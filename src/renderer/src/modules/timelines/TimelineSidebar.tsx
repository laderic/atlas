import { useState } from 'react'
import { norm } from '@/lib/mentions'
import { lifeKindFor } from '@/lib/lives'
import type { EraPatch, EventPatch, LifeEnd, LifeStart, TimelineDetail, TimelineEvent, TimelineVersion } from '@shared/types'
import { Modal } from '@/components/Modal'
import { t } from '@/i18n/pt-BR'
import { tt } from '@/i18n/timelines'
import { te } from '@/i18n/events'
import { tl } from '@/i18n/lives'
import { useCards } from '@/store/cards'
import { ERA_PALETTE, type LifeWithTitle } from './TimelineStrip'

interface Props {
  detail: TimelineDetail
  event: TimelineEvent | null
  lives: LifeWithTitle[]
  onPatchEvent: (id: string, p: EventPatch) => void
  onRemoveEvent: (id: string) => void
  onPatchEra: (id: string, p: EraPatch) => void
  onAddEra: () => void
  onRemoveEra: (id: string) => void
  onAddVersion: () => void
  onRenameVersion: (v: TimelineVersion) => void
  onRemoveVersion: (v: TimelineVersion) => void
  onAddLife: (cardId: string) => void
  onPatchLife: (id: string, p: { start_value?: number; start_kind?: LifeStart; end_value?: number | null; end_kind?: LifeEnd | null }) => void
  onRemoveLife: (id: string) => void
}

const field = 'w-full rounded border border-line bg-raised px-2.5 py-1.5'
const label = 'mb-1 block text-xs uppercase tracking-wide text-muted'
const compact = 'rounded border border-line bg-raised px-1.5 py-0.5 text-xs outline-none'
const numOrNull = (v: string): number | null => (v.trim() === '' || Number.isNaN(Number(v)) ? null : Number(v))

