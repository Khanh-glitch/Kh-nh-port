import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { EXHIBITS } from '../layout'
import { audio, type Bus } from '../audio'
import { toast } from '../store'
import { beamGeometry, beamMaterial, glowTexture, rand, rbox } from '../gfx'
import { Hit } from './Hit'
import { Label } from './Label'
import { PadRing, useWorldColliders, worldPos } from './common'
import { SocialDrops } from './SocialDrops'
import { kit, led } from './kit/materials'
import { TAU, annulus, latheHard, merge, plate, slotPath, strut, v3, placed } from './kit/geo'
import { CROSS, MAST_TOP, P, PIVOT_Y, RT, Y1, buildBase, buildMicrowave, buildPanel, buildSat, buildTower, buildYoke, dishGeo, feedGeo, rcAt, yAt } from './beacon/parts'

// ---------------------------------------------------------------------------
// SIGNAL BEACON — trạm viễn thông tương lai.
//  · Tháp lưới hyperboloid Shukhov: 36 thanh thẳng xoắn ngược, vòng nén đặt đúng tại các nút giao.
//  · Lõi trung tâm có thang, sàn grating, feeder, 3 ống sợi quang truyền gói dữ liệu lên đỉnh.
//  · Headframe: 6 anten sector (3 hướng × 2 tầng) + 3 chảo viba hướng thẳng về Station / Stage / Cinema.
//  · Chảo tracking AZ/EL (servo có quán tính) bám theo một vệ tinh thật sự bay trên bầu trời.
// ---------------------------------------------------------------------------
const ex = EXHIBITS.beacon
const SECTORS = [Math.PI / 2, Math.PI / 2 + TAU / 3, Math.PI / 2 + (2 * TAU) / 3]
const SECTOR_COL = ['#6aa8ff', '#9a6bff', '#38d9ff']
const CAB_ANGLE = -2.1 // phía tây bắc, khuất khỏi hướng nhìn từ điểm xuất phát
const Y_AXIS = new THREE.Vector3(0, 1, 0)

function linkMaterial(color: string, len: number) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uBurst: { value: 0 }, uLen: { value: len }, uColor: { value: new THREE.Color(color) } },
    vertexShader: /* glsl */ `
      varying float vY; varying vec3 vN; varying vec3 vV;
      void main(){ vY = uv.y; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uBurst, uLen; uniform vec3 uColor; varying float vY; varying vec3 vN; varying vec3 vV;
      void main(){
        float f = pow(abs(dot(normalize(vN), normalize(vV))), 1.4);
        float d = fract(vY * uLen * 0.22 - uTime * (1.1 + uBurst * 4.0));
        float dash = smoothstep(0.0, 0.06, d) * (1.0 - smoothstep(0.14, 0.3, d));
        gl_FragColor = vec4(uColor * 1.7, f * (0.1 + dash * (0.55 + uBurst * 1.6)));
      }`,
  })
}
const linkGeo = (() => {
  const g = new THREE.CylinderGeometry(0.07, 0.07, 1, 6, 1, true)
  g.translate(0, 0.5, 0)
  return g
})()
const _q = new THREE.Quaternion()
const _d = new THREE.Vector3()
function aimLink(m: THREE.Mesh, from: THREE.Vector3, to: THREE.Vector3) {
  _d.subVectors(to, from)
  const len = _d.length()
  m.position.copy(from)
  m.quaternion.copy(_q.setFromUnitVectors(Y_AXIS, _d.normalize()))
  m.scale.set(1, len, 1)
  return len
}

const dampAngle = (cur: number, target: number, lambda: number, dt: number) => {
  let d = target - cur
  d = Math.atan2(Math.sin(d), Math.cos(d))
  return cur + d * (1 - Math.exp(-lambda * dt))
}

