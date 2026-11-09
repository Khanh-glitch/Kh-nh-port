import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { audio } from '../audio'
import { makePixelStormClouds } from './pixelCloud'

type Weather = 0 | 1 | 2
interface Props {
  weatherRef: React.MutableRefObject<Weather>
  activeRef: React.MutableRefObject<boolean>
  scanProgressRef: React.MutableRefObject<number>
  worldPosition: [number, number, number]
}

// Seeded, stable positions avoid allocation and sudden resampling every frame.
const fhash = (n: number) => {
  const x = Math.sin(n * 127.1 + 43.7) * 43758.5453123
  return x - Math.floor(x)
}
const rainSeeds = Array.from({ length: 112 }, (_, i) => ({
  x: (fhash(i + 9) * 2 - 1) * 2.40,
  z: (fhash(i + 71) * 2 - 1) * 2.40,
  y: 0.5 + fhash(i + 121) * 2.5,
  speed: 3.2 + fhash(i + 248) * 2.3,
}))
const rippleSeeds = Array.from({ length: 20 }, (_, i) => ({
  a: fhash(i + 501) * Math.PI * 2,
  r: 2.05 + fhash(i + 529) * 0.55,
  phase: fhash(i + 601),
}))
const motes = Array.from({ length: 32 }, (_, i) => ({
  x: (fhash(i + 801) * 2 - 1) * 2.35,
  z: (fhash(i + 837) * 2 - 1) * 2.35,
  y: 0.55 + fhash(i + 912) * 2.3,
  phase: fhash(i + 961) * 6.28,
}))

/** Weather is confined to the island: physical rain, wind-driven droplets,
 *  expanding water rings, low drifting clouds and golden-dusk fireflies.
 *  No screen-space overlay, no extra renderer and no new objects per frame.
 */
