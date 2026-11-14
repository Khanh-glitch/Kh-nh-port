import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type ProfilePoint = [number, number];
export type FilletedCorner = [number, number, number?]; // [x, y, cornerRadius?]

/**
 * Compute exact tangent circular fillets at every vertex of a closed or open 2D polygon.
 * Enables realistic CNC cutter radii and sheet-metal bend radii on structural sections.
 */
export function filletPolygon2D(
  corners: FilletedCorner[],
  defaultRadius = 0.003,
  arcSegs = 4,
  closed = true,
): ProfilePoint[] {
  const out: ProfilePoint[] = [];
  const n = corners.length;
  if (n < 3) return corners.map(([x, y]) => [x, y]);

  for (let i = 0; i < n; i++) {
    const [cx, cy, rOverride] = corners[i];
    const rReq = rOverride ?? defaultRadius;

    if ((!closed && (i === 0 || i === n - 1)) || rReq <= 1e-6) {
      out.push([cx, cy]);
      continue;
    }

    const [px, py] = corners[(i - 1 + n) % n];
    const [nx, ny] = corners[(i + 1) % n];

    const v1x = px - cx;
    const v1y = py - cy;
    const v2x = nx - cx;
    const v2y = ny - cy;
    const l1 = Math.hypot(v1x, v1y);
    const l2 = Math.hypot(v2x, v2y);
    if (l1 < 1e-6 || l2 < 1e-6) {
      out.push([cx, cy]);
      continue;
    }

    const u1x = v1x / l1;
    const u1y = v1y / l1;
    const u2x = v2x / l2;
    const u2y = v2y / l2;

    const dot = THREE.MathUtils.clamp(u1x * u2x + u1y * u2y, -0.9995, 0.9995);
    const halfAngle = Math.acos(dot) * 0.5;
    const tanHalf = Math.tan(halfAngle);
    if (tanHalf < 1e-4) {
      out.push([cx, cy]);
      continue;
    }

    const maxTrim = Math.min(l1, l2) * 0.46;
    const trim = Math.min(rReq / tanHalf, maxTrim);
    const rActual = trim * tanHalf;

    const t1x = cx + u1x * trim;
    const t1y = cy + u1y * trim;
    const t2x = cx + u2x * trim;
    const t2y = cy + u2y * trim;

    const bx = u1x + u2x;
    const by = u1y + u2y;
    const bLen = Math.hypot(bx, by);
    if (bLen < 1e-6) {
      out.push([cx, cy]);
      continue;
    }
    const centerDist = rActual / Math.sin(halfAngle);
    const ocx = cx + (bx / bLen) * centerDist;
    const ocy = cy + (by / bLen) * centerDist;

    const a1 = Math.atan2(t1y - ocy, t1x - ocx);
    let a2 = Math.atan2(t2y - ocy, t2x - ocx);
    let delta = a2 - a1;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;

    const steps = Math.max(2, arcSegs);
    for (let s = 0; s <= steps; s++) {
      const a = a1 + (delta * s) / steps;
      out.push([ocx + Math.cos(a) * rActual, ocy + Math.sin(a) * rActual]);
    }
  }
  return out;
}

/** Standard structural cross-sections (in metres) with realistic bend/fillet radii */
export function cChannelProfile(width: number, height: number, wall: number, r = 0.002): ProfilePoint[] {
  const hw = width * 0.5;
  const hh = height * 0.5;
  return filletPolygon2D([
    [-hw, -hh, r],
    [hw, -hh, r],
    [hw, -hh + wall, r * 0.5],
    [-hw + wall, -hh + wall, r * 0.8],
    [-hw + wall, hh - wall, r * 0.8],
    [hw, hh - wall, r * 0.5],
    [hw, hh, r],
    [-hw, hh, r],
  ], r, 3);
}

export function iBeamProfile(width: number, height: number, flange: number, web: number, r = 0.002): ProfilePoint[] {
  const hw = width * 0.5;
  const hh = height * 0.5;
  const hweb = web * 0.5;
  return filletPolygon2D([
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
  ], r, 3);
}

export function tTrackProfile(baseW: number, headW: number, totalH: number, baseH: number, webW: number, r = 0.0015): ProfilePoint[] {
  const hbw = baseW * 0.5;
  const hhw = headW * 0.5;
  const hweb = webW * 0.5;
  const headH = totalH * 0.28;
  return filletPolygon2D([
    [-hbw, 0, r],
    [hbw, 0, r],
    [hbw, baseH, r],
    [hweb, baseH, r],
    [hweb, totalH - headH, r],
    [hhw, totalH - headH, r],
    [hhw, totalH, r],
    [-hhw, totalH, r],
    [-hhw, totalH - headH, r],
    [-hweb, totalH - headH, r],
    [-hweb, baseH, r],
    [-hbw, baseH, r],
  ], r, 3);
}

export interface SweepOptions {
  steps?: number;
  up?: THREE.Vector3;
  closedPath?: boolean;
  caps?: boolean;
  profileClosed?: boolean;
  creaseAngle?: number;
  scaleFn?: (t: number) => [number, number] | number;
  twistFn?: (t: number) => number;
}

