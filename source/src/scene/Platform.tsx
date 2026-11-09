import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { DISC_R, EXHIBIT_LIST } from '../layout'
import { FONT, beamGeometry, beamMaterial, canvasTex, glowTexture, rand } from '../gfx'

export const TOP_R = DISC_R - 1
const PAD_R: Record<string, number> = { orb: 9, robot: 11, piano: 6.5, rubik: 6.5, stage: 13, cinema: 10, products: 7, beacon: 4.5 }

function makeTopTextures() {
  const S = 2048
  const pm = S / (2 * TOP_R)
  const cx = S / 2
  const mapX = (x: number) => (x / TOP_R + 1) * 0.5 * S
  const mapY = (z: number) => (z / TOP_R + 1) * 0.5 * S

  // ----- Albedo -----
  const alb = canvasTex(S, S, (ctx) => {
    const g = ctx.createRadialGradient(cx, cx, 0, cx, cx, S / 2)
    g.addColorStop(0, '#141a30')
    g.addColorStop(0.5, '#0b101e')
    g.addColorStop(1, '#05070e')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, S, S)
    // vành ngoài
    ctx.strokeStyle = '#04060b'
    ctx.lineWidth = 0.075 * TOP_R * pm
    ctx.beginPath()
    ctx.arc(cx, cx, 0.94 * TOP_R * pm, 0, Math.PI * 2)
    ctx.stroke()
    // đường dẫn
    ctx.lineCap = 'butt'
    for (const e of EXHIBIT_LIST) {
      if (e.id === 'orb') continue
      ctx.strokeStyle = '#0e1528'
      ctx.lineWidth = 3.4 * pm
      ctx.beginPath()
      ctx.moveTo(cx, cx)
      ctx.lineTo(mapX(e.x), mapY(e.z))
      ctx.stroke()
    }
    // bệ
    for (const e of EXHIBIT_LIST) {
      ctx.fillStyle = '#0a1020'
      ctx.beginPath()
      ctx.arc(mapX(e.x), mapY(e.z), (PAD_R[e.id] ?? 6) * pm, 0, Math.PI * 2)
      ctx.fill()
    }
    // trung tâm
    ctx.fillStyle = '#080c18'
    ctx.beginPath()
    ctx.arc(cx, cx, PAD_R.orb * pm, 0, Math.PI * 2)
    ctx.fill()
  })

  // ----- Emissive -----
  const emi = canvasTex(S, S, (ctx) => {
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, S, S)
    const ring = (f: number, w: number, col: string, a = 1, dash?: number[]) => {
      ctx.save()
      ctx.globalAlpha = a
      ctx.strokeStyle = col
      ctx.lineWidth = w
      if (dash) ctx.setLineDash(dash)
      ctx.beginPath()
      ctx.arc(cx, cx, f * TOP_R * pm, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }
    ring(0.985, 5, '#2fd8ff', 0.9)
    ring(0.955, 2, '#9a6bff', 0.7)
    ring(0.9, 2, '#2fd8ff', 0.35, [pm * 0.8, pm * 0.5])
    ring(0.84, 1.5, '#9a6bff', 0.45)
    ring(0.62, 2, '#2fd8ff', 0.28, [pm * 2.5, pm * 1.2])
    ring(0.41, 1.5, '#ff4fd8', 0.25)
    ring(0.24, 2, '#2fd8ff', 0.28, [pm * 0.5, pm * 0.5])
    ring(0.16, 1.5, '#9a6bff', 0.4)

    // vạch chia độ
    ctx.strokeStyle = '#7fd8ff'
    for (let i = 0; i < 360; i += 2) {
      const a = (i / 180) * Math.PI
      const big = i % 10 === 0
      const r0 = 0.93 * TOP_R * pm
      const r1 = r0 + (big ? 1.1 : 0.55) * pm
      ctx.globalAlpha = big ? 0.9 : 0.4
      ctx.lineWidth = big ? 2.4 : 1.2
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(a) * r0, cx + Math.sin(a) * r0)
      ctx.lineTo(cx + Math.cos(a) * r1, cx + Math.sin(a) * r1)
      ctx.stroke()
    }
    ctx.globalAlpha = 1

    // chữ vòng tròn
    const text = 'ORBITA  •  LIVE PRODUCTION  •  DIGITAL PRODUCTS  •  IMMERSIVE EXPERIENCE  •  CREATIVE TECHNOLOGY  •  '
    ctx.save()
    ctx.translate(cx, cx)
    ctx.font = `700 ${1.15 * pm}px ${FONT}`
    ctx.textAlign = 'center'
    ctx.fillStyle = '#b6a4ff'
    const radius = 0.875 * TOP_R * pm
    const widths = [...text].map((ch) => ctx.measureText(ch).width + 0.22 * pm)
    const total = widths.reduce((a, b) => a + b, 0)
    const k = (Math.PI * 2) / (total / radius)
    let ang = 0
    ;[...text].forEach((ch, i) => {
      const step = (widths[i] / radius) * k
      ctx.save()
      ctx.rotate(ang + step / 2)
      ctx.translate(0, -radius)
      ctx.globalAlpha = 0.85
      ctx.fillText(ch, 0, 0)
      ctx.restore()
      ang += step
    })
    ctx.restore()

    // đường dẫn + chevron
    for (const e of EXHIBIT_LIST) {
      if (e.id === 'orb') continue
      const len = Math.hypot(e.x, e.z)
      const dx = e.x / len
      const dz = e.z / len
      const px = -dz
      const pz = dx
      const s0 = PAD_R.orb + 1
      const s1 = len - (PAD_R[e.id] ?? 6) - 0.5
      ctx.strokeStyle = e.color
      ctx.lineWidth = 2.2
      ctx.globalAlpha = 0.55
      for (const side of [-1, 1]) {
        ctx.beginPath()
        ctx.moveTo(mapX(dx * s0 + px * 1.7 * side), mapY(dz * s0 + pz * 1.7 * side))
        ctx.lineTo(mapX(dx * s1 + px * 1.7 * side), mapY(dz * s1 + pz * 1.7 * side))
        ctx.stroke()
      }
      ctx.globalAlpha = 0.85
      ctx.lineWidth = 3
      for (let s = s0 + 2; s < s1 - 1; s += 3.2) {
        ctx.beginPath()
        ctx.moveTo(mapX(dx * (s - 0.5) + px * 0.9), mapY(dz * (s - 0.5) + pz * 0.9))
        ctx.lineTo(mapX(dx * (s + 0.5)), mapY(dz * (s + 0.5)))
        ctx.lineTo(mapX(dx * (s - 0.5) - px * 0.9), mapY(dz * (s - 0.5) - pz * 0.9))
        ctx.stroke()
      }
    }

    // bệ trưng bày
    for (const e of EXHIBIT_LIST) {
      const R = (PAD_R[e.id] ?? 6) * pm
      const x = mapX(e.x)
      const y = mapY(e.z)
      ctx.strokeStyle = e.color
      ctx.globalAlpha = 0.95
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.arc(x, y, R, 0, Math.PI * 2)
      ctx.stroke()
      ctx.globalAlpha = 0.5
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(x, y, R * 0.86, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([pm * 0.4, pm * 0.4])
      ctx.globalAlpha = 0.45
      ctx.beginPath()
      ctx.arc(x, y, R * 0.7, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])
      for (let i = 0; i < 48; i++) {
        const a = (i / 48) * Math.PI * 2
        ctx.globalAlpha = 0.7
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(x + Math.cos(a) * R * 1.0, y + Math.sin(a) * R * 1.0)
        ctx.lineTo(x + Math.cos(a) * R * 1.07, y + Math.sin(a) * R * 1.07)
        ctx.stroke()
      }
    }
    ctx.globalAlpha = 1
  })
  return { alb: alb.tex, emi: emi.tex, albCanvas: alb.canvas, emiCanvas: emi.canvas }
}

