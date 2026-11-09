import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Sparkles } from '@react-three/drei'
import * as THREE from 'three'
import { EXHIBITS } from '../layout'
import { audio, type Bus } from '../audio'
import { toast } from '../store'
import { FONT, beamGeometry, beamMaterial, canvasTex, rbox, roundRect } from '../gfx'
import { Hit } from './Hit'
import { Label } from './Label'
import { PadRing, isFacing, mats, useWorldColliders, worldPos } from './common'

const ex = EXHIBITS.products
const TW = 360
const TH = 740
const R = 4.7
const APPS = [
  { name: 'TicketFlow', sub: 'Vé & check-in', color: '#ff4fd8' },
  { name: 'LiveSync', sub: 'Dashboard thời gian thực', color: '#38d9ff' },
  { name: 'Wayfinder AR', sub: 'Dẫn đường bằng AR', color: '#5dffb0' },
  { name: 'Pulse Poll', sub: 'Bình chọn trực tiếp', color: '#ffc23d' },
  { name: 'CueDeck', sub: 'Điều khiển show', color: '#9a6bff' },
]

const hash = (n: number) => {
  const s = Math.sin(n * 78.233) * 43758.5453
  return s - Math.floor(s)
}

function drawApp(ctx: CanvasRenderingContext2D, i: number, t: number) {
  const W = TW
  const H = TH
  ctx.globalCompositeOperation = 'source-over'
  ctx.shadowBlur = 0
  ctx.textAlign = 'left'
  const status = () => {
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.font = `600 15px ${FONT}`
    ctx.fillText('9:41', 28, 32)
    ctx.textAlign = 'right'
    ctx.fillText('5G  ▮▮▮', W - 28, 32)
    ctx.textAlign = 'left'
  }
  if (i === 0) {
    const g = ctx.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, '#2a0f45')
    g.addColorStop(1, '#0a0614')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
    status()
    ctx.fillStyle = '#fff'
    ctx.font = `700 26px ${FONT}`
    ctx.fillText('TicketFlow', 28, 82)
    const cg = ctx.createLinearGradient(0, 120, W, 600)
    cg.addColorStop(0, '#ff4fd8')
    cg.addColorStop(1, '#6a3bff')
    ctx.fillStyle = cg
    roundRect(ctx, 24, 112, W - 48, 480, 28)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = `800 26px ${FONT}`
    ctx.fillText('AURORA FEST 2025', 46, 164)
    ctx.font = `500 15px ${FONT}`
    ctx.fillText('GA · GATE B · 20:00 · 14.11', 46, 190)
    ctx.fillStyle = '#fff'
    roundRect(ctx, 58, 214, 244, 244, 18)
    ctx.fill()
    const seed = Math.floor(t / 3) * 101
    ctx.fillStyle = '#12061f'
    const n = 21
    const cs = 10.4
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const finder = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13)
        let on = hash(x * 31 + y * 17 + seed) > 0.5
        if (finder) {
          const fx = x < 7 ? x : x - 14
          const fy = y < 7 ? y : y - 14
          on = fx === 0 || fx === 6 || fy === 0 || fy === 6 || (fx >= 2 && fx <= 4 && fy >= 2 && fy <= 4)
        }
        if (on) ctx.fillRect(70 + x * cs, 226 + y * cs, cs - 0.8, cs - 0.8)
      }
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.font = `500 15px ${FONT}`
    ctx.textAlign = 'center'
    ctx.fillText(`Mã tự đổi sau ${3 - Math.floor(t % 3)}s · chống chụp ảnh`, W / 2, 492)
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    roundRect(ctx, 58, 510, 244, 8, 4)
    ctx.fill()
    ctx.fillStyle = '#fff'
    roundRect(ctx, 58, 510, 244 * ((t % 3) / 3), 8, 4)
    ctx.fill()
    ctx.fillStyle = '#fff'
    roundRect(ctx, 50, 640, W - 100, 58, 29)
    ctx.fill()
    ctx.fillStyle = '#2a0f45'
    ctx.font = `700 18px ${FONT}`
    ctx.fillText('Thêm vào Ví', W / 2, 676)
  } else if (i === 1) {
    ctx.fillStyle = '#06111d'
    ctx.fillRect(0, 0, W, H)
    status()
    ctx.fillStyle = '#fff'
    ctx.font = `700 26px ${FONT}`
    ctx.fillText('LiveSync', 28, 82)
    ctx.fillStyle = '#ff3b5c'
    ctx.beginPath()
    ctx.arc(W - 70, 74, 5 + Math.sin(t * 5) * 1.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#ff7a8a'
    ctx.font = `600 14px ${FONT}`
    ctx.fillText('LIVE', W - 58, 79)
    ctx.fillStyle = '#7fb8d8'
    ctx.font = `500 13px ${FONT}`
    ctx.fillText('KHÁN GIẢ TRONG KHUÔN VIÊN', 28, 128)
    ctx.fillStyle = '#fff'
    ctx.font = `800 54px ${FONT}`
    ctx.fillText((38000 + Math.round(Math.sin(t * 0.8) * 420 + t * 8) % 5000).toLocaleString('en-US'), 28, 184)
    const cg = ctx.createLinearGradient(0, 220, 0, 400)
    cg.addColorStop(0, 'rgba(56,217,255,0.45)')
    cg.addColorStop(1, 'rgba(56,217,255,0)')
    ctx.beginPath()
    ctx.moveTo(28, 400)
    for (let x = 0; x <= 304; x += 8) {
      const y = 330 - Math.sin(x * 0.03 + t * 0.9) * 40 - Math.sin(x * 0.011 - t * 0.4) * 30 - x * 0.1
      ctx.lineTo(28 + x, y)
    }
    ctx.lineTo(332, 400)
    ctx.fillStyle = cg
    ctx.fill()
    ctx.strokeStyle = '#38d9ff'
    ctx.lineWidth = 3
    ctx.beginPath()
    for (let x = 0; x <= 304; x += 8) {
      const y = 330 - Math.sin(x * 0.03 + t * 0.9) * 40 - Math.sin(x * 0.011 - t * 0.4) * 30 - x * 0.1
      if (x === 0) ctx.moveTo(28 + x, y)
      else ctx.lineTo(28 + x, y)
    }
    ctx.stroke()
    ctx.fillStyle = '#7fb8d8'
    ctx.font = `500 13px ${FONT}`
    ctx.fillText('MẬT ĐỘ ĐÁM ĐÔNG', 28, 436)
    for (let y = 0; y < 6; y++)
      for (let x = 0; x < 8; x++) {
        const v = 0.5 + 0.5 * Math.sin(t * 0.8 + hash(x + y * 8) * 6.28 + x * 0.4)
        ctx.fillStyle = `hsl(${200 - v * 200},90%,${30 + v * 30}%)`
        roundRect(ctx, 28 + x * 39, 450 + y * 33, 35, 29, 6)
        ctx.fill()
      }
    ctx.fillStyle = '#fff'
    ctx.font = `600 16px ${FONT}`
    ctx.fillText('Hàng chờ Gate A', 28, 690)
    ctx.textAlign = 'right'
    ctx.fillStyle = '#5dffb0'
    ctx.fillText(`${1 + Math.floor((Math.sin(t * 0.5) + 1) * 1.2)}:${String(10 + Math.floor(t * 3) % 50).padStart(2, '0')} phút`, W - 28, 690)
  } else if (i === 2) {
    const g = ctx.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, '#2c4a86')
    g.addColorStop(0.45, '#b36a8a')
    g.addColorStop(0.46, '#101828')
    g.addColorStop(1, '#05080f')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
    status()
    ctx.strokeStyle = 'rgba(93,255,176,0.35)'
    ctx.lineWidth = 2
    for (let k = -6; k <= 6; k++) {
      ctx.beginPath()
      ctx.moveTo(W / 2 + k * 8, 340)
      ctx.lineTo(W / 2 + k * 90, H)
      ctx.stroke()
    }
    ctx.globalCompositeOperation = 'lighter'
    for (let k = 0; k < 6; k++) {
      const z = (k + ((t * 0.8) % 1)) / 6
      const y = 340 + (H - 340) * z * z
      const w = 20 + z * 120
      ctx.strokeStyle = `rgba(93,255,176,${0.2 + z * 0.8})`
      ctx.lineWidth = 3 + z * 8
      ctx.beginPath()
      ctx.moveTo(W / 2 - w, y + w * 0.5)
      ctx.lineTo(W / 2, y)
      ctx.lineTo(W / 2 + w, y + w * 0.5)
      ctx.stroke()
    }
    ctx.globalCompositeOperation = 'source-over'
    const tag = (x: number, y: number, a: string, b: string, c: string) => {
      ctx.fillStyle = 'rgba(8,12,24,0.78)'
      roundRect(ctx, x, y, 170, 58, 16)
      ctx.fill()
      ctx.strokeStyle = c
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.fillStyle = '#fff'
      ctx.font = `700 16px ${FONT}`
      ctx.textAlign = 'left'
      ctx.fillText(a, x + 14, y + 25)
      ctx.fillStyle = c
      ctx.font = `600 14px ${FONT}`
      ctx.fillText(b, x + 14, y + 46)
    }
    tag(30, 150 + Math.sin(t * 1.5) * 4, 'Main Stage', '120 m ▸', '#ff4fd8')
    tag(160, 240 + Math.sin(t * 1.5 + 1) * 4, 'Food Court', '80 m ▸', '#ffc23d')
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(W / 2, 74, 26, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = '#ff5a5a'
    ctx.save()
    ctx.translate(W / 2, 74)
    ctx.rotate(Math.sin(t * 0.5) * 0.6)
    ctx.beginPath()
    ctx.moveTo(0, -18)
    ctx.lineTo(7, 8)
    ctx.lineTo(-7, 8)
    ctx.fill()
    ctx.restore()
    ctx.fillStyle = 'rgba(8,12,24,0.8)'
    roundRect(ctx, 40, 660, W - 80, 54, 27)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'center'
    ctx.font = `700 17px ${FONT}`
    ctx.fillText(`Đi thẳng ${Math.max(5, 40 - Math.floor((t * 2) % 36))} m`, W / 2, 693)
  } else if (i === 3) {
    ctx.fillStyle = '#17110a'
    ctx.fillRect(0, 0, W, H)
    status()
    ctx.fillStyle = '#ffc23d'
    ctx.font = `700 14px ${FONT}`
    ctx.fillText('PULSE POLL · LIVE', 28, 82)
    ctx.fillStyle = '#fff'
    ctx.font = `800 34px ${FONT}`
    ctx.fillText('Bài tiếp theo', 28, 136)
    ctx.fillText('là gì?', 28, 176)
    const p0 = 0.4 + 0.15 * Math.sin(t * 0.5)
    const p1 = 0.3 + 0.1 * Math.sin(t * 0.7 + 1)
    const p2 = Math.max(0.05, 1 - p0 - p1)
    const sum = p0 + p1 + p2
    const opts: [string, number, string][] = [
      ['Neon Drive', p0 / sum, '#ff4fd8'],
      ['Golden Hour', p1 / sum, '#ffc23d'],
      ['Aurora', p2 / sum, '#38d9ff'],
    ]
    opts.forEach(([n, v, c], k) => {
      const y = 220 + k * 130
      ctx.fillStyle = 'rgba(255,255,255,0.07)'
      roundRect(ctx, 28, y, W - 56, 106, 22)
      ctx.fill()
      ctx.fillStyle = c + '55'
      roundRect(ctx, 28, y, Math.max(40, (W - 56) * v), 106, 22)
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.font = `700 22px ${FONT}`
      ctx.textAlign = 'left'
      ctx.fillText(n, 48, y + 48)
      ctx.textAlign = 'right'
      ctx.font = `800 30px ${FONT}`
      ctx.fillStyle = c
      ctx.fillText(`${Math.round(v * 100)}%`, W - 46, y + 66)
    })
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(255,255,255,0.65)'
    ctx.font = `500 15px ${FONT}`
    ctx.fillText(`${(12400 + Math.floor(t * 9)).toLocaleString('en-US')} phiếu · ánh sáng đổi theo kết quả`, W / 2, 650)
  } else {
    ctx.fillStyle = '#0a0a16'
    ctx.fillRect(0, 0, W, H)
    status()
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'left'
    ctx.font = `700 26px ${FONT}`
    ctx.fillText('CueDeck', 28, 82)
    ctx.fillStyle = '#9a6bff'
    ctx.font = `600 17px ${FONT}`
    ctx.textAlign = 'right'
    const s = Math.floor(t)
    ctx.fillText(`01:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}:${String(Math.floor((t % 1) * 24)).padStart(2, '0')}`, W - 28, 80)
    const labels = ['LX 14', 'LX 15', 'VID 7', 'VID 8', 'SFX 2', 'SFX 3', 'PYRO', 'LASER', 'HAZE', 'FOG', 'CAM 1', 'CAM 2', 'FOLLOW', 'MUSIC', 'HOUSE']
    const cols = ['#ff4fd8', '#ff4fd8', '#38d9ff', '#38d9ff', '#ffc23d', '#ffc23d', '#ff3b3b', '#7aff8a', '#bfe6ff', '#bfe6ff', '#9a6bff', '#9a6bff', '#ff7a1f', '#5dffb0', '#fff']
    const act = Math.floor(t * 2.2) % 15
    for (let k = 0; k < 15; k++) {
      const x = 28 + (k % 3) * 104
      const y = 120 + Math.floor(k / 3) * 92
      ctx.fillStyle = k === act ? cols[k] : cols[k] + '33'
      roundRect(ctx, x, y, 96, 82, 16)
      ctx.fill()
      ctx.strokeStyle = cols[k]
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.fillStyle = k === act ? '#000' : '#fff'
      ctx.font = `700 17px ${FONT}`
      ctx.textAlign = 'center'
      ctx.fillText(labels[k], x + 48, y + 50)
    }
    ctx.fillStyle = 'rgba(255,255,255,0.12)'
    roundRect(ctx, 28, 600, W - 56, 10, 5)
    ctx.fill()
    ctx.fillStyle = '#9a6bff'
    roundRect(ctx, 28, 600, (W - 56) * ((t * 0.04) % 1), 10, 5)
    ctx.fill()
    const pulse = 0.6 + 0.4 * Math.sin(t * 4)
    ctx.fillStyle = `rgba(93,255,176,${0.6 + pulse * 0.4})`
    roundRect(ctx, 28, 630, W - 56, 80, 24)
    ctx.fill()
    ctx.fillStyle = '#04120b'
    ctx.font = `800 34px ${FONT}`
    ctx.textAlign = 'center'
    ctx.fillText('GO', W / 2, 683)
  }
}

