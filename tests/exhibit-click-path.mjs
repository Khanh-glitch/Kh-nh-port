/**
 * Exhibit click-path contract.
 *
 * A visitor standing in the 3D world has exactly two ways to open an exhibit:
 * press "E" (which opens `panel` and never calls the effect handler) or click
 * the exhibit hit volume (which calls `onClick` and never falls back to
 * `panel`). Those two paths used to disagree for most exhibits: clicking only
 * played an effect, or was actively ignored while an animation was cooling
 * down, so real visitors could not reach the dossier while "E" could.
 *
 * This test is static and deterministic; scripts/portfolio-panel-browser-test.mjs
 * proves the same property at runtime with real pointer clicks.
 */
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import {test} from 'node:test'

const scene = (name) => readFileSync(join('source/src/scene', name), 'utf8')
// Every hit volume an exhibit registers, not only the ones carrying a `panel`
// prop: Products' five screens open the dossier through `select(i)`.
const panelOf = (source) => [...source.matchAll(/<Hit\b[\s\S]*?\/>/g)].map((m) => m[0])

// Physical CONTROL pads on the frozen Main Stage (cue / play / pyro). They are
// deliberate tactile controls, not exhibit entrances; the stage dossier is
// opened by "stage-body" and by the FOH show selector. They keep the `panel`
// prop so aiming at a pad and pressing E still opens the case study.
const CONTROL_PADS = new Set(['stage-cue-', 'stage-play', 'stage-fire'])

/** Extract the JSX expression of `onClick={...}` with brace matching, so
 * short-circuit expressions and nested braces are read correctly. */
function onClickOf(source, hit) {
  const tail = source.slice(source.indexOf(hit))
  const at = tail.indexOf('onClick={')
  if (at < 0) return ''
  let depth = 0
  for (let i = at + 'onClick={'.length; i < tail.length; i++) {
    if (tail[i] === '{') depth++
    else if (tail[i] === '}') {
      if (depth === 0) return tail.slice(at + 'onClick={'.length, i)
      depth--
    }
  }
  return ''
}


