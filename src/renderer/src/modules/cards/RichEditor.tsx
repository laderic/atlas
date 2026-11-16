import { useRef, useState } from 'react'
import { Bold, Eraser, Heading2, Image as ImageIcon, Italic, List, Map as MapIcon, Minus, Plus, Quote } from 'lucide-react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Mention from '@tiptap/extension-mention'
import Placeholder from '@tiptap/extension-placeholder'
import Image from '@tiptap/extension-image'
import TextStyle from '@tiptap/extension-text-style'
import { PluginKey } from '@tiptap/pm/state'
import type { SuggestionProps } from '@tiptap/suggestion'
import { tc } from '@/i18n/cards'
import { tg } from '@/i18n/tags'
import { norm } from '@/lib/mentions'
import { mediaUrl } from '@/lib/media'
import { useCards } from '@/store/cards'
import { useWorkspace } from '@/store/workspace'
import { MediaPicker } from '@/modules/media/MediaPicker'
import type { MediaItem } from '@shared/types'

interface Item {
  id: string
  label: string
  color: string
  create?: boolean
  tagCreate?: boolean
}

const UNKNOWN_COLOR = '#7a7f8c'
// Tag é outro nó do editor: mesmo comportamento da menção, com "#" e chave própria.
const TagMention = Mention.extend({ name: 'tagMention' })
// Estilo do texto (fonte, tamanho, região) guardado como um texto de estilo CSS.
const CssStyle = TextStyle.extend({
  addAttributes() {
    return {
      css: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('style') || null,
        renderHTML: (attrs: { css?: string | null }) => (attrs.css ? { style: attrs.css } : {})
      }
    }
  }
})

const parseCss = (s: string): Record<string, string> =>
  Object.fromEntries(
    s.split(';').map((x) => x.split(':').map((y) => y.trim())).filter(([k, v]) => !!k && !!v) as [string, string][]
  )
const toCss = (o: Record<string, string>): string =>
  Object.entries(o).map(([k, v]) => `${k}: ${v}`).join('; ')

const FONTS: { label: string; value: string }[] = [
  { label: 'Padrão', value: '' },
  { label: 'Serifada (Georgia)', value: 'Georgia, serif' },
  { label: 'Clássica (Palatino)', value: "'Palatino Linotype', Palatino, serif" },
  { label: 'Sans (Segoe UI)', value: "'Segoe UI', sans-serif" },
  { label: 'Máquina (Consolas)', value: 'Consolas, monospace' }
]
const SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 40, 48]

/** Popup das menções (@ para cards, # para tags) feito em DOM puro. */
function createMentionPopup() {
  let el: HTMLDivElement | null = null
  let items: Item[] = []
  let selected = 0
  let command: (item: Item) => void = () => {}

  const paint = (): void => {
    if (!el) return
    el.replaceChildren()
    if (items.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'mention-empty'
      empty.textContent = tc.mentionNone
      el.appendChild(empty)
      return
    }
    items.forEach((item, i) => {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'mention-item' + (i === selected ? ' is-selected' : '')
      const dot = document.createElement('span')
      dot.className = 'mention-dot'
      dot.style.background = item.color
      const name = document.createElement('span')
      name.textContent = item.create ? (item.tagCreate ? tg.createTag(item.label) : tc.createStub(item.label)) : item.label
      b.append(dot, name)
      b.addEventListener('mousedown', (e) => {
        e.preventDefault()
        pick(item)
      })
      el!.appendChild(b)
    })
  }

  // Criar: cria o card (tipo Desconhecido) ou a tag, e só então insere a menção.
  const pick = (item: Item): void => {
    if (!item.create) {
      command(item)
      return
    }
    if (item.tagCreate) {
      void useCards.getState().createTag(item.label).then((t) => {
        if (t) command({ id: t.id, label: t.name, color: t.color })
      })
      return
    }
    const worldId = useWorkspace.getState().activeWorldId
    if (!worldId) return
    void window.api.cards.createStub(worldId, item.label).then(async (c) => {
      await useCards.getState().load(worldId)
      command({ id: c.id, label: c.title, color: UNKNOWN_COLOR })
    })
  }

  const place = (props: SuggestionProps<Item>): void => {
    const rect = props.clientRect?.()
    if (!el || !rect) return
    el.style.left = `${Math.min(rect.left, window.innerWidth - 280)}px`
    el.style.top = `${rect.bottom + 6}px`
  }

  const sync = (props: SuggestionProps<Item>): void => {
    items = props.items
    command = props.command
    if (selected >= items.length) selected = 0
    paint()
    place(props)
  }

  return {
    onStart: (props: SuggestionProps<Item>) => {
      el = document.createElement('div')
      el.className = 'mention-popup'
      document.body.appendChild(el)
      selected = 0
      sync(props)
    },
    onUpdate: (props: SuggestionProps<Item>) => sync(props),
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === 'ArrowDown') { selected = (selected + 1) % Math.max(items.length, 1); paint(); return true }
      if (event.key === 'ArrowUp') { selected = (selected - 1 + items.length) % Math.max(items.length, 1); paint(); return true }
      if (event.key === 'Enter' || event.key === 'Tab') {
        if (items[selected]) { pick(items[selected]); return true }
      }
      if (event.key === 'Escape') { el?.remove(); el = null; return true }
      return false
    },
    onExit: () => {
      el?.remove()
      el = null
    }
  }
}

