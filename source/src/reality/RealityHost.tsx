// ORBITA · Reality Rewrite — Host điều phối toàn bộ trải nghiệm.
// Bảo toàn nguyên vẹn Grand Piano (tách clone vật liệu dùng chung trước khi vá thế giới gốc),
// chuẩn bị tài nguyên GPU phân bổ đều theo từng khung hình (không khựng khi lại gần đàn lần đầu),
// và chuyển bài mượt mà ngay bên trong không gian UEH (Mưa Mùa Hạ <-> Hoa Phượng Trong Gió).
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { audio } from '../audio'
import { setInteractiveFilter, player } from '../world'
import { useStore, toast } from '../store'
import { FRONT_MAX, RW, ease, frontReached, patchOld } from './mask'
import { CENTER } from './site'
import { HexLattice, Ignition, StaffWall } from './Front'
import { Sheets } from './Sheets'
import { UEHWorld } from './worlds/UEH'
import { WU, reel } from './kit'
import { music } from './music'
import { TRACKS, type TrackId } from './tracks'
import { dismissReality, rt, useReality } from './state'

const IGNITE_S = 2.6
const SWEEP_S = 13
const RETRACT_S = 7.5
const curve = (u: number) => FRONT_MAX * Math.pow(Math.min(1, Math.max(0, u)), 1.5)

interface Managed {
  o: THREE.Object3D
  kind: 'mesh' | 'light' | 'sprite'
  c: THREE.Vector3
  r: number
  far: boolean
  hid: boolean
  castOrig: boolean
  inten: number
}

function underKeep(o: THREE.Object3D | null) {
  for (let p = o; p; p = p.parent) if (p.userData?.rwKeep) return true
  return false
}

// Bảng ánh sáng UEH: pha giữa "Hoa Phượng Trong Gió" (nắng chiều vàng) & "Cơn Mưa Mùa Hạ" (dịu mát man mác)
const GRADE_BLOSSOM = { sun: '#ffca82', sunI: 1.18, sky: '#a9c7e6', gnd: '#6b4e38', hemiI: 1.48, amb: '#ffd8a8', ambI: 1.85, env: 0.92 }
const GRADE_RAIN = { sun: '#c9d7ea', sunI: 0.82, sky: '#8fa6c4', gnd: '#484c54', hemiI: 1.55, amb: '#c4d2e6', ambI: 2.05, env: 0.85 }

