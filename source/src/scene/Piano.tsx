import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { EXHIBITS } from '../layout'
import { audio, type Bus } from '../audio'
import { toast } from '../store'
import { openPanel } from './Player'
import { rand, rbox } from '../gfx'
import { Hit } from './Hit'
import { Label } from './Label'
import { PadRing, Spot, mats, useWorldColliders, worldPos } from './common'
import { rt } from '../reality/state'

const ex = EXHIBITS.piano
const S = 1.5
const P = 0.0235
const X0 = -52 * P * 0.5
const BLACK_PC = [1, 3, 6, 8, 10]

interface KeyDef {
  midi: number
  black: boolean
  x: number
}
const KEYS: KeyDef[] = (() => {
  const out: KeyDef[] = []
  let w = 0
  for (let m = 21; m <= 108; m++) {
    if (!BLACK_PC.includes(m % 12)) {
      out.push({ midi: m, black: false, x: X0 + (w + 0.5) * P })
      w++
    } else out.push({ midi: m, black: true, x: X0 + w * P })
  }
  return out
})()

// ---------- Bản nhạc tự chơi (phong cách Gymnopédie, D major, 3/4) ----------
interface Ev {
  t: number
  midi: number
  dur: number
  vel: number
}
const B = 0.95
function buildScore() {
  const G = { bass: 43, chord: [59, 62, 66] }
  const D = { bass: 38, chord: [57, 61, 66] }
  const Em = { bass: 40, chord: [55, 59, 62] }
  const A = { bass: 45, chord: [55, 61, 64] }
  const bars = [G, D, G, D, G, D, G, D, G, D, Em, A, D, G, D, D]
  const mel: [number, number, number][][] = [
    [], [], [], [],
    [[78, 0, 1], [81, 1, 1], [79, 2, 1]],
    [[78, 0, 2], [73, 2, 1]],
    [[71, 0, 1], [73, 1, 1], [74, 2, 1]],
    [[69, 0, 3]],
    [[78, 0, 1], [81, 1, 1], [79, 2, 1]],
    [[78, 0, 1], [76, 1, 1], [74, 2, 1]],
    [[71, 0, 1], [74, 1, 1], [76, 2, 1]],
    [[73, 0, 2], [69, 2, 1]],
    [[74, 0, 1], [78, 1, 1], [81, 2, 1]],
    [[83, 0, 2], [81, 2, 1]],
    [[78, 0, 1], [76, 1, 1], [74, 2, 1]],
    [[74, 0, 3]],
  ]
  const ev: Ev[] = []
  for (let pass = 0; pass < 2; pass++) {
    bars.forEach((bar, i) => {
      const t0 = (pass * 16 + i) * 3 * B
      ev.push({ t: t0, midi: bar.bass, dur: 2.6 * B, vel: 0.52 })
      if (pass === 1) ev.push({ t: t0, midi: bar.bass + 12, dur: 2.2 * B, vel: 0.22 })
      ;[1, 2].forEach((beat) =>
        bar.chord.forEach((m, k) => ev.push({ t: t0 + beat * B + k * 0.014, midi: m, dur: 0.95 * B, vel: 0.34 - k * 0.02 })),
      )
      mel[i].forEach(([m, b, d]) => {
        ev.push({ t: t0 + b * B, midi: m, dur: d * B * 0.98, vel: 0.62 })
        if (pass === 1) ev.push({ t: t0 + b * B + 0.01, midi: m - 12, dur: d * B * 0.95, vel: 0.28 })
      })
      if (pass === 1 && i < 4) {
        // arpeggio lấp lánh ở đoạn dạo đầu lượt 2
        const top = bar.chord[2] + 12
        ev.push({ t: t0 + 0.5 * B, midi: top + 7, dur: B, vel: 0.3 })
        ev.push({ t: t0 + 1.5 * B, midi: top + 12, dur: B, vel: 0.26 })
        ev.push({ t: t0 + 2.4 * B, midi: top + 4, dur: B, vel: 0.28 })
      }
    })
  }
  ev.sort((a, b) => a.t - b.t)
  return { events: ev, length: 32 * 3 * B + 2 * B }
}

