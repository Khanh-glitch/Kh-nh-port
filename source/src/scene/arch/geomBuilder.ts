import * as THREE from 'three'
import { mergeGeometries, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export type Vec2 = [number, number]
export type FilletedPt = [number, number, number?] // [x, y, cornerRadius?]

/**
 * Compute exact tangent circular fillets at polygon corners for CNC / architectural extrusions.
 */
export function filletPoly2D(
  corners: FilletedPt[],
  defaultR = 0.015,
  arcSegs = 4,
  closed = true,
): Vec2[] {
  const out: Vec2[] = []
  const n = corners.length
  if (n < 3) return corners.map(([x, y]) => [x, y])

  for (let i = 0; i < n; i++) {
    const [cx, cy, rOv] = corners[i]
    const rReq = rOv ?? defaultR
    if ((!closed && (i === 0 || i === n - 1)) || rReq <= 1e-6) {
      out.push([cx, cy])
      continue
    }
    const [px, py] = corners[(i - 1 + n) % n]
    const [nx, ny] = corners[(i + 1) % n]
    const v1x = px - cx
    const v1y = py - cy
    const v2x = nx - cx
    const v2y = ny - cy
    const l1 = Math.hypot(v1x, v1y)
    const l2 = Math.hypot(v2x, v2y)
    if (l1 < 1e-6 || l2 < 1e-6) {
      out.push([cx, cy])
      continue
    }
    const u1x = v1x / l1
    const u1y = v1y / l1
    const u2x = v2x / l2
    const u2y = v2y / l2
    const dot = THREE.MathUtils.clamp(u1x * u2x + u1y * u2y, -0.9995, 0.9995)
    const halfAng = Math.acos(dot) * 0.5
    const tanH = Math.tan(halfAng)
    if (tanH < 1e-4) {
      out.push([cx, cy])
      continue
    }
    const trim = Math.min(rReq / tanH, Math.min(l1, l2) * 0.45)
    const rAct = trim * tanH
    const t1x = cx + u1x * trim
    const t1y = cy + u1y * trim
    const t2x = cx + u2x * trim
    const t2y = cy + u2y * trim
    const bx = u1x + u2x
    const by = u1y + u2y
    const bLen = Math.hypot(bx, by)
    if (bLen < 1e-6) {
      out.push([cx, cy])
      continue
    }
    const dist = rAct / Math.sin(halfAng)
    const ocx = cx + (bx / bLen) * dist
    const ocy = cy + (by / bLen) * dist
    const a1 = Math.atan2(t1y - ocy, t1x - ocx)
    const a2 = Math.atan2(t2y - ocy, t2x - ocx)
    let delta = a2 - a1
    while (delta > Math.PI) delta -= Math.PI * 2
    while (delta < -Math.PI) delta += Math.PI * 2
    const steps = Math.max(2, arcSegs)
    for (let s = 0; s <= steps; s++) {
      const a = a1 + (delta * s) / steps
      out.push([ocx + Math.cos(a) * rAct, ocy + Math.sin(a) * rAct])
    }
  }
  return out
}

export function shapeFromPoints(pts: Vec2[]): THREE.Shape {
  const s = new THREE.Shape()
  if (!pts.length) return s
  s.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1])
  s.closePath()
  return s
}

export function roundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape()
  const hw = w / 2
  const hh = h / 2
  const rr = Math.min(r, hw - 1e-4, hh - 1e-4)
  s.moveTo(-hw + rr, -hh)
  s.lineTo(hw - rr, -hh)
  s.quadraticCurveTo(hw, -hh, hw, -hh + rr)
  s.lineTo(hw, hh - rr)
  s.quadraticCurveTo(hw, hh, hw - rr, hh)
  s.lineTo(-hw + rr, hh)
  s.quadraticCurveTo(-hw, hh, -hw, hh - rr)
  s.lineTo(-hw, -hh + rr)
  s.quadraticCurveTo(-hw, -hh, -hw + rr, -hh)
  return s
}

