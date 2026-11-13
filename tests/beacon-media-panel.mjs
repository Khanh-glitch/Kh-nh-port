// Beacon icons, owner media and floating panels.
//
// Three owner requests, and the failure each one had that a build could not
// catch:
//
//   1. "the social icons are upside down, and they hang too high"
//      The icons were NOT upside down in their source paths. Rasterising the
//      paths showed the TikTok note hanging low and the octocat's ears on top.
//      The flip happened in the pipeline: SVGLoader returns SVG space (y grows
//      DOWN) and ExtrudeGeometry treats it as three space (y grows UP), so every
//      silhouette came out mirrored about its own horizontal axis. Fixed in the
//      geometry, not on the mesh, because the per-frame animation already writes
//      rotation.z.
//
//   2. "the two songs must play the real audio, from these exact cues"
//      `probeMedia` answers "is there a file of this type here" by content-type,
//      which a Drive viewer page fails (text/html) even when the file is
//      playable. `probePlayable` loads the actual element instead. A YouTube id
//      is never sampled into a VideoTexture: their terms and CORS both forbid it.
//
//   3. "panels must float like the main stage, not block the screen"
//      Every exhibit panel used to be a full-height DOM card at z-40. It is now
//      a transparent plane in the world. Asserted in the interactive-pick
//      contract; here we only assert it cannot silently come back as a sheet.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(p, 'utf8')
const drops = read('source/src/scene/SocialDrops.tsx')
const layout = read('source/src/layout.ts')
const tracks = read('source/src/reality/tracks.ts')
const music = read('source/src/reality/music.ts')
const kit = read('source/src/reality/kit.tsx')
const exp = read('source/src/scene/Experience.tsx')

// --- 1. Icons upright, baked into the geometry -------------------------------
assert.match(
  drops,
  /geo\.rotateX\(Math\.PI\)/,
  'the SVG y-down / three y-up correction must be baked into the geometry',
)
assert.match(
  drops,
  /ORIENTATION — measured, not guessed/,
  'the reason must stay documented next to the fix',
)
// Applied before the normals are rebuilt, or flipped faces light backwards.
const rot = drops.indexOf('geo.rotateX(Math.PI)')
const norms = drops.indexOf('geo.computeVertexNormals()')
assert.ok(rot > 0 && norms > rot, 'rotate before computeVertexNormals')

// --- 1b. They land on the ground, not beside the mast ------------------------
const start = Number(drops.match(/const DROP_START_Y = ([\d.]+)/)[1])
const land = Number(drops.match(/const DROP_LAND_Y = ([\d.]+)/)[1])
assert.ok(start > 10 && start < 24, 'the drop must start above the pad, not at the mast head')
assert.ok(land > 0.5 && land < 1.6, 'the icons must settle on the ground (centre ~1 m)')
assert.match(drops, /DROP_START_Y - \(DROP_START_Y - DROP_LAND_Y\)\*x/, 'descent uses both constants')
assert.match(
  drops,
  /halo\.position\.y=\.03/,
  'the halo is the contact shadow and must sit on the pad, not on the icon',
)