const caseOuter = () => {
  const s = new THREE.Shape()
  s.moveTo(-0.72, 0.52)
  s.lineTo(0.72, 0.52)
  s.lineTo(0.72, 0.85)
  s.bezierCurveTo(0.72, 1.35, 0.36, 1.45, 0.3, 1.92)
  s.bezierCurveTo(0.26, 2.38, 0.08, 2.74, -0.3, 2.74)
  s.lineTo(-0.5, 2.74)
  s.bezierCurveTo(-0.66, 2.74, -0.72, 2.64, -0.72, 2.5)
  s.lineTo(-0.72, 0.52)
  return s
}
const caseInner = () => {
  const h = new THREE.Path()
  h.moveTo(-0.67, 0.6)
  h.lineTo(0.67, 0.6)
  h.lineTo(0.67, 0.86)
  h.bezierCurveTo(0.67, 1.33, 0.31, 1.43, 0.25, 1.93)
  h.bezierCurveTo(0.21, 2.33, 0.05, 2.68, -0.3, 2.68)
  h.lineTo(-0.5, 2.68)
  h.bezierCurveTo(-0.62, 2.68, -0.67, 2.6, -0.67, 2.48)
  h.lineTo(-0.67, 0.6)
  return h
}

interface Active {
  midi: number
  on: number
  off: number
}

