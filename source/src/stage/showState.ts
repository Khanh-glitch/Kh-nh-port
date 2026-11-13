import { create } from 'zustand'
import * as THREE from 'three'
import { SHOWS, photoAllowed, type ShowId } from './shows'

export type VideoState = 'off' | 'loading' | 'playing' | 'paused' | 'blocked' | 'error'

interface ShowStore {
  active: ShowId | null
  startedAt: number // performance.now() ms
  selectorOpen: boolean
  clip: number
  video: VideoState
  videoMuted: boolean
  focus: { show: ShowId; idx: number; kind: 'photo' | 'info' } | null
  select: (id: ShowId | null) => void
  setSelector: (v: boolean) => void
  nextClip: () => void
  setVideo: (v: VideoState) => void
  setVideoMuted: (m: boolean) => void
  setFocus: (f: ShowStore['focus']) => void
}

export const useShow = create<ShowStore>((set, get) => ({
  active: null,
  startedAt: 0,
  selectorOpen: true,
  clip: 0,
  video: 'off',
  videoMuted: false,
  focus: null,
  select: (id) => set({ active: id, startedAt: performance.now(), selectorOpen: false, clip: 0, video: id ? 'loading' : 'off', focus: null }),
  setSelector: (selectorOpen) => set({ selectorOpen }),
  nextClip: () => {
    const s = get()
    const show = SHOWS.find((x) => x.id === s.active)
    if (!show) return
    set({ clip: (s.clip + 1) % show.clips.length, video: 'loading' })
  },
  setVideo: (video) => set({ video }),
  setVideoMuted: (videoMuted) => set({ videoMuted }),
  setFocus: (focus) => set({ focus }),
}))

export const showById = (id: ShowId | null) => SHOWS.find((s) => s.id === id) ?? null

/** thời gian (giây) kể từ khi chọn show */
export const showElapsed = () => (performance.now() - useShow.getState().startedAt) / 1000

// ---------------------------------------------------------------------------
// Media: ảnh (HTMLImageElement CORS) dùng chung cho texture 3D và canvas LED
// ---------------------------------------------------------------------------
export interface MediaEntry {
  img: HTMLImageElement | null
  tex: THREE.Texture | null
  ok: boolean
  failed: boolean
  uploaded: boolean
}

const media = new Map<string, MediaEntry>()

export function mediaFor(url: string): MediaEntry {
  let e = media.get(url)
  if (e) return e
  e = { img: null, tex: null, ok: false, failed: false, uploaded: false }
  media.set(url, e)
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.decoding = 'async'
  img.referrerPolicy = 'no-referrer'
  const entry = e
  img.onload = async () => {
    try {
      await img.decode?.()
    } catch {
      /* noop */
    }
    // ảnh YouTube "maxresdefault" không tồn tại sẽ trả về placeholder 120×90
    if (img.naturalWidth < 200) {
      entry.failed = true
      return
    }
    const t = new THREE.Texture(img)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    t.generateMipmaps = true
    t.minFilter = THREE.LinearMipmapLinearFilter
    t.needsUpdate = true
    entry.img = img
    entry.tex = t
    entry.ok = true
  }
  img.onerror = () => {
    entry.failed = true
  }
  img.src = url
  return e
}

let prefetched = false
/** Tải trước toàn bộ ảnh của ba show (gọi khi người chơi tiến vào khu Main Stage). */
export function prefetchShowMedia() {
  if (prefetched) return
  prefetched = true
  SHOWS.forEach((s) => s.photos.filter(photoAllowed).forEach((p) => mediaFor(p.url)))
  loadYouTubeAPI()
}

/** Đẩy dần texture lên GPU (tối đa 1 ảnh/frame) để tránh giật khi show bắt đầu. */
export function uploadPending(gl: THREE.WebGLRenderer) {
  for (const e of media.values()) {
    if (e.ok && e.tex && !e.uploaded) {
      gl.initTexture(e.tex)
      e.uploaded = true
      return
    }
  }
}

// ---------------------------------------------------------------------------
// YouTube IFrame Player API (cách phát hợp lệ duy nhất cho video YouTube; không thể
// đưa luồng YouTube vào THREE.VideoTexture vì CORS + điều khoản dịch vụ)
// ---------------------------------------------------------------------------
type YTNS = {
  Player: new (el: HTMLElement | string, opts: Record<string, unknown>) => YTPlayer
}
export interface YTPlayer {
  loadVideoById: (o: { videoId: string; startSeconds?: number }) => void
  playVideo: () => void
  pauseVideo: () => void
  mute: () => void
  unMute: () => void
  isMuted: () => boolean
  setVolume: (v: number) => void
  destroy: () => void
  getPlayerState?: () => number
  seekTo?: (seconds: number, allowSeekAhead: boolean) => void
}

let ytPromise: Promise<YTNS> | null = null
export function loadYouTubeAPI(): Promise<YTNS> {
  if (ytPromise) return ytPromise
  ytPromise = new Promise((resolve, reject) => {
    const w = window as unknown as { YT?: YTNS & { loaded?: number }; onYouTubeIframeAPIReady?: () => void }
    if (w.YT && w.YT.Player) return resolve(w.YT)
    const prev = w.onYouTubeIframeAPIReady
    w.onYouTubeIframeAPIReady = () => {
      prev?.()
      if (w.YT) resolve(w.YT)
    }
    const s = document.createElement('script')
    s.src = 'https://www.youtube.com/iframe_api'
    s.async = true
    s.onerror = () => reject(new Error('youtube api blocked'))
    document.head.appendChild(s)
    window.setTimeout(() => reject(new Error('youtube api timeout')), 45000)
  })
  // A transient network error must not poison all later playback attempts.
  const pending = ytPromise
  pending.catch(() => { if (ytPromise === pending) ytPromise = null })
  return ytPromise
}
