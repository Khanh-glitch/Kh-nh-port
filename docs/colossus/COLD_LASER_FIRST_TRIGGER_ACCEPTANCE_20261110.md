# COLOSSUS — First-Trigger Performance & Visual Acceptance Ledger

Updated: 2026-11-10. **Single authoritative ledger — supersedes dated provisional claims in earlier commits.**

**Decision: NOT ACCEPTED for zero-stutter. NO MERGE into `main` or production.**

## Non-negotiable experience contract

Cold first activation of Colossus laser, APEX CHAOS and Ragnarok must not freeze or visibly hitch. Retain original live 3D meshes, animations, materials, shader appearance, lighting, original 2048×2048 directional shadows, Bloom/ChromaticAberration/Noise/Vignette/ToneMapping, quality/pixel ratio, scan reveal and particle effects. Source compilation, a functional button and a green smoke job are NOT performance or visual acceptance. Diagnose first, change only justified paths, then prove actual frame pacing and image parity.

## How to interpret the evidence

- Browser smoke serves the **exact candidate**: CI transpiles selected source modules to the existing integrated 56+ module `index.html` map and serves the generated `dist-pages/` over loopback. Do not reuse historical Cloudflare preview URL as proof of newer commits.
- `maxFrameMs` is a gap **between React Three Fiber frame callbacks**, not GPU-only execution or guaranteed display/presentation timing. `firstBeamFrameAtMs` is the first real beam *submission* from R3F, not proof the display presented it at that exact millisecond.
- Headless Ubuntu runners identify as **SwiftShader software rasterizer**: all multi-second absolute numbers there are software-environment measurements, not the user's computer.
- macOS runner returns **`ANGLE (Apple, ANGLE Metal Renderer: Apple Paravirtual device, Unspecified Version)`**. This is a virtualized Metal backend; calling it actual bare-metal M1 user-hardware verification is FALSE. Measurements are more representative than SwiftShader but do not certify the user's hardware.
- Strict smoke now FAILS non-smooth runs (>120ms callback gap, slow initial callback, missing first beam), even if build and interaction pass. Red CI here is an intentional rejection, not an excuse for false green.

## Implemented and kept

1. Frozen light-count rig for APEX and Ragnarok with original animated light world-space transforms, zero intensity when dormant. No production lighting values changed.
2. Shared identical materialization GLSL cache key, per-material uniforms retained; animation scan-culling skips only conservative fully shader-discarded mesh bounding boxes. Dynamic/instanced objects retain original behavior.
3. GPU warmup prioritized 3 Colossus beams + impact flare, followed by optional showcase textures and 4-mesh batches in healthy idle frames. Offscreen output color-space matches the renderer; state restored per pass; asynchronous GPU readback recorded separately from draw-command submission.
4. Shader precompile representative mapped/unmapped Basic/Physical materialization variants, asynchronously on Metal; skip dangerous eager compile on software GL. Post-click new programs can reach **0**.
5. Adaptive frame-gated scheduler replacing the overly strict fixed 50ms: bound based on recent visible callback median, never accept >100ms as healthy. Cancels on summon and avoids saturating visibly overloaded renderers. Live graphics settings unchanged.
6. Test-only URL toggles: `colossusPrewarm=off`, `colossusShadowProbe=off` (renderer global shadow state restored), `colossusPostProbe=off` (standalone Experience module also synchronized). **None activates by default.** The normal portfolio retains 2048px shadows and every post effect.

## Evidence / measured decisions

### CPU/GPU prewarm and early stutter

