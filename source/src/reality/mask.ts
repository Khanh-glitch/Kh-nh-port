// ORBITA · Reality Rewrite — lõi "viết lại vật chất" + khí quyển (Aerial Haze, Contact AO, Gió & Độ Ẩm).
// Một mặt trận hình học (lưới lăng trụ lục giác) được dùng CHUNG bởi:
//  • vật liệu của thế giới gốc  -> kết tinh rồi biến mất khi mặt trận quét qua,
//  • vật liệu của thế giới mới  -> được "in" ra ngay tại đường quét, mọc từ sàn lên + hòa sương mù & bóng tiếp xúc,
//  • lưới lăng trụ ánh sáng thật (Front).
import * as THREE from 'three'

export const FRONT_MAX = 330
export const HEX_S = 4

export const RW = {
  // x: bán kính mặt trận, y: thời gian, z: bật(1)/tắt(0), w: mức âm thanh
  uRW: { value: new THREE.Vector4(0, 0, 0, 0) },
  uRWc: { value: new THREE.Vector3() },
  // xyz: màu mép (vàng), w: phụ trợ
  uRWt: { value: new THREE.Vector4(1.0, 0.72, 0.26, 0) },
  // khí quyển thực tại mới: rgb = màu sương mù chân trời, a = mật độ
  uRWhaze: { value: new THREE.Vector4(0.95, 0.68, 0.44, 0.0072) },
  // hướng mặt trời để tạo warm rim / scattering trong sương mù
  uRWsun: { value: new THREE.Vector3(-0.55, 0.16, -0.82).normalize() },
  // x: mưa (0..1), y: độ ẩm mặt sân/mái (0..1), z: hoa phượng bay (0..1), w: cường độ gió (0..1)
  uRWenv: { value: new THREE.Vector4(0, 0, 0, 0.25) },
}

export const GLSL_COMMON = /* glsl */ `
uniform vec4 uRW;
uniform vec3 uRWc;
uniform vec4 uRWt;
uniform vec4 uRWhaze;
uniform vec3 uRWsun;
uniform vec4 uRWenv;
float rwH(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
vec4 rwHex(vec2 p){
  const vec2 r = vec2(1.0, 1.7320508);
  const vec2 h = r*0.5;
  vec2 a = mod(p, r) - h;
  vec2 b = mod(p - h, r) - h;
  vec2 gv = dot(a,a) < dot(b,b) ? a : b;
  return vec4(p - gv, gv);
}
vec2 rwCid(vec2 c){ return vec2(floor(c.x*2.0+0.5)*0.5, floor(c.y/0.8660254+0.5)); }
float rwHexD(vec2 gv){ gv = abs(gv); return max(dot(gv, vec2(0.5, 0.8660254)), gv.x); }
// >0: vật chất tại điểm này đã bị mặt trận quét qua (thuộc thực tại mới)
float rwX(vec3 wp, out float edgeHex){
  vec3 d3 = wp - uRWc;
  float L = length(d3);
  edgeHex = 0.0;
  if (L < 135.0) {
    vec2 p = d3.xz / ${HEX_S.toFixed(1)};
    vec4 hx = rwHex(p);
    float cd = length(hx.xy) * ${HEX_S.toFixed(1)};
    float jit = rwH(rwCid(hx.xy)) * 9.0;
    edgeHex = rwHexD(hx.zw);
    return uRW.x - cd - jit - max(wp.y, 0.0) * 0.55;
  }
  float el = abs(d3.y / L);
  float n = rwH(floor(d3.xz / L * 40.0)) * 6.0;
  return uRW.x - (150.0 + el * 150.0) - n;
}
float rwGrow(float x, float len){
  float g = clamp(x / len, 0.0, 1.0);
  float c1 = 1.70158; float c3 = c1 + 1.0;
  float e = 1.0 + c3 * pow(g - 1.0, 3.0) + c1 * pow(g - 1.0, 2.0);
  return mix(0.0, e, step(0.0001, g));
}
`

const decl = 'varying vec3 vRWp;\nvarying float vRWg;\n'
// Uniform scalars permit ONE identical shader program for every numeric
// grow length / rim brightness / wind strength without changing their pixels.
const scalarDecl = 'uniform float uRWGrowLen;\nuniform float uRWGlow;\nuniform float uRWWind;\n'
const fragCommon = decl + scalarDecl + GLSL_COMMON
const vertCommon = decl + scalarDecl + GLSL_COMMON

const patched = new WeakMap<THREE.Material, string>()

type AnyMat = THREE.Material & {
  isShaderMaterial?: boolean
  isRawShaderMaterial?: boolean
  isSpriteMaterial?: boolean
}

