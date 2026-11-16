import { create } from 'zustand'

interface NameDialog {
  title: string
  label: string
  initial: string
  submit: string
  onSubmit: (value: string) => void | Promise<void>
}

interface UiState {
  newWorldOpen: boolean
  paletteOpen: boolean
  toast: string | null
  newCard: { folderId: string | null } | null
  focusMode: boolean
  importOpen: boolean
  settingsOpen: boolean
  setSettingsOpen: (v: boolean) => void
  setImportOpen: (v: boolean) => void
  setFocusMode: (v: boolean) => void
  newMapOpen: boolean
  nameDialog: NameDialog | null
  setNewWorldOpen: (v: boolean) => void
  setPaletteOpen: (v: boolean) => void
  showToast: (msg: string) => void
  openNewCard: (folderId: string | null) => void
  closeNewCard: () => void
  setNewMapOpen: (v: boolean) => void
  openNameDialog: (d: NameDialog) => void
  closeNameDialog: () => void
}

let toastTimer: ReturnType<typeof setTimeout> | undefined

export const useUi = create<UiState>((set) => ({
  newWorldOpen: false,
  paletteOpen: false,
  toast: null,
  newCard: null,
  focusMode: false,
  importOpen: false,
  settingsOpen: false,
  setSettingsOpen: (v) => set({ settingsOpen: v }),
  setImportOpen: (v) => set({ importOpen: v }),
  setFocusMode: (v) => set({ focusMode: v }),
  newMapOpen: false,
  nameDialog: null,
  setNewWorldOpen: (v) => set({ newWorldOpen: v }),
  setPaletteOpen: (v) => set({ paletteOpen: v }),
  showToast: (msg) => {
    clearTimeout(toastTimer)
    set({ toast: msg })
    toastTimer = setTimeout(() => set({ toast: null }), 3500)
  },
  openNewCard: (folderId) => set({ newCard: { folderId } }),
  closeNewCard: () => set({ newCard: null }),
  setNewMapOpen: (v) => set({ newMapOpen: v }),
  openNameDialog: (d) => set({ nameDialog: d }),
  closeNameDialog: () => set({ nameDialog: null })
}))
