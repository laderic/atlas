import { tg } from '@/i18n/tags'
import { CardTile } from '@/modules/gallery/CardTile'
import { useCards } from '@/store/cards'

export function TagView({ tagId }: { tagId: string }): JSX.Element {
  const tag = useCards((s) => s.tags.find((t) => t.id === tagId) ?? null)
  const cards = useCards((s) => s.cards)
  const types = useCards((s) => s.types)
  const tags = useCards((s) => s.tags)
  const links = useCards((s) => s.tagLinks)
  const updateTag = useCards((s) => s.updateTag)
  const removeTag = useCards((s) => s.removeTag)
  const openCard = useCards((s) => s.openCard)

  if (!tag) return <div className="p-10 text-muted">{tg.gone}</div>

  const list = cards.filter((c) => (links[c.id] ?? []).includes(tagId))

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="space-y-3 border-b border-line px-6 py-4">
        <div className="flex flex-wrap items-center gap-4">
          <input
            type="color"
            aria-label="Cor da tag"
            defaultValue={tag.color}
            onChange={(e) => void updateTag(tagId, { color: e.target.value })}
            className="h-9 w-10 cursor-pointer rounded border border-line bg-raised p-0.5"
          />
          <input
            key={tag.id}
            aria-label={tg.tagName}
            defaultValue={tag.name}
            onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== tag.name && updateTag(tagId, { name: e.target.value.trim() })}
            className="min-w-0 flex-1 bg-transparent font-serif text-3xl outline-none"
          />
          <span className="text-sm text-muted">{tg.cardsCount(list.length)}</span>
          <button
            onClick={() => window.confirm(tg.confirmDeleteTag(tag.name)) && removeTag(tagId)}
            className="text-sm text-muted hover:text-danger"
          >
            {tg.deleteTag}
          </button>
        </div>
        <div>
          <label htmlFor="tag-desc" className="mb-1 block text-sm text-muted">{tg.description}</label>
          <textarea
            id="tag-desc"
            key={`d-${tag.id}`}
            rows={3}
            defaultValue={tag.description ?? ''}
            placeholder={tg.descriptionPlaceholder}
            onBlur={(e) => {
              const v = e.target.value.trim() || null
              if (v !== (tag.description ?? null)) void updateTag(tagId, { description: v })
            }}
            className="w-full resize-y rounded border border-line bg-raised px-3 py-2 leading-relaxed outline-none focus:border-muted"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        {list.length === 0 ? (
          <p className="mt-16 text-center text-muted">{tg.emptyTag}</p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-4">
            {list.map((c) => {
              const t = types.find((x) => x.id === c.type_id)
              return (
                <CardTile
                  key={c.id}
                  card={c}
                  tags={tags.filter((x) => (links[c.id] ?? []).includes(x.id))}
                  typeName={t?.name ?? null}
                  typeColor={t?.color ?? '#9a9cab'}
                  onOpen={() => openCard(c.id)}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
