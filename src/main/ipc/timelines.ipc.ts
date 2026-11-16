import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { getDb } from '../db/connection'
import type {
  Era, EraInput, EraPatch, EventInput, EventPatch, EventRef, TimelineDetail, TimelineEvent,
  TimelineSummary, TimelineVersion, TimelineLife
} from '@shared/types'

interface TlRow { id: string; world_id: string; name: string; calendar: string }

const CANON = 'canon'
const DEFAULT_UNIT = 'Ano'

const parseUnit = (s: string): string => {
  try {
    const v = JSON.parse(s) as { unit?: unknown }
    return typeof v.unit === 'string' && v.unit.trim() ? v.unit : DEFAULT_UNIT
  } catch {
    return DEFAULT_UNIT
  }
}
const toSummary = (r: TlRow): TimelineSummary => ({ id: r.id, world_id: r.world_id, name: r.name, unit: parseUnit(r.calendar) })
const num = (n: unknown): number | null => (typeof n === 'number' && Number.isFinite(n) ? n : null)

export function registerTimelines(): void {
  const db = (): ReturnType<typeof getDb> => getDb()
  const getTl = (id: string): TlRow | undefined => db().prepare('SELECT * FROM timelines WHERE id = ?').get(id) as TlRow | undefined
  const getEra = (id: string): Era => db().prepare('SELECT * FROM eras WHERE id = ?').get(id) as Era
  const getEvent = (id: string): TimelineEvent => db().prepare('SELECT * FROM timeline_events WHERE id = ?').get(id) as TimelineEvent

  // ---------- linhas do tempo ----------
  ipcMain.handle('timelines:list', (_e, worldId: string): TimelineSummary[] =>
    (db().prepare('SELECT * FROM timelines WHERE world_id = ? ORDER BY name COLLATE NOCASE').all(worldId) as TlRow[]).map(toSummary)
  )

  ipcMain.handle('timelines:create', (_e, worldId: string, name: string): TimelineSummary => {
    const id = randomUUID()
    db().prepare('INSERT INTO timelines (id, world_id, name, calendar) VALUES (?, ?, ?, ?)')
      .run(id, worldId, name.trim() || 'Linha do tempo', JSON.stringify({ unit: DEFAULT_UNIT }))
    return toSummary(getTl(id)!)
  })

  ipcMain.handle('timelines:update', (_e, id: string, patch: { name?: string; unit?: string }): TimelineSummary => {
    const cur = getTl(id)
    if (!cur) throw new Error('Linha do tempo não encontrada.')
    const name = patch.name?.trim() || cur.name
    const unit = patch.unit?.trim() || parseUnit(cur.calendar)
    db().prepare('UPDATE timelines SET name = ?, calendar = ? WHERE id = ?').run(name, JSON.stringify({ unit }), id)
    return toSummary(getTl(id)!)
  })

  ipcMain.handle('timelines:remove', (_e, id: string): void => {
    db().prepare('DELETE FROM timelines WHERE id = ?').run(id)
  })

  ipcMain.handle('timelines:detail', (_e, id: string): TimelineDetail => {
    const tl = getTl(id)
    if (!tl) throw new Error('Linha do tempo não encontrada.')
    return {
      timeline: toSummary(tl),
      eras: db().prepare('SELECT * FROM eras WHERE timeline_id = ? ORDER BY position, start_value').all(id) as Era[],
      events: db().prepare('SELECT * FROM timeline_events WHERE timeline_id = ? ORDER BY sort_value').all(id) as TimelineEvent[],
      lives: db().prepare('SELECT * FROM timeline_lives WHERE timeline_id = ?').all(id) as TimelineLife[],
      versions: db().prepare('SELECT * FROM timeline_versions WHERE world_id = ? ORDER BY position, name COLLATE NOCASE')
        .all(tl.world_id) as TimelineVersion[]
    }
  })

  ipcMain.handle('timelines:eventsForCard', (_e, cardId: string): EventRef[] =>
    db().prepare(
      `SELECT e.id, e.timeline_id, t.name AS timeline_name, e.title, e.date_label, e.version
         FROM timeline_events e JOIN timelines t ON t.id = e.timeline_id
        WHERE e.card_id = ?
        ORDER BY t.name COLLATE NOCASE`
    ).all(cardId) as EventRef[]
  )

  // Título do evento vem do card de evento escolhido.
  const cardTitle = (cardId: string | null): string | null => {
    if (!cardId) return null
    const r = db().prepare('SELECT title FROM cards WHERE id = ?').get(cardId) as { title: string } | undefined
    return r?.title ?? null
  }

  // ---------- eras ----------
  ipcMain.handle('eras:create', (_e, timelineId: string, input: EraInput): Era => {
    const id = randomUUID()
    const pos = (db().prepare('SELECT COALESCE(MAX(position), -1) + 1 AS p FROM eras WHERE timeline_id = ?')
      .get(timelineId) as { p: number }).p
    db().prepare(
      'INSERT INTO eras (id, timeline_id, name, color, start_value, end_value, position) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, timelineId, input.name.trim() || 'Era', input.color ?? null, num(input.start_value), num(input.end_value), pos)
    return getEra(id)
  })

  ipcMain.handle('eras:update', (_e, id: string, patch: EraPatch): Era => {
    const cur = getEra(id)
    db().prepare('UPDATE eras SET name = ?, color = ?, start_value = ?, end_value = ? WHERE id = ?').run(
      'name' in patch ? (patch.name?.trim() || cur.name) : cur.name,
      'color' in patch ? (patch.color ?? null) : cur.color,
      'start_value' in patch ? num(patch.start_value) : cur.start_value,
      'end_value' in patch ? num(patch.end_value) : cur.end_value,
      id
    )
    return getEra(id)
  })

  ipcMain.handle('eras:remove', (_e, id: string): void => {
    db().prepare('DELETE FROM eras WHERE id = ?').run(id)
  })

  // ---------- eventos ----------
  ipcMain.handle('events:create', (_e, timelineId: string, input: EventInput): TimelineEvent => {
    const id = randomUUID()
    const sort = num(input.sort_value) ?? 0
    db().prepare(
      `INSERT INTO timeline_events (id, timeline_id, era_id, version, title, description, sort_value, date_label, card_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, timelineId, input.era_id ?? null, input.version || CANON, cardTitle(input.card_id) ?? (input.title.trim() || 'Evento'),
      input.description ?? null, sort, input.date_label?.trim() || null, input.card_id ?? null
    )
    return getEvent(id)
  })

  ipcMain.handle('events:update', (_e, id: string, patch: EventPatch): TimelineEvent => {
    const cur = getEvent(id)
    db().prepare(
      `UPDATE timeline_events SET title = ?, description = ?, sort_value = ?, date_label = ?,
              era_id = ?, version = ?, card_id = ? WHERE id = ?`
    ).run(
      'title' in patch ? (patch.title?.trim() || 'Evento') : cur.title,
      'description' in patch ? (patch.description ?? null) : cur.description,
      'sort_value' in patch ? (num(patch.sort_value) ?? cur.sort_value) : cur.sort_value,
      'date_label' in patch ? (patch.date_label?.trim() || null) : cur.date_label,
      'era_id' in patch ? (patch.era_id ?? null) : cur.era_id,
      'version' in patch ? (patch.version || CANON) : cur.version,
      'card_id' in patch ? (patch.card_id ?? null) : cur.card_id,
      id
    )
    return getEvent(id)
  })

  ipcMain.handle('events:remove', (_e, id: string): void => {
    db().prepare('DELETE FROM timeline_events WHERE id = ?').run(id)
  })

  // ---------- versões (valem para o mundo inteiro) ----------
  const checkVersionName = (name: string): string => {
    const clean = name.trim()
    if (!clean || clean.toLowerCase() === CANON) throw new Error('Este nome é reservado.')
    return clean
  }

  ipcMain.handle('versions:create', (_e, worldId: string, name: string): TimelineVersion => {
    const clean = checkVersionName(name)
    const id = randomUUID()
    const pos = (db().prepare('SELECT COALESCE(MAX(position), -1) + 1 AS p FROM timeline_versions WHERE world_id = ?')
      .get(worldId) as { p: number }).p
    db().prepare('INSERT INTO timeline_versions (id, world_id, name, position) VALUES (?, ?, ?, ?)').run(id, worldId, clean, pos)
    return db().prepare('SELECT * FROM timeline_versions WHERE id = ?').get(id) as TimelineVersion
  })

  ipcMain.handle('versions:rename', (_e, id: string, name: string): void => {
    const clean = checkVersionName(name)
    const cur = db().prepare('SELECT * FROM timeline_versions WHERE id = ?').get(id) as TimelineVersion | undefined
    if (!cur || cur.name === clean) return
    db().transaction(() => {
      db().prepare(
        `UPDATE timeline_events SET version = ?
          WHERE version = ? AND timeline_id IN (SELECT id FROM timelines WHERE world_id = ?)`
      ).run(clean, cur.name, cur.world_id)
      db().prepare('UPDATE timeline_versions SET name = ? WHERE id = ?').run(clean, id)
    })()
  })

  // Eventos da versão excluída voltam para o Canon, sem serem apagados.
  ipcMain.handle('versions:remove', (_e, id: string): void => {
    const cur = db().prepare('SELECT * FROM timeline_versions WHERE id = ?').get(id) as TimelineVersion | undefined
    if (!cur) return
    db().transaction(() => {
      db().prepare(
        `UPDATE timeline_events SET version = ?
          WHERE version = ? AND timeline_id IN (SELECT id FROM timelines WHERE world_id = ?)`
      ).run(CANON, cur.name, cur.world_id)
      db().prepare('DELETE FROM timeline_versions WHERE id = ?').run(id)
    })()
  })
}
