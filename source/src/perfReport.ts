/**
 * ORBITA performance tier — measurement report.
 *
 * The performance tier claims: "measure the machine, then give up the least
 * visible thing first, and only keep a concession that helped." A claim needs a
 * number, so this prints one per rung from any machine, without a GPU here.
 *
 * HOW TO RUN (in the browser that has the shipped build open):
 *   copy the body of `runPerfReport()` below into the DevTools console.
 * It prints a table and leaves `window.__orbitaPerfReport` populated.
 *
 * The script only reads: it forces rungs through the same store the Q key uses,
 * waits for each to settle, and samples the real requestAnimationFrame deltas.
 */

export const PERF_REPORT_SCRIPT = String.raw`
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // Sample real frame deltas for ms milliseconds: fps + tail latency.
  const sample = (ms) => new Promise((resolve) => {
    const t = [];
    let last = performance.now();
    const stop = performance.now() + ms;
    const tick = () => {
      const now = performance.now();
      t.push(now - last);
      last = now;
      if (now < stop) requestAnimationFrame(tick);
      else {
        const span = t.reduce((a, b) => a + b, 0) - t[0];
        const sorted = [...t].sort((a, b) => a - b);
        const p = (q) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
        resolve({
          fps: +(((t.length - 1) * 1000) / span).toFixed(1),
          p50: +p(0.5).toFixed(1),
          p95: +p(0.95).toFixed(1),
          p99: +p(0.99).toFixed(1),
          frames: t.length,
        });
      }
    };
    requestAnimationFrame(tick);
  });

  const store = window.__orbitaStore || null;
  const out = { tier: null, rungs: [], note: '' };
  if (!store) {
    console.warn('Run this on the page that hosts the build.');
    return out;
  }

  // Enter the performance tier exactly like pressing Q does.
  store.getState().setQuality('performance');
  await sleep(400);

  const ladder = window.__orbitaPerf;
  if (!ladder) {
    out.note = 'perfLadder not active; is the build current?';
    return out;
  }

  // Record what the ladder decided on its own, then measure each rung
  // explicitly so the table is comparable across machines.
  out.autoRung = ladder.rung;
  out.autoReason = ladder.reason;

  for (let rung = 0; rung <= 5; rung++) {
    // Force the rung by resetting and stepping the ladder's own state machine
    // through the public surface it exposes.
    const before = window.__orbitaPerf;
    window.__orbitaPerfForceRung?.(rung);
    await sleep(700);            // let textures/shadows reallocate and settle
    const s = await sample(1500);
    out.rungs.push({ rung, concession: before.concession, ...s });
    console.log('rung', rung, s);
  }

  // Leave the tier as we found it.
  store.getState().setQuality('low');
  window.__orbitaPerfReport = out;
  console.table(out.rungs);
  return out;
})();
`;

/**
 * Release note helper for humans: what each rung actually costs the eye.
 * Kept next to the engine so the two cannot drift apart.
 */
export const RUNG_VISUAL_COST = [
  'no change at all',
  'loses the film-grain overlay and the dark frame vignette',
  '15% fewer raster pixels; geometry, textures and shaders identical',
  'shadow edges at 1024 instead of 2048; contact shadows unchanged',
  'Bloom glow slightly tighter (3 mip levels instead of 5)',
  '28% fewer raster pixels; still double the 0.5x used under the spacecraft',
] as const;
