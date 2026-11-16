import { create } from 'zustand'
import type { MediaItem, RadioStation } from '@shared/types'
import { mediaUrl } from '@/lib/media'

// Um único elemento de áudio, para a rádio continuar tocando ao trocar de aba.
const audio = new Audio()
audio.preload = 'auto'

interface RadioState {
  station: RadioStation | null
  tracks: MediaItem[]
  index: number
  playing: boolean
  loop: boolean
  shuffle: boolean
  volume: number
  time: number
  duration: number
  setStation: (station: RadioStation, items: MediaItem[]) => void
  toggle: () => void
  pause: () => void
  next: () => void
  prev: () => void
  seek: (t: number) => void
  setLoop: (v: boolean) => void
  setShuffle: (v: boolean) => void
  setVolume: (v: number) => void
}

const otherIndex = (cur: number, n: number): number => {
  let r = cur
  while (r === cur) r = Math.floor(Math.random() * n)
  return r
}

const playIndex = (i: number, set: (p: Partial<RadioState>) => void, get: () => RadioState): void => {
  const { tracks } = get()
  if (tracks.length === 0) return
  const idx = ((i % tracks.length) + tracks.length) % tracks.length
  audio.src = mediaUrl(tracks[idx])
  set({ index: idx, time: 0 })
  void audio.play().catch(() => set({ playing: false }))
}

export const useRadio = create<RadioState>((set, get) => {
  audio.onplay = () => set({ playing: true })
  audio.onpause = () => set({ playing: false })
  audio.ontimeupdate = () => set({ time: audio.currentTime })
  audio.onloadedmetadata = () => set({ duration: audio.duration || 0 })
  audio.onended = () => {
    const { index, tracks, loop, shuffle } = get()
    if (shuffle && tracks.length > 1) playIndex(otherIndex(index, tracks.length), set, get)
    else if (index < tracks.length - 1) playIndex(index + 1, set, get)
    else if (loop && tracks.length) playIndex(0, set, get)
    else set({ playing: false })
  }
  audio.volume = 0.6

  return {
    station: null,
    tracks: [],
    index: 0,
    playing: false,
    loop: false,
    shuffle: false,
    volume: 0.6,
    time: 0,
    duration: 0,

    setStation: (station, items) => {
      const byId = new Map(items.map((m) => [m.id, m]))
      const tracks = station.playlist.map((id) => byId.get(id)).filter((m): m is MediaItem => !!m)
      const same = get().station?.id === station.id
      set({ station, tracks, index: 0, time: 0, duration: 0 })
      if (!same || !get().playing) {
        audio.pause()
        if (tracks[0]) audio.src = mediaUrl(tracks[0])
        else audio.removeAttribute('src')
        set({ playing: false })
      }
    },

    toggle: () => {
      const { playing, tracks, index } = get()
      if (playing) audio.pause()
      else if (audio.src) void audio.play().catch(() => set({ playing: false }))
      else if (tracks.length) playIndex(index, set, get)
    },

    pause: () => audio.pause(),

    next: () => {
      const { shuffle, tracks, index } = get()
      playIndex(shuffle && tracks.length > 1 ? otherIndex(index, tracks.length) : index + 1, set, get)
    },
    prev: () => playIndex(get().index - 1, set, get),

    seek: (t) => {
      audio.currentTime = t
      set({ time: t })
    },

    setLoop: (v) => set({ loop: v }),
    setShuffle: (v) => set({ shuffle: v }),
    setVolume: (v) => {
      audio.volume = v
      set({ volume: v })
    }
  }
})
