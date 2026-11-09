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

    const warm = async () => {
      if (disposed) return
      const roots = ['apex-showcase-root', 'ragnarok-showcase-root']
        .map(name => scene.getObjectByName(name))
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
      // Preserve shadow/light-dependent shader defines, unlike the previous
      // purely unlit proxy collection.
      scene.traverse(object => {
        if (!(object as THREE.Light).isLight) return
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
      try {
        // Program compilation alone cannot remove the first-draw upload hitch.
        // Compile first, then issue the actual draw calls offscreen to upload
        // vertex/index/instance buffers, textures and renderer-side VAOs.
        if (typeof gl.compileAsync === 'function') {
          try { await gl.compileAsync(stageNow, camera) }
          catch { gl.compile(stageNow, camera) }
        } else gl.compile(stageNow, camera)
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
        // One-pixel readback is a deliberate synchronization barrier. It
        // prevents previously queued driver shader/buffer work from migrating
        // into the visitor's first laser-animation frame.
        gl.readRenderTargetPixels(target, 0, 0, 1, 1, new Uint8Array(4))
        info.gpuSynced = true
        info.status = 'ready' 
      } catch (err) {
        info.status = 'failed'
        info.error = String(err)
        console.warn('[Colossus] GPU prewarm failed; normal rendering preserved:', err)
      } finally {
        gl.setRenderTarget(oldTarget)
        gl.setViewport(oldViewport)
        gl.setScissor(oldScissor)
        gl.setScissorTest(oldScissorTest)
        gl.xr.enabled = oldXR
        gl.autoClear = oldAutoClear
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
        if (location.hash.includes('colossus-profile')) {
          console.info('[Colossus] GPU startup prewarm:', { ...info })
        }
      }
    }

    // Execute early during the landing phase, NOT after an arbitrary idle
    // timeout. This gives a visitor walking across the 60m disc a fully hot
    // exhibit before reaching Colossus. GPU work is paid once, at startup.
    raf = requestAnimationFrame(() => {
      cancelTimeout = window.setTimeout(() => { void warm() }, 80)
    })
    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      clearTimeout(cancelTimeout)
      target?.dispose()
      stage?.clear()
    }
  }, [gl, scene])
  return null
}
