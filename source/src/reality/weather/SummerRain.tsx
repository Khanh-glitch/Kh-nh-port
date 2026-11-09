// ORBITA · Cơn Mưa Mùa Hạ ("Mùa Hạ Thứ 18")
// Hệ thống mưa không gian 3D gắn với kiến trúc & ánh sáng sân trường UEH:
//  1. RainStreaks : Hạt mưa kéo sợi mảnh theo gió nhẹ trong không gian thế giới (world-space wrapping,
//                   billboard quanh trục vận tốc, có tính đến mái che công trình UEH & nắp đàn Piano).
//  2. RoofDrips   : Giọt nước nhỏ giọt dọc mép mái hiên Cơ sở A, mái che Góc Sinh Viên & sảnh B1.
//  3. RainSplashes: Vòng nước bắn mảnh bật lên trên mặt sân gạch ẩm ướt & vũng nước (bỏ qua vùng có mái che).
//  4. SummerMist  : Làn hơi ẩm mỏng manh lướt thấp trên sân trường dưới nắng chiều dịu.
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { EXHIBITS } from '../../layout'
import { useStore } from '../../store'
import { patchNew, RW } from '../mask'
import { WU } from '../kit'
import { rt } from '../state'

const E = EXHIBITS

// Các mái che thực tế của UEH (tọa độ thế giới): x, z, rotY, halfW, halfD, roofY
const SHELTERS = [
  { x: E.robot.x, z: E.robot.z, rot: 0, hw: 9.6, hd: 5.8, y: 50 }, // B1
  { x: E.robot.x - 27.5, z: E.robot.z, rot: 0, hw: 10.4, hd: 5.7, y: 17.8 }, // B2
  { x: E.robot.x - 13.5, z: E.robot.z, rot: 0, hw: 4.7, hd: 1.9, y: 12.7 }, // Cầu nối B1-B2
  { x: E.cinema.x, z: E.cinema.z, rot: E.cinema.rotY, hw: 11.8, hd: 5.4, y: 10.2 }, // Cơ sở A
  { x: E.rubik.x, z: E.rubik.z, rot: -0.45, hw: 5.6, hd: 5.0, y: 10.9 }, // Thư viện
  { x: E.stage.x, z: E.stage.z, rot: E.stage.rotY, hw: 7.4, hd: 4.1, y: 8.2 }, // Sân khấu
  { x: E.products.x, z: E.products.z, rot: -0.45, hw: 5.2, hd: 3.2, y: 3.9 }, // Mái che Góc Sinh Viên
  { x: E.piano.x, z: E.piano.z, rot: E.piano.rotY, hw: 1.4, hd: 2.0, y: 1.85 }, // Đàn Grand Piano
]

const SH_POS = SHELTERS.map((s) => new THREE.Vector4(s.x, s.z, Math.cos(s.rot), Math.sin(s.rot)))
const SH_DIM = SHELTERS.map((s) => new THREE.Vector4(s.hw, s.hd, s.y, 0))

const SHELTER_GLSL = /* glsl */ `
uniform vec4 uShPos[8];
uniform vec4 uShDim[8];
float roofHeightAt(vec2 xz){
  float top = 0.0;
  for (int i = 0; i < 8; i++) {
    vec2 d = xz - uShPos[i].xy;
    float c = uShPos[i].z; float s = uShPos[i].w;
    vec2 l = vec2(d.x * c - d.y * s, d.x * s + d.y * c);
    if (abs(l.x) < uShDim[i].x && abs(l.y) < uShDim[i].y) {
      top = max(top, uShDim[i].z);
    }
  }
  return top;
}
`

