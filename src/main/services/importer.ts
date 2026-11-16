import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { basename, extname, join, relative, sep } from 'path'
import { randomUUID } from 'crypto'
import AdmZip from 'adm-zip'
import mammoth from 'mammoth'
import { getDb } from '../db/connection'
import { indexCard, plainText } from './search.service'
import { ensureUnknownType } from './unknownType'
import type { ImportPayload, ImportSource, RawImport, RawNote, RawTable } from '@shared/types'

interface Entry { rel: string; read: () => Buffer }

const norm = (s: string): string => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
// Notion acrescenta um código de 32 caracteres ao nome de cada página e arquivo.
const cleanNotion = (s: string): string => s.replace(/\s[0-9a-f]{32}$/i, '').trim()

function fromDir(root: string): Entry[] {
  const out: Entry[] = []
  const walk = (dir: string): void => {
    for (const n of readdirSync(dir)) {
      if (n.startsWith('.')) continue
      const p = join(dir, n)
      if (statSync(p).isDirectory()) walk(p)
      else out.push({ rel: relative(root, p).split(sep).join('/'), read: () => readFileSync(p) })
    }
  }
  walk(root)
  return out
}

function fromZip(path: string): Entry[] {
  return new AdmZip(path).getEntries()
    .filter((e) => !e.isDirectory && !e.entryName.split('/').some((p) => p.startsWith('.') || p === '__MACOSX'))
    .map((e) => ({ rel: e.entryName, read: () => e.getData() }))
}

function entriesFrom(paths: string[]): Entry[] {
  const out: Entry[] = []
  for (const p of paths) {
    if (statSync(p).isDirectory()) out.push(...fromDir(p))
    else if (extname(p).toLowerCase() === '.zip') out.push(...fromZip(p))
    else out.push({ rel: basename(p), read: () => readFileSync(p) })
  }
  return out
}

const folderOf = (rel: string, clean: (s: string) => string): string[] =>
  rel.split('/').slice(0, -1).map(clean).filter(Boolean)
const baseName = (rel: string, clean: (s: string) => string): string =>
  clean(basename(rel, extname(rel)))

export async function scanImport(source: ImportSource, paths: string[]): Promise<RawImport> {
  const entries = entriesFrom(paths)
  const notes: RawNote[] = []
  const tables: RawTable[] = []
  const warnings: string[] = []
  const identity = (s: string): string => s.trim()

  if (source === 'obsidian' || source === 'worldanvil') {
    const clean = identity
    for (const e of entries) {
      const ext = extname(e.rel).toLowerCase()
      if (ext === '.md' || (source === 'worldanvil' && ext === '.html')) {
        notes.push({
          title: baseName(e.rel, clean),
          folder: folderOf(e.rel, clean),
          format: ext === '.md' ? 'md' : 'html',
          text: e.read().toString('utf-8'),
          asBook: false
        })
      }
    }
    if (notes.length === 0) warnings.push('Nenhum arquivo .md ou .html foi encontrado na pasta escolhida.')
  } else if (source === 'notion') {
    for (const e of entries) {
      const ext = extname(e.rel).toLowerCase()
      if (ext === '.md') {
        notes.push({ title: baseName(e.rel, cleanNotion), folder: folderOf(e.rel, cleanNotion), format: 'md', text: e.read().toString('utf-8'), asBook: false })
      } else if (ext === '.csv') {
        tables.push({ name: baseName(e.rel, cleanNotion), csv: e.read().toString('utf-8') })
      }
    }
    if (notes.length + tables.length === 0) warnings.push('Nada importável encontrado. Use a exportação "Markdown & CSV" do Notion.')
  } else {
    // Word e Google Docs: cada documento vira um livro.
    for (const e of entries) {
      const ext = extname(e.rel).toLowerCase()
      const title = baseName(e.rel, identity)
      if (ext === '.docx') {
        const result = await mammoth.convertToHtml({ buffer: e.read() })
        const imgs = (result.value.match(/<img/g) ?? []).length
        if (imgs) warnings.push(`"${title}": ${imgs} imagem(ns) não foram importadas. Adicione-as pela Biblioteca de mídia.`)
        notes.push({ title, folder: [], format: 'html', text: result.value, asBook: true })
      } else if (ext === '.html' || ext === '.htm') {
        notes.push({ title, folder: [], format: 'html', text: e.read().toString('utf-8'), asBook: true })
      }
    }
    if (notes.length === 0) warnings.push('Nenhum .docx ou .html foi encontrado. Baixe o documento como Word (.docx) ou HTML.')
  }
  return { source, notes, tables, warnings }
}

