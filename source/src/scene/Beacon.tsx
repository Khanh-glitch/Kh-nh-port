import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { EXHIBITS } from '../layout'
import { audio, type Bus } from '../audio'
import { toast } from '../store'
import { beamGeometry, beamMaterial, glowTexture, rand } from '../gfx'
import { Hit } from './Hit'
import { Label } from './Label'
import { PadRing, mats, useWorldColliders, worldPos } from './common'
import { SocialDrops } from './SocialDrops'

const ex = EXHIBITS.beacon
const MAST_H = 9.5
const RINGS = 8

export function Beacon() {
  const busRef = useRef<Bus | null>(null)
  const dishYaw = useRef<THREE.Group>(null)
  const dishTilt = useRef<THREE.Group>(null)
  const sats = [useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null)]
  const crystals = useRef<(THREE.Mesh | null)[]>([])
  const mastRings = useRef<(THREE.MeshBasicMaterial | null)[]>([])
  const wave = useRef<(THREE.Mesh | null)[]>([])
  const flash = useRef<THREE.Sprite>(null)
  const light = useRef<THREE.PointLight>(null)
  const st = useRef({ send: -100, nextAmbient: 3 }).current
  const beamGeo = useMemo(() => beamGeometry(600, 1.5, 0.45, 20), [])
  const beamMat = useMemo(() => beamMaterial('#78a8ff', 0.8), [])
  const waveMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color('#9fc4ff').multiplyScalar(2.6), toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), [])
  const glow = glowTexture()
  const waves = useRef(Array.from({ length: 6 }, () => ({ t0: -100 }))).current

  useWorldColliders(ex, [{ type: 'circle', x: 0, z: 0, r: 1.7 }])
  useEffect(() => {
    busRef.current = audio.createBus('beacon', worldPos(ex, 0, MAST_H, 0), { ref: 5, rolloff: 1.2, maxDist: 110, reverb: 0.6, gain: 0.8 })
  }, [])

  const send = () => {
    const now = performance.now() / 1000
    if (now - st.send < 2.5) return
    st.send = now
    waves.forEach((w, i) => (w.t0 = now + i * 0.22))
    if (busRef.current) audio.ping(busRef.current)
    // Sending a signal is a WORLD action (beam, rings, social icons). It must
    // never take over the screen: the profile panel now opens only when the
    // visitor actually targets the floating panel / press E, so the signal
    // keeps pulsing where the beam is instead of a dark sheet + blur.
    toast('Tín hiệu đã phát vào vũ trụ…')
  }

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const now = performance.now() / 1000
    const k = now - st.send
    const burst = k >= 0 && k < 3 ? Math.exp(-k * 1.1) : 0
    beamMat.uniforms.uIntensity.value = 0.55 + burst * 2.4 + Math.sin(t * 2) * 0.06
    if (dishYaw.current) dishYaw.current.rotation.y = t * 0.28
    if (dishTilt.current) dishTilt.current.rotation.x = -0.95 + Math.sin(t * 0.4) * 0.18
    sats.forEach((s, i) => {
      if (s.current) {
        const a = t * (0.9 + i * 0.25) + (i * Math.PI * 2) / 3
        s.current.position.set(Math.cos(a) * 2.6, 0.6 + Math.sin(a * 1.7 + i) * 0.7, Math.sin(a) * 2.6)
      }
    })
    crystals.current.forEach((c, i) => {
      if (!c) return
      const a = t * 0.3 + (i / 6) * Math.PI * 2
      c.position.set(Math.cos(a) * 3.4, 1.3 + Math.sin(t * 1.3 + i * 2) * 0.35, Math.sin(a) * 3.4)
      c.rotation.set(t * 0.8 + i, t * 0.6, 0)
    })
    const ph = (t * 6) % RINGS
    mastRings.current.forEach((m, i) => {
      if (!m) return
      const d = Math.abs(((i - ph + RINGS * 1.5) % RINGS) - RINGS / 2)
      m.color.set('#5fb4ff').multiplyScalar(0.5 + Math.max(0, 1 - d) * 2.8 + burst * 2)
    })

    // sóng tín hiệu bay lên
    if (t > st.nextAmbient) {
      st.nextAmbient = t + rand(6, 10)
      waves.forEach((w, i) => {
        if (i < 1 && now - st.send > 4) w.t0 = now
      })
    }
    wave.current.forEach((m, i) => {
      if (!m) return
      const kk = now - waves[i].t0
      if (kk > 0 && kk < 2.6) {
        m.visible = true
        m.position.y = MAST_H + 0.5 + kk * 70
        m.scale.setScalar(1 + kk * 4)
        waveMat.opacity = 0.9
      } else m.visible = false
    })
    if (flash.current) {
      flash.current.scale.setScalar(3 + burst * 12)
      ;(flash.current.material as THREE.SpriteMaterial).opacity = 0.35 + burst * 0.65
    }
    if (light.current) light.current.intensity = 140 + burst * 900
  })

  return (
    <group position={[ex.x, 0, ex.z]}>
      <PadRing radius={4.8} color={ex.color} />
      <Label title="Signal Beacon" sub="Liên hệ · Phát tín hiệu" color={ex.color} position={[0, 14.5, 0]} scale={1.1} />

      <mesh position={[0, 0.3, 0]} material={mats.darkMetal} castShadow receiveShadow>
        <cylinderGeometry args={[1.5, 1.9, 0.6, 32]} />
      </mesh>
      <mesh position={[0, 0.65, 0]} material={mats.lacquer}>
        <cylinderGeometry args={[1.1, 1.4, 0.12, 32]} />
      </mesh>
      {/* cột */}
      <mesh position={[0, 0.6 + MAST_H / 2, 0]} material={mats.darkMetal} castShadow>
        <cylinderGeometry args={[0.22, 0.5, MAST_H, 16]} />
      </mesh>
      {Array.from({ length: RINGS }, (_, i) => {
        const y = 1.2 + (i / (RINGS - 1)) * (MAST_H - 1.2)
        const r = 0.5 - (y / MAST_H) * 0.28 + 0.06
        return (
          <mesh key={i} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[r, 0.04, 8, 28]} />
            <meshBasicMaterial ref={(m) => { mastRings.current[i] = m }} color="#5fb4ff" toneMapped={false} />
          </mesh>
        )
      })}

      {/* chảo */}
      <group position={[0, MAST_H + 0.7, 0]}>
        <mesh position={[0, -0.15, 0]} material={mats.silver}>
          <cylinderGeometry args={[0.3, 0.3, 0.3, 16]} />
        </mesh>
        <group ref={dishYaw}>
          <mesh position={[0, 0.2, 0]} material={mats.silver}>
            <boxGeometry args={[0.3, 0.7, 0.3]} />
          </mesh>
          <group ref={dishTilt} position={[0, 0.55, 0]}>
            <mesh rotation={[0, 0, 0]} castShadow>
              <sphereGeometry args={[1.7, 40, 16, 0, Math.PI * 2, 0, Math.PI / 3.1]} />
              <meshStandardMaterial color="#cfd6e6" metalness={0.9} roughness={0.25} side={THREE.DoubleSide} envMapIntensity={1.7} />
            </mesh>
            <mesh position={[0, 1.3, 0]} material={mats.silver}>
              <cylinderGeometry args={[0.04, 0.04, 1.0, 8]} />
            </mesh>
            <mesh position={[0, 1.85, 0]}>
              <sphereGeometry args={[0.14, 12, 10]} />
              <meshBasicMaterial color={new THREE.Color('#9fc4ff').multiplyScalar(4)} toneMapped={false} />
            </mesh>
          </group>
        </group>
        {sats.map((s, i) => (
          <mesh key={i} ref={s}>
            <sphereGeometry args={[0.1, 10, 8]} />
            <meshBasicMaterial color={new THREE.Color(['#6aa8ff', '#9a6bff', '#38d9ff'][i]).multiplyScalar(3.5)} toneMapped={false} />
          </mesh>
        ))}
        <sprite ref={flash} position={[0, 0.6, 0]} scale={[3, 3, 1]}>
          <spriteMaterial map={glow} color="#8fb4ff" transparent opacity={0.4} blending={THREE.AdditiveBlending} depthWrite={false} />
        </sprite>
        <mesh position={[0, 0.5, 0]} geometry={beamGeo} material={beamMat} />
        <pointLight ref={light} color="#7aa8ff" intensity={140} distance={26} decay={2} />
      </group>

      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} ref={(m) => { crystals.current[i] = m }}>
          <octahedronGeometry args={[0.28, 0]} />
          <meshStandardMaterial color="#10162a" emissive="#4d8dff" emissiveIntensity={2.2} metalness={0.6} roughness={0.2} />
        </mesh>
      ))}
      {waves.map((_, i) => (
        <mesh key={i} ref={(m) => { wave.current[i] = m }} rotation={[Math.PI / 2, 0, 0]} visible={false} material={waveMat}>
          <torusGeometry args={[1, 0.035, 8, 64]} />
        </mesh>
      ))}

      <SocialDrops signal={st} />
      <Hit id="beacon" label="Signal Beacon" hint="Phát tín hiệu liên hệ" panel="beacon" maxDist={55} shape="cylinder" size={[1.6, 11, 0]} position={[0, 5.5, 0]} onClick={send} />
      <Hit id="beacon-dish" label="Signal Beacon" hint="Phát tín hiệu liên hệ" panel="beacon" maxDist={55} shape="sphere" size={[2.4, 0, 0]} position={[0, MAST_H + 1.5, 0]} onClick={send} />
    </group>
  )
}
