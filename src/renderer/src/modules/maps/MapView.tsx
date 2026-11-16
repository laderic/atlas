import { useEffect, useRef, useState } from 'react'
import type {
  MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent
} from 'react'
import type { FeatureKind, Geometry, MapFeature, MapFeaturePatch } from '@shared/types'
import { tmap } from '@/i18n/maps'
import { mediaUrl } from '@/lib/media'
import { useCards } from '@/store/cards'
import { useMaps } from '@/store/maps'
import { useMedia } from '@/store/media'
import { useUi } from '@/store/ui'
import { FeatureDetails } from './FeatureDetails'
import { MapInspector } from './MapInspector'

type Tool = 'select' | FeatureKind
type Pt = [number, number]
interface View { s: number; x: number; y: number }
type Gesture =
  | { kind: 'pan'; sx: number; sy: number; vx: number; vy: number }
  | { kind: 'drag'; id: string; start: Pt; orig: Geometry; geom: Geometry; moved: boolean }

const COLOR: Record<FeatureKind, string> = { pin: '#7fb7a4', region: '#e0a96d', zone: '#b58ad6', label: '#e8e4d9', path: '#6da7e0' }
const PATH_W = { sm: 2, md: 4, lg: 7 } as const
const PIN_R = { sm: 5, md: 8, lg: 12 } as const
const TEXT_PX = { sm: 12, md: 15, lg: 20 } as const
const MIN_S = 0.05
const MAX_S = 8
const TOOLS: Tool[] = ['select', 'pin', 'region', 'zone', 'label', 'path']

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))
const dist = (a: Pt, b: Pt): number => Math.hypot(a[0] - b[0], a[1] - b[1])
const centroid = (pts: Pt[]): Pt => [
  pts.reduce((s, p) => s + p[0], 0) / pts.length,
  pts.reduce((s, p) => s + p[1], 0) / pts.length
]
const anchor = (g: Geometry): Pt => ('points' in g ? centroid(g.points) : [g.x, g.y])
const shift = (g: Geometry, dx: number, dy: number): Geometry =>
  'points' in g ? { points: g.points.map(([x, y]) => [x + dx, y + dy] as Pt) } : { x: g.x + dx, y: g.y + dy }
const dedupe = (pts: Pt[], min: number): Pt[] => pts.filter((p, i) => i === 0 || dist(p, pts[i - 1]) > min)
const polyStr = (pts: Pt[]): string => pts.map((p) => `${p[0]},${p[1]}`).join(' ')

