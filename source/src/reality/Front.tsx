// ORBITA · Reality Rewrite — TRƯỜNG LĂNG TRỤ ÁNH SÁNG
// Lưới lăng trụ lục giác (instanced) trồi lên rồi sụp xuống theo từng ô khi mặt trận đi qua,
// cộng với "bức tường khuông nhạc" hình nón — năm dòng kẻ nhạc vàng chạy quanh toàn bộ chiếc đĩa.
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { CENTER } from './site'
import { GLSL_COMMON, HEX_S, RW } from './mask'
import { rt } from './state'
import { music } from './music'

const latticeVS = /* glsl */ `
${GLSL_COMMON}
attribute vec3 aC;
varying vec3 vL;
varying vec3 vN;
varying float vH;
varying float vE;
varying float vX;
void main(){
  vec2 cp = (aC.xz - uRWc.xz) / ${HEX_S.toFixed(1)};
  float cd = length(cp) * ${HEX_S.toFixed(1)};
  float hs = rwH(rwCid(cp));
  float x = uRW.x - cd - hs * 9.0;
  float rise = smoothstep(-16.0, 0.0, x);
  float fall = 1.0 - smoothstep(0.0, 26.0, x);
  float env = rise * fall;
  float H = 2.5 + hs * hs * 16.0 + uRW.w * 10.0 * hs;
  float h = H * env;
  vE = env;
  vX = x;
  vH = position.y;
  vL = position;
  vN = normal;
  if (h < 0.03 || uRW.z < 0.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float R = ${(HEX_S * 0.5774 * 0.93).toFixed(4)};
  vec3 p = vec3(position.x * R, position.y * h, position.z * R) + aC;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`
const latticeFS = /* glsl */ `
varying vec3 vL; varying vec3 vN; varying float vH; varying float vE; varying float vX;
uniform vec4 uRW;
void main(){
  float ang = atan(vL.x, vL.z);
  float f = abs(fract(ang / 1.0471976 + 0.5) - 0.5) * 2.0;
  float edge = 1.0 - smoothstep(0.0, 0.1, f);
  bool top = vN.y > 0.5;
  vec3 gold = vec3(1.0, 0.70, 0.24);
  vec3 hot = vec3(1.0, 0.80, 0.42);
  float pulse = 1.0 + uRW.w * 0.8;
  float a; vec3 c;
  if (top) {
    float rim = smoothstep(0.72, 0.97, length(vL.xz));
    c = mix(gold * 0.6, hot * 1.5, rim);
    a = 0.05 + rim * 0.4;
  } else {
    float vv = vH;
    c = mix(gold * 0.8, hot * 1.4, edge);
    a = (0.025 + edge * 0.32) * (0.35 + vv * 0.8);
    a += smoothstep(0.88, 1.0, vv) * 0.15;
  }
  float crest = smoothstep(2.0, 0.0, abs(vX));
  c += hot * crest * 0.7;
  a *= clamp(vE * 1.3, 0.0, 1.0) * 0.8;
  gl_FragColor = vec4(c * pulse * a, a);
}`

export function HexLattice() {
  const meshRef = useRef<THREE.Mesh>(null)
  // Lossless idle gate: latticeVS explicitly sends every vertex outside the
  // clip volume when uRW.z < 0.5. Skip its instanced GPU draw entirely then.
  // Re-enable on the exact shader threshold; all geometry/shaders stay intact.
  useFrame(() => {
    const mesh = meshRef.current
    if (mesh) mesh.visible = RW.uRW.value.z >= 0.5
  })
  const low = useStore((s) => s.quality) === 'low'
  const { geo, count } = useMemo(() => {
    const S = HEX_S * (low ? 1 : 1)
    const R = low ? 104 : 118
    const cells: number[] = []
    const rows = Math.ceil(R / (S * 0.866))
    for (let r = -rows; r <= rows; r++) {
      const cols = Math.ceil(R / S) + 1
      for (let i = -cols; i <= cols; i++) {
        const x = (i + (Math.abs(r) % 2 ? 0.5 : 0)) * S
        const z = r * 0.8660254 * S
        if (Math.hypot(x, z) > R) continue
        cells.push(CENTER.x + x, 0.02, CENTER.z + z)
      }
    }
    const base = new THREE.CylinderGeometry(1, 1, 1, 6, 1, false)
    base.translate(0, 0.5, 0)
    const g = new THREE.InstancedBufferGeometry().copy(base as unknown as THREE.InstancedBufferGeometry)
    g.setAttribute('aC', new THREE.InstancedBufferAttribute(new Float32Array(cells), 3))
    g.instanceCount = cells.length / 3
    return { geo: g, count: cells.length / 3 }
  }, [low])
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: latticeVS,
        fragmentShader: latticeFS,
        uniforms: { uRW: RW.uRW, uRWc: RW.uRWc, uRWt: RW.uRWt },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    [],
  )
  return <mesh ref={meshRef} visible={false} geometry={geo} material={mat} frustumCulled={false} renderOrder={20} userData={{ rwKeep: true, count }} />
}

