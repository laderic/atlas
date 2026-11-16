import { BrowserWindow, dialog, ipcMain } from 'electron'
import { commitImport } from '../services/importer'
import { scanImport } from '../services/importer'
import type { ImportPayload, ImportPickMode, ImportSource } from '@shared/types'

const FILTERS: Record<ImportSource, { name: string; extensions: string[] }[]> = {
  obsidian: [],
  worldanvil: [],
  notion: [{ name: 'Exportação do Notion', extensions: ['zip'] }],
  googledocs: [{ name: 'Documentos', extensions: ['docx', 'html', 'htm', 'zip'] }],
  word: [{ name: 'Documentos Word', extensions: ['docx'] }]
}

export function registerImport(): void {
  ipcMain.handle('import:pick', async (e, source: ImportSource, mode: ImportPickMode): Promise<string[]> => {
    const win = BrowserWindow.fromWebContents(e.sender)!
    if (mode === 'folder') {
      const r = await dialog.showOpenDialog(win, { title: 'Escolher pasta', properties: ['openDirectory'] })
      return r.canceled ? [] : r.filePaths
    }
    const filters = mode === 'zip' ? [{ name: 'Arquivo zip', extensions: ['zip'] }] : FILTERS[source]
    const r = await dialog.showOpenDialog(win, {
      title: 'Escolher arquivos',
      properties: ['openFile', 'multiSelections'],
      filters: filters.length ? filters : undefined
    })
    return r.canceled ? [] : r.filePaths
  })

  ipcMain.handle('import:scan', (_e, source: ImportSource, paths: string[]) => scanImport(source, paths))

  ipcMain.handle('import:commit', (_e, worldId: string, payload: ImportPayload) => commitImport(worldId, payload))
}
