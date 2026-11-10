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

  useEffect(() => {
    let disposed = false
    let cancelTimeout = 0
    let stage: THREE.Scene | null = null
    let target: THREE.WebGLRenderTarget | null = null
    const info = {
      status: 'scheduled',
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
      uploadedProxies: 0,
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
    const nextPaint = () => new Promise<void>(resolve => {
      requestAnimationFrame(() => window.setTimeout(resolve, 0))
    })
    const warm = async () => {
      if (interrupted()) { info.status = 'cancelled-on-summon'; return }
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
        if (copy.castShadow && shadow) shadow.mapSize.set(64, 64)
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
      roots.forEach(root => root!.traverse(object => {
        const m = object as THREE.Mesh
        const sprite = object as THREE.Sprite
        if (!m.isMesh && !sprite.isSprite) return
        const proxy = object.clone(false) as THREE.Object3D
        proxy.position.set(0, 0, 0)
        proxy.rotation.set(0, 0, 0)
        proxy.scale.setScalar(1)
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
            if (t?.isTexture) textures.add(t)
          }
        }
      }))
      info.textureMaps = textures.size
      info.totalProxies = proxies.length
      const camera = new THREE.PerspectiveCamera(60, 1, 0.01, 200)
      camera.position.set(0, 0, 12)
      camera.lookAt(0, 0, 0)

      // Capture/restores the *current* framebuffer on each independent pass.
      // Never keep a private target bound across requestAnimationFrame/await.
      const withTarget = (fn: () => void) => {
        const prevTarget = gl.getRenderTarget()
        const prevViewport = gl.getViewport(new THREE.Vector4()).clone()
        const prevScissor = gl.getScissor(new THREE.Vector4()).clone()
        const prevTest = gl.getScissorTest()
        const prevXR = gl.xr.enabled
        const prevClear = gl.autoClear
        try {
          gl.xr.enabled = false
          gl.autoClear = true
          gl.setRenderTarget(target)
          gl.setViewport(0, 0, 96, 96)
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
        if (typeof gl.compileAsync === 'function') {
          const begin = performance.now()
          await gl.compileAsync(stageNow, camera)
          info.variants.push({ name:'stable-light', ms:Math.round(performance.now()-begin), programs:gl.info.programs?.length ?? 0 })
        }
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
        info.status = 'uploading-textures'
        for (const texture of textures) {
          await nextPaint()
          if (interrupted()) { info.status='cancelled-on-summon'; return }
          try { gl.initTexture(texture) } catch { /* The real renderer can upload it. */ }
        }
        if (interrupted()) { info.status='cancelled-on-summon'; return }
        target = new THREE.WebGLRenderTarget(96, 96, { depthBuffer:true, stencilBuffer:false })
        proxies.forEach(proxy => { proxy.visible = false })
        info.status = 'uploading'
        for (const proxy of proxies) {
          await nextPaint()
          if (interrupted()) { info.status='cancelled-on-summon'; return }
          proxy.visible = true
          try {
            withTarget(() => {
              gl.clear(true, true, false)
              gl.render(stageNow, camera)
            })
          } finally {
            proxy.visible = false
          }
          info.uploadedProxies++
        }
        info.drawnVariants.push({ name:'incremental', programs:gl.info.programs?.length ?? 0 })
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
    cancelTimeout = window.setTimeout(() => { void warm() }, 0)
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
