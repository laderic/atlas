import { ipcMain } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'
import { importPaths } from '../services/mediaStore'
import { readStockIndex, stockRoot } from '../services/stock'
import type { ImportResult } from '@shared/types'

export function registerStock(): void {
  ipcMain.handle('stock:index', () => readStockIndex())

  // Copia as imagens escolhidas para a biblioteca do mundo (sem duplicar as que já existem).
  ipcMain.handle('stock:import', async (_e, worldId: string, folderId: string | null, ids: string[]): Promise<ImportResult> => {
    const idx = readStockIndex()
    const paths = ids
      .map((id) => idx.items.find((i) => i.id === id))
      .filter((i): i is NonNullable<typeof i> => !!i)
      .map((i) => join(stockRoot(), i.file))
      .filter((p) => existsSync(p))
    return importPaths(worldId, folderId, paths)
  })
}
