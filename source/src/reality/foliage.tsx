// ORBITA · Botanical System — Cây Phượng Vĩ (*Delonix regia*) với Tán Lá Kép Lông Chim & Chùm Hoa Phượng 3D Thật.
// Tuyệt đối KHÔNG nhuộm đỏ asset lá cây:
//  • Lớp 1: Thân gỗ phân nhánh đệ quy + rễ nổi + PBR vỏ cây,
//  • Lớp 2: Tán lá kép lông chim xanh mượt (crossed leaf cards, alphaTest),
//  • Lớp 3: Chùm hoa phượng 3D thật (4 cánh đỏ cam uốn cong + 1 cánh cờ trắng vàng đốm đỏ + nhị hoa vươn dài + nụ phượng) mọc trên ngọn tán!
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useStore } from '../store'
import { EXHIBITS } from '../layout'
import { patchNew } from './mask'
import { createBarkPBR } from './pbr'

function rnd(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

export interface FlamboyantCanopy {
  x: number
  z: number
  yMin: number
  yMax: number
  radius: number
  weight: number
}

// Danh sách tọa độ tán cây phượng thật trên sân UEH để hoa phượng trong gió rời đúng từ tán cây
export const FLAMBOYANT_CANOPIES: FlamboyantCanopy[] = []

// ------------------------------------------------------------------ 1. Texture lá phượng kép lông chim xanh (CHỈ XANH, KHÔNG ĐỎ)
function makeFernLeafTex() {
  const S = 256
  const c = document.createElement('canvas')
  c.width = S
  c.height = S
  const ctx = c.getContext('2d')!
  ctx.clearRect(0, 0, S, S)
  const r = rnd(44)

  const drawPinna = (ox: number, oy: number, ang: number, len: number) => {
    ctx.save()
    ctx.translate(ox, oy)
    ctx.rotate(ang)
    ctx.strokeStyle = '#3b5722'
    ctx.lineWidth = 2.0
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(0, -len)
    ctx.stroke()

    const sub = 9
    for (let i = 1; i <= sub; i++) {
      const y = -(i / sub) * len
      const span = Math.sin((i / sub) * Math.PI) * len * 0.27 + 4
      for (const side of [-1, 1]) {
        // cuống phụ + các lá chét nhỏ li ti đặc trưng lá phượng
        ctx.strokeStyle = '#476829'
        ctx.lineWidth = 1.0
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(side * span, y - 3)
        ctx.stroke()
        const leaflets = 6
        for (let k = 1; k <= leaflets; k++) {
          const lx = side * (k / leaflets) * span
          const ly = y - (k / leaflets) * 3
          ctx.fillStyle = r() > 0.45 ? '#4c7e2f' : r() > 0.3 ? '#3b6824' : '#65983b'
          ctx.beginPath()
          ctx.ellipse(lx, ly, 2.3, 4.1, side * 0.3, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }
    ctx.restore()
  }

  for (let i = 0; i < 6; i++) {
    const a = (i - 2.5) * 0.44 + (r() - 0.5) * 0.14
    drawPinna(S / 2 + (r() - 0.5) * 16, S * 0.9, a, S * (0.58 + r() * 0.2))
  }

  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

// ------------------------------------------------------------------ 2. Atlas texture riêng cho Cánh Hoa Phượng thật (cánh đỏ cam, cánh cờ trắng-vàng đốm đỏ, nụ hoa)
// Layout 2x2 UV:
//   (0, 0.5)-(0.5, 1.0): Cánh hoa đỏ cam có cuống mảnh & gân nhăn
//   (0.5, 0.5)-(1.0, 1.0): Cánh cờ (standard petal) trắng kem - vàng nhạt có vệt đốm đỏ cam
//   (0, 0)-(0.5, 0.5): Cánh hoa đỏ thẫm rìa cam rực
//   (0.5, 0)-(1.0, 0.5): Nụ hoa & đài hoa xanh ánh đỏ
function makeBlossomAtlasTex() {
  const S = 512
  const H = 256
  const c = document.createElement('canvas')
  c.width = S
  c.height = S
  const ctx = c.getContext('2d')!
  ctx.clearRect(0, 0, S, S)
  const r = rnd(919)

  const drawPetalCell = (cx: number, cy: number, variant: 'scarlet' | 'crimson' | 'banner') => {
    ctx.save()
    ctx.translate(cx, cy)
    // hình thái cánh hoa phượng: cuống mảnh phía dưới (y = +85) phình thành phiến muỗng rìa lượn (y = -85)
    ctx.beginPath()
    ctx.moveTo(0, 92)
    ctx.bezierCurveTo(10, 62, 12, 34, 48, 8)
    ctx.bezierCurveTo(86, -20, 84, -74, 34, -92)
    ctx.bezierCurveTo(12, -99, -12, -99, -34, -92)
    ctx.bezierCurveTo(-84, -74, -86, -20, -48, 8)
    ctx.bezierCurveTo(-12, 34, -10, 62, 0, 92)
    ctx.closePath()

    if (variant === 'banner') {
      const g = ctx.createLinearGradient(0, -96, 0, 90)
      g.addColorStop(0, '#fff7dc')
      g.addColorStop(0.38, '#ffe694')
      g.addColorStop(0.75, '#ff7338')
      g.addColorStop(1, '#d82b18')
      ctx.fillStyle = g
      ctx.fill()
      // các vệt đốm đỏ son đặc trưng trên cánh cờ hoa phượng
      ctx.save()
      ctx.clip()
      for (let i = 0; i < 38; i++) {
        const px = (r() - 0.5) * 110
        const py = -75 + r() * 95
        ctx.fillStyle = r() > 0.35 ? 'rgba(214,36,20,0.82)' : 'rgba(245,92,32,0.75)'
        ctx.beginPath()
        ctx.ellipse(px, py, 3 + r() * 5, 5 + r() * 8, (r() - 0.5) * 0.5, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    } else {
      const g = ctx.createRadialGradient(0, -35, 8, 0, -25, 110)
      if (variant === 'scarlet') {
        g.addColorStop(0, '#ff5c28')
        g.addColorStop(0.55, '#e82d1a')
        g.addColorStop(1, '#b61912')
      } else {
        g.addColorStop(0, '#ff7630')
        g.addColorStop(0.55, '#d62317')
        g.addColorStop(1, '#99140e')
      }
      ctx.fillStyle = g
      ctx.fill()
      // gân cánh mềm
      ctx.save()
      ctx.clip()
      ctx.strokeStyle = 'rgba(255,195,120,0.28)'
      ctx.lineWidth = 1.6
      for (let v = -3; v <= 3; v++) {
        ctx.beginPath()
        ctx.moveTo(0, 88)
        ctx.quadraticCurveTo(v * 14, 10, v * 23, -84)
        ctx.stroke()
      }
      ctx.restore()
    }
    ctx.restore()
  }

  // Ô trên-trái (0..256, 0..256 -> UV y in [0.5, 1.0])
  drawPetalCell(128, 128, 'scarlet')
  // Ô trên-phải: Cánh cờ trắng-vàng đốm đỏ
  drawPetalCell(384, 128, 'banner')
  // Ô dưới-trái: Cánh đỏ thẫm
  drawPetalCell(128, 384, 'crimson')
  // Ô dưới-phải: Nụ hoa & cuống xanh-đỏ
  ctx.save()
  ctx.translate(384, 384)
  const bg = ctx.createRadialGradient(-8, -14, 4, 0, 0, 74)
  bg.addColorStop(0, '#df4824')
  bg.addColorStop(0.55, '#9d2d1d')
  bg.addColorStop(1, '#4f6e29')
  ctx.fillStyle = bg
  ctx.beginPath()
  ctx.ellipse(0, 0, 44, 72, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  void H

  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

function mergeGeos(geos: THREE.BufferGeometry[]) {
  let count = 0
  let idxCount = 0
  geos.forEach((g) => {
    count += g.attributes.position.count
    idxCount += g.index ? g.index.count : g.attributes.position.count
  })
  const pos = new Float32Array(count * 3)
  const norm = new Float32Array(count * 3)
  const uv = new Float32Array(count * 2)
  const idx = new Uint32Array(idxCount)
  let vOff = 0
  let iOff = 0
  geos.forEach((g) => {
    const p = g.attributes.position
    const n = g.attributes.normal
    const u = g.attributes.uv
    pos.set(p.array as Float32Array, vOff * 3)
    if (n) norm.set(n.array as Float32Array, vOff * 3)
    if (u) uv.set(u.array as Float32Array, vOff * 2)
    if (g.index) {
      const gi = g.index.array
      for (let i = 0; i < gi.length; i++) idx[iOff + i] = gi[i] + vOff
      iOff += gi.length
    } else {
      for (let i = 0; i < p.count; i++) idx[iOff + i] = vOff + i
      iOff += p.count
    }
    vOff += p.count
  })
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  out.setAttribute('normal', new THREE.BufferAttribute(norm, 3))
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  out.setIndex(new THREE.BufferAttribute(idx, 1))
  return out
}

// Tạo 1 cánh hoa 3D uốn cong hình muỗng (map UV vào một trong 4 ô của atlas)
function make3DPetalCard(w: number, h: number, uvBox: [number, number, number, number], curveCup = 0.05) {
  const g = new THREE.PlaneGeometry(w, h, 2, 3)
  g.translate(0, h * 0.5, 0)
  const p = g.attributes.position
  const u = g.attributes.uv
  const [u0, v0, u1, v1] = uvBox
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    const y = p.getY(i)
    const ty = y / h
    const nx = x / (w * 0.5)
    // uốn lõm lòng cánh & ngả ra ngoài ở đầu cánh
    const z = Math.sin(ty * Math.PI) * curveCup + nx * nx * 0.018 - ty * ty * 0.03
    p.setZ(i, z)
    u.setXY(i, u0 + u.getX(i) * (u1 - u0), v0 + u.getY(i) * (v1 - v0))
  }
  g.computeVertexNormals()
  return g
}

// Tạo 1 bông hoa phượng 3D hoàn chỉnh: 4 cánh đỏ cam + 1 cánh cờ trắng-vàng đốm đỏ + 6 nhị hoa mảnh vươn dài
function buildSingleFlamboyantFlower(scale = 0.24): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = []
  // 4 cánh đỏ tỏa xung quanh tâm
  const angles = [0.68, 1.95, -0.68, -1.95]
  angles.forEach((a, idx) => {
    const uv: [number, number, number, number] = idx % 2 === 0 ? [0.02, 0.52, 0.48, 0.98] : [0.02, 0.02, 0.48, 0.48]
    const pet = make3DPetalCard(0.82 * scale, 1.0 * scale, uv, 0.08 * scale)
    pet.rotateX(-1.12)
    pet.rotateY(a)
    parts.push(pet)
  })
  // Cánh thứ 5: Cánh cờ dựng đứng, to hơn một chút, UV vào ô trắng-vàng đốm đỏ
  const banner = make3DPetalCard(0.92 * scale, 1.12 * scale, [0.52, 0.52, 0.98, 0.98], 0.07 * scale)
  banner.rotateX(-0.48)
  parts.push(banner)

  // Nhị hoa vươn dài ra phía trước (dùng 2 lát chéo mảnh màu đỏ cam)
  for (let s = 0; s < 3; s++) {
    const st = make3DPetalCard(0.06 * scale, 0.85 * scale, [0.18, 0.55, 0.32, 0.92], 0.05 * scale)
    st.rotateX(1.18 + (s - 1) * 0.14)
    st.rotateY((s - 1) * 0.26)
    parts.push(st)
  }
  return parts
}

// Tạo 1 CỤM HOA PHƯỢNG (Corymb Cluster) gồm 5 bông hoa 3D tỏa tròn + 3 nụ hoa trên cuống!
function buildCorymbClusterGeo() {
  const r = rnd(314)
  const parts: THREE.BufferGeometry[] = []
  const flowerOffsets: [number, number, number, number, number][] = [
    [0, 0.22, 0, -0.15, 0],
    [0.24, 0.14, 0.16, 0.42, 0.7],
    [-0.22, 0.12, 0.18, 0.45, -0.9],
    [0.18, 0.10, -0.22, -0.45, 2.1],
    [-0.20, 0.09, -0.18, -0.42, -2.3],
  ]
  flowerOffsets.forEach(([ox, oy, oz, tilt, yaw], idx) => {
    const fl = buildSingleFlamboyantFlower(0.24 + (idx === 0 ? 0.03 : r() * 0.03))
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(ox, oy, oz),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, yaw, (r() - 0.5) * 0.3)),
      new THREE.Vector3(1, 1, 1),
    )
    fl.forEach((g) => {
      g.applyMatrix4(m)
      parts.push(g)
    })
  })
  // 2 nụ phượng ở rìa cụm
  for (let b = 0; b < 2; b++) {
    const bud = make3DPetalCard(0.11, 0.17, [0.54, 0.04, 0.96, 0.46], 0.02)
    bud.rotateX(0.5)
    bud.rotateY(b * 2.4 + 0.5)
    bud.translate(b === 0 ? 0.16 : -0.16, 0.02, b === 0 ? -0.12 : 0.12)
    parts.push(bud)
  }
  return mergeGeos(parts)
}

function makeCrossedLeafGeo(size = 1.65) {
  const p1 = new THREE.PlaneGeometry(size, size)
  const p2 = new THREE.PlaneGeometry(size, size)
  p2.rotateY(Math.PI * 0.5)
  const p3 = new THREE.PlaneGeometry(size, size)
  p3.rotateX(Math.PI * 0.36)
  return mergeGeos([p1, p2, p3])
}

function makeBranchSegment(a: THREE.Vector3, b: THREE.Vector3, r0: number, r1: number, segs = 7) {
  const dir = new THREE.Vector3().subVectors(b, a)
  const len = dir.length()
  const g = new THREE.CylinderGeometry(r1, r0, len, segs, 1)
  g.translate(0, len * 0.5, 0)
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize())
  const m = new THREE.Matrix4().compose(a, q, new THREE.Vector3(1, 1, 1))
  g.applyMatrix4(m)
  return g
}

interface TreePlan {
  x: number
  z: number
  scale: number
  flamboyant: boolean
  hero?: boolean
  seed: number
}

function buildTreeStructure(plan: TreePlan, leafCardsPerTip: number) {
  const r = rnd(plan.seed)
  const branches: THREE.BufferGeometry[] = []
  const greenMats: { matrix: THREE.Matrix4; color: THREE.Color }[] = []
  const blossomMats: { matrix: THREE.Matrix4; color: THREE.Color }[] = []

  const origin = new THREE.Vector3(plan.x, 0, plan.z)
  const trunkH = (plan.hero ? 5.6 : 3.4 + r() * 1.4) * plan.scale
  const trunkR = (plan.hero ? 0.72 : 0.34 + r() * 0.1) * plan.scale

  const rootEnd = origin.clone().add(new THREE.Vector3((r() - 0.5) * 0.15, trunkH * 0.3, (r() - 0.5) * 0.15))
  branches.push(makeBranchSegment(origin, rootEnd, trunkR * 1.35, trunkR * 0.92, plan.hero ? 10 : 7))

  const trunkTop = rootEnd.clone().add(new THREE.Vector3((r() - 0.5) * 0.35, trunkH * 0.7, (r() - 0.5) * 0.35))
  branches.push(makeBranchSegment(rootEnd, trunkTop, trunkR * 0.92, trunkR * 0.62, plan.hero ? 10 : 7))

  const tmp = new THREE.Object3D()
  const col = new THREE.Color()

  let minY = 999
  let maxY = 0
  let maxRad = 0

  const spawnFoliageAndBlooms = (tip: THREE.Vector3, spread: number, count: number, isTopCrown: boolean) => {
    // 1. Tán lá xanh kép lông chim (nằm ở lớp thân tán)
    for (let i = 0; i < count; i++) {
      const a = r() * Math.PI * 2
      const rad = Math.sqrt(r()) * spread
      const dy = (r() - 0.42) * spread * 0.44
      tmp.position.set(tip.x + Math.cos(a) * rad, tip.y + dy, tip.z + Math.sin(a) * rad)
      tmp.rotation.set((r() - 0.5) * 0.55, r() * Math.PI * 2, (r() - 0.5) * 0.55)
      const s = (plan.hero ? 1.55 : 1.05) * plan.scale * (0.78 + r() * 0.42)
      tmp.scale.set(s, s * (0.72 + r() * 0.22), s)
      tmp.updateMatrix()
      const sunTop = Math.min(1, Math.max(0, (dy + spread * 0.3) / (spread * 0.8)))
      col.set('#3f6b2b').lerp(new THREE.Color('#7ca342'), sunTop * 0.75)
      greenMats.push({ matrix: tmp.matrix.clone(), color: col.clone() })
    }

    // 2. Chùm hoa phượng 3D thật mọc VƯỢT LÊN TRÊN & RÌA NGOÀI tán lá xanh!
    if (plan.flamboyant) {
      const bloomN = Math.max(2, Math.round(count * (isTopCrown ? 1.15 : 0.75)))
      for (let i = 0; i < bloomN; i++) {
        const a = r() * Math.PI * 2
        const rad = (0.35 + 0.65 * Math.sqrt(r())) * spread * 1.04
        const dy = spread * (0.14 + r() * 0.34)
        const px = tip.x + Math.cos(a) * rad
        const py = tip.y + dy
        const pz = tip.z + Math.sin(a) * rad
        tmp.position.set(px, py, pz)
        tmp.rotation.set((r() - 0.5) * 0.35, r() * Math.PI * 2, (r() - 0.5) * 0.35)
        const s = (plan.hero ? 1.5 : 1.15) * plan.scale * (0.85 + r() * 0.35)
        tmp.scale.setScalar(s)
        tmp.updateMatrix()
        col.set('#ffffff').lerp(new THREE.Color('#ffe0c2'), r() * 0.25)
        blossomMats.push({ matrix: tmp.matrix.clone(), color: col.clone() })
        minY = Math.min(minY, py)
        maxY = Math.max(maxY, py)
        maxRad = Math.max(maxRad, Math.hypot(px - plan.x, pz - plan.z))
      }
    }
  }

  const nMain = plan.hero ? 6 : 4
  for (let i = 0; i < nMain; i++) {
    const a = (i / nMain) * Math.PI * 2 + (r() - 0.5) * 0.42
    const reach = (plan.hero ? 5.8 : 2.8 + r() * 1.1) * plan.scale
    const rise = (plan.hero ? 3.8 : 2.2 + r() * 0.9) * plan.scale
    const p1 = trunkTop.clone().add(new THREE.Vector3(Math.cos(a) * reach * 0.58, rise * 0.55, Math.sin(a) * reach * 0.58))
    const p2 = trunkTop.clone().add(new THREE.Vector3(Math.cos(a) * reach, rise, Math.sin(a) * reach))
    branches.push(makeBranchSegment(trunkTop, p1, trunkR * 0.46, trunkR * 0.3, 6))
    branches.push(makeBranchSegment(p1, p2, trunkR * 0.3, trunkR * 0.16, 5))

    const nSub = plan.hero ? 4 : 2
    for (let j = 0; j < nSub; j++) {
      const sa = a + (j - (nSub - 1) * 0.5) * 0.65 + (r() - 0.5) * 0.25
      const sr = (plan.hero ? 3.4 : 1.7) * plan.scale
      const sy = (plan.hero ? 1.7 : 1.05) * plan.scale
      const subEnd = p2.clone().add(new THREE.Vector3(Math.cos(sa) * sr, sy, Math.sin(sa) * sr))
      branches.push(makeBranchSegment(p2, subEnd, trunkR * 0.15, trunkR * 0.06, 5))
      spawnFoliageAndBlooms(subEnd, (plan.hero ? 3.1 : 1.85) * plan.scale, leafCardsPerTip, false)
    }
    spawnFoliageAndBlooms(p2, (plan.hero ? 2.7 : 1.65) * plan.scale, Math.round(leafCardsPerTip * 0.7), false)
  }
  spawnFoliageAndBlooms(trunkTop.clone().add(new THREE.Vector3(0, (plan.hero ? 4.7 : 2.7) * plan.scale, 0)), (plan.hero ? 4.8 : 2.2) * plan.scale, leafCardsPerTip * 2, true)

  if (plan.flamboyant && maxRad > 0) {
    FLAMBOYANT_CANOPIES.push({
      x: plan.x,
      z: plan.z,
      yMin: minY,
      yMax: maxY,
      radius: maxRad,
      weight: plan.hero ? 3.2 : 1.0,
    })
  }

  return { branches, greenMats, blossomMats }
}

// ------------------------------------------------------------------ Toàn bộ cây sân trường UEH + hoa phượng 3D thật + cỏ
export function UEHFoliage() {
  const low = useStore((s) => s.quality) === 'low'

  const { trunkGeo, greenLeaves, blossomClusters } = useMemo(() => {
    FLAMBOYANT_CANOPIES.length = 0
    const r = rnd(1976)
    const plans: TreePlan[] = [
      // Cây Phượng Cổ Thụ tâm sân
      { x: 0, z: 0, scale: 1.0, flamboyant: true, hero: true, seed: 1976 },
    ]
    const placed: [number, number][] = [[0, 0]]
    const ok = (x: number, z: number) => {
      if (Math.hypot(x, z) > 56 || Math.hypot(x, z) < 11) return false
      if (Object.values(EXHIBITS).some((e) => Math.hypot(e.x - x, e.z - z) < 12.5)) return false
      return placed.every(([px, pz]) => Math.hypot(px - x, pz - z) > 9.5)
    }
    const nEdge = low ? 16 : 24
    for (let i = 0; i < nEdge; i++) {
      const a = (i / nEdge) * Math.PI * 2 + r() * 0.1
      const rad = 52.5 + r() * 2.5
      const x = Math.cos(a) * rad
      const z = Math.sin(a) * rad
      if (Object.values(EXHIBITS).some((e) => Math.hypot(e.x - x, e.z - z) < 11)) continue
      placed.push([x, z])
      plans.push({ x, z, scale: 0.9 + r() * 0.38, flamboyant: r() > 0.52, seed: 300 + i * 17 })
    }
    const nInner = low ? 7 : 12
    for (let i = 0; i < nInner; i++) {
      for (let t = 0; t < 40; t++) {
        const a = r() * Math.PI * 2
        const rad = 16 + r() * 28
        const x = Math.cos(a) * rad
        const z = Math.sin(a) * rad
        if (ok(x, z)) {
          placed.push([x, z])
          plans.push({ x, z, scale: 0.8 + r() * 0.35, flamboyant: r() > 0.42, seed: 700 + i * 29 })
          break
        }
      }
    }

    const allBranches: THREE.BufferGeometry[] = []
    const greens: { matrix: THREE.Matrix4; color: THREE.Color }[] = []
    const blossoms: { matrix: THREE.Matrix4; color: THREE.Color }[] = []
    const tipCount = low ? 5 : 8

    plans.forEach((p) => {
      const built = buildTreeStructure(p, p.hero ? (low ? 10 : 16) : tipCount)
      allBranches.push(...built.branches)
      greens.push(...built.greenMats)
      blossoms.push(...built.blossomMats)
    })

    return {
      trunkGeo: mergeGeos(allBranches),
      greenLeaves: greens,
      blossomClusters: blossoms,
    }
  }, [low])

  const barkMat = useMemo(() => {
    const pbr = createBarkPBR(2, 4)
    return patchNew(
      new THREE.MeshStandardMaterial({
        map: pbr.map,
        bumpMap: pbr.bumpMap,
        bumpScale: 0.08,
        roughnessMap: pbr.roughnessMap,
        roughness: 0.94,
        metalness: 0.0,
      }),
      { grow: true, growLen: 18, wet: true },
    )
  }, [])

  const cardGeo = useMemo(() => makeCrossedLeafGeo(1.72), [])
  const corymbGeo = useMemo(() => buildCorymbClusterGeo(), [])

  const greenMat = useMemo(() => {
    const tex = makeFernLeafTex()
    return patchNew(
      new THREE.MeshStandardMaterial({
        map: tex,
        alphaTest: 0.44,
        side: THREE.DoubleSide,
        roughness: 0.7,
        metalness: 0.0,
        emissive: new THREE.Color('#2d4214'),
        emissiveIntensity: 0.14,
      }),
      { grow: true, growLen: 22, wind: 0.08, wet: true },
    )
  }, [])

  const blossomMat = useMemo(() => {
    const tex = makeBlossomAtlasTex()
    return patchNew(
      new THREE.MeshStandardMaterial({
        map: tex,
        alphaTest: 0.42,
        side: THREE.DoubleSide,
        roughness: 0.5,
        metalness: 0.0,
        emissive: new THREE.Color('#cf3418'),
        emissiveIntensity: 0.28,
      }),
      { grow: true, growLen: 22, wind: 0.1 },
    )
  }, [])

  const greenRef = useRef<THREE.InstancedMesh>(null)
  const blossomRef = useRef<THREE.InstancedMesh>(null)

  useEffect(() => {
    if (greenRef.current) {
      greenLeaves.forEach((l, i) => {
        greenRef.current!.setMatrixAt(i, l.matrix)
        greenRef.current!.setColorAt(i, l.color)
      })
      greenRef.current.instanceMatrix.needsUpdate = true
      if (greenRef.current.instanceColor) greenRef.current.instanceColor.needsUpdate = true
    }
    if (blossomRef.current) {
      blossomClusters.forEach((b, i) => {
        blossomRef.current!.setMatrixAt(i, b.matrix)
        blossomRef.current!.setColorAt(i, b.color)
      })
      blossomRef.current.instanceMatrix.needsUpdate = true
      if (blossomRef.current.instanceColor) blossomRef.current.instanceColor.needsUpdate = true
    }
  }, [greenLeaves, blossomClusters])

  return (
    <group>
      <mesh geometry={trunkGeo} material={barkMat} castShadow receiveShadow />
      <instancedMesh ref={greenRef} args={[cardGeo, greenMat, greenLeaves.length]} frustumCulled={false} castShadow />
      <instancedMesh ref={blossomRef} args={[corymbGeo, blossomMat, blossomClusters.length]} frustumCulled={false} />
      <CourtyardGrass low={low} />
    </group>
  )
}

// ------------------------------------------------------------------ Thảm cỏ thật trong các ô vườn sân trường
function onWalkway(x: number, z: number) {
  const r0 = Math.hypot(x, z)
  if (r0 < 9.9) return true
  for (const e of Object.values(EXHIBITS)) {
    if (e.id === 'orb') continue
    const L = Math.hypot(e.x, e.z)
    const t = Math.max(0, Math.min(1, (x * e.x + z * e.z) / (L * L)))
    const d = Math.hypot(x - e.x * t, z - e.z * t)
    if (d < 2.25 || Math.hypot(x - e.x, z - e.z) < 8.1) return true
  }
  return false
}

function CourtyardGrass({ low }: { low: boolean }) {
  const N = low ? 2200 : 4200
  const mesh = useRef<THREE.InstancedMesh>(null)
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(0.052, 0.26, 1, 2)
    g.translate(0, 0.13, 0)
    const p = g.attributes.position
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i)
      const k = y / 0.26
      p.setX(i, p.getX(i) * (1 - k * 0.85))
      p.setZ(i, k * k * 0.05)
    }
    g.computeVertexNormals()
    return g
  }, [])
  const mat = useMemo(
    () =>
      patchNew(
        new THREE.MeshStandardMaterial({
          color: '#ffffff',
          roughness: 0.75,
          side: THREE.DoubleSide,
        }),
        { grow: true, growLen: 6, wind: 0.08, wet: true },
      ),
    [],
  )
  useEffect(() => {
    const im = mesh.current
    if (!im) return
    const r = rnd(404)
    const dummy = new THREE.Object3D()
    const c = new THREE.Color()
    const beds = [
      { x: -10, z: 22, rx: 11, rz: 6.5, rot: 0.2 },
      { x: 13, z: 19, rx: 9.5, rz: 6.5, rot: -0.3 },
      { x: -15, z: -14, rx: 10.5, rz: 5.5, rot: 0.45 },
      { x: 15, z: -13, rx: 10, rz: 6, rot: -0.45 },
    ]
    for (let i = 0; i < N; i++) {
      const b = beds[i % beds.length]
      let wx = 0
      let wz = 0
      let placed = false
      for (let t = 0; t < 16; t++) {
        const a = r() * Math.PI * 2
        const rad = Math.sqrt(r())
        const lx = Math.cos(a) * rad * b.rx
        const lz = Math.sin(a) * rad * b.rz
        const cr = Math.cos(b.rot)
        const sr = Math.sin(b.rot)
        wx = b.x + lx * cr - lz * sr
        wz = b.z + lx * sr + lz * cr
        if (!onWalkway(wx, wz)) {
          placed = true
          break
        }
      }
      if (!placed) {
        dummy.position.set(0, -10, 0)
        dummy.scale.setScalar(0)
      } else {
        dummy.position.set(wx, 0.05, wz)
        dummy.rotation.set((r() - 0.5) * 0.25, r() * Math.PI * 2, (r() - 0.5) * 0.2)
        dummy.scale.set(0.75 + r() * 0.6, 0.7 + r() * 0.85, 1)
      }
      dummy.updateMatrix()
      im.setMatrixAt(i, dummy.matrix)
      c.set('#46742e').lerp(new THREE.Color('#729a3e'), r() * 0.75)
      im.setColorAt(i, c)
    }
    im.instanceMatrix.needsUpdate = true
    if (im.instanceColor) im.instanceColor.needsUpdate = true
  }, [N])
  return <instancedMesh ref={mesh} args={[geo, mat, N]} frustumCulled={false} />
}
