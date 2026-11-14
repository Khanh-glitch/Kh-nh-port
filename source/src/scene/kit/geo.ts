// Bộ dựng hình dùng chung cho bốn công trình sci-fi.
//
// Nguyên tắc (rút ra từ việc đối chiếu three.js examples, three-bvh-csg và các
// kết cấu thật): hình học phải đến từ PHƯƠNG PHÁP CHẾ TẠO chứ không phải từ việc xếp
// hộp.  Mỗi helper ở đây tương ứng một phương pháp gia công:
//   - strut()      : thanh/ống cắt theo chiều dài giữa hai nút (kết cấu giàn)
//   - latheHard()  : tiện CNC — profile có cạnh vát thật, pháp tuyến phẳng từng mặt
//   - plate()      : tấm cắt laser — Shape có lỗ/khe được extrude kèm vát cạnh
//   - pleated()    : vải / rèm xếp ly — mặt lưới dịch chuyển theo sóng
//   - sweep()      : ép đùn dọc đường cong — tiết diện siêu-ellipse đổi theo chiều dài
// three-bvh-csg (MIT) được khảo sát cho phép trừ khối kín, nhưng Shape-with-holes cho
// kết quả chính xác, rẻ và không sinh mặt non-manifold nên được chọn cho tấm đục lỗ.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const Y = new THREE.Vector3(0, 1, 0)
const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _e = new THREE.Euler()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3()

export const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z)

/** Gộp nhiều geometry (kể cả indexed lẫn non-indexed) thành một draw call. */
export function merge(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const norm = list.map((g) => {
    const ng = g.index ? g.toNonIndexed() : g.clone()
    for (const k of Object.keys(ng.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') ng.deleteAttribute(k)
    if (!ng.attributes.uv) ng.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(ng.attributes.position.count * 2), 2))
    if (!ng.attributes.normal) ng.computeVertexNormals()
    ng.clearGroups()
    return ng
  })
  const out = mergeGeometries(norm, false)
  if (!out) throw new Error('merge failed')
  return out
}

/** Bản sao đã đặt vị trí / xoay / tỉ lệ. */
export function placed(g: THREE.BufferGeometry, pos: [number, number, number] = [0, 0, 0], rot: [number, number, number] = [0, 0, 0], scale: number | [number, number, number] = 1) {
  const c = g.clone()
  _p.set(pos[0], pos[1], pos[2])
  _e.set(rot[0], rot[1], rot[2])
  _q.setFromEuler(_e)
  if (typeof scale === 'number') _s.set(scale, scale, scale)
  else _s.set(scale[0], scale[1], scale[2])
  _m.compose(_p, _q, _s)
  c.applyMatrix4(_m)
  return c
}

/** Thanh tròn nối hai điểm (bán kính có thể thuôn từ a → b). */
export function strut(a: THREE.Vector3, b: THREE.Vector3, r0: number, r1 = r0, seg = 6) {
  const d = new THREE.Vector3().subVectors(b, a)
  const len = d.length()
  const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1, false)
  _q.setFromUnitVectors(Y, d.normalize())
  _m.compose(new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), _q, new THREE.Vector3(1, 1, 1))
  g.applyMatrix4(_m)
  return g
}

/** Tiện: mỗi đoạn profile là một mặt riêng → cạnh sắc, đúng như chi tiết gia công. profile = [bán kính, y]. */
export function latheHard(profile: [number, number][], seg = 40, phiStart = 0, phiLen = Math.PI * 2) {
  const parts: THREE.BufferGeometry[] = []
  for (let i = 0; i < profile.length - 1; i++) {
    const [r0, y0] = profile[i]
    const [r1, y1] = profile[i + 1]
    if (Math.abs(r0 - r1) < 1e-6 && Math.abs(y0 - y1) < 1e-6) continue
    parts.push(new THREE.LatheGeometry([new THREE.Vector2(r0, y0), new THREE.Vector2(r1, y1)], seg, phiStart, phiLen))
  }
  return merge(parts)
}

/** Lathe mượt (dùng cho tấm phản xạ parabol, thân cong). */
export function latheSmooth(profile: [number, number][], seg = 48) {
  return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg)
}

export function roundRectShape(w: number, h: number, r: number) {
  const s = new THREE.Shape()
  const x = -w / 2
  const y = -h / 2
  r = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4)
  s.moveTo(x + r, y)
  s.lineTo(x + w - r, y)
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false)
  s.lineTo(x + w, y + h - r)
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false)
  s.lineTo(x + r, y + h)
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false)
  s.lineTo(x, y + r)
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false)
  return s
}

export function slotPath(cx: number, cy: number, w: number, h: number) {
  const p = new THREE.Path()
  const r = Math.min(w, h) / 2
  const x = cx - w / 2
  const y = cy - h / 2
  p.moveTo(x + r, y)
  p.lineTo(x + w - r, y)
  p.absarc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2, false)
  p.lineTo(x + r, y + h)
  p.absarc(x + r, y + r, r, Math.PI / 2, Math.PI * 1.5, false)
  return p
}

export function circlePath(cx: number, cy: number, r: number) {
  const p = new THREE.Path()
  p.absarc(cx, cy, r, 0, Math.PI * 2, true)
  return p
}

/** Tấm gia công laser: hình chữ nhật bo góc + các khe/lỗ cắt xuyên, có vát cạnh. Tâm tại gốc, dày theo Z. */
export function plate(w: number, h: number, depth: number, corner = 0.02, bevel = 0.006, cuts: THREE.Path[] = []) {
  const s = roundRectShape(w, h, corner)
  s.holes.push(...cuts)
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.001, depth - bevel * 2), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 6 })
  g.translate(0, 0, -depth / 2 + bevel)
  return g
}

