import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { NOISE_GLSL, beamGeometry, beamMaterial, glowTexture, rand } from '../gfx'

const V = (x: number, y: number, z: number, d: number) => new THREE.Vector3(x, y, z).normalize().multiplyScalar(d)

export const SUN_DIR = new THREE.Vector3(0.12, 0.38, 0.92).normalize()

// ============ HỐ ĐEN ============
const accretionMat = (inner: number, outer: number, bright: number) =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uInner: { value: inner }, uOuter: { value: outer }, uBright: { value: bright } },
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: /* glsl */ `
      varying vec2 vP; uniform float uTime, uInner, uOuter, uBright;
      ${NOISE_GLSL}
      void main(){
        float r = length(vP);
        float t = (r - uInner) / (uOuter - uInner);
        if (t < 0.0 || t > 1.0) discard;
        float ang = atan(vP.y, vP.x);
        float om = 0.9 / pow(max(r/uInner, 1.0), 1.5);
        float a2 = uTime * om;
        mat2 rot = mat2(cos(a2), -sin(a2), sin(a2), cos(a2));
        vec2 p = rot * (vP / uOuter);
        float n = fbm(vec3(p*9.0, t*2.5));
        float n2 = fbm(vec3(p*22.0, 4.0 + t*5.0));
        float bands = 0.55 + 0.45*sin(t*70.0 + n*7.0);
        float dens = (0.35 + 0.9*n) * (0.5 + 0.8*n2) * bands;
        vec3 hot  = vec3(1.0, 0.93, 0.80) * 3.2;
        vec3 mid  = vec3(1.0, 0.50, 0.12) * 1.7;
        vec3 cold = vec3(0.55, 0.08, 0.03) * 0.7;
        vec3 col = mix(hot, mid, smoothstep(0.0, 0.32, t));
        col = mix(col, cold, smoothstep(0.28, 1.0, t));
        float dopp = 0.45 + 1.1 * (0.5 + 0.5*cos(ang - 0.4));
        float edge = smoothstep(0.0, 0.05, t) * (1.0 - smoothstep(0.72, 1.0, t));
        float inten = dens * dopp * edge * uBright * (1.4 - t);
        gl_FragColor = vec4(col * inten, 1.0);
      }`,
  })

function BlackHole() {
  const R = 52
  const pos = useMemo(() => V(-0.62, 0.2, -0.76, 1050), [])
  const disk = useMemo(() => accretionMat(R * 1.55, R * 5.6, 1.0), [R])
  const halo = useMemo(() => accretionMat(R * 1.04, R * 2.3, 1.5), [R])
  const haloRef = useRef<THREE.Mesh>(null)
  const diskQ = useMemo(() => {
    const v = pos.clone().negate().normalize()
    const n = new THREE.Vector3(0, 1, 0).addScaledVector(v, 0.45).normalize()
    return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n)
  }, [pos])
  const jetMat = useMemo(() => beamMaterial('#6fa0ff', 0.9), [])
  const jetGeo = useMemo(() => beamGeometry(R * 9, R * 0.5, R * 0.03), [R])
  const glow = glowTexture()
  const jetQ = useMemo(() => {
    const n = new THREE.Vector3(0, 1, 0).addScaledVector(pos.clone().negate().normalize(), 0.45).normalize()
    return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n)
  }, [pos])

  useFrame((s) => {
    const t = s.clock.elapsedTime
    disk.uniforms.uTime.value = t
    halo.uniforms.uTime.value = t * 1.3
    haloRef.current?.lookAt(s.camera.position)
  })

  return (
    <group position={pos}>
      <mesh>
        <sphereGeometry args={[R, 64, 40]} />
        <meshBasicMaterial color="#000000" />
      </mesh>
      <mesh quaternion={diskQ} material={disk}>
        <ringGeometry args={[R * 1.5, R * 5.7, 160, 1]} />
      </mesh>
      <mesh ref={haloRef} material={halo}>
        <ringGeometry args={[R * 1.02, R * 2.4, 128, 1]} />
      </mesh>
      <group quaternion={jetQ}>
        <mesh geometry={jetGeo} material={jetMat} />
        <mesh geometry={jetGeo} material={jetMat} rotation={[Math.PI, 0, 0]} />
      </group>
      <sprite scale={[R * 16, R * 16, 1]}>
        <spriteMaterial map={glow} color="#ff8a3a" transparent opacity={0.35} blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>
    </group>
  )
}

