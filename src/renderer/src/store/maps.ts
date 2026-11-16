import { create } from 'zustand'
import type { MapSummary } from '@shared/types'
import { tmap } from '@/i18n/maps'
import { useWorkspace } from './workspace'

interface MapsState {
  worldId: string | null
  maps: MapSummary[]
  focus: { mapId: string; featureId: string } | null
  load: (worldId: string) => Promise<void>
  createMap: (input: { name: string; image_id: string | null; width: number | null; height: number | null }) => Promise<void>
  renameMap: (id: string, name: string) => Promise<void>
  removeMap: (id: string) => Promise<void>
  openMap: (id: string, featureId?: string) => void
  clearFocus: () => void
}

const byName = (a: MapSummary, b: MapSummary): number => a.name.localeCompare(b.name, 'pt-BR')

export const useMaps = create<MapsState>((set, get) => ({
  worldId: null,
  maps: [],
  focus: null,

  load: async (worldId) => {
    const maps = await window.api.maps.list(worldId)
    if (useWorkspace.getState().activeWorldId !== worldId) return
    set({ worldId, maps })
  },

  createMap: async (input) => {
    const worldId = useWorkspace.getState().activeWorldId
    if (!worldId) return
    const m = await window.api.maps.create(worldId, input)
    set((s) => ({ maps: [...s.maps, m].sort(byName) }))
    get().openMap(m.id)
  },

  renameMap: async (id, name) => {
    const m = await window.api.maps.rename(id, name)
    set((s) => ({ maps: s.maps.map((x) => (x.id === id ? m : x)).sort(byName) }))
    useWorkspace.getState().renameTab(`map:${id}`, m.name)
  },

  removeMap: async (id) => {
    await window.api.maps.remove(id)
    set((s) => ({ maps: s.maps.filter((m) => m.id !== id) }))
    useWorkspace.getState().closeTab(`map:${id}`)
  },

  openMap: (id, featureId) => {
    const m = get().maps.find((x) => x.id === id)
    if (!m) return
    if (featureId) set({ focus: { mapId: id, featureId } })
    useWorkspace.getState().openTab({ id: `map:${id}`, worldId: m.world_id, kind: 'map', refId: id, title: m.name })
  },

  clearFocus: () => set({ focus: null })
}))

export { tmap }
