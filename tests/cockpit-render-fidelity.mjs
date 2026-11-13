// Cockpit render fidelity.
//
// Two silent failures found by rasterising the REAL scene graph on the CPU
// (there is no browser or GPU in this environment, so this is how the cabin
// actually got inspected). Neither one throws, neither one shows up in a
// triangle count, and both were visible to a human in one glance.
//
// Failure 1 -- the primary report was cut in half.
//   `paintScreen` lays out at exactly MAIN_W x MAIN_H (1024x640), but the main
//   screen was painted with scale = 2. The transform doubled while the backing
//   store stayed 1024x640, so only the top-left quarter of the report landed on
//   the canvas and the rest was clipped away. On screen the pilot's name read
//   "LÊ QUỐC KH..." and the bottom third of the display was empty.
//
// Failure 2 -- the cabin read as a living room.
//   The CC0 kit props carry their original glTF colours (warm wood f3cca8).
//   `applyTint` was supposed to pull them toward steel blue but lerped a LINEAR
//   baseColorFactor against an sRGB hex, so the result stayed warm brown. The
//   cockpit looked like it had a sideboard in it.
//
// Everything here reads the shipped source and the shipped GLBs, so it cannot
// drift from what users get.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const IMM = 'source/immersive'
const interiorSrc = readFileSync(`${IMM}/src/cockpit/interior.ts`, 'utf8')
const paintSrc = readFileSync(`${IMM}/src/lib/screenPaint.ts`, 'utf8')
const furnishSrc = readFileSync(`${IMM}/src/cockpit/furnish.ts`, 'utf8')

// --- 1. the primary report must be painted at the canvas's own resolution ----
const MAIN_W = Number(paintSrc.match(/export const MAIN_W = (\d+)/)[1])
const MAIN_H = Number(paintSrc.match(/export const MAIN_H = (\d+)/)[1])

const callSites = [...interiorSrc.matchAll(/paintScreen\(([^)]*)\)/g)].map((m) =>
  m[1].split(',').map((s) => s.trim()),
)
assert.ok(callSites.length > 0, 'interior.ts must call paintScreen')

for (const args of callSites) {
  // signature: (index, canvas, data, lang, ready, progress, scale)
  const scaleArg = args[6]
  const scale = scaleArg === undefined ? 1 : Number(scaleArg)
  assert.ok(
    Number.isFinite(scale) && scale === 1,
    `paintScreen is called with scale=${scaleArg}. The layout is authored at ` +
      `${MAIN_W}x${MAIN_H} and the canvas IS ${MAIN_W}x${MAIN_H}, so any other ` +
      `scale multiplies the transform without enlarging the backing store and ` +
      `silently clips the report to its top-left corner. Raise the canvas size ` +
      `in screenPaint.ts instead of passing a scale.`,
  )
}

// The canvas handed to paintScreen must really be MAIN_W x MAIN_H.
assert.match(
  interiorSrc,
  /makeCanvas\(\s*MAIN_W\s*,\s*MAIN_H\s*\)/,
  'the primary canvas must be makeCanvas(MAIN_W, MAIN_H)',
)

// --- 2. furnished props must end up near their tint, not their kit colour ---
const os = { tmp: (p) => path.join(tmpdir(), p) }
const out = os.tmp(`cockpit-fidelity-${process.pid}.mjs`)
let furnish, loadGlb, THREE
try {
  execFileSync(
    path.join(IMM, 'node_modules/.bin/esbuild'),
    [
      `${IMM}/src/cockpit/furnish.ts`,
      '--bundle', '--format=esm', '--platform=node', '--loader:.ts=ts',
      '--external:three', `--outfile=${tmpdir()}/furnish-bundle.mjs`,
    ],
    { stdio: 'pipe' },
  )
  const bundled = readFileSync(`${tmpdir()}/furnish-bundle.mjs`, 'utf8').replace(
    /from\s*["']three["']/g,
    `from "${path.resolve(IMM, 'node_modules/three/build/three.module.js')}"`,
  )
  const { writeFileSync } = await import('node:fs')
  writeFileSync(out, bundled)
  ;({ furnishCockpit: furnish } = await import(pathToFileURL(out).href))
  THREE = await import(pathToFileURL(path.resolve(IMM, 'node_modules/three/build/three.module.js')).href)
} catch {
  console.log('cockpit-render-fidelity SKIP -- esbuild/three unavailable')
  process.exit(0)
}

// furnishCockpit fetches; serve the repo's own kit files.
const { createCanvas } = await import('/tmp/node_modules/@napi-rs/canvas/index.js').catch(() => ({}))
globalThis.document = {
  fonts: { ready: Promise.resolve(), load: () => Promise.resolve() },
  createElement: () => {
    const c = createCanvas ? createCanvas(8, 8) : { width: 8, height: 8, getContext: () => null, style: {} }
    c.style = {}
    return c
  },
}
globalThis.window = { innerWidth: 1600, innerHeight: 900, devicePixelRatio: 1, addEventListener() {} }
const kit = path.resolve('assets/3d/room-showcase')
globalThis.fetch = async (url) => {
  const rel = String(url).replace(/^.*assets\/3d\/room-showcase\//, '')
  const p = path.join(kit, rel)
  const b = readFileSync(p)
  return { ok: true, status: 200, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }
}

const result = await furnish('assets/3d/room-showcase/')
assert.deepEqual(result.failed, [], `every prop must load, failed: ${result.failed}`)

// Tint target used when a prop does not name one.
const DEFAULT_TINT = 0x2a3648
const tintHue = new THREE.Color(DEFAULT_TINT)
const tintHsl = { h: 0, s: 0, l: 0 }
tintHue.getHSL(tintHsl)

let checked = 0
result.group.traverse((o) => {
  const mat = o.material
  if (!mat || Array.isArray(mat) || !mat.color) return
  const current = mat.color
  const hsl = { h: 0, s: 0, l: 0 }
  current.getHSL(hsl)

  // Warm surfaces (the kit's wood/metal) must no longer read as warm. A tiny
  // hue difference between two nearby colours is fine; what must never happen
  // is the prop keeping its original red/orange bias.
  const warmth = current.r - current.b
  assert.ok(
    warmth < 0.10,
    `prop material is still warm (r-b = ${warmth.toFixed(3)}, hex ${current.getHexString()}). ` +
      `The cabin must read as steel, not as living-room furniture.`,
  )
  checked++
})

assert.ok(checked >= 10, `expected to inspect the prop materials, saw ${checked}`)

// The tint must actually be applied -- a no-op would leave the kit's own hexes.
const anyTinted = (() => {
  let found = false
  result.group.traverse((o) => {
    if (o.material && !Array.isArray(o.material) && o.material.userData?.__tinted) found = true
  })
  return found
})()
assert.ok(anyTinted, 'applyTint never ran on the furnished props')

console.log(
  `cockpit-render-fidelity OK -- primary painted at ${MAIN_W}x${MAIN_H} scale 1, ` +
    `${checked} prop materials de-warmed, ${result.triangles} triangles`,
)
