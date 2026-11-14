# HEX first-draw performance evidence — 2026-11-11

**Release state: HOLD. Branch:** `fix/hex-hitch-no-visual-loss` (forked from `main@4454511b31913531856549659bf55628ffc25578`). No merge to `main`.

## Required acceptance
- The authentic piano HEX → Mưa Mùa Hạ / Nếu Ngày Mai experience must remain identical in original 3D meshes, UEH buildings, instanced foliage and flowers, lighting, cast/receive shadows, shader materialization, weather, audio, Bloom, ACES, and render resolution.
- Cold first trigger, switch, retract, repeat trigger, reload and non-HEX portfolio intro must work.
- Do not use improved shader compile count or a green build as evidence of perceptually smooth frame pacing. Measure largest rAF gap **and silent time after the last callback**.
- A/B and visual screenshots must use the same GPU, viewport and corresponding HEX scan radius. No fake/placeholder or reduced-visual test is an acceptable production variant.

## Evidence

| Test / immutable evidence | Observed result | Decision |
|---|---|---|
| Fully warmed original UEH shader + texture: [run 42932240293](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42932240293) | 83/83 shader preps and 41/41 texture preps completed; first real GPU submission still had ~9.1s stall on virtual Metal | Shader/texture precompile alone is insufficient |
| Counterbalanced UEH group ablation: [run 42937971705](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42937971705) | Normal first-world gaps 3.4–4.6s; with UEH completely hidden for diagnosis 0.27–0.57s; hiding eight UEH InstancedMeshes 1.4–2.5s | First draw of original UEH is primary bottleneck; eight instanced drawables contribute substantially |
| Instance-family ablation: [run 42936951280](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42936951280) | Native instanced counts in test quality: 75 roots, 30 B1 fins, 60 bulbs, 1820 foliage leaves, 973 blossom clusters, 2200 grass, 1150 petals, 190 whole flowers | Need preserve all instance data, dynamic wind behavior and shadow paths |
| Opt-in radial instance reorder: [A/B run 42942323579](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42942323579) and [visual run 42942748063](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42942748063) | Mixed GPU gaps 3.1–5.1s; **real visual regression: missing phượng canopy at final scan and one almost-black frame** | **REJECTED AND REMOVED** from `RealityHost.tsx` at `96790f1a`; do not revive it |
| First opt-in original BufferAttribute 1-triangle private upload: [run 42943677979](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42943677979) | First single private draw took 127–218ms, exceeding the 75ms guard and aborting at 1/8 objects | Not accepted or enabled; may reflect preview program compilation + buffer allocation |
| Separate preview `compileAsync` A/B: [run 42944582218](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42944582218) | New diagnostic re-run; result not yet evaluated at time of this record | Still experimental; opt-in `?hexAttrWarm=1` only |

## Already retained on candidate branch
- Original UEH shader grow length, rim glow and wind numbers were converted into material-local uniforms, rather than creating new GLSL programs for each numeric value.
- Warm shader/texture queues are scheduled during idle instead of discarded immediately upon entering.
- Conservative static opaque-mesh materialization culling and mathematically invisible far-sky gating are enabled, without changing the shader or source assets.
- Reused original-resolution Memory Reel canvas texture; avoided duplicate `reel.use()` calls.
- Full standalone HTML is re-synced from relevant source modules; build and specific HEX visual-invariant gates run in Actions.
- An opt-in **test-only** GPU draw-category isolation path exists. These ablations are never active on the default portfolio.

## Work next
1. Evaluate async-preview compilation separately from attribute upload CPU cost and cold first-trigger savings. Reject if it displaces a major hitch into the intro/approach.
2. If first-draw bottleneck persists, profile original shadow-depth passes and PBR lighting/instancing variant cold draw separately; never reduce shadow map 2048 or use visual placeholders.
3. Run multi-stage real screenshots (initial front, 12/60/160/260/330, switched song, retract, second summon) on default candidate vs `main`.
4. Keep a failing feature in opt-in diagnostic mode only. No merge before visual + functional + frame-pacing acceptance.

**Important:** CI success means test execution success, not completion of frame pacing or visual acceptance. Earlier radial visual workflow passed but actual saved screenshots clearly showed lost foliage.

## Follow-up verification (same date)

