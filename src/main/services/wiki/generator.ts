import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { dirname, extname, join } from 'path'
import { getDb, mediaDir } from '../../db/connection'

export interface WikiOpts {
  title: string
  theme: string
  outDir: string
  localDomain: string
}
export interface PublishResult {
  pages: number
  dir: string
}

const MARKER = '.atlas-wiki'
type Json = Record<string, unknown>
type Node = { type?: string; text?: string; attrs?: Record<string, unknown>; marks?: { type: string; attrs?: Record<string, unknown> }[]; content?: Node[] }

const parse = <T>(s: string | null | undefined, fallback: T): T => {
  try {
    return s ? (JSON.parse(s) as T) : fallback
  } catch {
    return fallback
  }
}
const esc = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const slugify = (s: string): string =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'pagina'

/** Prepara a pasta de saída sem apagar nada que não tenha sido criado pelo Atlas. */
function prepareDir(dir: string): void {
  if (existsSync(dir)) {
    const entries = readdirSync(dir)
    if (entries.length && !existsSync(join(dir, MARKER))) {
      throw new Error('A pasta escolhida já tem arquivos que não foram criados pelo Atlas. Escolha uma pasta vazia.')
    }
    rmSync(dir, { recursive: true, force: true })
  }
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, MARKER), 'Pasta gerada pelo Atlas. Pode ser apagada e gerada de novo.\n')
}

// ---------- conteúdo rico (TipTap) → HTML ----------
interface Ctx {
  fromDir: string
  cardLink: (id: string) => string | null
  mediaSrc: (id: string | null) => string | null
}

function inline(n: Node, ctx: Ctx): string {
  if (n.type === 'text') {
    let h = esc(n.text ?? '')
    for (const m of n.marks ?? []) {
      if (m.type === 'bold') h = `<strong>${h}</strong>`
      else if (m.type === 'italic') h = `<em>${h}</em>`
      else if (m.type === 'code') h = `<code>${h}</code>`
      else if (m.type === 'textStyle' && m.attrs?.css) h = `<span style="${esc(m.attrs.css)}">${h}</span>`
    }
    return h
  }
  if (n.type === 'tagMention') return `<span class="mention tag-mention">#${esc(n.attrs?.label ?? '')}</span>`
  if (n.type === 'mention') {
    const id = String(n.attrs?.id ?? '')
    const label = esc(n.attrs?.label ?? '')
    const href = ctx.cardLink(id)
    return href ? `<a class="mention" href="${href}">${label}</a>` : `<span class="mention">${label}</span>`
  }
  if (n.type === 'hardBreak') return '<br>'
  return (n.content ?? []).map((c) => inline(c, ctx)).join('')
}

function block(n: Node, ctx: Ctx): string {
  const kids = () => (n.content ?? []).map((c) => block(c, ctx)).join('')
  const inl = () => (n.content ?? []).map((c) => inline(c, ctx)).join('')
  switch (n.type) {
    case 'paragraph': return `<p>${inl()}</p>`
    case 'heading': {
      const l = Math.min(3, Math.max(1, Number(n.attrs?.level ?? 2)))
      return `<h${l}>${inl()}</h${l}>`
    }
    case 'bulletList': return `<ul>${kids()}</ul>`
    case 'orderedList': return `<ol>${kids()}</ol>`
    case 'listItem': return `<li>${kids()}</li>`
    case 'blockquote': return `<blockquote>${kids()}</blockquote>`
    case 'codeBlock': return `<pre><code>${esc((n.content ?? []).map((c) => c.text ?? '').join(''))}</code></pre>`
    case 'image': {
      const src = ctx.mediaSrc(n.attrs?.mediaId ? String(n.attrs.mediaId) : null)
      return src ? `<figure><img src="${src}" alt="${esc(n.attrs?.alt ?? '')}"></figure>` : ''
    }
    case 'text': case 'mention': case 'hardBreak': return inline(n, ctx)
    default: return kids()
  }
}

const docHtml = (doc: unknown, ctx: Ctx): string => block(doc as Node, ctx)

