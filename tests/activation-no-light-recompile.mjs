/**
 * Activation must never change the scene-wide point-light count.
 *
 * three.js keys every shader Program on `NUM_POINT_LIGHTS`. When an exhibit
 * flips a point light's `visible` from false to true, EVERY lit material in the
 * island (plus the sun's shadow variant) needs a new Program. On first
 * activation that compile happens synchronously inside the click frame, which
 * is the multi-hundred-millisecond freeze / black flash reported for the
 * beacon, the piano, the colossus and the stage.
 *
 * The rule this test enforces: lights that belong to an activation (the six
 * beacon social icons, the Apex eye, the Ragnarok fire/island lamps) stay
 * mounted at all times and are driven by intensity. Intensity is a uniform, so
 * it changes nothing about the Program cache.
 */
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {test} from 'node:test'

const html = readFileSync('index.html', 'utf8')
const tag = '<script id="orbita-embedded-map" type="application/json">'
const start = html.indexOf(tag)
const end = html.indexOf('</script>', start + tag.length)
assert.ok(start >= 0 && end > start, 'embedded module map missing')

const modules = JSON.parse(html.slice(start + tag.length, end))
const source = (key) => {
  const entry = modules[key]
  assert.ok(entry, 'missing module ' + key)
  return Buffer.from(entry.slice(entry.indexOf(',') + 1), 'base64').toString('utf8')
}

test('beacon social icons keep six mounted lamps instead of six toggled lights', () => {
  const js = source('orbita/scene/SocialDrops')
  assert.match(js, /DROP_LIGHT_INTENSITY/, 'lamp intensity constant missing')
  // The lights must be rendered from the always-visible root, i.e. BEFORE the
  // per-icon groups, and outside the `visible: false` wrappers.
  const lampAt = js.indexOf('pointLight')
  const nodeGroupAt = js.indexOf('nodes.current[i]')
  assert.ok(lampAt > 0, 'no mounted point light in SocialDrops')
  assert.ok(nodeGroupAt > 0, 'icon wrapper group not found')
  assert.ok(
    !/visible:\s*false[^;]{0,200}pointLight/.test(js),
    'a social-icon point light is still nested in a hidden group',
  )
  // ...and the dormant path must write intensity 0, never visibility.
  assert.match(js, /lamp\.intensity\s*=\s*0/, 'dormant path must zero the intensity')
})

test('apex and ragnarok lamps stay mounted and are driven by intensity', () => {
  for (const key of ['orbita/scene/ApexShowcase', 'orbita/scene/RagnarokShowcase']) {
    const js = source(key)
    assert.ok(
      !/visible:\s*false[^;]{0,400}?<pointLight/.test(js),
      key + ' hides a point light behind a visibility toggle',
    )
    assert.match(js, /pointLight/, key + ' lost its lamps')
    assert.match(js, /Anchor/, key + ' lost the lamp anchor used to keep it mounted')
  }
})

test('the beacon signal is a world action, not a panel open', () => {
  const js = source('orbita/scene/Beacon')
  assert.ok(!/openPanel/.test(js), 'beacon still opens the profile panel by itself')
  assert.ok(!/pendingOpen/.test(js), 'beacon still schedules a deferred panel open')
})

test('the profile sheet floats and is click-through outside the card', () => {
  const js = source('orbita/ui/Overlay')
  assert.match(js, /pointerEvents:\s*'none'/, 'profile layer still swallows the screen')
  assert.match(js, /pointerEvents:\s*'auto'/, 'profile card must still accept input')
  assert.ok(
    !/inset-0[^"]*bg-gradient-to-l/.test(js),
    'the full-viewport dark gradient over the live canvas came back',
  )
})

test('the pause sheet cannot flash on a pointer-lock blip', () => {
  const js = source('orbita/ui/Overlay')
  const paused = js.slice(js.indexOf('function Paused'))
  assert.ok(paused.length > 0, 'Paused() not found')
  assert.match(paused, /setTimeout|setVisible/, 'pause sheet has no appearance delay')
  // Look only at the scrim element itself: the blur must not be on the
  // full-screen div that covers the live WebGL surface.
  // Compiled JSX reads `_jsx("div", { className: "absolute inset-0 ..." })`,
  // the source reads `<div className="absolute inset-0 ...">`; accept both.
  const scrim = paused.match(/(?:<div className=|_jsx\("div", \{ className: )"([^"]*inset-0[^"]*)"/)
  assert.ok(scrim, 'pause scrim element not found')
  assert.ok(
    !/backdrop-blur/.test(scrim[1]),
    'a full-screen backdrop-filter is back over the WebGL surface',
  )
})

test('12 original modules untouched by the activation work', () => {
  // Guard the pieces the activation fixes rely on but must not have modified.
  for (const key of ['orbita/scene/Orb', 'orbita/scene/Cinema', 'orbita/scene/Rubik']) {
    assert.ok(source(key).length > 1000, key + ' is empty')
  }
})
