import type { MediaItem } from '@shared/types'
import { mediaUrl } from '@/lib/media'

/** Miniatura de qualquer tipo de mídia, preenchendo o contêiner pai. */
export function MediaThumb({ item }: { item: MediaItem }): JSX.Element {
  if (item.type === 'image' || item.type === 'gif') {
    return <img src={mediaUrl(item)} alt={item.name} loading="lazy" decoding="async" draggable={false} className="h-full w-full object-cover" />
  }
  if (item.type === 'video') {
    return (
      <div className="relative h-full w-full bg-black">
        <video src={mediaUrl(item)} preload="metadata" muted className="h-full w-full object-cover" />
        <span className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 text-xs">▶</span>
      </div>
    )
  }
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-raised text-muted">
      <span className="text-3xl">♪</span>
      <span className="max-w-full truncate px-2 text-xs">{item.name}</span>
    </div>
  )
}