/**
 * Rotation-Minimizing Frame (Wang et al. 2008 Double Reflection Method) sweep.
 * Eliminates gimbal-lock twisting on steep 3D paths (A-pillars, overhead bows, hoses)
 * and computes creased vertex normals so CNC flanges stay sharp while fillets stay smooth.
 */
export function sweepProfile(
  points: THREE.Vector3[] | THREE.CatmullRomCurve3,
  profile: ProfilePoint[],
  opts: SweepOptions = {},
): THREE.BufferGeometry {
  const curve =
    points instanceof THREE.CatmullRomCurve3
      ? points
      : new THREE.CatmullRomCurve3(points, opts.closedPath ?? false, 'centripetal', 0.5);

  const steps = opts.steps ?? Math.max(28, Math.round(profile.length * 4));
  const closedProfile = opts.profileClosed ?? true;
  const creaseAngle = opts.creaseAngle ?? 0.68; // ~39 degrees

  // Ensure consistent CCW profile winding so outward normals always face out
  let signedArea = 0;
  for (let j = 0; j < profile.length; j++) {
    const [x1, y1] = profile[j];
    const [x2, y2] = profile[(j + 1) % profile.length];
    signedArea += x1 * y2 - x2 * y1;
  }
  const prof = closedProfile && signedArea < 0 ? [...profile].reverse() : profile;

  const centers: THREE.Vector3[] = [];
  const tangents: THREE.Vector3[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    centers.push(curve.getPointAt(t));
    tangents.push(curve.getTangentAt(t).normalize());
  }

  // Build initial orthonormal frame (t0, side0, lift0)
  const upHint = (opts.up ?? new THREE.Vector3(0, 1, 0)).clone().normalize();
  const normalsR: THREE.Vector3[] = [];
  const binormalsS: THREE.Vector3[] = [];

  const t0 = tangents[0];
  let r0 = new THREE.Vector3().crossVectors(t0, upHint);
  if (r0.lengthSq() < 1e-6) {
    const alt = Math.abs(t0.x) < 0.8 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
    r0.crossVectors(t0, alt);
  }
  r0.normalize();
  const s0 = new THREE.Vector3().crossVectors(r0, t0).normalize();
  normalsR.push(r0);
  binormalsS.push(s0);

  // Double-reflection RMF propagation
  const v1 = new THREE.Vector3();
  const v2 = new THREE.Vector3();
  const rL = new THREE.Vector3();
  const tL = new THREE.Vector3();

  for (let i = 0; i < steps; i++) {
    v1.subVectors(centers[i + 1], centers[i]);
    const c1Sq = v1.lengthSq();
    let riNext: THREE.Vector3;
    if (c1Sq < 1e-12) {
      riNext = normalsR[i].clone();
    } else {
      const c1 = 2 / c1Sq;
      rL.copy(normalsR[i]).addScaledVector(v1, -c1 * v1.dot(normalsR[i]));
      tL.copy(tangents[i]).addScaledVector(v1, -c1 * v1.dot(tangents[i]));
      v2.subVectors(tangents[i + 1], tL);
      const c2Sq = v2.lengthSq();
      if (c2Sq < 1e-12) {
        riNext = rL.clone().normalize();
      } else {
        const c2 = 2 / c2Sq;
        riNext = rL.clone().addScaledVector(v2, -c2 * v2.dot(rL)).normalize();
      }
    }
    // Re-orthogonalize against t_{i+1}
    riNext.addScaledVector(tangents[i + 1], -riNext.dot(tangents[i + 1])).normalize();
    const siNext = new THREE.Vector3().crossVectors(riNext, tangents[i + 1]).normalize();
    normalsR.push(riNext);
    binormalsS.push(siNext);
  }

  const n = prof.length;
  const positions: number[] = [];
  const uvs: number[] = [];

  // Perimeter cumulative arc-length for clean UVs
  const profArc: number[] = [0];
  let totalPerim = 0;
  for (let j = 1; j < n; j++) {
    totalPerim += Math.hypot(prof[j][0] - prof[j - 1][0], prof[j][1] - prof[j - 1][1]);
    profArc.push(totalPerim);
  }
  if (closedProfile && n > 1) {
    totalPerim += Math.hypot(prof[0][0] - prof[n - 1][0], prof[0][1] - prof[n - 1][1]);
  }
  const invPerim = totalPerim > 1e-6 ? 1 / totalPerim : 1;
  const curveLen = Math.max(0.05, curve.getLength());

  const side = new THREE.Vector3();
  const lift = new THREE.Vector3();

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const twist = opts.twistFn ? opts.twistFn(t) : 0;
    const cosT = Math.cos(twist);
    const sinT = Math.sin(twist);
    side.copy(normalsR[i]).multiplyScalar(cosT).addScaledVector(binormalsS[i], sinT);
    lift.copy(binormalsS[i]).multiplyScalar(cosT).addScaledVector(normalsR[i], -sinT);

    const sc = opts.scaleFn ? opts.scaleFn(t) : 1;
    const sx = Array.isArray(sc) ? sc[0] : sc;
    const sy = Array.isArray(sc) ? sc[1] : sc;

    const c = centers[i];
    for (let j = 0; j < n; j++) {
      const px = prof[j][0] * sx;
      const py = prof[j][1] * sy;
      positions.push(
        c.x + side.x * px + lift.x * py,
        c.y + side.y * px + lift.y * py,
        c.z + side.z * px + lift.z * py,
      );
      uvs.push(profArc[j] * invPerim * 2, t * curveLen * 4);
    }
  }

  const indices: number[] = [];
  const segCount = closedProfile ? n : n - 1;
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < segCount; j++) {
      const j2 = (j + 1) % n;
      const a = i * n + j;
      const b = i * n + j2;
      const c = (i + 1) * n + j;
      const d = (i + 1) * n + j2;
      indices.push(a, c, b, b, c, d);
    }
  }

  if (opts.caps && !opts.closedPath && closedProfile && n >= 3) {
    const contour = prof.map(([x, y]) => new THREE.Vector2(x, y));
    const capTris = THREE.ShapeUtils.triangulateShape(contour, []);
    const addCap = (ringStart: number, flip: boolean) => {
      const baseIdx = positions.length / 3;
      for (let j = 0; j < n; j++) {
        const src = (ringStart + j) * 3;
        positions.push(positions[src], positions[src + 1], positions[src + 2]);
        uvs.push(prof[j][0] * 4, prof[j][1] * 4);
      }
      for (const [ia, ib, ic] of capTris) {
        if (flip) indices.push(baseIdx + ia, baseIdx + ic, baseIdx + ib);
        else indices.push(baseIdx + ia, baseIdx + ib, baseIdx + ic);
      }
    };
    addCap(0, true);
    addCap(steps * n, false);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return creaseAngle > 0 ? toCreasedNormals(geo, creaseAngle) : geo;
}

