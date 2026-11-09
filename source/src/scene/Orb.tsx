import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { EXHIBITS } from '../layout'
import { audio, type Bus } from '../audio'
import { toast } from '../store'
import { NOISE_GLSL, beamGeometry, beamMaterial, glowTexture, rand } from '../gfx'
import { Hit } from './Hit'
import { Label } from './Label'
import { PadRing, mats, useWorldColliders, worldPos } from './common'

const ex = EXHIBITS.orb
const ORB_Y = 6.8
const ORB_R = 2.5
const N_RAYS = 56
const N_ARCS = 9
const ARC_PTS = 24

const PALETTE = ['#9a5bff', '#38d9ff', '#ff4fd8', '#b8c8ff', '#6a7bff'].map((c) => new THREE.Color(c))

export function Orb() {
  const busRef = useRef<Bus | null>(null)
  const hum = useRef(false)
  const raysRef = useRef<THREE.InstancedMesh>(null)
  const shell = useRef<THREE.Mesh>(null)
  const core = useRef<THREE.Mesh>(null)
  const light = useRef<THREE.PointLight>(null)
  const gyro = [useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null)]
  const wave1 = useRef<THREE.Mesh>(null)
  const wave2 = useRef<THREE.Mesh>(null)
  const flash = useRef<THREE.Sprite>(null)
  const st = useRef({ t0: -100, nextArc: new Float32Array(N_ARCS) }).current
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const tmpV = useMemo(() => new THREE.Vector3(), [])
  const tmpQ = useMemo(() => new THREE.Quaternion(), [])
  const Y = useMemo(() => new THREE.Vector3(0, 1, 0), [])

  useWorldColliders(ex, [{ type: 'circle', x: 0, z: 0, r: 3 }])
  useEffect(() => {
    busRef.current = audio.createBus('orb', worldPos(ex, 0, ORB_Y, 0), { ref: 5, rolloff: 1.15, maxDist: 130, reverb: 0.45, gain: 0.55 })
  }, [])

  const rayData = useMemo(() => {
    const geo = beamGeometry(64, 1.3, 0.03, 8)
    const aColor = new Float32Array(N_RAYS * 3)
    const aPhase = new Float32Array(N_RAYS)
    const data = Array.from({ length: N_RAYS }, (_, i) => {
      const d = new THREE.Vector3(rand(-1, 1), rand(-0.1, 1), rand(-1, 1)).normalize()
      const ax = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize()
      const c = PALETTE[Math.floor(Math.random() * PALETTE.length)]
      aColor.set([c.r, c.g, c.b], i * 3)
      aPhase[i] = Math.random()
      return { d, ax, w: rand(-0.35, 0.35) || 0.2, len: rand(0.35, 1), th: rand(0.5, 1.4) }
    })
    geo.setAttribute('aColor', new THREE.InstancedBufferAttribute(aColor, 3))
    geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(aPhase, 1))
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uEnergy: { value: 1 } },
      vertexShader: /* glsl */ `
        attribute vec3 aColor; attribute float aPhase;
        varying vec3 vC; varying vec3 vN; varying vec3 vV; varying float vH; varying float vPh;
        void main(){
          mat4 mvi = modelViewMatrix * instanceMatrix;
          vec4 mv = mvi * vec4(position, 1.0);
          vN = normalize(mat3(mvi) * normal);
          vV = normalize(-mv.xyz);
          vH = uv.y; vC = aColor; vPh = aPhase;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime, uEnergy;
        varying vec3 vC; varying vec3 vN; varying vec3 vV; varying float vH; varying float vPh;
        void main(){
          float f = clamp(abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0);
          float edge = pow(f, 1.8);
          float fade = pow(clamp(1.0 - vH, 0.0, 1.0), 1.1);
          float flick = 0.7 + 0.3 * sin(uTime*(3.0 + vPh*5.0) + vPh*40.0);
          float pulse = 0.6 + 0.8 * pow(0.5 + 0.5*sin(vH*14.0 - uTime*(3.0 + vPh*3.0) + vPh*30.0), 3.0);
          float a = edge * fade * flick * pulse * clamp(uEnergy, 0.0, 3.2);
          gl_FragColor = vec4(vC * 1.7, a * 0.9);
        }`,
    })
    return { geo, mat, data }
  }, [])

  const shellMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uEnergy: { value: 1 } },
        vertexShader: /* glsl */ `
          uniform float uTime;
          varying vec3 vN; varying vec3 vV; varying vec3 vO;
          varying float vNoise;
          ${NOISE_GLSL}
          void main(){
            vO = normalize(position);
            vN = normalMatrix * normal;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vV = -mv.xyz;
            vec3 q = vO * 3.0 + vec3(0.0, uTime*0.5, uTime*0.35);
            vNoise = clamp(fbm(q), 0.0, 1.0);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          varying vec3 vN; varying vec3 vV; varying vec3 vO;
          varying float vNoise;
          uniform float uTime, uEnergy;
          ${NOISE_GLSL}
          void main(){
            float facing = clamp(abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0);
            float rim = pow(clamp(1.0 - facing, 0.0, 1.0), 2.4);
            float n = clamp(vNoise, 0.0, 1.0);
            vec3 q = normalize(vO) * 5.4 + vec3(n * 1.5, uTime*0.85, uTime*0.65);
            float detail = vnoise(q);
            float arcs = pow(clamp(1.0 - abs(detail - 0.5) * 2.0, 0.0, 1.0), 6.0);
            vec3 col = mix(vec3(0.5,0.2,1.0), vec3(0.1,0.8,1.0), clamp(n + 0.3*sin(uTime*0.5), 0.0, 1.0));
            col = mix(col, vec3(1.0,0.4,0.9), arcs*0.6);
            float a = clamp(rim*1.1 + arcs*(0.15 + rim*2.2), 0.0, 1.0);
            gl_FragColor = vec4(col * a * clamp(uEnergy, 0.0, 3.0) * 1.7, 1.0);
          }`,
      }),
    [],
  )

  const swirl = useMemo(() => {
    const N = 2400
    const pos = new Float32Array(N * 3)
    const aR = new Float32Array(N)
    const aA = new Float32Array(N)
    const aS = new Float32Array(N)
    const aT = new Float32Array(N)
    const aH = new Float32Array(N)
    const tilts = [0.0, 0.9, -0.8]
    for (let i = 0; i < N; i++) {
      aR[i] = rand(3.3, 9)
      aA[i] = rand(0, Math.PI * 2)
      aS[i] = rand(1.2, 3.2) * (Math.random() < 0.5 ? 1 : -1)
      aT[i] = tilts[i % 3] + rand(-0.12, 0.12)
      aH[i] = Math.random()
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aR', new THREE.BufferAttribute(aR, 1))
    g.setAttribute('aA', new THREE.BufferAttribute(aA, 1))
    g.setAttribute('aS', new THREE.BufferAttribute(aS, 1))
    g.setAttribute('aT', new THREE.BufferAttribute(aT, 1))
    g.setAttribute('aH', new THREE.BufferAttribute(aH, 1))
    const m = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uEnergy: { value: 1 }, uPx: { value: 1 } },
      vertexShader: /* glsl */ `
        uniform float uTime, uEnergy, uPx;
        attribute float aR, aA, aS, aT, aH; varying vec3 vC;
        void main(){
          float r = aR * (1.0 + (uEnergy - 1.0)*0.12);
          float a = aA + uTime * aS / (0.6 + r*0.18);
          vec3 p = vec3(cos(a)*r, sin(a*2.0 + aA)*0.25, sin(a)*r);
          float ct = cos(aT), st = sin(aT);
          p = vec3(p.x, p.y*ct - p.z*st, p.y*st + p.z*ct);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float eyeDepth = max(-mv.z, 0.15);
          gl_PointSize = (-mv.z > 0.0) ? clamp(uPx * 40.0 / eyeDepth * (0.5 + aH), 1.0, 8.0) : 1.0;
          vC = mix(vec3(0.55,0.25,1.0), vec3(0.25,0.95,1.0), aH) * (0.8 + 0.4*uEnergy);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vC;
        void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(vC * 2.0, a*a); }`,
    })
    return { g, m }
  }, [])

  const arcs = useMemo(() => {
    const mat = new THREE.LineBasicMaterial({ color: new THREE.Color('#d6c8ff').multiplyScalar(3.2), toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
    return Array.from({ length: N_ARCS }, () => {
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ARC_PTS * 3), 3))
      const l = new THREE.Line(g, mat)
      l.frustumCulled = false
      return l
    })
  }, [])

  const regenArc = (l: THREE.Line, energy: number) => {
    const p = l.geometry.attributes.position as THREE.BufferAttribute
    const dir = tmpV.set(rand(-1, 1), rand(-0.4, 1), rand(-1, 1)).normalize()
    const sx = dir.x * ORB_R * 1.02
    const sy = dir.y * ORB_R * 1.02
    const sz = dir.z * ORB_R * 1.02
    const reach = rand(5, 9) * (0.8 + energy * 0.35)
    let ex_ = dir.x * reach + rand(-2, 2)
    let ey = dir.y * reach + rand(-2, 2)
    const ez = dir.z * reach + rand(-2, 2)
    if (ey < -ORB_Y + 0.15) ey = -ORB_Y + 0.15
    ex_ = ex_ + 0
    for (let i = 0; i < ARC_PTS; i++) {
      const t = i / (ARC_PTS - 1)
      const amp = Math.sin(Math.PI * t) * 0.9 * (0.7 + energy * 0.3)
      p.setXYZ(
        i,
        sx + (ex_ - sx) * t + rand(-amp, amp),
        sy + (ey - sy) * t + rand(-amp, amp),
        sz + (ez - sz) * t + rand(-amp, amp),
      )
    }
    p.needsUpdate = true
  }

  const trigger = () => {
    const t = performance.now() / 1000
    if (t - st.t0 < 2.6) return
    st.t0 = t
    if (busRef.current) audio.orbCharge(busRef.current)
    toast('Singularity Orb: tích năng lượng…')
  }

  const shock = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color('#9f8bff').multiplyScalar(2.4), toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), [])
  const shock2 = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color('#5fe0ff').multiplyScalar(2.4), toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), [])
  const stemBeam = useMemo(() => beamGeometry(2.6, 0.55, 0.12, 20), [])
  const stemMat = useMemo(() => beamMaterial('#a77bff', 1.6), [])
  const glow = glowTexture()

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    if (!hum.current && audio.started && busRef.current) {
      hum.current = true
      audio.orbHum(busRef.current)
    }
    const k = performance.now() / 1000 - st.t0
    const charge = k >= 0 && k < 1.05 ? k / 1.05 : 0
    const boom = k >= 1.05 ? Math.exp(-(k - 1.05) * 0.85) : 0
    const energy = 1 + charge * 0.7 + boom * 2.0
    const sc = 1 - charge * 0.1 + boom * 0.05

    rayData.mat.uniforms.uTime.value = t
    rayData.mat.uniforms.uEnergy.value = energy
    shellMat.uniforms.uTime.value = t
    shellMat.uniforms.uEnergy.value = energy
    swirl.m.uniforms.uTime.value = t
    swirl.m.uniforms.uEnergy.value = energy
    swirl.m.uniforms.uPx.value = state.gl.getPixelRatio()
    if (core.current) core.current.scale.setScalar(sc)
    if (shell.current) shell.current.scale.setScalar(1.045 * sc)

    // tia sáng
    const rays = raysRef.current
    if (rays) {
      for (let i = 0; i < N_RAYS; i++) {
        const r = rayData.data[i]
        tmpV.copy(r.d).applyAxisAngle(r.ax, t * r.w)
        tmpQ.setFromUnitVectors(Y, tmpV)
        dummy.position.set(0, 0, 0)
        dummy.quaternion.copy(tmpQ)
        const len = r.len * (0.75 + 0.25 * Math.sin(t * r.th + i)) * (0.7 + (energy - 1) * 0.45)
        const w = 0.8 + (energy - 1) * 0.7
        dummy.scale.set(w, len, w)
        dummy.updateMatrix()
        rays.setMatrixAt(i, dummy.matrix)
      }
      rays.instanceMatrix.needsUpdate = true
    }

    // sét
    for (let i = 0; i < N_ARCS; i++) {
      st.nextArc[i] -= dt
      const l = arcs[i]
      if (st.nextArc[i] <= 0) {
        st.nextArc[i] = rand(0.04, 0.13) / (1 + boom * 2.5)
        regenArc(l, energy)
        l.visible = Math.random() < 0.55 + boom * 0.45 + charge * 0.3
      }
    }

    // ánh sáng + vòng xoay
    if (light.current) {
      light.current.color.setHSL((t * 0.04) % 1, 0.75, 0.6)
      light.current.intensity = 420 * energy
    }
    gyro.forEach((g, i) => {
      if (g.current) g.current.rotation.set(t * (0.3 + i * 0.17) + i, t * (0.22 - i * 0.12), t * 0.1 * (i + 1))
    })
    if (flash.current) {
      const f = k >= 1.05 ? Math.exp(-(k - 1.05) * 2.6) : charge * 0.5
      flash.current.scale.setScalar(8 + f * 30)
      ;(flash.current.material as THREE.SpriteMaterial).opacity = Math.min(1, 0.25 + f)
    }
    // sóng xung trên mặt đĩa
    const sw = (m: THREE.Mesh | null, mat: THREE.MeshBasicMaterial, delay: number) => {
      if (!m) return
      const kk = k - 1.05 - delay
      if (kk > 0 && kk < 2.4) {
        m.visible = true
        m.scale.setScalar(3 + (kk / 2.4) * 52)
        mat.opacity = (1 - kk / 2.4) * 0.9
      } else m.visible = false
    }
    sw(wave1.current, shock, 0)
    sw(wave2.current, shock2, 0.25)
  })

  return (
    <group position={[ex.x, 0, ex.z]}>
      <PadRing radius={8.2} color={ex.color} />
      <PadRing radius={5.6} color="#38d9ff" y={0.08} tube={0.05} />
      <Label title="Singularity Orb" sub="VFX · Lighting · Laser" color={ex.color} position={[0, 13.5, 0]} scale={1.3} fadeFar={110} />

      {/* bệ */}
      <mesh position={[0, 0.3, 0]} material={mats.darkMetal} castShadow receiveShadow>
        <cylinderGeometry args={[3.1, 3.5, 0.6, 48]} />
      </mesh>
      <mesh position={[0, 0.62, 0]} material={mats.lacquer}>
        <cylinderGeometry args={[2.0, 2.6, 0.12, 48]} />
      </mesh>
      <PadRing radius={2.95} color="#a77bff" y={0.58} tube={0.05} />
      <mesh position={[0, 2.0, 0]} material={mats.darkMetal} castShadow>
        <cylinderGeometry args={[0.2, 0.55, 2.8, 24]} />
      </mesh>
      <mesh position={[0, 3.5, 0]} geometry={stemBeam} material={stemMat} />

      {/* quả cầu */}
      <group position={[0, ORB_Y, 0]}>
        <mesh ref={core} castShadow>
          <sphereGeometry args={[ORB_R, 64, 48]} />
          <meshPhysicalMaterial color="#020204" metalness={1} roughness={0.05} clearcoat={1} envMapIntensity={1.6} />
        </mesh>
        <mesh ref={shell} material={shellMat}>
          <sphereGeometry args={[ORB_R, 64, 48]} />
        </mesh>
        <sprite ref={flash} scale={[8, 8, 1]}>
          <spriteMaterial map={glow} color="#b9a0ff" transparent opacity={0.3} blending={THREE.AdditiveBlending} depthWrite={false} />
        </sprite>
        <instancedMesh ref={raysRef} args={[rayData.geo, rayData.mat, N_RAYS]} frustumCulled={false} />
        <points geometry={swirl.g} material={swirl.m} frustumCulled={false} />
        {arcs.map((l, i) => (
          <primitive key={i} object={l} />
        ))}
        {[4.0, 4.6, 5.2].map((r, i) => (
          <mesh key={i} ref={gyro[i]}>
            <torusGeometry args={[r, 0.04 + i * 0.012, 10, 140]} />
            <meshStandardMaterial color="#12131c" metalness={1} roughness={0.25} emissive={['#7a4dff', '#2fd8ff', '#ff4fd8'][i]} emissiveIntensity={1.4} />
          </mesh>
        ))}
        <pointLight ref={light} color="#a77bff" intensity={420} distance={90} decay={2} />
      </group>

      <mesh ref={wave1} position={[0, 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false} material={shock}>
        <ringGeometry args={[0.95, 1, 128]} />
      </mesh>
      <mesh ref={wave2} position={[0, 0.14, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false} material={shock2}>
        <ringGeometry args={[0.95, 1, 128]} />
      </mesh>

      <Hit id="orb" label="Singularity Orb" hint="Kích hoạt năng lượng" panel="orb" maxDist={60} shape="sphere" size={[4.2, 0, 0]} position={[0, ORB_Y, 0]} onClick={trigger} />
      <Hit id="orb-base" label="Singularity Orb" hint="Kích hoạt năng lượng" panel="orb" maxDist={40} shape="cylinder" size={[3.4, 2, 0]} position={[0, 1, 0]} onClick={trigger} />
    </group>
  )
}
