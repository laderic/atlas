import { SideItem, EmptyNote, matches } from '@/components/SidebarSection'
import { tk } from '@/i18n/canvas'
import { useCanvases } from '@/store/canvas'
import { useWorkspace } from '@/store/workspace'

export function CanvasesBody({ q }: { q: string }): JSX.Element {
  const all = useCanvases((s) => s.list)
  const list = all.filter((c) => matches(c.name, q))
  const open = useCanvases((s) => s.open)
  const activeTabId = useWorkspace((s) => s.activeTabId)
  if (all.length === 0) return <EmptyNote>{tk.empty}</EmptyNote>
  if (list.length === 0) return <EmptyNote>{tk.noResults}</EmptyNote>
  return (
    <div>
      {list.map((c) => (
        <SideItem
          key={c.id}
          active={activeTabId === `canvas:${c.id}`}
          onClick={() => open(c.id)}
          tag={c.kind === 'relation_tree' ? tk.kindLabel.relation_tree : undefined}
        >
          {c.name}
        </SideItem>
      ))}
    </div>
  )
}
