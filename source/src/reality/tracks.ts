// ORBITA · Reality Rewrite — cấu hình hai "sheet" (hai bài hát) dùng chung không gian UEH.
//
// NGUỒN SỰ THẬT: tên bài + vai trò lấy từ nhánh portfolio/data-intake
// (portfolio-data/SHOWTIME_SITE_CONTENT_V1.json). Ở đó quyền rehost audio/video của cả hai bài
// đang là "not_granted", vì vậy KHÔNG có file thật nào được đóng gói trong build này.
//
// ĐỂ GẮN TÁC PHẨM THẬT (không cần sửa code khác):
//   1. Đặt file vào  public/reality/  (ví dụ  public/reality/mua-ha-thu-18.mp3, .mp4)
//   2. Điền  audioSrc / videoSrc  bên dưới, chỉnh  highlight.start / highlight.dur  (45–90 giây).
//   Khi file tồn tại, nhãn DEMO tự biến mất và nhạc/video thật thay thế bản demo thủ tục.

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
    highlight: { start: 0, dur: 66 },
    audioSrc: undefined,
    videoSrc: undefined,
    links: [{ label: 'Xem reel gốc', url: 'https://www.facebook.com/reel/848691413758411' }],
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
    highlight: { start: 0, dur: 72 },
    audioSrc: undefined,
    videoSrc: undefined,
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
