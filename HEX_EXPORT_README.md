# ORBITA — HEX / Reality Rewrite, two-state source export

## Origin
- Repository: https://github.com/Khanh-glitch/Kh-nh-port
- Source branch: main
- Source commit (immutable): 8dd5dedb5b4078ba2a867fa5787993819d9e6350
- Extracted: 2026-11-10
- Scope: ONLY original source files under `source/src/reality/**` plus `source/public/reality/README.md`.

## The two visual conditions
1. **Original ORBITA / dormant**: `phase = 'idle'` (no HEX front; unmodified original scene stays visible).
2. **HEX rewrite / activated**: `ignite -> sweep -> active`, with the 3D instanced `HexLattice`, shader material transition, and replacement reality. `retract` returns to `idle`.

There are additionally TWO distinct **activated-environment variants**, selected without retracting:
- `mua-ha`: summer rain, wetness, UEH atmosphere.
- `ngay-mai`: flamboyant blossoms and wind, UEH atmosphere.

**Important**: the engine has five operational phases (`idle`, `ignite`, `sweep`, `active`, `retract`), not literally two state-machine enums; the "two states" above describe the major visual outcomes. `mua-ha` and `ngay-mai` are the two track-driven environment variants.

## Entry points
- `source/src/reality/Front.tsx`: `HexLattice`, `StaffWall`, `Ignition`, custom GLSL.
- `source/src/reality/mask.ts`: `HEX_S`, world-space hex front and shader material transforms.
- `source/src/reality/state.ts`: phases, request/retract, activation data.
- `source/src/reality/RealityHost.tsx`: transitions, timing, two activated climate variants, uniform synchronization.
- `source/src/reality/worlds/UEH.tsx`, `weather/*`, `foliage.tsx`, `kit.tsx`: generated environments and two conditions.
- `source/src/reality/tracks.ts`, `music.ts`, `Sheets.tsx`: triggers, media links, music-reaction control.

## Export policy and limitations
- Source files copied by **their existing Git blob SHA** without modifying contents.
- Deliberately excludes the rest of the portfolio, the compiled `index.html`, other exhibit scenes, and 3D room-showcase assets.
- This is **source/data extraction**, not a self-contained web application. The extracted modules still reference parent-project imports such as `../store`, `../world`, `../audio`, `../gfx`, `../layout`, and other components. Reintegrate these dependencies or adapt imports before compiling.
- Original commercial music/video media are not bundled; source README states rehosting rights are not granted.
- No changes were made to `main`.
