import { useEffect, useState } from 'react'
import { te } from '@/i18n/events'
import { norm } from '@/lib/mentions'
import { useCards } from '@/store/cards'

/** Seção "Envolvidos" do evento: marca vários cards de uma vez. */
export function ParticipantsEditor({ eventId }: { eventId: string }): JSX.Element {
  const cards = useCards((s) => s.cards)
  const [ids, setIds] = useState<string[]>([])
  const [q, setQ] = useState('')

  useEffect(() => {
    let alive = true
    void window.api.eventCards.participants(eventId).then((ps) => alive && setIds(ps.map((p) => p.id)))
    return () => {
      alive = false
    }
  }, [eventId])

  const save = (next: string[]): void => {
    setIds(next)
    void window.api.eventCards.setParticipants(eventId, next)
  }

  const nq = norm(q.trim())
  const others = cards.filter((c) => c.id !== eventId && (!nq || norm(c.title).includes(nq)))

  return (
    <section className="mt-10 border-t border-line pt-6" aria-label={te.involved}>
      <div className="mb-1 flex items-baseline justify-between">
        <h3 className="font-serif text-xl">{te.involved}</h3>
        <span className="text-sm text-muted">{te.count(ids.length)}</span>
      </div>
      <p className="mb-3 text-sm text-muted">{te.involvedHelp}</p>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={te.searchCards}
        aria-label={te.searchCards}
        className="mb-3 w-full rounded border border-line bg-raised px-3 py-1.5 outline-none"
      />
      <ul className="max-h-72 space-y-0.5 overflow-y-auto">
        {others.map((c) => (
          <li key={c.id}>
            <label className="flex cursor-pointer items-center gap-3 rounded px-2 py-1.5 hover:bg-raised">
              <input
                type="checkbox"
                checked={ids.includes(c.id)}
                onChange={(e) => save(e.target.checked ? [...ids, c.id] : ids.filter((x) => x !== c.id))}
              />
              <span className="truncate">{c.title}</span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  )
}
