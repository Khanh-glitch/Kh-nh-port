import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { EXHIBITS } from '../layout'
import { audio, type Bus } from '../audio'
import { toast } from '../store'
import { FONT, beamGeometry, beamMaterial, canvasTex, glowTexture, rand, rbox } from '../gfx'
import { Hit } from './Hit'
import { Label } from './Label'
import { PadRing, isFacing, mats, useWorldColliders, worldPos } from './common'
import { photoAllowed, type ShowId } from '../stage/shows'
import { useShow, showById, showElapsed, mediaFor } from '../stage/showState'
import { LED_W, LED_H, drawShowLED } from '../stage/ledShow'
import { ShowSelector, InfoVeil, PhotoWings, FocusViewer, LedVideo, ShowFX, ShowPreloader, useInfoTexture, videoCoverage } from '../stage/ShowSystem'

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)

const ex = EXHIBITS.stage
const LW = 832
const LH = 333

const SCENES = [
  { name: 'NEON', colors: ['#ff2bd6', '#2bd9ff', '#9b5cff'] },
  { name: 'SUNSET', colors: ['#ff7a1a', '#ffc23d', '#ff3d6e'] },
  { name: 'STROBE', colors: ['#ffffff', '#bfe6ff', '#ffe6ff'] },
  { name: 'AURORA', colors: ['#2bffb0', '#2bb6ff', '#7a5cff'] },
]

const hash = (n: number) => {
  const s = Math.sin(n * 91.7) * 43758.5453
  return s - Math.floor(s)
}

function makeTruss(len: number, w = 0.55) {
  const parts: THREE.BufferGeometry[] = []
  const h = w / 2
  const Y = new THREE.Vector3(0, 1, 0)
  const cyl = (p: THREE.Vector3, q: THREE.Vector3, r: number) => {
    const d = new THREE.Vector3().subVectors(q, p)
    const l = d.length()
    const g = new THREE.CylinderGeometry(r, r, l, 5, 1)
    g.applyMatrix4(new THREE.Matrix4().compose(p.clone().add(q).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(Y, d.normalize()), new THREE.Vector3(1, 1, 1)))
    parts.push(g)
  }
  const corners: [number, number][] = [[h, h], [h, -h], [-h, -h], [-h, h]]
  corners.forEach(([y, z]) => cyl(new THREE.Vector3(-len / 2, y, z), new THREE.Vector3(len / 2, y, z), 0.05))
  const n = Math.max(2, Math.round(len / 0.55))
  const step = len / n
  for (let i = 0; i < n; i++) {
    const x0 = -len / 2 + i * step
    const x1 = x0 + step
    for (let k = 0; k < 4; k++) {
      const [y0, z0] = corners[k]
      const [y1, z1] = corners[(k + 1) % 4]
      if (i % 2 === 0) cyl(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1), 0.02)
      else cyl(new THREE.Vector3(x0, y1, z1), new THREE.Vector3(x1, y0, z0), 0.02)
    }
  }
  return mergeGeometries(parts)!
}

function Truss({ a, b }: { a: [number, number, number]; b: [number, number, number] }) {
  const va = new THREE.Vector3(...a)
  const vb = new THREE.Vector3(...b)
  const len = va.distanceTo(vb)
  const geo = useMemo(() => makeTruss(len), [len])
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), vb.clone().sub(va).normalize())
  const mid = va.clone().add(vb).multiplyScalar(0.5)
  return <mesh geometry={geo} material={mats.silver} position={mid} quaternion={q} castShadow />
}