/** Loft a single smooth parametric surface (for glass panes and decals) */
export function loftSurface(
  fn: (u: number, v: number, out: THREE.Vector3) => void,
  uSeg = 32,
  vSeg = 20,
  closeU = false,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const p = new THREE.Vector3();
  for (let i = 0; i <= uSeg; i++) {
    const u = i / uSeg;
    for (let j = 0; j <= vSeg; j++) {
      const v = j / vSeg;
      fn(u, v, p);
      positions.push(p.x, p.y, p.z);
      uvs.push(u * 2, v * 2);
    }
  }
  const stride = vSeg + 1;
  void closeU;
  for (let i = 0; i < uSeg; i++) {
    for (let j = 0; j < vSeg; j++) {
      const a = i * stride + j;
      const b = a + stride;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Loft a watertight thick structural shell from a parametric outer surface (u,v) -> point.
 * Offsets along local surface normal by `thickness` and stitches all 4 perimeter edge walls!
 * Eliminates zero-thickness paper sheets on hull skins, glare shields, and composite shells.
 */
export function loftThickShell(
  fn: (u: number, v: number, out: THREE.Vector3) => void,
  thickness: number,
  uSeg = 32,
  vSeg = 18,
  creaseAngle = 0.72,
): THREE.BufferGeometry {
  const stride = vSeg + 1;
  const count = (uSeg + 1) * stride;
  const outerPts: THREE.Vector3[] = new Array(count);
  const innerPts: THREE.Vector3[] = new Array(count);

  const p = new THREE.Vector3();
  const pu = new THREE.Vector3();
  const pv = new THREE.Vector3();
  const du = new THREE.Vector3();
  const dv = new THREE.Vector3();
  const nrm = new THREE.Vector3();
  const eps = 1e-3;

  for (let i = 0; i <= uSeg; i++) {
    const u = i / uSeg;
    for (let j = 0; j <= vSeg; j++) {
      const v = j / vSeg;
      fn(u, v, p);
      const u1 = Math.min(1, u + eps);
      const u0 = Math.max(0, u - eps);
      const v1 = Math.min(1, v + eps);
      const v0 = Math.max(0, v - eps);

      fn(u1, v, pu);
      fn(u0, v, du);
      du.subVectors(pu, du);

      fn(u, v1, pv);
      fn(u, v0, dv);
      dv.subVectors(pv, dv);

      nrm.crossVectors(du, dv).normalize();
      const idx = i * stride + j;
      outerPts[idx] = p.clone();
      innerPts[idx] = p.clone().addScaledVector(nrm, -thickness);
    }
  }

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  // 0..count-1: outer, count..2*count-1: inner
  for (let i = 0; i <= uSeg; i++) {
    for (let j = 0; j <= vSeg; j++) {
      const pt = outerPts[i * stride + j];
      positions.push(pt.x, pt.y, pt.z);
      uvs.push((i / uSeg) * 3, (j / vSeg) * 3);
    }
  }
  for (let i = 0; i <= uSeg; i++) {
    for (let j = 0; j <= vSeg; j++) {
      const pt = innerPts[i * stride + j];
      positions.push(pt.x, pt.y, pt.z);
      uvs.push((i / uSeg) * 3, (j / vSeg) * 3);
    }
  }

  // Outer & inner faces
  for (let i = 0; i < uSeg; i++) {
    for (let j = 0; j < vSeg; j++) {
      const a = i * stride + j;
      const b = a + stride;
      indices.push(a, b, a + 1, b, b + 1, a + 1);

      const ia = count + a;
      const ib = count + b;
      indices.push(ia, ia + 1, ib, ib, ia + 1, ib + 1);
    }
  }

  // Stitch perimeter edges (v=0, v=vSeg, u=0, u=uSeg)
  const addQuad = (o0: number, o1: number, i0: number, i1: number) => {
    const base = positions.length / 3;
    for (const k of [o0, o1, i0, i1]) {
      positions.push(positions[k * 3], positions[k * 3 + 1], positions[k * 3 + 2]);
    }
    uvs.push(0, 0, 1, 0, 0, 0.2, 1, 0.2);
    indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
  };

  for (let i = 0; i < uSeg; i++) {
    // v = 0 edge
    const a0 = i * stride;
    const b0 = (i + 1) * stride;
    addQuad(b0, a0, count + b0, count + a0);
    // v = vSeg edge
    const a1 = i * stride + vSeg;
    const b1 = (i + 1) * stride + vSeg;
    addQuad(a1, b1, count + a1, count + b1);
  }
  for (let j = 0; j < vSeg; j++) {
    // u = 0 edge
    const a0 = j;
    const b0 = j + 1;
    addQuad(a0, b0, count + a0, count + b0);
    // u = uSeg edge
    const a1 = uSeg * stride + j;
    const b1 = uSeg * stride + j + 1;
    addQuad(b1, a1, count + b1, count + a1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return toCreasedNormals(geo, creaseAngle);
}

/**
 * Multi-station closed-profile loft (skins smooth cross-sections through 3D stations).
 * Ideal for sculpted pistol grips, contoured seat bolsters, and tapered housings.
 */
export interface LoftStation {
  origin: THREE.Vector3;
  xDir: THREE.Vector3;
  yDir: THREE.Vector3;
  profile: ProfilePoint[];
}

export function loftStations(
  stations: LoftStation[],
  caps = true,
  creaseAngle = 0.75,
): THREE.BufferGeometry {
  const m = stations.length;
  const n = stations[0].profile.length;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i < m; i++) {
    const st = stations[i];
    const ux = st.xDir.clone().normalize();
    const uy = st.yDir.clone().normalize();
    for (let j = 0; j < n; j++) {
      const [px, py] = st.profile[j];
      positions.push(
        st.origin.x + ux.x * px + uy.x * py,
        st.origin.y + ux.y * px + uy.y * py,
        st.origin.z + ux.z * px + uy.z * py,
      );
      uvs.push(j / n, i / Math.max(1, m - 1));
    }
  }

  for (let i = 0; i < m - 1; i++) {
    for (let j = 0; j < n; j++) {
      const j2 = (j + 1) % n;
      const a = i * n + j;
      const b = i * n + j2;
      const c = (i + 1) * n + j;
      const d = (i + 1) * n + j2;
      indices.push(a, c, b, b, c, d);
    }
  }

  if (caps && n >= 3) {
    const capStation = (stIdx: number, flip: boolean) => {
      const contour = stations[stIdx].profile.map(([x, y]) => new THREE.Vector2(x, y));
      const tris = THREE.ShapeUtils.triangulateShape(contour, []);
      const base = positions.length / 3;
      const ringStart = stIdx * n;
      for (let j = 0; j < n; j++) {
        const s = (ringStart + j) * 3;
        positions.push(positions[s], positions[s + 1], positions[s + 2]);
        uvs.push(stations[stIdx].profile[j][0] * 3, stations[stIdx].profile[j][1] * 3);
      }
      for (const [ia, ib, ic] of tris) {
        if (flip) indices.push(base + ia, base + ic, base + ib);
        else indices.push(base + ia, base + ib, base + ic);
      }
    };
    capStation(0, true);
    capStation(m - 1, false);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return creaseAngle > 0 ? toCreasedNormals(geo, creaseAngle) : geo;
}

export function roundedRectPath(cx: number, cy: number, w: number, h: number, r: number): THREE.Path {
  const p = new THREE.Path();
  const x = cx - w / 2;
  const y = cy - h / 2;
  const rr = Math.min(r, w * 0.49, h * 0.49);
  p.moveTo(x + rr, y);
  p.lineTo(x + w - rr, y);
  p.quadraticCurveTo(x + w, y, x + w, y + rr);
  p.lineTo(x + w, y + h - rr);
  p.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  p.lineTo(x + rr, y + h);
  p.quadraticCurveTo(x, y + h, x, y + h - rr);
  p.lineTo(x, y + rr);
  p.quadraticCurveTo(x, y, x + rr, y);
  return p;
}

export function circleHolePath(cx: number, cy: number, radius: number, segs = 24): THREE.Path {
  const p = new THREE.Path();
  p.absarc(cx, cy, radius, 0, Math.PI * 2, false);
  void segs;
  return p;
}

export function roundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  const rr = Math.min(r, w / 2, h / 2);
  s.moveTo(x + rr, y);
  s.lineTo(x + w - rr, y);
  s.quadraticCurveTo(x + w, y, x + w, y + rr);
  s.lineTo(x + w, y + h - rr);
  s.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  s.lineTo(x + rr, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - rr);
  s.lineTo(x, y + rr);
  s.quadraticCurveTo(x, y, x + rr, y);
  return s;
}

export function polygonToShape(corners: FilletedCorner[], defaultR = 0.004, arcSegs = 5): THREE.Shape {
  const pts = filletPolygon2D(corners, defaultR, arcSegs, true);
  const s = new THREE.Shape();
  if (pts.length === 0) return s;
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    s.lineTo(pts[i][0], pts[i][1]);
  }
  s.closePath();
  return s;
}

/**
 * Extrude a machined aerospace plate/bezel/frame with true cut-out holes/slots
 * and inward-compensated bevels so outer assembly dimensions stay exact.
 */
export function machinedPlate(
  outer: THREE.Shape,
  opts: {
    holes?: THREE.Path[];
    depth: number;
    bevel?: number;
    bevelSegments?: number;
    curveSegments?: number;
    creaseAngle?: number;
    centerZ?: boolean;
  },
): THREE.BufferGeometry {
  if (opts.holes) {
    for (const h of opts.holes) outer.holes.push(h);
  }
  const bevel = opts.bevel ?? 0.002;
  const geo = new THREE.ExtrudeGeometry(outer, {
    depth: Math.max(0.001, opts.depth - bevel * 2),
    bevelEnabled: bevel > 0,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelOffset: -bevel,
    bevelSegments: opts.bevelSegments ?? 2,
    curveSegments: opts.curveSegments ?? 14,
  });
  if (opts.centerZ) {
    geo.translate(0, 0, -(opts.depth * 0.5 - bevel));
  } else if (bevel > 0) {
    geo.translate(0, 0, bevel);
  }
  geo.computeVertexNormals();
  return toCreasedNormals(geo, opts.creaseAngle ?? 0.62);
}

/** Create a hollow picture-frame bezel with chamfered inner sight-line */
export function machinedBezel(
  outerW: number,
  outerH: number,
  innerW: number,
  innerH: number,
  depth: number,
  outerR = 0.014,
  innerR = 0.008,
  bevel = 0.0025,
): THREE.BufferGeometry {
  const shape = roundedRectShape(outerW, outerH, outerR);
  const hole = roundedRectPath(0, 0, innerW, innerH, innerR);
  return machinedPlate(shape, { holes: [hole], depth, bevel, bevelSegments: 2, centerZ: true });
}

export function panelGeometry(
  w: number,
  h: number,
  r: number,
  depth: number,
  bevel = 0.003,
): THREE.BufferGeometry {
  return machinedPlate(roundedRectShape(w, h, r), { depth, bevel, centerZ: false });
}

export function shapeExtrude(
  shape: THREE.Shape,
  depth: number,
  bevel = 0.003,
): THREE.BufferGeometry {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelOffset: bevel > 0 ? -bevel * 0.5 : 0,
    bevelSegments: 2,
    curveSegments: 14,
  });
  geo.computeVertexNormals();
  return toCreasedNormals(geo, 0.65);
}

export function roundedBox(w: number, h: number, d: number, r = 0.006, seg = 3): RoundedBoxGeometry {
  return new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w * 0.45, h * 0.45, d * 0.45));
}

