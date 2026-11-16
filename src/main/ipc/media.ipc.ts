import { BrowserWindow, dialog, ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { mkdirSync, readdirSync, statSync, writeFileSync } from 'fs'
import { extname, join } from 'path'
import { getDb, mediaDir } from '../db/connection'
import {
  deleteFileIfUnused, ensureCollection, fullPath, getItem, hashBytes, importPaths, mediaTypeFor
} from '../services/mediaStore'
import { importUrls } from '../services/download'
import type { Folder, ImportResult, MediaItem } from '@shared/types'

const EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'avif', 'svg', 'gif', 'mp4', 'webm', 'mov', 'm4v', 'ogv', 'mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'opus']

export function registerMedia(): void {
  const db = (): ReturnType<typeof getDb> => getDb()

  ipcMain.handle('media:list', (_e, worldId: string): MediaItem[] =>
    db().prepare('SELECT * FROM media WHERE world_id = ? ORDER BY rowid DESC').all(worldId) as MediaItem[]
  )

  ipcMain.handle('media:pick', async (e, worldId: string, folderId: string | null): Promise<ImportResult> => {
    const win = BrowserWindow.fromWebContents(e.sender)!
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'Importar arquivos',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Imagens, GIFs, vídeos e áudios', extensions: EXTENSIONS },
        { name: 'Todos os arquivos', extensions: ['*'] }
      ]
    })
    if (canceled || filePaths.length === 0) return { items: [], skipped: 0, failed: 0 }
    return importPaths(worldId, folderId, filePaths)
  })

  // Cada subpasta vira uma coleção (útil para organizar stock art por gênero).
  ipcMain.handle('media:pickFolder', async (e, worldId: string): Promise<ImportResult & { folders: Folder[] }> => {
    const win = BrowserWindow.fromWebContents(e.sender)!
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'Importar pasta',
      properties: ['openDirectory']
    })
    const empty = { items: [], skipped: 0, failed: 0, folders: [] as Folder[] }
    if (canceled || filePaths.length === 0) return empty

    const root = filePaths[0]
    const total: ImportResult = { items: [], skipped: 0, failed: 0 }
    const add = (r: ImportResult): void => {
      total.items.push(...r.items)
      total.skipped += r.skipped
      total.failed += r.failed
    }

    const rootFiles: string[] = []
    for (const name of readdirSync(root)) {
      const p = join(root, name)
      if (name.startsWith('.')) continue
      if (statSync(p).isDirectory()) add(await importPaths(worldId, ensureCollection(worldId, name).id, [p]))
      else rootFiles.push(p)
    }
    if (rootFiles.length) add(await importPaths(worldId, null, rootFiles))

    const folders = db().prepare("SELECT * FROM folders WHERE world_id = ? AND scope = 'media' ORDER BY position, name COLLATE NOCASE").all(worldId) as Folder[]
    return { ...total, folders }
  })

  ipcMain.handle('media:importPaths', (_e, worldId: string, folderId: string | null, paths: string[]): Promise<ImportResult> =>
    importPaths(worldId, folderId, paths)
  )

  ipcMain.handle('media:importUrls', (_e, worldId: string, folderId: string | null, urls: string[]) =>
    importUrls(worldId, folderId, urls)
  )

  ipcMain.handle('media:rename', (_e, id: string, name: string): MediaItem => {
    db().prepare('UPDATE media SET name = ? WHERE id = ?').run(name.trim() || 'Sem nome', id)
    return getItem(id)!
  })

  ipcMain.handle('media:move', (_e, id: string, folderId: string | null): MediaItem => {
    db().prepare('UPDATE media SET folder_id = ? WHERE id = ?').run(folderId, id)
    return getItem(id)!
  })

  ipcMain.handle('media:remove', (_e, id: string): void => {
    const item = getItem(id)
    if (!item) return
    db().prepare('DELETE FROM media WHERE id = ?').run(id)
    deleteFileIfUnused(item.file_path)
  })

  ipcMain.handle(
    'media:saveCrop',
    (_e, id: string, bytes: Uint8Array, mime: string, mode: 'copy' | 'replace'): MediaItem => {
      const cur = getItem(id)
      if (!cur || !cur.world_id) throw new Error('Arquivo não encontrado.')
      const ext = mime === 'image/jpeg' ? '.jpg' : '.png'
      const buf = Buffer.from(bytes)
      const hash = hashBytes(buf)
      mkdirSync(join(mediaDir(), cur.world_id), { recursive: true })

      if (mode === 'copy') {
        const newId = randomUUID()
        const rel = `${cur.world_id}/${newId}${ext}`
        writeFileSync(fullPath(rel), buf)
        db().prepare(
          'INSERT INTO media (id, world_id, file_path, type, name, hash, size, folder_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(newId, cur.world_id, rel, 'image', `${cur.name} (recorte)`, hash, buf.length, cur.folder_id)
        return getItem(newId)!
      }

      const oldRel = cur.file_path
      const rel = `${cur.world_id}/${cur.id}${ext}`
      writeFileSync(fullPath(rel), buf)
      db().prepare('UPDATE media SET file_path = ?, type = ?, hash = ?, size = ? WHERE id = ?')
        .run(rel, 'image', hash, buf.length, id)
      if (oldRel !== rel) deleteFileIfUnused(oldRel)
      return getItem(id)!
    }
  )

  // ---------- coleções ----------
  ipcMain.handle('mediaFolders:list', (_e, worldId: string): Folder[] =>
    db().prepare("SELECT * FROM folders WHERE world_id = ? AND scope = 'media' ORDER BY position, name COLLATE NOCASE").all(worldId) as Folder[]
  )
  ipcMain.handle('mediaFolders:create', (_e, worldId: string, name: string): Folder => ensureCollection(worldId, name))
  ipcMain.handle('mediaFolders:rename', (_e, id: string, name: string): void => {
    db().prepare('UPDATE folders SET name = ? WHERE id = ?').run(name.trim() || 'Coleção', id)
  })
  ipcMain.handle('mediaFolders:remove', (_e, id: string): void => {
    db().transaction(() => {
      db().prepare('UPDATE media SET folder_id = NULL WHERE folder_id = ?').run(id)
      db().prepare('DELETE FROM folders WHERE id = ?').run(id)
    })()
  })

  void extname
  void mediaTypeFor
}
