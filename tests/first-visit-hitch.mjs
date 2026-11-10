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
assert.ok(showWarm.includes('info.uploadedProxies += batch.length'), 'showcase geometry is prepared in small frame-budgeted batches')
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

assert.ok(showWarm.includes("const roots: THREE.Object3D[] = [...beams, ...(showcaseRoots as THREE.Object3D[])]"), 'laser emitters must be GPU-primed before the larger models')
assert.ok(showWarm.includes('window.setTimeout(() => { void warm() }, 0)'), 'async first-use work must not wait for a potentially stalled first render frame')

assert.ok(showWarm.includes('const laserProxies = proxies.slice(0, beams.length)'), 'all four laser drawables are first priority')
assert.ok(showWarm.includes('laserProxies.forEach(proxy => { proxy.visible = true })') &&
  showWarm.includes('laserProxies.forEach(proxy => { proxy.visible = false })'), 'critical lasers share one private render pass')
assert.ok(showWarm.includes('info.laserSubmitted = true') && showWarm.includes('info.laserGpuSynced = true') &&
  showWarm.includes('info.laserReady = true'), 'laser GPU completion differs from command submission')
assert.ok(showWarm.includes('const SHOWCASE_BATCH_SIZE = 4') && showWarm.includes('info.showcaseDrawBatches++'),
  'optional showcase uploads are batched')
assert.ok(showWarm.includes('for (const texture of priorityTextures)'), 'laser impact textures upload before exhibits')
assert.ok(showWarm.indexOf("info.status = 'laser-geometry'") < showWarm.indexOf("info.status = 'showcase-textures'"), 'beam-first ordering enforced')

assert.ok(showWarm.includes('target.texture.colorSpace = gl.outputColorSpace'), 'private warmup must compile the same color-space shader variant as visible canvas')

assert.ok(!showWarm.includes('await gl.compileAsync(stageNow, camera)'), 'whole-scene compile is forbidden on latency-sensitive route')
assert.ok(showWarm.includes("name:'laser-priority-incremental'"), 'priority laser compile occurs per drawable')
assert.ok(apex.includes('updateScanCullMeshes(') && rag.includes('updateScanCullMeshes('), 'both projection scenes progressively render only shader-visible geometry')

const cooperativeBudget = read('source/src/scene/ShowcaseWarmup.tsx')
assert.ok(cooperativeBudget.includes('deferredShowcaseFrames'), 'GPU work throttling must expose evidence')
assert.ok(cooperativeBudget.includes("priority === 'laser'"), 'all laser resources must bypass showcase frame budget')
assert.ok(cooperativeBudget.includes("smoothPaints >= 3"), 'showcase work requires three healthy frames')
assert.ok(cooperativeBudget.includes("isInputPending"), 'yield to queued user input')
assert.ok(cooperativeBudget.includes('document.visibilityState'), 'no GPU background prewarm in hidden tab')
assert.ok(cooperativeBudget.includes('laserReady = true'), 'laser readiness is recorded after real proxy uploads')
assert.ok(cooperativeBudget.includes('await uploadTexture(texture)') && cooperativeBudget.includes("nextPaint('showcase')"), 'optional GPU work obeys frame budget')
assert.ok(cooperativeBudget.includes("await nextPaint('laser')") &&
  cooperativeBudget.includes('laserProxies.forEach(proxy => { proxy.visible = true })'), 'laser requires one priority paint opportunity')

const clickClock = read('source/src/scene/Robot.tsx')
assert.ok(clickClock.includes('lastPostClickFrameAt'), 'cold trigger profile has its own post-click callback clock')
assert.ok(clickClock.includes('frameAt - coldProbe.started'), 'first sample starts at input, not previous rAF')
assert.ok(clickClock.includes('frameAt - coldProbe.lastPostClickFrameAt'), 'later samples measure only post-click gaps')
assert.ok(clickClock.includes('firstFrameFromClickMs'), 'first input-to-rAF latency is reported')
assert.ok(clickClock.includes('firstBeamFrameAtMs'), 'time to first actual submitted laser geometry is observable')

// The two materialization program variants must be primed ahead of the
// frame-budgeted, opportunistic exhibit queue; do not downgrade shader fidelity.
assert.ok(showWarm.includes("const materializeVariants = new Map<string, THREE.Object3D>()"))
assert.ok(showWarm.includes("material.type === 'MeshBasicMaterial'") && showWarm.includes("maps.map?.isTexture && mesh.geometry.getAttribute('uv')"))
assert.ok(showWarm.includes('info.materializeShadersPrimed = representatives.length'))
assert.ok(showWarm.includes('info.materializeCompileMode = \'compileAsync\''))
assert.ok(showWarm.indexOf("info.status = 'materialize-shaders'") < showWarm.indexOf("info.status = 'showcase-textures'"))

assert.ok(!showWarm.includes("info.materializeShaderMs = Math.round(performance.now() - startedMaterialize)\n          info.uploadedProxies +="), "shader precompile must not falsely claim geometry upload")

assert.ok(showWarm.includes("new URLSearchParams(location.search).get('colossusPrewarm') === 'off'"), 'diagnostic A/B no-prewarm variant exists without modifying production default')

assert.ok(showWarm.includes('MAX_LASER_PREFLIGHT_WAIT_MS = 2500'), 'laser preflight must not compete with overloaded visible renderer')
assert.ok(showWarm.includes("info.status = 'prewarm-skipped-busy-renderer'"), 'budget backoff exposed in diagnostics')
assert.ok(showWarm.includes('healthyLaserPaints >= 2'), 'laser GPU work requires healthy idle frames')

const smokeSource = read('scripts/colossus-browser-smoke.mjs')
assert.ok(smokeSource.includes('window.__orbitaColossusProfile?.firstBeamFrameAtMs != null'), 'browser CI must witness actual first laser submission')
assert.ok(smokeSource.includes('UNACCEPTED_SOFTWARE_GPU') && smokeSource.includes('process.exitCode=12'), 'slow software GPU cannot become false-green acceptance')
assert.ok(showWarm.includes('materializeProgramsCompiled = true') && !showWarm.includes('materializeShaderGpuSynced = true'), 'compileAsync must never claim GPU geometry-ready')

assert.ok(showWarm.indexOf("info.status = 'budget-preflight'") < showWarm.indexOf("const showcaseRoots ="), 'GPU frame-budget gate precedes expensive scene proxy construction')