/** Turned CNC lathe solid with creased shoulders */
export function latheMachined(
  pts: [number, number][],
  segments = 32,
  creaseAngle = 0.58,
  phiLength = Math.PI * 2,
): THREE.BufferGeometry {
  const v2 = pts.map(([r, y]) => new THREE.Vector2(Math.max(0.0001, r), y));
  const geo = new THREE.LatheGeometry(v2, segments, 0, phiLength);
  geo.computeVertexNormals();
  return toCreasedNormals(geo, creaseAngle);
}

/**
 * Watertight sinusoidal corrugated bellows / O2 umbilical hose swept with RMF.
 * Replaces floating torus rings with a continuous molded elastomer bellows.
 */
export function corrugatedTube(
  points: THREE.Vector3[],
  baseRadius: number,
  ribHeight: number,
  ribCount: number,
  radialSegs = 20,
  tubularSegs = 120,
): THREE.BufferGeometry {
  const circle: ProfilePoint[] = [];
  for (let i = 0; i < radialSegs; i++) {
    const a = (i / radialSegs) * Math.PI * 2;
    circle.push([Math.cos(a) * baseRadius, Math.sin(a) * baseRadius]);
  }
  return sweepProfile(points, circle, {
    steps: tubularSegs,
    caps: true,
    creaseAngle: 1.15,
    scaleFn: (t) => {
      const endFade = Math.min(1, Math.min(t, 1 - t) * 14);
      const wave = 0.5 - 0.5 * Math.cos(t * Math.PI * 2 * ribCount);
      return 1 + (ribHeight / baseRadius) * wave * endFade;
    },
  });
}

