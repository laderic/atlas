import { useEffect, useMemo, useState } from 'react'
import type { CardSummary } from '@shared/types'
import { Modal } from '@/components/Modal'
import { mediaUrl } from '@/lib/media'
import { useCards } from '@/store/cards'
import { useMedia } from '@/store/media'

const ROTATE_MS = 5000

/** Escolhe um card aleatório da lista, evitando repetir o atual. */
const pickRandom = (list: CardSummary[], exclude: string | null): string | null => {
  const pool = list.length > 1 ? list.filter((c) => c.id !== exclude) : list
  if (pool.length === 0) return null
  return pool[Math.floor(Math.random() * pool.length)].id
}

/**
 * Destaques da home. Sem escolha do usuário, o app usa todos os cards do mundo
 * e gira em ordem aleatória. Se você fixar cards em "Escolher destaques", só eles giram.
 */
export function Highlights({ worldId }: { worldId: string }): JSX.Element | null {
  const cards = useCards((s) => s.cards)
  const types = useCards((s) => s.types)
  const openCard = useCards((s) => s.openCard)
  const media = useMedia((s) => s.items)
  const [pinned, setPinned] = useState<string[]>([])
  const [current, setCurrent] = useState<string | null>(null)
  const [paused, setPaused] = useState(false)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    let alive = true
    void window.api.highlights.list(worldId).then((rows: CardSummary[]) => alive && setPinned(rows.map((r) => r.id)))
    return () => {
      alive = false
    }
  }, [worldId])

  // Lista que gira: os fixados (se houver) ou todos os cards.
  const pool = useMemo<CardSummary[]>(() => {
    if (pinned.length) return pinned.map((id) => cards.find((c) => c.id === id)).filter((c): c is CardSummary => !!c)
    return cards
  }, [pinned, cards])

  // Mantém um card atual válido e sorteia um quando a lista muda.
  useEffect(() => {
    if (pool.length === 0) return setCurrent(null)
    if (!current || !pool.some((c) => c.id === current)) setCurrent(pickRandom(pool, null))
  }, [pool, current])

  // Troca aleatória a cada alguns segundos; pausa com o mouse em cima.
  useEffect(() => {
    if (paused || pool.length < 2) return
    const t = window.setInterval(() => setCurrent((prev) => pickRandom(pool, prev)), ROTATE_MS)
    return () => window.clearInterval(t)
  }, [paused, pool])

  const save = (next: string[]): void => {
    setPinned(next)
    void window.api.highlights.set(worldId, next)
  }

  if (pool.length === 0) return null
  const cur = pool.find((c) => c.id === current) ?? pool[0]
  const pic = media.find((m) => m.id === cur.cover_media_id) ?? media.find((m) => m.id === cur.image_id) ?? null
  const typeName = types.find((t) => t.id === cur.type_id)?.name

  return (
    <div className="mb-8">
      <div
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        className="relative h-56 max-w-xl overflow-hidden rounded-lg border border-line bg-panel"
      >
        <button onClick={() => openCard(cur.id)} className="absolute inset-0 text-left">
          {pic ? (
            <img src={mediaUrl(pic)} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-raised" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-4">
            {typeName && <p className="text-[10px] uppercase tracking-wider text-white/70">{typeName}</p>}
            <p className="font-serif text-2xl text-white">{cur.title}</p>
          </div>
        </button>
      </div>
      <button onClick={() => setEditing(true)} className="mt-2 text-xs text-muted hover:text-ink">
        {pinned.length ? 'Destaques escolhidos · editar' : 'Escolher destaques (opcional)'}
      </button>

      {editing && (
        <Modal title="Destaques da home" onClose={() => setEditing(false)} width={500}>
          <p className="mb-3 text-sm text-muted">
            Sem escolha, o app gira todos os cards do mundo. Marque cards para girar só eles.
          </p>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm">{pinned.length ? `${pinned.length} escolhidos` : 'Automático (todos os cards)'}</span>
            {pinned.length > 0 && (
              <button onClick={() => save([])} className="text-sm text-accent hover:underline">Voltar ao automático</button>
            )}
          </div>
          <ul className="max-h-72 space-y-0.5 overflow-y-auto">
            {cards.map((c) => (
              <li key={c.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded px-2 py-1 hover:bg-raised">
                  <input
                    type="checkbox"
                    checked={pinned.includes(c.id)}
                    onChange={(e) => save(e.target.checked ? [...pinned, c.id] : pinned.filter((x) => x !== c.id))}
                  />
                  <span className="truncate">{c.title}</span>
                </label>
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </div>
  )
}
