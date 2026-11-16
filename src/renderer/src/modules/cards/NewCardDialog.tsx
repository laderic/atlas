import { useEffect, useState } from 'react'
import { Modal } from '@/components/Modal'
import { t } from '@/i18n/pt-BR'
import { tc } from '@/i18n/cards'
import { useCards } from '@/store/cards'
import { useUi } from '@/store/ui'
import { folderPath } from './CardView'

export function NewCardDialog(): JSX.Element | null {
  const req = useUi((s) => s.newCard)
  const close = useUi((s) => s.closeNewCard)
  const { types, folders, createCard } = useCards()
  const [title, setTitle] = useState('')
  const [typeId, setTypeId] = useState('')
  const [folderId, setFolderId] = useState('')

  useEffect(() => {
    if (req) {
      setTitle('')
      setTypeId(types[0]?.id ?? '')
      setFolderId(req.folderId ?? '')
    }
  }, [req, types])

  if (!req) return null
  const submit = async (): Promise<void> => {
    await createCard({ title, type_id: typeId || null, folder_id: folderId || null })
    close()
  }
  const cls = 'mb-4 w-full rounded border border-line bg-raised px-3 py-2'

  return (
    <Modal title={tc.newCard} onClose={close}>
      <label htmlFor="nc-title" className="mb-1 block text-muted">{tc.cardTitle}</label>
      <input id="nc-title" autoFocus value={title} placeholder={tc.untitled} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} className={cls} />
      <label htmlFor="nc-type" className="mb-1 block text-muted">{tc.type}</label>
      <select id="nc-type" value={typeId} onChange={(e) => setTypeId(e.target.value)} className={cls}>
        <option value="">{tc.noType}</option>
        {types.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
      </select>
      <label htmlFor="nc-folder" className="mb-1 block text-muted">{tc.folder}</label>
      <select id="nc-folder" value={folderId} onChange={(e) => setFolderId(e.target.value)} className={`${cls} mb-5`}>
        <option value="">{tc.noFolder}</option>
        {folders.map((f) => <option key={f.id} value={f.id}>{folderPath(folders, f.id)}</option>)}
      </select>
      <div className="flex justify-end gap-2">
        <button onClick={close} className="rounded px-4 py-2 text-muted hover:text-ink">{t.cancel}</button>
        <button onClick={submit} className="rounded bg-accent px-4 py-2 font-medium text-accent-ink">{tc.create}</button>
      </div>
    </Modal>
  )
}
