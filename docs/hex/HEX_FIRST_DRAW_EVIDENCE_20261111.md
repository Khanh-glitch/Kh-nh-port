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