/** Structural I-beam cross-section with filleted inner radii. */
export function iBeamProfile(width: number, height: number, flange: number, web: number, r = 0.008): Vec2[] {
  const hw = width * 0.5
  const hh = height * 0.5
  const hweb = web * 0.5
  return filletPoly2D([
    [-hw, -hh, r * 0.6],
    [hw, -hh, r * 0.6],
    [hw, -hh + flange, r * 0.6],
    [hweb, -hh + flange, r],
    [hweb, hh - flange, r],
    [hw, hh - flange, r * 0.6],
    [hw, hh, r * 0.6],
    [-hw, hh, r * 0.6],
    [-hw, hh - flange, r * 0.6],
    [-hweb, hh - flange, r],
    [-hweb, -hh + flange, r],
    [-hw, -hh + flange, r * 0.6],
  ], r, 3)
}

/** Tapered aerospace rib / fin cross-section (chamfered octagonal trapezoid). */
export function aeroRibProfile(wBase: number, wTip: number, depth: number, r = 0.014): Vec2[] {
  const hb = wBase * 0.5
  const ht = wTip * 0.5
  const hd = depth * 0.5
  return filletPoly2D([
    [-hb, -hd, r],
    [hb, -hd, r],
    [ht, hd, r],
    [-ht, hd, r],
  ], r, 3)
}

/** Rounded-edge machined solid extruded along Z, centered. */
export function bevelBox(
  w: number,
  h: number,
  d: number,
  r = 0.025,
  bevel = 0.008,
  curveSegs = 4,
): THREE.BufferGeometry {
  const b = Math.min(bevel, w * 0.3, h * 0.3, d * 0.3)
  const sh = roundedRectShape(Math.max(0.004, w - b * 2), Math.max(0.004, h - b * 2), Math.max(0.002, r - b))
  const g = new THREE.ExtrudeGeometry(sh, {
    depth: Math.max(0.004, d - b * 2),
    bevelEnabled: b > 1e-4,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: 2,
    curveSegments: curveSegs,
  })
  g.center()
  return g
}

export function extrudeShape(
  shape: THREE.Shape,
  depth: number,
  bevel = 0.008,
  curveSegs = 8,
  center = true,
): THREE.BufferGeometry {
  const b = Math.min(bevel, depth * 0.35)
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.004, depth - b * 2),
    bevelEnabled: b > 1e-4,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: 2,
    curveSegments: curveSegs,
  })
  if (center) g.center()
  return g
}

export interface SweepOpts {
  steps?: number
  up?: THREE.Vector3
  closedPath?: boolean
  caps?: boolean
  creaseAngle?: number
  scaleFn?: (t: number) => [number, number] | number
  twistFn?: (t: number) => number
}

/**
 * Rotation-Minimizing Frame (Wang et al. Double Reflection) sweep of an arbitrary 2D cross-section
 * along a 3D Catmull-Rom spline with optional smooth taper & twist.
 */
