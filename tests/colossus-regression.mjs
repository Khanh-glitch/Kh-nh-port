/** Lightweight source-contract regression checks. No browser/runtime claims. */
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const source = (name) => readFileSync(new URL(`../source/src/scene/${name}`, import.meta.url), 'utf8')
const rag = source('RagnarokShowcase.tsx')
const apex = source('ApexShowcase.tsx')
const weather = source('RagnarokWeather.tsx')
const robot = source('Robot.tsx')
const uv = source('ragnarokSprites.ts')
const materialize = source('materialize.ts')
const warmup = source('ShowcaseWarmup.tsx')
const cloud = source('pixelCloud.ts')

// Dormant showpieces must not spawn before the scan.
for (const [name, data] of [['APEX', apex], ['Ragnarok', rag]]) {
  assert.match(data, /<group ref=\{plinthRef\} visible=\{false\}>/, `${name}: plinth begins hidden`)
  assert.match(data, /plinthReveal = THREE\.MathUtils\.smoothstep\(prog/, `${name}: base has scan driven reveal`)
}
assert.match(rag, /<group ref=\{exhibitRef\}[^>]*visible=\{false\}>/, 'Ragnarok environment starts hidden')
assert.match(rag, /spriteMat = patchMaterialize\(/, 'Sprite atlas obeys fabrication scan')
assert.match(rag, /uReveal/, 'Pixel ocean has wave reveal')
assert.match(rag, /treeRefs\.current\.forEach/, 'Trees sway in wind')
assert.match(rag, /<RagnarokWeather/, 'Real 3D miniature weather is mounted')
assert.match(materialize, /T extends THREE\.Material/, 'Fabrication shader supports pixel BasicMaterial')
assert.match(weather, /<instancedMesh ref=\{rainRef\}/, 'Raindrop meshes')
assert.match(weather, /<instancedMesh ref=\{ripplesRef\}/, 'Water-impact ripple meshes')
assert.match(weather, /<instancedMesh ref=\{gustsRef\}/, 'Wind-gust meshes')
assert.match(weather, /<group ref=\{cloudsRef\}/, 'Storm cloud sprites')
assert.doesNotMatch(weather, /<boxGeometry args=\{\[0\.42, 0\.19/, 'No old box clouds')
assert.match(weather, /<spriteMaterial map=\{cloudTextures/, 'Pixel cloud billboards replace boxes')
assert.match(cloud, /NearestFilter/, 'Pixel clouds use nearest-neighbor crisp sampling')
assert.match(weather, /rain\.connect\(rainFilter\)/, 'Storm audio layer')
assert.match(uv, /lastUV = new WeakMap/, 'Animated sprite UV upload cache')
assert.match(warmup, /(?:await | = )gl\.compileAsync\(/, 'Shader prewarming away from summon event')
assert.match(warmup, /gl\.render\(stageNow, camera\)/, 'Actual GPU draw primes geometry & programs, not only compileAsync')
assert.doesNotMatch(warmup, /if \(\'requestIdleCallback\' in window/, 'Warmup cannot be postponed indefinitely to browser idle')
assert.match(robot, /coldProbe\.warmStatusAtClick/, 'Cold vs warm first-activation diagnostics available')
assert.match(robot, /<ShowcaseWarmup arenaState=\{st\} \/>/, 'Cooperative prewarm is mounted with laser state')
assert.match(robot, /apexColliderRemove/, 'Invisible plinth no longer collides')
assert.match(robot, /ragColliderRemove/, 'Invisible Ragnarok plinth no longer collides')

// Static rounded parts must survive Robot/Apex React state transitions without
// invalidating the GPU buffers already uploaded during prewarm.
const stableRobot = robot
const stableApex = apex
assert.match(stableRobot, /const stableGeometry = useMemo\(/, 'Colossus Part geometry cached per dimension')
assert.match(stableRobot, /geometry=\{roundedBox\(/, 'Colossus inline rounded geometry cached')
assert.match(stableApex, /geometry=\{roundedBox\(/, 'APEX inline rounded geometry cached')

// Native offscreen preflight may modify the live sun ONLY synchronously:
// no public rAF can run while the real camera or sun points at Colossus.
const nativeWarmSource = warmup
assert.match(nativeWarmSource, /for \(let repeat = 0; repeat < info\.nativeSceneRepeats; repeat\+\+\)/, 'native warmup repeats are frame-budgeted')
const offscreenBegin = nativeWarmSource.indexOf('sun.target.position.set(0, 0, -41)')
const offscreenEnd = nativeWarmSource.indexOf('sun.target.position.copy(targetPos)', offscreenBegin)
assert.ok(offscreenBegin >= 0 && offscreenEnd > offscreenBegin, 'native source camera and sun restored')
assert.ok(!nativeWarmSource.slice(offscreenBegin, offscreenEnd).includes('await '), 'no await while public camera or sun is temporarily moved')

console.log('PASS: static Colossus contracts (NOT a substitute for browser visual QA)')
