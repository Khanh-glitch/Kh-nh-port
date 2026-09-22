# Canonical renders — real lighting audition

These are the **first real rendered images** of the three studies. Unlike
`previews/` (AABB diagnostics, no lighting or materials), these resolve the
authored lights, materials, shadows and Godot's post-processing chain.

| Image | Study | Camera |
|---|---|---|
| `A_WorkWall_Canonical.png` | `RoomStudy_A_WorkWall` | `Canonical`, 47° |
| `B_DiagonalStudio_Canonical.png` | `RoomStudy_B_DiagonalStudio` | `Canonical`, 50° |
| `C_PresentationPlane_Canonical.png` | `RoomStudy_C_PresentationPlane` | `Canonical`, 52° |

1280×720, Cycles CPU, 32 samples + OpenImageDenoise. ~70 s each, rendered
one at a time. Secondary angles deliberately not rendered yet.

## The `.tscn` files are the source of truth

`tools/render_studies.py` **reads** the scenes and `scripts/room_palette.gd`;
it never writes them. No composition was changed to produce these images.
Every object position, light value, material and camera comes from the
committed scene files.

## Why not Godot

Godot cannot be installed here — the Debian mirrors are unreachable from this
sandbox (only PyPI and GitHub resolve). Blender was obtained as the `bpy`
PyPI wheel. So these are *faithful previews of the Godot scenes*, not Godot
screenshots, and the remaining differences are listed below.

## Godot → Cycles mapping

Reproduced rather than reinvented:

- **Light units.** Godot pre-multiplies light colour by π and its Lambert
  lobe divides by π. Cycles does not. Sun energy is therefore `π × energy`;
  point/spot wattage is `4π²d²  × energy × atten(d)`, calibrated at the
  distance each light actually works at (2.0 m spots, 1.2 m practicals),
  because Godot's windowed inverse-power falloff and Cycles' physical
  inverse-square can only agree at one distance.
- **Spot cone.** Godot `spot_angle` is a half-angle; Blender `spot_size` is
  the full cone, hence the ×2.
- **Colour.** All Godot `Color` values are sRGB and converted to linear.
- **Tonemap / glow / BCS.** Ports of Godot 4's own `tonemap.glsl`
  (ACES with the 1.8 bias, `tonemap_white`, then glow, then
  brightness/contrast/saturation in sRGB space) applied in numpy after a
  raw-linear EXR render.
- **Ambient.** Godot's flat `ambient_light` has no Cycles equivalent. A
  Light Path node gives camera rays the procedural sky and shading rays the
  ambient colour — the same split Godot makes, but with real occlusion
  instead of SSAO.
- **Materials.** `scripts/room_palette.gd` is parsed directly, so the kit
  re-surfacing here is the same data `scripts/kit_instance.gd` applies at
  runtime.

## Known differences from a Godot screenshot

- Cycles computes true multi-bounce GI; Godot Forward+ here has SSAO and no
  GI, so Godot will look slightly flatter in the corners.
- Godot's glow is a mip pyramid; this uses stacked box blurs.
- SSAO is not simulated (real ray-traced occlusion replaces it).

## Deliberately not used

No volumetrics, no fog, no depth of field, no caustics, no bloom beyond the
authored glow, no extra lights. Bounces are capped at 4. Nothing was added to
rescue a composition — a weak image here means a weak composition.

## Reproduce

    python3 tools/render_studies.py A --samples 32 --width 1280 --height 720

Requires the `bpy` wheel. One study at a time.