// ---------- publicação ----------
export function publishWiki(worldId: string, o: WikiOpts): PublishResult {
  const db = getDb()
  prepareDir(o.outDir)
  const world = db.prepare('SELECT * FROM worlds WHERE id = ?').get(worldId) as { name: string; description: string | null }
  const settings = { title: o.title || world.name, theme: o.theme, localDomain: o.localDomain }

  const cards = db.prepare(
    `SELECT c.*, t.name AS type_name, t.schema AS type_schema FROM cards c
       LEFT JOIN card_types t ON t.id = c.type_id
      WHERE c.world_id = ? AND c.id NOT IN (SELECT card_id FROM wiki_pages WHERE world_id = ? AND published = 0)
      ORDER BY c.title COLLATE NOCASE`
  ).all(worldId, worldId) as (Json & { id: string; title: string; content: string; properties: string; image_id: string | null; type_name: string | null; type_schema: string | null; type_id: string | null })[]
  const cardIds = new Set(cards.map((c) => c.id))
  const maps = db.prepare('SELECT * FROM maps WHERE world_id = ? ORDER BY name COLLATE NOCASE').all(worldId) as (Json & { id: string; name: string; image_id: string | null; width: number | null; height: number | null })[]
  const timelines = db.prepare('SELECT * FROM timelines WHERE world_id = ? ORDER BY name COLLATE NOCASE').all(worldId) as (Json & { id: string; name: string; calendar: string })[]
  const trees = db.prepare("SELECT * FROM canvases WHERE world_id = ? ORDER BY name COLLATE NOCASE").all(worldId) as (Json & { id: string; name: string })[]
  const sheets = db.prepare('SELECT * FROM sheets WHERE world_id = ? ORDER BY name COLLATE NOCASE').all(worldId) as (Json & { id: string; name: string; kind: string; card_id: string | null; columns: string; rows: string })[]

  // slugs estáveis e únicos
  const slug = (id: string, title: string): string => `${slugify(title)}-${id.slice(0, 6)}`
  const cardSlug = new Map(cards.map((c) => [c.id, slug(c.id, c.title)]))
  const mapSlug = new Map(maps.map((m) => [m.id, slug(m.id, m.name)]))
  const tlSlug = new Map(timelines.map((t) => [t.id, slug(t.id, t.name)]))
  const treeSlug = new Map(trees.map((t) => [t.id, slug(t.id, t.name)]))

  const copied = new Map<string, string>()
  const copyMedia = (id: string | null): string | null => {
    if (!id) return null
    if (copied.has(id)) return copied.get(id)!
    const m = db.prepare('SELECT file_path FROM media WHERE id = ?').get(id) as { file_path: string } | undefined
    if (!m) return null
    const ext = extname(m.file_path)
    const rel = `assets/media/${id}${ext}`
    mkdirSync(join(o.outDir, 'assets/media'), { recursive: true })
    try {
      copyFileSync(join(mediaDir(), m.file_path), join(o.outDir, rel))
    } catch {
      return null
    }
    copied.set(id, rel)
    return rel
  }

  let pages = 0
  const write = (rel: string, html: string): void => {
    const full = join(o.outDir, rel)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, html, 'utf-8')
    pages++
  }

  const ctxFor = (fromDir: string): Ctx => ({
    fromDir,
    cardLink: (id) => (cardIds.has(id) ? link(fromDir, 'cards', cardSlug.get(id)!) : null),
    mediaSrc: (id) => {
      const rel = copyMedia(id)
      if (!rel) return null
      return (fromDir ? '../' : '') + rel
    }
  })
  const link = (fromDir: string, target: string, s: string): string =>
    fromDir === target ? `${s}.html` : fromDir === '' ? `${target}/${s}.html` : `../${target}/${s}.html`
  const assetPrefix = (dir: string): string => (dir ? '../' : '')

  const shell = (title: string, dir: string, body: string): string => {
    const up = assetPrefix(dir)
    const domain = settings.localDomain ? `<span class="domain">${esc(settings.localDomain)}</span>` : ''
    return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · ${esc(settings.title)}</title><link rel="stylesheet" href="${up}assets/style.css"></head>
<body class="theme-${esc(settings.theme)}">
<header class="site"><a href="${up}index.html" class="brand">${esc(settings.title)}</a><nav>
<a href="${up}index.html#cards">Cards</a><a href="${up}index.html#mapas">Mapas</a><a href="${up}index.html#linhas">Linhas do tempo</a><a href="${up}index.html#relacoes">Relações</a></nav>${domain}</header>
<main>${body}</main></body></html>`
  }

  // ----- páginas de card -----
  for (const c of cards) {
    const ctx = ctxFor('cards')
    const imgRel = copyMedia(c.image_id)
    const eventFields = Number(c.is_event) === 1
      ? [
          { key: 'evLocal', label: 'Local', kind: 'card' },
          { key: 'evCausa', label: 'Causa', kind: 'longtext' },
          { key: 'evResultado', label: 'Resultado', kind: 'longtext' }
        ]
      : []
    const fields = [...eventFields, ...parse<{ key: string; label: string; kind?: string }[]>(c.type_schema, [])]
    const props = parse<Json>(c.properties, {})
    const propsHtml = fields
      .filter((f) => props[f.key] !== undefined && props[f.key] !== null && props[f.key] !== '')
      .map((f) => `<dt>${esc(f.label)}</dt><dd>${(f as { kind?: string }).kind === 'card' && cardIds.has(String(props[f.key])) ? `<a href="${ctx.cardLink(String(props[f.key]))}">${esc(cards.find((x) => x.id === props[f.key])?.title)}</a>` : esc(Array.isArray(props[f.key]) ? (props[f.key] as string[]).join(', ') : props[f.key])}</dd>`).join('')

    const sheetsHtml = sheets.filter((s) => s.card_id === c.id).map((s) => {
      if (s.kind === 'ficha') {
        const attrs = parse<{ key: string; label: string }[]>(s.columns, [])
        const vals = parse<Record<string, { value: string | null; note: string }>>(s.rows, {})
        const items = attrs.map((a) => {
          const v = vals[a.key]
          return `<dt>${esc(a.label)}</dt><dd>${v?.value ? esc(v.value) : '<em class="muted">não definido</em>'}${v?.note ? `<p class="note">${esc(v.note)}</p>` : ''}</dd>`
        }).join('')
        return `<section class="ficha"><h3>${esc(s.name)}</h3><dl>${items}</dl></section>`
      }
      const cols = parse<{ key: string; label: string }[]>(s.columns, [])
      const rows = parse<Record<string, unknown>[]>(s.rows, [])
      return `<section class="ficha"><h3>${esc(s.name)}</h3><table><thead><tr>${cols.map((k) => `<th>${esc(k.label)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${cols.map((k) => `<td>${esc(r[k.key])}</td>`).join('')}</tr>`).join('')}</tbody></table></section>`
    }).join('')

    const links = db.prepare(
      `SELECT l.source_card_id AS s, l.target_card_id AS t, l.relation AS r FROM card_links l
        WHERE l.relation != 'mention' AND (l.source_card_id = ? OR l.target_card_id = ?)`
    ).all(c.id, c.id) as { s: string; t: string; r: string }[]
    const relHtml = links.map((l) => {
      const other = l.s === c.id ? l.t : l.s
      const dir = l.s === c.id ? '' : ' <span class="muted">(inverso)</span>'
      const name = cardIds.has(other) ? `<a href="${ctx.cardLink(other)}">${esc(cards.find((x) => x.id === other)?.title)}</a>` : esc('—')
      return `<li><span class="rel">${esc(l.r)}</span> ${name}${dir}</li>`
    }).join('')

    const mentions = db.prepare(
      `SELECT c2.id, c2.title FROM card_links l JOIN cards c2 ON c2.id = l.source_card_id
        WHERE l.target_card_id = ? AND l.relation = 'mention' AND c2.id != ? ORDER BY c2.title COLLATE NOCASE`
    ).all(c.id, c.id) as { id: string; title: string }[]
    const mentionsHtml = mentions.filter((m) => cardIds.has(m.id))
      .map((m) => `<li><a href="${ctx.cardLink(m.id)}">${esc(m.title)}</a></li>`).join('')

    const featHtml = db.prepare(
      `SELECT f.label, m.id AS map_id, m.name AS map_name FROM map_features f JOIN maps m ON m.id = f.map_id WHERE f.card_id = ?`
    ).all(c.id) as { label: string | null; map_id: string; map_name: string }[]
    const mapsHtml = featHtml.filter((f) => mapSlug.has(f.map_id))
      .map((f) => `<li><a href="${link('cards', 'maps', mapSlug.get(f.map_id)!)}">${esc(f.map_name)}</a>${f.label ? ` · ${esc(f.label)}` : ''}</li>`).join('')

    const evHtml = db.prepare(
      `SELECT e.title, e.version, e.timeline_id, t.name AS tl FROM timeline_events e JOIN timelines t ON t.id = e.timeline_id WHERE e.card_id = ?`
    ).all(c.id) as { title: string; version: string; timeline_id: string; tl: string }[]
    const evsHtml = evHtml.filter((e) => tlSlug.has(e.timeline_id))
      .map((e) => `<li><a href="${link('cards', 'timelines', tlSlug.get(e.timeline_id)!)}">${esc(e.title)}</a> <span class="muted">· ${esc(e.tl)}${e.version !== 'canon' ? ` (${esc(e.version)})` : ''}</span></li>`).join('')

    // Envolvidos (só em eventos)
    const partsRows = db.prepare(
      'SELECT c2.id, c2.title FROM event_participants ep JOIN cards c2 ON c2.id = ep.card_id WHERE ep.event_id = ? ORDER BY c2.title COLLATE NOCASE'
    ).all(c.id) as { id: string; title: string }[]
    const partsSection = partsRows.length
      ? `<section><h2>Envolvidos</h2><ul class="list">${partsRows.filter((p) => cardIds.has(p.id)).map((p) => `<li><a href="${ctx.cardLink(p.id)}">${esc(p.title)}</a></li>`).join('')}</ul></section>`
      : ''
    const section = (title: string, html: string): string => (html ? `<section><h2>${title}</h2><ul class="list">${html}</ul></section>` : '')
    const body = `
<article class="card-page">
  ${imgRel ? `<img class="hero" src="${assetPrefix('cards')}${imgRel}" alt="${esc(c.title)}">` : ''}
  <p class="kicker">${esc(c.type_name ?? '')}</p>
  <h1>${esc(c.title)}</h1>
  ${propsHtml ? `<dl class="props">${propsHtml}</dl>` : ''}
  <div class="prose">${docHtml(parse(c.content, {}), ctx)}</div>
  ${sheetsHtml}
  ${relHtml ? `<section><h2>Relações</h2><ul class="list">${relHtml}</ul></section>` : ''}
  ${partsSection}
  ${section('Mencionado em', mentionsHtml)}
  ${section('Aparece em mapas', mapsHtml)}
  ${section('Linhas do tempo', evsHtml)}
</article>`
    write(`cards/${cardSlug.get(c.id)}.html`, shell(c.title, 'cards', body))
  }

  // ----- mapas -----
  for (const m of maps) {
    const ctx = ctxFor('maps')
    const src = ctx.mediaSrc(m.image_id)
    const W = m.width ?? 1000
    const H = m.height ?? 1000
    const feats = db.prepare('SELECT * FROM map_features WHERE map_id = ? ORDER BY rowid').all(m.id) as { id: string; kind: string; geometry: string; label: string | null; notes: string | null; style: string; card_id: string | null; child_map_id: string | null }[]
    const hrefFor = (f: typeof feats[number]): string | null => {
      if (f.card_id && cardIds.has(f.card_id)) return link('maps', 'cards', cardSlug.get(f.card_id)!)
      if (f.child_map_id && mapSlug.has(f.child_map_id)) return link('maps', 'maps', mapSlug.get(f.child_map_id)!)
      return null
    }
    const r = Math.max(W, H) / 110
    const shapes = feats.map((f) => {
      const g = parse<{ x?: number; y?: number; points?: [number, number][] }>(f.geometry, {})
      const color = (parse<{ color?: string }>(f.style, {})).color ?? '#7fb7a4'
      const href = hrefFor(f)
      const title = `<title>${esc(f.label ?? '')}</title>`
      let inner = ''
      if (f.kind === 'path' && g.points) {
        const sz = (parse<{ size?: string; dash?: boolean }>(f.style, {})).size ?? 'md'
        const w = ({ sm: 2, md: 4, lg: 7 } as Record<string, number>)[sz] ?? 4
        const dash = (parse<{ dash?: boolean }>(f.style, {})).dash ? ' stroke-dasharray="8 6"' : ''
        inner = `<polyline points="${g.points.map((p) => p.join(',')).join(' ')}" fill="none" stroke="${esc(color)}" stroke-width="${(Math.max(W, H) / 400) * (w / 4)}" stroke-linecap="round"${dash}/>`
      } else if ((f.kind === 'region' || f.kind === 'zone') && g.points) {
        const pts = g.points.map((p) => p.join(',')).join(' ')
        inner = `<polygon class="${f.kind}" points="${pts}" fill="${esc(color)}" fill-opacity="${f.kind === 'zone' ? 0.14 : 0.3}" stroke="${esc(color)}" stroke-width="${Math.max(W, H) / 600}">${title}</polygon>`
      } else if (f.kind === 'pin' && g.x !== undefined) {
        inner = `<circle class="pin" cx="${g.x}" cy="${g.y}" r="${r * 0.6}" fill="${esc(color)}" stroke="#0f1116" stroke-width="${r * 0.15}">${title}</circle>`
        if (f.label) inner += `<text x="${g.x}" y="${(g.y ?? 0) + r * 1.8}" text-anchor="middle" font-size="${r * 0.9}" class="maplabel">${esc(f.label)}</text>`
      } else if (f.kind === 'label' && g.x !== undefined) {
        inner = `<text x="${g.x}" y="${g.y}" text-anchor="middle" font-size="${r * 1.1}" fill="${esc(color)}" class="maplabel">${esc(f.label)}</text>`
      }
      return href ? `<a href="${href}">${inner}</a>` : inner
    }).join('')

    const list = feats.filter((f) => f.label).map((f) => {
      const h = hrefFor(f)
      return `<li>${h ? `<a href="${h}">${esc(f.label)}</a>` : esc(f.label)}${f.notes ? `<p class="note">${esc(f.notes)}</p>` : ''}</li>`
    }).join('')

    const body = `
<article>
  <p class="kicker">Mapa</p>
  <h1>${esc(m.name)}</h1>
  ${src ? `<div class="mapwrap" style="aspect-ratio:${W}/${H}"><img src="${src}" alt="${esc(m.name)}"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${shapes}</svg></div>` : '<p class="muted">Este mapa não tem imagem.</p>'}
  ${list ? `<section><h2>Pontos do mapa</h2><ul class="list">${list}</ul></section>` : ''}
</article>`
    write(`maps/${mapSlug.get(m.id)}.html`, shell(m.name, 'maps', body))
  }

  // ----- linhas do tempo (versão canon) -----
  for (const t of timelines) {
    const ctx = ctxFor('timelines')
    const unit = parse<{ unit?: string }>(t.calendar, {}).unit ?? 'Ano'
    const eras = db.prepare('SELECT * FROM eras WHERE timeline_id = ? ORDER BY position, start_value').all(t.id) as { id: string; name: string; color: string | null; start_value: number | null; end_value: number | null }[]
    const events = db.prepare("SELECT * FROM timeline_events WHERE timeline_id = ? AND version = 'canon' ORDER BY sort_value").all(t.id) as { title: string; description: string | null; sort_value: number; date_label: string | null; era_id: string | null; card_id: string | null }[]
    const byEra = (eid: string | null): string => events.filter((e) => e.era_id === eid).map((e) => {
      const when = e.date_label || `${Number(e.sort_value.toFixed(2)).toLocaleString('pt-BR')} ${unit}`
      const title = e.card_id && cardIds.has(e.card_id) ? `<a href="${ctx.cardLink(e.card_id)}">${esc(e.title)}</a>` : esc(e.title)
      return `<li><span class="when">${esc(when)}</span> ${title}${e.description ? `<p class="note">${esc(e.description)}</p>` : ''}</li>`
    }).join('')
    const eraSections = eras.map((er) => {
      const items = byEra(er.id)
      return items ? `<section><h2 style="color:${esc(er.color ?? '#9a9cab')}">${esc(er.name)}</h2><ul class="list">${items}</ul></section>` : ''
    }).join('')
    const loose = byEra(null)
    const versionsHtml = (db.prepare('SELECT name FROM timeline_versions WHERE world_id = ? ORDER BY position, name COLLATE NOCASE').all(worldId) as { name: string }[])
      .map((v) => {
        const evs = db.prepare('SELECT title, sort_value, date_label FROM timeline_events WHERE timeline_id = ? AND version = ? ORDER BY sort_value')
          .all(t.id, v.name) as { title: string; sort_value: number; date_label: string | null }[]
        if (evs.length === 0) return ''
        return `<section><h2>Versão: ${esc(v.name)}</h2><ul class="list">${evs.map((e) => `<li><span class="when">${esc(e.date_label || `${Number(e.sort_value).toLocaleString('pt-BR')} ${unit}`)}</span> ${esc(e.title)}</li>`).join('')}</ul></section>`
      }).join('')
    const KL: Record<string, string> = { nascimento: 'Nascimento', fundacao: 'Fundação', morte: 'Morte', abandono: 'Abandono', destruicao: 'Destruição', dissolucao: 'Dissolução', fim: 'Fim' }
    const lifeRows = db.prepare(
      'SELECT l.*, c.title AS title FROM timeline_lives l JOIN cards c ON c.id = l.card_id WHERE l.timeline_id = ? ORDER BY l.start_value'
    ).all(t.id) as { title: string; start_value: number; start_kind: string; end_value: number | null; end_kind: string | null; card_id: string }[]
    const livesHtml = lifeRows.length
      ? `<section><h2>Nascimentos e origens</h2><ul class="list">${lifeRows.map((r) => {
          const ttl = cardIds.has(r.card_id) ? `<a href="${ctx.cardLink(r.card_id)}">${esc(r.title)}</a>` : esc(r.title)
          const end = r.end_value != null ? ` <span class="muted">· ${esc(KL[r.end_kind ?? 'fim'] ?? '')} ${esc(Number(r.end_value).toLocaleString('pt-BR'))}</span>` : ''
          return `<li><span class="when">${esc(KL[r.start_kind] ?? r.start_kind)} ${esc(Number(r.start_value).toLocaleString('pt-BR'))}</span> ${ttl}${end}</li>`
        }).join('')}</ul></section>`
      : ''
    const body = `
<article>
  <p class="kicker">Linha do tempo</p>
  <h1>${esc(t.name)}</h1>
  ${livesHtml}
  ${eraSections}
  ${versionsHtml}
  ${loose ? `<section><h2>Sem era</h2><ul class="list">${loose}</ul></section>` : ''}
</article>`
    write(`timelines/${tlSlug.get(t.id)}.html`, shell(t.name, 'timelines', body))
  }

  // ----- árvores de relações (SVG) -----
  for (const tr of trees) {
    const ctx = ctxFor('relations')
    const els = db.prepare('SELECT * FROM canvas_elements WHERE canvas_id = ?').all(tr.id) as { id: string; kind: string; data: string; card_id: string | null }[]
    const nodes = els.filter((e) => e.kind === 'card')
    const pos = new Map<string, { x: number; y: number; w: number; h: number; card: string | null }>()
    for (const n of nodes) {
      const d = parse<{ x?: number; y?: number }>(n.data, {})
      pos.set(n.id, { x: d.x ?? 0, y: d.y ?? 0, w: 200, h: 72, card: n.card_id })
    }
    const xs = [...pos.values()].flatMap((p) => [p.x, p.x + p.w])
    const ys = [...pos.values()].flatMap((p) => [p.y, p.y + p.h])
    const minX = xs.length ? Math.min(...xs) - 40 : 0
    const minY = ys.length ? Math.min(...ys) - 40 : 0
    const W = xs.length ? Math.max(...xs) - minX + 40 : 400
    const H = ys.length ? Math.max(...ys) - minY + 40 : 300
    // Notas do quadro aparecem como caixas de texto
    const notesSvg = els.filter((e) => e.kind === 'note').map((e) => {
      const d = parse<{ x?: number; y?: number; w?: number; h?: number; text?: string }>(e.data, {})
      const x0 = (d.x ?? 0) - minX
      const y0 = (d.y ?? 0) - minY
      const w = d.w ?? 220
      const h = d.h ?? 150
      return `<rect x="${x0}" y="${y0}" width="${w}" height="${h}" rx="8" class="node"/><foreignObject x="${x0 + 10}" y="${y0 + 10}" width="${w - 20}" height="${h - 20}"><div xmlns="http://www.w3.org/1999/xhtml" class="note-text">${esc(d.text ?? '')}</div></foreignObject>`
    }).join('')
    const edges = els.filter((e) => e.kind === 'edge').map((e) => parse<{ from?: string; to?: string; label?: string }>(e.data, {}))
      .map((d) => {
        const a = pos.get(d.from ?? ''), b = pos.get(d.to ?? '')
        if (!a || !b) return ''
        const x1 = a.x + a.w / 2 - minX, y1 = a.y + a.h / 2 - minY
        const x2 = b.x + b.w / 2 - minX, y2 = b.y + b.h / 2 - minY
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2
        return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="edge"/><text x="${mx}" y="${my}" class="edge-label" text-anchor="middle">${esc(d.label ?? '')}</text>`
      }).join('')
    const boxes = [...pos.values()].map((p) => {
      const c = p.card && cardIds.has(p.card) ? cards.find((x) => x.id === p.card) : null
      const label = c ? c.title : '—'
      const box = `<rect x="${p.x - minX}" y="${p.y - minY}" width="${p.w}" height="${p.h}" rx="8" class="node"/><text x="${p.x - minX + 14}" y="${p.y - minY + 34}" class="node-label">${esc(label)}</text>`
      return c && p.card ? `<a href="${ctx.cardLink(p.card)}">${box}</a>` : box
    }).join('')
    const body = `
<article>
  <p class="kicker">Árvore de relações</p>
  <h1>${esc(tr.name)}</h1>
  <div class="treewrap"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${edges}${boxes}${notesSvg}</svg></div>
</article>`
    write(`relations/${treeSlug.get(tr.id)}.html`, shell(tr.name, 'relations', body))
  }

  // ----- índice -----
  const byType = new Map<string, typeof cards>()
  for (const c of cards) {
    const k = c.type_name ?? 'Sem tipo'
    byType.set(k, [...(byType.get(k) ?? []), c])
  }
  const typeSections = [...byType].map(([name, list]) =>
    `<section><h2>${esc(name)}</h2><ul class="list">${list.map((c) => `<li><a href="cards/${cardSlug.get(c.id)}.html">${esc(c.title)}</a></li>`).join('')}</ul></section>`
  ).join('')
  const cardsSection = `<section id="cards"><h2>Cards</h2>${typeSections || '<p class="muted">Nenhum card publicado.</p>'}</section>`
  const mapsSection = `<section id="mapas"><h2>Mapas</h2><ul class="list">${maps.map((m) => `<li><a href="maps/${mapSlug.get(m.id)}.html">${esc(m.name)}</a></li>`).join('') || '<li class="muted">Nenhum mapa.</li>'}</ul></section>`
  const tlSection = `<section id="linhas"><h2>Linhas do tempo</h2><ul class="list">${timelines.map((t) => `<li><a href="timelines/${tlSlug.get(t.id)}.html">${esc(t.name)}</a></li>`).join('') || '<li class="muted">Nenhuma linha do tempo.</li>'}</ul></section>`
  const relSection = `<section id="relacoes"><h2>Relações</h2><ul class="list">${trees.map((t) => `<li><a href="relations/${treeSlug.get(t.id)}.html">${esc(t.name)}</a></li>`).join('') || '<li class="muted">Nenhuma árvore de relações.</li>'}</ul></section>`
  const intro = world.description ? `<p class="lead">${esc(world.description)}</p>` : ''
  const indexBody = `<article><p class="kicker">Mundo</p><h1>${esc(settings.title)}</h1>${intro}${cardsSection}${mapsSection}${tlSection}${relSection}</article>`
  write('index.html', shell(settings.title, '', indexBody))

  write('assets/style.css', STYLE)
  return { pages, dir: o.outDir }
}

