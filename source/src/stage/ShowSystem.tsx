import { DomOcclusion } from '../scene/domOcclusion'
import { useReality } from '../reality/state'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Hit } from '../scene/Hit'
import { player } from '../world'
import { useStore } from '../store'
import { glowTexture } from '../gfx'
import { SHOWS, photoAllowed, MEDIA_POLICY, type Show, type ShowId, type Photo } from './shows'
import { useShow, showById, showElapsed, mediaFor, prefetchShowMedia, uploadPending, loadYouTubeAPI, type YTPlayer } from './showState'
import { LED_H, VID_W } from './ledShow'

const SANS = '"Space Grotesk", "Segoe UI", system-ui, sans-serif'
const BODY = 'Inter, "Segoe UI", system-ui, sans-serif'
const damp = THREE.MathUtils.damp

// ============================================================ vật liệu "ánh sáng chạm được"
const GLASS_VERT = /* glsl */ `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`
const GLASS_FRAG = /* glsl */ `
  uniform sampler2D uTex; uniform float uReveal; uniform float uHover; uniform float uTime;
  uniform vec3 uTint; uniform float uOpacity; uniform float uDir;
  varying vec2 vUv;
  float h21(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
  void main(){
    vec2 uv = vUv;
    float n = h21(floor(uv * vec2(90.0, 30.0)) + floor(uTime * 12.0));
    float d = mix(abs(uv.x - 0.5) * 2.0, 1.0 - uv.y, uDir);
    float R = uReveal * 1.2;
    float m = smoothstep(R, R - 0.12, d + (n - 0.5) * 0.06);
    float ca = 0.0015 + 0.0035 * (1.0 - uHover) + 0.01 * (1.0 - uReveal);
    vec4 t0 = texture2D(uTex, uv);
    float r = texture2D(uTex, uv + vec2(ca, 0.0)).r;
    float b = texture2D(uTex, uv - vec2(ca, 0.0)).b;
    vec3 col = vec3(r, t0.g, b);
    float sweep = exp(-pow((uv.x - fract(uTime * 0.11) * 1.8 + 0.4) * 7.0, 2.0)) * 0.45;
    float front = exp(-pow((d - R) * 16.0, 2.0)) * step(uReveal, 0.995) * step(0.001, uReveal);
    col *= 0.6 + 0.45 * uHover + sweep * t0.a * 0.6;
    float a = t0.a * m * uOpacity;
    gl_FragColor = vec4(col + uTint * front * 1.5, clamp(a + front * 0.35 * uOpacity, 0.0, 1.0));
  }`

function glassMaterial(tex: THREE.Texture, tint: string, additive = true, dir = 0) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: {
      uTex: { value: tex },
      uReveal: { value: 0 },
      uHover: { value: 0 },
      uTime: { value: 0 },
      uTint: { value: new THREE.Color(tint) },
      uOpacity: { value: 1 },
      uDir: { value: dir },
    },
    vertexShader: GLASS_VERT,
    fragmentShader: GLASS_FRAG,
  })
}

function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return { c, ctx: c.getContext('2d')!, tex }
}

function spaced(ctx: CanvasRenderingContext2D, txt: string, x: number, y: number, sp: number) {
  ctx.save()
  ;(ctx as unknown as { letterSpacing: string }).letterSpacing = `${sp}px`
  ctx.fillText(txt, x, y)
  ctx.restore()
}

function wrap(ctx: CanvasRenderingContext2D, txt: string, x: number, y: number, maxW: number, lh: number) {
  const words = txt.split(' ')
  let line = ''
  for (const w of words) {
    const test = line ? line + ' ' + w : w
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y)
      y += lh
      line = w
    } else line = test
  }
  if (line) ctx.fillText(line, x, y)
  return y + lh
}

const fontsReady = () => (document.fonts?.ready ?? Promise.resolve()).then(() => undefined)

/** vị trí camera trong hệ toạ độ cục bộ của nhóm sân khấu */
const _v = new THREE.Vector3()
function localCam(group: THREE.Object3D | null, cam: THREE.Camera) {
  if (!group) return null
  return group.worldToLocal(_v.copy(cam.position))
}

const hoverIs = (label: string) => useStore.getState().hover?.label === label

// ============================================================ Bộ chọn chương trình (FOH)
const ROW_W = 2.7
const ROW_H = 0.5
const SEL_Z = 10.95

function drawRow(ctx: CanvasRenderingContext2D, s: Show | null, live: boolean) {
  const W = 1024
  const H = 190
  ctx.clearRect(0, 0, W, H)
  if (!s) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.font = `600 34px ${SANS}`
    ctx.textAlign = 'center'
    spaced(ctx, 'TRẢ SÂN KHẤU VỀ DJ SET', W / 2, 108, 8)
    return
  }
  const accent = s.look.accent
  // chấm sáng màu chương trình
  const g = ctx.createRadialGradient(46, 98, 0, 46, 98, 34)
  g.addColorStop(0, '#ffffff')
  g.addColorStop(0.25, accent)
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 50, 100, 100)
  ctx.textAlign = 'left'
  ctx.fillStyle = accent
  ctx.font = `600 22px ${SANS}`
  spaced(ctx, `${s.dateLabel}   ·   ${s.kicker}`, 104, 52, 4)
  ctx.fillStyle = '#ffffff'
  ctx.font = `600 ${s.title.length > 22 ? 58 : 64}px ${SANS}`
  ctx.shadowColor = accent
  ctx.shadowBlur = 18
  ctx.fillText(s.title, 102, 124)
  ctx.shadowBlur = 0
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.font = `400 22px ${BODY}`
  ctx.fillText(s.venue, 104, 166)
  if (live) {
    ctx.textAlign = 'right'
    ctx.fillStyle = accent
    ctx.font = `700 20px ${SANS}`
    spaced(ctx, '● ĐANG DIỄN', W - 20, 52, 4)
  }
}

function SelectorRow({ show, y, index, open, live, onPick }: { show: Show | null; y: number; index: number; open: boolean; live: boolean; onPick: () => void }) {
  const cv = useMemo(() => makeCanvas(1024, 190), [])
  const mat = useMemo(() => glassMaterial(cv.tex, show?.look.accent ?? '#ffffff'), [cv, show])
  const lineMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(show?.look.accent ?? '#ffffff').multiplyScalar(2.2), transparent: true, opacity: 0, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false }), [show])
  const grp = useRef<THREE.Group>(null)
  const line = useRef<THREE.Mesh>(null)
  const label = show ? `Gọi lại · ${show.title}` : 'Kết thúc show'
  useEffect(() => {
    let alive = true
    drawRow(cv.ctx, show, live)
    cv.tex.needsUpdate = true
    fontsReady().then(() => {
      if (!alive) return
      drawRow(cv.ctx, show, live)
      cv.tex.needsUpdate = true
    })
    return () => {
      alive = false
    }
  }, [cv, show, live])
  const st = useRef({ reveal: 0, hover: 0 }).current
  useFrame((state, dt) => {
    const target = open ? 1 : 0
    const delay = open ? index * 0.09 : (3 - index) * 0.05
    st.reveal = damp(st.reveal, target, open ? 3.2 - delay * 6 : 6, dt)
    const h = open && hoverIs(label) ? 1 : 0
    st.hover = damp(st.hover, h, 10, dt)
    const u = mat.uniforms
    u.uReveal.value = st.reveal
    u.uHover.value = st.hover
    u.uTime.value = state.clock.elapsedTime
    u.uOpacity.value = Math.min(1, st.reveal * 1.4)
    if (grp.current) {
      grp.current.position.y = y - (1 - st.reveal) * 0.35
      grp.current.position.z = SEL_Z + st.hover * 0.06
      grp.current.visible = st.reveal > 0.005
    }
    if (line.current) {
      line.current.scale.x = 0.15 + st.hover * 0.85 + 0.0001
      lineMat.opacity = (0.25 + st.hover * 0.75) * st.reveal
    }
  })
  return (
    <group ref={grp} position={[0, y, SEL_Z]}>
      <mesh material={mat} renderOrder={20}>
        <planeGeometry args={[ROW_W, ROW_H * (show ? 1 : 0.55)]} />
      </mesh>
      <mesh ref={line} position={[0.05, -ROW_H * (show ? 0.5 : 0.3), 0]} material={lineMat} renderOrder={21}>
        <planeGeometry args={[ROW_W * 0.94, 0.008]} />
      </mesh>
      {open && <Hit id={`show-pick-${show?.id ?? 'end'}`} label={label} hint={show ? 'Đánh thức sân khấu với chương trình này' : 'Quay lại sân khấu DJ'} maxDist={8} size={[ROW_W, ROW_H * (show ? 0.95 : 0.5), 0.12]} onClick={onPick} />}
    </group>
  )
}

