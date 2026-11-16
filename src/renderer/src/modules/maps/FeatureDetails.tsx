import { useEffect, useMemo, useState } from 'react'
import type { MapFeature, MapFeaturePatch } from '@shared/types'
import { ItemPicker } from '@/components/ItemPicker'
import { Modal } from '@/components/Modal'
import { tmap } from '@/i18n/maps'
import { docToText } from '@/lib/mentions'
import { useCards } from '@/store/cards'
import { useMaps } from '@/store/maps'

interface Props {
  feature: MapFeature
  currentMapId: string
  onPatch: (patch: MapFeaturePatch) => void
  onClose: () => void
}

export function FeatureDetails({ feature, currentMapId, onPatch, onClose }: Props): JSX.Element {
  const cards = useCards((s) => s.cards)
  const types = useCards((s) => s.types)
  const openCard = useCards((s) => s.openCard)
  const maps = useMaps((s) => s.maps)
  const openMap = useMaps((s) => s.openMap)
  const [summary, setSummary] = useState('')

  const cardOptions = useMemo(
    () => cards.map((c) => ({ id: c.id, label: c.title, hint: types.find((t) => t.id === c.type_id)?.name })),
    [cards, types]
  )
  const mapOptions = useMemo(
    () => maps.filter((m) => m.id !== currentMapId).map((m) => ({ id: m.id, label: m.name })),
    [maps, currentMapId]
  )

  useEffect(() => {
    setSummary('')
    if (!feature.card_id) return
    let alive = true
    window.api.cards.get(feature.card_id).then((c) => {
      if (!alive || !c) return
      const text = docToText(c.content).replace(/\s+/g, ' ')
      setSummary(text.length > 320 ? `${text.slice(0, 320)}…` : text)
    })
    return () => {
      alive = false
    }
  }, [feature.card_id])

  const go = (fn: () => void): void => {
    onClose()
    fn()
  }

  return (
    <Modal title={feature.label || tmap.kindLabel[feature.kind]} onClose={onClose} width={560}>
      <p className="mb-4 text-xs uppercase tracking-wide text-muted">{tmap.kindLabel[feature.kind]}</p>

      <label htmlFor="fd-name" className="mb-1 block text-muted">{tmap.name}</label>
      <input
        id="fd-name"
        value={feature.label ?? ''}
        onChange={(e) => onPatch({ label: e.target.value })}
        className="mb-4 w-full rounded border border-line bg-raised px-3 py-2"
      />

      <label htmlFor="fd-notes" className="mb-1 block text-muted">{tmap.notes}</label>
      <textarea
        id="fd-notes"
        rows={4}
        value={feature.notes ?? ''}
        placeholder={tmap.notesPlaceholder}
        onChange={(e) => onPatch({ notes: e.target.value })}
        className="mb-4 w-full resize-y rounded border border-line bg-raised px-3 py-2"
      />

      <span className="mb-1 block text-muted">{tmap.linkedCard}</span>
      <ItemPicker value={feature.card_id} options={cardOptions} placeholder={tmap.pickCard} onChange={(id) => onPatch({ card_id: id })} />
      {feature.card_id && cards.some((c) => c.id === feature.card_id) && (
        <div className="mt-2 rounded border border-line bg-panel p-3">
          {summary && (
            <>
              <p className="mb-1 text-xs uppercase tracking-wide text-muted">{tmap.cardSummary}</p>
              <p className="mb-2 text-[13px] leading-relaxed">{summary}</p>
            </>
          )}
          <button onClick={() => go(() => openCard(feature.card_id!))} className="text-accent hover:underline">{tmap.openCard}</button>
        </div>
      )}

      {feature.kind !== 'label' && (
        <>
          <span className="mb-1 mt-4 block text-muted">{tmap.linkedMap}</span>
          <ItemPicker value={feature.child_map_id} options={mapOptions} placeholder={tmap.pickMap} onChange={(id) => onPatch({ child_map_id: id })} />
          {feature.child_map_id && maps.some((m) => m.id === feature.child_map_id) && (
            <button onClick={() => go(() => openMap(feature.child_map_id!))} className="mt-2 text-accent hover:underline">{tmap.openMap}</button>
          )}
        </>
      )}

      <div className="mt-6 flex justify-end">
        <button onClick={onClose} className="rounded bg-accent px-4 py-2 font-medium text-accent-ink">{tmap.close}</button>
      </div>
    </Modal>
  )
}
