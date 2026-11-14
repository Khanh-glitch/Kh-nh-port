// Signal Beacon — hình học cơ khí.
//
// Tháp là LƯỚI HYPERBOLOID (Shukhov, 1896 – tháp Shabolovka, Canton Tower, Kobe Port Tower):
// 2 họ thanh THẲNG xoắn ngược chiều cùng sinh ra một mặt cong kép.  Mọi thanh là đoạn
// thẳng giữa hai nút, các vòng nén đặt đúng tại mức hai họ cắt nhau (φ(s) = m·Δ/2)
// nên mỗi nút vòng là giao điểm thật của hai thanh — không có chi tiết "dán" tự do.
import * as THREE from 'three'
import { TAU, annulus, latheHard, latheSmooth, merge, placed, plate, slotPath, strut, v3 } from '../kit/geo'

export const N = 18
export const RB = 3.0
export const RT = 1.55
export const Y0 = 0.95
export const Y1 = 25.5
export const TWIST = 1.7
export const MAST_TOP = 8.6 // chiều cao cột đỡ phía trên headframe (so với Y1)
export const PIVOT_Y = Y1 + MAST_TOP + 1.55 // trục elevation của chảo chính

export const yAt = (s: number) => Y0 + s * (Y1 - Y0)
export const rcAt = (y: number) => 0.62 - 0.32 * ((y - Y0) / (Y1 - Y0)) // bán kính lõi

/** Điểm trên thanh thứ i, họ fam (+1/−1), tham số s∈[0,1]: nội suy thẳng giữa hai đầu. */
export function P(i: number, fam: number, s: number) {
  const a0 = (i / N) * TAU
  const a1 = a0 + fam * TWIST
  return v3(
    (1 - s) * RB * Math.cos(a0) + s * RT * Math.cos(a1),
    yAt(s),
    (1 - s) * RB * Math.sin(a0) + s * RT * Math.sin(a1),
  )
}

/** Mức s_m nơi hai họ thanh cắt nhau: φ(s_m) = m·(TAU/N)/2 */
const LEVELS_X = (() => {
  const out: number[] = []
  const D = TAU / N
  for (let m = 0; m <= 9; m++) {
    const phi = (m * D) / 2
    if (m === 0) { out.push(0); continue }
    const t = Math.tan(Math.min(phi, Math.PI / 2 - 1e-6))
    out.push((t * RB) / (RT * Math.sin(TWIST) + t * (RB - RT * Math.cos(TWIST))))
  }
  return out
})()
export const CROSS = LEVELS_X
export const LEVELS = [...LEVELS_X, 1]
const rod = (s: number) => 0.088 - 0.046 * s

