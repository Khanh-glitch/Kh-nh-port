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

function HighGateMeter() {
  useFrame((state, delta) => {
    highGuard.record(delta, useStore.getState().quality, state.gl)
  })
  return null
}

export function Experience() {
  const quality = useStore((s) => s.quality)
  const low = quality === 'low'
  // BENCHMARK BRANCH ONLY: compare cold-frame cost of integrated render layers.
  // All production paths retain their complete appearance.
  const flags = window.location.hash
  const qaNoPost = flags.includes('qa-no-post')
  const qaNoReality = flags.includes('qa-no-reality')
  const qaNoPhenomena = flags.includes('qa-no-phenomena')

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
        {!qaNoPhenomena && <Phenomena />}
        <Platform />
        <Exhibits />
        <Player />
        {!qaNoReality && <RealityHost />}
        {!qaNoPost && <Post low={low} />}
      </Suspense>
    </Canvas>
  )
}
