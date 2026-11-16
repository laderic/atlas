import { ipcMain } from 'electron'
import { getDb } from '../db/connection'
import type { CardSummary } from '@shared/types'

const COLS = 'c.id, c.world_id, c.type_id, c.folder_id, c.title, c.updated_at, c.image_id, c.cover_media_id, c.is_event'

export function registerEventCards(): void {
  const db = (): ReturnType<typeof getDb> => getDb()

  ipcMain.handle('eventCards:list', (_e, worldId: string): CardSummary[] =>
    db().prepare(`SELECT ${COLS} FROM cards c WHERE c.world_id = ? AND c.is_event = 1 ORDER BY c.title COLLATE NOCASE`)
      .all(worldId) as CardSummary[]
  )

  ipcMain.handle('eventCards:participants', (_e, eventId: string): CardSummary[] =>
    db().prepare(
      `SELECT ${COLS} FROM event_participants p JOIN cards c ON c.id = p.card_id
        WHERE p.event_id = ? ORDER BY c.title COLLATE NOCASE`
    ).all(eventId) as CardSummary[]
  )

  // Substitui a lista de envolvidos; um evento não pode envolver a si mesmo.
  ipcMain.handle('eventCards:setParticipants', (_e, eventId: string, cardIds: string[]): void => {
    db().transaction(() => {
      db().prepare('DELETE FROM event_participants WHERE event_id = ?').run(eventId)
      const ins = db().prepare('INSERT OR IGNORE INTO event_participants (event_id, card_id) VALUES (?, ?)')
      for (const id of cardIds) if (id !== eventId) ins.run(eventId, id)
    })()
  })

  ipcMain.handle('eventCards:setFlag', (_e, cardId: string, on: boolean): void => {
    db().prepare('UPDATE cards SET is_event = ? WHERE id = ?').run(on ? 1 : 0, cardId)
  })
}
