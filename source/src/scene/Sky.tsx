import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { NOISE_GLSL } from '../gfx'

const BAND_N = new THREE.Vector3(0.25, 0.9, -0.35).normalize()

const skyFrag = /* glsl */ `
varying vec3 vP;
${NOISE_GLSL}

float starLayer(vec3 d, float scale, float thresh, out vec3 tint){
  vec3 p = d*scale; vec3 id = floor(p); vec3 f = fract(p) - 0.5;
  float h = hash13(id);
  tint = vec3(1.0);
  if (h < thresh) return 0.0;
  vec3 off = (vec3(hash13(id+1.3), hash13(id+7.1), hash13(id+3.7)) - 0.5)*0.6;
  float dd = length(f - off);
  float b = (h - thresh)/(1.0 - thresh);
  float tc = hash13(id+9.0);
  tint = mix(vec3(1.0,0.78,0.55), vec3(0.62,0.8,1.0), tc);
  return smoothstep(0.16, 0.0, dd) * (0.25 + b*b*3.5);
}

void main(){
  vec3 d = normalize(vP);
  vec3 bn = vec3(${BAND_N.x.toFixed(4)}, ${BAND_N.y.toFixed(4)}, ${BAND_N.z.toFixed(4)});
  float lat = dot(d, bn);
  float band = exp(-lat*lat*14.0);
  float core = pow(max(dot(d, normalize(vec3(-0.5,0.08,0.85)))*0.5+0.5, 0.0), 4.0);

  vec3 col = vec3(0.003, 0.004, 0.012) + vec3(0.012,0.006,0.024) * (0.55 + 0.45*d.y);

  float n1 = fbm(d*2.3 + 3.0);
  float n2 = fbm(d*5.0 + n1*1.6 + 11.0);
  float n3 = fbm(d*1.25 + 40.0);
  float n4 = fbm(d*3.2 - 20.0 + n2);

  vec3 violet = vec3(0.50, 0.08, 0.85);
  vec3 blue   = vec3(0.04, 0.38, 0.95);
  vec3 ember  = vec3(1.00, 0.32, 0.14);
  vec3 teal   = vec3(0.05, 0.85, 0.72);
  vec3 rose   = vec3(1.0, 0.25, 0.6);

  col += violet * smoothstep(0.33, 0.80, n1) * 0.50 * (0.35 + band);
  col += blue   * smoothstep(0.40, 0.88, n2) * 0.42 * (0.25 + band*1.3);
  col += ember  * pow(smoothstep(0.50, 0.92, n3 + 0.22*n2), 2.0) * 0.55 * (0.4 + core);
  col += teal   * pow(smoothstep(0.55, 0.95, n4), 2.0) * 0.30;
  col += rose   * pow(smoothstep(0.58, 0.95, fbm(d*2.0 + 70.0)), 2.2) * 0.35;

  float dust = smoothstep(0.45, 0.78, fbm(d*7.0 + 5.0 + n1)) * band;
  col *= 1.0 - dust*0.82;
  col += vec3(0.85,0.78,0.98) * band * (0.035 + 0.13*fbm(d*16.0)) * (0.55 + 1.2*core);

  vec3 t1, t2, t3;
  float s = starLayer(d, 70.0,  0.90 - band*0.04, t1);
  vec3 sc = t1*s*0.9;
  s = starLayer(d, 150.0, 0.93 - band*0.04, t2); sc += t2*s*0.9;
  s = starLayer(d, 320.0, 0.955 - band*0.03, t3); sc += t3*s*0.8;
  col += sc * (1.0 - dust*0.6);

  gl_FragColor = vec4(col, 1.0);
}
`

const starVert = /* glsl */ `
attribute float aSize; attribute vec3 aColor; attribute float aPhase;
uniform float uTime; uniform float uPx;
varying vec3 vC;
void main(){
  float tw = 0.75 + 0.25*sin(uTime*(0.7+aPhase*1.6) + aPhase*40.0);
  vC = aColor * tw;
  gl_PointSize = aSize * uPx;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`
const starFrag = /* glsl */ `
varying vec3 vC;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  a = a*a;
  gl_FragColor = vec4(vC * 2.2, a);
}`

export function Sky() {
  const { gl, scene } = useThree()

  useEffect(() => {
    const rt = new THREE.WebGLCubeRenderTarget(1024, {
      type: THREE.HalfFloatType,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
    })
    const cam = new THREE.CubeCamera(0.1, 20, rt)
    const bake = new THREE.Scene()
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: skyFrag,
    })
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(10, 64, 32), mat)
    bake.add(mesh)
    cam.update(gl, bake)

    const pm = new THREE.PMREMGenerator(gl)
    const env = pm.fromCubemap(rt.texture)
    const prevBg = scene.background
    const prevEnv = scene.environment
    scene.background = rt.texture
    scene.environment = env.texture
    scene.environmentIntensity = 1.15
    scene.backgroundIntensity = 1

    return () => {
      scene.background = prevBg
      scene.environment = prevEnv
      env.dispose()
      pm.dispose()
      rt.dispose()
      mat.dispose()
      mesh.geometry.dispose()
    }
  }, [gl, scene])

  const group = useRef<THREE.Group>(null)
  const { geo, mat } = useMemo(() => {
    const N = 6500
    const pos = new Float32Array(N * 3)
    const col = new Float32Array(N * 3)
    const size = new Float32Array(N)
    const phase = new Float32Array(N)
    const v = new THREE.Vector3()
    const c = new THREE.Color()
    const gauss = () => (Math.random() + Math.random() + Math.random() + Math.random() - 2) / 2
    for (let i = 0; i < N; i++) {
      if (Math.random() < 0.55) {
        v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize()
      } else {
        // tập trung quanh dải ngân hà
        v.set(gauss(), gauss(), gauss()).normalize()
        const k = v.dot(BAND_N)
        v.addScaledVector(BAND_N, -k * 0.85).normalize()
        v.addScaledVector(BAND_N, gauss() * 0.14).normalize()
      }
      v.multiplyScalar(3600)
      pos.set([v.x, v.y, v.z], i * 3)
      const temp = Math.random()
      c.setHSL(temp < 0.5 ? 0.6 : 0.09, 0.2 + Math.random() * 0.5, 0.75 + Math.random() * 0.2)
      col.set([c.r, c.g, c.b], i * 3)
      const r = Math.random()
      size[i] = 1.2 + r * r * r * 4.2
      phase[i] = Math.random()
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aColor', new THREE.BufferAttribute(col, 3))
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
    g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1))
    const m = new THREE.ShaderMaterial({
      vertexShader: starVert,
      fragmentShader: starFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uPx: { value: 1 } },
    })
    return { geo: g, mat: m }
  }, [])

  useFrame((state) => {
    mat.uniforms.uTime.value = state.clock.elapsedTime
    mat.uniforms.uPx.value = state.gl.getPixelRatio()
    if (group.current) group.current.position.copy(state.camera.position)
  })

  return (
    <group ref={group}>
      <points geometry={geo} material={mat} frustumCulled={false} renderOrder={-10} />
    </group>
  )
}
