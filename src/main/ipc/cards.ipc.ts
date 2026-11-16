import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { ensureUnknownType } from '../services/unknownType'
import { getDb } from '../db/connection'
import { ensureIndex, extractMentions, indexCard, removeFromIndex, searchCards } from '../services/search.service'
import type {
  Card, CardField, CardPatch, CardSummary, CardType, CardTypeInput, Folder, SearchHit
} from '@shared/types'

interface CardRow {
  id: string
  world_id: string
  type_id: string | null
  folder_id: string | null
  title: string
  content: string
  image_id: string | null
  cover_media_id: string | null
  is_event: number
  properties: string
  created_at: number
  updated_at: number
}
interface TypeRow {
  id: string
  world_id: string
  name: string
  icon: string | null
  color: string | null
  schema: string
}

const EMPTY_DOC = { type: 'doc', content: [{ type: 'paragraph' }] }
const FIELD_KINDS = new Set(['text', 'longtext', 'number', 'select', 'card', 'chips'])
const SUMMARY = 'id, world_id, type_id, folder_id, title, updated_at, image_id, cover_media_id, is_event'

const parse = <T>(s: string, fallback: T): T => {
  try {
    return JSON.parse(s) as T
  } catch {
    return fallback
  }
}

const toCard = (r: CardRow): Card => ({
  id: r.id,
  world_id: r.world_id,
  type_id: r.type_id,
  folder_id: r.folder_id,
  title: r.title,
  image_id: r.image_id,
  cover_media_id: r.cover_media_id,
  is_event: r.is_event,
  created_at: r.created_at,
  updated_at: r.updated_at,
  content: parse(r.content, EMPTY_DOC),
  properties: parse(r.properties, {})
})

const toType = (r: TypeRow): CardType => ({
  id: r.id,
  world_id: r.world_id,
  name: r.name,
  icon: r.icon,
  color: r.color,
  fields: parse<CardField[]>(r.schema, [])
})

const getSummary = (id: string): CardSummary =>
  getDb().prepare(`SELECT ${SUMMARY} FROM cards WHERE id = ?`).get(id) as CardSummary

function syncLinks(id: string, worldId: string, content: unknown): void {
  const db = getDb()
  db.prepare("DELETE FROM card_links WHERE source_card_id = ? AND relation = 'mention'").run(id)
  const ins = db.prepare(
    `INSERT OR IGNORE INTO card_links (source_card_id, target_card_id, relation)
     SELECT ?, id, 'mention' FROM cards WHERE id = ? AND world_id = ?`
  )
  for (const target of extractMentions(content as never)) {
    if (target !== id) ins.run(id, target, worldId)
  }
}

function cleanFields(fields: CardField[]): CardField[] {
  const seen = new Set<string>()
  const out: CardField[] = []
  for (const f of fields) {
    const label = f.label?.trim()
    if (!label || !FIELD_KINDS.has(f.kind)) continue
    let key = f.key?.trim() || `f${randomUUID().slice(0, 6)}`
    while (seen.has(key)) key += '_'
    seen.add(key)
    const field: CardField = { key, label, kind: f.kind }
    if (f.kind === 'select') field.options = (f.options ?? []).map((o) => o.trim()).filter(Boolean)
    out.push(field)
  }
  return out
}