function SelectorVeil({ open }: { open: boolean }) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 256
    const x = c.getContext('2d')!
    const g = x.createRadialGradient(128, 128, 10, 128, 128, 128)
    g.addColorStop(0, 'rgba(2,3,10,0.8)')
    g.addColorStop(0.6, 'rgba(2,3,10,0.58)')
    g.addColorStop(1, 'rgba(2,3,10,0)')
    x.fillStyle = g
    x.fillRect(0, 0, 256, 256)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }), [tex])
  const ref = useRef<THREE.Mesh>(null)
  useFrame((_, dt) => {
    mat.opacity = damp(mat.opacity, open ? 1 : 0, open ? 2.5 : 6, dt)
    if (ref.current) ref.current.visible = mat.opacity > 0.01
  })
  return (
    <mesh ref={ref} position={[0, 2.0, SEL_Z - 0.06]} material={mat} renderOrder={18}>
      <planeGeometry args={[ROW_W * 1.6, 2.6]} />
    </mesh>
  )
}

function SelectorHeader({ open }: { open: boolean }) {
  const cv = useMemo(() => makeCanvas(1024, 90), [])
  const mat = useMemo(() => glassMaterial(cv.tex, '#ffffff'), [cv])
  useEffect(() => {
    const draw = () => {
      const c = cv.ctx
      c.clearRect(0, 0, 1024, 90)
      c.textAlign = 'center'
      c.fillStyle = 'rgba(255,255,255,0.9)'
      c.font = `600 26px ${SANS}`
      spaced(c, 'S H O W T I M E', 512, 34, 6)
      c.fillStyle = 'rgba(255,255,255,0.5)'
      c.font = `400 22px ${BODY}`
      c.fillText('Chạm vào một chương trình để gọi nó trở lại sân khấu', 512, 74)
      const g = c.createLinearGradient(0, 0, 1024, 0)
      g.addColorStop(0, 'rgba(255,255,255,0)')
      g.addColorStop(0.5, 'rgba(255,255,255,0.8)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      c.fillStyle = g
      c.fillRect(0, 88, 1024, 2)
      cv.tex.needsUpdate = true
    }
    draw()
    fontsReady().then(draw)
  }, [cv])
  const st = useRef({ r: 0 }).current
  const ref = useRef<THREE.Mesh>(null)
  useFrame((s, dt) => {
    st.r = damp(st.r, open ? 1 : 0, open ? 2.5 : 7, dt)
    mat.uniforms.uReveal.value = st.r
    mat.uniforms.uOpacity.value = st.r
    mat.uniforms.uTime.value = s.clock.elapsedTime
    if (ref.current) ref.current.visible = st.r > 0.005
  })
  return (
    <mesh ref={ref} position={[0, 2.98, SEL_Z]} material={mat} renderOrder={20}>
      <planeGeometry args={[ROW_W, ROW_W * (90 / 1024)]} />
    </mesh>
  )
}

/** Các nút ánh sáng nhỏ nổi trên bàn FOH khi show đang diễn */
function Pill({ x, text, label, hint, onClick, accent, visible }: { x: number; text: string; label: string; hint: string; onClick: () => void; accent: string; visible: boolean }) {
  const cv = useMemo(() => makeCanvas(512, 96), [])
  const mat = useMemo(() => glassMaterial(cv.tex, accent), [cv, accent])
  useEffect(() => {
    const draw = () => {
      const c = cv.ctx
      c.clearRect(0, 0, 512, 96)
      c.strokeStyle = 'rgba(255,255,255,0.45)'
      c.lineWidth = 2
      c.beginPath()
      c.roundRect?.(6, 10, 500, 76, 38)
      c.stroke()
      c.fillStyle = '#ffffff'
      c.textAlign = 'center'
      c.font = `600 30px ${SANS}`
      spaced(c, text, 256, 58, 3)
      cv.tex.needsUpdate = true
    }
    draw()
    fontsReady().then(draw)
  }, [cv, text])
  const st = useRef({ r: 0, h: 0 }).current
  const ref = useRef<THREE.Group>(null)
  useFrame((s, dt) => {
    st.r = damp(st.r, visible ? 1 : 0, 4, dt)
    st.h = damp(st.h, visible && hoverIs(label) ? 1 : 0, 10, dt)
    const u = mat.uniforms
    u.uReveal.value = st.r
    u.uOpacity.value = st.r * (0.55 + 0.45 * st.h)
    u.uHover.value = st.h
    u.uTime.value = s.clock.elapsedTime
    if (ref.current) ref.current.visible = st.r > 0.01
  })
  return (
    <group ref={ref} position={[x, 1.48, 11.25]} rotation={[-0.25, 0, 0]}>
      <mesh material={mat} renderOrder={22}>
        <planeGeometry args={[0.9, 0.169]} />
      </mesh>
      {visible && <Hit id={`show-pill-${label}`} label={label} hint={hint} maxDist={6} size={[0.9, 0.2, 0.1]} onClick={onClick} />}
    </group>
  )
}

export function ShowSelector({ stageGroup, onPick }: { stageGroup: React.RefObject<THREE.Group | null>; onPick: (id: ShowId | null) => void }) {
  const selectorOpen = useShow((s) => s.selectorOpen)
  const active = useShow((s) => s.active)
  const clip = useShow((s) => s.clip)
  const videoMuted = useShow((s) => s.videoMuted)
  const [near, setNear] = useState(false)
  const nearRef = useRef(false)
  useFrame((state) => {
    const p = localCam(stageGroup.current, state.camera)
    if (!p) return
    const inZone = Math.abs(p.x) < 6.5 && p.z > 7.5 && p.z < 21
    if (inZone !== nearRef.current) {
      nearRef.current = inZone
      setNear(inZone)
    }
  })
  const open = near && selectorOpen
  const show = showById(active)
  const live = !!active && !selectorOpen
  return (
    <group>
      <SelectorVeil open={open} />
      <SelectorHeader open={open} />
      {SHOWS.map((s, i) => (
        <SelectorRow key={s.id} show={s} y={2.52 - i * 0.5} index={i} open={open} live={active === s.id} onPick={() => onPick(s.id)} />
      ))}
      <SelectorRow show={null} y={2.52 - 3 * 0.5 + 0.17} index={3} open={open && !!active} live={false} onPick={() => onPick(null)} />
      <Pill x={-1.0} visible={near && live} text="◂ CHƯƠNG TRÌNH" label="Mở bộ chọn chương trình" hint="Chọn show khác" accent={show?.look.accent ?? '#fff'} onClick={() => useShow.getState().setSelector(true)} />
      <Pill x={0} visible={near && live && !!show && show.clips.length > 1} text={`CLIP ${clip + 1}/${show?.clips.length ?? 1} ▸`} label="Clip tiếp theo trên LED" hint="Đổi footage" accent={show?.look.accent ?? '#fff'} onClick={() => useShow.getState().nextClip()} />
      <Pill x={1.0} visible={near && live} text={videoMuted ? 'ÂM THANH: TẮT' : 'ÂM THANH: BẬT'} label="Âm thanh footage" hint="Bật / tắt tiếng video" accent={show?.look.accent ?? '#fff'} onClick={() => useShow.getState().setVideoMuted(!useShow.getState().videoMuted)} />
    </group>
  )
}

// ============================================================ Tấm thông tin
const INFO_W = 1024
const INFO_H = 1560
export const INFO_POS: [number, number, number] = [-4.05, 2.42, 10.35]
export const INFO_ROT = 0.88
export const INFO_SIZE: [number, number] = [1.95, 1.95 * (INFO_H / INFO_W)]

function drawInfo(ctx: CanvasRenderingContext2D, s: Show, clipLine: string, status: string) {
  const W = INFO_W
  const H = INFO_H
  ctx.clearRect(0, 0, W, H)
  // nền mờ, tan ở mép — giữ chữ đọc được mà không thành "bảng"
  const bg = ctx.createLinearGradient(0, 0, W, 0)
  bg.addColorStop(0, 'rgba(3,5,12,0)')
  bg.addColorStop(0.12, 'rgba(3,5,12,0.62)')
  bg.addColorStop(0.88, 'rgba(3,5,12,0.62)')
  bg.addColorStop(1, 'rgba(3,5,12,0)')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  const vg = ctx.createLinearGradient(0, 0, 0, H)
  vg.addColorStop(0, 'rgba(0,0,0,1)')
  vg.addColorStop(0.05, 'rgba(0,0,0,0)')
  vg.addColorStop(0.95, 'rgba(0,0,0,0)')
  vg.addColorStop(1, 'rgba(0,0,0,1)')
  ctx.globalCompositeOperation = 'destination-out'
  ctx.fillStyle = vg
  ctx.fillRect(0, 0, W, H)
  ctx.globalCompositeOperation = 'source-over'
  const A = s.look.accent
  const L = 112
  const R = W - 100
  ctx.fillStyle = A
  ctx.fillRect(L - 34, 110, 3, 250)
  ctx.textAlign = 'left'
  ctx.font = `600 24px ${SANS}`
  spaced(ctx, s.kicker, L, 128, 5)
  ctx.fillStyle = '#fff'
  ctx.font = `700 86px ${SANS}`
  ctx.shadowColor = A
  ctx.shadowBlur = 26
  ctx.fillText(s.titleLines[0], L, 226)
  ctx.fillText(s.titleLines[1], L, 318)
  ctx.shadowBlur = 0
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.font = `600 28px ${SANS}`
  spaced(ctx, s.dateLabel, L, 380, 4)
  ctx.font = `400 26px ${BODY}`
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  let y = wrap(ctx, s.venue, L, 422, R - L, 34)
  y = wrap(ctx, `Tổ chức: ${s.organizer}`, L, y, R - L, 34)
  ctx.font = `italic 400 25px ${BODY}`
  ctx.fillStyle = 'rgba(255,255,255,0.62)'
  y = wrap(ctx, s.thesis, L, y + 18, R - L, 35)
  // số liệu
  y += 30
  for (const f of s.facts) {
    ctx.fillStyle = A
    ctx.font = `700 76px ${SANS}`
    ctx.fillText(f.value, L, y + 62)
    const vw = ctx.measureText(f.value).width
    ctx.fillStyle = '#fff'
    ctx.font = `500 28px ${BODY}`
    wrap(ctx, f.label, L + vw + 22, y + 34, R - L - vw - 22, 32)
    ctx.fillStyle = 'rgba(255,255,255,0.48)'
    ctx.font = `400 19px ${BODY}`
    wrap(ctx, f.scope, L + vw + 22, y + 66, R - L - vw - 22, 24)
    y += 116
  }
  // vai trò
  y += 18
  const g = ctx.createLinearGradient(L, 0, R, 0)
  g.addColorStop(0, A)
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(L, y, R - L, 2)
  y += 52
  ctx.fillStyle = A
  ctx.font = `600 22px ${SANS}`
  spaced(ctx, 'VAI TRÒ CỦA TÔI', L, y, 6)
  y += 52
  ctx.fillStyle = '#fff'
  ctx.font = `600 38px ${SANS}`
  y = wrap(ctx, s.roleTitle, L, y, R - L, 44)
  y += 6
  ctx.font = `400 25px ${BODY}`
  for (const r of s.roleLines) {
    ctx.fillStyle = A
    ctx.fillRect(L, y - 9, 14, 2)
    ctx.fillStyle = 'rgba(255,255,255,0.86)'
    y = wrap(ctx, r, L + 30, y, R - L - 30, 32) + 4
  }
  ctx.font = `italic 400 20px ${BODY}`
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  y = wrap(ctx, s.roleNote, L, y + 8, R - L, 27)
  // footage + nguồn
  y = Math.max(y + 26, H - 210)
  ctx.fillStyle = 'rgba(255,255,255,0.18)'
  ctx.fillRect(L, y - 30, R - L, 1)
  ctx.font = `600 18px ${SANS}`
  ctx.fillStyle = A
  spaced(ctx, `LED · ${status}`, L, y, 3)
  ctx.font = `400 20px ${BODY}`
  ctx.fillStyle = 'rgba(255,255,255,0.66)'
  y = wrap(ctx, clipLine, L, y + 32, R - L, 26)
  ctx.fillStyle = 'rgba(255,255,255,0.42)'
  ctx.font = `400 18px ${BODY}`
  y = wrap(ctx, `Nguồn: ${s.sources.join(' · ')}`, L, y + 6, R - L, 24)
  if (MEDIA_POLICY === 'review') wrap(ctx, 'Ảnh báo chí hiển thị từ nguồn gốc kèm ghi công — đang chờ cấp phép tái xuất bản.', L, y, R - L, 24)
}

export const VIDEO_STATUS: Record<string, string> = {
  off: 'CHỜ',
  loading: 'ĐANG TẢI FOOTAGE…',
  playing: 'ĐANG PHÁT FOOTAGE THẬT',
  paused: 'TẠM DỪNG',
  blocked: 'TRÌNH DUYỆT CHẶN VIDEO — TRÌNH CHIẾU ẢNH',
  error: 'KHÔNG PHÁT ĐƯỢC VIDEO — TRÌNH CHIẾU ẢNH',
}
export const clipLineFor = (c: { title: string; channel: string; published: string } | undefined) => (c ? `“${c.title}” — YouTube embed chính thức, kênh ${c.channel} (${c.published}).` : '')

export function useInfoTexture() {
  const active = useShow((s) => s.active)
  const clip = useShow((s) => s.clip)
  const video = useShow((s) => s.video)
  const cv = useMemo(() => makeCanvas(INFO_W, INFO_H), [])
  useEffect(() => {
    const s = showById(active)
    if (!s) return
    const c = s.clips[clip]
    const status = VIDEO_STATUS[video]
    const line = clipLineFor(c)
    let alive = true
    const draw = () => {
      if (!alive) return
      drawInfo(cv.ctx, s, line, status)
      cv.tex.needsUpdate = true
    }
    draw()
    fontsReady().then(draw)
    return () => {
      alive = false
    }
  }, [active, clip, video, cv])
  return cv.tex
}

export function InfoVeil({ tex }: { tex: THREE.Texture }) {
  const active = useShow((s) => s.active)
  const startedAt = useShow((s) => s.startedAt)
  const focus = useShow((s) => s.focus)
  const mat = useMemo(() => glassMaterial(tex, '#ffffff', false, 1), [tex])
  const ref = useRef<THREE.Group>(null)
  const st = useRef({ r: 0, h: 0, last: 0 }).current
  const show = showById(active)
  useEffect(() => {
    st.r = 0
    if (show) mat.uniforms.uTint.value.set(show.look.accent)
  }, [startedAt, show, mat, st])
  useFrame((s, dt) => {
    const el = showElapsed()
    const want = active && el > 3.1 && focus?.kind !== 'info' ? 1 : 0
    st.r = damp(st.r, want, want ? 0.9 : 6, dt)
    st.h = damp(st.h, hoverIs('Thông tin chương trình') ? 1 : 0, 8, dt)
    const u = mat.uniforms
    u.uReveal.value = st.r
    u.uOpacity.value = Math.min(1, st.r * 1.3)
    u.uHover.value = 0.4 + st.h * 0.6
    u.uTime.value = s.clock.elapsedTime
    if (ref.current) {
      ref.current.visible = st.r > 0.003
      ref.current.position.y = INFO_POS[1] + Math.sin(s.clock.elapsedTime * 0.6) * 0.025
    }
  })
  return (
    <group ref={ref} position={INFO_POS} rotation={[0, INFO_ROT, 0]}>
      <mesh material={mat} renderOrder={19}>
        <planeGeometry args={INFO_SIZE} />
      </mesh>
      {active && <Hit id="show-info" label="Thông tin chương trình" hint="Xem gần" maxDist={9} size={[INFO_SIZE[0], INFO_SIZE[1], 0.1]} onClick={() => useShow.getState().setFocus({ show: active, idx: 0, kind: 'info' })} />}
    </group>
  )
}

// ============================================================ Ảnh hai cánh sân khấu
const PHOTO_VERT = GLASS_VERT
const PHOTO_FRAG = /* glsl */ `
  uniform sampler2D uTex; uniform float uReveal; uniform float uHover; uniform float uTime; uniform vec3 uTint; uniform float uLevel;
  varying vec2 vUv;
  float h21(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main(){
    vec2 uv = vUv;
    float e = smoothstep(0.0, 0.05, uv.x) * smoothstep(1.0, 0.95, uv.x) * smoothstep(0.0, 0.07, uv.y) * smoothstep(1.0, 0.93, uv.y);
    vec2 cell = floor(uv * vec2(48.0, 32.0));
    float n = h21(cell);
    float R = uReveal * 1.25;
    float m = step(uv.y + n * 0.25, R);
    float front = smoothstep(0.08, 0.0, abs(uv.y + n * 0.25 - R)) * step(uReveal, 0.995);
    vec3 c = texture2D(uTex, uv).rgb;
    float leak = smoothstep(0.55, 1.0, uv.x * 0.7 + uv.y * 0.5 + 0.15 * sin(uTime * 0.35)) * 0.35;
    c = c * (0.62 + 0.25 * uLevel + 0.38 * uHover) + uTint * leak * (0.5 + 0.5 * uLevel);
    float a = e * m;
    gl_FragColor = vec4(c + uTint * front * 2.0, a * (0.92 + 0.08 * uHover));
  }`

export interface PhotoSlot {
  photo: Photo
  idx: number
  pos: THREE.Vector3
  rotY: number
  w: number
  h: number
}

const photoAspect = (p: Photo) => p.aspect ?? (p.url.includes('ytimg') ? 16 / 9 : 1.5)

// Ảnh nổi đối diện tấm thông tin qua khu FOH (đối xứng gương: x và hướng xoay đảo dấu)
const FOH_PHOTO_POS = new THREE.Vector3(-INFO_POS[0], INFO_POS[1] + 0.05, INFO_POS[2])
const FOH_PHOTO_H = 1.5

function slotsFor(show: Show): PhotoSlot[] {
  const list = show.photos.filter(photoAllowed)
  let wing = 0
  const out: PhotoSlot[] = []
  list.forEach((p, idx) => {
    const aspect = photoAspect(p)
    if (p.placement === 'foh') {
      out.push({ photo: p, idx, pos: FOH_PHOTO_POS.clone(), rotY: -INFO_ROT, w: FOH_PHOTO_H * aspect, h: FOH_PHOTO_H })
      return
    }
    const side = wing % 2 === 0 ? -1 : 1
    const k = Math.floor(wing / 2)
    const h = 1.72 - k * 0.06
    out.push({
      photo: p,
      idx,
      pos: new THREE.Vector3(side * (11.0 + k * 1.15), 3.05 + k * 0.62, 2.1 - k * 2.35),
      rotY: -side * (0.74 - k * 0.07),
      w: h * aspect,
      h,
    })
    wing++
  })
  return out
}

function captionCanvas(p: Photo, accent: string) {
  const cv = makeCanvas(1024, 150)
  const draw = () => {
    const c = cv.ctx
    c.clearRect(0, 0, 1024, 150)
    c.textAlign = 'left'
    c.fillStyle = accent
    c.fillRect(0, 22, 4, 92)
    c.fillStyle = '#ffffff'
    c.font = `500 34px ${BODY}`
    wrap(c, p.caption, 24, 52, 990, 40)
    c.fillStyle = 'rgba(255,255,255,0.55)'
    c.font = `400 24px ${BODY}`
    c.fillText(`${p.credit}${p.clearance === 'press-pending' ? ' · chờ cấp phép' : ''}`, 24, 134)
    cv.tex.needsUpdate = true
  }
  draw()
  fontsReady().then(draw)
  return cv
}

function PhotoPlate({ slot, show, idx, tint }: { slot: PhotoSlot; show: Show; idx: number; tint: string }) {
  const entry = mediaFor(slot.photo.url)
  const blank = useMemo(() => new THREE.Texture(), [])
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        side: THREE.DoubleSide,
        uniforms: { uTex: { value: blank }, uReveal: { value: 0 }, uHover: { value: 0 }, uTime: { value: 0 }, uTint: { value: new THREE.Color(tint) }, uLevel: { value: 0.5 } },
        vertexShader: PHOTO_VERT,
        fragmentShader: PHOTO_FRAG,
      }),
    [blank, tint],
  )
  const cap = useMemo(() => captionCanvas(slot.photo, show.look.accent), [slot, show])
  const capMat = useMemo(() => new THREE.MeshBasicMaterial({ map: cap.tex, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }), [cap])
  const haloMat = useMemo(() => new THREE.SpriteMaterial({ map: glowTexture(), color: new THREE.Color(tint), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }), [tint])
  const grp = useRef<THREE.Group>(null)
  const st = useRef({ r: 0, h: 0 }).current
  const label = `Ảnh · ${slot.photo.caption.slice(0, 38)}${slot.photo.caption.length > 38 ? '…' : ''}`
  const focus = useShow((s) => s.focus)
  const focused = focus?.kind === 'photo' && focus.show === show.id && focus.idx === idx
  useFrame((s, dt) => {
    const el = showElapsed()
    const ready = entry.ok && entry.tex
    if (ready && mat.uniforms.uTex.value !== entry.tex) mat.uniforms.uTex.value = entry.tex
    const want = ready && el > 3.6 + idx * 0.35 && !focused ? 1 : 0
    st.r = damp(st.r, want, want ? 1.3 : 6, dt)
    st.h = damp(st.h, hoverIs(label) ? 1 : 0, 8, dt)
    const u = mat.uniforms
    u.uReveal.value = st.r
    u.uHover.value = st.h
    u.uTime.value = s.clock.elapsedTime + idx
    const beat = (el * show.look.bpm) / 60
    u.uLevel.value = 0.55 + 0.45 * Math.exp(-(beat % 1) * 4) * (show.look.mode === 'chase' ? 1 : 0.4)
    capMat.opacity = st.h * st.r
    haloMat.opacity = st.r * (0.18 + 0.25 * st.h)
    if (grp.current) {
      grp.current.visible = st.r > 0.003
      grp.current.position.set(slot.pos.x, slot.pos.y + Math.sin(s.clock.elapsedTime * 0.5 + idx * 1.7) * 0.05, slot.pos.z)
      grp.current.rotation.y = slot.rotY * (1 - st.h * 0.12)
    }
  })
  return (
    <group ref={grp} position={slot.pos} rotation={[0, slot.rotY, 0]}>
      <sprite position={[0, 0, -0.25]} scale={[slot.w * 1.9, slot.h * 2.1, 1]} material={haloMat} />
      <mesh material={mat} renderOrder={15}>
        <planeGeometry args={[slot.w, slot.h]} />
      </mesh>
      <mesh position={[0, -slot.h / 2 - 0.2, 0.01]} material={capMat} renderOrder={16}>
        <planeGeometry args={[slot.w, slot.w * (150 / 1024)]} />
      </mesh>
      <Hit id={`show-photo-${show.id}-${idx}`} label={label} hint="Ngắm ảnh lớn" maxDist={18} size={[slot.w, slot.h, 0.1]} onClick={() => useShow.getState().setFocus({ show: show.id, idx, kind: 'photo' })} />
    </group>
  )
}