// ============ SIÊU TÂN TINH ============
function Supernova() {
  const R = 210
  const pos = useMemo(() => V(0.72, 0.3, -0.62, 1250), [])
  const shell = useRef<THREE.Mesh>(null)
  const flash = useRef<THREE.Sprite>(null)
  const rings = useRef<THREE.Group>(null)
  const glow = glowTexture()
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uFade: { value: 1 } },
        vertexShader: /* glsl */ `
          varying vec3 vN; varying vec3 vV; varying vec3 vO;
          void main(){
            vO = normalize(position);
            vN = normalize(normalMatrix * normal);
            vec4 mv = modelViewMatrix * vec4(position,1.0);
            vV = normalize(-mv.xyz);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          varying vec3 vN; varying vec3 vV; varying vec3 vO;
          uniform float uTime, uFade;
          ${NOISE_GLSL}
          void main(){
            float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
            float rim = pow(f, 2.0);
            vec3 q = vO * 2.6 + vec3(0.0, uTime*0.02, uTime*0.015);
            float n = fbm(q * 1.6);
            float ridge = pow(1.0 - abs(fbm(q*2.7 + n) - 0.5)*2.0, 7.0);
            vec3 c1 = vec3(0.1, 0.85, 0.95);
            vec3 c2 = vec3(1.0, 0.2, 0.7);
            vec3 c3 = vec3(1.0, 0.65, 0.2);
            vec3 col = mix(c1, c2, smoothstep(0.3, 0.7, n));
            col = mix(col, c3, ridge*0.7);
            float a = (rim*0.95 + 0.07) * (0.25 + ridge*2.0 + n*0.9);
            gl_FragColor = vec4(col * a * uFade * 1.8, 1.0);
          }`,
      }),
    [],
  )
  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color('#bfe6ff').multiplyScalar(2.2), toneMapped: false, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }), [])

  useFrame((s) => {
    const t = s.clock.elapsedTime
    const cyc = (t % 48) / 48
    const e = 1 - Math.pow(1 - cyc, 2.2)
    const sc = 0.3 + 0.7 * e
    shell.current?.scale.setScalar(sc)
    mat.uniforms.uTime.value = t
    mat.uniforms.uFade.value = Math.min(1, cyc * 14) * (1 - Math.pow(cyc, 3))
    if (flash.current) {
      const f = Math.exp(-cyc * 16) * 2.2 + 0.15
      flash.current.scale.setScalar(R * (1.4 + f * 3))
      ;(flash.current.material as THREE.SpriteMaterial).opacity = Math.min(1, 0.2 + f * 0.5)
    }
    if (rings.current) {
      rings.current.scale.setScalar(0.4 + 0.6 * e)
      rings.current.rotation.y = t * 0.02
      ringMat.opacity = 0.85 * (1 - Math.pow(cyc, 2.5))
    }
  })

  return (
    <group position={pos} rotation={[0.6, 0.3, 0.2]}>
      <mesh ref={shell} material={mat}>
        <sphereGeometry args={[R, 64, 48]} />
      </mesh>
      <group ref={rings}>
        {[-0.55, 0, 0.55].map((y, i) => (
          <mesh key={i} position={[0, y * R * 0.5, 0]} rotation={[Math.PI / 2, 0, 0]} material={ringMat} scale={i === 1 ? 1 : 0.84}>
            <torusGeometry args={[R * 0.62, 1.8, 8, 160]} />
          </mesh>
        ))}
      </group>
      <sprite ref={flash} scale={[R * 2, R * 2, 1]}>
        <spriteMaterial map={glow} color="#ffd0f0" transparent blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>
    </group>
  )
}

// ============ PULSAR ============
function Pulsar() {
  const pos = useMemo(() => V(-0.82, 0.46, 0.38, 1350), [])
  const spin = useRef<THREE.Group>(null)
  const core = useRef<THREE.Sprite>(null)
  const geo = useMemo(() => beamGeometry(1000, 52, 1.5, 24), [])
  const mat = useMemo(() => beamMaterial('#7fe9ff', 1.3), [])
  const mat2 = useMemo(() => beamMaterial('#d8a8ff', 1.1), [])
  const glow = glowTexture()
  useFrame((s) => {
    const t = s.clock.elapsedTime
    if (spin.current) spin.current.rotation.y = t * 1.15
    if (core.current) core.current.scale.setScalar(110 + Math.abs(Math.sin(t * 1.15)) * 120)
  })
  return (
    <group position={pos} rotation={[0.2, 0, 0.7]}>
      <group ref={spin}>
        <mesh geometry={geo} material={mat} rotation={[0, 0, -Math.PI / 2]} />
        <mesh geometry={geo} material={mat2} rotation={[0, 0, Math.PI / 2]} />
      </group>
      <sprite ref={core} scale={[150, 150, 1]}>
        <spriteMaterial map={glow} color="#c8f4ff" transparent blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>
      <mesh>
        <sphereGeometry args={[6, 16, 12]} />
        <meshBasicMaterial color={new THREE.Color('#ffffff').multiplyScalar(4)} toneMapped={false} />
      </mesh>
    </group>
  )
}

