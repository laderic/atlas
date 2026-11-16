import type { SheetCol, SheetDetail, SheetRow, SheetSavePatch } from '@shared/types'
import { ts } from '@/i18n/sheets'

const newKey = (): string => `c${Math.random().toString(36).slice(2, 8)}`
const cellCls = 'w-full bg-transparent px-2 py-1.5 outline-none focus:bg-raised rounded'

interface Props {
  detail: SheetDetail
  save: (patch: SheetSavePatch) => void
}

export function TabelaView({ detail, save }: Props): JSX.Element {
  const cols = detail.cols
  const rows = detail.rows

  const setCols = (next: SheetCol[]): void => save({ cols: next })
  const setRows = (next: SheetRow[]): void => save({ rows: next })

  const addCol = (): void => setCols([...cols, { key: newKey(), label: ts.colName, type: 'text' }])
  const updateCol = (key: string, p: Partial<SheetCol>): void =>
    setCols(cols.map((c) => (c.key === key ? { ...c, ...p } : c)))
  const removeCol = (c: SheetCol): void => {
    if (!window.confirm(ts.confirmRemoveCol(c.label))) return
    setCols(cols.filter((x) => x.key !== c.key))
    setRows(rows.map((r) => {
      const { [c.key]: _gone, ...rest } = r
      return rest
    }))
  }
  const addRow = (): void => setRows([...rows, {}])
  const setCell = (ri: number, col: SheetCol, raw: string): void => {
    const v: string | number | null = col.type === 'number' ? (raw.trim() === '' ? null : Number(raw)) : (raw || null)
    setRows(rows.map((r, i) => (i === ri ? { ...r, [col.key]: v } : r)))
  }
  const removeRow = (ri: number): void => setRows(rows.filter((_, i) => i !== ri))

  const totals = cols.map((c) =>
    c.type === 'number' ? rows.reduce((sum, r) => sum + (typeof r[c.key] === 'number' ? (r[c.key] as number) : 0), 0) : null
  )

  return (
    <div className="h-full overflow-auto px-6 py-6">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-line text-muted">
            {cols.map((c) => (
              <th key={c.key} className="min-w-40 px-2 pb-2 font-normal">
                <div className="flex items-center gap-2">
                  <input
                    aria-label={ts.colName}
                    value={c.label}
                    onChange={(e) => updateCol(c.key, { label: e.target.value })}
                    className="min-w-0 flex-1 bg-transparent font-medium text-ink outline-none"
                  />
                  <select
                    aria-label={`${ts.colName}: tipo`}
                    value={c.type}
                    onChange={(e) => updateCol(c.key, { type: e.target.value as 'text' | 'number' })}
                    className="rounded border border-line bg-raised px-1 py-0.5 text-xs text-ink"
                  >
                    <option value="text">{ts.types.text}</option>
                    <option value="number">{ts.types.number}</option>
                  </select>
                  <button aria-label={`${ts.removeCol}: ${c.label}`} onClick={() => removeCol(c)} className="text-muted hover:text-danger">×</button>
                </div>
              </th>
            ))}
            <th className="w-10 pb-2">
              <button onClick={addCol} aria-label={ts.addCol} className="whitespace-nowrap text-accent hover:underline">+</button>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="group border-b border-line/60 hover:bg-panel/60">
              {cols.map((c) => (
                <td key={c.key} className="px-1 py-0.5">
                  <input
                    type={c.type === 'number' ? 'number' : 'text'}
                    aria-label={`${c.label} ${ri + 1}`}
                    value={r[c.key] ?? ''}
                    onChange={(e) => setCell(ri, c, e.target.value)}
                    className={`${cellCls} ${c.type === 'number' ? 'text-right tabular-nums' : ''}`}
                  />
                </td>
              ))}
              <td className="px-1">
                <button aria-label={ts.removeRow} onClick={() => removeRow(ri)} className="invisible text-muted hover:text-danger group-hover:visible">×</button>
              </td>
            </tr>
          ))}
        </tbody>
        {cols.some((c) => c.type === 'number') && rows.length > 0 && (
          <tfoot>
            <tr className="text-muted">
              {cols.map((c, i) => (
                <td key={c.key} className="px-2 py-2 text-right tabular-nums">
                  {totals[i] !== null ? `${ts.total}: ${Number(totals[i]!.toFixed(2)).toLocaleString('pt-BR')}` : ''}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>

      {rows.length === 0 && <p className="px-2 py-4 text-muted">{ts.empty}</p>}
      <button onClick={addRow} className="mt-3 px-2 text-accent hover:underline">{ts.addRow}</button>
    </div>
  )
}
