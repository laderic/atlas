import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { getDb } from '../db/connection'
import type {
  FichaValue, SheetAttr, SheetCol, SheetDetail, SheetKind, SheetRow, SheetSavePatch, SheetSummary
} from '@shared/types'

interface SRow {
  id: string
  world_id: string
  name: string
  columns: string
  rows: string
  kind: string
  card_id: string | null
}

// Atributos literários: a ficha descreve pessoas por qualidades, não por números.
const FICHA_PRESET: SheetAttr[] = [
  { key: 'fisico', label: 'Físico', options: ['magro', 'fraco', 'mediano', 'forte', 'atlético'] },
  { key: 'coragem', label: 'Coragem', options: ['medroso', 'hesitante', 'firme', 'destemido', 'temerário'] },
  { key: 'temperamento', label: 'Temperamento', options: ['calmo', 'impulsivo', 'melancólico', 'otimista', 'cínico'] },
  { key: 'intelecto', label: 'Intelecto', options: ['simples', 'perspicaz', 'erudito', 'brilhante'] },
  { key: 'aparencia', label: 'Aparência', options: ['discreta', 'marcante', 'elegante', 'desgastada'] },
  { key: 'origem', label: 'Origem', options: [] },
  { key: 'oficio', label: 'Ofício', options: [] }
]
const TABLE_PRESET: SheetCol[] = [
  { key: 'nome', label: 'Nome', type: 'text' },
  { key: 'quantidade', label: 'Quantidade', type: 'number' },
  { key: 'valor', label: 'Valor', type: 'number' }
]

const parse = <T>(s: string, fallback: T): T => {
  try {
    return JSON.parse(s) as T
  } catch {
    return fallback
  }
}
const toSummary = (r: SRow): SheetSummary => ({
  id: r.id, world_id: r.world_id, name: r.name, kind: r.kind === 'ficha' ? 'ficha' : 'tabela', card_id: r.card_id
})
const toDetail = (r: SRow): SheetDetail => {
  const base = { sheet: toSummary(r) }
  if (r.kind === 'ficha') {
    return { ...base, attrs: parse<SheetAttr[]>(r.columns, []), cols: [], values: parse<Record<string, FichaValue>>(r.rows, {}), rows: [] }
  }
  return { ...base, attrs: [], cols: parse<SheetCol[]>(r.columns, []), values: {}, rows: parse<SheetRow[]>(r.rows, []) }
}

export function registerSheets(): void {
  const db = (): ReturnType<typeof getDb> => getDb()
  const getRow = (id: string): SRow => {
    const r = db().prepare('SELECT * FROM sheets WHERE id = ?').get(id) as SRow | undefined
    if (!r) throw new Error('Ficha não encontrada.')
    return r
  }

  ipcMain.handle('sheets:list', (_e, worldId: string): SheetSummary[] =>
    (db().prepare('SELECT * FROM sheets WHERE world_id = ? ORDER BY name COLLATE NOCASE').all(worldId) as SRow[]).map(toSummary)
  )

  ipcMain.handle('sheets:forCard', (_e, cardId: string): SheetSummary[] =>
    (db().prepare('SELECT * FROM sheets WHERE card_id = ? ORDER BY name COLLATE NOCASE').all(cardId) as SRow[]).map(toSummary)
  )

  ipcMain.handle('sheets:get', (_e, id: string): SheetDetail => toDetail(getRow(id)))

  ipcMain.handle('sheets:create', (_e, worldId: string, name: string, kind: SheetKind, cardId: string | null): SheetDetail => {
    const id = randomUUID()
    const isFicha = kind === 'ficha'
    db().prepare('INSERT INTO sheets (id, world_id, name, columns, rows, kind, card_id) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      id,
      worldId,
      name.trim() || (isFicha ? 'Nova ficha' : 'Nova tabela'),
      JSON.stringify(isFicha ? FICHA_PRESET : TABLE_PRESET),
      JSON.stringify(isFicha ? {} : []),
      isFicha ? 'ficha' : 'tabela',
      cardId
    )
    return toDetail(getRow(id))
  })

  ipcMain.handle('sheets:rename', (_e, id: string, name: string): void => {
    db().prepare('UPDATE sheets SET name = ? WHERE id = ?').run(name.trim() || 'Sem nome', id)
  })

  // Salva só o que mudou. Fichas usam attrs/values; tabelas usam cols/rows.
  ipcMain.handle('sheets:save', (_e, id: string, patch: SheetSavePatch): void => {
    const cur = getRow(id)
    const sets: string[] = []
    const args: string[] = []
    if (patch.name !== undefined) {
      sets.push('name = ?')
      args.push(patch.name.trim() || 'Sem nome')
    }
    if (cur.kind === 'ficha') {
      if (patch.attrs) { sets.push('columns = ?'); args.push(JSON.stringify(patch.attrs)) }
      if (patch.values) { sets.push('rows = ?'); args.push(JSON.stringify(patch.values)) }
    } else {
      if (patch.cols) { sets.push('columns = ?'); args.push(JSON.stringify(patch.cols)) }
      if (patch.rows) { sets.push('rows = ?'); args.push(JSON.stringify(patch.rows)) }
    }
    if (sets.length) db().prepare(`UPDATE sheets SET ${sets.join(', ')} WHERE id = ?`).run(...args, id)
  })

  ipcMain.handle('sheets:remove', (_e, id: string): void => {
    db().prepare('DELETE FROM sheets WHERE id = ?').run(id)
  })
}
