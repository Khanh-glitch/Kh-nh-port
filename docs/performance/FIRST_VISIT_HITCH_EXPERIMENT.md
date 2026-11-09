# Menniverse — first visit hitch mitigation (experiment)

Base: `main@8dd5ded`. Branch: `experiment/first-visit-hitch-piano-colossus`.
Main remains unchanged. Root `index.html` embedded ESM map has been updated alongside source; Cloudflare Pages preview deployments can therefore use the same root static HTML.

## Scope

- Piano: GoldZone is rendered at **zero intensity during intro** to prime its actual GPU resources before proximity. Its actual gameplay visibility rules and shaders remain unchanged.
- Piano: prepare sheets before hidden UEH materials, run async shader compilation when available, and stop the RealityHost GPU preparation loop once gameplay begins. The silent UEH warm pass is safely reverted if intro ends between two prewarm frames.
- Colossus: prime all three laser beams and impact flare, include currently visible lights (instead of hidden showcase lights) in the private shader warm scene.
- Colossus: replace blocking `readRenderTargetPixels` with async GPU readback; **restore the renderer's public framebuffer before awaiting**. When not available, submit with `flush()` and honestly report `submitted-no-async-readback`.

## Visual-quality freeze

No reductions in: 3D meshes, polygon counts, shader detail, shadow map, textures, postprocessing, render scale, effects, animation, instancing or lighting intensity. The source for actual Piano, APEX and Ragnarok models is untouched. Robot changes ONLY tag its existing beams with `name` props.

## Validation matrix

1. `node tests/first-visit-hitch.mjs` checks standalone embedded JS syntax, key invariants, and settings.
2. CI attempts a native Vite build as a separate source smoke test; it does **not** replace root `index.html`.
3. Browser: with `#colossus-profile`, record `window.__orbitaColossusWarmup`; it must report `beams: 4`, and when async readback is supported eventually report `ready`.
4. Compare **cold vs warm** approaches to Piano and Colossus at the same quality settings and camera route. Capture Chrome Performance (Main, GPU, Shader, long tasks) and screenshots to prove no change in visual output.
5. Verify re-entering Piano, summoning/retracting twice, switching between APEX/Ragnarok, and Hex → retract; no permanently visible UEH in idle.

This commit is a mitigation experiment, NOT confirmed GPU/fps acceptance. The remaining risk is that other first-use materials/shadow variants or external browser drivers might still introduce shader compile stalls. Do not merge solely on static tests.