export function PhotoWings() {
  const active = useShow((s) => s.active)
  const show = showById(active)
  const slots = useMemo(() => (show ? slotsFor(show) : []), [show])
  if (!show) return null
  return (
    <group key={show.id}>
      {slots.map((sl) => (
        <PhotoPlate key={sl.photo.url} slot={sl} show={show} idx={sl.idx} tint={show.look.colors[sl.idx % 2 ? 2 : 1] ?? show.look.accent} />
      ))}
    </group>
  )
}

// ============================================================ Ngắm gần: panel ảo render 1:1 điểm ảnh
// Khi xem gần, panel/ảnh được dựng lại ở ĐÚNG độ phân giải bộ đệm vẽ và render trong một lượt riêng
// SAU EffectComposer (useFrame priority 2) bằng camera trực giao tính theo pixel:
//   – 1 texel = 1 điểm ảnh, căn đúng lưới pixel, LinearFilter không mipmap → không lấy mẫu mờ;
//   – không đi qua Bloom / Noise / Vignette / Chromatic Aberration / ACES → chữ không bị lóa, nhòe hay sạn;
//   – chữ của tấm thông tin được vẽ lại dạng vector ở tỉ lệ đích, ảnh được resample chất lượng cao đúng kích thước.
// Không đổi pixel ratio, không đụng tới cơ chế Low/High.

