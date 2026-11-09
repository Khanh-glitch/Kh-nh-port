// ORBITA · Reality Rewrite — hai tờ sheet nhạc, vùng ánh sáng vàng quanh đàn, và biểu tượng thu hồi trên piano.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { canvasTex, FONT } from '../gfx'
import { Hit } from '../scene/Hit'
import { Label } from '../scene/Label'
import { player } from '../world'
import { pianoLocal, CENTER } from './site'
import { TRACK_LIST, type TrackDef } from './tracks'
import { dismissReality, requestReality, rt, useReality } from './state'
import { music } from './music'
import { NOISE_GLSL, WU } from './kit'

const SLOT = [
  { x: -2.9, z: 5.2 },
  { x: 2.9, z: 5.2 },
]

function paperTexture(tr: TrackDef) {
  const W = 512
  const H = 720
  return canvasTex(W, H, (c) => {
    c.fillStyle = '#f2e8d2'
    c.fillRect(0, 0, W, H)
    for (let i = 0; i < 900; i++) {
      c.fillStyle = `rgba(120,90,50,${Math.random() * 0.04})`
      c.fillRect(Math.random() * W, Math.random() * H, 30, 2)
    }
    c.fillStyle = '#2a2018'
    c.textAlign = 'center'
    c.font = `700 44px ${FONT}`
    c.fillText(tr.title, W / 2, 96)
    c.font = `500 20px ${FONT}`
    c.fillStyle = '#6b5a44'
    c.fillText(tr.role, W / 2, 132)
    c.strokeStyle = '#3b2e22'
    c.lineWidth = 1.4
    let seed = tr.index * 17 + 3
    const r = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
    for (let s = 0; s < 6; s++) {
      const y0 = 190 + s * 82
      for (let l = 0; l < 5; l++) {
        c.beginPath()
        c.moveTo(44, y0 + l * 9)
        c.lineTo(W - 44, y0 + l * 9)
        c.stroke()
      }
      c.fillStyle = '#2a2018'
      c.font = `700 52px serif`
      c.textAlign = 'left'
      c.fillText('𝄞', 48, y0 + 36)
      for (let n = 0; n < 9; n++) {
        const x = 110 + n * 44 + r() * 8
        const y = y0 + Math.floor(r() * 7) * 4.5 - 3
        c.beginPath()
        c.ellipse(x, y + 18, 6.5, 5, -0.4, 0, Math.PI * 2)
        c.fill()
        c.fillRect(x + 5, y - 12, 1.6, 30)
      }
    }
    c.fillStyle = tr.accent
    c.beginPath()
    c.arc(W - 70, H - 64, 24, 0, Math.PI * 2)
    c.fill()
    c.textAlign = 'center'
    c.fillStyle = '#2a2018'
    c.font = `600 15px ${FONT}`
    c.fillText('HIGHLIGHT', 70, H - 58)
  }).tex
}

const sheetVS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }'
const sheetFS = /* glsl */ `
uniform sampler2D uTex; uniform float uBurn; uniform float uNear; uniform float uT; uniform vec3 uAcc; varying vec2 vUv;
${NOISE_GLSL}
void main(){
  float n = fbm(vUv * 7.0 + 3.0) * 0.85 + (1.0 - vUv.y) * 0.15;
  float thr = uBurn * 1.18 - 0.08;
  float d = n - thr;
  if (d < 0.0) discard;
  vec3 paper = texture2D(uTex, vUv).rgb;
  vec2 e = abs(vUv - 0.5) * 2.0;
  vec3 col = paper * (0.78 + uNear * 0.55);
  col += uAcc * smoothstep(0.88, 1.0, max(e.x, e.y)) * uNear * 1.8;
  float band = 1.0 - smoothstep(0.0, 0.07, d);
  float char_ = 1.0 - smoothstep(0.0, 0.16, d);
  col = mix(col, vec3(0.05, 0.03, 0.02), char_ * step(0.001, uBurn));
  col += vec3(1.0, 0.55, 0.12) * band * 5.0 * step(0.001, uBurn);
  gl_FragColor = vec4(col, 1.0);
}`

