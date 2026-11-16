import { useMemo, useState } from 'react'
import type { Era, TimelineEvent, TimelineLife } from '@shared/types'
import { tl } from '@/i18n/lives'
import { useCards } from '@/store/cards'

export const ERA_PALETTE = ['#7fb7a4', '#e0a96d', '#b58ad6', '#e07a6b', '#6da7e0', '#e0c76d', '#9bd16d', '#d68ab5']

const BOX_W = 170
const BOX_H = 52
const PAD = 100
const BASE_W = 900
const LANE_ROW = 34
const LABEL_W = 220
const LANE_MAX_ROWS = 4
// Itens que caem a até GROUP_PX um do outro viram um grupo quando são GROUP_MIN ou mais.
const GROUP_PX = 40
const GROUP_MIN = 3
const GROUP_W = 46
const BIRTH = '#7fb7a4'
const FOUNDING = '#e0a96d'
const END = '#e07a6b'
const startColor = (kind: string): string => (kind === 'fundacao' ? FOUNDING : BIRTH)

export type LifeWithTitle = TimelineLife & { title: string }

type LaneEntry =
  | { kind: 'item'; key: string; x1: number; x2: number | null; row: number; life: LifeWithTitle }
  | { kind: 'group'; key: string; x1: number; row: number; items: LifeWithTitle[] }

const niceStep = (raw: number): number => {
  const p = 10 ** Math.floor(Math.log10(raw))
  const f = raw / p
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p
}

function buildLayout(eras: Era[], events: TimelineEvent[], lives: LifeWithTitle[], zoom: number) {
  const vals: number[] = []
  for (const e of eras) {
    if (e.start_value != null) vals.push(e.start_value)
    if (e.end_value != null) vals.push(e.end_value)
  }
  for (const ev of events) vals.push(ev.sort_value)
  for (const l of lives) {
    vals.push(l.start_value)
    if (l.end_value != null) vals.push(l.end_value)
  }

  let min = vals.length ? Math.min(...vals) : 0
  let max = vals.length ? Math.max(...vals) : 100
  if (max - min < 1) max = min + 1
  const pad = (max - min) * 0.05
  min -= pad
  max += pad

  const span = BASE_W * zoom
  const x = (v: number): number => ((v - min) / (max - min)) * span

  const eraBands = eras.map((e) => {
    const a = e.start_value ?? min
    const b = e.end_value ?? max
    return { era: e, left: x(Math.min(a, b)), width: Math.abs(x(b) - x(a)) }
  })

  const step = niceStep((max - min) / 8)
  const ticks: { v: number; px: number }[] = []
  for (let v = Math.ceil(min / step) * step; v <= max; v += step) ticks.push({ v, px: x(v) })

  // Faixa: agrupa os que estão muito juntos e distribui o resto em linhas.
  const sortedL = lives
    .map((l) => ({ l, x1: x(l.start_value), x2: l.end_value != null ? x(l.end_value) : null }))
    .sort((a, b) => a.x1 - b.x1)
  const clusters: (typeof sortedL)[] = []
  for (const it of sortedL) {
    const last = clusters[clusters.length - 1]
    if (last && it.x1 - last[last.length - 1].x1 <= GROUP_PX) last.push(it)
    else clusters.push([it])
  }
  const entries: LaneEntry[] = []
  for (const c of clusters) {
    if (c.length >= GROUP_MIN) {
      entries.push({ kind: 'group', key: `g-${c[0].l.id}`, x1: c[0].x1, row: 0, items: c.map((i) => i.l) })
    } else {
      for (const it of c) entries.push({ kind: 'item', key: it.l.id, x1: it.x1, x2: it.x2, row: 0, life: it.l })
    }
  }
  entries.sort((a, b) => a.x1 - b.x1)

  const rowRight: number[] = []
  for (const e of entries) {
    let right: number
    if (e.kind === 'group') {
      right = e.x1 + GROUP_W
    } else {
      const short = e.x2 != null && e.x2 - e.x1 < 200
      const labelStart = short && e.x2 != null ? e.x2 + 14 : e.x1 + 9
      const textW = Math.min(LABEL_W, 40 + (tl.kinds[e.life.start_kind].length + e.life.title.length + 12) * 6.2)
      right = labelStart + textW
    }
    let row = rowRight.findIndex((r) => e.x1 > r + 6)
    if (row < 0) {
      row = rowRight.length
      rowRight.push(0)
    }
    rowRight[row] = right
    e.row = row
  }
  const laneContentH = entries.length ? 14 + rowRight.length * LANE_ROW : 0
  const laneH = entries.length ? 14 + Math.min(rowRight.length, LANE_MAX_ROWS) * LANE_ROW : 0

  // Eventos: níveis acima/abaixo do eixo.
  const sorted = events.map((ev) => ({ ev, px: x(ev.sort_value) })).sort((a, b) => a.px - b.px)
  const levels: { side: number; right: number }[] = []
  const placed = sorted.map(({ ev, px }) => {
    const left = px - BOX_W / 2
    let idx = levels.findIndex((l) => left > l.right + 8)
    if (idx < 0) {
      idx = levels.length
      levels.push({ side: idx % 2 === 0 ? -1 : 1, right: 0 })
    }
    levels[idx].right = left + BOX_W
    const depth = Math.floor(idx / 2)
    const side = levels[idx].side
    const top = side === -1 ? -40 - depth * 72 - BOX_H : 40 + depth * 72
    return { ev, px, top, side }
  })

  const tops = placed.map((p) => p.top)
  const bottoms = placed.map((p) => p.top + BOX_H)
  const minTop = Math.min(0, ...tops)
  const maxBottom = Math.max(0, ...bottoms)
  const axisY = -minTop + 30
  const height = axisY + maxBottom + 30

  return { min, max, span, width: span + PAD * 2, height, axisY, x, eraBands, ticks, placed, entries, laneH, laneContentH }
}

