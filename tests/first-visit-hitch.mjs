import fs from 'node:fs'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'

const read = p => fs.readFileSync(p, 'utf8')
const source = Object.fromEntries([
  'source/src/reality/RealityHost.tsx',
  'source/src/reality/Sheets.tsx',
  'source/src/scene/ShowcaseWarmup.tsx',
  'source/src/scene/Robot.tsx'
].map(p => [p, read(p)]))

const html = read('index.html')
const match = html.match(/<script id="orbita-embedded-map" type="application\\/json">([\\s\\S]*?)<\\/script>/)
assert.ok(match, 'standalone ESM map is present')
const modules = JSON.parse(match[1])
assert.ok(Object.keys(modules).length >= 56, 'all public modules are retained')
const pairs = [
  ['source/src/reality/RealityHost.tsx', 'orbita/reality/RealityHost'],
  ['source/src/reality/Sheets.tsx', 'orbita/reality/Sheets'],
  ['source/src/scene/ShowcaseWarmup.tsx', 'orbita/scene/ShowcaseWarmup'],
  ['source/src/scene/Robot.tsx', 'orbita/scene/Robot']
]
for (const [file, key] of pairs) {
  assert.ok(modules[key]?.startsWith('data:text/javascript;base64,'), key)
  const js = Buffer.from(modules[key].split(',')[1], 'base64').toString('utf8')
  const c = spawnSync(process.execPath, ['--check', '--input-type=module'], { input: js, encoding: 'utf8' })
  assert.equal(c.status, 0, key + ' compiled JS parse failure: ' + c.stderr)
  if (file.includes('ShowcaseWarmup')) {
    assert.ok(!js.includes('gl.readRenderTargetPixels(target'), 'no blocking GPU read')
    assert.ok(js.includes('readRenderTargetPixelsAsync'), 'async GPU readback is present')
    assert.ok(js.includes('if (!restored)'), 'safe framebuffer restoration')
  }
  if (file.includes('Sheets')) assert.ok(js.includes("k > 0.01 || useStore.getState().phase === 'intro'"), 'Piano GoldZone primed')
  if (file.includes('Robot')) assert.ok(js.includes('colossus-warm-beam-left') && js.includes('colossus-warm-impact'), 'Robot beams and flare identified')
  if (file.includes('RealityHost')) assert.ok(js.includes('warmCompilePending') && js.includes('intro'), 'Piano intro-only async scheduler')
}
const world = source['source/src/reality/RealityHost.tsx']
assert.ok(world.includes("S.warmPass < 2 && useStore.getState().phase !== 'intro'"), 'UEH cannot be left accidentally visible')
assert.ok(world.includes('ueh.current.visible = false'), 'UEH restored on exit from intro')
assert.ok(source['source/src/scene/ShowcaseWarmup.tsx'].includes('scene.traverseVisible'), 'avoid hidden showcase lights during precompile')
const experience = read('source/src/scene/Experience.tsx')
assert.ok(experience.includes('shadow-mapSize={[2048, 2048]}'), 'shadow resolution unchanged')
assert.ok(experience.includes('Bloom intensity={low ? 0.9 : 1.25}'), 'bloom settings unchanged')
console.log('[FIRST_VISIT_HITCH] 4 embedded JS modules parse; source parity and visual settings: PASS')
