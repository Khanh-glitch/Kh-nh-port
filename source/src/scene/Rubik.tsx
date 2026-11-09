import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Sparkles } from '@react-three/drei'
import * as THREE from 'three'
import { EXHIBITS } from '../layout'
import { audio, type Bus } from '../audio'
import { toast } from '../store'
import { FONT, beamGeometry, beamMaterial, canvasTex, rbox, roundRect } from '../gfx'
import { Hit } from './Hit'
import { Label } from './Label'
import { PadRing, mats, useWorldColliders, worldPos } from './common'

const ex = EXHIBITS.rubik
const CUBE_Y = 4.7
const COLORS = { R: '#ff2a2a', L: '#ff8a00', U: '#f4f4f4', D: '#ffd400', F: '#00c853', B: '#1f66ff' }

type Axis = 'x' | 'y' | 'z'
interface Move {
  axis: Axis
  layer: number
  dir: 1 | -1
}
type Phase = 'idle' | 'scramble' | 'hold' | 'solve' | 'win'

function label(m: Move) {
  const L = { x: ['L', 'M', 'R'], y: ['D', 'E', 'U'], z: ['B', 'S', 'F'] }[m.axis][m.layer + 1]
  let cw: boolean
  if (m.layer === 1) cw = m.dir === -1
  else if (m.layer === -1) cw = m.dir === 1
  else cw = m.axis === 'z' ? m.dir === -1 : m.dir === 1
  return L + (cw ? '' : "'")
}

function buildCube() {
  const root = new THREE.Group()
  const cubies: THREE.Group[] = []
  const bodyGeo = rbox(0.95, 0.95, 0.95, 0.14, 4)
  const bodyMat = new THREE.MeshPhysicalMaterial({ color: '#07070a', roughness: 0.32, metalness: 0.25, clearcoat: 0.7, clearcoatRoughness: 0.2 })
  const s = new THREE.Shape()
  const h = 0.4
  const r = 0.1
  s.moveTo(-h + r, -h)
  s.lineTo(h - r, -h)
  s.quadraticCurveTo(h, -h, h, -h + r)
  s.lineTo(h, h - r)
  s.quadraticCurveTo(h, h, h - r, h)
  s.lineTo(-h + r, h)
  s.quadraticCurveTo(-h, h, -h, h - r)
  s.lineTo(-h, -h + r)
  s.quadraticCurveTo(-h, -h, -h + r, -h)
  const stickerGeo = new THREE.ShapeGeometry(s, 6)
  const stickerMats: Record<string, THREE.MeshStandardMaterial> = {}
  Object.entries(COLORS).forEach(([k, c]) => {
    stickerMats[k] = new THREE.MeshStandardMaterial({ color: c, roughness: 0.25, metalness: 0, emissive: c, emissiveIntensity: 0.3 })
  })
  const faces: { n: [number, number, number]; rot: [number, number, number]; k: keyof typeof COLORS }[] = [
    { n: [1, 0, 0], rot: [0, Math.PI / 2, 0], k: 'R' },
    { n: [-1, 0, 0], rot: [0, -Math.PI / 2, 0], k: 'L' },
    { n: [0, 1, 0], rot: [-Math.PI / 2, 0, 0], k: 'U' },
    { n: [0, -1, 0], rot: [Math.PI / 2, 0, 0], k: 'D' },
    { n: [0, 0, 1], rot: [0, 0, 0], k: 'F' },
    { n: [0, 0, -1], rot: [0, Math.PI, 0], k: 'B' },
  ]
  for (let x = -1; x <= 1; x++)
    for (let y = -1; y <= 1; y++)
      for (let z = -1; z <= 1; z++) {
        const g = new THREE.Group()
        g.position.set(x, y, z)
        const body = new THREE.Mesh(bodyGeo, bodyMat)
        body.castShadow = true
        g.add(body)
        faces.forEach((f) => {
          if ((f.n[0] !== 0 && f.n[0] === x) || (f.n[1] !== 0 && f.n[1] === y) || (f.n[2] !== 0 && f.n[2] === z)) {
            const st = new THREE.Mesh(stickerGeo, stickerMats[f.k])
            st.position.set(f.n[0] * 0.4775, f.n[1] * 0.4775, f.n[2] * 0.4775)
            st.rotation.set(f.rot[0], f.rot[1], f.rot[2])
            g.add(st)
          }
        })
        root.add(g)
        cubies.push(g)
      }
  return { root, cubies, stickerMats }
}

