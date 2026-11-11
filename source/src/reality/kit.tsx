// ORBITA · Reality Rewrite — bộ dựng dùng chung cho các thực tại (bầu trời, đáy đảo, bụi nắng/đèn trời, khung ký ức).
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { patchNew, RW } from './mask'
import { music } from './music'
import { TRACKS, probeMedia, type TrackId } from './tracks'
import { useReality } from './state'

export const WU = {
  uMus: { value: new THREE.Vector4() },
  uProg: { value: 0 },
  uEnergy: { value: 0.3 },
  uTime: { value: 0 },
}

export const NOISE_GLSL = /* glsl */ `
float nh(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(nh(i), nh(i+vec2(1,0)), f.x), mix(nh(i+vec2(0,1)), nh(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * vn(p); p = p * 2.03 + 11.7; a *= 0.5; } return s; }
`

// ------------------------------------------------------------------ bầu trời UEH (chuyển mượt giữa mưa bóng mây dịu dàng & nắng gió chiều hoa phượng)
const skyVS = 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w * 0.9999; }'
const skyUEH = /* glsl */ `
uniform vec4 uMus; uniform float uEnergy; uniform float uTime; varying vec3 vD;
${NOISE_GLSL}
void main(){
  vec3 d = normalize(vD);
  vec3 sunDir = normalize(vec3(-0.55, 0.16, -0.82));
  float h = d.y;
  float rain = uRWenv.x;
  vec3 zen = mix(vec3(0.14, 0.33, 0.54), vec3(0.24, 0.34, 0.46), rain);
  vec3 mid = mix(vec3(0.86, 0.57, 0.42), vec3(0.56, 0.58, 0.65), rain);
  vec3 hor = mix(vec3(0.98, 0.78, 0.55), vec3(0.76, 0.72, 0.68), rain);
  vec3 col = mix(hor, mid, smoothstep(0.0, 0.24, h));
  col = mix(col, zen, smoothstep(0.16, 0.78, h));
  col = mix(col, mix(vec3(0.24, 0.16, 0.14), vec3(0.20, 0.23, 0.28), rain), smoothstep(0.0, -0.35, h));
  float sd = max(dot(d, sunDir), 0.0);
  float glow = (pow(sd, 5.0) * 0.48 + pow(sd, 36.0) * 0.95) * (1.0 - rain * 0.58)
             + pow(sd, 650.0) * (10.0 + uMus.x * 4.0) * (1.0 - rain * 0.88);
  col += mix(vec3(1.0, 0.72, 0.36), vec3(1.0, 0.84, 0.68), rain) * glow * (0.85 + uEnergy * 0.35);
  if (h > 0.0) {
    vec2 uv = d.xz / (h + 0.28) * 1.4 + vec2(uTime * (0.008 + rain * 0.008), 0.0);
    float c = fbm(uv * vec2(1.0, 2.4));
    float c2 = fbm(uv * 3.2 + 4.0);
    float m = smoothstep(mix(0.50, 0.32, rain), mix(0.84, 0.74, rain), c * 0.88 + c2 * 0.26) * smoothstep(0.0, 0.16, h);
    vec3 warmCloud = mix(vec3(0.96, 0.58, 0.42), vec3(1.0, 0.92, 0.76), smoothstep(0.45, 0.85, c2) + sd * 0.65);
    vec3 rainCloud = mix(vec3(0.44, 0.49, 0.58), vec3(0.76, 0.78, 0.82), smoothstep(0.42, 0.82, c2) + sd * 0.4);
    vec3 cc = mix(warmCloud, rainCloud, rain);
    col = mix(col, cc * (1.02 + sd * 0.8 * (1.0 - rain * 0.5)), m * (0.74 + rain * 0.14));
  }
  gl_FragColor = vec4(col, 1.0);
}`
const skyTomorrow = /* glsl */ `
uniform vec4 uMus; uniform float uEnergy; uniform float uTime; uniform float uProg; varying vec3 vD;
${NOISE_GLSL}
void main(){
  vec3 d = normalize(vD);
  float h = d.y;
  float dawn = smoothstep(0.52, 0.95, uProg);
  float pre = smoothstep(0.28, 0.58, uProg);
  vec3 zen = mix(vec3(0.015, 0.025, 0.075), vec3(0.08, 0.14, 0.34), pre);
  zen = mix(zen, vec3(0.18, 0.28, 0.54), dawn);
  vec3 hor = mix(vec3(0.05, 0.08, 0.19), vec3(0.38, 0.24, 0.36), pre);
  hor = mix(hor, vec3(0.98, 0.58, 0.36), dawn);
  vec3 col = mix(hor, zen, smoothstep(0.0, 0.58, h));
  col = mix(col, hor * 0.28, smoothstep(0.0, -0.35, h));
  vec3 sunDir = normalize(vec3(0.0, mix(-0.18, 0.10, dawn), -1.0));
  float sd = max(dot(d, sunDir), 0.0);
  col += vec3(1.0, 0.70, 0.38) * (pow(sd, 12.0) * 0.55 + pow(sd, 140.0) * 1.6 + pow(sd, 1600.0) * 20.0) * dawn;
  vec3 moonDir = normalize(vec3(0.55, 0.38, 0.6));
  float md = max(dot(d, moonDir), 0.0);
  col += vec3(0.75, 0.85, 1.0) * (pow(md, 1100.0) * 7.0 + pow(md, 40.0) * 0.09) * (1.0 - dawn);
  vec2 sp = d.xz / (abs(h) + 0.4) * 90.0;
  float st = step(0.988, nh(floor(sp))) * smoothstep(0.02, 0.25, h) * (0.5 + 0.5 * sin(uTime * 2.5 + nh(floor(sp)) * 40.0));
  col += vec3(0.82, 0.9, 1.0) * st * 1.1 * (1.0 - dawn);
  gl_FragColor = vec4(col, 1.0);
}`

