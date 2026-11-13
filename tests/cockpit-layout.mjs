// Cockpit layout contract (rebuilt interior).
//
// The cabin was rebuilt from scratch after rasterising it showed that the old
// shell was ~24 boxes with no ceiling, no side walls and no seat -- a few slabs
// floating in a void. It read as "almost nothing there".
//
// The rebuild also exposed a projection mistake that no amount of reading the
// source would have caught: the selector keys sit on an arc of radius 2.10, but
// the OUTER columns land at z = -1.94, not -2.10. Projecting against 2.10 said
// the keys were comfortably inside the frame; projecting against 1.94 showed
// row two ending at 99.7% of the frame height, with its lower bezel behind the
// dash lip. That is exactly the sort of "technically inside, visually cut"
// error this file exists to stop.
//
// It parses the real placement constants and the real camera from interior.ts
// and SpaceScene.tsx, so it cannot drift from what ships.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const interior = readFileSync('source/immersive/src/cockpit/interior.ts', 'utf8')

// --- camera -----------------------------------------------------------------
const space = readFileSync('source/immersive/src/components/SpaceScene.tsx', 'utf8')
const fovMatch = space.match(/fov:\s*(\d+)/) || space.match(/PerspectiveCamera\(\s*(\d+)/)
const FOV = fovMatch ? Number(fovMatch[1]) : 58
assert.equal(FOV, 58, 'camera fov changed; re-derive the layout numbers')

const tanV = Math.tan((FOV * Math.PI) / 180 / 2)

/** Vertical position in the frame, 0 = top, 1 = bottom. */
const fracY = (y, z) => 1 - ((y / (tanV * Math.abs(z))) * 0.5 + 0.5)

// --- placement constants, read from source ----------------------------------
const num = (re, what) => {
  const m = interior.match(re)
  assert.ok(m, `could not find ${what} in interior.ts`)
  return Number(m[1])
}

const KEY_R = num(/const KEY_R = ([\d.]+)/, 'KEY_R')
const rowMatch = interior.match(/const KEY_ROW_Y = \[([-\d.]+),\s*([-\d.]+)\]/)
assert.ok(rowMatch, 'KEY_ROW_Y')
const ROW_Y = [Number(rowMatch[1]), Number(rowMatch[2])]

const primaryMatch = interior.match(/const PRIMARY = \{\s*y:\s*([-\d.]+),\s*radius:\s*([-\d.]+)/)
assert.ok(primaryMatch, 'PRIMARY')
const PRIMARY_Y = Number(primaryMatch[1])
const PRIMARY_R = Number(primaryMatch[2])

const KEY_W = 0.54
const KEY_H = (KEY_W * 320) / 512

// --- 1. every key must be fully inside the frame -----------------------------
//
// The angle spread depends on aspect, but the DEPTH does not change with row:
// `z = cos(angle) * KEY_R` and the outer column is the shallowest. Use the
// widest spread the code can produce (visibleHalfAngle caps at 0.46 rad) so
// this is the worst case.
const HALF_MAX = 0.46
const outerAngle = HALF_MAX * 0.86
const zOuter = Math.cos(outerAngle) * KEY_R
assert.ok(zOuter > 1.5, `outer key depth ${zOuter.toFixed(2)} is implausible`)

for (let row = 0; row < ROW_Y.length; row++) {
  const y = ROW_Y[row]
  const top = fracY(y + KEY_H / 2, zOuter)
  const bottom = fracY(y - KEY_H / 2, zOuter)
  assert.ok(
    top > 0.60,
    `key row ${row + 1} starts at ${(top * 100).toFixed(1)}% of the frame; it ` +
      `overlaps the primary glass, which ends at about 55%.`,
  )
  assert.ok(
    bottom < 0.965,
    `key row ${row + 1} ends at ${(bottom * 100).toFixed(1)}% of the frame. At ` +
      `that height the lower bezel falls behind the dash lip and the row is ` +
      `visibly cut off -- the 4:3 regression.`,
  )
}

// --- 2. the primary glass must not swallow the canopy ------------------------
const mainW = num(/addScreen\(0, mainCanvas, ([\d.]+)/, 'primary width')
const mainTop = fracY(PRIMARY_Y + (mainW * 640) / 1024 / 2, PRIMARY_R)
const mainBottom = fracY(PRIMARY_Y - (mainW * 640) / 1024 / 2, PRIMARY_R)
assert.ok(
  mainTop > 0.10,
  `the primary display reaches ${(mainTop * 100).toFixed(1)}% of the frame; it is ` +
    `covering the canopy and the cabin turns back into a wall of glass.`,
)
assert.ok(
  mainBottom < 0.66,
  `the primary display reaches ${(mainBottom * 100).toFixed(1)}%; it leaves no ` +
    `room for the selector keys below it.`,
)

// --- 3. the cabin must have the parts that make it a cabin -------------------
// The old interior had no ceiling, no seat and no pedestal. A "cockpit" without
// these is a dashboard floating in space.
const mustHave = [
  [/backrest/, 'seat backrest'],
  [/headrest/, 'seat headrest'],
  [/Centre pedestal/, 'centre pedestal between the pilot\'s knees'],
  [/lever/, 'throttle lever'],
  [/aft bulkhead|CAB\.aftZ/, 'aft bulkhead'],
  [/canopy/i, 'canopy structure'],
  [/InstancedMesh/, 'instanced greeble detail'],
]
for (const [re, what] of mustHave) {
  assert.ok(re.test(interior), `the rebuilt cabin is missing its ${what}`)
}

// --- 4. surface detail must be instanced, not one mesh per rivet -------------
// Hundreds of individual meshes would be hundreds of draw calls. The point of
// the instancing is that density stays cheap.
// Count call sites AND the loop-driven repeats they stand for, because eleven
// literal calls expand to a couple of hundred instances.
const greebleCalls = (interior.match(/greeble\(/g) || []).length
// Every `for (let i = 0; i < N` block that contains a greeble multiplies it.
let implied = 0
for (const loop of interior.matchAll(/for\s*\([^)]*i\s*<\s*(\d+)[^)]*\)\s*\{([\s\S]{0,400}?)\n  \}/g)) {
  if (loop[2].includes('greeble(')) implied += Number(loop[1])
}
assert.ok(
  greebleCalls + implied > 120,
  `only ~${greebleCalls + implied} greebles (${greebleCalls} call sites, ${implied} in loops); ` +
    `the cabin will read as bare slabs`,
)
assert.ok(
  /new THREE\.InstancedMesh\(/.test(interior),
  'greebles must be flushed into InstancedMesh, not one Mesh each',
)

// --- 5. the canopy must stay OPEN above the rail -----------------------------
// A closed ceiling fills the upper frame with a flat wall and hides the one
// thing that reads as "spaceship": space, through the glass.
assert.ok(
  !/solid\(2\.10,\s*0\.10,\s*2\.80/.test(interior),
  'a full-width ceiling slab is back; it will wall off the canopy',
)

console.log(
  `cockpit-layout OK -- fov ${FOV}, keys at ${(fracY(ROW_Y[0] + KEY_H / 2, zOuter) * 100).toFixed(0)}` +
    `..${(fracY(ROW_Y[1] - KEY_H / 2, zOuter) * 100).toFixed(0)}%, primary ` +
    `${(mainTop * 100).toFixed(0)}..${(mainBottom * 100).toFixed(0)}%, ${greebleCalls} greebles instanced`,
)
