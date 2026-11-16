import { BrowserWindow, dialog, ipcMain } from 'electron'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { dirname, relative, resolve, isAbsolute } from 'path'
import { getDb, mediaDir } from '../db/connection'
import { reindexAll } from '../services/search.service'
import type { BackupResult } from '@shared/types'

// Ordem respeita as chaves estrangeiras (pais antes dos filhos).
const TABLES = [
  'worlds', 'tags', 'media', 'folders', 'card_types', 'cards', 'card_tags', 'card_links', 'event_participants', 'highlights',
  'maps', 'map_features', 'timelines', 'eras', 'timeline_events', 'timeline_lives',
  'canvases', 'canvas_elements', 'sheets', 'quill_books', 'quill_chapters',
  'quill_revisions', 'radio_stations', 'wiki_settings', 'wiki_pages', 'workshop_tools'
] as const

const FORMAT = 'atlas-backup'
const VERSION = 1

type Row = Record<string, unknown>
interface BackupFile {
  format: string
  version: number
  exportedAt: string
  tables: Record<string, Row[]>
  mediaFiles: Record<string, string> // caminho relativo → base64
}

const safePath = (rel: string): string | null => {
  const full = resolve(mediaDir(), rel)
  const check = relative(mediaDir(), full)
  return check.startsWith('..') || isAbsolute(check) ? null : full
}

function buildBackup(): BackupFile {
  const db = getDb()
  const tables: Record<string, Row[]> = {}
  for (const t of TABLES) tables[t] = db.prepare(`SELECT * FROM ${t}`).all() as Row[]

  const mediaFiles: Record<string, string> = {}
  for (const m of tables.media) {
    const rel = String(m.file_path)
    const full = safePath(rel)
    if (full && existsSync(full)) mediaFiles[rel] = readFileSync(full).toString('base64')
  }
  return { format: FORMAT, version: VERSION, exportedAt: new Date().toISOString(), tables, mediaFiles }
}

function restoreBackup(data: BackupFile): void {
  if (data.format !== FORMAT) throw new Error('Este arquivo não é um backup do Atlas.')
  if (data.version > VERSION) throw new Error('Backup criado por uma versão mais nova do Atlas.')

  const db = getDb()
  // Só aceita colunas que existem de verdade na tabela.
  const columns = new Map<string, Set<string>>()
  for (const t of TABLES) {
    const info = db.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]
    columns.set(t, new Set(info.map((c) => c.name)))
  }

  db.pragma('foreign_keys = OFF')
  try {
    db.transaction(() => {
      for (const t of [...TABLES].reverse()) db.prepare(`DELETE FROM ${t}`).run()
      for (const t of TABLES) {
        const valid = columns.get(t)!
        for (const row of data.tables[t] ?? []) {
          const cols = Object.keys(row).filter((c) => valid.has(c))
          if (cols.length === 0) continue
          db.prepare(
            `INSERT INTO ${t} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`
          ).run(...cols.map((c) => row[c]))
        }
      }
    })()
  } finally {
    db.pragma('foreign_keys = ON')
  }

  for (const [rel, b64] of Object.entries(data.mediaFiles ?? {})) {
    const full = safePath(rel)
    if (!full) continue
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, Buffer.from(b64, 'base64'))
  }
}

export function registerBackup(): void {
  ipcMain.handle('backup:export', async (e): Promise<BackupResult> => {
    const win = BrowserWindow.fromWebContents(e.sender)!
    const stamp = new Date().toISOString().slice(0, 10)
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: 'Exportar dados',
      defaultPath: `atlas-backup-${stamp}.json`,
      filters: [{ name: 'Backup do Atlas', extensions: ['json'] }]
    })
    if (canceled || !filePath) return { ok: false }
    try {
      writeFileSync(filePath, JSON.stringify(buildBackup()))
      return { ok: true, path: filePath }
    } catch (err) {
      return { ok: false, message: (err as Error).message }
    }
  })

  ipcMain.handle('backup:import', async (e): Promise<BackupResult> => {
    const win = BrowserWindow.fromWebContents(e.sender)!
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'Importar dados',
      properties: ['openFile'],
      filters: [{ name: 'Backup do Atlas', extensions: ['json'] }]
    })
    if (canceled || filePaths.length === 0) return { ok: false }

    const confirm = await dialog.showMessageBox(win, {
      type: 'warning',
      buttons: ['Substituir tudo', 'Cancelar'],
      defaultId: 1,
      cancelId: 1,
      title: 'Importar dados',
      message: 'A importação substitui todos os mundos atuais.',
      detail: 'Exporte um backup antes se quiser guardar o estado atual.'
    })
    if (confirm.response !== 0) return { ok: false }

    try {
      restoreBackup(JSON.parse(readFileSync(filePaths[0], 'utf-8')) as BackupFile)
      reindexAll()
      return { ok: true, path: filePaths[0] }
    } catch (err) {
      return { ok: false, message: (err as Error).message }
    }
  })
}
