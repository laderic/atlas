import { useEffect, useState } from 'react'
import type { SheetDetail, SheetSavePatch } from '@shared/types'
import { ts } from '@/i18n/sheets'
import { useSheets } from '@/store/sheets'
import { useCards } from '@/store/cards'
import { useUi } from '@/store/ui'
import { FichaView } from './FichaView'
import { TabelaView } from './TabelaView'

export function SheetView({ sheetId }: { sheetId: string }): JSX.Element {
  const [detail, setDetail] = useState<SheetDetail | null>(null)
  const cards = useCards((s) => s.cards)
  const openNameDialog = useUi((s) => s.openNameDialog)
  const rename = useSheets((s) => s.rename)
  const remove = useSheets((s) => s.remove)
  const openCard = useCards((s) => s.openCard)

  useEffect(() => {
    let alive = true
    window.api.sheets.get(sheetId).then((d) => alive && setDetail(d))
    return () => {
      alive = false
    }
  }, [sheetId])

  if (!detail) return <div className="p-10 text-muted">…</div>

  // Atualiza a tela na hora e grava em segundo plano.
  const save = (patch: SheetSavePatch): void => {
    setDetail((d) => {
      if (!d) return d
      return {
        ...d,
        sheet: patch.name !== undefined ? { ...d.sheet, name: patch.name } : d.sheet,
        attrs: patch.attrs ?? d.attrs,
        values: patch.values ?? d.values,
        cols: patch.cols ?? d.cols,
        rows: patch.rows ?? d.rows
      }
    })
    void window.api.sheets.save(sheetId, patch)
  }

  const linked = detail.sheet.card_id ? cards.find((c) => c.id === detail.sheet.card_id) ?? null : null
  const isFicha = detail.sheet.kind === 'ficha'

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-line bg-panel px-4 py-2">
        <span className="rounded bg-raised px-2 py-0.5 text-xs text-muted">{isFicha ? ts.ficha : ts.table}</span>
        <h1 className="max-w-md truncate font-serif text-2xl">{detail.sheet.name}</h1>
        <button
          onClick={() => openNameDialog({ title: ts.rename, label: ts.nameLabel, initial: detail.sheet.name, submit: ts.rename, onSubmit: (v) => rename(sheetId, v).then(() => save({ name: v })) })}
          className="rounded px-2 py-1 text-xs text-muted hover:text-ink"
        >
          {ts.rename}
        </button>
        {linked && (
          <button onClick={() => openCard(linked.id)} className="text-sm text-muted hover:text-ink">
            {ts.linkedCard}: <span className="text-accent">{linked.title}</span>
          </button>
        )}
        <button
          onClick={() => window.confirm(ts.confirmRemove(detail.sheet.name)) && remove(sheetId)}
          className="ml-auto rounded px-2 py-1 text-muted hover:text-danger"
        >
          {ts.remove}
        </button>
      </div>
      <div className="min-h-0 flex-1">
        {isFicha ? <FichaView detail={detail} save={save} /> : <TabelaView detail={detail} save={save} />}
      </div>
    </div>
  )
}
