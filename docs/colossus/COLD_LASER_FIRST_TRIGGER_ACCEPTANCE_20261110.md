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


## 2026-11-10 fully-ready same-session idle vs click comparison (new evidence)

- [Controlled Metal comparison, run 42781481249](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42781481249), source commit `f1437501`, exact 1280×720 viewport, same live WebGL context/quality/scene, **131/131 proxies uploaded**, `gpuSynced=true`, `status=ready`, then five seconds of idle followed by one cold click and five seconds of post-click sampling. Apple Paravirtual Metal, **not a physical machine**.
- Trial 1: idle rAF max **167 ms** (p95 67, median 33); after-click max **967 ms** (p95 100, median 50), main R3F profile max **1018 ms**, laser first submitted **172 ms**, zero new shader programs; React commit 5 ms.
- Trial 2: idle rAF max **233 ms** (p95 67, median 33); after-click max **1050 ms** (p95 100, median 50), R3F profile max **1056 ms**, laser first submitted **243 ms**, zero new shader programs; React commit 8 ms.
- This **does** distinguish an activation-correlated large frame gap from the ready/idle baseline in these two trials. It **does not** yet separate shadow submission from other 3D GPU/compositor work; neither callback timestamps nor prewarm counts prove a pixel reached the physical display. Both trials appropriately FAILED strict frame acceptance.
- Code improvement in `f1437501`: `Robot.tsx` now uploads its 512×192 console CanvasTexture only when the display mode actually changes. This removes redundant GPU uploads while retaining identical console pixels. Build/source verification PASSED (run 42781481163), but no causal improvement to worst frame pacing was demonstrated; **not accepted as a hitch fix**.
- Follow-up fully-ready identical-session diagnostic: compare **original full shadows** to **test-only shadows disabled**, with timestamped >120ms callback gaps and shader program count, to attribute the activation-induced delta without altering normal portfolio visuals. All production settings remain unchanged; no merge into `main`.


## 2026-11-10 full-ready shadow-on/off and slow-frame timing (resolved)

[Four-trial controlled Metal diagnostic, run 42782336885](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42782336885), source `4047cd2b`; same-session 5-second idle versus 5-second click, both scenarios at 131/131 uploaded and `status=ready`, 0 new post-click shader programs, Apple **Paravirtual** Metal only.

| Diagnostic | Trial | Idle max rAF gap | Post-click max rAF gap | First laser R3F submission | R3F slow-frame timing | React commit |
| --- | --- | ---: | ---: | ---: | --- | ---: |
| Original 2048px shadows ON | 1 | 67 ms | **1,283 ms** | 1,443 ms | at 1,443 ms, gap 1,281 ms | 3 ms |
| Original 2048px shadows ON | 2 | 217 ms | **1,067 ms** | 250 ms | at 1,327 ms, gap 1,077 ms | 3 ms |
| ALL shadows OFF **diagnostic only** | 1 | 67 ms | **800 ms** | 933 ms | at 932 ms, gap 801 ms | 6 ms |
| ALL shadows OFF **diagnostic only** | 2 | 67 ms | **833 ms** | 1,000 ms | at 954 ms, gap 848 ms | 2 ms |

**Revised finding:** shadow pass is a significant contributor, but not the only bottleneck; even removing all shadows leaves 800–833 ms frame gaps on this virtual GPU. The stall can occur **before** the first laser R3F callback (trial 1) or **after** it (trial 2). Thus the previous two-trial suggestion that the big stall always occurs after the first visible beam was TOO STRONG and is now superseded. No React loop, new shader compilation, or unfinished preload accounts for the observed large gap. CPU/GPU compositor scheduling and first-visibility render workload remain the locus for investigation, but a physical GPU may behave differently. No visual downgrade or production shadow toggle is authorized; still **NOT ACCEPTED**, no merge.

**Concrete next engineering target:** isolate first-visibility render pass (laser primitives, transparent/materializing exhibits, cast-shadow draw load) while retaining exact geometry/materials/lighting; favor draw-call batching and conservative zero-pixel culling supported by captures, not shaderless proxies, loss of shadows, reducing DPR or effect removal. Any implementation must be independently visually compared at multiple scan percentages before being accepted.


## 2026-11-10 first-visibility / shader deep isolation — final status of this round

