import type { ImportPayload, RawImport, RawNote, RawTable } from '@shared/types'

type J = Record<string, unknown>

const BLOCK = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'blockquote', 'pre', 'table'])
const CONTAINER = new Set(['div', 'section', 'article', 'body', 'header', 'main'])

const text = (t: string, marks: string[] = []): J[] =>
  t ? [{ type: 'text', text: t, ...(marks.length ? { marks: marks.map((type) => ({ type })) } : {}) }] : []

const decodeTarget = (url: string): string => {
  let u = url
  try {
    u = decodeURIComponent(url)
  } catch {
    /* mantém como está */
  }
  return u.split('/').pop()!.split('#')[0].replace(/\.md$/i, '').replace(/\s[0-9a-f]{32}$/i, '').trim()
}

// ---------- Markdown ----------
const INLINE_RE =
  /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]|!\[\[[^\]]+\]\]|!\[[^\]]*\]\([^)]*\)|\[([^\]]+)\]\(([^)]+)\)|\*\*(.+?)\*\*|__(.+?)__|\*([^*\n]+?)\*|_([^_\n]+?)_|`([^`]+)`/g

function inlineMd(src: string, marks: string[] = []): J[] {
  const out: J[] = []
  let last = 0
  const re = new RegExp(INLINE_RE.source, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) {
    out.push(...text(src.slice(last, m.index), marks))
    last = re.lastIndex
    if (m[1]) {
      const target = m[1].split('#')[0].trim()
      const label = (m[2] ?? m[1]).trim()
      out.push({ type: 'mention', attrs: { id: null, label, target } })
    } else if (m[0].startsWith('!')) {
      // imagens não entram no texto
    } else if (m[3] !== undefined) {
      const url = m[4].trim()
      if (/^[a-z]+:\/\//i.test(url) || url.startsWith('#')) out.push(...inlineMd(m[3], marks))
      else out.push({ type: 'mention', attrs: { id: null, label: m[3], target: decodeTarget(url) } })
    } else if (m[5] !== undefined) out.push(...inlineMd(m[5], [...marks, 'bold']))
    else if (m[6] !== undefined) out.push(...inlineMd(m[6], [...marks, 'bold']))
    else if (m[7] !== undefined) out.push(...inlineMd(m[7], [...marks, 'italic']))
    else if (m[8] !== undefined) out.push(...inlineMd(m[8], [...marks, 'italic']))
    else if (m[9] !== undefined) out.push(...text(m[9], [...marks, 'code']))
  }
  out.push(...text(src.slice(last), marks))
  return out
}

export function mdToDoc(src: string): { doc: J; props: Record<string, string> } {
  let body = src.replace(/\r\n/g, '\n').replace(/^\uFEFF/, '')
  const props: Record<string, string> = {}

  // frontmatter (YAML simples: chave: valor)
  if (body.startsWith('---\n')) {
    const end = body.indexOf('\n---', 4)
    if (end > 0) {
      for (const line of body.slice(4, end).split('\n')) {
        const m = /^([^:#]+):\s*(.*)$/.exec(line)
        if (m) props[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '').replace(/^\[(.*)\]$/, '$1')
      }
      body = body.slice(end + 4)
    }
  }

  const lines = body.split('\n')
  const blocks: J[] = []
  const push = (b: J): void => {
    if (b.type === 'paragraph' && !(b.content as unknown[])?.length) return
    blocks.push(b)
  }
  const isBreak = (l: string): boolean =>
    /^(#{1,6}\s|```|\s*>|\s*[-*+]\s|\s*\d+[.)]\s)/.test(l)

  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (/^```/.test(line)) {
      const buf: string[] = []
      i++
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++])
      i++
      push({ type: 'codeBlock', content: buf.length ? [{ type: 'text', text: buf.join('\n') }] : [] })
      continue
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line)
    if (h) {
      push({ type: 'heading', attrs: { level: Math.min(3, h[1].length) }, content: inlineMd(h[2]) })
      i++
      continue
    }
    if (/^\s*>/.test(line)) {
      const buf: string[] = []
      while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ''))
      push({ type: 'blockquote', content: [{ type: 'paragraph', content: inlineMd(buf.join(' ')) }] })
      continue
    }
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: J[] = []
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push({ type: 'listItem', content: [{ type: 'paragraph', content: inlineMd(lines[i].replace(/^\s*[-*+]\s+/, '')) }] })
        i++
      }
      push({ type: 'bulletList', content: items })
      continue
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: J[] = []
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push({ type: 'listItem', content: [{ type: 'paragraph', content: inlineMd(lines[i].replace(/^\s*\d+[.)]\s+/, '')) }] })
        i++
      }
      push({ type: 'orderedList', content: items })
      continue
    }
    if (line.trim() === '') {
      i++
      continue
    }
    const buf: string[] = []
    while (i < lines.length && lines[i].trim() !== '' && !isBreak(lines[i])) buf.push(lines[i++])
    if (buf.length === 0) buf.push(lines[i++])
    push({ type: 'paragraph', content: inlineMd(buf.join(' ').trim()) })
  }
  return { doc: { type: 'doc', content: blocks.length ? blocks : [{ type: 'paragraph' }] }, props }
}

// ---------- HTML (Word, Google Docs, World Anvil) ----------
const parseHtml = (html: string): Document => new DOMParser().parseFromString(html, 'text/html')

function inlineDom(n: Node, marks: string[] = []): J[] {
  if (n.nodeType === Node.TEXT_NODE) return text((n.textContent ?? '').replace(/\s+/g, ' '), marks)
  if (n.nodeType !== Node.ELEMENT_NODE) return []
  const el = n as Element
  const tag = el.tagName.toLowerCase()
  if (tag === 'br') return [{ type: 'hardBreak' }]
  if (tag === 'img' || tag === 'script' || tag === 'style') return []
  const m =
    tag === 'strong' || tag === 'b' ? [...marks, 'bold']
      : tag === 'em' || tag === 'i' ? [...marks, 'italic']
        : tag === 'code' ? [...marks, 'code'] : marks
  return [...el.childNodes].flatMap((c) => inlineDom(c, m))
}

function blocksOf(el: Element): J[] {
  const tag = el.tagName.toLowerCase()
  const inl = (): J[] => [...el.childNodes].flatMap((c) => inlineDom(c))
  const para = (content: J[]): J[] => (content.length ? [{ type: 'paragraph', content }] : [])

  if (/^h[1-6]$/.test(tag)) return [{ type: 'heading', attrs: { level: Math.min(3, Number(tag[1])) }, content: inl() }]
  if (tag === 'p') return para(inl())
  if (tag === 'ul' || tag === 'ol') {
    const items = [...el.children].filter((c) => c.tagName.toLowerCase() === 'li').map((li) => ({
      type: 'listItem',
      content: [{ type: 'paragraph', content: [...li.childNodes].flatMap((c) => inlineDom(c)) }]
    }))
    return items.length ? [{ type: tag === 'ul' ? 'bulletList' : 'orderedList', content: items }] : []
  }
  if (tag === 'blockquote') return [{ type: 'blockquote', content: [{ type: 'paragraph', content: inl() }] }]
  if (tag === 'pre') return [{ type: 'codeBlock', content: [{ type: 'text', text: el.textContent ?? '' }] }]
  if (tag === 'table') {
    return [...el.querySelectorAll('tr')].flatMap((tr) =>
      para(text([...tr.children].map((td) => (td.textContent ?? '').trim()).filter(Boolean).join(' | ')))
    )
  }
  const hasBlock = [...el.children].some((c) => BLOCK.has(c.tagName.toLowerCase()))
  if (CONTAINER.has(tag) && hasBlock) return [...el.children].flatMap(blocksOf)
  if (!hasBlock) return para(inl())
  return [...el.children].flatMap(blocksOf)
}

export function htmlToDoc(html: string): J {
  const blocks = [...parseHtml(html).body.children].flatMap(blocksOf)
  return { type: 'doc', content: blocks.length ? blocks : [{ type: 'paragraph' }] }
}

/** Divide um documento em capítulos: cada título de nível 1 começa um novo. */
export function htmlChapters(html: string, fallbackTitle: string): { title: string; content: J }[] {
  const chapters: { title: string; blocks: J[] }[] = []
  const state: { cur: { title: string; blocks: J[] } | null } = { cur: null }

  const visit = (el: Element): void => {
    const tag = el.tagName.toLowerCase()
    if (tag === 'h1') {
      state.cur = { title: (el.textContent ?? '').trim() || 'Capítulo', blocks: [] }
      chapters.push(state.cur)
      return
    }
    const hasBlock = [...el.children].some((c) => BLOCK.has(c.tagName.toLowerCase()))
    if (CONTAINER.has(tag) && hasBlock) {
      ;[...el.children].forEach(visit)
      return
    }
    if (!state.cur) {
      state.cur = { title: fallbackTitle, blocks: [] }
      chapters.push(state.cur)
    }
    state.cur.blocks.push(...blocksOf(el))
  }
  ;[...parseHtml(html).body.children].forEach(visit)

  return chapters
    .filter((c) => c.blocks.length > 0 || c.title !== fallbackTitle)
    .map((c) => ({ title: c.title, content: { type: 'doc', content: c.blocks.length ? c.blocks : [{ type: 'paragraph' }] } }))
}

// ---------- CSV ----------
export function parseCsv(src: string): string[][] {
  const s = src.replace(/^\uFEFF/, '')
  const firstLine = s.split(/\r?\n/)[0] ?? ''
  const delim = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ','
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (quoted) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === delim) {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += ch
  }
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

// ---------- montagem do lote ----------
export interface Prepared {
  payload: ImportPayload
  counts: { cards: number; tables: number; books: number; chapters: number }
}

export function prepare(raw: RawImport): Prepared {
  const payload: ImportPayload = { cards: [], tables: [], books: [] }

  for (const n of raw.notes as RawNote[]) {
    if (n.asBook) {
      const chapters = htmlChapters(n.text, n.title)
      payload.books.push({ title: n.title, chapters })
      continue
    }
    let content: J
    let props: Record<string, string> = {}
    if (n.format === 'md') {
      const r = mdToDoc(n.text)
      content = r.doc
      props = r.props
    } else {
      content = htmlToDoc(n.text)
    }
    const typeName = props.type ? props.type : null
    const { type: _t, ...rest } = props
    payload.cards.push({ title: n.title, folder: n.folder, typeName, props: rest, content })
  }

  for (const t of raw.tables as RawTable[]) {
    const rows = parseCsv(t.csv)
    if (rows.length === 0) continue
    const [header, ...body] = rows
    payload.tables.push({ name: t.name, columns: header, rows: body })
  }

  return {
    payload,
    counts: {
      cards: payload.cards.length,
      tables: payload.tables.length,
      books: payload.books.length,
      chapters: payload.books.reduce((n, b) => n + b.chapters.length, 0)
    }
  }
}
