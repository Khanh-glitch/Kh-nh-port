import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { create } from 'zustand'
import { DISC_R, EXHIBIT_LIST, EXHIBITS, PROFILES, openExternal, type ExhibitId } from '../layout'
import { type PanelId } from '../content'
import { audio, type Bus } from '../audio'
import { toast } from '../store'
import { player } from '../world'
import { FONT, beamGeometry, beamMaterial, canvasTex, glowTexture, rbox, roundRect } from '../gfx'
import { Hit } from './Hit'
import { Label } from './Label'
import { PadRing, useWorldColliders, worldPos } from './common'
import { openPanel } from './Player'
import { kit, led } from './kit/materials'
import { TAU, latheHard, merge, placed, strut, sweep, v3 } from './kit/geo'

// ---------------------------------------------------------------------------
// CENTRAL INFORMATION STATION — "ATLAS".
// Trái tim của đảo: quảng trường tròn, bàn Atlas giữa tâm chiếu một MÔ HÌNH TỈ LỆ THẬT của đĩa
// (toạ độ lấy từ layout.ts, vị trí & hướng nhìn của chính người xem cập nhật theo thời gian thực),
// vòng thông tin "halo" gắn trên 6 trụ cong, ba kiosk (hồ sơ · danh mục · liên kết).
// Toàn bộ dữ liệu hiển thị đến từ content.ts / layout.ts (PANELS, STUDIO, PROFILES, EXHIBITS).
// ---------------------------------------------------------------------------
const ex = EXHIBITS.station
const HOLO_R = 1.72
const HOLO_S = HOLO_R / DISC_R
const HOLO_Y = 1.75
const HALO_Y = 6.4
const HALO_R = 6.0
const N_PYLON = 6
const rPylon = (t: number) => 7.6 - 3.5 * Math.pow(t, 1.8)
const PANEL_OF: Record<string, PanelId> = { orb: 'orb', piano: 'piano', rubik: 'rubik', robot: 'robot', cinema: 'cinema', stage: 'stage', products: 'products', beacon: 'beacon', station: 'about' }
const NODES = EXHIBIT_LIST.filter((e) => e.id !== 'station')
const ACCENT = '#7fdcff'

export const useStation = create<{ focus: ExhibitId | null; setFocus: (f: ExhibitId | null) => void }>((set) => ({ focus: null, setFocus: (focus) => set({ focus }) }))

// ------------------------------------------------------------------ vẽ nội dung
function wrap(c: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number, maxLines: number) {
  const words = text.split(' ')
  let line = ''
  let n = 0
  for (const w of words) {
    const test = line ? line + ' ' + w : w
    if (c.measureText(test).width > maxW && line) {
      c.fillText(line, x, y + n * lh)
      line = w
      if (++n >= maxLines) return
    } else line = test
  }
  if (line && n < maxLines) c.fillText(line, x, y + n * lh)
}

function panelBase(c: CanvasRenderingContext2D, W: number, H: number, accent: string, kicker: string, title: string) {
  const g = c.createLinearGradient(0, 0, W, H)
  g.addColorStop(0, '#05090f')
  g.addColorStop(1, '#0a1522')
  c.fillStyle = g
  c.fillRect(0, 0, W, H)
  c.strokeStyle = 'rgba(127,220,255,0.12)'
  c.lineWidth = 1
  for (let x = 0; x < W; x += 48) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke() }
  c.fillStyle = accent
  c.fillRect(0, 0, 8, H)
  c.fillRect(W - 120, 22, 96, 3)
  c.textAlign = 'left'
  c.font = `600 22px ${FONT}`
  c.fillStyle = accent
  c.fillText(kicker, 40, 46)
  c.font = `700 62px ${FONT}`
  c.fillStyle = '#ffffff'
  c.fillText(title, 40, 112)
}

