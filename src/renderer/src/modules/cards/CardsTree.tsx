import { useState } from 'react'
import type { CardSummary, Folder } from '@shared/types'
import { tc } from '@/i18n/cards'
import { tg } from '@/i18n/tags'
import { FOLDER_COLORS } from '@/lib/colors'
import { EMPTY_IDS } from '@/lib/constants'
import { norm } from '@/lib/mentions'
import { useCards } from '@/store/cards'
import { useUi } from '@/store/ui'
import { useWorkspace } from '@/store/workspace'

function TagDots({ id }: { id: string }): JSX.Element | null {
  const tags = useCards((s) => s.tags)
  const ids = useCards((s) => s.tagLinks[id] ?? EMPTY_IDS)
  const mine = tags.filter((t) => ids.includes(t.id)).slice(0, 4)
  if (mine.length === 0) return null
  return (
    <span className="flex shrink-0 gap-0.5" aria-hidden="true">
      {mine.map((t) => <span key={t.id} className="h-1.5 w-1.5 rounded-full" style={{ background: t.color }} />)}
    </span>
  )
}

function CardRow({ card, depth }: { card: CardSummary; depth: number }): JSX.Element {
  const types = useCards((s) => s.types)
  const openCard = useCards((s) => s.openCard)
  const active = useWorkspace((s) => s.activeTabId === `card:${card.id}`)
  const color = types.find((t) => t.id === card.type_id)?.color ?? '#9a9cab'
  return (
    <button
      onClick={() => openCard(card.id)}
      aria-current={active}
      style={{ paddingLeft: 12 + depth * 14 }}
      className={`flex w-full items-center gap-2 rounded py-1 pr-2 text-left ${active ? 'bg-raised text-ink' : 'text-muted hover:text-ink'}`}
    >
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
      <span className="min-w-0 flex-1 truncate">{card.title}</span>
      <TagDots id={card.id} />
    </button>
  )
}

function FolderNode({ folder, depth }: { folder: Folder; depth: number }): JSX.Element {
  const { cards, folders, createFolder, renameFolder, removeFolder, setFolderColor } = useCards()
  const { openNewCard, openNameDialog } = useUi()
  const [open, setOpen] = useState(true)
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)

  const subfolders = folders.filter((f) => f.parent_id === folder.id)
  const inside = cards.filter((c) => c.folder_id === folder.id)

  const items: [string, () => void][] = [
    [tc.newCardHere, () => openNewCard(folder.id)],
    [tc.newSubfolder, () => openNameDialog({ title: tc.newSubfolder, label: tc.folderName, initial: '', submit: tc.newFolder, onSubmit: (v) => createFolder(v, folder.id) })],
    [tc.rename, () => openNameDialog({ title: tc.renameFolder, label: tc.folderName, initial: folder.name, submit: tc.rename, onSubmit: (v) => renameFolder(folder.id, v) })],
    [tc.deleteFolder, () => { if (window.confirm(tc.confirmDeleteFolder(folder.name))) removeFolder(folder.id) }]
  ]

  return (
    <div>
      <div
        className="group flex items-center rounded text-muted hover:text-ink"
        style={{ paddingLeft: 4 + depth * 14 }}
        onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY }) }}
      >
        <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-1.5 py-1 text-left">
          <span className="w-4 text-center text-xs">{open ? '▾' : '▸'}</span>
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-sm"
            style={folder.color ? { background: folder.color } : { border: '1px solid var(--line)' }}
            aria-hidden="true"
          />
          <span className="truncate" style={folder.color ? { color: folder.color } : undefined}>{folder.name}</span>
        </button>
        <button aria-label={`${folder.name}: ${tc.newCardHere}`} onClick={() => openNewCard(folder.id)} className="invisible px-1.5 group-hover:visible">+</button>
        <button aria-label={`${folder.name}: menu`} onClick={(e) => setMenu({ x: e.clientX, y: e.clientY })} className="invisible px-1.5 group-hover:visible">⋯</button>
      </div>

      {menu && (
        <div className="fixed inset-0 z-40" onMouseDown={() => setMenu(null)} onContextMenu={(e) => { e.preventDefault(); setMenu(null) }}>
          <ul role="menu" style={{ left: menu.x, top: menu.y }} className="absolute w-52 rounded border border-line bg-raised py-1 shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
            {items.map(([label, run]) => (
              <li key={label}>
                <button role="menuitem" onClick={() => { setMenu(null); run() }} className="w-full px-3 py-1.5 text-left hover:bg-line">{label}</button>
              </li>
            ))}
            <li className="border-t border-line px-3 py-2">
              <div className="mb-1.5 text-xs text-muted">{tg.folderColor}</div>
              <div className="flex flex-wrap gap-1.5">
                {FOLDER_COLORS.map((c) => (
                  <button
                    key={c}
                    aria-label={`Cor ${c}`}
                    onClick={() => { setMenu(null); void setFolderColor(folder.id, c) }}
                    className={`h-5 w-5 rounded-full border-2 ${folder.color === c ? 'border-ink' : 'border-transparent'}`}
                    style={{ background: c }}
                  />
                ))}
                <button
                  aria-label={tg.folderColor + ': sem cor'}
                  onClick={() => { setMenu(null); void setFolderColor(folder.id, null) }}
                  className="flex h-5 w-5 items-center justify-center rounded-full border border-line text-[10px] text-muted"
                >
                  ×
                </button>
              </div>
            </li>
          </ul>
        </div>
      )}

      {open && (
        <div>
          {subfolders.map((f) => <FolderNode key={f.id} folder={f} depth={depth + 1} />)}
          {inside.map((c) => <CardRow key={c.id} card={c} depth={depth + 1} />)}
        </div>
      )}
    </div>
  )
}

export function CardsBody({ q }: { q: string }): JSX.Element {
  const { cards, folders } = useCards()
  if (cards.length === 0 && folders.length === 0) {
    return <p className="px-3 py-2 text-sm text-muted/70">{tc.emptyCards}</p>
  }
  if (q.trim()) {
    const hits = cards.filter((c) => norm(c.title).includes(norm(q.trim())))
    if (hits.length === 0) return <p className="px-3 py-2 text-sm text-muted/70">{tc.noResults}</p>
    return <div>{hits.map((c) => <CardRow key={c.id} card={c} depth={0} />)}</div>
  }
  const rootFolders = folders.filter((f) => f.parent_id === null)
  const rootCards = cards.filter((c) => c.folder_id === null)
  return (
    <div>
      {rootFolders.map((f) => <FolderNode key={f.id} folder={f} depth={0} />)}
      {rootCards.map((c) => <CardRow key={c.id} card={c} depth={0} />)}
    </div>
  )
}
