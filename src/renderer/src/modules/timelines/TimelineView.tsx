import { useEffect, useState } from 'react'
import type { EventPatch, EraPatch, TimelineDetail, TimelineEvent, TimelineVersion } from '@shared/types'
import { tt } from '@/i18n/timelines'
import { useTimelines } from '@/store/timelines'
import { useCards } from '@/store/cards'
import { EventPicker } from './EventPicker'
import { lifeKindFor } from '@/lib/lives'
import type { LifeEnd, LifeStart } from '@shared/types'
import { useUi } from '@/store/ui'
import { ERA_PALETTE, TimelineStrip } from './TimelineStrip'
import { TimelineSidebar } from './TimelineSidebar'

const bySort = (a: TimelineEvent, b: TimelineEvent): number => a.sort_value - b.sort_value

export function TimelineView({ timelineId }: { timelineId: string }): JSX.Element {
  const summary = useTimelines((s) => s.list.find((t) => t.id === timelineId) ?? null)
  const focus = useTimelines((s) => s.focus)
  const clearFocus = useTimelines((s) => s.clearFocus)
  const renameTimeline = useTimelines((s) => s.renameTimeline)
  const setUnit = useTimelines((s) => s.setUnit)
  const removeTimeline = useTimelines((s) => s.removeTimeline)
  const openNameDialog = useUi((s) => s.openNameDialog)
  const showToast = useUi((s) => s.showToast)

  const [detail, setDetail] = useState<TimelineDetail | null>(null)
  const [mode, setMode] = useState<'strip' | 'list'>('strip')
  const [version, setVersion] = useState('canon')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [unitDraft, setUnitDraft] = useState('')
  const [pickingEvent, setPickingEvent] = useState(false)
  const cards = useCards((s) => s.cards)
  const types = useCards((s) => s.types)

  const reload = (): Promise<void> => window.api.timelines.detail(timelineId).then(setDetail)

  useEffect(() => {
    let alive = true
    window.api.timelines.detail(timelineId).then((d) => alive && setDetail(d))
    return () => {
      alive = false
    }
  }, [timelineId])

  useEffect(() => setUnitDraft(summary?.unit ?? ''), [summary?.unit])

  // veio de um card: troca para a versão do evento e seleciona-o
  useEffect(() => {
    if (!detail || !focus || focus.timelineId !== timelineId) return
    const ev = detail.events.find((e) => e.id === focus.eventId)
    if (ev) {
      setVersion(ev.version)
      setSelectedId(ev.id)
    }
    clearFocus()
  }, [detail, focus, timelineId, clearFocus])

  if (!summary || !detail) return <div className="p-10 text-muted">…</div>

  const events = detail.events
  const visible = events.filter((e) => e.version === version)
  const selected = events.find((e) => e.id === selectedId) ?? null
  const versionNames = ['canon', ...detail.versions.map((v) => v.name)]
  const activeVersion = versionNames.includes(version) ? version : 'canon'
  const shown = events.filter((e) => e.version === activeVersion)
  const withTitle = (e: TimelineEvent): TimelineEvent => ({ ...e, title: cards.find((c) => c.id === e.card_id)?.title ?? e.title })
  const livesT = detail.lives.map((l) => ({ ...l, title: cards.find((c) => c.id === l.card_id)?.title ?? '' }))
  const PLACE = /lugar|local|facc|cidade|reino|vila|regi|fortaleza|ilha|pais/

  // Adiciona um card à faixa; lugares começam com "fundação" e terminam com "abandono".
  const addLife = async (cardId: string): Promise<void> => {
    const c = cards.find((x) => x.id === cardId)
    const typeName = types.find((t) => t.id === c?.type_id)?.name ?? ''
    const kind = lifeKindFor(typeName)
    const start = kind.start
    const saved = await window.api.lives.upsert(timelineId, cardId, {
      start_value: 0,
      start_kind: start as LifeStart,
      end_value: null,
      end_kind: null
    })
    setDetail((d) => d && { ...d, lives: [...d.lives.filter((l) => l.id !== saved.id), saved] })
  }

  const patchLife = (id: string, p: { start_value?: number; start_kind?: LifeStart; end_value?: number | null; end_kind?: LifeEnd | null }): void => {
    setDetail((d) => d && { ...d, lives: d.lives.map((l) => (l.id === id ? { ...l, ...p } : l)) })
    void window.api.lives.patch(id, p)
  }

  const removeLife = async (id: string): Promise<void> => {
    await window.api.lives.remove(id)
    setDetail((d) => d && { ...d, lives: d.lives.filter((l) => l.id !== id) })
  }

  // ---------- eventos ----------
  const patchEvent = (id: string, p: EventPatch): void => {
    setDetail((d) => d && { ...d, events: d.events.map((e) => (e.id === id ? { ...e, ...p } : e)) })
    void window.api.timelines.updateEvent(id, p)
  }

  // Adiciona à linha um evento já criado (o título vem do card).
  const addEventFromCard = async (cardId: string): Promise<void> => {
    const c = cards.find((x) => x.id === cardId)
    const max = events.reduce((m, e) => Math.max(m, e.sort_value), 0)
    const ev = await window.api.timelines.createEvent(timelineId, {
      title: c?.title ?? tt.defaults.event,
      description: null,
      sort_value: events.length ? max + 1 : 0,
      date_label: null,
      era_id: null,
      version: activeVersion,
      card_id: cardId
    })
    setDetail((d) => d && { ...d, events: [...d.events, ev].sort(bySort) })
    setSelectedId(ev.id)
    setPickingEvent(false)
  }

  const removeEvent = async (id: string): Promise<void> => {
    if (!window.confirm(tt.event.confirmDelete)) return
    await window.api.timelines.removeEvent(id)
    setDetail((d) => d && { ...d, events: d.events.filter((e) => e.id !== id) })
    setSelectedId((s) => (s === id ? null : s))
  }

  // ---------- eras ----------
  const patchEra = (id: string, p: EraPatch): void => {
    setDetail((d) => d && { ...d, eras: d.eras.map((e) => (e.id === id ? { ...e, ...p } : e)) })
    void window.api.timelines.updateEra(id, p)
  }

  const addEra = async (): Promise<void> => {
    const ends = detail.eras.map((e) => e.end_value ?? e.start_value ?? 0)
    const start = ends.length ? Math.max(...ends) : 0
    const era = await window.api.timelines.createEra(timelineId, {
      name: tt.defaults.era,
      color: ERA_PALETTE[detail.eras.length % ERA_PALETTE.length],
      start_value: start,
      end_value: start + 100
    })
    setDetail((d) => d && { ...d, eras: [...d.eras, era] })
  }

  const removeEra = async (id: string): Promise<void> => {
    await window.api.timelines.removeEra(id)
    setDetail((d) =>
      d && { ...d, eras: d.eras.filter((e) => e.id !== id), events: d.events.map((e) => (e.era_id === id ? { ...e, era_id: null } : e)) }
    )
  }

  // ---------- versões ----------
  const guard = async (fn: () => Promise<unknown>): Promise<void> => {
    try {
      await fn()
      await reload()
    } catch (err) {
      const msg = (err as Error).message
      showToast(msg.includes('UNIQUE') ? tt.versionExists : msg)
    }
  }

  const addVersion = (): void =>
    openNameDialog({
      title: tt.newVersion, label: tt.versionName, initial: '', submit: tt.create,
      onSubmit: (name) => guard(async () => {
        const v = await window.api.timelines.createVersion(summary.world_id, name)
        setVersion(v.name)
      })
    })

  const renameVersion = (v: TimelineVersion): void =>
    openNameDialog({
      title: tt.renameVersion, label: tt.versionName, initial: v.name, submit: tt.rename,
      onSubmit: (name) => guard(async () => {
        await window.api.timelines.renameVersion(v.id, name)
        if (version === v.name) setVersion(name.trim())
      })
    })

  const removeVersion = (v: TimelineVersion): void => {
    if (!window.confirm(tt.confirmDeleteVersion(v.name))) return
    void guard(async () => {
      await window.api.timelines.removeVersion(v.id)
      if (version === v.name) setVersion('canon')
    })
  }

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-line bg-panel px-4 py-2">
        <h1 className="max-w-xs truncate font-serif text-2xl">{summary.name}</h1>
        <button
          onClick={() => openNameDialog({ title: tt.rename, label: tt.timelineName, initial: summary.name, submit: tt.rename, onSubmit: (v) => renameTimeline(timelineId, v) })}
          className="rounded px-2 py-1 text-xs text-muted hover:text-ink"
        >
          {tt.rename}
        </button>

        <label className="flex items-center gap-2 text-muted">
          {tt.unit}
          <input
            aria-label={tt.unitHint}
            placeholder={tt.unitHint}
            value={unitDraft}
            onChange={(e) => setUnitDraft(e.target.value)}
            onBlur={() => unitDraft.trim() !== summary.unit && setUnit(timelineId, unitDraft.trim())}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            className="w-24 rounded border border-line bg-raised px-2 py-1 text-ink"
          />
        </label>

        <label className="flex items-center gap-2 text-muted">
          {tt.version}
          <select aria-label={tt.version} value={activeVersion} onChange={(e) => setVersion(e.target.value)} className="rounded border border-line bg-raised px-2 py-1 text-ink">
            <option value="canon">{tt.canon}</option>
            {detail.versions.map((v) => <option key={v.id} value={v.name}>{v.name}</option>)}
          </select>
        </label>

        <div role="group" aria-label={tt.mode.strip} className="flex gap-1">
          {(['strip', 'list'] as const).map((m) => (
            <button
              key={m}
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={`rounded px-2.5 py-1 ${mode === m ? 'bg-raised text-ink' : 'text-muted hover:text-ink'}`}
            >
              {tt.mode[m]}
            </button>
          ))}
        </div>

        <span className="ml-auto flex items-center gap-1">
          {mode === 'strip' && (
            <>
              <button aria-label={tt.zoomOut} onClick={() => setZoom((z) => Math.max(0.5, z / 1.25))} className="rounded px-2 py-1 text-muted hover:text-ink">−</button>
              <button aria-label={tt.zoomIn} onClick={() => setZoom((z) => Math.min(6, z * 1.25))} className="rounded px-2 py-1 text-muted hover:text-ink">+</button>
            </>
          )}
          <button onClick={() => setPickingEvent(true)} className="ml-2 rounded bg-accent px-3 py-1.5 font-medium text-accent-ink">{tt.newEvent}</button>
          <button
            onClick={() => window.confirm(tt.confirmDeleteTimeline(summary.name)) && removeTimeline(timelineId)}
            className="ml-3 rounded px-2 py-1 text-muted hover:text-danger"
          >
            {tt.deleteTimeline}
          </button>
        </span>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-auto bg-bg">
          {events.length === 0 && detail.eras.length === 0 ? (
            <p className="mx-auto mt-24 max-w-sm text-center text-muted">{tt.empty}</p>
          ) : shown.length === 0 && mode === 'list' ? (
            <p className="mx-auto mt-24 max-w-sm text-center text-muted">{tt.emptyVersion}</p>
          ) : mode === 'strip' ? (
            <div className="p-6">
              <TimelineStrip
                eras={detail.eras}
                events={visible.map(withTitle)}
                unit={summary.unit}
                zoom={zoom}
                lives={livesT}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            </div>
          ) : (
            <table className="w-full border-collapse text-left">
              <thead className="sticky top-0 bg-panel text-muted">
                <tr>
                  <th className="px-4 py-2 font-normal">{tt.cols.when}</th>
                  <th className="px-4 py-2 font-normal">{tt.cols.title}</th>
                  <th className="px-4 py-2 font-normal">{tt.cols.era}</th>
                  <th className="px-4 py-2 font-normal">{tt.cols.version}</th>
                </tr>
              </thead>
              <tbody>
                {[...shown].sort(bySort).map(withTitle).map((e) => (
                  <tr
                    key={e.id}
                    onClick={() => setSelectedId(e.id)}
                    className={`cursor-pointer border-b border-line ${e.id === selectedId ? 'bg-raised' : 'hover:bg-panel'}`}
                  >
                    <td className="px-4 py-2 text-muted">{e.date_label || `${e.sort_value} ${summary.unit}`}</td>
                    <td className="px-4 py-2">{e.title}</td>
                    <td className="px-4 py-2 text-muted">{detail.eras.find((x) => x.id === e.era_id)?.name ?? tt.noEra}</td>
                    <td className="px-4 py-2 text-muted">{e.version === 'canon' ? tt.canon : e.version}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {pickingEvent && (
          <EventPicker
            usedIds={new Set(events.flatMap((e) => (e.card_id ? [e.card_id] : [])))}
            onPick={(id) => void addEventFromCard(id)}
            onClose={() => setPickingEvent(false)}
          />
        )}
        <TimelineSidebar
          detail={detail}
          event={selected}
          lives={livesT}
          onAddLife={(id) => void addLife(id)}
          onPatchLife={patchLife}
          onRemoveLife={(id) => void removeLife(id)}
          onPatchEvent={patchEvent}
          onRemoveEvent={removeEvent}
          onPatchEra={patchEra}
          onAddEra={addEra}
          onRemoveEra={removeEra}
          onAddVersion={addVersion}
          onRenameVersion={renameVersion}
          onRemoveVersion={removeVersion}
        />
      </div>
    </div>
  )
}
