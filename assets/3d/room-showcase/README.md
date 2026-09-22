# Room Showcase — Curated 3D Asset Kit v1

This folder is the **asset audition kit**, not a frozen room layout.

## Intent

One creative production workspace for a portfolio spanning event production, music, AI / technical experimentation, and research.

These are **not four separate themed corners**. The room should read as one coherent world first. Real portfolio work should carry more identity than generic props.

## Folder map

```text
core/
  work-console.glb
  chair.glb
  display.glb
  bookcase-low.glb
  plant-small.glb
event/
  spotlight.glb
music/
  speaker-small.glb
  headphones.glb
ai/
  circuit-board.glb
research/
  books.glb
  corkboard.glb
```

## Godot integration rules

- Import the GLBs as scenes; do not commit generated `.godot/imported` cache files.
- Keep collisions simple and separate; add them only where interaction actually needs them.
- Harmonize accent props using controlled material overrides instead of adding unrelated asset styles.
- Treat `display.glb` as a shell. Put real portfolio / AI / event imagery on a controlled surface or material.
- Treat `spotlight.glb` as fixture geometry. Use Godot `SpotLight3D` for illumination; do not add expensive volumetric simulation merely to signal “event”.
- Do not duplicate a complete concert stage into the room.
- Do not freeze exact positions, scales, rotations, palette values, or lighting until a visual composition passes the taste gate.
- Reuse the portfolio's real project images as art-directed content surfaces in the next visual audition.

## Performance posture

The 11 binary assets in this kit total **179,808 bytes (~175.6 KiB)** before Godot import artifacts.

Higher-cost assets should only be introduced when their visible gain is proven.

See `asset-manifest.json` and `PROVENANCE.md`.
