import { useMemo, useState } from 'react'
import { Modal } from '@/components/Modal'
import { t } from '@/i18n/pt-BR'
import { tk } from '@/i18n/canvas'
import { norm } from '@/lib/mentions'
import { useCards } from '@/store/cards'

export function CardPicker({ excluded, onPick, onClose }: { excluded: Set<string>; onPick: (id: string) => void; onClose: () => void }): JSX.Element {
  const cards = useCards((s) => s.cards)
  const types = useCards((s) => s.types)
  const [q, setQ] = useState('')
  const list = useMemo(() => {
    const nq = norm(q.trim())
    return cards.filter((c) => !excluded.has(c.id) && (!nq || norm(c.title).includes(nq))).slice(0, 60)
  }, [cards, excluded, q])

  return (
    <Modal title={tk.pickCard} onClose={onClose} width={480}>
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={tk.search}
        aria-label={tk.search}
        className="mb-3 w-full rounded border border-line bg-raised px-3 py-2"
      />
      <ul className="max-h-72 overflow-y-auto">
        {list.length === 0 && <li className="px-2 py-2 text-muted">{tk.noCards}</li>}
        {list.map((c) => (
          <li key={c.id}>
            <button
              onClick={() => onPick(c.id)}
              className="flex w-full items-center justify-between gap-3 rounded px-3 py-2 text-left hover:bg-raised"
            >
              <span className="truncate">{c.title}</span>
              <span className="shrink-0 text-xs text-muted">{types.find((x) => x.id === c.type_id)?.name ?? ''}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex justify-end">
        <button onClick={onClose} className="rounded px-4 py-2 text-muted hover:text-ink">{t.cancel}</button>
      </div>
    </Modal>
  )
}