function LifePicker({ usedIds, onPick, onClose }: { usedIds: Set<string>; onPick: (id: string) => void; onClose: () => void }): JSX.Element {
  const [q, setQ] = useState('')
  const nq = norm(q.trim())
  const list = useCards((s) => s.cards).filter((c) => !usedIds.has(c.id) && (!nq || norm(c.title).includes(nq)))
  return (
    <Modal title={tl.pickLife} onClose={onClose} width={440}>
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={tl.searchCards}
        aria-label={tl.searchCards}
        className="mb-3 w-full rounded border border-line bg-raised px-3 py-2 outline-none"
      />
      {list.length === 0 ? (
        <p className="text-muted">{tl.noCardsLeft}</p>
      ) : (
        <ul className="max-h-80 overflow-y-auto">
          {list.map((c) => (
            <li key={c.id}>
              <button onClick={() => onPick(c.id)} className="w-full truncate rounded px-3 py-2 text-left hover:bg-raised">{c.title}</button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex justify-end">
        <button onClick={onClose} className="rounded px-4 py-2 text-muted hover:text-ink">{t.cancel}</button>
      </div>
    </Modal>
  )
}

export function TimelineSidebar(p: Props): JSX.Element {
  const { detail, event, lives, onPatchEvent, onRemoveEvent, onPatchEra, onAddEra, onRemoveEra, onPatchLife, onRemoveLife } = p
  const cards = useCards((s) => s.cards)
  const openCard = useCards((s) => s.openCard)
  const [pickingLife, setPickingLife] = useState(false)
  const [lq, setLq] = useState('')
  const nlq = norm(lq.trim())
  const types = useCards((s) => s.types)
  const endFor = (cardId: string): LifeEnd => lifeKindFor(types.find((t) => t.id === cards.find((c) => c.id === cardId)?.type_id)?.name).end
  const title = event ? (cards.find((c) => c.id === event.card_id)?.title ?? event.title) : ''
  const versionNames = [tt.canon, ...detail.versions.map((v) => v.name)]
  const versionKeys = ['canon', ...detail.versions.map((v) => v.name)]
  const fmtVal = (v: number): string => Number(v.toFixed(2)).toLocaleString('pt-BR')

  return (
    <aside className="w-80 shrink-0 space-y-7 overflow-y-auto border-l border-line bg-panel p-4">
      {event ? (
        <section aria-label={te.events}>
          <h3 className="mb-3 font-serif text-lg">{te.events}</h3>
          <div className="space-y-3">
            <div>
              <span className={label}>{te.events}</span>
              <button onClick={() => event.card_id && openCard(event.card_id)} className="w-full truncate rounded border border-line bg-raised px-2.5 py-1.5 text-left text-accent hover:underline">
                {title}
              </button>
            </div>
            <div>
              <label htmlFor="ev-date" className={label}>{te.dateLabel}</label>
              <input id="ev-date" className={field} value={event.date_label ?? ''} onChange={(e) => onPatchEvent(event.id, { date_label: e.target.value || null })} />
            </div>
            <div>
              <label htmlFor="ev-pos" className={label}>{te.positionLabel}</label>
              <input
                id="ev-pos"
                type="number"
                className={field}
                value={event.sort_value}
                onChange={(e) => {
                  const n = numOrNull(e.target.value)
                  if (n !== null) onPatchEvent(event.id, { sort_value: n })
                }}
              />
              <p className="mt-1 text-xs text-muted">{tt.event.positionHint}</p>
            </div>
            <div>
              <label htmlFor="ev-era" className={label}>{tt.event.era}</label>
              <select id="ev-era" className={field} value={event.era_id ?? ''} onChange={(e) => onPatchEvent(event.id, { era_id: e.target.value || null })}>
                <option value="">{tt.noEra}</option>
                {detail.eras.map((era) => <option key={era.id} value={era.id}>{era.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="ev-ver" className={label}>{tt.event.version}</label>
              <select id="ev-ver" className={field} value={event.version} onChange={(e) => onPatchEvent(event.id, { version: e.target.value })}>
                {versionKeys.map((k, i) => <option key={k} value={k}>{versionNames[i]}</option>)}
              </select>
            </div>
            <button onClick={() => onRemoveEvent(event.id)} className="text-muted hover:text-danger">{te.removeFromLine}</button>
          </div>
        </section>
      ) : (
        <p className="text-muted">{tt.noSelection}</p>
      )}

      <section aria-label={tl.lanesTitle}>
        <h3 className="mb-1 font-serif text-lg">{tl.lanesTitle}</h3>
        <p className="mb-3 text-xs text-muted">{tl.lanesHelp}</p>
        {lives.length > 6 && (
          <input
            value={lq}
            onChange={(e) => setLq(e.target.value)}
            placeholder={tl.searchCards}
            aria-label={tl.searchCards}
            className="mb-2 w-full rounded border border-line bg-raised px-2.5 py-1.5 text-sm outline-none"
          />
        )}
        {lives.length === 0 && <p className="mb-3 text-sm text-muted">{tl.noLanes}</p>}
        <div className={lives.length > 6 ? 'max-h-[26rem] overflow-y-auto rounded border border-line' : ''}>
        <ul className="divide-y divide-line overflow-hidden rounded border border-line">
          {[...lives]
            .sort((a, b) => a.start_value - b.start_value)
            .filter((l) => !nlq || norm(l.title).includes(nlq))
            .map((l) => (
              <li key={l.id} className="px-2.5 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <button onClick={() => openCard(l.card_id)} className="min-w-0 flex-1 truncate text-left font-medium text-accent hover:underline">{l.title}</button>
                  <button onClick={() => onRemoveLife(l.id)} aria-label={`${tl.removeLife}: ${l.title}`} className="text-muted hover:text-danger">×</button>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                  <select aria-label={`${tl.startLabel}: ${l.title}`} className={compact} value={l.start_kind} onChange={(e) => onPatchLife(l.id, { start_kind: e.target.value as LifeStart })}>
                    <option value="nascimento">{tl.kinds.nascimento}</option>
                    <option value="fundacao">{tl.kinds.fundacao}</option>
                  </select>
                  <input
                    type="number"
                    aria-label={`${tl.startLabel} valor: ${l.title}`}
                    className={`${compact} w-20`}
                    value={l.start_value}
                    onChange={(e) => {
                      const n = numOrNull(e.target.value)
                      if (n !== null) onPatchLife(l.id, { start_value: n })
                    }}
                  />
                  <span className="text-muted">→</span>
                  {l.end_value == null ? (
                    <button onClick={() => onPatchLife(l.id, { end_value: l.start_value + 100, end_kind: endFor(l.card_id) })} className={`${compact} border-dashed text-muted hover:text-ink`}>
                      {tl.markEnd}
                    </button>
                  ) : (
                    <>
                      <select aria-label={`${tl.endLabel}: ${l.title}`} className={compact} value={l.end_kind ?? 'fim'} onChange={(e) => onPatchLife(l.id, { end_kind: e.target.value as LifeEnd })}>
                        <option value="morte">{tl.kinds.morte}</option>
                        <option value="abandono">{tl.kinds.abandono}</option>
                        <option value="destruicao">{tl.kinds.destruicao}</option>
                        <option value="dissolucao">{tl.kinds.dissolucao}</option>
                        <option value="fim">{tl.kinds.fim}</option>
                      </select>
                      <input
                        type="number"
                        aria-label={`${tl.endLabel} valor: ${l.title}`}
                        className={`${compact} w-20`}
                        value={l.end_value}
                        onChange={(e) => {
                          const n = numOrNull(e.target.value)
                          if (n !== null) onPatchLife(l.id, { end_value: n })
                        }}
                      />
                      <button onClick={() => onPatchLife(l.id, { end_value: null, end_kind: null })} aria-label={`${tl.removeEnd}: ${l.title}`} title={tl.removeEnd} className="text-muted hover:text-ink">×</button>
                    </>
                  )}
                </div>
              </li>
            ))}
        </ul>
        </div>
        <button onClick={() => setPickingLife(true)} className="mt-3 text-accent hover:underline">{tl.addLife}</button>
        {pickingLife && (
          <LifePicker
            usedIds={new Set(lives.map((l) => l.card_id))}
            onPick={(id) => {
              setPickingLife(false)
              p.onAddLife(id)
            }}
            onClose={() => setPickingLife(false)}
          />
        )}
      </section>

      <section aria-label={tt.era.section}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-serif text-lg">{tt.era.section}</h3>
        </div>
        {detail.eras.length === 0 && <p className="mb-3 text-muted">{tt.era.none}</p>}
        <ul className="space-y-4">
          {detail.eras.map((era, i) => (
            <li key={era.id} className="rounded border border-line p-3">
              <div className="mb-2 flex items-center gap-2">
                <input aria-label={tt.era.name} className={`${field} min-w-0 flex-1`} value={era.name} onChange={(e) => onPatchEra(era.id, { name: e.target.value })} />
                <input
                  type="color"
                  aria-label={tt.era.color}
                  value={era.color ?? ERA_PALETTE[i % ERA_PALETTE.length]}
                  onChange={(e) => onPatchEra(era.id, { color: e.target.value })}
                  className="h-8 w-9 shrink-0 rounded border border-line bg-raised p-0.5"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className={label}>{tt.era.start}</span>
                  <input type="number" aria-label={tt.era.start} className={field} value={era.start_value ?? ''} onChange={(e) => onPatchEra(era.id, { start_value: numOrNull(e.target.value) })} />
                </div>
                <div>
                  <span className={label}>{tt.era.end}</span>
                  <input type="number" aria-label={tt.era.end} className={field} value={era.end_value ?? ''} onChange={(e) => onPatchEra(era.id, { end_value: numOrNull(e.target.value) })} />
                </div>
              </div>
              <button onClick={() => window.confirm(tt.era.confirmDelete(era.name)) && onRemoveEra(era.id)} className="mt-2 text-xs text-muted hover:text-danger">
                {tt.deleteOne}
              </button>
            </li>
          ))}
        </ul>
        <button onClick={onAddEra} className="mt-3 text-accent hover:underline">{tt.era.add}</button>
      </section>

      <section aria-label={tt.versionsSection}>
        <h3 className="mb-1 font-serif text-lg">{tt.versionsSection}</h3>
        <p className="mb-3 text-xs text-muted">{tt.versionsHint}</p>
        <ul className="space-y-1">
          <li className="px-2 py-1 text-muted">{tt.canon}</li>
          {detail.versions.map((v) => (
            <li key={v.id} className="group flex items-center justify-between rounded px-2 py-1 hover:bg-raised">
              <span className="truncate">{v.name}</span>
              <span className="invisible flex gap-2 group-hover:visible">
                <button aria-label={`${tt.renameVersion}: ${v.name}`} onClick={() => p.onRenameVersion(v)} className="text-xs text-muted hover:text-ink">✎</button>
                <button aria-label={`${tt.deleteVersion}: ${v.name}`} onClick={() => p.onRemoveVersion(v)} className="text-xs text-muted hover:text-danger">×</button>
              </span>
            </li>
          ))}
        </ul>
        <button onClick={p.onAddVersion} className="mt-2 text-accent hover:underline">+ {tt.newVersion}</button>
      </section>
    </aside>
  )
}