function Sheet({ tr, slot }: { tr: TrackDef; slot: { x: number; z: number } }) {
  const g = useRef<THREE.Group>(null)
  const burn = useRef(0)
  const near = useRef(0)
  const tex = useMemo(() => paperTexture(tr), [tr])
  const mat = useMemo(
    () => new THREE.ShaderMaterial({ vertexShader: sheetVS, fragmentShader: sheetFS, uniforms: { uTex: { value: tex }, uBurn: { value: 0 }, uNear: { value: 0 }, uT: WU.uTime, uAcc: { value: new THREE.Color(tr.accent) } }, side: THREE.DoubleSide, toneMapped: false }),
    [tex, tr.accent],
  )
  const base = useMemo(() => pianoLocal(slot.x, 0, slot.z), [slot])
  const glow = useRef<THREE.Mesh>(null)
  const glowMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uK: { value: 0 }, uAcc: { value: new THREE.Color(tr.accent) } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: 'uniform float uK; uniform vec3 uAcc; varying vec2 vUv; void main(){ float d = length(vUv - 0.5) * 2.0; float a = (1.0 - smoothstep(0.0, 1.0, d)); a = a * a * uK; float ring = smoothstep(0.04, 0.0, abs(d - 0.78)) * uK; gl_FragColor = vec4(uAcc * (a * 1.6 + ring * 2.4), a * 0.8 + ring); }',
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [tr.accent],
  )
  const phase = useReality((s) => s.phase)
  const track = useReality((s) => s.track)
  const idx = tr.index

  useFrame((s, dt) => {
    const st = useReality.getState()
    const grp = g.current
    if (!grp) return
    const t = s.clock.elapsedTime
    // mức "đến gần" (đã làm mượt ở host) -> sheet bay lên
    near.current += (rt.presence - near.current) * (1 - Math.exp(-dt * 2.6))
    const k = near.current
    const e = k * k * (3 - 2 * k)
    const mine = st.track === tr.id
    let target = 0
    if (mine && st.phase === 'ignite') target = rt.ignite
    else if (mine && (st.phase === 'sweep' || st.phase === 'active')) target = 1
    else if (mine && st.phase === 'retract') target = rt.front > 30 ? 1 : 0
    if (st.phase === 'ignite' && mine) burn.current = target
    else burn.current += (target - burn.current) * (1 - Math.exp(-dt * (target > burn.current ? 6 : 1.4)))
    mat.uniforms.uBurn.value = burn.current > 0.003 ? Math.min(burn.current, 0.999) : 0
    mat.uniforms.uNear.value = e
    const bob = Math.sin(t * 1.3 + idx * 2) * 0.09 * e
    grp.position.set(base.x, 0.05 + e * 1.55 + bob, base.z)
    const yaw = Math.atan2(s.camera.position.x - base.x, s.camera.position.z - base.z)
    grp.rotation.set(0, 0, 0)
    grp.rotation.order = 'YXZ'
    grp.rotation.y = yaw * e + (1 - e) * (idx ? 0.5 : -0.4)
    grp.rotation.x = -Math.PI / 2 * (1 - e) - 0.1 * e + Math.sin(t * 0.9 + idx) * 0.05 * e
    grp.visible = burn.current < 0.999
    if (glow.current) {
      glowMat.uniforms.uK.value = 0.25 + e * 0.9 + (mine ? 0.4 * (1 - burn.current) : 0) + music.kick * 0.15 * e
      glow.current.visible = true
    }
  })
  const interactive = phase === 'idle' || phase === 'active' || phase === 'sweep'
  return (
    <>
      <mesh ref={glow} position={[base.x, 0.07, base.z]} rotation={[-Math.PI / 2, 0, 0]} material={glowMat} renderOrder={4}>
        <planeGeometry args={[3.6, 3.6]} />
      </mesh>
      <group ref={g}>
        <mesh material={mat}>
          <planeGeometry args={[1.3, 1.82, 12, 16]} />
        </mesh>
        {interactive && track !== tr.id && (
          <Hit
            id={`sheet-${tr.id}`}
            label={`Sheet · ${tr.title}`}
            hint={phase === 'idle' ? 'Nhấn / E — bốc cháy & triệu hồi thực tại' : 'Nhấn / E — chuyển sang bài này'}
            maxDist={16}
            onClick={() => requestReality(tr.id)}
            size={[1.7, 2.2, 0.3]}
          />
        )}
      </group>
    </>
  )
}

