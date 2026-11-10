import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { EXHIBITS } from '../layout'
import { audio, type Bus } from '../audio'
import { toast } from '../store'
import { FONT, beamGeometry, beamMaterial, canvasTex, glowTexture, rbox, roundRect } from '../gfx'
import { Hit } from './Hit'
import { Label } from './Label'
import { PadRing, Spot, mats, useWorldColliders, worldPos } from './common'
import { ApexShowcase } from './ApexShowcase'
import { RagnarokShowcase } from './RagnarokShowcase'
import { ShowcaseWarmup } from './ShowcaseWarmup'
import { openPanel } from './Player'
import { addCollider } from '../world'

const ex = EXHIBITS.robot
const SC = 0.78

const APEX_POS: [number, number, number] = [-8.5, 0, 6.8]
const RAG_POS: [number, number, number] = [8.5, 0, 6.8]
const CONSOLE_POS: [number, number, number] = [0, 0, 9.8]

type ArenaMode = 'dormant' | 'summon_apex' | 'summon_rag' | 'active' | 'retracting'

const accent = new THREE.MeshStandardMaterial({ color: '#ff7a1f', emissive: '#ff4d00', emissiveIntensity: 0.55, metalness: 0.5, roughness: 0.4 })
const eyeColor = new THREE.Color('#ffa24a').multiplyScalar(3.2)
const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff8a2a').multiplyScalar(2.8), toneMapped: false })

type V3 = [number, number, number]
function Part({ s, p, r = 0.22, m = mats.white, rot, cast = true }: { s: V3; p: V3; r?: number; m?: THREE.Material; rot?: V3; cast?: boolean }) {
  return <mesh geometry={rbox(s[0], s[1], s[2], r)} material={m} position={p} rotation={rot} castShadow={cast} receiveShadow />
}

function Arm({
  side,
  armRef,
  foreRef,
  emitterRef,
}: {
  side: 1 | -1
  armRef: React.Ref<THREE.Group>
  foreRef: React.Ref<THREE.Group>
  emitterRef: React.Ref<THREE.Mesh>
}) {
  return (
    <group ref={armRef} position={[side * 4.2, 11.6, 0]}>
      <mesh material={mats.darkMetal} castShadow>
        <sphereGeometry args={[1.25, 24, 18]} />
      </mesh>
      <Part s={[2.4, 1.1, 2.7]} p={[side * 0.35, 0.95, 0]} rot={[0, 0, side * 0.15]} r={0.35} />
      <Part s={[1.35, 3.0, 1.5]} p={[0, -1.9, 0]} />
      <Part s={[1.45, 0.3, 1.6]} p={[0, -1.0, 0]} m={accent} r={0.1} />
      <group ref={foreRef} position={[0, -3.5, 0]}>
        <mesh material={mats.darkMetal} castShadow>
          <sphereGeometry args={[0.85, 20, 14]} />
        </mesh>
        <Part s={[1.25, 2.9, 1.6]} p={[0, -1.7, 0.05]} />
        <Part s={[1.35, 0.3, 1.7]} p={[0, -0.9, 0.05]} m={accent} r={0.1} />
        <Part s={[1.5, 1.3, 1.2]} p={[0, -3.5, 0]} m={mats.darkMetal} />
        {/* Wrist Laser Projector Ring */}
        <mesh position={[0, -3.6, 0.68]} rotation={[Math.PI / 2, 0, 0]} material={mats.silver}>
          <torusGeometry args={[0.32, 0.06, 8, 16]} />
        </mesh>
        <mesh ref={emitterRef} position={[0, -3.6, 0.72]}>
          <sphereGeometry args={[0.2, 12, 10]} />
          <meshBasicMaterial color={new THREE.Color('#66e4ff').multiplyScalar(2.8)} toneMapped={false} />
        </mesh>
        {[-0.45, 0, 0.45].map((x) => (
          <Part key={x} s={[0.36, 1.1, 0.4]} p={[x, -4.5, 0.1]} m={mats.darkMetal} r={0.1} />
        ))}
      </group>
    </group>
  )
}

