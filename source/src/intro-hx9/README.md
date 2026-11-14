# HX-9 assembly cinematic

The cockpit geometry, original meshes, instrument art, textures and material
properties originate from `Khanh-glitch/hauek`, main branch, archive
`advanced-aerospace-cockpit-redesign.zip`. `tools/exportAssemblies.ts` builds
the original procedural model and exports its real geometry into six GLB
assemblies: structure, pressure shell, glass, seat, dashboard and controls.
The exporter combines certain roughness/metalness texture channels as required
by glTF; no geometry decimation or texture downscaling is requested. The
exports are under Cloudflare Pages' 25 MiB individual-file limit.

The existing immersive space renderer and environment remain in use. Once its
first frames have appeared, the assemblies load one at a time while the camera
and space render, then follow `cinematicTimeline.ts`: weighted approaches and
seating strokes; the camera travels above the canopy to the design eye point;
instruments and cabin light power up in sequence; pilot identity is drawn on the
actual 3D primary display. Cinematic time waits for actual assembly availability
rather than faking a percent. The Orbita canvas mounts only after the completed
cockpit has rendered and the visitor chooses to enter. The ship renderer is
released before Orbita is allocated; the transition waits for Orbita's actual
rendered frames, not audio readiness or a timer.

Rebuild `assets/immersive/hx9.js` and the standalone ship import map with
`node scripts/build-hx9-intro.mjs` after changing scene sources. Then run
`node scripts/build-pages.mjs`. The generated GLBs are deployed as files and
are not embedded in the root HTML. Native browser verification lives in
`scripts/hx9-cinematic-browser-test.mjs` and the associated GitHub workflow.

`workerPrepare.ts` remains an independent experiment, not the production model
loader: it demonstrated off-thread original-model construction, but has not
solved transferring the original live canvas textures and geometry without
interrupting rendering. GLB loading and GPU uploads can still cause frame gaps;
measure them on native devices rather than inferring smoothness from a software
renderer or the status message. The diagnostic `hx9DiagnosticSpeed` query is
used only for accelerated capture and is not present in normal visitor URLs.

Native GPU validation run `43552148726` reached the glass assembly but timed
out before the pilot viewpoint; it did not establish smoothness. A later local
software-rendered accelerated test confirmed the completed ship, explicit
entry, renderer release, actual island-ready gate and handoff without page
errors, but it is not a native performance measurement.