const wordsOf = (content: unknown): number => {
  const t = plainText(content as never).trim()
  return t ? t.split(/\s+/).length : 0
}

/** Troca @menções pelos ids dos cards; menções sem card viram texto comum. */
function resolveMentions(doc: Record<string, unknown>, titles: Map<string, string>): { doc: Record<string, unknown>; ids: Set<string> } {
  const ids = new Set<string>()
  const walk = (n: Record<string, unknown>): Record<string, unknown> => {
    if (n.type === 'mention') {
      const attrs = (n.attrs ?? {}) as { label?: string; target?: string }
      const label = String(attrs.label ?? attrs.target ?? '')
      const id = titles.get(norm(String(attrs.target ?? label)))
      if (id) {
        ids.add(id)
        return { type: 'mention', attrs: { id, label } }
      }
      return { type: 'text', text: label }
    }
    const content = Array.isArray(n.content) ? (n.content as Record<string, unknown>[]).map(walk) : undefined
    return content ? { ...n, content } : n
  }
  return { doc: walk(doc), ids }
}

export function commitImport(worldId: string, p: ImportPayload): { cards: number; tables: number; books: number } {
  const db = getDb()
  const now = Date.now()
  const res = { cards: 0, tables: 0, books: 0 }

  db.transaction(() => {
    const types = db.prepare('SELECT id, name, schema FROM card_types WHERE world_id = ?').all(worldId) as { id: string; name: string; schema: string }[]
    const typeByName = new Map(types.map((t) => [norm(t.name), t]))
    const titles = new Map<string, string>()
    for (const c of db.prepare('SELECT id, title FROM cards WHERE world_id = ?').all(worldId) as { id: string; title: string }[]) {
      titles.set(norm(c.title), c.id)
    }

    const folderIds = new Map<string, string>()
    const folderFor = (parts: string[]): string | null => {
      let parent: string | null = null
      let key = ''
      for (const raw of parts) {
        const name = raw.trim()
        if (!name) continue
        key += `/${name}`
        let id = folderIds.get(key)
        if (!id) {
          const ex = db.prepare("SELECT id FROM folders WHERE world_id = ? AND scope = 'cards' AND name = ? AND parent_id IS ?")
            .get(worldId, name, parent) as { id: string } | undefined
          id = ex?.id ?? randomUUID()
          if (!ex) {
            db.prepare("INSERT INTO folders (id, world_id, parent_id, scope, name, position) VALUES (?, ?, ?, 'cards', ?, 0)")
              .run(id, worldId, parent, name)
          }
          folderIds.set(key, id)
        }
        parent = id
      }
      return parent
    }

    // 1ª passagem: cria os cards (para que menções entre eles funcionem)
    const created: { id: string; content: Record<string, unknown> }[] = []
    for (const c of p.cards) {
      const id = randomUUID()
      const type = c.typeName ? typeByName.get(norm(c.typeName)) : undefined
      const fields = type ? (JSON.parse(type.schema) as { key: string; label: string; kind: string }[]) : []
      const props: Record<string, unknown> = {}
      for (const [label, value] of Object.entries(c.props)) {
        const f = fields.find((x) => norm(x.label) === norm(label) || x.key === label)
        if (!f) continue
        const isNum = f.kind === 'number' && value.trim() !== '' && !Number.isNaN(Number(value))
        props[f.key] = isNum ? Number(value) : value
      }
      db.prepare(
        `INSERT INTO cards (id, world_id, type_id, folder_id, title, content, properties, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, '{}', ?, ?, ?)`
      ).run(id, worldId, type?.id ?? null, folderFor(c.folder), c.title.trim() || 'Sem título', JSON.stringify(props), now, now)
      if (!titles.has(norm(c.title))) titles.set(norm(c.title), id)
      created.push({ id, content: c.content })
    }

    // Menções para páginas que não existem viram cards "Desconhecido" (para completar depois).
    const unknownType = ensureUnknownType(worldId)
    const missing = new Map<string, string>()
    const collect = (n: Record<string, unknown>): void => {
      if (n.type === 'mention') {
        const a = (n.attrs ?? {}) as { label?: string; target?: string }
        const label = String(a.target ?? a.label ?? '').trim()
        const key = norm(label)
        if (label && !titles.has(key) && !missing.has(key)) missing.set(key, label)
        return
      }
      for (const c of (Array.isArray(n.content) ? n.content : []) as Record<string, unknown>[]) collect(c)
    }
    for (const { content } of created) collect(content)
    for (const label of missing.values()) {
      const id = randomUUID()
      db.prepare(
        `INSERT INTO cards (id, world_id, type_id, folder_id, title, content, properties, created_at, updated_at)
         VALUES (?, ?, ?, NULL, ?, '{}', '{}', ?, ?)`
      ).run(id, worldId, unknownType, label, now, now)
      titles.set(norm(label), id)
      indexCard(id)
    }

    // 2ª passagem: conteúdo, menções e busca
    for (const { id, content } of created) {
      const { doc, ids } = resolveMentions(content, titles)
      db.prepare('UPDATE cards SET content = ? WHERE id = ?').run(JSON.stringify(doc), id)
      for (const t of ids) {
        if (t !== id) db.prepare("INSERT OR IGNORE INTO card_links (source_card_id, target_card_id, relation) VALUES (?, ?, 'mention')").run(id, t)
      }
      indexCard(id)
    }
    res.cards = created.length

    // Tabelas: colunas numéricas viram tipo número, o resto é texto.
    for (const t of p.tables) {
      const keys = t.columns.map((_, i) => `c${i}`)
      const numeric = t.columns.map((_, i) => {
        const vals = t.rows.map((r) => (r[i] ?? '').trim()).filter((v) => v !== '')
        return vals.length > 0 && vals.every((v) => !Number.isNaN(Number(v.replace(',', '.'))))
      })
      const cols = t.columns.map((label, i) => ({
        key: keys[i],
        label: label.trim() || `Coluna ${i + 1}`,
        type: numeric[i] ? 'number' : 'text'
      }))
      const rows = t.rows.map((r) =>
        Object.fromEntries(keys.map((k, i) => {
          const raw = (r[i] ?? '').trim()
          const v = cols[i].type === 'number' && raw !== '' ? Number(raw.replace(',', '.')) : raw || null
          return [k, v]
        }))
      )
      db.prepare("INSERT INTO sheets (id, world_id, name, columns, rows, kind) VALUES (?, ?, ?, ?, ?, 'tabela')")
        .run(randomUUID(), worldId, t.name || 'Tabela importada', JSON.stringify(cols), JSON.stringify(rows))
      res.tables++
    }

    // Livros: cada capítulo com a contagem de palavras já calculada.
    for (const b of p.books) {
      const bid = randomUUID()
      db.prepare('INSERT INTO quill_books (id, world_id, title) VALUES (?, ?, ?)').run(bid, worldId, b.title || 'Livro importado')
      const chapters = b.chapters.length ? b.chapters : [{ title: 'Capítulo 1', content: { type: 'doc', content: [{ type: 'paragraph' }] } }]
      chapters.forEach((ch, i) => {
        db.prepare('INSERT INTO quill_chapters (id, book_id, title, content, position, word_count) VALUES (?, ?, ?, ?, ?, ?)')
          .run(randomUUID(), bid, ch.title || `Capítulo ${i + 1}`, JSON.stringify(ch.content), i, wordsOf(ch.content))
      })
      res.books++
    }
  })()

  return res
}

export const pathExists = (p: string): boolean => existsSync(p)
