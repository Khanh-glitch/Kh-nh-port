import * as THREE from 'three'

/** A Colossus-inspired scan, preserving each final material's physical settings. */
export type FabricationUniforms = {
  uScanY: THREE.IUniform<number>
  uWireHeight: THREE.IUniform<number>
  uTime: THREE.IUniform<number>
  uComplete: THREE.IUniform<number>
  uColor: THREE.IUniform<THREE.Color>
}
export function createFabricationUniforms(): FabricationUniforms {
  return {uScanY:{value:-100},uWireHeight:{value:.22},uTime:{value:0},uComplete:{value:0},uColor:{value:new THREE.Color('#52eaff')}}
}
export function patchFabrication<T extends THREE.Material>(material: T, uniforms: FabricationUniforms): T {
  const previous = material.onBeforeCompile
  material.customProgramCacheKey = () => 'hx9-fabrication-v1'
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer)
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
varying vec3 vHx9World;`).replace('#include <begin_vertex>', `#include <begin_vertex>
vec4 hx9Local = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  hx9Local = instanceMatrix * hx9Local;
#endif
vHx9World = (modelMatrix * hx9Local).xyz;`)
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vHx9World;
uniform float uScanY;
uniform float uWireHeight;
uniform float uTime;
uniform float uComplete;
uniform vec3 uColor;`).replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
if (uComplete < .999 && (vHx9World.y - uScanY) > uWireHeight + .025) discard;`).replace('#include <dithering_fragment>', `#include <dithering_fragment>
if (uComplete < .999) {
  float ripple = sin(vHx9World.x * 22.0 + uTime * 4.5) * cos(vHx9World.z * 21.0 - uTime * 3.8) * .018;
  float dy = (vHx9World.y - uScanY) + ripple;
  if (dy > uWireHeight) discard;
  if (dy > 0.0) {
    float gy = step(.83, abs(sin(vHx9World.y * 58.0)));
    float gx = step(.91, abs(sin(vHx9World.x * 48.0)));
    float gz = step(.91, abs(sin(vHx9World.z * 48.0)));
    float grid = clamp(gy + gx * .8 + gz * .8, 0.0, 1.0);
    float fade = clamp(1.0 - dy / max(.05, uWireHeight), 0.0, 1.0);
    if (grid < .25 && dy > .035) discard;
    vec3 holo = uColor * (.85 + 1.25 * grid) * (.35 + .65 * fade);
    gl_FragColor = vec4(clamp(holo, 0.0, 3.0), 1.0);
  } else {
    float seam = exp(-abs(dy) * 38.0);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, uColor * 2.0, clamp(seam * .9, 0.0, 1.0));
  }
}`)
  }
  material.needsUpdate = true
  return material
}
/** Scan moves past the part's full vertical bounds before restoring the exact material. */
export function fabricationScan(minY: number, maxY: number, progress: number) {
  const p = Math.max(0, Math.min(1, progress))
  return minY - .3 + (maxY - minY + .6) * p
}
