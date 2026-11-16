import { registerWorlds } from './worlds.ipc'
import { registerBackup } from './backup.ipc'
import { registerCards } from './cards.ipc'
import { registerMedia } from './media.ipc'
import { registerMaps } from './maps.ipc'
import { registerTimelines } from './timelines.ipc'
import { registerCanvas } from './canvas.ipc'
import { registerSheets } from './sheets.ipc'
import { registerQuill } from './quill.ipc'
import { registerWiki } from './wiki.ipc'
import { registerImport } from './import.ipc'
import { registerWorkshop } from './workshop.ipc'
import { registerTags } from './tags.ipc'
import { registerEventCards } from './eventCards.ipc'
import { registerLives } from './lives.ipc'
import { registerHighlights } from './highlights.ipc'
import { registerInventory } from './inventory.ipc'
import { registerStock } from './stock.ipc'
import { registerUndo } from './undo.ipc'
import { registerConfig } from './config.ipc'

export function registerIpc(): void {
  registerWorlds()
  registerBackup()
  registerCards()
  registerMedia()
  registerMaps()
  registerTimelines()
  registerCanvas()
  registerSheets()
  registerQuill()
  registerWiki()
  registerImport()
  registerWorkshop()
  registerTags()
  registerEventCards()
  registerLives()
  registerHighlights()
  registerInventory()
  registerStock()
  registerUndo()
  registerConfig()
  // Próximas fases: cards, media, maps, timelines, canvas, tables, quill, wiki, import, workshop.
}
