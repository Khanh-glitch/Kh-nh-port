import * as THREE from 'three'

export interface MaterializeUniforms {
  uScanY: { value: number }
  uWireHeight: { value: number }
  uTime: { value: number }
  uComplete: { value: number }
  uColor: { value: THREE.Color }
  [key: string]: THREE.IUniform<unknown>
}

export function createMaterializeUniforms(color: THREE.ColorRepresentation): MaterializeUniforms {
  return {
    uScanY: { value: -2 },
    uWireHeight: { value: 0.75 },
    uTime: { value: 0 },
    uComplete: { value: 0 },
    uColor: { value: new THREE.Color(color) },
  }
}

/**
 * Patches any MeshStandardMaterial / MeshPhysicalMaterial with a world-Y
 * laser-fabrication scanline & holographic blueprint grid shader.
 * When uComplete >= 0.999, renders standard PBR with zero clipping.
 */
export function patchMaterialize<T extends THREE.Material>(mat: T, uniforms: MaterializeUniforms, _tag: string): T {
  mat.side = THREE.DoubleSide
  mat.userData.orbitaMaterialize = true
  // Every material uses identical injected GLSL. The renderer already keys
  // differences in map, material type, lighting, skinning and vertex defines.
  // A per-material tag here incorrectly multiplies shader programs and
  // first-summon compilation. Uniforms remain PER MATERIAL, never shared by
  // this program-cache deduplication.
  // Opt-in experiment; default retains original shaders until frame and visual
  // parity gates pass. Move ONLY the rejection of zero-visible-pixel fragments
  // ahead of costly PBR lighting; keep the final color equation unchanged.
  const earlyVariant = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('colossusEarlyDiscardProbe')
    : null
  const earlyDiscardProbe = earlyVariant === 'on' || earlyVariant === 'fast'
  const fastBoundProbe = earlyVariant === 'fast'
  // Keep the original cache identity for every production material.
  mat.customProgramCacheKey = () => 'orbita-materialize-shared-v1'
  // The opt-in experiment is a distinct shared GLSL program family.
  if (earlyDiscardProbe) mat.customProgramCacheKey = () => fastBoundProbe
    ? 'orbita-materialize-fast-bound-v3'
    : 'orbita-materialize-early-reject-v2'
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uScanY = uniforms.uScanY
    shader.uniforms.uWireHeight = uniforms.uWireHeight
    shader.uniforms.uTime = uniforms.uTime
    shader.uniforms.uComplete = uniforms.uComplete
    shader.uniforms.uColor = uniforms.uColor

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vMatWorldPos;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vMatWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
      )

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vMatWorldPos;
        uniform float uScanY;
        uniform float uWireHeight;
        uniform float uTime;
        uniform float uComplete;
        uniform vec3 uColor;`,
      )
      .replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
        if (uComplete < 0.999) {
          float ripple = sin(vMatWorldPos.x * 14.0 + uTime * 4.5) * cos(vMatWorldPos.z * 14.0 - uTime * 3.8) * 0.035;
          float dy = (vMatWorldPos.y - uScanY) + ripple;
          if (dy > uWireHeight) {
            discard;
          }
          if (dy > 0.0) {
            float gY = step(0.84, abs(sin(vMatWorldPos.y * 22.0)));
            float gX = step(0.86, abs(sin(vMatWorldPos.x * 18.0)));
            float gZ = step(0.86, abs(sin(vMatWorldPos.z * 18.0)));
            float grid = clamp(gY + gX * 0.8 + gZ * 0.8, 0.0, 1.0);
            float fade = clamp(1.0 - dy / max(0.05, uWireHeight), 0.0, 1.0);
            if (grid < 0.25 && dy > 0.1) {
              discard;
            }
            vec3 holo = uColor * (0.9 + 1.2 * grid) * (0.35 + 0.65 * fade);
            gl_FragColor = vec4(clamp(holo, 0.0, 3.0), 1.0);
          } else {
            float seam = exp(-abs(dy) * 14.0);
            vec3 weld = mix(gl_FragColor.rgb, uColor * 2.1, clamp(seam * 0.95, 0.0, 1.0));
            gl_FragColor = vec4(clamp(weld, 0.0, 3.5), gl_FragColor.a);
          }
        }`,
      )
    if (fastBoundProbe) {
      // Strictly conservative upper bound: ripple amplitude <= 0.035.
      // Above wireHeight + 0.04 the ORIGINAL shader necessarily discards,
      // so reject BEFORE texture sampling and PBR without any sine/cosine.
      // This does not cull fragments near the actual laser band.
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
        if (uComplete < 0.999 && (vMatWorldPos.y - uScanY) > uWireHeight + 0.04) discard;`,
      )
    }
    if (earlyDiscardProbe) {
      // Alpha/texture sampling has already occurred, but lighting has not.
      // The original end-of-fragment discard and final color math remain
      // intact. Masked fragments must satisfy IDENTICAL discard conditions.
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <alphatest_fragment>',
        `#include <alphatest_fragment>
        if (uComplete < 0.999) {
          float earlyRipple = sin(vMatWorldPos.x * 14.0 + uTime * 4.5) * cos(vMatWorldPos.z * 14.0 - uTime * 3.8) * 0.035;
          float earlyDy = (vMatWorldPos.y - uScanY) + earlyRipple;
          if (earlyDy > uWireHeight) discard;
          if (earlyDy > 0.1) {
            float earlyGY = step(0.84, abs(sin(vMatWorldPos.y * 22.0)));
            float earlyGX = step(0.86, abs(sin(vMatWorldPos.x * 18.0)));
            float earlyGZ = step(0.86, abs(sin(vMatWorldPos.z * 18.0)));
            float earlyGrid = clamp(earlyGY + earlyGX * 0.8 + earlyGZ * 0.8, 0.0, 1.0);
            if (earlyGrid < 0.25) discard;
          }
        }`,
      )
    }
  }
  return mat
}


/**
 * Exact draw-call culling for the unmodified materialization shader.
 * The shader discards every fragment whose world Y is higher than
 * uScanY + uWireHeight (+/- the 0.035 ripple). Such a mesh has ZERO visible
 * pixels, so skipping its draw/initial VBO upload until the scan reaches it
 * cannot change the intended rendered image. Culling uses conservative
 * world-space AABBs and leaves separately animated/effect meshes alone.
 */
export interface ScanCullEntry {
  mesh: THREE.Mesh
  localBounds: THREE.Box3
  worldBounds: THREE.Box3
}
export function collectScanCullMeshes(root: THREE.Object3D, skip: ReadonlySet<THREE.Object3D> = new Set()): ScanCullEntry[] {
  const entries: ScanCullEntry[] = []
  root.traverse(obj => {
    // Instanced meshes need per-instance bounds, so leave them to their
    // existing animation/visibility owner rather than using one geometry box.
    if (skip.has(obj) || !(obj as THREE.Mesh).isMesh || (obj as THREE.InstancedMesh).isInstancedMesh || !obj.visible) return
    const mesh = obj as THREE.Mesh
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    if (!mats.length || mats.some(m => !m?.userData?.orbitaMaterialize)) return
    const geometry = mesh.geometry
    if (!geometry.boundingBox) geometry.computeBoundingBox()
    if (!geometry.boundingBox) return
    entries.push({ mesh, localBounds: geometry.boundingBox, worldBounds: new THREE.Box3() })
  })
  return entries
}
export function updateScanCullMeshes(
  root: THREE.Object3D,
  entries: readonly ScanCullEntry[],
  scanWorldY: number,
  wireHeight: number,
  complete: boolean,
): void {
  if (complete) {
    for (const entry of entries) entry.mesh.visible = true
    return
  }
  // Animated transforms are refreshed once and bounds are conservative:
  // a mesh is culled ONLY when no point of its geometry could reach the
  // existing shader's visible band. This preserves world-Y scan silhouettes.
  root.updateWorldMatrix(true, true)
  const edgeY = scanWorldY + wireHeight + 0.06
  for (const entry of entries) {
    entry.worldBounds.copy(entry.localBounds).applyMatrix4(entry.mesh.matrixWorld)
    entry.mesh.visible = entry.worldBounds.min.y <= edgeY
  }
}
