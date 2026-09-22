# Room composition studies

Three variants of one room, exploring how a portfolio space should be
composed, lit and framed. **Composition, camera, lighting and asset
relationships only** — no navigation, UI, project pages, interactions or
transitions.

Open `scenes/StudySwitcher.tscn` (the project's main scene) and run. Left and
right arrows cycle studies; `C` toggles that study's second camera.

| Study | Idea | Canonical camera |
|---|---|---|
| `RoomStudy_A_WorkWall` | One dense working wall. Desk, shelf, research board and a raking fixture read as a single horizontal gesture. | 47° |
| `RoomStudy_B_DiagonalStudio` | Desk turned 34° off-axis. The room is read across a diagonal, with a floor light stand and a large research wall. | 50° |
| `RoomStudy_C_PresentationPlane` | A 4 m presentation plane as hero, lit by a hanging fixture, with the working desk demoted to foreground. | 52° |

## Nothing here is frozen

Coordinates, room dimensions, FOV, colours, light intensities and material
values are all still open. These are studies, not a locked set.

## Reserved portfolio surfaces

Every study reserves the real surfaces a portfolio would eventually occupy —
primary display, secondary display, research/corkboard, printed sheets, and
in C the large plane. They are deliberately **neutral planes, not fake UI**:
each room is meant to read as a considered space before any content exists.

They are checked, not eyeballed. `tools/check_studies.py` reports how much of
the canonical frame each reserved surface occupies and fails if the total
falls below 2%:

| Study | Reserved surface share of canonical frame |
|---|---|
| A | 5.1% |
| B | 3.2% |
| C | 13.7% |

## Lighting

Each study uses real Godot lights. `spotlight.glb` is fixture geometry only
and is always paired with an actual `SpotLight3D` aimed along the fixture's
own axis; the mesh never fakes illumination. Beyond the key light each room
has a practical (the reason the desk is readable), an unshadowed screen
bounce so the display reads as a light source, and a cool fill from the open
side so the wall does not go flat.

## Generated, not hand-placed

These `.tscn` files are emitted by `tools/build_studies.py`, which places
every object against the kit's real measured bounds rather than guessed
numbers. Regenerate with:

    python3 tools/build_studies.py     # write the three scenes
    python3 tools/check_studies.py     # physical + framing validation
    python3 tools/preview_studies.py   # composition previews -> previews/
    python3 tools/solve_camera.py abc  # search for non-clipping cameras

**Once you start hand-editing a study in the Godot editor, stop regenerating
that study** — the generator will overwrite your work.

## Why there are custom tools

Godot is not installed in this environment, so the scenes cannot be opened or
rendered here. `check_studies.py` verifies physically meaningful properties
(nothing floats, nothing interpenetrates, everything is inside the shell,
reserved surfaces are actually on screen) and `preview_studies.py` projects
the real geometry through the real cameras so composition can be judged
before an engine is available. See `previews/README.md` for what those images
do and do not represent.