export function RealityHost() {
  const { scene, camera, gl } = useThree()
  const ueh = useRef<THREE.Group>(null)
  const hostRoot = useRef<THREE.Group>(null)
  const S = useRef({
    managed: [] as Managed[],
    lights: [] as { o: THREE.Light; color: THREE.Color; gcolor?: THREE.Color; inten: number }[],
    envI: 1,
    baseFov: 72,
    u: 0,
    musicOn: false,
    lastPhase: 'idle',
    lastTrack: null as TrackId | null,
    lastSwitchSeq: 0,
    ignT: 0,
    warmStarted: false,
    warmTex: [] as THREE.Texture[],
    warmMesh: [] as THREE.Object3D[],
    warmCompilePending: false,
    warmErrors: 0,
    warmPass: 0, // 0: đang upload tex/compile, 1: đang bật 1 frame silent shadow warm, 2: xong hoàn toàn
  }).current

  const tmp = useMemo(() => new THREE.Vector3(), [])
  const tc = useMemo(() => new THREE.Color(), [])
  const tc2 = useMemo(() => new THREE.Color(), [])

  // HEX/UEH cooperative GPU preflight. Share source geometry and source materials;
  // never replace textures, reduce shadow resolution or mutate the visible scene.
  // A private 96px target uploads GPU resources a few meshes at a time, instead
  // of exposing the entire multi-building UEH world on the first ignition frame.
  const hexGpu = useRef({
    stage: null as THREE.Scene | null,
    target: null as THREE.WebGLRenderTarget | null,
    camera: null as THREE.PerspectiveCamera | null,
    proxies: [] as THREE.Object3D[],
    lights: [] as THREE.Light[],
    index: 0, lastPaintAt: 0, healthyPaints: 0, frame: 0,
    blocked: false,
    info: {
      status: 'scheduled', total: 0, uploaded: 0,
      maxPrivateCpuMs: 0, deferredFrames: 0,
      renderer: '', error: '', gpuTarget: 'private-96px',
    },
  }).current

  useEffect(() => {
    const stage = new THREE.Scene()
    stage.environment = scene.environment
    stage.fog = scene.fog
    const proxies: THREE.Object3D[] = []
    // Cloning without children reuses exactly the original GPU geometry,
    // material and instance buffers. This is not a simplified scene.
    ueh.current?.traverse((source) => {
      const draw = source as THREE.Mesh
      const sprite = source as THREE.Sprite
      const points = source as THREE.Points
      const line = source as THREE.Line
      if (!draw.isMesh && !sprite.isSprite && !points.isPoints && !line.isLine) return
      const proxy = source.clone(false)
      proxy.visible = true
      proxy.frustumCulled = false
      proxy.position.set(0, 0, 0)
      proxy.rotation.set(0, 0, 0)
      proxy.scale.setScalar(1)
      if ((source as THREE.InstancedMesh).isInstancedMesh) {
        const src = source as THREE.InstancedMesh
        const dst = proxy as THREE.InstancedMesh
        dst.instanceMatrix = src.instanceMatrix
        dst.instanceColor = src.instanceColor
      }
      proxies.push(proxy)
    })
    // Keep shader light-count/shadow defines representative of the real stage.
    scene.traverseVisible(o => {
      if (!(o as THREE.Light).isLight) return
      const light = (o as THREE.Light).clone(false)
      if ((light as THREE.DirectionalLight).target) {
        const target = (o as THREE.DirectionalLight).target.clone(false)
        ;(light as THREE.DirectionalLight).target = target
        stage.add(target)
      }
      if (light.castShadow && (light as THREE.Light & {shadow?:THREE.LightShadow}).shadow) {
        (light as THREE.Light & {shadow:THREE.LightShadow}).shadow.mapSize.set(64, 64)
      }
      stage.add(light)
      hexGpu.lights.push(light)
    })
    const target = new THREE.WebGLRenderTarget(96, 96, {
      depthBuffer: true, stencilBuffer: false,
    })
    target.texture.colorSpace = gl.outputColorSpace
    const cameraHex = new THREE.PerspectiveCamera(70, 1, 0.01, 9000)
    cameraHex.position.set(0, 4, 16)
    cameraHex.lookAt(0, 0, 0)
    hexGpu.stage = stage
    hexGpu.target = target
    hexGpu.camera = cameraHex
    hexGpu.proxies = proxies
    hexGpu.info.total = proxies.length
    const dbg = gl.getContext().getExtension('WEBGL_debug_renderer_info')
    hexGpu.info.renderer = String(gl.getContext().getParameter(
      dbg?.UNMASKED_RENDERER_WEBGL ?? gl.getContext().RENDERER))
    if (/SwiftShader|llvmpipe|Software/i.test(hexGpu.info.renderer)) {
      hexGpu.blocked = true
      hexGpu.info.status = 'skipped-software-renderer'
    } else hexGpu.info.status = 'awaiting-idle'
    ;(window as unknown as {__orbitaHexPrewarm:typeof hexGpu.info}).__orbitaHexPrewarm = hexGpu.info
    return () => {
      target.dispose()
      hexGpu.lights.forEach(l =>
        (l as THREE.Light & {shadow?:THREE.LightShadow}).shadow?.dispose())
      stage.clear()
      hexGpu.proxies.length = 0
      hexGpu.stage = null
      hexGpu.target = null
    }
  }, [scene, gl])

  useFrame((_, dtRaw) => {
    const h = hexGpu
    if (h.blocked || !h.stage || !h.target || !h.camera ||
        h.index >= h.proxies.length) return
    const realityPhase = useReality.getState().phase
    // No competition with a clicked HEX, landing GPU preflight, or Colossus.
    if (realityPhase !== 'idle' || useStore.getState().phase !== 'playing' ||
        document.visibilityState !== 'visible') return
    const landing = (window as unknown as {
      __orbitaLandingPrewarm?: {status:string}
    }).__orbitaLandingPrewarm
    const colossus = (window as unknown as {
      __orbitaColossusWarmup?: {status:string}
    }).__orbitaColossusWarmup
    const terminal = ['ready','failed','disabled','cancelled',
      'skipped-entered','skipped-busy-or-entered','skipped-software-renderer',
      'submitted-no-fence','prewarm-skipped-busy-renderer',
      'diagnostic-prewarm-disabled','cancelled-on-summon',
      'submitted-no-async-readback']
    if ((landing && !terminal.includes(landing.status)) ||
        (colossus && !terminal.includes(colossus.status))) {
      h.info.status = 'waiting-for-other-preflights'
      return
    }
    const pendingInput = (navigator as Navigator & {
      scheduling?:{isInputPending?:()=>boolean}
    }).scheduling?.isInputPending?.() ?? false
    // At most one small offscreen draw per three healthy frames.
    // A busy renderer or pending user input is always favored over prewarm.
    const healthy = dtRaw > 0 && dtRaw <= 0.05 && !pendingInput
    h.healthyPaints = healthy ? h.healthyPaints + 1 : 0
    if (h.healthyPaints < 3) { h.info.deferredFrames++; return }
    h.healthyPaints = 0
    const stage = h.stage, target = h.target
    const batch = h.proxies.slice(h.index, h.index + 3)
    const oldTarget = gl.getRenderTarget()
    const viewport = gl.getViewport(new THREE.Vector4()).clone()
    const scissor = gl.getScissor(new THREE.Vector4()).clone()
    const scissorTest = gl.getScissorTest()
    const xr = gl.xr.enabled, clear = gl.autoClear
    const rw = RW.uRW.value.clone(), center = RW.uRWc.value.clone()
    const started = performance.now()
    try {
      for (const obj of batch) stage.add(obj)
      RW.uRW.value.set(FRONT_MAX, RW.uRW.value.y, 1, RW.uRW.value.w)
      RW.uRWc.value.set(0, 0, 0)
      gl.xr.enabled = false
      gl.autoClear = true
      gl.setRenderTarget(target)
      gl.setViewport(0, 0, 96, 96)
      gl.setScissorTest(false)
      gl.clear(true, true, false)
      gl.render(stage, h.camera)
      h.index += batch.length
      h.info.uploaded = h.index
      h.info.status = h.index >= h.proxies.length ? 'ready' : 'warming-geometry'
      h.info.maxPrivateCpuMs = Math.max(h.info.maxPrivateCpuMs,
        Math.round(performance.now() - started))
      // Do not make the visible portfolio pay for a saturated renderer.
      if (performance.now() - started > 75) {
        h.blocked = true
        h.info.status = 'paused-expensive-private-draw'
      }
    } catch (e) {
      h.info.error = String(e)
      h.info.status = 'failed'
      h.blocked = true
    } finally {
      RW.uRW.value.copy(rw)
      RW.uRWc.value.copy(center)
      for (const obj of batch) stage.remove(obj)
      gl.setRenderTarget(oldTarget)
      gl.setViewport(viewport)
      gl.setScissor(scissor)
      gl.setScissorTest(scissorTest)
      gl.xr.enabled = xr
      gl.autoClear = clear
    }
  })
  const recordHexTiming = (step: string, started: number) => {
    if (typeof window === 'undefined' || new URLSearchParams(location.search).get('hexProfile') !== '1') return
    const host = window as unknown as {__orbitaHexTimings?: Array<{step:string;ms:number;at:number}>}
    const rows = host.__orbitaHexTimings ?? (host.__orbitaHexTimings = [])
    rows.push({ step, ms: Math.round((performance.now()-started)*10)/10, at: Math.round(performance.now()) })
    if (rows.length > 100) rows.shift()
  }

  // Tách riêng vật liệu dùng chung trên các đối tượng cần giữ nguyên (như Grand Piano dùng chung mats.lacquer/gold/silver)
  // để patchOld KHÔNG bao giờ vô tình cắt mất thân đàn, nắp đàn, chân và bàn đạp!
  const isolateKeepMaterials = () => {
    const keepObjs: THREE.Mesh[] = []
    const outsideMats = new Set<THREE.Material>()

    const visit = (o: THREE.Object3D) => {
      if (o === hostRoot.current) return
      const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined
      if (m) {
        if (underKeep(o)) keepObjs.push(o as THREE.Mesh)
        else (Array.isArray(m) ? m : [m]).forEach((mat) => outsideMats.add(mat))
      }
      o.children.forEach(visit)
    }
    visit(scene)

    const clonedMap = new Map<THREE.Material, THREE.Material>()
    const getIsolated = (mat: THREE.Material) => {
      if (mat.userData?.__rwIsolated) return mat
      if (!outsideMats.has(mat)) return mat
      let copy = clonedMap.get(mat)
      if (!copy) {
        copy = mat.clone()
        copy.userData = { ...copy.userData, __rwIsolated: true }
        clonedMap.set(mat, copy)
      }
      return copy
    }

    keepObjs.forEach((o) => {
      const m = o.material
      if (Array.isArray(m)) o.material = m.map(getIsolated)
      else o.material = getIsolated(m)
    })
  }

  const patchAll = () => {
    const started = performance.now()
    isolateKeepMaterials()
    const visit = (o: THREE.Object3D) => {
      if (o.userData?.rwKeep) return
      const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined
      if (m) patchOld(m)
      o.children.forEach(visit)
    }
    visit(scene)
    recordHexTiming('patch-all', started)
  }

  const collect = () => {
    const started = performance.now()
    S.managed.length = 0
    S.lights.length = 0
    scene.updateMatrixWorld(true)
    const visit = (o: THREE.Object3D) => {
      if (o.userData?.rwKeep) return
      const any = o as THREE.Object3D & { isMesh?: boolean; isPoints?: boolean; isLine?: boolean; isSprite?: boolean; isLight?: boolean; geometry?: THREE.BufferGeometry }
      if (any.isLight) {
        if (any instanceof THREE.PointLight || any instanceof THREE.SpotLight) {
          const p = new THREE.Vector3().setFromMatrixPosition(any.matrixWorld)
          S.managed.push({ o, kind: 'light', c: p, r: 0, far: false, hid: false, castOrig: false, inten: any.intensity })
        } else if (any instanceof THREE.DirectionalLight || any instanceof THREE.HemisphereLight || any instanceof THREE.AmbientLight) {
          const l = any as THREE.Light
          S.lights.push({ o: l, color: l.color.clone(), gcolor: l instanceof THREE.HemisphereLight ? l.groundColor.clone() : undefined, inten: l.intensity })
        }
      } else if (any.isSprite) {
        S.managed.push({ o, kind: 'sprite', c: new THREE.Vector3().setFromMatrixPosition(o.matrixWorld), r: 0, far: false, hid: false, castOrig: false, inten: 0 })
      } else if ((any.isMesh || any.isPoints || any.isLine) && o.visible && any.geometry) {
        const g = any.geometry
        const im = o as THREE.InstancedMesh
        if ((o as THREE.InstancedMesh).isInstancedMesh) im.computeBoundingSphere()
        const bs = (o as THREE.InstancedMesh).isInstancedMesh && im.boundingSphere ? im.boundingSphere : (g.boundingSphere ?? (g.computeBoundingSphere(), g.boundingSphere))
        if (bs) {
          const c = bs.center.clone().applyMatrix4(o.matrixWorld)
          const sc = new THREE.Vector3().setFromMatrixScale(o.matrixWorld)
          const r = bs.radius * Math.max(sc.x, sc.y, sc.z)
          const d3 = c.distanceTo(CENTER)
          S.managed.push({ o, kind: 'mesh', c, r, far: d3 > 120 || r > 200, hid: false, castOrig: (o as THREE.Mesh).castShadow, inten: 0 })
        }
      }
      o.children.forEach(visit)
    }
    visit(scene)
    S.envI = (scene as unknown as { environmentIntensity?: number }).environmentIntensity ?? 1
    recordHexTiming('collect', started)
  }

  const restoreAll = () => {
    S.managed.forEach((m) => {
      if (m.kind === 'light') (m.o as THREE.PointLight).intensity = m.inten
      else {
        if (m.hid) m.o.visible = true
        if (m.kind === 'mesh') (m.o as THREE.Mesh).castShadow = m.castOrig
      }
      m.hid = false
    })
    S.lights.forEach((l) => {
      l.o.color.copy(l.color)
      l.o.intensity = l.inten
      if (l.gcolor) (l.o as THREE.HemisphereLight).groundColor.copy(l.gcolor)
    })
    ;(scene as unknown as { environmentIntensity: number }).environmentIntensity = S.envI
    if (camera instanceof THREE.PerspectiveCamera && Math.abs(camera.fov - S.baseFov) > 1e-3) {
      camera.fov = S.baseFov
      camera.updateProjectionMatrix()
    }
  }

  // Hàng đợi chuẩn bị tài nguyên UEH phân bổ đều (texture + shader) để KHÔNG khựng khi lại gần đàn lần đầu
  const buildWarmQueues = () => {
    if (S.warmStarted) return
    const started = performance.now()
    S.warmStarted = true
    const seenTex = new Set<THREE.Texture>()
    const seenMat = new Set<THREE.Material>()
    const scan = (root: THREE.Object3D | null) => {
      if (!root) return
      root.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined
        if (!m) return
        const list = Array.isArray(m) ? m : [m]
        let needCompile = false
        list.forEach((mat) => {
          if (!seenMat.has(mat)) {
            seenMat.add(mat)
            needCompile = true
          }
          const rec = mat as unknown as Record<string, unknown>
          ;['map', 'bumpMap', 'roughnessMap', 'normalMap', 'emissiveMap'].forEach((k) => {
            const t = rec[k]
            if (t instanceof THREE.Texture && !seenTex.has(t)) {
              seenTex.add(t)
              S.warmTex.push(t)
            }
          })
          const unif = (mat as THREE.ShaderMaterial).uniforms
          if (unif) {
            Object.values(unif).forEach((u) => {
              if (u?.value instanceof THREE.Texture && !seenTex.has(u.value)) {
                seenTex.add(u.value)
                S.warmTex.push(u.value)
              }
            })
          }
        })
        if (needCompile) S.warmMesh.push(o)
      })
    }
    // Prepare Piano sheets and GoldZone before the hidden UEH campus.
    if (hostRoot.current) for (const child of hostRoot.current.children) if (child !== ueh.current) scan(child)
    scan(ueh.current)
    recordHexTiming('warm-queue-build', started)
  }

  useEffect(() => {
    patchAll()
    buildWarmQueues()
    const t = window.setTimeout(patchAll, 2500)
    if (camera instanceof THREE.PerspectiveCamera) S.baseFov = camera.fov
    return () => {
      window.clearTimeout(t)
      music.stop(0.1)
      RW.uRW.value.z = 0
      rt.suppressAutoPlay = false
      restoreAll()
      setInteractiveFilter(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // phím R: thu hồi thực tại
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyR' && !e.repeat && useStore.getState().phase === 'playing') dismissReality()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // bộ lọc tương tác: vật thể gốc đã bị quét thì không còn nhận tương tác "ma"
  useEffect(() => {
    setInteractiveFilter((o) => {
      if (RW.uRW.value.z < 0.5 || underKeep(o)) return true
      o.getWorldPosition(tmp)
      return frontReached(Math.hypot(tmp.x - CENTER.x, tmp.z - CENTER.z), tmp.y) < 0
    })
  }, [tmp])

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, rt.maxDt)
    const st = useReality.getState()
    rt.t = state.clock.elapsedTime

    // --- 1. Intro-only GPU preflight. No synchronous shader compilation during gameplay.
    if (S.warmPass < 2 && st.phase === 'idle' &&
        (useStore.getState().phase === 'intro' ||
         (useStore.getState().phase === 'playing' && rawDt <= 0.05 &&
          document.visibilityState === 'visible'))) {
      if (S.warmTex.length) {
        const tex = S.warmTex.shift()!
        try { gl.initTexture(tex) } catch (err) { S.warmErrors++; console.warn('[Piano preflight] texture', err) }
      } else if (S.warmMesh.length && !S.warmCompilePending) {
        const obj = S.warmMesh.shift()!
        S.warmCompilePending = true
        if (typeof gl.compileAsync === 'function') {
          void gl.compileAsync(obj, camera, scene).catch(err => {
            S.warmErrors++
            console.warn('[Piano preflight] shader', err)
          }).finally(() => { S.warmCompilePending = false })
        } else {
          try { gl.compile(obj, camera, scene) }
          catch (err) { S.warmErrors++; console.warn('[Piano preflight] shader fallback', err) }
          S.warmCompilePending = false
        }
      } else if (!S.warmCompilePending) {
        // The old one-frame ENTIRE-UEH visibility preflight caused a large
        // first GPU submission. Private source-mesh batches above replace it.
        // Keep the real world hidden until the real HEX state machine reveals it.
        S.warmPass = 2
      }
    }
        // Never leave the silent UEH preflight pass visible if the visitor starts
    // walking between its two intro frames.
    if (S.warmPass < 2 && useStore.getState().phase !== 'intro' && st.phase === 'idle') {
      if (ueh.current) ueh.current.visible = false
      S.warmTex.length = 0
      S.warmMesh.length = 0
      S.warmPass = 2
    }
    // --- 2. Hiện diện của người chơi quanh đàn ---
    const dist = Math.hypot(player.pos.x - CENTER.x, player.pos.z - CENTER.z)
    const pt = 1 - ease.smooth(8, 15, dist)
    rt.presence += (pt - rt.presence) * (1 - Math.exp(-dt * 3))

    // --- 3. Máy trạng thái & Chuyển bài liên tục trong không gian UEH ---
    if (st.phase !== S.lastPhase) {
      if (st.phase === 'ignite') {
        S.ignT = 0
        S.u = 0
        rt.ignite = 0
        audio.prepare()
        collect()
        patchAll()
        const reelStarted = performance.now()
        reel.use(st.track!)
        recordHexTiming('reel-use-call', reelStarted)
        S.lastTrack = st.track
        S.lastSwitchSeq = st.switchSeq
        toast(`Triệu hồi · ${TRACKS[st.track!].title}`, 2400)
      }
      if (st.phase === 'sweep') {
        RW.uRW.value.z = 1
        S.u = 0
        rt.flash = 1
        rt.suppressAutoPlay = true
        music.start(st.track!, 0.35, 0.08)
        S.musicOn = true
        useReality.getState().set({ demo: true })
      }
      if (st.phase === 'retract') {
        S.u = Math.max(0.0001, Math.pow(rt.front / FRONT_MAX, 1 / 1.5))
        rt.suppressAutoPlay = false
        music.stop(3)
        reel.stop()
        S.musicOn = false
      }
      S.lastPhase = st.phase
    }

    // Chuyển bài mượt mà ngay trong UEH (KHÔNG thu hồi về vũ trụ!)
    if ((st.phase === 'sweep' || st.phase === 'active') && st.switchSeq !== S.lastSwitchSeq && st.track) {
      S.lastSwitchSeq = st.switchSeq
      S.lastTrack = st.track
      reel.use(st.track)
      music.start(st.track, 0.25, 0.85)
      S.musicOn = true
      useReality.getState().set({ demo: true })
      toast(`Chuyển sang · ${TRACKS[st.track].title}`, 2400)
    }

    if (st.phase === 'ignite') {
      S.ignT += dt / IGNITE_S
      rt.ignite = ease.inOut(Math.min(1, S.ignT))
      if (S.ignT >= 1) useReality.getState().setPhase('sweep')
    } else if (st.phase === 'sweep') {
      S.u += dt / SWEEP_S
      rt.front = curve(S.u)
      rt.ignite = Math.max(0, rt.ignite - dt * 0.5)
      if (S.u >= 1) useReality.getState().setPhase('active')
    } else if (st.phase === 'active') {
      rt.front = FRONT_MAX
      rt.ignite = 0
      if (S.musicOn && music.playing) useReality.getState().set({ demo: music.demo })
      if (music.ended && rt.dbg === null) useReality.getState().setPhase('retract')
    } else if (st.phase === 'retract') {
      S.u -= dt / RETRACT_S
      rt.front = curve(Math.max(0, S.u))
      rt.ignite = 0
      if (S.u <= 0) {
        rt.front = 0
        RW.uRW.value.z = 0
        restoreAll()
        S.managed.length = 0
        S.lastTrack = null
        useReality.getState().set({ track: null, phase: 'idle' })
        S.lastPhase = 'idle'
      }
    }
    if (rt.dbg !== null && (st.phase === 'sweep' || st.phase === 'active')) rt.front = rt.dbg
    rt.flash = Math.max(0, rt.flash - dt * 0.7)

    // --- 4. Hai linh hồn thiên nhiên trên cùng sân trường UEH ---
    const inUEH = st.phase === 'sweep' || st.phase === 'active'
    const wantRain = inUEH && st.track === 'mua-ha' ? 1 : 0
    const wantBlossom = inUEH && st.track === 'ngay-mai' ? 1 : 0

    rt.rain += (wantRain - rt.rain) * (1 - Math.exp(-dt * (wantRain ? 0.75 : 1.1)))
    rt.blossom += (wantBlossom - rt.blossom) * (1 - Math.exp(-dt * (wantBlossom ? 0.8 : 1.3)))
    const wantWet = wantRain ? 1 : 0
    rt.wetness += (wantWet - rt.wetness) * (1 - Math.exp(-dt * (wantWet ? 0.35 : 0.22)))
    const wantWind = wantBlossom ? 0.65 + music.energy * 0.35 : wantRain ? 0.26 : 0.2
    rt.wind += (wantWind - rt.wind) * (1 - Math.exp(-dt * 1.2))

    if (st.phase === 'idle') {
      rt.rain = 0
      rt.wetness = 0
      rt.blossom = 0
    }

    // --- 5. Uniform toàn cục ---
    music.update(dt)
    const lvl = Math.min(1, music.bass * 0.7 + music.mid * 0.4 + music.kick * 0.35)
    RW.uRW.value.x = rt.front
    RW.uRW.value.w += (lvl - RW.uRW.value.w) * (1 - Math.exp(-dt * 12))
    RW.uRWc.value.copy(CENTER)
    RW.uRWt.value.w = st.track === 'ngay-mai' ? 1 : 0
    RW.uRWenv.value.set(rt.rain, rt.wetness, rt.blossom, rt.wind)

    const rK = rt.rain
    RW.uRWhaze.value.set(
      THREE.MathUtils.lerp(0.95, 0.62, rK),
      THREE.MathUtils.lerp(0.68, 0.66, rK),
      THREE.MathUtils.lerp(0.44, 0.72, rK),
      THREE.MathUtils.lerp(0.0072, 0.0094, rK),
    )
    RW.uRWsun.value.set(-0.55, 0.16, -0.82).normalize()

    WU.uTime.value = state.clock.elapsedTime
    WU.uMus.value.set(music.bass, music.mid, music.high, music.kick)
    WU.uProg.value = music.progress
    WU.uEnergy.value = music.energy

    const on = RW.uRW.value.z > 0.5
    // --- 6. Vật thể gốc: ẩn khi đã bị quét hoàn toàn, khôi phục khi thu hồi ---
    if (on) {
      for (const m of S.managed) {
        if (m.kind === 'light') {
          const xc = frontReached(Math.hypot(m.c.x - CENTER.x, m.c.z - CENTER.z), m.c.y)
          ;(m.o as THREE.PointLight).intensity = m.inten * (1 - ease.smooth(-8, 10, xc))
          continue
        }
        const dxz = Math.hypot(m.c.x - CENTER.x, m.c.z - CENTER.z)
        const xc = frontReached(dxz, m.c.y)
        let swept: boolean
        if (m.kind === 'sprite') swept = xc > 0
        else {
          const x = m.far ? rt.front - 306 : frontReached(dxz + m.r * 1.25 + 4, m.c.y + m.r * 1.25)
          swept = x > 0
          const noCast = m.far ? false : xc > 0
          ;(m.o as THREE.Mesh).castShadow = m.castOrig && !noCast
        }
        if (swept && !m.hid) {
          m.o.visible = false
          m.hid = true
        } else if (!swept && m.hid) {
          m.o.visible = true
          m.hid = false
        }
      }
    }

    // --- 7. Ánh sáng toàn cục pha mượt theo mặt trận & thời tiết ---
    const g = ease.smooth(25, 240, rt.front)
    rt.grade = g
    if (g > 0.001) {
      S.lights.forEach((l) => {
        if (l.o instanceof THREE.DirectionalLight) {
          tc.set(GRADE_BLOSSOM.sun).lerp(tc2.set(GRADE_RAIN.sun), rK)
          l.o.color.copy(l.color).lerp(tc, g)
          const sunI = THREE.MathUtils.lerp(GRADE_BLOSSOM.sunI, GRADE_RAIN.sunI, rK)
          l.o.intensity = THREE.MathUtils.lerp(l.inten, l.inten * sunI, g)
        } else if (l.o instanceof THREE.HemisphereLight) {
          tc.set(GRADE_BLOSSOM.sky).lerp(tc2.set(GRADE_RAIN.sky), rK)
          l.o.color.copy(l.color).lerp(tc, g)
          tc.set(GRADE_BLOSSOM.gnd).lerp(tc2.set(GRADE_RAIN.gnd), rK)
          l.o.groundColor.copy(l.gcolor!).lerp(tc, g)
          const hemiI = THREE.MathUtils.lerp(GRADE_BLOSSOM.hemiI, GRADE_RAIN.hemiI, rK)
          l.o.intensity = THREE.MathUtils.lerp(l.inten, l.inten * hemiI, g)
        } else if (l.o instanceof THREE.AmbientLight) {
          tc.set(GRADE_BLOSSOM.amb).lerp(tc2.set(GRADE_RAIN.amb), rK)
          l.o.color.copy(l.color).lerp(tc, g)
          const ambI = THREE.MathUtils.lerp(GRADE_BLOSSOM.ambI, GRADE_RAIN.ambI, rK)
          l.o.intensity = THREE.MathUtils.lerp(l.inten, l.inten * ambI, g)
        }
      })
      const envTarget = THREE.MathUtils.lerp(GRADE_BLOSSOM.env, GRADE_RAIN.env, rK)
      ;(scene as unknown as { environmentIntensity: number }).environmentIntensity = THREE.MathUtils.lerp(S.envI, S.envI * envTarget, g)
    }

    // FOV "thở" khi trường mở ra
    if (camera instanceof THREE.PerspectiveCamera) {
      const f = S.baseFov + rt.flash * rt.flash * 9 + (st.phase === 'sweep' ? music.kick * 1.1 : 0)
      if (Math.abs(camera.fov - f) > 0.01) {
        camera.fov = f
        camera.updateProjectionMatrix()
      }
    }

    // The original newly generated world is completely shader-discarded
    // before HEX sweep begins. Do not submit its entire GPU geometry during
    // the 2.6s ignition. Actual scan/active/retract render remains unchanged.
    if (ueh.current) {
      const reveal = st.phase === 'sweep' || st.phase === 'active' || st.phase === 'retract'
      ueh.current.visible = reveal
      if (reveal) {
        S.warmPass = 2
        S.warmTex.length = 0
        S.warmMesh.length = 0
      }
    }
  })

  return (
    <group ref={hostRoot} userData={{ rwKeep: true }}>
      <group ref={ueh} visible={false}>
        <UEHWorld />
      </group>
      <HexLattice />
      <StaffWall />
      <Ignition />
      <Sheets />
    </group>
  )
}
