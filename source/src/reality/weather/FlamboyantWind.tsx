// ORBITA · Hoa Phượng Trong Gió ("Nếu ngày mai")
// Mô phỏng cánh hoa phượng & bông hoa 5 cánh rời trực tiếp từ tán cây phượng UEH,
// trôi theo dòng gió xoáy trên sân trường, chao lượn khí động học, đáp xuống sân gạch & quanh đàn piano,
// rồi được các đợt gió chiều cuốn bay trở lại không trung.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { EXHIBITS } from '../../layout'
import { useStore } from '../../store'
import { FLAMBOYANT_CANOPIES } from '../foliage'
import { patchNew, RW } from '../mask'
import { music } from '../music'
import { rt } from '../state'

const E = EXHIBITS

function rnd(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

// ------------------------------------------------------------------ 1. Texture cánh hoa rời sắc nét (đỏ son / đỏ cam / cánh cờ đốm trắng vàng)
function makeSinglePetalTex() {
  const S = 256
  const c = document.createElement('canvas')
  c.width = S
  c.height = S
  const ctx = c.getContext('2d')!
  ctx.clearRect(0, 0, S, S)

  // cuống mảnh ở dưới (y = 236) -> phiến muỗng rộng rìa lượn (y = 22)
  ctx.save()
  ctx.translate(S / 2, S / 2)
  ctx.beginPath()
  ctx.moveTo(0, 108)
  ctx.bezierCurveTo(10, 74, 14, 38, 56, 8)
  ctx.bezierCurveTo(96, -22, 90, -84, 36, -104)
  ctx.bezierCurveTo(14, -112, -14, -112, -36, -104)
  ctx.bezierCurveTo(-90, -84, -96, -22, -56, 8)
  ctx.bezierCurveTo(-14, 38, -10, 74, 0, 108)
  ctx.closePath()

  const g = ctx.createRadialGradient(0, -34, 8, 0, -24, 128)
  g.addColorStop(0, '#ff7846')
  g.addColorStop(0.5, '#f23a22')
  g.addColorStop(1, '#c41e18')
  ctx.fillStyle = g
  ctx.fill()

  ctx.clip()
  ctx.strokeStyle = 'rgba(255,215,165,0.28)'
  ctx.lineWidth = 1.8
  for (let v = -3; v <= 3; v++) {
    ctx.beginPath()
    ctx.moveTo(0, 102)
    ctx.quadraticCurveTo(v * 16, 12, v * 25, -96)
    ctx.stroke()
  }
  ctx.restore()

  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

// Hình khối 3D cánh hoa đơn uốn cong (khum lòng muỗng + đầu cánh hơi vểnh)
function make3DSinglePetalGeo() {
  const g = new THREE.PlaneGeometry(0.145, 0.185, 3, 4)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    const y = p.getY(i)
    const nx = x / 0.0725
    const ny = y / 0.0925
    const camber = (1 - nx * nx) * 0.022 - ny * ny * 0.016 + Math.sin(ny * 3.14) * 0.01
    p.setZ(i, camber)
  }
  g.computeVertexNormals()
  return g
}

// Hình khối 3D bông hoa phượng 5 cánh nguyên vẹn (xoay tít như chong chóng khi rơi)
function makeWholeBlossomGeo() {
  const geos: THREE.BufferGeometry[] = []
  for (let k = 0; k < 5; k++) {
    const pg = make3DSinglePetalGeo()
    pg.translate(0, 0.082, 0)
    pg.rotateX(-1.08)
    pg.rotateY((k / 5) * Math.PI * 2)
    geos.push(pg)
  }
  let vCount = 0
  let iCount = 0
  geos.forEach((g) => {
    vCount += g.attributes.position.count
    iCount += g.index ? g.index.count : g.attributes.position.count
  })
  const pos = new Float32Array(vCount * 3)
  const norm = new Float32Array(vCount * 3)
  const uv = new Float32Array(vCount * 2)
  const idx = new Uint32Array(iCount)
  let vo = 0
  let io = 0
  geos.forEach((g) => {
    pos.set(g.attributes.position.array as Float32Array, vo * 3)
    norm.set(g.attributes.normal.array as Float32Array, vo * 3)
    uv.set(g.attributes.uv.array as Float32Array, vo * 2)
    const gi = g.index!.array
    for (let i = 0; i < gi.length; i++) idx[io + i] = gi[i] + vo
    io += gi.length
    vo += g.attributes.position.count
  })
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  out.setAttribute('normal', new THREE.BufferAttribute(norm, 3))
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  out.setIndex(new THREE.BufferAttribute(idx, 1))
  return out
}

interface PetalParticle {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  rx: number
  ry: number
  rz: number
  phase: number
  scale: number
  flutter: number
  mass: number
  state: 'air' | 'rest'
  restTimer: number
  lifeFade: number
  whole: boolean
}

function insideBuildingFootprint(x: number, z: number) {
  // tránh cánh hoa xuyên vào bên trong khối đặc của tòa B1, B2, Cơ sở A, Thư viện
  if (Math.abs(x - E.robot.x) < 9.5 && Math.abs(z - E.robot.z) < 5.6) return true
  if (Math.abs(x - (E.robot.x - 27.5)) < 10.2 && Math.abs(z - E.robot.z) < 5.2) return true
  if (Math.hypot(x - E.cinema.x, z - E.cinema.z) < 9.5) return true
  if (Math.hypot(x - E.rubik.x, z - E.rubik.z) < 5.4) return true
  return false
}

export function FlamboyantWind() {
  const low = useStore((s) => s.quality) !== 'high'
  const N_PETALS = low ? 1150 : 1900
  const N_WHOLE = low ? 190 : 320
  const TOTAL = N_PETALS + N_WHOLE

  const petalMesh = useRef<THREE.InstancedMesh>(null)
  const wholeMesh = useRef<THREE.InstancedMesh>(null)

  const petalGeo = useMemo(() => make3DSinglePetalGeo(), [])
  const wholeGeo = useMemo(() => makeWholeBlossomGeo(), [])

  const mat = useMemo(() => {
    const tex = makeSinglePetalTex()
    return patchNew(
      new THREE.MeshStandardMaterial({
        map: tex,
        alphaTest: 0.35,
        side: THREE.DoubleSide,
        roughness: 0.46,
        metalness: 0.0,
        emissive: new THREE.Color('#d93616'),
        emissiveIntensity: 0.48,
      }),
      { grow: false, ao: false },
    )
  }, [])

  const sim = useMemo(() => {
    const r = rnd(2026)
    const arr: PetalParticle[] = []
    for (let i = 0; i < TOTAL; i++) {
      arr.push({
        x: 0,
        y: -10,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        rx: r() * 6.28,
        ry: r() * 6.28,
        rz: r() * 6.28,
        phase: r() * 100,
        scale: 0.85 + r() * 0.55,
        flutter: 2.8 + r() * 2.4,
        mass: 0.72 + r() * 0.52,
        state: 'air',
        restTimer: 0,
        lifeFade: 0,
        whole: i >= N_PETALS,
      })
    }
    return { arr, seeded: false, r }
  }, [TOTAL, N_PETALS])

  const pickCanopyPoint = () => {
    const r = sim.r
    const list = FLAMBOYANT_CANOPIES
    if (!list.length) return { x: (r() - 0.5) * 40, y: 7 + r() * 6, z: (r() - 0.5) * 40 }
    // ưu tiên lấy theo trọng số (cây phượng cổ thụ trung tâm + các cây gần khu đàn/sân giữa)
    let totalW = 0
    for (let i = 0; i < list.length; i++) totalW += list[i].weight
    let pick = r() * totalW
    let chosen = list[0]
    for (let i = 0; i < list.length; i++) {
      pick -= list[i].weight
      if (pick <= 0) {
        chosen = list[i]
        break
      }
    }
    const a = r() * Math.PI * 2
    const rad = (0.3 + 0.7 * Math.sqrt(r())) * chosen.radius
    return {
      x: chosen.x + Math.cos(a) * rad,
      y: chosen.yMin + r() * Math.max(0.8, chosen.yMax - chosen.yMin),
      z: chosen.z + Math.sin(a) * rad,
    }
  }

  const spawnPetal = (p: PetalParticle, scatterInitial = false) => {
    const r = sim.r
    const c = pickCanopyPoint()
    // rải cánh hoa dọc luồng gió từ tán cây qua sân giữa & khu đàn Piano
    const driftAlong = scatterInitial ? r() * 28 : r() * 3.5
    const windAng = 2.42 + (r() - 0.5) * 0.65
    p.x = c.x + Math.cos(windAng) * driftAlong + (r() - 0.5) * 3.0
    p.z = c.z + Math.sin(windAng) * driftAlong + (r() - 0.5) * 3.0
    if (Math.hypot(p.x, p.z) > 57) {
      p.x = c.x
      p.z = c.z
    }
    p.y = scatterInitial ? 0.45 + r() * (c.y - 0.45) : c.y
    p.vx = (r() - 0.5) * 0.8 + Math.cos(windAng) * 1.4
    p.vy = -0.25 - r() * 0.35
    p.vz = (r() - 0.5) * 0.8 + Math.sin(windAng) * 1.4
    p.rx = r() * Math.PI * 2
    p.ry = r() * Math.PI * 2
    p.rz = r() * Math.PI * 2
    p.state = scatterInitial && r() > 0.66 ? 'rest' : 'air'
    if (p.state === 'rest') {
      p.y = 0.048 + r() * 0.014
      p.rx = -Math.PI * 0.5 + (r() - 0.5) * 0.14
      p.rz = (r() - 0.5) * 0.14
      p.restTimer = 4 + r() * 12
    }
    p.lifeFade = 0
  }

  useEffect(() => {
    const r = sim.r
    const col = new THREE.Color()
    const applyColors = (im: THREE.InstancedMesh | null, count: number, offset: number) => {
      if (!im) return
      for (let i = 0; i < count; i++) {
        const k = r()
        if (offset === 0 && k > 0.89) {
          // ~11% cánh cờ kem-vàng-cam rơi lẫn trong thảm đỏ
          col.set('#ffe2a8').lerp(new THREE.Color('#ff8a4c'), r() * 0.55)
        } else if (k > 0.52) {
          col.set('#ff5c2e').lerp(new THREE.Color('#ff8542'), r() * 0.5)
        } else {
          col.set('#e82e1e').lerp(new THREE.Color('#ff4928'), r() * 0.65)
        }
        im.setColorAt(i, col)
      }
      if (im.instanceColor) im.instanceColor.needsUpdate = true
    }
    applyColors(petalMesh.current, N_PETALS, 0)
    applyColors(wholeMesh.current, N_WHOLE, N_PETALS)
  }, [N_PETALS, N_WHOLE, sim])

  const dummy = useMemo(() => new THREE.Object3D(), [])

  useFrame((state, rawDt) => {
    const pm = petalMesh.current
    const wm = wholeMesh.current
    if (!pm || !wm) return

    const active = rt.blossom > 0.01
    const show = active || RW.uRW.value.z < 0.5
    pm.visible = show
    wm.visible = show
    if (!active) {
      // reset hạt khi tắt hoàn toàn để lần sau mở ra mọc mới từ tán cây
      if (sim.seeded) {
        for (let i = 0; i < TOTAL; i++) sim.arr[i].lifeFade = 0
        sim.seeded = false
      }
      return
    }

    if (!sim.seeded) {
      for (let i = 0; i < TOTAL; i++) spawnPetal(sim.arr[i], true)
      sim.seeded = true
    }

    const dt = Math.min(rawDt, 0.05)
    const t = state.clock.elapsedTime
    const cam = state.camera.position
    const intensity = rt.blossom

    // hướng gió chủ đạo uyển chuyển (Đông Bắc -> Tây Nam xuyên qua cây phượng giữa sân về phía Grand Piano)
    const baseAngle = 2.42 + Math.sin(t * 0.13) * 0.36
    const windBaseX = Math.cos(baseAngle) * (2.0 + music.energy * 1.1)
    const windBaseZ = Math.sin(baseAngle) * (2.0 + music.energy * 1.1)

    let pi = 0
    let wi = 0

    for (let i = 0; i < TOTAL; i++) {
      const p = sim.arr[i]
      // kích hoạt dần số lượng cánh hoa theo intensity (0..1)
      const slot = i / TOTAL
      const wantOn = intensity > slot * 0.92
      p.lifeFade += ((wantOn ? 1 : 0) - p.lifeFade) * Math.min(1, dt * (wantOn ? 2.4 : 3.2))

      if (p.lifeFade < 0.01) {
        dummy.position.set(0, -50, 0)
        dummy.scale.setScalar(0)
        dummy.updateMatrix()
        if (p.whole) wm.setMatrixAt(wi++, dummy.matrix)
        else pm.setMatrixAt(pi++, dummy.matrix)
        continue
      }

      // sóng gió di chuyển ngang sân trường
      const gustWave = Math.max(0, Math.sin(p.x * 0.075 + p.z * 0.055 - t * 0.85))
      const gustStr = gustWave * gustWave * (1.8 + music.energy * 1.4)

      if (p.state === 'rest') {
        p.restTimer -= dt
        // thỉnh thoảng đợt gió mạnh cuốn cánh hoa nằm trên sân bay bổng trở lại!
        if (gustStr > 1.35 && Math.sin(p.phase + t * 2.1) > 0.65) {
          p.state = 'air'
          p.vy = 0.8 + gustStr * 0.55
          p.vx += windBaseX * 0.6
          p.vz += windBaseZ * 0.6
        } else if (p.restTimer <= 0 || insideBuildingFootprint(p.x, p.z)) {
          spawnPetal(p, false)
        }
      } else {
        // Trường xoáy gió 3D tự nhiên + dòng chảy quanh người chơi
        const swirl = Math.sin(p.x * 0.14 - t * 0.7 + p.phase * 0.05)
        const swirl2 = Math.cos(p.z * 0.13 + t * 0.62 - p.phase * 0.03)
        const wx = windBaseX + swirl * 1.15 + windBaseX * gustStr * 0.45
        const wz = windBaseZ + swirl2 * 1.15 + windBaseZ * gustStr * 0.45
        const wy = -0.68 * p.mass + Math.sin(t * 1.4 + p.phase) * 0.24 + gustStr * 0.22

        // Tương tác nhẹ khi gió cuốn cánh hoa lướt ngang người chơi
        const dxC = p.x - cam.x
        const dzC = p.z - cam.z
        const distC = Math.hypot(dxC, dzC)
        let wakeX = 0
        let wakeZ = 0
        let wakeY = 0
        if (distC < 3.2 && distC > 0.1) {
          const push = (1 - distC / 3.2) * 1.6
          wakeX = (dxC / distC) * push
          wakeZ = (dzC / distC) * push
          wakeY = push * 0.35
        }

        const drag = 1 - Math.exp(-dt * 2.2)
        p.vx += (wx + wakeX - p.vx) * drag
        p.vy += (wy + wakeY - p.vy) * drag
        p.vz += (wz + wakeZ - p.vz) * drag

        p.x += p.vx * dt
        p.y += p.vy * dt
        p.z += p.vz * dt

        // chao lượn khí động học: nghiêng theo hướng lướt + rung cánh mỏng
        if (p.whole) {
          p.ry += dt * (4.2 + gustStr * 2.0)
          p.rx = Math.sin(t * 2.4 + p.phase) * 0.45
          p.rz = Math.cos(t * 2.1 + p.phase) * 0.45
        } else {
          const fl = Math.sin(t * p.flutter + p.phase)
          p.rx = -0.35 + fl * 0.68
          p.ry += dt * (1.2 + Math.cos(t * 1.8 + p.phase) * 1.1)
          p.rz = Math.cos(t * p.flutter * 0.8 + p.phase) * 0.58
        }

        // chạm đất sân trường -> đáp xuống nghỉ nhẹ
        if (p.y <= 0.052) {
          if (Math.hypot(p.x, p.z) > 58.2 || insideBuildingFootprint(p.x, p.z)) {
            spawnPetal(p, false)
          } else {
            p.y = 0.048 + (i % 7) * 0.0025
            p.state = 'rest'
            p.restTimer = 6 + (i % 10) * 1.1
            p.rx = -Math.PI * 0.5 + Math.sin(p.phase) * 0.08
            p.rz = Math.cos(p.phase) * 0.08
          }
        }
        // bay ra ngoài mép đĩa -> quay lại rụng từ tán cây
        if (Math.hypot(p.x, p.z) > 62) {
          spawnPetal(p, false)
        }
      }

      dummy.position.set(p.x, p.y, p.z)
      dummy.rotation.set(p.rx, p.ry, p.rz)
      const s = p.scale * p.lifeFade
      dummy.scale.setScalar(s)
      dummy.updateMatrix()
      if (p.whole) wm.setMatrixAt(wi++, dummy.matrix)
      else pm.setMatrixAt(pi++, dummy.matrix)
    }

    pm.instanceMatrix.needsUpdate = true
    wm.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      <instancedMesh ref={petalMesh} args={[petalGeo, mat, N_PETALS]} frustumCulled={false} renderOrder={8} />
      <instancedMesh ref={wholeMesh} args={[wholeGeo, mat, N_WHOLE]} frustumCulled={false} renderOrder={8} />
    </group>
  )
}
