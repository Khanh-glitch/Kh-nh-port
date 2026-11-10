# COLOSSUS — Cold Laser First-Trigger Acceptance Ledger (2026-11-10)

**Status: NOT ACCEPTED for zero-stutter; source/build checks pass, first-trigger hardware + visual acceptance NOT proven.**
**Custody:** `main` / production intentionally untouched. This is an experimental branch; do not merge based on green CI alone.

## User's non-negotiable contract

First laser activation at Colossus must not visibly hitch and must not downgrade shaders, 3D models, shadow quality, resolution, Bloom, particles, motion or materialization effects. A working button, successful build or absence of JS exceptions is insufficient.

## Implemented source changes

- `ApexShowcase.tsx` and `RagnarokShowcase.tsx`: original showcase lights remain in a stable shader-light-count rig, tracking the original anchor transforms, inactive at zero intensity.
- `materialize.ts`: physically identical GLSL compiled under a shared program cache key; uniforms stay material-local.
- Showcase scan: conservative world-space AABB gating only for the meshes whose existing materialization shader would discard all fragments. Dynamic actors/instanced geometry excluded. Full model returns at materialization complete.
- `ShowcaseWarmup.tsx`: 4 beam/impact resources are prioritized before 120 exhibit meshes; heavy whole-scene `compileAsync` removed; offscreen target matches output color space and restores renderer state per draw; cancel on first summon; offscreen shadow-map resolution affects ONLY private cloned lights, never live scene.
- **Current round:** frame-budget gating of background *showcase* work. Requires 3 consecutive visible frames <=50 ms and no pending input; otherwise yields without touching the visible scene. Four laser resources bypass this gate and are prioritized. Diagnostic `laserReady` and `deferredShowcaseFrames` track real runtime behavior. No new UI delays were imposed.
- Source patches are synchronized into the 56-module embedded map in root `index.html`. Cloudflare deploy must use built integrated HTML; testing only `source/dist` or the old root index is invalid.

## Reproducible evidence

- [Laser-priority CI, 3 first-trigger trials](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42751901896): worst individual frame 5,394 / 3,377 / 2,575 milliseconds. Inconsistent and all too slow on software GPU.
- [Render-layer causal isolation](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42752601323): disabling isolated visual layers did not consistently remove stutter. Do NOT sacrifice graphics based on it.
- [Reality idle draw gating A/B](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42753266298): idle and laser results overlap noisily; not a supported win; keep this experimental branch unmerged.
- [WebGL backend fingerprint paired tests](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42754040528): explicit `swiftshader`, `angle-gl`, and `egl` flags ALL resolved to `ANGLE ... SwiftShader Device (Subzero)`. These are three configurations of ONE SOFTWARE renderer, NOT hardware independent validation.
- [Frame-budget CI source/build test](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42754601240): PASS.
- [Frame-budget Chrome smoke](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42754727431): one valid trial had `laserReady=true`, 4 laser proxy uploads, and 4 deferred showcase frames; max frame 5,400 ms. Another valid trial reached 2,656 ms. Third had no completed profile even though legacy smoke marked success. The smoke test has NOW been corrected to require a completed first-trigger profile; earlier greens lacking that field are INVALID as performance evidence.

## CORRECTED profiler round (source compiled and deployed, no stale HTML)

The original profile mistakenly used R3F's raw first-frame `dtRaw`, which may include time **before** the click. It also permitted false-green Chrome tests with no completed profile. Both defects have now been fixed and the browser test is pinned to the immutable Cloudflare deployment `https://107d7b2c.menniverse.pages.dev`; it rejects old source by validating `frameMeasureOrigin`, and rejects a missing profile.

[Strict post-click-clock browser CI](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42755589843) — **all 3 jobs PASS as valid measurements, NOT as smoothness acceptance**:

| Trial | First frame from click | Worst post-click callback gap | Pre-click laser-ready | Beam submitted within 3-second profile |
|---|---:|---:|---|---|
| 1 | 329 ms | 3,541 ms | false | no |
| 2 | 2,626 ms | 2,626 ms | false | no |
| 3 | 209 ms | 5,289 ms | false | no |

All executed on ANGLE/SwiftShader, not a physical hardware GPU. The new profile records click-to-first-rAF accurately, but an rAF callback is NOT a displayed/presented frame. `firstBeamFrameAtMs=null` means the laser was not submitted within the initial three-second profiling window; it does NOT prove the beam never appeared afterward. The experience is **still demonstrably unsmooth in this software environment**. Do NOT reuse any older uncorrected "maxFrameMs" as causal proof.

## Interpretation and explicit non-claims

Slow first draw remains on the software GPU, and idle frames can stall without any laser. No measured command or React commit alone accounts for the full interval. `maxFrameMs` is duration **between** requestAnimationFrame callbacks, not GPU-only duration. Neither software-backend results nor CI-build success proves the user's actual GPU is hitch-free. Original/modified GOLD screenshots have not been accepted as visually identical; unchanged source settings and geometry tests are necessary but insufficient.

## Next acceptance action (no manual work for user)

1. Verify the corrected strict smoke CI; reject missing profiles, wrong URL, wrong summon mode, or JS/WebGL errors.
2. Keep the best independent complete preview available but do not deploy to `main` on software-GPU evidence.
3. Seek an automation-capable **hardware-accelerated** browser runner, fingerprint the actual GPU, then compare baseline and candidate cold visits with ≥3 trials each under identical viewport, pixel ratio and scene settings. Record input-to-first-laser, rAF max/p95, shader counts, context loss and frame screenshots AFTER the timing window.
4. Confirm APEX and Ragnarok full materialization and repeat retract/resummon, plus image parity at multiple progress points; no loss of geometry, shadows, lighting, timing or detail.
5. If no genuine GPU runner is available, label hardware verdict BLOCKED rather than making the user execute DevTools, ZIPs or a QA checklist or claiming PASS.

**Decision:** source/test checks PASS; browser smoke functional PASS when profile exists; real-GPU and visual acceptance BLOCKED; no merge/production.
