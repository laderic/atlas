import { useCards } from '@/store/cards'
import { useEffect, useState } from 'react'
import { tm } from '@/i18n/media'
import { mediaUrl } from '@/lib/media'
import { useMedia } from '@/store/media'
import { MediaPicker } from '../media/MediaPicker'
import type { GraphData, World, WorldStats } from '@shared/types'
import { t } from '@/i18n/pt-BR'
import { useWorkspace } from '@/store/workspace'
import { WorldGraph } from './WorldGraph'
import { Highlights } from './Highlights'

type HomeLayout = { order: string[]; hidden: string[] }
const HOME_IDS = ['destaques', 'numeros']
const HOME_LABEL: Record<string, string> = { destaques: 'Destaques', numeros: 'Números' }
const layoutKey = (worldId: string): string => `atlas.home.layout.${worldId}`

function loadLayout(worldId: string): HomeLayout {
  try {
    const saved = JSON.parse(localStorage.getItem(layoutKey(worldId)) ?? 'null') as HomeLayout | null
    if (saved && Array.isArray(saved.order)) {
      const order = [...saved.order.filter((id) => HOME_IDS.includes(id)), ...HOME_IDS.filter((id) => !saved.order.includes(id))]
      return { order, hidden: (saved.hidden ?? []).filter((id) => HOME_IDS.includes(id)) }
    }
  } catch {
    /* sem layout salvo */
  }
  return { order: [...HOME_IDS], hidden: [] }
}

function saveLayout(worldId: string, l: HomeLayout): void {
  localStorage.setItem(layoutKey(worldId), JSON.stringify(l))
}

export function WorldHome({ world }: { world: World }): JSX.Element {
  const { updateWorld, removeWorld } = useWorkspace()
  const openCard = useCards((s) => s.openCard)
  const [graph, setGraph] = useState<GraphData>({ nodes: [], links: [] })
  const [stats, setStats] = useState<WorldStats | null>(null)
  const [name, setName] = useState(world.name)
  const [desc, setDesc] = useState(world.description ?? '')
  const [picking, setPicking] = useState(false)
  const [layout, setLayout] = useState<HomeLayout>(() => loadLayout(world.id))
  const [editMode, setEditMode] = useState(false)
  const changeLayout = (next: HomeLayout): void => {
    setLayout(next)
    saveLayout(world.id, next)
  }
  const moveSection = (id: string, d: -1 | 1): void => {
    const i = layout.order.indexOf(id)
    const j = i + d
    if (j < 0 || j >= layout.order.length) return
    const order = [...layout.order]
    ;[order[i], order[j]] = [order[j], order[i]]
    changeLayout({ ...layout, order })
  }
  const hideSection = (id: string): void => changeLayout({ ...layout, hidden: [...layout.hidden, id] })
  const showSection = (id: string): void => changeLayout({ ...layout, hidden: layout.hidden.filter((x) => x !== id) })
  const cover = useMedia((s) => s.items.find((m) => m.id === world.cover_media_id) ?? null)

  useEffect(() => {
    setName(world.name)
    setDesc(world.description ?? '')
    window.api.worlds.graph(world.id).then(setGraph)
    window.api.worlds.stats(world.id).then(setStats)
  }, [world.id, world.name, world.description])

  const commitName = (): void => {
    if (name.trim() && name !== world.name) updateWorld(world.id, { name })
    else setName(world.name)
  }
  const commitDesc = (): void => {
    if (desc !== (world.description ?? '')) updateWorld(world.id, { description: desc.trim() || null })
  }
  const onRemove = (): void => {
    if (window.confirm(t.confirmRemove(world.name))) removeWorld(world.id)
  }

  return (
    <div className="relative h-full overflow-hidden">
      {cover && (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center opacity-25"
          style={{ backgroundImage: `url("${mediaUrl(cover)}")` }}
        />
      )}
      <WorldGraph data={graph} onOpenCard={openCard} />
      {graph.nodes.length === 0 && (
        <p className="absolute bottom-8 right-8 max-w-xs text-right text-muted">{t.graphEmpty}</p>
      )}

      <div className="relative z-10 flex h-full max-w-2xl flex-col px-10 py-10">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          aria-label={t.rename}
          className="w-full bg-transparent font-serif text-5xl leading-tight outline-none"
        />
        <textarea
          value={desc}
          rows={3}
          placeholder={t.noDescription}
          onChange={(e) => setDesc(e.target.value)}
          onBlur={commitDesc}
          className="mt-3 w-full max-w-xl resize-none bg-transparent leading-relaxed text-muted outline-none placeholder:text-muted/50"
        />

        <button onClick={() => setEditMode(!editMode)} className="mt-3 self-start text-xs text-muted hover:text-ink">
          {editMode ? 'Concluir' : 'Organizar página'}
        </button>
        {layout.order.filter((id) => !layout.hidden.includes(id)).map((id, i, arr) => (
          <div key={id} className={`relative ${editMode ? 'mt-3 rounded border border-dashed border-line p-2' : ''}`}>
            {editMode && (
              <div className="mb-1 flex items-center gap-2 text-xs text-muted">
                <span className="mr-auto">{HOME_LABEL[id]}</span>
                <button aria-label="Subir" disabled={i === 0} onClick={() => moveSection(id, -1)} className="px-1 disabled:opacity-30">↑</button>
                <button aria-label="Descer" disabled={i === arr.length - 1} onClick={() => moveSection(id, 1)} className="px-1 disabled:opacity-30">↓</button>
                <button onClick={() => hideSection(id)} className="hover:text-danger">Ocultar</button>
              </div>
            )}
            {id === 'destaques' ? (
              <Highlights worldId={world.id} />
            ) : (
              stats && (
                <dl className="mt-8 grid max-w-md grid-cols-3 gap-x-6 gap-y-4">
                  {(Object.keys(t.stats) as (keyof WorldStats)[]).map((k) => (
                    <div key={k}>
                      <dd className="font-serif text-2xl">{stats[k]}</dd>
                      <dt className="text-muted">{t.stats[k]}</dt>
                    </div>
                  ))}
                </dl>
              )
            )}
          </div>
        ))}
        {editMode && layout.hidden.length > 0 && (
          <div className="mt-3 flex gap-3 text-xs text-muted">
            Ocultos:
            {layout.hidden.map((id) => (
              <button key={id} onClick={() => showSection(id)} className="underline hover:text-ink">{HOME_LABEL[id]}</button>
            ))}
          </div>
        )}
        <div className="mt-auto flex items-center gap-5">
          <button onClick={() => setPicking(true)} className="text-muted hover:text-ink">{tm.chooseCover}</button>
          {cover && (
            <button onClick={() => updateWorld(world.id, { cover_media_id: null })} className="text-muted hover:text-ink">{tm.removeCover}</button>
          )}
          <button onClick={onRemove} className="ml-auto text-muted hover:text-danger">{t.remove}</button>
        </div>
      </div>
      {picking && (
        <MediaPicker
          title={tm.chooseCover}
          onClose={() => setPicking(false)}
          onPick={(m) => updateWorld(world.id, { cover_media_id: m.id })}
        />
      )}
    </div>
  )
}
