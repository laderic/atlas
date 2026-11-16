import type { CardField } from '@shared/types'

/** Propriedade dos itens: Único (um dono por vez) ou Muitos (podem ser de vários). */
export const QTY_FIELD: CardField = { key: 'quantidade', label: 'Quantidade', kind: 'select', options: ['Único', 'Muitos'] }
