type Json = { type?: string; attrs?: Record<string, unknown>; content?: Json[] } & Record<string, unknown>

/** Atualiza o texto das @menções com os títulos atuais dos cards (títulos podem ter mudado). */
export function refreshMentionLabels(doc: Record<string, unknown>, titleById: Map<string, string>): Record<string, unknown> {
  const walk = (n: Json): Json => {
    const next: Json = { ...n }
    if (n.type === 'mention' && typeof n.attrs?.id === 'string') {
      const title = titleById.get(n.attrs.id)
      if (title) next.attrs = { ...n.attrs, label: title }
    }
    if (n.content) next.content = n.content.map(walk)
    return next
  }
  return walk(doc as Json)
}

export const norm = (s: string): string =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/** Texto simples de um documento TipTap (para prévias). */
export function docToText(doc: unknown): string {
  type N = { type?: string; text?: string; attrs?: { label?: string }; content?: N[] }
  const walk = (n: N): string => {
    if (n.type === 'text') return n.text ?? ''
    if (n.type === 'mention') return `@${n.attrs?.label ?? ''}`
    if (n.type === 'tagMention') return `#${n.attrs?.label ?? ''}`
    const inner = (n.content ?? []).map(walk).join('')
    return ['paragraph', 'heading', 'listItem', 'blockquote'].includes(n.type ?? '') ? inner + '\n' : inner
  }
  return walk(doc as N).trim()
}