// ---------------------------------------------------------------- vùng ánh sáng vàng quanh đàn
function GoldZone() {
  const mesh = useRef<THREE.Mesh>(null)
  const pts = useRef<THREE.Points>(null)
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uK: { value: 0 }, uT: WU.uTime, uMus: WU.uMus },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: `uniform float uK; uniform float uT; uniform vec4 uMus; varying vec2 vUv;
          void main(){
            vec2 p = (vUv - 0.5) * 2.0; float d = length(p);
            vec2 q = p * 5.5; vec2 r = vec2(1.0, 1.7320508);
            vec2 a = mod(q, r) - r*0.5; vec2 b = mod(q - r*0.5, r) - r*0.5; vec2 gv = dot(a,a) < dot(b,b) ? a : b;
            vec2 gg = abs(gv); float hd = max(dot(gg, vec2(0.5,0.8660254)), gg.x);
            float line = smoothstep(0.44, 0.5, hd);
            float wave = 0.5 + 0.5 * sin(d * 18.0 - uT * 2.5);
            float edge = smoothstep(1.0, 0.82, d);
            float ring = smoothstep(0.03, 0.0, abs(d - 0.94)) * 2.0;
            float a0 = (line * (0.3 + wave * 0.5) * edge + (1.0 - d) * 0.22 + ring) * uK;
            gl_FragColor = vec4(vec3(1.0, 0.72, 0.28) * a0 * (1.4 + uMus.x * 2.0), a0 * 0.7);
          }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [],
  )
  const motes = useMemo(() => {
    const n = 70
    const g = new THREE.BufferGeometry()
    const a = new Float32Array(n * 4)
    for (let i = 0; i < n; i++) {
      const r = Math.sqrt(Math.random()) * 7
      const t = Math.random() * 6.283
      a[i * 4] = Math.cos(t) * r
      a[i * 4 + 1] = Math.random()
      a[i * 4 + 2] = Math.sin(t) * r
      a[i * 4 + 3] = 0.5 + Math.random()
    }
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
    g.setAttribute('aS', new THREE.BufferAttribute(a, 4))
    const m = new THREE.ShaderMaterial({
      uniforms: { uK: { value: 0 }, uT: WU.uTime },
      vertexShader: `attribute vec4 aS; uniform float uK; uniform float uT; varying float vA;
        void main(){ float t = fract(aS.y + uT * 0.07 * aS.w); vec3 p = vec3(aS.x + sin(uT * 0.7 + aS.w * 9.0) * 0.5, 0.2 + t * 9.0, aS.z + cos(uT * 0.6 + aS.w * 7.0) * 0.5);
          vA = sin(t * 3.14159) * uK; vec4 mv = viewMatrix * vec4(p, 1.0); gl_PointSize = clamp(7.0 * aS.w * 40.0 / -mv.z, 1.0, 24.0); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: 'varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; float k = pow(smoothstep(0.5, 0.0, d), 1.5); gl_FragColor = vec4(vec3(1.0,0.78,0.36) * 2.6 * k * vA, k * vA); }',
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })
    return { g, m }
  }, [])
  useFrame(() => {
    const k = rt.presence
    mat.uniforms.uK.value = k
    motes.m.uniforms.uK.value = k
    if (mesh.current) mesh.current.visible = k > 0.01
    if (pts.current) pts.current.visible = k > 0.01
  })
  return (
    <group position={[CENTER.x, 0, CENTER.z]}>
      <mesh ref={mesh} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.09, 0]} material={mat} renderOrder={3}>
        <planeGeometry args={[15, 15]} />
      </mesh>
      <points ref={pts} geometry={motes.g} material={motes.m} frustumCulled={false} />
    </group>
  )
}

// ---------------------------------------------------------------- biểu tượng thu hồi nổi trên piano
function Sigil() {
  const phase = useReality((s) => s.phase)
  const ref = useRef<THREE.Group>(null)
  const p = useMemo(() => pianoLocal(0, 6.7, 1.2), [])
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc766').multiplyScalar(2.2), toneMapped: false, wireframe: false }), [])
  useFrame((s) => {
    if (ref.current) {
      ref.current.rotation.y = s.clock.elapsedTime * 0.8
      ref.current.scale.setScalar(1 + music.kick * 0.12)
    }
  })
  const on = phase === 'active' || phase === 'sweep'
  if (!on) return null
  return (
    <group position={[p.x, p.y, p.z]}>
      <group ref={ref}>
        <mesh material={mat}>
          <torusGeometry args={[0.55, 0.05, 8, 6]} />
        </mesh>
        <mesh material={mat} rotation={[0, 0, Math.PI / 6]}>
          <torusGeometry args={[0.36, 0.03, 8, 6]} />
        </mesh>
        <mesh material={mat}>
          <octahedronGeometry args={[0.13, 0]} />
        </mesh>
      </group>
      <Label title="Thu hồi thực tại" sub="Về lại vũ trụ ORBITA" color="#ffd27a" position={[0, 1.15, 0]} scale={0.9} fadeNear={1} />
      <Hit id="piano-reality-recall" label="Piano · Thu hồi thực tại" hint="Nhấn / E — trường biến đổi thu hồi" maxDist={40} onClick={() => dismissReality()} shape="sphere" size={[1.0, 1, 1]} />
    </group>
  )
}

export function Sheets() {
  useEffect(() => {
    void player
  }, [])
  return (
    <group userData={{ rwKeep: true }}>
      <GoldZone />
      {TRACK_LIST.map((tr) => (
        <Sheet key={tr.id} tr={tr} slot={SLOT[tr.index]} />
      ))}
      <Sigil />
    </group>
  )
}