export function sweepRMF(
  points: THREE.Vector3[] | THREE.CatmullRomCurve3,
  profile: Vec2[],
  opts: SweepOpts = {},
): THREE.BufferGeometry {
  const curve =
    points instanceof THREE.CatmullRomCurve3
      ? points
      : new THREE.CatmullRomCurve3(points, opts.closedPath ?? false, 'centripetal', 0.5)

  const steps = opts.steps ?? 36
  const closedPath = opts.closedPath ?? false
  const caps = opts.caps ?? !closedPath
  const creaseAngle = opts.creaseAngle ?? 0.65

  // Guarantee CCW profile winding for consistent outward normals
  let area = 0
  for (let j = 0; j < profile.length; j++) {
    const [x1, y1] = profile[j]
    const [x2, y2] = profile[(j + 1) % profile.length]
    area += x1 * y2 - x2 * y1
  }
  const prof = area < 0 ? [...profile].reverse() : profile
  const m = prof.length

  const centers: THREE.Vector3[] = []
  const tangents: THREE.Vector3[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    centers.push(curve.getPointAt(t))
    tangents.push(curve.getTangentAt(t).normalize())
  }

  // Initial orthonormal frame
  const upHint = (opts.up ?? new THREE.Vector3(0, 1, 0)).clone().normalize()
  let r0 = new THREE.Vector3().crossVectors(upHint, tangents[0])
  if (r0.lengthSq() < 1e-5) {
    r0 = new THREE.Vector3().crossVectors(new THREE.Vector3(1, 0, 0), tangents[0])
  }
  r0.normalize()
  const s0 = new THREE.Vector3().crossVectors(tangents[0], r0).normalize()

  const R: THREE.Vector3[] = [r0]
  const S: THREE.Vector3[] = [s0]

  for (let i = 0; i < steps; i++) {
    const v1 = new THREE.Vector3().subVectors(centers[i + 1], centers[i])
    const c1 = v1.dot(v1)
    let rL = R[i].clone()
    let tL = tangents[i].clone()
    if (c1 > 1e-10) {
      rL.addScaledVector(v1, (-2 / c1) * v1.dot(R[i]))
      tL.addScaledVector(v1, (-2 / c1) * v1.dot(tangents[i]))
    }
    const v2 = new THREE.Vector3().subVectors(tangents[i + 1], tL)
    const c2 = v2.dot(v2)
    let rNext = rL.clone()
    if (c2 > 1e-10) {
      rNext.addScaledVector(v2, (-2 / c2) * v2.dot(rL))
    }
    // Re-orthogonalize
    rNext.addScaledVector(tangents[i + 1], -rNext.dot(tangents[i + 1])).normalize()
    const sNext = new THREE.Vector3().crossVectors(tangents[i + 1], rNext).normalize()
    R.push(rNext)
    S.push(sNext)
  }

  // Build ring vertices
  const rings: THREE.Vector3[][] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const sc = opts.scaleFn ? opts.scaleFn(t) : 1
    const sx = Array.isArray(sc) ? sc[0] : sc
    const sy = Array.isArray(sc) ? sc[1] : sc
    const tw = opts.twistFn ? opts.twistFn(t) : 0
    const ct = Math.cos(tw)
    const st = Math.sin(tw)
    const ring: THREE.Vector3[] = []
    for (let j = 0; j < m; j++) {
      const px = prof[j][0] * sx
      const py = prof[j][1] * sy
      const rx = px * ct - py * st
      const ry = px * st + py * ct
      const v = centers[i].clone().addScaledVector(R[i], rx).addScaledVector(S[i], ry)
      ring.push(v)
    }
    rings.push(ring)
  }

  const pos: number[] = []
  const pushTri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
  }

  for (let i = 0; i < steps; i++) {
    const rA = rings[i]
    const rB = rings[i + 1]
    for (let j = 0; j < m; j++) {
      const jn = (j + 1) % m
      pushTri(rA[j], rB[j], rB[jn])
      pushTri(rA[j], rB[jn], rA[jn])
    }
  }

  if (caps) {
    // Start cap (facing -tangent[0])
    const cStart = centers[0]
    for (let j = 0; j < m; j++) {
      const jn = (j + 1) % m
      pushTri(cStart, rings[0][jn], rings[0][j])
    }
    // End cap (facing +tangent[steps])
    const cEnd = centers[steps]
    for (let j = 0; j < m; j++) {
      const jn = (j + 1) % m
      pushTri(cEnd, rings[steps][j], rings[steps][jn])
    }
  }

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.computeVertexNormals()
  const creased = toCreasedNormals(g, creaseAngle)
  g.dispose()
  return creased
}

/** Structural cylinder strut connecting arbitrary 3D endpoints a -> b. */
export function strutGeo(
  a: [number, number, number],
  b: [number, number, number],
  rA: number,
  rB = rA,
  segs = 10,
): THREE.BufferGeometry {
  const va = new THREE.Vector3(...a)
  const vb = new THREE.Vector3(...b)
  const d = vb.clone().sub(va)
  const len = Math.max(1e-4, d.length())
  const g = new THREE.CylinderGeometry(rB, rA, len, segs, 1)
  const mid = va.add(vb).multiplyScalar(0.5)
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())
  g.applyMatrix4(new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1)))
  return g
}

