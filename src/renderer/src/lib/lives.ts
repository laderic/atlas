import type { LifeEnd, LifeStart } from '@shared/types'

const norm = (s: string): string => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const PLACE = /lugar|local|cidade|reino|vila|regiao|fortaleza|ilha|pais|povoado|floresta|montanha|rio|mar/
const FACTION = /faccao|grupo|ordem|guilda|cla|organiz|irmandade|exercito|culto/

/**
 * Rótulos padrão de nascimento e fim, pelo tipo do card:
 * - facção: fundação e dissolução
 * - lugar: fundação e abandono
 * - demais (personagens etc.): nascimento e morte
 */
export function lifeKindFor(typeName: string | null | undefined): { start: LifeStart; end: LifeEnd } {
  const n = norm(typeName ?? '')
  if (FACTION.test(n)) return { start: 'fundacao', end: 'dissolucao' }
  if (PLACE.test(n)) return { start: 'fundacao', end: 'abandono' }
  return { start: 'nascimento', end: 'morte' }
}