| Test | Evidence | Decision |
|---|---|---|
| UEH shadow-depth isolation | [Run 42945093380](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42945093380), two independently ordered virtual Metal jobs. `no-ueh-shadows` disabled castShadow on 133/399 drawables; max long task still 4.95–5.02 seconds. `no-ueh-instanced-shadows` disabled the two shadow-casting instanced groups; max long task remained 3.99–6.05 seconds. Normal jobs varied ~3.72–7.46s. | Shadows alone DO NOT explain the first-draw hitch. Keep full original 2048px shadows. |
| Whole-mesh front gating (no reorder) | [Run 42954658615](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42954658615) plus [9-stage visual evidence 42954766822](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42954766822). Only ONE non-shadow static InstancedMesh was eligible and the gate opened at front radius ~5; repeated Metal first-draw long tasks were still ~3.9–5.3s on one runner and worse than controls on the other. | REJECTED; source logic removed in `c242e5a9` after A/B. No source instance data was ever modified. |
| One-triangle private upload, with or without preceding compileAsync | [First run 42943677979](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42943677979) and [async compile run 42944582218](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42944582218). Some draws took 86–218ms even before visitor interaction; after 8/8 buffers were uploaded, a 5.05s first-HEX stall remained. | REJECTED and removed `e14d696c`, protected by `tests/hex-preservation.mjs`. Do not shift lag from first HEX click into walking/intro. |
| Material-v-buffer isolation | [Live test run 42955546214](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42955546214) compares original instanced PBR, eight unchanged source buffers with diagnostic basic shader, and the fully omitted instanced drawables in reversed order. | **DIAGNOSTIC ONLY**; no result claimed until logs / artifacts have been inspected. The default app retains original PBR and original shader/visuals. |

Current release verdict stays **HOLD**. Production `main` remains at the already accepted Colossus `4454511b`. Compile/visual-invariant CI success must never be called performance acceptance.


## GPU driver-level finding — follow-up

| Grounded evidence | Observations | Verdict |
|---|---|---|
| [Metal WebGL call trace 42956942228](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42956942228) | At first HEX exposure, 24 newly linked shader programs; `getProgramInfoLog` consumed **9,116 ms cumulatively** (max individual 1,091 ms), whereas `bufferData` took **7 ms cumulatively** in that same run. In counterbalanced jobs, 24–26 first-use shader links remained. | First-use GPU program link/synchronization is a primary blocker, more specific than geometry upload. |
| [Debug-log opt-in A/B 42957615245](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42957615245) | `renderer.debug.checkShaderErrors=false` eliminated `getProgramInfoLog`, but the driver blocked on `getProgramParameter` instead: one job recorded **8,062 ms** total there; max frame gaps ranged **4.2–8.37 seconds** and were not consistently better than the default. [18-image visual fixture 42957694225](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42957694225) passed with no repeat summon black rectangle. | REJECT for release: not a real performance fix. Only opt-in `?hexSkipShaderLogs=1`. |
| [True-scene compileAsync 42958734925](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42958734925) | Compiling the full authentic UEH group with actual scene/camera took 6–15 ms to submit, but cached program count remained **113 → 113**. First-click frame gaps still ranged **5.3–8.9 seconds**, with 24–27 first-use new programs linked on demand. | REJECT for release: no new relevant variants were precompiled; remains opt-in `?hexRealSceneCompile=1`. |
| [PBR vs geometry isolation 42955546214](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42955546214) | Diagnostic Basic material on the same eight original instance buffers had 1.5–3.9s first-click stalls. Original PBR varied ~0.6–5.4s; fully suppressing the instances reduced some stalls to 1.6–2.1s. | Both geometry/instancing and shader linking contribute. Never substitute Basic for PBR in release. |
| [Shader-source fingerprint trace 42959530710](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42959530710) | Instruments real `shaderSource`, `attachShader` and `linkProgram`, tracks GLSL hashes before/after the first click and classifies PBR, instancing and source HEX variants. | This is the next actionable root-cause gate; results require examination before any material/program change. |

**Critical distinction:** Turning off a blocking WebGL log query does NOT remove the underlying GPU program linkage; it merely transfers the sync point to another API call. Retain default error checks until a whole-run A/B and real image parity have proved a genuine fix.

**Production boundary:** The original `main` remains unchanged at `4454511b`. Current `fix/hex-hitch-no-visual-loss` diagnostic flags remain OFF by default. All eight original UEH instance groups, actual PBR, shadows, original HEX GLSL, Bloom and materials are still part of the normal render. Not accepted for merge.