1. [6-trial component ablation, run 42783185283](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42783185283): all 131/131 prewarm resources ready, Metal Paravirtual GPU, same normal 2048px shadows. Full original displays: post-click rAF max 1000/1333ms; disabling ONLY visible laser/impact for diagnosis: 1167/1367ms; disabling BOTH 3D exhibit groups for diagnosis but keeping laser: **150/350ms**. Thus activation of dense 3D exhibit rendering, not laser draw primitives, explains most large observed frame gaps in this environment. Ablation is NOT acceptable as production appearance.
2. [Early fragment-discard A/B, run 42784509013](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42784509013): legacy rAF max 1350/1083/1083ms, opt-in early 833/1017/1050ms, zero shader creation after full readiness. A second run [42785965807](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42785965807) reversed the relative result: legacy 1150/1050ms vs early 1033/1367ms and conservative fast-discard 1050/1233ms. **No replicated >120ms pass, no proven stable performance win. Keep disabled by default.**
3. [Exact shader pixel parity fixture, run 42786071392](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42786071392): Basic/PBR, mapped/unmapped, alpha-test, 480x360 frame, six scan stages, BOTH early and fast variants **0 mismatched pixels** for 12 comparisons against original legacy in Metal Paravirtual. This is a LIMITED shader fixture, not whole-site visual acceptance.
4. Hologram-direct early-return test [42786531044](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42786531044) **failed exact pixels**: at scan 50%, 55 pixels differed, maximum channel delta 49; moving to after-normal hook [42787253855](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42787253855) still differed at 50% (56 pixels, delta 49). Full-ready performance [42786531091](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42786531091) also remained unsmooth: hologram 1033/1667ms compared with legacy 1150/1550ms, fast 1300/1033ms. **Rejected. Removed the hologram-direct code and test option from candidate**; do not label its visuals pixel-perfect.
5. Default `materialize.ts` retains original shader and original `orbita-materialize-shared-v1` cache identity. The proven pixel-exact fast/early variants remain explicit URL **diagnostic-only**, no production activation. The 512x192 unchanged console texture upload optimization remains. Do not change main or shadow/Bloom/DPR.

**Round decision: HOLD zero-stutter.** Build/source and isolated shader fixture parity are necessary but insufficient. Materializing dense 3D exhibit first-visibility rendering correlates with the large stall; remaining shadow/compositor rendering and actual cold GPU production buffers must be diagnosed at the first visible scan frames. Do not claim zero-stutter without same-hardware cold baseline, repeated frame pacing and whole-site screenshot parity.


## 2026-11-10 onward: real-shadow-preflight engineering continuation

### Executed and preserved

- `fe206ec4`: opt-in 96px full-lit fragment preflight, restores `uComplete` synchronously. [A/B 42820901900](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42820901900) legacy post-click rAF peaks **1033 / 1200 ms** versus full-lit **1183 / 1100 ms**. No clear improvement; OFF by default.
- `66758598`: opt-in world-space proxy preflight (512px color target; cloned 2048px directional shadows). [A/B 42822057894](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42822057894) legacy **1000 / 1017 ms** versus deep **1217 / 967 ms**. Again no stable improvement. OFF by default.
- `d8009ec3`: CI-only ablation disables shadow casting for the NEWBOT mesh group, not the whole world. [A/B 42823083595](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42823083595) original with shadows **1483 ms** in the available comparable trial; suppressed model shadows **883 / 1067 ms**. Supports a meaningful *model-specific shadow workload* contribution; shadow suppression **NOT** allowed in production. The other baseline job was still queued when this section was written.
- `2f80597a`: genuine zero-quality-loss source fix: each of Colossus's procedural `Part` rounded geometries is memoized by dimension; Robot's 4 other inline rounded shapes plus APEX's 17 inline rounded shapes use stable per-component geometry caches. No new GPU buffer IDs on unrelated React state updates. [CI build 42823598518](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42823598518) PASS. [Geometry A/B 42823598316](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42823598316) legacy **1033 / 883 ms** versus cached **1000 / 1633 ms**: **no demonstrated improvement in worst-frame timing on virtual GPU**, so source fix is retained for correctness/resource stability, not labeled a hitch cure.
- `6b4a52ac`: APEX glow sprite texture now `useMemo` instead of being regenerated on summon completion React renders. Default appearance/material/silhouette identical; removes another unnecessary GPU texture identity churn.

### Native LIVE scene preflight: significant but provisional evidence

- `f7e83752`: A/B of detached warmup versus an offscreen draw of **actual showcase scene** with real source mesh transforms and the *original* 2048px directional shadow attachment. [Early native A/B, run 42824502641](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42824502641): native samples **367 ms, 417 ms** post-click rAF maxima, one available legacy sample **1033 ms**, after 131/131 proxy-ready and zero new shaders. On this virtual renderer, this is the first reproducible large reduction of cold-trigger stalls. **Both native results still FAIL the 120ms smoothness gate.**
- Important qualification: that first prototype moved the live sun and private preflight camera BEFORE awaiting nextPaint, which could temporarily alter public intro lighting. Thus its performance result is **directional engineering evidence, not an acceptable visual candidate**. The on-screen CI screenshot proves the completed Colossus, APEX and Ragnarok were rendered, but not screenshot parity during intro.
- `cf17313e`: fixed live sun/camera mutation scope: every native scene stage now waits for a healthy frame FIRST, changes live scene only within a synchronous private render, restores every uniform/visibility/sun/camera before yielding. [Source/build PASS 42824909028](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42824909028). This visual-safe version requires independent A/B measurements before promotion.
- `5be2465c`: tests **one vs. two native preflight passes per exhibit** (two vs. four native draws total), still privately rendered with actual production shadows and exact uniforms; repeat stages are budgeted and restore scene before each await. [Source/build PASS 42826059876](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42826059876). [Native-repeat A/B run 42826059584](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42826059584) was queued at recording time. No conclusion until run logs and real-scene visual evidence are inspected.

