import { createHash, randomUUID } from 'crypto'
import { createReadStream, copyFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs'
import { basename, extname, join } from 'path'
import { getDb, mediaDir } from '../db/connection'
import type { Folder, ImportResult, MediaItem, MediaType } from '@shared/types'

const EXT: Record<string, MediaType> = {}
for (const e of ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.avif', '.svg']) EXT[e] = 'image'
EXT['.gif'] = 'gif'
for (const e of ['.mp4', '.webm', '.mov', '.m4v', '.ogv']) EXT[e] = 'video'
for (const e of ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.opus']) EXT[e] = 'audio'

export const mediaTypeFor = (ext: string): MediaType | null => EXT[ext.toLowerCase()] ?? null

export function hashFile(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const h = createHash('sha256')
    createReadStream(path)
      .on('data', (d) => h.update(d))
      .on('end', () => resolve(h.digest('hex')))
      .on('error', reject)
  })
}

export const hashBytes = (b: Uint8Array): string => createHash('sha256').update(b).digest('hex')

/** Expande pastas em arquivos (recursivo), ignorando itens ocultos. */
export function collectFiles(paths: string[]): string[] {
  const out: string[] = []
  const walk = (p: string): void => {
    if (basename(p).startsWith('.')) return
    let st
    try {
      st = statSync(p)
    } catch {
      return
    }
    if (st.isDirectory()) for (const n of readdirSync(p)) walk(join(p, n))
    else out.push(p)
  }
  paths.forEach(walk)
  return out
}

export const getItem = (id: string): MediaItem | undefined =>
  getDb().prepare('SELECT * FROM media WHERE id = ?').get(id) as MediaItem | undefined

export function fullPath(rel: string): string {
  return join(mediaDir(), rel)
}

export function deleteFileIfUnused(rel: string): void {
  const used = (getDb().prepare('SELECT COUNT(*) n FROM media WHERE file_path = ?').get(rel) as { n: number }).n
  if (used > 0) return
  try {
    unlinkSync(fullPath(rel))
  } catch {
    /* já removido */
  }
}

export async function importPaths(worldId: string, folderId: string | null, paths: string[]): Promise<ImportResult> {
  const db = getDb()
  const result: ImportResult = { items: [], skipped: 0, failed: 0 }
  const find = db.prepare('SELECT id FROM media WHERE world_id = ? AND hash = ?')
  const insert = db.prepare(
    'INSERT INTO media (id, world_id, file_path, type, name, hash, size, folder_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  )

  for (const src of collectFiles(paths)) {
    try {
      const ext = extname(src).toLowerCase()
      const type = mediaTypeFor(ext)
      if (!type) {
        result.failed++
        continue
      }
      const hash = await hashFile(src)
      if (find.get(worldId, hash)) {
        result.skipped++
        continue
      }
      const id = randomUUID()
      const rel = `${worldId}/${id}${ext}`
      mkdirSync(join(mediaDir(), worldId), { recursive: true })
      copyFileSync(src, fullPath(rel))
      insert.run(id, worldId, rel, type, basename(src, extname(src)), hash, statSync(src).size, folderId)
      result.items.push(getItem(id)!)
    } catch {
      result.failed++
    }
  }
  return result
}

export function ensureCollection(worldId: string, name: string): Folder {
  const db = getDb()
  const existing = db
    .prepare("SELECT * FROM folders WHERE world_id = ? AND scope = 'media' AND name = ?")
    .get(worldId, name) as Folder | undefined
  if (existing) return existing
  const id = randomUUID()
  const pos = (db
    .prepare("SELECT COALESCE(MAX(position), -1) + 1 AS p FROM folders WHERE world_id = ? AND scope = 'media'")
    .get(worldId) as { p: number }).p
  db.prepare("INSERT INTO folders (id, world_id, parent_id, scope, name, position) VALUES (?, ?, NULL, 'media', ?, ?)")
    .run(id, worldId, name.trim() || 'Coleção', pos)
  return db.prepare('SELECT * FROM folders WHERE id = ?').get(id) as Folder
}

export const fileExists = (rel: string): boolean => existsSync(fullPath(rel))
