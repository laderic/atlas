import { runUndo, undoCount } from './lib/undo'
import { useEffect } from 'react'
import { Sidebar } from './components/Sidebar'
import { TabBar } from './components/TabBar'
import { CommandPalette } from './components/CommandPalette'
import { NewWorldDialog } from './components/NewWorldDialog'
import { Toast } from './components/Toast'
import { NameDialog } from './components/NameDialog'
import { NewCardDialog } from './modules/cards/NewCardDialog'
import { CardView } from './modules/cards/CardView'
import { TypesManager } from './modules/cards/TypesManager'
import { MediaLibrary } from './modules/media/MediaLibrary'
import { MapView } from './modules/maps/MapView'
import { TimelineView } from './modules/timelines/TimelineView'
import { CanvasView } from './modules/canvas/CanvasView'
import { SheetView } from './modules/sheets/SheetView'
import { QuillView } from './modules/quill/QuillView'
import { WikiView } from './modules/wiki/WikiView'
import { ImportDialog } from './modules/import/ImportDialog'
import { WorkshopView } from './modules/workshop/WorkshopView'
import { SettingsDialog } from './components/SettingsDialog'
import { applyTheme, getAppTheme } from './lib/theme'
import { RadioView } from './modules/radio/RadioView'
import { GalleryView } from './modules/gallery/GalleryView'
import { TagView } from './modules/tags/TagView'
import { NewMapDialog } from './modules/maps/NewMapDialog'
import { WorldHome } from './modules/worlds/WorldHome'
import { t } from './i18n/pt-BR'
import { useUi } from './store/ui'
import { useCards } from './store/cards'
import { useMaps } from './store/maps'
import { useTimelines } from './store/timelines'
import { useCanvases } from './store/canvas'
import { useSheets } from './store/sheets'
import { useQuill } from './store/quill'
import { useMedia } from './store/media'
import { useWorkspace } from './store/workspace'

export default function App(): JSX.Element {
  const { worlds, loaded, tabs, activeTabId, activeWorldId, dataVersion, load } = useWorkspace()
  const activeTheme = worlds.find((w) => w.id === activeWorldId)?.theme

  // Ctrl+Z desfaz a última exclusão. Dentro de campos de texto, o Ctrl+Z é do texto.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.key.toLowerCase() !== 'z') return
      const el = e.target as HTMLElement
      if (el.closest('input, textarea, [contenteditable="true"], .ProseMirror')) return
      if (undoCount() === 0) return
      e.preventDefault()
      void runUndo().then((label) => {
        if (label) useUi.getState().showToast(`Restaurado: "${label}"`)
      })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  useEffect(() => {
    applyTheme(getAppTheme())
  }, [activeTheme])
  const loadCards = useCards((s) => s.load)
  const loadMedia = useMedia((s) => s.load)
  const loadMaps = useMaps((s) => s.load)
  const loadTimelines = useTimelines((s) => s.load)
  const loadCanvases = useCanvases((s) => s.load)
  const loadSheets = useSheets((s) => s.load)
  const loadQuill = useQuill((s) => s.load)
  const { setNewWorldOpen, setPaletteOpen, showToast } = useUi()
  const focusMode = useUi((s) => s.focusMode)
  const importOpen = useUi((s) => s.importOpen)
  const setImportOpen = useUi((s) => s.setImportOpen)

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (activeWorldId) {
      loadCards(activeWorldId)
      loadMedia(activeWorldId)
      loadMaps(activeWorldId)
      loadTimelines(activeWorldId)
      loadCanvases(activeWorldId)
      loadSheets(activeWorldId)
      loadQuill(activeWorldId)
    }
  }, [activeWorldId, dataVersion, loadCards, loadMedia, loadMaps, loadTimelines, loadCanvases, loadSheets, loadQuill])

  useEffect(
    () =>
      window.api.onMenu(async (action) => {
        if (action === 'novo-mundo') setNewWorldOpen(true)
        if (action === 'paleta') setPaletteOpen(true)
        if (action === 'exportar') {
          const r = await window.api.backup.exportAll()
          if (r.ok) showToast(t.exported)
          else if (r.message) showToast(`${t.exportFail}: ${r.message}`)
        }
        if (action === 'importar') {
          const r = await window.api.backup.importAll()
          if (r.ok) {
            await load()
            showToast(t.imported)
          } else if (r.message) showToast(`${t.importFail}: ${r.message}`)
        }
      }),
    [load, setNewWorldOpen, setPaletteOpen, showToast]
  )

  const tab = tabs.find((x) => x.id === activeTabId)
  const world = worlds.find((w) => w.id === tab?.worldId)

  return (
    <div className="flex h-full">
      {!focusMode && <Sidebar />}
      <main className="flex min-w-0 flex-1 flex-col">
        {loaded && worlds.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-10 text-center">
            <h1 className="mb-3 font-serif text-4xl">{t.emptyTitle}</h1>
            <p className="mb-6 max-w-md text-muted">{t.emptyBody}</p>
            <button onClick={() => setNewWorldOpen(true)} className="rounded bg-accent px-5 py-2.5 font-medium text-accent-ink">
              {t.newWorld}
            </button>
          </div>
        ) : (
          <>
            {!focusMode && <TabBar />}
            <div className="min-h-0 flex-1">
              {tab?.kind === 'home' && world && <WorldHome world={world} />}
              {tab?.kind === 'card' && tab.refId && <CardView key={tab.refId} cardId={tab.refId} />}
              {tab?.kind === 'types' && <TypesManager key={tab.id} />}
              {tab?.kind === 'media' && <MediaLibrary key={tab.id} />}
              {tab?.kind === 'map' && tab.refId && <MapView key={tab.refId} mapId={tab.refId} />}
              {tab?.kind === 'timeline' && tab.refId && <TimelineView key={tab.refId} timelineId={tab.refId} />}
              {tab?.kind === 'canvas' && tab.refId && <CanvasView key={tab.refId} canvasId={tab.refId} />}
              {tab?.kind === 'sheet' && tab.refId && <SheetView key={tab.refId} sheetId={tab.refId} />}
              {tab?.kind === 'quill' && tab.refId && <QuillView key={tab.refId} bookId={tab.refId} />}
              {tab?.kind === 'wiki' && world && <WikiView key={tab.id} worldId={world.id} />}
              {tab?.kind === 'workshop' && <WorkshopView key={tab.id} />}
              {tab?.kind === 'gallery' && <GalleryView key={tab.id} />}
              {tab?.kind === 'radio' && <RadioView key={tab.id} />}
              {tab?.kind === 'tag' && tab.refId && <TagView key={tab.refId} tagId={tab.refId} />}
            </div>
          </>
        )}
      </main>
      <NewWorldDialog />
      <NewCardDialog />
      <NameDialog />
      <NewMapDialog />
      <SettingsDialog />
      {importOpen && <ImportDialog onClose={() => setImportOpen(false)} />}
      <CommandPalette />
      <Toast />
    </div>
  )
}
