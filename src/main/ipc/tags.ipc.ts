import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { getDb } from '../db/connection'
import type { Tag, TagMap } from '@shared/types'

const HEX = /^#[0-9a-fA-F]{6}$/

export function registerTags(): void {
  const db = (): ReturnType<typeof getDb> => getDb()
  const getTag = (id: string): Tag => db().prepare('SELECT * FROM tags WHERE id = ?').get(id) as Tag

  ipcMain.handle('tags:map', (_e, worldId: string): TagMap => {
    const tags = db().prepare('SELECT * FROM tags WHERE world_id = ? ORDER BY name COLLATE NOCASE').all(worldId) as Tag[]
    const links = db().prepare(
      `SELECT ct.card_id AS c, ct.tag_id AS t FROM card_tags ct JOIN cards c ON c.id = ct.card_id WHERE c.world_id = ?`
    ).all(worldId) as { c: string; t: string }[]
    return { tags, links: links.map((l) => [l.c, l.t] as [string, string]) }
  })

  ipcMain.handle('tags:create', (_e, worldId: string, name: string, color: string): Tag => {
    const clean = name.trim()
    if (!clean) throw new Error('A tag precisa de um nome.')
    const id = randomUUID()
    try {
      db().prepare('INSERT INTO tags (id, world_id, name, color) VALUES (?, ?, ?, ?)')
        .run(id, worldId, clean, HEX.test(color) ? color : '#9a9cab')
    } catch (err) {
      if (String((err as Error).message).includes('UNIQUE')) throw new Error('Já existe uma tag com este nome.')
      throw err
    }
    return getTag(id)
  })

  ipcMain.handle('tags:update', (_e, id: string, patch: { name?: string; color?: string; description?: string | null }): void => {
    const cur = getTag(id)
    const description = 'description' in patch ? (patch.description?.trim() || null) : cur.description
    const name = patch.name?.trim() || cur.name
    const color = patch.color && HEX.test(patch.color) ? patch.color : cur.color
    try {
      db().prepare('UPDATE tags SET name = ?, color = ?, description = ? WHERE id = ?').run(name, color, description, id)
    } catch (err) {
      if (String((err as Error).message).includes('UNIQUE')) throw new Error('Já existe uma tag com este nome.')
      throw err
    }
  })

  ipcMain.handle('tags:remove', (_e, id: string): void => {
    db().prepare('DELETE FROM tags WHERE id = ?').run(id)
  })

  // Substitui as tags de um card de uma vez.
  ipcMain.handle('tags:setCardTags', (_e, cardId: string, tagIds: string[]): void => {
    db().transaction(() => {
      db().prepare('DELETE FROM card_tags WHERE card_id = ?').run(cardId)
      const ins = db().prepare('INSERT OR IGNORE INTO card_tags (card_id, tag_id) VALUES (?, ?)')
      for (const t of tagIds) ins.run(cardId, t)
    })()
  })
}