// Architecture-only integration: do not republish unverified STUDIO/PANELS
// achievements, fabricated portfolio statistics or placeholder email addresses.
// Kiosk navigation remains interactive and reads authoritative exhibit names.
const PAGES: Record<string, (c: CanvasRenderingContext2D, W: number, H: number) => void> = {
  overview(c, W, H) {
    panelBase(c, W, H, ACCENT, 'PORTFOLIO · GIỚI THIỆU', 'LÊ QUỐC KHÁNH')
    c.fillStyle = '#c9d8ea'; c.font = `500 29px ${FONT}`
    wrap(c, 'Khám phá các công trình và tác phẩm trực tiếp trên hòn đảo 3D.', 40, 175, W - 100, 43, 2)
    c.fillStyle = '#829ab0'; c.font = `400 23px ${FONT}`
    wrap(c, 'Chọn một địa điểm trên bản đồ mô phỏng bên dưới để tìm hiểu thêm.', 40, 300, W - 100, 36, 2)
  },
  domains(c, W, H) {
    panelBase(c, W, H, '#b66bff', 'BẢN ĐỒ CÔNG TRÌNH', 'Khám phá các khu vực')
    NODES.forEach((e, i) => {
      const x = 40 + (i % 4) * 365
      const y = 150 + Math.floor(i / 4) * 120
      c.fillStyle = e.color; c.fillRect(x, y, 5, 84)
      c.fillStyle = '#fff'; c.font = `700 26px ${FONT}`
      c.fillText(e.name, x + 18, y + 34)
      c.fillStyle = '#9fb4cc'; c.font = `400 17px ${FONT}`
      c.fillText('CHỌN TRÊN ATLAS ĐỂ XEM', x + 18, y + 65)
    })
  },
  projects(c, W, H) {
    panelBase(c, W, H, '#ff8a3d', 'TÁC PHẨM VÀ TRẢI NGHIỆM', 'Chọn một công trình')
    const targets = ['robot', 'cinema', 'stage', 'piano', 'products', 'rubik'] as ExhibitId[]
    targets.forEach((id, i) => {
      const e = EXHIBITS[id]; const x = 40 + (i % 3) * 485; const y = 150 + Math.floor(i / 3) * 120
      c.fillStyle = e.color; c.fillRect(x, y, 5, 80)
      c.fillStyle = '#fff'; c.font = `700 29px ${FONT}`; c.fillText(e.name, x + 18, y + 36)
      c.fillStyle = '#9fb4cc'; c.font = `400 18px ${FONT}`; c.fillText('XEM TRỰC TIẾP TRONG THẾ GIỚI', x + 18, y + 66)
    })
  },
  achievements(c, W, H) {
    // Do not claim counts/awards until real source data is verified.
    panelBase(c, W, H, '#ffd27a', 'THÔNG TIN CÓ DẪN CHỨNG', 'Tác phẩm trước, kết quả sau')
    c.fillStyle = '#c9d8ea'; c.font = `500 28px ${FONT}`
    wrap(c, 'Chọn từng khu vực để xem tác phẩm, vai trò và các nguồn tham khảo đi kèm.', 40, 185, W - 100, 40, 3)
  },
  connect(c, W, H) {
    panelBase(c, W, H, '#6aa8ff', 'CÁC KÊNH KẾT NỐI', 'Liên hệ')
    Object.entries(PROFILES).filter(([, p]) => p.confirmed).forEach(([slug, p], i) => {
      const x = 40 + (i % 3) * 485; const y = 170 + Math.floor(i / 3) * 86
      c.fillStyle = 'rgba(106,168,255,0.14)'; roundRect(c, x, y, 450, 60, 10); c.fill()
      c.fillStyle = '#ffffff'; c.font = `700 25px ${FONT}`; c.fillText(slug.toUpperCase(), x + 18, y + 36)
      c.fillStyle = '#829ab0'; c.font = `400 14px ${FONT}`
      c.fillText(p.url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 44), x + 145, y + 36)
    })
  },
}

function drawFocus(c: CanvasRenderingContext2D, W: number, H: number, id: ExhibitId | null) {
  if (!id) {
    panelBase(c, W, H, ACCENT, 'ATLAS', 'Chọn một công trình')
    c.fillStyle = '#9fb4cc'; c.font = `400 25px ${FONT}`
    wrap(c, 'Mô hình ở trung tâm phản chiếu các địa điểm thật trên hòn đảo. Chạm một nút sáng để chọn công trình tương ứng.', 40, 175, W - 80, 38, 4)
    return
  }
  const e = EXHIBITS[id]
  panelBase(c, W, H, e.color, 'CÔNG TRÌNH TRÊN ĐẢO', e.name)
  c.fillStyle = '#c9d8ea'; c.font = `500 26px ${FONT}`
  wrap(c, 'Địa điểm tương tác — đến trực tiếp công trình để xem tác phẩm và thông tin chi tiết.', 40, 165, W - 80, 38, 3)
  c.fillStyle = '#839ab5'; c.font = `400 19px ${FONT}`
  wrap(c, 'Chọn lần nữa để mở hồ sơ hiện có của khu vực.', 40, 315, W - 80, 28, 2)
}

