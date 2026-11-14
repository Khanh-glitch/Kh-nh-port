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

Native Metal run `43554216066` rejected the static batching candidate: it
reached the camera transition but observed a 12.983-second rAF gap and then
timed out before the pilot view. It did not demonstrate the requested smooth
experience. That candidate was reverted; the unbatched cinematic remains on
the branch and also has not passed native performance validation (earlier run
`43553008332` reached controls and timed out, with a 3.75-second observed gap).
Do not describe either result as a successful no-stall release.

## Inside-out laser fabrication

The actual imported meshes now use a materialization scan derived from the
Colossus shader: a luminous holographic grid ahead of the moving scanline, a
bright weld seam, and the original shaded material behind it. Instanced mesh
positions are included in the world-space scan. Once finished, the shader
bypasses the effect; no model geometry or final material settings are reduced.
The 3D laser beams, scan rings, sparks and impact flare follow each part's true
world-space bounds. The aft bulkhead is exported with the outer shell instead
of the seat, so the seat and dashboard appear before the exterior.

Accelerated software-Chromium captures showed the seat, dashboard, frame and
outer shell being fabricated, then the original pilot view with identity. A
full accelerated parent-page run reached the real island gate and entered
Orbita with no page errors. This is a visual/lifecycle check only; native GPU
performance and actual Cloudflare deployment need separate validation. Previous
native cinematic runs had severe rAF stalls; the laser effect is not evidence
that those stalls are resolved.

Native Metal run `43557507508` rendered through the glass scan but timed out
before the pilot view, with a 9.333 s observed rAF gap. Run `43558251275`
removed intermediate screenshot readbacks, reached the controls scan, then
timed out; the largest observed rAF gap before the timeout was 4.916 s.
Neither run establishes a smooth or complete native experience. The visual
and accelerated software tests above must not be mistaken for performance proof.

## Continuous reveal

The laser beams, scan rings, particles and flare have been removed. The
holographic materialization on the original meshes remains. Model downloads
start in parallel, prioritising the seat; assemblies are decoded in order with
paint opportunities between them. The sequence starts as soon as the seat is
ready, without waiting for the later downloads. Each cue starts before the
preceding cue finishes. If a later part is not yet ready, the timeline waits
at that cue boundary (while the camera and space continue to animate) rather
than skipping its reveal. The sequence and camera move are shorter; full
detail is retained.
The initial preparation can still take time and native GPU stalls previously
measured above are not automatically solved by this scheduling change.