const easeIO = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

export function Rubik() {
  const built = useMemo(() => buildCube(), [])
  const { root, cubies, stickerMats } = built
  const cubeGroup = useRef<THREE.Group>(null)
  const ring1 = useRef<THREE.Mesh>(null)
  const ring2 = useRef<THREE.Mesh>(null)
  const ring3 = useRef<THREE.Mesh>(null)
  const burst = useRef<THREE.Mesh>(null)
  const light = useRef<THREE.PointLight>(null)
  const readout = useRef<THREE.Mesh>(null)
  const busRef = useRef<Bus | null>(null)
  const tmp = useMemo(() => ({ m4: new THREE.Matrix4(), wp: new THREE.Vector3() }), [])

  const sm = useRef({
    phase: 'idle' as Phase,
    timer: 1.5,
    queue: [] as Move[],
    history: [] as Move[],
    cur: null as null | { m: Move; pivot: THREE.Group; list: THREE.Group[]; t: number; dur: number },
    turbo: 0,
    solved: 0,
    total: 0,
    done: 0,
    flash: 0,
    burstT: 99,
    lastLabel: '—',
    key: '',
  }).current

  useWorldColliders(ex, [{ type: 'circle', x: 0, z: 0, r: 2.3 }])

  useEffect(() => {
    busRef.current = audio.createBus('rubik', worldPos(ex, 0, CUBE_Y, 0), { ref: 4, rolloff: 1.4, maxDist: 100, reverb: 0.3, gain: 1 })
  }, [])

  const ro = useMemo(() => {
    const W = 512
    const H = 192
    const c = canvasTex(W, H, () => {})
    return { ...c, W, H }
  }, [])
  const drawReadout = () => {
    const { ctx, W, H, tex } = ro
    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = 'rgba(8,16,30,0.7)'
    roundRect(ctx, 10, 10, W - 20, H - 20, 26)
    ctx.fill()
    ctx.strokeStyle = '#4dd8ff'
    ctx.lineWidth = 3
    ctx.shadowColor = '#4dd8ff'
    ctx.shadowBlur = 14
    ctx.stroke()
    ctx.shadowBlur = 0
    ctx.textAlign = 'left'
    ctx.fillStyle = '#7fe9ff'
    ctx.font = `600 24px ${FONT}`
    const st = { idle: 'STANDBY', scramble: 'SCRAMBLING…', hold: 'ANALYZING…', solve: 'SOLVING', win: 'SOLVED ✓' }[sm.phase]
    ctx.fillText(st, 38, 56)
    ctx.textAlign = 'right'
    ctx.fillStyle = '#fff'
    ctx.font = `600 22px ${FONT}`
    ctx.fillText(`SOLVES ${String(sm.solved).padStart(3, '0')}`, W - 38, 56)
    ctx.textAlign = 'left'
    ctx.fillStyle = '#ffffff'
    ctx.font = `700 76px ${FONT}`
    ctx.fillText(sm.lastLabel, 38, 140)
    // progress
    const p = sm.total ? sm.done / sm.total : 0
    ctx.fillStyle = 'rgba(255,255,255,0.15)'
    roundRect(ctx, 190, 112, W - 228, 14, 7)
    ctx.fill()
    ctx.fillStyle = sm.phase === 'solve' || sm.phase === 'win' ? '#5dffb0' : '#ff8a3d'
    roundRect(ctx, 190, 112, Math.max(14, (W - 228) * p), 14, 7)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.font = `500 18px ${FONT}`
    ctx.fillText(`${sm.done}/${sm.total} moves`, 190, 150)
    tex.needsUpdate = true
  }

  const genScramble = () => {
    const out: Move[] = []
    let last: Move | null = null
    while (out.length < 22) {
      const axis = (['x', 'y', 'z'] as Axis[])[Math.floor(Math.random() * 3)]
      const layer = Math.floor(Math.random() * 3) - 1
      const dir = (Math.random() < 0.5 ? 1 : -1) as 1 | -1
      if (last && last.axis === axis && last.layer === layer) continue
      const m: Move = { axis, layer, dir }
      out.push(m)
      last = m
    }
    return out
  }

  const startMove = (m: Move, dur: number) => {
    root.updateMatrixWorld(true)
    const pivot = new THREE.Group()
    root.add(pivot)
    const list = cubies.filter((c) => Math.round(c.position[m.axis]) === m.layer)
    list.forEach((c) => pivot.attach(c))
    sm.cur = { m, pivot, list, t: 0, dur }
    sm.lastLabel = label(m)
  }
  const finishMove = () => {
    const c = sm.cur
    if (!c) return
    c.pivot.rotation[c.m.axis] = c.m.dir * (Math.PI / 2)
    c.pivot.updateMatrixWorld(true)
    root.updateMatrixWorld(true)
    c.list.forEach((q) => {
      root.attach(q)
      q.position.set(Math.round(q.position.x), Math.round(q.position.y), Math.round(q.position.z))
      tmp.m4.makeRotationFromQuaternion(q.quaternion)
      const e = tmp.m4.elements
      for (const i of [0, 1, 2, 4, 5, 6, 8, 9, 10]) e[i] = Math.round(e[i])
      q.quaternion.setFromRotationMatrix(tmp.m4)
    })
    root.remove(c.pivot)
    sm.cur = null
    sm.done++
    audio.cubeClick(busRef.current!, 0.85 + Math.random() * 0.4)
  }

  const trigger = () => {
    sm.turbo = 3
    if (sm.phase === 'idle' || sm.phase === 'win') sm.timer = 0
    toast('Rubik: tăng tốc ×3')
    if (busRef.current) audio.cubeClick(busRef.current, 1.4)
  }

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const t = state.clock.elapsedTime
    const g = cubeGroup.current
    if (!g) return
    const k = sm.turbo > 0 ? 3 : 1
    sm.turbo = Math.max(0, sm.turbo - dt)

    // máy trạng thái
    if (sm.cur) {
      sm.cur.t += (dt * k) / sm.cur.dur
      const a = easeIO(Math.min(1, sm.cur.t))
      sm.cur.pivot.rotation[sm.cur.m.axis] = sm.cur.m.dir * (Math.PI / 2) * a
      if (sm.cur.t >= 1) finishMove()
    } else if (sm.queue.length) {
      startMove(sm.queue.shift()!, sm.phase === 'scramble' ? 0.14 : 0.34)
    } else {
      sm.timer -= dt * k
      if (sm.phase === 'idle' && sm.timer <= 0) {
        sm.history = genScramble()
        sm.queue = sm.history.slice()
        sm.total = sm.queue.length
        sm.done = 0
        sm.phase = 'scramble'
      } else if (sm.phase === 'scramble') {
        sm.phase = 'hold'
        sm.timer = 1.1
        sm.lastLabel = '…'
      } else if (sm.phase === 'hold' && sm.timer <= 0) {
        sm.queue = sm.history
          .slice()
          .reverse()
          .map((m) => ({ ...m, dir: (-m.dir) as 1 | -1 }))
        sm.total = sm.queue.length
        sm.done = 0
        sm.phase = 'solve'
      } else if (sm.phase === 'solve') {
        sm.phase = 'win'
        sm.timer = 3
        sm.solved++
        sm.flash = 1
        sm.burstT = 0
        sm.lastLabel = '✓'
        if (busRef.current) audio.cubeWin(busRef.current)
      } else if (sm.phase === 'win' && sm.timer <= 0) {
        sm.phase = 'idle'
        sm.timer = 1.2
        sm.lastLabel = '—'
      }
    }

    // chuyển động trôi nổi
    g.position.y = CUBE_Y + Math.sin(t * 1.1) * 0.2
    g.rotation.y += dt * (0.32 + (sm.phase === 'win' ? 2.2 : 0))
    g.rotation.x = 0.38 + Math.sin(t * 0.5) * 0.14
    sm.flash = Math.max(0, sm.flash - dt * 0.8)
    Object.values(stickerMats).forEach((m) => (m.emissiveIntensity = 0.3 + sm.flash * 1.2 + (sm.phase === 'solve' ? 0.1 : 0)))
    if (ring1.current) ring1.current.rotation.set(t * 0.6, t * 0.3, 0)
    if (ring2.current) ring2.current.rotation.set(1.2, t * -0.5, t * 0.2)
    if (ring3.current) ring3.current.rotation.set(-0.5, t * 0.35, t * 0.7)
    if (light.current) light.current.intensity = 160 + sm.flash * 700 + Math.sin(t * 3) * 20
    if (burst.current) {
      sm.burstT += dt
      const b = Math.min(1, sm.burstT / 1.5)
      burst.current.visible = b < 1
      burst.current.scale.setScalar(1 + b * 9)
      ;(burst.current.material as THREE.MeshBasicMaterial).opacity = (1 - b) * 0.9
    }
    if (readout.current) {
      readout.current.getWorldPosition(tmp.wp)
      readout.current.rotation.y = Math.atan2(state.camera.position.x - tmp.wp.x, state.camera.position.z - tmp.wp.z) - ex.rotY
    }
    const key = sm.phase + sm.lastLabel + sm.done + sm.solved
    if (key !== sm.key) {
      sm.key = key
      drawReadout()
    }
  })

  const beam = useMemo(() => beamGeometry(2.1, 0.9, 0.3, 24), [])
  const beamMat = useMemo(() => beamMaterial('#52d8ff', 1.5), [])

  return (
    <group position={[ex.x, 0, ex.z]} rotation={[0, ex.rotY, 0]}>
      <PadRing radius={6.2} color={ex.color} />
      <Label title="Cube Solver" sub="Show Control · Tự xáo & tự giải" color={ex.color} position={[0, 8.6, 0]} scale={1.1} />

      {/* bệ */}
      <mesh position={[0, 0.25, 0]} material={mats.darkMetal} receiveShadow castShadow>
        <cylinderGeometry args={[2.5, 2.8, 0.5, 48]} />
      </mesh>
      <mesh position={[0, 0.58, 0]} material={mats.lacquer}>
        <cylinderGeometry args={[1.7, 2.1, 0.2, 48]} />
      </mesh>
      <PadRing radius={2.35} color="#4dd8ff" y={0.52} tube={0.05} />
      <PadRing radius={1.6} color="#4dd8ff" y={0.7} tube={0.04} />
      <mesh position={[0, 0.7, 0]} geometry={beam} material={beamMat} />
      <mesh position={[0, 0.69, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.45, 40]} />
        <meshBasicMaterial color={new THREE.Color('#4dd8ff').multiplyScalar(1.4)} toneMapped={false} transparent opacity={0.55} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      {/* khối Rubik */}
      <group ref={cubeGroup} position={[0, CUBE_Y, 0]}>
        <primitive object={root} scale={1.3} />
        <mesh ref={ring1}>
          <torusGeometry args={[3.5, 0.025, 8, 120]} />
          <meshBasicMaterial color={new THREE.Color('#4dd8ff').multiplyScalar(2.6)} toneMapped={false} />
        </mesh>
        <mesh ref={ring2}>
          <torusGeometry args={[3.9, 0.02, 8, 120]} />
          <meshBasicMaterial color={new THREE.Color('#ff4fd8').multiplyScalar(2.4)} toneMapped={false} />
        </mesh>
        <mesh ref={ring3}>
          <torusGeometry args={[4.3, 0.018, 8, 120]} />
          <meshBasicMaterial color={new THREE.Color('#ffffff').multiplyScalar(2)} toneMapped={false} />
        </mesh>
      </group>
      <mesh ref={burst} position={[0, CUBE_Y, 0]} rotation={[Math.PI / 2, 0, 0]} visible={false}>
        <torusGeometry args={[1, 0.03, 8, 96]} />
        <meshBasicMaterial color={new THREE.Color('#9ff').multiplyScalar(3)} toneMapped={false} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <group position={[0, CUBE_Y + 3.6, 0]}>
        <mesh ref={readout}>
          <planeGeometry args={[3.2, 1.2]} />
          <meshBasicMaterial map={ro.tex} transparent toneMapped={false} depthWrite={false} />
        </mesh>
      </group>
      <Sparkles count={60} scale={[8, 7, 8]} size={5} speed={0.5} color="#7fe9ff" position={[0, CUBE_Y, 0]} />
      <pointLight ref={light} position={[0, CUBE_Y, 0]} color="#5fd8ff" intensity={160} distance={22} decay={2} />

      <Hit id="rubik" label="Cube Solver" hint="Tăng tốc ×3" panel="rubik" maxDist={45} shape="sphere" size={[3.2, 0, 0]} position={[0, CUBE_Y, 0]} onClick={trigger} />
      <Hit id="rubik-base" label="Cube Solver" hint="Tăng tốc ×3" panel="rubik" maxDist={30} shape="cylinder" size={[2.6, 1.2, 0]} position={[0, 0.6, 0]} onClick={trigger} />
    </group>
  )
}