function makeDetail() {
  const S = 512
  const { tex } = canvasTex(
    S,
    S,
    (ctx) => {
      ctx.fillStyle = '#9a9a9a'
      ctx.fillRect(0, 0, S, S)
      for (let i = 0; i < 9000; i++) {
        const v = 120 + Math.random() * 70
        ctx.fillStyle = `rgb(${v},${v},${v})`
        ctx.fillRect(Math.random() * S, Math.random() * S, 1 + Math.random() * 2, 1 + Math.random() * 2)
      }
      ctx.strokeStyle = '#2a2a2a'
      ctx.lineWidth = 4
      for (let i = 0; i <= S; i += 128) {
        ctx.beginPath()
        ctx.moveTo(i, 0)
        ctx.lineTo(i, S)
        ctx.moveTo(0, i)
        ctx.lineTo(S, i)
        ctx.stroke()
      }
      ctx.strokeStyle = '#555'
      ctx.lineWidth = 1.5
      for (let i = 64; i < S; i += 128) {
        ctx.beginPath()
        ctx.moveTo(i, 0)
        ctx.lineTo(i, S)
        ctx.moveTo(0, i)
        ctx.lineTo(S, i)
        ctx.stroke()
      }
    },
    false,
  )
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(36, 36)
  return tex
}

