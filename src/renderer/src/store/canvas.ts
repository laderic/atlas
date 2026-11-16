import { create } from 'zustand'
import type { CanvasKind, CanvasSummary } from '@shared/types'
import { tk } from '@/i18n/canvas'
import { useUi } from './ui'
import { useWorkspace } from './workspace'

interface CanvasesState {
  worldId: string | null
  list: CanvasSummary[]
  load: (worldId: string) => Promise<void>
  create: (name: string, kind: CanvasKind) => Promise<void>
  rename: (id: string, name: string) => Promise<void>
  remove: (id: string) => Promise<void>
  open: (id: string) => void
}

const byName = (a: CanvasSummary, b: CanvasSummary): number => a.name.localeCompare(b.name, 'pt-BR')

export const useCanvases = create<CanvasesState>((set, get) => ({
  worldId: null,
  list: [],

  load: async (worldId) => {
    const list = await window.api.canvas.list(worldId)
    if (useWorkspace.getState().activeWorldId !== worldId) return
    set({ worldId, list })
  },

  create: async (name, kind) => {
    const worldId = useWorkspace.getState().activeWorldId
    if (!worldId) return
    const c = await window.api.canvas.create(worldId, name, kind)
    set((s) => ({ list: [...s.list, c].sort(byName) }))
    get().open(c.id)
  },

  rename: async (id, name) => {
    const c = await window.api.canvas.rename(id, name)
    set((s) => ({ list: s.list.map((x) => (x.id === id ? c : x)).sort(byName) }))
    useWorkspace.getState().renameTab(`canvas:${id}`, c.name)
  },

  remove: async (id) => {
    await window.api.canvas.remove(id)
    set((s) => ({ list: s.list.filter((c) => c.id !== id) }))
    useWorkspace.getState().closeTab(`canvas:${id}`)
  },

  open: (id) => {
    const c = get().list.find((x) => x.id === id)
    if (!c) return
    useWorkspace.getState().openTab({ id: `canvas:${id}`, worldId: c.world_id, kind: 'canvas', refId: id, title: c.name })
  }
}))

export const askNewCanvas = (kind: CanvasKind): void =>
  useUi.getState().openNameDialog({
    title: kind === 'relation_tree' ? tk.newRelationTree : tk.newCanvas,
    label: tk.canvasName,
    initial: '',
    submit: tk.create,
    onSubmit: (v) => useCanvases.getState().create(v, kind)
  })
