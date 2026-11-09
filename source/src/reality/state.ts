// ORBITA · Reality Rewrite — máy trạng thái trung tâm (độc lập với store gốc, tích hợp an toàn).
import { create } from 'zustand'
import type { TrackId } from './tracks'

export type RPhase = 'idle' | 'ignite' | 'sweep' | 'active' | 'retract'

interface RState {
  phase: RPhase
  track: TrackId | null
  switchSeq: number // tăng mỗi khi chuyển bài liên tục ngay bên trong thế giới UEH
  demo: boolean
  setPhase: (p: RPhase) => void
  set: (p: Partial<RState>) => void
}
export const useReality = create<RState>((set) => ({
  phase: 'idle',
  track: null,
  switchSeq: 0,
  demo: true,
  setPhase: (phase) => set({ phase }),
  set: (p) => set(p),
}))

// dữ liệu thay đổi từng khung hình (không gây re-render React)
export const rt = {
  front: 0, // 0..FRONT_MAX
  ignite: 0, // 0..1 (sheet cháy, năng lượng tụ lại)
  flash: 0, // 0..1 nhấp nháy bùng nổ khi mở trường
  presence: 0, // người chơi ở gần đàn 0..1
  grade: 0, // 0..1 mức chuyển màu ánh sáng toàn cục
  rain: 0, // 0..1 cường độ cơn mưa mùa hạ (Mùa Hạ Thứ 18)
  wetness: 0, // 0..1 độ ẩm / vũng nước trên sân UEH
  blossom: 0, // 0..1 cường độ hoa phượng bay trong gió (Nếu Ngày Mai)
  wind: 0.25, // cường độ gió nền cho tán cây & cánh hoa
  suppressAutoPlay: false, // tạm dừng nhạc tự chơi Gymnopédie khi đang trong thực tại âm nhạc
  t: 0,
  maxDt: 0.05, // kiểm thử trên máy yếu có thể nới ra
  dbg: null as number | null, // chỉ dùng để kiểm thử: khóa mặt trận ở một bán kính
}

export function requestReality(id: TrackId) {
  const s = useReality.getState()
  if (s.phase === 'ignite' || s.phase === 'retract') return
  if (s.phase === 'idle') {
    s.set({ track: id, phase: 'ignite' })
  } else if (s.track !== id) {
    // Chuyển bài NGAY BÊN TRONG thực tại UEH: KHÔNG thu hồi đĩa về vũ trụ!
    s.set({ track: id, switchSeq: s.switchSeq + 1 })
  }
}

export function dismissReality() {
  const s = useReality.getState()
  if (s.phase === 'sweep' || s.phase === 'active') s.set({ phase: 'retract' })
}

// Móc kiểm thử (không ảnh hưởng người dùng): window.__orbitaReality
if (typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__orbitaReality = { requestReality, dismissReality, rt, useReality }
}
