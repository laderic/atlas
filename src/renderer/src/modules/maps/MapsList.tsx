import { SideItem, EmptyNote, matches } from '@/components/SidebarSection'
import { tmap } from '@/i18n/maps'
import { useMaps } from '@/store/maps'
import { useWorkspace } from '@/store/workspace'

export function MapsBody({ q }: { q: string }): JSX.Element {
  const all = useMaps((s) => s.maps)
  const maps = all.filter((m) => matches(m.name, q))
  const openMap = useMaps((s) => s.openMap)
  const activeTabId = useWorkspace((s) => s.activeTabId)
  if (all.length === 0) return <EmptyNote>{tmap.emptyList}</EmptyNote>
  if (maps.length === 0) return <EmptyNote>{tmap.noResults}</EmptyNote>
  return (
    <div>
      {maps.map((m) => (
        <SideItem key={m.id} active={activeTabId === `map:${m.id}`} onClick={() => openMap(m.id)}>{m.name}</SideItem>
      ))}
    </div>
  )
}