## HIGH-quality gate and cooperative Linear proof

After comparing generated GLSL source, **22/25** first-use programs had the same vertex shader as their preflight counterpart, but output fragment code changed `sRGB` to `Linear`. A private 4×4 Linear-sRGB render target with full-scene `compileAsync` prelinked 32 extra variants and reduced first-click new links from ~25–28 to 7, but **still stalled 4.1–4.8 seconds** on Metal and required up to 274ms synchronous CPU submission at full HIGH quality. See [run 42961169078](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42961169078) and [HIGH startup run 42963834516](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42963834516). **Rejected as default.**

The original 18-frame visual benchmark was only at `quality: low`. This was corrected with an explicit CI-only `?hexForceHigh=1` initial store quality (normal visitor default remains LOW, user-selectable HIGH). [HIGH visual run 42963535207](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42963535207) validated nine frames in both modes, including two songs, retract and second summon; all 18 reported `quality: high`, zero page errors and no large second-summon pure-black rectangle. Moving VFX means these screenshots are NOT strict pixel-identical evidence.

**Cooperative Linear shader queue** — opt-in `?hexCooperativeLinear=1` — reuses the existing healthy-frame scheduler rather than submitting all 32 programs at once. It renders no private mesh and restores framebuffer, viewport and scissor before leaving each callback. At HIGH, 85 original program dispatches took only **7–13ms max CPU submission**, 0 state-restore failures, and new first-click links fell to **4**; first-click stalls were **2.4–2.9s** compared with baseline **2.6–5.8s**, but pre-click GPU variability remained severe. [HIGH A/B run 42964606636](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42964606636). The [HIGH 18-frame test 42964665391](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42964665391) passed with quality HIGH, no errors or large second-summon black rectangle.

At the default LOW quality, cooperative Linear prepared 83 programs with **13–21ms max submission**, 0 restore failures and cut click-time links to **4**; however, first-click gaps still varied **3.97–6.08s** versus the normal **4.75–6.78s**. [LOW A/B run 42964789444](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42964789444).

**Remaining four cold GLSL links** are three actual MeshDepthMaterial shadow-pass variants (instanced, mapped and alpha-test) plus one program already linked earlier. See `newlyLinked` hashes in the HIGH runs; the identified first-use variants include `029c725b+849add84`, `6307b692+50060f35`, `9a1a4580+50905ed4`. Their program hashes and material/shadow states are preserved for verification.

A new opt-in `?hexCooperativeLinear=1&hexShadowProgramWarm=1` precompiles equivalent MeshDepthMaterial source variants **without changing the actual 2048px shadow maps or PBR**, using the same per-frame cooperative scheduler. [A/B run 42965675683](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42965675683) must be inspected before acceptance. The code is still **EXPERIMENTAL AND NOT DEFAULT**.

**Release state: HOLD.** No production merge; the accepted main remains Colossus `4454511b31913531856549659bf55628ffc25578`. No configuration is accepted as “no hitch” until measured frame gaps/long tasks on the full original scene are actually under the target, with no regressions to landing, robot or visual fidelity.

## 2026-11-11 — exact Cinema Canvas2D readback root cause and new gates

**Working branch only; release HOLD.** The frozen public main remains `4454511b31913531856549659bf55628ffc25578`. No new perf experiment is enabled by default. Never degrade PBR, 2048 shadow textures, original UEH flora/geometry, film resolution, HEX shaders, track switching, or second summon for frame-time wins.