/** Hex bolt + machined washer (oriented along +Y by default). */
export function hexBoltGeo(headR = 0.025, headH = 0.016): THREE.BufferGeometry {
  const head = new THREE.CylinderGeometry(headR, headR * 0.96, headH, 6)
  head.translate(0, headH * 0.5 + 0.004, 0)
  const washer = new THREE.CylinderGeometry(headR * 1.45, headR * 1.45, 0.006, 12)
  washer.translate(0, 0.003, 0)
  return mergeClean([head, washer])
}

/**
 * Mathematical thick-walled parabolic reflector dish: y(r) = r^2 / (4f).
 * Creates inner reflective surface + thick beveled outer shell lip.
 */
export function parabolicDishGeo(
  radius: number,
  focalLength: number,
  rimThickness = 0.14,
  centerHoleR = 0.28,
  radialSegs = 24,
  circSegs = 64,
): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = []
  // Outer back shell from hub to rim
  for (let i = 0; i <= radialSegs; i++) {
    const t = i / radialSegs
    const r = centerHoleR + (radius - centerHoleR) * t
    const y = (r * r) / (4 * focalLength)
    const thick = rimThickness * (1.55 - 0.65 * t)
    pts.push(new THREE.Vector2(r, y - thick))
  }
  // Rim chamfer lip
  const yRim = (radius * radius) / (4 * focalLength)
  pts.push(new THREE.Vector2(radius + 0.05, yRim - rimThickness * 0.55))
  pts.push(new THREE.Vector2(radius + 0.05, yRim + 0.05))
  pts.push(new THREE.Vector2(radius - 0.02, yRim + 0.06))
  // Inner concave parabola back down to center hole
  for (let i = radialSegs; i >= 0; i--) {
    const t = i / radialSegs
    const r = centerHoleR + (radius - centerHoleR) * t
    const y = (r * r) / (4 * focalLength)
    pts.push(new THREE.Vector2(r, y))
  }
  pts.push(pts[0].clone())
  const g = new THREE.LatheGeometry(pts, circSegs)
  g.computeVertexNormals()
  return g
}

/**
 * Sculpted sinusoidal pleated curtain mesh for boutique cinema proscenium.
 */
export function pleatedCurtainGeo(
  width: number,
  height: number,
  folds = 8,
  depth = 0.14,
  segsX = 48,
  segsY = 12,
): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(width, height, segsX, segsY)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    const y = p.getY(i)
    const u = (x + width * 0.5) / width
    const v = (y + height * 0.5) / height
    // Deeper drape toward bottom, cinched softly at top
    const drapeAmp = depth * (0.72 + 0.36 * (1 - v))
    const wave = Math.sin(u * Math.PI * 2 * folds) * drapeAmp
    const micro = Math.sin(u * Math.PI * 4 * folds + 0.8) * drapeAmp * 0.14
    p.setZ(i, wave + micro)
  }
  g.computeVertexNormals()
  return g
}

/**
 * Curved cylindrical arc screen / blade geometry (faces INWARD toward center when concave=true).
 */
export function curvedBladeGeo(
  radius: number,
  arcAngle: number,
  height: number,
  segsX = 28,
  concave = true,
): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(radius, radius, height, segsX, 1, true, -arcAngle / 2, arcAngle)
  if (concave) {
    // Flip face winding & normals so inner surface faces the visitor at center/south
    const idx = g.index
    if (idx) {
      for (let i = 0; i < idx.count; i += 3) {
        const b = idx.getX(i + 1)
        const c = idx.getX(i + 2)
        idx.setX(i + 1, c)
        idx.setX(i + 2, b)
      }
      idx.needsUpdate = true
    }
    // Flip horizontal UV so text reads left-to-right from inside
    const uv = g.attributes.uv
    for (let i = 0; i < uv.count; i++) {
      uv.setX(i, 1 - uv.getX(i))
    }
    uv.needsUpdate = true
    g.computeVertexNormals()
  }
  return g
}