interface Props {
  eras: Era[]
  events: TimelineEvent[]
  lives: LifeWithTitle[]
  unit: string
  zoom: number
  selectedId: string | null
  onSelect: (id: string) => void
}

export function TimelineStrip({ eras, events, lives, unit, zoom, selectedId, onSelect }: Props): JSX.Element {
  const L = useMemo(() => buildLayout(eras, events, lives, zoom), [eras, events, lives, zoom])
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const openCard = useCards((s) => s.openCard)
  const eraColor = (id: string | null): string => eras.find((e) => e.id === id)?.color ?? '#9a9cab'
  const fmt = (v: number): string => Number(v.toFixed(2)).toLocaleString('pt-BR')
  const laneY = (row: number): number => 14 + row * LANE_ROW + 9
  const group = L.entries.find((e) => e.kind === 'group' && e.key === openGroup) as
    | Extract<LaneEntry, { kind: 'group' }>
    | undefined

  return (
    <div className="relative" style={{ width: L.width, height: L.height + L.laneH }}>
      {/* faixa de nascimentos e fins, no topo */}
      {L.laneH > 0 && (
        <div className="absolute left-0 top-0 overflow-y-auto border-b border-line/60" style={{ width: L.width, height: L.laneH }}>
          <div className="relative" style={{ width: L.width, height: L.laneContentH }}>
            {L.entries.map((e) => {
              if (e.kind === 'group') {
                return (
                  <button
                    key={e.key}
                    onClick={() => setOpenGroup(openGroup === e.key ? null : e.key)}
                    aria-expanded={openGroup === e.key}
                    aria-label={`${e.items.length} itens neste ponto`}
                    className="absolute flex h-5 items-center rounded-full border border-line bg-panel px-2 text-[11px] font-semibold text-ink hover:border-accent"
                    style={{ left: e.x1 + PAD, top: laneY(e.row) - 9 }}
                  >
                    +{e.items.length}
                  </button>
                )
              }
              const it = e.life
              const y = laneY(e.row)
              const startLbl = tl.kinds[it.start_kind]
              const endLbl = it.end_kind ? tl.kinds[it.end_kind] : null
              const shortSpan = e.x2 != null && e.x2 - e.x1 < 200
              const labelLeft = shortSpan && e.x2 != null ? e.x2 + PAD + 14 : e.x1 + PAD + 9
              return (
                <div key={e.key}>
                  {e.x2 != null && (
                    <div className="absolute h-1 rounded" style={{ left: e.x1 + PAD, top: y - 2, width: Math.max(e.x2 - e.x1, 2), background: startColor(it.start_kind), opacity: 0.55 }} />
                  )}
                  <div className="absolute h-2.5 w-2.5 rotate-45" style={{ left: e.x1 + PAD - 5, top: y - 5, background: startColor(it.start_kind) }} title={startLbl} />
                  <span className="absolute whitespace-nowrap text-[12px]" style={{ left: labelLeft, top: y - 9 }}>
                    <span className="text-muted">{startLbl} {fmt(it.start_value)} · </span>
                    <span className="font-medium">{it.title}</span>
                  </span>
                  {e.x2 != null && (
                    <span
                      className="absolute flex h-4 w-4 items-center justify-center rounded-full bg-bg text-[11px] font-bold leading-none"
                      style={{ left: e.x2 + PAD - 8, top: y - 8, color: END }}
                      title={`${endLbl} · ${fmt(it.end_value ?? 0)}`}
                    >
                      ✕
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* lista do grupo: abre ao clicar no número e fecha ao clicar fora */}
      {group && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpenGroup(null)} />
          <div className="absolute z-40 w-64 rounded-lg border border-line bg-panel p-2 shadow-xl" style={{ left: group.x1 + PAD - 8, top: laneY(group.row) + 12 }}>
            <p className="mb-1 px-1 text-xs text-muted">{group.items.length} neste ponto</p>
            <ul className="max-h-40 space-y-0.5 overflow-y-auto">
              {[...group.items].sort((a, b) => a.start_value - b.start_value).map((l) => (
                <li key={l.id}>
                  <button
                    onClick={() => {
                      setOpenGroup(null)
                      openCard(l.card_id)
                    }}
                    className="flex w-full items-center gap-2 rounded px-2 py-1 text-left hover:bg-raised"
                  >
                    <span className="h-2 w-2 shrink-0 rotate-45" style={{ background: startColor(l.start_kind) }} />
                    <span className="min-w-0 flex-1 truncate text-sm">{l.title}</span>
                    <span className="shrink-0 text-xs text-muted">{fmt(l.start_value)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      <div className="absolute left-0" style={{ top: L.laneH, width: L.width, height: L.height }}>
        {L.eraBands.map((b) => {
          const c = b.era.color ?? '#9a9cab'
          return (
            <div key={b.era.id} className="absolute bottom-0 top-0" style={{ left: b.left + PAD, width: Math.max(b.width, 2), background: `${c}1f`, borderLeft: `2px solid ${c}` }}>
              <span className="absolute left-2 top-2 whitespace-nowrap text-xs font-semibold" style={{ color: c }}>{b.era.name}</span>
            </div>
          )
        })}

        <div className="absolute h-0.5 bg-line" style={{ left: PAD, width: L.span, top: L.axisY }} />
        {L.ticks.map((t) => (
          <span key={t.v} className="absolute text-[11px] text-muted" style={{ left: t.px + PAD, top: L.axisY + 8, transform: 'translateX(-50%)' }}>
            {fmt(t.v)}
          </span>
        ))}

        {L.placed.map(({ ev, px, top, side }) => {
          const c = eraColor(ev.era_id)
          const sel = ev.id === selectedId
          const boxTop = L.axisY + top
          const connTop = side === -1 ? boxTop + BOX_H : L.axisY
          const connH = side === -1 ? L.axisY - (boxTop + BOX_H) : top
          return (
            <div key={ev.id}>
              <div className="absolute w-px bg-muted/50" style={{ left: px + PAD, top: connTop, height: connH }} />
              <div className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-bg" style={{ left: px + PAD, top: L.axisY, background: c }} />
              <button
                onClick={() => onSelect(ev.id)}
                aria-pressed={sel}
                className={`absolute overflow-hidden rounded border bg-panel px-2.5 py-1.5 text-left ${sel ? 'border-accent ring-1 ring-accent' : 'border-line hover:border-muted'}`}
                style={{ left: px + PAD - BOX_W / 2, top: boxTop, width: BOX_W, height: BOX_H, borderLeft: `3px solid ${c}` }}
              >
                <span className="block truncate text-[13px] font-medium">{ev.title}</span>
                <span className="block truncate text-[11px] text-muted">{ev.date_label || `${fmt(ev.sort_value)} ${unit}`}</span>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
