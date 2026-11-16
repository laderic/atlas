import { useEffect, useMemo, useState } from 'react'
import type { MediaItem, MediaType } from '@shared/types'
import { tm } from '@/i18n/media'
import { formatSize, isCroppable, mediaUrl } from '@/lib/media'
import { norm } from '@/lib/mentions'
import { useMedia } from '@/store/media'
import { useUi } from '@/store/ui'
import { CropDialog } from './CropDialog'
import { ImportUrlDialog } from './ImportUrlDialog'
import { StockDialog } from './StockDialog'
import { MediaThumb } from './MediaThumb'

type FolderFilter = 'all' | 'none' | string
type TypeFilter = 'all' | MediaType

const TYPE_KEYS: TypeFilter[] = ['all', 'image', 'gif', 'video', 'audio']

function Preview({ item }: { item: MediaItem }): JSX.Element {
  const url = mediaUrl(item)
  if (item.type === 'video') return <video key={url} src={url} controls className="max-h-64 w-full rounded bg-black" />
  if (item.type === 'audio') return <audio key={url} src={url} controls className="w-full" />
  return <img key={url} src={url} alt={item.name} className="max-h-64 w-full rounded bg-black/30 object-contain" />
}

export function MediaLibrary(): JSX.Element {
  const { items, folders, importFiles, importFolder, importDropped, rename, move, remove, createFolder, renameFolder, removeFolder } = useMedia()
  const openNameDialog = useUi((s) => s.openNameDialog)
  const [folder, setFolder] = useState<FolderFilter>('all')
  const [type, setType] = useState<TypeFilter>('all')
  const [q, setQ] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [cropping, setCropping] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [linking, setLinking] = useState(false)
  const [stocking, setStocking] = useState(false)

  const selected = items.find((m) => m.id === selectedId) ?? null
  const [name, setName] = useState('')
  useEffect(() => setName(selected?.name ?? ''), [selected?.id, selected?.name])

  const visible = useMemo(() => {
    const nq = norm(q.trim())
    return items.filter(
      (m) =>
        (folder === 'all' || (folder === 'none' ? m.folder_id === null : m.folder_id === folder)) &&
        (type === 'all' || m.type === type) &&
        (!nq || norm(m.name).includes(nq))
    )
  }, [items, folder, type, q])

  const targetFolder = folder === 'all' || folder === 'none' ? null : folder
  const count = (pred: (m: MediaItem) => boolean): number => items.filter(pred).length

  const navBtn = (key: FolderFilter, label: string, n: number): JSX.Element => (
    <button
      onClick={() => setFolder(key)}
      aria-current={folder === key}
      className={`flex w-full items-center justify-between rounded px-3 py-1.5 text-left ${folder === key ? 'bg-raised text-ink' : 'text-muted hover:text-ink'}`}
    >
      <span className="truncate">{label}</span>
      <span className="text-xs">{n}</span>
    </button>
  )

  return (
    <div
      className="relative flex h-full"
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false) }}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        void importDropped(targetFolder, Array.from(e.dataTransfer.files))
      }}
    >
      {/* coleções */}
      <nav className="w-56 shrink-0 overflow-y-auto border-r border-line bg-panel p-3" aria-label={tm.collections}>
        {navBtn('all', tm.all, items.length)}
        {navBtn('none', tm.uncollected, count((m) => m.folder_id === null))}
        <div className="mb-1 mt-4 flex items-center justify-between px-3 text-muted">
          <span>{tm.collections}</span>
          <button
            aria-label={tm.newCollection}
            onClick={() => openNameDialog({ title: tm.newCollection, label: tm.collectionName, initial: '', submit: tm.newCollection, onSubmit: (v) => createFolder(v) })}
            className="text-lg leading-none hover:text-ink"
          >+</button>
        </div>
        {folders.map((f) => (
          <div key={f.id} className="group flex items-center">
            <div className="min-w-0 flex-1">{navBtn(f.id, f.name, count((m) => m.folder_id === f.id))}</div>
            <button
              aria-label={`${tm.renameCollection}: ${f.name}`}
              onClick={() => openNameDialog({ title: tm.renameCollection, label: tm.collectionName, initial: f.name, submit: tm.renameCollection, onSubmit: (v) => renameFolder(f.id, v) })}
              className="invisible px-1 text-muted hover:text-ink group-hover:visible"
            >✎</button>
            <button
              aria-label={`${f.name}: excluir`}
              onClick={() => {
                if (window.confirm(tm.confirmDeleteCollection(f.name))) {
                  removeFolder(f.id)
                  if (folder === f.id) setFolder('all')
                }
              }}
              className="invisible px-1 text-muted hover:text-danger group-hover:visible"
            >×</button>
          </div>
        ))}
      </nav>

      {/* grade */}
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3">
          <h1 className="mr-2 font-serif text-2xl">{tm.title}</h1>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tm.search}
            aria-label={tm.search}
            className="w-56 rounded border border-line bg-raised px-3 py-1.5"
          />
          <div role="group" className="flex gap-1">
            {TYPE_KEYS.map((k) => (
              <button
                key={k}
                aria-pressed={type === k}
                onClick={() => setType(k)}
                className={`rounded px-2.5 py-1 ${type === k ? 'bg-raised text-ink' : 'text-muted hover:text-ink'}`}
              >
                {tm.types[k]}
              </button>
            ))}
          </div>
          <span className="ml-auto flex gap-2">
            <button onClick={() => setStocking(true)} className="rounded border border-line px-3 py-1.5 hover:bg-raised">{tm.stockArt}</button>
            <button onClick={() => setLinking(true)} className="rounded border border-line px-3 py-1.5 hover:bg-raised">{tm.importLink}</button>
            <button onClick={() => importFolder()} title={tm.importFolderHint} className="rounded border border-line px-3 py-1.5 hover:bg-raised">{tm.importFolder}</button>
            <button onClick={() => importFiles(targetFolder)} className="rounded bg-accent px-3 py-1.5 font-medium text-accent-ink">{tm.importFiles}</button>
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {visible.length === 0 ? (
            <p className="mx-auto mt-16 max-w-sm text-center text-muted">{items.length === 0 ? tm.empty : tm.noResults}</p>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
              {visible.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedId(m.id)}
                  aria-pressed={m.id === selectedId}
                  title={m.name}
                  className={`group text-left ${m.id === selectedId ? 'outline outline-2 outline-accent' : ''} rounded`}
                >
                  <div className="aspect-square overflow-hidden rounded border border-line bg-panel">
                    <MediaThumb item={m} />
                  </div>
                  <div className="mt-1 truncate px-0.5 text-xs text-muted group-hover:text-ink">{m.name}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* detalhes */}
      {selected && (
        <aside className="w-80 shrink-0 overflow-y-auto border-l border-line bg-panel p-4">
          <Preview item={selected} />
          <label htmlFor="m-name" className="mb-1 mt-4 block text-muted">{tm.name}</label>
          <input
            id="m-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() && name !== selected.name ? rename(selected.id, name) : setName(selected.name)}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            className="w-full rounded border border-line bg-raised px-2.5 py-1.5"
          />
          <dl className="mt-4 grid grid-cols-2 gap-y-2 text-muted">
            <dt>{tm.kind}</dt><dd className="text-ink">{tm.typeLabel[selected.type]}</dd>
            <dt>{tm.size}</dt><dd className="text-ink">{formatSize(selected.size)}</dd>
          </dl>
          <label htmlFor="m-folder" className="mb-1 mt-4 block text-muted">{tm.collection}</label>
          <select
            id="m-folder"
            value={selected.folder_id ?? ''}
            onChange={(e) => move(selected.id, e.target.value || null)}
            className="w-full rounded border border-line bg-raised px-2.5 py-1.5"
          >
            <option value="">{tm.uncollected}</option>
            {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>

          <div className="mt-6 flex flex-col items-start gap-3">
            {isCroppable(selected) && (
              <button onClick={() => setCropping(true)} className="rounded border border-line px-3 py-1.5 hover:bg-raised">{tm.crop}</button>
            )}
            <button
              onClick={async () => {
                if (!window.confirm(tm.confirmDelete(selected.name))) return
                await remove(selected.id)
                setSelectedId(null)
              }}
              className="text-muted hover:text-danger"
            >
              {tm.delete}
            </button>
          </div>
        </aside>
      )}

      {stocking && <StockDialog onClose={() => setStocking(false)} />}
      {linking && <ImportUrlDialog folderId={targetFolder} onClose={() => setLinking(false)} />}

      {cropping && selected && <CropDialog item={selected} onClose={() => setCropping(false)} />}

      {dragging && (
        <div className="pointer-events-none absolute inset-3 z-30 flex items-center justify-center rounded-lg border-2 border-dashed border-accent bg-bg/80 font-serif text-2xl">
          {tm.drop}
        </div>
      )}
    </div>
  )
}
