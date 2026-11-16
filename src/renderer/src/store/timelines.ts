import { create } from 'zustand'
import type { TimelineSummary } from '@shared/types'
import { tt } from '@/i18n/timelines'
import { useUi } from './ui'
import { useWorkspace } from './workspace'

interface Focus { timelineId: string; eventId: string }

interface TimelinesState {
  worldId: string | null
  list: TimelineSummary[]
  focus: Focus | null
  load: (worldId: string) => Promise<void>
  createTimeline: (name: string) => Promise<void>
  renameTimeline: (id: string, name: string) => Promise<void>
  setUnit: (id: string, unit: string) => Promise<void>
  removeTimeline: (id: string) => Promise<void>
  openTimeline: (id: string, eventId?: string) => void
  clearFocus: () => void
}

const byName = (a: TimelineSummary, b: TimelineSummary): number => a.name.localeCompare(b.name, 'pt-BR')
const replace = (list: TimelineSummary[], t: TimelineSummary): TimelineSummary[] =>
  list.map((x) => (x.id === t.id ? t : x)).sort(byName)

export const useTimelines = create<TimelinesState>((set, get) => ({
  worldId: null,
  list: [],
  focus: null,

  load: async (worldId) => {
    const list = await window.api.timelines.list(worldId)
    if (useWorkspace.getState().activeWorldId !== worldId) return
    set({ worldId, list })
  },

  createTimeline: async (name) => {
    const worldId = useWorkspace.getState().activeWorldId
    if (!worldId) return
    const t = await window.api.timelines.create(worldId, name)
    set((s) => ({ list: [...s.list, t].sort(byName) }))
    get().openTimeline(t.id)
  },

  renameTimeline: async (id, name) => {
    const t = await window.api.timelines.update(id, { name })
    set((s) => ({ list: replace(s.list, t) }))
    useWorkspace.getState().renameTab(`timeline:${id}`, t.name)
  },

  setUnit: async (id, unit) => {
    const t = await window.api.timelines.update(id, { unit })
    set((s) => ({ list: replace(s.list, t) }))
  },

  removeTimeline: async (id) => {
    await window.api.timelines.remove(id)
    set((s) => ({ list: s.list.filter((t) => t.id !== id) }))
    useWorkspace.getState().closeTab(`timeline:${id}`)
  },

  openTimeline: (id, eventId) => {
    const t = get().list.find((x) => x.id === id)
    if (!t) return
    if (eventId) set({ focus: { timelineId: id, eventId } })
    useWorkspace.getState().openTab({ id: `timeline:${id}`, worldId: t.world_id, kind: 'timeline', refId: id, title: t.name })
  },

  clearFocus: () => set({ focus: null })
}))

export const askNewTimeline = (): void =>
  useUi.getState().openNameDialog({
    title: tt.newTimeline,
    label: tt.timelineName,
    initial: '',
    submit: tt.create,
    onSubmit: (v) => useTimelines.getState().createTimeline(v)
  })
