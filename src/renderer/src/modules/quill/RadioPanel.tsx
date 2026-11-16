import { useEffect, useState } from 'react'
import type { RadioStation } from '@shared/types'
import { tq } from '@/i18n/quill'
import { tu } from '@/i18n/ui'
import { MediaPicker } from '@/modules/media/MediaPicker'
import { useMedia } from '@/store/media'
import { useRadio } from '@/store/radio'
import { useUi } from '@/store/ui'
import { useWorkspace } from '@/store/workspace'

const btn = 'rounded px-2.5 py-1.5 text-muted hover:text-ink disabled:opacity-40'
const fmt = (s: number): string => {
  if (!Number.isFinite(s) || s <= 0) return '0:00'
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

export function RadioPanel(): JSX.Element {
  const worldId = useWorkspace((s) => s.activeWorldId)
  const items = useMedia((s) => s.items)
  const openNameDialog = useUi((s) => s.openNameDialog)
  const radio = useRadio()
  const [stations, setStations] = useState<RadioStation[]>([])
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    if (!worldId) return
    window.api.radio.list(worldId).then(setStations)
  }, [worldId])

  const current = radio.station ? stations.find((s) => s.id === radio.station!.id) ?? radio.station : null
  const audioItems = items.filter((m) => m.type === 'audio')
  const trackName = radio.tracks[radio.index]?.name

  const select = (st: RadioStation): void => radio.setStation(st, audioItems)

  const createStation = (name: string): void => {
    if (!worldId) return
    void window.api.radio.create(worldId, name).then((st) => {
      setStations((s) => [...s, st].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')))
      select(st)
    })
  }

  const addTrack = (mediaId: string): void => {
    if (!current) return
    const playlist = [...current.playlist, mediaId]
    void window.api.radio.update(current.id, { playlist }).then((st) => {
      setStations((s) => s.map((x) => (x.id === st.id ? st : x)))
      select(st)
    })
    setAdding(false)
  }

  const removeTrack = (i: number): void => {
    if (!current) return
    const playlist = current.playlist.filter((_, n) => n !== i)
    void window.api.radio.update(current.id, { playlist }).then((st) => {
      setStations((s) => s.map((x) => (x.id === st.id ? st : x)))
      select(st)
    })
  }

  const removeStation = (st: RadioStation): void => {
    if (!window.confirm(`Excluir a estação "${st.name}"?`)) return
    void window.api.radio.remove(st.id).then(() => setStations((s) => s.filter((x) => x.id !== st.id)))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-muted">{tq.radioStation}</span>
        <button onClick={() => openNameDialog({ title: tq.newStation, label: tq.stationName, initial: '', submit: tq.create, onSubmit: createStation })} className="text-accent hover:underline">
          {tq.newStation}
        </button>
      </div>

      {stations.length === 0 ? (
        <p className="text-muted">{tq.noStations}</p>
      ) : (
        <ul className="space-y-1">
          {stations.map((st) => (
            <li key={st.id} className="group flex items-center justify-between">
              <button onClick={() => select(st)} aria-current={current?.id === st.id} className={`truncate rounded px-2 py-1 text-left ${current?.id === st.id ? 'bg-raised text-ink' : 'text-muted hover:text-ink'}`}>
                {st.name}
              </button>
              <button aria-label={`${tq.removeTrack}: ${st.name}`} onClick={() => removeStation(st)} className="invisible text-muted hover:text-danger group-hover:visible">×</button>
            </li>
          ))}
        </ul>
      )}

      {current && (
        <div className="rounded border border-line p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="truncate font-medium">{current.name}</span>
            <span className="text-xs text-muted">{radio.playing ? tq.nowPlaying : ''}</span>
          </div>
          <p className="mb-3 truncate text-sm text-muted">{trackName ?? '—'}</p>

          <div className="mb-3 flex items-center gap-1">
            <button className={btn} onClick={radio.prev} disabled={radio.tracks.length === 0} aria-label={tq.prev}>⏮</button>
            <button className="rounded bg-accent px-3 py-1.5 font-medium text-accent-ink disabled:opacity-40" onClick={radio.toggle} disabled={radio.tracks.length === 0} aria-label={radio.playing ? tq.pause : tq.play}>
              {radio.playing ? '❚❚' : '▶'}
            </button>
            <button className={btn} onClick={radio.next} disabled={radio.tracks.length === 0} aria-label={tq.next}>⏭</button>
            <label className="ml-auto flex items-center gap-1.5 text-xs text-muted">
              <input type="checkbox" checked={radio.loop} onChange={(e) => radio.setLoop(e.target.checked)} />
              {tq.loop}
            </label>
            <label className="flex items-center gap-1.5 text-xs text-muted">
              <input type="checkbox" checked={radio.shuffle} onChange={(e) => radio.setShuffle(e.target.checked)} />
              {tu.shuffle}
            </label>
          </div>

          <div className="mb-3 flex items-center gap-2 text-xs text-muted">
            <span className="w-10 tabular-nums">{fmt(radio.time)}</span>
            <input
              type="range"
              aria-label="Posição da faixa"
              min={0}
              max={radio.duration || 0}
              step={0.5}
              value={radio.time}
              onChange={(e) => radio.seek(Number(e.target.value))}
              className="w-full"
            />
            <span className="w-10 text-right tabular-nums">{fmt(radio.duration)}</span>
          </div>

          <label className="mb-3 flex items-center gap-2 text-xs text-muted">
            {tq.volume}
            <input type="range" min={0} max={1} step={0.05} value={radio.volume} onChange={(e) => radio.setVolume(Number(e.target.value))} className="w-full" />
          </label>

          <ol className="mb-2 space-y-1">
            {current.playlist.length === 0 && <li className="text-sm text-muted">{tq.noTracks}</li>}
            {current.playlist.map((id, i) => {
              const m = items.find((x) => x.id === id)
              return (
                <li key={`${id}-${i}`} className="group flex items-center justify-between text-sm">
                  <span className="truncate">{i + 1}. {m?.name ?? '—'}</span>
                  <button aria-label={`${tq.removeTrack}: ${m?.name ?? i + 1}`} onClick={() => removeTrack(i)} className="invisible text-muted hover:text-danger group-hover:visible">×</button>
                </li>
              )
            })}
          </ol>
          <button onClick={() => setAdding(true)} className="text-accent hover:underline">{tq.addTrack}</button>
        </div>
      )}

      {adding && <MediaPicker title={tq.pickTrack} kinds={['audio']} onPick={(m) => addTrack(m.id)} onClose={() => setAdding(false)} />}
    </div>
  )
}
