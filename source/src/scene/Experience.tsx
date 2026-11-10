import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Bloom, ChromaticAberration, EffectComposer, Noise, ToneMapping, Vignette } from '@react-three/postprocessing'
import { BlendFunction, ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import { useStore, toast } from '../store'
import { Sky } from './Sky'
import { Phenomena, SUN_DIR } from './Phenomena'
import { Platform } from './Platform'
import { Player } from './Player'
import { Exhibits } from './Exhibits'
import { player } from '../world'
import { highGuard } from '../highGuard'
import { RealityHost } from '../reality/RealityHost'

function Lights() {
  const light = useRef<THREE.DirectionalLight>(null)
  const target = useMemo(() => new THREE.Object3D(), [])
  useFrame(() => {
    const l = light.current
    if (!l) return
    // khung bóng đổ bám theo người chơi (làm tròn để tránh nhấp nháy)
    const cx = Math.round(player.pos.x / 2) * 2
    const cz = Math.round(player.pos.z / 2) * 2
    target.position.set(cx, 0, cz)
    l.position.set(cx + SUN_DIR.x * 90, SUN_DIR.y * 90, cz + SUN_DIR.z * 90)
    l.target.updateMatrixWorld()
  })
  return (
    <>
      <primitive object={target} />
      <directionalLight
        ref={light}
        target={target}
        color="#cfe0ff"
        intensity={2.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-38}
        shadow-camera-right={38}
        shadow-camera-top={38}
        shadow-camera-bottom={-38}
        shadow-camera-near={1}
        shadow-camera-far={220}
        shadow-bias={-0.0004}
        shadow-normalBias={0.05}
      />
      <hemisphereLight args={['#7a8cff', '#1a0f30', 0.55]} />
      <ambientLight intensity={0.12} color="#8090ff" />
    </>
  )
}

function Post({ low }: { low: boolean }) {
  const ca = useMemo(() => new THREE.Vector2(0.0007, 0.0009), [])
  return (
    <EffectComposer multisampling={low ? 0 : 4} enableNormalPass={false}>
      <Bloom intensity={low ? 0.9 : 1.25} luminanceThreshold={0.82} luminanceSmoothing={0.25} mipmapBlur radius={0.78} levels={low ? 5 : 8} />
      <ChromaticAberration offset={ca} radialModulation modulationOffset={0.35} blendFunction={low ? BlendFunction.SKIP : BlendFunction.NORMAL} />
      <Noise opacity={0.035} blendFunction={BlendFunction.SOFT_LIGHT} />
      <Vignette offset={0.25} darkness={0.55} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  )
}

// Lightweight genuine Three.js cockpit rig anchored to the visitor camera.
// It is visible only in the opt-in approach, and never after landing.
// All components use basic materials; the full ORBITA scene keeps its
// existing 2048px shadows, 4x MSAA composer and postprocessing unchanged.
function ArrivalCockpit() {
  const frame = useRef<THREE.Group>(null)
  const offset = useMemo(() => new THREE.Vector3(0, -0.34, -2.9), [])
  useFrame(({ camera }) => {
    if (!frame.current) return
    frame.current.visible = useStore.getState().phase === 'intro'
    frame.current.position.copy(offset).applyQuaternion(camera.quaternion).add(camera.position)
    frame.current.quaternion.copy(camera.quaternion)
  })
  return (
    <group ref={frame} name="orbita-arrival-cockpit">
      {/* 3D panoramic windshield frame, dashboard and illuminated consoles. */}
      <mesh position={[0, -1.12, 0.2]} renderOrder={25}>
        <boxGeometry args={[5.3, 0.65, 0.65]} />
        <meshBasicMaterial color="#08101f" depthTest={false} depthWrite={false} />
      </mesh>
      <mesh position={[0, -0.85, 0.05]} rotation={[-0.18, 0, 0]} renderOrder={26}>
        <boxGeometry args={[4.6, 0.08, 0.45]} />
        <meshBasicMaterial color="#234a68" depthTest={false} depthWrite={false} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * 1.87, 0.04, 0]} rotation={[0, 0, side * -0.2]} renderOrder={25}>
            <boxGeometry args={[0.09, 2.7, 0.12]} />
            <meshBasicMaterial color="#172d48" depthTest={false} depthWrite={false} />
          </mesh>
          <mesh position={[side * 1.84, -0.58, 0.22]} renderOrder={27}>
            <boxGeometry args={[1.02, 0.44, 0.08]} />
            <meshBasicMaterial color="#0b253c" depthTest={false} depthWrite={false} />
          </mesh>
          <mesh position={[side * 1.84, -0.42, 0.31]} renderOrder={28}>
            <boxGeometry args={[0.86, 0.045, 0.01]} />
            <meshBasicMaterial color="#39b9d9" depthTest={false} depthWrite={false} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 1.17, 0]} renderOrder={25}>
        <boxGeometry args={[4.1, 0.12, 0.12]} />
        <meshBasicMaterial color="#1a3852" depthTest={false} depthWrite={false} />
      </mesh>
      <mesh position={[0, -1.02, 0.56]} renderOrder={28}>
        <boxGeometry args={[1.0, 0.18, 0.1]} />
        <meshBasicMaterial color="#20c0e5" depthTest={false} depthWrite={false} />
      </mesh>
    </group>
  )
}

function HighGateMeter() {
  useFrame((state, delta) => {
    highGuard.record(delta, useStore.getState().quality, state.gl)
  })
  return null
}

export function Experience() {
  const quality = useStore((s) => s.quality)
  const low = quality === 'low'
  // DIAGNOSTIC ONLY: compare first-laser GPU scheduling with/without the
  // composer. Normal portfolio path always retains Bloom/AA/tonemapping.
  const postProbeOff = typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('colossusPostProbe') === 'off'

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyQ' || e.repeat || useStore.getState().phase !== 'playing') return
      if (useStore.getState().quality === 'high') {
        highGuard.resetToLow()
        useStore.getState().setQuality('low')
        toast('Chất lượng: THẤP')
        return
      }
      const verdict = highGuard.tryEnable()
      if (verdict.ok) {
        useStore.getState().setQuality('high')
        toast('Chất lượng: CAO — đã vượt qua kiểm tra GPU')
      } else if (verdict.reason) {
        // A rejected machine never enters High. Repeated Q is ignored.
        toast(verdict.reason, 3200)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <Canvas
      dpr={low ? 1 : [1, 1.6]}
      shadows="percentage"
      camera={{ fov: 72, near: 0.1, far: 9000, position: [0, 17, 88] }}
      gl={{ antialias: false, powerPreference: 'high-performance', toneMapping: THREE.NoToneMapping, stencil: false }}
    >
      <HighGateMeter />
      <Suspense fallback={null}>
        <Sky />
        <Lights />
        <Phenomena />
        <Platform />
        <Exhibits />
        <Player />
        {typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('arrival') === 'on' && <ArrivalCockpit />}
        <RealityHost />
        {!postProbeOff && <Post low={low} />}
      </Suspense>
    </Canvas>
  )
}