export function Beacon() {
  const K = kit()
  const busRef = useRef<Bus | null>(null)
  const dishYaw = useRef<THREE.Group>(null)
  const dishTilt = useRef<THREE.Group>(null)
  const satRef = useRef<THREE.Group>(null)
  const satGlow = useRef<THREE.Sprite>(null)
  const mastRings = useRef<(THREE.MeshBasicMaterial | null)[]>([])
  const wave = useRef<(THREE.Mesh | null)[]>([])
  const sectorWave = useRef<(THREE.Mesh | null)[]>([])
  const flash = useRef<THREE.Sprite>(null)
  const light = useRef<THREE.PointLight>(null)
  const linkSat = useRef<THREE.Mesh>(null)
  const linkRefs = useRef<(THREE.Mesh | null)[]>([])
  const strobe = useRef<THREE.MeshBasicMaterial>(null)
  const strobeSprite = useRef<THREE.Sprite>(null)
  const st = useRef({ send: -100, nextAmbient: 3, nextSector: [1.2, 2.6, 3.9], secT: [-100, -100, -100] }).current

  const tower = useMemo(buildTower, [])
  const base = useMemo(buildBase, [])
  const panel = useMemo(buildPanel, [])
  const yoke = useMemo(buildYoke, [])
  const sat = useMemo(buildSat, [])
  const mw = useMemo(() => [buildMicrowave(0.64), buildMicrowave(0.5), buildMicrowave(0.5)], [])
  const main = useMemo(() => {
    const R = 1.4, depth = 0.42, th = 0.05
    return { R, depth, th, shell: dishGeo(R, depth, th), feed: feedGeo(R, depth, th) }
  }, [])
  const head = useMemo(() => {
    const holes: { x: number; y: number; r: number }[] = []
    for (let i = 0; i < 30; i++) holes.push({ x: Math.cos((i / 30) * TAU) * (RT + 0.38), y: Math.sin((i / 30) * TAU) * (RT + 0.38), r: 0.05 })
    const deck = placed(annulus(0.5, RT + 0.78, 0.08, holes, 48), [0, 0.12, 0])
    const mast = merge([
      latheHard([[0.3, 0.1], [0.3, 0.5], [0.26, 0.5], [0.26, 3.6], [0.2, 3.6], [0.2, 3.75], [0.16, 3.75], [0.16, 7.0], [0.12, 7.0], [0.12, MAST_TOP]], 14),
      ...[0.5, 1.8, 3.6, 5.2, 7.0].map((y) => latheHard([[0.12, -0.04], [0.3, -0.04], [0.3, 0.04], [0.12, 0.04]], 14).translate(0, y, 0)),
      latheHard([[0.12, MAST_TOP], [0.45, MAST_TOP], [0.45, MAST_TOP + 0.08], [0.12, MAST_TOP + 0.08]], 14),
    ])
    const stays: THREE.BufferGeometry[] = []
    const rails: THREE.BufferGeometry[] = []
    const rr = RT + 0.74
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU + 0.26
      stays.push(strut(v3(Math.cos(a) * RT, -0.35, Math.sin(a) * RT), v3(Math.cos(a) * rr, 0.1, Math.sin(a) * rr), 0.05, 0.04, 6))
    }
    rails.push(placed(new THREE.TorusGeometry(rr, 0.02, 6, 48), [0, 1.2, 0], [Math.PI / 2, 0, 0]))
    rails.push(placed(new THREE.TorusGeometry(rr, 0.014, 6, 48), [0, 0.68, 0], [Math.PI / 2, 0, 0]))
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU
      rails.push(strut(v3(Math.cos(a) * rr, 0.12, Math.sin(a) * rr), v3(Math.cos(a) * rr, 1.2, Math.sin(a) * rr), 0.016, 0.016, 5))
    }
    return { deck, mast, stays: merge(stays), rails: merge(rails) }
  }, [])
  const louver = useMemo(() => plate(0.92, 1.56, 0.03, 0.025, 0.006, Array.from({ length: 9 }, (_, i) => slotPath(0, -0.62 + i * 0.065, 0.62, 0.03))), [])
  const doorPlate = useMemo(() => plate(0.92, 1.56, 0.03, 0.025, 0.006, []), [])
  const ringLeds = useMemo(() => [2, 4, 6, 8].map((m) => ({ y: yAt(CROSS[m]), r: Math.hypot(P(0, 1, CROSS[m]).x, P(0, 1, CROSS[m]).z) - 0.13 })), [])
  const pipes = useMemo(() => {
    const out: THREE.BufferGeometry[] = []
    for (const a of [3.6, 4.5, 5.4]) {
      const f = (y: number) => v3(Math.cos(a) * (rcAt(y) + 0.09), y, Math.sin(a) * (rcAt(y) + 0.09))
      out.push(strut(f(1.1), f(Y1 - 0.1), 0.042, 0.036, 8))
    }
    return merge(out)
  }, [])
  const pipeMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uBurst: { value: 0 } },
        vertexShader: /* glsl */ `varying float vY; void main(){ vY = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: /* glsl */ `
          uniform float uTime, uBurst; varying float vY;
          void main(){
            float d = fract(vY * 7.0 + uTime * (0.55 + uBurst * 2.8));
            float pk = smoothstep(0.0, 0.05, d) * (1.0 - smoothstep(0.08, 0.3, d));
            gl_FragColor = vec4(vec3(0.35, 0.7, 1.0) * (0.55 + pk * (2.2 + uBurst * 2.0)), 0.9);
          }`,
      }),
    [],
  )
  const beamGeo = useMemo(() => beamGeometry(150, 1.0, 0.28, 20), [])
  const beamMat = useMemo(() => beamMaterial('#78a8ff', 0.8), [])
  const waveMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color('#9fc4ff').multiplyScalar(2.6), toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), [])
  const sectorGeo = useMemo(() => {
    const g = new THREE.TorusGeometry(1, 0.012, 6, 40, Math.PI * 0.75)
    g.rotateZ(-Math.PI * 0.375)
    g.rotateX(Math.PI / 2)
    return g
  }, [])
  const sectorMats = useMemo(() => SECTOR_COL.map((c) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(2.4), toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 })), [])
  const glow = glowTexture()
  const waves = useRef(Array.from({ length: 6 }, () => ({ t0: -100 }))).current
  const links = useMemo(() => {
    const defs: { id: 'station' | 'stage' | 'cinema'; y: number; color: string; ry: number }[] = [
      { id: 'station', y: 5.0, color: '#7fdcff', ry: 11 },
      { id: 'stage', y: 6.15, color: '#ff3dcb', ry: 9 },
      { id: 'cinema', y: 7.2, color: '#ff6a5a', ry: 6 },
    ]
    return defs.map((d, i) => {
      const dx = EXHIBITS[d.id].x - ex.x
      const dz = EXHIBITS[d.id].z - ex.z
      const dir = v3(dx, 0, dz).normalize()
      const q = new THREE.Quaternion().setFromUnitVectors(Y_AXIS, dir)
      const from = v3(dir.x * 1.0, Y1 + d.y, dir.z * 1.0)
      const to = v3(dx, d.ry, dz)
      const mat = linkMaterial(d.color, from.distanceTo(to))
      return { ...d, dir, q, from, to, mat, R: i === 0 ? 0 : 1 }
    })
  }, [])
  const strobeMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ff2a1a', toneMapped: false }), [])
  const satLinkMat = useMemo(() => linkMaterial('#9fd0ff', 90), [])

  useWorldColliders(ex, [
    { type: 'circle', x: 0, z: 0, r: 3.5 },
    ...[-0.3, 0, 0.3].map((o) => ({ type: 'circle' as const, x: Math.cos(CAB_ANGLE + o) * 6.6, z: Math.sin(CAB_ANGLE + o) * 6.6, r: 0.8 })),
    { type: 'circle', x: Math.cos(CAB_ANGLE + 0.78) * 6.9, z: Math.sin(CAB_ANGLE + 0.78) * 6.9, r: 1.0 },
  ])
  useEffect(() => {
    busRef.current = audio.createBus('beacon', worldPos(ex, 0, Y1 + 8, 0), { ref: 5, rolloff: 1.2, maxDist: 110, reverb: 0.6, gain: 0.8 })
  }, [])

  const send = () => {
    const now = performance.now() / 1000
    if (now - st.send < 2.5) return
    st.send = now
    waves.forEach((w, i) => (w.t0 = now + i * 0.22))
    st.secT = [now, now + 0.15, now + 0.3]
    if (busRef.current) audio.ping(busRef.current)
    toast('Tín hiệu đã phát vào vũ trụ…')
  }

  const satPos = useMemo(() => new THREE.Vector3(), [])
  const pivot = useMemo(() => new THREE.Vector3(0, PIVOT_Y, 0), [])
  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    const now = performance.now() / 1000
    const k = now - st.send
    const burst = k >= 0 && k < 3 ? Math.exp(-k * 1.1) : 0
    beamMat.uniforms.uIntensity.value = 0.45 + burst * 2.4 + Math.sin(t * 2) * 0.06
    pipeMat.uniforms.uTime.value = t
    pipeMat.uniforms.uBurst.value = burst
    satLinkMat.uniforms.uTime.value = t
    satLinkMat.uniforms.uBurst.value = burst
    links.forEach((l) => {
      l.mat.uniforms.uTime.value = t
      l.mat.uniforms.uBurst.value = burst
    })

    // vệ tinh bay trên quỹ đạo nghiêng — chảo servo bám theo với quán tính
    const a = t * 0.05 + 0.6
    satPos.set(Math.cos(a) * 58, 64 + Math.sin(a * 1.7) * 12, Math.sin(a) * 46)
    if (satRef.current) {
      satRef.current.position.copy(satPos)
      satRef.current.rotation.y = -a
      satRef.current.visible = true
    }
    if (satGlow.current) (satGlow.current.material as THREE.SpriteMaterial).opacity = 0.55 + 0.25 * Math.sin(t * 3.1) + burst * 0.4
    const dx = satPos.x
    const dy = satPos.y - PIVOT_Y
    const dz = satPos.z
    const yawT = Math.atan2(dx, dz)
    const tiltT = Math.atan2(Math.hypot(dx, dz), dy)
    if (dishYaw.current) dishYaw.current.rotation.y = dampAngle(dishYaw.current.rotation.y, yawT, 1.3 + burst, dt)
    if (dishTilt.current) dishTilt.current.rotation.x = THREE.MathUtils.damp(dishTilt.current.rotation.x, tiltT, 1.3 + burst, dt)
    if (linkSat.current) aimLink(linkSat.current, pivot, satPos)

    // chuỗi LED chạy lên theo vòng nén
    const ph = (t * 3.2) % ringLeds.length
    mastRings.current.forEach((m, i) => {
      if (!m) return
      const d = Math.abs(((i - ph + ringLeds.length * 1.5) % ringLeds.length) - ringLeds.length / 2)
      m.color.set('#5fb4ff').multiplyScalar(0.35 + Math.max(0, 1 - d) * 2.8 + burst * 2)
    })

    // sóng sector: mỗi hướng phát lần lượt, định kỳ hoặc khi bấm
    sectorWave.current.forEach((m, i) => {
      if (!m) return
      if (t > st.nextSector[i]) {
        st.nextSector[i] = t + rand(5, 8)
        st.secT[i] = now
      }
      const kk = now - st.secT[i]
      if (kk >= 0 && kk < 2.4) {
        m.visible = true
        const s = 2.2 + kk * 6.5
        m.scale.set(s, 1, s)
        sectorMats[i].opacity = (1 - kk / 2.4) * (0.55 + burst * 0.5)
      } else m.visible = false
    })

    // sóng tín hiệu bay dọc trục chảo
    if (t > st.nextAmbient) {
      st.nextAmbient = t + rand(6, 10)
      if (now - st.send > 4) waves[0].t0 = now
    }
    wave.current.forEach((m, i) => {
      if (!m) return
      const kk = now - waves[i].t0
      if (kk > 0 && kk < 2.6) {
        m.visible = true
        m.position.y = main.feed.F + 0.5 + kk * 40
        m.scale.setScalar(1 + kk * 2.5)
        waveMat.opacity = 0.9
      } else m.visible = false
    })
    if (flash.current) {
      flash.current.scale.setScalar(2 + burst * 9)
      ;(flash.current.material as THREE.SpriteMaterial).opacity = 0.3 + burst * 0.65
    }
    if (light.current) light.current.intensity = 120 + burst * 900
    // đèn báo không lưu: 40 chớp / phút
    const on = (t % 1.5) < 0.18
    strobeMat.color.set('#ff2a1a').multiplyScalar(on ? 5 : 0.25)
    if (strobe.current) strobe.current.color.copy(strobeMat.color)
    if (strobeSprite.current) (strobeSprite.current.material as THREE.SpriteMaterial).opacity = on ? 0.9 : 0.05
  })

  const cabinets = [-0.3, 0, 0.3]
  return (
    <group position={[ex.x, 0, ex.z]}>
      <PadRing radius={7.6} color={ex.color} />
      <Label title="Signal Beacon" sub="Liên hệ · Phát tín hiệu" color={ex.color} position={[0, Y1 + 15.5, 0]} scale={1.5} fadeFar={110} />

      {/* ---- nền móng: bê tông đổ tại chỗ, dầm vòng thép, 18 chân neo ---- */}
      <mesh geometry={base.plinth} material={K.concrete} castShadow receiveShadow />
      <mesh geometry={base.girder} material={K.zinc} castShadow receiveShadow />
      <mesh geometry={base.hardware} material={K.titanium} />

      {/* ---- tháp lưới hyperboloid ---- */}
      <mesh geometry={tower.lattice} material={K.zinc} castShadow />
      <mesh geometry={tower.ringsA} material={K.paintWhite} castShadow />
      <mesh geometry={tower.ringsB} material={K.zinc} />
      <mesh geometry={tower.nodes} material={K.titanium} />
      <mesh geometry={tower.core} material={K.gunmetal} castShadow />
      <mesh geometry={tower.spokes} material={K.zinc} />
      <mesh geometry={tower.decks} material={K.grating} />
      <mesh geometry={tower.rails} material={K.paintRed} />
      <mesh geometry={tower.ladder} material={K.titanium} />
      <mesh geometry={tower.feeders} material={K.rubber} />
      <mesh geometry={pipes} material={pipeMat} />
      {ringLeds.map((r, i) => (
        <mesh key={i} position={[0, r.y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[r.r, 0.022, 6, 72]} />
          <meshBasicMaterial ref={(m) => { mastRings.current[i] = m }} color="#5fb4ff" toneMapped={false} />
        </mesh>
      ))}

      {/* ---- tủ thiết bị, máy phát, máng cáp ---- */}
      {cabinets.map((o, i) => {
        const a = CAB_ANGLE + o
        return (
          <group key={i} position={[Math.cos(a) * 6.6, 0, Math.sin(a) * 6.6]} rotation={[0, -a + Math.PI / 2, 0]}>
            <mesh position={[0, 0.08, 0]} geometry={rbox(1.22, 0.16, 0.9, 0.02)} material={K.rubber} />
            <mesh position={[0, 1.15, 0]} geometry={rbox(1.15, 2.0, 0.8, 0.035)} material={K.paintWhite} castShadow />
            <mesh position={[0, 2.2, 0]} geometry={rbox(1.28, 0.1, 0.94, 0.03)} material={K.gunmetal} castShadow />
            <mesh position={[0, 1.15, 0.41]} geometry={i === 1 ? doorPlate : louver} material={K.polymer} />
            <mesh position={[0.4, 1.15, 0.44]} geometry={rbox(0.03, 0.36, 0.04, 0.01)} material={K.titanium} />
            <mesh position={[-0.34, 1.9, 0.44]} material={led(i === 1 ? '#ffb347' : '#46ff9a', 2.6)}>
              <boxGeometry args={[0.1, 0.02, 0.01]} />
            </mesh>
            {i === 1 && (
              <mesh position={[0, 1.3, 0.435]} material={K.screenGlass}>
                <boxGeometry args={[0.5, 0.3, 0.012]} />
              </mesh>
            )}
          </group>
        )
      })}
      <group position={[Math.cos(CAB_ANGLE + 0.78) * 6.9, 0, Math.sin(CAB_ANGLE + 0.78) * 6.9]} rotation={[0, -(CAB_ANGLE + 0.78) + Math.PI / 2, 0]}>
        <mesh position={[0, 0.12, 0]} geometry={rbox(1.5, 0.24, 1.9, 0.03)} material={K.gunmetal} />
        <mesh position={[0, 0.78, 0]} rotation={[Math.PI / 2, 0, 0]} material={K.paintRed} castShadow>
          <cylinderGeometry args={[0.52, 0.52, 1.6, 24]} />
        </mesh>
        {[-0.6, 0.6].map((z) => <mesh key={z} position={[0, 0.4, z]} geometry={rbox(1.3, 0.3, 0.12, 0.02)} material={K.gunmetal} />)}
        <mesh position={[0.45, 1.5, -0.6]} material={K.titanium}>
          <cylinderGeometry args={[0.06, 0.06, 0.9, 10]} />
        </mesh>
      </group>
      {/* máng cáp từ tủ tới chân tháp: nắp cao su có gờ + cáp lộ ra */}
      <group rotation={[0, -CAB_ANGLE, 0]}>
        <mesh position={[5.1, 0.06, 0]} geometry={rbox(2.5, 0.12, 0.42, 0.04)} material={K.rubber} />
        {[-0.12, 0, 0.12].map((z) => (
          <mesh key={z} position={[3.55, 0.12, z]} rotation={[0, 0, Math.PI / 2]} material={K.rubber}>
            <cylinderGeometry args={[0.028, 0.028, 0.8, 6]} />
          </mesh>
        ))}
        <mesh position={[3.9, 0.12, 0]} material={led('#46ffb0', 1.6)}>
          <boxGeometry args={[0.05, 0.012, 0.3]} />
        </mesh>
      </group>

      {/* ---- headframe ---- */}
      <group position={[0, Y1, 0]}>
        <mesh geometry={head.mast} material={K.titaniumLong} castShadow />
        <mesh geometry={head.deck} material={K.grating} />
        <mesh geometry={head.stays} material={K.zinc} />
        <mesh geometry={head.rails} material={K.paintRed} />
        {/* anten sector */}
        {[1.9, 3.7].map((y, ti) =>
          SECTORS.map((phi, si) => {
            const c = Math.cos(phi)
            const s = Math.sin(phi)
            const rotY = Math.atan2(c, s)
            return (
              <group key={`${ti}-${si}`}>
                {/* cánh tay đỡ + ống mast */}
                <mesh geometry={strut(v3(c * 0.25, y + 0.62, s * 0.25), v3(c * 1.92, y + 0.62, s * 1.92), 0.03, 0.03, 6)} material={K.zinc} />
                <mesh geometry={strut(v3(c * 0.25, y - 0.62, s * 0.25), v3(c * 1.92, y - 0.62, s * 1.92), 0.03, 0.03, 6)} material={K.zinc} />
                <mesh geometry={strut(v3(c * 2.0, y - 0.9, s * 2.0), v3(c * 2.0, y + 0.9, s * 2.0), 0.035, 0.035, 8)} material={K.titanium} />
                {[-0.27, 0.27].map((o, pi) => (
                  <group key={pi} position={[c * 2.14 - s * o, y, s * 2.14 + c * o]} rotation={[0, rotY, 0]}>
                    <mesh geometry={panel.radome} material={K.paintWhite} castShadow />
                    <mesh geometry={panel.back} material={K.gunmetal} />
                    <mesh geometry={panel.clamps} material={K.titanium} />
                    <mesh geometry={panel.rru} material={K.anodized} position={[0, -0.5, -0.3]} />
                    <mesh position={[0, -0.28, -0.22]} material={led(pi ? '#46ff9a' : '#ffb347', 2.4)}>
                      <boxGeometry args={[0.05, 0.02, 0.01]} />
                    </mesh>
                  </group>
                ))}
              </group>
            )
          }),
        )}
        {/* sóng sector lan toả theo từng hướng */}
        {SECTORS.map((phi, i) => (
          <mesh key={i} ref={(m) => { sectorWave.current[i] = m }} position={[0, 2.8, 0]} rotation={[0, -phi, 0]} geometry={sectorGeo} material={sectorMats[i]} visible={false} />
        ))}
        {/* chảo viba hướng thẳng tới Station / Stage / Cinema */}
        {links.map((l, i) => (
          <group key={l.id} position={[l.dir.x * 0.95, l.y, l.dir.z * 0.95]} quaternion={l.q}>
            <mesh geometry={mw[i].body} material={K.paintWhite} castShadow />
            <mesh geometry={mw[i].face} material={K.glassSmoke} />
            <mesh geometry={mw[i].hw} material={K.gunmetal} />
          </group>
        ))}
        {links.map((l) => (
          <mesh key={l.id} position={[l.dir.x * 0.4, l.y, l.dir.z * 0.4]} geometry={strut(v3(0, 0, 0), v3(l.dir.x * 0.5, 0, l.dir.z * 0.5), 0.035, 0.035, 6)} material={K.titanium} />
        ))}

        {/* chảo tracking AZ/EL */}
        <group position={[0, MAST_TOP + 0.08, 0]}>
          <mesh geometry={yoke.drum} material={K.anodized} castShadow />
          <mesh geometry={yoke.teeth} material={K.titanium} />
          <group ref={dishYaw} position={[0, 0.48, 0]}>
            <mesh position={[0, 0.07, 0]} geometry={rbox(2 * (main.R + 0.18), 0.14, 0.55, 0.03)} material={K.gunmetal} />
            {[-1, 1].map((sx) => (
              <group key={sx}>
                <mesh geometry={yoke.arm} material={K.titanium} position={[sx * (main.R + 0.16), 0.75, 0]} castShadow />
                <mesh geometry={yoke.hub} material={K.gunmetal} position={[sx * (main.R + 0.07), 1.07, 0]} />
              </group>
            ))}
            <group ref={dishTilt} position={[0, 1.07, 0]}>
              <mesh geometry={main.shell} material={K.paintWhite} castShadow />
              <mesh geometry={main.feed.geo} material={K.titanium} />
              <mesh position={[0, main.feed.F - 0.14, 0]} rotation={[Math.PI, 0, 0]}>
                <circleGeometry args={[0.11, 16]} />
                <meshBasicMaterial color={new THREE.Color('#9fc4ff').multiplyScalar(4)} toneMapped={false} />
              </mesh>
              <sprite ref={flash} position={[0, main.feed.F - 0.2, 0]} scale={[3, 3, 1]}>
                <spriteMaterial map={glow} color="#8fb4ff" transparent opacity={0.4} blending={THREE.AdditiveBlending} depthWrite={false} />
              </sprite>
              <mesh position={[0, main.feed.F, 0]} geometry={beamGeo} material={beamMat} />
              <pointLight ref={light} position={[0, main.feed.F + 0.8, 0]} color="#7aa8ff" intensity={120} distance={30} decay={2} />
              {Array.from({ length: 6 }, (_, i) => (
                <mesh key={i} ref={(m) => { wave.current[i] = m }} rotation={[0, 0, 0]} visible={false} material={waveMat}>
                  <torusGeometry args={[1, 0.035, 8, 64]} />
                </mesh>
              ))}
            </group>
          </group>
        </group>

        {/* cột thu lôi + đèn báo không lưu */}
        <group position={[Math.cos(0.5) * 2.1, 0, Math.sin(0.5) * 2.1]}>
          <mesh geometry={strut(v3(0, 0.1, 0), v3(0, MAST_TOP + 5.4, 0), 0.045, 0.02, 6)} material={K.zinc} />
          <mesh position={[0, MAST_TOP + 5.55, 0]}>
            <sphereGeometry args={[0.12, 14, 10]} />
            <meshBasicMaterial ref={strobe} color="#ff2a1a" toneMapped={false} />
          </mesh>
          <sprite ref={strobeSprite} position={[0, MAST_TOP + 5.55, 0]} scale={[2.2, 2.2, 1]}>
            <spriteMaterial map={glow} color="#ff3a22" transparent opacity={0.05} blending={THREE.AdditiveBlending} depthWrite={false} />
          </sprite>
          <mesh position={[0, MAST_TOP + 5.78, 0]} material={K.titanium}>
            <coneGeometry args={[0.03, 0.4, 6]} />
          </mesh>
        </group>
      </group>

      {/* ---- vệ tinh và đường truyền xuống ---- */}
      <group ref={satRef} visible={false}>
        <group scale={2.0}>
          <mesh geometry={sat.bus} material={K.bronze} />
          <mesh geometry={sat.wingL} material={K.screenGlass} />
          <mesh geometry={sat.wingR} material={K.screenGlass} />
          <mesh geometry={sat.strut} material={K.titanium} position={[-0.95, 0, 0]} />
          <mesh geometry={sat.dish} material={K.paintWhite} />
          <mesh position={[0, 0, 0.47]} material={led('#9fd0ff', 4)}>
            <boxGeometry args={[0.12, 0.05, 0.02]} />
          </mesh>
        </group>
        <sprite ref={satGlow} scale={[14, 14, 1]}>
          <spriteMaterial map={glow} color="#bcd8ff" transparent opacity={0.6} blending={THREE.AdditiveBlending} depthWrite={false} />
        </sprite>
      </group>
      <mesh ref={linkSat} material={satLinkMat} geometry={linkGeo} frustumCulled={false} />
      {links.map((l, i) => (
        <mesh
          key={l.id}
          ref={(m) => {
            linkRefs.current[i] = m
            if (m) aimLink(m, l.from.clone().setY(l.from.y), l.to)
          }}
          material={l.mat}
          geometry={linkGeo}
          frustumCulled={false}
        />
      ))}

      <SocialDrops signal={st} />
      <Hit id="beacon" label="Signal Beacon" hint="Phát tín hiệu liên hệ" panel="beacon" maxDist={70} shape="cylinder" size={[2.8, Y1, 0]} position={[0, Y1 / 2, 0]} onClick={send} />
      <Hit id="beacon-dish" label="Signal Beacon" hint="Phát tín hiệu liên hệ" panel="beacon" maxDist={80} shape="sphere" size={[3.2, 0, 0]} position={[0, PIVOT_Y, 0]} onClick={send} />
      <Hit id="beacon-base" label="Signal Beacon" hint="Phát tín hiệu liên hệ" panel="beacon" maxDist={30} shape="cylinder" size={[1.5, 2.4, 0]} position={[Math.cos(CAB_ANGLE) * 6.6, 1.2, Math.sin(CAB_ANGLE) * 6.6]} onClick={send} />
    </group>
  )
}
