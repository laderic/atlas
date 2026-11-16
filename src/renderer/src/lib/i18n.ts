export type Lang = 'pt-BR' | 'en'

let current: Lang = 'pt-BR'
export const setLang = (l: Lang): void => {
  current = l === 'en' ? 'en' : 'pt-BR'
}
export const getLang = (): Lang => current

/**
 * Dicionário com troca de idioma: lê o idioma atual a cada acesso.
 * Se uma chave não existir em inglês, mostra o texto em português.
 */
export function bi<T extends object>(pt: T, en: object): T {
  return new Proxy(pt, {
    get(target, key) {
      const ptVal = Reflect.get(target, key) as unknown
      const enVal = current === 'en' ? (en as Record<PropertyKey, unknown>)[key] : undefined
      if (ptVal !== null && typeof ptVal === 'object' && !Array.isArray(ptVal)) {
        return bi(ptVal as object, enVal && typeof enVal === 'object' ? (enVal as object) : {})
      }
      return enVal !== undefined ? enVal : ptVal
    }
  }) as T
}
