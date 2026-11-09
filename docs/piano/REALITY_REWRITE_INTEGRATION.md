# ORBITA — Piano Reality Rewrite integration (V3-safe)

Merged from incoming `orbita-grand-piano-experience (4).zip` on top of repository main 6becd1b.

Safety: remote main is base tree, **NO** source/src/scene/Robot.tsx or Colossus-V3 files are overwritten. The root index.html data ESM map is updated by replacing ONLY the new Piano / Reality modules, preserving all existing Colossus-V3 module URLs intact.

Selected modifications: App (+RealityHud), Experience (+RealityHost), Piano (rwKeep and suppressAutoPlay, plus original sample-free audio fallback), Player (+interactive filter), world (+filter), RealityHud, all used src/reality modules except unused Tomorrow.tsx.

Intentionally retained from main: audio.ts (sample fallback), content.ts (new game descriptions), ui/Overlay.tsx (game UI), Colossus V3, Ragnarok, GPU prewarm, weather, materialize, graphics / highGuard.

Limitations: user audio and video files are NOT in ZIP; the two tracks use labelled procedural demos until real files are added to source/public/reality and configured in tracks.ts. The full compiled Vite release and end-to-end GPU performance/visual QA could not be reproduced in this isolated runtime. A source-level TypeScript transpile and embedded module graph check are performed.