### Decision and arrival integration constraint

- Keep this on `fix/colossus-frame-budget-prewarm`. No merge to `main`, no shadow-map downsize, no PBR/mesh/Bloom/postprocessing removal. Existing 2048 shadow setting and actual game geometries are retained.
- The user's new spaceship arrival concept SHOULD allocate the genuine GPU warming **before landing**. Existing intro `loading` still tracks **piano audio downloads**; its 100% is not a graphics-readiness claim. Arrival must have distinct audio/asset/shader/VBO/real-shadow/render and first-present readiness; don't equate `131/131` with a no-hitch native scene, and don't autoplay landing solely on an arbitrary cinematic timer.
- Native preflight stays explicit URL **diagnostic only** until repeated fixed-code CPU/GPU frame gating, safe preflight session pacing, before/after screenshot inspection and both activation/landing acceptance. Do not claim 60FPS or zero-stutter yet. Remaining blocker = 120ms cold-summon max-frame contract and actual hardware validation.


## ORBITA Arrival GPU-gate implementation and negative A/B evidence (2026-11-10 follow-up)

### Production safety / exact mechanism

- Arrival is deliberately **opt-in** via `?arrival=on` on branch `fix/colossus-frame-budget-prewarm`; `main` was **not** merged.
- Intro now creates an actual camera-mounted Three.js cockpit with an overlay flight HUD. The flight-distance target reflects **Colossus GPU prewarm** progress (real geometry uploads, original 2048px shadows, native-scene submissions, and readback fence), *not* piano loading. Latest `Player.tsx` damps the flight camera's distance with a frame-time exponential rather than teleporting between asynchronous progress milestones; landing requires both audio readiness, GPU readiness and completed physical approach.
- Original `startGame` behavior remains unchanged for URLs without `?arrival=on`. All offscreen native passes restore real sun/camera/material uniforms synchronously before yielding to the public event loop. No meshes/Bloom/shadow-map reduction, no `main` release.

### Arrival on Metal Paravirtual, actually measured

- [First arrival smoke 42834048078](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42834048078): landing gate worked (initially disabled, then 131/131 uploads + 4 native passes + async fence, no page errors), but max post-land rAF gap **533ms**, 4 frames over 120ms. FAIL.
- [First landing-position preflight A/B 42837482831](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42837482831): 640x360 private landing view **717ms** vs no separate landing-view preflight **750ms**. Both fail; difference too small for a stable win.
- [Flight path A/B 42837658735](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42837658735): additional offscreen flight-path real-scene priming at 27/55/82% yielded **1433ms** max gap vs baseline (without landing-view priming) **1050ms** in one trial; no stable performance gain. Flight path preflight was accordingly changed to **diagnostic-only** `arrivalFlightPathPreflight=on`, OFF by default.
- `f392ac07`: startGame now records timestamped R3F callback traces for the real 3.2s descent, separate from compositor rAF; the CI artifact reports first several worst callback gaps and current transition/camera pose. No quality changes.
- `f38a5b61`: tests an alternative hypothesis: a GPU completion fence signals submitted work completed but **not** reliable compositor frame pacing. `arrivalGpuSettle=on` therefore gates landing on three independent windows of three healthy presentation rAF frames (max 12s per window) after GPU sync. `?arrival=on` without this option retains the control path. [A/B 42839209801](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42839209801): 2 x `primed` (no settle) versus 2 x `settled` jobs, pending at this ledger update. **Do not announce smoothness or enable settling in production until the measured comparison passes.**

### Acceptance still OPEN

1. Landing: worst post-land rAF gap <= 120ms, with correct full visual geometry, no missing textures/shadows/console and no context loss; validate across two or more runs and inspect approach + landed screenshots.
2. Colossus: its own fully-ready cold summon still fails <=120ms despite native live-scene prewarm. Preserve independent A/B, do not conflate landing and robot warmup acceptance.
3. Behavior: no early landing click, no GPU false-ready when native shadow or real descent preflight is missing, no indefinite blocking without truthful stage, no regression to legacy entry URL, correct audio behavior, physical GPU or real-device verification after paravirtual Metal.
4. The cockpit currently is a **functional 3D prototype**, not a final art-quality ship: it lacks complete exterior model, landing thrusters, and polished cockpit material/lighting. Those require a separate visual acceptance after the hitch contract is met.
