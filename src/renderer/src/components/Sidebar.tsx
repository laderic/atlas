import { useRef, useState, type ReactNode } from 'react'
import {
  BookOpen, Clock, Download, FileText, Globe, Library, Map as MapIcon, Image as ImageIcon,
  Puzzle, Search, Shapes, Table2, X, Tag, LayoutGrid, Settings, Radio, CalendarDays
} from 'lucide-react'
import { t } from '@/i18n/pt-BR'
import { tu } from '@/i18n/ui'
import { tc } from '@/i18n/cards'
import { tk } from '@/i18n/canvas'
import { tm } from '@/i18n/media'
import { tq } from '@/i18n/quill'
import { ts } from '@/i18n/sheets'
import { ti } from '@/i18n/import'
import { tw } from '@/i18n/wiki'
import { tt } from '@/i18n/timelines'
import { tmap } from '@/i18n/maps'
import { tg } from '@/i18n/tags'
import { TagsBody, askNewTag } from '@/modules/tags/TagsPanel'
import { EventsBody, askNewEvent } from '@/modules/events/EventsPanel'
import { te } from '@/i18n/events'
import { CardsBody } from '@/modules/cards/CardsTree'
import { MapsBody } from '@/modules/maps/MapsList'
import { TimelinesBody } from '@/modules/timelines/TimelinesList'
import { CanvasesBody } from '@/modules/canvas/CanvasesList'
import { SheetsBody } from '@/modules/sheets/SheetsList'
import { QuillBody } from '@/modules/quill/QuillList'
import { askNewCanvas } from '@/store/canvas'
import { useCards } from '@/store/cards'
import { useMaps } from '@/store/maps'
import { useCanvases } from '@/store/canvas'
import { askNewBook, useQuill } from '@/store/quill'
import { askNewSheet, useSheets } from '@/store/sheets'
import { askNewTimeline, useTimelines } from '@/store/timelines'
import { PANEL_MAX, PANEL_MIN, useSidebar } from '@/store/sidebar'
import { useUi } from '@/store/ui'
import { useWorkspace } from '@/store/workspace'
import { SideAction, SideItem, EmptyNote } from './SidebarSection'

type IconType = typeof Globe