function drawLED(ctx: CanvasRenderingContext2D, scene: number, t: number, kick: number, energy: number) {
  const W = LW
  const H = LH
  ctx.globalCompositeOperation = 'source-over'
  ctx.shadowBlur = 0
  if (scene === 0) {
    const g = ctx.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, '#12002a')
    g.addColorStop(0.6, '#3a0a5a')
    g.addColorStop(1, '#05000a')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
    const hy = H * 0.62
    const sr = H * (0.3 + kick * 0.03)
    const sg = ctx.createLinearGradient(0, hy - sr * 2, 0, hy)
    sg.addColorStop(0, '#ffe45e')
    sg.addColorStop(1, '#ff2bd6')
    ctx.fillStyle = sg
    ctx.beginPath()
    ctx.arc(W / 2, hy - sr * 0.2, sr, Math.PI, 0)
    ctx.arc(W / 2, hy - sr * 0.2, sr, 0, Math.PI)
    ctx.fill()
    ctx.fillStyle = '#12002a'
    for (let i = 0; i < 7; i++) ctx.fillRect(W / 2 - sr, hy - sr * 0.6 + i * (sr * 0.12) + i * i * 1.2, sr * 2, 2 + i * 1.6)
    ctx.fillStyle = '#080012'
    ctx.fillRect(0, hy, W, H - hy)
    ctx.strokeStyle = '#2bd9ff'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(0, hy)
    ctx.lineTo(W, hy)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(255,43,214,0.8)'
    ctx.lineWidth = 1.5
    for (let i = -14; i <= 14; i++) {
      ctx.beginPath()
      ctx.moveTo(W / 2 + i * 12, hy)
      ctx.lineTo(W / 2 + i * 120, H)
      ctx.stroke()
    }
    for (let i = 0; i < 9; i++) {
      const z = (i + ((t * 0.6) % 1)) / 9
      const y = hy + (H - hy) * z * z
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(W, y)
      ctx.stroke()
    }
    ctx.globalCompositeOperation = 'lighter'
    for (let i = 0; i < 52; i++) {
      const h = (0.15 + 0.85 * Math.abs(Math.sin(t * 3 + i * 0.5) * Math.cos(i * 0.3 + t))) * (0.35 + kick * 0.9 * energy) * 90
      const bg = ctx.createLinearGradient(0, H, 0, H - h)
      bg.addColorStop(0, 'rgba(43,217,255,0.9)')
      bg.addColorStop(1, 'rgba(255,43,214,0.9)')
      ctx.fillStyle = bg
      ctx.fillRect(i * (W / 52) + 2, H - h, W / 52 - 4, h)
    }
    ctx.globalCompositeOperation = 'source-over'
  } else if (scene === 1) {
    const g = ctx.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, '#2a0a4a')
    g.addColorStop(0.5, '#ff5a2a')
    g.addColorStop(0.8, '#ffc23d')
    g.addColorStop(1, '#ff7a1a')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
    const sr = H * (0.32 + kick * 0.04)
    const sg = ctx.createRadialGradient(W / 2, H * 0.62, 0, W / 2, H * 0.62, sr * 1.8)
    sg.addColorStop(0, '#fffbe0')
    sg.addColorStop(0.35, '#ffe08a')
    sg.addColorStop(1, 'rgba(255,120,40,0)')
    ctx.fillStyle = sg
    ctx.fillRect(0, 0, W, H)
    for (let l = 0; l < 6; l++) {
      ctx.fillStyle = `rgba(${40 - l * 5},${5},${50 - l * 6},${0.9 - l * 0.08})`
      ctx.beginPath()
      ctx.moveTo(0, H)
      for (let x = 0; x <= W; x += 16) ctx.lineTo(x, H * (0.72 + l * 0.05) + Math.sin(x * 0.01 + t * (0.4 + l * 0.2) + l) * (10 + l * 4))
      ctx.lineTo(W, H)
      ctx.fill()
    }
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.font = `700 28px ${FONT}`
    ctx.textAlign = 'center'
    ctx.fillText('SUNSET SESSIONS', W / 2, 52)
  } else if (scene === 2) {
    ctx.fillStyle = '#050508'
    ctx.fillRect(0, 0, W, H)
    const step = Math.floor(t * 8)
    for (let x = 0; x < 8; x++)
      for (let y = 0; y < 3; y++) {
        if (hash(step * 7 + x * 3 + y * 11) > 0.55) {
          ctx.fillStyle = `rgba(255,255,255,${0.4 + hash(step + x + y) * 0.6})`
          ctx.fillRect(x * (W / 8) + 4, y * (H / 3) + 4, W / 8 - 8, H / 3 - 8)
        }
      }
    ctx.fillStyle = `rgba(255,255,255,${Math.min(1, kick * 0.8 * energy)})`
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = kick > 0.4 ? '#000' : '#fff'
    ctx.font = `800 120px ${FONT}`
    ctx.textAlign = 'center'
    ctx.fillText('STROBE', W / 2, H / 2 + 40)
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, '#000610')
    g.addColorStop(1, '#021a2a')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = '#fff'
    for (let i = 0; i < 60; i++) ctx.fillRect(hash(i) * W, hash(i + 40) * H * 0.7, 1.5, 1.5)
    ctx.globalCompositeOperation = 'lighter'
    const cols = ['43,255,176', '43,182,255', '122,92,255', '43,255,176']
    for (let c = 0; c < 4; c++) {
      for (let x = 0; x < W; x += 6) {
        const y = H * (0.28 + c * 0.04) + Math.sin(x * 0.012 + t * (0.5 + c * 0.2) + c * 2) * 40 + Math.sin(x * 0.03 - t * 0.7) * 14
        const h = 70 + Math.sin(x * 0.02 + t + c) * 30 + kick * 40 * energy
        const gr = ctx.createLinearGradient(0, y - h, 0, y + 20)
        gr.addColorStop(0, `rgba(${cols[c]},0)`)
        gr.addColorStop(0.7, `rgba(${cols[c]},0.35)`)
        gr.addColorStop(1, `rgba(${cols[c]},0)`)
        ctx.fillStyle = gr
        ctx.fillRect(x, y - h, 6, h + 20)
      }
    }
    ctx.globalCompositeOperation = 'source-over'
  }
}

interface Head {
  pan: THREE.Group | null
  tilt: THREE.Group | null
  mat: THREE.ShaderMaterial
  base: number
  x: number
  y: number
  z: number
}

const HEAD_POS: [number, number, number, number][] = [
  [-6, 9.05, 2.6, -0.7],
  [-3, 9.05, 2.6, -0.8],
  [0, 9.05, 2.6, -0.6],
  [3, 9.05, 2.6, -0.8],
  [6, 9.05, 2.6, -0.7],
  [-4.5, 7.85, -3.4, 0.5],
  [4.5, 7.85, -3.4, 0.5],
]

const COUNT_C = 380
const COUNT_S = 180

