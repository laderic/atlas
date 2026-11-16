import type { CardField } from '@shared/types'

/** Propriedades que todo evento tem, além das do tipo do card. */
export const EVENT_FIELDS: CardField[] = [
  { key: 'evLocal', label: 'Local', kind: 'card', options: [] },
  { key: 'evCausa', label: 'Causa', kind: 'longtext', options: [] },
  { key: 'evResultado', label: 'Resultado', kind: 'longtext', options: [] }
]
