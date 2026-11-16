import { useMemo, useState } from 'react'
import { tmap } from '@/i18n/maps'
import { norm } from '@/lib/mentions'

export interface Option {
  id: string
  label: string
  hint?: string
}

interface Props {
  value: string | null
  options: Option[]
  placeholder: string
  onChange: (id: string | null) => void
}

/** Seletor com busca (usado para vincular card ou submapa). */
export function ItemPicker({ value, options, placeholder, onChange }: Props): JSX.Element {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const current = options.find((o) => o.id === value)

  const list = useMemo(() => {
    const nq = norm(q.trim())
    return options.filter((o) => !nq || norm(o.label).includes(nq)).slice(0, 30)
  }, [options, q])

  return (
    <div className="relative">
      <div className="flex gap-1">
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="min-w-0 flex-1 truncate rounded border border-line bg-raised px-2.5 py-1.5 text-left"
        >
          {value ? (current?.label ?? tmap.removed) : <span className="text-muted">{placeholder}</span>}
        </button>
        {value && (
          <button type="button" aria-label={tmap.none} onClick={() => onChange(null)} className="px-2 text-muted hover:text-danger">×</button>
        )}
      </div>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onMouseDown={() => setOpen(false)} />
          <div className="absolute left-0 right-0 z-20 mt-1 rounded border border-line bg-raised shadow-xl">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={tmap.search}
              aria-label={tmap.search}
              className="w-full border-b border-line bg-transparent px-2.5 py-1.5 outline-none"
            />
            <ul role="listbox" className="max-h-52 overflow-y-auto py-1">
              {list.length === 0 && <li className="px-2.5 py-1.5 text-muted">{tmap.noOptions}</li>}
              {list.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={o.id === value}
                    onClick={() => { onChange(o.id); setOpen(false); setQ('') }}
                    className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left hover:bg-line"
                  >
                    <span className="truncate">{o.label}</span>
                    {o.hint && <span className="shrink-0 text-xs text-muted">{o.hint}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
