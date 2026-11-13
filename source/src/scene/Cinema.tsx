import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { EXHIBITS, openExternal } from '../layout'
import { audio, type Bus } from '../audio'
import { toast, useStore } from '../store'
import { FONT, beamGeometry, beamMaterial, canvasTex, rbox, roundRect } from '../gfx'
import { useReality } from '../reality/state'
import { Hit } from './Hit'
import { DomOcclusion } from './domOcclusion'
import { Label } from './Label'
import { PadRing, isFacing, mats, useWorldColliders, worldPos } from './common'

const ex = EXHIBITS.cinema

// Same-origin clips can autoplay and advance reliably without Drive player clicks.
const PROJECT_FILMS: { id: string; label: string; src?: string }[] = [
  { id: '1fkUo-py1nE_pqeGVYvpnJCJCs1IlWAKe', label: 'THE FOOT BETRAYS YOU', src: './portfolio/films/the-foot-betrays-you.mp4' },
  { id: '1RfgyAe0LeKlENlNUTLRYanoFpslrKDz3', label: 'UNHEARD · MUSIC DISCOVERY', src: './portfolio/films/unheard-music-discovery.mp4' },
  { id: '13TybcMrggmZG2K5MpHREdY54WGSyWRh3', label: 'CORAVAMARIS · VIDEO PROJECT 3', src: './portfolio/films/coravamaris.mp4' },
  { id: '1Q8fq-i-Of1jMqeuFCPNCpLhZTatq4j4h', label: 'SOCIAL MEDIA · 92da', src: './portfolio/films/social-2.mp4' },
  { id: '1sR4CaGBWVUNnmaIQK-gWbmYP_0W4KDko', label: 'SOCIAL MEDIA · 9c40', src: './portfolio/films/social-1.mp4' },
  { id: '1O5hcaN86PB4KGd9Sb476Mdahqgv6W-bY', label: 'SOCIAL MEDIA · ea07', src: './portfolio/films/social-3.mp4' },
]