const STYLE = `
:root{--bg:#12141c;--panel:#181b26;--line:#2e3348;--text:#e8e4d9;--muted:#9a9cab;--accent:#7fb7a4;--serif:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif}
body.theme-claro{--bg:#f7f5ef;--panel:#ffffff;--line:#d9d4c7;--text:#23211d;--muted:#6f6a5e;--accent:#2f7d68}
body.theme-pergaminho{--bg:#ead9b5;--panel:#f3e7cc;--line:#c9b68a;--text:#3b2e1a;--muted:#7a6749;--accent:#8a4b1f}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.7 system-ui,"Segoe UI",sans-serif}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
header.site{display:flex;align-items:center;gap:24px;flex-wrap:wrap;padding:14px 28px;border-bottom:1px solid var(--line);background:var(--panel);position:sticky;top:0;z-index:2}
header.site .brand{font-family:var(--serif);font-size:20px;color:var(--text);font-weight:600}
header.site nav{display:flex;gap:16px;font-size:14px}
.domain{margin-left:auto;font-size:12px;color:var(--muted)}
main{max-width:820px;margin:0 auto;padding:40px 24px 80px}
h1{font-family:var(--serif);font-size:44px;line-height:1.15;margin:4px 0 16px}
h2{font-family:var(--serif);font-size:24px;margin:40px 0 12px;border-bottom:1px solid var(--line);padding-bottom:6px}
h3{font-family:var(--serif);font-size:19px;margin:24px 0 8px}
.kicker{text-transform:uppercase;letter-spacing:.12em;font-size:12px;color:var(--muted);margin:0}
.lead{font-size:18px;color:var(--muted);font-style:italic}
.hero{width:100%;max-height:420px;object-fit:cover;border-radius:10px;border:1px solid var(--line);margin-bottom:24px}
.prose p{margin:0 0 1em}.prose blockquote{border-left:3px solid var(--line);margin:0 0 1em;padding-left:16px;color:var(--muted)}
.prose code{background:var(--panel);padding:1px 6px;border-radius:4px}
.mention{color:var(--accent);background:color-mix(in srgb,var(--accent) 14%,transparent);border-radius:4px;padding:0 4px}
dl.props,.ficha dl{display:grid;grid-template-columns:max-content 1fr;gap:6px 24px;margin:0 0 24px}
dl.props dt,.ficha dt{color:var(--muted)}dl.props dd,.ficha dd{margin:0}
figure{margin:1.2em 0}figure img{max-width:100%;border-radius:8px;border:1px solid var(--line)}
.note-text{font:13px/1.4 system-ui,sans-serif;color:var(--text);overflow:hidden}
.tag-mention{color:#e0a96d;background:color-mix(in srgb,#e0a96d 14%,transparent)}\n.note{color:var(--muted);font-size:14px;margin:4px 0 0}
.muted{color:var(--muted)}
ul.list{list-style:none;padding:0;margin:0}
ul.list li{padding:6px 0;border-bottom:1px solid color-mix(in srgb,var(--line) 60%,transparent)}
.when{color:var(--muted);font-variant-numeric:tabular-nums;margin-right:6px}
.rel{display:inline-block;background:var(--panel);border:1px solid var(--line);border-radius:999px;padding:0 10px;font-size:13px;margin-right:4px}
.ficha{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px 20px;margin-top:20px}
.ficha table{width:100%;border-collapse:collapse}.ficha th,.ficha td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--line)}
.mapwrap{position:relative;width:100%;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:var(--panel)}
.mapwrap img{position:absolute;inset:0;width:100%;height:100%;object-fit:fill}
.mapwrap svg{position:absolute;inset:0;width:100%;height:100%}
.mapwrap a:hover circle,.mapwrap a:hover polygon{filter:brightness(1.25)}
.maplabel{fill:#f2efe6;stroke:#12141c;stroke-width:.4px;paint-order:stroke}
.treewrap{border:1px solid var(--line);border-radius:10px;background:var(--panel);overflow:auto;padding:12px}
.treewrap svg{width:100%;height:auto;min-height:320px}
.edge{stroke:var(--muted);stroke-width:2}.edge-label{fill:var(--text);font-size:13px;paint-order:stroke;stroke:var(--panel);stroke-width:4px}
.node{fill:var(--bg);stroke:var(--accent);stroke-width:1.5}.node-label{fill:var(--text);font-size:15px}
a:hover .node{fill:var(--panel)}
@media (max-width:640px){h1{font-size:34px}header.site nav{display:none}}
`
