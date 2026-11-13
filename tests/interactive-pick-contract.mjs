// Interactive-pick contract: a single click must activate what is under the
// crosshair.
//
// Regression this pins down (reported as "panel nổi khó click, phải click nhiều
// lần"): the hover raycast was throttled to 15 Hz but the throttle ALSO cleared
// `hovered.current` and the on-screen prompt on every skipped frame. A
// pointer-locked click activates the cached hover target, so on roughly three
// frames out of four the click hit `null` and silently did nothing. The target
// had to be re-acquired by a *later* frame before the next click could land,
// which is felt exactly as "I have to click several times".
//
// Three properties must hold forever:
//   1. a deferred (throttled) cast NEVER discards the last resolved target;
//   2. only a genuinely blocked interaction state clears it;
//   3. the cast refreshes when the camera/player/targets change, not only when
//      the pointer moves -- otherwise aiming at an exhibit never resolves.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(p, 'utf8')
const player = read('source/src/scene/Player.tsx')

// --- 1. The throttle gate and the clearing branch are separate -------------
const hoverStart = player.indexOf('// ---- hover ----')
assert.ok(hoverStart > 0, 'hover block present')
const hoverBlock = player.slice(hoverStart, hoverStart + 3200)

assert.match(
  hoverBlock,
  /const hoverBlocked = s\.panel \|\| s\.paused \|\| trans\.active/,
  'hover must be blocked only by real interaction states',
)
assert.match(
  hoverBlock,
  /if \(!hoverBlocked && hoverDue\) \{/,
  'the deferred cast must be gated separately from the clearing branch',
)
assert.match(
  hoverBlock,
  /else if \(hoverBlocked && hoverKey\.current\) \{/,
  'the cached hover target must be cleared ONLY when interaction is blocked; ' +
    'clearing it on a throttled frame makes most clicks land on null',
)
assert.doesNotMatch(
  hoverBlock,
  /\} else if \(hoverKey\.current\) \{/,
  'a plain `else` here reintroduces the click-eating regression',
)

// --- 2. The cast must refresh on camera/player/target changes --------------
for (const signal of ['const camMoved', 'const worldMoved', 'const targetsChanged']) {
  assert.ok(hoverBlock.includes(signal), 'hover must react to ' + signal)
}
assert.match(
  hoverBlock,
  /const hoverDue = pointerMoved \|\| camMoved \|\| worldMoved \|\| targetsChanged \|\|\s*\n\s*nowMs - lastPickAt\.current > 66/,
  'a still pointer must not prevent re-resolving after the view changed',
)

// --- 3. The click handlers must keep working ------------------------------
assert.match(
  player,
  /if \(document\.pointerLockElement === el\) \{\s*\n\s*activate\('click', hovered\.current\)/,
  'pointer-locked click activates the resolved target',
)
assert.match(
  player,
  /if \(dragging && moved < 8\) activate\('click', pick\(true\)\)/,
  'unlocked click must keep the original drag threshold and re-cast on click',
)

// --- 4. Panels float in the world; nothing covers the screen --------------
//
// These assertions replaced the ones that pinned the old DOM card. The card is
// gone on purpose: every exhibit panel used to be a full-height sheet at z-40,
// and the owner asked for the Main Stage's behaviour instead -- a panel that
// floats beside the exhibit and leaves the scene visible. The properties worth
// pinning did not disappear with the card, so they are asserted against the new
// architecture rather than dropped:
//
//   a. the DOM layer must stay click-through, and must still carry a backdrop
//      strip that closes the panel (the recovery path when pointer lock fails);
//   b. an explicit close control must survive;
//   c. the card itself must be a bounded plane in the scene, anchored once at
//      open time and NOT tracking the camera every frame -- a card that follows
//      the visitor is a HUD, not an object in the world.
const overlay = read('source/src/ui/Overlay.tsx')
assert.doesNotMatch(
  overlay,
  /<aside[\s\S]{0,400}?backdrop-blur-2xl/,
  'the full-height DOM card must not come back; panels are 3D now',
)
assert.match(
  overlay,
  /className="absolute inset-0 z-40 flex"/,
  'the walk-through layer that closes the panel must survive',
)
const panelLayer = overlay.slice(overlay.indexOf('className="absolute inset-0 z-40 flex"'))
const panelHead = panelLayer.slice(0, 1600)
assert.ok(
  panelHead.includes("pointerEvents: 'none'"),
  'the panel layer must stay click-through so the canvas keeps receiving input',
)
assert.ok(
  panelHead.includes("pointerEvents: 'auto'"),
  'the backdrop strip (and the close control) must accept input',
)
assert.match(
  overlay,
  /onClick=\{\(\) => closePanel\(true\)\}/,
  'clicking beside the card must still close it (recovery path, old behaviour)',
)

// Panels live in scene/Experience.tsx: the standalone build runs on a fixed
// embedded-module map, so a new file could not be published. The contract is
// asserted on the real source either way.
const floating = read('source/src/scene/Experience.tsx')
assert.match(
  floating,
  /const DISTANCE = 2\.4/,
  'the card must sit at a fixed distance in front of the visitor',
)
assert.match(
  floating,
  /Anchor the card where the visitor is standing \*now\* and stop following/,
  'the anchor must be captured once at open time',
)
// The anchor is written in the open effect, never in useFrame.
const frameBodies = [...floating.matchAll(/useFrame\(\([^)]*\)\s*=>\s*\{([\s\S]*?)\n {2}\}\)/g)].map((m) => m[1])
assert.ok(frameBodies.length > 0, 'the floating card animates')
assert.ok(
  frameBodies.every((b) => !b.includes('anchor.current.pos.copy') && !b.includes('camera.position')),
  'useFrame must not re-anchor the card onto the camera',
)
assert.match(
  floating,
  /<meshBasicMaterial map=\{tex\} transparent depthWrite=\{false\} toneMapped=\{false\}/,
  'the card is a real transparent plane in the scene graph, not a DOM overlay',
)

// --- 5. The shipped standalone must carry the same fix --------------------
const html = read('index.html')
const tag = '<script id="orbita-embedded-map" type="application/json">'
const a = html.indexOf(tag)
const b = html.indexOf('</script>', a + tag.length)
assert.ok(a >= 0 && b > a, 'standalone ESM map present')
const map = JSON.parse(html.slice(a + tag.length, b))
const decode = (key) => {
  const value = map[key]
  assert.ok(value?.startsWith('data:text/javascript;base64,'), key + ' embedded')
  return Buffer.from(value.split(',')[1], 'base64').toString('utf8')
}
const playerJs = decode('orbita/scene/Player')
const overlayJs = decode('orbita/ui/Overlay')
assert.ok(
  playerJs.includes('hoverBlocked && hoverKey.current'),
  'published Player must only clear hover when interaction is blocked',
)
assert.ok(
  playerJs.includes('const camMoved') && playerJs.includes('const targetsChanged'),
  'published Player must refresh hover when the view or targets change',
)
assert.ok(
  !overlayJs.includes('backdrop-blur-2xl'),
  'published Overlay must not still ship the full-screen card',
)

console.log(
  'INTERACTIVE_PICK_PASS: throttled hover keeps its target, view changes ' +
    're-resolve, clicks act on the first press, panels float in the world',
)