export const topCanvases: { albedo: HTMLCanvasElement | null } = { albedo: null }

function DiscBody() {
  const { alb, emi, albCanvas } = useMemo(() => makeTopTextures(), [])
  const detail = useMemo(() => makeDetail(), [])
  useEffect(() => {
    topCanvases.albedo = albCanvas
  }, [albCanvas])

  const lathe = useMemo(() => {
    const R = DISC_R
    const pts = [
      [TOP_R, 0],
      [R - 0.3, -0.12],
      [R, -0.7],
      [R, -1.6],
      [R - 1.2, -2.7],
      [R * 0.9, -4.6],
      [R * 0.66, -8.6],
      [R * 0.4, -14],
      [R * 0.18, -20],
      [5, -25],
      [0, -26],
    ].map(([x, y]) => new THREE.Vector2(x, y))
    return new THREE.LatheGeometry(pts, 160)
  }, [])

  const rimMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: /* glsl */ `
          varying vec2 vUv; uniform float uTime;
          void main(){
            float u = vUv.x;
            float dash = smoothstep(0.35, 0.5, sin(u*900.0 - uTime*5.0)*0.5+0.5);
            float chase = pow(0.5+0.5*sin(u*6.2831*3.0 - uTime*1.4), 6.0);
            vec3 c = mix(vec3(0.1,0.8,1.0), vec3(0.7,0.3,1.0), 0.5+0.5*sin(u*6.2831*2.0 + uTime*0.3));
            float a = 0.55 + 0.45*dash + chase*1.4;
            gl_FragColor = vec4(c * a * 2.0, 1.0);
          }`,
      }),
    [],
  )
  const fieldMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: /* glsl */ `
          varying vec2 vUv; uniform float uTime;
          void main(){
            float h = vUv.y;
            float fall = pow(h, 2.4);
            float lines = pow(abs(sin(vUv.x*500.0)), 14.0);
            float wave = 0.5 + 0.5*sin(vUv.x*60.0 + uTime*1.2 + h*6.0);
            vec3 c = mix(vec3(0.1,0.7,1.0), vec3(0.65,0.25,1.0), 0.5+0.5*sin(vUv.x*6.2831*2.0 + uTime*0.2));
            float a = fall * (0.12 + lines*0.5 + wave*0.1);
            gl_FragColor = vec4(c * 2.0, a);
          }`,
      }),
    [],
  )
  const pulseMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uR: { value: 0 }, uFade: { value: 1 } },
        vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: /* glsl */ `
          varying vec2 vP; uniform float uR, uFade;
          void main(){
            float r = length(vP);
            float d = (r - uR);
            float a = exp(-d*d/(2.0*1.3)) * uFade + exp(-pow(d+3.5,2.0)/6.0) * uFade * 0.35;
            gl_FragColor = vec4(vec3(0.35,0.7,1.0)*a*1.2, a*0.7);
          }`,
      }),
    [],
  )
  useFrame((s) => {
    const t = s.clock.elapsedTime
    rimMat.uniforms.uTime.value = t
    fieldMat.uniforms.uTime.value = t
    const c = (t % 9) / 9
    pulseMat.uniforms.uR.value = 8 + c * (TOP_R - 8)
    pulseMat.uniforms.uFade.value = Math.sin(Math.PI * Math.min(1, c * 1.05)) * 0.9
  })

  const underRings = [
    { r: DISC_R * 0.9, y: -4.6, c: '#32d8ff' },
    { r: DISC_R * 0.66, y: -8.6, c: '#9a6bff' },
    { r: DISC_R * 0.4, y: -14, c: '#ff4fd8' },
    { r: DISC_R * 0.18, y: -20, c: '#32d8ff' },
  ]
  const engineGeo = useMemo(() => beamGeometry(120, 14, 2, 28), [])
  const engineMat = useMemo(() => beamMaterial('#6a8cff', 1.4), [])
  const glow = glowTexture()

  return (
    <group>
      {/* mặt đĩa */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[TOP_R, 160]} />
        <meshStandardMaterial
          map={alb}
          emissiveMap={emi}
          emissive="#ffffff"
          emissiveIntensity={1.7}
          roughness={0.5}
          roughnessMap={detail}
          bumpMap={detail}
          bumpScale={0.6}
          metalness={0.75}
          envMapIntensity={1.4}
        />
      </mesh>
      {/* thân đĩa */}
      <mesh geometry={lathe}>
        <meshStandardMaterial color="#0b0f1a" metalness={0.92} roughness={0.32} envMapIntensity={1.6} />
      </mesh>
      {/* vòng sáng rìa */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.1, 0]} material={rimMat}>
        <torusGeometry args={[TOP_R - 0.4, 0.13, 8, 320]} />
      </mesh>
      {/* rào năng lượng */}
      <mesh position={[0, 2.6, 0]} material={fieldMat}>
        <cylinderGeometry args={[TOP_R - 0.2, TOP_R - 0.2, 5.2, 256, 1, true]} />
      </mesh>
      {/* sóng xung từ tâm */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} material={pulseMat}>
        <circleGeometry args={[TOP_R, 128]} />
      </mesh>
      {/* rãnh sáng phía dưới */}
      {underRings.map((u, i) => (
        <mesh key={i} position={[0, u.y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[u.r + 0.1, 0.18, 8, 200]} />
          <meshBasicMaterial color={new THREE.Color(u.c).multiplyScalar(2.5)} toneMapped={false} />
        </mesh>
      ))}
      {/* động cơ */}
      <group position={[0, -26, 0]}>
        <sprite scale={[60, 60, 1]}>
          <spriteMaterial map={glow} color="#7a9bff" transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} />
        </sprite>
        <mesh geometry={engineGeo} material={engineMat} rotation={[Math.PI, 0, 0]} />
      </group>
      <pointLight position={[0, -14, 0]} intensity={3500} distance={90} decay={2} color="#6a8cff" />
    </group>
  )
}

