import { useState } from 'react'
import type { CardSummary, CardType } from '@shared/types'
import { tg } from '@/i18n/tags'
import { tc } from '@/i18n/cards'
import { tu } from '@/i18n/ui'
import { matches } from '@/components/SidebarSection'
import { useCards } from '@/store/cards'
import { CardTile } from './CardTile'

type SortKey = 'nome' | 'recentes' | 'antigos' | 'tipo'
const sortCards = (list: CardSummary[], key: SortKey, types: CardType[]): CardSummary[] => {
  const out = [...list]
  const typeName = (id: string | null): string => types.find((t) => t.id === id)?.name ?? '~'
  if (key === 'recentes') out.sort((a, b) => b.updated_at - a.updated_at)
  else if (key === 'antigos') out.sort((a, b) => a.updated_at - b.updated_at)
  else if (key === 'tipo') out.sort((a, b) => typeName(a.type_id).localeCompare(typeName(b.type_id), 'pt-BR') || a.title.localeCompare(b.title, 'pt-BR'))
  else out.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'))
  return out
}

const chip = (active: boolean): string =>
  `rounded-full border px-3 py-1 text-sm transition-colors ${active ? 'border-accent bg-accent/15 text-ink' : 'border-line text-muted hover:text-ink'}`

export function GalleryView(): JSX.Element {
  const cards = useCards((s) => s.cards)
  const types = useCards((s) => s.types)
  const tags = useCards((s) => s.tags)
  const links = useCards((s) => s.tagLinks)
  const openCard = useCards((s) => s.openCard)
  const [q, setQ] = useState('')
  const [typeId, setTypeId] = useState<string | 'all'>('all')
  const [tagId, setTagId] = useState<string | null>(null)
  const [sort, setSort] = useState<SortKey>('nome')

  const filtered = cards.filter(
    (c) =>
      (typeId === 'all' || c.type_id === typeId) &&
      (!tagId || (links[c.id] ?? []).includes(tagId)) &&
      matches(c.title, q)
  )
  const list = sortCards(filtered, sort, types)

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="space-y-3 border-b border-line px-6 py-4">
        <div className="flex items-center gap-3">
          <h1 className="font-serif text-2xl">{tg.gallery}</h1>
          <select aria-label="Ordenar" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="rounded border border-line bg-raised px-2 py-1.5 text-sm text-ink outline-none">
            <option value="nome">Nome</option>
            <option value="recentes">Mais recentes</option>
            <option value="antigos">Mais antigos</option>
            <option value="tipo">Tipo</option>
          </select>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tu.search}
            aria-label={tu.searchGallery}
            className="ml-auto w-60 rounded border border-line bg-raised px-3 py-1.5 outline-none focus:border-muted"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setTypeId('all')} className={chip(typeId === 'all')}>{tg.all} · {cards.length}</button>
          {types.map((t) => (
            <button
              key={t.id}
              onClick={() => setTypeId(t.id)}
              className={chip(typeId === t.id)}
              style={typeId === t.id ? { borderColor: t.color } : undefined}
            >
              {t.name} · {cards.filter((c) => c.type_id === t.id).length}
            </button>
          ))}
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <button
                key={t.id}
                onClick={() => setTagId(tagId === t.id ? null : t.id)}
                aria-pressed={tagId === t.id}
                className={chip(tagId === t.id)}
                style={{ borderColor: tagId === t.id ? t.color : undefined, color: tagId === t.id ? t.color : undefined }}
              >
                # {t.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        {list.length === 0 ? (
          <p className="mt-16 text-center text-muted">{cards.length === 0 ? tc.emptyCards : tg.emptyGallery}</p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-4">
            {list.map((c) => {
              const t = types.find((x) => x.id === c.type_id)
              return (
                <CardTile
                  key={c.id}
                  card={c}
                  tags={tags.filter((tag) => (links[c.id] ?? []).includes(tag.id))}
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