// ------------------------------------------------------------------ 1. Hạt mưa 3D world-space
const streakVS = /* glsl */ `
${SHELTER_GLSL}
attribute vec4 aSeed; // x, y, z (0..1 trong khối bọc quanh người chơi), w (seed 0..1)
uniform float uTime;
uniform float uRain;
uniform vec3 uCam;
varying vec2 vUv;
varying float vAlpha;
varying float vSun;
void main(){
  vUv = uv;
  if (uRain < 0.01 || aSeed.w > uRain * 1.06) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vAlpha = 0.0;
    return;
  }
  float span = 46.0;
  float H = 28.0;
  float speed = 13.5 + aSeed.w * 5.0;
  vec3 vel = normalize(vec3(0.11 + sin(uTime * 0.45) * 0.04, -1.0, 0.07));

  // vị trí hạt mưa cuộn mượt trong không gian thế giới quanh người chơi
  float fallT = uTime * speed;
  float wx0 = (aSeed.x - 0.5) * span + vel.x * fallT;
  float wz0 = (aSeed.z - 0.5) * span + vel.z * fallT;
  float wx = uCam.x + mod(wx0 - uCam.x + span * 0.5, span) - span * 0.5;
  float wz = uCam.z + mod(wz0 - uCam.z + span * 0.5, span) - span * 0.5;
  float wy = mod(aSeed.y * H - fallT, H);

  // kiểm tra mái che: ẩn đoạn mưa rơi xuống dưới mái nhà
  float roof = roofHeightAt(vec2(wx, wz));
  if (roof > 0.1 && wy < roof) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vAlpha = 0.0;
    return;
  }
  // chỉ rơi trên phạm vi chiếc đĩa (R ~ 62m)
  if (length(vec2(wx, wz)) > 63.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vAlpha = 0.0;
    return;
  }

  vec3 center = vec3(wx, wy, wz);
  vec3 toCam = normalize(cameraPosition - center);
  vec3 cr = cross(vel, toCam);
  vec3 right = length(cr) > 1e-4 ? normalize(cr) : vec3(1.0, 0.0, 0.0);
  float width = 0.022 + aSeed.w * 0.014;
  float len = 0.72 + aSeed.w * 0.46;
  vec3 worldPos = center + right * (position.x * width) + vel * (position.y * len);

  float dist = length(cameraPosition - center);
  float nearFade = smoothstep(0.9, 2.5, dist);
  float farFade = 1.0 - smoothstep(20.0, 28.0, dist);
  float topFade = 1.0 - smoothstep(22.0, H, wy);
  float gFade = smoothstep(0.05, 0.55, wy - roof);
  float appear = smoothstep(0.0, 0.25, uRain - aSeed.w * 0.55);

  vAlpha = nearFade * farFade * topFade * gFade * appear * (0.44 + aSeed.w * 0.30);
  vec3 sunDir = normalize(vec3(-0.55, 0.16, -0.82));
  vSun = pow(max(dot(-toCam, sunDir), 0.0), 4.0);

  gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
}
`
const streakFS = /* glsl */ `
varying vec2 vUv;
varying float vAlpha;
varying float vSun;
void main(){
  if (vAlpha < 0.003) discard;
  float x = abs(vUv.x - 0.5) * 2.0;
  float y = vUv.y;
  // sợi mưa mảnh mềm mại, nhọn nhẹ ở hai đầu
  float core = exp(-x * x * 5.2);
  float tip = smoothstep(0.0, 0.22, y) * (1.0 - smoothstep(0.75, 1.0, y));
  float a = core * tip * vAlpha;
  vec3 col = mix(vec3(0.74, 0.84, 0.96), vec3(1.0, 0.88, 0.72), 0.22 + vSun * 0.58);
  gl_FragColor = vec4(col * 1.15, a);
}
`

