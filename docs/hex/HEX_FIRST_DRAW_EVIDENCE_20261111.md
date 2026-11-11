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