// ---------- Vành đai thiên thạch ----------
function Debris() {
  const rocks = useRef<THREE.InstancedMesh>(null)
  const crystals = useRef<THREE.InstancedMesh>(null)
  const grp = useRef<THREE.Group>(null)
  const geo = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(1, 1)
    const p = g.attributes.position
    const v = new THREE.Vector3()
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i)
      const k = 0.7 + 0.5 * Math.abs(Math.sin(v.x * 3.1 + v.y * 5.3 + v.z * 2.7))
      v.multiplyScalar(k)
      p.setXYZ(i, v.x, v.y * 0.8, v.z)
    }
    g.computeVertexNormals()
    return g
  }, [])
  useEffect(() => {
    const dummy = new THREE.Object3D()
    const m = rocks.current
    if (m) {
      for (let i = 0; i < 170; i++) {
        const a = Math.random() * Math.PI * 2
        const r = rand(104, 200)
        const s = Math.pow(Math.random(), 3) * 7 + 0.5
        dummy.position.set(Math.cos(a) * r, rand(-30, 18) * (r > 120 ? 1.3 : 1), Math.sin(a) * r)
        dummy.rotation.set(rand(0, 6), rand(0, 6), rand(0, 6))
        dummy.scale.set(s * rand(0.8, 1.4), s, s * rand(0.8, 1.4))
        dummy.updateMatrix()
        m.setMatrixAt(i, dummy.matrix)
      }
      m.instanceMatrix.needsUpdate = true
    }
    const c = crystals.current
    if (c) {
      const col = new THREE.Color()
      for (let i = 0; i < 60; i++) {
        const a = Math.random() * Math.PI * 2
        const r = rand(100, 160)
        const s = rand(0.4, 1.6)
        dummy.position.set(Math.cos(a) * r, rand(-14, 14), Math.sin(a) * r)
        dummy.rotation.set(rand(0, 6), rand(0, 6), rand(0, 6))
        dummy.scale.set(s * 0.6, s * 1.8, s * 0.6)
        dummy.updateMatrix()
        c.setMatrixAt(i, dummy.matrix)
        col.setHSL(rand(0.5, 0.85), 0.9, 0.6).multiplyScalar(2.5)
        c.setColorAt(i, col)
      }
      c.instanceMatrix.needsUpdate = true
      if (c.instanceColor) c.instanceColor.needsUpdate = true
    }
  }, [])
  useFrame((_, dt) => {
    if (grp.current) grp.current.rotation.y += dt * 0.006
  })
  return (
    <group ref={grp}>
      <instancedMesh ref={rocks} args={[geo, undefined, 170]} frustumCulled={false}>
        <meshStandardMaterial color="#3b3946" roughness={0.9} metalness={0.15} flatShading envMapIntensity={0.8} />
      </instancedMesh>
      <instancedMesh ref={crystals} args={[undefined, undefined, 60]} frustumCulled={false}>
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </group>
  )
}