export function buildTower() {
  const members: THREE.BufferGeometry[] = []
  for (let i = 0; i < N; i++)
    for (const fam of [1, -1])
      for (let k = 0; k < LEVELS.length - 1; k++) members.push(strut(P(i, fam, LEVELS[k]), P(i, fam, LEVELS[k + 1]), rod(LEVELS[k]), rod(LEVELS[k + 1]), 6))

  const ringsA: THREE.BufferGeometry[] = []
  const ringsB: THREE.BufferGeometry[] = []
  const nodes: THREE.BufferGeometry[] = []
  const nodeG = new THREE.SphereGeometry(1, 8, 6)
  for (let m = 1; m <= 9; m++) {
    const s = CROSS[m]
    const target = m % 2 === 0 ? ringsA : ringsB
    const r = m % 2 === 0 ? 0.06 : 0.036
    for (let i = 0; i < N; i++) {
      const a = P(i, 1, s)
      const b = P((i + 1) % N, 1, s)
      target.push(strut(a, b, r, r, 6))
      nodes.push(placed(nodeG, [a.x, a.y, a.z], [0, 0, 0], r * 1.9))
    }
  }
  // vòng đỉnh: 36 đầu thanh của hai họ nằm xen kẽ trên cùng một đường tròn
  const top: THREE.Vector3[] = []
  for (let i = 0; i < N; i++) top.push(P(i, 1, 1), P(i, -1, 1))
  top.sort((a, b) => Math.atan2(a.z, a.x) - Math.atan2(b.z, b.x))
  for (let i = 0; i < top.length; i++) {
    const a = top[i]
    const b = top[(i + 1) % top.length]
    ringsA.push(strut(a, b, 0.07, 0.07, 6))
    nodes.push(placed(nodeG, [a.x, a.y, a.z], [0, 0, 0], 0.12))
  }

  // ---- lõi trung tâm: thân đa giác thuôn + mặt bích + nan hoa nối vào các vòng
  const core: THREE.BufferGeometry[] = []
  const shaft = new THREE.CylinderGeometry(rcAt(Y1), rcAt(Y0), Y1 - Y0, 10, 1).toNonIndexed()
  shaft.computeVertexNormals()
  shaft.translate(0, (Y0 + Y1) / 2, 0)
  core.push(shaft)
  for (let k = 0; k <= 7; k++) {
    const y = yAt(k / 7)
    const r = rcAt(y) + 0.1
    core.push(placed(latheHard([[r - 0.1, -0.07], [r, -0.05], [r, 0.05], [r - 0.1, 0.07]], 10), [0, y, 0]))
  }
  const spokes: THREE.BufferGeometry[] = []
  for (const m of [2, 4, 6, 8]) {
    const s = CROSS[m]
    const y = yAt(s)
    for (let j = 0; j < 6; j++) {
      const n = P(j * 3, 1, s)
      spokes.push(strut(v3(Math.cos(n.x * 0 + Math.atan2(n.z, n.x)) * (rcAt(y) + 0.1), y, Math.sin(Math.atan2(n.z, n.x)) * (rcAt(y) + 0.1)), n, 0.028, 0.028, 5))
    }
  }

  // ---- sàn thao tác (grating) + lan can
  const decks: THREE.BufferGeometry[] = []
  const rails: THREE.BufferGeometry[] = []
  for (const m of [3, 6, 9]) {
    const s = CROSS[m]
    const y = yAt(s)
    const rIn = rcAt(y) + 0.14
    const rOut = Math.hypot(P(0, 1, s).x, P(0, 1, s).z) - 0.1
    const holes: { x: number; y: number; r: number }[] = []
    for (const [f, c] of [[0.3, 20], [0.66, 34]] as [number, number][])
      for (let i = 0; i < c; i++) {
        const rr = rIn + f * (rOut - rIn)
        const a = (i / c) * TAU
        holes.push({ x: Math.cos(a) * rr, y: Math.sin(a) * rr, r: 0.055 })
      }
    decks.push(placed(annulus(rIn, rOut, 0.07, holes, 48, 0.01), [0, y - 0.04, 0]))
    rails.push(placed(new THREE.TorusGeometry(rOut - 0.04, 0.02, 6, 48), [0, y + 1.05, 0], [Math.PI / 2, 0, 0]))
    rails.push(placed(new THREE.TorusGeometry(rOut - 0.04, 0.014, 6, 48), [0, y + 0.55, 0], [Math.PI / 2, 0, 0]))
    rails.push(placed(latheHard([[rOut - 0.04, 0], [rOut - 0.04, 0.12], [rOut - 0.06, 0.12], [rOut - 0.06, 0]], 48), [0, y, 0]))
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * TAU
      rails.push(strut(v3(Math.cos(a) * (rOut - 0.04), y, Math.sin(a) * (rOut - 0.04)), v3(Math.cos(a) * (rOut - 0.04), y + 1.05, Math.sin(a) * (rOut - 0.04)), 0.016, 0.016, 5))
    }
  }

  // ---- thang leo + vòng bảo vệ + ống feeder
  const ladder: THREE.BufferGeometry[] = []
  const la = 0.55
  const lx = (y: number, off: number) => {
    const r = rcAt(y) + 0.19
    return v3(Math.cos(la + off) * r, y, Math.sin(la + off) * r)
  }
  for (const off of [-0.085, 0.085]) ladder.push(strut(lx(Y0 + 0.3, off), lx(Y1 - 0.2, off), 0.018, 0.018, 5))
  for (let y = Y0 + 0.6; y < Y1 - 0.4; y += 0.32) ladder.push(strut(lx(y, -0.085), lx(y, 0.085), 0.011, 0.011, 4))
  const feeders: THREE.BufferGeometry[] = []
  for (let k = 0; k < 4; k++) {
    const a = 2.4 + k * 0.1
    const f = (y: number) => v3(Math.cos(a) * (rcAt(y) + 0.07), y, Math.sin(a) * (rcAt(y) + 0.07))
    feeders.push(strut(f(Y0 + 0.2), f(Y1), 0.032, 0.03, 6))
  }
  for (let y = Y0 + 1.0; y < Y1; y += 1.6) {
    const a = 2.5
    const r = rcAt(y) + 0.07
    ladder.push(placed(new THREE.BoxGeometry(0.2, 0.07, 0.07), [Math.cos(a) * r, y, Math.sin(a) * r], [0, -a, 0]))
  }

  return {
    lattice: merge(members),
    ringsA: merge(ringsA),
    ringsB: merge(ringsB),
    nodes: merge(nodes),
    core: merge(core),
    spokes: merge(spokes),
    decks: merge(decks),
    rails: merge(rails),
    ladder: merge(ladder),
    feeders: merge(feeders),
  }
}