interface Props {
  initialContent: Record<string, unknown>
  selfId: string
  onChange: (doc: Record<string, unknown>) => void
  onOpenCard: (id: string) => void
}

export function RichEditor({ initialContent, selfId, onChange, onOpenCard }: Props): JSX.Element {
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const [picking, setPicking] = useState(false)

  const editor = useEditor({
    content: initialContent,
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder: tc.editorPlaceholder }),
      CssStyle,
      Mention.configure({
        HTMLAttributes: { class: 'mention' },
        suggestion: {
          char: '@',
          pluginKey: new PluginKey('cardMention'),
          items: ({ query }: { query: string }): Item[] => {
            const { cards, types } = useCards.getState()
            const raw = query.trim()
            const q = norm(raw)
            const color = (typeId: string | null): string => types.find((t) => t.id === typeId)?.color ?? '#9a9cab'
            const found: Item[] = cards
              .filter((c) => c.id !== selfId && (!q || norm(c.title).includes(q)))
              .slice(0, 8)
              .map((c) => ({ id: c.id, label: c.title, color: color(c.type_id) }))
            const exact = cards.some((c) => norm(c.title) === q)
            if (raw && !exact) found.push({ id: '__create__', label: raw, color: UNKNOWN_COLOR, create: true })
            return found
          },
          render: createMentionPopup
        }
      }),
      // Imagem da biblioteca de mídia; guarda o id para a wiki e a exportação.
      Image.extend({
        addAttributes() {
          return { ...this.parent?.(), mediaId: { default: null } }
        }
      }).configure({ inline: false, allowBase64: false }),
      TagMention.configure({
        HTMLAttributes: { class: 'tag-mention' },
        suggestion: {
          char: '#',
          pluginKey: new PluginKey('tagMention'),
          items: ({ query }: { query: string }): Item[] => {
            const raw = query.trim()
            const q = norm(raw)
            const tags = useCards.getState().tags
            const found: Item[] = tags
              .filter((t) => !q || norm(t.name).includes(q))
              .slice(0, 8)
              .map((t) => ({ id: t.id, label: t.name, color: t.color }))
            const exact = tags.some((t) => norm(t.name) === q)
            if (raw && !exact) found.push({ id: '__create__', label: raw, color: '#e0a96d', create: true, tagCreate: true })
            return found
          },
          render: createMentionPopup
        }
      })
    ],
    onUpdate: ({ editor: e }) => onChangeRef.current(e.getJSON() as Record<string, unknown>)
  })

  if (!editor) return <div />

  const btn = (label: string, active: boolean, run: () => void, title?: string): JSX.Element => (
    <button
      type="button"
      aria-pressed={active}
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={run}
      className={`rounded px-2.5 py-1 ${active ? 'bg-raised text-ink' : 'text-muted hover:text-ink'}`}
    >
      {label}
    </button>
  )

  // Estilo atual do texto selecionado (ou do que for digitado a seguir).
  const css = parseCss(editor.getAttributes('textStyle').css ?? '')
  const size = parseInt(css['font-size'] ?? '16', 10) || 16
  const setCss = (patch: Record<string, string | null>): void => {
    const next = { ...css }
    for (const [k, v] of Object.entries(patch)) {
      if (v) next[k] = v
      else delete next[k]
    }
    editor.chain().focus().setMark('textStyle', { css: toCss(next) || null }).run()
  }
  const select = 'rounded border border-line bg-raised px-1.5 py-1 text-xs text-ink outline-none'
  const ibtn = (icon: JSX.Element, title: string, active: boolean, run: () => void): JSX.Element => (
    <button
      type="button"
      aria-label={title}
      title={title}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={run}
      className={`flex h-7 w-7 items-center justify-center rounded ${active ? 'bg-raised text-ink' : 'text-muted hover:text-ink'}`}
    >
      {icon}
    </button>
  )

  return (
    <div>
      <div className="sticky top-0 z-10 mb-3 flex flex-wrap items-center gap-1 border-b border-line bg-bg/95 py-1.5">
        {ibtn(<Bold size={15} />, tc.bold, editor.isActive('bold'), () => editor.chain().focus().toggleBold().run())}
        {ibtn(<Italic size={15} />, tc.italic, editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run())}
        {ibtn(<Heading2 size={15} />, tc.heading, editor.isActive('heading', { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run())}
        {ibtn(<List size={15} />, tc.list, editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run())}
        {ibtn(<Quote size={15} />, tc.quote, editor.isActive('blockquote'), () => editor.chain().focus().toggleBlockquote().run())}
        {ibtn(<ImageIcon size={15} />, tc.image, false, () => setPicking(true))}
        <span className="mx-1 h-5 w-px bg-line" />
        <select aria-label={tc.font} title={tc.font} className={select} value={css['font-family'] ?? ''} onChange={(e) => setCss({ 'font-family': e.target.value || null })}>
          {FONTS.map((f) => <option key={f.label} value={f.value}>{f.value ? f.label : tc.fontDefault}</option>)}
        </select>
        <select aria-label={tc.textSize} title={tc.textSize} className={select} value={size} onChange={(e) => setCss({ 'font-size': `${e.target.value}px` })}>
          {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {ibtn(<Minus size={15} />, tc.smaller, false, () => setCss({ 'font-size': `${Math.max(10, size - 2)}px` }))}
        {ibtn(<Plus size={15} />, tc.bigger, false, () => setCss({ 'font-size': `${Math.min(72, size + 2)}px` }))}
        <span className="mx-1 h-5 w-px bg-line" />
        {ibtn(<MapIcon size={15} />, tc.regionStyle, false, () =>
          editor.chain().focus().setMark('textStyle', {
            css: toCss({ 'font-family': 'Georgia, serif', 'font-size': '22px', 'letter-spacing': '0.18em', 'text-transform': 'uppercase', color: '#9bd6c0' })
          }).run()
        )}
        {ibtn(<Eraser size={15} />, tc.clearStyle, false, () => editor.chain().focus().unsetMark('textStyle').run())}
      </div>

      <div
        onClick={(e) => {
          const target = e.target as HTMLElement
          const card = target.closest('[data-type="mention"]')?.getAttribute('data-id')
          if (card) return onOpenCard(card)
          const tagEl = target.closest('[data-type="tagMention"]')
          const tagId = tagEl?.getAttribute('data-id')
          const wid = useWorkspace.getState().activeWorldId
          if (tagId && wid) {
            const tag = useCards.getState().tags.find((t) => t.id === tagId)
            useWorkspace.getState().openTab({ id: `tag:${tagId}`, worldId: wid, kind: 'tag', refId: tagId, title: tag?.name ?? 'Tag' })
          }
        }}
      >
        <EditorContent editor={editor} />
      </div>
      {picking && (
        <MediaPicker
          title={tc.insertImage}
          kinds={['image', 'gif']}
          onClose={() => setPicking(false)}
          onPick={(m: MediaItem) =>
            editor.chain().focus().insertContent({ type: 'image', attrs: { src: mediaUrl(m), alt: m.name, mediaId: m.id } }).run()
          }
        />
      )}
    </div>
  )
}