export function Piano() {
  const wRef = useRef<THREE.InstancedMesh>(null)
  const bRef = useRef<THREE.InstancedMesh>(null)
  const gwRef = useRef<THREE.InstancedMesh>(null)
  const gbRef = useRef<THREE.InstancedMesh>(null)
  const orbRef = useRef<THREE.InstancedMesh>(null)
  const busRef = useRef<Bus | null>(null)
  const score = useMemo(() => buildScore(), [])
  const sim = useRef({
    ph: -1.2,
    idx: 0,
    pausedUntil: 0,
    userPause: false,
    manualPause: false,
    active: [] as Active[],
    amt: new Float32Array(120),
    orbs: Array.from({ length: 44 }, () => ({ life: 0, dur: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s: 1 })),
    orbIdx: 0,
  }).current
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const col = useMemo(() => new THREE.Color(), [])

  useWorldColliders(ex, [{ type: 'box', x: 0, z: -0.18, hw: 1.15, hd: 1.85 }])

  const geos = useMemo(() => {
    const outer = caseOuter()
    outer.holes.push(caseInner())
    const body = new THREE.ExtrudeGeometry(outer, { depth: 0.36, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 3, curveSegments: 40 })
    const lidShape = caseOuter()
    const lid = new THREE.ExtrudeGeometry(lidShape, { depth: 0.04, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.008, bevelSegments: 3, curveSegments: 40 })
    const soundboard = new THREE.ShapeGeometry(new THREE.Shape(caseInner().getPoints(40)), 40)
    const plate = new THREE.Shape()
    plate.moveTo(-0.6, 0.66)
    plate.lineTo(0.6, 0.66)
    plate.lineTo(0.6, 0.9)
    plate.bezierCurveTo(0.6, 1.3, 0.27, 1.4, 0.2, 1.9)
    plate.bezierCurveTo(0.17, 2.28, 0.03, 2.6, -0.28, 2.6)
    plate.lineTo(-0.48, 2.6)
    plate.bezierCurveTo(-0.56, 2.6, -0.6, 2.54, -0.6, 2.45)
    plate.lineTo(-0.6, 0.66)
    const plateG = new THREE.ShapeGeometry(plate, 40)
    // dây đàn
    const N = 62
    const pts: number[] = []
    const colors: number[] = []
    const c = new THREE.Color()
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1)
      const x = -0.57 + t * 1.12
      const yb = 2.47 - 1.55 * Math.pow(t, 0.75)
      pts.push(x, 0, 0.7, x - 0.02 * (1 - t), 0, yb)
      c.set(t < 0.28 ? '#d9894a' : '#e8e6ee').multiplyScalar(1.3)
      colors.push(c.r, c.g, c.b, c.r, c.g, c.b)
    }
    const strings = new THREE.BufferGeometry()
    // (x, 0, y_s) -> (x, 0, -y_s)
    const arr = new Float32Array(pts.length)
    for (let i = 0; i < pts.length; i += 3) {
      arr[i] = pts[i]
      arr[i + 1] = pts[i + 1]
      arr[i + 2] = -pts[i + 2]
    }
    strings.setAttribute('position', new THREE.BufferAttribute(arr, 3))
    strings.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3))
    const wKey = new THREE.BoxGeometry(P - 0.0012, 0.022, 0.15)
    wKey.translate(0, 0, 0.075)
    const bKey = new THREE.BoxGeometry(0.0125, 0.02, 0.092)
    bKey.translate(0, 0, 0.046)
    const gW = new THREE.PlaneGeometry(P - 0.003, 0.15)
    gW.rotateX(-Math.PI / 2)
    gW.translate(0, 0, 0.075)
    const gB = new THREE.PlaneGeometry(0.01, 0.09)
    gB.rotateX(-Math.PI / 2)
    gB.translate(0, 0, 0.046)
    return { body, lid, soundboard, plateG, strings, wKey, bKey, gW, gB }
  }, [])

  const whites = useMemo(() => KEYS.filter((k) => !k.black), [])
  const blacks = useMemo(() => KEYS.filter((k) => k.black), [])
  const idxOf = useMemo(() => {
    const m: Record<number, { black: boolean; i: number }> = {}
    let wi = 0
    let bi = 0
    KEYS.forEach((k) => {
      m[k.midi] = k.black ? { black: true, i: bi++ } : { black: false, i: wi++ }
    })
    return m
  }, [])

  const setKey = (midi: number, amt: number) => {
    const k = idxOf[midi]
    const def = KEYS[midi - 21]
    const white = wRef.current
    const black = bRef.current
    const gw = gwRef.current
    const gb = gbRef.current
    if (!k) return
    dummy.rotation.set(amt * 0.075, 0, 0)
    if (!k.black) {
      dummy.position.set(def.x, 0.749, -0.505)
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()
      white?.setMatrixAt(k.i, dummy.matrix)
      dummy.position.y = 0.7625
      dummy.scale.set(Math.max(amt, 0.0001), 1, Math.max(amt, 0.0001))
      dummy.updateMatrix()
      gw?.setMatrixAt(k.i, dummy.matrix)
    } else {
      dummy.position.set(def.x, 0.78, -0.505)
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()
      black?.setMatrixAt(k.i, dummy.matrix)
      dummy.position.y = 0.7915
      dummy.scale.set(Math.max(amt, 0.0001), 1, Math.max(amt, 0.0001))
      dummy.updateMatrix()
      gb?.setMatrixAt(k.i, dummy.matrix)
    }
  }

  useEffect(() => {
    KEYS.forEach((k) => {
      setKey(k.midi, 0)
      const idx = idxOf[k.midi]
      col.setHSL(0.07 + ((k.midi - 21) / 87) * 0.5, 0.95, 0.62).multiplyScalar(2.6)
      if (k.black) gbRef.current?.setColorAt(idx.i, col)
      else gwRef.current?.setColorAt(idx.i, col)
    })
    ;[wRef, bRef, gwRef, gbRef].forEach((r) => {
      if (r.current) {
        r.current.instanceMatrix.needsUpdate = true
        if (r.current.instanceColor) r.current.instanceColor.needsUpdate = true
      }
    })
    const o = orbRef.current
    if (o) {
      dummy.scale.setScalar(0)
      dummy.updateMatrix()
      for (let i = 0; i < 44; i++) {
        o.setMatrixAt(i, dummy.matrix)
        o.setColorAt(i, col)
      }
      o.instanceMatrix.needsUpdate = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    busRef.current = audio.createBus('piano', worldPos(ex, 0, 1.4, 0), { ref: 6, rolloff: 1.05, maxDist: 200, reverb: 0.5, gain: 1 })
  }, [])

  const spawnOrb = (midi: number) => {
    const o = sim.orbs[sim.orbIdx++ % sim.orbs.length]
    const def = KEYS[midi - 21]
    o.life = o.dur = rand(2.2, 3.4)
    o.x = def.x
    o.y = 0.82
    o.z = -0.45
    o.vx = rand(-0.03, 0.12)
    o.vy = rand(0.22, 0.45)
    o.vz = rand(-0.2, -0.05)
    o.s = rand(0.012, 0.024)
    col.setHSL(0.07 + ((midi - 21) / 87) * 0.5, 0.95, 0.65).multiplyScalar(3)
    orbRef.current?.setColorAt(sim.orbs.indexOf(o), col)
    if (orbRef.current?.instanceColor) orbRef.current.instanceColor.needsUpdate = true
  }

  const playUser = (midi: number) => {
    const bus = busRef.current
    if (!bus || !audio.started) return
    const now = audio.ctx.currentTime
    audio.playPiano(bus, midi, 0.8, now, 2.2)
    sim.active.push({ midi, on: now, off: now + 0.4 })
    sim.userPause = true
    sim.pausedUntil = performance.now() + 9000
  }

  const onKeyboardClick = (hit: THREE.Intersection) => {
    const local = hit.object.worldToLocal(hit.point.clone())
    const x = local.x
    const ys = -(-0.43 + local.z)
    let midi = -1
    if (ys > 0.41) {
      for (const k of blacks) {
        if (Math.abs(x - k.x) < 0.0075) {
          midi = k.midi
          break
        }
      }
    }
    if (midi < 0) {
      const wi = Math.floor((x - X0) / P)
      if (wi >= 0 && wi < whites.length) midi = whites[wi].midi
    }
    if (midi > 0) playUser(midi)
  }
  // Playing a key is the visible effect; a click on the keyboard must also
  // reach the Music Lab dossier, exactly like "E" and like the piano body.
  const keyboardAndOpen = (hit: THREE.Intersection) => {
    onKeyboardClick(hit)
    openPanel('piano')
  }

  const target = useMemo(() => new Float32Array(120), [])
  useFrame((state, dt) => {
    const bus = busRef.current
    const now = audio.started ? audio.ctx.currentTime : 0

    // --- tự chơi ---
    if (audio.started && bus) {
      if (sim.userPause && performance.now() > sim.pausedUntil) sim.userPause = false
      const paused = sim.userPause || sim.manualPause || rt.suppressAutoPlay
      if (!paused) sim.ph += dt
      const horizon = sim.ph + 0.25
      while (sim.idx < score.events.length && score.events[sim.idx].t < horizon) {
        const e = score.events[sim.idx]
        const when = now + Math.max(0, e.t - sim.ph) + rand(0, 0.012)
        audio.playPiano(bus, e.midi, e.vel * rand(0.92, 1.06), when, e.dur)
        sim.active.push({ midi: e.midi, on: when, off: when + Math.min(e.dur * 0.92, 2.2) })
        sim.idx++
      }
      if (sim.idx >= score.events.length && sim.ph >= score.length) {
        sim.ph -= score.length
        sim.idx = 0
      }
    }

    // --- phím ---
    target.fill(0)
    for (let i = sim.active.length - 1; i >= 0; i--) {
      const a = sim.active[i]
      if (a.off < now - 0.5) sim.active.splice(i, 1)
      else if (now >= a.on && now < a.off) target[a.midi] = 1
    }
    let dirty = false
    for (let m = 21; m <= 108; m++) {
      const cur = sim.amt[m]
      const tg = target[m]
      if (cur === tg) continue
      const next = cur + (tg - cur) * (1 - Math.exp(-(tg > cur ? 45 : 14) * dt))
      const fin = Math.abs(tg - next) < 0.004 ? tg : next
      if (cur < 0.5 && fin >= 0.5 && tg === 1) spawnOrb(m)
      sim.amt[m] = fin
      setKey(m, fin)
      dirty = true
    }
    if (dirty) {
      ;[wRef, bRef, gwRef, gbRef].forEach((r) => {
        if (r.current) r.current.instanceMatrix.needsUpdate = true
      })
    }

    // --- quả cầu ánh sáng bay lên ---
    const o = orbRef.current
    if (o) {
      let any = false
      sim.orbs.forEach((b, i) => {
        if (b.life <= 0) return
        any = true
        b.life -= dt
        b.x += b.vx * dt
        b.y += b.vy * dt
        b.z += b.vz * dt
        b.vx += Math.sin(state.clock.elapsedTime * 2 + i) * 0.02 * dt
        const k = Math.max(0, b.life / b.dur)
        dummy.position.set(b.x, b.y, b.z)
        dummy.rotation.set(0, 0, 0)
        dummy.scale.setScalar(b.life > 0 ? b.s * Math.sin(Math.PI * Math.min(1, (1 - k) * 3 + 0.05)) * (0.4 + k) : 0)
        dummy.updateMatrix()
        o.setMatrixAt(i, dummy.matrix)
      })
      if (any) o.instanceMatrix.needsUpdate = true
    }
  })

  const lidAngle = 0.78
  return (
    <group position={[ex.x, 0, ex.z]} rotation={[0, ex.rotY, 0]} userData={{ rwKeep: true }}>
      <PadRing radius={6.2} color={ex.color} />
      <Spot position={[2, 15, 3]} target={[0, 0.8, 0]} color="#ffe2b8" intensity={750} angle={0.42} distance={45} />
      <Label title="Grand Piano" sub="Live Music · Âm thanh 3D" color={ex.color} position={[0, 5.4, 0]} scale={1.1} />

      <group scale={S}>
        <group position={[0, 0, 1.4]}>
          {/* thân đàn */}
          <mesh geometry={geos.body} material={mats.lacquer} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.64, 0]} castShadow />
          {/* soundboard + khung gang */}
          <mesh geometry={geos.soundboard} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.9, 0]}>
            <meshStandardMaterial color="#9b6a36" roughness={0.55} />
          </mesh>
          <mesh geometry={geos.plateG} material={mats.gold} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.925, 0]} />
          {[
            [-0.27, 1.25, 0.075],
            [0.02, 1.75, 0.09],
            [-0.34, 1.95, 0.07],
            [-0.12, 2.3, 0.06],
          ].map(([x, y, r], i) => (
            <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.927, -y]}>
              <circleGeometry args={[r, 28]} />
              <meshStandardMaterial color="#6b4524" roughness={0.6} />
            </mesh>
          ))}
          {/* thanh giằng */}
          {[
            [0.0, 1.2, 1.1, -0.18],
            [-0.05, 1.7, 0.7, 0.12],
            [-0.15, 2.15, 0.5, 0.0],
          ].map(([x, y, l, rot], i) => (
            <mesh key={i} position={[x, 0.945, -y]} rotation={[0, rot, 0]} material={mats.gold}>
              <boxGeometry args={[l, 0.02, 0.045]} />
            </mesh>
          ))}
          <lineSegments geometry={geos.strings} position={[0, 0.955, 0]}>
            <lineBasicMaterial vertexColors toneMapped={false} />
          </lineSegments>
          {/* dây thép chốt */}
          <mesh position={[0, 0.94, -0.7]} material={mats.gold}>
            <boxGeometry args={[1.18, 0.03, 0.05]} />
          </mesh>

          {/* nắp đàn mở + que chống */}
          <group position={[-0.72, 1.0, 0]} rotation={[0, 0, lidAngle]}>
            <mesh geometry={geos.lid} material={mats.lacquer} rotation={[-Math.PI / 2, 0, 0]} position={[0.72, 0, 0]} castShadow />
          </group>
          <mesh position={[0.36, 1.43, -1.15]} rotation={[0, 0, 0.52]} material={mats.silver}>
            <cylinderGeometry args={[0.012, 0.012, 0.99, 10]} />
          </mesh>
          {/* hộp phím + má phím */}
          <mesh position={[0, 0.67, -0.41]} material={mats.lacquer}>
            <boxGeometry args={[1.4, 0.1, 0.24]} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.7, 0.74, -0.41]} material={mats.lacquer}>
              <boxGeometry args={[0.05, 0.18, 0.24]} />
            </mesh>
          ))}
          <mesh position={[0, 0.77, -0.32]} material={mats.lacquer}>
            <boxGeometry args={[1.4, 0.08, 0.04]} />
          </mesh>
          <mesh position={[0, 0.9, -0.525]} material={mats.lacquer}>
            <boxGeometry args={[1.44, 0.28, 0.05]} />
          </mesh>
          <mesh position={[0, 0.92, -0.508]}>
            <planeGeometry args={[0.2, 0.012]} />
            <meshStandardMaterial color="#d4a74c" metalness={1} roughness={0.25} />
          </mesh>
          {/* giá nhạc + bản nhạc */}
          <group position={[0, 1.07, -0.56]} rotation={[-0.32, 0, 0]}>
            <mesh material={mats.lacquer}>
              <boxGeometry args={[0.72, 0.28, 0.012]} />
            </mesh>
            <mesh position={[0, 0.01, 0.008]}>
              <planeGeometry args={[0.6, 0.22]} />
              <meshStandardMaterial color="#b8b09c" roughness={0.95} />
            </mesh>
          </group>

          {/* phím */}
          <instancedMesh ref={wRef} args={[geos.wKey, undefined, whites.length]} frustumCulled={false}>
            <meshStandardMaterial color="#f6f1e6" roughness={0.3} metalness={0.02} />
          </instancedMesh>
          <instancedMesh ref={bRef} args={[geos.bKey, undefined, blacks.length]} frustumCulled={false}>
            <meshStandardMaterial color="#0b0b0d" roughness={0.22} metalness={0.15} envMapIntensity={1.8} />
          </instancedMesh>
          <instancedMesh ref={gwRef} args={[geos.gW, undefined, whites.length]} frustumCulled={false} renderOrder={3}>
            <meshBasicMaterial toneMapped={false} transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} />
          </instancedMesh>
          <instancedMesh ref={gbRef} args={[geos.gB, undefined, blacks.length]} frustumCulled={false} renderOrder={3}>
            <meshBasicMaterial toneMapped={false} transparent opacity={0.95} blending={THREE.AdditiveBlending} depthWrite={false} />
          </instancedMesh>
          <instancedMesh ref={orbRef} args={[undefined, undefined, 44]} frustumCulled={false}>
            <sphereGeometry args={[1, 10, 8]} />
            <meshBasicMaterial toneMapped={false} />
          </instancedMesh>

          {/* chân đàn */}
          {[
            [-0.64, -0.62],
            [0.64, -0.62],
            [-0.4, -2.55],
          ].map(([x, z], i) => (
            <group key={i} position={[x, 0, z]}>
              <mesh position={[0, 0.34, 0]} material={mats.lacquer} castShadow>
                <cylinderGeometry args={[0.05, 0.035, 0.66, 16]} />
              </mesh>
              <mesh position={[0, 0.05, 0]} material={mats.gold}>
                <cylinderGeometry args={[0.04, 0.05, 0.05, 16]} />
              </mesh>
              <mesh position={[0, 0.02, 0]} material={mats.gold}>
                <sphereGeometry args={[0.03, 12, 8]} />
              </mesh>
            </group>
          ))}
          {/* lyre + bàn đạp */}
          <group position={[0, 0, -0.45]}>
            {[-0.06, 0.06].map((x) => (
              <mesh key={x} position={[x, 0.42, 0]} material={mats.lacquer}>
                <boxGeometry args={[0.025, 0.46, 0.06]} />
              </mesh>
            ))}
            <mesh position={[0, 0.17, 0]} material={mats.lacquer}>
              <boxGeometry args={[0.2, 0.04, 0.12]} />
            </mesh>
            {[-0.06, 0, 0.06].map((x) => (
              <mesh key={x} position={[x, 0.12, 0.11]} rotation={[0.1, 0, 0]} material={mats.gold}>
                <boxGeometry args={[0.035, 0.012, 0.13]} />
              </mesh>
            ))}
          </group>

          {/* ghế */}
          <group position={[0, 0, 0.25]}>
            <mesh position={[0, 0.5, 0]} geometry={rbox(0.8, 0.09, 0.34, 0.03)} castShadow>
              <meshLambertMaterial color="#3a1420" />
            </mesh>
            {[
              [-0.34, -0.12],
              [0.34, -0.12],
              [-0.34, 0.12],
              [0.34, 0.12],
            ].map(([x, z], i) => (
              <mesh key={i} position={[x, 0.24, z]} material={mats.lacquer}>
                <cylinderGeometry args={[0.018, 0.014, 0.46, 8]} />
              </mesh>
            ))}
          </group>

          <pointLight position={[0.15, 1.35, -1.2]} color="#ffb869" intensity={18} distance={5} decay={2} />

          {/* vùng tương tác (bàn phím / thân đàn) */}
          <Hit
            id="piano-keys"
            label="Grand Piano · Bàn phím"
            hint="Nhấn phím để chơi"
            maxDist={9}
            panel="piano"
            onClick={keyboardAndOpen}
            size={[1.3, 0.08, 0.22]}
            position={[0, 0.77, -0.43]}
          />
          <Hit
            id="piano-body"
            label="Grand Piano"
            hint="Mở hồ sơ · dừng / tiếp tục tự chơi"
            maxDist={30}
            panel="piano"
            onClick={() => {
              sim.manualPause = !sim.manualPause
              toast(sim.manualPause ? 'Piano: tạm dừng' : 'Piano: tiếp tục tự chơi')
              openPanel('piano')
            }}
            size={[1.5, 1.8, 2.3]}
            position={[0, 1.0, -1.65]}
          />
        </group>
      </group>
    </group>
  )
}
