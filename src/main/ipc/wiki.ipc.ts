import { app, dialog, ipcMain, BrowserWindow, shell } from 'electron'
import { createServer, type Server } from 'http'
import { randomUUID } from 'crypto'
import { existsSync, readFileSync, statSync } from 'fs'
import { extname, join, resolve, sep } from 'path'
import { getDb, dataDir } from '../db/connection'
import { publishWiki } from '../services/wiki/generator'
import type { WikiCardRow, WikiSettings, WikiState, WikiTheme } from '@shared/types'

const DEFAULT_PORT = 4321
const THEMES: WikiTheme[] = ['escuro', 'claro', 'pergaminho']
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.avif': 'image/avif', '.bmp': 'image/bmp'
}

let server: Server | null = null
let servingUrl: string | null = null

const defaultDir = (worldId: string): string => join(dataDir(), 'wiki', worldId)

function stopServer(): Promise<void> {
  return new Promise((resolveP) => {
    if (!server) return resolveP()
    server.close(() => resolveP())
    server.closeAllConnections?.()
    server = null
    servingUrl = null
  })
}

function startServer(dir: string, port: number): Promise<string> {
  const root = resolve(dir)
  return new Promise((resolveP, reject) => {
    const srv = createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url ?? '/', 'http://127.0.0.1').pathname)
      if (p.endsWith('/')) p += 'index.html'
      const full = resolve(root, '.' + p)
      if (full !== root && !full.startsWith(root + sep)) {
        res.writeHead(403).end('Acesso negado')
        return
      }
      let file = full
      if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html')
      if (!existsSync(file)) {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' }).end('<h1>Página não encontrada</h1>')
        return
      }
      res.writeHead(200, { 'Content-Type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream' })
      res.end(readFileSync(file))
    })
    srv.once('error', (err: NodeJS.ErrnoException) => {
      reject(new Error(err.code === 'EADDRINUSE' ? `A porta ${port} já está em uso. Escolha outra nas configurações.` : err.message))
    })
    // Só aceita conexões da própria máquina.
    srv.listen(port, '127.0.0.1', () => {
      server = srv
      servingUrl = `http://127.0.0.1:${port}/`
      resolveP(servingUrl)
    })
  })
}