test('every exhibit has a click path to its own dossier', () => {
  const files = ['Orb.tsx', 'Cinema.tsx', 'Rubik.tsx', 'Piano.tsx', 'Stage.tsx',
    'Products.tsx', 'Beacon.tsx', 'VngGallery.tsx', 'Robot.tsx',
    'ApexShowcase.tsx', 'RagnarokShowcase.tsx']
  for (const file of files) {
    const source = scene(file)
    const hits = panelOf(source)
    assert.ok(hits.length > 0, `${file}: no dossier hit volume at all`)
    const opens = hits.filter((hit) => {
      const id = hit.match(/id=["'{]?([\w$\-{}.]+)/)?.[1] ?? ''
      if ([...CONTROL_PADS].some((pad) => id.startsWith(pad))) return false
      const onClick = onClickOf(source, hit)
      return /openPanel\(/.test(onClick) ||
        onClick.split(/[^\w$]+/).filter(Boolean).some((name) =>
          new RegExp(`(const|function) ${name}\\b[\\s\\S]{0,600}?openPanel\\(`).test(source)) ||
        // A shared selection helper that dispatches through the store, e.g.
        // Products.select(i) -> __orbitaPanelSelection + openPanel('products').
        onClick.split(/[^\w$]+/).filter(Boolean).some((name) =>
          new RegExp(`(const|function) ${name}\\b[\\s\\S]{0,600}?__orbitaPanelSelection`)
            .test(source))
    })
    assert.ok(opens.length > 0,
      `${file}: no exhibit click opens the dossier; a visitor cannot reach the case study with the mouse (only "E" works)`)
    for (const hit of hits) {
      const id = hit.match(/id=["'{]?([\w$\-{}.]+)/)?.[1] ?? ''
      if ([...CONTROL_PADS].some((pad) => id.startsWith(pad))) continue
      const onClick = onClickOf(source, hit)
      assert.ok(onClick.length > 0,
        `${file}: ${id} advertises a dossier but has no onClick at all`)
    }
  }
})

test('exhibit effects never silently swallow the click', () => {
  // Orb used to `return` while its charge animation was cooling down, so most
  // clicks did nothing at all.
  const orb = scene('Orb.tsx')
  assert.match(orb, /const animateAndOpen/,
    'Orb must open its dossier regardless of the charge-animation cooldown')
  assert.match(orb, /onClick=\{animateAndOpen\}/,
    'Orb hit volumes must use the open-capable handler')
  // Robot used to re-summon (and hide the showcase) on every click.
  const robot = scene('Robot.tsx')
  assert.match(robot, /const colossusClickAndOpen/,
    'Colossus must distinguish "summon" from "open dossier"')
  assert.match(robot, /resumeAfterSummon/,
    'Colossus must continue into the dossier after the summon animation')
  for (const [file, name] of [['ApexShowcase.tsx', 'abilityAndOpen'],
    ['RagnarokShowcase.tsx', 'surgeAndOpen'],
    ['Rubik.tsx', 'turboAndOpen'], ['Cinema.tsx', 'nextAndOpen']]) {
    const source = scene(file)
    assert.match(source, new RegExp(`const ${name}`),
      `${file}: the effect handler must also open the dossier`)
    assert.match(source, new RegExp(`onClick=\\{${name}\\}`),
      `${file}: the exhibit must use the open-capable handler`)
  }
})

test('the main stage sends visitors to its case study, not away from it', () => {
  const stage = scene('Stage.tsx')
  assert.match(stage, /id="stage-body"[\s\S]{0,300}onClick=\{\(\) => openPanel\('stage'\)\}/,
    'Clicking the Main Stage must open the frozen Main Stage case study')
  assert.doesNotMatch(stage,
    /Đến khu FOH phía trước sân khấu để gọi lại một chương trình/,
    'The stage must not answer a click with a redirect message')
})

test('the VNG competition dossier is reachable from where a visitor stands', () => {
  const vng = scene('VngGallery.tsx')
  const hit = vng.match(/id="vng-project-dossier"[\s\S]*?\/>/)?.[0] ?? ''
  assert.ok(hit, 'VNG dossier hit volume missing')
  const maxDist = Number(hit.match(/maxDist=\{(\d+)\}/)?.[1] ?? 0)
  assert.ok(maxDist >= 40,
    `VNG dossier maxDist=${maxDist} is too short: standing at the kiosk disables the trigger`)
  assert.match(vng, /changeSlide\(1\); openPanel\('vng'\)/,
    'The projection screen must also open the competition dossier')
})

test('clicking a dossier control can never pass through to the 3D scene', () => {
  // The dossier is a DOM overlay above the canvas; this asserts the shipped
  // standalone keeps the overlay mounted above the scene and that the canvas
  // only receives pointer input when no dossier is open.
  const player = scene('Player.tsx')
  assert.match(player, /if \(s\.phase !== 'playing' \|\| s\.panel \|\| s\.paused\) return/,
    'The 3D pointer handler must ignore input while a dossier is open')
  assert.match(player, /if \(document\.pointerLockElement === el\) \{\s*activate\('click', hovered\.current\)/,
    'Pointer-lock clicks must activate the hovered exhibit')
  assert.match(player, /if \(dragging && moved < 8\) activate\('click', pick\(true\)\)/,
    'Drag-look clicks must raycast the pointer, so a real click reaches the exhibit')
})

test('the interaction harness cannot crash before it reports', () => {
  // A harness that dies while parsing configuration writes no evidence at all,
  // which is indistinguishable from "nothing ran". Guard the specific class of
  // bug that did this (null.split on the default viewport mode) and require a
  // report to be the last thing that always happens.
  const src = readFileSync('scripts/portfolio-panel-browser-test.mjs', 'utf8')
  assert.doesNotMatch(src, /\(MODE\s*===\s*'all'\s*\?\s*null\s*:\s*MODE\)\.split/,
    'viewport mode parsing must not call split on null')
  assert.match(src, /finally\s*\{[\s\S]*writeFileSync\(OUT\+'\/report\.json'/,
    'the report must be written in a finally block so every failure is recorded')
  assert.match(src, /Unknown PORTFOLIO_VIEWPORTS value/,
    'an unknown viewport name must fail with a readable message')
  for (const name of ['dom','world'])
    assert.match(src, new RegExp(`'${name}'`), 'suite kind '+name+' must be planned')
  // Every exhibit entry must name the real hit volume it is aimed at.
  const entries = [...src.matchAll(/\{id:'(\w+)',hit:'([\w-]+)'/g)].map((m) => m[2])
  assert.ok(entries.length >= 7, 'expected every exhibit to have a real hit volume target')
  for (const hit of entries)
    assert.match(hit, /^[\w-]+$/, 'hit volume id must be a literal, not an expression')
})
