import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { rmSync } from 'fs'
import { join } from 'path'
import { getDb, mediaDir } from '../db/connection'
import type { GraphData, World, WorldStats } from '@shared/types'

const DEFAULT_TYPES = [
  { name: 'Personagem', icon: 'user', color: '#e0a96d', schema: [{ key: 'titulo', label: 'Título', kind: 'text' }, { key: 'idade', label: 'Idade', kind: 'number' }, { key: 'ocupacao', label: 'Ocupação', kind: 'text' }] },
  { name: 'Lugar', icon: 'map-pin', color: '#7fb7a4', schema: [{ key: 'regiao', label: 'Região', kind: 'text' }, { key: 'populacao', label: 'População', kind: 'number' }] },
  { name: 'Facção', icon: 'flag', color: '#b58ad6', schema: [{ key: 'lider', label: 'Líder', kind: 'text' }, { key: 'sede', label: 'Sede', kind: 'text' }] },
  { name: 'Item', icon: 'gem', color: '#e0c76d', schema: [{ key: 'raridade', label: 'Raridade', kind: 'text' }, { key: 'valor', label: 'Valor', kind: 'number' }] },
  { name: 'Criatura', icon: 'paw-print', color: '#e07a6b', schema: [{ key: 'habitat', label: 'Habitat', kind: 'text' }, { key: 'perigo', label: 'Nível de perigo', kind: 'number' }] }
]

const getWorld = (id: string): World =>
  getDb().prepare('SELECT * FROM worlds WHERE id = ?').get(id) as World

export function registerWorlds(): void {
  ipcMain.handle('worlds:list', (): World[] =>
    getDb().prepare('SELECT * FROM worlds ORDER BY updated_at DESC').all() as World[]
  )

  ipcMain.handle('worlds:create', (_e, name: string, description?: string): World => {
    const db = getDb()
    const id = randomUUID()
    const now = Date.now()
    db.transaction(() => {
      db.prepare(
        'INSERT INTO worlds (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
      ).run(id, name.trim() || 'Mundo sem nome', description?.trim() || null, now, now)
      const ins = db.prepare(
        'INSERT INTO card_types (id, world_id, name, icon, color, schema) VALUES (?, ?, ?, ?, ?, ?)'
      )
      for (const t of DEFAULT_TYPES) ins.run(randomUUID(), id, t.name, t.icon, t.color, JSON.stringify(t.schema))
    })()
    return getWorld(id)
  })

  ipcMain.handle(
    'worlds:update',
    (_e, id: string, patch: { name?: string; description?: string | null; cover_media_id?: string | null; theme?: string }): World => {
      const db = getDb()
      const cur = getWorld(id)
      db.prepare('UPDATE worlds SET name = ?, description = ?, cover_media_id = ?, theme = ?, updated_at = ? WHERE id = ?').run(
        patch.name?.trim() || cur.name,
        patch.description === undefined ? cur.description : patch.description,
        patch.cover_media_id === undefined ? cur.cover_media_id : patch.cover_media_id,
        patch.theme === undefined ? cur.theme : patch.theme,
        Date.now(),
        id
      )
      return getWorld(id)
    }
  )

  ipcMain.handle('worlds:remove', (_e, id: string): void => {
    getDb().prepare('DELETE FROM worlds WHERE id = ?').run(id)
    getDb().prepare('DELETE FROM search_index WHERE world_id = ?').run(id)
    rmSync(join(mediaDir(), id), { recursive: true, force: true })
  })

  ipcMain.handle('worlds:graph', (_e, id: string): GraphData => {
    const db = getDb()
    const nodes = db
      .prepare(
        `SELECT c.id, c.title AS label, t.name AS type, t.color
           FROM cards c LEFT JOIN card_types t ON t.id = c.type_id
          WHERE c.world_id = ?`
      )
      .all(id) as GraphData['nodes']
    const links = db
      .prepare(
        `SELECT DISTINCT l.source_card_id AS source, l.target_card_id AS target
           FROM card_links l JOIN cards c ON c.id = l.source_card_id
          WHERE c.world_id = ?`
      )
      .all(id) as GraphData['links']
    return { nodes, links }
  })

  ipcMain.handle('worlds:stats', (_e, id: string): WorldStats => {
    const db = getDb()
    const n = (sql: string): number => (db.prepare(sql).get(id) as { n: number }).n
    return {
      cards: n('SELECT COUNT(*) n FROM cards WHERE world_id = ?'),
      maps: n('SELECT COUNT(*) n FROM maps WHERE world_id = ?'),
      timelines: n('SELECT COUNT(*) n FROM timelines WHERE world_id = ?'),
      canvases: n('SELECT COUNT(*) n FROM canvases WHERE world_id = ?'),
      sheets: n('SELECT COUNT(*) n FROM sheets WHERE world_id = ?'),
      books: n('SELECT COUNT(*) n FROM quill_books WHERE world_id = ?')
    }
  })
}
