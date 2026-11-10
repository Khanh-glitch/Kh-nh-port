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

## 2026-11-10 compositor and GPU synchronization follow-up

- **Opt-in `Post` A/B** ([6-run Metal matrix](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42776366240), `49435d3`): original full postprocessing (3 runs) worst first-click callback gaps **853 / 882 / 1130 ms**, new programs **0/0/0**. Removing all postprocessing only for diagnosis gave **969 / 1180 / 1214 ms** but two new shader programs in each run; not an exact shader-matched comparison, thus NO evidence to remove Bloom, post effects, or tone mapping. The production default retains everything.
- **Chrome trace (not yet fully ready)** ([raw trace and attribution](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42777147920/artifacts/13743554945), `96fdd93`): 48,706 events with 25,064 GPU/viz/graphics-category events. A 916-ms `SkiaOutputSurfaceImplOnGpu::SwapBuffers` / `IOSurfaceImageBacking::WaitForCommandsToBeScheduled` chain and a 495-ms `GLES2Implementation::GetProgramiv` / command-buffer wait were captured, along with a 750-ms main-thread animation-frame task. **Causal limitation:** `warmupAtClick=scheduled`; these timings might include unfinished shader linking and are NOT proof of identical behavior after fully ready, nor of a defect on the user's actual GPU. Tracing itself perturbs timing.
- **After-full-ready trace** ([workflow](https://github.com/Khanh-glitch/Kh-nh-port/actions/workflows/colossus-gpu-trace.yml), `b8e3d64`): requires `status=ready`, `gpuSynced=true`, `uploadedProxies>=totalProxies` before beginning trace, otherwise fails closed. Record the result before claiming specific root cause.
- **Policy unchanged:** no production visual quality reductions, no main merge, no false-green. Do not treat Apple Paravirtual Metal as real user-device hardware certification.


## 2026-11-10 full-ready GPU trace, direct WebGL-call instrumentation

**This supersedes the above statement that full-ready compositor evidence was pending.**

- [Full-ready trace, run 42777498916](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42777498916), branch commit `b8e3d644`: BEFORE click `status=ready`, `laserReady=true`, `uploadedProxies=131/131`; after click `programDelta=0`, worst rAF gap **1045 ms**, first beam submitted **1227 ms**. Chrome trace records **889 ms** in `SkiaOutputSurfaceImplOnGpu::SwapBuffers` and `IOSurfaceImageBacking::WaitForCommandsToBeScheduled::Dawn`; this is an Apple Paravirtual Metal GPU/compositor stall, not a proof of faulty JS loop, nor a prediction for a physical GPU.
- [Direct WebGL API timing, run 42777862888](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42777862888), commit `193e90ba`: injected opt-in interceptors for GL calls from browser startup, with recording only after first click; NEVER shipped in normal app. **Two fully ready runs:** longest monitored synchronous WebGL call only **3 ms** and **9 ms**, yet maximum rAF gaps **996 ms** and **1027 ms**, with `programDelta=0`. **One no-prewarm completed run:** `getProgramInfoLog` blocked **1227 ms** and **458 ms**, maximum rAF gap **1753 ms**, two new shader programs. A fourth run timed out and is rejected as missing data.
- **Interpretation:** earlier async compilation and GPU warmup genuinely eliminated the expensive first-use GL program-info synchronization. The residual roughly 1-second gap after 131/131 ready is consistent with the independently traced compositor/IOSurface queue. *These two types of stutter must not be conflated or counted as solved by source/build green.* WebGL interception has measurement overhead and does not observe external compositor calls.
- **New isolated experiment:** Opaque WebGL canvas using `colossusOpaqueCanvas=1`; keep the default context / visual appearance unchanged. The first object-form attempt reported `contextAlpha=true` despite requesting false, and **is invalid as A/B evidence**. The subsequent explicit WebGLRenderer factory is diagnostic only; acceptance requires `getContextAttributes().alpha===false`, repeated same-run normal comparisons, first-beam timing and visual parity. Pending result must not be treated as a win.

**Decision:** prewarm remains necessary for eliminating shader log stalls, but insufficient for smooth delivery. No main merge or production visual downgrade. On a physical GPU, also validate the original user's initial-loading/idle complaint separately from first Colossus click: no-click baseline has already demonstrated stalls in virtualized renderers.
