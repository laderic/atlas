import { useMemo, useState } from 'react'
import type { MediaItem, MediaType } from '@shared/types'
import { Modal } from '@/components/Modal'
import { t } from '@/i18n/pt-BR'
import { tm } from '@/i18n/media'
import { norm } from '@/lib/mentions'
import { useMedia } from '@/store/media'
import { ImportUrlDialog } from './ImportUrlDialog'
import { MediaThumb } from './MediaThumb'

interface Props {
  title?: string
  kinds?: MediaType[]
  onPick: (item: MediaItem) => void
  onClose: () => void
}

/** Seletor reutilizável (imagem de card, capa do mundo; depois mapas e quadros). */
export function MediaPicker({ title = tm.pickTitle, kinds = ['image', 'gif'], onPick, onClose }: Props): JSX.Element {
  const { items, folders, importFiles } = useMedia()
  const [q, setQ] = useState('')
  const [folder, setFolder] = useState('')
  const [linking, setLinking] = useState(false)

  const list = useMemo(() => {
    const nq = norm(q.trim())
    return items.filter(
      (m) => kinds.includes(m.type) && (!folder || m.folder_id === folder) && (!nq || norm(m.name).includes(nq))
    )
  }, [items, q, folder, kinds])

  return (
    <Modal title={title} onClose={onClose} width={760}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={tm.search}
          aria-label={tm.search}
          className="min-w-0 flex-1 rounded border border-line bg-raised px-3 py-2"
        />
        <select value={folder} onChange={(e) => setFolder(e.target.value)} aria-label={tm.collection} className="rounded border border-line bg-raised px-2 py-2">
          <option value="">{tm.all}</option>
          {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <button onClick={() => importFiles(folder || null)} className="rounded border border-line px-3 py-2 hover:bg-raised">{tm.importFiles}</button>
        <button onClick={() => setLinking(true)} className="rounded border border-line px-3 py-2 hover:bg-raised">{tm.importLink}</button>
      </div>

      {list.length === 0 ? (
        <p className="py-10 text-center text-muted">{items.length === 0 ? tm.empty : tm.noResults}</p>
      ) : (
        <div className="grid max-h-[50vh] grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2 overflow-y-auto">
          {list.map((m) => (
            <button
              key={m.id}
              onClick={() => { onPick(m); onClose() }}
              title={m.name}
              className="aspect-square overflow-hidden rounded border border-line hover:border-accent"
            >
              <MediaThumb item={m} />
            </button>
          ))}
        </div>
      )}
      <div className="mt-4 flex justify-end">
        <button onClick={onClose} className="rounded px-4 py-2 text-muted hover:text-ink">{t.cancel}</button>
      </div>
      {linking && <ImportUrlDialog folderId={folder || null} onClose={() => setLinking(false)} />}
    </Modal>
  )
}
