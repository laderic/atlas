import { Modal } from './Modal'
import { tu } from '@/i18n/ui'
import { getLang, type Lang } from '@/lib/i18n'
import { applyTheme, getAppTheme, setAppTheme, type ThemeName } from '@/lib/theme'
import { useUi } from '@/store/ui'

const THEME_LABEL: Record<ThemeName, string> = { escuro: 'Escuro', claro: 'Claro', pergaminho: 'Pergaminho' }

export function SettingsDialog(): JSX.Element | null {
  const open = useUi((s) => s.settingsOpen)
  const setOpen = useUi((s) => s.setSettingsOpen)
  if (!open) return null
  const changeTheme = (t: ThemeName): void => {
    setAppTheme(t)
    applyTheme(t)
  }
  return (
    <Modal title={tu.settings} onClose={() => setOpen(false)} width={420}>
      <label htmlFor="app-lang" className="mb-1 block text-muted">{tu.language}</label>
      <select
        id="app-lang"
        defaultValue={getLang()}
        onChange={(e) => void window.api.config.setLang(e.target.value as Lang)}
        className="mb-2 w-full rounded border border-line bg-raised px-3 py-2"
      >
        <option value="pt-BR">{tu.ptBR}</option>
        <option value="en">{tu.en}</option>
      </select>
      <p className="mb-5 text-sm text-muted">{tu.languageHelp}</p>
      <label htmlFor="app-theme" className="mb-1 block text-muted">Tema</label>
      <select
        id="app-theme"
        defaultValue={getAppTheme()}
        onChange={(e) => changeTheme(e.target.value as ThemeName)}
        className="w-full rounded border border-line bg-raised px-3 py-2"
      >
        {(Object.keys(THEME_LABEL) as ThemeName[]).map((t) => <option key={t} value={t}>{THEME_LABEL[t]}</option>)}
      </select>
    </Modal>
  )
}
