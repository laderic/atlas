import { SideItem, EmptyNote, matches } from '@/components/SidebarSection'
import { tt } from '@/i18n/timelines'
import { useTimelines } from '@/store/timelines'
import { useWorkspace } from '@/store/workspace'

export function TimelinesBody({ q }: { q: string }): JSX.Element {
  const all = useTimelines((s) => s.list)
  const list = all.filter((t) => matches(t.name, q))
  const openTimeline = useTimelines((s) => s.openTimeline)
  const activeTabId = useWorkspace((s) => s.activeTabId)
  if (all.length === 0) return <EmptyNote>{tt.empty}</EmptyNote>
  if (list.length === 0) return <EmptyNote>{tt.noResults}</EmptyNote>
  return (
    <div>
      {list.map((t) => (
        <SideItem key={t.id} active={activeTabId === `timeline:${t.id}`} onClick={() => openTimeline(t.id)}>{t.name}</SideItem>
      ))}
    </div>
  )
}
