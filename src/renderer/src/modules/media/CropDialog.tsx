import { useRef, useState } from 'react'
import type { MediaItem } from '@shared/types'
import { Modal } from '@/components/Modal'
import { t } from '@/i18n/pt-BR'
import { tm } from '@/i18n/media'
import { mediaUrl } from '@/lib/media'
import { useMedia } from '@/store/media'

interface Sel { x: number; y: number; w: number; h: number }
const RATIOS: [string, number | null][] = [[tm.ratioFree, null], ['1:1', 1], ['4:3', 4 / 3], ['3:4', 3 / 4], ['16:9', 16 / 9], ['3:2', 3 / 2]]
const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi)

export function CropDialog({ item, onClose }: { item: MediaItem; onClose: () => void }): JSX.Element {
  const saveCrop = useMedia((s) => s.saveCrop)
  const imgRef = useRef<HTMLImageElement>(null)
  const start = useRef<{ x: number; y: number } | null>(null)
  const [sel, setSel] = useState<Sel | null>(null)
  const [ratio, setRatio] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const point = (e: React.PointerEvent): { x: number; y: number } => {
    const r = imgRef.current!.getBoundingClientRect()
    return { x: clamp(e.clientX - r.left, 0, r.width), y: clamp(e.clientY - r.top, 0, r.height) }
  }

  const compute = (s: { x: number; y: number }, p: { x: number; y: number }): Sel => {
    const W = imgRef.current!.clientWidth
    const H = imgRef.current!.clientHeight
    const dx = p.x - s.x
    const dy = p.y - s.y
    const maxW = dx >= 0 ? W - s.x : s.x
    const maxH = dy >= 0 ? H - s.y : s.y
    let w = Math.min(Math.abs(dx), maxW)
    let h = Math.min(Math.abs(dy), maxH)
    if (ratio) {
      w = Math.min(w, maxH * ratio)
      h = w / ratio
    }
    return { x: dx >= 0 ? s.x : s.x - w, y: dy >= 0 ? s.y : s.y - h, w, h }
  }

  const valid = sel !== null && sel.w > 4 && sel.h > 4

  const save = async (mode: 'copy' | 'replace'): Promise<void> => {
    const img = imgRef.current
    if (!img || !sel || !valid) return
    setBusy(true)
    setError(null)
    try {
      const kx = img.naturalWidth / img.clientWidth
      const ky = img.naturalHeight / img.clientHeight
      const sw = Math.max(1, Math.round(sel.w * kx))
      const sh = Math.max(1, Math.round(sel.h * ky))
      const canvas = document.createElement('canvas')
      canvas.width = sw
      canvas.height = sh
      canvas.getContext('2d')!.drawImage(img, Math.round(sel.x * kx), Math.round(sel.y * ky), sw, sh, 0, 0, sw, sh)
      const mime = /\.jpe?g$/i.test(item.file_path) ? 'image/jpeg' : 'image/png'
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, mime, 0.92))
      if (!blob) throw new Error('empty')
      await saveCrop(item.id, new Uint8Array(await blob.arrayBuffer()), mime, mode)
      onClose()
    } catch {
      setError(tm.cropError)
      setBusy(false)
    }
  }

  return (
    <Modal title={tm.cropTitle} onClose={onClose} width={820}>
      <p className="mb-3 text-muted">{tm.cropHelp}</p>
      <div className="mb-4 flex justify-center rounded bg-black/40 p-3">
        <div
          className="relative inline-block cursor-crosshair touch-none select-none overflow-hidden"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            start.current = point(e)
            setSel({ ...start.current, w: 0, h: 0 })
          }}
          onPointerMove={(e) => start.current && setSel(compute(start.current, point(e)))}
          onPointerUp={() => (start.current = null)}
        >
          <img
            ref={imgRef}
            src={mediaUrl(item)}
            crossOrigin="anonymous"
            alt={item.name}
            draggable={false}
            className="block max-h-[56vh] max-w-full"
          />
          {sel && sel.w > 0 && (
            <div
              className="pointer-events-none absolute border border-accent"
              style={{ left: sel.x, top: sel.y, width: sel.w, height: sel.h, boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)' }}
            />
          )}
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2 text-muted">
        <label htmlFor="crop-ratio">{tm.ratio}</label>
        <select
          id="crop-ratio"
          value={RATIOS.findIndex(([, r]) => r === ratio)}
          onChange={(e) => { setRatio(RATIOS[Number(e.target.value)][1]); setSel(null) }}
          className="rounded border border-line bg-raised px-2 py-1 text-ink"
        >
          {RATIOS.map(([label], i) => <option key={label} value={i}>{label}</option>)}
        </select>
        {error && <span className="ml-3 text-danger">{error}</span>}
      </div>

      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="rounded px-4 py-2 text-muted hover:text-ink">{t.cancel}</button>
        <button onClick={() => save('replace')} disabled={!valid || busy} className="rounded border border-line px-4 py-2 disabled:opacity-40">{tm.replace}</button>
        <button onClick={() => save('copy')} disabled={!valid || busy} className="rounded bg-accent px-4 py-2 font-medium text-accent-ink disabled:opacity-40">{tm.saveCopy}</button>
      </div>
    </Modal>
  )
}
