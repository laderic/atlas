import { useEffect, useMemo, useState } from 'react'
import type { SearchHit } from '@shared/types'
import { t } from '@/i18n/pt-BR'
import { tc } from '@/i18n/cards'
import { norm } from '@/lib/mentions'
import { useCards } from '@/store/cards'
import { useUi } from '@/store/ui'
import { useWorkspace } from '@/store/workspace'

interface Item {
  id: string
  label: string
  hint: string
  detail?: string
  run: () => void
}

export function CommandPalette(): JSX.Element | null {
  const open = useUi((s) => s.paletteOpen)
  const setOpen = useUi((s) => s.setPaletteOpen)
  const setNewWorldOpen = useUi((s) => s.setNewWorldOpen)
  const openNewCard = useUi((s) => s.openNewCard)
  const worlds = useWorkspace((s) => s.worlds)
  const activeWorldId = useWorkspace((s) => s.activeWorldId)
  const selectWorld = useWorkspace((s) => s.selectWorld)
  const openCard = useCards((s) => s.openCard)
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)
  const [hits, setHits] = useState<SearchHit[]>([])

  // Busca de cards (FTS5) com pequeno atraso para não consultar a cada tecla.
  useEffect(() => {
    if (!open || !activeWorldId || !q.trim()) {
      setHits([])
      return
    }
    let alive = true
    const timer = setTimeout(() => {
      window.api.search.query(activeWorldId, q).then((r) => alive && setHits(r))
    }, 150)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [q, open, activeWorldId])

  const items = useMemo<Item[]>(() => {
    const base: Item[] = [
      { id: 'new-world', label: t.newWorld, hint: 'Ação', run: () => setNewWorldOpen(true) },
      ...(activeWorldId ? [{ id: 'new-card', label: tc.newCard, hint: 'Ação', run: () => openNewCard(null) }] : []),
      ...worlds.map((w) => ({ id: w.id, label: w.name, hint: 'Mundo', run: () => selectWorld(w.id) }))
    ]
    const nq = norm(q.trim())
    const filtered = nq ? base.filter((i) => norm(i.label).includes(nq)) : base
    const cardItems: Item[] = hits.map((h) => ({
      id: `card:${h.id}`,
      label: h.title,
      hint: tc.searchCards,
      detail: h.snippet,
      run: () => openCard(h.id)
    }))
    return [...cardItems, ...filtered]
  }, [q, worlds, hits, activeWorldId, selectWorld, setNewWorldOpen, openNewCard, openCard])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(!useUi.getState().paletteOpen)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setOpen])

  useEffect(() => {
    setIdx(0)
  }, [q, open, hits])

  if (!open) return null
  const close = (): void => {
    setOpen(false)
    setQ('')
  }
  const choose = (i?: Item): void => {
    if (!i) return
    close()
    i.run()
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-black/55 pt-28" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div role="dialog" aria-label={t.search} className="h-fit w-[560px] overflow-hidden rounded-lg border border-line bg-panel shadow-2xl">
        <input
          autoFocus
          value={q}
          placeholder={t.searchPlaceholder}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(i + 1, items.length - 1)) }
            if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)) }
            if (e.key === 'Enter') choose(items[idx])
          }}
          className="w-full border-b border-line bg-transparent px-4 py-3 text-base outline-none"
        />
        <ul className="max-h-80 overflow-y-auto py-1">
          {items.map((i, n) => (
            <li key={i.id}>
              <button
                onClick={() => choose(i)}
                onMouseEnter={() => setIdx(n)}
                className={`flex w-full items-center justify-between gap-4 px-4 py-2 text-left ${n === idx ? 'bg-raised' : ''}`}
              >
                <span className="min-w-0">
                  <span className="block truncate">{i.label}</span>
                  {i.detail && <span className="block truncate text-xs text-muted">{i.detail}</span>}
                </span>
                <span className="shrink-0 text-xs text-muted">{i.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
