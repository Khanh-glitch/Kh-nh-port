// Performance tier contract.
//
// The user asked for a third quality tier that trades away as little visual
// experience as possible, and that decides HOW MUCH to trade by measuring the
// actual machine. That makes two things testable without a GPU:
//
//   A. the decision engine behaves correctly on synthetic frame streams;
//   B. the render path only ever reaches a concession through that engine, and
//      `high`/`low` cannot accidentally inherit any of them.
//
// This runs the REAL perfLadder module (compiled with the repo's own esbuild
// from source/src/perfLadder.ts), not a copy, so the behaviour assertions apply
// to what ships.
import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const read = (p) => readFileSync(p, 'utf8')
const ladderSrc = read('source/src/perfLadder.ts')
const experience = read('source/src/scene/Experience.tsx')
const store = read('source/src/store.ts')

// ---------------------------------------------------------------- A. engine
const dir = mkdtempSync(join(tmpdir(), 'orbita-perf-'))
const compiled = join(dir, 'perfLadder.mjs')
const built = spawnSync('source/node_modules/.bin/esbuild', [
  'source/src/perfLadder.ts',
  '--format=esm',
  '--target=es2020',
  `--outfile=${compiled}`,
  '--log-level=error',
], { encoding: 'utf8' })
assert.equal(built.status, 0, 'esbuild must compile perfLadder: ' + built.stderr)

const sim = spawnSync(process.execPath, ['tests/support/perf-ladder-sim.mjs'], {
  encoding: 'utf8',
  env: { ...process.env, PERF_LADDER_MODULE: compiled },
})
assert.equal(sim.status, 0,
  'ladder behaviour simulation must pass:\n' + sim.stdout + sim.stderr)

// ------------------------------------------------------- B. tiers stay apart
// `high` must remain the untouched path: full DPR range, 2048 shadows, all
// film passes. Only `low`/`performance` may read a concession.
assert.match(
  experience,
  /const low = quality !== 'high'/,
  'high must be the untouched full-fidelity branch',
)
assert.match(
  experience,
  /phase === 'intro' \? 0\.5 : low \? concessions\.renderScale : \[1, 1\.6\]/,
  'high keeps the original [1, 1.6] DPR range; low/perf use the ladder scale',
)
assert.match(
  experience,
  /const concessions = RUNG_CONCESSIONS\[perf \? rung : 0\]/,
  'concessions must come from the ladder, and default to rung 0 (no change)',
)
assert.match(
  experience,
  /<Lights shadowEdge=\{concessions\.shadowMapSize\} \/>/,
  'shadow resolution must be driven by the concession set',
)
assert.match(
  experience,
  /filmPasses=\{!concessions\.dropFilmPasses\}/,
  'the removable film passes must be driven by the concession set',
)

// The full-fidelity defaults must still literally exist in the file, so a
// careless edit cannot silently lower High.
assert.ok(experience.includes('<Bloom intensity={low ? 0.9 : 1.25}'),
  'Bloom intensities unchanged')
assert.ok(experience.includes('<ToneMapping mode={ToneMappingMode.ACES_FILMIC} />'),
  'ACES tonemapping must always be present, in every tier')

// Rung 0 must be a no-op so entering the tier cannot change a single pixel.
assert.match(
  ladderSrc,
  /0: \{ dropFilmPasses: false, shadowMapSize: 2048, renderScale: 1, bloomLevels: 5 \}/,
  'rung 0 must remove nothing at all',
)

// Nothing may reduce the scene itself: only raster size, shadow edge and two
// post passes are allowed to change. Guard against future "optimisations" that
// quietly delete geometry or materials.
for (const forbidden of [
  'visible = false',
  'geometry.dispose',
  'material.dispose',
  'count = Math.floor',
]) {
  assert.ok(!ladderSrc.includes(forbidden),
    'the perf tier must not remove scene content: ' + forbidden)
}

// --------------------------------------------------------- C. Q cycles tiers
assert.match(
  experience,
  /if \(current === 'high'\) \{\s*\n\s*set\('performance'\)/,
  'Q must cycle high -> performance',
)
assert.match(
  experience,
  /highGuard\.resetToLow\(\)\s*\n\s*set\('low'\)/,
  'Q must cycle performance -> low',
)
assert.match(
  experience,
  /const verdict = highGuard\.tryEnable\(\)/,
  'Q must still gate High behind the measured GPU check',
)
// A rejected machine must still be able to reach the tier it needs.
assert.match(
  experience,
  /set\('performance'\)\s*\n\s*perfLadder\.reset\(\)\s*\n\s*toast\(verdict\.reason/,
  'a machine denied High must fall through to performance, not swallow the key',
)

// ------------------------------------------------- D. measurement is exposed
assert.match(ladderSrc, /__orbitaPerf/,
  'the ladder must publish its verdict for real measurement on any machine')
assert.match(ladderSrc, /TARGET_FPS = 55/, 'the FPS target is explicit')
assert.match(ladderSrc, /MEANINGFUL_GAIN/, 'a rung must justify itself by a real gain')
assert.match(ladderSrc, /futile/, 'rungs that do not help must be remembered and skipped')

// -------------------------------------------------- E. shipped artifact too
const html = read('index.html')
const tag = '<script id="orbita-embedded-map" type="application/json">'
const a = html.indexOf(tag)
const b = html.indexOf('</script>', a + tag.length)
assert.ok(a >= 0 && b > a, 'standalone ESM map present')
const map = JSON.parse(html.slice(a + tag.length, b))
assert.ok(map['orbita/perfLadder']?.startsWith('data:text/javascript;base64,'),
  'the ladder must ship inside index.html')
assert.ok(map['orbita/scene/Experience']?.startsWith('data:text/javascript;base64,'))
const expJs = Buffer.from(map['orbita/scene/Experience'].split(',')[1], 'base64').toString('utf8')
assert.ok(expJs.includes("set('performance')"),
  'the published standalone must actually be able to enter the perf tier')
assert.ok(expJs.includes('RUNG_CONCESSIONS'),
  'the published standalone must read the concession set')
assert.ok(map['orbita/store']?.startsWith('data:text/javascript;base64,'))
const storeJs = Buffer.from(map['orbita/store'].split(',')[1], 'base64').toString('utf8')
assert.ok(storeJs.includes("perfTier"),
  'the published store must understand the perfTier entry point')

// Tier default must remain `low`, so nothing changes for a visitor who never
// presses Q.
assert.match(store, /\.get\('hexForceHigh'\) === '1'[\s\S]{0,220}?\? 'high'/,
  'the CI-only high override still wins')
assert.match(store, /: 'low',/, 'the visitor default tier must stay low')

console.log(sim.stdout.trim().split('\n').slice(-1)[0])
console.log('PERF_TIER_PASS: measured ladder behaves on synthetic streams; high/low untouched; standalone ships all three tiers')
