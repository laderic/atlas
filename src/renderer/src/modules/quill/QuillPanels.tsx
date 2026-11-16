import { useEffect, useMemo, useState } from 'react'
import type { Card, QuillChapter, QuillRevision } from '@shared/types'
import { te } from '@/i18n/events'
import { tq } from '@/i18n/quill'
import { docToText, norm } from '@/lib/mentions'
import { useCards } from '@/store/cards'
import { useUi } from '@/store/ui'
import { RadioPanel } from './RadioPanel'

export type PanelKey = 'notes' | 'world' | 'versions' | 'radio' | 'events'

export function NotesPanel({ chapter, onChange }: { chapter: QuillChapter; onChange: (notes: string) => void }): JSX.Element {
  return (
    <textarea
      aria-label={tq.panels.notes}
      value={chapter.notes}
      placeholder={tq.notesPlaceholder}
      onChange={(e) => onChange(e.target.value)}
      className="h-full min-h-64 w-full resize-none rounded border border-line bg-raised p-3 leading-relaxed outline-none focus:border-muted"
    />
  )
}

/** Card do mundo ao lado da escrita, só para leitura. */
export function WorldPanel({ onOpenCard }: { onOpenCard: (id: string) => void }): JSX.Element {
  const cards = useCards((s) => s.cards)
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<Card | null>(null)

  useEffect(() => {
    if (!picked) return
    let alive = true
    window.api.cards.get(picked.id).then((c) => alive && c && setPicked(c))
    return () => {
      alive = false
    }
  }, [picked?.id])

  const list = useMemo(() => {
    const nq = norm(q.trim())
    return cards.filter((c) => !nq || norm(c.title).includes(nq)).slice(0, 40)
  }, [cards, q])

  return (
    <div className="space-y-3">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tq.worldSearch} aria-label={tq.worldSearch} className="w-full rounded border border-line bg-raised px-3 py-1.5" />
      <ul className="max-h-40 space-y-0.5 overflow-y-auto">
        {list.map((c) => (
          <li key={c.id}>
            <button onClick={() => setPicked({ ...c, content: {}, properties: {}, image_id: null, created_at: 0 })} className={`w-full truncate rounded px-2 py-1 text-left ${picked?.id === c.id ? 'bg-raised text-ink' : 'text-muted hover:text-ink'}`}>
              {c.title}
            </button>
          </li>
        ))}
      </ul>
      {!picked ? (
        <p className="text-muted">{tq.worldPick}</p>
      ) : (
        <article className="rounded border border-line p-3">
          <h4 className="mb-2 font-serif text-lg">{picked.title}</h4>
          <p className="mb-3 max-h-64 overflow-y-auto whitespace-pre-wrap text-[13px] leading-relaxed text-ink/85">
            {docToText(picked.content).slice(0, 1800) || '…'}
          </p>
          <button onClick={() => onOpenCard(picked.id)} className="text-accent hover:underline">{tq.openCard}</button>
        </article>
      )}
    </div>
  )
}

export function VersionsPanel({ chapter, onRestored }: { chapter: QuillChapter; onRestored: () => void }): JSX.Element {
  const [revs, setRevs] = useState<QuillRevision[]>([])
  const [busy, setBusy] = useState(false)
  const showToast = useUi((s) => s.showToast)

  const reload = (): Promise<void> => window.api.quill.revisions(chapter.id).then(setRevs)
  useEffect(() => {
    void reload()
  }, [chapter.id, chapter.word_count])

  const snapshot = async (): Promise<void> => {
    setBusy(true)
    await window.api.quill.snapshot(chapter.id)
    await reload()
    setBusy(false)
    showToast(tq.snapshot)
  }
  const restore = async (r: QuillRevision): Promise<void> => {
    if (!window.confirm(tq.confirmRestore)) return
    await window.api.quill.restore(r.id)
    onRestored()
    await reload()
  }
  const remove = async (r: QuillRevision): Promise<void> => {
    await window.api.quill.removeRevision(r.id)
    setRevs((rs) => rs.filter((x) => x.id !== r.id))
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">{tq.versionsHint}</p>
      <button onClick={snapshot} disabled={busy} className="w-full rounded border border-line px-3 py-1.5 hover:bg-raised disabled:opacity-50">{tq.snapshot}</button>
      {revs.length === 0 && <p className="text-muted">{tq.noVersions}</p>}
      <ul className="space-y-2">
        {revs.map((r) => (
          <li key={r.id} className="group rounded border border-line p-2.5">
            <div className="flex items-center justify-between text-sm">
              <span>{new Date(r.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
              <span className="text-xs text-muted">{tq.words(r.words)}</span>
            </div>
            <div className="mt-2 flex gap-3 text-sm">
              <button onClick={() => restore(r)} className="text-accent hover:underline">{tq.restore}</button>
              <button onClick={() => remove(r)} className="invisible text-muted hover:text-danger group-hover:visible">{tq.removeVersion}</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Eventos do mundo para consultar enquanto escreve. */
export function EventsReadPanel({ onOpenCard }: { onOpenCard: (id: string) => void }): JSX.Element {
  const all = useCards((s) => s.cards).filter((c) => !!c.is_event)
  const [sel, setSel] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [parts, setParts] = useState<{ id: string; title: string }[]>([])

  useEffect(() => {
    if (!sel) return
    let alive = true
    void window.api.eventCards.participants(sel).then((ps) => alive && setParts(ps.map((p) => ({ id: p.id, title: p.title }))))
    void window.api.cards.get(sel).then((c) => alive && c && setText(docToText(c.content).slice(0, 1800)))
    return () => {
      alive = false
    }
  }, [sel])

  if (all.length === 0) return <p className="text-muted">{te.noEventsInBook}</p>
  return (
    <div className="space-y-3">
      <ul className="max-h-40 space-y-0.5 overflow-y-auto">
        {all.map((c) => (
          <li key={c.id}>
            <button onClick={() => setSel(c.id)} className={`w-full truncate rounded px-2 py-1 text-left ${sel === c.id ? 'bg-raised text-ink' : 'text-muted hover:text-ink'}`}>
              {c.title}
            </button>
          </li>
        ))}
      </ul>
      {sel && (
        <article className="rounded border border-line p-3">
          <h4 className="mb-2 font-serif text-lg">{all.find((c) => c.id === sel)?.title}</h4>
          <p className="mb-3 max-h-56 overflow-y-auto whitespace-pre-wrap text-[13px] leading-relaxed">{text || '…'}</p>
          {parts.length > 0 && (
            <>
              <p className="mb-1 text-xs uppercase tracking-wide text-muted">{te.involved}</p>
              <ul className="mb-3 space-y-0.5">
                {parts.map((p) => (
                  <li key={p.id}>
                    <button onClick={() => onOpenCard(p.id)} className="truncate text-accent hover:underline">{p.title}</button>
                  </li>
                ))}
              </ul>
            </>
          )}
          <button onClick={() => onOpenCard(sel)} className="text-accent hover:underline">{te.openEvent}</button>
        </article>
      )}
    </div>
  )
}

export { RadioPanel }