function crispTexture(c: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.generateMipmaps = false
  t.minFilter = THREE.LinearFilter
  t.magFilter = THREE.LinearFilter
  t.anisotropy = 1
  return t
}

function wrapLines(ctx: CanvasRenderingContext2D, txt: string, maxW: number) {
  const out: string[] = []
  let line = ''
  for (const w of txt.split(' ')) {
    const test = line ? line + ' ' + w : w
    if (ctx.measureText(test).width > maxW && line) {
      out.push(line)
      line = w
    } else line = test
  }
  if (line) out.push(line)
  return out
}

/** Khung ảnh ánh sáng: ảnh resample đúng kích thước đích, viền phát sáng nằm NGOÀI vùng ảnh. */
function photoPanelCanvas(img: HTMLImageElement, accent: string, bw: number, bh: number) {
  const nw = img.naturalWidth
  const nh = img.naturalHeight
  let k = Math.min((bw * 0.86) / nw, (bh * 0.72) / nh)
  if (Math.abs(k - 1) < 0.04) k = 1 // gần kích thước gốc → hiển thị đúng pixel gốc
  const iw = Math.round(nw * k)
  const ih = Math.round(nh * k)
  const P = Math.max(10, Math.round(bh * 0.02))
  const c = document.createElement('canvas')
  c.width = iw + P * 2
  c.height = ih + P * 2
  const x = c.getContext('2d')!
  x.save()
  x.shadowColor = accent
  x.shadowBlur = P * 0.9
  x.strokeStyle = accent
  x.globalAlpha = 0.85
  x.lineWidth = 2
  x.strokeRect(P - 1.5, P - 1.5, iw + 3, ih + 3)
  x.restore()
  x.imageSmoothingEnabled = true
  x.imageSmoothingQuality = 'high'
  if (k === 1) x.drawImage(img, P, P)
  else x.drawImage(img, P, P, iw, ih)
  return { c, inner: iw }
}

