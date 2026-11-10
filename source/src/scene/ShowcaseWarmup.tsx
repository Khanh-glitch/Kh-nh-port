import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * The cold-activation hitch survived V2 because compileAsync only prepared
 * programs, not VBO/VAO/instancing buffers, and the requestIdleCallback warmup
 * could still be pending when the first laser scan made meshes visible.
 *
 * Prime ACTUAL showcase resources using a tiny private framebuffer while the
 * landing page is still open. No quality / geometry / material is downgraded.
 * Do not change the visibility or transforms of either real display.
 */
export function ShowcaseWarmup({ arenaState }: { arenaState: { mode: string } }) {
  const { gl, scene } = useThree()

  // Test-only shadow A/B. The normal portfolio does not alter shadows,
  // their 2048px map, geometry, shader, light count, or rendered pixels.
  useEffect(() => {
    const shadowProbeOff = new URLSearchParams(location.search).get('colossusShadowProbe') === 'off'
    if (!shadowProbeOff) return
    const originalShadows = gl.shadowMap.enabled
    gl.shadowMap.enabled = false
    return () => { gl.shadowMap.enabled = originalShadows }
  }, [gl])

  useEffect(() => {
    let disposed = false
    let cancelTimeout = 0
    let stage: THREE.Scene | null = null
    let target: THREE.WebGLRenderTarget | null = null
    const info = {
      status: 'scheduled',
      shadowProbe: new URLSearchParams(location.search).get('colossusShadowProbe') === 'off' ? 'off-diagnostic-only' : 'unchanged',
      meshes: 0,
      sprites: 0,
      beams: 0,
      variants: [] as { name: string; ms: number; programs: number }[],
      drawnVariants: [] as Array<{ name: string; programs: number }>,
      visibilityAtStart: document.visibilityState,
      hadFocusAtStart: document.hasFocus(),
      extraApexLights: 0,
      extraRagLights: 0,
      textureMaps: 0,
      totalProxies: 0,
      fullLitPrewarm: new URLSearchParams(location.search).get('colossusFullLitPrewarm') === 'on' ||
        new URLSearchParams(location.search).get('colossusDeepPrewarm') === 'on',
      deepWorldPrewarm: new URLSearchParams(location.search).get('colossusDeepPrewarm') === 'on',
      longestPrivateBatchCpuMs: 0,
      // Production hitch-only candidate: stage each real shadow-casting exhibit
      // twice BEFORE click, on the private 96px target. Metal A/B reduced
      // cold-click maxima from 1133ms to 517-583ms while keeping intro idle
      // under the 120ms gate. Full-res 960px improved click only slightly but
      // caused a 300ms intro frame, so retain safe 96px as the default.
      // ?colossusNativePreflight=off restores the old preflight for A/B.
      nativeScenePrewarm: new URLSearchParams(location.search).get('colossusNativePreflight') !== 'off',
      nativeSceneRepeats: new URLSearchParams(location.search).get('colossusNativePreflight') === 'on' ? 1 : 2,
      nativeScenePasses: 0,
      nativeScenePeakCpuMs: 0,
      nativePreflightWidth: [96,512,960].includes(
        Number(new URLSearchParams(location.search).get('colossusNativeTarget') || 96))
          ? Number(new URLSearchParams(location.search).get('colossusNativeTarget') || 96)
          : 96,
      nativePreflightHeight: 0,
      nativePreflightGpuFence: false,
      nativeHologramPasses: 0,
      nativePassMode: new URLSearchParams(location.search).get('colossusNativePassMode') === 'mixed'
        ? 'mixed' : 'full',
      fullyLitMeshesPrimed: 0,
      fullyLitBatches: 0,
      uploadedProxies: 0,
      laserReady: false,
      earlyShaderCompileStatus: 'not-started',
      earlyShaderCompileMs: 0,
      earlyShaderVariantKeys: [] as string[],
      laserSubmitted: false,
      laserGpuSynced: false,
      materializeShadersPrimed: 0,
      materializeProgramsCompiled: false,
      materializeShaderGpuSynced: false,
      materializeShaderMs: 0,
      materializeCompileMode: 'not-started',
      materializeVariantKeys: [] as string[],
      laserBatchCpuMs: 0,
      deferredLaserFrames: 0,
      adaptiveFrameBudgetMs: 50,
      measuredMedianFrameMs: 0,
      showcaseDrawBatches: 0,
      deferredShowcaseFrames: 0,
      maxSampledFrameMs: 0,
      gpuSynced: false,
      durationMs: 0,
      programsBefore: 0,
      programsAfter: 0,
      error: '',
    }
    // Browser diagnostic: __orbitaColossusWarmup shows whether a cold click
    // raced initialization. With #colossus-profile, this is logged as well.
    Object.assign(window as unknown as { __orbitaColossusWarmup: typeof info }, { __orbitaColossusWarmup: info }) 
    // Preview-only diagnostics: both / and /#colossus-profile execute identical code.
    // The overlay does not alter renderer, shader, pixel ratio or scene.
    const badge = document.createElement('section')
    badge.id = 'menniverse-laser-probe'
    badge.setAttribute('aria-label', 'Laser preflight diagnostics')
    badge.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:30000;max-width:340px;padding:10px 12px;border:1px solid #4ac9de;border-radius:8px;background:rgba(3,10,24,.92);color:#d8f6ff;font:12px/1.5 system-ui,sans-serif;box-shadow:0 6px 30px #0008;pointer-events:auto'
    const label = document.createElement('div')
    const copy = document.createElement('button')
    copy.textContent = 'Copy laser report'
    copy.type = 'button'
    copy.style.cssText = 'margin-top:6px;padding:3px 8px;background:#12354d;border:1px solid #4ac9de;border-radius:4px;color:#e2f9ff;cursor:pointer;font:inherit'
    const updateBadge = () => {
      const result = (window as unknown as { __orbitaColossusProfile?: { clickHandlerMs?: number; maxFrameMs?: number; programDelta?: number } }).__orbitaColossusProfile
      const perf = result ? ` | click ${result.clickHandlerMs}ms | worst ${result.maxFrameMs}ms | +${result.programDelta} shaders` : ' | trigger laser to measure'
      label.textContent = `LASER LAB · prewarm: ${info.status} · beams ${info.beams}${perf}`
    }
    copy.onclick = () => {
      const w = window as unknown as { __orbitaColossusProfiles?: unknown[]; __orbitaColossusProfile?: unknown }
      const record = { build: 'laser-ab-experiment', hash: location.hash, prewarm: info, profiles: w.__orbitaColossusProfiles ?? [], lastProfile: w.__orbitaColossusProfile ?? null }
      const text = JSON.stringify(record, null, 2)
      navigator.clipboard?.writeText(text).then(() => { copy.textContent = 'Copied' }).catch(() => { copy.textContent = 'See Console'; console.info('[Laser report]', text) })
    }
    badge.append(label, copy)
    const diagnosticsVisible = window.location.hash.includes('colossus-profile')
    if (diagnosticsVisible) { document.body.appendChild(badge); updateBadge() }
    const hudTimer = diagnosticsVisible ? window.setInterval(updateBadge, 500) : 0

    // Never let a large preflight draw race the visitor's first laser click.
    // Renderer-side geometry uploads are spread over animation frames (one
    // actual mesh per private draw), keeping source mesh/material/texture data.
    const interrupted = () => disposed || arenaState.mode !== 'dormant'
    // First landing owns initial GPU preparation. A 3.5-second timeout used
    // to let the 131-object Colossus queue overlap a still-compiling landing
    // scene (Metal has observed >4-second waits between healthy frames).
    // Wait for a TERMINAL landing state instead of racing two GPU warmups.
    // This yields to the browser and never blocks a visitor's click; summon,
    // unmount, or the landing scene's own phase cancellation aborts the wait.
    const waitForLandingPreflight = async () => {
      while(!interrupted()){
        const landing=(window as unknown as {
          __orbitaLandingPrewarm?:{status:string}
        }).__orbitaLandingPrewarm
        if(!landing || ['ready','disabled','failed','cancelled',
          'skipped-busy-or-entered','skipped-software-renderer',
          'skipped-entered','submitted-no-fence'].includes(landing.status))return
        await new Promise<void>(resolve=>window.setTimeout(resolve,40))
      }
    }
    // Laser uses the earliest available paint. Showcase assets are opportunistic:
    // do NOT submit an extra GPU draw while the active scene is already late,
    // or while Chrome reports a pending input event. Visual content is unchanged.
    let previousPaintAt = 0
    let smoothPaints = 0
    let healthyLaserPaints = 0
    let budgetClockStart = performance.now()
    const recentFrameMs: number[] = []
    // Based on actual Metal idle traces: normal 67-83ms frames were being
    // rejected by the old fixed 50ms gate, so the 131 VBOs never warmed.
    // Learn a bounded local median instead; never accept >100ms "healthy".
    const MAX_LASER_PREFLIGHT_WAIT_MS = 3500
    // Do not submit an additional offscreen GPU workload if the renderer's
    // own visible frames are already late. The production 3D visuals are
    // untouched. Both laser and optional work must yield to user input.
    const nextPaint = async (priority: 'laser' | 'showcase'): Promise<boolean> => {
      for (;;) {
        const timestamp = await new Promise<number>(resolve => requestAnimationFrame(resolve))
        const frameMs = previousPaintAt > 0 ? timestamp - previousPaintAt : 0
        previousPaintAt = timestamp
        await new Promise<void>(resolve => window.setTimeout(resolve, 0))
        if (interrupted()) return false
        const scheduling = (navigator as Navigator & {
          scheduling?: { isInputPending?: () => boolean }
        }).scheduling
        const pendingInput = scheduling?.isInputPending?.() ?? false
        if (frameMs > 0 && frameMs < 200) {
          recentFrameMs.push(frameMs)
          if (recentFrameMs.length > 12) recentFrameMs.shift()
        }
        const sorted = [...recentFrameMs].sort((a, b) => a - b)
        const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 16.7
        const adaptiveBudget = Math.min(100, Math.max(50, median * 1.35))
        info.measuredMedianFrameMs = Math.round(median)
        info.adaptiveFrameBudgetMs = Math.round(adaptiveBudget)
        const healthyPaint = document.visibilityState === 'visible' && !pendingInput &&
          recentFrameMs.length >= 4 && frameMs > 0 && frameMs <= adaptiveBudget
        if (priority === 'laser') {
          healthyLaserPaints = healthyPaint ? healthyLaserPaints + 1 : 0
          if (healthyLaserPaints >= 2) { healthyLaserPaints = 0; return true }
          info.deferredLaserFrames++
          if (performance.now() - budgetClockStart >= MAX_LASER_PREFLIGHT_WAIT_MS) {
            info.status = 'prewarm-skipped-busy-renderer'
            return false
          }
          continue
        }
        info.maxSampledFrameMs = Math.max(info.maxSampledFrameMs, Math.round(frameMs))
        if (healthyPaint) smoothPaints++
        else smoothPaints = 0
        if (smoothPaints >= 3) { smoothPaints = 0; return true }
        info.deferredShowcaseFrames++
      }
    }
    // Metal/true-hardware shader compilation is cheap to submit asynchronously,
    // whereas full VBO/VAO offscreen draws can saturate the visible renderer.
    // Compile ONLY representative real shader variants before the heavier
    // frame-budget gate. Skip software GL backends to avoid their multi-second
    // compile/driver stalls. No live material, geometry or visibility changes.
    const precompileCriticalShaders = async () => {
      if (interrupted()) return
      const ctx = gl.getContext()
      const dbg = ctx.getExtension('WEBGL_debug_renderer_info')
      const rendererName = dbg ? String(ctx.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : ''
      if (/SwiftShader|llvmpipe|Software/i.test(rendererName)) {
        info.earlyShaderCompileStatus = 'software-skipped'
        return
      }
      const names = ['apex-showcase-root','ragnarok-showcase-root']
      const roots = names.map(n => scene.getObjectByName(n))
      if (roots.some(r => !r)) { info.earlyShaderCompileStatus = 'missing-roots'; return }
      const chosen = new Map<string, THREE.Mesh>()
      for (const root of roots) root!.traverse(obj => {
        const mesh = obj as THREE.Mesh
        if (!mesh.isMesh || (mesh as THREE.InstancedMesh).isInstancedMesh) return
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        const mat = mats.find(m => m?.userData?.orbitaMaterialize)
        if (!mat) return
        const mapped = !!((mat as THREE.MeshStandardMaterial).map?.isTexture && mesh.geometry.getAttribute('uv'))
        const family = mat.type === 'MeshBasicMaterial' ? 'basic' : 'physical'
        const kind = family + ':' + (mapped ? 'mapped' : 'unmapped')
        if (!chosen.has(kind)) chosen.set(kind, mesh)
      })
      if (!chosen.size) { info.earlyShaderCompileStatus = 'missing-materials'; return }
      const stageEarly = new THREE.Scene()
      stageEarly.environment = scene.environment
      stageEarly.fog = scene.fog
      const lights: THREE.Light[] = []
      scene.traverseVisible(obj => {
        if (!(obj as THREE.Light).isLight) return
        const copy = (obj as THREE.Light).clone(false)
        if (copy.castShadow && (copy as THREE.Light & {shadow?: THREE.LightShadow}).shadow) {
          (copy as THREE.Light & {shadow: THREE.LightShadow}).shadow.mapSize.set(64,64)
        }
        stageEarly.add(copy)
        lights.push(copy)
      })
      for (const mesh of chosen.values()) {
        const proxy = mesh.clone(false)
        proxy.position.set(0,0,0)
        proxy.rotation.set(0,0,0)
        proxy.scale.setScalar(1)
        proxy.visible = true
        proxy.frustumCulled = false
        stageEarly.add(proxy)
      }
      const cameraEarly = new THREE.PerspectiveCamera(60,1,0.01,200)
      cameraEarly.position.set(0,0,12)
      cameraEarly.lookAt(0,0,0)
      const privateTarget = new THREE.WebGLRenderTarget(96,96,{depthBuffer:true,stencilBuffer:false})
      privateTarget.texture.colorSpace = gl.outputColorSpace
      const oldTarget = gl.getRenderTarget()
      const viewport = gl.getViewport(new THREE.Vector4()).clone()
      const scissor = gl.getScissor(new THREE.Vector4()).clone()
      const scissorTest = gl.getScissorTest()
      const xr = gl.xr.enabled
      const startedAt = performance.now()
      info.earlyShaderVariantKeys = [...chosen.keys()]
      try {
        info.earlyShaderCompileStatus = 'compiling'
        let compilePromise: Promise<unknown> = Promise.resolve()
        try {
          gl.xr.enabled = false
          gl.setRenderTarget(privateTarget)
          gl.setViewport(0,0,96,96)
          gl.setScissorTest(false)
          compilePromise = gl.compileAsync(stageEarly,cameraEarly)
        } finally {
          gl.setRenderTarget(oldTarget)
          gl.setViewport(viewport)
          gl.setScissor(scissor)
          gl.setScissorTest(scissorTest)
          gl.xr.enabled = xr
        }
        await compilePromise
        info.earlyShaderCompileStatus = 'compiled'
      } catch (err) {
        info.earlyShaderCompileStatus = 'failed'
        info.error = String(err)
      } finally {
        info.earlyShaderCompileMs = Math.round(performance.now() - startedAt)
        privateTarget.dispose()
        lights.forEach(l => (l as THREE.Light & {shadow?: THREE.LightShadow}).shadow?.dispose())
        stageEarly.clear()
      }
    }
    const warm = async () => {
      // Experimental A/B isolation only. Production/default code path remains
      // exactly the same: no visual settings, materials or geometry altered.
      if (new URLSearchParams(location.search).get('colossusPrewarm') === 'off') {
        info.status = 'diagnostic-prewarm-disabled'
        return
      }
      if (interrupted()) { info.status = 'cancelled-on-summon'; return }
      // Prepare cache keys asynchronously on an actual GPU even if the
      // expensive geometry-prewarm budget never opens. The visible scene is
      // untouched; subsequent first-draw VBO work remains frame-gated.
      await precompileCriticalShaders()
      if (interrupted()) { info.status='cancelled-on-summon'; return }
      // Shader compile is independently asynchronous. Measure the budget from
      // when GL geometry work is actually eligible, not from React mount.
      budgetClockStart = performance.now()
      // BEFORE cloning/traversing the 131 proxies and production lights,
      // require healthy render frames. A saturated renderer must not spend
      // additional CPU/GPU time even constructing temporary warmup objects.
      info.status = 'budget-preflight'
      if (!await nextPaint('laser')) {
        if (info.status !== 'prewarm-skipped-busy-renderer') info.status='cancelled-on-summon'
        return
      }
      const showcaseRoots = ['apex-showcase-root', 'ragnarok-showcase-root']
        .map(name => scene.getObjectByName(name))
      const beamNames = ['colossus-warm-beam-left', 'colossus-warm-beam-right', 'colossus-warm-beam-eye', 'colossus-warm-impact']
      const beams = beamNames.map(name => scene.getObjectByName(name)).filter((o): o is THREE.Object3D => !!o)
      info.beams = beams.length
      if (showcaseRoots.some(root => !root) || beams.length !== 4) { info.status = 'missing-roots'; return }
      // Cold click requires the 3 beam VBOs + impact flare FIRST, not after
      // the 120 exhibit meshes. Keep all original meshes and full quality.
      const roots: THREE.Object3D[] = [...beams, ...(showcaseRoots as THREE.Object3D[])]

      const started = performance.now()
      info.status = 'compiling'
      info.programsBefore = gl.info.programs?.length ?? 0
      stage = new THREE.Scene()
      stage.environment = scene.environment
      stage.fog = scene.fog
      stage.background = null
      const stageNow = stage
      const proxies: THREE.Object3D[] = []
      const baseVisibleLights = new Set<THREE.Object3D>()
      // Only PRIVATE light clones use a 64px shadow cache, never production
      // shadow quality. Keep castShadow and shader light/shadow defines intact.
      const clonePrivateLight = (source: THREE.Light): THREE.Light => {
        const copy = source.clone(false)
        const shadow = (copy as THREE.Light & { shadow?: THREE.LightShadow }).shadow
        if (copy.castShadow && shadow) {
          // A/B only: match the real 2048x2048 sun shadow attachment during
          // arrival preflight. Private shadow textures do NOT change game quality.
          const size = info.deepWorldPrewarm && source instanceof THREE.DirectionalLight ? 2048 : 64
          shadow.mapSize.set(size, size)
        }
        return copy
      }
      const extraLights = (root: THREE.Object3D | undefined | null): THREE.Light[] => {
        const list: THREE.Light[] = []
        root?.traverse(obj => {
          if (!(obj as THREE.Light).isLight || baseVisibleLights.has(obj)) return
          list.push(clonePrivateLight(obj as THREE.Light))
        })
        return list
      }
      scene.traverseVisible(object => {
        if (!(object as THREE.Light).isLight) return
        baseVisibleLights.add(object)
        stageNow.add(clonePrivateLight(object as THREE.Light))
      })
      const textures = new Set<THREE.Texture>()
      const priorityTextures = new Set<THREE.Texture>()
      roots.forEach((root, rootIndex) => root!.traverse(object => {
        const m = object as THREE.Mesh
        const sprite = object as THREE.Sprite
        if (!m.isMesh && !sprite.isSprite) return
        const proxy = object.clone(false) as THREE.Object3D
        if (info.deepWorldPrewarm) {
          // Private clones share source geometry, original materials and actual
          // world transforms; unlike a zeroed 96px proxy, this renders the same
          // real positions/shadow casters the visitor will encounter.
          object.updateWorldMatrix(true, false)
          proxy.matrixAutoUpdate = false
          proxy.matrix.copy(object.matrixWorld)
          proxy.matrixWorld.copy(object.matrixWorld)
        } else {
          proxy.position.set(0, 0, 0)
          proxy.rotation.set(0, 0, 0)
          proxy.scale.setScalar(1)
        }
        proxy.frustumCulled = false
        proxy.visible = true
        if ((m as THREE.InstancedMesh).isInstancedMesh) {
          const source = m as THREE.InstancedMesh
          const copy = proxy as THREE.InstancedMesh
          copy.instanceMatrix = source.instanceMatrix
          copy.instanceColor = source.instanceColor
        }
        stageNow.add(proxy)
        proxies.push(proxy)
        if (sprite.isSprite) info.sprites++
        else info.meshes++
        const mats = Array.isArray(m.material) ? m.material : [m.material]
        for (const mat of mats) {
          if (!mat) continue
          for (const name of ['map','alphaMap','emissiveMap','normalMap','roughnessMap','metalnessMap'] as const) {
            const t = (mat as THREE.MeshStandardMaterial)[name]
            if (t?.isTexture) {
              textures.add(t)
              if (rootIndex < beams.length) priorityTextures.add(t)
            }
          }
        }
      }))
      info.textureMaps = textures.size
      info.totalProxies = proxies.length
      const camera = new THREE.PerspectiveCamera(60, 1, 0.01, 200)
      if (info.deepWorldPrewarm) {
        camera.position.set(0, 17, -18)
        camera.lookAt(0, 4, -41)
      } else {
        camera.position.set(0, 0, 12)
        camera.lookAt(0, 0, 0)
      }
      const targetSize = info.deepWorldPrewarm ? 512 : 96

      // Capture/restores the *current* framebuffer on each independent pass.
      // Never keep a private target bound across requestAnimationFrame/await.
      const withTarget = (fn: () => void, outputTarget: THREE.WebGLRenderTarget | null = target) => {
        const prevTarget = gl.getRenderTarget()
        const prevViewport = gl.getViewport(new THREE.Vector4()).clone()
        const prevScissor = gl.getScissor(new THREE.Vector4()).clone()
        const prevTest = gl.getScissorTest()
        const prevXR = gl.xr.enabled
        const prevClear = gl.autoClear
        try {
          gl.xr.enabled = false
          gl.autoClear = true
          gl.setRenderTarget(outputTarget)
          gl.setViewport(0, 0, outputTarget?.width ?? targetSize, outputTarget?.height ?? targetSize)
          gl.setScissorTest(false)
          fn()
        } finally {
          gl.setRenderTarget(prevTarget)
          gl.setViewport(prevViewport)
          gl.setScissor(prevScissor)
          gl.setScissorTest(prevTest)
          gl.xr.enabled = prevXR
          gl.autoClear = prevClear
        }
      }
      try {
        // Do not compile all models in one uninterruptible GPU task.
        // The four laser proxies are rendered FIRST, one object per paint,
        // then all remaining showcase textures/meshes incrementally.
        info.variants.push({ name:'laser-priority-incremental', ms:0, programs:gl.info.programs?.length ?? 0 })
        const apexLights = extraLights(showcaseRoots[0])
        const ragLights = extraLights(showcaseRoots[1])
        info.extraApexLights = apexLights.length
        info.extraRagLights = ragLights.length
        // The frozen visible light rig should make both extra arrays empty.
        // If not, stop rather than silently compiling an unrepresentative rig.
        if (apexLights.length || ragLights.length) {
          info.status = 'light-rig-mismatch'
          return
        }
        if (interrupted()) { info.status='cancelled-on-summon'; return }
        // Prepare the actual beam and flare resources FIRST. Previously all
        // 14 exhibit textures could block the four laser proxies even though
        // the visitor sees only those proxies at the start of fabrication.
        // Prime all four latency-critical laser drawables in one offscreen pass.
        // Previously each beam waited for a separate requestAnimationFrame.
        info.status = 'laser-textures'
        // First healthy-frame gate already ran before any source traversal.
        for (const texture of priorityTextures) {
          if (interrupted()) { info.status='cancelled-on-summon'; return }
          try { gl.initTexture(texture) } catch { /* Visible renderer can retry. */ }
        }
        target = new THREE.WebGLRenderTarget(targetSize, targetSize, { depthBuffer:true, stencilBuffer:false })
        target.texture.colorSpace = gl.outputColorSpace
        proxies.forEach(proxy => { proxy.visible = false })
        const laserProxies = proxies.slice(0, beams.length)
        if (interrupted()) { info.status='cancelled-on-summon'; return }
        info.status = 'laser-geometry'
        const laserBatchStarted = performance.now()
        laserProxies.forEach(proxy => { proxy.visible = true })
        try {
          withTarget(() => {
            gl.clear(true, true, false)
            gl.render(stageNow, camera)
          })
        } finally {
          laserProxies.forEach(proxy => { proxy.visible = false })
        }
        info.laserBatchCpuMs = Math.round(performance.now() - laserBatchStarted)
        info.uploadedProxies += laserProxies.length
        info.laserSubmitted = true

        // GPU command submission is not readiness. Use asynchronous readback
        // as a nonblocking completion fence for the critical laser batch.
        if (typeof gl.readRenderTargetPixelsAsync === 'function') {
          let laserFence: Promise<unknown> = Promise.resolve()
          withTarget(() => {
            laserFence = gl.readRenderTargetPixelsAsync(target!, 0, 0, 1, 1, new Uint8Array(4))
          })
          info.status = 'laser-gpu-pending'
          await laserFence
          info.laserGpuSynced = true
          info.laserReady = true
        } else {
          gl.getContext().flush()
          info.status = 'laser-submitted-no-fence'
        }
        if (interrupted()) { info.status='cancelled-on-summon'; return }

        // The first-click cache keys differ by MATERIAL MAP DEFINES, not by
        // the mere presence of a UV buffer. Almost all geometry has UVs;
        // classifying only geometry.uv incorrectly selected ONE representative.
        // Compile the actual Standard/Basic material variants, using source
        // geometry and full production light rig, without any visible mutation.
        const materializeVariants = new Map<string, THREE.Object3D>()
        for (const proxy of proxies.slice(beams.length)) {
          const mesh = proxy as THREE.Mesh
          if (!mesh.isMesh || (mesh as THREE.InstancedMesh).isInstancedMesh) continue
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
          const material = mats.find(mat => mat?.userData?.orbitaMaterialize)
          if (!material) continue
          const maps = material as THREE.MeshStandardMaterial
          const mapped = !!(maps.map?.isTexture && mesh.geometry.getAttribute('uv'))
          const shaderFamily = material.type === 'MeshBasicMaterial' ? 'basic' : 'physical'
          const variant = shaderFamily + ':' + (mapped ? 'mapped' : 'unmapped')
          if (!materializeVariants.has(variant)) materializeVariants.set(variant, proxy)
        }
        if (materializeVariants.size > 0) {
          info.status = 'materialize-shaders'
          info.materializeVariantKeys = [...materializeVariants.keys()]
          if (!await nextPaint('laser')) {
          if (info.status !== 'prewarm-skipped-busy-renderer') info.status='cancelled-on-summon'
          return
        }
          if (interrupted()) { info.status='cancelled-on-summon'; return }
          const startedMaterialize = performance.now()
          const representatives = [...materializeVariants.values()]
          representatives.forEach(proxy => { proxy.visible = true })
          try {
            // Only selected representative meshes are visible in the private
            // stage. Parallel compile avoids the old 4-5 second synchronous
            // GL.render that raced user input in software-backed Chrome.
            // Keep the same offscreen output color-space shader cache variant.
            let compiled: Promise<unknown> = Promise.resolve()
            withTarget(() => {
              compiled = gl.compileAsync(stageNow, camera)
            })
            info.materializeCompileMode = 'compileAsync'
            await compiled
          } finally {
            representatives.forEach(proxy => { proxy.visible = false })
          }
          info.materializeShadersPrimed = representatives.length
          info.materializeProgramsCompiled = true // program compilation only; NO geometry fence claim
          info.materializeShaderMs = Math.round(performance.now() - startedMaterialize)
        }
        if (interrupted()) { info.status='cancelled-on-summon'; return }

        // Optional showcase work never blocks laser readiness. Small batches
        // reduce the previous 120 independent three-frame scheduling windows.
        // All original live geometry, materials and render settings are intact.
        const uploadTexture = async (texture: THREE.Texture): Promise<boolean> => {
          if (!await nextPaint('showcase')) return false
          if (interrupted()) return false
          try { gl.initTexture(texture) } catch { /* Visible renderer can retry. */ }
          return true
        }
        info.status = 'showcase-textures'
        for (const texture of textures) {
          if (priorityTextures.has(texture)) continue
          if (!await uploadTexture(texture)) { info.status='cancelled-on-summon'; return }
        }
        info.status = 'showcase-geometry'
        const showcaseProxies = proxies.slice(beams.length)
        const SHOWCASE_BATCH_SIZE = 4
        // The existing 96px proxy warmup can upload ALL geometry while leaving
        // every custom hologram material clipped by uComplete=0. This candidate
        // verifies whether priming the SAME complete PBR path before the actual
        // first visible scan avoids first-fragment GPU scheduling. No scene
        // mutation persists across frames; shader, texture and shadows of the
        // original portfolio are unchanged. OFF by default until measured.
        const renderRealFragments = info.fullLitPrewarm
        const temporarilyMaterialize = (batch: THREE.Object3D[]) => {
          const restore: Array<{ uniform: { value: number }; old: number }> = []
          if (!renderRealFragments) return restore
          const visited = new Set<object>()
          for (const obj of batch) {
            const mesh = obj as THREE.Mesh
            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
            for (const material of materials) {
              const u = material?.userData?.orbitaMaterializeUniforms as
                | { uComplete: { value: number } }
                | undefined
              if (!u || visited.has(u.uComplete)) continue
              visited.add(u.uComplete)
              restore.push({ uniform: u.uComplete, old: u.uComplete.value })
              u.uComplete.value = 1
              info.fullyLitMeshesPrimed++
            }
          }
          return restore
        }
        for (let i = 0; i < showcaseProxies.length; i += SHOWCASE_BATCH_SIZE) {
          if (!await nextPaint('showcase')) { info.status='cancelled-on-summon'; return }
          if (interrupted()) { info.status='cancelled-on-summon'; return }
          const batch = showcaseProxies.slice(i, i + SHOWCASE_BATCH_SIZE)
          batch.forEach(proxy => { proxy.visible = true })
          const savedUniforms = temporarilyMaterialize(batch)
          const batchCpuStart = performance.now()
          try {
            withTarget(() => {
              gl.clear(true, true, false)
              gl.render(stageNow, camera)
            })
            info.longestPrivateBatchCpuMs = Math.max(
              info.longestPrivateBatchCpuMs,
              Math.round(performance.now() - batchCpuStart),
            )
            if (savedUniforms.length) info.fullyLitBatches++
          } finally {
            for (const entry of savedUniforms) entry.uniform.value = entry.old
            batch.forEach(proxy => { proxy.visible = false })
          }
          info.uploadedProxies += batch.length
          info.showcaseDrawBatches++
        }
        info.drawnVariants.push({ name:'incremental', programs:gl.info.programs?.length ?? 0 })
        // Opt-in only. The detached low-res proxy has not exercised the ORIGINAL
        // 2048px sun shadow attachment with the REAL exhibit mesh transforms.
        // A full native scene offscreen draw tests this missing first-use path.
        // Never render mutations to the public framebuffer. Restore all actor
        // visibility, material uniforms, camera and sun transforms in finally.
        if (info.nativeScenePrewarm && !interrupted()) {
          const contents = [
            scene.getObjectByName('apex-exhibit-content'),
            scene.getObjectByName('ragnarok-exhibit-content'),
          ]
          let sun: THREE.DirectionalLight | undefined
          scene.traverse(o => {
            const light = o as THREE.DirectionalLight
            if (!sun && light.isDirectionalLight && light.castShadow) sun = light
          })
          if (!sun || contents.some(c => !c)) {
            info.status = 'native-scene-preflight-missing-primitives'
            return
          }
          // The old preflight used only a 96x96 color attachment even though
          // the real exhibit fills a full 1280x720 viewport. An alternate
          // full-size private target lets us prove whether the remaining cold
          // click is first-use of the full color/depth compositor path.
          // All 131 earlier proxy draws stay at 96px for frame-budget safety.
          const nativeWidth = info.nativePreflightWidth
          const nativeHeight = nativeWidth === 96 ? 96 : Math.round(nativeWidth * 9 / 16)
          info.nativePreflightHeight = nativeHeight
          const nativeTarget = nativeWidth === targetSize && nativeHeight === targetSize
            ? target
            : new THREE.WebGLRenderTarget(nativeWidth, nativeHeight,
              { depthBuffer: true, stencilBuffer: false })
          if (nativeTarget !== target) nativeTarget.texture.colorSpace = gl.outputColorSpace
          const priorAspect = camera.aspect
          camera.aspect = nativeWidth / nativeHeight
          camera.updateProjectionMatrix()
          try {
          for (const content of contents) {
            for (let repeat = 0; repeat < info.nativeSceneRepeats; repeat++) {
            // Do not leave the live sun/camera mutated across nextPaint().
            // The prior candidate did this and could alter the REAL visible
            // intro frames while awaiting the GPU frame budget. Each stage
            // mutation now begins AFTER the await and is restored BEFORE it
            // yields back to the browser's public animation loop.
            if (!await nextPaint('showcase')) { info.status='cancelled-on-summon'; return }
            if (interrupted() || !content) { info.status='cancelled-on-summon'; return }
            const priorVisible = content.visible
            const sunPos = sun.position.clone()
            const targetPos = sun.target.position.clone()
            const offset = sunPos.clone().sub(targetPos)
            const savedCameraPos = camera.position.clone()
            const savedCameraRotation = camera.quaternion.clone()
            // An all-PBR (uComplete=1) private draw cannot exercise the
            // materialization branch (scan ripple/grid/discard) that becomes
            // visible for the very first time after clicking Colossus.
            // Compare a second pass through that ORIGINAL exact shader path.
            const savedUniforms = new Map<{value:number},number>()
            const setPreflightUniform = (uniform: {value:number}|undefined, value:number) => {
              if (!uniform) return
              if (!savedUniforms.has(uniform)) savedUniforms.set(uniform,uniform.value)
              uniform.value = value
            }
            const warmHologram = info.nativePassMode === 'mixed' && repeat > 0
            const startNative = performance.now()
            try {
              sun.target.position.set(0, 0, -41)
              sun.position.copy(sun.target.position).add(offset)
              sun.target.updateMatrixWorld(true)
              sun.updateMatrixWorld(true)
              camera.position.set(0, 16, -17)
              camera.lookAt(0, 4, -41)
              content.visible = true
              content.traverse(o => {
                const mesh = o as THREE.Mesh
                if (!mesh.isMesh) return
                const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
                for (const material of materials) {
                  const u = material?.userData?.orbitaMaterializeUniforms as
                    | { uComplete?: {value:number}; uScanY?: {value:number}; uTime?: {value:number} }
                    | undefined
                  if (!u) continue
                  setPreflightUniform(u.uComplete, warmHologram ? 0 : 1)
                  if (warmHologram) {
                    setPreflightUniform(u.uScanY, 2.1)
                    setPreflightUniform(u.uTime, 1.7)
                  }
                }
              })
              withTarget(() => { gl.clear(true,true,false); gl.render(scene,camera) }, nativeTarget)
              info.nativeScenePeakCpuMs = Math.max(info.nativeScenePeakCpuMs,
                Math.round(performance.now() - startNative))
              info.nativeScenePasses++
              if (warmHologram) info.nativeHologramPasses++
            } finally {
              savedUniforms.forEach((value,uniform) => { uniform.value=value })
              content.visible = priorVisible
              camera.position.copy(savedCameraPos)
              camera.quaternion.copy(savedCameraRotation)
              sun.position.copy(sunPos)
              sun.target.position.copy(targetPos)
              sun.target.updateMatrixWorld(true)
              sun.updateMatrixWorld(true)
            }
            }
          }
          } finally {
            camera.aspect = priorAspect
            camera.updateProjectionMatrix()
            if (nativeTarget !== target) nativeTarget.dispose()
          }
        }
        if (interrupted()) { info.status='cancelled-on-summon'; return }
        if (typeof gl.readRenderTargetPixelsAsync === 'function') {
          let fence: Promise<unknown> = Promise.resolve()
          withTarget(() => {
            fence = gl.readRenderTargetPixelsAsync(target!, 0, 0, 1, 1, new Uint8Array(4))
          })
          info.status = 'gpu-pending'
          await fence
          info.gpuSynced = true
          info.status = 'ready'
        } else {
          gl.getContext().flush()
          info.status = 'submitted-no-async-readback'
        }
      } catch(err) {
        info.status='failed'
        info.error=String(err)
        console.warn('[Colossus] cooperative GPU preflight failed; real game unchanged:',err)
      } finally {
        target?.dispose()
        target=null
        stageNow.traverse(o=>{
          if ((o as THREE.Light).isLight)
            (o as THREE.Light & { shadow?: THREE.LightShadow }).shadow?.dispose()
        })
        stageNow.clear()
        stage=null
        info.durationMs=Math.round(performance.now()-started)
        info.programsAfter=gl.info.programs?.length??0
      }
    }

    // Schedule after this React mount task, not after the first renderer rAF.
    // Waiting for the first 3D rAF can take seconds on slow GPUs and let the
    // visitor click BEFORE any laser beam has been primed. Actual GPU uploads
    // still yield to each subsequent browser paint and stop on summon.
    cancelTimeout = window.setTimeout(() => {
      void (async()=>{
        await waitForLandingPreflight()
        if (!interrupted()) await warm()
      })()
    }, 0)
    return () => {
      window.clearInterval(hudTimer)
      badge.remove()
      disposed = true
      clearTimeout(cancelTimeout)
      target?.dispose()
      stage?.clear()
    }
  }, [gl, scene, arenaState])
  return null
}
