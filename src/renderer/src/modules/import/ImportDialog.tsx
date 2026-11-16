import { useState } from 'react'
import type { ImportCounts, ImportPickMode, ImportSource, RawImport } from '@shared/types'
import { Modal } from '@/components/Modal'
import { ti } from '@/i18n/import'
import { prepare, type Prepared } from '@/lib/importConvert'
import { useCards } from '@/store/cards'
import { useQuill } from '@/store/quill'
import { useSheets } from '@/store/sheets'
import { useUi } from '@/store/ui'
import { useWorkspace } from '@/store/workspace'

const SOURCES: ImportSource[] = ['obsidian', 'notion', 'worldanvil', 'googledocs', 'word']
const MODE_LABEL: Record<ImportPickMode, string> = { folder: ti.pick.folder, files: ti.pick.files, zip: ti.pick.zip }

export function ImportDialog({ onClose }: { onClose: () => void }): JSX.Element {
  const worldId = useWorkspace((s) => s.activeWorldId)
  const showToast = useUi((s) => s.showToast)
  const [source, setSource] = useState<ImportSource>('obsidian')
  const [paths, setPaths] = useState<string[]>([])
  const [raw, setRaw] = useState<RawImport | null>(null)
  const [prep, setPrep] = useState<Prepared | null>(null)
  const [busy, setBusy] = useState<'pick' | 'scan' | 'import' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cfg = ti.sources[source]

  const pick = async (mode: ImportPickMode): Promise<void> => {
    setBusy('pick')
    setError(null)
    try {
      const chosen = await window.api.import.pick(source, mode)
      if (chosen.length === 0) return
      setPaths(chosen)
      setBusy('scan')
      const r = await window.api.import.scan(source, chosen)
      setRaw(r)
      setPrep(prepare(r))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const reset = (): void => {
    setPaths([])
    setRaw(null)
    setPrep(null)
    setError(null)
  }

  const run = async (): Promise<void> => {
    if (!worldId || !prep) return
    setBusy('import')
    setError(null)
    try {
      const c: ImportCounts = await window.api.import.commit(worldId, prep.payload)
      await Promise.all([
        useCards.getState().load(worldId),
        useSheets.getState().load(worldId),
        useQuill.getState().load(worldId)
      ])
      showToast(ti.done(c))
      onClose()
    } catch (err) {
      setError(`${ti.failed}: ${(err as Error).message}`)
    } finally {
      setBusy(null)
    }
  }

  const empty = prep && prep.counts.cards + prep.counts.tables + prep.counts.books === 0

  return (
    <Modal title={ti.title} onClose={onClose} width={620}>
      <p className="mb-4 text-sm text-muted">{ti.intro}</p>

      <div role="radiogroup" aria-label={ti.title} className="mb-4 flex flex-wrap gap-2">
        {SOURCES.map((s) => (
          <button
            key={s}
            role="radio"
            aria-checked={source === s}
            onClick={() => { setSource(s); reset() }}
            className={`rounded-full border px-3 py-1 text-sm ${source === s ? 'border-accent bg-accent text-accent-ink' : 'border-line text-muted hover:text-ink'}`}
          >
            {ti.sources[s].label}
          </button>
        ))}
      </div>

      {!prep && (
        <>
          <p className="mb-4 rounded border border-line bg-raised p-3 text-sm leading-relaxed">{cfg.help}</p>
          <div className="flex flex-wrap gap-2">
            {cfg.modes.map((m) => (
              <button
                key={m}
                onClick={() => pick(m)}
                disabled={busy !== null}
                className="rounded bg-accent px-4 py-2 font-medium text-accent-ink disabled:opacity-50"
              >
                {busy === 'pick' ? '…' : MODE_LABEL[m]}
              </button>
            ))}
          </div>
          {busy === 'scan' && <p className="mt-4 text-muted">{ti.scanning}</p>}
        </>
      )}

      {prep && raw && (
        <>
          <p className="mb-3 text-sm text-muted">{ti.picked(paths.length)}</p>
          <h3 className="mb-2 font-serif text-lg">{ti.preview}</h3>
          <p className="mb-3">{ti.willImport}</p>
          <ul className="mb-4 list-inside list-disc space-y-1">
            {prep.counts.cards > 0 && <li>{ti.cards(prep.counts.cards)}</li>}
            {prep.counts.tables > 0 && <li>{ti.tables(prep.counts.tables)}</li>}
            {prep.counts.books > 0 && <li>{ti.books(prep.counts.books, prep.counts.chapters)}</li>}
            {empty && <li className="text-muted">{ti.nothing}</li>}
          </ul>

          {raw.warnings.length > 0 && (
            <div className="mb-4 rounded border border-line bg-raised p-3 text-sm">
              <p className="mb-1 font-medium">{ti.warnings}</p>
              <ul className="space-y-1 text-muted">
                {raw.warnings.map((w) => <li key={w}>{w}</li>)}
              </ul>
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <button onClick={reset} disabled={busy !== null} className="rounded px-4 py-2 text-muted hover:text-ink">{ti.back}</button>
            <button
              onClick={run}
              disabled={busy !== null || !!empty}
              className="rounded bg-accent px-5 py-2 font-medium text-accent-ink disabled:opacity-40"
            >
              {busy === 'import' ? ti.importing : ti.start}
            </button>
          </div>
        </>
      )}

      {error && <p role="alert" className="mt-4 rounded border border-danger/50 bg-danger/10 p-3 text-sm">{error}</p>}
    </Modal>
  )
}
