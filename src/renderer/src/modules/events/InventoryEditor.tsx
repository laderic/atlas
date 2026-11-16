import { useEffect, useState } from 'react'
import { QTY_FIELD } from '@/lib/items'
import { norm } from '@/lib/mentions'
import { useCards } from '@/store/cards'
import { useUi } from '@/store/ui'

const itemTypesKey = (worldId: string): string => `atlas.itemTypes.${worldId}`

/** Inventário do personagem: menciona só os cards dos tipos que são itens. */
export function InventoryEditor({ cardId }: { cardId: string }): JSX.Element {
  const cards = useCards((s) => s.cards)
  const types = useCards((s) => s.types)
  const worldId = useCards((s) => s.worldId)
  const saveType = useCards((s) => s.saveType)
  const showToast = useUi((s) => s.showToast)
  const [ids, setIds] = useState<string[]>([])
  const [q, setQ] = useState('')
  const [itemTypes, setItemTypes] = useState<string[] | null>(null)
  const [map, setMap] = useState<{ links: [string, string][]; unique: string[]; titles: Record<string, string> }>({ links: [], unique: [], titles: {} })

  useEffect(() => {
    let alive = true
    void window.api.inventory.list(cardId).then((items) => alive && setIds(items.map((i) => i.id)))
    return () => {
      alive = false
    }
  }, [cardId])

  // Quem está com cada item (atualiza ao abrir e ao mudar o inventário)
  useEffect(() => {
    if (!worldId) return
    void window.api.inventory.map(worldId).then(setMap)
  }, [worldId, ids.length])

  // Tipos que contam como item: o que você escolheu, ou por padrão os que têm "item" no nome.
  useEffect(() => {
    if (!worldId) return
    let saved: string[] | null = null
    try {
      saved = JSON.parse(localStorage.getItem(itemTypesKey(worldId)) ?? 'null') as string[] | null
    } catch {
      saved = null
    }
    const byName = types.filter((t) => norm(t.name).includes('item')).map((t) => t.id)
    const chosen = saved ?? (byName.length ? byName : types.map((t) => t.id))
    setItemTypes(chosen)
    chosen.forEach((id) => void ensureQty(id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldId, types.length])

  // Garante que o tipo tem a propriedade Quantidade (Único ou Muitos)
  const ensureQty = async (typeId: string): Promise<void> => {
    const t = types.find((x) => x.id === typeId)
    if (!t || t.fields.some((f) => f.key === QTY_FIELD.key)) return
    await saveType({ id: t.id, name: t.name, color: t.color ?? undefined, icon: t.icon ?? undefined, fields: [...t.fields, QTY_FIELD] })
  }

  const chosen = itemTypes ?? []
  const toggleType = (id: string): void => {
    const next = chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id]
    setItemTypes(next)
    if (worldId) localStorage.setItem(itemTypesKey(worldId), JSON.stringify(next))
    if (!chosen.includes(id)) void ensureQty(id)
  }

  const save = async (next: string[]): Promise<void> => {
    try {
      await window.api.inventory.set(cardId, next)
      setIds(next)
    } catch (err) {
      showToast((err as Error).message)
    }
  }

  // Com quem o item já está (outros personagens), se for único
  const takenBy = (itemId: string): string | null => {
    if (!map.unique.includes(itemId)) return null
    const owner = map.links.find(([o, i]) => i === itemId && o !== cardId)
    return owner ? (map.titles[owner[0]] ?? '—') : null
  }

  const nq = norm(q.trim())
  const others = cards.filter(
    (c) => c.id !== cardId && chosen.includes(c.type_id ?? '') && (!nq || norm(c.title).includes(nq))
  )

  return (
    <section className="mb-8" aria-label="Inventário">
      <div className="mb-1 flex items-baseline justify-between">
        <h3 className="font-serif text-lg">Inventário</h3>
        <span className="text-sm text-muted">{ids.length} {ids.length === 1 ? 'item' : 'itens'}</span>
      </div>
      <p className="mb-2 text-xs text-muted">Escolha os tipos que são itens e marque os que este personagem possui. Itens únicos só podem estar com um personagem.</p>

      <div className="mb-2 flex flex-wrap gap-1.5">
        {types.map((t) => (
          <button
            key={t.id}
            aria-pressed={chosen.includes(t.id)}
            onClick={() => toggleType(t.id)}
            className={`rounded-full border px-2.5 py-0.5 text-xs ${chosen.includes(t.id) ? 'border-accent text-ink' : 'border-line text-muted hover:text-ink'}`}
          >
            <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: t.color ?? '#9a9cab' }} />
            {t.name}
          </button>
        ))}
      </div>

      {ids.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {ids.map((id) => {
            const c = cards.find((x) => x.id === id)
            return (
              <span key={id} className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-sm">
                {c?.title ?? '—'}
                <button aria-label={`Remover ${c?.title ?? ''}`} onClick={() => void save(ids.filter((x) => x !== id))} className="text-muted hover:text-danger">×</button>
              </span>
            )
          })}
        </div>
      )}

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar item…"
        aria-label="Buscar item"
        className="mb-2 w-full rounded border border-line bg-raised px-2.5 py-1.5 text-sm outline-none"
      />
      {others.length === 0 ? (
        <p className="text-xs text-muted">Nenhum card dos tipos escolhidos.</p>
      ) : (
        <ul className="max-h-48 space-y-0.5 overflow-y-auto">
          {others.map((c) => {
            const owner = takenBy(c.id)
            const mine = ids.includes(c.id)
            const blocked = !!owner && !mine
            return (
              <li key={c.id}>
                <label className={`flex items-center gap-2 rounded px-2 py-1 text-sm ${blocked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-raised'}`}>
                  <input
                    type="checkbox"
                    checked={mine}
                    disabled={blocked}
                    onChange={(e) => void save(e.target.checked ? [...ids, c.id] : ids.filter((x) => x !== c.id))}
                  />
                  <span className="truncate">{c.title}</span>
                  {blocked && <span className="ml-auto shrink-0 text-xs text-muted">com {owner}</span>}
                </label>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