/** Counterbored socket-head cap screw + captive washer geometry */
export function boltGeometry(radius = 0.0055, height = 0.0042): THREE.BufferGeometry {
  // Turned stepped socket-head cap screw with chamfered crown and socket recess
  return latheMachined([
    [0.0001, 0],
    [radius * 1.48, 0],
    [radius * 1.48, height * 0.24],
    [radius * 1.0, height * 0.26],
    [radius * 1.0, height * 0.88],
    [radius * 0.86, height],
    [radius * 0.48, height],
    [radius * 0.44, height * 0.52],
    [0.0001, height * 0.52],
  ], 12, 0.55);
}

export interface BoltPlacement {
  position: THREE.Vector3;
  normal: THREE.Vector3;
  scale?: number;
}

export function fastenerInstances(
  placements: BoltPlacement[],
  material: THREE.Material,
  radius = 0.0052,
  height = 0.004,
): THREE.Group {
  const group = new THREE.Group();
  if (placements.length === 0) return group;
  const geo = boltGeometry(radius, height);
  const inst = new THREE.InstancedMesh(geo, material, placements.length);
  inst.castShadow = true;
  inst.receiveShadow = true;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const s = new THREE.Vector3(1, 1, 1);
  placements.forEach((p, i) => {
    const nrm = p.normal.clone().normalize();
    q.setFromUnitVectors(up, nrm);
    const sc = p.scale ?? 1;
    s.set(sc, sc, sc);
    m.compose(p.position.clone().addScaledVector(nrm, -height * 0.12 * sc), q, s);
    inst.setMatrixAt(i, m);
  });
  inst.instanceMatrix.needsUpdate = true;
  group.add(inst);
  return group;
}