export function registerCards(): void {
  const db = (): ReturnType<typeof getDb> => getDb()

  // ---------- tipos de card ----------
  ipcMain.handle('cardTypes:list', (_e, worldId: string): CardType[] =>
    (db().prepare('SELECT * FROM card_types WHERE world_id = ? ORDER BY rowid').all(worldId) as TypeRow[]).map(toType)
  )

  ipcMain.handle('cardTypes:save', (_e, worldId: string, input: CardTypeInput): CardType => {
    const name = input.name.trim() || 'Sem nome'
    const schema = JSON.stringify(cleanFields(input.fields ?? []))
    let id = input.id
    if (id) {
      db().prepare('UPDATE card_types SET name = ?, icon = ?, color = ?, schema = ? WHERE id = ?')
        .run(name, input.icon ?? null, input.color ?? null, schema, id)
    } else {
      id = randomUUID()
      db().prepare('INSERT INTO card_types (id, world_id, name, icon, color, schema) VALUES (?, ?, ?, ?, ?, ?)')
        .run(id, worldId, name, input.icon ?? null, input.color ?? '#9a9cab', schema)
    }
    return toType(db().prepare('SELECT * FROM card_types WHERE id = ?').get(id) as TypeRow)
  })

  ipcMain.handle('cardTypes:remove', (_e, id: string): void => {
    db().prepare('DELETE FROM card_types WHERE id = ?').run(id)
  })

  // ---------- cards ----------
  ipcMain.handle('cards:list', (_e, worldId: string): CardSummary[] =>
    db().prepare(`SELECT ${SUMMARY} FROM cards WHERE world_id = ? ORDER BY title COLLATE NOCASE`).all(worldId) as CardSummary[]
  )

  ipcMain.handle('cards:get', (_e, id: string): Card | null => {
    const r = db().prepare('SELECT * FROM cards WHERE id = ?').get(id) as CardRow | undefined
    return r ? toCard(r) : null
  })

  ipcMain.handle(
    'cards:create',
    (_e, worldId: string, input: { title?: string; type_id?: string | null; folder_id?: string | null }): Card => {
      const id = randomUUID()
      const now = Date.now()
      db().prepare(
        `INSERT INTO cards (id, world_id, type_id, folder_id, title, content, properties, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, '{}', ?, ?)`
      ).run(id, worldId, input.type_id ?? null, input.folder_id ?? null, input.title?.trim() || 'Sem título', JSON.stringify(EMPTY_DOC), now, now)
      indexCard(id)
      return toCard(db().prepare('SELECT * FROM cards WHERE id = ?').get(id) as CardRow)
    }
  )

  ipcMain.handle('cards:update', (_e, id: string, patch: CardPatch): CardSummary => {
    const cur = db().prepare('SELECT * FROM cards WHERE id = ?').get(id) as CardRow | undefined
    if (!cur) throw new Error('Card não encontrado.')
    const title = patch.title !== undefined ? patch.title.trim() || 'Sem título' : cur.title
    const typeId = 'type_id' in patch ? (patch.type_id ?? null) : cur.type_id
    const folderId = 'folder_id' in patch ? (patch.folder_id ?? null) : cur.folder_id
    const imageId = 'image_id' in patch ? (patch.image_id ?? null) : cur.image_id
    const coverId = 'cover_media_id' in patch ? (patch.cover_media_id ?? null) : cur.cover_media_id
    const content = patch.content !== undefined ? JSON.stringify(patch.content) : cur.content
    const properties = patch.properties !== undefined ? JSON.stringify(patch.properties) : cur.properties

    db().transaction(() => {
      db().prepare(
        'UPDATE cards SET title = ?, type_id = ?, folder_id = ?, image_id = ?, cover_media_id = ?, content = ?, properties = ?, updated_at = ? WHERE id = ?'
      ).run(title, typeId, folderId, imageId, coverId, content, properties, Date.now(), id)
      if (patch.content !== undefined) syncLinks(id, cur.world_id, patch.content)
    })()
    indexCard(id)
    return getSummary(id)
  })

  ipcMain.handle('cards:remove', (_e, id: string): void => {
    db().prepare('DELETE FROM cards WHERE id = ?').run(id)
    removeFromIndex(id)
  })

  ipcMain.handle('cards:backlinks', (_e, id: string): CardSummary[] =>
    db().prepare(
      `SELECT c.id, c.world_id, c.type_id, c.folder_id, c.title, c.updated_at
         FROM card_links l JOIN cards c ON c.id = l.source_card_id
        WHERE l.target_card_id = ? AND l.source_card_id != ?
        ORDER BY c.title COLLATE NOCASE`
    ).all(id, id) as CardSummary[]
  )

  // Card criado a partir de uma menção: entra como "Desconhecido" até ganhar um tipo.
  ipcMain.handle('cards:createStub', (_e, worldId: string, title: string): CardSummary => {
    const typeId = ensureUnknownType(worldId)
    const id = randomUUID()
    const now = Date.now()
    db().prepare(
      `INSERT INTO cards (id, world_id, type_id, folder_id, title, content, properties, created_at, updated_at)
       VALUES (?, ?, ?, NULL, ?, ?, '{}', ?, ?)`
    ).run(id, worldId, typeId, title.trim() || 'Sem título', JSON.stringify(EMPTY_DOC), now, now)
    indexCard(id)
    return db().prepare(`SELECT ${SUMMARY} FROM cards WHERE id = ?`).get(id) as CardSummary
  })

  // ---------- pastas ----------
  ipcMain.handle('folders:list', (_e, worldId: string): Folder[] =>
    db().prepare("SELECT * FROM folders WHERE world_id = ? AND scope = 'cards' ORDER BY position, name COLLATE NOCASE").all(worldId) as Folder[]
  )

  ipcMain.handle('folders:create', (_e, worldId: string, name: string, parentId: string | null): Folder => {
    const id = randomUUID()
    const pos = (db().prepare(
      "SELECT COALESCE(MAX(position), -1) + 1 AS p FROM folders WHERE world_id = ? AND scope = 'cards' AND parent_id IS ?"
    ).get(worldId, parentId) as { p: number }).p
    db().prepare("INSERT INTO folders (id, world_id, parent_id, scope, name, position) VALUES (?, ?, ?, 'cards', ?, ?)")
      .run(id, worldId, parentId, name.trim() || 'Nova pasta', pos)
    return db().prepare('SELECT * FROM folders WHERE id = ?').get(id) as Folder
  })

  ipcMain.handle('folders:rename', (_e, id: string, name: string): void => {
    db().prepare('UPDATE folders SET name = ? WHERE id = ?').run(name.trim() || 'Pasta', id)
  })

  ipcMain.handle('folders:color', (_e, id: string, color: string | null): void => {
    db().prepare('UPDATE folders SET color = ? WHERE id = ?').run(color || null, id)
  })

  // Subpastas são removidas junto; os cards de dentro voltam para a raiz.
  ipcMain.handle('folders:remove', (_e, id: string): void => {
    db().prepare('DELETE FROM folders WHERE id = ?').run(id)
  })

  // ---------- busca ----------
  ipcMain.handle('search:query', (_e, worldId: string, q: string): SearchHit[] => searchCards(worldId, q))

  ensureIndex()
}
