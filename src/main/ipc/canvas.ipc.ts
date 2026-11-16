import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { getDb } from '../db/connection'
import type {
  CanvasDetail, CanvasElement, CanvasElementKind, CanvasKind, CanvasNodeData, CanvasSummary,
  ElementInput, ElementPatch, MoveItem, Viewport
} from '@shared/types'

interface CRow { id: string; world_id: string; name: string; kind: string; viewport: string }
interface ERow { id: string; canvas_id: string; kind: string; data: string; card_id: string | null; media_id: string | null }

const KINDS = new Set<CanvasElementKind>(['note', 'card', 'image', 'shape', 'edge'])
const DEFAULT_RELATION = 'relacionado a'

const parse = <T>(s: string, fallback: T): T => {
  try {
    return JSON.parse(s) as T
  } catch {
    return fallback
  }
}
const toCanvas = (r: CRow): CanvasSummary => ({
  id: r.id, world_id: r.world_id, name: r.name, kind: r.kind === 'relation_tree' ? 'relation_tree' : 'canvas'
})
const toEl = (r: ERow): CanvasElement => ({
  id: r.id,
  canvas_id: r.canvas_id,
  kind: r.kind as CanvasElementKind,
  data: parse<CanvasNodeData>(r.data, { x: 0, y: 0 }),
  card_id: r.card_id,
  media_id: r.media_id
})
const cleanData = (d: CanvasNodeData): CanvasNodeData => ({
  ...d,
  x: Number.isFinite(d.x) ? d.x : 0,
  y: Number.isFinite(d.y) ? d.y : 0
})

