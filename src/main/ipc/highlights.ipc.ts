import { ipcMain } from 'electron'
import { getDb } from '../db/connection'
import type { CardSummary } from '@shared/types'

export function registerHighlights(): void {
  const db = (): ReturnType<typeof getDb> => getDb()

  ipcMain.handle('highlights:list', (_e, worldId: string): CardSummary[] =>
    db().prepare(
      `SELECT c.id, c.world_id, c.type_id, c.folder_id, c.title, c.updated_at, c.image_id, c.cover_media_id, c.is_event
         FROM highlights h JOIN cards c ON c.id = h.card_id
        WHERE h.world_id = ? ORDER BY h.position`
    ).all(worldId) as CardSummary[]
  )

  // Grava a lista na ordem recebida (a ordem é a do carrossel).
  ipcMain.handle('highlights:set', (_e, worldId: string, cardIds: string[]): void => {
    db().transaction(() => {
      db().prepare('DELETE FROM highlights WHERE world_id = ?').run(worldId)
      const ins = db().prepare('INSERT OR IGNORE INTO highlights (world_id, card_id, position) VALUES (?, ?, ?)')
      cardIds.forEach((id, i) => ins.run(worldId, id, i))
    })()
  })
}
