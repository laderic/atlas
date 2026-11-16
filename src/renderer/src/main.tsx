import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { setLang } from './lib/i18n'
import { applyTheme, getAppTheme } from './lib/theme'
import './styles/globals.css'

async function boot(): Promise<void> {
  const cfg = await window.api.config.get()
  setLang(cfg.lang)
  applyTheme(getAppTheme())
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  )
}

void boot()
