import { EmptyNote, matches } from '@/components/SidebarSection'
import { tg } from '@/i18n/tags'
import { tc } from '@/i18n/cards'
import { useCards } from '@/store/cards'
import { useUi } from '@/store/ui'
import { useWorkspace } from '@/store/workspace'

export const askNewTag = (): void =>
  useUi.getState().openNameDialog({
    title: tg.newTag,
    label: tg.tagName,
    initial: '',
    submit: tg.create,
    onSubmit: async (v) => {
      try {
        await useCards.getState().createTag(v)
      } catch (err) {
        useUi.getState().showToast((err as Error).message)
      }
    }
  })

export function TagsBody({ q }: { q: string }): JSX.Element {
  const all = useCards((s) => s.tags)
  const links = useCards((s) => s.tagLinks)
  const tags = all.filter((t) => matches(t.name, q))
  const activeTabId = useWorkspace((s) => s.activeTabId)
  const openTab = useWorkspace((s) => s.openTab)

  if (all.length === 0) return <EmptyNote>{tg.noTags}</EmptyNote>
  if (tags.length === 0) return <EmptyNote>{tc.noResults}</EmptyNote>
  return (
    <div>
      {tags.map((t) => {
        const n = Object.values(links).filter((ids) => ids.includes(t.id)).length
        const active = activeTabId === `tag:${t.id}`
        return (
          <button
            key={t.id}
            onClick={() => openTab({ id: `tag:${t.id}`, worldId: t.world_id, kind: 'tag', refId: t.id, title: t.name })}
            aria-current={active}
            className={`flex w-full items-center gap-2 rounded px-3 py-1.5 text-left ${active ? 'bg-raised text-ink' : 'text-muted hover:text-ink'}`}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: t.color }} />
            <span className="min-w-0 flex-1 truncate">{t.name}</span>
            <span className="text-xs">{n}</span>
          </button>
        )
      })}
    </div>
  )
}