// ============ HÀNH TINH KHÍ + VÀNH ĐAI ============
function GasGiant() {
  const R = 120
  const pos = useMemo(() => V(0.72, 0.16, 0.68, 780), [])
  const moon = useRef<THREE.Mesh>(null)
  const planetMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uSun: { value: SUN_DIR }, uR: { value: R } },
        vertexShader: /* glsl */ `
          varying vec3 vN; varying vec3 vO; varying vec3 vW;
          void main(){
            vO = position;
            vN = normalize(mat3(modelMatrix) * normal);
            vec4 w = modelMatrix * vec4(position,1.0);
            vW = w.xyz;
            gl_Position = projectionMatrix * viewMatrix * w;
          }`,
        fragmentShader: /* glsl */ `
          varying vec3 vN; varying vec3 vO; varying vec3 vW;
          uniform float uTime, uR; uniform vec3 uSun;
          ${NOISE_GLSL}
          void main(){
            vec3 n = normalize(vN);
            float lat = vO.y / uR;
            float turb = fbm(vec3(vO.x*0.012 + uTime*0.006, lat*4.0, vO.z*0.012));
            float b = sin(lat*20.0 + turb*7.0) * 0.5 + 0.5;
            float b2 = sin(lat*47.0 + turb*13.0) * 0.5 + 0.5;
            vec3 c1 = vec3(0.92, 0.80, 0.62);
            vec3 c2 = vec3(0.62, 0.38, 0.24);
            vec3 c3 = vec3(0.30, 0.20, 0.30);
            vec3 col = mix(c2, c1, b);
            col = mix(col, c3, b2*0.35);
            col += vec3(0.1,0.06,0.0) * smoothstep(0.7,1.0,turb);
            float l = max(dot(n, normalize(uSun)), 0.0);
            float term = smoothstep(0.0, 0.35, l);
            vec3 V = normalize(cameraPosition - vW);
            float fr = pow(1.0 - max(dot(n, V), 0.0), 3.0);
            vec3 lit = col * (0.025 + 1.5*term) + vec3(0.35,0.55,1.0) * fr * (0.15 + term*0.9);
            gl_FragColor = vec4(lit, 1.0);
          }`,
      }),
    [],
  )
  const ringMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: { uIn: { value: R * 1.45 }, uOut: { value: R * 2.5 } },
        vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: /* glsl */ `
          varying vec2 vP; uniform float uIn, uOut;
          ${NOISE_GLSL}
          void main(){
            float r = length(vP);
            float t = (r - uIn)/(uOut - uIn);
            if (t<0.0||t>1.0) discard;
            float b = fbm(vec3(t*38.0, 1.0, 2.0));
            float b2 = vnoise(vec3(t*140.0, 5.0, 0.0));
            float gap = smoothstep(0.52, 0.56, t) * (1.0 - smoothstep(0.60, 0.64, t));
            float dens = (0.25 + b*1.0) * (0.6 + b2*0.6) * (1.0 - gap*0.92);
            dens *= smoothstep(0.0, 0.06, t) * (1.0 - smoothstep(0.92, 1.0, t));
            vec3 col = mix(vec3(0.85,0.72,0.55), vec3(0.6,0.5,0.45), b2);
            gl_FragColor = vec4(col * 1.3, dens * 0.9);
          }`,
      }),
    [],
  )
  useFrame((s) => {
    const t = s.clock.elapsedTime
    planetMat.uniforms.uTime.value = t
    if (moon.current) {
      const a = t * 0.05
      moon.current.position.set(Math.cos(a) * R * 3.4, Math.sin(a * 1.3) * R * 0.5, Math.sin(a) * R * 3.4)
    }
  })
  return (
    <group position={pos} rotation={[0.25, 0, -0.3]}>
      <mesh material={planetMat}>
        <sphereGeometry args={[R, 96, 64]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2 + 0.05, 0, 0]} material={ringMat}>
        <ringGeometry args={[R * 1.45, R * 2.5, 160, 1]} />
      </mesh>
      <mesh ref={moon}>
        <sphereGeometry args={[R * 0.14, 32, 24]} />
        <meshStandardMaterial color="#8a8a96" roughness={0.95} metalness={0} />
      </mesh>
    </group>
  )
}