function captionPanelCanvas(p: Photo, accent: string, width: number, bh: number, hint: string) {
  const fs = Math.round(THREE.MathUtils.clamp(bh * 0.022, 13, 28))
  const pad = Math.round(fs * 0.9)
  const meas = document.createElement('canvas').getContext('2d')!
  meas.font = `500 ${fs}px ${BODY}`
  const lines = wrapLines(meas, p.caption, width - pad * 2)
  const lh = Math.round(fs * 1.32)
  const h = pad + lines.length * lh + Math.round(fs * 0.4) + Math.round(fs * 0.86 * 1.4) + Math.round(fs * 0.8) + Math.round(fs * 0.8) + pad
  const c = document.createElement('canvas')
  c.width = Math.round(width)
  c.height = h
  const x = c.getContext('2d')!
  x.fillStyle = accent
  x.fillRect(0, pad * 0.6, 3, h - pad * 1.2)
  x.textAlign = 'left'
  x.textBaseline = 'alphabetic'
  x.fillStyle = '#ffffff'
  x.font = `500 ${fs}px ${BODY}`
  let y = pad + fs
  for (const l of lines) {
    x.fillText(l, pad, y)
    y += lh
  }
  y += Math.round(fs * 0.25)
  x.fillStyle = 'rgba(255,255,255,0.66)'
  x.font = `400 ${Math.round(fs * 0.8)}px ${BODY}`
  x.fillText(`${p.credit}${p.clearance === 'press-pending' ? ' · chờ cấp phép' : ''}`, pad, y)
  y += Math.round(fs * 1.5)
  x.fillStyle = 'rgba(255,255,255,0.45)'
  x.font = `600 ${Math.round(fs * 0.62)}px ${SANS}`
  spaced(x, hint, pad, y, 3)
  return c
}

function hintCanvas(text: string, bh: number) {
  const fs = Math.round(THREE.MathUtils.clamp(bh * 0.016, 11, 18))
  const c = document.createElement('canvas')
  const meas = c.getContext('2d')!
  meas.font = `600 ${fs}px ${SANS}`
  c.width = Math.ceil(meas.measureText(text).width + text.length * 3 + 20)
  c.height = Math.round(fs * 2)
  const x = c.getContext('2d')!
  x.fillStyle = 'rgba(255,255,255,0.5)'
  x.font = `600 ${fs}px ${SANS}`
  x.textAlign = 'left'
  spaced(x, text, 10, Math.round(fs * 1.35), 3)
  return c
}

interface OvLayer {
  mesh: THREE.Mesh
  mat: THREE.MeshBasicMaterial
  w: number
  h: number
}

export function FocusViewer() {
  const focus = useShow((s) => s.focus)
  const { camera, gl } = useThree()
  const ov = useMemo(() => {
    const scene = new THREE.Scene()
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10)
    const geo = new THREE.PlaneGeometry(1, 1)
    const mk = (order: number): OvLayer => {
      const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.renderOrder = order
      mesh.frustumCulled = false
      mesh.visible = false
      scene.add(mesh)
      return { mesh, mat, w: 1, h: 1 }
    }
    const dim = mk(0)
    dim.mat.color.set('#02030a')
    dim.mesh.visible = true
    return { scene, cam, dim, main: mk(1), cap: mk(2) }
  }, [])
  const st = useRef({ a: 0, anchor: new THREE.Vector3(), key: '', bw: 0, bh: 0, kind: 'photo' as 'photo' | 'info' }).current
  const buf = useMemo(() => new THREE.Vector2(), [])
  const show = focus ? showById(focus.show) : null
  const photos = useMemo(() => (show ? show.photos.filter(photoAllowed) : []), [show])

  useEffect(() => {
    if (!focus) return
    st.anchor.copy(camera.position)
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') useShow.getState().setFocus(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focus, camera, st])

  useEffect(
    () => () => {
      ;[ov.main, ov.cap].forEach((l) => l.mat.map?.dispose())
    },
    [ov],
  )

  const setLayer = (l: OvLayer, c: HTMLCanvasElement | null) => {
    l.mat.map?.dispose()
    l.mat.map = c ? crispTexture(c) : null
    l.mat.needsUpdate = true
    l.w = c ? c.width : 1
    l.h = c ? c.height : 1
    l.mesh.visible = !!c
  }

  // đặt lớp theo pixel, căn đúng lưới điểm ảnh khi tỉ lệ = 1
  const place = (l: OvLayer, cx: number, cy: number, s: number, bw: number, bh: number) => {
    const ox = Math.abs((l.w - bw) % 2) === 1 ? 0.5 : 0
    const oy = Math.abs((l.h - bh) % 2) === 1 ? 0.5 : 0
    l.mesh.position.set(Math.round(cx) + ox, Math.round(cy) + oy, 0)
    l.mesh.scale.set(l.w * s, l.h * s, 1)
  }

  useFrame((state, dt) => {
    const f = useShow.getState().focus
    if (f && camera.position.distanceTo(st.anchor) > 0.7) useShow.getState().setFocus(null)
    gl.getDrawingBufferSize(buf)
    const bw = Math.round(buf.x)
    const bh = Math.round(buf.y)
    if (bw !== st.bw || bh !== st.bh) {
      st.bw = bw
      st.bh = bh
      ov.cam.left = -bw / 2
      ov.cam.right = bw / 2
      ov.cam.top = bh / 2
      ov.cam.bottom = -bh / 2
      ov.cam.updateProjectionMatrix()
      ov.dim.mesh.scale.set(bw + 4, bh + 4, 1)
    }
    // dựng lại nội dung khi đổi mục / đổi kích thước / đổi trạng thái footage
    if (f) {
      const s = useShow.getState()
      const sh = showById(f.show)
      const photo = f.kind === 'photo' ? photos[f.idx] : null
      const entry = photo ? mediaFor(photo.url) : null
      const key = `${f.kind}|${f.show}|${f.idx}|${bw}x${bh}|${f.kind === 'info' ? s.clip + s.video : entry?.ok}`
      if (key !== st.key && sh && (f.kind === 'info' || (entry?.ok && entry.img))) {
        st.key = key
        st.kind = f.kind
        if (f.kind === 'info') {
          let ih = Math.round(bh * 0.9)
          let iw = Math.round((ih * INFO_W) / INFO_H)
          if (iw > bw * 0.92) {
            iw = Math.floor(bw * 0.92)
            ih = Math.round((iw * INFO_H) / INFO_W)
          }
          const c = document.createElement('canvas')
          c.width = iw
          c.height = ih
          const x = c.getContext('2d')!
          x.setTransform(iw / INFO_W, 0, 0, ih / INFO_H, 0, 0)
          drawInfo(x, sh, clipLineFor(sh.clips[s.clip]), VIDEO_STATUS[s.video])
          setLayer(ov.main, c)
          setLayer(ov.cap, hintCanvas('CLICK · ESC · HOẶC BƯỚC ĐI ĐỂ ĐÓNG', bh))
        } else if (photo && entry?.img) {
          const { c, inner } = photoPanelCanvas(entry.img, sh.look.accent, bw, bh)
          setLayer(ov.main, c)
          const more = f.idx + 1 < photos.length
          const hint = `${f.idx + 1} / ${photos.length}   ·   CLICK ${more ? 'ẢNH TIẾP' : 'ĐÓNG'}   ·   ESC / BƯỚC ĐI ĐỂ ĐÓNG`
          setLayer(ov.cap, captionPanelCanvas(photo, sh.look.accent, Math.max(inner, Math.min(bw * 0.86, 720)), bh, hint))
        }
      }
    }
    st.a = damp(st.a, f ? 1 : 0, f ? 9 : 12, dt)
    if (!f && st.a < 0.003) {
      if (st.key) {
        st.key = ''
        setLayer(ov.main, null)
        setLayer(ov.cap, null)
      }
      return
    }
    const a = st.a
    const sc = a > 0.985 ? 1 : 0.965 + 0.035 * a // khi đứng yên: đúng tỉ lệ 1:1
    const lift = a > 0.985 ? 0 : (1 - a) * bh * 0.02
    ov.dim.mat.opacity = a * 0.78
    ov.main.mat.opacity = a
    ov.cap.mat.opacity = a
    if (st.kind === 'info') {
      const my = bh * 0.025
      place(ov.main, 0, my - lift, sc, bw, bh)
      place(ov.cap, 0, -bh / 2 + ov.cap.h / 2 + bh * 0.012, 1, bw, bh)
    } else {
      const gap = Math.round(bh * 0.006)
      const total = ov.main.h + gap + ov.cap.h
      const my = total / 2 - ov.main.h / 2
      place(ov.main, 0, my - lift, sc, bw, bh)
      place(ov.cap, 0, my - ov.main.h / 2 - gap - ov.cap.h / 2 - lift, sc, bw, bh)
    }
    // lượt render riêng, sau hậu kỳ, thẳng ra màn hình
    gl.setRenderTarget(null)
    const ac = gl.autoClear
    gl.autoClear = false
    gl.clearDepth()
    gl.render(ov.scene, ov.cam)
    gl.autoClear = ac
    void state
  }, 2)

  // vùng click (trong thế giới, bám theo camera) để chuyển ảnh / đóng
  const hitGrp = useRef<THREE.Group>(null)
  const fwd = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    const g = hitGrp.current
    if (!g) return
    camera.getWorldDirection(fwd)
    g.position.copy(camera.position).addScaledVector(fwd, 1.4)
    g.quaternion.copy(camera.quaternion)
  })
  const next = () => {
    const f = useShow.getState().focus
    if (!f) return
    if (f.kind === 'info' || f.idx + 1 >= photos.length) useShow.getState().setFocus(null)
    else useShow.getState().setFocus({ ...f, idx: f.idx + 1 })
  }
  return (
    <group ref={hitGrp}>
      {focus && (
        <Hit
          id="show-focus"
          label={focus.kind === 'info' ? 'Đóng thông tin' : `Ảnh ${focus.idx + 1}/${photos.length}`}
          hint={focus.kind === 'info' ? 'Đóng' : focus.idx + 1 < photos.length ? 'Ảnh tiếp' : 'Đóng'}
          maxDist={4}
          size={[2.6, 1.8, 0.05]}
          onClick={next}
        />
      )}
    </group>
  )
}