export function buildBase() {
  const plinth = latheHard([[0, 0], [4.3, 0], [4.3, 0.3], [4.0, 0.46], [0, 0.46]], 64)
  const girder = latheHard([[2.7, 0.46], [3.3, 0.46], [3.35, 0.51], [3.35, 0.87], [3.3, 0.92], [2.7, 0.92], [2.65, 0.87], [2.65, 0.51], [2.7, 0.46]], 72)
  const bolts: THREE.BufferGeometry[] = []
  const plates: THREE.BufferGeometry[] = []
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU
    const x = Math.cos(a) * RB
    const z = Math.sin(a) * RB
    plates.push(placed(new THREE.CylinderGeometry(0.22, 0.24, 0.06, 8), [x, 0.95, z]))
    for (let k = 0; k < 4; k++) {
      const b = (k / 4) * TAU + 0.4
      bolts.push(placed(new THREE.CylinderGeometry(0.03, 0.03, 0.08, 6), [x + Math.cos(b) * 0.15, 1.0, z + Math.sin(b) * 0.15]))
    }
    // anchor bolt thò ra từ bê tông ngoài chân dầm
    const ox = Math.cos(a) * 3.62
    const oz = Math.sin(a) * 3.62
    bolts.push(placed(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 6), [ox, 0.54, oz]))
    bolts.push(placed(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 6), [ox, 0.49, oz]))
  }
  return { plinth, girder, hardware: merge([...plates, ...bolts]) }
}

/** Vỏ chảo parabol có gờ cuộn, sườn gia cường phía sau, và hệ chân đế feed. */
export function dishGeo(R: number, depth: number, thick: number, ribs = 12) {
  const front: [number, number][] = []
  const back: [number, number][] = []
  const st = 18
  for (let i = st; i >= 0; i--) {
    const r = (i / st) * R
    front.push([r, depth * (r / R) ** 2])
  }
  for (let i = 0; i <= st; i++) {
    const r = (i / st) * R * 0.98
    back.push([r, depth * (r / R) ** 2 - thick])
  }
  const parts: THREE.BufferGeometry[] = [
    latheSmooth(front, 56),
    latheSmooth(back, 56),
    latheHard([[R * 0.98, depth - thick], [R + thick * 0.8, depth - thick * 0.6], [R + thick * 0.8, depth + thick * 0.2], [R, depth]], 56),
  ]
  const rib = new THREE.Shape()
  const rs = 8
  for (let i = 0; i <= rs; i++) {
    const r = 0.1 * R + (i / rs) * R * 0.86
    const y = depth * (r / R) ** 2 - thick
    i === 0 ? rib.moveTo(r, y) : rib.lineTo(r, y)
  }
  for (let i = rs; i >= 0; i--) {
    const r = 0.1 * R + (i / rs) * R * 0.86
    const y = depth * (r / R) ** 2 - thick - (0.34 * R * (1 - i / rs) * 0.85 + 0.03)
    rib.lineTo(r, y)
  }
  const ribG = new THREE.ExtrudeGeometry(rib, { depth: 0.03, bevelEnabled: false })
  ribG.translate(0, 0, -0.015)
  for (let k = 0; k < ribs; k++) parts.push(placed(ribG, [0, 0, 0], [0, (k / ribs) * TAU, 0]))
  return merge(parts)
}

export function feedGeo(R: number, depth: number, thick: number) {
  const F = (R * R) / (4 * depth)
  const parts: THREE.BufferGeometry[] = []
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * TAU + Math.PI / 4
    parts.push(strut(v3(Math.cos(a) * R * 0.97, depth - thick * 0.3, Math.sin(a) * R * 0.97), v3(0, F + 0.12, 0), 0.026, 0.02, 5))
  }
  // loa feed: côn + cổ ống dẫn sóng + mặt bích
  parts.push(placed(latheHard([[0.06, F + 0.2], [0.06, F + 0.1], [0.17, F - 0.1], [0.19, F - 0.1], [0.19, F - 0.12], [0.1, F - 0.12], [0.0, F - 0.12]], 20)))
  return { geo: merge(parts), F }
}