export function Stage() {
  const busRef = useRef<Bus | null>(null)
  const led = useMemo(() => canvasTex(LW, LH, () => {}), [])
  const st = useRef({ scene: 0, beatOn: false, lastDraw: 0, press: [0, 0, 0, 0, 0, 0], fireT: 99, sparkT: 99, showLvl: 0, fallback: false, dropDone: false, lastConfetti: -1 }).current
  const showLed = useMemo(() => canvasTex(LED_W, LED_H, (c, w, h) => { c.fillStyle = '#000'; c.fillRect(0, 0, w, h) }), [])
  const root = useRef<THREE.Group>(null)
  const infoTex = useInfoTexture()
  const heads = useMemo<Head[]>(
    () => HEAD_POS.map(([x, y, z, base]) => ({ pan: null, tilt: null, mat: beamMaterial('#ff2bd6', 1), base, x, y, z })),
    [],
  )
  const beamGeo = useMemo(() => beamGeometry(38, 3.6, 0.14, 24), [])
  const padMats = useMemo(() => SCENES.map((s) => new THREE.MeshBasicMaterial({ color: new THREE.Color(s.colors[0]), toneMapped: false })), [])
  const playMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff3b3b'), toneMapped: false }), [])
  const boomMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd23d'), toneMapped: false }), [])
  const padGroups = useRef<(THREE.Group | null)[]>([])
  const light = useRef<THREE.PointLight>(null)
  const light2 = useRef<THREE.PointLight>(null)
  const ledMat = useRef<THREE.MeshBasicMaterial>(null)
  const sideBars = useRef<(THREE.MeshBasicMaterial | null)[]>([])
  const platters = useRef<(THREE.Mesh | null)[]>([])
  const haze = useRef<(THREE.Sprite | null)[]>([])
  const strobes = useRef<(THREE.MeshBasicMaterial | null)[]>([])
  const pcs = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const col = useMemo(() => new THREE.Color(), [])
  const glow = glowTexture()

  const parts = useMemo(() => {
    const n = COUNT_C + COUNT_S
    return {
      p: new Float32Array(n * 3),
      v: new Float32Array(n * 3),
      life: new Float32Array(n),
      max: new Float32Array(n),
      size: new Float32Array(n),
      rot: new Float32Array(n * 3),
      spin: new Float32Array(n * 3),
    }
  }, [])

  useWorldColliders(ex, [
    { type: 'box', x: 0, z: -0.8, hw: 8.5, hd: 4.5 },
    { type: 'box', x: 0, z: 12, hw: 3.3, hd: 1.0 },
    { type: 'circle', x: -10.5, z: 1.5, r: 1.4 },
    { type: 'circle', x: 10.5, z: 1.5, r: 1.4 },
    { type: 'circle', x: -8, z: 2.6, r: 0.5 },
    { type: 'circle', x: 8, z: 2.6, r: 0.5 },
  ])

  useEffect(() => {
    busRef.current = audio.createBus('stage', worldPos(ex, 0, 3, 1), { ref: 6, rolloff: 1.15, maxDist: 130, reverb: 0.3, gain: 0.8 })
    const m = pcs.current
    if (m) {
      dummy.scale.setScalar(0)
      dummy.updateMatrix()
      for (let i = 0; i < COUNT_C + COUNT_S; i++) {
        m.setMatrixAt(i, dummy.matrix)
        m.setColorAt(i, col.set('#fff'))
      }
      m.instanceMatrix.needsUpdate = true
    }
    return () => {
      audio.stopBeat()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const bus = () => busRef.current

  const toggleBeat = () => {
    if (!audio.started) return
    const b = bus()
    if (!b) return
    if (st.beatOn) {
      audio.stopBeat()
      st.beatOn = false
      toast('Sân khấu: dừng nhạc')
    } else {
      audio.setBeatScene(st.scene)
      audio.startBeat(b, st.scene)
      st.beatOn = true
      toast('Sân khấu: DJ set bắt đầu')
    }
  }
  const setScene = (i: number) => {
    if (useShow.getState().active) endShow(false)
    st.scene = i
    st.press[i] = 1
    audio.setBeatScene(i)
    const b = bus()
    if (b) audio.stageHit(b)
    if (!st.beatOn) toggleBeat()
    toast(`Cue ${i + 1} · ${SCENES[i].name}`)
  }
  const fire = (silent = false) => {
    const b = bus()
    if (b) {
      audio.confetti(b)
      audio.stageHit(b)
    }
    st.press[5] = 1
    st.fireT = 0
    st.sparkT = 0
    const { p, v, life, max, size, rot, spin } = parts
    const m = pcs.current
    for (let i = 0; i < COUNT_C + COUNT_S; i++) {
      const left = i % 2 === 0 ? -1 : 1
      const confetti = i < COUNT_C
      const sx = confetti ? left * 7.4 : left * 5.2
      p[i * 3] = sx
      p[i * 3 + 1] = 1.4
      p[i * 3 + 2] = confetti ? 3.0 : 3.4
      const sp = confetti ? rand(10, 19) : rand(9, 15)
      const ang = rand(-0.5, 0.5)
      const lean = confetti ? rand(-0.35, 0.55) : rand(-0.12, 0.12)
      v[i * 3] = Math.sin(ang) * sp * 0.6 - left * (confetti ? 2 : 0)
      v[i * 3 + 1] = sp
      v[i * 3 + 2] = Math.sin(lean) * sp * 0.7 + rand(-1, 1)
      life[i] = max[i] = confetti ? rand(3.5, 6) : rand(0.9, 1.8)
      size[i] = confetti ? rand(0.7, 1.2) : rand(0.5, 1)
      rot.set([rand(0, 6), rand(0, 6), rand(0, 6)], i * 3)
      spin.set([rand(-8, 8), rand(-8, 8), rand(-8, 8)], i * 3)
      if (m) {
        if (confetti) col.setHSL(Math.random(), 0.9, 0.58).multiplyScalar(1.5)
        else col.set(Math.random() < 0.5 ? '#ffd27a' : '#ffffff').multiplyScalar(4)
        m.setColorAt(i, col)
      }
    }
    if (m?.instanceColor) m.instanceColor.needsUpdate = true
    if (!silent) toast('Pháo giấy & pháo hoa!')
  }

  // ---- SHOWTIME: gọi lại một chương trình thật lên sân khấu
  const endShow = (announce = true) => {
    useShow.getState().select(null)
    useShow.getState().setSelector(true)
    if (st.fallback) {
      audio.stopBeat()
      st.beatOn = false
      st.fallback = false
    }
    if (announce) toast('Sân khấu trở về DJ set')
  }
  const pickShow = (id: ShowId | null) => {
    if (!id) return endShow()
    if (st.beatOn) {
      audio.stopBeat()
      st.beatOn = false
    }
    st.fallback = false
    st.dropDone = false
    st.lastConfetti = -1
    useShow.getState().select(id)
    const b = bus()
    if (b) audio.stageHit(b)
    const s = showById(id)
    if (s) toast(`${s.title} · ${s.dateLabel}`, 3200)
  }

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    const cam = state.camera.position
    const dist = Math.hypot(cam.x - ex.x, cam.z - ex.z)
    const sc = SCENES[st.scene]
    const near = dist < 120 && isFacing(state.camera, ex.x, ex.z, 30)

    // nhịp kick (đồng bộ với âm thanh nếu đang bật nhạc)
    let kick: number
    if (st.beatOn && audio.started) {
      const now = audio.ctx.currentTime
      let last = -1
      for (const k of audio.kicks) if (k <= now && k > last) last = k
      kick = last > 0 ? Math.exp(-(now - last) * 6) : 0
    } else kick = 0.2 + 0.12 * Math.sin(t * 2)
    const energy = st.beatOn ? 1 : 0.45
    const strobeScene = st.scene === 2

    // ---- trạng thái show
    const ss = useShow.getState()
    const show = showById(ss.active)
    const el = show ? showElapsed() : 0
    st.showLvl = THREE.MathUtils.damp(st.showLvl, show ? 1 : 0, 2.2, dt)
    const look = show?.look
    const sBeatF = look ? (el * look.bpm) / 60 : 0
    const sBeat = look ? Math.exp(-(sBeatF % 1) * 5) : 0
    const fadeOut = show ? clamp01(1 - el / 1.0) : 0 // blackout trước khi show thức dậy
    const djScale = show ? fadeOut : Math.max(0.04, 1 - st.showLvl)
    if (show && look) {
      // drop: âm thanh + pháo giấy (GET DOWNTOWN)
      if (!st.dropDone && el > 2.7) {
        st.dropDone = true
        const b = bus()
        if (b) audio.stageHit(b)
        if (look.confetti) fire(true)
      }
      if (look.confetti && el > 6) {
        const sec = Math.floor(sBeatF / 64)
        if (sec !== st.lastConfetti && sec > 0) {
          st.lastConfetti = sec
          fire(true)
        }
      } else if (st.lastConfetti < 0) st.lastConfetti = 0
      // âm thanh dự phòng nếu footage không phát được
      const vidBad = ss.video === 'error' || ss.video === 'blocked'
      if (vidBad && el > 3 && !st.beatOn && audio.started) {
        const b = bus()
        if (b) {
          audio.setBeatScene(look.beatScene)
          audio.startBeat(b, look.beatScene)
          st.beatOn = true
          st.fallback = true
        }
      } else if (ss.video === 'playing' && st.fallback) {
        audio.stopBeat()
        st.beatOn = false
        st.fallback = false
      }
    }

    // màn LED
    if (show) {
      if (near && t - st.lastDraw > 1 / 30) {
        st.lastDraw = t
        const imgs: HTMLImageElement[] = []
        for (const p of show.photos) {
          if (!photoAllowed(p) || p.placement === 'foh') continue
          const e = mediaFor(p.url)
          if (e.ok && e.img) imgs.push(e.img)
        }
        drawShowLED(showLed.ctx, show, { t, el, beat: sBeat, bar: Math.floor(sBeatF / 4), video: videoCoverage(), imgs })
        showLed.tex.needsUpdate = true
      }
      if (ledMat.current && ledMat.current.map !== showLed.tex) {
        ledMat.current.map = showLed.tex
        ledMat.current.needsUpdate = true
      }
      if (ledMat.current) ledMat.current.color.setScalar(0.92 + sBeat * (look?.mode === 'chase' ? 0.18 : 0.04))
    } else {
      if (ledMat.current && ledMat.current.map !== led.tex) {
        ledMat.current.map = led.tex
        ledMat.current.needsUpdate = true
      }
      if (near && t - st.lastDraw > 1 / 24) {
        st.lastDraw = t
        drawLED(led.ctx, st.scene, t, kick, energy)
        led.tex.needsUpdate = true
      }
      if (ledMat.current) ledMat.current.color.setScalar((0.9 + kick * 0.35) * (0.15 + 0.85 * djScale))
    }

    // moving heads
    heads.forEach((h, i) => {
      if (show && look) {
        const ign = el < 1.1 ? 0 : clamp01((el - 1.25 - (i < 5 ? Math.abs(i - 2) * 0.16 : 0.6)) / 0.45)
        let pan = 0
        let tilt = h.base
        let inten = 1
        let c = look.colors[0]
        if (look.mode === 'chase') {
          const sec = Math.floor(sBeatF / 8) % 4
          c = look.colors[(sec + (i % 2)) % look.colors.length]
          if (sec === 0) {
            pan = Math.sin(sBeatF * Math.PI * 0.5 + i * 0.9) * 1.1
            tilt = h.base + Math.sin(sBeatF * Math.PI * 0.25 + i) * 0.5
          } else if (sec === 1) {
            pan = (i % 2 ? 1 : -1) * (0.45 + 0.25 * Math.sin(sBeatF * Math.PI * 0.5))
            tilt = h.base + 0.3 * Math.sin(sBeatF * Math.PI)
          } else if (sec === 2) {
            pan = (i - 3) * 0.22
            tilt = -0.2 - sBeat * 0.12
          } else {
            pan = Math.sin(sBeatF * Math.PI + i * 1.3) * 1.3
            tilt = h.base + Math.cos(sBeatF * Math.PI * 0.5 + i) * 0.6
          }
          inten = (0.65 + 1.5 * sBeat) * (sec === 2 ? (Math.sin(t * 28 + i * 2.1) > 0.1 ? 2.1 : 0.08) : 1)
        } else if (look.mode === 'fan') {
          const cyc = (sBeatF % 32) / 32
          const conv = clamp01((cyc - 0.72) * 6) * clamp01((1 - cyc) * 12)
          const spread = i < 5 ? (i - 2) * 0.34 : i === 5 ? -0.45 : 0.45
          pan = spread * (1 - conv * 0.85) + Math.sin(t * 0.22 + i) * 0.05
          tilt = h.base * 0.55 + Math.sin(t * 0.33 + i * 0.7) * 0.1
          c = conv > 0.4 ? '#fff1e2' : look.colors[i % 3 === 0 ? 1 : i % 3 === 1 ? 0 : 2]
          inten = (0.7 + 0.3 * Math.sin(t * 0.8 + i * 0.6) + conv * 0.6) * 0.62
        } else {
          const sky = clamp01(Math.sin(t * 0.21) * 1.6)
          if (i >= 5 || i % 2 === 1) {
            pan = (i - 3) * 0.05 + Math.sin(t * 0.1 + i) * 0.25
            tilt = THREE.MathUtils.lerp(0.15, 2.75, sky) + Math.sin(t * 0.17 + i) * 0.08
          } else {
            pan = (i - 2) * 0.06 + Math.sin(t * 0.12 + i) * 0.06
            tilt = -0.05 + Math.sin(t * 0.14 + i * 0.5) * 0.08
          }
          c = look.colors[i % 2 ? 0 : (i >> 1) % 2 ? 2 : 1]
          inten = (0.85 + 0.2 * Math.sin(t * 0.5 + i)) * 0.5
        }
        ;(h.mat.uniforms.uColor.value as THREE.Color).set(c)
        h.mat.uniforms.uIntensity.value = inten * ign
        if (h.pan) h.pan.rotation.y = THREE.MathUtils.damp(h.pan.rotation.y, pan, look.mode === 'chase' ? 9 : 2.2, dt)
        if (h.tilt) h.tilt.rotation.x = THREE.MathUtils.damp(h.tilt.rotation.x, tilt, look.mode === 'chase' ? 9 : 2.2, dt)
        return
      }
      const c = sc.colors[i % 3]
      ;(h.mat.uniforms.uColor.value as THREE.Color).set(c)
      let inten = (0.75 + 0.9 * kick) * (st.beatOn ? 1.15 : 0.8)
      if (strobeScene) inten = Math.sin(t * 30 + i * 2.1) > 0.2 ? 2.2 : 0.05
      h.mat.uniforms.uIntensity.value = inten * djScale
      const speed = st.beatOn ? 1.0 : 0.5
      if (h.pan) h.pan.rotation.y = Math.sin(t * 0.7 * speed + i * 1.3) * 1.2
      if (h.tilt) h.tilt.rotation.x = h.base + Math.sin(t * 0.9 * speed + i * 0.8) * 0.55 + kick * 0.15
    })
    if (show && look) {
      const lv = el < 1.0 ? fadeOut : clamp01((el - 1.3) / 1.2)
      const pulse = look.mode === 'chase' ? sBeat : 0.35 + 0.15 * Math.sin(t * 0.8)
      if (light.current) {
        light.current.color.set(look.mode === 'chase' ? look.colors[Math.floor(sBeatF / 8) % 2 ? 1 : 0] : look.colors[1])
        light.current.intensity = (260 + pulse * 700) * lv
      }
      if (light2.current) {
        light2.current.color.set(look.colors[2])
        light2.current.intensity = (90 + pulse * 120) * lv
      }
      sideBars.current.forEach((m, i) => {
        if (m) m.color.set(look.colors[i % look.colors.length]).multiplyScalar((1.2 + pulse * 1.6) * lv)
      })
      const strobeOn = look.strobe > 0 && Math.floor(sBeatF / 8) % 4 === 2 && Math.sin(t * 30) > 0
      strobes.current.forEach((m) => {
        if (m) m.color.setScalar(strobeOn ? 6 * lv : 0.25)
      })
      haze.current.forEach((s, i) => {
        if (!s) return
        s.position.x = Math.sin(t * 0.09 + i * 2) * 7
        s.position.z = 5 + Math.cos(t * 0.07 + i * 1.7) * 3
        s.position.y = 2.4 + (i % 2) * 1.6
        const m = s.material as THREE.SpriteMaterial
        m.color.set(look.colors[(i + 1) % look.colors.length])
        m.opacity = (0.03 + 0.03 * pulse) * look.haze * (0.4 + 0.6 * lv)
      })
    } else {
    if (light.current) {
      light.current.color.set(sc.colors[0])
      light.current.intensity = (500 + kick * 900) * (strobeScene ? (Math.sin(t * 30) > 0 ? 1.6 : 0.2) : 1)
    }
    if (light2.current) {
      light2.current.color.set(sc.colors[1])
      light2.current.intensity = 110 + kick * 200
    }
    sideBars.current.forEach((m, i) => {
      if (m) m.color.set(sc.colors[i % 3]).multiplyScalar(1.6 + kick * 1.6)
    })
    strobes.current.forEach((m) => {
      if (m) m.color.setScalar(strobeScene && Math.sin(t * 30) > 0 ? 6 : 0.4)
    })
    haze.current.forEach((s, i) => {
      if (!s) return
      s.position.x = Math.sin(t * 0.13 + i * 2) * 7
      s.position.z = 5.5 + Math.cos(t * 0.1 + i * 1.7) * 2.5
      const m = s.material as THREE.SpriteMaterial
      m.color.set(sc.colors[i % 3])
      m.opacity = (0.05 + 0.05 * kick * energy) * djScale
      s.position.y = 1.8
    })
    }
    platters.current.forEach((p, i) => {
      if (p) p.rotation.y += dt * (st.beatOn ? 3.2 : 0.4) * (i ? -1 : 1)
    })

    // nút bấm
    padMats.forEach((m, i) => {
      const active = st.scene === i
      m.color.set(SCENES[i].colors[0]).multiplyScalar(active ? 2.8 + kick * 1.2 : 0.55)
    })
    playMat.color.set('#ff3b3b').multiplyScalar(st.beatOn ? 2.6 : 0.8)
    boomMat.color.set('#ffd23d').multiplyScalar(1 + st.press[5] * 2.2)
    for (let i = 0; i < 6; i++) {
      st.press[i] = Math.max(0, st.press[i] - dt * 4)
      const g = padGroups.current[i]
      if (g) g.position.y = -0.045 * st.press[i]
    }

    // hạt
    const m = pcs.current
    if (m && st.fireT < 7) {
      st.fireT += dt
      const { p, v, life, max, size, rot, spin } = parts
      for (let i = 0; i < COUNT_C + COUNT_S; i++) {
        if (life[i] <= 0) {
          dummy.scale.setScalar(0)
          dummy.updateMatrix()
          m.setMatrixAt(i, dummy.matrix)
          continue
        }
        life[i] -= dt
        const confetti = i < COUNT_C
        v[i * 3 + 1] -= (confetti ? 7 : 11) * dt
        const drag = confetti ? 1 - 1.7 * dt : 1 - 0.4 * dt
        v[i * 3] *= drag
        v[i * 3 + 2] *= drag
        if (confetti && v[i * 3 + 1] < -2.2) v[i * 3 + 1] = -2.2
        p[i * 3] += v[i * 3] * dt
        p[i * 3 + 1] += v[i * 3 + 1] * dt
        p[i * 3 + 2] += v[i * 3 + 2] * dt
        if (p[i * 3 + 1] < 0.05 && !confetti) life[i] = 0
        if (p[i * 3 + 1] < 0.05) {
          p[i * 3 + 1] = 0.05
          v[i * 3] = v[i * 3 + 1] = v[i * 3 + 2] = 0
        }
        rot[i * 3] += spin[i * 3] * dt
        rot[i * 3 + 1] += spin[i * 3 + 1] * dt
        rot[i * 3 + 2] += spin[i * 3 + 2] * dt
        dummy.position.set(p[i * 3], p[i * 3 + 1], p[i * 3 + 2])
        dummy.rotation.set(rot[i * 3], rot[i * 3 + 1], rot[i * 3 + 2])
        const k = Math.min(1, life[i] / 0.6)
        dummy.scale.setScalar(size[i] * (confetti ? 1 : Math.max(0.05, life[i] / max[i])) * (life[i] > 0 ? k : 0))
        dummy.updateMatrix()
        m.setMatrixAt(i, dummy.matrix)
      }
      m.instanceMatrix.needsUpdate = true
    }
  })

  const padX = [-1.05, -0.35, 0.35, 1.05]
  return (
    <>
    <FocusViewer />
    <group ref={root} position={[ex.x, 0, ex.z]} rotation={[0, ex.rotY, 0]}>
      <ShowPreloader stageGroup={root} />
      <ShowSelector stageGroup={root} onPick={pickShow} />
      <InfoVeil tex={infoTex} />
      <PhotoWings />
      <LedVideo stageGroup={root} />
      <ShowFX beamGeo={beamGeo} />
      <PadRing radius={13.4} color={ex.color} />
      <Label title="Main Stage" sub="Live Production · LED · Sound" color={ex.color} position={[0, 13.5, 2]} scale={1.4} fadeFar={110} />

      {/* sân khấu */}
      <mesh position={[0, 0.6, -0.8]} geometry={rbox(16.4, 1.2, 8.6, 0.12)} material={mats.darkMetal} castShadow receiveShadow />
      <mesh position={[0, 1.21, -0.8]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[16.0, 8.2]} />
        <meshStandardMaterial color="#07080e" metalness={0.8} roughness={0.22} envMapIntensity={1.6} />
      </mesh>
      <mesh position={[0, 0.9, 3.52]}>
        <boxGeometry args={[16.2, 0.07, 0.04]} />
        <meshBasicMaterial ref={(r) => { sideBars.current[2] = r }} color="#ff2bd6" toneMapped={false} />
      </mesh>

      {/* màn LED chính + hai thanh LED bên */}
      <mesh position={[0, 4.35, -4.9]} geometry={rbox(13.4, 5.5, 0.3, 0.06)} material={mats.lacquer} />
      <mesh position={[0, 4.35, -4.73]}>
        <planeGeometry args={[13, 5.2]} />
        <meshBasicMaterial ref={ledMat} map={led.tex} toneMapped={false} />
      </mesh>
      {[-1, 1].map((s, i) => (
        <mesh key={s} position={[s * 7.4, 4.3, -4.5]}>
          <boxGeometry args={[0.28, 5.4, 0.2]} />
          <meshBasicMaterial ref={(r) => { sideBars.current[i] = r }} color="#ff2bd6" toneMapped={false} />
        </mesh>
      ))}

      {/* truss: hai cổng + dầm nối */}
      <Truss a={[-8, 1.2, 2.6]} b={[-8, 9.4, 2.6]} />
      <Truss a={[8, 1.2, 2.6]} b={[8, 9.4, 2.6]} />
      <Truss a={[-8, 9.4, 2.6]} b={[8, 9.4, 2.6]} />
      <Truss a={[-8, 1.2, -3.4]} b={[-8, 8.2, -3.4]} />
      <Truss a={[8, 1.2, -3.4]} b={[8, 8.2, -3.4]} />
      <Truss a={[-8, 8.2, -3.4]} b={[8, 8.2, -3.4]} />
      <Truss a={[-8, 9.2, 2.6]} b={[-8, 8.4, -3.4]} />
      <Truss a={[8, 9.2, 2.6]} b={[8, 8.4, -3.4]} />

      {/* moving head */}
      {heads.map((h, i) => (
        <group key={i} position={[h.x, h.y, h.z]}>
          <mesh position={[0, 0.2, 0]} material={mats.darkMetal}>
            <boxGeometry args={[0.45, 0.2, 0.45]} />
          </mesh>
          <group ref={(r) => { h.pan = r }} position={[0, 0, 0]}>
            <mesh position={[0, -0.1, 0]} material={mats.darkMetal}>
              <cylinderGeometry args={[0.2, 0.25, 0.25, 12]} />
            </mesh>
            <group ref={(r) => { h.tilt = r }} position={[0, -0.45, 0]}>
              <mesh position={[0, -0.25, 0]} geometry={rbox(0.55, 0.7, 0.55, 0.12)} material={mats.darkMetal} castShadow />
              <mesh position={[0, -0.62, 0]} rotation={[0, 0, 0]}>
                <circleGeometry args={[0.2, 20]} />
                <meshBasicMaterial color={new THREE.Color('#ffffff').multiplyScalar(4)} toneMapped={false} />
              </mesh>
              <mesh position={[0, -0.6, 0]} rotation={[Math.PI, 0, 0]} geometry={beamGeo} material={h.mat} />
              <sprite position={[0, -0.7, 0]} scale={[1.6, 1.6, 1]}>
                <spriteMaterial map={glow} color="#ffffff" transparent opacity={0.8} blending={THREE.AdditiveBlending} depthWrite={false} />
              </sprite>
            </group>
          </group>
        </group>
      ))}
      {/* strobe */}
      {[-4.5, -1.5, 1.5, 4.5].map((x, i) => (
        <mesh key={x} position={[x, 8.75, 2.6]}>
          <boxGeometry args={[1.1, 0.25, 0.3]} />
          <meshBasicMaterial ref={(r) => { strobes.current[i] = r }} color="#ffffff" toneMapped={false} />
        </mesh>
      ))}

      {/* loa */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <group position={[s * 9.3, 8.6, 2.6]}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <group key={i} position={[0, -i * 0.62, i * 0.03]} rotation={[0.03 + i * 0.045, 0, 0]}>
                <mesh geometry={rbox(1.3, 0.58, 0.85, 0.06)} material={mats.darkMetal} castShadow />
                <mesh position={[0, 0, 0.43]}>
                  <planeGeometry args={[1.15, 0.45]} />
                  <meshStandardMaterial color="#050507" roughness={0.9} metalness={0.5} />
                </mesh>
              </group>
            ))}
          </group>
          {[0, 1].map((i) => (
            <group key={i} position={[s * 10.5, 0.6 + i * 1.2, 1.5]}>
              <mesh geometry={rbox(2.1, 1.18, 1.5, 0.08)} material={mats.darkMetal} castShadow />
              <mesh position={[0, 0, 0.76]}>
                <circleGeometry args={[0.46, 24]} />
                <meshStandardMaterial color="#050507" roughness={0.6} metalness={0.7} />
              </mesh>
              <mesh position={[0, 0, 0.765]}>
                <ringGeometry args={[0.47, 0.5, 24]} />
                <meshBasicMaterial color={new THREE.Color('#ff2bd6').multiplyScalar(2)} toneMapped={false} />
              </mesh>
            </group>
          ))}
        </group>
      ))}

      {/* khói + đèn */}
      {[0, 1, 2, 3, 4].map((i) => (
        <sprite key={i} ref={(r) => { haze.current[i] = r }} position={[0, 1.8, 5.5]} scale={[11, 5, 1]}>
          <spriteMaterial map={glow} color="#ff2bd6" transparent opacity={0.06} blending={THREE.AdditiveBlending} depthWrite={false} />
        </sprite>
      ))}
      <pointLight ref={light} position={[0, 6, 4]} color="#ff2bd6" intensity={500} distance={44} decay={2} />
      <pointLight ref={light2} position={[0, 6, 3]} color="#2bd9ff" intensity={120} distance={30} decay={2} />

      {/* pháo giấy / pháo hoa */}
      <instancedMesh ref={pcs} args={[undefined, undefined, COUNT_C + COUNT_S]} frustumCulled={false}>
        <planeGeometry args={[0.16, 0.1]} />
        <meshBasicMaterial side={THREE.DoubleSide} toneMapped={false} />
      </instancedMesh>

      {/* bàn FOH */}
      <group position={[0, 0, 12]}>
        <mesh position={[0, 0.45, 0]} geometry={rbox(6.4, 0.9, 1.8, 0.1)} material={mats.darkMetal} castShadow receiveShadow />
        <group position={[0, 0.96, 0]} rotation={[0.2, 0, 0]}>
          <mesh geometry={rbox(6.2, 0.1, 1.7, 0.04)} material={mats.lacquer} />
          {/* CDJ */}
          {[-1.9, 1.9].map((x, i) => (
            <group key={x} position={[x, 0.09, -0.22]}>
              <mesh geometry={rbox(1.35, 0.1, 1.15, 0.05)} material={mats.darkMetal} />
              <mesh ref={(r) => { platters.current[i] = r }} position={[0, 0.07, 0.05]}>
                <cylinderGeometry args={[0.42, 0.42, 0.04, 32]} />
                <meshStandardMaterial color="#1a1c26" metalness={0.9} roughness={0.3} emissive={i ? '#ff2bd6' : '#2bd9ff'} emissiveIntensity={0.9} />
              </mesh>
              <mesh position={[0, 0.095, 0.05]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.36, 0.4, 32]} />
                <meshBasicMaterial color={new THREE.Color(i ? '#ff2bd6' : '#2bd9ff').multiplyScalar(3)} toneMapped={false} />
              </mesh>
            </group>
          ))}
          {/* mixer */}
          <mesh position={[0, 0.1, -0.3]} geometry={rbox(1.4, 0.1, 1.0, 0.04)} material={mats.darkMetal} />
          {[-0.45, -0.15, 0.15, 0.45].map((x) => (
            <group key={x}>
              <mesh position={[x, 0.17, -0.1]} material={mats.silver}>
                <boxGeometry args={[0.06, 0.04, 0.2]} />
              </mesh>
              <mesh position={[x, 0.18, -0.55]} material={mats.silver}>
                <cylinderGeometry args={[0.06, 0.06, 0.06, 12]} />
              </mesh>
            </group>
          ))}
          {/* pad cue */}
          {SCENES.map((s, i) => (
            <group key={s.name} ref={(r) => { padGroups.current[i] = r }} position={[padX[i], 0.08, 0.5]}>
              <mesh geometry={rbox(0.58, 0.1, 0.52, 0.05)} material={padMats[i]} />
              <Hit id={`stage-cue-${i}`} label={`Cue ${i + 1} · ${s.name}`} hint="Đổi cảnh + bật nhạc" maxDist={7} panel="stage" size={[0.66, 0.5, 0.6]} position={[0, 0.1, 0]} onClick={() => setScene(i)} />
            </group>
          ))}
          <group ref={(r) => { padGroups.current[4] = r }} position={[-2.75, 0.1, 0.5]}>
            <mesh material={playMat}>
              <cylinderGeometry args={[0.32, 0.34, 0.1, 24]} />
            </mesh>
            <Hit id="stage-play" label="PLAY / STOP · DJ set" hint="Bật / tắt nhạc" maxDist={7} panel="stage" size={[0.8, 0.5, 0.8]} position={[0, 0.1, 0]} onClick={() => { padGroups.current[4] && (st.press[4] = 1); toggleBeat() }} />
          </group>
          <group ref={(r) => { padGroups.current[5] = r }} position={[2.75, 0.1, 0.5]}>
            <mesh material={boomMat}>
              <cylinderGeometry args={[0.32, 0.34, 0.1, 24]} />
            </mesh>
            <Hit id="stage-fire" label="PHÁO GIẤY & PYRO" hint="Bắn pháo!" maxDist={7} panel="stage" size={[0.8, 0.5, 0.8]} position={[0, 0.1, 0]} onClick={() => fire()} />
          </group>
        </group>
      </group>
      <Hit id="stage-body" label="Main Stage" hint="Đến khu FOH để chọn chương trình" maxDist={60} panel="stage" size={[16.4, 9, 8.6]} position={[0, 4.5, -0.8]} onClick={() => toast('Đến khu FOH phía trước sân khấu để gọi lại một chương trình')} />
    </group>
    </>
  )
}