// ============================================================ LED video (YouTube IFrame Player API)
const VIDEO_PX_W = 1280
const VIDEO_PX_H = 720
const LED_WORLD_H = 5.2
const VIDEO_WORLD_W = (LED_WORLD_H * VID_W) / LED_H

export function LedVideo({ stageGroup }: { stageGroup: React.RefObject<THREE.Group | null> }) {
  const active = useShow((s) => s.active)
  const clip = useShow((s) => s.clip)
  const realityPhase = useReality((s) => s.phase)
  const videoMuted = useShow((s) => s.videoMuted)
  const globalMuted = useStore((s) => s.muted)
  const { gl, scene } = useThree()
  const occlusion = useMemo(() => new DomOcclusion(), [])
  const worldCorners = useMemo(() => Array.from({ length: 4 }, () => new THREE.Vector3()), [])
  // lớp DOM chứa iframe, được chiếu đúng lên mặt LED bằng homography (CSS matrix3d)
  const dom = useMemo(() => {
    const d = document.createElement('div')
    Object.assign(d.style, { position: 'absolute', left: '0', top: '0', width: VIDEO_PX_W + 'px', height: VIDEO_PX_H + 'px', transformOrigin: '0 0', pointerEvents: 'none', mixBlendMode: 'screen', opacity: '0', visibility: 'hidden', background: '#000', overflow: 'hidden' })
    const h = document.createElement('div')
    Object.assign(h.style, { width: '100%', height: '100%', pointerEvents: 'none', filter: 'saturate(1.12) contrast(1.06)' })
    d.appendChild(h)
    return { d, h }
  }, [])
  useEffect(() => {
    gl.domElement.parentElement?.appendChild(dom.d)
    return () => dom.d.remove()
  }, [gl, dom])
  const hostEl = dom.h
  const corners = useMemo(() => [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], [])
  const player = useRef<YTPlayer | null>(null)
  const st = useRef({ vis: 0, playingSince: 0, tries: 0 }).current
  const show = showById(active)
  const c = show?.clips[clip]

  useEffect(() => {
    if (!c || !hostEl || realityPhase !== 'idle') return
    let cancelled = false
    const setVideo = useShow.getState().setVideo
    setVideo('loading')
    const host = hostEl
    host.innerHTML = ''
    const el = document.createElement('div')
    host.appendChild(el)
    const watchdog = window.setTimeout(() => {
      if (cancelled) return
      const v = useShow.getState().video
      if (v === 'loading') {
        try {
          player.current?.mute()
          player.current?.playVideo()
        } catch {
          /* noop */
        }
        window.setTimeout(() => {
          if (!cancelled && useShow.getState().video === 'loading') setVideo('blocked')
        }, 5000)
      }
    }, 25000)
    loadYouTubeAPI()
      .then((YT) => {
        if (cancelled) return
        player.current = new YT.Player(el, {
          width: VIDEO_PX_W,
          height: VIDEO_PX_H,
          videoId: c.yt,
          host: 'https://www.youtube-nocookie.com',
          playerVars: { autoplay: 1, controls: 0, rel: 0, playsinline: 1, start: c.start ?? 0, iv_load_policy: 3, disablekb: 1, fs: 0, modestbranding: 1, origin: location.origin },
          events: {
            onReady: (e: { target: YTPlayer }) => {
              if (cancelled) return
              const m = useShow.getState().videoMuted || useStore.getState().muted
              if (m) e.target.mute()
              else {
                e.target.unMute()
                e.target.setVolume(85)
              }
              e.target.playVideo()
            },
            onStateChange: (e: { data: number }) => {
              if (cancelled) return
              if (e.data === 1) setVideo('playing')
              else if (e.data === 2) setVideo('paused')
              else if (e.data === 0) {
                // hết clip: show nhiều clip → clip kế; show 1 clip → phát lại từ đầu (tránh kẹt trạng thái 'loading')
                const sh = showById(useShow.getState().active)
                if (sh && sh.clips.length > 1) useShow.getState().nextClip()
                else {
                  try {
                    player.current?.seekTo?.(c.start ?? 0, true)
                    player.current?.playVideo()
                  } catch {
                    /* noop */
                  }
                }
              }
            },
            onError: () => !cancelled && setVideo('error'),
          },
        })
      })
      .catch(() => !cancelled && setVideo('error'))
    return () => {
      cancelled = true
      window.clearTimeout(watchdog)
      try {
        player.current?.destroy()
      } catch {
        /* noop */
      }
      player.current = null
      host.innerHTML = ''
    }
  }, [c, hostEl, realityPhase])

  useEffect(() => {
    const p = player.current
    if (!p) return
    try {
      if (videoMuted || globalMuted) p.mute()
      else {
        p.unMute()
        p.setVolume(85)
      }
    } catch {
      /* noop */
    }
  }, [videoMuted, globalMuted])

  useFrame((state, dt) => {
    const w = dom.d
    const s = useShow.getState()
    const p = localCam(stageGroup.current, state.camera)
    let visible = realityPhase === 'idle' && !!s.active && s.video === 'playing' && showElapsed() > 2.6 && !s.focus
    if (p) {
      // chỉ hiện khi đứng trước sân khấu (iframe là lớp DOM nên không thể bị che bởi vật thể 3D)
      const ang = Math.atan2(Math.abs(p.x), p.z + 4.7)
      visible = visible && p.z > 2 && p.z < 70 && ang < 0.9
      // âm lượng theo khoảng cách
      const d = Math.hypot(p.x, p.z + 2)
      try {
        if (player.current && s.video === 'playing' && !s.videoMuted && !useStore.getState().muted) player.current.setVolume(Math.round(THREE.MathUtils.clamp(100 - (d - 12) * 2.2, 8, 90)))
      } catch {
        /* noop */
      }
    }
    const g = stageGroup.current
    if (g && (visible || st.vis > 0.01)) {
      const hw = VIDEO_WORLD_W / 2
      const pts: number[] = []
      const cw = gl.domElement.clientWidth
      const ch = gl.domElement.clientHeight
      let behind = false
      ;[[-hw, 4.35 + 2.6], [hw, 4.35 + 2.6], [-hw, 4.35 - 2.6], [hw, 4.35 - 2.6]].forEach(([x, y], k) => {
        const v = corners[k].set(x, y, -4.69)
        g.localToWorld(v)
        const cz = v.clone().applyMatrix4(state.camera.matrixWorldInverse).z
        if (cz > -0.2) behind = true
        worldCorners[k].copy(v)
        v.project(state.camera)
        pts.push(((v.x + 1) / 2) * cw, ((1 - v.y) / 2) * ch)
      })
      if (behind) visible = false
      else {
        w.style.transform = homography(VIDEO_PX_W, VIDEO_PX_H, pts)
        occlusion.update(w, state.camera, scene, worldCorners, performance.now() / 1000)
      }
    }
    st.vis = damp(st.vis, visible ? 1 : 0, 3, dt)
    w.style.opacity = st.vis.toFixed(3)
    w.style.visibility = st.vis > 0.01 ? 'visible' : 'hidden'
  })

  return null
}