- Native Metal CPU profiler [run 42967520361](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42967520361) independently traced `getImageData` to `source/src/scene/Cinema.tsx` 4×2 average-light sampler, NOT to HEX; one primed run spent ~7.8s CPU self-time in `getImageData` after GPU shader preflight. In other runs `getProgramInfoLog` still dominated.
- First opt-in `?hexCinemaCpuCanvas=1`: make the **unchanged 1024×450** full film canvas CPU-backed while keeping its original SRGB CanvasTexture/anisotropy and full movie frames. Counterbalanced Metal jobs [42969228807](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42969228807) and [42969278333](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42969278333) were inconsistent; GPU stalls remained. **Not accepted.**
- Alternative opt-in `?hexCinemaFarLightGate=1` keeps the original movie drawing and 4×2 light averaging when relevant, but skips the readback only when HEX is non-idle and the viewer is more than 24m from Cinema. The point light has a finite 13m attenuation range. Because this option is in a non-HEX exhibit, `sync-hex-standalone.mjs` was corrected to include `scene/Cinema`, and `tests/hex-preservation.mjs` now asserts both opt-in flags are in the **actually built standalone**. Old tests before this sync fix did not execute the changed Cinema code and are NOT valid evidence of the option.
- **First valid after-sync opposite-order Metal A/B:** [run 42970548575](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42970548575): the optional gate removed `getImageData` from the CPU top trace during the sampled HEX transition, but the largest frame gap remained approximately **6.3–8.4 seconds** and shader driver `getProgramInfoLog` dominated. **This is a source isolation result, NOT a successful UX fix.** Native runtime controls and image fidelity must remain protected.
- Exact-source visual comparison with 18 native 1280×720 screenshots was added at `.github/workflows/hex-cinema-far-visual.yml`, using default and flagged candidate from the SAME build. The first CI attempt failed because its script assumed a checkout layout containing `candidate/source/node_modules`; the script was fixed to resolve both layouts. Do not claim native visual parity until the fixed workflow and screenshots pass at a single exact SHA.
- Combined opt-in `prime-cinema-far` uses the existing original GLSL, actual PBR and depth program first-use preflight **together with** the distant Cinema readback gate. Opposite-order Metal profiler [workflow](https://github.com/Khanh-glitch/Kh-nh-port/actions/workflows/hex-combined-cinema-gpu-ab.yml) checks whether removing both independent sync points improves first-click rAF gaps. Its outcomes must be independently read before enabling anything.

**Release rule:** count both first-click rAF largest gap and silent time after last callback, intro/idle long tasks, exact HIGH-quality nine-stage visual parity, source-map fidelity, and cold/repeat/switch/retract. A green build/CPU trace alone does not authorize promoting any flag. Do not move the hitch from piano to intro or Cinema approach.

### Updated decision after combined cold Metal runs — 2026-11-11

The completed [combined GPU + Cinema A/B run 42970788388](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42970788388) measured in opposite execution orders:

| Execution order | Program first-use only | Program first-use + distant Cinema readback gate |
|---|---:|---:|
| Combined first | 7783ms largest rAF gap / 7775ms max long task | 6100ms largest rAF gap / 715ms max long task |
| First-use first | 6500ms largest rAF gap / 6499ms max long task | 5116ms largest rAF gap / 620ms max long task |

The combined option substantially reduces the main-thread long-task component but **still fails** frame pacing: 5.1–6.1s rAF gap. Hence **NO RELEASE PROMOTION** and **no default activation**. All original source geometry, full-resolution cinema, physically based materials, native 2048 shadow maps, shaders, Bloom and ACES remain unchanged.

The next diagnostic commit adds a **25ms independent JS timer heartbeat** to `scripts/hex-cpu-first-trigger-trace.mjs` and records `maxTimerGapMs` versus `maxGapMs`, `maxRafMinusTimerGapMs`, and `timersStillActiveWhileRafStarved`. New opposite-order native Metal CI [42979943719](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42979943719) was queued/running during this handoff, **not yet accepted**. If the JS timer remains responsive while rAF stops, investigate GPU/compositor frame publication and first scene submissions; if both stop, inspect exact blocking main-thread call stacks in Chrome tracing. Never infer absence of a stall from short Long Tasks alone.

**Current decision: continue diagnostics on this branch; production main untouched; HOLD.** The user does not need to change settings or sacrifice visual quality to proceed.


### Uninterrupted continuation — GPU / compositor frame publication diagnostic

Confirmed independent timer heartbeat from completed [native Metal run 42979943719](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42979943719) on `7fa1a367`:

| Metal job order | Mode | Largest rAF gap | Largest JS timer gap | Max browser Long Task | Readout |
|---|---|---:|---:|---:|---|
| Combined first | `prime-cinema-far` | 6750ms | 502ms | 498ms | rAF stops although JS timer continues |
| Combined first | `prime-first-use` | 4867ms | 5003ms | 4865ms | main-thread readback stall remains |
| Prime first | `prime-first-use` | 6133ms | 6304ms | 6126ms | main-thread readback stall remains |
| Prime first | `prime-cinema-far` | 4433ms | 592ms | 505ms | rAF stops although JS timer continues |

Thus the distance-safe Cinema readback gate measurably resolves the `getImageData` main-thread blocker, but the remaining 4.4–6.8s rAF stall is **not** simply a main-thread Long Task. Chrome CPU samples for the combined mode show substantial `(idle)` and `uniformMatrix4fv` work. Investigate GPU/context/compositor frame publication / 3D first-draw saturation, rather than further moving shader synchronization around. These are virtualized Apple Metal results and must not be treated as universal hardware timings.

New **diagnostic-only** bisection at `b62f318` includes authentic source with `hexGpuDiag=no-ueh-instanced`, `no-ueh-foliage`, `no-ueh-architecture`, `no-ueh-wind`, `no-world`; new multi-job counterbalanced [run 42982818551](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42982818551), created at `669ea8a`. These flags intentionally hide categories **only during diagnostics** and are prohibited in release. Compare each to unchanged `prime-cinema-far` using **max rAF silent gap, timer gap, Long Task**, then design a preservation-safe rendering solution for implicated category, instead of blind ablation or radial reorder. No such A/B result has yet been read/accepted for this new run at this checkpoint (jobs queued).

**Visual acceptance to retain:** native [18-frame exact-source visual run 42970661748](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42970661748) passed; native baseline-v-candidate visual [42970661914](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42970661914) passed. They validate no obvious missing UEH geometry/foliage across 9 scan stages, switching, retract, second summon, but are not pixel-identical proof due to dynamic effects. Any new rendering approach must repeat these gates on its **exact commit** and preserve 2048px shadows, authentic PBR, full materialization shader, Bloom, ACES, 1024x450 cinema and complete original meshes.

**Status:** HOLD on `fix/hex-hitch-no-visual-loss`, do not promote new defaults/merge main. Source/CI instrumentation is actively advanced; no claim of completed smoothness. Target next: preserve visual fidelity and reduce both long-task and rAF silent gap to a genuinely non-disruptive transition on cold and repeat action, with no new intro jank.


### 2026-11-11 — targeted native first-draw GPU buffer hypothesis (still experimental)

Completed category bisections [42982818551](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42982818551) and [42988276018](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42988276018), all on native Metal, show that diagnostic `no-ueh-instanced` (8 source instanced draws) reduced worst initial rAF gap from ~4.9–6.5s to ~1.9–2.6s without fixing all remaining GPU frame pacing. Diagnostic `no-world` yielded 83–650ms. This **localizes** GPU load but explicitly does **not** authorize removing or simplifying any UEH object.

The source eight instanced meshes are authentic architecture 75/30/60, foliage green 1820, blossom 973, grass 2200, and wind 1150/190. The new `gpu-no-instance-0..7` mode at `529b3c7` and [individual-instance workflow](https://github.com/Khanh-glitch/Kh-nh-port/actions/workflows/hex-individual-instance-bisect.yml) determine which of the 8 contributes most. Individual hiding is **only diagnostic** and never enabled in default.

An opt-in **preservation-safe** candidate `?hexInstanceBufferWarm=1` was added on this branch (starting `c5bf4cc`). After normal shader+texture preflight completes, when the viewer is safely idle, it binds one ORIGINAL UEH mesh's own geometry, instanceMatrix and instanceColor attributes to a 2×2 private framebuffer with a simple temporary material, then restores the target/viewport/scissor/renderer state in the same frame. This is an attempt to initialize GPU buffers and VAOs before first visible UEH submit, without reducing a single source tree, flower, grass blade, building, original PBR shader, shadow, Bloom, ACES or screen resolution. Production/default path does not enable it.

The candidate has a hard **120ms per-idle-submission rejection** and keeps an externally measurable `__orbitaHexInstanceBufferWarm` report with total/done/maxSubmitMs/errors. The native [reverse-order GPU buffer A/B workflow](https://github.com/Khanh-glitch/Kh-nh-port/actions/workflows/hex-instance-buffer-warm-ab.yml) was queued at the handoff and has **NOT** yet proved a smooth HEX. Reject if it shifts stalls into idle, doesn't prepare all 8 source buffers, causes runtime/visual errors, or fails cold/second summon frame pacing. Preserve its query-flag-only status unless *both* GPU and visual gates pass on the exact same candidate SHA.

**NO RELEASE / NO MERGE**; native performance and visual acceptance pending.


### Quality-first decision: continuity from first ignition through complete retract

**User acceptance definition:** an observer must perceive the SAME UEH summer world / flamboyant trees / architecture / HEX light grid / audio / weather and track transitions, from first ignition through sweep, active, song switching, retract and second summon. The aim is *perceptual equivalence*, not a bit-identical draw call graph. Small distant LoD differences are acceptable ONLY when actual side-by-side movement/camera captures show no meaningful loss; deleting whole tree canopies, suppressing buildings, lowering 2048 shadow for all users, destroying growth/shader rhythm or moving the pause into intro is forbidden.

**Evidence-driven technical decision:**
- The corrected native CPU+heartbeat results confirm TWO bottlenecks: original Cinema 2D readback is a synchronous main-thread offender, and the intact UEH world still causes >4s rAF/compositor starvation even when timers remain active. The per-category tests confirm instanced scene families materially contribute to the residual.
- A tempting spatial/radial **reordering** optimization was drafted and then immediately reverted before release in commits `aaefa8b` and `5fd6e2f` because the existing preservation test explicitly forbids reintroducing a previously rejected radial reorder. No such change is enabled in the built standalone.
- Opt-in 2px private original instance GPU attribute prewarm (`hexInstanceBufferWarm`) passed visual stage [42990337324](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42990337324), but the first completed reversed-order performance pair [42990193449](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42990193449) observed **5167ms rAF gap in the warm candidate versus 3583ms in the control** (candidate's 8/8 warm submissions max 99ms). This is **not a performance win**; keep disabled and wait for the second ordering before final disposition.
- A new **RED release blocker** [workflow](https://github.com/Khanh-glitch/Kh-nh-port/actions/workflows/hex-release-no-hitch-gate.yml) measures the actual published default HTML with original main as comparison and rejects 120ms+ worst rAF/long task or p95 >34ms across idle, FIRST summon, switching tracks, retract and SECOND summon. It explicitly includes the silent tail so a browser freeze cannot masquerade as perfect frame time. Existing diagnostic CI green is NOT acceptance.

**Next architectural path (preserve experience, optimize actual scheduling):**
1. Obtain per-stage compositor/GPU evidence, not CPU-only benchmarks. Distinguish first draw/upload/VAO, shader driver, costly overdraw and postprocessing with genuine GPU timing and Chrome trace. The UEH world is ~399 source drawables with eight instanced meshes; never equate simple triangle count with the actual bottleneck.
2. Keep current light/sound/HEX foreground continuous. Prime unchanged materials, textures and vertex data in small healthy-idle CPU/GPU units; reject any single submission that creates a perceptible pause or delays the player's first input. Do NOT load the entire high-quality UEH world in one GPU frame.
3. Stream render obligations according to **actual scan boundary and camera visibility**, without the banned radial matrix reorder and without omitting any potentially visible pixel. Merge only static objects sharing original material/shadow semantics; preserve full-resolution hero foliage near camera and use visually validated distant impostors/LoD ONLY if original full geometry cannot meet the measured GPU budget. Back-of-world content not yet visible must not compete with the first displayed front.
4. At active state, preserve premium look and camera interaction. Reuse every shader/texture/buffer on song switch, retract and replay rather than dispose/recompile/reupload; retreat is an actual reverse visual motion, not an abrupt disappearance or crossfade to black.
5. Run paired native video/screenshot comparison of every phase, with full tree canopy/red flowers, B1/B2 facades, rain/sun/weather, shadows, glow and transitions, plus HIGH-quality default and practical moderate-GPU class. A static screenshot alone cannot prove animation continuity; any low-fidelity adaptive alternative must be presented as nearly identical from the visitor's POV.

**Decision:** the correct success condition is *no perceivable hitch throughout the lifecycle AND convincing premium visual continuity*. If GPU capacity fundamentally cannot sustain the original full scene on a target machine, prioritize a visually equivalent adaptive renderer over unsustainable identical geometry. Release/merge remains HOLD until BOTH performance and visual gates pass.


### 2026-11-11 — user-playable preview and conservative foliage vertex raster gate

**User target:** their own opening-to-disappearance, repeated and track-switching, should feel near-identical to the original ORBITA/UEH scene, with **no visible pause**, not merely an improved static screenshot.

**Unblocking end-to-end acceptance:** the original full-lifecycle test `42991471830` initially failed from a bad Playwright path, repaired at `c236896`. The corrected [run 42993780616](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42993780616) ran both authentic published sites, confirmed a baseline first summon **18.17s silent rAF tail**, and a candidate first summon **6.69s silent rAF tail** plus remaining switch/retract/replay jank (full `hex-evidence/bench.json` artifact `13843227973`). Even though source/state/visual CI green, **NO performance approval**. Note that the virtual Apple Metal device also exhibits idle p95 frame times much worse than physical hardware; test real client devices before setting portable FPS thresholds.

**Attempt rejected:** the opt-in private 2px GPU first-use warmup for unchanged instance attributes failed opposite-order A/B [42990193449](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42990193449): first ordering had candidate 5167ms vs 3583ms control, and the reverse ordering produced a **169ms idle prewarm** (above the 120ms regression gate). Do not enable this approach by default; do not move the hitch to intro/idle.

**New quality-preserving experiment:** at `c05b651`, `0bbd1f2`, `2e87315` a query-only opt-in `?hexVertexGate=leaves` (or `all`) was implemented:
- Original instance counts, instanceMatrix, instanceColor, geometry, source PBR MeshStandardMaterials, real shader-based growth/wind/wetness, 2048 shadows, bloom/ACES, and original render order remain **untouched**.
- Each instance receives a conservative bounding-sphere lower bound `aRWStart`; when the REAL scan front is smaller than that bound, only the vertex positions are clipped outside the GPU frustum. Source fragment shader, original `rwX` and reveal motion remain responsible for all visible pixels; no instances are removed or reordered.
- A special GLSL cache tag is applied only in query-enabled cases to avoid overriding the original GPU program. Original/default mode is identical to prior source. Separate `leaves` and `all` tests allow rejecting riskier changes independently.
- Native 18 screenshot / 9-stage source-identical [visual run 42994705137](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42994705137) **green-leaves matrix PASSED** (same scene, controls, map, weather/foliage intact by inspection). Full vegetation matrix and triple reversed-order GPU [42994657695](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42994657695) were queued on last check. **No full performance acceptance yet**.

**Testable artifact, without production promotion:** GitHub Actions [run 42995170872](https://github.com/Khanh-glitch/Kh-nh-port/actions/runs/42995170872) built the root standalone and all original public assets; artifact `13843542258`, size 1.1MB zipped, SHA `d54572e80e05b9f2a93cc77824cdf49be2e348ad` (exact contents include `index.html` and real asset tree). The user also received an equivalent downloaded zip with `START-HEX-TEST.html` to directly choose default, leaves and full-vegetation mode. This is **playable for user validation**, but NOT certified free of freezes; feedback from real hardware is part of final acceptance. Cloudflare Pages has no confirmed preview URL in repo; never invent one. Do not merge `main` or call release DONE without both first-click and full-lifecycle frame pacing plus visual acceptance.

**Next:** on latest CI, compare `maxGapMs` / `maxTimerGapMs` and actual scene visual states for leaf gates; if still multi-second, reject and target materialization GPU scheduling/overdraw with *preservation-equivalent* representation, not deletion. Keep a self-contained user-testable artifact updated for the exact accepted SHA.

### 2026-11-14 — original-material, private-target warm experiment

The default scene at `95240f7` still failed the native Metal release gate:
first-summon rAF gap 7.335s candidate-first and 5.549s candidate-second;
switch gaps 700ms and 683ms. Neither tree batching nor the earlier 2×2
basic-material attribute warm is accepted.

New query-only `?hexActualDrawWarm=1` experiment submits each of the eight
original instanced meshes, with its original material and shared geometry and
instance attributes, to a private 4×4 linear target, one per healthy idle
frame. It restores render target, viewport, scissor, XR and materialization
uniforms immediately. The scratch scene has cloned lights without shadow
casting; it does **not** warm identical shadow variants and is not proof of a
full first-draw cure. It does not alter any visible geometry, texture,
resolution, shaders or shadow setting. It rejects any individual CPU submit
above 120ms and is disabled by default.

`portfolio-hex-real-draw-warm.yml` runs same-build A/B in both orders. The
candidate waits for the experimental preparation and records idle rAF gaps,
submission time, errors and the full lifecycle. A warmup timeout, error or
idle stall is rejection, not a green success. Initial software-rendering scene
smoke created the eight-item queue with no page errors; it does not establish
performance or visual parity. Await native results and compare real nine-stage
HIGH visual captures before considering any default change.