// ---------- Bụi sáng / đom đóm ----------
function Dust() {
  const { geo, mat } = useMemo(() => {
    const N = 900
    const pos = new Float32Array(N * 3)
    const seed = new Float32Array(N)
    const col = new Float32Array(N * 3)
    const c = new THREE.Color()
    for (let i = 0; i < N; i++) {
      const a = Math.random() * Math.PI * 2
      const r = Math.sqrt(Math.random()) * (TOP_R - 2)
      pos.set([Math.cos(a) * r, rand(0.3, 16), Math.sin(a) * r], i * 3)
      seed[i] = Math.random()
      c.setHSL(rand(0.5, 0.85), 0.8, 0.65)
      col.set([c.r, c.g, c.b], i * 3)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    g.setAttribute('aColor', new THREE.BufferAttribute(col, 3))
    const m = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uPx: { value: 1 } },
      vertexShader: /* glsl */ `
        attribute float aSeed; attribute vec3 aColor; uniform float uTime, uPx; varying vec3 vC; varying float vA;
        void main(){
          vec3 p = position;
          p.x += sin(uTime*0.25 + aSeed*40.0)*1.6;
          p.z += cos(uTime*0.21 + aSeed*70.0)*1.6;
          p.y += sin(uTime*0.4 + aSeed*55.0)*0.9;
          vec4 mv = modelViewMatrix * vec4(p,1.0);
          gl_PointSize = clamp(uPx * (70.0 * (0.4 + aSeed)) / -mv.z, 1.0, 14.0);
          vC = aColor; vA = 0.4 + 0.6*pow(0.5+0.5*sin(uTime*(0.6+aSeed) + aSeed*90.0), 2.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vC; varying float vA;
        void main(){ float d = length(gl_PointCoord-0.5); float a = smoothstep(0.5,0.0,d); gl_FragColor = vec4(vC*2.0, a*a*vA); }`,
    })
    return { geo: g, mat: m }
  }, [])
  useFrame((s) => {
    mat.uniforms.uTime.value = s.clock.elapsedTime
    mat.uniforms.uPx.value = s.gl.getPixelRatio()
  })
  return <points geometry={geo} material={mat} frustumCulled={false} />
}

export function Platform() {
  return (
    <group>
      <DiscBody />
      <Debris />
      <Dust />
    </group>
  )
}
