import { Component, type ReactNode } from 'react'
import { tu } from '@/i18n/ui'

interface State { error: Error | null }

/** Se a interface quebrar, mostra o erro em vez de uma tela vazia. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error): void {
    console.error('Atlas: erro na interface', error)
  }

  render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-10 text-center">
        <h1 className="font-serif text-3xl">{tu.errorTitle}</h1>
        <p className="max-w-lg text-muted">{tu.errorBody}</p>
        <pre className="max-w-2xl overflow-auto rounded border border-line bg-raised p-3 text-left text-xs text-danger">
          {error.message}
        </pre>
        <button onClick={() => window.location.reload()} className="rounded bg-accent px-5 py-2 font-medium text-accent-ink">
          {tu.reload}
        </button>
      </div>
    )
  }
}
