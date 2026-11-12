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

test('harness output is committed under a name git does not ignore', () => {
  // The evidence workflow copies the harness output into docs/evidence. It was
  // named *.log, which the repository's .gitignore drops, so the terminal error
  // never reached the repository and a crash looked like an empty run.
  const workflow = readFileSync('.github/workflows/portfolio-dossier-interaction-dev.yml', 'utf8')
  const ignored = readFileSync('.gitignore', 'utf8').split('\n')
    .map((l) => l.trim()).filter((l) => l && !l.startsWith('#') && !l.startsWith('!'))
  const copied = [...workflow.matchAll(/f:?\s*([\w./-]*harness[\w./-]*)/g)].map((m) => m[1])
  const names = copied.length ? copied
    : [...workflow.matchAll(/harness-[a-z.]*\.(\w+)/g)].map((m) => 'x.' + m[1])
  assert.ok(names.length > 0, 'evidence workflow must capture harness output')
  for (const name of names) {
    for (const rule of ignored) {
      const pattern = rule.replace(/^\//, '')
      if (pattern.startsWith('*.')) {
        assert.ok(!name.endsWith(pattern.slice(1)),
          'harness output "' + name + '" would be dropped by .gitignore rule ' + rule)
      }
    }
  }
})

test('the harness reports its own load and launch failures', () => {
  const src = readFileSync('scripts/portfolio-panel-browser-test.mjs', 'utf8')
  assert.match(src, /HARNESS_FATAL/, 'a fatal harness error must be printed explicitly')
  assert.match(src, /load-playwright/, 'a missing Playwright dependency must be reported')
  assert.match(src, /launch-chromium/, 'a browser launch failure must be reported')
  assert.match(src, /writeFileSync\(OUT\+'\/report\.txt'/, 'the report must also be plain text')
})

test('the evidence step captures harness output before failing', () => {
  // `set -eu` plus a pipeline made the step abort on the harness failure, so the
  // captured diagnosis was discarded and the repository recorded "NO REPORT".
  const workflow = readFileSync('.github/workflows/portfolio-dossier-interaction-dev.yml', 'utf8')
  const step = workflow.slice(workflow.indexOf('Real 3D exhibit clicks and dossier interaction'))
  const body = step.slice(0, step.indexOf('- name: Commit the interaction evidence'))
  // Either errexit is disabled, or the step never enables it at all: what
  // matters is that a failing harness still reaches the evidence code.
  assert.ok(/set \+e/.test(body) || /set -u\n(?!.*set -e)/.test(body),
    'the step must not abort before the harness status is captured')
  assert.doesNotMatch(body, /^\s*set -eu$/m,
    'the step must not run under errexit')
  assert.match(body, /> browser-evidence\/portfolio\/harness-out\.txt 2>&1/,
    'harness output must be written to a file, not discarded by a failing pipeline')
  assert.match(body, /cat browser-evidence\/portfolio\/harness-out\.txt/,
    'the captured output must be printed')
  assert.match(body, /exit 0/, 'the evidence step itself must complete so evidence can be committed')
  assert.match(workflow, /Fail the run when a real defect was recorded/,
    'the verdict must be enforced in its own later step')
})

test('the evidence script survives a partial or missing harness report', async () => {
  // The inline `node -e` reporter assumed report.viewports always existed, so a
  // fatal/partial report made the evidence step itself fail and the diagnosis
  // was lost. The reporter is now a script and must handle every shape.
  const {execFileSync} = await import('node:child_process')
  const {mkdtempSync, writeFileSync: write, readFileSync: read, rmSync} = await import('node:fs')
  const {tmpdir} = await import('node:os')
  const {join} = await import('node:path')
  const dir = mkdtempSync(join(tmpdir(), 'dossier-evidence-'))
  // The reporter must never be pointed at the repository while testing: doing
  // that once overwrote the committed evidence with a test fixture.
  const out = mkdtempSync(join(tmpdir(), 'dossier-evidence-out-'))
  const run = (report) => {
    if (report === null) { try { rmSync(join(dir, 'report.json')) } catch {} }
    else write(join(dir, 'report.json'), JSON.stringify(report))
    write(join(dir, 'harness-out.txt'), 'HARNESS_FATAL demo\n')
    execFileSync('node', ['scripts/portfolio-interaction-evidence.mjs'],
      {env: {...process.env, PORTFOLIO_EVIDENCE_DIR: dir,
        PORTFOLIO_EVIDENCE_OUT: out}, stdio: 'pipe'})
    return read(join(out, 'portfolio-interaction-latest.md'), 'utf8')
  }
  try {
    const full = run({backend: 'SwiftShader', viewports: ['desktop'], worldViewports: ['desktop'],
      worldEntry: [], panels: [], inputPaths: [], failures: [], plan: [], suites: [],
      passed: true, finishedAt: 'now', totalMs: 1})
    assert.match(full, /PASS — every planned proof ran/)
    const partial = run({backend: 'SwiftShader', stage: {at: 'load-playwright'}, fatal: 'no playwright'})
    assert.match(partial, /INCOMPLETE — the harness stopped part way/)
    assert.match(partial, /harness fatal: no playwright/)
    const none = run(null)
    assert.match(none, /NO REPORT/)
    assert.match(none, /HARNESS_FATAL demo/)
  } finally {
    rmSync(dir, {recursive: true, force: true})
    rmSync(out, {recursive: true, force: true})
  }
})

test('every viewport value a workflow passes is accepted by the harness', () => {
  // A regression here already cost three runs: the harness started rejecting
  // PORTFOLIO_VIEWPORTS=fast while the workflows still passed it, and every
  // suite failed at startup. The workflows and the parser must agree.
  const src = readFileSync('scripts/portfolio-panel-browser-test.mjs', 'utf8')
  const modes = new Set()
  for (const file of ['.github/workflows/portfolio-dossier-interaction-dev.yml',
    '.github/workflows/space-first-real-entry.yml',
    '.github/workflows/portfolio-panels-native-metal.yml']) {
    const w = readFileSync(file, 'utf8')
    for (const m of w.matchAll(/PORTFOLIO_VIEWPORTS:\s*([^\n]+)/g)) {
      const value = m[1].replace(/\$\{\{[^}]*\|\|\s*'([^']*)'\s*\}\}/g, '$1').trim()
      if (value && !value.includes('${{')) modes.add(value)
    }
  }
  assert.ok(modes.size > 0, 'at least one workflow must set viewports')
  for (const mode of modes) {
    for (const part of mode.split(',')) {
      assert.match(src, new RegExp('\\b' + part + ':'), 'harness must accept viewport value ' + part)
    }
  }
  assert.match(src, /aliases=\{fast:\[/, "'fast' must stay a supported alias")
})

test('committed evidence is never a test fixture', () => {
  // A test once ran the reporter without redirecting its output directory and
  // wrote a fixture over the real committed report. Evidence must always be a
  // real observation, and tests must redirect both input and output.
  const md = readFileSync('docs/evidence/portfolio-interaction-latest.md', 'utf8')
  assert.doesNotMatch(md, /HARNESS_FATAL demo/, 'fixture text must never reach committed evidence')
  const testSrc = readFileSync('tests/exhibit-click-path.mjs', 'utf8')
  assert.match(testSrc, /PORTFOLIO_EVIDENCE_OUT/, 'reporter tests must redirect output to a temp dir')
  const reporter = readFileSync('scripts/portfolio-interaction-evidence.mjs', 'utf8')
  assert.match(reporter, /PORTFOLIO_EVIDENCE_OUT/, 'the reporter output dir must be overridable for tests')
})

test('the evidence trap runs inside the harness step', () => {
  // Evidence used to be generated in a following step. When the job was torn
  // down mid-step, that step was skipped and the repository kept an old report.
  const workflow = readFileSync('.github/workflows/portfolio-dossier-interaction-dev.yml', 'utf8')
  const step = workflow.slice(workflow.indexOf('Real 3D exhibit clicks and dossier interaction'),
    workflow.indexOf('Fail the run when a real defect was recorded'))
  assert.match(step, /trap commit_evidence EXIT/,
    'evidence must be produced by an EXIT trap in the harness step')
  assert.match(step, /node scripts\/portfolio-interaction-evidence\.mjs/,
    'the trap must generate the report')
  assert.doesNotMatch(step, /\| tee /, 'the harness output must not go through a pipeline')
})

test('the harness navigates a deep link with a real load and polls slow state', () => {
  const src = readFileSync('scripts/portfolio-panel-browser-test.mjs', 'utf8')
  // A fragment-only page.goto does not reload, so #view was never applied and
  // every exhibit reported a 23-53m "placement" failure that was the harness's.
  assert.match(src, /page\.reload\(\{waitUntil:'domcontentloaded'/,
    'a deep-linked pose needs a real document load')
  assert.match(src, /if\(page\.url\(\)!==url\)/, 'the navigation must be verified')
  // The second tab is a React state flush; at ~1 fps it needs polling, not an
  // instant textContent read.
  assert.match(src, /while\(Date\.now\(\)<deadline\)\{[\s\S]{0,200}aria-selected/,
    'the activated tab must be polled, not read once')
  // Walking to a pose uses real keys and never fakes arrival.
  assert.match(src, /page\.keyboard\.down\('KeyW'\)/, 'walking must use a real held W key')
  assert.match(src, /UNPROVEN_TIME_BUDGET/, 'an unfinished walk must be labelled, not passed')
  // Internal opening is allowed ONLY as a labelled layout audit of the dossier
  // UI. It must never be the proof that a visitor can reach an exhibit.
  const worldFns = src.slice(src.indexOf('async function clickWorldEntry'),
    src.indexOf('async function auditPanel'))
  assert.doesNotMatch(worldFns, /openPanel\(/,
    'reaching an exhibit must never use the internal panel call')
  assert.match(src, /via:'dossier audit'/, 'layout-only audits must be labelled')
})
