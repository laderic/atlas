import { net } from 'electron'
import { createWriteStream, mkdtempSync, rmSync } from 'fs'
import { once } from 'events'
import { tmpdir } from 'os'
import { basename, extname, join } from 'path'
import { getDb } from '../db/connection'
import { importPaths, mediaTypeFor } from './mediaStore'
import type { ImportResult } from '@shared/types'

const MAX_BYTES = 200 * 1024 * 1024
const TIMEOUT_MS = 30_000

const EXT_BY_MIME: Record<string, string> = {
  'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif',
  'image/avif': '.avif', 'image/bmp': '.bmp', 'image/svg+xml': '.svg',
  'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov',
  'audio/mpeg': '.mp3', 'audio/wav': '.wav', 'audio/x-wav': '.wav', 'audio/ogg': '.ogg',
  'audio/mp4': '.m4a', 'audio/aac': '.aac', 'audio/flac': '.flac'
}

class DownloadError extends Error {}

const safeName = (s: string): string =>
  s.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').trim().slice(0, 80) || 'imagem'

/** Baixa uma URL para um arquivo temporário; devolve o caminho e o diretório a limpar. */
async function downloadToTemp(rawUrl: string): Promise<{ file: string; dir: string }> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new DownloadError('link inválido')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new DownloadError('só links http ou https')

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  let dir: string | null = null
  try {
    let res: Response
    try {
      res = await net.fetch(url.toString(), {
        signal: ctrl.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Atlas/0.1' }
      })
    } catch {
      throw new DownloadError(ctrl.signal.aborted ? 'tempo esgotado' : 'falha de conexão')
    }
    if (!res.ok || !res.body) throw new DownloadError(`erro HTTP ${res.status}`)

    const mime = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
    const ext = EXT_BY_MIME[mime] ?? extname(url.pathname).toLowerCase()
    if (!mediaTypeFor(ext)) throw new DownloadError('o link não aponta para um arquivo de imagem, vídeo ou áudio')
    if (Number(res.headers.get('content-length') ?? 0) > MAX_BYTES) throw new DownloadError('arquivo muito grande (limite de 200 MB)')

    let base = ''
    try {
      base = decodeURIComponent(basename(url.pathname, extname(url.pathname)))
    } catch {
      base = basename(url.pathname, extname(url.pathname))
    }
    dir = mkdtempSync(join(tmpdir(), 'atlas-dl-'))
    const file = join(dir, safeName(base || url.hostname) + ext)

    const out = createWriteStream(file)
    const reader = res.body.getReader()
    let total = 0
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        total += value.length
        if (total > MAX_BYTES) {
          ctrl.abort()
          throw new DownloadError('arquivo muito grande (limite de 200 MB)')
        }
        if (!out.write(value)) await once(out, 'drain')
      }
    } catch (err) {
      out.destroy()
      if (err instanceof DownloadError) throw err
      throw new DownloadError(ctrl.signal.aborted ? 'tempo esgotado' : 'falha ao baixar')
    }
    out.end()
    await once(out, 'finish')
    return { file, dir }
  } catch (err) {
    if (dir) rmSync(dir, { recursive: true, force: true })
    throw err
  } finally {
    clearTimeout(timer)
  }
}

export async function importUrls(
  worldId: string,
  folderId: string | null,
  urls: string[]
): Promise<ImportResult & { errors: string[] }> {
  void getDb
  const total: ImportResult & { errors: string[] } = { items: [], skipped: 0, failed: 0, errors: [] }
  for (const url of urls) {
    let tmp: { file: string; dir: string } | null = null
    try {
      tmp = await downloadToTemp(url)
      const r = await importPaths(worldId, folderId, [tmp.file])
      total.items.push(...r.items)
      total.skipped += r.skipped
      if (r.failed) throw new DownloadError('não foi possível salvar o arquivo')
    } catch (err) {
      total.failed++
      total.errors.push(`${url} — ${err instanceof DownloadError ? err.message : 'erro inesperado'}`)
    } finally {
      if (tmp) rmSync(tmp.dir, { recursive: true, force: true })
    }
  }
  return total
}
