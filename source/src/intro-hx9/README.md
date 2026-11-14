# HX-9 cockpit in the opening scene

The model assemblies, geometry, materials, textures, datum and blueprint in this
folder are taken unchanged from `Khanh-glitch/hauek`, `main`, archive
`advanced-aerospace-cockpit-redesign.zip`. The upstream space, UI, dossier and
standalone engine are not used; instrument textures remain part of the model.

`stagedCockpit.ts` builds the same four assemblies in their original order.
The deployed renderer is the existing `assets/immersive` space renderer. After
its first two real frames it builds and presents the cockpit progressively,
showing the name of the current step before each operation. The cockpit's
reflection environment is applied to its own materials without replacing the
existing space. Orbita's renderer mounts only after the final model has rendered;
entry waits for Orbita's own real first frame. A retry path remains for errors.

Rebuild the shipped intro after changing its source with
`node scripts/build-hx9-intro.mjs`, then synchronize the root HTML with
`node scripts/sync-portfolio-standalone.mjs` and run `node scripts/build-pages.mjs`.
The import map uses the existing Three.js version; no full upstream application
or second space renderer is loaded.

Validation: software-rendered Chromium displayed the original cockpit over the
existing planet and sent the readiness message after all four assemblies. A
full parent-page offline-CDN test confirmed that the ship readiness message
preceded mounting the Orbita canvas, the dual real-frame gate reached ready,
and clicking the entry button removed the intro and entered the island without
page errors. This is not a native GPU smoothness benchmark. Headless Chromium
CPU construction previously measured roughly 150–1321 ms for individual stages;
the status text appears before each stage, but first-visit pauses can still be
noticeable. Real-device startup and Cloudflare deployment remain to be checked.
