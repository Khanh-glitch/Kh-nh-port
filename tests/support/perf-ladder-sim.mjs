// Simulate the performance ladder against synthetic frame streams.
// This is the same decision engine the browser runs; only the clock and the
// frame stream are synthetic, so a behaviour claim here is a real claim about
// the shipped logic rather than a description of it.
globalThis.document = { hidden: false, visibilityState: 'visible' }
let nowMs = 0
globalThis.performance = { now: () => nowMs }

// The compiled module is produced by the caller (tests/perf-tier-ladder.mjs)
// with the repo's own esbuild, so this harness always runs the real engine.
const { perfLadder, RUNG_CONCESSIONS } = await import(process.env.PERF_LADDER_MODULE)

function run(label, fpsAtRung, seconds = 14) {
  perfLadder.reset()
  nowMs = 0
  let t = 0
  const seen = []
  while (t < seconds * 1000) {
    const r = perfLadder.rung
    if (seen[seen.length - 1] !== r) seen.push(r)
    const fps = Math.max(5, fpsAtRung(r))
    const dt = 1000 / fps
    perfLadder.record(dt / 1000)
    t += dt
    nowMs = t
  }
  const api = globalThis.__orbitaPerf
  console.log(label.padEnd(36), 'rung=' + api.rung, 'fps=' + api.fps,
              'mode=' + api.mode, '|', api.reason)
  return { rung: api.rung, fps: api.fps, mode: api.mode, futile: api.futile, seen }
}

let failures = 0
const check = (name, ok, detail) => {
  if (ok) console.log('  ok   ' + name)
  else { console.log('  FAIL ' + name + (detail ? ' -> ' + detail : '')); failures++ }
}

// 1. A fast machine must lose nothing at all.
const fast = run('fast machine (100 FPS at rung 0)', () => 100)
check('fast machine keeps full visuals', fast.rung === 0 && fast.mode === 'done', 'rung=' + fast.rung)

// 2. A machine that only needs the first concession must not take more.
const one = run('needs exactly one concession', (r) => (r >= 1 ? 60 : 40))
check('stops after the first concession', one.rung === 1, 'rung=' + one.rung)

// 3. A weak machine that keeps improving must keep climbing, and must not
//    overshoot past the point where it is already smooth.
const weak = run('weak machine, needs 3 rungs', (r) => [28, 37, 47, 58, 61, 61][r])
check('climbs only as far as needed', weak.rung >= 2 && weak.rung <= 4, 'rung=' + weak.rung)

// 4. THE IMPORTANT ONE: concessions that buy nothing must be undone, not kept.
const hopeless = run('concessions buy nothing', () => 22)
check('does not spend visuals for nothing',
      hopeless.rung === 0 && hopeless.futile.length >= 1,
      'rung=' + hopeless.rung + ' futile=' + JSON.stringify(hopeless.futile))
check('reports an honest limit', /giới hạn|không cải thiện/.test(globalThis.__orbitaPerf.reason),
      globalThis.__orbitaPerf.reason)

// 5. Visual cost must be monotone: later rungs are never cheaper-looking.
for (const r of [1, 2, 3, 4, 5]) {
  check('rung ' + r + ' renderScale is non-increasing',
        RUNG_CONCESSIONS[r].renderScale <= RUNG_CONCESSIONS[r - 1].renderScale)
  check('rung ' + r + ' shadow map is non-increasing',
        RUNG_CONCESSIONS[r].shadowMapSize <= RUNG_CONCESSIONS[r - 1].shadowMapSize)
}

// 6. Rung 0 must be pixel-identical to today's low tier: nothing removed.
const r0 = RUNG_CONCESSIONS[0]
check('rung 0 removes nothing',
      r0.dropFilmPasses === false && r0.renderScale === 1 &&
      r0.shadowMapSize === 2048 && r0.bloomLevels === 5)

// 7. A tab switch / long task must not be mistaken for a slow machine.
perfLadder.reset()
nowMs = 0
for (let i = 0; i < 40; i++) { perfLadder.record(1 / 60); nowMs += 1000 / 60 }
perfLadder.record(5) // a 5-second stall, e.g. the tab was hidden
for (let i = 0; i < 120; i++) { perfLadder.record(1 / 60); nowMs += 1000 / 60 }
check('a stalled frame does not trigger downgrades', perfLadder.rung === 0, 'rung=' + perfLadder.rung)

console.log(failures ? '\n' + failures + ' FAILURE(S)' : '\nladder simulation: all scenarios pass')
process.exit(failures ? 1 : 0)