function wire(shader: { uniforms: Record<string, { value: unknown }> }) {
  shader.uniforms.uRW = RW.uRW
  shader.uniforms.uRWc = RW.uRWc
  shader.uniforms.uRWt = RW.uRWt
  shader.uniforms.uRWhaze = RW.uRWhaze
  shader.uniforms.uRWsun = RW.uRWsun
  shader.uniforms.uRWenv = RW.uRWenv
}

export interface NewOpts {
  grow?: boolean
  growLen?: number
  glow?: number
  haze?: boolean
  ao?: boolean
  wind?: number
  wet?: boolean
}

/**
 * mode 'old': loại bỏ phần đã bị quét + phát sáng kết tinh ở mép.
 * mode 'new': chỉ hiển thị phần đã bị quét, mọc dần từ mặt đất + bóng tiếp xúc AO + sương mù khí quyển + độ ẩm mưa.
 */
export function patchMaterial(mat: THREE.Material, mode: 'old' | 'new', opts: NewOpts = {}) {
  const m = mat as AnyMat
  if (patched.has(m)) return
  if (m.isSpriteMaterial || m.isRawShaderMaterial) return
  const isShader = !!m.isShaderMaterial
  const prev = m.onBeforeCompile
  const prevKey = m.customProgramCacheKey
  // Snapshot the original key BEFORE replacing onBeforeCompile: the default
  // Three.js implementation calls this.onBeforeCompile.toString() dynamically.
  // Reading it afterwards can collapse different source shaders into one key.
  const originalKey = prevKey ? prevKey.call(m) : ''
  const grow = mode === 'new' && opts.grow !== false
  const gl = opts.growLen ?? 14
  const glow = opts.glow ?? 0.65
  const useHaze = mode === 'new' && opts.haze !== false
  const useAo = mode === 'new' && opts.ao !== false
  const useWet = mode === 'new' && !!opts.wet
  const wind = opts.wind ?? 0
  // Numerical values MUST NOT split programs. The original numeric values
  // remain material-local uniforms, evaluated using exactly the same GLSL.
  const tag = `rw-uniform-v2-${mode}-${grow ? 'g' : 'n'}-${useHaze ? 'h' : 'x'}-${useAo ? 'a' : 'x'}-${useWet ? 'wt' : 'x'}-${wind > 0 ? 'wind' : 'still'}`
  const scalars = {
    uRWGrowLen: { value: Number(gl.toFixed(1)) },
    uRWGlow: { value: Number(glow.toFixed(2)) },
    uRWWind: { value: Number(wind.toFixed(3)) },
  }
  patched.set(m, tag)

  m.onBeforeCompile = (shader, renderer) => {
    prev?.call(m, shader, renderer)
    wire(shader as unknown as { uniforms: Record<string, { value: unknown }> })
    // Every material receives its OWN parameter objects; a shared cached
    // GPU program never imposes another building's height, wind, or glow.
    Object.assign(shader.uniforms, scalars)
    let vs = shader.vertexShader
    let fs = shader.fragmentShader
    if (isShader) {
      if (!/void\s+main\s*\(\s*\)\s*\{/.test(vs) || !/void\s+main\s*\(\s*\)\s*\{/.test(fs)) return
      const inst = `
        mat4 rwM = modelMatrix;
        #ifdef USE_INSTANCING
          rwM = modelMatrix * instanceMatrix;
        #endif
        vRWp = (rwM * vec4(position, 1.0)).xyz;
        float rwEd0; vRWg = rwX((rwM * vec4(0.0,0.0,0.0,1.0)).xyz, rwEd0);
      `
      vs = vertCommon + vs.replace(/void\s+main\s*\(\s*\)\s*\{/, (s) => s + inst)
      const test =
        mode === 'old'
          ? 'float rwE; float rwx = rwX(vRWp, rwE); if (uRW.z > 0.5 && rwx > 0.0) discard;'
          : 'float rwE; float rwx = rwX(vRWp, rwE); if (uRW.z < 0.5 || rwx < 0.0) discard;'
      fs = fragCommon + fs.replace(/void\s+main\s*\(\s*\)\s*\{/, (s) => s + test)
    } else {
      if (!vs.includes('#include <begin_vertex>')) return
      const growCode = grow ? 'transformed.y *= rwGrow(vRWg, uRWGrowLen);' : ''
      const windCode =
        wind > 0
          ? `float wPh = vRWp.x * 0.25 + vRWp.z * 0.19 + vRWp.y * 0.35;
             float wAmp = uRWWind * (0.75 + uRWenv.w * 1.65);
             float wK = smoothstep(0.0, 1.5, vRWp.y) * wAmp;
             float wGust = 0.65 + 0.35 * sin(uRW.y * 0.6 + vRWp.x * 0.08 + vRWp.z * 0.06);
             transformed.x += (sin(uRW.y * 1.9 + wPh) * 0.8 + sin(uRW.y * 4.3 + wPh * 2.1) * 0.35 + 0.45 * uRWenv.w) * wK * wGust;
             transformed.z += (cos(uRW.y * 1.6 + wPh * 1.3) * 0.7 + 0.35 * uRWenv.w) * wK * wGust;`
          : ''
      vs =
        vertCommon +
        vs.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          {
            mat4 rwM = modelMatrix;
            #ifdef USE_INSTANCING
              rwM = modelMatrix * instanceMatrix;
            #endif
            vRWp = (rwM * vec4(transformed, 1.0)).xyz;
            float rwEd0; vRWg = rwX((rwM * vec4(0.0,0.0,0.0,1.0)).xyz, rwEd0);
            ${windCode}
            ${growCode}
            vRWp = (rwM * vec4(transformed, 1.0)).xyz;
          }`,
        )
      const head =
        mode === 'old'
          ? 'float rwE; float rwx = rwX(vRWp, rwE); if (uRW.z > 0.5 && rwx > 0.0) discard;'
          : 'float rwE; float rwx = rwX(vRWp, rwE); if (uRW.z < 0.5 || rwx < 0.0) discard;'
      fs = fragCommon + fs.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\n${head}`)

      if (useWet && fs.includes('#include <roughnessmap_fragment>')) {
        fs = fs.replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
           roughnessFactor = mix(roughnessFactor, max(0.14, roughnessFactor * 0.42), uRWenv.y * 0.78);`,
        )
      }
      const wetDark = useWet ? `gl_FragColor.rgb *= mix(1.0, 0.82, uRWenv.y * 0.85);` : ''
      const aoCode = useAo
        ? `float rwGroundAO = mix(0.68, 1.0, smoothstep(0.0, 1.15, vRWp.y));
           gl_FragColor.rgb *= rwGroundAO;`
        : ''
      const hazeCode = useHaze
        ? `vec3 rwCam = cameraPosition - vRWp;
           float rwDist = length(rwCam);
           vec3 rwRay = -rwCam / max(rwDist, 0.001);
           float rwHFactor = 1.0 - exp(-max(rwDist - 10.0, 0.0) * uRWhaze.w * exp(-max(vRWp.y, 0.0) * 0.015));
           float rwSun = pow(max(dot(rwRay, normalize(uRWsun)), 0.0), 5.0);
           vec3 rwFogCol = uRWhaze.rgb + vec3(0.45, 0.25, 0.08) * rwSun * (1.0 - uRWenv.x * 0.65);
           gl_FragColor.rgb = mix(gl_FragColor.rgb, rwFogCol, clamp(rwHFactor * 0.85, 0.0, 0.88));`
        : ''
      const tail =
        mode === 'old'
          ? `if (uRW.z > 0.5) { float k = smoothstep(-5.5, 0.0, rwx); float hl = smoothstep(0.42, 0.5, rwE); gl_FragColor.rgb += uRWt.xyz * (k*k*1.6 + hl*k*2.2); }`
          : `{ ${wetDark} ${aoCode} ${hazeCode} float f = 1.0 - smoothstep(0.0, 5.5, rwx); float hl = smoothstep(0.43, 0.5, rwE); gl_FragColor.rgb += uRWt.xyz * uRWGlow * (f*f*1.4 + hl*f*1.8); }`
      if (fs.includes('#include <dithering_fragment>')) fs = fs.replace('#include <dithering_fragment>', `${tail}\n#include <dithering_fragment>`)
    }
    shader.vertexShader = vs
    shader.fragmentShader = fs
  }
  m.customProgramCacheKey = () => originalKey + '|' + tag
  m.needsUpdate = true
}

export const patchOld = (m: THREE.Material | THREE.Material[]) => (Array.isArray(m) ? m : [m]).forEach((x) => patchMaterial(x, 'old'))
export const patchNew = <T extends THREE.Material>(m: T, o?: NewOpts): T => {
  patchMaterial(m, 'new', o)
  return m
}

export function frontReached(dist: number, y: number) {
  return RW.uRW.value.x - dist - 9 - Math.max(y, 0) * 0.55
}

export const ease = {
  inOut: (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  out: (t: number) => 1 - Math.pow(1 - t, 3),
  smooth: (a: number, b: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)
  },
}
