import { randomUUID } from 'crypto'
import { getDb } from '../db/connection'

export const UNKNOWN_TYPE_NAME = 'Desconhecido'

/** Tipo usado para cards criados por menção (ainda sem categoria). Cria o tipo se não existir. */
export function ensureUnknownType(worldId: string): string {
  const db = getDb()
  const row = db.prepare('SELECT id FROM card_types WHERE world_id = ? AND name = ?').get(worldId, UNKNOWN_TYPE_NAME) as { id: string } | undefined
  if (row) return row.id
  const id = randomUUID()
  db.prepare('INSERT INTO card_types (id, world_id, name, icon, color, schema) VALUES (?, ?, ?, NULL, ?, ?)')
    .run(id, worldId, UNKNOWN_TYPE_NAME, '#7a7f8c', '[]')
  return id
}
