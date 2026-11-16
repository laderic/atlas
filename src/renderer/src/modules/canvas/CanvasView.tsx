import { useEffect, useRef, useState } from 'react'
import type {
  MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent
} from 'react'
import type { CanvasDetail, CanvasElement, CanvasNodeData, CanvasSummary, Viewport } from '@shared/types'
import { tk } from '@/i18n/canvas'
import { mediaUrl } from '@/lib/media'
import { useCards } from '@/store/cards'
import { useMedia } from '@/store/media'
import { useUi } from '@/store/ui'
import { MediaPicker } from '@/modules/media/MediaPicker'
import { CanvasInspector } from './CanvasInspector'
import { CardPicker } from './CardPicker'

type Tool = 'select' | 'note' | 'card' | 'image' | 'shape' | 'connect'
type Pt = [number, number]
type Gesture =
  | { kind: 'pan'; sx: number; sy: number; vx: number; vy: number }
  | { kind: 'drag'; id: string; start: Pt; ox: number; oy: number; moved: boolean; x: number; y: number }

const NODE_SIZE = { card: [200, 72], note: [220, 150], image: [220, 160], shape: [170, 100] } as const
const MIN_S = 0.05
const MAX_S = 6
const TOOLS: Tool[] = ['select', 'note', 'card', 'image', 'shape', 'connect']
const TREE_TOOLS: Tool[] = ['select', 'card', 'connect']
const KEYS: Record<string, Tool> = { v: 'select', n: 'note', c: 'card', i: 'image', s: 'shape', l: 'connect' }
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))

function sizeOf(el: CanvasElement): Pt {
  if (el.kind === 'edge') return [0, 0]
  const d = NODE_SIZE[el.kind]
  return [el.data.w ?? d[0], el.data.h ?? d[1]]
}
const centerOf = (el: CanvasElement): Pt => {
  const [w, h] = sizeOf(el)
  return [el.data.x + w / 2, el.data.y + h / 2]
}
/** Ponto de borda de uma caixa centrada em c, na direção de t. */
function exitPoint(c: Pt, w: number, h: number, t: Pt): Pt {
  const dx = t[0] - c[0]
  const dy = t[1] - c[1]
  if (dx === 0 && dy === 0) return c
  const tx = dx !== 0 ? w / 2 / Math.abs(dx) : Infinity
  const ty = dy !== 0 ? h / 2 / Math.abs(dy) : Infinity
  const k = Math.min(tx, ty, 1)
  return [c[0] + dx * k, c[1] + dy * k]
}

