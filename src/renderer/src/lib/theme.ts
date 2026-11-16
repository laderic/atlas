export type ThemeName = 'escuro' | 'claro' | 'pergaminho'

const PALETTES: Record<ThemeName, Record<string, string>> = {
  escuro: {
    '--bg': '#12141c', '--panel': '#181b26', '--raised': '#212536', '--line': '#2e3348',
    '--text': '#ffffff', '--muted': '#9a9cab', '--accent': '#7fb7a4', '--accent-ink': '#0f1a16', '--danger': '#e07a6b'
  },
  claro: {
    '--bg': '#f6f4ee', '--panel': '#ffffff', '--raised': '#ecebe4', '--line': '#d9d5c8',
    '--text': '#000000', '--muted': '#3a3a3a', '--accent': '#2f7d68', '--accent-ink': '#ffffff', '--danger': '#c0392b'
  },
  pergaminho: {
    '--bg': '#ead9b5', '--panel': '#f3e7cc', '--raised': '#e4d3ad', '--line': '#c9b68a',
    '--text': '#000000', '--muted': '#3a2e1a', '--accent': '#8a4b1f', '--accent-ink': '#fff7e6', '--danger': '#a33b2a'
  }
}

const APP_KEY = 'atlas.theme'
const isTheme = (v: unknown): v is ThemeName => v === 'escuro' || v === 'claro' || v === 'pergaminho'

export const getAppTheme = (): ThemeName => {
  try {
    const v = localStorage.getItem(APP_KEY)
    return isTheme(v) ? v : 'escuro'
  } catch {
    return 'escuro'
  }
}

export const setAppTheme = (t: ThemeName): void => {
  try {
    localStorage.setItem(APP_KEY, t)
  } catch {
    /* sem armazenamento */
  }
}

/** Tema do mundo, quando ele escolheu um; senão, o tema do app. */
export const resolveTheme = (worldTheme?: string | null): ThemeName =>
  isTheme(worldTheme) ? worldTheme : getAppTheme()

export function applyTheme(t: ThemeName): void {
  const root = document.documentElement
  for (const [k, v] of Object.entries(PALETTES[t])) root.style.setProperty(k, v)
  root.style.colorScheme = t === 'escuro' ? 'dark' : 'light'
}
