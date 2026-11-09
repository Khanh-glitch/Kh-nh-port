# ORBITA Colossus — Direct Repair (from user ZIP v8)

This is **the entire original Vite project** with a targeted local repair. It is not an image mockup, a replacement design, or a fabricated live game.

## Changes

1. **Ragnarok fabrication ordering:** plinth now starts hidden and is revealed with early scan progress; island starts hidden and only enters during scan; sprite atlas now uses the same world-height materialization shader as terrain; ocean disc has its own pixel-wave reveal instead of appearing fully; ocean rim and underside halo are shader-scanned; floating title appears near completion. This closes multiple early-materialization paths. APEX plinth is treated consistently. Invisible projector footprints no longer create permanent collision barriers.
2. **Weather:** isolated, instanced miniature rain streaks, wind gusts, water-impact ripples, drifting voxel storm clouds, animated tree sway, storm ambient rain/wind audio, and golden-dusk motes. No full-screen overlay; weather is only active after completing the island summon. Use Ragnarok click to cycle Sunny Island -> Golden Dusk -> Ragnarok Storm (existing boss-surge interaction also runs).
3. **First activation performance:** repeated pixel sprite UV uploads are skipped when atlas frame unchanged; complex exhibit subtrees are memoized with stable props; the scene queues an idle-time texture upload + async shader precompile of showcase material variants before first summon. This addresses identifiable first-use costs but cannot guarantee elimination of all GPU/driver hitches.
4. **Preserved:** original Colossus design and choreography, pixel-island gameplay loop, existing scene, Low-first / protected High policies, and other exhibits. No changes to the existing game-media/piano feature scope.

## Source files changed

- `src/scene/Robot.tsx`
- `src/scene/ApexShowcase.tsx`
- `src/scene/RagnarokShowcase.tsx`
- `src/scene/materialize.ts`
- `src/scene/ragnarokSprites.ts`

## Added

- `src/scene/RagnarokWeather.tsx`
- `src/scene/ShowcaseWarmup.tsx`
- `tests/colossus-regression.mjs`

## Run

From this directory, with a machine that can access the npm registry:

```bash
npm ci
npm run dev
```

Open the local URL printed by Vite. For a release artifact: `npm run build` (Vite single-file plugin emits a standalone `dist/index.html`).

Suggested manual verification: (1) open unsummoned exhibit and check plinths aren't prematurely present; (2) walk to console and summon both games on the *first* activation, observing any stutter; (3) retract and summon again; (4) click Ragnarok twice more to enter storm, observe rain/wind/clouds/ripples and listen to storm weather; (5) walk around both bases and retry on Low; (6) only try High on a system that passes the original hardware guard.

## Validation actually run here

- Original zip extracted intact; edited files parsed and transpiled successfully using TypeScript syntax/transpile check.
- `node tests/colossus-regression.mjs` static source contracts: PASS.
- **Not performed:** full `npm run build`, actual first-frame GPU profiling or live screenshot/visual comparison. The execution environment cannot resolve `registry.npmjs.org` and the ZIP has no `node_modules`. Chromium is installed but the Vite runtime cannot load without the missing packages. **Do not interpret static PASS as visual acceptance.**


## V3: cold GPU work & pixel storm clouds (2026-11-09)

- Source-level cause addressed: V2 called `compileAsync` via idle scheduling and used disposable Mesh proxies, which compiled shader variants and preloaded some textures but did not issue real draw calls or prime source instance/VBO buffers. The first actual appearance still incurred GPU allocation/upload, consistent with a cold-only hitch. **This diagnosis is grounded in code paths, not a GPU timing measurement on the owner’s machine.**
- Replaced with early startup GPU prewarm of actual exhibit geometry/material/texture and instance attributes in a private 96x96 render target. Restores viewport, scissor, target, XR and autoClear state. No mesh decimation or texture shrink.
- Added `#colossus-profile` console comparison for first vs repeat activation, recording warmup status plus 3-second frame timing statistics. Inspect `window.__orbitaColossusWarmup`.
- Replaced 15 transparent cloud box meshes with 9 multilayer painterly pixel cloud sprites and crisp nearest-neighbor procedural cloud textures, designed for 2.5D miniature art style; retains rain/gusts/water ripple/audio. Original generated art (no external asset licensing burden). Research compared CC0 pixel-cloud assets and larger volumetric Three.js approaches but selected pixel method for visual consistency and lower runtime cost.
- Static syntax / source-contract tests run. WebGL visual benchmark not available in this environment without working ESM CDN. This release is a targeted fix pending end-user cold-start profiling and visual review.