function plazaTexture() {
  const S = 2048
  const pm = S / (2 * 9.4)
  return canvasTex(S, S, (c) => {
    c.clearRect(0, 0, S, S)
    const cx = S / 2
    const ring = (r: number, w: number, col: string, a: number, dash?: number[]) => {
      c.save(); c.globalAlpha = a; c.strokeStyle = col; c.lineWidth = w; if (dash) c.setLineDash(dash)
      c.beginPath(); c.arc(cx, cx, r * pm, 0, TAU); c.stroke(); c.restore()
    }
    ring(9.2, 5, ACCENT, 0.95)
    ring(8.7, 2, '#b66bff', 0.6)
    ring(7.0, 2, ACCENT, 0.35, [pm * 0.4, pm * 0.3])
    ring(3.6, 3, ACCENT, 0.7)
    ring(3.05, 1.5, '#ffffff', 0.4)
    for (let i = 0; i < 360; i += 2) {
      const a = (i / 180) * Math.PI
      const big = i % 10 === 0
      const r0 = 8.85
      const r1 = r0 + (big ? 0.28 : 0.13)
      c.globalAlpha = big ? 0.9 : 0.4
      c.strokeStyle = ACCENT
      c.lineWidth = big ? 3 : 1.5
      c.beginPath(); c.moveTo(cx + Math.sin(a) * r0 * pm, cx - Math.cos(a) * r0 * pm); c.lineTo(cx + Math.sin(a) * r1 * pm, cx - Math.cos(a) * r1 * pm); c.stroke()
    }
    c.globalAlpha = 1
    for (const e of NODES) {
      const L = Math.hypot(e.x, e.z)
      const dx = e.x / L
      const dz = e.z / L
      c.strokeStyle = e.color
      c.lineWidth = 5
      c.globalAlpha = 0.85
      c.beginPath(); c.moveTo(cx + dx * 3.7 * pm, cx + dz * 3.7 * pm); c.lineTo(cx + dx * 8.4 * pm, cx + dz * 8.4 * pm); c.stroke()
      for (let s = 4.2; s < 8; s += 0.7) {
        c.lineWidth = 3
        c.globalAlpha = 0.9
        const px = -dz
        const pz = dx
        c.beginPath()
        c.moveTo(cx + (dx * (s - 0.18) + px * 0.2) * pm, cx + (dz * (s - 0.18) + pz * 0.2) * pm)
        c.lineTo(cx + dx * (s + 0.18) * pm, cx + dz * (s + 0.18) * pm)
        c.lineTo(cx + (dx * (s - 0.18) - px * 0.2) * pm, cx + (dz * (s - 0.18) - pz * 0.2) * pm)
        c.stroke()
      }
      c.save()
      c.translate(cx + dx * 6.1 * pm, cx + dz * 6.1 * pm)
      c.rotate(Math.atan2(dz, dx))
      c.globalAlpha = 0.95
      c.fillStyle = e.color
      c.font = `700 ${0.34 * pm}px ${FONT}`
      c.textAlign = 'center'
      c.fillText(e.name.toUpperCase(), 0, 0.12 * pm)
      c.restore()
    }
    c.globalAlpha = 1
    c.fillStyle = '#fff'
    c.font = `800 ${0.8 * pm}px ${FONT}`
    c.textAlign = 'center'
    c.fillText('N', cx, cx - 7.7 * pm)
    c.fillStyle = ACCENT
    c.font = `600 ${0.45 * pm}px ${FONT}`
    c.fillText('E', cx + 7.7 * pm, cx + 0.15 * pm)
    c.fillText('S', cx, cx + 7.9 * pm)
    c.fillText('W', cx - 7.7 * pm, cx + 0.15 * pm)
  })
}

/** Bệ lectern: nêm extrude từ profile mặt bên, mặt trên dốc về phía người dùng (+z). */
function lectern(W: number, D: number, hf: number, hb: number) {
  const s = new THREE.Shape()
  s.moveTo(-D / 2, 0)
  s.lineTo(D / 2, 0)
  s.lineTo(D / 2, hb - 0.06)
  s.lineTo(D / 2 - 0.06, hb)
  s.lineTo(-D / 2 + 0.05, hf)
  s.lineTo(-D / 2, hf - 0.08)
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, { depth: W - 0.03, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2 })
  g.translate(0, 0, -(W - 0.03) / 2)
  g.rotateY(Math.PI / 2)
  return g
}

const KIOSKS = [
  { id: 'dossier', th: Math.PI / 2, title: 'DOSSIER', hint: 'Mở hồ sơ tổng quan' },
  { id: 'directory', th: Math.PI / 2 + TAU / 3, title: 'DIRECTORY', hint: 'Duyệt các hạng mục' },
  { id: 'network', th: Math.PI / 2 + (2 * TAU) / 3, title: 'NETWORK', hint: 'Mở liên kết' },
]
const LINKS = Object.entries(PROFILES)

