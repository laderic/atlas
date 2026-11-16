import { BrowserWindow, Menu, type MenuItemConstructorOptions } from 'electron'
import type { MenuAction } from '@shared/types'
import { getLang, type Lang } from './config'

const LABELS: Record<Lang, Record<string, string>> = {
  'pt-BR': {
    file: 'Arquivo', newWorld: 'Novo mundo', exportJson: 'Exportar dados (JSON)…', importJson: 'Importar dados (JSON)…', quit: 'Sair',
    edit: 'Editar', undo: 'Desfazer', redo: 'Refazer', cut: 'Recortar', copy: 'Copiar', paste: 'Colar', selectAll: 'Selecionar tudo', search: 'Busca global…',
    view: 'Exibir', zoomIn: 'Aumentar zoom', zoomOut: 'Diminuir zoom', zoomReset: 'Zoom padrão', fullscreen: 'Tela cheia', devtools: 'Ferramentas de desenvolvedor'
  },
  en: {
    file: 'File', newWorld: 'New world', exportJson: 'Export data (JSON)…', importJson: 'Import data (JSON)…', quit: 'Quit',
    edit: 'Edit', undo: 'Undo', redo: 'Redo', cut: 'Cut', copy: 'Copy', paste: 'Paste', selectAll: 'Select all', search: 'Global search…',
    view: 'View', zoomIn: 'Zoom in', zoomOut: 'Zoom out', zoomReset: 'Reset zoom', fullscreen: 'Full screen', devtools: 'Developer tools'
  }
}

export function buildMenu(win: BrowserWindow): void {
  const L = LABELS[getLang()]
  const send = (a: MenuAction) => () => win.webContents.send('menu', a)

  const template: MenuItemConstructorOptions[] = [
    {
      label: L.file,
      submenu: [
        { label: L.newWorld, accelerator: 'CmdOrCtrl+N', click: send('novo-mundo') },
        { type: 'separator' },
        { label: L.exportJson, click: send('exportar') },
        { label: L.importJson, click: send('importar') },
        { type: 'separator' },
        { label: L.quit, role: 'quit' }
      ]
    },
    {
      label: L.edit,
      submenu: [
        { label: L.undo, role: 'undo' },
        { label: L.redo, role: 'redo' },
        { type: 'separator' },
        { label: L.cut, role: 'cut' },
        { label: L.copy, role: 'copy' },
        { label: L.paste, role: 'paste' },
        { label: L.selectAll, role: 'selectAll' },
        { type: 'separator' },
        { label: L.search, accelerator: 'CmdOrCtrl+K', click: send('paleta') }
      ]
    },
    {
      label: L.view,
      submenu: [
        { label: L.zoomIn, role: 'zoomIn' },
        { label: L.zoomOut, role: 'zoomOut' },
        { label: L.zoomReset, role: 'resetZoom' },
        { type: 'separator' },
        { label: L.fullscreen, role: 'togglefullscreen' },
        { label: L.devtools, role: 'toggleDevTools' }
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
