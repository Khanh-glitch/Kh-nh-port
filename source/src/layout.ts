// Bố cục thế giới: đơn vị = 1 mét. Trục -Z là "phía bắc" nhìn từ điểm xuất phát.
export const DISC_R = 60
export const EYE = 1.7
export const SPAWN = { x: 0, z: 46 }

export type ExhibitId =
  | 'orb'
  | 'station'
  | 'piano'
  | 'rubik'
  | 'robot'
  | 'cinema'
  | 'stage'
  | 'products'
  | 'beacon'

export interface ExhibitDef {
  id: ExhibitId
  name: string
  x: number
  z: number
  rotY: number
  color: string
}

export const EXHIBITS: Record<ExhibitId, ExhibitDef> = {
  station: { id: 'station', name: 'Central Information Station', x: 0, z: 0, rotY: 0, color: '#7fdcff' },
  orb: { id: 'orb', name: 'Singularity Orb', x: -47, z: -3, rotY: 0.5, color: '#b66bff' },
  robot: { id: 'robot', name: 'Colossus', x: 0, z: -41, rotY: 0, color: '#ff8a3d' },
  piano: { id: 'piano', name: 'Grand Piano', x: -26, z: 9, rotY: -0.62, color: '#ffd27a' },
  rubik: { id: 'rubik', name: 'Cube Solver', x: 27, z: 9, rotY: 0, color: '#4dd8ff' },
  stage: { id: 'stage', name: 'Main Stage', x: -31, z: -26, rotY: 0.88, color: '#ff3dcb' },
  cinema: { id: 'cinema', name: 'Mini Cinema', x: 32, z: -27, rotY: -0.86, color: '#ff4d4d' },
  products: { id: 'products', name: 'Product Lab', x: 22, z: 31, rotY: 0, color: '#5dffb0' },
  beacon: { id: 'beacon', name: 'Signal Beacon', x: -22, z: 31, rotY: 0, color: '#6aa8ff' },
}

export const EXHIBIT_LIST = Object.values(EXHIBITS)


// ---------------------------------------------------------------------------
// Dữ liệu liên kết ra ngoài — nguồn sự thật duy nhất cho mọi URL trong đảo.
//
// Vì sao nằm ở đây chứ không ở một file mới: standalone ở gốc repo là một bản
// build KHÔNG có Vite, chạy bằng import map nhúng trong index.html. Bộ module
// của nó là cố định (64 slot, mỗi slot một module), và một file mới không có
// slot sẽ không thể publish. Thêm một module mới là thay đổi hạ tầng publish,
// không phải thêm dữ liệu — nên dữ liệu thuần nằm trong module đã có sẵn.
//
// Quy tắc:
//   1. URL do chủ dự án đưa thì dùng nguyên văn, không rút gọn, không đoán.
//   2. Nền tảng chưa biết link thật thì trỏ về thư mục Drive, KHÔNG trỏ vào
//      link chết và KHÔNG đoán tài khoản của người khác.
//      Tìm `TODO(profile)` để thay handle thật.
//   3. Thời điểm là giây, lấy từ chính mốc chủ dự án đưa.
// ---------------------------------------------------------------------------

/** Thư mục dự án (Drive) do chủ dự án đưa. */
export const DRIVE_PORTFOLIO =
  'https://drive.google.com/drive/u/0/folders/1VwZseTeVQaOWxhVKLEj7Oa6hwiZ4AQTj'

/** "Mùa Hạ Thứ 18" — phát từ 1:54 (114 s) đến hết. */
export const MUA_HA_AUDIO_SRC =
  'https://drive.google.com/file/d/14pmfR3_CIDgX8-QgMiUpQen_-hZ0BSID/view?usp=drive_link'
// The complete owner-supplied recording, transcoded from WAV for the web.
// Keep the full timeline so MUA_HA_CUE still means 1:54 in the original.
export const MUA_HA_MEDIA_SRC = './reality/mua-ha-thu-18.mp3'
export const MUA_HA_CUE = 114

/** Video sân khấu chính trong HEX. Chỉ dùng BÊN TRONG HEX. */
export const HEX_MAIN_STAGE_VIDEO_SRC =
  'https://drive.google.com/file/d/1gkTtTvvEgyD7lLRFFc3VhXtq1rF8h1wB/view?usp=drive_link'

/** "Nếu Ngày Mai" — lyric video chính thức. YouTube không thể thành
 *  VideoTexture (CORS + điều khoản), nên phải nhúng, không lấy mẫu. */
export const NGAY_MAI_WATCH_URL = 'https://youtu.be/179btG24VE8'
export const NGAY_MAI_VIDEO_ID = '179btG24VE8'
export const NGAY_MAI_CUE = 82

/** Đã xác nhận. */
export const GITHUB_PROFILE = 'https://github.com/Khanh-glitch'

/** Đích của sáu icon Beacon, theo slug trong scene/socialLogoPaths.ts. */
export const PROFILES: Record<string, { url: string; confirmed: boolean }> = {
  github: { url: GITHUB_PROFILE, confirmed: true },
  facebook: { url: 'https://www.facebook.com/menisrealforeverbae', confirmed: true },
  instagram: { url: 'https://www.instagram.com/menisrealforeverbae/', confirmed: true },
  tiktok: { url: 'https://www.tiktok.com/@menisrealforeverbae', confirmed: true },
  discord: { url: DRIVE_PORTFOLIO, confirmed: false },
  linkedin: { url: 'https://www.linkedin.com/in/quockhanh-le/', confirmed: true },
}

/** Mở tab mới, không để trang phía sau điều hướng. */
export function openExternal(url: string) {
  if (typeof window === 'undefined' || !url) return
  window.open(url, '_blank', 'noopener,noreferrer')
}