function RainStreaks({ low }: { low: boolean }) {
  const N = low ? 1500 : 2600
  const geo = useMemo(() => {
    const base = new THREE.PlaneGeometry(1, 1)
    const g = new THREE.InstancedBufferGeometry()
    g.index = base.index
    g.attributes.position = base.attributes.position
    g.attributes.uv = base.attributes.uv
    const seeds = new Float32Array(N * 4)
    for (let i = 0; i < N; i++) {
      seeds[i * 4] = Math.random()
      seeds[i * 4 + 1] = Math.random()
      seeds[i * 4 + 2] = Math.random()
      seeds[i * 4 + 3] = Math.random()
    }
    g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4))
    g.instanceCount = N
    return g
  }, [N])

  const cam = useMemo(() => new THREE.Vector3(), [])
  const uRain = useMemo(() => ({ value: 0 }), [])
  const mat = useMemo(() => {
    const m = new THREE.ShaderMaterial({
      vertexShader: streakVS,
      fragmentShader: streakFS,
      uniforms: { uTime: WU.uTime, uRain, uCam: { value: cam }, uShPos: { value: SH_POS }, uShDim: { value: SH_DIM } },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    })
    return patchNew(m, { grow: false, haze: false, ao: false })
  }, [cam, uRain])

  const mesh = useRef<THREE.Mesh>(null)
  useFrame((s) => {
    uRain.value = rt.rain
    cam.copy(s.camera.position)
    if (mesh.current) mesh.current.visible = rt.rain > 0.008 || RW.uRW.value.z < 0.5
  })
  return <mesh ref={mesh} geometry={geo} material={mat} frustumCulled={false} renderOrder={12} />
}

// ------------------------------------------------------------------ 2. Vòng nước bắn trên mặt sân (Splash Crowns)
const splashVS = /* glsl */ `
${SHELTER_GLSL}
attribute vec4 aPos; // x, z, phase, scale
uniform float uTime;
uniform float uRain;
uniform vec3 uCam;
varying vec2 vUv;
varying float vLife;
varying float vAlpha;
void main(){
  vUv = uv;
  if (uRain < 0.02 || aPos.w > uRain * 1.05) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vAlpha = 0.0;
    return;
  }
  float span = 38.0;
  float cyc = fract(uTime * 2.1 + aPos.z);
  float slot = floor(uTime * 2.1 + aPos.z);
  float jx = fract(sin(slot * 12.989 + aPos.z * 71.1) * 43758.54) - 0.5;
  float jz = fract(sin(slot * 78.233 + aPos.z * 39.7) * 43758.54) - 0.5;
  float wx = uCam.x + mod(aPos.x + jx * 4.0 - uCam.x + span * 0.5, span) - span * 0.5;
  float wz = uCam.z + mod(aPos.y + jz * 4.0 - uCam.z + span * 0.5, span) - span * 0.5;
  float roof = roofHeightAt(vec2(wx, wz));
  if (roof > 0.1 || length(vec2(wx, wz)) > 58.2) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vAlpha = 0.0;
    return;
  }
  float r = (0.09 + cyc * 0.32) * (0.7 + aPos.w * 0.55);
  vec3 wp = vec3(wx + position.x * r, 0.058 + sin(cyc * 3.14159) * 0.018, wz - position.y * r);
  float dist = length(cameraPosition - wp);
  vLife = cyc;
  vAlpha = (1.0 - cyc) * smoothstep(0.0, 0.18, cyc) * (1.0 - smoothstep(16.0, 24.0, dist)) * uRain * 0.76;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
`
const splashFS = /* glsl */ `
varying vec2 vUv;
varying float vLife;
varying float vAlpha;
void main(){
  if (vAlpha < 0.003) discard;
  float d = length(vUv - 0.5) * 2.0;
  float ring = exp(-pow((d - (0.35 + vLife * 0.55)) * 7.5, 2.0));
  float dotCenter = exp(-d * d * 18.0) * (1.0 - smoothstep(0.0, 0.35, vLife));
  float a = (ring + dotCenter * 0.8) * vAlpha;
  gl_FragColor = vec4(vec3(0.88, 0.92, 0.98), a);
}
`

