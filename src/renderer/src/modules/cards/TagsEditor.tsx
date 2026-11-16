import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { tg } from '@/i18n/tags'
import { norm } from '@/lib/mentions'
import { useCards } from '@/store/cards'
import { useUi } from '@/store/ui'

export function TagsEditor({ cardId }: { cardId: string }): JSX.Element {
  const tags = useCards((s) => s.tags)
  const links = useCards((s) => s.tagLinks)
  const setCardTags = useCards((s) => s.setCardTags)
  const createTag = useCards((s) => s.createTag)
  const showToast = useUi((s) => s.showToast)
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')

  const assigned = links[cardId] ?? []
  const mine = tags.filter((t) => assigned.includes(t.id))
  const nq = norm(q.trim())
  const options = tags.filter((t) => !nq || norm(t.name).includes(nq))
  const exists = tags.some((t) => norm(t.name) === nq)

  const toggle = (id: string): void =>
    void setCardTags(cardId, assigned.includes(id) ? assigned.filter((x) => x !== id) : [...assigned, id])

  const create = async (): Promise<void> => {
    const name = q.trim()
    if (!name) return
    try {
      const t = await createTag(name)
      if (t) await setCardTags(cardId, [...assigned, t.id])
      setQ('')
    } catch (err) {
      showToast((err as Error).message)
    }
  }

  return (
    <div className="mb-8">
      <h3 className="mb-3 font-serif text-lg">{tg.cardTags}</h3>
      <div className="flex flex-wrap gap-1.5">
        {mine.map((t) => (
          <span key={t.id} className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-sm" style={{ borderColor: t.color, color: t.color }}>
            {t.name}
            <button aria-label={`Remover tag ${t.name}`} onClick={() => toggle(t.id)} className="opacity-70 hover:opacity-100">
              <X size={12} />
            </button>
          </span>
        ))}
        <div className="relative">
          <button onClick={() => setOpen(!open)} className="inline-flex items-center gap-1 rounded-full border border-dashed border-line px-2.5 py-0.5 text-sm text-muted hover:text-ink">
            <Plus size={12} />
            {tg.addTag}
          </button>
          {open && (
            <>
              <div className="fixed inset-0 z-10" onMouseDown={() => setOpen(false)} />
              <div className="absolute left-0 z-20 mt-1 w-60 rounded border border-line bg-raised p-2 shadow-xl">
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void create()}
                  placeholder={tg.searchOrCreate}
                  aria-label={tg.searchOrCreate}
                  className="mb-2 w-full rounded border border-line bg-bg px-2 py-1 outline-none"
                />
                <ul className="max-h-48 overflow-y-auto">
                  {options.map((t) => (
                    <li key={t.id}>
                      <button onClick={() => toggle(t.id)} className="flex w-full items-center gap-2 rounded px-2 py-1 text-left hover:bg-line">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: t.color }} />
                        <span className="min-w-0 flex-1 truncate">{t.name}</span>
                        {assigned.includes(t.id) && <span className="text-accent">✓</span>}
                      </button>
                    </li>
                  ))}
                </ul>
                {q.trim() && !exists && (
                  <button onClick={() => void create()} className="mt-1 w-full rounded px-2 py-1 text-left text-accent hover:bg-line">
                    {tg.createTag(q.trim())}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
