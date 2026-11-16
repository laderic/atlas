import { BrowserWindow, dialog, ipcMain } from 'electron'
import { readFileSync } from 'fs'
import { getDb } from '../db/connection'
import { createFromTemplate, parseTool } from '../services/workshop'
import type { WorkshopTool, WorkshopTemplate } from '@shared/types'

interface Row { id: string; name: string; version: string; manifest: string; enabled: number }

const toTool = (r: Row): WorkshopTool => {
  const m = parseTool(r.manifest, r.enabled === 1)
  return { ...m, id: r.id, name: r.name, version: r.version, enabled: r.enabled === 1 }
}

export function registerWorkshop(): void {
  const db = (): ReturnType<typeof getDb> => getDb()

  ipcMain.handle('workshop:list', (): WorkshopTool[] =>
    (db().prepare('SELECT * FROM workshop_tools ORDER BY name COLLATE NOCASE').all() as Row[]).map(toTool)
  )

  ipcMain.handle('workshop:install', async (e): Promise<WorkshopTool | null> => {
    const win = BrowserWindow.fromWebContents(e.sender)!
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'Instalar extensão',
      properties: ['openFile'],
      filters: [{ name: 'Extensão do Atlas', extensions: ['json'] }]
    })
    if (canceled || !filePaths[0]) return null
    const raw = readFileSync(filePaths[0], 'utf-8')
    const tool = parseTool(raw, true)
    // Guarda o arquivo original (já validado), para revalidar ao ler.
    const manifest = raw
    // Reinstalar a mesma extensão atualiza o arquivo e mantém se estava ligada.
    const prev = db().prepare('SELECT enabled FROM workshop_tools WHERE id = ?').get(tool.id) as { enabled: number } | undefined
    db().prepare(
      `INSERT INTO workshop_tools (id, name, version, manifest, enabled) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, version = excluded.version, manifest = excluded.manifest`
    ).run(tool.id, tool.name, tool.version, manifest, prev?.enabled ?? 1)
    const row = db().prepare('SELECT * FROM workshop_tools WHERE id = ?').get(tool.id) as Row
    return toTool(row)
  })

  ipcMain.handle('workshop:setEnabled', (_e, id: string, enabled: boolean): void => {
    db().prepare('UPDATE workshop_tools SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, id)
  })

  ipcMain.handle('workshop:remove', (_e, id: string): void => {
    db().prepare('DELETE FROM workshop_tools WHERE id = ?').run(id)
  })

  ipcMain.handle('workshop:create', (_e, worldId: string, toolId: string, templateId: string, title: string) => {
    const row = db().prepare('SELECT * FROM workshop_tools WHERE id = ?').get(toolId) as Row | undefined
    if (!row) throw new Error('Extensão não encontrada.')
    const tool = toTool(row)
    if (!tool.enabled) throw new Error('Ligue a extensão antes de usar os modelos.')
    const tpl = tool.templates.find((t: WorkshopTemplate) => t.id === templateId)
    if (!tpl) throw new Error('Modelo não encontrado.')
    return createFromTemplate(worldId, tpl, title)
  })
}
