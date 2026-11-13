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

// --- 4. Panel geometry: the card must stay on screen and closable ---------
const overlay = read('source/src/ui/Overlay.tsx')
assert.match(
  overlay,
  /alignItems: 'flex-start'/,
  "the shipped Tailwind subset has no `items-start` utility, so alignment must " +
    'be inline or the card stretches to full height',
)
assert.match(
  overlay,
  /maxHeight: 'calc\(100% - 12px\)'/,
  'the card height must be bounded so its scroll body and close control stay ' +
    'inside the viewport',
)
assert.match(
  overlay,
  /onClick=\{\(\) => closePanel\(true\)\}/,
  'clicking beside the card must still close it (recovery path, old behaviour)',
)
// The click-through wrapper plus the two input surfaces (backdrop, card).
const panelLayer = overlay.slice(overlay.indexOf('className="absolute inset-0 z-40 flex"'))
const panelHead = panelLayer.slice(0, 1600)
assert.ok(
  panelHead.includes("pointerEvents: 'none'"),
  'the panel wrapper must stay click-through so the canvas keeps receiving input',
)
assert.ok(
  panelHead.includes("pointerEvents: 'auto'"),
  'the card itself must accept input',
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
  overlayJs.includes("maxHeight: 'calc(100% - 12px)'"),
  'published Overlay must bound the card height',
)

console.log(
  'INTERACTIVE_PICK_PASS: throttled hover keeps its target, view changes ' +
    're-resolve, clicks act on the first press, card stays on screen',
)
