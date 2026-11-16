import { useEffect, useState } from 'react'
import { Modal } from './Modal'
import { t } from '@/i18n/pt-BR'
import { useUi } from '@/store/ui'

export function NameDialog(): JSX.Element | null {
  const dialog = useUi((s) => s.nameDialog)
  const close = useUi((s) => s.closeNameDialog)
  const [value, setValue] = useState('')

  useEffect(() => {
    setValue(dialog?.initial ?? '')
  }, [dialog])

  if (!dialog) return null
  const submit = async (): Promise<void> => {
    if (!value.trim()) return
    await dialog.onSubmit(value.trim())
    close()
  }

  return (
    <Modal title={dialog.title} onClose={close}>
      <label htmlFor="name-input" className="mb-1 block text-muted">{dialog.label}</label>
      <input
        id="name-input"
        autoFocus
        value={value}
        onFocus={(e) => e.target.select()}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        className="mb-5 w-full rounded border border-line bg-raised px-3 py-2"
      />
      <div className="flex justify-end gap-2">
        <button onClick={close} className="rounded px-4 py-2 text-muted hover:text-ink">{t.cancel}</button>
        <button onClick={submit} disabled={!value.trim()} className="rounded bg-accent px-4 py-2 font-medium text-accent-ink disabled:opacity-40">
          {dialog.submit}
        </button>
      </div>
    </Modal>
  )
}
