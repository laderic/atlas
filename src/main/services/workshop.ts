import { randomUUID } from 'crypto'
import { getDb } from '../db/connection'
import { indexCard } from './search.service'
import type { WorkshopField, WorkshopSection, WorkshopTemplate, WorkshopTool } from '@shared/types'

const MAX_BYTES = 300 * 1024
const FIELD_KINDS = new Set(['text', 'longtext', 'number', 'select'])
const ID_RE = /^[a-z0-9][a-z0-9-]{1,39}$/
const KEY_RE = /^[a-zA-Z][a-zA-Z0-9_]{0,39}$/

const str = (v: unknown, max: number, field: string): string => {
  if (typeof v !== 'string') throw new Error(`Campo "${field}" deve ser texto.`)
  if (v.length > max) throw new Error(`Campo "${field}" é longo demais (máximo ${max} caracteres).`)
  return v.trim()
}
const arr = <T>(v: unknown, max: number, field: string, map: (x: unknown) => T): T[] => {
  if (v === undefined) return []
  if (!Array.isArray(v)) throw new Error(`Campo "${field}" deve ser uma lista.`)
  if (v.length > max) throw new Error(`Campo "${field}" tem itens demais (máximo ${max}).`)
  return v.map(map)
}

function normalizeField(x: unknown): WorkshopField {
  const f = x as Record<string, unknown>
  const kind = str(f.kind ?? 'text', 20, 'kind of field')
  if (!FIELD_KINDS.has(kind)) throw new Error(`Tipo de propriedade inválido: "${kind}".`)
  const key = str(f.key, 40, 'key')
  if (!KEY_RE.test(key)) throw new Error(`Chave inválida: "${key}". Use letras, números e _.`)
  return {
    key,
    label: str(f.label ?? key, 60, 'label'),
    kind: kind as WorkshopField['kind'],
    options: arr(f.options, 30, 'options', (o) => str(o, 60, 'opção'))
  }
}

function normalizeSection(x: unknown): WorkshopSection {
  const s = x as Record<string, unknown>
  return { title: str(s.title, 120, 'título da seção'), prompt: str(s.prompt ?? '', 400, 'prompt') }
}

function normalizeTemplate(x: unknown): WorkshopTemplate {
  const t = x as Record<string, unknown>
  const kind = t.kind === 'ficha' ? 'ficha' : t.kind === 'card' ? 'card' : null
  if (!kind) throw new Error('Cada modelo precisa ter "kind": "card" ou "ficha".')
  const id = str(t.id, 40, 'id do modelo')
  if (!ID_RE.test(id)) throw new Error(`Id de modelo inválido: "${id}".`)
  return {
    id,
    name: str(t.name, 80, 'nome do modelo'),
    kind,
    typeName: str(t.typeName ?? t.name, 60, 'typeName'),
    fields: arr(t.fields, 30, 'fields', normalizeField),
    sections: arr(t.sections, 30, 'sections', normalizeSection)
  }
}

/** Valida o arquivo da extensão. Só aceita dados; nenhum código é executado. */
export function parseTool(raw: string, enabled = true): WorkshopTool {
  if (Buffer.byteLength(raw, 'utf-8') > MAX_BYTES) throw new Error('O arquivo da extensão é grande demais.')
  let obj: Record<string, unknown>
  try {
    obj = JSON.parse(raw) as Record<string, unknown>
  } catch {
    throw new Error('O arquivo não é um JSON válido.')
  }
  if (obj.format !== 'atlas-tool') throw new Error('Este arquivo não é uma extensão do Atlas (campo "format" deve ser "atlas-tool").')
  const id = str(obj.id, 40, 'id')
  if (!ID_RE.test(id)) throw new Error(`Id inválido: "${id}". Use letras minúsculas, números e hífens.`)
  const templates = arr(obj.templates, 50, 'templates', normalizeTemplate)
  if (templates.length === 0) throw new Error('A extensão precisa ter pelo menos um modelo.')
  return {
    id,
    name: str(obj.name, 80, 'name'),
    version: str(obj.version ?? '1.0.0', 20, 'version'),
    description: str(obj.description ?? '', 400, 'description'),
    enabled,
    templates
  }
}

const docFromSections = (sections: WorkshopSection[]): Record<string, unknown> => {
  const content = sections.flatMap((s) => [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: s.title }] },
    s.prompt
      ? { type: 'paragraph', content: [{ type: 'text', text: s.prompt, marks: [{ type: 'italic' }] }] }
      : { type: 'paragraph' }
  ])
  return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] }
}

/** Cria um card (com seu tipo) ou uma ficha a partir de um modelo da extensão. */
export function createFromTemplate(worldId: string, t: WorkshopTemplate, title: string): { kind: 'card' | 'ficha'; id: string } {
  const db = getDb()
  const name = title.trim() || t.name
  const id = randomUUID()

  if (t.kind === 'ficha') {
    const attrs = t.fields.map((f) => ({ key: f.key, label: f.label, options: f.options }))
    db.prepare("INSERT INTO sheets (id, world_id, name, columns, rows, kind) VALUES (?, ?, ?, ?, '{}', 'ficha')")
      .run(id, worldId, name, JSON.stringify(attrs))
    return { kind: 'ficha', id }
  }

  // Tipo: reaproveita o existente pelo nome e acrescenta só as propriedades que faltam.
  const typeRow = db.prepare('SELECT id, schema FROM card_types WHERE world_id = ? AND lower(name) = lower(?)')
    .get(worldId, t.typeName) as { id: string; schema: string } | undefined
  const fieldsOf = (s: string): { key: string; label: string; kind: string; options?: string[] }[] => {
    try {
      return JSON.parse(s) as { key: string; label: string; kind: string; options?: string[] }[]
    } catch {
      return []
    }
  }
  let typeId: string
  if (typeRow) {
    typeId = typeRow.id
    const current = fieldsOf(typeRow.schema)
    const used = new Set(current.map((f) => f.key))
    const labels = new Set(current.map((f) => f.label.toLowerCase()))
    const extra = t.fields
      .filter((f) => !labels.has(f.label.toLowerCase()))
      .map((f) => {
        let key = f.key
        while (used.has(key)) key += '_'
        used.add(key)
        return { key, label: f.label, kind: f.kind, options: f.options }
      })
    if (extra.length) db.prepare('UPDATE card_types SET schema = ? WHERE id = ?').run(JSON.stringify([...current, ...extra]), typeId)
  } else {
    typeId = randomUUID()
    const schema = t.fields.map((f) => ({ key: f.key, label: f.label, kind: f.kind, options: f.options }))
    db.prepare('INSERT INTO card_types (id, world_id, name, icon, color, schema) VALUES (?, ?, ?, NULL, ?, ?)')
      .run(typeId, worldId, t.typeName, '#9a9cab', JSON.stringify(schema))
  }

  const now = Date.now()
  db.prepare(
    `INSERT INTO cards (id, world_id, type_id, folder_id, title, content, properties, created_at, updated_at)
     VALUES (?, ?, ?, NULL, ?, ?, '{}', ?, ?)`
  ).run(id, worldId, typeId, name, JSON.stringify(docFromSections(t.sections)), now, now)
  indexCard(id)
  return { kind: 'card', id }
}