export function Station() {
  const K = kit()
  const busRef = useRef<Bus | null>(null)
  const focus = useStation((s) => s.focus)
  const holo = useRef<THREE.Group>(null)
  const nodeRefs = useRef<(THREE.Group | null)[]>([])
  const marker = useRef<THREE.Mesh>(null)
  const hlRef = useRef<THREE.Mesh>(null)
  const focusRing = useRef<THREE.Mesh>(null)
  const stripMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 } },
        vertexShader: /* glsl */ `varying float vY; void main(){ vY = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: /* glsl */ `uniform float uTime; varying float vY; void main(){ float d = fract(vY*3.0 - uTime*0.25); float p = smoothstep(0.0,0.04,d)*(1.0-smoothstep(0.06,0.3,d)); gl_FragColor = vec4(vec3(0.45,0.88,1.0)*(0.5+p*2.4), 0.95); }`,
      }),
    [],
  )
  const holoMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        uniforms: { uTime: { value: 0 } },
        vertexShader: /* glsl */ `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: /* glsl */ `
          uniform float uTime; varying vec2 vP;
          float ln(float x){ return 1.0 - smoothstep(0.0, 0.035, abs(fract(x + 0.5) - 0.5)); }
          void main(){
            float r = length(vP) / ${HOLO_R.toFixed(3)};
            float g = max(ln(vP.x * 6.0), ln(vP.y * 6.0));
            float rg = ln(r * 4.0);
            float rim = smoothstep(0.93, 1.0, r) * (1.0 - smoothstep(0.995, 1.0, r));
            float a = atan(vP.y, vP.x);
            float sw = pow(max(0.0, sin(a - uTime * 0.9) * 0.5 + 0.5), 14.0) * (1.0 - r);
            float m = 1.0 - smoothstep(0.985, 1.0, r);
            float al = (0.05 + g * 0.12 + rg * 0.22 + rim * 0.9 + sw * 0.3) * m;
            gl_FragColor = vec4(vec3(0.38, 0.85, 1.0) * 1.5, al);
          }`,
      }),
    [],
  )
  const plaza = useMemo(plazaTexture, [])
  // mặt trong của vòng halo nhìn từ trong ra → lật trục U để chữ đọc đúng chiều
  const flipU = (t: THREE.Texture) => { t.wrapS = THREE.RepeatWrapping; t.repeat.x = -1; t.offset.x = 1; return t }
  const panelTex = useMemo(() => Object.fromEntries(Object.entries(PAGES).map(([k, fn]) => [k, { ...canvasTex(1536, 400, (c, w, h) => fn(c, w, h)) }])), [])
  const focusTex = useMemo(() => canvasTex(1536, 400, () => {}), [])
  useMemo(() => { Object.values(panelTex).forEach((p) => flipU(p.tex)); flipU(focusTex.tex) }, [panelTex, focusTex])
  const outerTex = useMemo(
    () => canvasTex(1536, 400, (c, W, H) => {
      c.fillStyle = '#04070c'; c.fillRect(0, 0, W, H)
      c.fillStyle = ACCENT; c.fillRect(0, H / 2 - 2, W, 4)
      c.textAlign = 'center'; c.fillStyle = '#fff'; c.font = `800 120px ${FONT}`; c.fillText('LÊ QUỐC KHÁNH', W / 2, H / 2 - 28)
      c.fillStyle = ACCENT; c.font = `600 34px ${FONT}`; c.fillText('CENTRAL INFORMATION STATION', W / 2, H / 2 + 70)
      c.fillStyle = '#6a86a8'; c.font = `500 22px ${FONT}`; c.fillText('KHÁM PHÁ CÁC CÔNG TRÌNH', W / 2, H / 2 + 122)
    }),
    [],
  )
  const kioskTex = useMemo(() => KIOSKS.map(() => canvasTex(512, 320, () => {})), [])
  const tagTex = useMemo(() => canvasTex(512, 96, () => {}), [])

  // ----- hình học tĩnh
  const G = useMemo(() => {
    const pylons: THREE.BufferGeometry[] = []
    const strips: THREE.BufferGeometry[] = []
    const dirs = (th: number) => v3(Math.sin(th), 0, Math.cos(th))
    for (let k = 0; k < N_PYLON; k++) {
      const th = Math.PI / 6 + (k * TAU) / N_PYLON
      const d = dirs(th)
      const path = (t: number) => v3(d.x * rPylon(t), 12.2 * t, d.z * rPylon(t))
      pylons.push(sweep({ path, size: (t) => [0.55 - 0.4 * t, 0.95 - 0.65 * t], exponent: 2.9, steps: 48, ring: 28 }))
      strips.push(sweep({ path: (t) => v3(d.x * (rPylon(t) - (0.55 - 0.4 * t) + 0.012), 12.2 * t, d.z * (rPylon(t) - (0.55 - 0.4 * t) + 0.012)), size: () => [0.012, 0.045], exponent: 3, steps: 48, ring: 8 }))
    }
    const rings: THREE.BufferGeometry[] = []
    for (const y of [HALO_Y - 0.78, HALO_Y + 0.78]) rings.push(latheHard([[HALO_R - 0.08, y - 0.1], [HALO_R + 0.22, y - 0.1], [HALO_R + 0.22, y + 0.1], [HALO_R - 0.08, y + 0.1], [HALO_R - 0.08, y - 0.1]], 96))
    const crown = latheHard([[3.7, 12.1], [4.55, 12.1], [4.55, 12.45], [4.3, 12.5], [3.7, 12.5], [3.7, 12.1]], 96)
    const projector = merge([
      latheHard([[2.35, 9.5], [2.85, 9.5], [2.85, 9.8], [2.35, 9.8], [2.35, 9.5]], 64),
      ...Array.from({ length: 12 }, (_, i) => placed(new THREE.CylinderGeometry(0.1, 0.13, 0.34, 12), [Math.sin((i / 12) * TAU) * 2.6, 9.4, Math.cos((i / 12) * TAU) * 2.6])),
      ...Array.from({ length: N_PYLON }, (_, k) => {
        const th = Math.PI / 6 + (k * TAU) / N_PYLON
        return strut(v3(Math.sin(th) * rPylon(0.8), 9.75, Math.cos(th) * rPylon(0.8)), v3(Math.sin(th) * 2.6, 9.65, Math.cos(th) * 2.6), 0.05, 0.04, 8)
      }),
    ])
    const ped = merge([
      latheHard([[0, 0], [2.6, 0], [2.6, 0.08], [2.2, 0.16], [2.05, 0.2], [2.05, 0.8], [2.2, 0.84], [2.2, 0.93], [1.88, 0.95], [1.88, 0.8]], 64),
      latheHard([[2.22, 0.14], [2.22, 0.2], [2.08, 0.2], [2.08, 0.14]], 64),
    ])
    const plazaDisc = merge([
      latheHard([[9.25, 0], [10.0, 0], [10.0, 0.1], [9.85, 0.14], [9.3, 0.14], [9.25, 0.1]], 128),
      latheHard([[0, 0.1], [9.25, 0.1], [9.25, 0.14], [0, 0.14]], 128),
    ])
    const ticks: THREE.BufferGeometry[] = []
    for (let i = 0; i < 72; i++) ticks.push(placed(new THREE.BoxGeometry(0.04, 0.02, i % 6 === 0 ? 0.3 : 0.14), [Math.sin((i / 72) * TAU) * 9.6, 0.145, Math.cos((i / 72) * TAU) * 9.6], [0, (i / 72) * TAU, 0]))
    return { pylons: merge(pylons), strips: merge(strips), rings, crown, projector, ped, plazaDisc, ticks: merge(ticks), lectern: lectern(0.95, 0.72, 0.86, 1.14) }
  }, [])
  const pylonMat = useMemo(() => {
    const m = K.anodized.clone()
    if (m.bumpMap) { m.bumpMap = m.bumpMap.clone(); m.bumpMap.repeat.set(2, 7); m.bumpMap.needsUpdate = true }
    m.color.set('#232a38'); m.metalness = 1; m.roughness = 0.32
    return m
  }, [K])
  const beamGeo = useMemo(() => beamGeometry(60, 0.55, 0.12, 20), [])
  const beamMat = useMemo(() => beamMaterial('#b8ecff', 0.55), [])
  const coneGeo = useMemo(() => { const g = new THREE.CylinderGeometry(1.7, 0.45, 8, 40, 1, true); g.translate(0, -4, 0); return g }, [])
  const coneMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color('#7fdcff').multiplyScalar(0.7), transparent: true, opacity: 0.045, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }), [])
  const glow = glowTexture()

  useWorldColliders(ex, [
    { type: 'circle', x: 0, z: 0, r: 2.45 },
    ...Array.from({ length: N_PYLON }, (_, k) => ({ type: 'circle' as const, x: Math.sin(Math.PI / 6 + (k * TAU) / N_PYLON) * 7.6, z: Math.cos(Math.PI / 6 + (k * TAU) / N_PYLON) * 7.6, r: 0.75 })),
    ...KIOSKS.map((k) => ({ type: 'circle' as const, x: Math.sin(k.th) * 4.7, z: Math.cos(k.th) * 4.7, r: 0.6 })),
  ])
  useEffect(() => {
    busRef.current = audio.createBus('station', worldPos(ex, 0, 2, 0), { ref: 4, rolloff: 1.2, maxDist: 70, reverb: 0.5, gain: 0.5 })
  }, [])

  // ----- nội dung động theo focus
  useEffect(() => {
    drawFocus(focusTex.ctx, 1536, 400, focus)
    focusTex.tex.needsUpdate = true
    const c = tagTex.ctx
    c.clearRect(0, 0, 512, 96)
    if (focus) {
      c.textAlign = 'center'
      c.shadowColor = EXHIBITS[focus].color
      c.shadowBlur = 14
      c.fillStyle = '#fff'
      c.font = `700 44px ${FONT}`
      c.fillText(EXHIBITS[focus].name.toUpperCase(), 256, 58)
    }
    tagTex.tex.needsUpdate = true
    kioskTex.forEach((kt, i) => {
      const c2 = kt.ctx
      c2.fillStyle = '#05090f'
      c2.fillRect(0, 0, 512, 320)
      c2.fillStyle = ACCENT
      c2.fillRect(0, 0, 512, 34)
      c2.fillStyle = '#04121a'
      c2.font = `700 20px ${FONT}`
      c2.textAlign = 'left'
      c2.fillText(KIOSKS[i].title, 14, 24)
      c2.fillStyle = '#c9d8ea'
      if (i === 0) {
        c2.font = `700 34px ${FONT}`; c2.fillStyle = '#fff'; c2.fillText('LÊ QUỐC KHÁNH', 18, 84)
        c2.font = `600 20px ${FONT}`; c2.fillStyle = ACCENT; c2.fillText('PORTFOLIO', 18, 116)
        c2.font = `400 17px ${FONT}`; c2.fillStyle = '#9fb4cc'; wrap(c2, 'Khám phá các tác phẩm và công trình tương tác trong không gian 3D.', 18, 144, 470, 22, 2)
        c2.fillStyle = 'rgba(127,220,255,0.18)'; roundRect(c2, 18, 250, 476, 48, 10); c2.fill()
        c2.fillStyle = '#fff'; c2.font = `700 20px ${FONT}`; c2.textAlign = 'center'; c2.fillText('MỞ HỒ SƠ ĐẦY ĐỦ  ▸', 256, 281)
      } else if (i === 1) {
        const e = focus ? EXHIBITS[focus] : null
        c2.font = `700 28px ${FONT}`; c2.fillStyle = e?.color ?? '#fff'; c2.fillText(e ? e.name : 'Chưa chọn hạng mục', 18, 80)
        c2.font = `400 17px ${FONT}`; c2.fillStyle = '#9fb4cc'
        if (focus) wrap(c2, 'Khám phá tác phẩm, vai trò và tư liệu ngay tại công trình.', 18, 110, 470, 22, 3)
        c2.fillStyle = 'rgba(255,255,255,0.08)'
        roundRect(c2, 18, 250, 110, 48, 10); c2.fill(); roundRect(c2, 140, 250, 110, 48, 10); c2.fill()
        c2.fillStyle = 'rgba(127,220,255,0.2)'; roundRect(c2, 262, 250, 232, 48, 10); c2.fill()
        c2.fillStyle = '#fff'; c2.font = `700 24px ${FONT}`; c2.textAlign = 'center'; c2.fillText('◂', 73, 283); c2.fillText('▸', 195, 283)
        c2.font = `700 18px ${FONT}`; c2.fillText('MỞ HỒ SƠ', 378, 280)
      } else {
        c2.font = `600 16px ${FONT}`
        LINKS.forEach(([slug, p], j) => {
          const x = 14 + (j % 2) * 248
          const y = 50 + Math.floor(j / 2) * 84
          c2.fillStyle = p.confirmed ? 'rgba(106,168,255,0.18)' : 'rgba(255,255,255,0.06)'
          roundRect(c2, x, y, 236, 72, 10); c2.fill()
          c2.fillStyle = '#fff'; c2.textAlign = 'left'; c2.font = `700 22px ${FONT}`; c2.fillText(slug.toUpperCase(), x + 14, y + 32)
          c2.fillStyle = '#7f94ac'; c2.font = `400 13px ${FONT}`; c2.fillText(p.url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 30), x + 14, y + 54)
        })
      }
      kt.tex.needsUpdate = true
    })
  }, [focus, focusTex, tagTex, kioskTex])

  const pick = (id: ExhibitId) => {
    if (useStation.getState().focus === id) { openPanel(PANEL_OF[id]); return }
    useStation.getState().setFocus(id)
    if (busRef.current) audio.cubeClick(busRef.current, 0.7)
    toast(`${EXHIBITS[id].name} — chạm lần nữa để mở hồ sơ`)
  }
  const cycle = (d: number) => {
    const cur = useStation.getState().focus
    const i = cur ? NODES.findIndex((n) => n.id === cur) : -1
    useStation.getState().setFocus(NODES[(i + d + NODES.length) % NODES.length].id)
    if (busRef.current) audio.cubeClick(busRef.current, 0.5)
  }

  const tmp = useMemo(() => new THREE.Vector3(), [])
  useFrame((state) => {
    const t = state.clock.elapsedTime
    stripMat.uniforms.uTime.value = t
    holoMat.uniforms.uTime.value = t
    beamMat.uniforms.uIntensity.value = 0.45 + Math.sin(t * 1.3) * 0.08
    coneMat.opacity = 0.04 + Math.sin(t * 2.1) * 0.008
    if (holo.current) holo.current.position.y = HOLO_Y + Math.sin(t * 0.8) * 0.025
    if (marker.current) {
      marker.current.position.set(player.pos.x * HOLO_S, 0.03, player.pos.z * HOLO_S)
      marker.current.rotation.y = player.yaw
      const s = 1 + 0.2 * Math.sin(t * 5)
      marker.current.scale.setScalar(s)
    }
    const f = useStation.getState().focus
    nodeRefs.current.forEach((g, i) => {
      if (!g) return
      const sel = NODES[i].id === f
      g.scale.y = THREE.MathUtils.damp(g.scale.y, sel ? 1.5 : 1, 8, 0.016)
    })
    if (focusRing.current) {
      focusRing.current.visible = !!f
      if (f) {
        focusRing.current.position.set(EXHIBITS[f].x * HOLO_S, 0.02, EXHIBITS[f].z * HOLO_S)
        const s = 1 + ((t * 0.9) % 1) * 1.6
        focusRing.current.scale.set(s, s, s)
        ;(focusRing.current.material as THREE.MeshBasicMaterial).opacity = 1 - ((t * 0.9) % 1)
        ;(focusRing.current.material as THREE.MeshBasicMaterial).color.set(EXHIBITS[f].color).multiplyScalar(2.2)
      }
    }
    if (hlRef.current) {
      hlRef.current.visible = !!f
      if (f) {
        const e = EXHIBITS[f]
        const L = Math.hypot(e.x, e.z)
        hlRef.current.position.set((e.x / L) * 6.1, 0.17, (e.z / L) * 6.1)
        hlRef.current.rotation.y = Math.atan2(e.x, e.z)
        ;(hlRef.current.material as THREE.MeshBasicMaterial).color.set(e.color).multiplyScalar(1.4 + 0.9 * Math.sin(t * 4))
      }
    }
    void tmp
  })

  return (
    <group position={[ex.x, 0, ex.z]}>
      <PadRing radius={10.3} color={ex.color} />
      <Label title="Central Information Station" sub="Overview · Domains · Projects" color={ex.color} position={[0, 15.4, 0]} scale={1.7} fadeFar={130} />

      {/* ---- quảng trường ---- */}
      <mesh geometry={G.plazaDisc} material={K.titanium} receiveShadow />
      <mesh position={[0, 0.141, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[9.25, 96]} />
        <meshStandardMaterial color="#0a1018" metalness={0.8} roughness={0.28} envMapIntensity={0.8} />
      </mesh>
      <mesh position={[0, 0.151, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[18.8, 18.8]} />
        <meshBasicMaterial map={plaza.tex} transparent toneMapped={false} depthWrite={false} />
      </mesh>
      <mesh geometry={G.ticks} material={K.bronze} />
      <mesh ref={hlRef} visible={false}>
        <boxGeometry args={[0.28, 0.02, 4.8]} />
        <meshBasicMaterial toneMapped={false} />
      </mesh>

      {/* ---- bàn Atlas ---- */}
      <mesh geometry={G.ped} material={K.gunmetal} castShadow receiveShadow />
      <mesh position={[0, 0.955, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.86, 64]} />
        <meshBasicMaterial map={plaza.tex} toneMapped={false} color="#9fd8ff" />
      </mesh>
      <mesh position={[0, 0.975, 0]} rotation={[-Math.PI / 2, 0, 0]} material={K.glassSmoke}>
        <circleGeometry args={[1.88, 64]} />
      </mesh>
      <group ref={holo} position={[0, HOLO_Y, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} material={holoMat}>
          <circleGeometry args={[HOLO_R, 96]} />
        </mesh>
        {NODES.map((e, i) => (
          <group key={e.id} ref={(g) => { nodeRefs.current[i] = g }} position={[e.x * HOLO_S, 0, e.z * HOLO_S]}>
            <mesh position={[0, 0.2, 0]} material={led(e.color, 1.8)}><cylinderGeometry args={[0.007, 0.007, 0.4, 6]} /></mesh>
            <mesh position={[0, 0.42, 0]} material={led(e.color, 3)}><octahedronGeometry args={[0.04, 0]} /></mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} material={led(e.color, 2)}><ringGeometry args={[0.07, 0.085, 24]} /></mesh>
            <Hit id={`atlas-${e.id}`} label={e.name} hint="Chạm để xem · chạm lần nữa để mở hồ sơ" maxDist={14} size={[0.3, 0.7, 0.3]} position={[0, 0.3, 0]} onClick={() => pick(e.id)} />
          </group>
        ))}
        <mesh ref={marker} rotation={[0, 0, 0]}>
          <coneGeometry args={[0.035, 0.12, 4]} />
          <meshBasicMaterial color={new THREE.Color('#ffffff').multiplyScalar(3)} toneMapped={false} />
        </mesh>
        <mesh ref={focusRing} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
          <ringGeometry args={[0.08, 0.1, 32]} />
          <meshBasicMaterial transparent toneMapped={false} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
        <sprite position={[0, 0.85, 0]} scale={[1.6, 0.3, 1]}>
          <spriteMaterial map={tagTex.tex} transparent depthWrite={false} toneMapped={false} />
        </sprite>
        <sprite position={[0, 0.05, 0]} scale={[4.2, 4.2, 1]}>
          <spriteMaterial map={glow} color="#7fdcff" transparent opacity={0.14} blending={THREE.AdditiveBlending} depthWrite={false} />
        </sprite>
      </group>
      <Hit id="station" label="Central Information Station" hint="Mở hồ sơ tổng quan" panel="about" maxDist={60} shape="cylinder" size={[2.2, 1.1, 0]} position={[0, 0.55, 0]} />
      <mesh position={[0, 9.55, 0]} geometry={coneGeo} material={coneMat} />

      {/* ---- trụ cong + vòng thông tin + vương miện ---- */}
      <mesh geometry={G.pylons} material={pylonMat} castShadow receiveShadow />
      <mesh geometry={G.strips} material={stripMat} />
      <mesh geometry={G.crown} material={K.titanium} castShadow />
      <mesh geometry={G.projector} material={K.gunmetal} castShadow />
      {Array.from({ length: 12 }, (_, i) => (
        <mesh key={i} position={[Math.sin((i / 12) * TAU) * 2.6, 9.22, Math.cos((i / 12) * TAU) * 2.6]} rotation={[Math.PI / 2, 0, 0]} material={led('#bdeaff', 3)}>
          <circleGeometry args={[0.09, 12]} />
        </mesh>
      ))}
      <mesh position={[0, 12.5, 0]} geometry={beamGeo} material={beamMat} />
      {G.rings.map((g, i) => <mesh key={i} geometry={g} material={K.titanium} castShadow />)}
      {Array.from({ length: 6 }, (_, k) => {
        const th = (k * TAU) / 6
        const key = ['achievements', 'projects', 'domains', 'overview', 'focus', 'connect'][k]
        // th=0 là hướng nam (+z); OVERVIEW nằm ở phía bắc (th=π) để người đứng giữa quảng trường nhìn thẳng vào
        const thArc = 0.9
        const map = key === 'focus' ? focusTex.tex : panelTex[key].tex
        return (
          <group key={k}>
            <mesh position={[0, HALO_Y, 0]} rotation={[0, 0, 0]}>
              <cylinderGeometry args={[HALO_R, HALO_R, 1.4, 32, 1, true, th - thArc / 2, thArc]} />
              <meshBasicMaterial map={map} toneMapped={false} side={THREE.BackSide} />
            </mesh>
            <mesh position={[0, HALO_Y, 0]}>
              <cylinderGeometry args={[HALO_R + 0.1, HALO_R + 0.1, 1.4, 32, 1, true, th - thArc / 2, thArc]} />
              <meshBasicMaterial map={outerTex.tex} toneMapped={false} />
            </mesh>
            <Hit
              id={`halo-${key}`}
              label={key === 'focus' ? 'Atlas · hạng mục đang chọn' : `Station · ${key}`}
              hint={key === 'focus' ? 'Mở hồ sơ hạng mục' : 'Mở hồ sơ tổng quan'}
              maxDist={40}
              size={[5.2, 1.4, 0.4]}
              position={[Math.sin(th) * (HALO_R - 0.1), HALO_Y, Math.cos(th) * (HALO_R - 0.1)]}
              rotation={[0, th, 0]}
              onClick={() => { const f = useStation.getState().focus; openPanel(key === 'focus' && f ? PANEL_OF[f] : 'about') }}
            />
          </group>
        )
      })}

      {/* ---- ba kiosk ---- */}
      {KIOSKS.map((k, i) => (
        <group key={k.id} position={[Math.sin(k.th) * 4.7, 0, Math.cos(k.th) * 4.7]} rotation={[0, k.th + Math.PI, 0]}>
          <mesh position={[0, 0.04, 0]} geometry={rbox(1.2, 0.08, 1.0, 0.03)} material={K.titanium} />
          <mesh position={[0, 0.08, 0]} geometry={G.lectern} material={K.anodized} castShadow receiveShadow />
          <mesh position={[0, 0.09, 0.4]} material={led(ACCENT, 1.6)}><boxGeometry args={[0.9, 0.012, 0.012]} /></mesh>
          <group position={[0, 1.04, 0.0]} rotation={[-1.0, 0, 0]}>
            <mesh position={[0, 0, -0.01]} geometry={rbox(0.7, 0.5, 0.03, 0.015)} material={K.screenGlass} />
            <mesh position={[0, 0, 0.007]}>
              <planeGeometry args={[0.64, 0.4]} />
              <meshBasicMaterial map={kioskTex[i].tex} toneMapped={false} />
            </mesh>
            {i === 0 && <Hit id="kiosk-dossier" label="DOSSIER" hint={k.hint} panel="about" maxDist={9} size={[0.64, 0.4, 0.2]} />}
            {i === 1 && (
              <>
                <Hit id="kiosk-prev" label="Hạng mục trước" hint="Duyệt danh mục" maxDist={9} size={[0.14, 0.1, 0.2]} position={[-0.25, -0.12, 0.03]} onClick={() => cycle(-1)} />
                <Hit id="kiosk-next" label="Hạng mục tiếp" hint="Duyệt danh mục" maxDist={9} size={[0.14, 0.1, 0.2]} position={[-0.15, -0.12, 0.03]} onClick={() => cycle(1)} />
                <Hit id="kiosk-open" label="Mở hồ sơ hạng mục" hint="Mở bảng chi tiết" maxDist={9} size={[0.29, 0.1, 0.2]} position={[0.12, -0.12, 0.03]} onClick={() => { const f = useStation.getState().focus; if (f) openPanel(PANEL_OF[f]); else toast('Chọn một nút trên Atlas trước') }} />
              </>
            )}
            {i === 2 && LINKS.map(([slug, p], j) => (
              <Hit key={slug} id={`kiosk-link-${slug}`} label={slug.toUpperCase()} hint={p.confirmed ? 'Mở trang cá nhân' : 'Mở thư mục dự án'} maxDist={9} size={[0.29, 0.09, 0.2]} position={[-0.155 + (j % 2) * 0.31, 0.12 - Math.floor(j / 2) * 0.105, 0.03]} onClick={() => openExternal(p.url)} />
            ))}
          </group>
        </group>
      ))}
    </group>
  )
}
