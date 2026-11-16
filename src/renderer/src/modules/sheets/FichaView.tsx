import { useState } from 'react'
import type { FichaValue, SheetAttr, SheetDetail, SheetSavePatch } from '@shared/types'
import { ts } from '@/i18n/sheets'

const newKey = (): string => `a${Math.random().toString(36).slice(2, 8)}`
const field = 'w-full rounded border border-line bg-raised px-3 py-2'

interface Props {
  detail: SheetDetail
  save: (patch: SheetSavePatch) => void
}

export function FichaView({ detail, save }: Props): JSX.Element {
  const attrs = detail.attrs
  const [selKey, setSelKey] = useState<string | null>(attrs[0]?.key ?? null)
  const current = attrs.find((a) => a.key === selKey) ?? attrs[0] ?? null
  const cur: FichaValue = (current && detail.values[current.key]) || { value: null, note: '' }

  const setVal = (key: string, p: Partial<FichaValue>): void => {
    const prev = detail.values[key] ?? { value: null, note: '' }
    save({ values: { ...detail.values, [key]: { ...prev, ...p } } })
  }
  const setAttrs = (next: SheetAttr[]): void => save({ attrs: next })

  const addAttr = (): void => {
    const key = newKey()
    setAttrs([...attrs, { key, label: ts.attrName, options: [] }])
    setSelKey(key)
  }
  const updateAttr = (key: string, p: Partial<SheetAttr>): void =>
    setAttrs(attrs.map((a) => (a.key === key ? { ...a, ...p } : a)))
  const removeAttr = (a: SheetAttr): void => {
    if (!window.confirm(ts.confirmRemoveAttr(a.label))) return
    const { [a.key]: _gone, ...rest } = detail.values
    save({ attrs: attrs.filter((x) => x.key !== a.key), values: rest })
    setSelKey(attrs.find((x) => x.key !== a.key)?.key ?? null)
  }

  return (
    <div className="flex h-full">
      <nav className="w-64 shrink-0 overflow-y-auto border-r border-line bg-panel p-3" aria-label={ts.attributes}>
        <ul className="space-y-1">
          {attrs.map((a) => {
            const v = detail.values[a.key]
            const active = a.key === current?.key
            return (
              <li key={a.key}>
                <button
                  onClick={() => setSelKey(a.key)}
                  aria-current={active}
                  className={`w-full rounded px-3 py-2 text-left ${active ? 'bg-raised text-ink' : 'text-muted hover:text-ink'}`}
                >
                  <span className="block font-medium">{a.label}</span>
                  <span className={`block truncate text-sm ${v?.value ? 'text-ink/80' : 'italic text-muted/70'}`}>
                    {v?.value || ts.notFilled}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        <button onClick={addAttr} className="mt-3 px-3 text-accent hover:underline">{ts.addAttr}</button>
      </nav>

      <section className="min-w-0 flex-1 overflow-y-auto px-10 py-8">
        {!current ? (
          <p className="text-muted">{ts.empty}</p>
        ) : (
          <div className="mx-auto max-w-2xl">
            <div className="mb-1 flex items-center gap-3">
              <input
                aria-label={ts.attrName}
                value={current.label}
                onChange={(e) => updateAttr(current.key, { label: e.target.value })}
                className="min-w-0 flex-1 bg-transparent font-serif text-4xl leading-tight outline-none"
              />
              <button onClick={() => removeAttr(current)} className="text-sm text-muted hover:text-danger">{ts.removeAttr}</button>
            </div>
            <p className="mb-6 text-sm text-muted">{current.options.length ? ts.chooseHint : ts.noOptions}</p>

            {current.options.length > 0 && (
              <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label={current.label}>
                {current.options.map((opt) => {
                  const on = cur.value === opt
                  return (
                    <button
                      key={opt}
                      aria-pressed={on}
                      onClick={() => setVal(current.key, { value: on ? null : opt })}
                      className={`rounded-full border px-4 py-1.5 text-[15px] transition-colors ${
                        on ? 'border-accent bg-accent text-accent-ink' : 'border-line text-muted hover:border-muted hover:text-ink'
                      }`}
                    >
                      {opt}
                    </button>
                  )
                })}
              </div>
            )}

            <label htmlFor="fx-custom" className="mb-1 block text-muted">{ts.custom}</label>
            <input
              id="fx-custom"
              value={cur.value ?? ''}
              onChange={(e) => setVal(current.key, { value: e.target.value || null })}
              className={`${field} mb-6`}
            />

            <label htmlFor="fx-notes" className="mb-1 block text-muted">{ts.notes}</label>
            <textarea
              id="fx-notes"
              rows={8}
              value={cur.note}
              placeholder={ts.notesPlaceholder}
              onChange={(e) => setVal(current.key, { note: e.target.value })}
              className={`${field} mb-8 resize-y leading-relaxed`}
            />

            <details className="rounded border border-line p-4">
              <summary className="cursor-pointer text-muted">{ts.options}</summary>
              <textarea
                aria-label={ts.options}
                rows={2}
                defaultValue={current.options.join(', ')}
                onBlur={(e) => {
                  const opts = e.target.value.split(',').map((o) => o.trim()).filter(Boolean)
                  if (opts.join('|') !== current.options.join('|')) updateAttr(current.key, { options: opts })
                }}
                className={`${field} mt-3`}
              />
              <p className="mt-2 text-xs text-muted">{ts.optionsHint}</p>
            </details>
          </div>
        )}
      </section>
    </div>
  )
}