function RainSplashes({ low }: { low: boolean }) {
  const N = low ? 240 : 420
  const geo = useMemo(() => {
    const base = new THREE.PlaneGeometry(1, 1)
    const g = new THREE.InstancedBufferGeometry()
    g.index = base.index
    g.attributes.position = base.attributes.position
    g.attributes.uv = base.attributes.uv
    const a = new Float32Array(N * 4)
    for (let i = 0; i < N; i++) {
      a[i * 4] = (Math.random() - 0.5) * 38
      a[i * 4 + 1] = (Math.random() - 0.5) * 38
      a[i * 4 + 2] = Math.random()
      a[i * 4 + 3] = Math.random()
    }
    g.setAttribute('aPos', new THREE.InstancedBufferAttribute(a, 4))
    g.instanceCount = N
    return g
  }, [N])

  const cam = useMemo(() => new THREE.Vector3(), [])
  const uRain = useMemo(() => ({ value: 0 }), [])
  const mat = useMemo(() => {
    const m = new THREE.ShaderMaterial({
      vertexShader: splashVS,
      fragmentShader: splashFS,
      uniforms: { uTime: WU.uTime, uRain, uCam: { value: cam }, uShPos: { value: SH_POS }, uShDim: { value: SH_DIM } },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    })
    return patchNew(m, { grow: false, haze: false, ao: false })
  }, [cam, uRain])

  const mesh = useRef<THREE.Mesh>(null)
  useFrame((s) => {
    uRain.value = rt.rain
    cam.copy(s.camera.position)
    if (mesh.current) mesh.current.visible = rt.rain > 0.01 || RW.uRW.value.z < 0.5
  })
  return <mesh ref={mesh} geometry={geo} material={mat} frustumCulled={false} renderOrder={7} />
}

// ------------------------------------------------------------------ 3. Giọt nước nhỏ giọt từ mép mái hiên & nắp đàn
const dripVS = /* glsl */ `
attribute vec4 aDrip; // x, roofY, z, phase
uniform float uTime;
uniform float uRain;
varying vec2 vUv;
varying float vAlpha;
void main(){
  vUv = uv;
  if (uRain < 0.05) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vAlpha = 0.0;
    return;
  }
  float t = fract(uTime * 0.72 + aDrip.w);
  float y = aDrip.y * (1.0 - t * t);
  if (y < 0.05) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vAlpha = 0.0;
    return;
  }
  vec3 center = vec3(aDrip.x, y, aDrip.z);
  vec3 toCam = normalize(cameraPosition - center);
  vec3 cr = cross(vec3(0.0, -1.0, 0.0), toCam);
  vec3 right = length(cr) > 1e-4 ? normalize(cr) : vec3(1.0, 0.0, 0.0);
  vec3 wp = center + right * (position.x * 0.018) + vec3(0.0, position.y * (0.09 + t * 0.14), 0.0);
  float dist = length(cameraPosition - center);
  vAlpha = smoothstep(0.0, 0.12, t) * (1.0 - smoothstep(0.85, 1.0, t)) * (1.0 - smoothstep(14.0, 26.0, dist)) * uRain * 0.45;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
`
const dripFS = /* glsl */ `
varying vec2 vUv;
varying float vAlpha;
void main(){
  if (vAlpha < 0.003) discard;
  float x = abs(vUv.x - 0.5) * 2.0;
  float y = abs(vUv.y - 0.5) * 2.0;
  float d = exp(-x * x * 4.5) * exp(-y * y * 2.5);
  gl_FragColor = vec4(vec3(0.92, 0.95, 1.0), d * vAlpha);
}
`

