import { useEffect, useState } from 'react'
import type { CardField, CardTypeInput, FieldKind } from '@shared/types'
import { t } from '@/i18n/pt-BR'
import { tc } from '@/i18n/cards'
import { useCards } from '@/store/cards'
import { useUi } from '@/store/ui'

const blank = (): CardTypeInput => ({ name: '', color: '#7fb7a4', fields: [] })
const newKey = (): string => `f${Math.random().toString(36).slice(2, 8)}`
const inputCls = 'rounded border border-line bg-raised px-2.5 py-1.5'

export function TypesManager(): JSX.Element {
  const { types, saveType, removeType } = useCards()
  const showToast = useUi((s) => s.showToast)
  const [selected, setSelected] = useState<string | 'new'>(types[0]?.id ?? 'new')
  const [draft, setDraft] = useState<CardTypeInput>(blank())

  useEffect(() => {
    if (selected === 'new') {
      setDraft(blank())
      return
    }
    const ty = types.find((x) => x.id === selected)
    if (ty) setDraft({ id: ty.id, name: ty.name, color: ty.color, icon: ty.icon, fields: ty.fields.map((f) => ({ ...f })) })
  }, [selected, types])

  const setField = (i: number, patch: Partial<CardField>): void =>
    setDraft((d) => ({ ...d, fields: d.fields.map((f, n) => (n === i ? { ...f, ...patch } : f)) }))
  const move = (i: number, dir: -1 | 1): void =>
    setDraft((d) => {
      const j = i + dir
      if (j < 0 || j >= d.fields.length) return d
      const fields = [...d.fields]
      ;[fields[i], fields[j]] = [fields[j], fields[i]]
      return { ...d, fields }
    })

  const onSave = async (): Promise<void> => {
    if (!draft.name.trim()) return
    const saved = await saveType(draft)
    if (saved) {
      setSelected(saved.id)
      showToast(tc.typeSaved)
    }
  }
  const onDelete = async (): Promise<void> => {
    if (!draft.id || !window.confirm(tc.confirmDeleteType(draft.name))) return
    await removeType(draft.id)
    setSelected('new')
  }

  return (
    <div className="flex h-full">
      <nav className="w-56 shrink-0 overflow-y-auto border-r border-line bg-panel p-3" aria-label={tc.types}>
        {types.map((ty) => (
          <button
            key={ty.id}
            onClick={() => setSelected(ty.id)}
            aria-current={selected === ty.id}
            className={`flex w-full items-center gap-2 rounded px-3 py-1.5 text-left ${selected === ty.id ? 'bg-raised text-ink' : 'text-muted hover:text-ink'}`}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: ty.color ?? '#9a9cab' }} />
            {ty.name}
          </button>
        ))}
        <button onClick={() => setSelected('new')} className="mt-2 w-full rounded border border-dashed border-line px-3 py-1.5 text-left text-muted hover:text-ink">
          + {tc.newType}
        </button>
      </nav>

      <div className="min-w-0 flex-1 overflow-y-auto px-10 py-8">
        <div className="max-w-2xl">
          <h1 className="mb-6 font-serif text-3xl">{selected === 'new' ? tc.newType : draft.name || tc.types}</h1>

          <div className="mb-6 flex items-end gap-4">
            <div className="flex-1">
              <label htmlFor="ty-name" className="mb-1 block text-muted">{tc.typeName}</label>
              <input id="ty-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={`${inputCls} w-full`} />
            </div>
            <div>
              <label htmlFor="ty-color" className="mb-1 block text-muted">{tc.typeColor}</label>
              <input id="ty-color" type="color" value={draft.color ?? '#7fb7a4'} onChange={(e) => setDraft({ ...draft, color: e.target.value })} className="h-9 w-14 rounded border border-line bg-raised p-1" />
            </div>
          </div>

          <h2 className="mb-3 font-serif text-xl">{tc.fields}</h2>
          <ul className="space-y-3">
            {draft.fields.map((f, i) => (
              <li key={f.key} className="rounded border border-line bg-panel p-3">
                <div className="flex items-center gap-2">
                  <input
                    aria-label={tc.fieldLabel}
                    placeholder={tc.fieldLabel}
                    value={f.label}
                    onChange={(e) => setField(i, { label: e.target.value })}
                    className={`${inputCls} min-w-0 flex-1`}
                  />
                  <select
                    aria-label="Tipo de propriedade"
                    value={f.kind}
                    onChange={(e) => setField(i, { kind: e.target.value as FieldKind })}
                    className={inputCls}
                  >
                    {(Object.keys(tc.fieldKinds) as FieldKind[]).map((k) => <option key={k} value={k}>{tc.fieldKinds[k]}</option>)}
                  </select>
                  <button aria-label={tc.moveUp} onClick={() => move(i, -1)} className="px-1.5 text-muted hover:text-ink">↑</button>
                  <button aria-label={tc.moveDown} onClick={() => move(i, 1)} className="px-1.5 text-muted hover:text-ink">↓</button>
                  <button aria-label={tc.removeField} onClick={() => setDraft({ ...draft, fields: draft.fields.filter((_, n) => n !== i) })} className="px-1.5 text-muted hover:text-danger">×</button>
                </div>
                {f.kind === 'select' && (
                  <input
                    aria-label={tc.fieldOptions}
                    placeholder={tc.fieldOptions}
                    value={(f.options ?? []).join(', ')}
                    onChange={(e) => setField(i, { options: e.target.value.split(',').map((o) => o.trim()) })}
                    className={`${inputCls} mt-2 w-full`}
                  />
                )}
              </li>
            ))}
          </ul>
          <button
            onClick={() => setDraft({ ...draft, fields: [...draft.fields, { key: newKey(), label: '', kind: 'text' }] })}
            className="mt-3 text-accent hover:underline"
          >
            + {tc.addField}
          </button>

          <div className="mt-8 flex items-center gap-4">
            <button onClick={onSave} disabled={!draft.name.trim()} className="rounded bg-accent px-5 py-2 font-medium text-accent-ink disabled:opacity-40">
              {tc.save}
            </button>
            {draft.id && <button onClick={onDelete} className="text-muted hover:text-danger">{tc.deleteType}</button>}
            <span className="sr-only">{t.app}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
