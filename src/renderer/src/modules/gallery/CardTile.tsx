import type { CardSummary, Tag } from '@shared/types'
import { useMedia } from '@/store/media'
import { mediaUrl } from '@/lib/media'

interface Props {
  card: CardSummary
  tags: Tag[]
  typeName: string | null
  typeColor: string
  onOpen: () => void
}

/** Cartão visual do card: capa (ou imagem), tipo e nome sobre um degradê. */
export function CardTile({ card, tags, typeName, typeColor, onOpen }: Props): JSX.Element {
  const media = useMedia((s) => s.items)
  const pic = media.find((m) => m.id === card.cover_media_id) ?? media.find((m) => m.id === card.image_id) ?? null

  return (
    <button
      onClick={onOpen}
      className="group relative aspect-[3/4] w-full overflow-hidden rounded-lg border border-line bg-panel text-left"
    >
      {pic ? (
        <img
          src={mediaUrl(pic)}
          alt=""
          draggable={false}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0" style={{ background: `linear-gradient(160deg, ${typeColor}55, #181b26 85%)` }}>
          <span className="absolute inset-0 flex items-center justify-center font-serif text-7xl text-white/20">{card.title.charAt(0)}</span>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />
      {tags.length > 0 && (
        <div className="absolute left-2 top-2 flex max-w-[90%] flex-wrap gap-1">
          {tags.slice(0, 3).map((t) => (
            <span key={t.id} className="rounded-full px-2 py-0.5 text-[10px] text-white" style={{ background: `${t.color}dd` }}>{t.name}</span>
          ))}
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 p-3">
        {typeName && <p className="text-[10px] uppercase tracking-wider text-white/70">{typeName}</p>}
        <p className="truncate font-serif text-lg leading-tight text-white">{card.title}</p>
      </div>
    </button>
  )
}
