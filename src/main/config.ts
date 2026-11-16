import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync } from 'fs'

export type Lang = 'pt-BR' | 'en'

const file = (): string => join(app.getPath('userData'), 'config.json')

export function getLang(): Lang {
  try {
    const c = JSON.parse(readFileSync(file(), 'utf-8')) as { lang?: string }
    return c.lang === 'en' ? 'en' : 'pt-BR'
  } catch {
    return 'pt-BR'
  }
}

export function setLangConfig(lang: Lang): void {
  writeFileSync(file(), JSON.stringify({ lang }, null, 2))
}