function cinemaHomography(src: number[][], dst: number[][]): number[] | null {
  const A: number[][] = []
  const b: number[] = []
  for (let i = 0; i < 4; i++) {
    const [u, v] = src[i]
    const [x, y] = dst[i]
    A.push([u, v, 1, 0, 0, 0, -u * x, -v * x])
    b.push(x)
    A.push([0, 0, 0, u, v, 1, -u * y, -v * y])
    b.push(y)
  }
  // Gaussian elimination with partial pivoting.
  const n = 8
  for (let col = 0; col < n; col++) {
    let piv = col
    for (let r = col + 1; r < n; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r
    if (Math.abs(A[piv][col]) < 1e-9) return null
    ;[A[col], A[piv]] = [A[piv], A[col]]
    ;[b[col], b[piv]] = [b[piv], b[col]]
    const d = A[col][col]
    for (let c = col; c < n; c++) A[col][c] /= d
    b[col] /= d
    for (let r = 0; r < n; r++) {
      if (r === col) continue
      const f = A[r][col]
      if (!f) continue
      for (let c = col; c < n; c++) A[r][c] -= f * A[col][c]
      b[r] -= f * b[col]
    }
  }
  const h = b
  // CSS matrix3d is column-major: columns (h11 h21 h31 h41) ...
  return [h[0], h[3], 0, h[6], h[1], h[4], 0, h[7], 0, 0, 1, 0, h[2], h[5], 0, 1]
}

// Same-origin films are real WebGL textures, so the screen is depth-tested
// pixel-for-pixel against the cinema, furniture and moving objects. The media
// element enters the existing HRTF/reverb bus rather than playing in 2D.
function LocalCinemaFilm({ index, onNext }: { index: number | null; onNext: () => void }) {
  const phase = useReality(s => s.phase)
  const media = useMemo(() => {
    const video = document.createElement('video')
    video.playsInline = true
    video.preload = 'auto'
    const texture = new THREE.VideoTexture(video)
    texture.colorSpace = THREE.SRGBColorSpace
    return { video, texture }
  }, [])
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  useEffect(() => {
    const film = index === null ? null : PROJECT_FILMS[index]
    if (!film?.src || phase !== 'idle') return
    audio.prepare()
    const bus = audio.createBus('cinema-film', worldPos(ex, 0, 2.95, -5.8), { ref: 4, rolloff: 1.4, maxDist: 75, reverb: 0.45, gain: 0.9 })
    const source = sourceRef.current ?? (sourceRef.current = audio.ctx.createMediaElementSource(media.video))
    source.connect(bus.input)
    media.video.src = film.src
    media.video.muted = false // global mute is applied by the shared master bus
    media.video.onended = onNext
    void media.video.play().catch(() => { toast('Bấm để cho phép phim phát có tiếng') })
    const resume = () => {
      if (!media.video.paused) return
      if (audio.ctx.state === 'suspended') void audio.ctx.resume()
      void media.video.play().catch(() => {})
    }
    window.addEventListener('pointerdown', resume)
    window.addEventListener('keydown', resume)
    return () => {
      window.removeEventListener('pointerdown', resume)
      window.removeEventListener('keydown', resume)
      media.video.onended = null
      media.video.pause()
      media.video.removeAttribute('src')
      media.video.load()
      source.disconnect()
    }
  }, [index, phase, media, onNext])
  useEffect(() => () => media.texture.dispose(), [media])
  const film = index === null ? null : PROJECT_FILMS[index]
  if (!film?.src || phase !== 'idle') return null
  return <mesh position={[0, 2.95, -5.94]}>
    <planeGeometry args={[8.3, 3.64]} />
    <meshBasicMaterial map={media.texture} toneMapped={false} />
  </mesh>
}

function CinemaVideo({ index, onClose, onNext }: { index: number | null; onClose: () => void; onNext: () => void }) {
  const { gl, camera, scene } = useThree()
  const occlusion = useMemo(() => new DomOcclusion(), [])
  const worldCorners = useMemo(() => Array.from({ length: 4 }, () => new THREE.Vector3()), [])
  const layer = useMemo(() => {
    const el = document.createElement('div')
    Object.assign(el.style, { position: 'absolute', left: '0', top: '0', width: '1280px', height: '720px', transformOrigin: '0 0', visibility: 'hidden', overflow: 'hidden', pointerEvents: 'none' })
    return el
  }, [])
  const phase = useReality((s) => s.phase)
  const muted = useStore((s) => s.muted)
  useEffect(() => {
    const video = layer.querySelector('video')
    if (video) video.muted = muted
  }, [muted, layer, index])
  useEffect(() => {
    if (index === null || phase !== 'idle' || PROJECT_FILMS[index].src) return
    const film = PROJECT_FILMS[index]
    const frame = film.src ? document.createElement('video') : document.createElement('iframe')
    if (frame instanceof HTMLVideoElement) {
      frame.src = film.src!
      frame.controls = true
      frame.muted = useStore.getState().muted || !audio.started
      frame.autoplay = true
      frame.playsInline = true
      frame.preload = 'auto'
      frame.onended = onNext
      void frame.play().catch(() => { frame.muted = true; void frame.play().catch(() => {}) })
    } else {
      frame.src = `https://drive.google.com/file/d/${film.id}/preview?autoplay=1`
      frame.allow = 'autoplay; fullscreen'
    }
    frame.title = film.label
    frame.style.cssText = 'width:100%;height:100%;border:0;background:#000;object-fit:contain'
    frame.style.pointerEvents = 'auto'
    layer.style.pointerEvents = 'auto'
    layer.appendChild(frame)
    const nextButton = document.createElement('button')
    nextButton.textContent = 'PHIM TIẾP ▶'
    nextButton.style.cssText = 'position:absolute;right:18px;top:18px;z-index:2;padding:12px 18px;color:white;background:#111c;border:1px solid white;border-radius:8px;cursor:pointer;font:600 22px sans-serif'
    nextButton.onclick = onNext
    layer.appendChild(nextButton)
    gl.domElement.parentElement?.appendChild(layer)
    return () => {
      if (frame instanceof HTMLVideoElement) { frame.onended = null; frame.pause(); frame.removeAttribute('src'); frame.load() }
      nextButton.remove(); frame.remove(); layer.remove()
    }
  }, [index, phase, layer, gl, onNext])
  const points = useMemo(() => [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], [])
  useFrame(() => {
    if (index === null || phase !== 'idle' || PROJECT_FILMS[index].src || !layer.parentElement) return
    const dx = camera.position.x - ex.x, dz = camera.position.z - ex.z
    const localZ = dx * Math.sin(ex.rotY) + dz * Math.cos(ex.rotY)
    if (Math.hypot(dx, dz) > 38) { onClose(); return }
    if (localZ < -5.7) { layer.style.visibility = 'hidden'; return }
    const c = Math.cos(ex.rotY), s = Math.sin(ex.rotY)
    const xy = [[-4.2,4.85], [4.2,4.85], [-4.2,1.05], [4.2,1.05]]
    const dst: number[][] = []
    for (let i=0; i<4; i++) {
      const [x,y] = xy[i], z = -5.75
      const v = points[i].set(ex.x + x*c + z*s, y, ex.z - x*s + z*c)
      if (v.clone().applyMatrix4(camera.matrixWorldInverse).z > -0.2) { layer.style.visibility = 'hidden'; return }
      worldCorners[i].copy(v)
      v.project(camera)
      dst.push([(v.x+1)*gl.domElement.clientWidth/2, (1-v.y)*gl.domElement.clientHeight/2])
    }
    const matrix = cinemaHomography([[0,0],[1280,0],[0,720],[1280,720]], dst)
    if (!matrix) { layer.style.visibility = 'hidden'; return }
    layer.style.visibility = 'visible'
    layer.style.transform = `matrix3d(${matrix.join(',')})`
    occlusion.update(layer, camera, scene, worldCorners, performance.now() / 1000)
  })
  return null
}

// Silent exterior teaser, decoded only when the visitor is near the cinema.
function CinemaTeaser() {
  const teaser = useMemo(() => {
    const video = document.createElement('video')
    video.muted = true
    video.loop = true
    video.playsInline = true
    video.preload = 'none'
    const texture = new THREE.VideoTexture(video)
    texture.colorSpace = THREE.SRGBColorSpace
    return { video, texture, loaded: false, lastCheck: 0 }
  }, [])
  useFrame(({ camera, clock }) => {
    if (clock.elapsedTime - teaser.lastCheck < 1) return
    teaser.lastCheck = clock.elapsedTime
    const near = useReality.getState().phase === 'idle' && Math.hypot(camera.position.x - ex.x, camera.position.z - ex.z) < 24
    if (!near) { if (!teaser.video.paused) teaser.video.pause(); return }
    if (!teaser.loaded) {
      teaser.loaded = true
      teaser.video.src = PROJECT_FILMS[0].src!
    }
    if (teaser.video.paused) void teaser.video.play().catch(() => {})
  })
  useEffect(() => () => {
    teaser.video.pause()
    teaser.video.removeAttribute('src')
    teaser.video.load()
    teaser.texture.dispose()
  }, [teaser])
  return <mesh position={[0, 0, 0.06]}>
    <planeGeometry args={[1, 0.5625]} />
    <meshBasicMaterial map={teaser.texture} toneMapped={false} />
  </mesh>
}

const SW = 1024
const SH = 450
const TITLES = ['AFTERGLOW', 'RUN OF SHOW', 'PARTICLES', 'TUNNEL']
const SUBS = ['Aftermovie · Festival 2025', 'Motion · Quy trình sản xuất', 'LED content · Real-time', 'Immersive · Dome 360°']
const velvet = new THREE.MeshStandardMaterial({ color: '#8c1226', roughness: 0.92, metalness: 0 })
const neonRed = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff3b3b').multiplyScalar(2.8), toneMapped: false })
const warm = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb070').multiplyScalar(2.2), toneMapped: false })

const hash = (n: number) => {
  const s = Math.sin(n * 127.1) * 43758.5453
  return s - Math.floor(s)
}

function film(ctx: CanvasRenderingContext2D, W: number, H: number, t: number, reel: number, rt: number) {
  ctx.globalCompositeOperation = 'source-over'
  ctx.shadowBlur = 0
  if (reel === 0) {
    const g = ctx.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, '#06000f')
    g.addColorStop(1, '#240838')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
    ctx.globalCompositeOperation = 'lighter'
    for (let i = 0; i < 16; i++) {
      const x0 = W * (0.05 + (i / 15) * 0.9)
      const ang = -Math.PI / 2 + Math.sin(t * 0.8 + i * 0.7) * 0.85 + (i - 7.5) * 0.06
      const hue = (i * 24 + t * 45) % 360
      ctx.strokeStyle = `hsla(${hue},100%,62%,0.6)`
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(x0, H * 0.96)
      ctx.lineTo(x0 + Math.cos(ang) * W * 1.1, H * 0.96 + Math.sin(ang) * W * 1.1)
      ctx.stroke()
      ctx.strokeStyle = `hsla(${hue},100%,70%,0.12)`
      ctx.lineWidth = 16
      ctx.stroke()
    }
    const rg = ctx.createRadialGradient(W / 2, H * 0.1, 0, W / 2, H * 0.1, W * 0.6)
    rg.addColorStop(0, `hsla(${(t * 30) % 360},100%,60%,0.35)`)
    rg.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = rg
    ctx.fillRect(0, 0, W, H)
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = '#05010b'
    for (let i = 0; i < 52; i++) {
      const x = (i / 51) * W
      const y = H * 0.9 - 12 * Math.abs(Math.sin(i * 1.7)) + Math.sin(t * 3.2 + i) * 7
      ctx.beginPath()
      ctx.arc(x, y, 17, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillRect(x - 22, y, 44, H)
      if (i % 3 === 0) {
        ctx.strokeStyle = '#05010b'
        ctx.lineWidth = 6
        ctx.beginPath()
        ctx.moveTo(x, y + 10)
        ctx.lineTo(x + Math.sin(t * 4 + i) * 12, y - 38 - Math.abs(Math.sin(t * 3 + i)) * 20)
        ctx.stroke()
      }
    }
  } else if (reel === 1) {
    const g = ctx.createLinearGradient(0, 0, W, H)
    g.addColorStop(0, '#071022')
    g.addColorStop(1, '#10052a')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.lineWidth = 1
    for (let x = -((t * 40) % 60); x < W; x += 60) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, H)
      ctx.stroke()
    }
    const cues = ['LX 014', 'VID 007', 'SFX 021', 'PYRO 003', 'LASER 09', 'AUDIO 12', 'FOLLOW 02', 'HAZE 05']
    const cols = ['#ff4fd8', '#38d9ff', '#ffd400', '#ff7a1f', '#7aff8a', '#9a6bff', '#ff3b3b', '#bfe6ff']
    for (let r = 0; r < 4; r++)
      for (let i = 0; i < 9; i++) {
        const x = ((i * 190 - t * (60 + r * 22)) % (W + 380)) - 190 + (r % 2) * 40
        const w = 150 + hash(i * 3 + r) * 60
        const c = cols[(i + r * 3) % 8]
        ctx.fillStyle = c + '33'
        roundRect(ctx, x, 150 + r * 54, w, 40, 8)
        ctx.fill()
        ctx.strokeStyle = c
        ctx.lineWidth = 2
        ctx.stroke()
        ctx.fillStyle = '#fff'
        ctx.font = `600 18px ${FONT}`
        ctx.textAlign = 'left'
        ctx.fillText(cues[(i + r * 2) % 8], x + 12, 176 + r * 54)
      }
    ctx.fillStyle = '#ff3b3b'
    ctx.fillRect(W * 0.3, 120, 3, 300)
    const words = ['HOUSE LIGHTS', 'INTRO VIDEO', 'ARTIST ENTRANCE', 'DROP', 'PYRO · 3…2…1', 'FINALE']
    const wi = Math.floor(t / 1.6) % words.length
    const ph = (t / 1.6) % 1
    ctx.textAlign = 'left'
    ctx.fillStyle = `rgba(255,255,255,${Math.min(1, ph * 6) * (1 - Math.max(0, ph - 0.8) * 5)})`
    ctx.font = `700 64px ${FONT}`
    ctx.fillText(words[wi], 60 + (1 - Math.min(1, ph * 5)) * 60, 100)
    ctx.fillStyle = '#7fe9ff'
    ctx.font = `600 22px ${FONT}`
    ctx.fillText(`CUE ${String(wi * 14 + 1).padStart(3, '0')} · GO`, 62, 130)
  } else if (reel === 2) {
    ctx.fillStyle = rt < 0.05 ? '#000' : 'rgba(2,3,12,0.14)'
    ctx.fillRect(0, 0, W, H)
    ctx.globalCompositeOperation = 'lighter'
    for (let i = 0; i < 160; i++) {
      const a = hash(i) * 6.283
      const r0 = 40 + hash(i + 50) * 260
      const sp = 0.25 + hash(i + 99) * 0.6
      const ang = a + t * sp
      const x = W / 2 + Math.cos(ang) * r0 * 1.7 + Math.sin(t * 0.9 + i) * 30
      const y = H / 2 + Math.sin(ang * 1.3) * r0 * 0.7 + Math.cos(t * 0.7 + i * 2) * 20
      ctx.fillStyle = `hsla(${(i * 7 + t * 40) % 360},100%,62%,0.9)`
      ctx.beginPath()
      ctx.arc(x, y, 1.5 + hash(i + 7) * 3, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalCompositeOperation = 'source-over'
  } else {
    ctx.fillStyle = '#02030a'
    ctx.fillRect(0, 0, W, H)
    ctx.globalCompositeOperation = 'lighter'
    ctx.translate(W / 2, H / 2)
    for (let i = 0; i < 26; i++) {
      const z = ((i / 26 + t * 0.12) % 1)
      const s = Math.pow(z, 2.6) * 1.6 + 0.02
      ctx.save()
      ctx.rotate(t * 0.3 + i * 0.12)
      ctx.strokeStyle = `hsla(${(i * 14 + t * 50) % 360},100%,60%,${Math.min(1, z * 2) * (1 - z * 0.4)})`
      ctx.lineWidth = 2 + z * 8
      ctx.beginPath()
      const n = 6
      for (let k = 0; k <= n; k++) {
        const a = (k / n) * Math.PI * 2
        const px = Math.cos(a) * W * 0.5 * s
        const py = Math.sin(a) * W * 0.5 * s
        if (k === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.stroke()
      ctx.restore()
    }
    ctx.globalCompositeOperation = 'source-over'
    ctx.setTransform(1, 0, 0, 1, 0, 0)
  }
  ctx.globalCompositeOperation = 'source-over'
  // letterbox + chú thích
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, W, 34)
  ctx.fillRect(0, H - 34, W, 34)
  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(255,255,255,0.75)'
  ctx.font = `500 15px ${FONT}`
  ctx.fillText(`REEL 0${reel + 1}/04 · ${TITLES[reel]}`, 24, H - 12)
  const f = Math.floor((rt * 24) % 24)
  const s = Math.floor(rt) % 60
  ctx.textAlign = 'right'
  ctx.fillText(`00:00:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`, W - 24, H - 12)
  if (rt < 3.2) {
    const a = Math.min(1, rt * 2) * (1 - Math.max(0, rt - 2.4) / 0.8)
    ctx.globalAlpha = Math.max(0, a)
    ctx.textAlign = 'center'
    ctx.fillStyle = '#fff'
    ctx.shadowColor = '#000'
    ctx.shadowBlur = 24
    ctx.font = `700 76px ${FONT}`
    ctx.fillText(TITLES[reel], W / 2, H / 2 + 20)
    ctx.shadowBlur = 0
    ctx.font = `500 22px ${FONT}`
    ctx.fillText(SUBS[reel].toUpperCase(), W / 2, H / 2 + 62)
    ctx.globalAlpha = 1
  }
}

function posterTex(title: string, a: string, b: string, sub: string) {
  return canvasTex(256, 384, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h)
    g.addColorStop(0, a)
    g.addColorStop(1, b)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    ctx.beginPath()
    ctx.arc(w / 2, h * 0.42, 76, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'
    ctx.lineWidth = 3
    for (let i = 0; i < 5; i++) {
      ctx.beginPath()
      ctx.arc(w / 2, h * 0.42, 28 + i * 14, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.textAlign = 'center'
    ctx.fillStyle = '#fff'
    ctx.font = `800 30px ${FONT}`
    ctx.fillText(title, w / 2, h * 0.8)
    ctx.font = `500 13px ${FONT}`
    ctx.fillText(sub, w / 2, h * 0.86)
  }).tex
}

export function Cinema() {
  const busRef = useRef<Bus | null>(null)
  const [projectFilm, setProjectFilm] = useState<number | null>(null)
  const realityPhase = useReality((s) => s.phase)
  useEffect(() => { if (realityPhase !== 'idle') setProjectFilm(null) }, [realityPhase])
  // Diagnostic only: do not read Cinema screen pixels to update a distant
  // room light during HEX. The full 1024x450 film keeps drawing, unchanged.
  // A/B ONLY: keep the real 1024×450 cinema pixels and exact CanvasTexture,
  // but opt into a CPU-backed 2D canvas to avoid a native readback fence when
  // the 4×2 room-light sampler calls getImageData(). No display changes allowed.
  const screenTex = useMemo(() => {
    if (typeof window === 'undefined' ||
        new URLSearchParams(window.location.search).get('hexCinemaCpuCanvas') !== '1') {
      return canvasTex(SW, SH, () => {})
    }
    const canvas = document.createElement('canvas')
    canvas.width = SW
    canvas.height = SH
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 8
    return { canvas, ctx, tex }
  }, [])
  const tiny = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 4
    c.height = 2
    return c.getContext('2d', { willReadFrequently: true })!
  }, [])
  const st = useRef({ reel: 0, reelT: 0, flash: 0, lastDraw: 0, scoreOn: false, lastAvg: 0 }).current
  const roomLight = useRef<THREE.PointLight>(null)
  const entrance = useMemo(() => worldPos(ex, 0, 0, 6.2), [])
  const leftDoor = useRef<THREE.Mesh>(null)
  const rightDoor = useRef<THREE.Mesh>(null)
  const bulbs = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const col = useMemo(() => new THREE.Color(), [])
  const posters = useMemo(
    () => [
      posterTex('AFTERGLOW', '#ff2bd6', '#2b1bff', 'FESTIVAL 2025'),
      posterTex('RUN OF SHOW', '#ff7a1f', '#7a0a2a', 'MOTION'),
      posterTex('TUNNEL', '#2bffd0', '#1a2bff', 'IMMERSIVE 360°'),
    ],
    [],
  )
  const beamGeo = useMemo(() => beamGeometry(10.8, 4.0, 0.1, 28), [])
  const beamMat = useMemo(() => beamMaterial('#bcd4ff', 0.4), [])

  useWorldColliders(ex, [
    { type: 'box', x: 0, z: -6.3, hw: 5.5, hd: 0.4 },
    { type: 'box', x: -5.3, z: 0, hw: 0.35, hd: 6.5 },
    { type: 'box', x: 5.3, z: 0, hw: 0.35, hd: 6.5 },
    { type: 'box', x: -3.65, z: 6.2, hw: 1.9, hd: 0.35 },
    { type: 'box', x: 3.65, z: 6.2, hw: 1.9, hd: 0.35 },
    ...[-1.0, 1.3, 3.6].flatMap((z) => [
      { type: 'box' as const, x: -3.1, z, hw: 1.15, hd: 0.5 },
      { type: 'box' as const, x: 3.1, z, hw: 1.15, hd: 0.5 },
    ]),
  ])

  useEffect(() => {
    busRef.current = audio.createBus('cinema', worldPos(ex, 0, 2.8, -4.5), { ref: 3, rolloff: 1.5, maxDist: 70, reverb: 0.5, gain: 0.8 })
    film(screenTex.ctx, SW, SH, 0, 0, 0)
    screenTex.tex.needsUpdate = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const advanceFilm = useCallback(() => setProjectFilm(i => i === null ? 0 : (i + 1) % PROJECT_FILMS.length), [])
  const next = () => {
    const nextFilm = projectFilm === null ? 0 : (projectFilm + 1) % PROJECT_FILMS.length
    setProjectFilm(nextFilm)
    // Release the cursor so native video/Drive controls remain usable.
    useStore.getState().setFree(true)
    if (document.pointerLockElement) document.exitPointerLock()
    st.reel = nextFilm
    st.reelT = 0
    st.flash = 1
    if (busRef.current) audio.cubeClick(busRef.current, 0.6)
    toast(`Rạp phim: ${PROJECT_FILMS[nextFilm].label} · chọn nút phát nếu trình duyệt yêu cầu`)
  }

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    const approachingDoor = Math.hypot(state.camera.position.x - entrance.x, state.camera.position.z - entrance.z) < 3
    const doorOffset = projectFilm !== null && !approachingDoor ? 0 : 1.65
    if (leftDoor.current) leftDoor.current.position.x = THREE.MathUtils.damp(leftDoor.current.position.x, -0.82 - doorOffset, 3, dt)
    if (rightDoor.current) rightDoor.current.position.x = THREE.MathUtils.damp(rightDoor.current.position.x, 0.82 + doorOffset, 3, dt)
    if (projectFilm === null && realityPhase === 'idle' && Math.hypot(state.camera.position.x - ex.x, state.camera.position.z - ex.z) < 24) setProjectFilm(0)
    if (!st.scoreOn && projectFilm === null && audio.started && busRef.current) {
      st.scoreOn = true
      audio.startScore(busRef.current)
    }
    if (busRef.current) busRef.current.input.gain.setTargetAtTime(projectFilm === null ? 0.8 : 0.0001, audio.ctx.currentTime, 0.15)
    st.reelT += dt
    if (projectFilm === null && st.reelT > 16) {
      st.reel = (st.reel + 1) % 4
      st.reelT = 0
    }
    st.flash = Math.max(0, st.flash - dt * 3)
    if (projectFilm === null && isFacing(state.camera, ex.x, ex.z) && t - st.lastDraw > 1 / 26) {
      st.lastDraw = t
      const ctx = screenTex.ctx
      ctx.save()
      film(ctx, SW, SH, t, st.reel, st.reelT)
      ctx.restore()
      if (st.flash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${st.flash})`
        ctx.fillRect(0, 0, SW, SH)
      }
      screenTex.tex.needsUpdate = true
      // màu trung bình của phim -> ánh sáng phòng
      // A synchronous canvas readback caused multi-second main-thread stalls.
      // The cinema light contributes nothing useful during HEX or from far
      // away, so never read its pixels in those cases.
      const skipReadback = useReality.getState().phase !== 'idle' ||
        Math.hypot(state.camera.position.x - ex.x, state.camera.position.z - ex.z) > 24
      if (t - st.lastAvg > 0.2 && !skipReadback) {
        st.lastAvg = t
        tiny.drawImage(screenTex.canvas, 0, 34, SW, SH - 68, 0, 0, 4, 2)
        const d = tiny.getImageData(0, 0, 4, 2).data
        let r = 0
        let g = 0
        let b = 0
        for (let i = 0; i < 8; i++) {
          r += d[i * 4]
          g += d[i * 4 + 1]
          b += d[i * 4 + 2]
        }
        if (roomLight.current) roomLight.current.color.setRGB(r / 2040 + 0.05, g / 2040 + 0.05, b / 2040 + 0.05)
      }
    }
    // bóng đèn marquee chạy
    const m = bulbs.current
    if (m) {
      const n = m.count
      const ph = Math.floor(t * 9)
      for (let i = 0; i < n; i++) {
        const on = (i - ph) % 3 === 0
        col.set('#ffd9a0').multiplyScalar(on ? 3.2 : 0.35)
        m.setColorAt(i, col)
      }
      if (m.instanceColor) m.instanceColor.needsUpdate = true
    }
  })

  const bulbPos = useMemo(() => {
    const out: [number, number][] = []
    const w = 4.5
    const h = 0.95
    for (let i = 0; i < 16; i++) out.push([-w + (i / 15) * w * 2, h])
    for (let i = 0; i < 16; i++) out.push([w - (i / 15) * w * 2, -h])
    for (let i = 1; i < 6; i++) out.push([-w, h - (i / 6) * h * 2])
    for (let i = 1; i < 6; i++) out.push([w, -h + (i / 6) * h * 2])
    return out
  }, [])
  useEffect(() => {
    const m = bulbs.current
    if (!m) return
    bulbPos.forEach(([x, y], i) => {
      dummy.position.set(x, y, 0)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
      m.setColorAt(i, col.set('#ffd9a0'))
    })
    m.instanceMatrix.needsUpdate = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const marquee = useMemo(
    () =>
      canvasTex(1024, 192, (ctx, w, h) => {
        ctx.fillStyle = '#0a0406'
        ctx.fillRect(0, 0, w, h)
        ctx.textAlign = 'center'
        ctx.shadowColor = '#ff3b3b'
        ctx.shadowBlur = 28
        ctx.fillStyle = '#ffd6d6'
        ctx.font = `800 96px ${FONT}`
        ctx.fillText('MINI CINEMA', w / 2, 112)
        ctx.shadowBlur = 8
        ctx.font = `600 32px ${FONT}`
        ctx.fillStyle = '#ff8a8a'
        ctx.fillText('NOW SHOWING · ORBITA SHOWREEL', w / 2, 163)
      }).tex,
    [],
  )

  return (
    <group position={[ex.x, 0, ex.z]} rotation={[0, ex.rotY, 0]}>
      <LocalCinemaFilm index={projectFilm} onNext={advanceFilm} />
      <CinemaVideo index={projectFilm} onClose={() => setProjectFilm(null)} onNext={advanceFilm} />
      <PadRing radius={10.2} color={ex.color} />
      <Label title="Mini Cinema" sub="Film · Motion · Aftermovie" color={ex.color} position={[0, 9.4, 3]} scale={1.2} />

      {/* sàn, tường, mái */}
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[10.4, 12.4]} />
        <meshStandardMaterial color="#2a0710" roughness={0.95} />
      </mesh>
      <mesh position={[0, 2.9, -6.3]} material={mats.darkMetal} castShadow receiveShadow>
        <boxGeometry args={[10.8, 5.8, 0.5]} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * 5.3, 2.9, 0]} material={mats.darkMetal} castShadow receiveShadow>
            <boxGeometry args={[0.5, 5.8, 12.8]} />
          </mesh>
          <mesh position={[s * 3.65, 2.9, 6.2]} material={mats.darkMetal} castShadow receiveShadow>
            <boxGeometry args={[3.7, 5.8, 0.5]} />
          </mesh>
          <mesh position={[s * 1.82, 2.9, 6.48]} material={neonRed}>
            <boxGeometry args={[0.07, 5.8, 0.06]} />
          </mesh>
          <mesh position={[s * 5.04, 3.2, 0]} material={neonRed}>
            <boxGeometry args={[0.05, 0.05, 12.2]} />
          </mesh>
          {[-4.2, -1.7, 0.8, 3.3].map((z) => (
            <mesh key={z} position={[s * 5.0, 2.7, z]} material={warm}>
              <boxGeometry args={[0.08, 0.7, 0.16]} />
            </mesh>
          ))}
        </group>
      ))}
      <mesh position={[0, 4.75, 6.2]} material={mats.darkMetal} castShadow>
        <boxGeometry args={[3.7, 2.1, 0.5]} />
      </mesh>
      <mesh position={[0, 5.95, 0]} material={mats.darkMetal} castShadow receiveShadow>
        <boxGeometry args={[11.2, 0.4, 13.2]} />
      </mesh>
      <mesh position={[0, 6.2, 6.5]} material={neonRed}>
        <boxGeometry args={[11.2, 0.08, 0.08]} />
      </mesh>

      {/* Automatic entrance doors reopen when approached from either side. */}
      <mesh ref={leftDoor} position={[-2.47, 1.9, 6.2]} material={velvet}><boxGeometry args={[1.6, 3.8, 0.15]} /></mesh>
      <mesh ref={rightDoor} position={[2.47, 1.9, 6.2]} material={velvet}><boxGeometry args={[1.6, 3.8, 0.15]} /></mesh>
      {projectFilm !== null && <Label title={PROJECT_FILMS[projectFilm].label} sub="Vai trò: chưa có thông tin xác minh" color="#ffb070" position={[0, 5.6, -5.3]} scale={0.65} fadeNear={1} fadeFar={28} />}
      {/* màn hình + rèm */}
      <mesh position={[0, 2.95, -5.98]}>
        <planeGeometry args={[8.3, 3.64]} />
        <meshBasicMaterial map={screenTex.tex} toneMapped={false} />
      </mesh>
      <mesh position={[0, 2.95, -6.03]} material={mats.lacquer}>
        <boxGeometry args={[8.6, 3.9, 0.1]} />
      </mesh>
      {[-1, 1].map((s) =>
        [0, 1, 2, 3].map((i) => (
          <mesh key={s + '-' + i} position={[s * (4.55 + i * 0.22), 2.8, -5.7]} material={velvet} scale={[1, 1, 0.55]}>
            <cylinderGeometry args={[0.2, 0.2, 5.2, 12]} />
          </mesh>
        )),
      )}
      <mesh position={[0, 5.3, -5.65]} material={velvet}>
        <boxGeometry args={[10.2, 0.7, 0.6]} />
      </mesh>

      {/* máy chiếu */}
      <mesh position={[0, 4.9, 4.9]} geometry={rbox(0.9, 0.55, 1.0, 0.1)} material={mats.darkMetal} />
      <mesh position={[0, 4.9, 4.35]} rotation={[Math.PI / 2, 0, 0]} material={mats.silver}>
        <cylinderGeometry args={[0.17, 0.2, 0.3, 16]} />
      </mesh>
      <mesh position={[0, 4.9, 4.2]} rotation={[-Math.PI / 2 - 0.19, 0, 0]} geometry={beamGeo} material={beamMat} />

      {/* ghế */}
      {[-1.0, 1.3, 3.6].map((z) =>
        [-3.7, -2.5, 2.5, 3.7].map((x) => (
          <group key={x + '-' + z} position={[x, 0, z]}>
            <mesh position={[0, 0.3, 0]} geometry={rbox(0.95, 0.5, 0.95, 0.12)} material={velvet} />
            <mesh position={[0, 0.98, 0.4]} rotation={[0.14, 0, 0]} geometry={rbox(0.95, 1.1, 0.24, 0.1)} material={velvet} />
            {[-0.5, 0.5].map((a) => (
              <mesh key={a} position={[a, 0.6, 0.05]} geometry={rbox(0.12, 0.3, 0.8, 0.04)} material={mats.darkMetal} />
            ))}
          </group>
        )),
      )}
      {[-1.5, 1.5].map((x) => (
        <mesh key={x} position={[x, 0.045, 0.6]} material={warm}>
          <boxGeometry args={[0.06, 0.02, 10]} />
        </mesh>
      ))}

      {/* marquee */}
      <group position={[0, 4.75, 6.5]}>
        <mesh geometry={rbox(9.6, 1.8, 0.3, 0.1)} material={mats.darkMetal} />
        <mesh position={[0, 0, 0.17]}>
          <planeGeometry args={[8.7, 1.62]} />
          <meshBasicMaterial map={marquee} toneMapped={false} />
        </mesh>
        <instancedMesh ref={bulbs} args={[undefined, undefined, bulbPos.length]} position={[0, 0, 0.24]} frustumCulled={false}>
          <sphereGeometry args={[0.07, 10, 8]} />
          <meshBasicMaterial toneMapped={false} />
        </instancedMesh>
      </group>

      {/* poster */}
      {posters.map((tex, i) => (
        <group key={i} position={[-4.5 + i * 1.35, 2.3, 6.5]}>
          <mesh material={mats.darkMetal}>
            <boxGeometry args={[1.12, 1.62, 0.08]} />
          </mesh>
          <mesh position={[0, 0, 0.05]}>
            <planeGeometry args={[1.0, 1.5]} />
            <meshBasicMaterial map={tex} toneMapped={false} />
          </mesh>
          {i === 0 && <CinemaTeaser />}
        </group>
      ))}

      <pointLight position={[0, 4.2, 0]} color="#ffb98a" intensity={projectFilm === null ? 22 : 0} distance={13} decay={2} />
      <pointLight ref={roomLight} position={[0, 2.8, -4.2]} color="#ffffff" intensity={projectFilm === null ? 55 : 5} distance={13} decay={2} />
      <pointLight position={[0, 4, 9]} color="#ff4d4d" intensity={90} distance={14} decay={2} />

      <Hit id="cinema-screen" label="Mini Cinema · Màn hình" hint="Đổi phim" panel="cinema" maxDist={40} size={[8.4, 3.8, 0.3]} position={[0, 2.95, -5.8]} onClick={next} />
      <Hit id="cinema-project-link" label="Phim dự án" hint="Mở video trên Drive" maxDist={35}
        size={[2.4, 1.2, 0.5]} position={[-3.4, 2.3, 6.5]}
        onClick={() => openExternal(`https://drive.google.com/file/d/${PROJECT_FILMS[projectFilm ?? 0].id}/view`)} />
      <Hit id="cinema-sign" label="Mini Cinema" hint="Chọn phim dự án" panel="cinema" maxDist={40} size={[9.4, 1.8, 0.6]} position={[0, 4.75, 6.5]} onClick={next} />
    </group>
  )
}

