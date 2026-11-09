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
export function ShowcaseWarmup() {
  const { gl, scene } = useThree()

  useEffect(() => {
    let disposed = false
    let raf = 0
    let cancelTimeout = 0
    let stage: THREE.Scene | null = null
    let target: THREE.WebGLRenderTarget | null = null
    const info = {
      status: 'scheduled',
      meshes: 0,
      sprites: 0,
      beams: 0,
      variants: [] as { name: string; ms: number; programs: number }[],
      extraApexLights: 0,
      extraRagLights: 0,
      textureMaps: 0,
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
    document.body.appendChild(badge)
    updateBadge()
    const hudTimer = window.setInterval(updateBadge, 500)

    const warm = async () => {
      if (disposed) return
      const roots = ['apex-showcase-root', 'ragnarok-showcase-root']
        .map(name => scene.getObjectByName(name))
      // These laser meshes belong to Robot, not the two showcase root groups.
      const beamNames = ['colossus-warm-beam-left', 'colossus-warm-beam-right', 'colossus-warm-beam-eye', 'colossus-warm-impact']
      const beams = beamNames.map(name => scene.getObjectByName(name)).filter((o): o is THREE.Object3D => !!o)
      info.beams = beams.length
      roots.push(...beams)
      if (roots.some(root => !root)) {
        info.status = 'missing-roots'
        return
      }

      const started = performance.now()
      info.status = 'compiling'
      info.programsBefore = gl.info.programs?.length ?? 0
      stage = new THREE.Scene()
      stage.environment = scene.environment
      stage.fog = scene.fog
      stage.background = null
      const stageNow = stage
      // First APEX reveal enables a previously hidden PointLight.
      // Compile the real light-count variants before the first laser.
      const baseVisibleLights = new Set<THREE.Object3D>()
      const extraLights = (root: THREE.Object3D | undefined | null): THREE.Light[] => {
        const list: THREE.Light[] = []
        root?.traverse(obj => {
          if (!(obj as THREE.Light).isLight || baseVisibleLights.has(obj)) return
          list.push((obj as THREE.Light).clone(false))
        })
        return list
      }
      // Preserve shadow/light-dependent shader defines, unlike the previous
      // purely unlit proxy collection.
      scene.traverseVisible(object => {
        if (!(object as THREE.Light).isLight) return
        baseVisibleLights.add(object)
        const light = (object as THREE.Light).clone(false)
        stageNow.add(light)
      })

      const textures = new Set<THREE.Texture>()
      roots.forEach(root => root!.traverse(object => {
        const m = object as THREE.Mesh
        const s = object as THREE.Sprite
        if (!m.isMesh && !s.isSprite) return
        const proxy = object.clone(false) as THREE.Object3D
        // Flatten every hidden hierarchy for GPU preparation. Frustum culling
        // is disabled ONLY on these temporary proxies, not on the real scene.
        proxy.position.set(0, 0, 0)
        proxy.rotation.set(0, 0, 0)
        proxy.scale.setScalar(1)
        proxy.frustumCulled = false
        proxy.visible = true
        if ((m as THREE.InstancedMesh).isInstancedMesh) {
          const source = m as THREE.InstancedMesh
          const copy = proxy as THREE.InstancedMesh
          // Warm the REAL instance attributes as well, not throwaway copies.
          copy.instanceMatrix = source.instanceMatrix
          copy.instanceColor = source.instanceColor
        }
        stageNow.add(proxy)
        if (s.isSprite) info.sprites++
        else info.meshes++
        const mats = Array.isArray(m.material) ? m.material : [m.material]
        for (const mat of mats) {
          if (!mat) continue
          for (const name of ['map', 'alphaMap', 'emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap'] as const) {
            const t = (mat as THREE.MeshStandardMaterial)[name]
            if (t?.isTexture) textures.add(t)
          }
        }
      }))
      info.textureMaps = textures.size
      const camera = new THREE.PerspectiveCamera(60, 1, 0.01, 200)
      camera.position.set(0, 0, 12)
      camera.lookAt(0, 0, 0)
      const oldTarget = gl.getRenderTarget()
      const oldViewport = gl.getViewport(new THREE.Vector4()).clone()
      const oldScissor = gl.getScissor(new THREE.Vector4()).clone()
      const oldScissorTest = gl.getScissorTest()
      const oldXR = gl.xr.enabled
      const oldAutoClear = gl.autoClear
      let restored = false
      try {
        // Program compilation alone cannot remove the first-draw upload hitch.
        // Compile first, then issue the actual draw calls offscreen to upload
        // vertex/index/instance buffers, textures and renderer-side VAOs.
                const compileVariant = async (name: string, lights: THREE.Light[]) => {
          const t0 = performance.now()
          lights.forEach(light => stageNow.add(light))
          try {
            if (typeof gl.compileAsync === 'function') {
              try { await gl.compileAsync(stageNow, camera) }
              catch { gl.compile(stageNow, camera) }
            } else gl.compile(stageNow, camera)
            info.variants.push({ name, ms: Math.round(performance.now() - t0), programs: gl.info.programs?.length ?? 0 })
          } finally { lights.forEach(light => stageNow.remove(light)) }
        }
        await compileVariant('dormant', [])
        const apexLights = extraLights(roots[0])
        const ragLights = extraLights(roots[1])
        info.extraApexLights = apexLights.length
        info.extraRagLights = ragLights.length
        if (apexLights.length) await compileVariant('laser-apex', apexLights)
        if (apexLights.length || ragLights.length) await compileVariant('laser-ragnarok', [...apexLights, ...ragLights])
        if (disposed) return
        info.status = 'uploading'
        target = new THREE.WebGLRenderTarget(96, 96, { depthBuffer: true, stencilBuffer: false })
        textures.forEach(t => {
          try { gl.initTexture(t) } catch { /* Rendering below retries it. */ }
        })
        gl.xr.enabled = false
        gl.autoClear = true
        gl.setRenderTarget(target)
        gl.setViewport(0, 0, 96, 96)
        gl.setScissorTest(false)
        gl.clear(true, true, false)
        gl.render(stageNow, camera)
        // Use a non-blocking GPU fence, not synchronous gl.readPixels.
        // Restore the public render target BEFORE awaiting so R3F keeps rendering.
        if (typeof gl.readRenderTargetPixelsAsync === 'function') {
          const fence = gl.readRenderTargetPixelsAsync(target, 0, 0, 1, 1, new Uint8Array(4))
          gl.setRenderTarget(oldTarget)
          gl.setViewport(oldViewport)
          gl.setScissor(oldScissor)
          gl.setScissorTest(oldScissorTest)
          gl.xr.enabled = oldXR
          gl.autoClear = oldAutoClear
          restored = true
          info.status = 'gpu-pending'
          await fence
          info.gpuSynced = true
          info.status = 'ready'
        } else {
          gl.getContext().flush()
          info.status = 'submitted-no-async-readback'
        } 
      } catch (err) {
        info.status = 'failed'
        info.error = String(err)
        console.warn('[Colossus] GPU prewarm failed; normal rendering preserved:', err)
      } finally {
        if (!restored) {
        gl.setRenderTarget(oldTarget)
        gl.setViewport(oldViewport)
        gl.setScissor(oldScissor)
        gl.setScissorTest(oldScissorTest)
        gl.xr.enabled = oldXR
        gl.autoClear = oldAutoClear
        }
        target?.dispose()
        target = null
        // Clones share original source materials and geometries: dispose only
        // the private render target. Never dispose the real exhibit assets.
        stageNow.traverse(o => {
          if ((o as THREE.Light).isLight) {
            const shadow = (o as THREE.Light & { shadow?: THREE.LightShadow }).shadow
            shadow?.dispose()
          }
        })
        stageNow.clear()
        stage = null
        info.durationMs = Math.round(performance.now() - started)
        info.programsAfter = gl.info.programs?.length ?? 0
        // No URL-hash-specific startup work: use identical warmup execution.
        // The experimental LASER LAB overlay reads this same info on both URLs.
      }
    }

    // Execute early during the landing phase, NOT after an arbitrary idle
    // timeout. This gives a visitor walking across the 60m disc a fully hot
    // exhibit before reaching Colossus. GPU work is paid once, at startup.
    raf = requestAnimationFrame(() => {
      cancelTimeout = window.setTimeout(() => { void warm() }, 80)
    })
    return () => {
      window.clearInterval(hudTimer)
      badge.remove()
      disposed = true
      cancelAnimationFrame(raf)
      clearTimeout(cancelTimeout)
      target?.dispose()
      stage?.clear()
    }
  }, [gl, scene])
  return null
}
