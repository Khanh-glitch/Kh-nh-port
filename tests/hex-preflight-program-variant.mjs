// HEX first-trigger preflight: the idle warm queue must compile the SAME GPU
// program variant that the first HEX draw will use, otherwise the prewarm is
// pure wasted work and every program links inside the visitor's click frame.
//
// three.js r187 derivation (source/node_modules/three/src/renderers/webgl):
//   WebGLPrograms.getParameters():217
//     outputColorSpace = currentRenderTarget === null
//       ? renderer.outputColorSpace          // sRGB  - direct-to-canvas path
//       : (isXRRenderTarget ? ... : ColorManagement.workingColorSpace) // Linear
//   WebGLPrograms.getProgramCacheKeyParameters():454
//     array.push(parameters.outputColorSpace)  // it is part of the cache key
// The EffectComposer RenderPass always binds its own target, so the real HEX
// draw compiles/uses the Linear variant while a target-less prewarm produced
// sRGB variants that can never be reused. The measured trace showed
// `cached program count 113 -> 113` with 24-27 programs still linking on demand
// at the first HEX exposure.
//
// This gate pins the structural facts, not an implementation detail: preflight
// compilation must bind a target whose texture colour space is working-space
// (Linear), must restore renderer state, must stay opt-out-able, and must never
// reintroduce the rejected "disable shader error checking" or "hide the world"
// shortcuts.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(p, 'utf8')
const host = read('source/src/reality/RealityHost.tsx')

// --- 1. The cooperative target is Linear-sRGB (working colour space) --------
assert.match(
  host,
  /target\.texture\.colorSpace\s*=\s*THREE\.LinearSRGBColorSpace/,
  'preflight target must use the working (Linear-sRGB) colour space so its ' +
    'programs match the composer RenderPass variant',
)

// --- 2. The preflight is ON by default and explicitly opt-out-able ---------
assert.match(
  host,
  /const hexCooperativeLinear = !!hexSearch && !hexComposerOff &&\s*\n\s*hexSearch\.get\('hexCooperativeLinear'\) !== '0'/,
  'Linear-variant preflight must be enabled by default with an explicit ' +
    "?hexCooperativeLinear=0 escape hatch, not a hidden opt-in",
)
assert.match(
  host,
  /const hexComposerOff = hexSearch\?\.get\('colossusPostProbe'\) === 'off'/,
  'the composer-off diagnostic path renders direct-to-canvas (sRGB) and must ' +
    'not force a Linear preflight it would never draw',
)

// --- 3. Compilation actually binds that target, and restores state ---------
assert.match(
  host,
  /const scratch=hexCooperativeLinear\?hexCooperativeTarget\.current:null/,
  'compileHexCooperatively must select the cooperative target',
)
assert.match(
  host,
  /gl\.setRenderTarget\(scratch\)/,
  'the target must be bound before gl.compileAsync so parameters resolve to ' +
    'the Linear variant',
)
for (const restore of [
  'gl.setRenderTarget(originalTarget)',
  'gl.setViewport(originalViewport)',
  'gl.setScissor(originalScissor)',
  'gl.setScissorTest(originalScissorTest)',
]) {
  assert.ok(host.includes(restore), 'preflight must restore renderer state: ' + restore)
}
assert.match(
  host,
  /if\(gl\.getRenderTarget\(\)!==originalTarget\)\s*\n\s*S\.warmLinearRestoreErrors\+\+/,
  'a leaked render target must be detectably counted, not silently ignored',
)

// --- 4. Shadow depth variants are the same bug and are warmed too ----------
assert.match(
  host,
  /const hexShadowProgramWarm = hexCooperativeLinear &&\s*\n\s*hexSearch\?\.get\('hexShadowProgramWarm'\) !== '0'/,
  'shadow.map is a non-null non-XR target too, so MeshDepthMaterial variants ' +
    'are also Linear and must be warmed by default',
)

// --- 5. Scheduling cost must not be moved into extra idle submissions ------
assert.match(
  host,
  /S\.warmHealthyPaints >= 2/,
  'warm work stays gated on healthy consecutive paints',
)
assert.match(
  host,
  /if\(took>120\)/,
  'the 120ms abort guard must remain so an idle frame is never sacrificed',
)

// --- 6. Rejected shortcuts must not come back -----------------------------
assert.doesNotMatch(
  host,
  /gl\.debug\.checkShaderErrors\s*=\s*false\s*\n\s*void /,
  'disabling shader error checking is a rejected non-fix',
)
assert.doesNotMatch(
  host,
  /hexCooperativeLinear\s*=\s*typeof window !== 'undefined' &&\s*\n\s*new URLSearchParams\(window\.location\.search\)\.get\('hexCooperativeLinear'\) === '1'/,
  'the preflight must not silently revert to a target-less opt-in prewarm',
)

// --- 7. The shipped standalone must carry the same behaviour --------------
const html = read('index.html')
const tag = '<script id="orbita-embedded-map" type="application/json">'
const a = html.indexOf(tag)
const b = html.indexOf('</script>', a + tag.length)
assert.ok(a >= 0 && b > a, 'standalone ESM map present')
const map = JSON.parse(html.slice(a + tag.length, b))
const embedded = map['orbita/reality/RealityHost']
assert.ok(embedded?.startsWith('data:text/javascript;base64,'), 'RealityHost embedded')
const js = Buffer.from(embedded.split(',')[1], 'base64').toString('utf8')
assert.ok(
  js.includes('hexCooperativeLinear') &&
    js.includes("get('hexCooperativeLinear')") &&
    js.includes("!== '0'"),
  'published standalone must run the Linear-variant preflight by default',
)
assert.ok(
  js.includes('hexShadowProgramWarm') && js.includes("!== '0'"),
  'published standalone must warm shadow depth variants by default',
)

// --- 8. Visual invariants are untouched by this change --------------------
const experience = read('source/src/scene/Experience.tsx')
assert.ok(experience.includes('shadow-mapSize={[2048, 2048]}'), '2048 shadow unchanged')
assert.ok(experience.includes('Bloom intensity={low ? 0.9 : 1.25}'), 'Bloom unchanged')
assert.ok(!host.includes('hexNativePbrWarm'), 'rejected Basic/PBR swap absent')
assert.ok(!host.includes('hexRadialInstances'), 'rejected radial reorder absent')

console.log(
  'HEX_PREFLIGHT_PROGRAM_VARIANT PASS: idle prewarm compiles the Linear variant ' +
    'the composer draws; state restored; visual invariants unchanged',
)
