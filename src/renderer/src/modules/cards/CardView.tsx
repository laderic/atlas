import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Card, CardMapRef, CardPatch, CardSummary, EventRef, Folder, SheetSummary } from '@shared/types'
import { tc } from '@/i18n/cards'
import { refreshMentionLabels } from '@/lib/mentions'
import { tm } from '@/i18n/media'
import { tg } from '@/i18n/tags'
import { TagsEditor } from './TagsEditor'
import { te } from '@/i18n/events'
import { EVENT_FIELDS } from '@/lib/events'
import { InventoryEditor } from '@/modules/events/InventoryEditor'
import { LivesInfo } from '@/modules/timelines/LivesInfo'
import { ParticipantsEditor } from '@/modules/events/ParticipantsEditor'
import { mediaUrl } from '@/lib/media'
import { tmap } from '@/i18n/maps'
import { tt } from '@/i18n/timelines'
import { ts } from '@/i18n/sheets'
import { useSheets } from '@/store/sheets'
import { useTimelines } from '@/store/timelines'
import { useCards } from '@/store/cards'
import { useMaps } from '@/store/maps'
import { useMedia } from '@/store/media'
import { MediaPicker } from '../media/MediaPicker'
import { PropertyFields } from './PropertyFields'
import { RichEditor } from './RichEditor'

export function folderPath(folders: Folder[], id: string): string {
  const parts: string[] = []
  let cur = folders.find((f) => f.id === id)
  while (cur) {
    parts.unshift(cur.name)
    cur = folders.find((f) => f.id === cur!.parent_id)
  }
  return parts.join(' / ')
}

