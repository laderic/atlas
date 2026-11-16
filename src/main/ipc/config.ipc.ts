import { BrowserWindow, ipcMain, session } from 'electron'
import { getLang, setLangConfig, type Lang } from '../config'
import { buildMenu } from '../menu'

const spellOrder = (lang: Lang): string[] => (lang === 'en' ? ['en-US', 'pt-BR'] : ['pt-BR', 'en-US'])

export function registerConfig(): void {
  ipcMain.handle('config:get', (): { lang: Lang } => ({ lang: getLang() }))

  // Troca o idioma: salva, atualiza o menu e recarrega a tela.
  ipcMain.handle('config:setLang', (e, lang: Lang): void => {
    const next: Lang = lang === 'en' ? 'en' : 'pt-BR'
    setLangConfig(next)
    session.defaultSession.setSpellCheckerLanguages(spellOrder(next))
    const win = BrowserWindow.fromWebContents(e.sender)
    if (win) {
      buildMenu(win)
      win.webContents.reload()
    }
  })
}
