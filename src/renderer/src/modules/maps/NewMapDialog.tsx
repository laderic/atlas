import { useEffect, useState } from 'react'
import type { MediaItem } from '@shared/types'
import { Modal } from '@/components/Modal'
import { t } from '@/i18n/pt-BR'
import { tmap } from '@/i18n/maps'
import { mediaUrl } from '@/lib/media'
import { useMaps } from '@/store/maps'
import { useUi } from '@/store/ui'
import { MediaPicker } from '../media/MediaPicker'

function readSize(item: MediaItem): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => resolve(null)
    img.src = mediaUrl(item)
  })
}

export function NewMapDialog(): JSX.Element | null {
  const open = useUi((s) => s.newMapOpen)
  const setOpen = useUi((s) => s.setNewMapOpen)
  const createMap = useMaps((s) => s.createMap)
  const [name, setName] = useState('')
  const [image, setImage] = useState<MediaItem | null>(null)
  const [picking, setPicking] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setName('')
      setImage(null)
      setBusy(false)
    }
  }, [open])

  if (!open) return null
  const close = (): void => setOpen(false)

  const submit = async (): Promise<void> => {
    if (!image || busy) return
    setBusy(true)
    const size = await readSize(image)
    await createMap({ name: name || image.name, image_id: image.id, width: size?.width ?? null, height: size?.height ?? null })
    close()
  }

  return (
    <Modal title={tmap.newMap} onClose={close}>
      <label htmlFor="nm-name" className="mb-1 block text-muted">{tmap.mapName}</label>
      <input
        id="nm-name"
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        className="mb-4 w-full rounded border border-line bg-raised px-3 py-2"
      />
      <span className="mb-1 block text-muted">{tmap.mapImage}</span>
      {image ? (
        <div className="mb-5">
          <img src={mediaUrl(image)} alt={image.name} className="mb-2 max-h-44 w-full rounded border border-line object-cover" />
          <button onClick={() => setPicking(true)} className="text-accent hover:underline">{tmap.changeImage}</button>
        </div>
      ) : (
        <button
          onClick={() => setPicking(true)}
          className="mb-5 flex h-24 w-full flex-col items-center justify-center gap-1 rounded border border-dashed border-line text-muted hover:border-accent hover:text-ink"
        >
          <span>+ {tmap.chooseImage}</span>
          <span className="text-xs">{tmap.noImageYet}</span>
        </button>
      )}
      <div className="flex justify-end gap-2">
        <button onClick={close} className="rounded px-4 py-2 text-muted hover:text-ink">{t.cancel}</button>
        <button onClick={submit} disabled={!image || busy} className="rounded bg-accent px-4 py-2 font-medium text-accent-ink disabled:opacity-40">
          {tmap.create}
        </button>
      </div>
      {picking && <MediaPicker title={tmap.chooseImage} kinds={['image']} onPick={setImage} onClose={() => setPicking(false)} />}
    </Modal>
  )
}