function RoofDrips() {
  const geo = useMemo(() => {
    const pts: number[] = []
    const pushEdge = (x: number, z: number, rot: number, hw: number, hd: number, y: number, n: number) => {
      const c = Math.cos(rot)
      const s = Math.sin(rot)
      for (let i = 0; i < n; i++) {
        const lx = -hw + (i / Math.max(1, n - 1)) * hw * 2
        const lz = hd
        pts.push(x + lx * c + lz * s, y, z - lx * s + lz * c, Math.random())
      }
    }
    // Mép mái hiên Cơ sở A, Mái che Góc Sinh Viên, Sảnh B1
    pushEdge(E.cinema.x, E.cinema.z, E.cinema.rotY, 11.4, 5.2, 9.6, 22)
    pushEdge(E.products.x, E.products.z, -0.45, 5.0, 3.1, 3.7, 16)
    pushEdge(E.robot.x, E.robot.z, 0, 5.6, 8.7, 4.6, 14)

    const base = new THREE.PlaneGeometry(1, 1)
    const g = new THREE.InstancedBufferGeometry()
    g.index = base.index
    g.attributes.position = base.attributes.position
    g.attributes.uv = base.attributes.uv
    g.setAttribute('aDrip', new THREE.InstancedBufferAttribute(new Float32Array(pts), 4))
    g.instanceCount = pts.length / 4
    return g
  }, [])

  const uRain = useMemo(() => ({ value: 0 }), [])
  const mat = useMemo(() => {
    const m = new THREE.ShaderMaterial({
      vertexShader: dripVS,
      fragmentShader: dripFS,
      uniforms: { uTime: WU.uTime, uRain },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    })
    return patchNew(m, { grow: false, haze: false, ao: false })
  }, [uRain])

  const mesh = useRef<THREE.Mesh>(null)
  useFrame(() => {
    uRain.value = rt.rain
    if (mesh.current) mesh.current.visible = rt.rain > 0.04 || RW.uRW.value.z < 0.5
  })
  return <mesh ref={mesh} geometry={geo} material={mat} frustumCulled={false} renderOrder={11} />
}

// ------------------------------------------------------------------ 4. Sương mưa mỏng bay là đà trên mặt sân
function SummerMist() {
  const N = 34
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const a = new Float32Array(N * 4)
    for (let i = 0; i < N; i++) {
      const ang = (i / N) * Math.PI * 2 + Math.random() * 0.2
      const rad = 12 + Math.random() * 40
      a[i * 4] = Math.cos(ang) * rad
      a[i * 4 + 1] = 0.8 + Math.random() * 2.2
      a[i * 4 + 2] = Math.sin(ang) * rad
      a[i * 4 + 3] = Math.random()
    }
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3))
    g.setAttribute('aM', new THREE.BufferAttribute(a, 4))
    return g
  }, [])
  const uRain = useMemo(() => ({ value: 0 }), [])
  const mat = useMemo(() => {
    const m = new THREE.ShaderMaterial({
      uniforms: { uTime: WU.uTime, uRain },
      vertexShader: `attribute vec4 aM; uniform float uTime; uniform float uRain; varying float vA;
        void main(){
          vec3 p = vec3(aM.x + sin(uTime * 0.18 + aM.w * 12.0) * 3.0, aM.y + sin(uTime * 0.3 + aM.w * 7.0) * 0.3, aM.z + cos(uTime * 0.14 + aM.w * 9.0) * 3.0);
          vec4 mv = viewMatrix * vec4(p, 1.0);
          float d = -mv.z;
          vA = smoothstep(6.0, 16.0, d) * (1.0 - smoothstep(38.0, 56.0, d)) * uRain * 0.085;
          gl_PointSize = clamp(420.0 / max(d, 1.0), 4.0, 110.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `varying float vA;
        void main(){
          float d = length(gl_PointCoord - 0.5) * 2.0;
          if (d > 1.0) discard;
          float k = pow(1.0 - d, 2.2);
          gl_FragColor = vec4(vec3(0.84, 0.88, 0.95), k * vA);
        }`,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    })
    return patchNew(m, { grow: false, haze: false, ao: false })
  }, [uRain])
  const pts = useRef<THREE.Points>(null)
  useFrame(() => {
    uRain.value = rt.rain
    if (pts.current) pts.current.visible = rt.rain > 0.02 || RW.uRW.value.z < 0.5
  })
  return <points ref={pts} geometry={geo} material={mat} frustumCulled={false} renderOrder={9} />
}

export function SummerRain() {
  const low = useStore((s) => s.quality) === 'low'
  return (
    <group>
      <RainStreaks low={low} />
      <RainSplashes low={low} />
      <RoofDrips />
      <SummerMist />
    </group>
  )
}