export function CanvasView({ canvasId }: { canvasId: string }): JSX.Element {
  const cards = useCards((s) => s.cards)
  const types = useCards((s) => s.types)
  const openCard = useCards((s) => s.openCard)
  const mediaItems = useMedia((s) => s.items)
  const showToast = useUi((s) => s.showToast)

  const [meta, setMeta] = useState<CanvasSummary | null>(null)
  const [els, setEls] = useState<CanvasElement[]>([])
  const [view, setView] = useState<Viewport>({ s: 1, x: 0, y: 0 })
  const [tool, setTool] = useState<Tool>('select')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [connectFrom, setConnectFrom] = useState<string | null>(null)
  const [cursor, setCursor] = useState<Pt | null>(null)
  const [pickingCard, setPickingCard] = useState<Pt | null>(null)
  const [pickingImage, setPickingImage] = useState<Pt | null>(null)

  const vpRef = useRef<HTMLDivElement>(null)
  const gesture = useRef<Gesture | null>(null)
  const spaceDown = useRef(false)
  const loaded = useRef(false)

  const isTree = meta?.kind === 'relation_tree'
  const tools = isTree ? TREE_TOOLS : TOOLS

  const toImg = (cx: number, cy: number): Pt => {
    const r = vpRef.current!.getBoundingClientRect()
    return [(cx - r.left - view.x) / view.s, (cy - r.top - view.y) / view.s]
  }
  const vpSize = (): { w: number; h: number } => {
    const r = vpRef.current!.getBoundingClientRect()
    return { w: r.width, h: r.height }
  }
  const zoomAt = (mx: number, my: number, factor: number): void =>
    setView((v) => {
      const s = clamp(v.s * factor, MIN_S, MAX_S)
      const k = s / v.s
      return { s, x: mx - (mx - v.x) * k, y: my - (my - v.y) * k }
    })
  const zoomCenter = (factor: number): void => {
    const v = vpSize()
    zoomAt(v.w / 2, v.h / 2, factor)
  }
  const fitAll = (): void => {
    if (!vpRef.current) return
    const v = vpSize()
    if (els.length === 0) {
      setView({ s: 1, x: v.w / 2, y: v.h / 2 })
      return
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const e of els) {
      if (e.kind === 'edge') continue
      const [w, h] = sizeOf(e)
      minX = Math.min(minX, e.data.x); minY = Math.min(minY, e.data.y)
      maxX = Math.max(maxX, e.data.x + w); maxY = Math.max(maxY, e.data.y + h)
    }
    if (!isFinite(minX)) return
    const bw = Math.max(maxX - minX, 1)
    const bh = Math.max(maxY - minY, 1)
    const s = clamp(Math.min(v.w / (bw + 80), v.h / (bh + 80)), MIN_S, 2)
    setView({ s, x: v.w / 2 - ((minX + maxX) / 2) * s, y: v.h / 2 - ((minY + maxY) / 2) * s })
  }

  const reloadEls = async (): Promise<void> => {
    const d = await window.api.canvas.get(canvasId)
    setEls(d.elements)
  }

  // ---------- carregamento ----------
  useEffect(() => {
    let alive = true
    window.api.canvas.get(canvasId).then(async (d: CanvasDetail) => {
      if (!alive) return
      setMeta(d.canvas)
      setEls(d.elements)
      if (d.canvas.kind === 'relation_tree') {
        await window.api.canvas.syncRelations(canvasId)
        const d2 = await window.api.canvas.get(canvasId)
        if (alive) setEls(d2.elements)
      }
      if (!alive) return
      const r = vpRef.current?.getBoundingClientRect()
      if (d.viewport && d.viewport.s) setView(d.viewport)
      else if (r) setView({ s: 1, x: r.width / 2, y: r.height / 2 })
      loaded.current = true
    })
    return () => {
      alive = false
    }
  }, [canvasId])

  // salva a posição da visão (com atraso, para não gravar a cada movimento)
  useEffect(() => {
    if (!loaded.current) return
    const t = window.setTimeout(() => void window.api.canvas.saveViewport(canvasId, view), 400)
    return () => window.clearTimeout(t)
  }, [view, canvasId])

  // ---------- operações ----------
  const patchData = (id: string, p: Partial<CanvasNodeData>): void => {
    const cur = els.find((e) => e.id === id)
    if (!cur) return
    const data = { ...cur.data, ...p }
    setEls((es) => es.map((e) => (e.id === id ? { ...e, data } : e)))
    void window.api.elements.update(id, { data })
  }

  const addNode = async (kind: 'note' | 'shape', p: Pt): Promise<void> => {
    const [w, h] = NODE_SIZE[kind]
    const base = { x: p[0] - w / 2, y: p[1] - h / 2 }
    const data: CanvasNodeData = kind === 'note'
      ? { ...base, text: '', color: '#21253a' }
      : { ...base, shape: 'rect', color: '#7fb7a4', label: '' }
    const el = await window.api.elements.create(canvasId, { kind, data })
    setEls((es) => [...es, el])
    setSelectedId(el.id)
    if (kind === 'note') setEditingId(el.id)
    setTool('select')
  }

  const addCard = async (cardId: string, p: Pt): Promise<void> => {
    setPickingCard(null)
    const [w, h] = NODE_SIZE.card
    const el = await window.api.elements.create(canvasId, {
      kind: 'card', card_id: cardId, data: { x: p[0] - w / 2, y: p[1] - h / 2 }
    })
    setEls((es) => [...es, el])
    setSelectedId(el.id)
    if (isTree) {
      await window.api.canvas.syncRelations(canvasId)
      await reloadEls()
    }
  }

  const addImage = async (mediaId: string, p: Pt): Promise<void> => {
    setPickingImage(null)
    const [w, h] = NODE_SIZE.image
    const el = await window.api.elements.create(canvasId, {
      kind: 'image', media_id: mediaId, data: { x: p[0] - w / 2, y: p[1] - h / 2 }
    })
    setEls((es) => [...es, el])
    setSelectedId(el.id)
    setTool('select')
  }

  const createLink = async (from: string, to: string): Promise<void> => {
    if (isTree) {
      const edge = await window.api.relations.create(canvasId, from, to, tk.defaultRelation)
      setEls((es) => (es.some((e) => e.id === edge.id) ? es : [...es, edge]))
    } else {
      const edge = await window.api.elements.create(canvasId, { kind: 'edge', data: { x: 0, y: 0, from, to, label: '' } })
      setEls((es) => [...es, edge])
    }
  }

  const removeSelected = async (): Promise<void> => {
    const el = els.find((e) => e.id === selectedId)
    if (!el) return
    if (el.kind === 'edge') {
      if (isTree && !window.confirm(tk.confirmRemoveRelation)) return
      await window.api.elements.remove(el.id)
      setEls((es) => es.filter((e) => e.id !== el.id))
    } else {
      // remove o nó e as ligações visuais dele, mas mantém as relações entre cards
      await window.api.elements.removeNode(el.id)
      setEls((es) => es.filter((e) => !(e.id === el.id || (e.kind === 'edge' && (e.data.from === el.id || e.data.to === el.id)))))
    }
    setSelectedId(null)
  }

  // Organiza os cards em níveis a partir do card selecionado (ou do primeiro).
  const layoutTree = async (): Promise<void> => {
    const nodes = els.filter((e) => e.kind === 'card')
    if (nodes.length === 0) return
    const root = nodes.find((n) => n.id === selectedId) ?? nodes[0]
    const adj = new Map<string, string[]>()
    for (const e of els) {
      if (e.kind !== 'edge' || !e.data.from || !e.data.to) continue
      adj.set(e.data.from, [...(adj.get(e.data.from) ?? []), e.data.to])
      adj.set(e.data.to, [...(adj.get(e.data.to) ?? []), e.data.from])
    }
    const depth = new Map<string, number>([[root.id, 0]])
    const queue = [root.id]
    while (queue.length) {
      const id = queue.shift()!
      for (const n of adj.get(id) ?? []) {
        if (!depth.has(n)) {
          depth.set(n, depth.get(id)! + 1)
          queue.push(n)
        }
      }
    }
    const maxD = Math.max(...depth.values())
    for (const n of nodes) if (!depth.has(n.id)) depth.set(n.id, maxD + 1)

    const rows = new Map<number, CanvasElement[]>()
    for (const n of nodes) {
      const d = depth.get(n.id)!
      rows.set(d, [...(rows.get(d) ?? []), n])
    }
    const [rx, ry] = centerOf(root)
    const GAP_X = 240
    const GAP_Y = 150
    const moves = new Map<string, Pt>()
    for (const [d, row] of rows) {
      const total = (row.length - 1) * GAP_X
      row.forEach((n, i) => {
        const cx = rx - total / 2 + i * GAP_X
        const cy = ry + d * GAP_Y
        moves.set(n.id, [cx - NODE_SIZE.card[0] / 2, cy - NODE_SIZE.card[1] / 2])
      })
    }
    setEls((es) => es.map((e) => (moves.has(e.id) ? { ...e, data: { ...e.data, x: moves.get(e.id)![0], y: moves.get(e.id)![1] } } : e)))
    await window.api.elements.moveMany([...moves].map(([id, [x, y]]) => ({ id, x, y })))
  }

  const setToolSafe = (t: Tool): void => {
    setConnectFrom(null)
    setCursor(null)
    setTool(t)
  }

  // ---------- ponteiro ----------
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    const target = e.target as Element
    if (target.closest('textarea,input,select')) return
    const fid = target.closest?.('[data-eid]')?.getAttribute('data-eid') ?? null
    const el = fid ? els.find((x) => x.id === fid) ?? null : null
    const [x, y] = toImg(e.clientX, e.clientY)

    if (e.button === 1 || (e.button === 0 && spaceDown.current)) {
      e.preventDefault()
      gesture.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y }
      return
    }
    if (e.button !== 0) return

    if (tool === 'connect') {
      if (!el || el.kind === 'edge') {
        setConnectFrom(null)
        return
      }
      if (!connectFrom) setConnectFrom(el.id)
      else if (el.id !== connectFrom) {
        const from = connectFrom
        setConnectFrom(null)
        setCursor(null)
        void createLink(from, el.id).catch((err: Error) => showToast(err.message))
      }
      return
    }

    if (tool === 'select') {
      if (el) {
        setSelectedId(el.id)
        if (el.kind !== 'edge') {
          gesture.current = { kind: 'drag', id: el.id, start: [x, y], ox: el.data.x, oy: el.data.y, moved: false, x: el.data.x, y: el.data.y }
        }
      } else {
        setSelectedId(null)
        setEditingId(null)
        e.currentTarget.setPointerCapture(e.pointerId)
        gesture.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y }
      }
      return
    }

    if (el) return // clicar em um item existente não cria nada
    if (tool === 'note' || tool === 'shape') void addNode(tool, [x, y])
    else if (tool === 'card') setPickingCard([x, y])
    else if (tool === 'image') setPickingImage([x, y])
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>): void => {
    const g = gesture.current
    if (g?.kind === 'pan') {
      const dx = e.clientX - g.sx
      const dy = e.clientY - g.sy
      setView((v) => ({ ...v, x: g.vx + dx, y: g.vy + dy }))
      return
    }
    if (g?.kind === 'drag') {
      const [x, y] = toImg(e.clientX, e.clientY)
      const dx = x - g.start[0]
      const dy = y - g.start[1]
      if (!g.moved && Math.hypot(dx, dy) * view.s < 3) return
      g.moved = true
      g.x = g.ox + dx
      g.y = g.oy + dy
      const { id, x: nx, y: ny } = g
      setEls((es) => es.map((el) => (el.id === id ? { ...el, data: { ...el.data, x: nx, y: ny } } : el)))
      return
    }
    if (connectFrom) setCursor(toImg(e.clientX, e.clientY))
  }

  const endGesture = (): void => {
    const g = gesture.current
    gesture.current = null
    if (g?.kind === 'drag' && g.moved) void window.api.elements.moveMany([{ id: g.id, x: g.x, y: g.y }])
  }

  const onWheel = (e: ReactWheelEvent<HTMLDivElement>): void => {
    const r = vpRef.current!.getBoundingClientRect()
    zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.15 : 1 / 1.15)
  }

  const onDoubleClick = (e: ReactMouseEvent<HTMLDivElement>): void => {
    if ((e.target as Element).closest?.('textarea')) return
    const fid = (e.target as Element).closest?.('[data-eid]')?.getAttribute('data-eid')
    if (!fid) return
    const el = els.find((x) => x.id === fid)
    if (el?.kind === 'card' && el.card_id) openCard(el.card_id)
  }

  // ---------- teclado ----------
  useEffect(() => {
    const isTyping = (t: EventTarget | null): boolean =>
      t instanceof HTMLElement && t.closest('input,textarea,select,[contenteditable="true"]') !== null
    const onDown = (e: KeyboardEvent): void => {
      if (isTyping(e.target)) return
      if (e.code === 'Space') {
        spaceDown.current = true
        e.preventDefault()
        return
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === 'Escape') {
        if (connectFrom) setConnectFrom(null)
        else if (editingId) setEditingId(null)
        else setToolSafe('select')
        return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault()
        void removeSelected()
        return
      }
      const next = KEYS[e.key.toLowerCase()]
      if (next && tools.includes(next)) setToolSafe(next)
    }
    const onUp = (e: KeyboardEvent): void => {
      if (e.code === 'Space') spaceDown.current = false
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  })

  // ---------- render ----------
  if (!meta) return <div className="p-10 text-muted">…</div>

  const nodes = els.filter((e) => e.kind !== 'edge')
  const nodeById = new Map<string, CanvasElement>(nodes.map((e) => [e.id, e] as [string, CanvasElement]))
  const edges = els.filter((e) => e.kind === 'edge')
  const selected = els.find((e) => e.id === selectedId) ?? null
  const cardIdsOnCanvas = new Set<string>(nodes.flatMap((n) => (n.card_id ? [n.card_id] : [])))
  const typeColor = (typeId: string | null | undefined): string => types.find((t) => t.id === typeId)?.color ?? '#9a9cab'
  const cardRow = (id: string | null) => cards.find((c) => c.id === id) ?? null

  const renderNode = (el: CanvasElement): JSX.Element => {
    const [w, h] = sizeOf(el)
    const sel = el.id === selectedId
    const box = `absolute overflow-hidden rounded-lg border select-none ${sel ? 'border-accent ring-2 ring-accent/40' : 'border-line'}`
    const style = { left: el.data.x, top: el.data.y, width: w, height: h }
    const cursorCls = tool === 'select' ? 'cursor-move' : 'cursor-pointer'

    if (el.kind === 'card') {
      const c = cardRow(el.card_id)
      return (
        <div key={el.id} data-eid={el.id} className={`${box} ${cursorCls} bg-panel px-3 py-2`} style={{ ...style, borderLeft: `4px solid ${typeColor(c?.type_id)}` }}>
          <div className="truncate font-medium">{c?.title ?? '—'}</div>
          <div className="truncate text-xs text-muted">{types.find((t) => t.id === c?.type_id)?.name ?? ''}</div>
        </div>
      )
    }
    if (el.kind === 'note') {
      const editing = el.id === editingId
      return (
        <div
          key={el.id}
          data-eid={el.id}
          className={`${box} ${cursorCls} p-3`}
          style={{ ...style, background: el.data.color ?? '#21253a' }}
        >
          {editing ? (
            <textarea
              autoFocus
              value={el.data.text ?? ''}
              onChange={(e) => patchData(el.id, { text: e.target.value })}
              onBlur={() => setEditingId(null)}
              className="h-full w-full resize-none bg-transparent text-[13px] leading-snug outline-none"
            />
          ) : (
            <p className="h-full whitespace-pre-wrap break-words text-[13px] leading-snug">{el.data.text || <span className="text-muted">…</span>}</p>
          )}
        </div>
      )
    }
    if (el.kind === 'image') {
      const m = mediaItems.find((x) => x.id === el.media_id)
      return (
        <div key={el.id} data-eid={el.id} className={`${box} ${cursorCls} bg-panel`} style={style}>
          {m ? <img src={mediaUrl(m)} alt={m.name} draggable={false} className="pointer-events-none h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-muted">—</span>}
        </div>
      )
    }
    // shape
    const c = el.data.color ?? '#7fb7a4'
    return (
      <div
        key={el.id}
        data-eid={el.id}
        className={`${box} ${cursorCls} flex items-center justify-center`}
        style={{ ...style, background: `${c}33`, borderColor: c, borderRadius: el.data.shape === 'ellipse' ? '50%' : 8 }}
      >
        <span className="px-2 text-center text-sm">{el.data.label}</span>
      </div>
    )
  }

  const pending = connectFrom ? nodeById.get(connectFrom) : undefined

  const hint = connectFrom ? tk.connectFromHint : tool === 'connect' ? tk.connectHint : null
  const isEmpty = els.length === 0

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-panel px-4 py-2">
        <h1 className="mr-2 max-w-xs truncate font-serif text-2xl">{meta.name}</h1>
        <span className="rounded bg-raised px-2 py-0.5 text-xs text-muted">{tk.kindLabel[meta.kind]}</span>
        <div role="group" aria-label={tk.kindLabel[meta.kind]} className="ml-3 flex gap-1">
          {tools.map((t) => (
            <button
              key={t}
              aria-pressed={tool === t}
              onClick={() => setToolSafe(t)}
              className={`rounded px-2.5 py-1 ${tool === t ? 'bg-raised text-ink' : 'text-muted hover:text-ink'}`}
            >
              {isTree ? tk.treeTools[t as keyof typeof tk.treeTools] : tk.tools[t]}
            </button>
          ))}
        </div>
        {isTree && (
          <button onClick={() => void layoutTree()} className="rounded border border-line px-3 py-1 hover:bg-raised">{tk.layout}</button>
        )}
        <span className="ml-auto flex items-center gap-1">
          <button aria-label={tk.zoomOut} onClick={() => zoomCenter(1 / 1.2)} className="rounded px-2 py-1 text-muted hover:text-ink">−</button>
          <button aria-label={tk.zoomIn} onClick={() => zoomCenter(1.2)} className="rounded px-2 py-1 text-muted hover:text-ink">+</button>
          <button onClick={fitAll} className="rounded px-2 py-1 text-muted hover:text-ink">{tk.fit}</button>
        </span>
      </div>

      <div className="flex min-h-0 flex-1">
        <div
          ref={vpRef}
          className={`relative min-w-0 flex-1 touch-none select-none overflow-hidden bg-bg ${tool === 'select' ? 'cursor-default' : 'cursor-crosshair'}`}
          style={{ backgroundImage: 'radial-gradient(var(--line) 1px, transparent 1px)', backgroundSize: `${28 * view.s}px ${28 * view.s}px`, backgroundPosition: `${view.x}px ${view.y}px` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endGesture}
          onPointerCancel={endGesture}
          onPointerLeave={endGesture}
          onDoubleClick={onDoubleClick}
          onWheel={onWheel}
        >
          <div className="absolute left-0 top-0" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})`, transformOrigin: '0 0' }}>
            <svg className="absolute left-0 top-0 overflow-visible" width={1} height={1}>
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" fill="#9a9cab" />
                </marker>
              </defs>
              {edges.map((e) => {
                const a = nodeById.get(e.data.from ?? '')
                const b = nodeById.get(e.data.to ?? '')
                if (!a || !b) return null
                const ca = centerOf(a)
                const cb = centerOf(b)
                const [wa, ha] = sizeOf(a)
                const [wb, hb] = sizeOf(b)
                const p1 = exitPoint(ca, wa, ha, cb)
                const p2 = exitPoint(cb, wb, hb, ca)
                const sel = e.id === selectedId
                const color = sel ? '#ffffff' : (e.data.color ?? '#9a9cab')
                const label = e.data.label
                return (
                  <g key={e.id}>
                    <line data-eid={e.id} x1={p1[0]} y1={p1[1]} x2={p2[0]} y2={p2[1]} stroke="transparent" strokeWidth={14 / view.s} pointerEvents="stroke" className="cursor-pointer" />
                    <line x1={p1[0]} y1={p1[1]} x2={p2[0]} y2={p2[1]} stroke={color} strokeWidth={2 / view.s} markerEnd="url(#arrow)" pointerEvents="none" />
                    {label && (
                      <text
                        x={(p1[0] + p2[0]) / 2}
                        y={(p1[1] + p2[1]) / 2}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize={13 / view.s}
                        fill="#f2efe6"
                        stroke="#12141c"
                        strokeWidth={4 / view.s}
                        paintOrder="stroke"
                        pointerEvents="none"
                      >
                        {label}
                      </text>
                    )}
                  </g>
                )
              })}
              {connectFrom && pending && cursor && (() => {
                const c = centerOf(pending)
                const [w, h] = sizeOf(pending)
                const p = exitPoint(c, w, h, cursor)
                return <line x1={p[0]} y1={p[1]} x2={cursor[0]} y2={cursor[1]} stroke="#7fb7a4" strokeWidth={2 / view.s} strokeDasharray={`${6 / view.s} ${4 / view.s}`} pointerEvents="none" />
              })()}
            </svg>
            {nodes.map(renderNode)}
          </div>

          {isEmpty && (
            <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-muted">
              {isTree ? tk.treeEmpty : tk.empty}
            </p>
          )}
          {hint && (
            <p className="pointer-events-none absolute bottom-3 left-3 rounded bg-panel/90 px-3 py-1.5 text-xs text-muted">{hint}</p>
          )}
        </div>

        <CanvasInspector
          el={selected}
          relationTree={!!isTree}
          mediaName={selected?.media_id ? (mediaItems.find((m) => m.id === selected.media_id)?.name ?? null) : null}
          onPatch={(p) => selected && patchData(selected.id, p)}
          onRemove={() => void removeSelected()}
          onOpenCard={openCard}
        />
      </div>

      {pickingCard && (
        <CardPicker
          excluded={cardIdsOnCanvas}
          onPick={(id) => {
            if (cardIdsOnCanvas.has(id)) {
              showToast(tk.cardExists)
              return
            }
            void addCard(id, pickingCard)
          }}
          onClose={() => setPickingCard(null)}
        />
      )}
      {pickingImage && (
        <MediaPicker
          title={tk.pickImage}
          kinds={['image', 'gif']}
          onPick={(m) => void addImage(m.id, pickingImage)}
          onClose={() => setPickingImage(null)}
        />
      )}
    </div>
  )
}
