import { useEffect, useRef } from 'react'
import type { FeatureStyle, MapFeature, MapFeaturePatch } from '@shared/types'
import { tmap } from '@/i18n/maps'

export const PALETTE = ['#7fb7a4', '#e0a96d', '#b58ad6', '#e07a6b', '#6da7e0', '#e0c76d', '#9bd16d', '#e8e4d9']

interface Props {
  feature: MapFeature | null
  autoFocusName: boolean
  cardTitle: string | null
  mapName: string | null
  onPatch: (patch: MapFeaturePatch) => void
  onDetails: () => void
  onDelete: () => void
}

export function MapInspector({ feature, autoFocusName, cardTitle, mapName, onPatch, onDetails, onDelete }: Props): JSX.Element {
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (feature && autoFocusName) {
      nameRef.current?.focus()
      nameRef.current?.select()
    }
  }, [feature?.id, autoFocusName])

  if (!feature) {
    return (
      <aside className="w-72 shrink-0 border-l border-line bg-panel p-4">
        <h3 className="mb-2 font-serif text-lg">{tmap.inspector}</h3>
        <p className="text-muted">{tmap.nothingSelected}</p>
      </aside>
    )
  }

  const style = feature.style
  const setStyle = (s: Partial<FeatureStyle>): void => onPatch({ style: { ...style, ...s } })
  const sizable = feature.kind === 'pin' || feature.kind === 'label' || feature.kind === 'path'

  return (
    <aside className="w-72 shrink-0 overflow-y-auto border-l border-line bg-panel p-4">
      <h3 className="mb-1 font-serif text-lg">{tmap.inspector}</h3>
      <p className="mb-4 text-xs uppercase tracking-wide text-muted">{tmap.kindLabel[feature.kind]}</p>

      <label htmlFor="mf-name" className="mb-1 block text-muted">{tmap.name}</label>
      <input
        id="mf-name"
        ref={nameRef}
        value={feature.label ?? ''}
        onChange={(e) => onPatch({ label: e.target.value })}
        className="mb-4 w-full rounded border border-line bg-raised px-2.5 py-1.5"
      />

      <span className="mb-1 block text-muted">{tmap.color}</span>
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {PALETTE.map((c) => (
          <button
            key={c}
            aria-label={c}
            aria-pressed={style.color === c}
            onClick={() => setStyle({ color: c })}
            className="h-6 w-6 rounded-full border-2"
            style={{ background: c, borderColor: style.color === c ? '#fff' : 'transparent' }}
          />
        ))}
        <input
          type="color"
          aria-label={tmap.color}
          value={style.color ?? '#7fb7a4'}
          onChange={(e) => setStyle({ color: e.target.value })}
          className="h-6 w-8 rounded border border-line bg-raised p-0.5"
        />
      </div>

      {sizable && (
        <>
          <label htmlFor="mf-size" className="mb-1 block text-muted">{tmap.size}</label>
          <select
            id="mf-size"
            value={style.size ?? 'md'}
            onChange={(e) => setStyle({ size: e.target.value as FeatureStyle['size'] })}
            className="mb-4 w-full rounded border border-line bg-raised px-2.5 py-1.5"
          >
            {(['sm', 'md', 'lg'] as const).map((k) => <option key={k} value={k}>{tmap.sizes[k]}</option>)}
          </select>
        </>
      )}

      {feature.kind === 'path' && (
        <label className="mb-4 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!style.dash} onChange={(e) => setStyle({ dash: e.target.checked })} />
          {tmap.dashed}
        </label>
      )}
      {(feature.card_id || feature.child_map_id) && (
        <dl className="mb-4 space-y-1 text-muted">
          {feature.card_id && (
            <div><dt className="inline">{tmap.linkedCard}: </dt><dd className="inline text-ink">{cardTitle ?? tmap.removed}</dd></div>
          )}
          {feature.child_map_id && (
            <div><dt className="inline">{tmap.linkedMap}: </dt><dd className="inline text-ink">{mapName ?? tmap.removed}</dd></div>
          )}
        </dl>
      )}

      <button onClick={onDetails} className="mb-6 w-full rounded border border-line px-3 py-1.5 hover:bg-raised">{tmap.details}</button>
      <button onClick={onDelete} className="text-muted hover:text-danger">{tmap.deleteFeature}</button>
    </aside>
  )
}
