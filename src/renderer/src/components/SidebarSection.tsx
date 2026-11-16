import type { ReactNode } from 'react'
import { norm } from '@/lib/mentions'

export function SideAction({ label, title, onClick }: { label: string; title?: string; onClick: () => void }): JSX.Element {
  return (
    <button
      onClick={onClick}
      title={title ?? label}
      aria-label={title ?? label}
      className="shrink-0 rounded px-2 py-1 hover:bg-raised hover:text-ink"
    >
      {label}
    </button>
  )
}

export function SideItem({
  active, onClick, tag, children
}: { active: boolean; onClick: () => void; tag?: string; children: ReactNode }): JSX.Element {
  return (
    <button
      onClick={onClick}
      aria-current={active}
      title={typeof children === 'string' ? children : undefined}
      className={`flex w-full min-w-0 items-center gap-2 rounded px-3 py-1.5 text-left ${active ? 'bg-raised text-ink' : 'text-muted hover:text-ink'}`}
    >
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {tag && <span className="shrink-0 text-[10px] uppercase tracking-wide opacity-70">{tag}</span>}
    </button>
  )
}

export const EmptyNote = ({ children }: { children: ReactNode }): JSX.Element => (
  <p className="px-3 py-2 text-sm text-muted/70">{children}</p>
)

/** Filtra por nome, ignorando acentos e maiúsculas. */
export const matches = (name: string, q: string): boolean => !q.trim() || norm(name).includes(norm(q.trim()))
