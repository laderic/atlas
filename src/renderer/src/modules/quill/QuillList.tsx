import { SideItem, EmptyNote, matches } from '@/components/SidebarSection'
import { tq } from '@/i18n/quill'
import { useQuill } from '@/store/quill'
import { useWorkspace } from '@/store/workspace'

export function QuillBody({ q }: { q: string }): JSX.Element {
  const all = useQuill((s) => s.books)
  const books = all.filter((b) => matches(b.title, q))
  const open = useQuill((s) => s.open)
  const activeTabId = useWorkspace((s) => s.activeTabId)
  if (all.length === 0) return <EmptyNote>{tq.noBooks}</EmptyNote>
  if (books.length === 0) return <EmptyNote>{tq.noResults}</EmptyNote>
  return (
    <div>
      {books.map((b) => (
        <SideItem key={b.id} active={activeTabId === `quill:${b.id}`} onClick={() => open(b.id)}>{b.title}</SideItem>
      ))}
    </div>
  )
}
