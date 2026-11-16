import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { getDb } from '../db/connection'
import type {
  CardMapRef, FeatureKind, FeatureStyle, Geometry, MapFeature, MapFeatureInput, MapFeaturePatch, MapSummary
} from '@shared/types'

interface FeatureRow {
  id: string
  map_id: string
  kind: FeatureKind
  geometry: string
  label: string | null
  notes: string | null
  style: string
  card_id: string | null
  child_map_id: string | null
}

const KINDS = new Set<FeatureKind>(['pin', 'region', 'zone', 'label', 'path'])
const MAP_COLS = 'id, world_id, name, image_id, width, height'

const parse = <T>(s: string, fallback: T): T => {
  try {
    return JSON.parse(s) as T
  } catch {
    return fallback
  }
}

const toFeature = (r: FeatureRow): MapFeature => ({
  ...r,
  geometry: parse<Geometry>(r.geometry, { x: 0, y: 0 }),
  style: parse<FeatureStyle>(r.style, {})
})

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)

function validGeometry(kind: FeatureKind, g: Geometry): boolean {
  if (kind === 'pin' || kind === 'label') return 'x' in g && finite(g.x) && finite(g.y)
  return 'points' in g && Array.isArray(g.points) && g.points.length >= (kind === 'path' ? 2 : 3) && g.points.every((p) => finite(p[0]) && finite(p[1]))
}

export function registerMaps(): void {
  const db = (): ReturnType<typeof getDb> => getDb()
  const getMap = (id: string): MapSummary =>
    db().prepare(`SELECT ${MAP_COLS} FROM maps WHERE id = ?`).get(id) as MapSummary
  const getFeature = (id: string): MapFeature =>
    toFeature(db().prepare('SELECT * FROM map_features WHERE id = ?').get(id) as FeatureRow)

  ipcMain.handle('maps:list', (_e, worldId: string): MapSummary[] =>
    db().prepare(`SELECT ${MAP_COLS} FROM maps WHERE world_id = ? ORDER BY name COLLATE NOCASE`).all(worldId) as MapSummary[]
  )

  ipcMain.handle(
    'maps:create',
    (_e, worldId: string, input: { name: string; image_id: string | null; width: number | null; height: number | null }): MapSummary => {
      const id = randomUUID()
      db().prepare('INSERT INTO maps (id, world_id, name, image_id, width, height) VALUES (?, ?, ?, ?, ?, ?)')
        .run(id, worldId, input.name.trim() || 'Mapa sem nome', input.image_id, input.width, input.height)
      return getMap(id)
    }
  )

  ipcMain.handle('maps:rename', (_e, id: string, name: string): MapSummary => {
    db().prepare('UPDATE maps SET name = ? WHERE id = ?').run(name.trim() || 'Mapa sem nome', id)
    return getMap(id)
  })

  ipcMain.handle('maps:remove', (_e, id: string): void => {
    db().prepare('DELETE FROM maps WHERE id = ?').run(id)
  })

  ipcMain.handle('maps:features', (_e, mapId: string): MapFeature[] =>
    (db().prepare('SELECT * FROM map_features WHERE map_id = ? ORDER BY rowid').all(mapId) as FeatureRow[]).map(toFeature)
  )

  ipcMain.handle('maps:createFeature', (_e, mapId: string, input: MapFeatureInput): MapFeature => {
    if (!KINDS.has(input.kind) || !validGeometry(input.kind, input.geometry)) throw new Error('Elemento inválido.')
    const id = randomUUID()
    db().prepare(
      'INSERT INTO map_features (id, map_id, kind, geometry, label, style) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, mapId, input.kind, JSON.stringify(input.geometry), input.label ?? null, JSON.stringify(input.style ?? {}))
    return getFeature(id)
  })

  ipcMain.handle('maps:updateFeature', (_e, id: string, patch: MapFeaturePatch): MapFeature => {
    const cur = db().prepare('SELECT * FROM map_features WHERE id = ?').get(id) as FeatureRow | undefined
    if (!cur) throw new Error('Elemento não encontrado.')
    if (patch.geometry && !validGeometry(cur.kind, patch.geometry)) throw new Error('Geometria inválida.')

    let child = 'child_map_id' in patch ? (patch.child_map_id ?? null) : cur.child_map_id
    if (child === cur.map_id) child = null // um mapa não pode ser submapa de si mesmo

    db().prepare(
      'UPDATE map_features SET geometry = ?, label = ?, notes = ?, style = ?, card_id = ?, child_map_id = ? WHERE id = ?'
    ).run(
      patch.geometry ? JSON.stringify(patch.geometry) : cur.geometry,
      'label' in patch ? (patch.label ?? null) : cur.label,
      'notes' in patch ? (patch.notes ?? null) : cur.notes,
      patch.style ? JSON.stringify(patch.style) : cur.style,
      'card_id' in patch ? (patch.card_id ?? null) : cur.card_id,
      child,
      id
    )
    return getFeature(id)
  })

  ipcMain.handle('maps:removeFeature', (_e, id: string): void => {
    db().prepare('DELETE FROM map_features WHERE id = ?').run(id)
  })

  ipcMain.handle('maps:featuresForCard', (_e, cardId: string): CardMapRef[] =>
    db().prepare(
      `SELECT f.id, f.map_id, m.name AS map_name, f.label, f.kind
         FROM map_features f JOIN maps m ON m.id = f.map_id
        WHERE f.card_id = ?
        ORDER BY m.name COLLATE NOCASE`
    ).all(cardId) as CardMapRef[]
  )
}