export function MapView({ mapId }: { mapId: string }): JSX.Element {
  const map = useMaps((s) => s.maps.find((m) => m.id === mapId) ?? null)
  const maps = useMaps((s) => s.maps)
  const focus = useMaps((s) => s.focus)
  const clearFocus = useMaps((s) => s.clearFocus)
  const renameMap = useMaps((s) => s.renameMap)
  const removeMap = useMaps((s) => s.removeMap)
  const image = useMedia((s) => s.items.find((m) => m.id === map?.image_id) ?? null)
  const cards = useCards((s) => s.cards)
  const openNameDialog = useUi((s) => s.openNameDialog)

  const [features, setFeatures] = useState<MapFeature[]>([])
  const [tool, setTool] = useState<Tool>('select')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [autoFocusId, setAutoFocusId] = useState<string | null>(null)
  const [detailsId, setDetailsId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Pt[] | null>(null)
  const [cursor, setCursor] = useState<Pt | null>(null)
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null)
  const [view, setView] = useState<View>({ s: 1, x: 0, y: 0 })

  const vpRef = useRef<HTMLDivElement>(null)
  const gesture = useRef<Gesture | null>(null)
  const spaceDown = useRef(false)
  const fittedFor = useRef<string | null>(null)

  const W = imgSize?.w ?? map?.width ?? 1000
  const H = imgSize?.h ?? map?.height ?? 1000

  const vpSize = (): { w: number; h: number } => {
    const r = vpRef.current!.getBoundingClientRect()
    return { w: r.width, h: r.height }
  }
  const toImg = (cx: number, cy: number): Pt => {
    const r = vpRef.current!.getBoundingClientRect()
    return [(cx - r.left - view.x) / view.s, (cy - r.top - view.y) / view.s]
  }
  const fitView = (w: number, h: number): void => {
    const v = vpSize()
    const s = Math.min(v.w / w, v.h / h) * 0.92
    setView({ s, x: (v.w - w * s) / 2, y: (v.h - h * s) / 2 })
  }
  const centerOn = (p: Pt): void => {
    const v = vpSize()
    setView((cur) => ({ s: cur.s, x: v.w / 2 - p[0] * cur.s, y: v.h / 2 - p[1] * cur.s }))
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
  // Traçados grudam no pin mais próximo, para conectar pins.
  const snapPoint = (x: number, y: number): Pt => {
    if (tool !== 'path') return [x, y]
    const pin = features.find((f) => f.kind === 'pin' && 'x' in f.geometry && Math.hypot(f.geometry.x - x, f.geometry.y - y) < 14 / view.s)
    return pin && 'x' in pin.geometry ? [pin.geometry.x, pin.geometry.y] : [x, y]
  }

  const setToolSafe = (t: Tool): void => {
    setDraft(null)
    setCursor(null)
    setTool(t)
  }

  // carrega os elementos do mapa
  useEffect(() => {
    let alive = true
    window.api.maps.features(mapId).then((f) => alive && setFeatures(f))
    return () => {
      alive = false
    }
  }, [mapId])

  // ajusta a visão na primeira vez que a imagem aparece
  useEffect(() => {
    if (!imgSize || !vpRef.current || fittedFor.current === mapId) return
    fittedFor.current = mapId
    fitView(imgSize.w, imgSize.h)
  }, [imgSize, mapId])

  // veio da busca ou de um card: seleciona e centraliza o elemento
  useEffect(() => {
    if (!focus || focus.mapId !== mapId) return
    const f = features.find((x) => x.id === focus.featureId)
    if (!f || !vpRef.current) return
    setSelectedId(f.id)
    setTool('select')
    centerOn(anchor(f.geometry))
    clearFocus()
  }, [focus, features, mapId])

  const createAt = async (kind: 'pin' | 'label', p: Pt): Promise<void> => {
    const f = await window.api.maps.createFeature(mapId, {
      kind,
      geometry: { x: p[0], y: p[1] },
      label: tmap.defaults[kind],
      style: { color: COLOR[kind], size: 'md' }
    })
    setFeatures((fs) => [...fs, f])
    setSelectedId(f.id)
    setAutoFocusId(f.id)
    setTool('select')
  }

  const finishDraft = async (): Promise<void> => {
    if (!draft || (tool !== 'region' && tool !== 'zone' && tool !== 'path')) return
    const kind = tool
    const pts = dedupe(draft, 3 / view.s)
    setDraft(null)
    setCursor(null)
    if (pts.length < (kind === 'path' ? 2 : 3)) return
    const f = await window.api.maps.createFeature(mapId, {
      kind,
      geometry: { points: pts },
      label: tmap.defaults[kind],
      style: { color: COLOR[kind] }
    })
    setFeatures((fs) => [...fs, f])
    setSelectedId(f.id)
    setAutoFocusId(f.id)
    setTool('select')
  }

  const requestDelete = async (id: string): Promise<void> => {
    const f = features.find((x) => x.id === id)
    if (!f) return
    if ((f.notes || f.card_id || f.child_map_id) && !window.confirm(tmap.confirmDeleteFeature)) return
    await window.api.maps.removeFeature(id)
    setFeatures((fs) => fs.filter((x) => x.id !== id))
    setSelectedId((s) => (s === id ? null : s))
    setDetailsId((d) => (d === id ? null : d))
  }

  // Atualização otimista: a UI muda na hora e o banco é gravado em segundo plano.
  // Não substituímos o estado pela resposta, para não atrasar a digitação.
  const patchFeature = (id: string, p: MapFeaturePatch): void => {
    setFeatures((fs) =>
      fs.map((f) =>
        f.id !== id
          ? f
          : {
              ...f,
              label: 'label' in p ? (p.label ?? null) : f.label,
              notes: 'notes' in p ? (p.notes ?? null) : f.notes,
              card_id: 'card_id' in p ? (p.card_id ?? null) : f.card_id,
              child_map_id: 'child_map_id' in p ? (p.child_map_id ?? null) : f.child_map_id,
              style: p.style ? { ...f.style, ...p.style } : f.style,
              geometry: p.geometry ?? f.geometry
            }
      )
    )
    void window.api.maps.updateFeature(id, p)
  }

  // atalhos de teclado
  useEffect(() => {
    const isTyping = (el: EventTarget | null): boolean =>
      el instanceof HTMLElement && el.closest('input,textarea,select,[contenteditable="true"]') !== null
    const onDown = (e: KeyboardEvent): void => {
      if (detailsId || isTyping(e.target)) return
      if (e.code === 'Space') {
        spaceDown.current = true
        e.preventDefault()
        return
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === 'Escape') {
        if (draft) {
          setDraft(null)
          setCursor(null)
        } else setToolSafe('select')
        return
      }
      if (e.key === 'Enter' && draft) {
        void finishDraft()
        return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault()
        void requestDelete(selectedId)
        return
      }
      const shortcuts: Record<string, Tool> = { v: 'select', p: 'pin', r: 'region', z: 'zone', t: 'label', l: 'path' }
      const next = shortcuts[e.key.toLowerCase()]
      if (next) setToolSafe(next)
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

  if (!map) return <div className="p-10 text-muted">…</div>

  const selectedFeature = features.find((f) => f.id === selectedId) ?? null
  const detailsFeature = features.find((f) => f.id === detailsId) ?? null

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    const fid = (e.target as Element).closest?.('[data-fid]')?.getAttribute('data-fid') ?? null
    const [x, y] = toImg(e.clientX, e.clientY)

    if (e.button === 1 || (e.button === 0 && spaceDown.current)) {
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      gesture.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y }
      return
    }
    if (e.button !== 0) return

    if (tool === 'select') {
      if (fid) {
        const f = features.find((x) => x.id === fid)
        if (!f) return
        setSelectedId(fid)
        setAutoFocusId(null)
        gesture.current = { kind: 'drag', id: fid, start: [x, y], orig: f.geometry, geom: f.geometry, moved: false }
      } else {
        setSelectedId(null)
        e.currentTarget.setPointerCapture(e.pointerId)
        gesture.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y }
      }
      return
    }
    if (tool === 'pin' || tool === 'label') {
      void createAt(tool, [x, y])
      return
    }
    // região, zona ou traçado: clique adiciona ponto; clicar perto do primeiro conclui
    if (!draft) {
      const p0 = snapPoint(x, y)
      setDraft([p0])
      setCursor(p0)
      return
    }
    if (draft.length >= 3 && dist([x, y], draft[0]) < 12 / view.s) {
      void finishDraft()
      return
    }
    setDraft([...draft, snapPoint(x, y)])
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
      g.geom = shift(g.orig, dx, dy)
      const id = g.id
      const geom = g.geom
      setFeatures((fs) => fs.map((f) => (f.id === id ? { ...f, geometry: geom } : f)))
      return
    }
    if (draft) setCursor(toImg(e.clientX, e.clientY))
  }

  const endGesture = (): void => {
    const g = gesture.current
    gesture.current = null
    if (g?.kind === 'drag' && g.moved) patchFeature(g.id, { geometry: g.geom })
  }

  const onDoubleClick = (e: ReactMouseEvent<HTMLDivElement>): void => {
    const fid = (e.target as Element).closest?.('[data-fid]')?.getAttribute('data-fid') ?? null
    if (fid) {
      setDetailsId(fid)
      return
    }
    if (draft && draft.length >= (tool === 'path' ? 2 : 3)) void finishDraft()
  }

  const onWheel = (e: ReactWheelEvent<HTMLDivElement>): void => {
    const r = vpRef.current!.getBoundingClientRect()
    zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.15 : 1 / 1.15)
  }

  const renderFeature = (f: MapFeature): JSX.Element => {
    const sel = f.id === selectedId
    const color = f.style.color ?? COLOR[f.kind]
    const shown = f.label || tmap.defaults[f.kind]
    const cursorCls = tool === 'select' ? 'pointer' : 'crosshair'

    if (f.kind === 'path' && 'points' in f.geometry) {
      const pts = f.geometry.points
      const mid = pts[Math.floor(pts.length / 2)]
      const w = PATH_W[f.style.size ?? 'md'] / view.s
      return (
        <g key={f.id}>
          <polyline
            data-fid={f.id}
            points={polyStr(pts)}
            fill="none"
            stroke={sel ? '#ffffff' : color}
            strokeWidth={w}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={f.style.dash ? `${8 / view.s} ${6 / view.s}` : undefined}
            style={{ cursor: cursorCls }}
          />
          <polyline data-fid={f.id} points={polyStr(pts)} fill="none" stroke="transparent" strokeWidth={14 / view.s} pointerEvents="stroke" />
          {f.label && (
            <text x={mid[0]} y={mid[1] - w} textAnchor="middle" fontSize={13 / view.s} fill="#f2efe6" stroke="rgba(0,0,0,0.7)" strokeWidth={3 / view.s} paintOrder="stroke" pointerEvents="none">
              {f.label}
            </text>
          )}
        </g>
      )
    }

    if ((f.kind === 'region' || f.kind === 'zone') && 'points' in f.geometry) {
      const pts = f.geometry.points
      const c = centroid(pts)
      return (
        <g key={f.id}>
          <polygon
            data-fid={f.id}
            points={polyStr(pts)}
            fill={color}
            fillOpacity={f.kind === 'zone' ? 0.12 : 0.28}
            stroke={sel ? '#ffffff' : color}
            strokeWidth={(sel ? 3 : 1.5) / view.s}
            strokeDasharray={f.kind === 'zone' ? `${6 / view.s} ${4 / view.s}` : undefined}
            style={{ cursor: cursorCls }}
          />
          <text
            x={c[0]}
            y={c[1]}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={13 / view.s}
            fill="#f2efe6"
            stroke="rgba(0,0,0,0.7)"
            strokeWidth={3 / view.s}
            paintOrder="stroke"
            pointerEvents="none"
          >
            {shown}
          </text>
        </g>
      )
    }

    if (f.kind === 'pin' && 'x' in f.geometry) {
      const { x, y } = f.geometry
      const r = PIN_R[f.style.size ?? 'md'] / view.s
      const linked = f.card_id || f.child_map_id
      return (
        <g key={f.id}>
          {sel && (
            <circle cx={x} cy={y} r={r * 1.8} fill="none" stroke="#ffffff" strokeWidth={2 / view.s} strokeDasharray={`${4 / view.s} ${3 / view.s}`} pointerEvents="none" />
          )}
          <circle data-fid={f.id} cx={x} cy={y} r={r * 2.2} fill="transparent" pointerEvents="all" style={{ cursor: cursorCls }} />
          <circle data-fid={f.id} cx={x} cy={y} r={r} fill={color} stroke="#0f1116" strokeWidth={1.5 / view.s} style={{ cursor: cursorCls }} />
          {linked && (
            <text x={x + r} y={y - r} fontSize={11 / view.s} fill="#ffffff" pointerEvents="none">{tmap.linkIndicator}</text>
          )}
          {f.label && (
            <text x={x} y={y + r + 14 / view.s} textAnchor="middle" fontSize={13 / view.s} fill="#f2efe6" stroke="rgba(0,0,0,0.7)" strokeWidth={3 / view.s} paintOrder="stroke" pointerEvents="none">
              {f.label}
            </text>
          )}
        </g>
      )
    }

    if (f.kind === 'label' && 'x' in f.geometry) {
      const { x, y } = f.geometry
      return (
        <text
          key={f.id}
          data-fid={f.id}
          x={x}
          y={y}
          textAnchor="middle"
          fontSize={TEXT_PX[f.style.size ?? 'md'] / view.s}
          fontWeight={600}
          fill={sel ? '#ffffff' : color}
          stroke="rgba(0,0,0,0.6)"
          strokeWidth={3 / view.s}
          paintOrder="stroke"
          style={{ cursor: cursorCls }}
        >
          {shown}
        </text>
      )
    }
    return <g key={f.id} />
  }

  const draftColor = tool === 'zone' ? COLOR.zone : COLOR.region
  const draftLayer =
    draft && (
      <g pointerEvents="none">
        {draft.length >= 3 && tool !== 'path' && (
          <polygon points={polyStr([...draft, ...(cursor ? [cursor] : [])])} fill={draftColor} fillOpacity={0.2} />
        )}
        <polyline points={polyStr([...draft, ...(cursor ? [cursor] : [])])} fill="none" stroke={draftColor} strokeWidth={2 / view.s} strokeDasharray={`${6 / view.s} ${4 / view.s}`} />
        {draft.map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r={(i === 0 ? 6 : 4) / view.s} fill={i === 0 ? '#ffffff' : draftColor} />
        ))}
      </g>
    )

  const hint = draft ? tmap.drawHint : tool === 'pin' || tool === 'label' ? tmap.placeHint : null

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-panel px-4 py-2">
        <h1 className="mr-1 max-w-xs truncate font-serif text-2xl">{map.name}</h1>
        <button
          onClick={() =>
            openNameDialog({
              title: tmap.renameMap, label: tmap.mapName, initial: map.name, submit: tmap.rename,
              onSubmit: (v) => renameMap(mapId, v)
            })
          }
          className="rounded px-2 py-1 text-xs text-muted hover:text-ink"
        >
          {tmap.rename}
        </button>
        <div role="group" aria-label={tmap.maps} className="ml-3 flex gap-1">
          {TOOLS.map((t) => (
            <button
              key={t}
              aria-pressed={tool === t}
              onClick={() => setToolSafe(t)}
              className={`rounded px-2.5 py-1 ${tool === t ? 'bg-raised text-ink' : 'text-muted hover:text-ink'}`}
            >
              {tmap.tools[t]}
            </button>
          ))}
        </div>
        <span className="ml-auto flex items-center gap-1">
          <button aria-label={tmap.zoomOut} onClick={() => zoomCenter(1 / 1.2)} className="rounded px-2 py-1 text-muted hover:text-ink">−</button>
          <button aria-label={tmap.zoomIn} onClick={() => zoomCenter(1.2)} className="rounded px-2 py-1 text-muted hover:text-ink">+</button>
          <button onClick={() => imgSize && fitView(imgSize.w, imgSize.h)} className="rounded px-2 py-1 text-muted hover:text-ink">{tmap.fit}</button>
          <button
            onClick={() => window.confirm(tmap.confirmDeleteMap(map.name)) && removeMap(mapId)}
            className="ml-3 rounded px-2 py-1 text-muted hover:text-danger"
          >
            {tmap.deleteMap}
          </button>
        </span>
      </div>

      <div className="flex min-h-0 flex-1">
        <div
          ref={vpRef}
          className={`relative min-w-0 flex-1 touch-none select-none overflow-hidden bg-black/40 ${tool === 'select' ? 'cursor-default' : 'cursor-crosshair'}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endGesture}
          onPointerCancel={endGesture}
          onPointerLeave={endGesture}
          onDoubleClick={onDoubleClick}
          onWheel={onWheel}
        >
          {!image && (
            <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-muted">{tmap.noImage}</p>
          )}
          <div
            className="absolute left-0 top-0 origin-top-left"
            style={{ width: W, height: H, transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})` }}
          >
            {image && (
              <img
                src={mediaUrl(image)}
                alt={image.name}
                draggable={false}
                onLoad={(e) => setImgSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
                className="pointer-events-none block max-w-none"
                style={{ width: W, height: H }}
              />
            )}
            <svg className="absolute left-0 top-0 overflow-visible" width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
              {features.filter((f) => f.kind === 'zone').map(renderFeature)}
              {features.filter((f) => f.kind === 'path').map(renderFeature)}
              {features.filter((f) => f.kind === 'region').map(renderFeature)}
              {draftLayer}
              {features.filter((f) => f.kind === 'pin' || f.kind === 'label').map(renderFeature)}
            </svg>
          </div>
          {hint && (
            <p className="pointer-events-none absolute bottom-3 left-3 rounded bg-panel/90 px-3 py-1.5 text-xs text-muted">{hint}</p>
          )}
        </div>

        <MapInspector
          feature={selectedFeature}
          autoFocusName={autoFocusId !== null && autoFocusId === selectedId}
          cardTitle={selectedFeature?.card_id ? (cards.find((c) => c.id === selectedFeature.card_id)?.title ?? null) : null}
          mapName={selectedFeature?.child_map_id ? (maps.find((m) => m.id === selectedFeature.child_map_id)?.name ?? null) : null}
          onPatch={(p) => selectedFeature && patchFeature(selectedFeature.id, p)}
          onDetails={() => selectedFeature && setDetailsId(selectedFeature.id)}
          onDelete={() => selectedFeature && void requestDelete(selectedFeature.id)}
        />
      </div>

      {detailsFeature && (
        <FeatureDetails
          feature={detailsFeature}
          currentMapId={mapId}
          onPatch={(p) => patchFeature(detailsFeature.id, p)}
          onClose={() => setDetailsId(null)}
        />
      )}
    </div>
  )
}
