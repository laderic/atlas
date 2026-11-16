import { ItemPicker } from '@/components/ItemPicker'
import type { CardField } from '@shared/types'
import { useCards } from '@/store/cards'
import { useState } from 'react'

interface Props {
  fields: CardField[]
  values: Record<string, unknown>
  onChange: (key: string, value: unknown) => void
}

const inputCls = 'w-full rounded border border-line bg-raised px-2.5 py-1.5'

/** Campo de várias respostas: digite e aperte Enter; clique no × para remover. */
function ChipsField({ id, value, onChange }: { id: string; value: string[]; onChange: (v: string[]) => void }): JSX.Element {
  const [draft, setDraft] = useState('')
  const add = (): void => {
    const t = draft.trim()
    if (!t || value.includes(t)) return setDraft('')
    onChange([...value, t])
    setDraft('')
  }
  return (
    <div id={id} className="flex flex-wrap items-center gap-1.5 rounded border border-line bg-raised px-2 py-1.5">
      {value.map((c) => (
        <span key={c} className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-sm">
          {c}
          <button type="button" aria-label={`Remover ${c}`} onClick={() => onChange(value.filter((x) => x !== c))} className="text-muted hover:text-danger">×</button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
        onBlur={add}
        placeholder={value.length ? '' : 'Digite e Enter…'}
        aria-label="Adicionar valor"
        className="min-w-24 flex-1 bg-transparent text-sm outline-none"
      />
    </div>
  )
}

export function PropertyFields({ fields, values, onChange }: Props): JSX.Element {
  const cards = useCards((s) => s.cards)
  const cardOptions = cards.map((c) => ({ id: c.id, label: c.title }))
  return (
    <div className="space-y-3">
      {fields.map((f) => {
        const id = `prop-${f.key}`
        const v = values[f.key]
        return (
          <div key={f.key}>
            <label htmlFor={id} className="mb-1 block text-muted">{f.label}</label>
            {f.kind === 'chips' ? (
              <ChipsField id={id} value={Array.isArray(v) ? (v as string[]) : []} onChange={(next) => onChange(f.key, next)} />
            ) : f.kind === 'card' ? (
              <ItemPicker
                value={typeof v === 'string' ? v : null}
                options={cardOptions}
                placeholder="Escolher card…"
                onChange={(cid) => onChange(f.key, cid)}
              />
            ) : f.kind === 'longtext' ? (
              <textarea id={id} rows={3} value={String(v ?? '')} onChange={(e) => onChange(f.key, e.target.value)} className={`${inputCls} resize-y`} />
            ) : f.kind === 'number' ? (
              <input
                id={id}
                type="number"
                value={typeof v === 'number' ? v : ''}
                onChange={(e) => onChange(f.key, e.target.value === '' ? null : Number(e.target.value))}
                className={inputCls}
              />
            ) : f.kind === 'select' ? (
              <select id={id} value={String(v ?? '')} onChange={(e) => onChange(f.key, e.target.value)} className={inputCls}>
                <option value=""></option>
                {(f.options ?? []).map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            ) : (
              <input id={id} value={String(v ?? '')} onChange={(e) => onChange(f.key, e.target.value)} className={inputCls} />
            )}
          </div>
        )
      })}
    </div>
  )
}
