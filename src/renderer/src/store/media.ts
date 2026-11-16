import { create } from 'zustand'
import type { Folder, ImportResult, MediaItem } from '@shared/types'
import { tm } from '@/i18n/media'
import { useUi } from './ui'
import { useWorkspace } from './workspace'

interface MediaState {
  worldId: string | null
  items: MediaItem[]
  folders: Folder[]
  load: (worldId: string) => Promise<void>
  importFiles: (folderId: string | null) => Promise<void>
  importFolder: () => Promise<void>
  importDropped: (folderId: string | null, files: File[]) => Promise<void>
  importUrls: (folderId: string | null, urls: string[]) => Promise<string[]>
  rename: (id: string, name: string) => Promise<void>
  move: (id: string, folderId: string | null) => Promise<void>
  remove: (id: string) => Promise<void>
  saveCrop: (id: string, bytes: Uint8Array, mime: string, mode: 'copy' | 'replace') => Promise<MediaItem>
  createFolder: (name: string) => Promise<void>
  renameFolder: (id: string, name: string) => Promise<void>
  removeFolder: (id: string) => Promise<void>
}

const activeWorld = (): string | null => useWorkspace.getState().activeWorldId

function report(r: ImportResult): void {
  const parts: string[] = []
  if (r.items.length) parts.push(tm.imported(r.items.length))
  if (r.skipped) parts.push(tm.skipped(r.skipped))
  if (r.failed) parts.push(tm.failed(r.failed))
  useUi.getState().showToast(parts.length ? parts.join(' · ') : tm.nothingImported)
}

export const useMedia = create<MediaState>((set, get) => ({
  worldId: null,
  items: [],
  folders: [],

  load: async (worldId) => {
    const [items, folders] = await Promise.all([
      window.api.media.list(worldId),
      window.api.mediaFolders.list(worldId)
    ])
    if (activeWorld() !== worldId) return
    set({ worldId, items, folders })
  },

  importFiles: async (folderId) => {
    const w = activeWorld()
    if (!w) return
    const r = await window.api.media.pick(w, folderId)
    if (r.items.length || r.skipped || r.failed) report(r)
    await get().load(w)
  },

  importFolder: async () => {
    const w = activeWorld()
    if (!w) return
    const r = await window.api.media.pickFolder(w)
    if (r.items.length || r.skipped || r.failed) report(r)
    await get().load(w)
  },

  importDropped: async (folderId, files) => {
    const w = activeWorld()
    if (!w || files.length === 0) return
    const paths = files.map((f) => window.api.media.pathForFile(f)).filter(Boolean)
    const r = await window.api.media.importPaths(w, folderId, paths)
    report(r)
    await get().load(w)
  },

  importUrls: async (folderId, urls) => {
    const w = activeWorld()
    if (!w || urls.length === 0) return []
    const r = await window.api.media.importUrls(w, folderId, urls)
    if (r.items.length || r.skipped) report({ items: r.items, skipped: r.skipped, failed: 0 })
    await get().load(w)
    return r.errors
  },

  rename: async (id, name) => {
    const m = await window.api.media.rename(id, name)
    set((s) => ({ items: s.items.map((x) => (x.id === id ? m : x)) }))
  },

  move: async (id, folderId) => {
    const m = await window.api.media.move(id, folderId)
    set((s) => ({ items: s.items.map((x) => (x.id === id ? m : x)) }))
  },

  remove: async (id) => {
    await window.api.media.remove(id)
    set((s) => ({ items: s.items.filter((x) => x.id !== id) }))
  },

  saveCrop: async (id, bytes, mime, mode) => {
    const m = await window.api.media.saveCrop(id, bytes, mime, mode)
    set((s) => ({
      items: mode === 'copy' ? [m, ...s.items] : s.items.map((x) => (x.id === id ? m : x))
    }))
    return m
  },

  createFolder: async (name) => {
    const w = activeWorld()
    if (!w) return
    const f = await window.api.mediaFolders.create(w, name)
    set((s) => ({ folders: s.folders.some((x) => x.id === f.id) ? s.folders : [...s.folders, f] }))
  },

  renameFolder: async (id, name) => {
    await window.api.mediaFolders.rename(id, name)
    set((s) => ({ folders: s.folders.map((f) => (f.id === id ? { ...f, name: name.trim() || f.name } : f)) }))
  },

  removeFolder: async (id) => {
    await window.api.mediaFolders.remove(id)
    set((s) => ({
      folders: s.folders.filter((f) => f.id !== id),
      items: s.items.map((m) => (m.folder_id === id ? { ...m, folder_id: null } : m))
    }))
  }
}))