// ---------- Trilho de ícones ----------
function RailButton({ label, Icon, active, onClick }: { label: string; Icon: IconType; active: boolean; onClick: () => void }): JSX.Element {
  return (
    <div className="group relative">
      <button
        onClick={onClick}
        aria-label={label}
        aria-pressed={active}
        className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${active ? 'bg-raised text-ink' : 'text-muted hover:bg-raised hover:text-ink'}`}
      >
        <Icon size={19} strokeWidth={1.8} />
      </button>
      {/* dica ao passar o mouse */}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded border border-line bg-raised px-2.5 py-1 text-sm text-ink opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100"
      >
        {label}
      </span>
    </div>
  )
}

function Divider(): JSX.Element {
  return <div className="my-2 h-px w-7 bg-line" />
}

// ---------- Painel ----------
function Panel({ title, count, search, onSearch, actions, children }: {
  title: string; count?: number; search?: boolean; onSearch?: (q: string) => void; actions?: ReactNode; children: ReactNode
}): JSX.Element {
  const close = useSidebar((s) => s.close)
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex items-center gap-1 border-b border-line px-3 py-2.5">
        <h2 className="min-w-0 flex-1 truncate font-serif text-lg">
          {title}
          {count !== undefined && <span className="ml-2 font-sans text-xs text-muted">{count}</span>}
        </h2>
        <span className="flex shrink-0 items-center gap-0.5 text-xs text-muted">{actions}</span>
        <button onClick={close} aria-label={tu.closePanel} className="ml-1 rounded p-1 text-muted hover:bg-raised hover:text-ink">
          <X size={15} />
        </button>
      </div>
      {search && onSearch && (
        <div className="px-3 pb-2 pt-2.5">
          <div className="flex items-center gap-2 rounded border border-line bg-raised px-2.5 py-1.5 text-muted focus-within:border-muted">
            <Search size={14} />
            <input
              aria-label={tu.search}
              placeholder={tu.search}
              onChange={(e) => onSearch(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-muted/70"
            />
          </div>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">{children}</div>
    </div>
  )
}

export function Sidebar(): JSX.Element {
  const { worlds, activeWorldId, selectWorld, activeTabId, openTab } = useWorkspace()
  const ui = useUi()
  const active = useSidebar((s) => s.active)
  const toggle = useSidebar((s) => s.toggle)
  const width = useSidebar((s) => s.width)
  const setWidth = useSidebar((s) => s.setWidth)
  const cards = useCards((s) => s.cards)
  const openTypes = useCards((s) => s.openTypes)
  const createFolder = useCards((s) => s.createFolder)
  const maps = useMaps((s) => s.maps)
  const timelines = useTimelines((s) => s.list)
  const canvases = useCanvases((s) => s.list)
  const sheets = useSheets((s) => s.list)
  const books = useQuill((s) => s.books)
  const tags = useCards((s) => s.tags)
  const wid = activeWorldId
  const [q, setQ] = useState('')
  const drag = useRef<{ x: number; w: number } | null>(null)

  const panelOpen = active !== null
  const pick = (id: string): void => {
    setQ('')
    toggle(id)
  }

  const newFolder = (): void =>
    ui.openNameDialog({
      title: tc.newFolder, label: tc.folderName, initial: '', submit: tc.newFolder,
      onSubmit: (v) => createFolder(v, null)
    })

  // alça para redimensionar o painel
  const onResizeDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    drag.current = { x: e.clientX, w: width }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onResizeMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (!drag.current) return
    setWidth(drag.current.w + (e.clientX - drag.current.x))
  }
  const onResizeUp = (): void => {
    drag.current = null
  }

  const needsWorld = (body: ReactNode): ReactNode =>
    wid ? body : <EmptyNote>{tu.pickWorld}</EmptyNote>

  const renderPanel = (): ReactNode => {
    switch (active) {
      case 'mundos':
        return (
          <Panel title={t.worlds} count={worlds.length} actions={<SideAction label="+" title={t.newWorld} onClick={() => ui.setNewWorldOpen(true)} />}>
            {worlds.length === 0 && <EmptyNote>{tu.noWorlds}</EmptyNote>}
            {worlds.map((w) => (
              <SideItem key={w.id} active={w.id === wid} onClick={() => selectWorld(w.id)}>{w.name}</SideItem>
            ))}
          </Panel>
        )
      case 'cards':
        return (
          <Panel
            title={tc.cards}
            count={wid ? cards.length : undefined}
            search
            onSearch={setQ}
            actions={
              wid && (
                <>
                  <SideAction label={tc.types} onClick={openTypes} />
                  <SideAction label="+ pasta" title={tc.newFolder} onClick={newFolder} />
                  <SideAction label="+" title={tc.newCard} onClick={() => ui.openNewCard(null)} />
                </>
              )
            }
          >
            {needsWorld(<CardsBody q={q} />)}
          </Panel>
        )
      case 'mapas':
        return (
          <Panel title={tmap.maps} count={wid ? maps.length : undefined} search onSearch={setQ} actions={wid && <SideAction label="+" title={tmap.newMap} onClick={() => ui.setNewMapOpen(true)} />}>
            {needsWorld(<MapsBody q={q} />)}
          </Panel>
        )
      case 'linhas':
        return (
          <Panel title={tt.timelines} count={wid ? timelines.length : undefined} search onSearch={setQ} actions={wid && <SideAction label="+" title={tt.newTimeline} onClick={askNewTimeline} />}>
            {needsWorld(<TimelinesBody q={q} />)}
          </Panel>
        )
      case 'quadros':
        return (
          <Panel
            title={tk.canvases}
            count={wid ? canvases.length : undefined}
            search
            onSearch={setQ}
            actions={
              wid && (
                <>
                  <SideAction label={tk.relationTrees} title={tk.newRelationTree} onClick={() => askNewCanvas('relation_tree')} />
                  <SideAction label="+" title={tk.newCanvas} onClick={() => askNewCanvas('canvas')} />
                </>
              )
            }
          >
            {needsWorld(<CanvasesBody q={q} />)}
          </Panel>
        )
      case 'fichas':
        return (
          <Panel
            title={ts.sheets}
            count={wid ? sheets.length : undefined}
            search
            onSearch={setQ}
            actions={
              wid && (
                <>
                  <SideAction label={`+ ${ts.ficha}`} onClick={() => askNewSheet('ficha')} />
                  <SideAction label={`+ ${ts.table}`} onClick={() => askNewSheet('tabela')} />
                </>
              )
            }
          >
            {needsWorld(<SheetsBody q={q} />)}
          </Panel>
        )
      case 'eventos':
        return (
          <Panel title={te.events} count={wid ? cards.filter((c) => !!c.is_event).length : undefined} search onSearch={setQ} actions={wid && <SideAction label="+" title={te.newEvent} onClick={askNewEvent} />}>
            {needsWorld(<EventsBody q={q} />)}
          </Panel>
        )
      case 'tags':
        return (
          <Panel title={tg.tags} count={wid ? tags.length : undefined} search onSearch={setQ} actions={wid && <SideAction label="+" title={tg.newTag} onClick={askNewTag} />}>
            {needsWorld(<TagsBody q={q} />)}
          </Panel>
        )
      case 'livros':
        return (
          <Panel title={tq.books} count={wid ? books.length : undefined} search onSearch={setQ} actions={wid && <SideAction label="+" title={tq.newBook} onClick={askNewBook} />}>
            {needsWorld(<QuillBody q={q} />)}
          </Panel>
        )
      default:
        return null
    }
  }

  // Itens de navegação: abrem o painel da área.
  const AREAS: { id: string; label: string; Icon: IconType }[] = [
    { id: 'mundos', label: t.worlds, Icon: Globe },
    { id: 'cards', label: tc.cards, Icon: FileText },
    { id: 'mapas', label: tmap.maps, Icon: MapIcon },
    { id: 'linhas', label: tt.timelines, Icon: Clock },
    { id: 'quadros', label: tk.canvases, Icon: Shapes },
    { id: 'fichas', label: ts.sheets, Icon: Table2 },
    { id: 'livros', label: tq.books, Icon: BookOpen },
    { id: 'tags', label: tg.tags, Icon: Tag },
    { id: 'eventos', label: te.events, Icon: CalendarDays }
  ]

  return (
    <aside className="flex h-full shrink-0 border-r border-line bg-panel">
      {/* trilho de ícones */}
      <nav aria-label={tu.navigation} className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-line py-3">
        <button
          onClick={() => ui.setPaletteOpen(true)}
          aria-label={t.search}
          className="mb-1 flex h-10 w-10 items-center justify-center rounded-lg font-serif text-lg text-accent hover:bg-raised"
          title={tu.globalSearch}
        >
          A
        </button>
        <Divider />
        {AREAS.map((a) => (
          <RailButton key={a.id} label={a.label} Icon={a.Icon} active={active === a.id} onClick={() => pick(a.id)} />
        ))}
        <Divider />
        {wid && (
          <>
            <RailButton
              label={tu.radio}
              Icon={Radio}
              active={activeTabId === `radio:${wid}`}
              onClick={() => openTab({ id: `radio:${wid}`, worldId: wid, kind: 'radio', title: tu.radio })}
            />
            <RailButton
              label={tg.gallery}
              Icon={LayoutGrid}
              active={activeTabId === `gallery:${wid}`}
              onClick={() => openTab({ id: `gallery:${wid}`, worldId: wid, kind: 'gallery', title: tg.gallery })}
            />
            <RailButton
              label={tm.title}
              Icon={ImageIcon}
              active={activeTabId === `media:${wid}`}
              onClick={() => openTab({ id: `media:${wid}`, worldId: wid, kind: 'media', title: tm.nav })}
            />
            <RailButton
              label={tw.wiki}
              Icon={Library}
              active={activeTabId === `wiki:${wid}`}
              onClick={() => openTab({ id: `wiki:${wid}`, worldId: wid, kind: 'wiki', title: tw.wiki })}
            />
            <RailButton
              label={tu.workshop}
              Icon={Puzzle}
              active={activeTabId === `workshop:${wid}`}
              onClick={() => openTab({ id: `workshop:${wid}`, worldId: wid, kind: 'workshop', title: 'Oficina' })}
            />
            <RailButton label={tu.settings} Icon={Settings} active={false} onClick={() => ui.setSettingsOpen(true)} />
            <RailButton label={ti.title} Icon={Download} active={false} onClick={() => ui.setImportOpen(true)} />
          </>
        )}
      </nav>

      {/* painel da área escolhida */}
      {panelOpen && (
        <div className="relative flex min-w-0" style={{ width }}>
          {renderPanel()}
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label={tu.resize}
            aria-valuemin={PANEL_MIN}
            aria-valuemax={PANEL_MAX}
            aria-valuenow={width}
            onPointerDown={onResizeDown}
            onPointerMove={onResizeMove}
            onPointerUp={onResizeUp}
            onPointerCancel={onResizeUp}
            className="absolute inset-y-0 -right-1 z-10 w-2 cursor-col-resize hover:bg-accent/40"
          />
        </div>
      )}
    </aside>
  )
}
