import { memo, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { audio, type Bus } from '../audio'
import { toast } from '../store'
import { FONT, beamGeometry, beamMaterial, canvasTex, glowTexture, rand, rbox, roundRect } from '../gfx'
import { Hit } from './Hit'
import { Label } from './Label'
import { PadRing } from './common'
import { collectScanCullMeshes, updateScanCullMeshes, createMaterializeUniforms, patchMaterialize } from './materialize'

export interface ShowcaseProps {
  position: [number, number, number]
  worldPosition: [number, number, number]
  rotationY: number
  summoned: boolean
  /** 0 = hidden/dormant, 0..1 = laser scan progress, 1 = materialized */
  scanProgressRef: React.MutableRefObject<number>
  /** World Y where Colossus laser scan ring currently sits during fabrication */
  scanWorldYRef: React.MutableRefObject<number>
  activeRef: React.MutableRefObject<boolean>
  onRequestSummon: () => void
  onFocus?: () => void
}

type AbilityMode = 0 | 1 | 2 // 0: Idle/Patrol, 1: A1 Target Lock & Dash Clamp, 2: A2 Armor Core Surge

function makeNewbotArmorTex() {
  const S = 512
  const { tex } = canvasTex(S, S, (ctx) => {
    // Ivory-cream weathered Scrap Basin plate
    const g = ctx.createLinearGradient(0, 0, S, S)
    g.addColorStop(0, '#f0e7d8')
    g.addColorStop(0.55, '#e4d8c3')
    g.addColorStop(1, '#cfc0a6')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, S, S)

    // Subtle panel grid lines & rivets
    ctx.strokeStyle = 'rgba(30,26,24,0.35)'
    ctx.lineWidth = 3
    ctx.strokeRect(18, 18, S - 36, S - 36)
    ctx.beginPath()
    ctx.moveTo(18, S * 0.48)
    ctx.lineTo(S - 18, S * 0.48)
    ctx.moveTo(S * 0.5, 18)
    ctx.lineTo(S * 0.5, S - 18)
    ctx.stroke()

    // Signature APEX orange-amber battle wear & hazard paint streaks
    ctx.fillStyle = '#eb8422'
    ctx.beginPath()
    ctx.moveTo(0, S * 0.68)
    ctx.lineTo(S * 0.42, S * 0.56)
    ctx.lineTo(S * 0.36, S * 0.72)
    ctx.lineTo(0, S * 0.84)
    ctx.closePath()
    ctx.fill()

    ctx.fillStyle = 'rgba(235, 132, 34, 0.75)'
    for (let i = 0; i < 28; i++) {
      const x = ((i * 97) % S)
      const y = ((i * 53) % S)
      ctx.fillRect(x, y, 8 + (i % 5) * 6, 3 + (i % 3) * 2)
    }

    // Dark scratches & rivets
    ctx.fillStyle = '#252329'
    for (const [rx, ry] of [[34, 34], [S - 34, 34], [34, S - 34], [S - 34, S - 34], [S * 0.5 - 14, 34], [S * 0.5 + 14, 34]]) {
      ctx.beginPath()
      ctx.arc(rx, ry, 5, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = 'rgba(35, 32, 36, 0.75)'
    ctx.font = `700 26px ${FONT}`
    ctx.fillText('NB-01 // SCRAP BASIN', 38, S - 42)
  })
  return tex
}

function makeDeckTex() {
  const S = 512
  const { tex } = canvasTex(S, S, (ctx) => {
    ctx.fillStyle = '#12141a'
    ctx.fillRect(0, 0, S, S)
    // Radial grating rings
    ctx.strokeStyle = '#272b35'
    ctx.lineWidth = 3
    for (let r = 60; r < S / 2; r += 38) {
      ctx.beginPath()
      ctx.arc(S / 2, S / 2, r, 0, Math.PI * 2)
      ctx.stroke()
    }
    // Caution hazard ring segment
    ctx.save()
    ctx.translate(S / 2, S / 2)
    ctx.strokeStyle = '#e5881e'
    ctx.lineWidth = 14
    ctx.setLineDash([22, 18])
    ctx.beginPath()
    ctx.arc(0, 0, S * 0.43, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  })
  return tex
}

function makeHudCardTex() {
  const W = 512
  const H = 192
  const c = canvasTex(W, H, () => {})
  return { ...c, W, H }
}

const MODE_LABELS = ['IDLE · SCRAP SENTRY', 'A1 · TARGET LOCK & CLAMP', 'A2 · ARMOR CORE SURGE']

function ApexShowcaseImpl({ position, worldPosition, rotationY, summoned, scanProgressRef, scanWorldYRef, activeRef, onRequestSummon, onFocus }: ShowcaseProps) {
  const busRef = useRef<Bus | null>(null)
  const exhibitRef = useRef<THREE.Group>(null)
  const showcaseRootRef = useRef<THREE.Group>(null)
  const eyeLight = useRef<THREE.PointLight>(null)
  const eyeLightAnchor = useRef<THREE.Group>(null)
  const eyeLightWorld = useMemo(() => new THREE.Vector3(), [])
  const plinthRef = useRef<THREE.Group>(null)
  const newbotRoot = useRef<THREE.Group>(null)
  const scanCullEntries = useRef<ReturnType<typeof collectScanCullMeshes> | null>(null)
  const upperBody = useRef<THREE.Group>(null)
  const chinRef = useRef<THREE.Mesh>(null)
  const cheekL = useRef<THREE.Mesh>(null)
  const cheekR = useRef<THREE.Mesh>(null)
  const coreEye = useRef<THREE.Mesh>(null)
  const armL = useRef<THREE.Group>(null)
  const armR = useRef<THREE.Group>(null)
  const turbineL = useRef<THREE.Group>(null)
  const turbineR = useRef<THREE.Group>(null)
  const shieldRef = useRef<THREE.Mesh>(null)
  const droneRef = useRef<THREE.Group>(null)
  const lockBeam = useRef<THREE.Mesh>(null)
  const scanRingRef = useRef<THREE.Mesh>(null)
  const holoBeamRef = useRef<THREE.Mesh>(null)
  const hudCardRef = useRef<THREE.Mesh>(null)
  const burstRef = useRef<THREE.Mesh>(null)
  const weaponRingRef = useRef<THREE.Group>(null)
  const sparksRef = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const tmpColor = useMemo(() => new THREE.Color(), [])

  const state = useRef({
    mode: 0 as AbilityMode,
    modeT: 0,
    dashPulse: 0,
    shieldAmt: 0,
    burstT: 99,
    lastHudKey: '',
    sparks: Array.from({ length: 36 }, () => ({ life: 0, dur: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 })),
    sparkIdx: 0,
  }).current

  const matUniforms = useMemo(() => createMaterializeUniforms('#ff9b30'), [])
  useEffect(() => {
    const shadowCasters: THREE.Mesh[] = []
    if (newbotRoot.current) {
      // TEST ONLY: isolate the model's shadow-pass cost without touching
      // global 2048px shadows, color meshes, or other exhibits. Restore every
      // original caster flag on unmount. Never enabled by default.
      if (new URLSearchParams(window.location.search).get('colossusApexShadowProbe') === 'off') {
        newbotRoot.current.traverse(o => {
          const m = o as THREE.Mesh
          if (!m.isMesh || !m.castShadow) return
          shadowCasters.push(m)
          m.castShadow = false
        })
      }
      const skip = new Set<THREE.Object3D>()
      if (shieldRef.current) skip.add(shieldRef.current)
      scanCullEntries.current = collectScanCullMeshes(newbotRoot.current, skip)
    }
    ;(window as unknown as { __orbitaApexShadowProbe?: unknown }).__orbitaApexShadowProbe = {
      modelShadowCastersSuppressed: shadowCasters.length,
    }
    return () => {
      for (const mesh of shadowCasters) mesh.castShadow = true
      scanCullEntries.current = null
    }
  }, [])

  const materials = useMemo(() => {
    const armorTex = makeNewbotArmorTex()
    const deckTex = makeDeckTex()
    const armor = patchMaterialize(
      new THREE.MeshStandardMaterial({ map: armorTex, roughness: 0.42, metalness: 0.28, envMapIntensity: 1.4 }),
      matUniforms,
      'apex-armor',
    )
    const dark = patchMaterialize(
      new THREE.MeshStandardMaterial({ color: '#161920', roughness: 0.42, metalness: 0.78, envMapIntensity: 1.25 }),
      matUniforms,
      'apex-dark',
    )
    const cavity = patchMaterialize(
      new THREE.MeshStandardMaterial({ color: '#07080c', roughness: 0.85, metalness: 0.15, envMapIntensity: 0.4 }),
      matUniforms,
      'apex-cavity',
    )
    const bronze = patchMaterialize(
      new THREE.MeshStandardMaterial({ color: '#cf8e42', roughness: 0.25, metalness: 0.94, envMapIntensity: 1.8 }),
      matUniforms,
      'apex-bronze',
    )
    const chrome = patchMaterialize(
      new THREE.MeshStandardMaterial({ color: '#c8d0dc', roughness: 0.2, metalness: 0.96, envMapIntensity: 1.9 }),
      matUniforms,
      'apex-chrome',
    )
    const orange = patchMaterialize(
      new THREE.MeshStandardMaterial({ color: '#ff8a1f', emissive: '#ff5500', emissiveIntensity: 0.55, roughness: 0.3, metalness: 0.5 }),
      matUniforms,
      'apex-orange',
    )
    const coreCrystal = patchMaterialize(
      new THREE.MeshStandardMaterial({
        color: '#ffaa33',
        emissive: '#ff7b00',
        emissiveIntensity: 1.65,
        roughness: 0.15,
        metalness: 0.25,
      }),
      matUniforms,
      'apex-core',
    )
    const deckMat = new THREE.MeshStandardMaterial({ map: deckTex, roughness: 0.55, metalness: 0.72, envMapIntensity: 1.2 })
    return { armor, dark, cavity, bronze, chrome, orange, coreCrystal, deckMat }
  }, [matUniforms])

  const hud = useMemo(() => makeHudCardTex(), [])
  const drawHud = (mode: AbilityMode, active: boolean) => {
    const { ctx, W, H, tex } = hud
    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = 'rgba(12, 10, 14, 0.82)'
    roundRect(ctx, 8, 8, W - 16, H - 16, 22)
    ctx.fill()
    ctx.strokeStyle = active ? '#ff941f' : '#586278'
    ctx.lineWidth = 3
    ctx.stroke()

    ctx.fillStyle = '#ff941f'
    ctx.font = `700 17px ${FONT}`
    ctx.textAlign = 'left'
    ctx.fillText('APEX CHAOS // DEMO', 30, 46)

    ctx.textAlign = 'right'
    ctx.fillStyle = active ? '#5dffb0' : '#9aa4b8'
    ctx.fillText(active ? '● ONLINE' : '○ STANDBY', W - 30, 46)

    ctx.textAlign = 'left'
    ctx.fillStyle = '#ffffff'
    ctx.font = `800 44px ${FONT}`
    ctx.fillText('NEWBOT', 30, 102)

    ctx.fillStyle = 'rgba(255, 148, 31, 0.18)'
    roundRect(ctx, 28, 122, W - 56, 42, 10)
    ctx.fill()
    ctx.fillStyle = '#ffd08a'
    ctx.font = `600 20px ${FONT}`
    ctx.fillText(active ? MODE_LABELS[mode] : 'CHỜ TRIỆU HỒI TỪ COLOSSUS', 44, 150)
    tex.needsUpdate = true
  }

  useEffect(() => {
    const wp = new THREE.Vector3(...worldPosition)
    busRef.current = audio.createBus('apex', wp, { ref: 4.5, rolloff: 1.25, maxDist: 95, reverb: 0.35, gain: 0.9 })
    drawHud(0, false)
    const sp = sparksRef.current
    if (sp) {
      dummy.scale.setScalar(0)
      dummy.updateMatrix()
      for (let i = 0; i < 36; i++) {
        sp.setMatrixAt(i, dummy.matrix)
        sp.setColorAt(i, tmpColor.set('#ff9b30'))
      }
      sp.instanceMatrix.needsUpdate = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const spawnSparks = (originY: number, count: number, colorHex: string) => {
    const sp = sparksRef.current
    if (!sp) return
    for (let i = 0; i < count; i++) {
      const idx = state.sparkIdx++ % state.sparks.length
      const p = state.sparks[idx]
      p.life = p.dur = rand(0.45, 0.95)
      p.x = rand(-0.45, 0.45)
      p.y = originY + rand(-0.2, 0.3)
      p.z = rand(0.1, 0.9)
      const a = rand(0, Math.PI * 2)
      const spd = rand(1.6, 4.2)
      p.vx = Math.cos(a) * spd
      p.vy = rand(1.2, 3.8)
      p.vz = Math.sin(a) * spd
      sp.setColorAt(idx, tmpColor.set(colorHex).multiplyScalar(2.6))
    }
    if (sp.instanceColor) sp.instanceColor.needsUpdate = true
  }

  const triggerAbility = () => {
    if (!activeRef.current) {
      onRequestSummon()
      return
    }
    onFocus?.()
    state.mode = ((state.mode + 1) % 3) as AbilityMode
    state.modeT = 0
    if (state.mode === 1) {
      state.dashPulse = 1
      state.burstT = 0
      spawnSparks(2.2, 22, '#ff941f')
      if (busRef.current) audio.newbotDash(busRef.current)
      toast('NEWBOT · A1: Target Lock & Clamp!')
    } else if (state.mode === 2) {
      state.burstT = 0
      spawnSparks(2.0, 20, '#5dffb0')
      if (busRef.current) audio.newbotShield(busRef.current)
      toast('NEWBOT · A2: Armor Core Surge!')
    } else {
      if (busRef.current) audio.cubeClick(busRef.current, 0.8)
      toast('NEWBOT · Scrap Sentry Idle')
    }
  }

  const scanBeamMat = useMemo(() => beamMaterial('#ff9b30', 0.9), [])
  const scanBeamGeo = useMemo(() => beamGeometry(4.4, 2.35, 2.35, 32), [])
  const lockGeo = useMemo(() => beamGeometry(2.3, 0.04, 0.015, 8), [])
  const lockMat = useMemo(() => beamMaterial('#ffb030', 2.0), [])
  const glow = glowTexture()

  useFrame((s, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const t = s.clock.elapsedTime
    const prog = scanProgressRef.current
    const isAct = activeRef.current

    matUniforms.uTime.value = t
    matUniforms.uScanY.value = scanWorldYRef.current
    matUniforms.uComplete.value = prog >= 0.999 ? 1.0 : 0.0

    // CI-only causal isolation of the materializing 3D exhibit. Default unchanged.
    const omitExhibitForProbe = typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('colossusExhibitProbe') === 'off'
    if (exhibitRef.current) exhibitRef.current.visible = prog > 0.005 && !omitExhibitForProbe
    const plinthReveal = THREE.MathUtils.smoothstep(prog, 0.005, 0.17)
    if (plinthRef.current) {
      plinthRef.current.visible = plinthReveal > 0.0001
      plinthRef.current.scale.set(plinthReveal, Math.max(plinthReveal, 0.0001), plinthReveal)
    }

    // Laser fabrication ring tracking exact scan height
    if (scanRingRef.current) {
      const fabricating = prog > 0.01 && prog < 0.999
      scanRingRef.current.visible = fabricating
      if (fabricating) {
        const localY = Math.max(0.15, scanWorldYRef.current - position[1])
        scanRingRef.current.position.y = localY
        scanRingRef.current.rotation.z = t * 3.5
        const radiusScale = 0.85 + 0.15 * Math.sin(t * 9)
        scanRingRef.current.scale.setScalar(radiusScale)
        if (Math.random() < 0.35) spawnSparks(localY, 2, '#38d9ff')
      }
    }
    if (holoBeamRef.current) {
      holoBeamRef.current.visible = prog > 0.01 && prog < 0.999
    }

    // Update NEWBOT animations (inspired by gold/shell.html + apex.js springs!)
    state.modeT += dt
    state.dashPulse = Math.max(0, state.dashPulse - dt * 1.45)
    const shieldTarget = state.mode === 2 ? 1 : 0
    state.shieldAmt += (shieldTarget - state.shieldAmt) * (1 - Math.exp(-6 * dt))

    const dashZ = state.mode === 1 ? Math.sin(Math.min(1, state.modeT * 1.8) * Math.PI) * 0.75 : 0
    const bob = Math.sin(t * 2.1) * 0.055
    const lean = state.mode === 1 ? 0.16 * state.dashPulse : Math.sin(t * 1.1) * 0.03

    if (newbotRoot.current) {
      newbotRoot.current.position.y = 0.82 + bob
      newbotRoot.current.position.z = dashZ
      newbotRoot.current.rotation.x = lean
    }
    if (upperBody.current) {
      upperBody.current.rotation.y = Math.sin(t * 0.9) * 0.08
      upperBody.current.rotation.z = Math.sin(t * 0.7) * 0.025
    }

    // Caliper Arms (clamp forward on A1, flare wide on A2, rhythmic combat hover on Idle)
    const clampAng = state.mode === 1 ? Math.sin(Math.min(1, state.modeT * 2.4) * Math.PI) * 0.45 : 0
    const openAng = state.shieldAmt * 0.24
    if (armL.current) {
      armL.current.rotation.z = 0.06 + openAng - clampAng * 0.6 + Math.sin(t * 1.5) * 0.04
      armL.current.rotation.x = clampAng * 0.8 + Math.sin(t * 1.2 + 0.5) * 0.04
    }
    if (armR.current) {
      armR.current.rotation.z = -0.06 - openAng + clampAng * 0.6 - Math.sin(t * 1.5) * 0.04
      armR.current.rotation.x = clampAng * 0.8 - Math.sin(t * 1.2 + 0.5) * 0.04
    }

    // Inner hub turbines spin faster in A2 or A1
    const spinSpeed = 1.6 + state.shieldAmt * 6.5 + state.dashPulse * 8.0
    if (turbineL.current) turbineL.current.rotation.z += dt * spinSpeed
    if (turbineR.current) turbineR.current.rotation.z -= dt * spinSpeed

    // Armor fold (cheek & chin plates flare outward in A2!)
    const fold = state.shieldAmt * 0.14
    if (chinRef.current) chinRef.current.position.y = -0.34 - fold * 0.5
    if (cheekL.current) cheekL.current.position.x = -0.48 - fold
    if (cheekR.current) cheekR.current.position.x = 0.48 + fold

    // Glowing core eye intensity (clamped cleanly so armor stays crisp!)
    materials.coreCrystal.emissiveIntensity = 1.45 + 0.35 * Math.sin(t * 3.8) + state.shieldAmt * 0.75 + state.dashPulse * 0.85
    materials.orange.emissiveIntensity = 0.4 + state.shieldAmt * 0.95

    // Shield dome in A2
    if (shieldRef.current) {
      shieldRef.current.visible = state.shieldAmt > 0.03
      shieldRef.current.scale.setScalar(0.6 + state.shieldAmt * 0.42)
      shieldRef.current.rotation.y = t * 0.6
      ;(shieldRef.current.material as THREE.MeshBasicMaterial).opacity = state.shieldAmt * 0.34
    }

    // Target drone + laser lock beam
    if (droneRef.current) {
      const recoil = state.dashPulse * 0.35
      droneRef.current.position.set(1.25, 2.25 + Math.sin(t * 2.4) * 0.15, 1.55 + recoil)
      droneRef.current.rotation.y = -t * 1.4
    }
    if (lockBeam.current) {
      lockBeam.current.visible = isAct && (state.mode === 1 || Math.sin(t * 1.8) > 0.35)
    }

    // Weapon / energy ring orbit
    if (weaponRingRef.current) {
      weaponRingRef.current.rotation.y = t * (0.45 + state.shieldAmt * 1.2)
    }

    // Floor shockwave ring on ability fire
    if (burstRef.current) {
      state.burstT += dt
      const k = state.burstT / 0.85
      if (k < 1) {
        burstRef.current.visible = true
        burstRef.current.scale.setScalar(1 + k * 2.6)
        ;(burstRef.current.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.85
      } else burstRef.current.visible = false
    }

    // Update sparks
    const sp = sparksRef.current
    if (sp) {
      let dirty = false
      for (let i = 0; i < state.sparks.length; i++) {
        const p = state.sparks[i]
        if (p.life <= 0) continue
        dirty = true
        p.life -= dt
        p.vy -= 5.5 * dt
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.z += p.vz * dt
        dummy.position.set(p.x, Math.max(0.1, p.y), p.z)
        dummy.rotation.set(t * 4 + i, t * 3, 0)
        dummy.scale.setScalar(p.life > 0 ? 0.055 * (p.life / p.dur) : 0)
        dummy.updateMatrix()
        sp.setMatrixAt(i, dummy.matrix)
      }
      if (dirty) sp.instanceMatrix.needsUpdate = true
    }

    if (hudCardRef.current) {
      hudCardRef.current.visible = prog > 0.75
      hudCardRef.current.position.y = 4.62 + Math.sin(t * 1.4) * 0.06
      hudCardRef.current.rotation.y = Math.atan2(s.camera.position.x - worldPosition[0], s.camera.position.z - worldPosition[2]) - rotationY
    }
    const hk = `${state.mode}-${isAct}`
    if (hk !== state.lastHudKey) {
      state.lastHudKey = hk
      drawHud(state.mode, isAct)
    }
    // The scan shader discards EVERY pixel above its wire-height band.
    // Defer mesh draw/first-use VBO upload until its conservative world AABB
    // intersects that band, spreading the previously all-at-once first scan
    // across animation frames. Actual shader/colors/geometry are unchanged.
    if (newbotRoot.current && scanCullEntries.current) {
      if (prog > 0.005 && prog < 0.999)
        updateScanCullMeshes(newbotRoot.current, scanCullEntries.current, scanWorldYRef.current, matUniforms.uWireHeight.value, false)
      else if (prog >= 0.999)
        updateScanCullMeshes(newbotRoot.current, scanCullEntries.current, scanWorldYRef.current, matUniforms.uWireHeight.value, true)
    }
    // Maintain the ORIGINAL world-space light position while keeping the light
    // in the always-visible root. This freezes the scene-wide point-light count:
    // first summon no longer recompiles unrelated materials for a new light define.
    if (eyeLight.current && eyeLightAnchor.current && showcaseRootRef.current) {
      eyeLightAnchor.current.getWorldPosition(eyeLightWorld)
      showcaseRootRef.current.worldToLocal(eyeLightWorld)
      eyeLight.current.position.copy(eyeLightWorld)
      eyeLight.current.intensity = prog > 0.005 ? 5.5 : 0
    }
  })

  return (
    <group ref={showcaseRootRef} name="apex-showcase-root" position={position} rotation={[0, rotationY, 0]}>
      <pointLight ref={eyeLight} color="#ff941f" intensity={0} distance={4.5} decay={2} />
      {/* Emitter fabrication matched to the scan (no premature full pedestal). */}
      <group ref={plinthRef} visible={false}>
      <PadRing radius={3.4} color="#ff941f" y={0.06} tube={0.045} intensity={summoned ? 2.4 : 1.1} />
      <mesh position={[0, 0.2, 0]} material={materials.deckMat} receiveShadow castShadow>
        <cylinderGeometry args={[2.75, 3.05, 0.4, 40]} />
      </mesh>
      <mesh position={[0, 0.43, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.5, 0.045, 8, 64]} />
        <meshBasicMaterial color={new THREE.Color('#ff941f').multiplyScalar(1.9)} toneMapped={false} />
      </mesh>
      {/* Inner projector lens */}
      <mesh position={[0, 0.41, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.1, 1.55, 32]} />
        <meshBasicMaterial color={new THREE.Color('#ff941f').multiplyScalar(1.4)} transparent opacity={0.45} toneMapped={false} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      </group>

      {/* Laser Fabrication Scan Ring + Cone */}
      <mesh ref={scanRingRef} position={[0, 1, 0]} rotation={[Math.PI / 2, 0, 0]} visible={false}>
        <torusGeometry args={[2.35, 0.04, 8, 64]} />
        <meshBasicMaterial color={new THREE.Color('#ff9b30').multiplyScalar(2.6)} toneMapped={false} />
      </mesh>
      <mesh ref={holoBeamRef} position={[0, 0.42, 0]} geometry={scanBeamGeo} material={scanBeamMat} visible={false} />

      <Label title="APEX CHAOS" sub="NEWBOT · Arena Combat Demo" color="#ff941f" position={[0, 6.1, 0]} scale={0.92} fadeNear={3} fadeFar={65} />

      {/* Materialized Game Showcase Content */}
      <group ref={exhibitRef}>
        {/* Floor Target Lock Reticle */}
        <mesh position={[0, 0.44, 0.35]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.65, 1.72, 6]} />
          <meshBasicMaterial color={new THREE.Color('#ffb030').multiplyScalar(2)} toneMapped={false} />
        </mesh>

        {/* ======= ARTICULATED 3D NEWBOT (from APEX CHAOS) ======= */}
        <group ref={newbotRoot} position={[0, 0.82, 0]} scale={1.15}>
          {/* Stub Thruster Legs */}
          {[-1, 1].map((s) => (
            <group key={s} position={[s * 0.48, 0.12, 0]} rotation={[0, s * -0.18, s * -0.16]}>
              {/* Hip Bronze Rotary Drum */}
              <mesh rotation={[0, 0, Math.PI / 2]} material={materials.bronze} castShadow>
                <cylinderGeometry args={[0.24, 0.24, 0.22, 18]} />
              </mesh>
              {/* Armored Thigh/Shin */}
              <mesh position={[s * 0.18, -0.35, 0.04]} rotation={[0, 0, s * -0.12]} geometry={rbox(0.38, 0.68, 0.44, 0.06)} material={materials.armor} castShadow />
              {/* Bronze Knee/Ankle Ring */}
              <mesh position={[s * 0.25, -0.58, 0.08]} rotation={[0, 0, Math.PI / 2]} material={materials.bronze}>
                <cylinderGeometry args={[0.17, 0.17, 0.24, 16]} />
              </mesh>
              {/* Tapered Chisel Foot */}
              <mesh position={[s * 0.28, -0.76, 0.16]} rotation={[0.15, 0, 0]} geometry={rbox(0.32, 0.24, 0.56, 0.05)} material={materials.dark} castShadow />
            </group>
          ))}

          {/* Waist Rotary Core */}
          <mesh position={[0, 0.3, 0]} material={materials.dark} castShadow>
            <cylinderGeometry args={[0.38, 0.3, 0.36, 20]} />
          </mesh>
          <mesh position={[0, 0.3, 0]} rotation={[Math.PI / 2, 0, 0]} material={materials.bronze}>
            <torusGeometry args={[0.36, 0.045, 8, 24]} />
          </mesh>

          {/* Upper Body Pod + Head + Caliper Arms */}
          <group ref={upperBody} position={[0, 0.88, 0]}>
            {/* Dark Inner Chassis Core */}
            <mesh geometry={rbox(1.12, 1.02, 0.96, 0.24)} material={materials.dark} castShadow />

            {/* Obsidian Recessed Visor Cavity */}
            <mesh position={[0, 0.04, 0.36]} geometry={rbox(0.78, 0.5, 0.34, 0.06)} material={materials.cavity} />

            {/* Signature Faceted Amber Core / Eye Crystal (matches home-robot-core.png!) */}
            <mesh ref={coreEye} position={[0, 0.05, 0.53]} rotation={[0.18, 0.25, -0.35]} scale={[0.72, 1.08, 0.65]} material={materials.coreCrystal}>
              <octahedronGeometry args={[0.25, 0]} />
            </mesh>
            <sprite position={[0, 0.05, 0.66]} scale={[0.75, 0.75, 1]}>
              <spriteMaterial map={glow} color="#ff941f" transparent opacity={0.42} blending={THREE.AdditiveBlending} depthWrite={false} />
            </sprite>
            <group ref={eyeLightAnchor} position={[0, 0.05, 0.95]} />

            {/* Dorsal Vertical Crest Fin */}
            <mesh position={[0, 0.68, 0.02]} rotation={[-0.22, 0, 0]} geometry={rbox(0.18, 0.58, 0.78, 0.04)} material={materials.armor} castShadow />
            <mesh position={[0, 0.72, 0.32]} rotation={[-0.22, 0, 0]} geometry={rbox(0.12, 0.48, 0.14, 0.02)} material={materials.orange} />

            {/* Overhanging Angled Brow Cowl Plates */}
            {[-1, 1].map((s) => (
              <mesh
                key={s}
                position={[s * 0.34, 0.34, 0.24]}
                rotation={[0.28, s * -0.26, s * -0.22]}
                geometry={rbox(0.56, 0.26, 0.76, 0.05)}
                material={materials.armor}
                castShadow
              />
            ))}

            {/* Floating Cheek & Chin Plates (spring-animated, flare open in A2!) */}
            <mesh ref={cheekL} position={[-0.48, -0.08, 0.28]} rotation={[0.12, 0.32, 0.18]} geometry={rbox(0.32, 0.44, 0.52, 0.05)} material={materials.armor} castShadow />
            <mesh ref={cheekR} position={[0.48, -0.08, 0.28]} rotation={[0.12, -0.32, -0.18]} geometry={rbox(0.32, 0.44, 0.52, 0.05)} material={materials.armor} castShadow />
            <mesh ref={chinRef} position={[0, -0.34, 0.38]} rotation={[0.25, 0, 0]} geometry={rbox(0.56, 0.24, 0.42, 0.05)} material={materials.armor} castShadow />

            {/* 3 Chest Status Ticks */}
            {[-0.14, 0, 0.14].map((x, idx) => (
              <mesh key={idx} position={[x, -0.22, 0.53]} geometry={rbox(0.08, 0.04, 0.04, 0.01)} material={materials.orange} />
            ))}

            {/* Back Pack / Exhaust */}
            <mesh position={[0, 0.05, -0.52]} geometry={rbox(0.84, 0.68, 0.36, 0.08)} material={materials.dark} castShadow />

            {/* Telescopic Hydraulic Struts (torso -> shoulder hubs) */}
            {[-1, 1].map((s) => (
              <group key={s} position={[s * 0.56, -0.18, 0]} rotation={[0, 0, s * -0.62]}>
                <mesh position={[0, 0.24, 0]} material={materials.dark}>
                  <cylinderGeometry args={[0.075, 0.085, 0.45, 10]} />
                </mesh>
                <mesh position={[0, 0.45, 0]} material={materials.chrome}>
                  <cylinderGeometry args={[0.045, 0.045, 0.42, 10]} />
                </mesh>
              </group>
            ))}

            {/* ======= LEFT & RIGHT GIANT CURVED CALIPER CLAW ARMS ======= */}
            {[
              { side: -1 as const, ref: armL, tRef: turbineL },
              { side: 1 as const, ref: armR, tRef: turbineR },
            ].map(({ side, ref, tRef }) => (
              <group key={side} ref={ref} position={[side * 0.92, 0.18, 0.02]}>
                {/* Dual Brushed-Bronze Rotary Hub */}
                <mesh rotation={[0, 0, Math.PI / 2]} material={materials.bronze} castShadow>
                  <cylinderGeometry args={[0.3, 0.3, 0.34, 20]} />
                </mesh>
                <mesh position={[side * 0.08, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={materials.dark}>
                  <cylinderGeometry args={[0.22, 0.22, 0.38, 16]} />
                </mesh>
                {/* Rotating 6-blade inner turbine */}
                <group ref={tRef} position={[side * 0.2, 0, 0]} rotation={[0, side * (Math.PI / 2), 0]}>
                  {[0, 1, 2, 3, 4, 5].map((b) => (
                    <mesh key={b} rotation={[0, 0, (b * Math.PI) / 3]} position={[0, 0, 0]} material={materials.orange}>
                      <boxGeometry args={[0.045, 0.34, 0.03]} />
                    </mesh>
                  ))}
                </group>

                {/* Massive Arched C-Shaped Caliper Shield Segments curving high above head */}
                <group rotation={[0, 0, side * 0.1]}>
                  {/* Lower arm strut */}
                  <mesh position={[side * 0.22, 0.38, 0.04]} rotation={[0, 0, side * -0.18]} geometry={rbox(0.36, 0.68, 0.46, 0.06)} material={materials.dark} castShadow />
                  {/* Mid curved ivory armor shield */}
                  <mesh position={[side * 0.24, 0.85, 0.08]} rotation={[-0.12, 0, side * 0.22]} geometry={rbox(0.42, 0.72, 0.5, 0.07)} material={materials.armor} castShadow />
                  {/* Upper inward-arching caliper claw blade */}
                  <mesh position={[side * 0.02, 1.38, 0.16]} rotation={[-0.25, 0, side * 0.68]} geometry={rbox(0.34, 0.68, 0.42, 0.06)} material={materials.armor} castShadow />
                  {/* Dark inner pincer tip */}
                  <mesh position={[side * -0.26, 1.56, 0.24]} rotation={[-0.3, 0, side * 1.05]} geometry={rbox(0.18, 0.4, 0.26, 0.03)} material={materials.dark} castShadow />
                  {/* Orange hazard trim accent */}
                  <mesh position={[side * 0.36, 0.88, 0.12]} rotation={[-0.12, 0, side * 0.22]} geometry={rbox(0.06, 0.56, 0.12, 0.02)} material={materials.orange} />
                </group>
              </group>
            ))}
          </group>

          {/* A2 Hex Armor Shield Dome */}
          <mesh ref={shieldRef} position={[0, 0.9, 0]} visible={false}>
            <icosahedronGeometry args={[1.85, 1]} />
            <meshBasicMaterial color={new THREE.Color('#5dffb0').multiplyScalar(1.5)} wireframe transparent opacity={0.3} toneMapped={false} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
        </group>

        {/* Hovering Scrap Target Drone + Laser Lock Beam */}
        <group ref={droneRef} position={[1.25, 2.25, 1.55]}>
          <mesh material={materials.dark} castShadow>
            <octahedronGeometry args={[0.26, 0]} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} material={materials.orange}>
            <torusGeometry args={[0.35, 0.025, 8, 24]} />
          </mesh>
          <mesh position={[0, 0, 0.22]}>
            <sphereGeometry args={[0.08, 12, 10]} />
            <meshBasicMaterial color={new THREE.Color('#ff4a2a').multiplyScalar(2.6)} toneMapped={false} />
          </mesh>
        </group>
        <mesh ref={lockBeam} position={[0, 1.75, 0.55]} rotation={[0.85, 0.55, -0.45]} geometry={lockGeo} material={lockMat} />

        {/* Rotating Holographic Loadout Orbit Ring */}
        <group ref={weaponRingRef} position={[0, 2.2, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[2.05, 0.015, 6, 72]} />
            <meshBasicMaterial color={new THREE.Color('#ff941f').multiplyScalar(1.8)} toneMapped={false} transparent opacity={0.55} />
          </mesh>
          {[0, 1, 2].map((k) => {
            const a = (k / 3) * Math.PI * 2
            return (
              <mesh key={k} position={[Math.cos(a) * 2.05, 0, Math.sin(a) * 2.05]}>
                <octahedronGeometry args={[0.09, 0]} />
                <meshBasicMaterial color={new THREE.Color('#ffbe55').multiplyScalar(2.4)} toneMapped={false} />
              </mesh>
            )
          })}
        </group>

        {/* Floor Impact Shockwave */}
        <mesh ref={burstRef} position={[0, 0.48, 0.2]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
          <ringGeometry args={[0.82, 1.0, 48]} />
          <meshBasicMaterial color={new THREE.Color('#ff941f').multiplyScalar(2.6)} toneMapped={false} transparent blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>

        {/* Diegetic Hologram Card */}
        <mesh ref={hudCardRef} position={[0, 4.32, -0.2]}>
          <planeGeometry args={[2.45, 0.92]} />
          <meshBasicMaterial map={hud.tex} transparent toneMapped={false} depthWrite={false} />
        </mesh>

        {/* Sparks */}
        <instancedMesh ref={sparksRef} args={[undefined, undefined, 36]} frustumCulled={false}>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial toneMapped={false} />
        </instancedMesh>
      </group>

      {/* Interactive Hitbox */}
      <Hit
        id="apex-newbot"
        label={summoned ? 'APEX CHAOS · NEWBOT' : 'Bệ phóng APEX CHAOS'}
        hint={summoned ? 'Kích hoạt kỹ năng NEWBOT' : 'Triệu hồi NEWBOT bằng laser'}
        panel="apex"
        maxDist={40}
        shape="cylinder"
        size={[2.6, 4.6, 0]}
        position={[0, 2.3, 0]}
        onClick={triggerAbility}
      />
    </group>
  )
}

// Avoid re-rendering the entire densely modeled exhibit when the console
// changes state; re-render only when its own public props change.
export const ApexShowcase = memo(ApexShowcaseImpl)
