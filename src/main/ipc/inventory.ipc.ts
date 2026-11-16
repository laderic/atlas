import { ipcMain } from 'electron'
import { getDb } from '../db/connection'
import type { CardSummary } from '@shared/types'

// O inventário é uma relação "possui" entre cards: aparece também nas relações e na wiki.
const REL = 'possui'

const norm = (s: string): string => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/** Um item é único quando a propriedade "quantidade" é Único. */
const isUniqueItem = (properties: string | null): boolean => {
  try {
    const p = JSON.parse(properties ?? '{}') as Record<string, unknown>
    return norm(String(p.quantidade ?? '')) === 'unico'
  } catch {
    return false
  }
}

export function registerInventory(): void {
  const db = (): ReturnType<typeof getDb> => getDb()

  ipcMain.handle('inventory:list', (_e, cardId: string): CardSummary[] =>
    db().prepare(
      `SELECT c.id, c.world_id, c.type_id, c.folder_id, c.title, c.updated_at, c.image_id, c.cover_media_id, c.is_event
         FROM card_links l JOIN cards c ON c.id = l.target_card_id
        WHERE l.source_card_id = ? AND l.relation = ? ORDER BY c.title COLLATE NOCASE`
    ).all(cardId, REL) as CardSummary[]
  )

  // Mapa do mundo: quem possui o quê, quais itens são únicos e os nomes.
  ipcMain.handle('inventory:map', (_e, worldId: string) => {
    const links = db().prepare(
      `SELECT l.source_card_id AS owner, l.target_card_id AS item FROM card_links l
         JOIN cards c ON c.id = l.source_card_id WHERE c.world_id = ? AND l.relation = ?`
    ).all(worldId, REL) as { owner: string; item: string }[]
    const cards = db().prepare('SELECT id, title, properties FROM cards WHERE world_id = ?')
      .all(worldId) as { id: string; title: string; properties: string }[]
    return {
      links: links.map((l) => [l.owner, l.item] as [string, string]),
      unique: cards.filter((c) => isUniqueItem(c.properties)).map((c) => c.id),
      titles: Object.fromEntries(cards.map((c) => [c.id, c.title]))
    }
  })

  // Grava o inventário. Item único não pode estar com outro personagem.
  ipcMain.handle('inventory:set', (_e, cardId: string, itemIds: string[]): void => {
    db().transaction(() => {
      for (const id of itemIds) {
        if (id === cardId) continue
        const item = db().prepare('SELECT title, properties FROM cards WHERE id = ?')
          .get(id) as { title: string; properties: string } | undefined
        if (!item || !isUniqueItem(item.properties)) continue
        const owner = db().prepare(
          `SELECT c.title FROM card_links l JOIN cards c ON c.id = l.source_card_id
            WHERE l.target_card_id = ? AND l.relation = ? AND l.source_card_id != ? LIMIT 1`
        ).get(id, REL, cardId) as { title: string } | undefined
        if (owner) throw new Error(`"${item.title}" é único e já está com "${owner.title}".`)
      }
      db().prepare('DELETE FROM card_links WHERE source_card_id = ? AND relation = ?').run(cardId, REL)
      const ins = db().prepare('INSERT OR IGNORE INTO card_links (source_card_id, target_card_id, relation) VALUES (?, ?, ?)')
      for (const id of itemIds) if (id !== cardId) ins.run(cardId, id, REL)
    })()
  })
}
