# Asset provenance

All third-party 3D binaries in this v1 set are recorded as **CC0 1.0 / public-domain dedication** by the source records checked during curation.

The production files were copied byte-for-byte from documented GitHub mirrors. The Git blob SHA of each copied file was verified to match the source blob SHA before inclusion.

| Local file | Author | Original model / pack | License | Original source | Verified mirror | Git blob SHA |
|---|---|---|---|---|---|---|
| `core/work-console.glb` | Kenney | Furniture Kit / sideTableDrawers.glb | CC0-1.0 | https://kenney.nl/assets/furniture-kit | `a52cents/was-it-there:src/assets/models/corridor/prop-console.glb` | `a801b290f9cd51a0dec7d5e0777ad839a727969d` |
| `core/chair.glb` | Kenney | Furniture Kit / chairCushion.glb | CC0-1.0 | https://kenney.nl/assets/furniture-kit | `a52cents/was-it-there:src/assets/models/bedroom/prop-chair-cushion.glb` | `bffa780b8f8a3efef7756025b2d00a3e01377a41` |
| `core/display.glb` | Kenney | Furniture Kit / televisionModern.glb | CC0-1.0 | https://kenney.nl/assets/furniture-kit | `a52cents/was-it-there:src/assets/models/bedroom/prop-television.glb` | `f047576f3d77a469e59059b1ae0aa1cdbbae7d0f` |
| `core/bookcase-low.glb` | Kenney | Furniture Kit / bookcaseOpenLow.glb | CC0-1.0 | https://kenney.nl/assets/furniture-kit | `a52cents/was-it-there:src/assets/models/bedroom/prop-bookcase-low.glb` | `3daa396e11c843a5da87ab6547a279731e6eba58` |
| `core/plant-small.glb` | Kenney | Furniture Kit / plantSmall2.glb | CC0-1.0 | https://kenney.nl/assets/furniture-kit | `a52cents/was-it-there:src/assets/models/bedroom/prop-plant-small.glb` | `2e6b8c7d1e1a6ce83d732344e1cc1a219a87adb4` |
| `music/speaker-small.glb` | Kenney | Furniture Kit / speakerSmall.glb | CC0-1.0 | https://kenney.nl/assets/furniture-kit | `a52cents/was-it-there:src/assets/models/corridor/prop-small-speaker.glb` | `5673177a3db49c2bc65e8131babde9092a2c3ed4` |
| `music/headphones.glb` | CreativeTrio | Headphones | CC0-1.0 | https://poly.pizza/m/PSsWSIAYIL | `juthomas/Isotricks:public/models/headphones.glb` | `ee822b19d9d6edc907e4772d163971e97cb46f21` |
| `research/books.glb` | Kenney | Furniture Kit / books.glb | CC0-1.0 | https://kenney.nl/assets/furniture-kit | `a52cents/was-it-there:src/assets/models/bedroom/prop-books-stack.glb` | `615aaa9632cf1b262c257f2cb7c208a6f199ab84` |
| `research/corkboard.glb` | CreativeTrio | Corkboard | CC0-1.0 | https://poly.pizza/m/U8yQZ9l0HZ | `chappyasel/PersonalWebsite:public/models/corkboard.glb` | `5396a661c3ce4a964b276a369228e6ed5249ef6a` |
| `ai/circuit-board.glb` | iPoly3D | Electronics Collectable | CC0-1.0 | https://poly.pizza/m/qqRVRerNSu | `chappyasel/PersonalWebsite:public/models/circuit-board.glb` | `34ab7fcfcafb4f20bc82eff1748a4297f343619a` |
| `event/spotlight.glb` | iPoly3D | Spotlight | CC0-1.0 | https://poly.pizza/m/YohOCmn0hO | `david-ma/ParallelHorizons:public/models/spotlight/Spotlight.glb` | `18a5763856cc7161728c6667d3bae1bea72ff6aa` |

## Source-record checks

- `a52cents/was-it-there/docs/ASSET_LICENSES.md`: Kenney Furniture Kit provenance, CC0 status, renamed GLBs and documented triangle counts.
- `juthomas/Isotricks/ATTRIBUTION.md`: CreativeTrio headphones recorded as CC0.
- `chappyasel/PersonalWebsite/public/models/LICENSES.json`: corkboard (CreativeTrio) and circuit board (iPoly3D) recorded as CC0.
- `david-ma/ParallelHorizons/README.md`: iPoly3D Spotlight from Poly Pizza credited as CC0.

## Engine-compatibility derivatives

Two curated originals cannot be imported by Godot 4. Both declare
`EXT_meshopt_compression` and `KHR_mesh_quantization` in `extensionsRequired`,
and Godot's glTF importer supports neither, so import fails outright rather
than degrading — a meshopt buffer has no uncompressed fallback by design.

Rather than swap in different models or hand-edit the curated files, the
originals are kept **byte-for-byte** as the licensing and provenance record,
and an importable derivative of each is generated alongside it:

| Derivative | Generated from | Git blob SHA | Bytes |
|---|---|---|---|
| `godot-compatible/research/corkboard.glb` | `research/corkboard.glb` | `6b8bf72f2d86ce0c283af18bacc6bcd4880164d6` | 16,200 |
| `godot-compatible/ai/circuit-board.glb` | `ai/circuit-board.glb` | `587145ec92b275cbb2b468d9b86bc1f7107b23b2` | 63,056 |

Produced by `tools/make-godot-compatible.mjs` (`cd tools && npm install &&
npm run make-godot-compatible`), which decodes the meshopt buffers and
de-quantizes vertex attributes to plain float32. **Geometry is unchanged**:
the largest world-space bounding-box deviation between original and
derivative is 3.9e-8 m, far below any modelling tolerance here.

The scenes reference the derivatives. Re-running the tool is idempotent and
reproduces identical output, so the derivatives can be regenerated from the
originals at any time and are safe to treat as build artifacts.

Licensing is unaffected: both sources are CC0-1.0, which permits modification
and redistribution without condition.

CC0 does not require attribution, but this provenance file is intentionally kept so later work does not lose source history or silently replace assets with less-clearly licensed copies.