/**
 * MIL-STD-1472H tactile-coded aerospace control knobs:
 * - 'fluted': 10-flute rotary selector knob with chamfered skirt & pointer bar
 * - 'encoder': fine-knurled dual-concentric encoder (MCP speed/altitude style)
 * - 'pointer': tapered wedge pointer selector (ECS / bus mode selector)
 */
export function buildKnob(
  radius: number,
  height: number,
  material: THREE.Material,
  accent: THREE.Material,
  kind: 'fluted' | 'encoder' | 'pointer' = 'fluted',
): THREE.Group {
  const g = new THREE.Group();
  if (kind === 'encoder') {
    const outer = new THREE.Mesh(
      latheMachined([
        [0.0002, 0],
        [radius * 1.18, 0],
        [radius * 1.18, height * 0.14],
        [radius * 1.04, height * 0.2],
        [radius * 1.04, height * 0.56],
        [radius * 0.94, height * 0.62],
        [radius * 0.72, height * 0.62],
        [radius * 0.72, height * 0.94],
        [radius * 0.64, height],
        [0.0002, height],
      ], 28),
      material,
    );
    outer.castShadow = true;
    g.add(outer);
    const ring = new THREE.Mesh(
      latheMachined([
        [radius * 0.62, height * 0.62],
        [radius * 0.75, height * 0.62],
        [radius * 0.75, height * 0.68],
        [radius * 0.62, height * 0.68],
      ], 24),
      accent,
    );
    g.add(ring);
    return g;
  }

  // Skirted base + fluted/polygon body
  const skirt = new THREE.Mesh(
    latheMachined([
      [0.0002, 0],
      [radius * 1.16, 0],
      [radius * 1.14, height * 0.14],
      [radius * 0.96, height * 0.22],
      [0.0002, height * 0.22],
    ], 28),
    material,
  );
  skirt.castShadow = true;
  g.add(skirt);

  if (kind === 'pointer') {
    const sh = polygonToShape([
      [-radius * 0.72, -radius * 0.55, radius * 0.22],
      [radius * 0.72, -radius * 0.55, radius * 0.22],
      [radius * 0.28, radius * 1.18, radius * 0.12],
      [-radius * 0.28, radius * 1.18, radius * 0.12],
    ], radius * 0.15, 4);
    const wedge = new THREE.Mesh(machinedPlate(sh, { depth: height * 0.8, bevel: 0.0018 }), material);
    wedge.rotation.x = -Math.PI / 2;
    wedge.position.y = height * 0.2;
    wedge.castShadow = true;
    g.add(wedge);

    const stripe = new THREE.Mesh(roundedBox(radius * 0.16, 0.0025, radius * 0.92, 0.0008, 2), accent);
    stripe.position.set(0, height + 0.0005, -radius * 0.22);
    g.add(stripe);
    return g;
  }

  // Fluted star profile
  const flutes = 10;
  const corners: FilletedCorner[] = [];
  for (let i = 0; i < flutes * 2; i++) {
    const a = (i / (flutes * 2)) * Math.PI * 2;
    const rr = i % 2 === 0 ? radius : radius * 0.87;
    corners.push([Math.cos(a) * rr, Math.sin(a) * rr, radius * 0.09]);
  }
  const barrel = new THREE.Mesh(
    machinedPlate(polygonToShape(corners, radius * 0.08, 3), { depth: height * 0.8, bevel: 0.002 }),
    material,
  );
  barrel.rotation.x = -Math.PI / 2;
  barrel.position.y = height * 0.2;
  barrel.castShadow = true;
  g.add(barrel);

  const indexBar = new THREE.Mesh(roundedBox(radius * 0.16, 0.0026, radius * 0.74, 0.0008, 2), accent);
  indexBar.position.set(0, height + 0.0006, -radius * 0.22);
  g.add(indexBar);
  return g;
}

