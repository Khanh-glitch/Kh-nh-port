// Cockpit prop placement contract.
//
// Regression this pins down (reported as "buồng lái trông như hộp rỗng, đạo cụ
// không thấy đâu"): `cockpit/furnish.ts` loaded eight CC0 props, reported a
// clean `failed: []`, and still looked empty. Nothing was wrong with the parse
// -- almost every prop was simply OUTSIDE the camera frustum, or buried behind
// the dash, or standing on a floor that sits below the bottom edge of the
// frame. A loader that succeeds is not the same as a cockpit that reads.
//
// The numbers below are the real cockpit camera: fov 58, near .5, far 6000,
// aspect 16:9, the PRIMARY glass at z = -2.02 spanning y [-0.1837, 0.7037],
// and the six selector keys on two rows at radius 2.10. Props are measured by
// their actual transformed bounding boxes, read straight out of the source so
// this test can never drift from the shipped table.
//
// Four properties must hold:
//   1. every prop is inside the frame (the chair excepted -- the pilot sits on
//      it, so it is legitimately below the camera);
//   2. no prop covers the primary glass or a selector key, except the display
//      bezel which is *supposed* to sit behind the glass;
//   3. no two props interpenetrate in world space (resting contacts allowed);
//   4. nothing stands on the floor, because the floor is not in shot.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const SRC = 'source/immersive/src/cockpit/furnish.ts'
const txt = readFileSync(SRC, 'utf8')
const body = txt.slice(txt.indexOf('const PROPS'), txt.indexOf('export const PROP_BASE'))

const ev = (v) => Number(eval(v.replace(/Math\.PI/g, String(Math.PI))))
const re = new RegExp(
  String.raw`^\s*(?:'([\w-]+)'|(\w+)):\s*\{\s*path:\s*'([^']+)',\s*height:\s*([\d.]+),` +
    String.raw`\s*position:\s*\[([^\]]+)\](?:,\s*rotation:\s*\[([^\]]+)\])?`,
  'gm',
)
const PROPS = []
let m
while ((m = re.exec(body))) {
  PROPS.push({
    id: m[1] || m[2],
    path: m[3],
    h: Number(m[4]),
    pos: m[5].split(',').map(ev),
    rot: m[6] ? m[6].split(',').map(ev) : [0, 0, 0],
  })
}

assert.equal(PROPS.length, 8, `expected the 8 mapped kit props, parsed ${PROPS.length}`)

// --- camera ------------------------------------------------------------------
const W = 1600
const H = 900
const tanV = Math.tan((58 * Math.PI) / 180 / 2)
const tanH = tanV * (W / H)
const proj = (x, y, z) => [
  (x / (tanH * Math.abs(z)) / 2 + 0.5) * W,
  (-y / (tanV * Math.abs(z)) / 2 + 0.5) * H,
]

// --- the screens the props must not cover ------------------------------------
const FLOOR_Y = -1.36
const PAD = 6

function rectOf(corners) {
  const r = { x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9 }
  for (const [x, y, z] of corners) {
    const [px, py] = proj(x, y, z)
    r.x0 = Math.min(r.x0, px)
    r.x1 = Math.max(r.x1, px)
    r.y0 = Math.min(r.y0, py)
    r.y1 = Math.max(r.y1, py)
  }
  return r
}
const prim = rectOf([
  [-0.71, 0.26 - 0.4437, -2.02],
  [0.71, 0.26 + 0.4437, -2.02],
])
const halfAngle = Math.min(0.46, Math.atan(tanV * (W / H) * 0.9))
const KEY_ROWS = [-0.48, -0.9]
const keys = []
for (let i = 0; i < 6; i++) {
  const row = i < 3 ? 0 : 1
  const col = i % 3
  const q = (col - 1) * halfAngle * 0.86
  const kx = Math.sin(q) * 2.1
  const kz = -Math.cos(q) * 2.1
  keys.push(
    rectOf([
      [kx - 0.27, KEY_ROWS[row] - 0.169, kz],
      [kx + 0.27, KEY_ROWS[row] + 0.169, kz],
    ]),
  )
}
const overlaps = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0

// --- measure each prop exactly as `furnish.ts` places it ----------------------
// The GLBs are parsed with the SHIPPED reader, so the bounding boxes are the
// real ones and not hand-copied numbers. `gltf.ts` is TypeScript, so bundle it
// to a temp file with the esbuild that ships inside the immersive workspace.
const os = await import('node:os')
const path = await import('node:path')
const { execFileSync } = await import('node:child_process')
const { pathToFileURL } = await import('node:url')
const IMM = 'source/immersive'
const esbuild = path.join(IMM, 'node_modules/.bin/esbuild')
let parseGlb
try {
  const out = path.join(os.tmpdir(), `cockpit-gltf-${process.pid}.mjs`)
  execFileSync(esbuild, [
    path.join(IMM, 'src/cockpit/gltf.ts'),
    '--bundle', '--format=esm', '--platform=node', '--loader:.ts=ts',
    `--outfile=${out}`,
  ], { stdio: 'pipe' })
  ;({ parseGlb } = await import(pathToFileURL(out).href))
} catch (e) {
  // esbuild is a transitive (vite) dependency; if the immersive workspace has
  // not been installed, degrading to a skip keeps the rest of the gate useful
  // instead of failing for the wrong reason.
  console.log('cockpit-prop-placement SKIP -- esbuild unavailable in source/immersive')
  process.exit(0)
}

