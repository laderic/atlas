import type { CanvasElement, CanvasNodeData } from '@shared/types'
import { PALETTE } from '@/modules/maps/MapInspector'
import { tk } from '@/i18n/canvas'
import { useCards } from '@/store/cards'

interface Props {
  el: CanvasElement | null
  relationTree: boolean
  mediaName: string | null
  onPatch: (p: Partial<CanvasNodeData>) => void
  onRemove: () => void
  onOpenCard: (id: string) => void
}

const field = 'w-full rounded border border-line bg-raised px-2.5 py-1.5'

export function CanvasInspector({ el, relationTree, mediaName, onPatch, onRemove, onOpenCard }: Props): JSX.Element {
  const cards = useCards((s) => s.cards)
  if (!el) {
    return (
      <aside className="w-72 shrink-0 border-l border-line bg-panel p-4">
        <h3 className="mb-2 font-serif text-lg">{tk.inspector}</h3>
        <p className="text-muted">{tk.noSelection}</p>
      </aside>
    )
  }

  const colorPicker = (current: string | undefined, fallback: string): JSX.Element => (
    <div className="mb-4 flex flex-wrap items-center gap-1.5">
      {PALETTE.map((c) => (
        <button
          key={c}
          aria-label={c}
          aria-pressed={current === c}
          onClick={() => onPatch({ color: c })}
          className="h-6 w-6 rounded-full border-2"
          style={{ background: c, borderColor: current === c ? '#fff' : 'transparent' }}
        />
      ))}
      <input type="color" aria-label={tk.color} value={current ?? fallback} onChange={(e) => onPatch({ color: e.target.value })} className="h-6 w-8 rounded border border-line bg-raised p-0.5" />
    </div>
  )

  return (
    <aside className="w-72 shrink-0 overflow-y-auto border-l border-line bg-panel p-4">
      <h3 className="mb-1 font-serif text-lg">{tk.inspector}</h3>
      <p className="mb-4 text-xs uppercase tracking-wide text-muted">{tk.itemKind[el.kind]}</p>

      {el.kind === 'note' && (
        <>
          <label htmlFor="ci-text" className="mb-1 block text-muted">{tk.text}</label>
          <textarea id="ci-text" rows={6} value={el.data.text ?? ''} onChange={(e) => onPatch({ text: e.target.value })} className={`${field} mb-4 resize-y`} />
          <span className="mb-1 block text-muted">{tk.color}</span>
          {colorPicker(el.data.color, '#21253a')}
        </>
      )}

      {el.kind === 'shape' && (
        <>
          <label htmlFor="ci-label" className="mb-1 block text-muted">{tk.label}</label>
          <input id="ci-label" value={el.data.label ?? ''} onChange={(e) => onPatch({ label: e.target.value })} className={`${field} mb-4`} />
          <label htmlFor="ci-shape" className="mb-1 block text-muted">{tk.shape}</label>
          <select id="ci-shape" value={el.data.shape ?? 'rect'} onChange={(e) => onPatch({ shape: e.target.value as 'rect' | 'ellipse' })} className={`${field} mb-4`}>
            <option value="rect">{tk.shapes.rect}</option>
            <option value="ellipse">{tk.shapes.ellipse}</option>
          </select>
          <span className="mb-1 block text-muted">{tk.color}</span>
          {colorPicker(el.data.color, '#7fb7a4')}
        </>
      )}

      {el.kind === 'card' && el.card_id && (
        <>
          <p className="mb-4 text-lg">{cards.find((c) => c.id === el.card_id)?.title ?? '—'}</p>
          <button onClick={() => onOpenCard(el.card_id!)} className="mb-6 w-full rounded border border-line px-3 py-1.5 hover:bg-raised">{tk.openCard}</button>
        </>
      )}

      {el.kind === 'image' && <p className="mb-6 break-all text-muted">{mediaName ?? '—'}</p>}

      {el.kind === 'edge' && (
        <>
          <label htmlFor="ci-rel" className="mb-1 block text-muted">{relationTree ? tk.relationLabel : tk.label}</label>
          <input id="ci-rel" value={el.data.label ?? ''} onChange={(e) => onPatch({ label: e.target.value })} className={`${field} mb-4`} />
          {!relationTree && (
            <>
              <span className="mb-1 block text-muted">{tk.color}</span>
              {colorPicker(el.data.color, '#9a9cab')}
            </>
          )}
        </>
      )}

      <button onClick={onRemove} className="text-muted hover:text-danger">{tk.removeItem}</button>
    </aside>
  )
}
