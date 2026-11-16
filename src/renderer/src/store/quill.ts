import { create } from 'zustand'
import type { QuillBook } from '@shared/types'
import { tq } from '@/i18n/quill'
import { useUi } from './ui'
import { useWorkspace } from './workspace'

interface QuillState {
  worldId: string | null
  books: QuillBook[]
  load: (worldId: string) => Promise<void>
  create: (title: string) => Promise<void>
  remove: (id: string) => Promise<void>
  open: (id: string) => void
}

const byTitle = (a: QuillBook, b: QuillBook): number => a.title.localeCompare(b.title, 'pt-BR')

export const useQuill = create<QuillState>((set, get) => ({
  worldId: null,
  books: [],

  load: async (worldId) => {
    const books = await window.api.quill.books(worldId)
    if (useWorkspace.getState().activeWorldId !== worldId) return
    set({ worldId, books })
  },

  create: async (title) => {
    const worldId = useWorkspace.getState().activeWorldId
    if (!worldId) return
    const b = await window.api.quill.createBook(worldId, title)
    set((s) => ({ books: [...s.books, b].sort(byTitle) }))
    get().open(b.id)
  },

  remove: async (id) => {
    await window.api.quill.removeBook(id)
    set((s) => ({ books: s.books.filter((b) => b.id !== id) }))
    useWorkspace.getState().closeTab(`quill:${id}`)
  },

  open: (id) => {
    const b = get().books.find((x) => x.id === id)
    if (!b) return
    useWorkspace.getState().openTab({ id: `quill:${id}`, worldId: b.world_id, kind: 'quill', refId: id, title: b.title })
  }
}))

export const askNewBook = (): void =>
  useUi.getState().openNameDialog({
    title: tq.newBook,
    label: tq.bookTitle,
    initial: '',
    submit: tq.create,
    onSubmit: (v) => useQuill.getState().create(v)
  })
