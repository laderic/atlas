import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { getDb } from '../db/connection'
import { plainText } from '../services/search.service'
import type {
  QuillBook, QuillChapter, QuillChapterPatch, QuillRevision, RadioStation
} from '@shared/types'

interface BookRow { id: string; world_id: string; title: string; synopsis: string | null; cover_media_id: string | null }
interface ChRow { id: string; book_id: string; title: string; content: string; notes: string | null; position: number; word_count: number }
interface RevRow { id: string; chapter_id: string; content: string; created_at: number }
interface RadRow { id: string; world_id: string; name: string; playlist: string }

const EMPTY_DOC = { type: 'doc', content: [{ type: 'paragraph' }] }
// Uma revisão automática é guardada no máximo a cada 10 minutos de escrita.
const AUTO_REVISION_GAP_MS = 10 * 60 * 1000

const parse = <T>(s: string, fallback: T): T => {
  try {
    return JSON.parse(s) as T
  } catch {
    return fallback
  }
}
const wordsOf = (doc: unknown): number => {
  const t = plainText(doc as never).trim()
  return t ? t.split(/\s+/).length : 0
}

export function registerQuill(): void {
  const db = (): ReturnType<typeof getDb> => getDb()

  const getBook = (id: string): QuillBook => {
    const r = db().prepare('SELECT * FROM quill_books WHERE id = ?').get(id) as BookRow | undefined
    if (!r) throw new Error('Livro não encontrado.')
    return toBook(r)
  }
  const toBook = (r: BookRow): QuillBook => {
    const agg = db().prepare('SELECT COUNT(*) AS n, COALESCE(SUM(word_count), 0) AS w FROM quill_chapters WHERE book_id = ?')
      .get(r.id) as { n: number; w: number }
    return { id: r.id, world_id: r.world_id, title: r.title, synopsis: r.synopsis, cover_media_id: r.cover_media_id, chapters: agg.n, words: agg.w }
  }
  const toChapter = (r: ChRow): QuillChapter => ({
    id: r.id, book_id: r.book_id, title: r.title, content: parse(r.content, EMPTY_DOC), notes: r.notes ?? '', position: r.position, word_count: r.word_count
  })
  const getChapterRow = (id: string): ChRow => {
    const r = db().prepare('SELECT * FROM quill_chapters WHERE id = ?').get(id) as ChRow | undefined
    if (!r) throw new Error('Capítulo não encontrado.')
    return r
  }
  const snapshotOf = (chapterId: string, content: string): void => {
    if (wordsOf(parse(content, EMPTY_DOC)) === 0) return
    db().prepare('INSERT INTO quill_revisions (id, chapter_id, content, created_at) VALUES (?, ?, ?, ?)')
      .run(randomUUID(), chapterId, content, Date.now())
  }

  // ---------- livros ----------
  ipcMain.handle('quill:books', (_e, worldId: string): QuillBook[] =>
    (db().prepare('SELECT * FROM quill_books WHERE world_id = ? ORDER BY title COLLATE NOCASE').all(worldId) as BookRow[]).map(toBook)
  )

  ipcMain.handle('quill:createBook', (_e, worldId: string, title: string): QuillBook => {
    const id = randomUUID()
    db().prepare('INSERT INTO quill_books (id, world_id, title) VALUES (?, ?, ?)').run(id, worldId, title.trim() || 'Livro sem título')
    db().prepare('INSERT INTO quill_chapters (id, book_id, title, content, position) VALUES (?, ?, ?, ?, 0)')
      .run(randomUUID(), id, 'Capítulo 1', JSON.stringify(EMPTY_DOC))
    return getBook(id)
  })

  ipcMain.handle('quill:updateBook', (_e, id: string, patch: { title?: string; synopsis?: string | null }): void => {
    const cur = getBook(id)
    db().prepare('UPDATE quill_books SET title = ?, synopsis = ? WHERE id = ?').run(
      patch.title !== undefined ? (patch.title.trim() || cur.title) : cur.title,
      'synopsis' in patch ? (patch.synopsis ?? null) : cur.synopsis,
      id
    )
  })

  ipcMain.handle('quill:removeBook', (_e, id: string): void => {
    db().prepare('DELETE FROM quill_books WHERE id = ?').run(id)
  })

  // ---------- capítulos ----------
  ipcMain.handle('quill:chapters', (_e, bookId: string): QuillChapter[] =>
    (db().prepare('SELECT * FROM quill_chapters WHERE book_id = ? ORDER BY position').all(bookId) as ChRow[]).map(toChapter)
  )

  ipcMain.handle('quill:createChapter', (_e, bookId: string, title: string): QuillChapter => {
    const id = randomUUID()
    const pos = (db().prepare('SELECT COALESCE(MAX(position), -1) + 1 AS p FROM quill_chapters WHERE book_id = ?')
      .get(bookId) as { p: number }).p
    const n = (db().prepare('SELECT COUNT(*) AS n FROM quill_chapters WHERE book_id = ?').get(bookId) as { n: number }).n
    db().prepare('INSERT INTO quill_chapters (id, book_id, title, content, position) VALUES (?, ?, ?, ?, ?)')
      .run(id, bookId, title.trim() || `Capítulo ${n + 1}`, JSON.stringify(EMPTY_DOC), pos)
    return toChapter(getChapterRow(id))
  })

  // Ao mudar o texto, guarda a versão anterior se a última revisão for antiga.
  ipcMain.handle('quill:updateChapter', (_e, id: string, patch: QuillChapterPatch): void => {
    const cur = getChapterRow(id)
    db().transaction(() => {
      if (patch.content !== undefined) {
        const next = JSON.stringify(patch.content)
        if (next !== cur.content) {
          const last = db().prepare('SELECT created_at FROM quill_revisions WHERE chapter_id = ? ORDER BY created_at DESC LIMIT 1')
            .get(id) as { created_at: number } | undefined
          if (!last || Date.now() - last.created_at > AUTO_REVISION_GAP_MS) snapshotOf(id, cur.content)
        }
      }
      db().prepare('UPDATE quill_chapters SET title = ?, content = ?, notes = ?, word_count = ? WHERE id = ?').run(
        patch.title !== undefined ? (patch.title.trim() || 'Sem título') : cur.title,
        patch.content !== undefined ? JSON.stringify(patch.content) : cur.content,
        patch.notes !== undefined ? patch.notes : cur.notes,
        patch.word_count !== undefined ? patch.word_count : cur.word_count,
        id
      )
    })()
  })

  ipcMain.handle('quill:moveChapter', (_e, id: string, dir: -1 | 1): void => {
    const cur = getChapterRow(id)
    const other = db().prepare(
      `SELECT * FROM quill_chapters WHERE book_id = ? AND position ${dir < 0 ? '<' : '>'} ?
        ORDER BY position ${dir < 0 ? 'DESC' : 'ASC'} LIMIT 1`
    ).get(cur.book_id, cur.position) as ChRow | undefined
    if (!other) return
    db().transaction(() => {
      db().prepare('UPDATE quill_chapters SET position = ? WHERE id = ?').run(other.position, id)
      db().prepare('UPDATE quill_chapters SET position = ? WHERE id = ?').run(cur.position, other.id)
    })()
  })

  ipcMain.handle('quill:removeChapter', (_e, id: string): void => {
    db().prepare('DELETE FROM quill_chapters WHERE id = ?').run(id)
  })

  // ---------- versões ----------
  ipcMain.handle('quill:revisions', (_e, chapterId: string): QuillRevision[] =>
    (db().prepare('SELECT * FROM quill_revisions WHERE chapter_id = ? ORDER BY created_at DESC').all(chapterId) as RevRow[])
      .map((r) => {
        const content = parse<Record<string, unknown>>(r.content, EMPTY_DOC)
        return { id: r.id, chapter_id: r.chapter_id, content, created_at: r.created_at, words: wordsOf(content) }
      })
  )

  ipcMain.handle('quill:snapshot', (_e, chapterId: string): void => {
    const cur = getChapterRow(chapterId)
    db().prepare('INSERT INTO quill_revisions (id, chapter_id, content, created_at) VALUES (?, ?, ?, ?)')
      .run(randomUUID(), chapterId, cur.content, Date.now())
  })

  // Restaurar guarda antes o texto atual, então nada se perde.
  ipcMain.handle('quill:restore', (_e, revisionId: string): void => {
    const rev = db().prepare('SELECT * FROM quill_revisions WHERE id = ?').get(revisionId) as RevRow | undefined
    if (!rev) throw new Error('Versão não encontrada.')
    const cur = getChapterRow(rev.chapter_id)
    db().transaction(() => {
      db().prepare('INSERT INTO quill_revisions (id, chapter_id, content, created_at) VALUES (?, ?, ?, ?)')
        .run(randomUUID(), cur.id, cur.content, Date.now())
      db().prepare('UPDATE quill_chapters SET content = ?, word_count = ? WHERE id = ?')
        .run(rev.content, wordsOf(parse(rev.content, EMPTY_DOC)), cur.id)
    })()
  })

  ipcMain.handle('quill:removeRevision', (_e, id: string): void => {
    db().prepare('DELETE FROM quill_revisions WHERE id = ?').run(id)
  })

  // ---------- rádio ----------
  const toStation = (r: RadRow): RadioStation => ({ id: r.id, world_id: r.world_id, name: r.name, playlist: parse<string[]>(r.playlist, []) })

  ipcMain.handle('radio:list', (_e, worldId: string): RadioStation[] =>
    (db().prepare('SELECT * FROM radio_stations WHERE world_id = ? ORDER BY name COLLATE NOCASE').all(worldId) as RadRow[]).map(toStation)
  )
  ipcMain.handle('radio:create', (_e, worldId: string, name: string): RadioStation => {
    const id = randomUUID()
    db().prepare('INSERT INTO radio_stations (id, world_id, name, playlist) VALUES (?, ?, ?, ?)')
      .run(id, worldId, name.trim() || 'Estação', '[]')
    return toStation(db().prepare('SELECT * FROM radio_stations WHERE id = ?').get(id) as RadRow)
  })
  ipcMain.handle('radio:update', (_e, id: string, patch: { name?: string; playlist?: string[] }): RadioStation => {
    const cur = toStation(db().prepare('SELECT * FROM radio_stations WHERE id = ?').get(id) as RadRow)
    db().prepare('UPDATE radio_stations SET name = ?, playlist = ? WHERE id = ?').run(
      patch.name?.trim() || cur.name,
      JSON.stringify(patch.playlist ?? cur.playlist),
      id
    )
    return toStation(db().prepare('SELECT * FROM radio_stations WHERE id = ?').get(id) as RadRow)
  })
  ipcMain.handle('radio:remove', (_e, id: string): void => {
    db().prepare('DELETE FROM radio_stations WHERE id = ?').run(id)
  })
}