/** Vành khăn có lỗ thoát (sàn grating, mặt bích). Nằm trong mặt XZ, dày theo +Y. */
export function annulus(rIn: number, rOut: number, depth: number, holes: { x: number; y: number; r: number }[] = [], seg = 48, bevel = 0.01) {
  const s = new THREE.Shape()
  s.absarc(0, 0, rOut, 0, Math.PI * 2, false)
  const inner = new THREE.Path()
  inner.absarc(0, 0, rIn, 0, Math.PI * 2, true)
  s.holes.push(inner)
  for (const h of holes) s.holes.push(circlePath(h.x, h.y, h.r))
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.001, depth - bevel * 2), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: seg })
  g.rotateX(-Math.PI / 2)
  g.translate(0, bevel, 0)
  return g
}

/** Rèm xếp ly: mặt phẳng chia lưới, dịch chuyển theo sóng sin (biên độ giảm dần theo chiều cao). */
export function pleated(width: number, height: number, pleats: number, amp: number, seg = 10) {
  const nx = pleats * seg
  const g = new THREE.PlaneGeometry(width, height, nx, 8)
  const pos = g.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const u = (x / width + 0.5) * pleats
    const fall = 0.65 + 0.35 * Math.sin((y / height + 0.5) * Math.PI * 0.5)
    pos.setZ(i, Math.sin(u * Math.PI * 2) * amp * fall + Math.sin(u * Math.PI * 6.0) * amp * 0.12)
  }
  g.computeVertexNormals()
  return g
}

export interface SweepOpts {
  /** Điểm trên đường dẫn tại t∈[0,1] */
  path: (t: number) => THREE.Vector3
  /** Bán kính hai trục tiết diện tại t: [dọc theo N (trong mặt phẳng chứa up), dọc theo B (ngang)] */
  size: (t: number) => [number, number]
  /** Số mũ siêu-ellipse (2 = ellipse, >2 = vuông bo, ~2.6 = lá/blade) */
  exponent?: number
  steps?: number
  ring?: number
  up?: THREE.Vector3
}

/** Quét tiết diện siêu-ellipse dọc đường cong — dùng cho cột cong (pylon) thay vì xếp trụ. */
export function sweep(o: SweepOpts) {
  const steps = o.steps ?? 40
  const ring = o.ring ?? 28
  const ex = o.exponent ?? 2.4
  const up = o.up ?? Y
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  const T = new THREE.Vector3()
  const N = new THREE.Vector3()
  const B = new THREE.Vector3()
  const frames: { p: THREE.Vector3; N: THREE.Vector3; B: THREE.Vector3; a: number; b: number }[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const p = o.path(t)
    T.subVectors(o.path(Math.min(1, t + 0.002)), o.path(Math.max(0, t - 0.002))).normalize()
    // Đường dẫn gần như thẳng đứng → dùng một trục ngang cố định làm tham chiếu để tránh suy biến
    const ref = Math.abs(T.dot(up)) > 0.98 ? new THREE.Vector3(1, 0, 0) : up
    B.crossVectors(ref, T).normalize()
    N.crossVectors(T, B).normalize()
    const [a, b] = o.size(t)
    frames.push({ p, N: N.clone(), B: B.clone(), a, b })
  }
  for (let i = 0; i <= steps; i++) {
    const f = frames[i]
    for (let j = 0; j <= ring; j++) {
      const th = (j / ring) * Math.PI * 2
      const c = Math.cos(th)
      const s = Math.sin(th)
      const cx = Math.sign(c) * Math.pow(Math.abs(c), 2 / ex)
      const sy = Math.sign(s) * Math.pow(Math.abs(s), 2 / ex)
      pos.push(f.p.x + f.N.x * cx * f.a + f.B.x * sy * f.b, f.p.y + f.N.y * cx * f.a + f.B.y * sy * f.b, f.p.z + f.N.z * cx * f.a + f.B.z * sy * f.b)
      uv.push(j / ring, i / steps)
    }
  }
  const row = ring + 1
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < ring; j++) {
      const a = i * row + j
      const b = a + row
      idx.push(a, a + 1, b, a + 1, b + 1, b)
    }
  }
  const cap = (i: number, flip: boolean) => {
    const f = frames[i]
    const c0 = pos.length / 3
    pos.push(f.p.x, f.p.y, f.p.z)
    uv.push(0.5, 0.5)
    for (let j = 0; j < ring; j++) {
      const a = i * row + j
      if (flip) idx.push(c0, a + 1, a)
      else idx.push(c0, a, a + 1)
    }
  }
  cap(0, false)
  cap(steps, true)
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/** Parabol y = depth·(r/R)² → profile tấm phản xạ có độ dày và vành gờ. [r,y] đi từ tâm ra vành rồi quay lại mặt sau. */
export function dishProfile(R: number, depth: number, thick: number, steps = 14): [number, number][] {
  const out: [number, number][] = []
  for (let i = 0; i <= steps; i++) {
    const r = (i / steps) * R
    out.push([r, depth * (r / R) * (r / R)])
  }
  out.push([R + thick * 0.8, depth + thick * 0.2])
  out.push([R + thick * 0.8, depth - thick * 0.6])
  for (let i = steps; i >= 0; i--) {
    const r = (i / steps) * R
    out.push([r * 0.98, depth * (r / R) * (r / R) - thick])
  }
  return out
}

export const TAU = Math.PI * 2
export const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}
