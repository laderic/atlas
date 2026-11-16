import { useEffect, useRef } from 'react'
import { Maximize2, Minus, Plus } from 'lucide-react'
import {
  forceCollide, forceLink, forceManyBody, forceSimulation,
  type Simulation, type SimulationLinkDatum, type SimulationNodeDatum
} from 'd3-force'
import type { GraphData } from '@shared/types'
import { tu } from '@/i18n/ui'

type N = SimulationNodeDatum & { id: string; label: string; color: string }
type L = SimulationLinkDatum<N>
type Drag =
  | { kind: 'pan'; sx: number; sy: number; tx: number; ty: number }
  | { kind: 'node'; id: string; start: [number, number]; group: Map<string, [number, number]>; moved: boolean }

const HOLD_MS = 350
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))

interface Props {
  data: GraphData
  onOpenCard: (id: string) => void
}

/**
 * Grafo de fundo da home.
 * - Roda para dar zoom; arraste o fundo para deslocar.
 * - Arraste uma bolinha: ela e os cards ligados a ela se movem juntos.
 * - Segure uma bolinha: destaca as conexões dela com borda branca.
 * - Clique rápido abre o card.
 */
export function WorldGraph({ data, onOpenCard }: Props): JSX.Element {
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const view = useRef({ k: 1, tx: 0, ty: 0 })
  const dims = useRef({ w: 0, h: 0 })
  const fitted = useRef(false)
  const nodes = useRef<N[]>([])
  const byId = useRef(new Map<string, N>())
  const links = useRef<L[]>([])
  const neighbors = useRef(new Map<string, Set<string>>())
  const sim = useRef<Simulation<N, L> | null>(null)
  const highlight = useRef<string | null>(null)
  const drag = useRef<Drag | null>(null)
  const pressTimer = useRef<number | undefined>(undefined)
  const openRef = useRef(onOpenCard)
  openRef.current = onOpenCard

  const draw = (): void => {
    const cv = canvas.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const { k, tx, ty } = view.current
    const { w, h } = dims.current
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * tx, dpr * ty)

    const hl = highlight.current
    const rel = hl ? (neighbors.current.get(hl) ?? new Set<string>()) : null
    const isRel = (id: string): boolean => !hl || id === hl || (rel?.has(id) ?? false)

    for (const l of links.current) {
      const s = l.source as N
      const t = l.target as N
      const on = hl ? s.id === hl || t.id === hl : true
      ctx.globalAlpha = hl ? (on ? 0.95 : 0.06) : 0.28
      ctx.strokeStyle = hl && on ? '#ffffff' : '#9a9cab'
      ctx.lineWidth = (hl && on ? 2 : 1) / k
      ctx.beginPath()
      ctx.moveTo(s.x ?? 0, s.y ?? 0)
      ctx.lineTo(t.x ?? 0, t.y ?? 0)
      ctx.stroke()
    }

    for (const n of nodes.current) {
      const r = 5 / k
      const x = n.x ?? 0
      const y = n.y ?? 0
      ctx.globalAlpha = isRel(n.id) ? 1 : 0.18
      ctx.fillStyle = n.color
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
      if (hl && isRel(n.id)) {
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 2 / k
        ctx.stroke()
      }
    }

    ctx.font = `${12 / k}px "Segoe UI", sans-serif`
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#e8e4d9'
    for (const n of nodes.current) {
      ctx.globalAlpha = isRel(n.id) ? 0.9 : 0.12
      ctx.fillText(n.label, (n.x ?? 0) + 8 / k, (n.y ?? 0) + 4 / k)
    }
    ctx.globalAlpha = 1
  }

  const fit = (): void => {
    const { w, h } = dims.current
    const ns = nodes.current
    if (!w || !h || ns.length === 0) return
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const n of ns) {
      minX = Math.min(minX, n.x ?? 0); maxX = Math.max(maxX, n.x ?? 0)
      minY = Math.min(minY, n.y ?? 0); maxY = Math.max(maxY, n.y ?? 0)
    }
    const bw = maxX - minX + 120
    const bh = maxY - minY + 120
    const k = clamp(Math.min(w / bw, h / bh), 0.25, 3)
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2
    view.current = { k, tx: w / 2 - cx * k, ty: h / 2 - cy * k }
    draw()
  }

  const zoomBy = (f: number): void => {
    const { w, h } = dims.current
    const v = view.current
    const k2 = clamp(v.k * f, 0.25, 4)
    const r = k2 / v.k
    v.tx = w / 2 - (w / 2 - v.tx) * r
    v.ty = h / 2 - (h / 2 - v.ty) * r
    v.k = k2
    draw()
  }

  // monta a simulação quando os dados mudam
  useEffect(() => {
    const ns: N[] = data.nodes.map((n) => ({ id: n.id, label: n.label, color: n.color ?? '#9a9cab' }))
    const ls: L[] = data.links.map((l) => ({ source: l.source, target: l.target }))
    const nb = new Map<string, Set<string>>()
    for (const l of data.links) {
      if (!nb.has(l.source)) nb.set(l.source, new Set())
      if (!nb.has(l.target)) nb.set(l.target, new Set())
      nb.get(l.source)!.add(l.target)
      nb.get(l.target)!.add(l.source)
    }
    nodes.current = ns
    links.current = ls
    byId.current = new Map(ns.map((n) => [n.id, n]))
    neighbors.current = nb
    highlight.current = null

    const s = forceSimulation(ns)
      .force('link', forceLink<N, L>(ls).id((d) => d.id).distance(70).strength(0.4))
      .force('charge', forceManyBody().strength(-120))
      .force('collide', forceCollide(14))
      .stop()
    for (let i = 0; i < 200; i++) s.tick()
    s.on('tick', draw)
    sim.current = s
    fitted.current = false
    fit()
    return () => {
      s.stop()
    }
  }, [data])

  // tamanho do canvas acompanha a área
  useEffect(() => {
    const el = wrap.current
    const cv = canvas.current
    if (!el || !cv) return
    const ro = new ResizeObserver(() => {
      const dpr = window.devicePixelRatio || 1
      dims.current = { w: el.clientWidth, h: el.clientHeight }
      cv.width = dims.current.w * dpr
      cv.height = dims.current.h * dpr
      cv.style.width = `${dims.current.w}px`
      cv.style.height = `${dims.current.h}px`
      if (!fitted.current && dims.current.w && dims.current.h) {
        fitted.current = true
        fit()
      } else draw()
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ponteiro: zoom pela roda, arrastar, segurar e clicar
  useEffect(() => {
    const cv = canvas.current
    if (!cv) return
    let startScreen: [number, number] = [0, 0]

    const local = (e: PointerEvent | WheelEvent): [number, number] => {
      const r = cv.getBoundingClientRect()
      return [e.clientX - r.left, e.clientY - r.top]
    }
    const toWorld = (p: [number, number]): [number, number] => {
      const { k, tx, ty } = view.current
      return [(p[0] - tx) / k, (p[1] - ty) / k]
    }
    const hit = (wx: number, wy: number): N | null => {
      let best: N | null = null
      let bd = Infinity
      const rad = 8 / view.current.k
      for (const n of nodes.current) {
        const d = Math.hypot((n.x ?? 0) - wx, (n.y ?? 0) - wy)
        if (d < rad && d < bd) { best = n; bd = d }
      }
      return best
    }

    const onDown = (e: PointerEvent): void => {
      cv.setPointerCapture(e.pointerId)
      startScreen = local(e)
      const w = toWorld(startScreen)
      const n = hit(w[0], w[1])
      if (!n) {
        drag.current = { kind: 'pan', sx: startScreen[0], sy: startScreen[1], tx: view.current.tx, ty: view.current.ty }
        return
      }
      const group = new Map<string, [number, number]>()
      group.set(n.id, [n.x ?? 0, n.y ?? 0])
      for (const nid of neighbors.current.get(n.id) ?? []) {
        const m = byId.current.get(nid)
        if (m) group.set(nid, [m.x ?? 0, m.y ?? 0])
      }
      for (const id of group.keys()) {
        const m = byId.current.get(id)!
        m.fx = m.x
        m.fy = m.y
      }
      drag.current = { kind: 'node', id: n.id, start: w, group, moved: false }
      window.clearTimeout(pressTimer.current)
      pressTimer.current = window.setTimeout(() => {
        const d = drag.current
        if (d?.kind === 'node' && !d.moved) {
          highlight.current = d.id
          draw()
        }
      }, HOLD_MS)
    }

    const onMove = (e: PointerEvent): void => {
      const d = drag.current
      if (!d) return
      const p = local(e)
      if (d.kind === 'pan') {
        view.current.tx = d.tx + (p[0] - d.sx)
        view.current.ty = d.ty + (p[1] - d.sy)
        draw()
        return
      }
      if (!d.moved && Math.hypot(p[0] - startScreen[0], p[1] - startScreen[1]) < 4) return
      if (!d.moved) {
        d.moved = true
        window.clearTimeout(pressTimer.current)
        highlight.current = null
      }
      const w = toWorld(p)
      const dx = w[0] - d.start[0]
      const dy = w[1] - d.start[1]
      for (const [id, [x0, y0]] of d.group) {
        const m = byId.current.get(id)
        if (m) {
          m.fx = x0 + dx
          m.fy = y0 + dy
          m.x = m.fx
          m.y = m.fy
        }
      }
      sim.current?.alpha(0.2).restart()
      draw()
    }

    const onUp = (): void => {
      const d = drag.current
      drag.current = null
      window.clearTimeout(pressTimer.current)
      if (d?.kind !== 'node') return
      for (const id of d.group.keys()) {
        const m = byId.current.get(id)
        if (m) {
          m.fx = null
          m.fy = null
        }
      }
      const wasHeld = highlight.current !== null
      highlight.current = null
      if (!d.moved && !wasHeld) openRef.current(d.id)
      sim.current?.alpha(0.3).restart()
      draw()
    }

    const onWheel = (e: WheelEvent): void => {
      e.preventDefault()
      const p = local(e)
      const v = view.current
      const k2 = clamp(v.k * (e.deltaY < 0 ? 1.15 : 1 / 1.15), 0.25, 4)
      const r = k2 / v.k
      v.tx = p[0] - (p[0] - v.tx) * r
      v.ty = p[1] - (p[1] - v.ty) * r
      v.k = k2
      draw()
    }

    cv.addEventListener('pointerdown', onDown)
    cv.addEventListener('pointermove', onMove)
    cv.addEventListener('pointerup', onUp)
    cv.addEventListener('pointercancel', onUp)
    cv.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      cv.removeEventListener('pointerdown', onDown)
      cv.removeEventListener('pointermove', onMove)
      cv.removeEventListener('pointerup', onUp)
      cv.removeEventListener('pointercancel', onUp)
      cv.removeEventListener('wheel', onWheel)
      window.clearTimeout(pressTimer.current)
    }
  }, [])

  return (
    <div ref={wrap} className="absolute inset-0">
      <canvas ref={canvas} className="block h-full w-full cursor-grab touch-none active:cursor-grabbing" aria-hidden="true" />
      <div className="absolute right-4 top-4 z-20 flex flex-col gap-1">
        <button aria-label={tu.zoomIn} onClick={() => zoomBy(1.25)} className="flex h-8 w-8 items-center justify-center rounded border border-line bg-panel/90 text-muted hover:text-ink">
          <Plus size={15} />
        </button>
        <button aria-label={tu.zoomOut} onClick={() => zoomBy(1 / 1.25)} className="flex h-8 w-8 items-center justify-center rounded border border-line bg-panel/90 text-muted hover:text-ink">
          <Minus size={15} />
        </button>
        <button aria-label={tu.fitAll} onClick={fit} className="flex h-8 w-8 items-center justify-center rounded border border-line bg-panel/90 text-muted hover:text-ink">
          <Maximize2 size={14} />
        </button>
      </div>
      <p className="pointer-events-none absolute right-4 top-[7.5rem] z-20 w-44 text-right text-xs text-muted/80">
        {tu.graphHint}
      </p>
    </div>
  )
}
