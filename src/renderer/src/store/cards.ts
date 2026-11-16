import { pushUndo } from '@/lib/undo'
import { create } from 'zustand'
import type { Card, CardSummary, CardType, CardTypeInput, Folder, Tag, TagMap } from '@shared/types'
import { tc } from '@/i18n/cards'
import { tagColor } from '@/lib/colors'
import { useUi } from './ui'
import { useWorkspace } from './workspace'

interface CardsState {
  worldId: string | null
  types: CardType[]
  cards: CardSummary[]
  folders: Folder[]
  tags: Tag[]
  tagLinks: Record<string, string[]>
  linksVersion: number
  load: (worldId: string) => Promise<void>
  reloadTags: () => Promise<void>
  createCard: (input: { title?: string; type_id?: string | null; folder_id?: string | null }) => Promise<Card | null>
  patchSummary: (s: CardSummary) => void
  removeCard: (id: string) => Promise<void>
  createFolder: (name: string, parentId: string | null) => Promise<void>
  renameFolder: (id: string, name: string) => Promise<void>
  setFolderColor: (id: string, color: string | null) => Promise<void>
  removeFolder: (id: string) => Promise<void>
  saveType: (input: CardTypeInput) => Promise<CardType | null>
  removeType: (id: string) => Promise<void>
  createTag: (name: string) => Promise<Tag | null>
  updateTag: (id: string, patch: { name?: string; color?: string; description?: string | null }) => Promise<void>
  removeTag: (id: string) => Promise<void>
  setCardTags: (cardId: string, tagIds: string[]) => Promise<void>
  openCard: (id: string) => void
  openTypes: () => void
}

const byTitle = (a: CardSummary, b: CardSummary): number => a.title.localeCompare(b.title, 'pt-BR')
const linksOf = (map: TagMap): Record<string, string[]> => {
  const rec: Record<string, string[]> = {}
  for (const [c, t] of map.links) rec[c] = [...(rec[c] ?? []), t]
  return rec
}

export const useCards = create<CardsState>((set, get) => ({
  worldId: null,
  types: [],
  cards: [],
  folders: [],
  tags: [],
  tagLinks: {},
  linksVersion: 0,

  load: async (worldId) => {
    const [types, cards, folders, tagMap] = await Promise.all([
      window.api.cardTypes.list(worldId),
      window.api.cards.list(worldId),
      window.api.folders.list(worldId),
      window.api.tags.map(worldId)
    ])
    if (useWorkspace.getState().activeWorldId !== worldId) return
    set((s) => ({
      worldId, types, cards, folders, tags: tagMap.tags, tagLinks: linksOf(tagMap), linksVersion: s.linksVersion + 1
    }))
  },

  reloadTags: async () => {
    const worldId = get().worldId
    if (!worldId) return
    const map = await window.api.tags.map(worldId)
    set({ tags: map.tags, tagLinks: linksOf(map) })
  },

  createCard: async (input) => {
    const worldId = useWorkspace.getState().activeWorldId
    if (!worldId) return null
    const card = await window.api.cards.create(worldId, input)
    const { content: _c, properties: _p, created_at: _t, ...summary } = card
    set((s) => ({ cards: [...s.cards, summary].sort(byTitle) }))
    get().openCard(card.id)
    return card
  },

  patchSummary: (sum) => {
    set((s) => ({
      cards: s.cards.map((c) => (c.id === sum.id ? sum : c)).sort(byTitle),
      linksVersion: s.linksVersion + 1
    }))
    useWorkspace.getState().renameTab(`card:${sum.id}`, sum.title)
  },

  removeCard: async (id) => {
    const title = useCards.getState().cards.find((c) => c.id === id)?.title ?? ''
    const snap = await window.api.cards.removeWithUndo(id)
    pushUndo({
      label: title,
      run: async () => {
        await window.api.cards.restore(snap)
        await useCards.getState().load(String(snap.card.world_id))
      }
    })
    useUi.getState().showToast(`"${title}" apagado. Ctrl+Z desfaz.`)
    set((s) => ({ cards: s.cards.filter((c) => c.id !== id), linksVersion: s.linksVersion + 1 }))
    useWorkspace.getState().closeTab(`card:${id}`)
    await get().reloadTags()
  },

  createFolder: async (name, parentId) => {
    const worldId = useWorkspace.getState().activeWorldId
    if (!worldId) return
    const f = await window.api.folders.create(worldId, name, parentId)
    set((s) => ({ folders: [...s.folders, { ...f, color: f.color ?? null }] }))
  },

  renameFolder: async (id, name) => {
    await window.api.folders.rename(id, name)
    set((s) => ({ folders: s.folders.map((f) => (f.id === id ? { ...f, name: name.trim() || f.name } : f)) }))
  },

  setFolderColor: async (id, color) => {
    await window.api.folders.color(id, color)
    set((s) => ({ folders: s.folders.map((f) => (f.id === id ? { ...f, color } : f)) }))
  },

  removeFolder: async (id) => {
    await window.api.folders.remove(id)
    const worldId = get().worldId
    if (worldId) await get().load(worldId)
  },

  saveType: async (input) => {
    const worldId = useWorkspace.getState().activeWorldId
    if (!worldId) return null
    const saved = await window.api.cardTypes.save(worldId, input)
    set((s) => ({
      types: s.types.some((t) => t.id === saved.id) ? s.types.map((t) => (t.id === saved.id ? saved : t)) : [...s.types, saved]
    }))
    return saved
  },

  removeType: async (id) => {
    await window.api.cardTypes.remove(id)
    const worldId = get().worldId
    if (worldId) await get().load(worldId)
  },

  createTag: async (name) => {
    const worldId = useWorkspace.getState().activeWorldId
    if (!worldId) return null
    const t = await window.api.tags.create(worldId, name, tagColor(get().tags.length))
    set((s) => ({ tags: [...s.tags, t].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')) }))
    return t
  },

  updateTag: async (id, patch) => {
    await window.api.tags.update(id, patch)
    await get().reloadTags()
    const t = get().tags.find((x) => x.id === id)
    if (t && patch.name) useWorkspace.getState().renameTab(`tag:${id}`, t.name)
  },

  removeTag: async (id) => {
    await window.api.tags.remove(id)
    set((s) => ({
      tags: s.tags.filter((t) => t.id !== id),
      tagLinks: Object.fromEntries(Object.entries(s.tagLinks).map(([c, ids]) => [c, ids.filter((x) => x !== id)]))
    }))
    useWorkspace.getState().closeTab(`tag:${id}`)
  },

  setCardTags: async (cardId, tagIds) => {
    await window.api.tags.setCardTags(cardId, tagIds)
    set((s) => ({ tagLinks: { ...s.tagLinks, [cardId]: tagIds }, linksVersion: s.linksVersion + 1 }))
  },

  openCard: (id) => {
    const c = get().cards.find((x) => x.id === id)
    if (!c) {
      useUi.getState().showToast(tc.cardGone)
      return
    }
    useWorkspace.getState().openTab({ id: `card:${id}`, worldId: c.world_id, kind: 'card', refId: id, title: c.title })
  },

  openTypes: () => {
    const worldId = useWorkspace.getState().activeWorldId
    if (!worldId) return
    useWorkspace.getState().openTab({ id: `types:${worldId}`, worldId, kind: 'types', title: tc.types })
  }
}))
