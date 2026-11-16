import { useState } from 'react'
import { Modal } from './Modal'
import { t } from '@/i18n/pt-BR'
import { useUi } from '@/store/ui'
import { useWorkspace } from '@/store/workspace'

export function NewWorldDialog(): JSX.Element | null {
  const open = useUi((s) => s.newWorldOpen)
  const setOpen = useUi((s) => s.setNewWorldOpen)
  const createWorld = useWorkspace((s) => s.createWorld)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')

  if (!open) return null
  const close = (): void => {
    setOpen(false)
    setName('')
    setDesc('')
  }
  const submit = async (): Promise<void> => {
    if (!name.trim()) return
    await createWorld(name, desc)
    close()
  }

  return (
    <Modal title={t.newWorld} onClose={close}>
      <label className="mb-1 block text-muted" htmlFor="w-name">{t.newWorldName}</label>
      <input
        id="w-name"
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        className="mb-4 w-full rounded border border-line bg-raised px-3 py-2"
      />
      <label className="mb-1 block text-muted" htmlFor="w-desc">{t.newWorldDesc}</label>
      <textarea
        id="w-desc"
        rows={3}
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        className="mb-5 w-full resize-none rounded border border-line bg-raised px-3 py-2"
      />
      <div className="flex justify-end gap-2">
        <button onClick={close} className="rounded px-4 py-2 text-muted hover:text-ink">{t.cancel}</button>
        <button
          onClick={submit}
          disabled={!name.trim()}
          className="rounded bg-accent px-4 py-2 font-medium text-accent-ink disabled:opacity-40"
        >
          {t.create}
        </button>
      </div>
    </Modal>
  )
}
