import { useEffect, useState } from 'react'
import type { StockIndex } from '@shared/types'
import { Modal } from '@/components/Modal'
import { tm } from '@/i18n/media'
import { useMedia } from '@/store/media'
import { useUi } from '@/store/ui'
import { useWorkspace } from '@/store/workspace'

/** Estoque de arte por gênero: escolha imagens e importe para a biblioteca do mundo. */
export function StockDialog({ onClose }: { onClose: () => void }): JSX.Element {
  const worldId = useWorkspace((s) => s.activeWorldId)
  const showToast = useUi((s) => s.showToast)
  const [index, setIndex] = useState<StockIndex | null>(null)
  const [genre, setGenre] = useState<string>('all')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void window.api.stock.index().then(setIndex)
  }, [])

  const items = (index?.items ?? []).filter((i) => genre === 'all' || i.genre === genre)
  const toggle = (id: string): void =>
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const importPicked = async (): Promise<void> => {
    if (!worldId || picked.size === 0) return
    setBusy(true)
    try {
      const r = await window.api.stock.import(worldId, null, [...picked])
      await useMedia.getState().load(worldId)
      showToast(tm.imported(r.items.length))
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={tm.stockArt} onClose={onClose} width={780}>
      <div className="mb-3 flex flex-wrap gap-1.5">
        <button onClick={() => setGenre('all')} className={`rounded-full border px-3 py-1 text-sm ${genre === 'all' ? 'border-accent text-ink' : 'border-line text-muted'}`}>
          Todos · {index?.items.length ?? 0}
        </button>
        {(index?.genres ?? []).map((g) => (
          <button
            key={g.slug}
            onClick={() => setGenre(g.slug)}
            className={`rounded-full border px-3 py-1 text-sm ${genre === g.slug ? 'border-accent text-ink' : 'border-line text-muted'}`}
          >
            {g.label} · {index?.items.filter((i) => i.genre === g.slug).length ?? 0}
          </button>
        ))}
      </div>

      {!index ? (
        <p className="py-10 text-center text-muted">…</p>
      ) : (
        <div className="grid max-h-[55vh] grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2 overflow-y-auto">
          {items.map((it) => {
            const on = picked.has(it.id)
            return (
              <button
                key={it.id}
                onClick={() => toggle(it.id)}
                aria-pressed={on}
                title={`${it.genreLabel} · ${it.subgenre}`}
                className={`relative aspect-square overflow-hidden rounded border-2 ${on ? 'border-accent' : 'border-line'}`}
              >
                <img src={`stock://file/${encodeURI(it.file)}`} alt="" loading="lazy" draggable={false} className="h-full w-full object-cover" />
                {on && <span className="absolute right-1 top-1 rounded-full bg-accent px-1.5 text-xs text-accent-ink">✓</span>}
              </button>
            )
          })}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <span className="text-sm text-muted">{picked.size} selecionadas</span>
        <div className="flex gap-2">
          <button onClick={onClose} className="rounded px-4 py-2 text-muted hover:text-ink">Cancelar</button>
          <button
            onClick={() => void importPicked()}
            disabled={busy || picked.size === 0}
            className="rounded bg-accent px-4 py-2 font-medium text-accent-ink disabled:opacity-40"
          >
            Importar selecionadas
          </button>
        </div>
      </div>
    </Modal>
  )
}
