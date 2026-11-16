import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { getDb } from '../db/connection'
import type { LifeEnd, LifeStart, TimelineLife } from '@shared/types'

const STARTS = new Set<LifeStart>(['nascimento', 'fundacao'])
const ENDS = new Set<LifeEnd>(['morte', 'abandono', 'destruicao', 'dissolucao', 'fim'])
const num = (n: unknown): number | null => (typeof n === 'number' && Number.isFinite(n) ? n : null)

export function registerLives(): void {
  const db = (): ReturnType<typeof getDb> => getDb()

  ipcMain.handle('lives:forCard', (_e, cardId: string) =>
    db().prepare(
      `SELECT l.*, t.name AS timeline_name FROM timeline_lives l JOIN timelines t ON t.id = l.timeline_id
        WHERE l.card_id = ? ORDER BY t.name COLLATE NOCASE`
    ).all(cardId)
  )

  // Cria ou atualiza o nascimento (e o fim, se houver) do card nesta linha do tempo.
  ipcMain.handle('lives:upsert', (_e, timelineId: string, cardId: string, input: {
    start_value: number; start_kind: LifeStart; end_value: number | null; end_kind: LifeEnd | null
  }): TimelineLife => {
    const sv = num(input.start_value)
    if (sv === null) throw new Error('Informe a posição do nascimento.')
    const sk: LifeStart = STARTS.has(input.start_kind) ? input.start_kind : 'nascimento'
    const ev = num(input.end_value)
    const ek: LifeEnd | null = ev !== null && ENDS.has(input.end_kind as LifeEnd) ? (input.end_kind as LifeEnd) : null
    const existing = db().prepare('SELECT id FROM timeline_lives WHERE timeline_id = ? AND card_id = ?')
      .get(timelineId, cardId) as { id: string } | undefined
    const id = existing?.id ?? randomUUID()
    db().prepare(
      `INSERT INTO timeline_lives (id, timeline_id, card_id, start_value, start_kind, end_value, end_kind)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(timeline_id, card_id) DO UPDATE SET
         start_value = excluded.start_value, start_kind = excluded.start_kind,
         end_value = excluded.end_value, end_kind = excluded.end_kind`
    ).run(id, timelineId, cardId, sv, sk, ev, ek)
    return db().prepare('SELECT * FROM timeline_lives WHERE timeline_id = ? AND card_id = ?').get(timelineId, cardId) as TimelineLife
  })

  ipcMain.handle('lives:patch', (_e, id: string, patch: Partial<TimelineLife>): void => {
    const cur = db().prepare('SELECT * FROM timeline_lives WHERE id = ?').get(id) as TimelineLife | undefined
    if (!cur) return
    const next = { ...cur, ...patch }
    db().prepare('UPDATE timeline_lives SET start_value = ?, start_kind = ?, end_value = ?, end_kind = ? WHERE id = ?').run(
      num(next.start_value) ?? cur.start_value,
      STARTS.has(next.start_kind) ? next.start_kind : cur.start_kind,
      num(next.end_value),
      num(next.end_value) !== null && next.end_kind && ENDS.has(next.end_kind) ? next.end_kind : null,
      id
    )
  })

  ipcMain.handle('lives:remove', (_e, id: string): void => {
    db().prepare('DELETE FROM timeline_lives WHERE id = ?').run(id)
  })
}
