import { create } from 'zustand'

const KEY = 'atlas.sidebar'
export const PANEL_MIN = 200
export const PANEL_MAX = 480
const DEFAULT_WIDTH = 260

interface Saved { active: string | null; width: number }

const load = (): Saved => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Saved>
    return {
      active: v.active === undefined ? 'cards' : v.active,
      width: typeof v.width === 'number' ? Math.min(PANEL_MAX, Math.max(PANEL_MIN, v.width)) : DEFAULT_WIDTH
    }
  } catch {
    return { active: 'cards', width: DEFAULT_WIDTH }
  }
}

const save = (s: Saved): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* sem armazenamento: segue só em memória */
  }
}

interface SidebarState extends Saved {
  /** Abre a área; clicar de novo na mesma área fecha o painel. */
  toggle: (id: string) => void
  close: () => void
  setWidth: (w: number) => void
}

export const useSidebar = create<SidebarState>((set, get) => ({
  ...load(),
  toggle: (id) => {
    const active = get().active === id ? null : id
    set({ active })
    save({ active, width: get().width })
  },
  close: () => {
    set({ active: null })
    save({ active: null, width: get().width })
  },
  setWidth: (w) => {
    const width = Math.min(PANEL_MAX, Math.max(PANEL_MIN, Math.round(w)))
    set({ width })
    save({ active: get().active, width })
  }
}))