// ---------------------------------------------------------------- bức tường khuông nhạc
const WALL_H = 120
const wallVS = /* glsl */ `
uniform vec4 uRW;
uniform vec3 uRWc;
varying vec2 vUv2;
varying float vY;
varying float vR;
void main(){
  float y = position.y * ${WALL_H.toFixed(1)};
  float r = max(uRW.x - 4.5 - 0.55 * y, 0.0);
  float ang = atan(position.x, position.z);
  vUv2 = vec2(ang * 40.0, y);
  vY = y;
  vR = r;
  vec3 p = vec3(sin(ang) * r + uRWc.x, y, cos(ang) * r + uRWc.z);
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  if (r < 0.5 || uRW.z < 0.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`
const wallFS = /* glsl */ `
uniform vec4 uRW;
varying vec2 vUv2; varying float vY; varying float vR;
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
void main(){
  vec3 gold = vec3(1.0, 0.72, 0.26);
  vec3 hot = vec3(1.0, 0.94, 0.72);
  // 5 dòng khuông nhạc (cao ~ 10..26m) + bóng mờ phía trên
  float arcLen = vUv2.x * vR / 40.0;
  float staff = 0.0;
  for (int i = 0; i < 5; i++) {
    float yy = 10.0 + float(i) * 3.6 + sin(arcLen * 0.05 + uRW.y * 0.8 + float(i)) * 0.5;
    float d = abs(vY - yy);
    staff += exp(-d * d * 7.0) * 1.8 + exp(-d * 1.4) * 0.12;
  }
  // nốt nhạc chạy dọc khuông
  float nt = 0.0;
  for (int k = 0; k < 6; k++) {
    float fk = float(k);
    float s = fract(arcLen * 0.012 + uRW.y * (0.05 + fk * 0.013) + fk * 0.37);
    float yy = 10.0 + floor(h21(vec2(fk, floor(arcLen * 0.012 + uRW.y * 0.05))) * 5.0) * 3.6;
    float dx = (s - 0.5) * 60.0;
    nt += exp(-(dx * dx) * 0.9 - (vY - yy) * (vY - yy) * 1.1) * 3.0;
  }
  // mặt hex mờ
  vec2 hp = vec2(arcLen, vY) / 5.0;
  vec2 r = vec2(1.0, 1.7320508);
  vec2 a = mod(hp, r) - r * 0.5;
  vec2 b = mod(hp - r * 0.5, r) - r * 0.5;
  vec2 gv = dot(a, a) < dot(b, b) ? a : b;
  vec2 q = abs(gv);
  float hd = max(dot(q, vec2(0.5, 0.8660254)), q.x);
  float hexLine = smoothstep(0.43, 0.5, hd);
  float cellId = h21(floor((hp - gv) * 2.0));
  float flick = 0.5 + 0.5 * sin(uRW.y * 2.0 + cellId * 40.0);
  float hex = hexLine * (0.25 + flick * 0.35) + (1.0 - hd) * cellId * 0.05;
  float fade = smoothstep(0.0, 6.0, vY) * (1.0 - smoothstep(60.0, ${WALL_H.toFixed(1)}, vY));
  float foot = exp(-vY * 0.5) * 1.4; // vệt sáng chân tường trên mặt đĩa
  float a0 = (staff * 0.9 + nt + hex * 0.9) * fade + foot;
  float pulse = 1.0 + uRW.w * 1.6;
  vec3 c = mix(gold, hot, clamp(staff * 0.35 + nt * 0.4 + foot * 0.3, 0.0, 1.0));
  float alpha = clamp(a0 * 0.55, 0.0, 1.0);
  gl_FragColor = vec4(c * a0 * 0.8 * pulse, alpha);
}`

export function StaffWall() {
  const meshRef = useRef<THREE.Mesh>(null)
  // wallVS likewise discards EVERY vertex whenever uRW.z < 0.5. Do not
  // submit its 160x24 wall mesh until the original GLSL can show a pixel.
  useFrame(() => {
    const mesh = meshRef.current
    if (mesh) mesh.visible = RW.uRW.value.z >= 0.5
  })
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: wallVS,
        fragmentShader: wallFS,
        uniforms: { uRW: RW.uRW, uRWc: RW.uRWc },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    [],
  )
  const geo = useMemo(() => {
    const g = new THREE.CylinderGeometry(1, 1, 1, 160, 24, true)
    g.translate(0, 0.5, 0)
    return g
  }, [])
  return <mesh ref={meshRef} visible={false} geometry={geo} material={mat} frustumCulled={false} renderOrder={21} userData={{ rwKeep: true }} />
}

