import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { t } from '@/i18n/pt-BR'
import { tu } from '@/i18n/ui'
import { useWorkspace } from '@/store/workspace'

/** Barra de abas com setas e rolagem pela roda do mouse, para abrir muitas abas. */
export function TabBar(): JSX.Element {
  const { tabs, activeTabId, activeWorldId, setActiveTab, closeTab } = useWorkspace()
  const visible = tabs.filter((x) => x.worldId === activeWorldId)
  const strip = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ left: false, right: false })

  const measure = (): void => {
    const el = strip.current
    if (!el) return
    setEdges({
      left: el.scrollLeft > 2,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2
    })
  }

  // mede de novo quando muda a quantidade de abas ou o tamanho da janela
  useEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [visible.length])

  // rola até a aba ativa (por exemplo, ao abrir um card pelo menu)
  useEffect(() => {
    const el = strip.current?.querySelector('[aria-selected="true"]') as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    measure()
  }, [activeTabId])

  const scrollBy = (d: number): void => {
    strip.current?.scrollBy({ left: d, behavior: 'smooth' })
  }

  const onWheel = (e: React.WheelEvent<HTMLDivElement>): void => {
    if (strip.current && Math.abs(e.deltaY) >= Math.abs(e.deltaX)) strip.current.scrollLeft += e.deltaY
  }

  const arrow = (dir: -1 | 1): JSX.Element => (
    <button
      onClick={() => scrollBy(dir * 240)}
      aria-label={dir < 0 ? tu.prevTabs : tu.nextTabs}
      className="flex h-full shrink-0 items-center bg-panel px-1.5 text-muted hover:text-ink"
    >
      {dir < 0 ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
    </button>
  )

  return (
    <div className="flex h-10 shrink-0 items-end border-b border-line bg-panel">
      {edges.left && arrow(-1)}
      <div
        ref={strip}
        role="tablist"
        onScroll={measure}
        onWheel={onWheel}
        className="flex min-w-0 flex-1 items-end gap-1 overflow-x-auto px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {visible.map((tab) => {
          const active = tab.id === activeTabId
          return (
            <div
              key={tab.id}
              className={`flex shrink-0 items-center gap-2 rounded-t px-3 py-2 ${active ? 'bg-bg text-ink' : 'text-muted hover:text-ink'}`}
            >
              <button role="tab" aria-selected={active} onClick={() => setActiveTab(tab.id)} className="max-w-48 truncate">
                {tab.title}
              </button>
              <button onClick={() => closeTab(tab.id)} aria-label={t.closeTab} className="text-muted hover:text-danger">×</button>
            </div>
          )
        })}
      </div>
      {edges.right && arrow(1)}
    </div>
  )
}
