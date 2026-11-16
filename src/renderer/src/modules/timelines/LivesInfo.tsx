import { useEffect, useState } from 'react'
import type { TimelineLife } from '@shared/types'
import { tl } from '@/i18n/lives'

type Row = TimelineLife & { timeline_name: string }

/** Na ficha do card: em quais linhas do tempo ele nasce/é fundado e quando termina. */
export function LivesInfo({ cardId }: { cardId: string }): JSX.Element | null {
  const [rows, setRows] = useState<Row[]>([])
  useEffect(() => {
    let alive = true
    void window.api.lives.forCard(cardId).then((r) => alive && setRows(r))
    return () => {
      alive = false
    }
  }, [cardId])
  if (rows.length === 0) return null
  const fmt = (v: number): string => Number(v.toFixed(2)).toLocaleString('pt-BR')
  return (
    <section className="mb-8">
      <h3 className="mb-2 font-serif text-lg">{tl.cardLinesTitle}</h3>
      <ul className="space-y-1 text-sm">
        {rows.map((r) => (
          <li key={r.id} className="text-muted">
            <span className="text-ink">{r.timeline_name}</span>: {tl.kinds[r.start_kind]} {fmt(r.start_value)}
            {r.end_value != null && r.end_kind && <> · {tl.kinds[r.end_kind]} {fmt(r.end_value)}</>}
          </li>
        ))}
      </ul>
    </section>
  )
}