// ---------------------------------------------------------------- cột sáng + cầu năng lượng khi bốc cháy
const orbVS = /* glsl */ `varying vec3 vN; varying vec3 vV;
void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`
const orbFS = /* glsl */ `varying vec3 vN; varying vec3 vV; uniform float uK; uniform float uT;
void main(){
  float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
  vec3 c = mix(vec3(1.0,0.62,0.18), vec3(1.0,0.95,0.75), 1.0 - f);
  float flick = 0.85 + 0.15 * sin(uT * 18.0 + vN.y * 9.0);
  gl_FragColor = vec4(c * (1.2 + f * 3.0) * uK * flick, 1.0);
}`
const beamVS = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`
const beamFS = /* glsl */ `varying vec2 vUv; uniform float uK; uniform float uT;
void main(){
  float edge = pow(1.0 - abs(vUv.x - 0.5) * 2.0, 1.5);
  float stripes = 0.7 + 0.3 * sin(vUv.y * 40.0 - uT * 14.0 + vUv.x * 12.0);
  float fade = (1.0 - vUv.y) * smoothstep(0.0, 0.04, vUv.y);
  float a = edge * stripes * fade * uK;
  gl_FragColor = vec4(vec3(1.0, 0.76, 0.34) * a * 2.2, a * 0.8);
}`

export function Ignition() {
  const orb = useRef<THREE.Mesh>(null)
  const beam = useRef<THREE.Mesh>(null)
  const light = useRef<THREE.PointLight>(null)
  const pts = useRef<THREE.Points>(null)
  const orbMat = useMemo(() => new THREE.ShaderMaterial({ vertexShader: orbVS, fragmentShader: orbFS, uniforms: { uK: { value: 0 }, uT: { value: 0 } }, toneMapped: false }), [])
  const beamMat = useMemo(
    () => new THREE.ShaderMaterial({ vertexShader: beamVS, fragmentShader: beamFS, uniforms: { uK: { value: 0 }, uT: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }),
    [],
  )
  const emberGeo = useMemo(() => {
    const n = 90
    const g = new THREE.BufferGeometry()
    const a = new Float32Array(n * 3)
    const s = new Float32Array(n * 4)
    for (let i = 0; i < n; i++) {
      s[i * 4] = Math.random() * Math.PI * 2
      s[i * 4 + 1] = 0.6 + Math.random() * 2.2
      s[i * 4 + 2] = Math.random()
      s[i * 4 + 3] = 0.5 + Math.random()
    }
    g.setAttribute('position', new THREE.BufferAttribute(a, 3))
    g.setAttribute('aS', new THREE.BufferAttribute(s, 4))
    return g
  }, [])
  const emberMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uK: { value: 0 }, uT: { value: 0 }, uC: { value: new THREE.Vector3() } },
        vertexShader: `attribute vec4 aS; uniform float uK; uniform float uT; uniform vec3 uC; varying float vA;
          void main(){
            float t = fract(uT * 0.35 * aS.w + aS.z);
            float r = aS.y * (1.0 - t) * (0.6 + uK * 1.4);
            float a = aS.x + uT * (1.2 + aS.w) ;
            vec3 p = uC + vec3(cos(a) * r, 0.2 + t * 6.5 * (0.5 + uK), sin(a) * r);
            vA = sin(t * 3.14159) * uK;
            vec4 mv = viewMatrix * vec4(p, 1.0);
            gl_PointSize = (3.0 + aS.z * 5.0) * 60.0 / -mv.z * (0.4 + uK);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; float k = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(vec3(1.0,0.6,0.2) * 3.0 * k * vA, k * vA); }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [],
  )
  const core = useMemo(() => new THREE.Vector3(CENTER.x, 8.5, CENTER.z), [])
  useFrame((_, dt) => {
    const k = rt.ignite
    const fl = rt.flash
    const on = k > 0.001 || fl > 0.001
    if (orb.current) {
      orb.current.visible = on
      const s = (0.2 + k * 2.4) * (1 + fl * 6) * Math.max(0, 1 - Math.max(0, fl - 0.3) * 1.4)
      orb.current.scale.setScalar(Math.max(0.001, s))
      orb.current.position.set(core.x, core.y + k * 1.5, core.z)
      orbMat.uniforms.uK.value = (0.4 + k) * (1 + fl * 3)
      orbMat.uniforms.uT.value = rt.t
    }
    if (beam.current) {
      beam.current.visible = fl > 0.001
      beam.current.scale.set(1 + (1 - fl) * 5, 1, 1 + (1 - fl) * 5)
      beamMat.uniforms.uK.value = fl
      beamMat.uniforms.uT.value = rt.t
    }
    if (light.current) light.current.intensity = (k * 160 + fl * 1400) * (1 + music.kick)
    if (pts.current) {
      pts.current.visible = k > 0.001
      emberMat.uniforms.uK.value = k
      emberMat.uniforms.uT.value = rt.t
      emberMat.uniforms.uC.value.set(core.x, 0.2, core.z)
    }
    void dt
  })
  return (
    <group userData={{ rwKeep: true }}>
      <mesh ref={orb} material={orbMat} visible={false} frustumCulled={false}>
        <icosahedronGeometry args={[1, 3]} />
      </mesh>
      <mesh ref={beam} material={beamMat} position={[core.x, 130, core.z]} visible={false} frustumCulled={false}>
        <cylinderGeometry args={[1.2, 1.2, 260, 32, 1, true]} />
      </mesh>
      <pointLight ref={light} position={[core.x, core.y + 1, core.z]} color="#ffb860" intensity={0} distance={90} decay={2} />
      <points ref={pts} geometry={emberGeo} material={emberMat} visible={false} frustumCulled={false} />
    </group>
  )
}
