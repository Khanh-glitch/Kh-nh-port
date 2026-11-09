import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

export const FONT = '"Segoe UI", system-ui, -apple-system, "Helvetica Neue", Roboto, Arial, sans-serif'

export const NOISE_GLSL = /* glsl */ `
float hash13(vec3 p){ p = fract(p*0.1031); p += dot(p, p.zyx+31.32); return fract((p.x+p.y)*p.z); }
float vnoise(vec3 x){
  vec3 i=floor(x); vec3 f=fract(x); f=f*f*(3.0-2.0*f);
  return mix(
    mix(mix(hash13(i),hash13(i+vec3(1,0,0)),f.x), mix(hash13(i+vec3(0,1,0)),hash13(i+vec3(1,1,0)),f.x), f.y),
    mix(mix(hash13(i+vec3(0,0,1)),hash13(i+vec3(1,0,1)),f.x), mix(hash13(i+vec3(0,1,1)),hash13(i+vec3(1,1,1)),f.x), f.y),
    f.z);
}
float fbm(vec3 p){
  float a=0.5, s=0.0;
  for(int i=0;i<5;i++){ s+=a*vnoise(p); p=p*2.03+vec3(1.7,9.2,3.1); a*=0.5; }
  return s;
}
`

const boxCache = new Map<string, THREE.BufferGeometry>()
export function rbox(w: number, h: number, d: number, r = 0.05, seg = 3) {
  const key = [w, h, d, r, seg].join('_')
  let g = boxCache.get(key)
  if (!g) {
    g = new RoundedBoxGeometry(w, h, d, seg, Math.min(r, Math.min(w, h, d) / 2 - 0.0001))
    boxCache.set(key, g)
  }
  return g
}

let glowTex: THREE.CanvasTexture | null = null
export function glowTexture() {
  if (glowTex) return glowTex
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const x = c.getContext('2d')!
  const g = x.createRadialGradient(128, 128, 0, 128, 128, 128)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.15, 'rgba(255,255,255,0.55)')
  g.addColorStop(0.4, 'rgba(255,255,255,0.14)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  x.fillStyle = g
  x.fillRect(0, 0, 256, 256)
  glowTex = new THREE.CanvasTexture(c)
  glowTex.colorSpace = THREE.SRGBColorSpace
  return glowTex
}

export function canvasTex(w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, srgb = true) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  draw(ctx, w, h)
  const t = new THREE.CanvasTexture(c)
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return { canvas: c, ctx, tex: t }
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// Vật liệu "tia sáng volumetric" cho hình trụ/nón rỗng: gốc ở y=0, đầu xa ở uv.y=1
export function beamMaterial(color: THREE.ColorRepresentation, intensity = 1) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(color) }, uIntensity: { value: intensity } },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV; varying float vH;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        vH = uv.y;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uIntensity;
      varying vec3 vN; varying vec3 vV; varying float vH;
      void main(){
        float f = abs(dot(normalize(vN), normalize(vV)));
        float edge = pow(f, 1.7);
        float fade = pow(1.0 - vH, 1.25) * smoothstep(0.0, 0.03, vH + 0.02);
        float a = edge * fade;
        gl_FragColor = vec4(uColor * uIntensity, a);
      }`,
  })
}

export function beamGeometry(length: number, rFar: number, rNear = 0.02, seg = 20) {
  const g = new THREE.CylinderGeometry(rFar, rNear, length, seg, 1, true)
  g.translate(0, length / 2, 0)
  return g
}

export const rand = (a: number, b: number) => a + Math.random() * (b - a)
export const smooth = (a: number, b: number, x: number) => THREE.MathUtils.smoothstep(x, a, b)
