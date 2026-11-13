// ORBITA · Reality Rewrite — cấu hình hai "sheet" (hai bài hát) dùng chung không gian UEH.
//
// Audio Mùa Hạ được tải từ Drive do chủ dự án cung cấp, chuyển sang MP3 và
// phục vụ cùng website. Giữ toàn bộ timeline để mốc 1:54 khớp bản gốc.
// Video Nếu ngày mai dùng bản lyric gốc trong Drive; YouTube vẫn có thể mở chính thức.

import { MUA_HA_AUDIO_SRC, MUA_HA_MEDIA_SRC, MUA_HA_CUE, NGAY_MAI_CUE, NGAY_MAI_VIDEO_ID } from '../layout'

export type TrackId = 'mua-ha' | 'ngay-mai'
export type WorldId = 'ueh'

export interface TrackDef {
  id: TrackId
  index: 0 | 1
  title: string
  role: string
  blurb: string
  world: WorldId
  worldName: string
  accent: string
  highlight: { start: number; dur: number }
  audioSrc?: string
  videoSrc?: string
  /** YouTube id for the official embed (never sampled into a texture). */
  videoId?: string
  links: { label: string; url: string }[]
}

export const TRACKS: Record<TrackId, TrackDef> = {
  'mua-ha': {
    id: 'mua-ha',
    index: 0,
    title: 'Mùa Hạ Thứ 18',
    role: 'Sáng tác',
    blurb: 'Cơn mưa mùa hạ man mác trên sân trường UEH.',
    world: 'ueh',
    worldName: 'UEH · Cơn Mưa Mùa Hạ',
    accent: '#8fc8ff',
    // Owner cue: from 1:54 (114 s) to the end. `dur` only bounds the procedurally
    // driven visuals; the real file plays until it ends.
    highlight: { start: MUA_HA_CUE, dur: 66 },
    audioSrc: MUA_HA_MEDIA_SRC,
    videoSrc: undefined,
    links: [
      { label: 'Nghe audio gốc trên Drive', url: MUA_HA_AUDIO_SRC },
      { label: 'Xem reel gốc', url: 'https://www.facebook.com/reel/848691413758411' },
    ],
  },
  'ngay-mai': {
    id: 'ngay-mai',
    index: 1,
    title: 'Nếu ngày mai',
    role: 'Giọng hát cùng Hồ Đá Chà Gươm',
    blurb: 'Bầu trời ngập tràn hoa phượng đỏ bay trong gió chiều.',
    world: 'ueh',
    worldName: 'UEH · Hoa Phượng Trong Gió',
    accent: '#ff7048',
    // Owner cue: 1:22 (82 s). The supplied original lyric file drives the
    // local depth-tested screen; videoId retains the official YouTube option.
    highlight: { start: NGAY_MAI_CUE, dur: 72 },
    audioSrc: undefined,
    videoSrc: undefined,
    videoId: NGAY_MAI_VIDEO_ID,
    links: [
      { label: 'Nghe trên Spotify', url: 'https://open.spotify.com/track/2AkPSNohBGtrZMGeTtwV12' },
      { label: 'Lyric video chính thức', url: 'https://www.youtube.com/watch?v=179btG24VE8' },
    ],
  },
}
export const TRACK_LIST = Object.values(TRACKS)

// kiểm tra file thật có tồn tại không (tránh SPA fallback trả index.html)
export async function probeMedia(src?: string, kind: 'audio' | 'video' = 'audio') {
  if (!src) return false
  try {
    const r = await fetch(src, { method: 'HEAD' })
    const ct = r.headers.get('content-type') || ''
    return r.ok && (ct.startsWith(kind) || ct.startsWith('application/octet-stream'))
  } catch {
    return false
  }
}

/**
 * Can this exact element play without CORS problems?
 *
 * `probeMedia` checks the response type; a Drive viewer is HTML and cannot be
 * assigned to an audio element. Even the public download endpoint can be blocked
 * by Drive confirmation pages or CORS. Loading the element is a second check,
 * not a promise that every browser or sharing configuration will play it.
 *
 * Setting `crossOrigin` and connecting an element to WebAudio turns a successful
 * load into a hard requirement: a response without `Access-Control-Allow-Origin`
 * fires `error` instead of degrading. A failed or timed-out check does not
 * replace the supplied track: playback is retried after user interaction.
 */
export function probePlayable(el: HTMLAudioElement | HTMLVideoElement, timeoutMs = 6000) {
  return new Promise<boolean>((resolve) => {
    let settled = false
    const done = (ok: boolean) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      el.removeEventListener('loadedmetadata', onOk)
      el.removeEventListener('canplay', onOk)
      el.removeEventListener('error', onErr)
      resolve(ok)
    }
    const onOk = () => done(true)
    const onErr = () => done(false)
    const timer = window.setTimeout(() => done(false), timeoutMs)
    el.addEventListener('loadedmetadata', onOk)
    el.addEventListener('canplay', onOk)
    el.addEventListener('error', onErr)
    if (el.readyState >= 1) done(true)
  })
}