// homography: hình chữ nhật (0,0,w,h) -> tứ giác màn hình (TL, TR, BL, BR)
function adj(m: number[]) {
  return [m[4] * m[8] - m[5] * m[7], m[2] * m[7] - m[1] * m[8], m[1] * m[5] - m[2] * m[4], m[5] * m[6] - m[3] * m[8], m[0] * m[8] - m[2] * m[6], m[2] * m[3] - m[0] * m[5], m[3] * m[7] - m[4] * m[6], m[1] * m[6] - m[0] * m[7], m[0] * m[4] - m[1] * m[3]]
}
function mulmm(a: number[], b: number[]) {
  const c: number[] = []
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) {
      let t = 0
      for (let k = 0; k < 3; k++) t += a[3 * j + k] * b[3 * k + i]
      c[3 * j + i] = t
    }
  return c
}
function mulmv(m: number[], v: number[]) {
  return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]]
}
function basis(p: number[]) {
  const m = [p[0], p[2], p[4], p[1], p[3], p[5], 1, 1, 1]
  const v = mulmv(adj(m), [p[6], p[7], 1])
  return mulmm(m, [v[0], 0, 0, 0, v[1], 0, 0, 0, v[2]])
}
function homography(w: number, h: number, dst: number[]) {
  const t = mulmm(basis(dst), adj(basis([0, 0, w, 0, 0, h, w, h])))
  for (let i = 0; i < 9; i++) t[i] = t[i] / t[8]
  return `matrix3d(${t[0]},${t[3]},0,${t[6]},${t[1]},${t[4]},0,${t[7]},0,0,1,0,${t[2]},${t[5]},0,${t[8]})`
}

/** video có đang phủ LED không (0..1) để canvas LED nhường vùng giữa */
export function videoCoverage() {
  const s = useShow.getState()
  return s.video === 'playing' && !s.focus ? 1 : 0
}

