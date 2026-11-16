import { app } from 'electron'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

export interface StockItem {
  id: string
  genre: string
  genreLabel: string
  subgenre: string
  file: string
  width: number
  height: number
}
export interface StockIndex {
  genres: { slug: string; label: string }[]
  items: StockItem[]
}

/** Pasta do estoque: no projeto (desenvolvimento) ou no instalador (app empacotado). */
export const stockRoot = (): string =>
  app.isPackaged ? join(process.resourcesPath, 'stock-art') : join(app.getAppPath(), 'stock-art')

export function readStockIndex(): StockIndex {
  const file = join(stockRoot(), 'index.json')
  if (!existsSync(file)) return { genres: [], items: [] }
  return JSON.parse(readFileSync(file, 'utf-8')) as StockIndex
}
