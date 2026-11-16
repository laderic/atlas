import { useEffect, useState } from 'react'
import type { WikiState, WikiTheme } from '@shared/types'
import { tw } from '@/i18n/wiki'
import { useUi } from '@/store/ui'

const field = 'w-full rounded border border-line bg-raised px-3 py-2'

export function WikiView({ worldId }: { worldId: string }): JSX.Element {
  const showToast = useUi((s) => s.showToast)
  const [st, setSt] = useState<WikiState | null>(null)
  const [title, setTitle] = useState('')
  const [domain, setDomain] = useState('')
  const [port, setPort] = useState(4321)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = (): Promise<void> =>
    window.api.wiki.state(worldId).then((s) => {
      setSt(s)
      setTitle(s.settings.title)
      setDomain(s.settings.local_domain)
      setPort(s.settings.port)
    })

  useEffect(() => {
    void load()
  }, [worldId])

  const run = async (key: string, fn: () => Promise<unknown>, ok?: string): Promise<void> => {
    setBusy(key)
    setError(null)
    try {
      await fn()
      if (ok) showToast(ok)
      await load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  if (!st) return <div className="p-10 text-muted">…</div>
  const s = st.settings
  const save = (patch: Partial<typeof s>): Promise<void> => run('save', () => window.api.wiki.save(worldId, patch), tw.saved)

  return (
    <div className="h-full overflow-y-auto px-10 py-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <header>
          <p className="text-xs uppercase tracking-wide text-muted">{tw.wiki}</p>
          <h1 className="font-serif text-4xl">{s.title}</h1>
          <p className="mt-2 text-sm text-muted">{tw.howToText}</p>
        </header>

        <section className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label htmlFor="w-title" className="mb-1 block text-muted">{tw.title}</label>
            <input id="w-title" value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => title.trim() !== s.title && save({ title })} className={field} />
          </div>
          <div>
            <label htmlFor="w-theme" className="mb-1 block text-muted">{tw.theme}</label>
            <select id="w-theme" value={s.theme} onChange={(e) => save({ theme: e.target.value as WikiTheme })} className={field}>
              {(Object.keys(tw.themes) as WikiTheme[]).map((k) => <option key={k} value={k}>{tw.themes[k]}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="w-port" className="mb-1 block text-muted">{tw.port}</label>
            <input id="w-port" type="number" min={1024} max={65535} value={port} onChange={(e) => setPort(Number(e.target.value))} onBlur={() => port !== s.port && save({ port })} className={field} />
          </div>
          <div className="col-span-2">
            <label htmlFor="w-domain" className="mb-1 block text-muted">{tw.domain}</label>
            <input id="w-domain" value={domain} onChange={(e) => setDomain(e.target.value)} onBlur={() => domain.trim() !== s.local_domain && save({ local_domain: domain })} className={field} />
            <p className="mt-1 text-xs text-muted">{tw.domainHelp}</p>
          </div>
          <div className="col-span-2">
            <span className="mb-1 block text-muted">{tw.folder}</span>
            <div className="flex items-center gap-3">
              <code className="min-w-0 flex-1 truncate rounded border border-line bg-raised px-3 py-2 text-sm">{s.output_dir}</code>
              <button
                onClick={async () => {
                  const dir = await window.api.wiki.chooseDir()
                  if (dir) await save({ output_dir: dir })
                }}
                className="rounded border border-line px-3 py-2 hover:bg-raised"
              >
                {tw.chooseFolder}
              </button>
            </div>
          </div>
        </section>

        <section className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => run('publish', async () => {
              const r = await window.api.wiki.publish(worldId)
              showToast(tw.published(r.pages))
            })}
            disabled={busy !== null}
            className="rounded bg-accent px-5 py-2.5 font-medium text-accent-ink disabled:opacity-50"
          >
            {busy === 'publish' ? tw.publishing : tw.publish}
          </button>
          <button onClick={() => run('open', () => window.api.wiki.serve(worldId).then(() => undefined))} disabled={busy !== null} className="rounded border border-line px-4 py-2.5 hover:bg-raised disabled:opacity-50">
            {tw.open}
          </button>
          {st.serving && (
            <button onClick={() => run('stop', () => window.api.wiki.stop())} className="px-2 py-2.5 text-muted hover:text-danger">{tw.stop}</button>
          )}
          <button onClick={() => window.api.wiki.openFolder(worldId)} className="px-2 py-2.5 text-muted hover:text-ink">{tw.openFolder}</button>
          <span className="w-full text-sm text-muted">{st.serving ? `${tw.running} ${st.serving}` : tw.notRunning}</span>
          {error && <p role="alert" className="w-full rounded border border-danger/50 bg-danger/10 p-3 text-sm">{error}</p>}
        </section>

        <section>
          <h2 className="mb-1 font-serif text-2xl">{tw.cardsSection}</h2>
          <p className="mb-3 text-sm text-muted">{tw.cardsHelp}</p>
          {st.cards.length === 0 ? (
            <p className="text-muted">{tw.noCards}</p>
          ) : (
            <ul className="max-h-96 divide-y divide-line overflow-y-auto rounded border border-line">
              {st.cards.map((c) => (
                <li key={c.card_id} className="flex items-center gap-3 px-4 py-2">
                  <input
                    type="checkbox"
                    aria-label={c.title}
                    checked={c.published}
                    onChange={(e) => run(`card:${c.card_id}`, () => window.api.wiki.setPublished(worldId, c.card_id, e.target.checked))}
                  />
                  <span className={`min-w-0 flex-1 truncate ${c.published ? '' : 'text-muted line-through'}`}>{c.title}</span>
                  <span className="shrink-0 text-xs text-muted">{c.type ?? ''}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
