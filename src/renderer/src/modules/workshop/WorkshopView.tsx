import { useEffect, useState } from 'react'
import type { WorkshopTemplate, WorkshopTool } from '@shared/types'
import { Modal } from '@/components/Modal'
import { t } from '@/i18n/pt-BR'
import { tc } from '@/i18n/cards'
import { tkSheets } from './labels'
import { to } from '@/i18n/workshop'
import { useCards } from '@/store/cards'
import { useQuill } from '@/store/quill'
import { useSheets } from '@/store/sheets'
import { useUi } from '@/store/ui'
import { useWorkspace } from '@/store/workspace'

export function WorkshopView(): JSX.Element {
  const worldId = useWorkspace((s) => s.activeWorldId)
  const showToast = useUi((s) => s.showToast)
  const openCard = useCards((s) => s.openCard)
  const [tools, setTools] = useState<WorkshopTool[] | null>(null)
  const [pending, setPending] = useState<{ tool: WorkshopTool; tpl: WorkshopTemplate } | null>(null)
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = (): Promise<void> => window.api.workshop.list().then(setTools)
  useEffect(() => {
    void load()
  }, [])

  const act = async (fn: () => Promise<unknown>, ok?: string): Promise<void> => {
    setError(null)
    try {
      await fn()
      if (ok) showToast(ok)
      await load()
    } catch (err) {
      setError(`${to.failed}: ${(err as Error).message}`)
    }
  }

  const install = (): Promise<void> =>
    act(async () => {
      const t2 = await window.api.workshop.install()
      if (t2) showToast(to.installed_ok(t2.name))
    })

  const create = async (): Promise<void> => {
    if (!pending || !worldId) return
    setBusy(true)
    setError(null)
    try {
      const r = await window.api.workshop.create(worldId, pending.tool.id, pending.tpl.id, title)
      if (r.kind === 'card') {
        await useCards.getState().load(worldId)
        openCard(r.id)
      } else {
        await useSheets.getState().load(worldId)
        useSheets.getState().open(r.id)
      }
      await useQuill.getState().load(worldId)
      setPending(null)
      setTitle('')
    } catch (err) {
      setError(`${to.failed}: ${(err as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto px-10 py-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">{t.app}</p>
            <h1 className="font-serif text-4xl">{to.title}</h1>
            <p className="mt-2 max-w-xl text-sm text-muted">{to.intro}</p>
          </div>
          <button onClick={install} className="rounded bg-accent px-4 py-2 font-medium text-accent-ink">{to.install}</button>
        </header>

        {error && <p role="alert" className="rounded border border-danger/50 bg-danger/10 p-3 text-sm">{error}</p>}

        {tools === null ? (
          <p className="text-muted">…</p>
        ) : tools.length === 0 ? (
          <p className="text-muted">{to.none}</p>
        ) : (
          <section>
            <h2 className="mb-3 font-serif text-2xl">{to.installed}</h2>
            <ul className="space-y-4">
              {tools.map((tool) => (
                <li key={tool.id} className="rounded-lg border border-line bg-panel p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-serif text-xl">{tool.name} <span className="text-sm text-muted">v{tool.version}</span></h3>
                      {tool.description && <p className="mt-1 text-sm text-muted">{tool.description}</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-4">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={tool.enabled}
                          onChange={(e) => act(() => window.api.workshop.setEnabled(tool.id, e.target.checked))}
                        />
                        {to.enabled}
                      </label>
                      <button
                        onClick={() => window.confirm(to.confirmRemove(tool.name)) && act(() => window.api.workshop.remove(tool.id))}
                        className="text-sm text-muted hover:text-danger"
                      >
                        {to.remove}
                      </button>
                    </div>
                  </div>

                  <h4 className="mb-2 mt-4 text-sm uppercase tracking-wide text-muted">{to.templates}</h4>
                  {!tool.enabled && <p className="mb-2 text-sm text-muted">{to.disabledHint}</p>}
                  <ul className="divide-y divide-line">
                    {tool.templates.map((tpl) => (
                      <li key={tpl.id} className="flex items-center justify-between gap-3 py-2">
                        <div className="min-w-0">
                          <span className="font-medium">{tpl.name}</span>
                          <span className="ml-2 rounded bg-raised px-2 py-0.5 text-xs text-muted">{tpl.kind === 'ficha' ? tkSheets.ficha : tc.cards}</span>
                          <p className="truncate text-xs text-muted">
                            {tpl.sections.map((s) => s.title).join(' · ') || tpl.fields.map((f) => f.label).join(' · ')}
                          </p>
                        </div>
                        <button
                          disabled={!tool.enabled || !worldId}
                          onClick={() => { setPending({ tool, tpl }); setTitle('') }}
                          className="shrink-0 rounded border border-line px-3 py-1 hover:bg-raised disabled:opacity-40"
                        >
                          {to.create}
                        </button>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {pending && (
        <Modal title={to.createTitle(pending.tpl.name)} onClose={() => setPending(null)} width={460}>
          <label htmlFor="wk-title" className="mb-1 block text-muted">{to.titleLabel}</label>
          <input
            id="wk-title"
            autoFocus
            value={title}
            placeholder={pending.tpl.name}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !busy && create()}
            className="mb-5 w-full rounded border border-line bg-raised px-3 py-2"
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setPending(null)} className="rounded px-4 py-2 text-muted hover:text-ink">{t.cancel}</button>
            <button onClick={create} disabled={busy} className="rounded bg-accent px-4 py-2 font-medium text-accent-ink disabled:opacity-50">{to.create}</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
