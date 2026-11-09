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
export function patchMaterialize<T extends THREE.Material>(mat: T, uniforms: MaterializeUniforms, tag: string): T {
  mat.side = THREE.DoubleSide
  mat.customProgramCacheKey = () => `orbita-materialize-${tag}`
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
  }
  return mat
}