export function registerWiki(): void {
  const db = (): ReturnType<typeof getDb> => getDb()

  const ensureSettings = (worldId: string): void => {
    const w = db().prepare('SELECT name FROM worlds WHERE id = ?').get(worldId) as { name: string } | undefined
    if (!w) throw new Error('Mundo não encontrado.')
    db().prepare("INSERT OR IGNORE INTO wiki_settings (world_id, title, theme, output_dir, local_domain) VALUES (?, ?, 'escuro', NULL, '')")
      .run(worldId, w.name)
  }

  const readPort = (worldId: string): number => {
    const r = db().prepare('SELECT settings FROM worlds WHERE id = ?').get(worldId) as { settings: string } | undefined
    try {
      const p = Number((JSON.parse(r?.settings ?? '{}') as { wikiPort?: number }).wikiPort)
      return Number.isInteger(p) && p > 1023 && p < 65536 ? p : DEFAULT_PORT
    } catch {
      return DEFAULT_PORT
    }
  }

  const state = (worldId: string): WikiState => {
    ensureSettings(worldId)
    const s = db().prepare('SELECT * FROM wiki_settings WHERE world_id = ?').get(worldId) as {
      title: string; theme: string; output_dir: string | null; local_domain: string | null
    }
    const cards = db().prepare(
      `SELECT c.id AS card_id, c.title, t.name AS type,
              COALESCE((SELECT published FROM wiki_pages p WHERE p.card_id = c.id AND p.world_id = c.world_id), 1) AS published
         FROM cards c LEFT JOIN card_types t ON t.id = c.type_id
        WHERE c.world_id = ? ORDER BY c.title COLLATE NOCASE`
    ).all(worldId) as { card_id: string; title: string; type: string | null; published: number }[]
    const settings: WikiSettings = {
      title: s.title,
      theme: THEMES.includes(s.theme as WikiTheme) ? (s.theme as WikiTheme) : 'escuro',
      output_dir: s.output_dir ?? defaultDir(worldId),
      local_domain: s.local_domain ?? '',
      port: readPort(worldId)
    }
    const rows: WikiCardRow[] = cards.map((c) => ({ ...c, published: c.published === 1 }))
    return { settings, cards: rows, serving: servingUrl }
  }

  ipcMain.handle('wiki:state', (_e, worldId: string): WikiState => state(worldId))

  ipcMain.handle('wiki:save', (_e, worldId: string, patch: Partial<WikiSettings>): WikiState => {
    ensureSettings(worldId)
    const cur = state(worldId).settings
    const theme = patch.theme && THEMES.includes(patch.theme) ? patch.theme : cur.theme
    db().prepare('UPDATE wiki_settings SET title = ?, theme = ?, output_dir = ?, local_domain = ? WHERE world_id = ?').run(
      (patch.title ?? cur.title).trim() || cur.title,
      theme,
      patch.output_dir !== undefined ? patch.output_dir || null : cur.output_dir,
      (patch.local_domain ?? cur.local_domain).trim(),
      worldId
    )
    if (patch.port !== undefined) {
      const port = Math.round(Number(patch.port))
      if (port < 1024 || port > 65535) throw new Error('Escolha uma porta entre 1024 e 65535.')
      const row = db().prepare('SELECT settings FROM worlds WHERE id = ?').get(worldId) as { settings: string }
      const obj = (() => { try { return JSON.parse(row.settings) as Record<string, unknown> } catch { return {} } })()
      db().prepare('UPDATE worlds SET settings = ? WHERE id = ?').run(JSON.stringify({ ...obj, wikiPort: port }), worldId)
    }
    return state(worldId)
  })

  // Cards marcados como não publicados ficam fora do site (e não têm página).
  ipcMain.handle('wiki:setPublished', (_e, worldId: string, cardId: string, published: boolean): void => {
    const row = db().prepare('SELECT id FROM wiki_pages WHERE card_id = ?').get(cardId) as { id: string } | undefined
    if (row) db().prepare('UPDATE wiki_pages SET published = ? WHERE id = ?').run(published ? 1 : 0, row.id)
    else if (!published) {
      db().prepare('INSERT INTO wiki_pages (id, world_id, card_id, published, slug) VALUES (?, ?, ?, 0, ?)')
        .run(randomUUID(), worldId, cardId, '')
    }
  })

  ipcMain.handle('wiki:chooseDir', async (e): Promise<string | null> => {
    const win = BrowserWindow.fromWebContents(e.sender)!
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'Escolher pasta da wiki',
      properties: ['openDirectory', 'createDirectory']
    })
    return canceled || !filePaths[0] ? null : filePaths[0]
  })

  ipcMain.handle('wiki:publish', (_e, worldId: string) => {
    ensureSettings(worldId)
    const s = state(worldId).settings
    const result = publishWiki(worldId, { title: s.title, theme: s.theme, outDir: s.output_dir, localDomain: s.local_domain })
    // Se o servidor estiver aberto, passa a servir a versão nova automaticamente (ele lê os arquivos a cada pedido).
    return result
  })

  ipcMain.handle('wiki:serve', async (_e, worldId: string): Promise<string> => {
    const s = state(worldId).settings
    if (!existsSync(join(s.output_dir, 'index.html'))) throw new Error('Publique a wiki antes de abrir.')
    await stopServer()
    const url = await startServer(s.output_dir, s.port)
    void shell.openExternal(url)
    return url
  })

  ipcMain.handle('wiki:stop', async (): Promise<void> => {
    await stopServer()
  })

  ipcMain.handle('wiki:openFolder', (_e, worldId: string): void => {
    const s = state(worldId).settings
    void shell.openPath(s.output_dir)
  })

  app.on('before-quit', () => {
    void stopServer()
  })
}