/** Transform geometry in-place cleanly. */
export function xf(
  g: THREE.BufferGeometry,
  opts: { pos?: [number, number, number]; rot?: [number, number, number]; scale?: [number, number, number] },
): THREE.BufferGeometry {
  if (opts.scale) g.scale(opts.scale[0], opts.scale[1], opts.scale[2])
  if (opts.rot) {
    if (opts.rot[0]) g.rotateX(opts.rot[0])
    if (opts.rot[1]) g.rotateY(opts.rot[1])
    if (opts.rot[2]) g.rotateZ(opts.rot[2])
  }
  if (opts.pos) g.translate(opts.pos[0], opts.pos[1], opts.pos[2])
  return g
}

/** Project metric planar UVs (scale UV units per metre) based on dominant face normal. */
export function planarUV(g: THREE.BufferGeometry, scale = 0.5): THREE.BufferGeometry {
  const pos = g.attributes.position
  if (!g.attributes.normal) g.computeVertexNormals()
  const nor = g.attributes.normal
  const uv = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const ax = Math.abs(nor.getX(i))
    const ay = Math.abs(nor.getY(i))
    const az = Math.abs(nor.getZ(i))
    let u: number
    let v: number
    if (ax >= ay && ax >= az) {
      u = z
      v = y
    } else if (ay >= az) {
      u = x
      v = z
    } else {
      u = x
      v = y
    }
    uv[i * 2] = u * scale
    uv[i * 2 + 1] = v * scale
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  return g
}

/** Normalize geometry attributes so any combination merges cleanly without WebGL warnings. */
export function cleanGeo(raw: THREE.BufferGeometry, uvScale?: number): THREE.BufferGeometry {
  const g = raw.index ? raw.toNonIndexed() : raw.clone()
  if (!g.attributes.normal) g.computeVertexNormals()
  for (const k of Object.keys(g.attributes)) {
    if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k)
  }
  if (uvScale !== undefined || !g.attributes.uv) {
    planarUV(g, uvScale ?? 0.5)
  }
  return g
}

export function mergeClean(list: THREE.BufferGeometry[], uvScale?: number): THREE.BufferGeometry {
  const cleaned = list.map((g) => cleanGeo(g, uvScale))
  const merged = mergeGeometries(cleaned, false)
  cleaned.forEach((c) => c.dispose())
  if (!merged) throw new Error('[geomBuilder] mergeGeometries returned null')
  return merged
}

/**
 * Per-material geometry bin accumulator.
 * Collects hundreds of architectural/mechanical sub-parts and flushes them into
 * ONE merged BufferGeometry per material key — cutting draw calls 10-50x while
 * keeping consistent metric texel density across every surface.
 */
export class MeshBinBuilder {
  private bins = new Map<string, THREE.BufferGeometry[]>()

  add(matKey: string, geom: THREE.BufferGeometry, uvScale = 0.5): this {
    const list = this.bins.get(matKey)
    const normalized = cleanGeo(geom, uvScale)
    geom.dispose()
    if (list) list.push(normalized)
    else this.bins.set(matKey, [normalized])
    return this
  }

  /** Merge each material bin into a single BufferGeometry record. */
  build(): Record<string, THREE.BufferGeometry> {
    const out: Record<string, THREE.BufferGeometry> = {}
    for (const [key, list] of this.bins.entries()) {
      if (!list.length) continue
      const merged = mergeGeometries(list, false)
      list.forEach((g) => g.dispose())
      if (merged) {
        merged.computeBoundingSphere()
        out[key] = merged
      }
    }
    this.bins.clear()
    return out
  }
}

export function disposeBinGeos(geos: Record<string, THREE.BufferGeometry>) {
  Object.values(geos).forEach((g) => g.dispose())
}