export function CardView({ cardId }: { cardId: string }): JSX.Element {
  const { types, folders, patchSummary, removeCard, openCard, linksVersion } = useCards()
  const [card, setCard] = useState<Card | null>(null)
  const [doc, setDoc] = useState<Record<string, unknown> | null>(null)
  const [title, setTitle] = useState('')
  const [typeId, setTypeId] = useState<string | null>(null)
  const [folderId, setFolderId] = useState<string | null>(null)
  const [props, setProps] = useState<Record<string, unknown>>({})
  const [imageId, setImageId] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const [coverId, setCoverId] = useState<string | null>(null)
  const [pickingCover, setPickingCover] = useState(false)
  const mediaItems = useMedia((s) => s.items)
  const [status, setStatus] = useState<'saved' | 'dirty'>('saved')
  const [backlinks, setBacklinks] = useState<CardSummary[]>([])
  const [cardMaps, setCardMaps] = useState<CardMapRef[]>([])
  const [cardEvents, setCardEvents] = useState<EventRef[]>([])
  const [cardSheets, setCardSheets] = useState<SheetSummary[]>([])

  const pending = useRef<CardPatch>({})
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    let alive = true
    window.api.cards.get(cardId).then((c) => {
      if (!alive || !c) return
      const titles = new Map(useCards.getState().cards.map((x) => [x.id, x.title]))
      setCard(c)
      setDoc(refreshMentionLabels(c.content, titles))
      setTitle(c.title)
      setTypeId(c.type_id)
      setFolderId(c.folder_id)
      setProps(c.properties)
      setImageId(c.image_id)
      setCoverId(c.cover_media_id)
    })
    return () => {
      alive = false
    }
  }, [cardId])

  const flush = useCallback(async (): Promise<void> => {
    window.clearTimeout(timer.current)
    const patch = pending.current
    if (Object.keys(patch).length === 0) return
    pending.current = {}
    const summary = await window.api.cards.update(cardId, patch)
    patchSummary(summary)
    if (Object.keys(pending.current).length === 0) setStatus('saved')
  }, [cardId, patchSummary])

  // Salva o que sobrou ao fechar a aba.
  useEffect(() => () => void flush(), [flush])

  const schedule = (p: CardPatch): void => {
    pending.current = { ...pending.current, ...p }
    setStatus('dirty')
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => void flush(), 700)
  }

  useEffect(() => {
    window.api.cards.backlinks(cardId).then(setBacklinks)
  }, [cardId, linksVersion])

  useEffect(() => {
    window.api.maps.featuresForCard(cardId).then(setCardMaps)
  }, [cardId])

  useEffect(() => {
    window.api.timelines.eventsForCard(cardId).then(setCardEvents)
  }, [cardId, linksVersion])

  useEffect(() => {
    window.api.sheets.forCard(cardId).then(setCardSheets)
  }, [cardId, linksVersion])

  const type = useMemo(() => types.find((t) => t.id === typeId) ?? null, [types, typeId])
  const image = useMemo(() => mediaItems.find((m) => m.id === imageId) ?? null, [mediaItems, imageId])
  const cover = useMemo(() => mediaItems.find((m) => m.id === coverId) ?? null, [mediaItems, coverId])

  const onDelete = async (): Promise<void> => {
    if (!window.confirm(tc.confirmDeleteCard(title || tc.untitled))) return
    window.clearTimeout(timer.current)
    pending.current = {}
    await removeCard(cardId)
  }

  if (!card || !doc) return <div className="p-10 text-muted">…</div>

  const selectCls = 'rounded border border-line bg-raised px-2 py-1 text-ink'

  return (
    <div className="flex h-full">
      <div className="min-w-0 flex-1 overflow-y-auto px-10 py-8">
        <div className="mx-auto max-w-3xl">
          <div className="group relative mb-6 h-48 overflow-hidden rounded-lg border border-line bg-raised">
            {cover ? (
              <img src={mediaUrl(cover)} alt={cover.name} className="h-full w-full object-cover" draggable={false} />
            ) : (
              <button onClick={() => setPickingCover(true)} className="flex h-full w-full items-center justify-center text-muted hover:text-ink">
                {tg.addCover}
              </button>
            )}
            {cover && (
              <div className="absolute bottom-2 right-2 flex gap-3 rounded bg-black/60 px-3 py-1.5 text-sm opacity-0 transition-opacity group-hover:opacity-100">
                <button onClick={() => setPickingCover(true)} className="text-white hover:underline">{tg.changeCover}</button>
                <button onClick={() => { setCoverId(null); schedule({ cover_media_id: null }) }} className="text-white hover:underline">{tg.removeCover}</button>
              </div>
            )}
          </div>
          <input
            value={title}
            aria-label={tc.cardTitle}
            placeholder={tc.untitled}
            onChange={(e) => {
              setTitle(e.target.value)
              schedule({ title: e.target.value })
            }}
            className="w-full bg-transparent font-serif text-4xl leading-tight outline-none placeholder:text-muted/40"
          />
          <div className="mt-3 flex flex-wrap items-center gap-3 text-muted">
            <label className="flex items-center gap-2">
              {tc.type}
              <select
                value={typeId ?? ''}
                onChange={(e) => {
                  const v = e.target.value || null
                  setTypeId(v)
                  schedule({ type_id: v })
                }}
                className={selectCls}
              >
                <option value="">{tc.noType}</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              {tc.folder}
              <select
                value={folderId ?? ''}
                onChange={(e) => {
                  const v = e.target.value || null
                  setFolderId(v)
                  schedule({ folder_id: v })
                }}
                className={selectCls}
              >
                <option value="">{tc.noFolder}</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>{folderPath(folders, f.id)}</option>
                ))}
              </select>
            </label>
            <span className="ml-auto text-xs" aria-live="polite">{status === 'saved' ? tc.saved : tc.saving}</span>
          </div>

          <div className="mt-6">
            <RichEditor
              initialContent={doc}
              selfId={cardId}
              onChange={(d) => schedule({ content: d })}
              onOpenCard={openCard}
            />
            {card.is_event ? <ParticipantsEditor eventId={cardId} /> : null}
          </div>
        </div>
      </div>

      <aside className="w-72 shrink-0 overflow-y-auto border-l border-line bg-panel p-4">
        <label className="mb-6 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!card.is_event}
            onChange={(e) => {
              const on = e.target.checked
              setCard((c) => (c ? { ...c, is_event: on ? 1 : 0 } : c))
              void window.api.eventCards.setFlag(cardId, on).then(() => useCards.getState().load(card.world_id))
            }}
          />
          {te.markEvent}
        </label>
        {!card.is_event && <InventoryEditor cardId={cardId} />}
        <LivesInfo cardId={cardId} />
        <TagsEditor cardId={cardId} />
        <h3 className="mb-3 font-serif text-lg">{tm.image}</h3>
        {image ? (
          <div className="mb-8">
            <img src={mediaUrl(image)} alt={image.name} className="mb-2 max-h-56 w-full rounded border border-line object-cover" />
            <div className="flex gap-4">
              <button onClick={() => setPicking(true)} className="text-accent hover:underline">{tm.changeImage}</button>
              <button
                onClick={() => { setImageId(null); schedule({ image_id: null }) }}
                className="text-muted hover:text-danger"
              >{tm.removeImage}</button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setPicking(true)}
            className="mb-8 flex h-28 w-full items-center justify-center rounded border border-dashed border-line text-muted hover:border-accent hover:text-ink"
          >
            + {tm.addImage}
          </button>
        )}

        <h3 className="mb-3 font-serif text-lg">{tc.properties}</h3>
        {(card.is_event || (type && type.fields.length > 0)) ? (
          <PropertyFields
            fields={[...(card.is_event ? EVENT_FIELDS : []), ...(type?.fields ?? [])]}
            values={props}
            onChange={(key, value) => {
              const next = { ...props, [key]: value }
              setProps(next)
              schedule({ properties: next })
            }}
          />
        ) : (
          <p className="text-muted">{type ? tc.noProperties : tc.noType}</p>
        )}

        <h3 className="mb-2 mt-8 font-serif text-lg">{tc.backlinks}</h3>
        {backlinks.length === 0 ? (
          <p className="text-muted">{tc.noBacklinks}</p>
        ) : (
          <ul className="space-y-1">
            {backlinks.map((b) => (
              <li key={b.id}>
                <button onClick={() => openCard(b.id)} className="w-full truncate rounded px-2 py-1 text-left hover:bg-raised">
                  {b.title}
                </button>
              </li>
            ))}
          </ul>
        )}

        <h3 className="mb-2 mt-8 font-serif text-lg">{tmap.appearsInMaps}</h3>
        {cardMaps.length === 0 ? (
          <p className="text-muted">{tmap.none}</p>
        ) : (
          <ul className="space-y-1">
            {cardMaps.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => useMaps.getState().openMap(r.map_id, r.id)}
                  className="w-full truncate rounded px-2 py-1 text-left hover:bg-raised"
                >
                  {r.map_name}{r.label ? ` · ${r.label}` : ''}
                </button>
              </li>
            ))}
          </ul>
        )}

        <h3 className="mb-2 mt-8 font-serif text-lg">{tt.appearsInTimelines}</h3>
        {cardEvents.length === 0 ? (
          <p className="text-muted">{tmap.none}</p>
        ) : (
          <ul className="space-y-1">
            {cardEvents.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => useTimelines.getState().openTimeline(r.timeline_id, r.id)}
                  className="w-full truncate rounded px-2 py-1 text-left hover:bg-raised"
                >
                  {r.title}
                  <span className="text-muted"> · {r.timeline_name}{r.version !== 'canon' ? ` (${r.version})` : ''}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <h3 className="mb-2 mt-8 flex items-center justify-between font-serif text-lg">
          {ts.sheetsOfCard}
          <button onClick={() => useSheets.getState().create(title || tc.untitled, 'ficha', cardId)} className="text-xs text-accent hover:underline">
            {ts.createFichaForCard}
          </button>
        </h3>
        {cardSheets.length === 0 ? (
          <p className="text-muted">{ts.noSheetsForCard}</p>
        ) : (
          <ul className="space-y-1">
            {cardSheets.map((sh) => (
              <li key={sh.id}>
                <button onClick={() => useSheets.getState().open(sh.id)} className="w-full truncate rounded px-2 py-1 text-left hover:bg-raised">
                  {sh.name}
                </button>
              </li>
            ))}
          </ul>
        )}

        <button onClick={onDelete} className="mt-10 text-muted hover:text-danger">{tc.deleteCard}</button>
      </aside>
      {pickingCover && (
        <MediaPicker
          title={tg.chooseCover}
          kinds={['image', 'gif']}
          onClose={() => setPickingCover(false)}
          onPick={(m) => { setCoverId(m.id); schedule({ cover_media_id: m.id }) }}
        />
      )}
      {picking && (
        <MediaPicker
          onClose={() => setPicking(false)}
          onPick={(m) => { setImageId(m.id); schedule({ image_id: m.id }) }}
        />
      )}
    </div>
  )
}
