import { create } from 'zustand'
import type { SheetKind, SheetSummary } from '@shared/types'
import { ts } from '@/i18n/sheets'
import { useUi } from './ui'
import { useWorkspace } from './workspace'

interface SheetsState {
  worldId: string | null
  list: SheetSummary[]
  load: (worldId: string) => Promise<void>
  create: (name: string, kind: SheetKind, cardId?: string | null) => Promise<void>
  rename: (id: string, name: string) => Promise<void>
  remove: (id: string) => Promise<void>
  open: (id: string) => void
}

const byName = (a: SheetSummary, b: SheetSummary): number => a.name.localeCompare(b.name, 'pt-BR')

export const useSheets = create<SheetsState>((set, get) => ({
  worldId: null,
  list: [],

  load: async (worldId) => {
    const list = await window.api.sheets.list(worldId)
    if (useWorkspace.getState().activeWorldId !== worldId) return
    set({ worldId, list })
  },

  create: async (name, kind, cardId = null) => {
    const worldId = useWorkspace.getState().activeWorldId
    if (!worldId) return
    const d = await window.api.sheets.create(worldId, name, kind, cardId)
    set((s) => ({ list: [...s.list, d.sheet].sort(byName) }))
    get().open(d.sheet.id)
  },

  rename: async (id, name) => {
    await window.api.sheets.rename(id, name)
    const clean = name.trim() || 'Sem nome'
    set((s) => ({ list: s.list.map((x) => (x.id === id ? { ...x, name: clean } : x)).sort(byName) }))
    useWorkspace.getState().renameTab(`sheet:${id}`, clean)
  },

  remove: async (id) => {
    await window.api.sheets.remove(id)
    set((s) => ({ list: s.list.filter((x) => x.id !== id) }))
    useWorkspace.getState().closeTab(`sheet:${id}`)
  },

  open: (id) => {
    const s = get().list.find((x) => x.id === id)
    if (!s) return
    useWorkspace.getState().openTab({ id: `sheet:${id}`, worldId: s.world_id, kind: 'sheet', refId: id, title: s.name })
  }
}))

export const askNewSheet = (kind: SheetKind): void =>
  useUi.getState().openNameDialog({
    title: kind === 'ficha' ? ts.newFicha : ts.newTable,
    label: ts.nameLabel,
    initial: '',
    submit: ts.create,
    onSubmit: (v) => useSheets.getState().create(v, kind)
  })
