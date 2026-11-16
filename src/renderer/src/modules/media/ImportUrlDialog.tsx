import { useState } from 'react'
import { Modal } from '@/components/Modal'
import { t } from '@/i18n/pt-BR'
import { tm } from '@/i18n/media'
import { useMedia } from '@/store/media'

export function ImportUrlDialog({ folderId, onClose }: { folderId: string | null; onClose: () => void }): JSX.Element {
  const importUrls = useMedia((s) => s.importUrls)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  const urls = text.split(/\s+/).map((s) => s.trim()).filter(Boolean)

  const run = async (): Promise<void> => {
    if (urls.length === 0 || busy) return
    setBusy(true)
    setErrors([])
    try {
      const failed = await importUrls(folderId, urls)
      if (failed.length === 0) {
        onClose()
        return
      }
      setErrors(failed)
      // Mantém só os que falharam, para tentar de novo.
      setText(failed.map((e) => e.split(' — ')[0]).join('\n'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={tm.linkTitle} onClose={onClose} width={560}>
      <p className="mb-2 text-muted">{tm.linkHelp}</p>
      <p className="mb-3 text-xs text-muted/80">{tm.linkTip}</p>
      <textarea
        autoFocus
        rows={5}
        value={text}
        disabled={busy}
        placeholder={tm.linkPlaceholder}
        onChange={(e) => setText(e.target.value)}
        aria-label={tm.linkTitle}
        className="mb-3 w-full resize-y rounded border border-line bg-raised px-3 py-2 font-mono text-[13px]"
      />
      {errors.length > 0 && (
        <div role="alert" className="mb-3 rounded border border-danger/50 bg-danger/10 p-3 text-[13px]">
          <p className="mb-1 font-medium">{tm.linkFailed}</p>
          <ul className="space-y-1">
            {errors.map((e) => <li key={e} className="break-all">{e}</li>)}
          </ul>
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="rounded px-4 py-2 text-muted hover:text-ink">{t.cancel}</button>
        <button
          onClick={run}
          disabled={urls.length === 0 || busy}
          className="rounded bg-accent px-4 py-2 font-medium text-accent-ink disabled:opacity-40"
        >
          {busy ? tm.linkWorking : tm.linkRun}
        </button>
      </div>
    </Modal>
  )
}