// --- 1c. Each icon is a real link -------------------------------------------
assert.match(drops, /import \{ PROFILES, openExternal \} from '\.\.\/layout'/)
assert.match(drops, /onClick=\{\(\) => openExternal\(PROFILES\[entry\.slug\]/)
for (const slug of ['tiktok', 'discord', 'facebook', 'instagram', 'github', 'linkedin']) {
  assert.ok(layout.includes(slug + ':'), 'PROFILES must answer for ' + slug)
}

// --- 2. Owner media, exactly as supplied ------------------------------------
const MUST = [
  ['DRIVE_PORTFOLIO', 'https://drive.google.com/drive/u/0/folders/1VwZseTeVQaOWxhVKLEj7Oa6hwiZ4AQTj'],
  ['MUA_HA_AUDIO_SRC', 'https://drive.google.com/file/d/14pmfR3_CIDgX8-QgMiUpQen_-hZ0BSID/view?usp=drive_link'],
  ['HEX_MAIN_STAGE_VIDEO_SRC', 'https://drive.google.com/file/d/1gkTtTvvEgyD7lLRFFc3VhXtq1rF8h1wB/view?usp=drive_link'],
]
for (const [name, url] of MUST) {
  assert.ok(layout.includes(url), name + ' must keep the owner-supplied URL verbatim')
}
assert.match(layout, /export const MUA_HA_CUE = 114/, 'Mùa Hạ cue is 1:54 = 114 s')
assert.match(layout, /export const NGAY_MAI_CUE = 82/, 'Nếu Ngày Mai cue is 1:22 = 82 s')
assert.match(layout, /NGAY_MAI_VIDEO_ID = '179btG24VE8'/, 'the lyric video id')
assert.match(tracks, /audioSrc: MUA_HA_MEDIA_SRC/, 'the real audio is wired to the track')
assert.match(tracks, /highlight: \{ start: MUA_HA_CUE/, 'the cue drives the track')
assert.match(tracks, /highlight: \{ start: NGAY_MAI_CUE/, 'the second cue drives the track')

// --- 2b. Playable is decided by the element, not the content-type -----------
assert.match(tracks, /export function probePlayable/, 'probePlayable must exist')
assert.match(music, /probePlayable\(candidate\)/, 'the music engine must test the element')
assert.match(kit, /probePlayable\(candidate\)/, 'the video feed must test the element')
// A YouTube stream must never be turned into a VideoTexture.
assert.doesNotMatch(kit, /videoId[\s\S]{0,80}VideoTexture/, 'no VideoTexture from a YouTube id')

// --- 2c. The HEX video cannot outlive HEX ----------------------------------
// The DOM layer is only appended while the reality is open, and the player is
// destroyed when the wanted id goes away.
assert.match(exp, /const wanted = inHex && \(track === 'ngay-mai' \|\| track === 'mua-ha'\)/, 'HEX video is gated on the reality')
assert.match(
  exp,
  /if \(!parent \|\| !wanted\) return/,
  'the video layer must not be appended outside HEX',
)
assert.match(exp, /dom\.d\.remove\(\)/, 'the layer is removed on close')
assert.match(exp, /player\.current\?\.destroy\(\)/, 'the player is destroyed, not orphaned')
// And the island stage keeps its own player, which it already suspends by
// visibility — the two must not be driven by the same id.
assert.match(exp, /host === 'stage'\) return null/, 'the island stage must not borrow the HEX id')

// --- 3. Panels float -------------------------------------------------------
assert.doesNotMatch(exp, /backdrop-blur-2xl/, 'no full-height DOM sheet')
assert.match(exp, /const DISTANCE = 2\.4/, 'the card floats at a fixed distance')
assert.match(exp, /Anchor the card where the visitor is standing/, 'anchored once, does not follow')
// Order matters: the mask gradient is declared, then applied with
// `destination-in`. Fading to transparent at the top instead of opaque erases
// the panel (this was a real bug: only the top of the card survived).
const maskIdx = exp.indexOf("fade.addColorStop(0.045, 'rgba(0,0,0,1)')")
assert.ok(maskIdx > 0, 'the glass mask must reach full opacity near the top edge')
assert.match(exp, /globalCompositeOperation = 'destination-in'/, 'the mask is applied')
assert.ok(
  !/fade\.addColorStop\(0\.0?5, '#000'\)[\s\S]{0,80}fade\.addColorStop\(0\.0?5, 'rgba\(6,9,20,0\)'/.test(exp),
  'the mask must not stop at transparent where the card should be visible',
)
// Anchor is written in the open effect only.
const frames = [...exp.matchAll(/useFrame\(\([^)]*\)\s*=>\s*\{([\s\S]*?)\n {2}\}\)/g)].map((m) => m[1])
assert.ok(frames.length > 0)
assert.ok(
  frames.every((b) => !b.includes('anchor.current.pos.copy')),
  'no frame may re-anchor the card onto the camera',
)

// --- 4. Published standalone carries it ------------------------------------
const html = read('index.html')
const tag = '<script id="orbita-embedded-map" type="application/json">'
const a = html.indexOf(tag)
const b = html.indexOf('</script>', a + tag.length)
const map = JSON.parse(html.slice(a + tag.length, b))
const decode = (k) => Buffer.from(map[k].split(',')[1], 'base64').toString('utf8')
assert.ok(decode('orbita/scene/SocialDrops').includes('rotateX(Math.PI)'), 'published icons are upright')
assert.ok(decode('orbita/layout').includes('MUA_HA_CUE = 114'), 'published layout carries the cues')
assert.ok(decode('orbita/scene/Experience').includes('const DISTANCE = 2.4'), 'published panels float')
assert.ok(!decode('orbita/ui/Overlay').includes('backdrop-blur-2xl'), 'published Overlay has no sheet')

console.log(
  'BEACON_MEDIA_PANEL_PASS: icons upright and grounded, media links and owner cues, ' +
    'HEX video cannot outlive HEX, panels float',
)