export function SkyDome({ world }: { world: 'ueh' | 'tomorrow' }) {
  const ref = useRef<THREE.Mesh>(null)
  const mat = useMemo(() => {
    const m = new THREE.ShaderMaterial({
      vertexShader: skyVS,
      fragmentShader: world === 'ueh' ? skyUEH : skyTomorrow,
      uniforms: { uMus: WU.uMus, uEnergy: WU.uEnergy, uTime: WU.uTime, uProg: WU.uProg, uRWenv: RW.uRWenv },
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
    })
    patchNew(m, { grow: false, haze: false, ao: false })
    return m
  }, [world])
  useFrame(({ camera }) => {
    ref.current?.position.copy(camera.position)
  })
  return (
    <mesh ref={ref} material={mat} renderOrder={-30} frustumCulled={false}>
      <sphereGeometry args={[3000, 48, 24]} />
    </mesh>
  )
}

// ------------------------------------------------------------------ đáy đảo đá & rễ (chất liệu đất đá thực)
export function Underside({ palette }: { palette: 'ueh' | 'tomorrow' }) {
  const low = useStore((s) => s.quality) === 'low'
  const { body, roots } = useMemo(() => {
    const pts: THREE.Vector2[] = []
    const prof: [number, number][] = [[59.6, 0], [60, -0.6], [59, -2.2], [52, -6.5], [42, -11.5], [31, -17.5], [20, -23.5], [9, -29.5], [2, -34], [0, -36]]
    prof.forEach(([r, y]) => pts.push(new THREE.Vector2(r, y)))
    const g = new THREE.LatheGeometry(pts, 96, 0, Math.PI * 2)
    const p = g.attributes.position
    const col: number[] = []
    const c = new THREE.Color()
    const c1 = new THREE.Color(palette === 'ueh' ? '#4a382b' : '#0b1222')
    const c2 = new THREE.Color(palette === 'ueh' ? '#7a5d47' : '#16243d')
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i)
      const y = p.getY(i)
      const z = p.getZ(i)
      const a = Math.atan2(z, x)
      const k = y < -1 ? 1 : 0
      const n = (Math.sin(a * 7 + y * 0.6) + Math.sin(a * 13 - y * 0.9) * 0.6 + Math.sin(a * 3 + y * 0.3)) * 0.9 * k
      const s = 1 + n * 0.032
      p.setXYZ(i, x * s, y + n * 0.5, z * s)
      c.copy(c1).lerp(c2, 0.5 + Math.sin(a * 5 + y * 0.4) * 0.35 + (y > -4 ? 0.2 : 0))
      col.push(c.r, c.g, c.b)
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
    g.computeVertexNormals()
    const N = low ? 75 : 130
    const rg = new THREE.CylinderGeometry(0.03, 0.2, 1, 5, 1)
    rg.translate(0, -0.5, 0)
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    const arr: THREE.Matrix4[] = []
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + Math.random() * 0.08
      const yy = -Math.random() * 14
      const r = 59.5 - Math.pow(Math.max(0, -yy) / 14, 0.9) * 14 + Math.random() * 1.2
      const len = 3 + Math.random() * 13
      e.set((Math.random() - 0.5) * 0.25, 0, (Math.random() - 0.5) * 0.25)
      q.setFromEuler(e)
      m.compose(new THREE.Vector3(Math.cos(a) * r, yy, Math.sin(a) * r), q, new THREE.Vector3(0.45 + Math.random() * 1.4, len, 0.45 + Math.random() * 1.4))
      arr.push(m.clone())
    }
    return { body: g, roots: { geo: rg, mats: arr } }
  }, [low, palette])

  const bodyMat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: palette === 'ueh' ? 0.92 : 0.45,
      metalness: palette === 'ueh' ? 0.04 : 0.4,
    })
    return patchNew(m, { grow: false, ao: false })
  }, [palette])
  const rootMat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({
      color: palette === 'ueh' ? '#5e4432' : '#1b2b4a',
      roughness: 0.9,
      metalness: palette === 'ueh' ? 0.05 : 0.35,
    })
    return patchNew(m, { grow: true, growLen: 24, ao: false })
  }, [palette])
  const inst = useRef<THREE.InstancedMesh>(null)
  useEffect(() => {
    const im = inst.current
    if (!im) return
    roots.mats.forEach((mm, i) => im.setMatrixAt(i, mm))
    im.instanceMatrix.needsUpdate = true
  }, [roots])
  return (
    <group>
      <mesh geometry={body} material={bodyMat} />
      <instancedMesh ref={inst} args={[roots.geo, rootMat, roots.mats.length]} frustumCulled={false} />
    </group>
  )
}