- [SwiftShader no-click A/B](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42768465570): even with GPU warmup *disabled*, idle rAF callback gaps 3,450 / 3,617 / 3,483ms. Therefore not every long gap is caused by clicking the robot or a shader.
- [Metal async shader precompile](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42770688726): 3 runs, 0 new post-click shaders, first beam submitted at 290 / 334 / 251ms, worst callback gaps 988 / 1054 / 870ms. Shader cache fixed part of first-use work, NOT the whole freeze.
- [Metal adaptive prewarm A/B](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42772720774): enabled prewarm 3 runs 764 / 746 / 834ms max gaps, with laser ready and zero new post-click shaders. Disabled prewarm: 947 / 1172 / 990ms, two new programs each. Material gains demonstrated, but **not smooth**.

### Rejected experiments — do not reinstate without contrary evidence

- APEX-first full queue (all 76 APEX proxies before Ragnarok) [Metal A/B](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42773047057): first-trigger worst gaps 879 / 1031 / 1323ms despite 68–76 APEX meshes warmed. Reverted via `47089c2e`; do not treat uploaded mesh counts as smoothness.
- Test-only shadows OFF vs normal [Metal A/B](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42773847619): shadow-normal worst gaps 940 / 1277 / 1356ms vs all-shadow-off diagnostic 524 / 773 / 729ms. **Shadow rendering contributes materially** but does not account for the entire gap. Disabling real scene shadows is NOT an accepted optimization.
- Warm private cloned 2048px shadow maps vs private 64px [Metal first-click/idle A/B](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42774535899) and [no-click](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42774535280): 2048px prewarm worst click gaps 884 / 1046 / 1073ms; 64px 1230 / 941 / 628ms. Idle A/B also showed large stalls. No proven win; reverted via `b77cc3e5` to light private shadow variant. Production shadows were NEVER downgraded.

### Delayed click / completeness test proves GPU prewarm is NOT sufficient

- [9-second idle then cold first click](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42775285269): enabled prewarm still had max gaps 992 / 928 / 868ms (0 new programs), even when the laser itself had been prepared. Disabled variant also remained unsmooth.
- [Fully GPU-ready gate](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42775891828): **all 3** actual Metal-virtualized trials reached `status=ready`, `gpuSynced=true`, `uploadedProxies=131/131`, `earlyShaderCompileStatus=compiled` BEFORE clicking; all had 0 new shader programs after click. Worst callback gaps **1220 / 1078 / 1252ms**, first beam submissions **1387 / 1239 / 1409ms**. Thus more of the same prewarm is NOT an evidence-based fix. Investigate the actual render/shadow/compositor pass and baseline frame pacing.
- New opt-in postprocessing compositor A/B [workflow](https://github.com/Khanh-glitch/Kh-nh-port/actions/workflows/colossus-post-ab.yml), source change `49435d3`: compares original postprocessing against off purely for causal diagnosis. **Pending measured comparison when this ledger section was written.** Do not switch the normal portfolio to post-off even if diagnostic run is faster.

## Validation/acceptance still required

- Always compare **immutable baseline `main` against candidate** on the same hardware, quality, viewport, DPR, scene and fresh browser profile, at least three actual cold visits each. Capture GPU backend string, frame pacing, input-to-submitted/presented laser (state distinction), new shader IDs, long-animation frames, and whether the tab was visible/focused.
- Exact image parity requires true screenshot comparisons at scan 0, 10, 25, 50, 75 and 100%, camera locked; APEX and Ragnarok materialization, shadows, lighting, animation, interactive HUD, retract/resummon. This has NOT been proven yet. Do not claim source config equality alone is visual acceptance.
- Reject 2-second click freezes, multi-hundred-millisecond gaps, missing first beams, timeline/quality regressions, and GPU-virtualization claims masquerading as real hardware.
- Do not alter `main`/production until zero perceptible hitch and intact visual fidelity are demonstrated; every rejection must lead to a corrective experiment or explicit named blocker.

**Next actual work:** determine whether postprocessing contributes materially to the remaining Metal-virtualized stall; if not, profile actual dynamic shadow/render passes rather than adding warmup. Avoid rerunning rejected APEX-priority or full-shadow-prewarm ideas without new evidence.
