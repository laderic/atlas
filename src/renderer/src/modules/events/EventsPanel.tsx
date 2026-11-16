import { EmptyNote, SideItem, matches } from '@/components/SidebarSection'
import { te } from '@/i18n/events'
import { tc } from '@/i18n/cards'
import { useCards } from '@/store/cards'
import { useUi } from '@/store/ui'
import { useWorkspace } from '@/store/workspace'

export const askNewEvent = (): void =>
  useUi.getState().openNameDialog({
    title: te.newEvent,
    label: te.eventName,
    initial: '',
    submit: te.create,
    onSubmit: async (name) => {
      const wid = useWorkspace.getState().activeWorldId
      if (!wid) return
      const c = await window.api.cards.create(wid, { title: name })
      await window.api.eventCards.setFlag(c.id, true)
      await useCards.getState().load(wid)
      useCards.getState().openCard(c.id)
    }
  })

export function EventsBody({ q }: { q: string }): JSX.Element {
  const all = useCards((s) => s.cards).filter((c) => !!c.is_event)
  const list = all.filter((c) => matches(c.title, q))
  const openCard = useCards((s) => s.openCard)
  const activeTabId = useWorkspace((s) => s.activeTabId)
  if (all.length === 0) return <EmptyNote>{te.noEvents}</EmptyNote>
  if (list.length === 0) return <EmptyNote>{tc.noResults}</EmptyNote>
  return (
    <div>
      {list.map((c) => (
        <SideItem key={c.id} active={activeTabId === `card:${c.id}`} onClick={() => openCard(c.id)}>{c.title}</SideItem>
      ))}
    </div>
  )
}