// ------------------------------------------------------------------ bụi nắng chiều / đèn lồng tinh tế (size nhỏ, có chiều sâu)
export function Drift({ mode, count, colA, colB, size = 1, mirror = false }: { mode: 'fall' | 'rise'; count: number; colA: string; colB: string; size?: number; mirror?: boolean }) {
  const low = useStore((s) => s.quality) === 'low'
  const n = Math.round(count * (low ? 0.55 : 1))
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const a = new Float32Array(n * 4)
    for (let i = 0; i < n; i++) {
      const r = 4 + Math.sqrt(Math.random()) * 68
      const t = Math.random() * Math.PI * 2
      a[i * 4] = Math.cos(t) * r
      a[i * 4 + 1] = Math.random()
      a[i * 4 + 2] = Math.sin(t) * r
      a[i * 4 + 3] = Math.random()
    }
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
    g.setAttribute('aS', new THREE.BufferAttribute(a, 4))
    return g
  }, [n])
  const mat = useMemo(() => {
    const m = new THREE.ShaderMaterial({
      uniforms: {
        uTime: WU.uTime,
        uMus: WU.uMus,
        uA: { value: new THREE.Color(colA) },
        uB: { value: new THREE.Color(colB) },
        uRise: { value: mode === 'rise' ? 1 : 0 },
        uSize: { value: size },
        uMir: { value: mirror ? 1 : 0 },
      },
      vertexShader: `
        attribute vec4 aS; uniform float uTime; uniform vec4 uMus; uniform float uRise; uniform float uSize; uniform float uMir;
        varying float vA; varying float vK;
        void main(){
          float sp = 0.4 + aS.w * 0.7;
          float H = 40.0;
          float t = fract(aS.y + uTime * 0.01 * sp * (uRise > 0.5 ? 1.0 : -1.0) * 3.0);
          float y = 0.8 + t * H;
          float sway = sin(uTime * 0.45 * sp + aS.w * 40.0) * 1.4;
          vec3 p = vec3(aS.x + sway, y, aS.z + cos(uTime * 0.35 * sp + aS.w * 30.0) * 1.4);
          if (uMir > 0.5) p.y = -p.y - 0.12;
          vA = smoothstep(0.0, 0.14, t) * (1.0 - smoothstep(0.75, 1.0, t)) * (uMir > 0.5 ? 0.25 : 0.72);
          vK = aS.w;
          vec4 mv = viewMatrix * vec4(p, 1.0);
          float dFade = smoothstep(4.0, 12.0, -mv.z);
          vA *= dFade;
          gl_PointSize = clamp((uRise > 0.5 ? 3.2 : 2.5) * uSize * (0.5 + aS.w) * (1.0 + uMus.x * 0.4) * 55.0 / -mv.z, 1.0, 13.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 uA; uniform vec3 uB; varying float vA; varying float vK;
        void main(){
          vec2 q = gl_PointCoord - 0.5;
          float d = length(q);
          if (d > 0.5) discard;
          float k = pow(smoothstep(0.5, 0.0, d), 2.0);
          vec3 c = mix(uA, uB, vK) * 1.65;
          gl_FragColor = vec4(c * k * vA, k * vA);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })
    patchNew(m, { grow: false, haze: false, ao: false })
    return m
  }, [colA, colB, mode, size, mirror])
  return <points geometry={geo} material={mat} frustumCulled={false} renderOrder={5} />
}

// ------------------------------------------------------------------ khung ký ức (video hòa vào không gian)
class Reel {
  canvas = document.createElement('canvas')
  tex: THREE.Texture
  private demoTexture: THREE.CanvasTexture
  private useGeneration = 0
  video: HTMLVideoElement | null = null
  demo = true
  private ctx: CanvasRenderingContext2D
  private acc = 0
  constructor() {
    this.canvas.width = 640
    this.canvas.height = 360
    this.ctx = this.canvas.getContext('2d')!
    this.demoTexture = new THREE.CanvasTexture(this.canvas)
    this.demoTexture.colorSpace = THREE.SRGBColorSpace
    this.tex = this.demoTexture
  }
  async use(id: TrackId) {
    const generation = ++this.useGeneration
    const tr = TRACKS[id]
    this.video?.pause()
    this.video = null
    this.demo = true
    if (tr.videoSrc && (await probeMedia(tr.videoSrc, 'video'))) {
      if (generation !== this.useGeneration) return
      const v = document.createElement('video')
      v.src = tr.videoSrc
      v.muted = true
      v.loop = true
      v.playsInline = true
      v.crossOrigin = 'anonymous'
      v.currentTime = tr.highlight.start
      await v.play().catch(() => {})
      if (generation !== this.useGeneration) { v.pause(); return }
      const vt = new THREE.VideoTexture(v)
      vt.colorSpace = THREE.SRGBColorSpace
      this.tex = vt
      this.video = v
      this.demo = false
    } else if (generation === this.useGeneration) {
      // Keep the SAME full-resolution 640x360 GPU canvas texture across
      // track changes and repeated HEX summon/retract. Recreating it could
      // upload a blank new texture while an in-flight screen still samples
      // the old one. Existing 20fps procedural imagery is unchanged.
      this.tex = this.demoTexture
      this.demoTexture.needsUpdate = true
    }
  }
  stop() {
    this.video?.pause()
  }
  draw(dt: number, t: number, id: TrackId) {
    if (this.video) return
    this.acc += dt
    if (this.acc < 1 / 20) return
    this.acc = 0
    const c = this.ctx
    const W = 640
    const H = 360
    const ueh = id === 'mua-ha'
    const g = c.createLinearGradient(0, 0, W, H)
    const ph = (Math.sin(t * 0.2) + 1) / 2
    if (ueh) {
      g.addColorStop(0, `hsl(${22 + ph * 16},75%,${42 + ph * 8}%)`)
      g.addColorStop(1, `hsl(${184 + ph * 14},68%,20%)`)
    } else {
      g.addColorStop(0, `hsl(${220 + ph * 18},62%,12%)`)
      g.addColorStop(1, `hsl(${24 + ph * 16},78%,${34 + ph * 20}%)`)
    }
    c.fillStyle = g
    c.fillRect(0, 0, W, H)
    c.globalCompositeOperation = 'lighter'
    for (let i = 0; i < 20; i++) {
      const x = ((Math.sin(i * 12.9 + t * 0.14 * (0.4 + (i % 5) * 0.2)) + 1) / 2) * W
      const y = ((Math.cos(i * 7.7 + t * 0.11 * (0.5 + (i % 3) * 0.3)) + 1) / 2) * H
      const r = 20 + (i % 7) * 12 + music.kick * 12
      const rg = c.createRadialGradient(x, y, 0, x, y, r)
      const a = 0.14 + (i % 4) * 0.04
      rg.addColorStop(0, ueh ? `rgba(255,${190 + (i % 3) * 20},120,${a})` : `rgba(${150 + (i % 3) * 30},200,255,${a})`)
      rg.addColorStop(1, 'rgba(0,0,0,0)')
      c.fillStyle = rg
      c.fillRect(x - r, y - r, r * 2, r * 2)
    }
    c.globalCompositeOperation = 'source-over'
    c.fillStyle = 'rgba(255,255,255,0.52)'
    c.font = '600 14px Inter, sans-serif'
    c.fillText('DEMO REEL — chưa phải video thật', 14, H - 14)
    this.tex.needsUpdate = true
  }
}
export const reel = new Reel()

export function MemoryFrames({ id, accent }: { id: TrackId; accent: string }) {
  const low = useStore((s) => s.quality) === 'low'
  const groupRef = useRef<THREE.Group>(null)
  const N = low ? 6 : 8
  const mats = useMemo(() => {
    return Array.from({ length: N }, (_, i) => {
      const m = new THREE.ShaderMaterial({
        uniforms: {
          uTex: { value: reel.tex },
          uT: WU.uTime,
          uMus: WU.uMus,
          uEnergy: WU.uEnergy,
          uAcc: { value: new THREE.Color('#ffb44a') },
          uOff: { value: new THREE.Vector4((i * 0.37) % 0.6, (i * 0.23) % 0.5, 0.4 + (i % 3) * 0.1, 0.4 + (i % 4) * 0.08) },
        },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: `
          uniform sampler2D uTex; uniform float uT; uniform vec4 uMus; uniform float uEnergy; uniform vec3 uAcc; uniform vec4 uOff; varying vec2 vUv;
          void main(){
            vec2 uv = uOff.xy + vUv * uOff.zw + vec2(sin(uT * 0.05 + uOff.x * 9.0) * 0.02, 0.0);
            vec3 c = texture2D(uTex, uv).rgb;
            vec2 e = abs(vUv - 0.5) * 2.0;
            float border = smoothstep(0.96, 1.0, max(e.x, e.y));
            float vig = 1.0 - smoothstep(0.35, 1.05, length(e));
            vec3 col = c * (0.75 + uEnergy * 0.55 + uMus.w * 0.25) * vig + uAcc * border * 0.9;
            float a = (0.28 + vig * 0.42) + border * 0.4;
            gl_FragColor = vec4(col, clamp(a, 0.0, 0.78));
          }`,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      })
      return patchNew(m, { grow: false, haze: false, ao: false }) as THREE.ShaderMaterial
    })
  }, [N])
  const plan = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => ({
        a: (i / N) * Math.PI * 2 + 0.35,
        r: 36 + (i % 2) * 8,
        y: 11 + (i % 3) * 3.5,
        w: 6.4 + (i % 2) * 1.4,
        ph: i * 1.4,
      })),
    [N],
  )
  const phase = useReality((s) => s.phase)
  useEffect(() => {
    mats.forEach((m) => m.uniforms.uAcc.value.set(accent))
    // RealityHost owns the single authoritative track request. The old
    // duplicate reel.use() here raced it on each ignite/switch.
    mats.forEach(m => { m.uniforms.uTex.value = reel.tex })
  }, [id, accent, mats])
  useFrame((s, dt) => {
    // Hidden idle frames do not need to upload a 640x360 texture 20 times/s.
    // The first active frame resumes the exact same procedural drawing.
    if (useReality.getState().phase !== 'idle') reel.draw(dt, s.clock.elapsedTime, id)
    for (const m of mats) {
      if (m.uniforms.uTex.value !== reel.tex) m.uniforms.uTex.value = reel.tex
    }
    const g = groupRef.current
    if (!g) return
    const live = music.playing
    g.children.forEach((c, i) => {
      const p = plan[i]
      const a = p.a + s.clock.elapsedTime * 0.008
      c.position.set(Math.cos(a) * p.r, p.y + Math.sin(s.clock.elapsedTime * 0.28 + p.ph) * 0.6, Math.sin(a) * p.r)
      c.lookAt(0, p.y * 0.7, 0)
      c.scale.setScalar(live ? 1 + music.kick * 0.025 : 1)
    })
  })
  return (
    <group ref={groupRef}>
      {plan.map((p, i) => (
        <mesh key={i} material={mats[i]} renderOrder={6} frustumCulled={false}>
          <planeGeometry args={[p.w, p.w * 0.5625]} />
        </mesh>
      ))}
    </group>
  )
}

export function useWorldUniforms() {
  const camPos = useThree((s) => s.camera.position)
  useFrame((s) => {
    WU.uTime.value = s.clock.elapsedTime
    WU.uMus.value.set(music.bass, music.mid, music.high, music.kick)
    WU.uProg.value = music.progress
    WU.uEnergy.value = music.energy
    RW.uRW.value.y = s.clock.elapsedTime
    void camPos
  })
}
