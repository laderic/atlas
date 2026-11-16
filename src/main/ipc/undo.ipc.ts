import { ipcMain } from 'electron'
import { getDb } from '../db/connection'
import { indexCard, removeFromIndex } from '../services/search.service'
import type { CardSnapshot } from '@shared/types'

const q = (name: string): string => `"${name.replace(/"/g, '""')}"`

/**
 * Guarda tudo que sai junto com um card: a linha dele, as linhas que o banco apagaria
 * em cascata (ligações, tags, envolvidos, nascimentos, destaques, inventário...) e as
 * referências que viram vazias (mapas, linhas do tempo, fichas).
 */
function snapshotCard(id: string): CardSnapshot {
  const db = getDb()
  const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(id) as Record<string, unknown> | undefined
  if (!card) throw new Error('Card não encontrado.')
  const cascade: CardSnapshot['cascade'] = []
  const nulled: CardSnapshot['nulled'] = []
  const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[])
    .map((r) => r.name)
    .filter((t) => t !== 'cards' && !t.startsWith('search_index'))
  for (const t of tables) {
    const fks = (db.prepare(`PRAGMA foreign_key_list(${q(t)})`).all() as
      { table: string; from: string; on_delete: string }[]).filter((f) => f.table === 'cards')
    for (const fk of fks) {
      if (fk.on_delete === 'CASCADE') {
        const rows = db.prepare(`SELECT * FROM ${q(t)} WHERE ${q(fk.from)} = ?`).all(id) as Record<string, unknown>[]
        if (rows.length) cascade.push({ table: t, rows })
      } else if (fk.on_delete === 'SET NULL') {
        const rowids = (db.prepare(`SELECT rowid AS rid FROM ${q(t)} WHERE ${q(fk.from)} = ?`).all(id) as { rid: number }[]).map((r) => r.rid)
        if (rowids.length) nulled.push({ table: t, col: fk.from, rowids })
      }
    }
  }
  return { card, cascade, nulled }
}

function insertRow(table: string, row: Record<string, unknown>): void {
  const db = getDb()
  const cols = Object.keys(row)
  db.prepare(`INSERT OR IGNORE INTO ${q(table)} (${cols.map(q).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
    .run(...cols.map((c) => row[c] as never))
}

export function registerUndo(): void {
  ipcMain.handle('cards:removeWithUndo', (_e, id: string): CardSnapshot => {
    const db = getDb()
    let snap: CardSnapshot | null = null
    db.transaction(() => {
      snap = snapshotCard(id)
      db.prepare('DELETE FROM cards WHERE id = ?').run(id)
    })()
    removeFromIndex(id)
    return snap as unknown as CardSnapshot
  })

  ipcMain.handle('cards:restore', (_e, snap: CardSnapshot): void => {
    const db = getDb()
    db.transaction(() => {
      const card = snap.card
      const cols = Object.keys(card)
      db.prepare(`INSERT INTO cards (${cols.map(q).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
        .run(...cols.map((c) => card[c] as never))
      for (const c of snap.cascade) for (const row of c.rows) insertRow(c.table, row)
      for (const n of snap.nulled) {
        if (n.rowids.length === 0) continue
        db.prepare(`UPDATE ${q(n.table)} SET ${q(n.col)} = ? WHERE rowid IN (${n.rowids.map(() => '?').join(',')})`)
          .run(card.id as never, ...(n.rowids as never[]))
      }
    })()
    indexCard(String(card.id))
  })
}