// ============================================================ Hiệu ứng không khí: khói sàn, CO2, hạt, beam sàn
function fogTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const x = c.getContext('2d')!
  for (let i = 0; i < 26; i++) {
    const px = 50 + Math.random() * 156
    const py = 70 + Math.random() * 116
    const r = 30 + Math.random() * 60
    const g = x.createRadialGradient(px, py, 0, px, py, r)
    g.addColorStop(0, 'rgba(255,255,255,0.18)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    x.fillStyle = g
    x.fillRect(0, 0, 256, 256)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

const MOTES = 240
const MOTE_VERT = /* glsl */ `
  attribute vec3 seed;
  uniform float uTime; uniform float uMode; uniform float uSize;
  varying float vA; varying float vS;
  void main(){
    vec3 p = position;
    float t = uTime;
    if (uMode < 0.5) { // sparks: bay lên nhanh, lấp lánh
      p.y = 1.3 + mod(p.y + t * (1.2 + seed.x * 2.0), 8.0);
      p.x += sin(t * 2.0 + seed.y * 20.0) * 0.15;
      vA = step(0.55, fract(sin(seed.z * 91.0 + floor(t * 8.0)) * 43758.5));
    } else if (uMode < 1.5) { // bokeh: trôi chậm, mềm
      p.y = 1.0 + mod(p.y + t * (0.12 + seed.x * 0.18), 8.0);
      p.x += sin(t * 0.3 + seed.y * 10.0) * 0.6;
      p.z += cos(t * 0.25 + seed.z * 10.0) * 0.4;
      vA = 0.35 + 0.35 * sin(t + seed.x * 6.0);
    } else { // nến + đom đóm
      if (seed.x < 0.45) { p = vec3((seed.y - 0.5) * 13.0, 1.55 + seed.z * 0.5, 2.6 - seed.x * 6.0); vA = 0.6 + 0.4 * sin(t * 9.0 + seed.z * 40.0); }
      else { p.y = 1.0 + mod(p.y + t * 0.18, 7.0); p.x += sin(t * 0.5 + seed.y * 9.0) * 0.8; vA = 0.4 + 0.6 * abs(sin(t * 1.3 + seed.z * 9.0)); }
    }
    vS = seed.y;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = uSize * (0.6 + seed.z) * (300.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }`
const MOTE_FRAG = /* glsl */ `
  uniform vec3 uC1; uniform vec3 uC2; uniform float uOpacity;
  varying float vA; varying float vS;
  void main(){
    vec2 d = gl_PointCoord - 0.5;
    float r = length(d);
    float a = smoothstep(0.5, 0.0, r);
    a = a * a;
    gl_FragColor = vec4(mix(uC1, uC2, vS) * 1.6, a * vA * uOpacity);
  }`

const FLOOR_X = [-6.2, -3.7, -1.25, 1.25, 3.7, 6.2]
const CO2_X = [-6.6, -2.9, 2.9, 6.6]

export function ShowFX({ beamGeo }: { beamGeo: THREE.BufferGeometry }) {
  const fogTex = useMemo(() => fogTexture(), [])
  const fogs = useRef<(THREE.Sprite | null)[]>([])
  const co2 = useRef<(THREE.Sprite | null)[]>([])
  const floorBeams = useRef<(THREE.Group | null)[]>([])
  const floorMats = useMemo(
    () =>
      FLOOR_X.map(
        () =>
          new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            uniforms: { uColor: { value: new THREE.Color('#fff') }, uIntensity: { value: 0 } },
            vertexShader: `varying vec3 vN; varying vec3 vV; varying float vH; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); vH = uv.y; gl_Position = projectionMatrix*mv; }`,
            fragmentShader: `uniform vec3 uColor; uniform float uIntensity; varying vec3 vN; varying vec3 vV; varying float vH; void main(){ float f = pow(abs(dot(normalize(vN), normalize(vV))), 1.7); float fade = pow(1.0 - vH, 1.6); gl_FragColor = vec4(uColor*uIntensity, f*fade); }`,
          }),
      ),
    [],
  )
  const motesGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const p = new Float32Array(MOTES * 3)
    const s = new Float32Array(MOTES * 3)
    for (let i = 0; i < MOTES; i++) {
      p.set([(Math.random() - 0.5) * 20, Math.random() * 8, -4 + Math.random() * 13], i * 3)
      s.set([Math.random(), Math.random(), Math.random()], i * 3)
    }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3))
    g.setAttribute('seed', new THREE.BufferAttribute(s, 3))
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 4, 2), 20)
    return g
  }, [])
  const motesMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uMode: { value: 0 }, uSize: { value: 0.12 }, uC1: { value: new THREE.Color('#fff') }, uC2: { value: new THREE.Color('#fff') }, uOpacity: { value: 0 } },
        vertexShader: MOTE_VERT,
        fragmentShader: MOTE_FRAG,
      }),
    [],
  )
  const motes = useRef<THREE.Points>(null)
  const st = useRef({ level: 0, lastSection: -1, co2T: 9, shown: '' }).current
  const col = useMemo(() => new THREE.Color(), [])

  useFrame((state, dt) => {
    const s = useShow.getState()
    const show = showById(s.active)
    const el = showElapsed()
    const t = state.clock.elapsedTime
    const target = show && el > 1.0 ? 1 : 0
    st.level = damp(st.level, target, target ? 0.9 : 2.5, dt)
    const L = st.level
    const look = show?.look
    const beatF = look ? (el * look.bpm) / 60 : t
    const beat = Math.exp(-(beatF % 1) * 5)
    // khói sàn
    fogs.current.forEach((f, i) => {
      if (!f) return
      const m = f.material as THREE.SpriteMaterial
      const front = i >= 6
      f.position.x = Math.sin(t * 0.07 + i * 1.9) * (front ? 7 : 6)
      f.position.z = front ? 4.6 + (i - 6) * 1.1 : -3.8 + (i % 6) * 1.25
      f.position.y = front ? 0.45 : 1.55
      if (look) m.color.set(look.colors[i % 2 ? 0 : 2]).lerp(col.set('#ffffff'), 0.55)
      m.opacity = (look?.groundFog ?? 0) * L * (front ? 0.22 : 0.4)
      f.visible = m.opacity > 0.01
    })
    // CO2 (GET DOWNTOWN)
    const section = look ? Math.floor(beatF / 32) : -1
    if (look?.co2 && el > 3 && section !== st.lastSection) {
      st.lastSection = section
      st.co2T = 0
    }
    st.co2T += dt
    co2.current.forEach((c, i) => {
      if (!c) return
      const k = st.co2T
      const on = look?.co2 && k < 1.8
      const m = c.material as THREE.SpriteMaterial
      const grow = Math.min(1, k / 0.25)
      c.scale.set(1.3 + grow * 0.9, 0.5 + grow * 6.5, 1)
      c.position.y = 1.2 + c.scale.y / 2 - 0.3
      m.opacity = on ? Math.max(0, 1 - k / 1.8) * 0.9 * L : 0
      c.visible = m.opacity > 0.01
      c.position.x = CO2_X[i]
    })
    // beam từ sàn sân khấu
    floorBeams.current.forEach((g, i) => {
      if (!g || !look) {
        if (g) g.visible = false
        return
      }
      g.visible = L > 0.02
      const m = floorMats[i]
      const side = FLOOR_X[i] < 0 ? -1 : 1
      const ii = i - 2.5
      let tilt = 0
      let roll = 0
      let inten = 0
      if (look.mode === 'chase') {
        roll = Math.sin(beatF * 0.5 * Math.PI + i) * 0.55 + side * 0.1
        tilt = -0.25 + Math.sin(beatF * 0.25 * Math.PI) * 0.2
        inten = (0.6 + 1.4 * beat) * (Math.floor(beatF) % 2 === i % 2 ? 1 : 0.35)
        m.uniforms.uColor.value.set(look.colors[Math.floor(beatF / 8 + i) % 2 ? 0 : 1])
      } else if (look.mode === 'fan') {
        roll = ii * 0.17 + Math.sin(t * 0.4) * 0.04
        tilt = -0.18
        inten = 0.9 + 0.3 * Math.sin(t * 0.7)
        m.uniforms.uColor.value.set(i % 3 === 0 ? look.colors[1] : look.colors[0])
      } else {
        roll = ii * 0.05
        tilt = -0.05 + Math.sin(t * 0.15 + i * 0.4) * 0.06
        inten = 0.55 + 0.25 * Math.sin(t * 0.5 + i)
        m.uniforms.uColor.value.set(look.colors[i % 2 ? 0 : 1])
      }
      m.uniforms.uIntensity.value = inten * L * (look.mode === 'chase' ? 0.8 : 0.5)
      g.rotation.set(tilt, 0, roll)
    })
    // hạt
    const u = motesMat.uniforms
    u.uTime.value = t
    if (look) {
      u.uMode.value = look.motes === 'sparks' ? 0 : look.motes === 'bokeh' ? 1 : 2
      u.uSize.value = look.motes === 'bokeh' ? 0.42 : look.motes === 'sparks' ? 0.09 : 0.12
      u.uC1.value.set(look.motes === 'candles' ? '#ffd58a' : look.colors[1])
      u.uC2.value.set(look.motes === 'candles' ? '#c8fff0' : look.colors[0])
    }
    u.uOpacity.value = L * (look?.motes === 'bokeh' ? 0.5 : 0.9)
    if (motes.current) motes.current.visible = L > 0.01
  })

  return (
    <group>
      {Array.from({ length: 10 }, (_, i) => (
        <sprite key={i} ref={(r) => { fogs.current[i] = r }} scale={[7.5, 2.0, 1]} visible={false}>
          <spriteMaterial map={fogTex} transparent opacity={0} depthWrite={false} />
        </sprite>
      ))}
      {CO2_X.map((x, i) => (
        <sprite key={x} ref={(r) => { co2.current[i] = r }} position={[x, 2, 2.9]} visible={false}>
          <spriteMaterial map={fogTex} color="#ffffff" transparent opacity={0} depthWrite={false} />
        </sprite>
      ))}
      {FLOOR_X.map((x, i) => (
        <group key={x} position={[x, 1.26, 3.05]}>
          <mesh position={[0, 0.08, 0]}>
            <boxGeometry args={[0.32, 0.16, 0.28]} />
            <meshStandardMaterial color="#0a0b10" metalness={0.8} roughness={0.35} />
          </mesh>
          <group ref={(r) => { floorBeams.current[i] = r }} visible={false}>
            <mesh geometry={beamGeo} material={floorMats[i]} scale={[0.55, 0.42, 0.55]} />
          </group>
        </group>
      ))}
      <points ref={motes} geometry={motesGeo} material={motesMat} frustumCulled={false} visible={false} />
    </group>
  )
}

// ============================================================ Tải trước media khi tiến gần
export function ShowPreloader({ stageGroup }: { stageGroup: React.RefObject<THREE.Group | null> }) {
  const { gl } = useThree()
  useEffect(() => {
    // hook kiểm thử (chỉ khi URL có #...debug): chọn show / đặt góc nhìn chính xác
    if (!location.hash.includes('debug')) return
    gl.debug.onShaderError = (ctx, program, vs, fs) => {
      const tail = (sh: WebGLShader) => (ctx.getShaderSource(sh) || '').replace(/\s+/g, ' ').slice(-500)
      console.error('SHADERFAIL link=' + ctx.getProgramParameter(program, ctx.LINK_STATUS) + ' log=' + ctx.getProgramInfoLog(program) + ' || VS: ' + tail(vs) + ' || FS: ' + tail(fs))
    }
    ;(window as unknown as Record<string, unknown>).__orbitaStage = {
      show: useShow,
      look: (yawDeg: number, pitchDeg: number) => {
        player.yaw = (yawDeg * Math.PI) / 180
        player.pitch = (pitchDeg * Math.PI) / 180
      },
      at: (x: number, z: number) => {
        player.pos.x = x
        player.pos.z = z
      },
      state: () => ({ active: useShow.getState().active, video: useShow.getState().video, clip: useShow.getState().clip, focus: useShow.getState().focus, el: showElapsed(), hover: useStore.getState().hover?.label ?? null, iframes: document.querySelectorAll('iframe').length }),
    }
  }, [gl])
  useFrame((state) => {
    const p = localCam(stageGroup.current, state.camera)
    if (!p) return
    if (Math.hypot(p.x, p.z) < 55) prefetchShowMedia()
    uploadPending(gl)
  })
  return null
}
