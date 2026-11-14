# HX-9 source staging (not connected to the opening scene)

Imported from `https://github.com/Khanh-glitch/hauek`, `main`, file
`advanced-aerospace-cockpit-redesign.zip`. The cockpit assemblies, geometry,
materials, textures, datum and data/blueprint are kept unchanged. No original
project sky, UI, dossier, independent 2D canvases or engine were imported.
Canvas textures used on the actual cockpit instruments remain part of the model.

`stagedCockpit.ts` is an experimental adapter which splits the unchanged build
into four assembly calls. This is not yet an acceptable loading experience:
individual calls and first-use GPU uploads may still block. It is deliberately
not imported by the live opening scene. Before integrating, use the existing
space renderer (not the upstream sky), render its real first frame, then build
and GPU-warm the cockpit progressively and acknowledge readiness only when the
whole cockpit has actually rendered. Mount Orbita only after that acknowledgement.
Measure real main-thread and rAF gaps, check appearance against the upstream
pilot view, mobile and cleanup, and preserve failure/retry behavior.

Initial headless Chromium CPU-only construction smoke: materials 1321 ms,
hull/canopy 969 ms, dash/HUD 1239 ms, pedestal 309 ms, seat/bulkhead 150 ms;
914 meshes, no page errors. This is not a real-device performance benchmark or
visual validation, but it shows that simply scheduling each whole assembly on
separate animation frames is insufficient. GPU upload/render costs were not
measured. The adapter therefore remains excluded from the published intro.
