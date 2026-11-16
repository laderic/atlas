import { app, BrowserWindow, Menu, protocol, net, shell, session, type MenuItemConstructorOptions } from 'electron'
import { join, resolve, relative, isAbsolute, sep } from 'path'
import { stockRoot } from './services/stock'
import { existsSync } from 'fs'
import { pathToFileURL } from 'url'
import { openDatabase, mediaDir } from './db/connection'
import { registerIpc } from './ipc'
import { buildMenu } from './menu'
import { getLang } from './config'

protocol.registerSchemesAsPrivileged([
  { scheme: 'media', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } },
  { scheme: 'atlas', privileges: { standard: true, secure: true, supportFetchAPI: true } },
  { scheme: 'stock', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
])

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 980,
    minHeight: 620,
    show: false,
    icon: existsSync(join(__dirname, '../../resources/icon.png')) ? join(__dirname, '../../resources/icon.png') : undefined,
    backgroundColor: '#12141c',
    title: 'Atlas',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  win.once('ready-to-show', () => win.show())

  // Clique direito: sugestões de correção e "adicionar ao dicionário" em palavras marcadas.
  win.webContents.on('context-menu', (_e, params) => {
    const items: MenuItemConstructorOptions[] = []
    if (params.misspelledWord) {
      const word = params.misspelledWord
      const suggestions = params.dictionarySuggestions.slice(0, 6)
      if (suggestions.length) {
        for (const s of suggestions) items.push({ label: s, click: () => win.webContents.replaceMisspelling(s) })
      } else {
        items.push({ label: 'Nenhuma sugestão', enabled: false })
      }
      items.push({ type: 'separator' })
      items.push({
        label: `Adicionar "${word}" ao dicionário`,
        click: () => { void win.webContents.session.addWordToSpellCheckerDictionary(word) }
      })
      items.push({ type: 'separator' })
    }
    if (params.isEditable) {
      items.push({ role: 'cut', label: 'Recortar' }, { role: 'copy', label: 'Copiar' }, { role: 'paste', label: 'Colar' }, { role: 'selectAll', label: 'Selecionar tudo' })
    } else if (params.selectionText) {
      items.push({ role: 'copy', label: 'Copiar' })
    }
    if (items.length) Menu.buildFromTemplate(items).popup({ window: win })
  })

  // Links externos nunca abrem dentro do app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadURL('atlas://app/index.html')
  }
  return win
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.whenReady().then(() => {
    openDatabase()
    session.defaultSession.setSpellCheckerLanguages(getLang() === 'en' ? ['en-US', 'pt-BR'] : ['pt-BR', 'en-US'])

    // Em produção, bloqueia qualquer recurso que não seja local.
    if (app.isPackaged) {
      session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
        cb({
          responseHeaders: {
            ...details.responseHeaders,
            'Content-Security-Policy': [
              "default-src 'self'; img-src 'self' media: stock: data: blob:; media-src 'self' media: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'"
            ]
          }
        })
      })
    }

    // media://file/<caminho-relativo> → arquivo dentro da pasta de mídia.
    protocol.handle('media', async (req) => {
      const url = new URL(req.url)
      const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '')
      const full = resolve(mediaDir(), rel)
      const check = relative(mediaDir(), full)
      if (check.startsWith('..') || isAbsolute(check)) return new Response('Acesso negado', { status: 403 })
      try {
        const res = await net.fetch(pathToFileURL(full).toString(), {
          headers: req.headers,
          bypassCustomProtocolHandlers: true
        })
        const headers = new Headers(res.headers)
        headers.set('Access-Control-Allow-Origin', '*')
        return new Response(res.body, { status: res.status, headers })
      } catch {
        return new Response('Não encontrado', { status: 404 })
      }
    })

    // stock://file/<caminho> → imagens do estoque de arte (só dentro da pasta do estoque)
    protocol.handle('stock', async (req) => {
      const { pathname } = new URL(req.url)
      const root = resolve(stockRoot())
      const rel = decodeURIComponent(pathname).replace(/^\/+/, '')
      const full = resolve(root, rel)
      if (!full.startsWith(root + sep)) return new Response('Acesso negado', { status: 403 })
      return net.fetch(pathToFileURL(full).toString())
    })

    // atlas://app/... → arquivos da interface (evita bloqueio de scripts ao abrir do disco)
    protocol.handle('atlas', async (req) => {
      const { pathname } = new URL(req.url)
      const root = resolve(join(__dirname, '../renderer'))
      const rel = decodeURIComponent(pathname).replace(/^\/+/, '') || 'index.html'
      const full = resolve(root, rel)
      if (full !== root && !full.startsWith(root + (process.platform === 'win32' ? '\\' : '/'))) {
        return new Response('Acesso negado', { status: 403 })
      }
      return net.fetch(pathToFileURL(full).toString())
    })

    registerIpc()
    const win = createWindow()
    buildMenu(win)

    app.on('second-instance', () => {
      if (win.isMinimized()) win.restore()
      win.focus()
    })
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) buildMenu(createWindow())
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
