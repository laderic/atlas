import { getDb } from '../db/connection'
import type { SearchHit } from '@shared/types'

interface Node {
  type?: string
  text?: string
  attrs?: Record<string, unknown>
  content?: Node[]
}

const BLOCKS = new Set(['paragraph', 'heading', 'listItem', 'blockquote', 'codeBlock'])

export function plainText(node: Node | undefined): string {
  if (!node) return ''
  if (node.type === 'text') return node.text ?? ''
  if (node.type === 'mention' || node.type === 'tagMention') return String(node.attrs?.label ?? '')
  const inner = (node.content ?? []).map(plainText).join('')
  return BLOCKS.has(node.type ?? '') ? inner + '\n' : inner
}

export function extractMentions(node: Node | undefined, out = new Set<string>()): Set<string> {
  if (!node) return out
  if (node.type === 'mention' && typeof node.attrs?.id === 'string') out.add(node.attrs.id)
  for (const c of node.content ?? []) extractMentions(c, out)
  return out
}

const parse = <T>(s: string, fallback: T): T => {
  try {
    return JSON.parse(s) as T
  } catch {
    return fallback
  }
}

interface IndexRow {
  id: string
  world_id: string
  title: string
  content: string
  properties: string
}

export function indexCard(id: string): void {
  const db = getDb()
  const row = db
    .prepare('SELECT id, world_id, title, content, properties FROM cards WHERE id = ?')
    .get(id) as IndexRow | undefined
  db.prepare("DELETE FROM search_index WHERE entity_type = 'card' AND entity_id = ?").run(id)
  if (!row) return
  const props = parse<Record<string, unknown>>(row.properties, {})
  const propText = Object.values(props)
    .filter((v) => typeof v === 'string' || typeof v === 'number')
    .join(' ')
  const body = `${plainText(parse<Node>(row.content, {}))} ${propText}`.trim()
  db.prepare(
    "INSERT INTO search_index (entity_type, entity_id, world_id, title, body) VALUES ('card', ?, ?, ?, ?)"
  ).run(row.id, row.world_id, row.title, body)
}

export function removeFromIndex(id: string): void {
  getDb().prepare("DELETE FROM search_index WHERE entity_type = 'card' AND entity_id = ?").run(id)
}

export function reindexAll(): void {
  const db = getDb()
  db.transaction(() => {
    db.prepare('DELETE FROM search_index').run()
    const ids = db.prepare('SELECT id FROM cards').all() as { id: string }[]
    for (const { id } of ids) indexCard(id)
  })()
}

/** Reconstrói o índice se ele estiver fora de sincronia (ex.: após importar backup). */
export function ensureIndex(): void {
  const db = getDb()
  const cards = (db.prepare('SELECT COUNT(*) n FROM cards').get() as { n: number }).n
  const indexed = (db.prepare("SELECT COUNT(*) n FROM search_index WHERE entity_type = 'card'").get() as { n: number }).n
  if (cards !== indexed) reindexAll()
}

export function searchCards(worldId: string, q: string): SearchHit[] {
  const tokens = q.normalize('NFKC').split(/[^\p{L}\p{N}]+/u).filter(Boolean)
  if (tokens.length === 0) return []
  const match = tokens.map((t) => `"${t}"*`).join(' ')
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT entity_id AS id, title, snippet(search_index, 4, '', '', '…', 12) AS snippet
         FROM search_index
        WHERE search_index MATCH ? AND world_id = ? AND entity_type = 'card'
        ORDER BY rank
        LIMIT 30`
    )
    .all(match, worldId) as SearchHit[]
  const exists = db.prepare('SELECT 1 FROM cards WHERE id = ?')
  return rows.filter((r) => exists.get(r.id))
}