export function registerCanvas(): void {
  const db = (): ReturnType<typeof getDb> => getDb()
  const getCanvasRow = (id: string): CRow => {
    const r = db().prepare('SELECT * FROM canvases WHERE id = ?').get(id) as CRow | undefined
    if (!r) throw new Error('Quadro não encontrado.')
    return r
  }
  const getEl = (id: string): ERow => {
    const r = db().prepare('SELECT * FROM canvas_elements WHERE id = ?').get(id) as ERow | undefined
    if (!r) throw new Error('Item não encontrado.')
    return r
  }
  const isRelationTree = (canvasId: string): boolean => getCanvasRow(canvasId).kind === 'relation_tree'
  const cardOf = (elId: string): string | null =>
    (db().prepare('SELECT card_id FROM canvas_elements WHERE id = ?').get(elId) as { card_id: string | null } | undefined)?.card_id ?? null

  // ---------- quadros ----------
  ipcMain.handle('canvas:list', (_e, worldId: string): CanvasSummary[] =>
    (db().prepare('SELECT * FROM canvases WHERE world_id = ? ORDER BY name COLLATE NOCASE').all(worldId) as CRow[]).map(toCanvas)
  )

  ipcMain.handle('canvas:create', (_e, worldId: string, name: string, kind: CanvasKind): CanvasSummary => {
    const id = randomUUID()
    db().prepare('INSERT INTO canvases (id, world_id, name, kind, viewport) VALUES (?, ?, ?, ?, ?)')
      .run(id, worldId, name.trim() || 'Sem nome', kind === 'relation_tree' ? 'relation_tree' : 'canvas', '{}')
    return toCanvas(getCanvasRow(id))
  })

  ipcMain.handle('canvas:rename', (_e, id: string, name: string): CanvasSummary => {
    db().prepare('UPDATE canvases SET name = ? WHERE id = ?').run(name.trim() || 'Sem nome', id)
    return toCanvas(getCanvasRow(id))
  })

  ipcMain.handle('canvas:remove', (_e, id: string): void => {
    db().prepare('DELETE FROM canvases WHERE id = ?').run(id)
  })

  ipcMain.handle('canvas:get', (_e, id: string): CanvasDetail => {
    const c = getCanvasRow(id)
    let els = (db().prepare('SELECT * FROM canvas_elements WHERE canvas_id = ? ORDER BY rowid').all(id) as ERow[]).map(toEl)

    // Limpeza: ligações cujo item de origem ou destino foi removido.
    const ids = new Set(els.map((e) => e.id))
    const orphans = els.filter((e) => e.kind === 'edge' && (!ids.has(e.data.from ?? '') || !ids.has(e.data.to ?? '')))
    if (orphans.length) {
      db().transaction(() => {
        for (const o of orphans) db().prepare('DELETE FROM canvas_elements WHERE id = ?').run(o.id)
      })()
      const gone = new Set(orphans.map((o) => o.id))
      els = els.filter((e) => !gone.has(e.id))
    }
    return { canvas: toCanvas(c), elements: els, viewport: parse<Viewport | null>(c.viewport, null) }
  })

  ipcMain.handle('canvas:saveViewport', (_e, id: string, vp: Viewport): void => {
    db().prepare('UPDATE canvases SET viewport = ? WHERE id = ?').run(JSON.stringify(vp), id)
  })

  // Cria as ligações que já existem entre os cards da árvore (sem duplicar).
  ipcMain.handle('canvas:syncRelations', (_e, canvasId: string): void => {
    if (!isRelationTree(canvasId)) return
    const nodes = db().prepare("SELECT id, card_id FROM canvas_elements WHERE canvas_id = ? AND kind = 'card' AND card_id IS NOT NULL")
      .all(canvasId) as { id: string; card_id: string }[]
    if (nodes.length < 2) return
    const byCard = new Map(nodes.map((n) => [n.card_id, n.id]))
    const cardIds = [...byCard.keys()]
    const marks = cardIds.map(() => '?').join(',')
    const links = db().prepare(
      `SELECT source_card_id AS s, target_card_id AS t, relation AS r FROM card_links
        WHERE relation != 'mention' AND source_card_id IN (${marks}) AND target_card_id IN (${marks})`
    ).all(...cardIds, ...cardIds) as { s: string; t: string; r: string }[]

    const existing = new Set(
      (db().prepare("SELECT data FROM canvas_elements WHERE canvas_id = ? AND kind = 'edge'").all(canvasId) as { data: string }[])
        .map((r) => parse<CanvasNodeData>(r.data, { x: 0, y: 0 }))
        .map((d) => `${d.from}|${d.to}|${d.label}`)
    )
    db().transaction(() => {
      for (const l of links) {
        const from = byCard.get(l.s)!
        const to = byCard.get(l.t)!
        const key = `${from}|${to}|${l.r}`
        if (existing.has(key)) continue
        existing.add(key)
        db().prepare("INSERT INTO canvas_elements (id, canvas_id, kind, data, card_id, media_id) VALUES (?, ?, 'edge', ?, NULL, NULL)")
          .run(randomUUID(), canvasId, JSON.stringify({ x: 0, y: 0, from, to, label: l.r }))
      }
    })()
  })

  // ---------- itens ----------
  ipcMain.handle('elements:create', (_e, canvasId: string, input: ElementInput): CanvasElement => {
    if (!KINDS.has(input.kind)) throw new Error('Tipo de item inválido.')
    getCanvasRow(canvasId)
    const id = randomUUID()
    db().prepare('INSERT INTO canvas_elements (id, canvas_id, kind, data, card_id, media_id) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, canvasId, input.kind, JSON.stringify(cleanData(input.data)), input.card_id ?? null, input.media_id ?? null)
    return toEl(getEl(id))
  })

  ipcMain.handle('elements:update', (_e, id: string, patch: ElementPatch): CanvasElement => {
    const cur = getEl(id)
    const oldData = parse<CanvasNodeData>(cur.data, { x: 0, y: 0 })
    const newData = patch.data ? cleanData(patch.data) : oldData

    // Em árvores de relações, renomear a ligação também renomeia a relação no banco.
    if (cur.kind === 'edge' && isRelationTree(cur.canvas_id) && patch.data) {
      const oldLabel = oldData.label ?? DEFAULT_RELATION
      const newLabel = (newData.label ?? '').trim() || DEFAULT_RELATION
      newData.label = newLabel
      const src = cardOf(oldData.from ?? '')
      const dst = cardOf(oldData.to ?? '')
      if (src && dst && newLabel !== oldLabel) {
        db().transaction(() => {
          db().prepare('INSERT OR IGNORE INTO card_links (source_card_id, target_card_id, relation) VALUES (?, ?, ?)').run(src, dst, newLabel)
          db().prepare('DELETE FROM card_links WHERE source_card_id = ? AND target_card_id = ? AND relation = ?').run(src, dst, oldLabel)
        })()
      }
    }

    db().prepare('UPDATE canvas_elements SET data = ?, card_id = ?, media_id = ? WHERE id = ?').run(
      JSON.stringify(newData),
      'card_id' in patch ? (patch.card_id ?? null) : cur.card_id,
      'media_id' in patch ? (patch.media_id ?? null) : cur.media_id,
      id
    )
    return toEl(getEl(id))
  })

  ipcMain.handle('elements:moveMany', (_e, items: MoveItem[]): void => {
    db().transaction(() => {
      for (const it of items) {
        const cur = getEl(it.id)
        const data = parse<CanvasNodeData>(cur.data, { x: 0, y: 0 })
        data.x = Number.isFinite(it.x) ? it.x : data.x
        data.y = Number.isFinite(it.y) ? it.y : data.y
        db().prepare('UPDATE canvas_elements SET data = ? WHERE id = ?').run(JSON.stringify(data), it.id)
      }
    })()
  })

  // Tira um card do quadro sem apagar as relações entre os cards no mundo.
  ipcMain.handle('elements:removeNode', (_e, id: string): void => {
    db().transaction(() => {
      db().prepare("DELETE FROM canvas_elements WHERE kind = 'edge' AND (json_extract(data, '$.from') = ? OR json_extract(data, '$.to') = ?)")
        .run(id, id)
      db().prepare('DELETE FROM canvas_elements WHERE id = ?').run(id)
    })()
  })

  ipcMain.handle('elements:remove', (_e, id: string): void => {
    const cur = getEl(id)
    db().transaction(() => {
      if (cur.kind === 'edge' && isRelationTree(cur.canvas_id)) {
        const d = parse<CanvasNodeData>(cur.data, { x: 0, y: 0 })
        const src = cardOf(d.from ?? '')
        const dst = cardOf(d.to ?? '')
        if (src && dst) {
          db().prepare('DELETE FROM card_links WHERE source_card_id = ? AND target_card_id = ? AND relation = ?')
            .run(src, dst, d.label ?? DEFAULT_RELATION)
        }
      }
      db().prepare('DELETE FROM canvas_elements WHERE id = ?').run(id)
    })()
  })

  // ---------- relações ----------
  ipcMain.handle('relations:create', (_e, canvasId: string, fromId: string, toId: string, relation: string): CanvasElement => {
    const label = relation.trim() || DEFAULT_RELATION
    const a = getEl(fromId)
    const b = getEl(toId)
    if (a.kind !== 'card' || b.kind !== 'card' || !a.card_id || !b.card_id || a.card_id === b.card_id) {
      throw new Error('Relações só podem ligar dois cards diferentes.')
    }
    const edges = db().prepare("SELECT * FROM canvas_elements WHERE canvas_id = ? AND kind = 'edge'").all(canvasId) as ERow[]
    const same = edges.find((r) => {
      const d = parse<CanvasNodeData>(r.data, { x: 0, y: 0 })
      return d.from === fromId && d.to === toId && d.label === label
    })
    if (same) return toEl(same)
    const id = randomUUID()
    db().transaction(() => {
      db().prepare('INSERT OR IGNORE INTO card_links (source_card_id, target_card_id, relation) VALUES (?, ?, ?)')
        .run(a.card_id, b.card_id, label)
      db().prepare("INSERT INTO canvas_elements (id, canvas_id, kind, data, card_id, media_id) VALUES (?, ?, 'edge', ?, NULL, NULL)")
        .run(id, canvasId, JSON.stringify({ x: 0, y: 0, from: fromId, to: toId, label }))
    })()
    return toEl(getEl(id))
  })
}
