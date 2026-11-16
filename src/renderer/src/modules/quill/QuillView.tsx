import { useEffect, useRef, useState } from 'react'
import type { QuillBook, QuillChapter, QuillChapterPatch } from '@shared/types'
import { RichEditor } from '@/modules/cards/RichEditor'
import { tq } from '@/i18n/quill'
import { docToText } from '@/lib/mentions'
import { useCards } from '@/store/cards'
import { useQuill } from '@/store/quill'
import { useUi } from '@/store/ui'
import { EventsReadPanel, NotesPanel, RadioPanel, VersionsPanel, WorldPanel, type PanelKey } from './QuillPanels'

const countWords = (doc: Record<string, unknown>): number => {
  const t = docToText(doc).trim()
  return t ? t.split(/\s+/).length : 0
}

const PANELS: PanelKey[] = ['notes', 'world', 'versions', 'radio', 'events']

export function QuillView({ bookId }: { bookId: string }): JSX.Element {
  const book: QuillBook | null = useQuill((s) => s.books.find((b) => b.id === bookId) ?? null)
  const removeBook = useQuill((s) => s.remove)
  const openCard = useCards((s) => s.openCard)
  const openNameDialog = useUi((s) => s.openNameDialog)
  const focusMode = useUi((s) => s.focusMode)
  const setFocusMode = useUi((s) => s.setFocusMode)

  const [chapters, setChapters] = useState<QuillChapter[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [panel, setPanel] = useState<PanelKey | null>('notes')
  const [saving, setSaving] = useState(false)
  const [editorRev, setEditorRev] = useState(0)
  const timers = useRef(new Map<string, number>())
  const pending = useRef(new Map<string, QuillChapterPatch>())

  const active = chapters.find((c) => c.id === activeId) ?? chapters[0] ?? null

  // ---------- carregamento ----------
  useEffect(() => {
    let alive = true
    window.api.quill.chapters(bookId).then((cs) => {
      if (!alive) return
      setChapters(cs)
      setActiveId(cs[0]?.id ?? null)
    })
    return () => {
      alive = false
    }
  }, [bookId])

  // ---------- salvamento com atraso ----------
  const flush = (id: string): void => {
    const p = pending.current.get(id)
    window.clearTimeout(timers.current.get(id))
    timers.current.delete(id)
    if (!p) return
    pending.current.delete(id)
    setSaving(pending.current.size > 0 || timers.current.size > 0)
    void window.api.quill.updateChapter(id, p)
  }
  const flushAll = (): void => [...pending.current.keys()].forEach(flush)

  const queue = (id: string, patch: QuillChapterPatch): void => {
    setChapters((cs) =>
      cs.map((c) =>
        c.id !== id
          ? c
          : {
              ...c,
              title: patch.title ?? c.title,
              notes: patch.notes ?? c.notes,
              content: patch.content ?? c.content,
              word_count: patch.word_count ?? c.word_count
            }
      )
    )
    pending.current.set(id, { ...pending.current.get(id), ...patch })
    setSaving(true)
    window.clearTimeout(timers.current.get(id))
    timers.current.set(id, window.setTimeout(() => flush(id), 700))
  }

  // Salva o que faltou ao sair do livro.
  useEffect(() => () => flushAll(), [])
  useEffect(() => () => setFocusMode(false), [setFocusMode])

  const switchTo = (id: string): void => {
    flushAll()
    setActiveId(id)
  }

  // ---------- capítulos ----------
  const addChapter = async (): Promise<void> => {
    flushAll()
    const ch = await window.api.quill.createChapter(bookId, '')
    setChapters((cs) => [...cs, ch])
    setActiveId(ch.id)
  }
  const moveChapter = async (c: QuillChapter, dir: -1 | 1): Promise<void> => {
    flushAll()
    await window.api.quill.moveChapter(c.id, dir)
    setChapters(await window.api.quill.chapters(bookId))
  }
  const removeChapter = async (c: QuillChapter): Promise<void> => {
    if (!window.confirm(tq.confirmRemoveChapter(c.title))) return
    pending.current.delete(c.id)
    await window.api.quill.removeChapter(c.id)
    const rest = chapters.filter((x) => x.id !== c.id)
    setChapters(rest)
    if (activeId === c.id) setActiveId(rest[0]?.id ?? null)
  }

  // Ao restaurar uma versão, o editor é recriado com o texto novo.
  const restored = async (): Promise<void> => {
    const cs = await window.api.quill.chapters(bookId)
    setChapters(cs)
    setEditorRev((n) => n + 1)
  }

  // Esc sai do modo foco.
  useEffect(() => {
    if (!focusMode) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setFocusMode(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focusMode, setFocusMode])

  if (!book) return <div className="p-10 text-muted">…</div>

  const bookWords = chapters.reduce((n, c) => n + c.word_count, 0)
  const editor = active && (
    <RichEditor
      key={`${active.id}:${editorRev}`}
      initialContent={active.content}
      selfId=""
      onChange={(doc) => queue(active.id, { content: doc, word_count: countWords(doc) })}
      onOpenCard={openCard}
    />
  )

  // ---------- modo foco ----------
  if (focusMode) {
    return (
      <div className="flex h-full min-w-0 flex-col">
        <div className="flex items-center justify-between px-8 py-3 text-sm text-muted">
          <span className="truncate">{active?.title || tq.untitled}</span>
          <span>
            {active ? tq.words(active.word_count) : ''} · <button onClick={() => setFocusMode(false)} className="hover:text-ink">{tq.exitFocus}</button>
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-24">
          <div className="mx-auto max-w-[68ch] pt-6">{editor}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-w-0">
      {/* capítulos */}
      <nav className="flex w-60 shrink-0 flex-col border-r border-line bg-panel">
        <div className="border-b border-line px-4 py-3">
          <h1 className="truncate font-serif text-xl">{book.title}</h1>
          <p className="mt-0.5 text-xs text-muted">{tq.bookWords(bookWords)}</p>
          <div className="mt-2 flex gap-3 text-xs">
            <button onClick={() => openNameDialog({ title: tq.rename, label: tq.bookTitle, initial: book.title, submit: tq.rename, onSubmit: (v) => window.api.quill.updateBook(bookId, { title: v }).then(() => useQuill.setState((s) => ({ books: s.books.map((b) => (b.id === bookId ? { ...b, title: v } : b)) }))) })} className="text-muted hover:text-ink">{tq.rename}</button>
            <button onClick={() => window.confirm(tq.confirmRemoveBook(book.title)) && removeBook(bookId)} className="text-muted hover:text-danger">{tq.removeBook}</button>
          </div>
        </div>
        <div className="flex items-center justify-between px-4 pb-1 pt-3 text-muted">
          <span>{tq.chapters}</span>
          <button onClick={addChapter} className="text-accent hover:underline">{tq.newChapter}</button>
        </div>
        <ol className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
          {chapters.map((c, i) => {
            const on = c.id === active?.id
            return (
              <li key={c.id} className="group flex items-center gap-1">
                <button onClick={() => switchTo(c.id)} aria-current={on} className={`min-w-0 flex-1 truncate rounded px-2 py-1.5 text-left ${on ? 'bg-raised text-ink' : 'text-muted hover:text-ink'}`}>
                  <span className="text-xs text-muted/70">{i + 1}. </span>{c.title || tq.untitled}
                </button>
                <span className="invisible flex shrink-0 group-hover:visible">
                  <button aria-label={`${tq.moveUp}: ${c.title}`} disabled={i === 0} onClick={() => moveChapter(c, -1)} className="px-1 text-xs text-muted hover:text-ink disabled:opacity-30">↑</button>
                  <button aria-label={`${tq.moveDown}: ${c.title}`} disabled={i === chapters.length - 1} onClick={() => moveChapter(c, 1)} className="px-1 text-xs text-muted hover:text-ink disabled:opacity-30">↓</button>
                  <button aria-label={`${tq.removeChapter}: ${c.title}`} onClick={() => removeChapter(c)} className="px-1 text-xs text-muted hover:text-danger">×</button>
                </span>
              </li>
            )
          })}
        </ol>
      </nav>

      {/* escrita */}
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-line px-6 py-2 text-sm text-muted">
          <span className="text-xs">{saving ? tq.saving : tq.saved}</span>
          <span>{active ? tq.words(active.word_count) : ''}</span>
          <span className="ml-auto flex gap-1">
            {PANELS.map((p) => (
              <button key={p} aria-pressed={panel === p} onClick={() => setPanel(panel === p ? null : p)} className={`rounded px-2.5 py-1 ${panel === p ? 'bg-raised text-ink' : 'hover:text-ink'}`}>
                {tq.panels[p]}
              </button>
            ))}
            <button onClick={() => setFocusMode(true)} className="ml-2 rounded border border-line px-2.5 py-1 hover:text-ink">{tq.focus}</button>
          </span>
        </div>

        {active && (
          <div className="min-h-0 flex-1 overflow-y-auto px-10 py-8">
            <div className="mx-auto max-w-3xl">
              <input
                aria-label={tq.chapterTitle}
                value={active.title}
                placeholder={tq.untitled}
                onChange={(e) => queue(active.id, { title: e.target.value })}
                className="mb-6 w-full bg-transparent font-serif text-4xl leading-tight outline-none placeholder:text-muted/40"
              />
              {editor}
            </div>
          </div>
        )}
      </section>

      {/* painel lateral */}
      {panel && (
        <aside className="w-80 shrink-0 overflow-y-auto border-l border-line bg-panel p-4">
          <h3 className="mb-3 font-serif text-lg">{tq.panels[panel]}</h3>
          {panel === 'notes' && active && <div className="h-[70vh]"><NotesPanel chapter={active} onChange={(notes) => queue(active.id, { notes })} /></div>}
          {panel === 'world' && <WorldPanel onOpenCard={openCard} />}
          {panel === 'versions' && active && <VersionsPanel chapter={active} onRestored={restored} />}
          {panel === 'radio' && <RadioPanel />}
          {panel === 'events' && <EventsReadPanel onOpenCard={openCard} />}
        </aside>
      )}
    </div>
  )
}