// ============ THIÊN HÀ XOẮN ỐC ============
function Galaxy() {
  const ref = useRef<THREE.Group>(null)
  const geo = useMemo(() => {
    const N = 42000
    const arms = 3
    const Rg = 760
    const pos = new Float32Array(N * 3)
    const col = new Float32Array(N * 3)
    const c = new THREE.Color()
    const core = new THREE.Color('#ffd9a0')
    const mid = new THREE.Color('#ff7fd0')
    const outer = new THREE.Color('#5f9bff')
    const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5
    for (let i = 0; i < N; i++) {
      const rr = Math.pow(Math.random(), 0.72)
      const r = rr * Rg
      const arm = i % arms
      const a = (arm / arms) * Math.PI * 2 + rr * 5.2 + gauss() * (0.55 - rr * 0.3)
      const sp = 14 + rr * 60
      const x = Math.cos(a) * r + gauss() * sp
      const z = Math.sin(a) * r + gauss() * sp
      const y = gauss() * (30 * (1 - rr) + 6)
      pos.set([x, y, z], i * 3)
      if (rr < 0.35) c.copy(core).lerp(mid, rr / 0.35)
      else c.copy(mid).lerp(outer, (rr - 0.35) / 0.65)
      c.multiplyScalar(0.5 + Math.random() * 0.9)
      col.set([c.r, c.g, c.b], i * 3)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    return g
  }, [])
  const glow = glowTexture()
  useFrame((s) => {
    if (ref.current) ref.current.rotation.y = s.clock.elapsedTime * 0.012
  })
  return (
    <group position={V(-0.18, 0.78, 0.3, 1900)} rotation={[0.9, 0.2, 0.5]}>
      <group ref={ref}>
        <points geometry={geo} frustumCulled={false}>
          <pointsMaterial size={9} map={glow} vertexColors transparent depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation toneMapped={false} />
        </points>
      </group>
      <sprite scale={[420, 420, 1]}>
        <spriteMaterial map={glow} color="#ffcf90" transparent opacity={0.8} blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>
    </group>
  )
}

// ============ SAO XANH KHỔNG LỒ (nguồn sáng) ============
function BlueStar() {
  const pos = useMemo(() => SUN_DIR.clone().multiplyScalar(2600), [])
  const glow = glowTexture()
  const spike = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 512
    const x = c.getContext('2d')!
    const draw = (ang: number, len: number, w: number) => {
      x.save()
      x.translate(256, 256)
      x.rotate(ang)
      const g = x.createLinearGradient(-len, 0, len, 0)
      g.addColorStop(0, 'rgba(255,255,255,0)')
      g.addColorStop(0.5, 'rgba(255,255,255,0.95)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      x.fillStyle = g
      x.beginPath()
      x.ellipse(0, 0, len, w, 0, 0, Math.PI * 2)
      x.fill()
      x.restore()
    }
    draw(0, 250, 3)
    draw(Math.PI / 2, 250, 3)
    draw(Math.PI / 4, 140, 2)
    draw(-Math.PI / 4, 140, 2)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
  const s1 = useRef<THREE.Sprite>(null)
  useFrame((s) => {
    const t = s.clock.elapsedTime
    if (s1.current) s1.current.material.rotation = t * 0.02
  })
  return (
    <group position={pos}>
      <sprite scale={[1300, 1300, 1]}>
        <spriteMaterial map={glow} color="#8fb8ff" transparent opacity={0.55} blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>
      <sprite scale={[380, 380, 1]}>
        <spriteMaterial map={glow} color="#e8f2ff" transparent blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>
      <sprite ref={s1} scale={[1500, 1500, 1]}>
        <spriteMaterial map={spike} color="#a8c8ff" transparent opacity={0.8} blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>
    </group>
  )
}

// ============ SAO BĂNG ============
function Meteors() {
  const COUNT = 4
  const refs = useRef<(THREE.Mesh | null)[]>([])
  const state = useRef(
    Array.from({ length: COUNT }, () => ({ life: 0, dur: 1, next: rand(1, 6), v: new THREE.Vector3(), p0: new THREE.Vector3() })),
  )
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: { uA: { value: 1 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: /* glsl */ `
          varying vec2 vUv;
          void main(){
            float along = pow(vUv.x, 3.0);
            float across = 1.0 - abs(vUv.y*2.0 - 1.0);
            across = pow(across, 1.5);
            vec3 col = mix(vec3(0.4,0.6,1.0), vec3(1.0), pow(vUv.x, 8.0)) * 3.0;
            gl_FragColor = vec4(col, along * across);
          }`,
      }),
    [],
  )
  const tmp = useMemo(() => ({ x: new THREE.Vector3(), y: new THREE.Vector3(), z: new THREE.Vector3(), m: new THREE.Matrix4() }), [])
  useFrame((_, dt) => {
    state.current.forEach((m, i) => {
      const mesh = refs.current[i]
      if (!mesh) return
      if (m.life <= 0) {
        m.next -= dt
        mesh.visible = false
        if (m.next <= 0) {
          m.life = m.dur = rand(1.1, 2.0)
          const dir = new THREE.Vector3(rand(-1, 1), rand(0.05, 0.9), rand(-1, 1)).normalize()
          m.p0.copy(dir).multiplyScalar(rand(380, 620))
          tmp.z.copy(m.p0).negate().normalize()
          const rnd = new THREE.Vector3(rand(-1, 1), rand(-1, 0.2), rand(-1, 1))
          m.v.copy(rnd).addScaledVector(tmp.z, -rnd.dot(tmp.z)).normalize().multiplyScalar(rand(260, 420))
          mesh.position.copy(m.p0)
          tmp.x.copy(m.v).normalize()
          tmp.y.crossVectors(tmp.z, tmp.x).normalize()
          tmp.m.makeBasis(tmp.x, tmp.y, tmp.z)
          mesh.quaternion.setFromRotationMatrix(tmp.m)
          mesh.visible = true
          m.next = rand(2, 9)
        }
      } else {
        m.life -= dt
        mesh.position.addScaledVector(m.v, dt)
        const k = m.life / m.dur
        mesh.scale.setScalar(Math.sin(Math.PI * (1 - k)) + 0.01)
      }
    })
  })
  return (
    <group>
      {Array.from({ length: COUNT }, (_, i) => (
        <mesh key={i} ref={(r) => { refs.current[i] = r }} material={mat} visible={false} frustumCulled={false}>
          <planeGeometry args={[110, 1.6]} />
        </mesh>
      ))}
    </group>
  )
}

// ============ TIA GAMMA ============
function GammaBurst() {
  const grp = useRef<THREE.Group>(null)
  const geo = useMemo(() => beamGeometry(1800, 26, 0.8, 12), [])
  const mat = useMemo(() => beamMaterial('#b8f0ff', 2.2), [])
  const glow = glowTexture()
  const spr = useRef<THREE.Sprite>(null)
  const next = useRef(14)
  const t0 = useRef(-100)
  useFrame((s) => {
    const t = s.clock.elapsedTime
    if (t > next.current) {
      t0.current = t
      next.current = t + rand(34, 55)
    }
    const k = t - t0.current
    const on = k >= 0 && k < 5
    if (grp.current) grp.current.visible = on
    if (on) {
      const a = k < 0.25 ? k / 0.25 : Math.exp(-(k - 0.25) * 1.2)
      mat.uniforms.uIntensity.value = 2.6 * a
      if (spr.current) {
        spr.current.scale.setScalar(260 + k * 140)
        ;(spr.current.material as THREE.SpriteMaterial).opacity = a
      }
    }
  })
  return (
    <group ref={grp} position={V(-0.25, 0.35, -0.9, 1700)} rotation={[0.4, 0.2, 1.1]} visible={false}>
      <mesh geometry={geo} material={mat} />
      <mesh geometry={geo} material={mat} rotation={[Math.PI, 0, 0]} />
      <sprite ref={spr} scale={[260, 260, 1]}>
        <spriteMaterial map={glow} color="#cfeaff" transparent blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>
    </group>
  )
}

export function Phenomena() {
  return (
    <group>
      <BlackHole />
      <Supernova />
      <Pulsar />
      <GasGiant />
      <Galaxy />
      <BlueStar />
      <Meteors />
      <GammaBurst />
    </group>
  )
}