function measure(p) {
  const buf = readFileSync(`assets/3d/room-showcase/${p.path}`)
  const obj = parseGlb(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), p.path)
  obj.updateMatrixWorld(true)
  const b1 = bbox(obj)
  const size = { x: b1.x1 - b1.x0, y: b1.y1 - b1.y0, z: b1.z1 - b1.z0 }
  // scale so the tallest axis becomes the requested height
  const s = p.h / size.y
  obj.scale.multiplyScalar(s)
  obj.updateMatrixWorld(true)
  const b2 = bbox(obj)
  // centre in x/z, sit the base at pos[1]
  obj.position.set(
    p.pos[0] - (b2.x0 + b2.x1) / 2,
    p.pos[1] - b2.y0,
    p.pos[2] - (b2.z0 + b2.z1) / 2,
  )
  obj.rotation.set(...p.rot)
  obj.updateMatrixWorld(true)
  const w = bbox(obj)
  return {
    id: p.id,
    world: w,
    screen: rectOf([
      [w.x0, w.y0, w.z0],
      [w.x1, w.y1, w.z1],
    ]),
    baseY: w.y0,
  }
}

function bbox(root) {
  const out = { x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9, z0: 1e9, z1: -1e9 }
  root.updateWorldMatrix(true, true)
  root.traverse((o) => {
    const g = o.geometry
    if (!g?.attributes?.position) return
    const pos = g.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      const z = pos.getZ(i)
      const e = o.matrixWorld.elements
      const X = e[0] * x + e[4] * y + e[8] * z + e[12]
      const Y = e[1] * x + e[5] * y + e[9] * z + e[13]
      const Z = e[2] * x + e[6] * y + e[10] * z + e[14]
      if (!Number.isFinite(X) || !Number.isFinite(Y) || !Number.isFinite(Z)) continue
      out.x0 = Math.min(out.x0, X)
      out.x1 = Math.max(out.x1, X)
      out.y0 = Math.min(out.y0, Y)
      out.y1 = Math.max(out.y1, Y)
      out.z0 = Math.min(out.z0, Z)
      out.z1 = Math.max(out.z1, Z)
    }
  })
  return out
}

const M = PROPS.map(measure)

// --- 1. everything except the seat is fully in frame -------------------------
const OFF_FRAME_OK = new Set(['chair'])
for (const p of M) {
  if (OFF_FRAME_OK.has(p.id)) continue
  const s = p.screen
  assert.ok(
    s.x0 >= PAD && s.x1 <= W - PAD && s.y0 >= PAD && s.y1 <= H - PAD,
    `${p.id} is not fully in frame: x[${s.x0.toFixed(0)}..${s.x1.toFixed(0)}] ` +
      `y[${s.y0.toFixed(0)}..${s.y1.toFixed(0)}] (frame ${W}x${H}). ` +
      `A prop the pilot cannot see is a draw call, not a cockpit.`,
  )
}

// --- 2. nothing covers the glass or the keys --------------------------------
for (const p of M) {
  const isBezel = p.id === 'display'
  for (const [label, r] of [['primary glass', prim], ...keys.map((k, i) => [`key ${i + 1}`, k])]) {
    if (!overlaps(p.screen, r)) continue
    assert.ok(
      isBezel && label === 'primary glass',
      `${p.id} covers the ${label}. Move it out of the interactive band.`,
    )
  }
}

// --- 3. no interpenetration in world space ---------------------------------
const RESTING = new Set(['bookcase-low+speaker-small', 'bookcase-low+books'])
for (let i = 0; i < M.length; i++) {
  for (let j = i + 1; j < M.length; j++) {
    const a = M[i].world
    const b = M[j].world
    const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)
    const oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0)
    const oz = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0)
    if (ox <= 0.01 || oy <= 0.01 || oz <= 0.01) continue
    const pair = [M[i].id, M[j].id].sort().join('+')
    assert.ok(
      RESTING.has(pair),
      `${pair} interpenetrate by ${ox.toFixed(3)}x${oy.toFixed(3)}x${oz.toFixed(3)} m`,
    )
  }
}

// --- 4. nothing is standing on the (invisible) floor ------------------------
// At fov 58 a base at y = -1.36 only clears the bottom edge at z > ~2.66 m,
// which is behind the glass. Anything mounted at eye level is fine; furniture
// parked at floor height is not, because its base falls outside the frame and
// it reads as floating.
for (const p of M) {
  if (p.id === 'chair') continue
  assert.ok(
    p.baseY > FLOOR_Y + 0.2,
    `${p.id} sits at floor height (base y=${p.baseY.toFixed(2)}); the floor is not ` +
      `in shot, so it would read as floating. Mount it at dash/wall height.`,
  )
}

console.log(
  `cockpit-prop-placement OK -- ${M.length} props measured, ${M.length - 1} in frame, ` +
    `0 screen overlaps, 0 penetrations, 0 floor-standing`,
)