/** Anten dạng tấm sector: radome bo vát, tấm lưng, RRU có cánh tản nhiệt, cùm kẹp. */
export function buildPanel() {
  const radome = plate(0.36, 1.55, 0.1, 0.06, 0.028)
  const back = placed(plate(0.3, 1.48, 0.05, 0.02, 0.008), [0, 0, -0.07])
  const clamps: THREE.BufferGeometry[] = []
  for (const y of [-0.55, 0.55]) {
    clamps.push(placed(new THREE.BoxGeometry(0.2, 0.09, 0.1), [0, y, -0.14]))
    clamps.push(placed(new THREE.TorusGeometry(0.052, 0.012, 6, 14), [0, y, -0.2], [0, 0, 0]))
  }
  clamps.push(strut(v3(0, -0.5, -0.12), v3(0, -0.74, -0.34), 0.016, 0.016, 5))
  const rru: THREE.BufferGeometry[] = [placed(new THREE.BoxGeometry(0.32, 0.46, 0.1), [0, 0, 0])]
  for (let i = 0; i < 9; i++) rru.push(placed(new THREE.BoxGeometry(0.3, 0.42, 0.012), [0, 0, -0.06 - i * 0.014]))
  rru.push(placed(new THREE.CylinderGeometry(0.025, 0.025, 0.06, 8), [-0.08, -0.27, 0.0]))
  rru.push(placed(new THREE.CylinderGeometry(0.025, 0.025, 0.06, 8), [0.08, -0.27, 0.0]))
  return { radome, back, clamps: merge(clamps), rru: merge(rru) }
}

/** Anten viba (microwave) có shroud + radome phẳng. Trục +Y là hướng bắn. */
export function buildMicrowave(R: number) {
  const body = merge([
    latheSmooth([[0, -0.3 * R], [0.35 * R, -0.28 * R], [0.7 * R, -0.16 * R], [R, 0]].map(([r, y]) => [r, y] as [number, number]), 40),
    latheHard([[R, 0], [R, 0.3 * R], [R * 0.97, 0.3 * R]], 40),
    placed(new THREE.TorusGeometry(R, R * 0.035, 6, 40), [0, 0.3 * R, 0], [Math.PI / 2, 0, 0]),
  ])
  const face = new THREE.CylinderGeometry(R * 0.97, R * 0.97, 0.016, 40)
  face.translate(0, 0.3 * R - 0.01, 0)
  const hw = merge([
    placed(new THREE.BoxGeometry(R * 0.6, R * 0.55, R * 0.4), [0, -0.4 * R, 0]),
    ...[0, 1, 2, 3].map((k) => strut(v3(Math.cos((k / 4) * TAU + 0.8) * R * 0.2, -0.3 * R, Math.sin((k / 4) * TAU + 0.8) * R * 0.2), v3(Math.cos((k / 4) * TAU + 0.8) * R * 0.55, 0.02 * R, Math.sin((k / 4) * TAU + 0.8) * R * 0.55), 0.014, 0.014, 5)),
  ])
  return { body, face, hw }
}

/** Bệ quay azimuth + càng chữ U (tấm cắt có lỗ giảm tải) + trục elevation. */
export function buildYoke() {
  const drum = merge([
    latheHard([[0.0, 0], [0.72, 0], [0.72, 0.1], [0.62, 0.18], [0.62, 0.44], [0.5, 0.48], [0.0, 0.48]], 40),
  ])
  // vành quay (slewing ring) có răng
  const teeth: THREE.BufferGeometry[] = []
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * TAU
    teeth.push(placed(new THREE.BoxGeometry(0.05, 0.1, 0.08), [Math.cos(a) * 0.745, 0.1, Math.sin(a) * 0.745], [0, -a, 0]))
  }
  const armCuts = [slotPath(0, 0.28, 0.2, 0.5), slotPath(0, -0.36, 0.2, 0.34)]
  const arm = merge([placed(plate(0.5, 1.5, 0.1, 0.1, 0.012, armCuts), [0, 0, 0], [0, Math.PI / 2, 0])])
  const hub = placed(new THREE.CylinderGeometry(0.2, 0.2, 0.2, 24), [0, 0, 0], [0, 0, Math.PI / 2])
  return { drum, teeth: merge(teeth), arm, hub }
}

/** Vệ tinh: thân bọc foil, hai cánh pin mặt trời, chảo nhỏ. */
export function buildSat() {
  const bus = merge([
    placed(new THREE.BoxGeometry(1.2, 0.9, 0.9), [0, 0, 0]),
    placed(new THREE.CylinderGeometry(0.06, 0.06, 0.8, 6), [0, 0.9, 0]),
  ])
  const wing = new THREE.BoxGeometry(2.6, 0.04, 1.1)
  const dish = latheSmooth([[0.3, 0.06], [0.2, 0.02], [0.1, 0.0], [0, -0.01]], 16)
  return { bus, wingL: placed(wing, [-1.95, 0, 0]), wingR: placed(wing, [1.95, 0, 0]), strut: placed(new THREE.BoxGeometry(0.7, 0.04, 0.04), [0, 0, 0]), dish: placed(dish, [0, 0.55, 0.55], [Math.PI / 2, 0, 0]) }
}
