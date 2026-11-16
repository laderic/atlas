import { SideItem, EmptyNote, matches } from '@/components/SidebarSection'
import { ts } from '@/i18n/sheets'
import { useSheets } from '@/store/sheets'
import { useWorkspace } from '@/store/workspace'

export function SheetsBody({ q }: { q: string }): JSX.Element {
  const all = useSheets((s) => s.list)
  const list = all.filter((x) => matches(x.name, q))
  const open = useSheets((s) => s.open)
  const activeTabId = useWorkspace((s) => s.activeTabId)
  if (all.length === 0) return <EmptyNote>{ts.noSheetsForCard}</EmptyNote>
  if (list.length === 0) return <EmptyNote>{ts.noResults}</EmptyNote>
  return (
    <div>
      {list.map((s) => (
        <SideItem key={s.id} active={activeTabId === `sheet:${s.id}`} onClick={() => open(s.id)} tag={s.kind === 'ficha' ? ts.ficha : ts.table}>
          {s.name}
        </SideItem>
      ))}
    </div>
  )
}