/**
 * MIL-DTL-3950 aerospace toggle switch with hex locknut, keyed tab washer,
 * stepped threaded bushing, bat-handle lever, and optional hinged U-channel safety guard!
 */
export function buildToggle(
  metal: THREE.Material,
  cap: THREE.Material,
  guard: THREE.Material | null,
  guardedClosed = false,
): THREE.Group {
  const g = new THREE.Group();

  // Keyed locking washer + hex mounting nut + threaded collar
  const washer = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.0014, 20), metal);
  washer.position.y = 0.0007;
  g.add(washer);

  const hexNut = new THREE.Mesh(new THREE.CylinderGeometry(0.0088, 0.0088, 0.0042, 6), metal);
  hexNut.position.y = 0.0035;
  g.add(hexNut);

  const bushing = new THREE.Mesh(
    latheMachined([
      [0.0002, 0.005],
      [0.0062, 0.005],
      [0.0062, 0.011],
      [0.0048, 0.012],
      [0.0035, 0.012],
      [0.0032, 0.008],
      [0.0002, 0.008],
    ], 18),
    metal,
  );
  g.add(bushing);

  // Pivoted bat-handle lever
  const leverGroup = new THREE.Group();
  leverGroup.position.set(0, 0.0095, 0);
  leverGroup.rotation.x = guardedClosed ? 0.22 : -0.34;
  g.add(leverGroup);

  const bat = new THREE.Mesh(
    latheMachined([
      [0.0034, 0],
      [0.0022, 0.007],
      [0.0028, 0.016],
      [0.0048, 0.024],
      [0.0045, 0.027],
      [0.0022, 0.0285],
      [0.0001, 0.0288],
    ], 16),
    metal,
  );
  bat.castShadow = true;
  leverGroup.add(bat);

  const tipCap = new THREE.Mesh(
    latheMachined([
      [0.0035, 0.018],
      [0.0052, 0.024],
      [0.0049, 0.0275],
      [0.0024, 0.0292],
      [0.0001, 0.0295],
    ], 16),
    cap,
  );
  leverGroup.add(tipCap);

  // Real MIL-spec hinged U-channel safety flip-guard (Boeing / Apollo / A-10C style)
  if (guard) {
    const baseBracket = new THREE.Mesh(
      machinedPlate(roundedRectShape(0.024, 0.036, 0.003), {
        holes: [circleHolePath(0, 0.002, 0.0068)],
        depth: 0.002,
        bevel: 0.0004,
      }),
      metal,
    );
    baseBracket.rotation.x = -Math.PI / 2;
    baseBracket.position.y = 0.0003;
    g.add(baseBracket);

    // Hinge ears at rear (-Z)
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(roundedBox(0.0026, 0.013, 0.011, 0.001, 2), metal);
      ear.position.set(sx * 0.0102, 0.007, -0.013);
      g.add(ear);
    }
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.0016, 0.0016, 0.025, 10), metal);
    pin.rotation.z = Math.PI / 2;
    pin.position.set(0, 0.011, -0.014);
    g.add(pin);

    // Pivoted U-channel cover
    const coverPivot = new THREE.Group();
    coverPivot.position.set(0, 0.011, -0.014);
    coverPivot.rotation.x = guardedClosed ? 0.04 : -1.52;
    g.add(coverPivot);

    const uProfile = cChannelProfile(0.023, 0.021, 0.0024, 0.0015);
    // Rotate C-channel so opening faces downward (-Y) when closed
    const orientedU: ProfilePoint[] = uProfile.map(([px, py]) => [py, -px]);
    const channel = new THREE.Mesh(
      sweepProfile(
        [new THREE.Vector3(0, 0.009, -0.002), new THREE.Vector3(0, 0.009, 0.034)],
        orientedU,
        { steps: 4, up: new THREE.Vector3(0, 1, 0), caps: true, creaseAngle: 0.6 },
      ),
      guard,
    );
    channel.castShadow = true;
    coverPivot.add(channel);
  }

  return g;
}

/** Korry-style recessed split-legend aerospace pushbutton annunciator */
export function buildKorrySwitch(
  w: number,
  h: number,
  bezelMat: THREE.Material,
  upperMat: THREE.Material,
  lowerMat: THREE.Material,
): THREE.Group {
  const g = new THREE.Group();
  const collar = new THREE.Mesh(
    machinedBezel(w + 0.007, h + 0.007, w, h, 0.009, 0.0025, 0.0012, 0.001),
    bezelMat,
  );
  collar.rotation.x = -Math.PI / 2;
  collar.position.y = 0.0045;
  collar.castShadow = true;
  g.add(collar);

  const halfH = (h - 0.0026) * 0.5;
  const topCap = new THREE.Mesh(roundedBox(w - 0.0018, 0.0055, halfH, 0.0008, 2), upperMat);
  topCap.position.set(0, 0.0052, -(halfH * 0.5 + 0.0008));
  g.add(topCap);

  const botCap = new THREE.Mesh(roundedBox(w - 0.0018, 0.0055, halfH, 0.0008, 2), lowerMat);
  botCap.position.set(0, 0.0052, halfH * 0.5 + 0.0008);
  g.add(botCap);
  return g;
}

