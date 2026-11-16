import { Modal } from '@/components/Modal'
import { t } from '@/i18n/pt-BR'
import { te } from '@/i18n/events'
import { useCards } from '@/store/cards'

/** Lista só os eventos já criados que ainda não estão nesta linha do tempo. */
export function EventPicker({ usedIds, onPick, onClose }: {
  usedIds: Set<string>
  onPick: (cardId: string) => void
  onClose: () => void
}): JSX.Element {
  const list = useCards((s) => s.cards).filter((c) => !!c.is_event && !usedIds.has(c.id))
  return (
    <Modal title={te.pickEvent} onClose={onClose} width={460}>
      {list.length === 0 ? (
        <p className="text-muted">{te.noAvailable}</p>
      ) : (
        <ul className="max-h-80 overflow-y-auto">
          {list.map((c) => (
            <li key={c.id}>
              <button onClick={() => onPick(c.id)} className="w-full truncate rounded px-3 py-2 text-left hover:bg-raised">{c.title}</button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex justify-end">
        <button onClick={onClose} className="rounded px-4 py-2 text-muted hover:text-ink">{t.cancel}</button>
      </div>
    </Modal>
  )
}
