import { useUi } from '@/store/ui'

export function Toast(): JSX.Element | null {
  const toast = useUi((s) => s.toast)
  if (!toast) return null
  return (
    <div role="status" className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded border border-line bg-raised px-4 py-2 shadow-xl">
      {toast}
    </div>
  )
}
