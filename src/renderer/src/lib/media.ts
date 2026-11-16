import type { MediaItem } from '@shared/types'

/** O `?v=` muda quando o arquivo é substituído, evitando cache antigo. */
export const mediaUrl = (m: MediaItem): string =>
  `media://file/${encodeURI(m.file_path)}?v=${(m.hash ?? '').slice(0, 8)}`

export function formatSize(n: number | null): string {
  if (n == null) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
}

export const isCroppable = (m: MediaItem): boolean => m.type === 'image' && !/\.svg$/i.test(m.file_path)
