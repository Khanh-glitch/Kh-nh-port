# ORBITA — VNG Work Gallery Integration

Source: user-uploaded `3d-vng-logo-scene.zip`. Ported original procedural VNG monumental logo, projector / volumetric laser, 16:9 screen, studio desk and assorted props into ORBITA's existing React Three Fiber Canvas. There is no nested WebGL renderer, OrbitControls, or new global postprocess. The original Colossus, APEX/Ragnarok and Piano are not replaced.

Placement: `(20, -40)` in world XZ, yaw `-0.68` radians; approximately 20 m to the right of Colossus `(0, -41)`, with a distinct exhibition radius of ~6.5 m. RAG projector center `(8.5, -34.2)` stays >12 m away; no VNG geometry overlaps the Ragnarok scan footprint. Front faces toward visitors approaching from the central Orb. The table is elevated 1.68 m to match ORBITA's ground plane.

Controls: walk to front edge; point at PREV/NEXT, press E or click. The screen is also clickable to advance. Four VNG portfolio slides currently have **honest placeholders**, because the ZIP provides no personal VNG deliverables, dates, metrics, names, or footage. Source company-ecosystem figures and artificial laser-product specifications must not be misrepresented as the owner's achievements. To add real achievements, edit `source/src/vng/textures.ts` `createProjectorSlideTexture` and `source/src/vng/types.ts` `PROJECTOR_SLIDES`, or replace with verified media. Current preview source files contain no actual VNG personal work evidence.

The complete desk/studio is intentionally kept for visual richness. It shares the existing sun/ambient/postprocess and does not create another renderer. Geometry and CanvasTextures are managed on unmount. The VNG gallery is part of the normal ORBITA world and therefore should transform with the Piano's Reality Rewrite, rather than be in `rwKeep`.

Not yet visually GPU-accepted: full scene must be inspected in actual browser on both low/high with Colossus summoned and after UEH reality rewrite. Source-only checks do not prove visual quality or FPS.