/** Aerospace thermal pull-type circuit breaker with white rating band */
export function buildCircuitBreaker(
  metalMat: THREE.Material,
  bandMat: THREE.Material,
  capMat: THREE.Material,
  tripped = false,
): THREE.Group {
  const g = new THREE.Group();
  const hex = new THREE.Mesh(new THREE.CylinderGeometry(0.0072, 0.0072, 0.0032, 6), metalMat);
  hex.position.y = 0.0016;
  g.add(hex);

  const lift = tripped ? 0.0045 : 0;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.0046, 0.0046, 0.0045, 16), bandMat);
  band.position.y = 0.005 + lift * 0.6;
  g.add(band);

  const cap = new THREE.Mesh(
    latheMachined([
      [0.0001, 0.0065],
      [0.0062, 0.0065],
      [0.0066, 0.008],
      [0.0066, 0.0125],
      [0.0054, 0.014],
      [0.0001, 0.014],
    ], 18),
    capMat,
  );
  cap.position.y = lift;
  cap.castShadow = true;
  g.add(cap);
  return g;
}

/** MIL-DTL-38999 circular bayonet connector + backshell */
export function buildCircularConnector(
  radius: number,
  shellMat: THREE.Material,
  ringMat: THREE.Material,
  bootMat: THREE.Material,
): THREE.Group {
  const g = new THREE.Group();
  const flange = new THREE.Mesh(
    machinedPlate(roundedRectShape(radius * 2.9, radius * 2.9, radius * 0.35), {
      depth: 0.0035,
      bevel: 0.0006,
    }),
    shellMat,
  );
  flange.rotation.x = -Math.PI / 2;
  g.add(flange);

  const barrel = new THREE.Mesh(
    latheMachined([
      [0.0002, 0.003],
      [radius * 1.02, 0.003],
      [radius * 1.02, 0.015],
      [radius * 1.18, 0.016],
      [radius * 1.18, 0.028],
      [radius * 0.96, 0.03],
      [radius * 0.92, 0.042],
      [radius * 0.68, 0.05],
      [0.0002, 0.05],
    ], 24),
    shellMat,
  );
  barrel.castShadow = true;
  g.add(barrel);

  const bayonetRing = new THREE.Mesh(
    latheMachined([
      [radius * 1.0, 0.017],
      [radius * 1.24, 0.017],
      [radius * 1.24, 0.025],
      [radius * 1.0, 0.025],
    ], 24),
    ringMat,
  );
  g.add(bayonetRing);

  const boot = new THREE.Mesh(
    latheMachined([
      [0.0002, 0.048],
      [radius * 0.72, 0.048],
      [radius * 0.56, 0.068],
      [0.0002, 0.068],
    ], 18),
    bootMat,
  );
  g.add(boot);
  return g;
}

/** Adel MS21919 cushioned P-clamp wrapping a tube/harness */
export function buildAdelClamp(
  tubeRadius: number,
  bandMat: THREE.Material,
  cushionMat: THREE.Material,
): THREE.Group {
  const g = new THREE.Group();
  const r = tubeRadius + 0.0022;
  const cushion = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.0014, r + 0.0014, 0.012, 20, 1, true), cushionMat);
  cushion.rotation.z = Math.PI / 2;
  g.add(cushion);

  const band = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.0026, r + 0.0026, 0.009, 20, 1, true), bandMat);
  band.rotation.z = Math.PI / 2;
  g.add(band);

  const tang = new THREE.Mesh(roundedBox(0.01, 0.0032, r + 0.018, 0.001, 2), bandMat);
  tang.position.set(0, -r - 0.001, (r + 0.018) * 0.45);
  g.add(tang);

  const bolt = new THREE.Mesh(boltGeometry(0.0032, 0.003), bandMat);
  bolt.position.set(0, -r + 0.001, r + 0.011);
  g.add(bolt);
  return g;
}

export function tube(
  points: THREE.Vector3[],
  radius: number,
  material: THREE.Material,
  radial = 12,
  tubular = 56,
): THREE.Mesh {
  const circle: ProfilePoint[] = [];
  for (let i = 0; i < radial; i++) {
    const a = (i / radial) * Math.PI * 2;
    circle.push([Math.cos(a) * radius, Math.sin(a) * radius]);
  }
  const geo = sweepProfile(points, circle, { steps: tubular, caps: true, creaseAngle: 1.2 });
  const m = new THREE.Mesh(geo, material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function makeLabelPlane(
  texture: THREE.Texture,
  w: number,
  h: number,
  opacity = 1,
): THREE.Mesh {
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity,
    depthWrite: false,
    toneMapped: false,
    side: THREE.FrontSide, // FrontSide prevents mirrored text through backfaces!
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
}

export { mergeGeometries, toCreasedNormals };
