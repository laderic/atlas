import { create } from 'zustand'
import type { World } from '@shared/types'

export interface Tab {
  id: string
  worldId: string
  kind: 'home' | 'card' | 'types' | 'media' | 'map' | 'timeline' | 'canvas' | 'sheet' | 'quill' | 'wiki' | 'workshop' | 'gallery' | 'tag' | 'radio'
  title: string
  refId?: string
}

interface WorkspaceState {
  worlds: World[]
  loaded: boolean
  dataVersion: number
  activeWorldId: string | null
  tabs: Tab[]
  activeTabId: string | null
  load: () => Promise<void>
  createWorld: (name: string, description?: string) => Promise<void>
  updateWorld: (
    id: string,
    patch: { name?: string; description?: string | null; cover_media_id?: string | null; theme?: string }
  ) => Promise<void>
  removeWorld: (id: string) => Promise<void>
  selectWorld: (id: string) => void
  openTab: (tab: Tab) => void
  renameTab: (id: string, title: string) => void
  setActiveTab: (id: string) => void
  closeTab: (id: string) => void
}

const homeTab = (w: World): Tab => ({ id: `home:${w.id}`, worldId: w.id, kind: 'home', title: w.name })

export const useWorkspace = create<WorkspaceState>((set, get) => ({
  worlds: [],
  loaded: false,
  dataVersion: 0,
  activeWorldId: null,
  tabs: [],
  activeTabId: null,

  load: async () => {
    const worlds = await window.api.worlds.list()
    const keep = worlds.find((w) => w.id === get().activeWorldId) ?? worlds[0] ?? null
    set((s) => ({
      worlds, loaded: true, tabs: [], activeTabId: null, activeWorldId: null, dataVersion: s.dataVersion + 1
    }))
    if (keep) get().selectWorld(keep.id)
  },

  createWorld: async (name, description) => {
    const w = await window.api.worlds.create(name, description)
    set((s) => ({ worlds: [w, ...s.worlds] }))
    get().selectWorld(w.id)
  },

  updateWorld: async (id, patch) => {
    const w = await window.api.worlds.update(id, patch)
    set((s) => ({
      worlds: s.worlds.map((x) => (x.id === id ? w : x)),
      tabs: s.tabs.map((t) => (t.id === `home:${id}` ? { ...t, title: w.name } : t))
    }))
  },

  removeWorld: async (id) => {
    await window.api.worlds.remove(id)
    const worlds = get().worlds.filter((w) => w.id !== id)
    set({ worlds, tabs: get().tabs.filter((t) => t.worldId !== id) })
    if (get().activeWorldId === id) {
      set({ activeWorldId: null, activeTabId: null })
      if (worlds[0]) get().selectWorld(worlds[0].id)
    }
  },

  selectWorld: (id) => {
    const w = get().worlds.find((x) => x.id === id)
    if (!w) return
    const tab = homeTab(w)
    set((s) => {
      const existing = s.tabs.filter((t) => t.worldId === id)
      const lastOpen =
        (s.activeWorldId === id ? s.activeTabId : null) ?? existing[existing.length - 1]?.id ?? tab.id
      return {
        activeWorldId: id,
        tabs: s.tabs.some((t) => t.id === tab.id) ? s.tabs : [...s.tabs, tab],
        activeTabId: lastOpen
      }
    })
  },

  openTab: (tab) =>
    set((s) => ({
      activeWorldId: tab.worldId,
      tabs: s.tabs.some((t) => t.id === tab.id) ? s.tabs : [...s.tabs, tab],
      activeTabId: tab.id
    })),

  renameTab: (id, title) => set((s) => ({ tabs: s.tabs.map((t) => (t.id === id ? { ...t, title } : t)) })),

  setActiveTab: (id) => set({ activeTabId: id }),

  closeTab: (id) => {
    const { tabs, activeTabId, activeWorldId } = get()
    const rest = tabs.filter((t) => t.id !== id)
    const visible = rest.filter((t) => t.worldId === activeWorldId)
    set({
      tabs: rest,
      activeTabId: activeTabId === id ? (visible[visible.length - 1]?.id ?? null) : activeTabId
    })
  }
}))
