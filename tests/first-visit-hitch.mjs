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
const tag = '<script id="orbita-embedded-map" type="application/json">'
const begin = html.indexOf(tag)
const finish = begin < 0 ? -1 : html.indexOf('</script>', begin + tag.length)
const match = begin < 0 || finish < 0 ? null : [null, html.slice(begin + tag.length, finish)]
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
    assert.ok(js.includes('if (!restored)') || js.includes('gl.setRenderTarget(prevTarget)'), 'public framebuffer restored for legacy or per-pass GPU preflight')
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

assert.ok(source['source/src/scene/Robot.tsx'].includes('__orbitaColossusProfile'), 'GPU preflight and click-time trace instrumented')

const robot = source['source/src/scene/Robot.tsx']
assert.ok(!robot.includes("if (window.location.hash.includes('colossus-profile'))"), 'same activation timeline regardless of hash')
assert.ok(robot.includes('__orbitaColossusProfiles'), 'record repeated cold/warm trials')
const warmup = source['source/src/scene/ShowcaseWarmup.tsx']
assert.ok(warmup.includes('menniverse-laser-probe') && warmup.includes('Copy laser report'), 'comparable no-console HUD')

assert.ok(source['source/src/scene/ShowcaseWarmup.tsx'].includes("const diagnosticsVisible = window.location.hash.includes('colossus-profile')"), 'profile hash controls diagnostic HUD only, not warmup code path')

const showWarm = source['source/src/scene/ShowcaseWarmup.tsx']
assert.ok(showWarm.includes('info.uploadedProxies++'), 'actual geometry upload must be split into individual frame-sized work items')
assert.ok(showWarm.includes('cancelled-on-summon') && showWarm.includes('arenaState.mode'), 'prewarm cancels rather than blocking the first laser')
assert.ok(showWarm.includes('const withTarget = (fn:'), 'every offscreen draw restores public renderer state')
assert.ok(!showWarm.includes("drawVariant('laser-apex', apexLights)"), 'no redundant offscreen light permutation after stabilizing lights')
assert.ok(!showWarm.includes("drawVariant('laser-ragnarok', [...apexLights, ...ragLights])"), 'no duplicate render for an identical shader permutation')
const apex = read('source/src/scene/ApexShowcase.tsx')
const rag = read('source/src/scene/RagnarokShowcase.tsx')
assert.ok(apex.includes('ref={showcaseRootRef}') && apex.includes('ref={eyeLightAnchor}'), 'APEX keeps original animated light transform via anchor')
assert.ok(rag.includes('ref={fireLightAnchor}') && rag.includes('ref={islandLightAnchor}'), 'Ragnarok lights follow floating island anchors')
assert.ok(apex.includes('intensity = prog > 0.005 ? 5.5 : 0'), 'APEX light dormant dark and revealed at original intensity')
assert.ok(rag.includes('prog > 0.19 ? (isAct ? 14 : 0)'), 'Ragnarok fire light dormant dark and original active intensity')
assert.ok(rag.includes('prog > 0.19 ? (sim.weather === 2'), 'Ragnarok island light dormant dark and original weather response')
assert.ok(!apex.includes('<pointLight position={[0, 0.05, 0.95]}'), 'APEX animated light no longer disappears from the light rig')
assert.ok(!rag.includes('<pointLight ref={fireLight} position='), 'Ragnarok light no longer nested under hidden island')

assert.ok(showWarm.includes('visibilityAtStart'), 'prewarm records tab state')
assert.ok(source['source/src/scene/Robot.tsx'].includes('hiddenDuringProfile'), 'tab throttling tracked')
assert.ok(source['source/src/scene/Robot.tsx'].includes('visibilityTransitions'), 'tab change events counted')

const detailedProbe = source['source/src/scene/Robot.tsx']
assert.ok(detailedProbe.includes('newPrograms'), 'shader identities captured')
assert.ok(detailedProbe.includes('reactCommits'), 'React reconciliation captured')
assert.ok(detailedProbe.includes("'long-animation-frame'"), 'LoAF profiling attempted')
assert.ok(detailedProbe.includes('browserTasks'), 'long task attribution captured')

const lateTasks = source['source/src/scene/Robot.tsx']
assert.ok(lateTasks.includes('browserTasks: coldProbe.browserTasks'), 'late observer entries remain visible in copied report')
assert.ok(lateTasks.includes('coldProbe.browserTasks = []'), 'task arrays isolated for repeat summon runs')

const mat = read('source/src/scene/materialize.ts')
assert.ok(mat.includes("mat.customProgramCacheKey = () => 'orbita-materialize-shared-v1'"), 'same-GLSL materialization materials reuse shader programs')
assert.ok(!mat.includes('orbita-materialize-${tag}'), 'unique decorative tags must not split identical shader programs')
