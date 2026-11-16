import { useEffect, type ReactNode } from 'react'

interface Props {
  title: string
  onClose: () => void
  width?: number
  children: ReactNode
}

export function Modal({ title, onClose, width = 440, children }: Props): JSX.Element {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/55"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div role="dialog" aria-modal="true" aria-label={title} style={{ width, maxWidth: '92vw' }} className="max-h-[92vh] overflow-y-auto rounded-lg border border-line bg-panel p-6 shadow-2xl">
        <h2 className="mb-4 font-serif text-xl">{title}</h2>
        {children}
      </div>
    </div>
  )
}