export function RagnarokWeather({ weatherRef, activeRef, scanProgressRef, worldPosition }: Props) {
  const rainRef = useRef<THREE.InstancedMesh>(null)
  const ripplesRef = useRef<THREE.InstancedMesh>(null)
  const gustsRef = useRef<THREE.InstancedMesh>(null)
  const motesRef = useRef<THREE.InstancedMesh>(null)
  const cloudsRef = useRef<THREE.Group>(null)
  const cloudPieces = useRef<Array<THREE.Group | null>>([])
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const cloudTextures = useMemo(() => makePixelStormClouds(), [])
  useEffect(() => {
    cloudTextures.forEach(texture => { texture.needsUpdate = true })
    return () => cloudTextures.forEach(texture => texture.dispose())
  }, [cloudTextures])
  const state = useRef({ lastAudioMode: -1, sources: null as null | {
    rain: AudioBufferSourceNode; wind: AudioBufferSourceNode;
    rainGain: GainNode; windGain: GainNode;
  } }).current

  useEffect(() => {
    // Loop a short shared procedural noise buffer. Audio volume is 0 outside
    // the storm, and positional bus keeps sound local to the diorama.
    const bus = audio.createBus('ragnarok-weather', new THREE.Vector3(...worldPosition), {
      ref: 4.5, rolloff: 1.1, maxDist: 65, reverb: 0.15, gain: 0.8,
    })
    const ctx = audio.ctx
    const rain = ctx.createBufferSource()
    const wind = ctx.createBufferSource()
    rain.buffer = audio.noise
    wind.buffer = audio.noise
    rain.loop = wind.loop = true
    wind.playbackRate.value = 0.8
    const rainFilter = ctx.createBiquadFilter()
    rainFilter.type = 'highpass'
    rainFilter.frequency.value = 1300
    const windFilter = ctx.createBiquadFilter()
    windFilter.type = 'lowpass'
    windFilter.frequency.value = 420
    const rainGain = ctx.createGain()
    const windGain = ctx.createGain()
    rainGain.gain.value = windGain.gain.value = 0
    rain.connect(rainFilter).connect(rainGain).connect(bus.input)
    wind.connect(windFilter).connect(windGain).connect(bus.input)
    rain.start()
    wind.start()
    state.sources = { rain, wind, rainGain, windGain }
    return () => {
      rain.stop()
      wind.stop()
      rain.disconnect()
      wind.disconnect()
      rainFilter.disconnect()
      windFilter.disconnect()
      rainGain.disconnect()
      windGain.disconnect()
      state.sources = null
    }
    // Three.js refs and world coordinates are stable for this exhibition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldPosition[0], worldPosition[1], worldPosition[2]])

  useFrame(({ clock }, dtRaw) => {
    const dt = Math.min(0.05, dtRaw)
    const t = clock.elapsedTime
    const complete = scanProgressRef.current >= 0.999 && activeRef.current
    const storm = complete && weatherRef.current === 2
    const dusk = complete && weatherRef.current === 1
    const showRain = storm && !!rainRef.current
    if (rainRef.current) rainRef.current.visible = showRain
    if (ripplesRef.current) ripplesRef.current.visible = storm
    if (gustsRef.current) gustsRef.current.visible = storm
    if (cloudsRef.current) cloudsRef.current.visible = storm
    if (motesRef.current) motesRef.current.visible = dusk

    const audioMode = storm ? 2 : dusk ? 1 : 0
    if (audioMode !== state.lastAudioMode && state.sources) {
      const now = audio.ctx.currentTime
      state.sources.rainGain.gain.setTargetAtTime(storm ? 0.13 : 0.00001, now, 0.45)
      state.sources.windGain.gain.setTargetAtTime(storm ? 0.075 : 0.00001, now, 0.65)
      state.lastAudioMode = audioMode
    }

    if (storm) {
      const r = rainRef.current
      if (r) {
        rainSeeds.forEach((drop, i) => {
          // Start at staggered positions; recycle above the miniature island.
          drop.y -= dt * drop.speed
          drop.x += dt * 1.32
          if (drop.y < 0.33 || drop.x > 2.65) {
            drop.y = 2.2 + fhash(i * 3 + Math.floor(t * 2)) * 1.0
            drop.x = -2.4 + fhash(i * 2 + 107) * 4.8
          }
          dummy.position.set(drop.x, drop.y, drop.z)
          dummy.rotation.set(0, 0, 0.28)
          dummy.scale.set(1, 0.85 + 0.3 * Math.sin(t * 9 + i), 1)
          dummy.updateMatrix()
          r.setMatrixAt(i, dummy.matrix)
        })
        r.instanceMatrix.needsUpdate = true
      }
      const rip = ripplesRef.current
      if (rip) {
        rippleSeeds.forEach((wave, i) => {
          const ph = (t * 1.6 + wave.phase * 2.9) % 1
          dummy.position.set(Math.cos(wave.a) * wave.r, 0.018, Math.sin(wave.a) * wave.r)
          dummy.rotation.set(-Math.PI / 2, 0, 0)
          dummy.scale.setScalar(0.18 + ph * 1.9)
          dummy.updateMatrix()
          rip.setMatrixAt(i, dummy.matrix)
        })
        rip.instanceMatrix.needsUpdate = true
      }
      const gs = gustsRef.current
      if (gs) {
        for (let i = 0; i < 16; i++) {
          const phase = fhash(i + 1041)
          const x = -2.8 + ((phase * 5.8 + t * (1.8 + i % 3 * 0.15)) % 5.8)
          dummy.position.set(x, 0.65 + (i % 5) * 0.32, -1.75 + fhash(i + 1101) * 3.5)
          dummy.rotation.set(0, 0, Math.sin(t * 2 + i) * 0.025)
          dummy.scale.set(0.55 + fhash(i + 1083) * 0.7, 1, 1)
          dummy.updateMatrix()
          gs.setMatrixAt(i, dummy.matrix)
        }
        gs.instanceMatrix.needsUpdate = true
      }
      cloudPieces.current.forEach((group, i) => {
        if (!group) return
        group.position.x = [-1.55, 0.6, 1.75][i] + Math.sin(t * 0.34 + i * 2.0) * 0.32
        group.position.z = [-1.32, -1.58, -0.94][i] + Math.sin(t * 0.23 + i) * 0.15
      })
    }
    if (dusk && motesRef.current) {
      motes.forEach((m, i) => {
        dummy.position.set(m.x + Math.sin(t * 0.45 + m.phase) * 0.20,
          m.y + Math.sin(t * 0.8 + m.phase) * 0.13,
          m.z + Math.cos(t * 0.6 + m.phase) * 0.15)
        dummy.rotation.set(0, t * 0.5, 0)
        dummy.scale.setScalar(0.6 + 0.4 * Math.sin(t * 1.7 + i) ** 2)
        dummy.updateMatrix()
        motesRef.current!.setMatrixAt(i, dummy.matrix)
      })
      motesRef.current.instanceMatrix.needsUpdate = true
    }
  })

  return <group name="ragnarok-miniature-weather">
    <instancedMesh ref={rainRef} args={[undefined, undefined, rainSeeds.length]} visible={false} frustumCulled={false}>
      <boxGeometry args={[0.018, 0.19, 0.018]} />
      <meshBasicMaterial color="#a4cbf5" transparent opacity={0.70} depthWrite={false} />
    </instancedMesh>
    <instancedMesh ref={ripplesRef} args={[undefined, undefined, rippleSeeds.length]} visible={false} frustumCulled={false}>
      <ringGeometry args={[0.068, 0.085, 10]} />
      <meshBasicMaterial color="#cae7ff" transparent opacity={0.55} depthWrite={false} side={THREE.DoubleSide} />
    </instancedMesh>
    <instancedMesh ref={gustsRef} args={[undefined, undefined, 16]} visible={false} frustumCulled={false}>
      <boxGeometry args={[0.26, 0.012, 0.012]} />
      <meshBasicMaterial color="#a0bded" transparent opacity={0.30} depthWrite={false} />
    </instancedMesh>
    <instancedMesh ref={motesRef} args={[undefined, undefined, motes.length]} visible={false} frustumCulled={false}>
      <boxGeometry args={[0.045, 0.045, 0.045]} />
      <meshBasicMaterial color="#ffd68a" transparent opacity={0.9} depthWrite={false} toneMapped={false} />
    </instancedMesh>
    <group ref={cloudsRef} visible={false}>
      {[0, 1, 2].map(i => (
        <group key={i} ref={v => { cloudPieces.current[i] = v }}
          position={[[ -1.55,2.75,-1.32], [0.6,3.06,-1.58], [1.75,2.63,-0.94]][i] as [number,number,number]}>
          {/* Multiple slightly separated illustrated layers give parallax while
              preserving the readable pixel silhouette at oblique viewpoints. */}
          {[0, 1, 2].map(layer => (
            <sprite key={layer}
              position={[(layer - 1) * 0.16, 0.045 * layer, -0.13 * layer]}
              scale={[1.92 + (layer === 1 ? 0.32 : 0), 1.12 + (layer === 1 ? 0.16 : 0), 1]}>
              <spriteMaterial map={cloudTextures[(i + layer) % cloudTextures.length]}
                color={layer === 0 ? '#c3cadc' : layer === 1 ? '#a8b4d3' : '#828eaf'}
                transparent alphaTest={0.08} opacity={layer === 1 ? 0.89 : 0.75}
                depthWrite={false} toneMapped={true} />
            </sprite>
          ))}
        </group>
      ))}
    </group>
  </group>
}