export function Products() {
  const busRef = useRef<Bus | null>(null)
  const ring = useRef<THREE.Group>(null)
  const holo = useRef<THREE.Mesh>(null)
  const holo2 = useRef<THREE.Mesh>(null)
  const rings = [useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null)]
  const phones = useRef<(THREE.Group | null)[]>([])
  const st = useRef({ sel: 0, ringAngle: 0, lastClick: -100, nextAuto: 7, last: [0, 0, 0, 0, 0], init: false }).current
  const texes = useMemo(() => APPS.map(() => canvasTex(TW, TH, () => {})), [])
  const beam = useMemo(() => beamGeometry(5.4, 0.45, 0.45, 20), [])
  const beamMat = useMemo(() => beamMaterial('#5dffb0', 1.1), [])

  useWorldColliders(ex, [{ type: 'circle', x: 0, z: 0, r: 1.7 }])
  useEffect(() => {
    busRef.current = audio.createBus('products', worldPos(ex, 0, 3.5, 0), { ref: 4, rolloff: 1.4, maxDist: 70, reverb: 0.3, gain: 0.8 })
    APPS.forEach((_, i) => {
      drawApp(texes[i].ctx, i, i * 1.3)
      texes[i].tex.needsUpdate = true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const select = (i: number) => {
    st.sel = i
    st.lastClick = performance.now() / 1000
    toast(`Product Lab · ${APPS[i].name}`)
    if (busRef.current) audio.cubeClick(busRef.current, 1.9)
  }

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    const cam = state.camera.position
    const dx = cam.x - ex.x
    const dz = cam.z - ex.z
    const dist = Math.hypot(dx, dz)
    const now = performance.now() / 1000
    if (now - st.lastClick > 12 && t > st.nextAuto) {
      st.sel = (st.sel + 1) % APPS.length
      st.nextAuto = t + 7
    }
    // xoay vòng sao cho màn hình được chọn hướng về người xem
    const target = Math.atan2(dx, dz) - (st.sel * Math.PI * 2) / APPS.length
    let diff = target - st.ringAngle
    diff = Math.atan2(Math.sin(diff), Math.cos(diff))
    if (!st.init) {
      st.init = true
      st.ringAngle = target
    } else st.ringAngle += diff * (1 - Math.exp(-2.2 * dt))
    if (ring.current) ring.current.rotation.y = st.ringAngle

    phones.current.forEach((g, i) => {
      if (!g) return
      const selected = i === st.sel
      const s = selected ? 1.3 : 0.88
      g.scale.setScalar(g.scale.x + (s - g.scale.x) * (1 - Math.exp(-5 * dt)))
      const y = (selected ? 0.5 : 0) + Math.sin(t * 1.1 + i * 1.7) * 0.12
      g.position.y += (y - g.position.y) * (1 - Math.exp(-5 * dt))
      const interval = selected ? 1 / 22 : 0.6
      if (dist < 90 && isFacing(state.camera, ex.x, ex.z, 20) && t - st.last[i] > interval) {
        st.last[i] = t
        drawApp(texes[i].ctx, i, t)
        texes[i].tex.needsUpdate = true
      }
    })
    if (holo.current) holo.current.rotation.set(t * 0.4, t * 0.6, 0)
    if (holo2.current) holo2.current.rotation.set(-t * 0.7, t * 0.3, t * 0.5)
    rings.forEach((r, i) => {
      if (r.current) r.current.rotation.set(Math.PI / 2 + Math.sin(t * 0.5 + i) * 0.5, t * (0.5 + i * 0.25), i)
    })
  })

  return (
    <group position={[ex.x, 0, ex.z]}>
      <PadRing radius={7.2} color={ex.color} />
      <PadRing radius={5.1} color="#ffffff" y={0.08} tube={0.03} intensity={1.2} />
      <Label title="Product Lab" sub="Digital Products" color={ex.color} position={[0, 8.6, 0]} scale={1.1} />

      <mesh position={[0, 0.3, 0]} material={mats.darkMetal} castShadow receiveShadow>
        <cylinderGeometry args={[1.5, 1.8, 0.6, 40]} />
      </mesh>
      <mesh position={[0, 0.65, 0]} material={mats.lacquer}>
        <cylinderGeometry args={[1.0, 1.35, 0.14, 40]} />
      </mesh>
      <PadRing radius={1.45} color={ex.color} y={0.6} tube={0.04} />
      <mesh position={[0, 0.75, 0]} geometry={beam} material={beamMat} />

      <group position={[0, 3.8, 0]}>
        <mesh ref={holo}>
          <icosahedronGeometry args={[1.15, 1]} />
          <meshBasicMaterial color={new THREE.Color('#5dffb0').multiplyScalar(2.2)} wireframe toneMapped={false} />
        </mesh>
        <mesh ref={holo2}>
          <octahedronGeometry args={[0.55, 0]} />
          <meshBasicMaterial color={new THREE.Color('#5dffb0').multiplyScalar(2)} toneMapped={false} transparent opacity={0.6} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        {rings.map((r, i) => (
          <mesh key={i} ref={r}>
            <torusGeometry args={[1.6 + i * 0.3, 0.015, 8, 100]} />
            <meshBasicMaterial color={new THREE.Color('#9ff').multiplyScalar(2.4)} toneMapped={false} />
          </mesh>
        ))}
        <Sparkles count={70} scale={[3.4, 6, 3.4]} size={4} speed={0.5} color="#5dffb0" position={[0, -1, 0]} />
        <pointLight color="#5dffb0" intensity={60} distance={14} decay={2} />
      </group>

      <group ref={ring} position={[0, 4.0, 0]}>
        {APPS.map((a, i) => {
          const ang = (i / APPS.length) * Math.PI * 2
          return (
            <group key={a.name} position={[Math.sin(ang) * R, 0, Math.cos(ang) * R]} rotation={[0, ang, 0]}>
              <group ref={(r) => { phones.current[i] = r }}>
                <mesh position={[0, 0, -0.012]} geometry={rbox(1.62, 3.26, 0.16, 0.24)}>
                  <meshBasicMaterial color={new THREE.Color(a.color).multiplyScalar(1.7)} toneMapped={false} />
                </mesh>
                <mesh geometry={rbox(1.56, 3.2, 0.18, 0.22)} material={mats.lacquer} castShadow />
                <mesh position={[0, 0, 0.095]}>
                  <planeGeometry args={[1.42, 2.92]} />
                  <meshBasicMaterial map={texes[i].tex} toneMapped={false} />
                </mesh>
                <mesh position={[0, -1.7, 0]} rotation={[0, 0, 0]}>
                  <planeGeometry args={[0.01, 0.01]} />
                  <meshBasicMaterial visible={false} />
                </mesh>
                <Hit id={`product-${i}`} label={`${a.name} · ${a.sub}`} hint="Chọn ứng dụng" maxDist={40} panel="products" size={[1.8, 3.4, 0.6]} position={[0, 0, 0.1]} onClick={() => select(i)} />
              </group>
            </group>
          )
        })}
      </group>
      <Hit id="product-base" label="Product Lab" hint="Xem danh mục sản phẩm" maxDist={30} panel="products" shape="cylinder" size={[1.8, 1.4, 0]} position={[0, 0.7, 0]} />
    </group>
  )
}