export function Robot() {
  const renderStartedAt = performance.now()
  const { gl } = useThree()
  const head = useRef<THREE.Group>(null)
  const torso = useRef<THREE.Group>(null)
  const armR = useRef<THREE.Group>(null)
  const armL = useRef<THREE.Group>(null)
  const foreR = useRef<THREE.Group>(null)
  const foreL = useRef<THREE.Group>(null)
  const emitterL = useRef<THREE.Mesh>(null)
  const emitterR = useRef<THREE.Mesh>(null)
  const visorEmitter = useRef<THREE.Mesh>(null)
  const eyes = useRef<THREE.MeshBasicMaterial>(null)
  const reactor = useRef<THREE.Mesh>(null)
  const reactorLight = useRef<THREE.PointLight>(null)
  const busRef = useRef<Bus | null>(null)

  // Laser Beams & Impact Flare
  const beamL = useRef<THREE.Mesh>(null)
  const beamR = useRef<THREE.Mesh>(null)
  const beamEye = useRef<THREE.Mesh>(null)
  const impactFlare = useRef<THREE.Sprite>(null)
  const conduitL = useRef<THREE.MeshBasicMaterial>(null)
  const conduitR = useRef<THREE.MeshBasicMaterial>(null)

  // Shared animation refs for both game exhibits
  const apexProgress = useRef(0)
  const apexScanY = useRef(-1)
  const apexActive = useRef(false)
  const ragProgress = useRef(0)
  const ragScanY = useRef(-1)
  const ragActive = useRef(false)
  // Collide with projector plinths only when they physically exist.
  const apexColliderRemove = useRef<null | (() => void)>(null)
  const ragColliderRemove = useRef<null | (() => void)>(null)
  const [apexSummoned, setApexSummoned] = useState(false)
  const [ragSummoned, setRagSummoned] = useState(false)
  const [arenaModeUi, setArenaModeUi] = useState<ArenaMode>('dormant')

  // Console button materials & press animation
  const btnMats = useMemo(
    () => [
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff941f').multiplyScalar(1.8), toneMapped: false }),
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#38d9ff').multiplyScalar(2.4), toneMapped: false }),
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#5dffb0').multiplyScalar(1.8), toneMapped: false }),
    ],
    [],
  )
  const btnPress = useRef([0, 0, 0]).current
  const btnRefs = useRef<(THREE.Mesh | null)[]>([])

  const coldProbe = useRef({
    running: false, started: 0, lastPostClickFrameAt: 0, firstBeamFrameAtMs: null as number | null, frames: 0, maxFrameMs: 0, frameMsSum: 0,
    warmStatusAtClick: '',
    clickHandlerMs: 0,
    framesTrace: [] as Array<{ atMs: number; dtMs: number; programs: number; mode: ArenaMode; hidden: boolean; focused: boolean }>,
    pageHiddenAtClick: false,
    pageFocusedAtClick: true,
    hiddenDuringProfile: false,
    visibilityTransitions: 0,
    programsAtClick: [] as Array<{ id: number; name: string; key: string }>,
    reactCommits: [] as Array<{ atMs: number; durationMs: number; mode: ArenaMode }>,
    browserTasks: [] as Array<{ type: string; atMs: number; durationMs: number; blockingMs: number; scripts: Array<{ durationMs: number; invoker: string; sourceURL: string }> }>,
  }).current
  const st = useRef({
    mode: 'dormant' as ArenaMode,
    modeT: 0,
    singleOnly: false,
    wave: -100,
    yaw: 0,
    pitch: 0,
    torsoYaw: 0,
    torsoPitch: 0,
    armLPitch: 0,
    armLRoll: -0.05,
    armRPitch: 0,
    armRRoll: 0.05,
    servoAcc: 0,
    lastServo: 0,
    lastDraw: 0,
    focusedGame: 'NONE' as 'NONE' | 'APEX CHAOS' | 'RAGNAROK',
  }).current

  useEffect(() => {
    const onVisibility = () => {
      if (!coldProbe.running) return
      coldProbe.visibilityTransitions++
      if (document.hidden) coldProbe.hiddenDuringProfile = true
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

    // Read-only diagnostic probes: never alter the scene or visual quality.
  const programSnapshot = () => (gl.info.programs ?? []).map((program, index) => {
    const p = program as unknown as { id?: number; name?: string; cacheKey?: string }
    return { id: p.id ?? index, name: p.name ?? '', key: String(p.cacheKey ?? '').slice(0, 500) }
  })
  useLayoutEffect(() => {
    if (!coldProbe.running || coldProbe.reactCommits.length >= 16) return
    coldProbe.reactCommits.push({
      atMs: Math.round(performance.now() - coldProbe.started),
      durationMs: Math.round(performance.now() - renderStartedAt),
      mode: st.mode,
    })
  })
  useEffect(() => {
    if (typeof PerformanceObserver !== 'function') return
    const observers: PerformanceObserver[] = []
    for (const type of ['longtask', 'long-animation-frame']) {
      try {
        const observer = new PerformanceObserver(list => {
          for (const entry of list.getEntries()) {
            if (coldProbe.started <= 0 || entry.startTime < coldProbe.started - 40 || entry.startTime > coldProbe.started + 3500 || performance.now() - coldProbe.started > 20000 || coldProbe.browserTasks.length >= 30) continue
            const e = entry as PerformanceEntry & {
              blockingDuration?: number
              scripts?: Array<{ duration?: number; invoker?: string; sourceURL?: string }>
            }
            coldProbe.browserTasks.push({
              type: entry.entryType,
              atMs: Math.round(entry.startTime - coldProbe.started),
              durationMs: Math.round(entry.duration),
              blockingMs: Math.round(e.blockingDuration ?? 0),
              scripts: (e.scripts ?? []).slice(0, 4).map(x => ({
                durationMs: Math.round(x.duration ?? 0),
                invoker: String(x.invoker ?? '').slice(0, 140),
                sourceURL: String(x.sourceURL ?? '').slice(0, 140),
              })),
            })
          }
        })
        observer.observe({ type, buffered: false })
        observers.push(observer)
      } catch { /* feature unsupported */ }
    }
    return () => observers.forEach(observer => observer.disconnect())
  }, [])

    const tmp = useMemo(
    () => ({
      a: new THREE.Vector3(),
      b: new THREE.Vector3(),
      c: new THREE.Vector3(),
      tgt: new THREE.Vector3(),
      dir: new THREE.Vector3(),
      q: new THREE.Quaternion(),
      Y: new THREE.Vector3(0, 1, 0),
    }),
    [],
  )

  useWorldColliders(ex, [
    { type: 'circle', x: -2.1, z: 0.5, r: 1.9 },
    { type: 'circle', x: 2.1, z: 0.5, r: 1.9 },
    { type: 'circle', x: 0, z: -2, r: 1.5 },
    { type: 'box', x: CONSOLE_POS[0], z: CONSOLE_POS[2], hw: 1.65, hd: 0.72 },
  ])

  useEffect(() => {
    busRef.current = audio.createBus('robot', worldPos(ex, 0, 6, 1), { ref: 8, rolloff: 1.0, maxDist: 170, reverb: 0.4, gain: 1 })
    if (window.location.hash.includes('summoned')) {
      apexProgress.current = 1
      ragProgress.current = 1
      apexScanY.current = 6
      ragScanY.current = 6
      apexActive.current = true
      ragActive.current = true
      st.mode = 'active'
      setApexSummoned(true)
      setRagSummoned(true)
      setArenaModeUi('active')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => () => {
    apexColliderRemove.current?.()
    ragColliderRemove.current?.()
    apexColliderRemove.current = null
    ragColliderRemove.current = null
  }, [])

  const disp = useMemo(() => canvasTex(640, 200, () => {}), [])
  const consoleScreen = useMemo(() => canvasTex(512, 192, () => {}), [])
  // This texture depends ONLY on the arena mode. Redrawing it every 0.18s
  // reuploads an unchanged 512x192 texture to the GPU and contends with the
  // shadow/compositor work during a cold summon. Preserve every pixel while
  // uploading only when the console's actual content changes.
  const lastConsoleMode = useRef<ArenaMode | null>(null)

  const drawChestLED = (t: number, waving: boolean) => {
    const { ctx, tex } = disp
    const W = 640
    const H = 200
    ctx.fillStyle = '#05080f'
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = 'rgba(255,140,40,0.06)'
    for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1)

    if (waving) {
      ctx.textAlign = 'center'
      ctx.fillStyle = '#7fe9ff'
      ctx.shadowColor = '#38d9ff'
      ctx.shadowBlur = 20
      ctx.font = `700 72px ${FONT}`
      ctx.fillText('XIN CHÀO!', W / 2, 98)
      ctx.font = `500 24px ${FONT}`
      ctx.fillStyle = '#fff'
      ctx.fillText('COLOSSUS · GAME FABRICATOR', W / 2, 148)
      ctx.shadowBlur = 0
    } else if (st.mode === 'summon_apex' || st.mode === 'summon_rag') {
      const target = st.mode === 'summon_apex' ? 'APEX CHAOS' : 'RAGNAROK'
      const pct = Math.round((st.mode === 'summon_apex' ? apexProgress.current : ragProgress.current) * 100)
      ctx.textAlign = 'left'
      ctx.fillStyle = st.mode === 'summon_apex' ? '#ff941f' : '#5dffb0'
      ctx.font = `700 24px ${FONT}`
      ctx.fillText('LASER FABRICATION // ACTIVE', 28, 44)
      ctx.fillStyle = '#ffffff'
      ctx.font = `800 50px ${FONT}`
      ctx.fillText(target, 28, 112)
      ctx.fillStyle = 'rgba(255,255,255,0.14)'
      roundRect(ctx, 28, 138, W - 56, 20, 8)
      ctx.fill()
      ctx.fillStyle = st.mode === 'summon_apex' ? '#ff941f' : '#5dffb0'
      roundRect(ctx, 28, 138, Math.max(18, ((W - 56) * pct) / 100), 20, 8)
      ctx.fill()
    } else if (st.mode === 'retracting') {
      ctx.textAlign = 'center'
      ctx.fillStyle = '#ff6b5a'
      ctx.font = `700 42px ${FONT}`
      ctx.fillText('RETRACTING EXHIBITS…', W / 2, 112)
    } else {
      ctx.textAlign = 'left'
      ctx.fillStyle = st.mode === 'active' ? '#5dffb0' : '#ff9a3d'
      ctx.font = `600 22px ${FONT}`
      ctx.fillText(st.mode === 'active' ? 'GAME SHOWCASE // LIVE' : 'COLOSSUS // STANDBY', 28, 40)
      ctx.fillStyle = st.mode === 'active' ? '#5dffb0' : '#ff9a3d'
      ctx.beginPath()
      ctx.arc(W - 40, 32, 8 + Math.sin(t * 4) * 2, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#9aa7c2'
      ctx.font = `500 24px ${FONT}`
      ctx.fillText(st.mode === 'active' ? 'SUMMONED WORLDS' : 'PROMPT TO PLAY · GAMES', 28, 96)
      ctx.fillStyle = '#fff'
      ctx.font = `700 46px ${FONT}`
      ctx.fillText(st.mode === 'active' ? 'APEX · RAGNAROK' : 'CLICK TO SUMMON', 28, 154)
      for (let b = 0; b < 16; b++) {
        const h = 12 + (Math.sin(t * 3 + b * 0.8) * 0.5 + 0.5) * 65
        ctx.fillStyle = st.mode === 'active' ? `hsl(${150 + b * 4},90%,58%)` : `hsl(${25 + b * 3},100%,58%)`
        roundRect(ctx, 430 + b * 11, 186 - h, 7, h, 2)
        ctx.fill()
      }
    }
    tex.needsUpdate = true
  }

  const drawConsole = () => {
    if (lastConsoleMode.current === st.mode) return
    const { ctx, tex } = consoleScreen
    const W = 512
    const H = 192
    ctx.fillStyle = '#070b14'
    ctx.fillRect(0, 0, W, H)
    ctx.strokeStyle = '#38d9ff'
    ctx.lineWidth = 4
    roundRect(ctx, 8, 8, W - 16, H - 16, 16)
    ctx.stroke()
    ctx.textAlign = 'left'
    ctx.fillStyle = '#7fe9ff'
    ctx.font = `700 20px ${FONT}`
    ctx.fillText('COLOSSUS // GAME PROJECTOR', 26, 44)
    ctx.fillStyle = '#ffffff'
    ctx.font = `700 34px ${FONT}`
    const line =
      st.mode === 'dormant'
        ? 'NHẤN ĐỂ TRIỆU HỒI 2 GAME'
        : st.mode === 'summon_apex'
          ? 'ĐANG DỰNG: APEX CHAOS…'
          : st.mode === 'summon_rag'
            ? 'ĐANG DỰNG: RAGNAROK…'
            : st.mode === 'retracting'
              ? 'ĐANG THU HỒI MÔ HÌNH…'
              : 'ĐÃ DỰNG XONG · CHỌN GAME'
    ctx.fillText(line, 26, 98)
    ctx.fillStyle = 'rgba(255,255,255,0.65)'
    ctx.font = `500 18px ${FONT}`
    ctx.fillText('TRÁI: APEX CHAOS   |   GIỮA: TRIỆU HỒI/THU HỒI   |   PHẢI: RAGNAROK', 26, 152)
    lastConsoleMode.current = st.mode
    tex.needsUpdate = true
  }

  const startSummonAll = (single?: 'apex' | 'rag') => {
    // IMPORTANT: no hash-dependent work. Both URLs follow the same code path.
    {
      const warm = (window as unknown as { __orbitaColossusWarmup?: { status?: string } }).__orbitaColossusWarmup
      // Never let a repeat summon or an automated browser check read the
      // previous click's completed profile as though it were this activation.
      ;(window as unknown as { __orbitaColossusProfile?: unknown }).__orbitaColossusProfile = null
      coldProbe.running = true
      coldProbe.started = performance.now()
      coldProbe.frames = 0
      coldProbe.lastPostClickFrameAt = 0
      coldProbe.firstBeamFrameAtMs = null
      coldProbe.maxFrameMs = 0
      coldProbe.frameMsSum = 0
      coldProbe.clickHandlerMs = 0
      coldProbe.framesTrace.length = 0
      coldProbe.pageHiddenAtClick = document.hidden
      coldProbe.pageFocusedAtClick = document.hasFocus()
      coldProbe.hiddenDuringProfile = document.hidden
      coldProbe.visibilityTransitions = 0
      coldProbe.programsAtClick = programSnapshot()
      coldProbe.reactCommits.length = 0
      coldProbe.browserTasks = []
      coldProbe.warmStatusAtClick = warm?.status ?? 'not-started'
      console.info('[Colossus] Laser clicked; GPU warmup status:', coldProbe.warmStatusAtClick)
    }
    // Separate immediate JS/audio callback cost from first-draw GPU cost.
    const recordClick = () => {
      if (!coldProbe.running) return
      coldProbe.clickHandlerMs = Math.round(performance.now() - coldProbe.started)
    }
        const bus = busRef.current
    if (single === 'apex') {
      st.singleOnly = true
      st.mode = 'summon_apex'
      st.modeT = 0
      apexProgress.current = 0
      apexActive.current = false
      setApexSummoned(false)
      setArenaModeUi('summon_apex')
      if (bus) {
        audio.servo(bus, 1.0)
        audio.laserSweep(bus, 2.3)
      }
      toast('Colossus: Đang dùng laser dựng APEX CHAOS…')
      recordClick()
      return
    }
    if (single === 'rag') {
      st.singleOnly = true
      st.mode = 'summon_rag'
      st.modeT = 0
      ragProgress.current = 0
      ragActive.current = false
      setRagSummoned(false)
      setArenaModeUi('summon_rag')
      if (bus) {
        audio.servo(bus, 1.0)
        audio.laserSweep(bus, 2.3)
      }
      toast('Colossus: Đang dùng laser dựng RAGNAROK…')
      recordClick()
      return
    }
    st.singleOnly = false
    st.mode = 'summon_apex'
    st.modeT = 0
    apexProgress.current = 0
    ragProgress.current = 0
    apexActive.current = false
    ragActive.current = false
    setApexSummoned(false)
    setRagSummoned(false)
    setArenaModeUi('summon_apex')
    if (bus) {
      audio.servo(bus, 1.2)
      audio.robotBoom(bus)
      audio.laserSweep(bus, 2.4)
    }
    toast('Colossus kích hoạt — Đang dựng hình 3D bằng laser!')
      recordClick()
  }

  const startRetract = () => {
    st.mode = 'retracting'
    st.modeT = 0
    apexActive.current = false
    ragActive.current = false
    setApexSummoned(false)
    setRagSummoned(false)
    setArenaModeUi('retracting')
    if (busRef.current) audio.retractSweep(busRef.current)
    toast('Colossus: Thu hồi hai thế giới game…')
  }

  const toggleMainSummon = () => {
    btnPress[1] = 1
    if (st.mode === 'dormant') startSummonAll()
    else if (st.mode === 'active') startRetract()
  }

  const onColossusClick = () => {
    const now = performance.now() / 1000
    if (st.mode === 'dormant') {
      st.wave = now
      startSummonAll()
      return
    }
    if (now - st.wave < 4.4) return
    st.wave = now
    const bus = busRef.current
    if (bus) {
      audio.servo(bus, 1.1)
      audio.robotBoom(bus)
    }
    audio.speak('Xin chào! Tôi là Colossus. Hãy khám phá hai thế giới game phía trước.')
    toast('Colossus: "Xin chào!"')
  }

  // Stable child inputs keep the (large) showcase subtrees out of unrelated
  // React reconciliations when Colossus changes its own interaction state.
  const apexWorldPos = useMemo<[number, number, number]>(() =>
    [ex.x + APEX_POS[0], APEX_POS[1], ex.z + APEX_POS[2]], [])
  const ragWorldPos = useMemo<[number, number, number]>(() =>
    [ex.x + RAG_POS[0], RAG_POS[1], ex.z + RAG_POS[2]], [])
  const requestApex = useCallback(() => startSummonAll('apex'), [])
  const requestRag = useCallback(() => startSummonAll('rag'), [])
  const focusApex = useCallback(() => { st.focusedGame = 'APEX CHAOS' }, [])
  const focusRag = useCallback(() => { st.focusedGame = 'RAGNAROK' }, [])

  const laserGeo = useMemo(() => beamGeometry(1, 0.24, 0.04, 14), [])
  const laserMatApex = useMemo(() => beamMaterial('#ff9b30', 2.0), [])
  const laserMatRag = useMemo(() => beamMaterial('#5dffb0', 2.0), [])
  const glow = useMemo(() => glowTexture(), [])

  const orientBeam = (mesh: THREE.Mesh | null, p0: THREE.Vector3, p1: THREE.Vector3, colorHex: string) => {
    if (!mesh) return
    tmp.dir.subVectors(p1, p0)
    const len = tmp.dir.length()
    if (len < 0.05) {
      mesh.visible = false
      return
    }
    mesh.visible = true
    mesh.position.copy(p0)
    tmp.dir.divideScalar(len)
    tmp.q.setFromUnitVectors(tmp.Y, tmp.dir)
    mesh.quaternion.copy(tmp.q)
    mesh.scale.set(1, len, 1)
    const mat = mesh.material as THREE.ShaderMaterial
    if (mat.uniforms?.uColor) (mat.uniforms.uColor.value as THREE.Color).set(colorHex)
  }

  useFrame((state, dtRaw) => {
    if (coldProbe.running) {
      coldProbe.frames++
      // R3F dtRaw on the FIRST post-click frame includes time BEFORE the
      // input event. Never charge that pre-click gap to trigger latency.
      // Time first callback from click, then subsequent callback-to-callback.
      const frameAt = performance.now()
      const atMs = Math.round(frameAt - coldProbe.started)
      const dtMs = coldProbe.lastPostClickFrameAt > 0
        ? frameAt - coldProbe.lastPostClickFrameAt
        : frameAt - coldProbe.started
      coldProbe.lastPostClickFrameAt = frameAt
      coldProbe.frameMsSum += dtMs
      coldProbe.maxFrameMs = Math.max(coldProbe.maxFrameMs, dtMs)
      if (coldProbe.framesTrace.length < 190) coldProbe.framesTrace.push({
        atMs, dtMs: Math.round(dtMs), programs: state.gl.info.programs?.length ?? 0, mode: st.mode,
        hidden: document.hidden, focused: document.hasFocus(),
      })
      if (atMs > 3000) {
        coldProbe.running = false
        const trace = coldProbe.framesTrace
        const initial = trace[0]?.programs ?? 0
        const final = trace.at(-1)?.programs ?? initial
        const programIdsAtClick = new Set(coldProbe.programsAtClick.map(p => p.id))
        const newPrograms = programSnapshot().filter(p => !programIdsAtClick.has(p.id))
                const report = {
          warmStatusAtClick: coldProbe.warmStatusAtClick,
          warmup: (window as unknown as { __orbitaColossusWarmup?: unknown }).__orbitaColossusWarmup,
          clickHandlerMs: coldProbe.clickHandlerMs,
          firstFrameFromClickMs: trace[0]?.atMs ?? null,
          firstBeamFrameAtMs: coldProbe.firstBeamFrameAtMs,
          frameMeasureOrigin: 'performance.now at click; never prior R3F dtRaw',
          pageHiddenAtClick: coldProbe.pageHiddenAtClick,
          pageFocusedAtClick: coldProbe.pageFocusedAtClick,
          hiddenDuringProfile: coldProbe.hiddenDuringProfile,
          visibilityTransitions: coldProbe.visibilityTransitions,
          totalFrames: coldProbe.frames,
          maxFrameMs: Math.round(coldProbe.maxFrameMs),
          avgFrameMs: Math.round(coldProbe.frameMsSum / Math.max(1, coldProbe.frames)),
          programDelta: final - initial,
          newPrograms,
          reactCommits: [...coldProbe.reactCommits],
          browserTasks: coldProbe.browserTasks,
          longFrames: trace.filter(x => x.dtMs >= 34),
          trace,
        }
        ;(window as unknown as { __orbitaColossusProfile: typeof report }).__orbitaColossusProfile = report
        const w = window as unknown as { __orbitaColossusProfiles?: Array<typeof report> }
        const history = (w.__orbitaColossusProfiles ??= [])
        history.push(report)
        if (history.length > 8) history.shift()
        console.info('[Colossus] First-trigger CPU/GPU profile:', report)
      }
    }
        const dt = Math.min(dtRaw, 0.05)
    const t = state.clock.elapsedTime
    const now = performance.now() / 1000
    const cam = state.camera.position
    const dx = cam.x - ex.x
    const dz = cam.z - ex.z
    const dist = Math.hypot(dx, dz)

    // Hidden projector stands must not leave invisible collision barriers.
    const ensurePlinth = (progress: number, local: [number, number, number], ref: React.MutableRefObject<null | (() => void)>) => {
      if (progress > 0.09 && !ref.current) {
        const world = worldPos(ex, local[0], 0, local[2])
        ref.current = addCollider({ type: 'circle', x: world.x, z: world.z, r: 3.15 })
      } else if (progress <= 0.09 && ref.current) {
        ref.current()
        ref.current = null
      }
    }
    ensurePlinth(apexProgress.current, APEX_POS, apexColliderRemove)
    ensurePlinth(ragProgress.current, RAG_POS, ragColliderRemove)

    // ----- State machine for Laser Summoning -----
    st.modeT += dt
    const SUMMON_DUR = 2.5
    let targetTorsoYaw = 0
    let targetTorsoPitch = 0
    let targetHeadYaw = THREE.MathUtils.clamp(Math.atan2(dx, dz), -1.15, 1.15)
    let targetHeadPitch = THREE.MathUtils.clamp(Math.atan2(11 - cam.y, Math.max(8, dist)), -0.3, 0.5)
    let targetArmLPitch = Math.sin(t * 0.5) * 0.03
    let targetArmLRoll = -0.05 - Math.sin(t * 0.7 + 1) * 0.025
    let targetArmRPitch = Math.sin(t * 0.55) * 0.03
    let targetArmRRoll = 0.05 + Math.sin(t * 0.7) * 0.025
    let showLasers = false
    let laserColor = '#38d9ff'

    if (st.mode === 'summon_apex') {
      const p = THREE.MathUtils.clamp(st.modeT / SUMMON_DUR, 0, 1)
      apexProgress.current = p
      const scanLocalY = 0.35 + p * 4.5
      apexScanY.current = scanLocalY
      // Aim torso, head & both laser gauntlets at Left Plinth!
      targetTorsoYaw = -0.78
      targetTorsoPitch = 0.1
      targetHeadYaw = -0.15
      targetHeadPitch = 0.38
      targetArmRPitch = -1.05 + Math.sin(t * 7) * 0.06
      targetArmRRoll = 0.18
      targetArmLPitch = -0.92 - Math.sin(t * 7) * 0.06
      targetArmLRoll = 0.35
      showLasers = p > 0.08
      laserColor = '#ff9b30'
      tmp.tgt.set(ex.x + APEX_POS[0] + Math.sin(t * 8) * 0.75, scanLocalY, ex.z + APEX_POS[2] + Math.cos(t * 6) * 0.65)
      if (p >= 1) {
        apexActive.current = true
        setApexSummoned(true)
        if (busRef.current) audio.materializeChime(busRef.current, 1.0)
        if (st.singleOnly) {
          st.mode = 'active'
          st.modeT = 0
          setArenaModeUi('active')
          toast('APEX CHAOS: NEWBOT đã sẵn sàng!')
        } else {
          st.mode = 'summon_rag'
          st.modeT = 0
          setArenaModeUi('summon_rag')
          if (busRef.current) audio.laserSweep(busRef.current, SUMMON_DUR)
          toast('Colossus: Chuyển tia laser dựng RAGNAROK…')
        }
      }
    } else if (st.mode === 'summon_rag') {
      const p = THREE.MathUtils.clamp(st.modeT / SUMMON_DUR, 0, 1)
      ragProgress.current = p
      const scanLocalY = 0.35 + p * 4.5
      ragScanY.current = scanLocalY
      targetTorsoYaw = 0.78
      targetTorsoPitch = 0.1
      targetHeadYaw = 0.15
      targetHeadPitch = 0.38
      targetArmLPitch = -1.05 + Math.sin(t * 7) * 0.06
      targetArmLRoll = -0.18
      targetArmRPitch = -0.92 - Math.sin(t * 7) * 0.06
      targetArmRRoll = -0.35
      showLasers = p > 0.08
      laserColor = '#5dffb0'
      tmp.tgt.set(ex.x + RAG_POS[0] + Math.sin(t * 8) * 0.75, scanLocalY, ex.z + RAG_POS[2] + Math.cos(t * 6) * 0.65)
      if (p >= 1) {
        ragActive.current = true
        setRagSummoned(true)
        if (busRef.current) audio.materializeChime(busRef.current, 1.18)
        st.mode = 'active'
        st.modeT = 0
        setArenaModeUi('active')
        toast('Triển lãm Game hoàn tất — hãy đi quanh để tương tác!')
      }
    } else if (st.mode === 'retracting') {
      const p = THREE.MathUtils.clamp(1 - st.modeT / 1.15, 0, 1)
      if (apexProgress.current > 0) apexProgress.current = Math.min(apexProgress.current, p)
      if (ragProgress.current > 0) ragProgress.current = Math.min(ragProgress.current, p)
      apexScanY.current = 0.35 + apexProgress.current * 4.5
      ragScanY.current = 0.35 + ragProgress.current * 4.5
      if (p <= 0) {
        apexProgress.current = 0
        ragProgress.current = 0
        st.mode = 'dormant'
        st.modeT = 0
        setArenaModeUi('dormant')
        toast('Hai thế giới game đã được thu hồi.')
      }
    } else {
      targetTorsoYaw = targetHeadYaw * 0.28
      targetHeadYaw = targetHeadYaw - targetTorsoYaw
    }

    // Smooth mechanical interpolation
    const kArm = 1 - Math.exp(-(showLasers ? 5.2 : 2.6) * dt)
    const oldYaw = st.yaw
    st.yaw += (targetHeadYaw - st.yaw) * (1 - Math.exp(-3.2 * dt))
    st.pitch += (targetHeadPitch - st.pitch) * (1 - Math.exp(-3.2 * dt))
    st.torsoYaw += (targetTorsoYaw - st.torsoYaw) * kArm
    st.torsoPitch += (targetTorsoPitch - st.torsoPitch) * kArm
    st.armLPitch += (targetArmLPitch - st.armLPitch) * kArm
    st.armLRoll += (targetArmLRoll - st.armLRoll) * kArm
    st.armRPitch += (targetArmRPitch - st.armRPitch) * kArm
    st.armRRoll += (targetArmRRoll - st.armRRoll) * kArm

    st.servoAcc += Math.abs(st.yaw - oldYaw)
    if (st.servoAcc > 0.28 && now - st.lastServo > 2.0 && busRef.current && dist < 90 && !showLasers) {
      st.servoAcc = 0
      st.lastServo = now
      audio.servo(busRef.current, 0.55)
    }

    if (head.current) {
      head.current.rotation.y = st.yaw
      head.current.rotation.x = st.pitch
    }
    if (torso.current) {
      torso.current.rotation.y = st.torsoYaw
      torso.current.rotation.x = st.torsoPitch
      torso.current.scale.y = 1 + Math.sin(t * 1.2) * 0.006
    }

    const kk = now - st.wave
    const waving = kk >= 0 && kk < 4.4 && !showLasers
    const raise = waving ? THREE.MathUtils.smoothstep(kk, 0, 0.9) * (1 - THREE.MathUtils.smoothstep(kk, 3.5, 4.4)) : 0
    if (armR.current) {
      armR.current.rotation.z = raise * 2.55 + st.armRRoll * (1 - raise)
      armR.current.rotation.x = -raise * 0.25 + st.armRPitch * (1 - raise)
    }
    if (foreR.current) foreR.current.rotation.z = raise * Math.sin(kk * 7) * 0.6 + (1 - raise) * 0.05
    if (armL.current) {
      armL.current.rotation.z = st.armLRoll
      armL.current.rotation.x = st.armLPitch
    }
    if (foreL.current) foreL.current.rotation.z = -0.05

    // Update 3 world-space laser beams from Colossus emitters -> moving target on plinth!
    if (showLasers && emitterL.current && emitterR.current && visorEmitter.current) {
      emitterL.current.getWorldPosition(tmp.a)
      emitterR.current.getWorldPosition(tmp.b)
      visorEmitter.current.getWorldPosition(tmp.c)
      // Convert world positions into Robot local space (Robot is at [ex.x, 0, ex.z], rotY = 0)
      tmp.a.x -= ex.x
      tmp.a.z -= ex.z
      tmp.b.x -= ex.x
      tmp.b.z -= ex.z
      tmp.c.x -= ex.x
      tmp.c.z -= ex.z
      tmp.tgt.x -= ex.x
      tmp.tgt.z -= ex.z
      orientBeam(beamL.current, tmp.a, tmp.tgt, laserColor)
      orientBeam(beamR.current, tmp.b, tmp.tgt, laserColor)
      orientBeam(beamEye.current, tmp.c, tmp.tgt, '#a6ecff')
      // Records when the real R3F callback first submitted visible laser
      // geometry. This is NOT a claim of display-present timing.
      if (coldProbe.started > 0 && coldProbe.firstBeamFrameAtMs === null && beamL.current?.visible) {
        coldProbe.firstBeamFrameAtMs = Math.round(performance.now() - coldProbe.started)
        const latest = (window as unknown as {
          __orbitaColossusProfile?: { firstBeamFrameAtMs: number | null }
        }).__orbitaColossusProfile
        if (latest) latest.firstBeamFrameAtMs = coldProbe.firstBeamFrameAtMs
      }
      if (impactFlare.current) {
        impactFlare.current.visible = true
        impactFlare.current.position.copy(tmp.tgt)
        impactFlare.current.scale.setScalar(2.4 + Math.sin(t * 24) * 0.6)
        ;(impactFlare.current.material as THREE.SpriteMaterial).color.set(laserColor)
      }
    } else {
      if (beamL.current) beamL.current.visible = false
      if (beamR.current) beamR.current.visible = false
      if (beamEye.current) beamEye.current.visible = false
      if (impactFlare.current) impactFlare.current.visible = false
    }

    // Floor conduits pulse with arena power
    if (conduitL.current) {
      const lit = st.mode === 'summon_apex' || apexActive.current
      conduitL.current.color.set('#ff941f').multiplyScalar(lit ? 2.4 + Math.sin(t * 6) * 0.4 : 0.45)
    }
    if (conduitR.current) {
      const lit = st.mode === 'summon_rag' || ragActive.current
      conduitR.current.color.set('#5dffb0').multiplyScalar(lit ? 2.4 + Math.sin(t * 6) * 0.4 : 0.45)
    }

    // Console button feedback
    for (let i = 0; i < 3; i++) {
      btnPress[i] = Math.max(0, btnPress[i] - dt * 4)
      const m = btnRefs.current[i]
      if (m) m.position.y = 0.06 - 0.035 * btnPress[i]
    }
    btnMats[0].color.set('#ff941f').multiplyScalar(apexActive.current ? 2.6 : 1.0)
    btnMats[1].color.set(st.mode === 'active' ? '#ff6a5a' : '#38d9ff').multiplyScalar(2.2 + Math.sin(t * 3) * 0.4)
    btnMats[2].color.set('#5dffb0').multiplyScalar(ragActive.current ? 2.6 : 1.0)

    if (eyes.current) {
      const blink = Math.sin(t * 0.7) > 0.985 ? 0.1 : 1
      const flash = waving || showLasers ? 1 : 0
      eyes.current.color.copy(eyeColor).lerp(new THREE.Color(1.4, 2.7, 3.2), flash * 0.75).multiplyScalar((0.85 + 0.15 * Math.sin(t * 3)) * blink)
    }
    const pulse = 0.75 + 0.25 * Math.sin(t * 2.2) + (waving || showLasers ? 0.45 : 0)
    if (reactor.current) reactor.current.scale.setScalar(pulse)
    if (reactorLight.current) reactorLight.current.intensity = 160 * pulse

    if (t - st.lastDraw > 0.18 && dist < 110) {
      st.lastDraw = t
      drawChestLED(t, waving)
      drawConsole()
    }
  })

  return (
    <group position={[ex.x, 0, ex.z]}>
      <PadRing radius={13.8} color={ex.color} />
      <PadRing radius={10.2} color="#ffffff" y={0.08} tube={0.04} intensity={1.1} />
      <Label title="Colossus" sub="Game Showcase · Laser Summoning" color={ex.color} position={[0, 17.5, 0]} scale={1.5} fadeFar={140} />
      <Spot position={[10, 26, 28]} target={[0, 6, 0]} color="#ffe6cc" intensity={3200} angle={0.36} distance={110} />
      <pointLight position={[0, 13, -11]} color="#ff8a3d" intensity={900} distance={50} decay={2} />

      {/* Main Robot Pedestal */}
      <mesh position={[0, 0.2, 0]} material={mats.darkMetal} receiveShadow>
        <cylinderGeometry args={[6.2, 6.6, 0.4, 48]} />
      </mesh>

      {/* Floor Energy Conduits connecting Colossus -> Left & Right Game Plinths */}
      <mesh position={[-4.25, 0.05, 3.4]} rotation={[0, -0.89, 0]}>
        <boxGeometry args={[0.24, 0.04, 10.6]} />
        <meshBasicMaterial ref={conduitL} color="#ff941f" toneMapped={false} />
      </mesh>
      <mesh position={[4.25, 0.05, 3.4]} rotation={[0, 0.89, 0]}>
        <boxGeometry args={[0.24, 0.04, 10.6]} />
        <meshBasicMaterial ref={conduitR} color="#5dffb0" toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.05, 4.9]}>
        <boxGeometry args={[0.22, 0.04, 9.6]} />
        <meshBasicMaterial color={new THREE.Color('#38d9ff').multiplyScalar(1.4)} toneMapped={false} />
      </mesh>

      {/* Colossus 12m Mech */}
      <group position={[0, 0.4, 0]} scale={SC}>
        {[-1, 1].map((s) => (
          <group key={s}>
            <Part s={[3.1, 0.8, 4.6]} p={[s * 2.7, 0.4, 0.6]} r={0.3} />
            <Part s={[3.1, 0.3, 1.1]} p={[s * 2.7, 0.55, 2.7]} m={accent} r={0.1} />
            <mesh position={[s * 2.7, 1.2, 0]} rotation={[0, 0, Math.PI / 2]} material={mats.darkMetal} castShadow>
              <cylinderGeometry args={[0.75, 0.75, 1.9, 24]} />
            </mesh>
            <Part s={[1.9, 3.0, 2.3]} p={[s * 2.7, 2.7, 0]} />
            <Part s={[1.5, 2.4, 0.4]} p={[s * 2.7, 2.8, 1.2]} m={mats.silver} r={0.12} />
            <Part s={[1.95, 0.25, 2.35]} p={[s * 2.7, 1.7, 0]} m={accent} r={0.08} />
            <mesh position={[s * 2.7, 4.5, 0.2]} material={mats.darkMetal} castShadow>
              <sphereGeometry args={[1.1, 24, 18]} />
            </mesh>
            <Part s={[1.7, 1.2, 1.0]} p={[s * 2.7, 4.5, 1.3]} r={0.3} />
            <Part s={[2.15, 2.6, 2.5]} p={[s * 2.7, 6.0, 0]} />
            <mesh position={[s * 2.8, 7.4, 0]} material={mats.darkMetal} castShadow>
              <sphereGeometry args={[1.15, 24, 18]} />
            </mesh>
          </group>
        ))}
        <Part s={[7.6, 1.7, 3.1]} p={[0, 7.7, 0]} m={mats.darkMetal} r={0.45} />
        <Part s={[7.7, 0.25, 3.2]} p={[0, 8.1, 0]} m={accent} r={0.08} />

        <group ref={torso} position={[0, 0, 0]}>
          <Part s={[3.8, 1.5, 2.5]} p={[0, 8.85, 0]} m={mats.darkMetal} r={0.4} />
          <Part s={[6.6, 3.7, 3.5]} p={[0, 10.7, 0]} r={0.65} />
          <Part s={[5.4, 0.7, 3.1]} p={[0, 12.6, 0]} m={mats.darkMetal} r={0.3} />
          <Part s={[4.2, 1.5, 0.35]} p={[0, 11.35, 1.78]} m={mats.darkMetal} r={0.12} />
          <mesh position={[0, 11.35, 1.97]}>
            <planeGeometry args={[3.9, 1.22]} />
            <meshBasicMaterial map={disp.tex} toneMapped={false} />
          </mesh>
          <mesh position={[0, 9.75, 1.78]} rotation={[Math.PI / 2, 0, 0]} material={mats.darkMetal}>
            <torusGeometry args={[0.95, 0.16, 12, 40]} />
          </mesh>
          <mesh ref={reactor} position={[0, 9.75, 1.82]} rotation={[Math.PI / 2, 0, 0]} material={glowMat}>
            <cylinderGeometry args={[0.7, 0.7, 0.2, 32]} />
          </mesh>
          <pointLight ref={reactorLight} position={[0, 9.75, 3.2]} color="#ff7a2a" intensity={160} distance={16} decay={2} />
          {[-1.9, 1.9].map((x) =>
            [0, 1, 2].map((i) => <Part key={x + '-' + i} s={[1.3, 0.12, 0.1]} p={[x, 9.9 + i * 0.28, 1.78]} m={mats.darkMetal} r={0.04} />),
          )}
          <Part s={[3.8, 3.2, 1.3]} p={[0, 10.8, -2.3]} m={mats.darkMetal} r={0.4} />
          {[-1.1, 1.1].map((x) => (
            <group key={x} position={[x, 9.6, -2.4]}>
              <mesh rotation={[Math.PI / 2, 0, 0]} material={mats.silver}>
                <cylinderGeometry args={[0.6, 0.75, 1.1, 20]} />
              </mesh>
              <mesh position={[0, 0, -0.58]} rotation={[Math.PI / 2, 0, 0]} material={glowMat}>
                <circleGeometry args={[0.5, 20]} />
              </mesh>
            </group>
          ))}

          <Arm side={1} armRef={armR} foreRef={foreR} emitterRef={emitterR} />
          <Arm side={-1} armRef={armL} foreRef={foreL} emitterRef={emitterL} />

          <mesh position={[0, 13.2, 0]} material={mats.darkMetal} castShadow>
            <cylinderGeometry args={[0.65, 0.8, 0.9, 20]} />
          </mesh>
          <group ref={head} position={[0, 13.5, 0]}>
            <Part s={[3.2, 2.4, 3.0]} p={[0, 1.2, 0]} r={0.7} />
            <Part s={[2.7, 1.0, 0.35]} p={[0, 1.3, 1.45]} m={mats.lacquer} r={0.2} />
            {[-0.68, 0.68].map((x) => (
              <mesh key={x} position={[x, 1.3, 1.64]} geometry={rbox(0.82, 0.3, 0.06, 0.1)}>
                <meshBasicMaterial ref={x < 0 ? eyes : undefined} color={eyeColor} toneMapped={false} />
              </mesh>
            ))}
            <mesh ref={visorEmitter} position={[0, 1.3, 1.68]}>
              <sphereGeometry args={[0.12, 8, 8]} />
              <meshBasicMaterial visible={false} />
            </mesh>
            <Part s={[0.55, 0.5, 2.4]} p={[0, 2.6, -0.1]} m={accent} r={0.18} />
            {[-1, 1].map((s) => (
              <group key={s}>
                <mesh position={[s * 1.75, 1.2, 0]} rotation={[0, 0, Math.PI / 2]} material={mats.darkMetal} castShadow>
                  <cylinderGeometry args={[0.6, 0.6, 0.55, 20]} />
                </mesh>
                <mesh position={[s * 2.04, 1.2, 0]} rotation={[0, 0, Math.PI / 2]} material={glowMat}>
                  <cylinderGeometry args={[0.35, 0.35, 0.05, 20]} />
                </mesh>
                <mesh position={[s * 1.0, 3.3, -0.4]} material={mats.silver}>
                  <cylinderGeometry args={[0.06, 0.06, 1.8, 8]} />
                </mesh>
                <mesh position={[s * 1.0, 4.25, -0.4]} material={glowMat}>
                  <sphereGeometry args={[0.18, 12, 10]} />
                </mesh>
              </group>
            ))}
          </group>
        </group>
      </group>

      {/* Dynamic Laser Fabrication Beams (aimed at active plinth!) */}
      <mesh name="colossus-warm-beam-left" ref={beamL} geometry={laserGeo} material={laserMatApex} visible={false} />
      <mesh name="colossus-warm-beam-right" ref={beamR} geometry={laserGeo} material={laserMatRag} visible={false} />
      <mesh name="colossus-warm-beam-eye" ref={beamEye} geometry={laserGeo} material={laserMatRag} visible={false} />
      <sprite name="colossus-warm-impact" ref={impactFlare} scale={[2.5, 2.5, 1]} visible={false}>
        <spriteMaterial map={glow} color="#38d9ff" transparent opacity={0.85} blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>

      {/* Shader/texture preflight runs at idle, never in the summon click. */}
      <ShowcaseWarmup arenaState={st} />

      {/* Flanking Game Showcases */}
      <ApexShowcase
        position={APEX_POS}
        worldPosition={apexWorldPos}
        rotationY={0.42}
        summoned={apexSummoned}
        scanProgressRef={apexProgress}
        scanWorldYRef={apexScanY}
        activeRef={apexActive}
        onRequestSummon={requestApex}
        onFocus={focusApex}
      />
      <RagnarokShowcase
        position={RAG_POS}
        worldPosition={ragWorldPos}
        rotationY={-0.42}
        summoned={ragSummoned}
        scanProgressRef={ragProgress}
        scanWorldYRef={ragScanY}
        activeRef={ragActive}
        onRequestSummon={requestRag}
        onFocus={focusRag}
      />

      {/* Center Control Console Pylon */}
      <group position={CONSOLE_POS}>
        <mesh position={[0, 0.52, 0]} geometry={rbox(3.1, 1.04, 1.15, 0.1)} material={mats.darkMetal} castShadow receiveShadow />
        {arenaModeUi === 'dormant' && (
          <mesh position={[0, 1.7, 0]} rotation={[0.4, 0.7, 0]}>
            <octahedronGeometry args={[0.16, 0]} />
            <meshBasicMaterial color={new THREE.Color('#38d9ff').multiplyScalar(2.4)} toneMapped={false} />
          </mesh>
        )}
        <group position={[0, 1.08, 0]} rotation={[0.32, 0, 0]}>
          <mesh geometry={rbox(2.95, 0.12, 1.05, 0.05)} material={mats.lacquer} />
          <mesh position={[0, 0.075, -0.22]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[2.6, 0.5]} />
            <meshBasicMaterial map={consoleScreen.tex} toneMapped={false} />
          </mesh>
          {/* 3 Tactile Glowing Console Buttons */}
          {[
            { x: -0.92, id: 'console-apex', label: 'Bệ 01 · APEX CHAOS', hint: apexSummoned ? 'Mở hồ sơ APEX CHAOS' : 'Triệu hồi APEX CHAOS', panel: 'apex' as const, fn: () => { btnPress[0] = 1; if (!apexActive.current) startSummonAll('apex'); else openPanel('apex') } },
            { x: 0, id: 'console-summon', label: 'Colossus · Laser Summoner', hint: arenaModeUi === 'active' ? 'Thu hồi mô hình' : 'Triệu hồi cả 2 game bằng laser', panel: 'robot' as const, fn: toggleMainSummon },
            { x: 0.92, id: 'console-rag', label: 'Bệ 02 · RAGNAROK', hint: ragSummoned ? 'Mở hồ sơ Ragnarok' : 'Triệu hồi Ragnarok', panel: 'ragnarok' as const, fn: () => { btnPress[2] = 1; if (!ragActive.current) startSummonAll('rag'); else openPanel('ragnarok') } },
          ].map((b, i) => (
            <group key={b.id} position={[b.x, 0.08, 0.25]}>
              <mesh ref={(r) => { btnRefs.current[i] = r }} position={[0, 0.06, 0]} geometry={rbox(0.68, 0.1, 0.36, 0.04)} material={btnMats[i]} />
              <Hit id={b.id} label={b.label} hint={b.hint} panel={b.panel} maxDist={9} size={[0.76, 0.45, 0.45]} position={[0, 0.08, 0]} onClick={b.fn} />
            </group>
          ))}
        </group>
      </group>

      {/* Main Colossus Hitbox */}
      <Hit
        id="robot"
        label="Colossus · Game Fabricator"
        hint={arenaModeUi === 'dormant' ? 'Kích hoạt triệu hồi game bằng laser' : 'Vẫy chào'}
        panel="robot"
        maxDist={75}
        size={[9, 12.8, 5.4]}
        position={[0, 6.6, 0]}
        onClick={onColossusClick}
      />
    </group>
  )
}
