"""
build_study_a1.py — Study A1, Authored Identity Pass.

A0 (`scenes/RoomStudy_A_WorkWall.tscn`, commit 1a5e39c) is the approved
*baseline* and is never modified. This script reads it and writes a sibling
scene, `scenes/RoomStudy_A1_WorkWall_Identity.tscn`.

The A0 taste-gate failure was not composition or lighting — it was that the
room read as a tasteful generic 3D room rather than one specific person's
event-production studio. This pass tests one hypothesis:

    the room becomes specific when it is covered in evidence of real work,
    not when it gains more props.

What changes
------------
1. CONTENT. Every neutral emissive rectangle becomes a real authored surface
   built from the user's own project media (see tools/make_content_textures.py).
   The monitor shows their RUNNING ORDER concept mid-design; the corkboard
   becomes a review wall of run-of-show, floor plan, contact sheet and prints.

2. EVIDENCE GEOMETRY. A small number of *flat* additions only — pinned
   documents, a taped print, a credential on a nail, a cue sheet on the desk.
   No new 3D asset packs, no invented hero props. Each is a plane carrying
   authored graphics, which is what a real working wall actually is.

3. LIGHT. A0's spotlight-raking-the-corkboard gesture is preserved exactly.
   What changes is that the *workstation* now wins the eye: a desk-level
   practical is warmed and strengthened, and a soft top-light lifts the
   working nucleus out of the matte gloom. No new colours, no neon, no bloom.

Everything else — room shell, camera, kit placement, palette — is inherited
from A0 untouched, so the comparison isolates authored identity.

    python3 tools/build_study_a1.py
"""

from __future__ import annotations

import os
import re

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(REPO, "scenes", "RoomStudy_A_WorkWall.tscn")
DST = os.path.join(REPO, "scenes", "RoomStudy_A1_WorkWall_Identity.tscn")

TEX = "res://assets/textures/room-content"

# ---------------------------------------------------------------------------
# Content surfaces.
#
# (node, texture, width, height, pos, rot, emission)
# `emission` is a small self-lit factor for the monitor only; paper surfaces
# are lit by the room like any other object.
# ---------------------------------------------------------------------------

WALL = -2.288          # north wall inner face (A0 sheet plane)
BOARD = -2.2255        # corkboard front face, minus a hair

# Documents pinned on the corkboard (x 0.51..1.69, y 1.10..1.90).
BOARD_ITEMS = [
    # name,             texture,                  w,     h,     x,     y,    rot_z
    ("BoardRunSheet",   "board_runsheet.png",     0.300, 0.414, 0.680, 1.520, -1.4),
    ("BoardFloorPlan",  "board_floorplan.png",    0.330, 0.248, 1.010, 1.760,  1.1),
    ("BoardContacts",   "board_contact_strip.png", 0.430, 0.112, 1.070, 1.540, -0.7),
    ("BoardPrintEvent", "board_print_event.png",  0.290, 0.193, 1.460, 1.770,  1.8),
    ("BoardPrintMusic", "board_print_music.png",  0.175, 0.245, 1.480, 1.420, -2.2),
    ("BoardNoteA",      "board_note_a.png",       0.105, 0.085, 0.905, 1.285,  3.4),
    ("BoardNoteB",      "board_note_b.png",       0.100, 0.080, 1.235, 1.260, -2.8),
]

# Loose working material on the wall around the desk (A0 sheet positions
# reused, now carrying real content).
WALL_ITEMS = [
    ("SheetMusic",   "wall_sheet_music.png",  0.300, 0.400, -2.020, 1.980, -2.5),
    ("SheetBrief",   "wall_sheet_brief.png",  0.235, 0.320, -1.700, 2.040,  1.8),
    ("SheetLayout",  "wall_sheet_layout.png", 0.290, 0.207, -1.790, 1.735, -0.8),
    ("SheetPerf",    "wall_sheet_perf.png",   0.330, 0.254, 0.255,  2.135,  1.2),
    ("SheetFrame",   "wall_sheet_frame.png",  0.200, 0.260, 0.300,  1.800, -1.6),
]


def mat_content(name, tex, rough, emission=0.0, warm=False):
    """An unshaded-ish paper/screen material. Emission only for the screen."""
    e = ""
    if emission > 0.0:
        e = (f'emission_enabled = true\n'
             f'emission = Color(1, 1, 1, 1)\n'
             f'emission_energy_multiplier = {emission}\n'
             f'emission_texture = ExtResource("{name}_tex")\n'
             f'emission_operator = 0\n')
    tint = "Color(1, 1, 1, 1)"
    return (f'[sub_resource type="StandardMaterial3D" id="{name}"]\n'
            f'resource_name = "{name}"\n'
            f'albedo_color = {tint}\n'
            f'albedo_texture = ExtResource("{name}_tex")\n'
            f'roughness = {rough}\n'
            f'metallic = 0\n'
            f'metallic_specular = 0.28\n'
            f'texture_filter = 4\n'
            f'{e}')


def build():
    src = open(SRC, encoding="utf-8").read()

    # ---- header: bump load_steps, rename root ----------------------------
    m = re.match(r"\[gd_scene load_steps=(\d+) format=3\]", src)
    base_steps = int(m.group(1))

    # ---- collect new external resources (textures) -----------------------
    ext_lines = []
    tex_ids = {}

    def add_tex(node_name, filename):
        rid = f"{node_name}_tex"
        tex_ids[node_name] = rid
        ext_lines.append(
            f'[ext_resource type="Texture2D" '
            f'path="{TEX}/{filename}" id="{rid}"]')
        return rid

    add_tex("ScreenRunningOrder", "screen_running_order.png")
    add_tex("DeskCueSheet", "desk_runsheet.png")
    add_tex("MountedPrint", "mounted_print.png")
    add_tex("Credential", "pass_credential.png")
    for name, fn, *_ in BOARD_ITEMS:
        add_tex(name, fn)
    for name, fn, *_ in WALL_ITEMS:
        add_tex(name, fn)

    # ---- new sub-resources ------------------------------------------------
    sub_lines = []

    # The monitor content surface: a real screen, gently self-lit so it still
    # reads as a light source in the room without blowing out the artwork.
    sub_lines.append(mat_content("ScreenRunningOrder", None, 0.34, 0.42))
    sub_lines.append(mat_content("DeskCueSheet", None, 0.90))
    sub_lines.append(mat_content("MountedPrint", None, 0.82))
    sub_lines.append(mat_content("Credential", None, 0.74))
    for name, *_ in BOARD_ITEMS:
        sub_lines.append(mat_content(name, None, 0.93))
    for name, *_ in WALL_ITEMS:
        sub_lines.append(mat_content(name, None, 0.92))

    # quad meshes for every new surface
    def quad(qid, w, h):
        sub_lines.append(f'[sub_resource type="QuadMesh" id="{qid}"]\n'
                         f'size = Vector2({w}, {h})\n')

    for name, _fn, w, h, *_ in BOARD_ITEMS:
        quad(f"Q_{name}", w, h)
    for name, _fn, w, h, *_ in WALL_ITEMS:
        quad(f"Q_{name}", w, h)
    quad("Q_DeskCueSheet", 0.21, 0.297)
    quad("Q_MountedPrint", 0.62, 0.3875)
    quad("Q_Credential", 0.075, 0.1145)
    # a thin nail/hook for the credential, and a rail the print hangs on
    sub_lines.append('[sub_resource type="BoxMesh" id="Box_CredNail"]\n'
                     'size = Vector3(0.012, 0.012, 0.035)\n')
    sub_lines.append('[sub_resource type="BoxMesh" id="Box_CredStrap"]\n'
                     'size = Vector3(0.016, 0.115, 0.004)\n')
    sub_lines.append('[sub_resource type="StandardMaterial3D" id="mat_strap"]\n'
                     'resource_name = "mat_strap"\n'
                     'albedo_color = Color(0.404, 0.114, 0.075, 1)\n'
                     'roughness = 0.88\n'
                     'metallic = 0\n'
                     'metallic_specular = 0.3\n')

    # ---- swap the primary display's neutral surface for the real screen --
    out = src

    out = out.replace(
        '[node name="ContentPrimary" type="MeshInstance3D" parent="WorkWall"]\n'
        'position = Vector3(-0.62, 1.18671934, -1.919125)\n'
        'mesh = SubResource("Quad_ContentPrimary")\n'
        'surface_material_override/0 = SubResource("mat_surface_primary")',
        '[node name="ContentPrimary" type="MeshInstance3D" parent="WorkWall"]\n'
        'position = Vector3(-0.62, 1.18671934, -1.919125)\n'
        'mesh = SubResource("Quad_ContentPrimary")\n'
        'surface_material_override/0 = SubResource("ScreenRunningOrder")')

    # ---- replace the five neutral pinned sheets with authored ones -------
    sheets_block = re.search(
        r'\[node name="PinnedSheets".*?(?=\[node name="ContentSecondary")',
        out, re.S).group(0)

    new_sheets = ['[node name="PinnedSheets" type="Node3D" parent="WorkWall"]\n']
    for name, _fn, w, h, x, y, rz in WALL_ITEMS:
        new_sheets.append(
            f'[node name="{name}" type="MeshInstance3D" '
            f'parent="WorkWall/PinnedSheets"]\n'
            f'position = Vector3({x}, {y}, {WALL})\n'
            f'rotation_degrees = Vector3(0, 0, {rz})\n'
            f'mesh = SubResource("Q_{name}")\n'
            f'surface_material_override/0 = SubResource("{name}")\n')
    out = out.replace(sheets_block, "\n".join(new_sheets) + "\n")

    # ---- ContentSecondary becomes a mounted print on the wall ------------
    out = re.sub(
        r'\[node name="ContentSecondary" type="MeshInstance3D" parent="WorkWall"\]\n'
        r'position = Vector3\([^)]*\)\n'
        r'rotation_degrees = Vector3\([^)]*\)\n'
        r'mesh = SubResource\("Quad_ContentSecondary"\)\n'
        r'surface_material_override/0 = SubResource\("mat_surface_secondary"\)',
        '[node name="ContentSecondary" type="MeshInstance3D" parent="WorkWall"]\n'
        'position = Vector3(1.74, 0.82, -2.25)\n'
        'rotation_degrees = Vector3(0, -7, 0)\n'
        'mesh = SubResource("Q_MountedPrint")\n'
        'surface_material_override/0 = SubResource("MountedPrint")',
        out)

    # ---- new nodes: corkboard documents, desk sheet, credential ----------
    added = ["\n[node name=\"BoardWork\" type=\"Node3D\" parent=\"WorkWall\"]\n"]
    for name, _fn, w, h, x, y, rz in BOARD_ITEMS:
        added.append(
            f'[node name="{name}" type="MeshInstance3D" parent="WorkWall/BoardWork"]\n'
            f'position = Vector3({x}, {y}, {BOARD})\n'
            f'rotation_degrees = Vector3(0, 0, {rz})\n'
            f'mesh = SubResource("Q_{name}")\n'
            f'surface_material_override/0 = SubResource("{name}")\n')

    # The cue sheet lying on the desk, angled as if just put down.
    added.append(
        '[node name="DeskCueSheet" type="MeshInstance3D" parent="WorkWall">\n'
        .replace(">", "]") +
        'position = Vector3(-1.02, 0.7385, -1.66)\n'
        'rotation_degrees = Vector3(-90, 13, 0)\n'
        'mesh = SubResource("Q_DeskCueSheet")\n'
        'surface_material_override/0 = SubResource("DeskCueSheet")\n')

    # Event credential hung on a nail beside the board — small, but it is the
    # single clearest "this person works on shows" object in the room.
    added.append(
        '[node name="Credential" type="Node3D" parent="WorkWall"]\n'
        'position = Vector3(1.905, 1.487, -2.276)\n')
    added.append(
        '[node name="Nail" type="MeshInstance3D" parent="WorkWall/Credential"]\n'
        'position = Vector3(0, 0.126, 0.012)\n'
        'mesh = SubResource("Box_CredNail")\n'
        'surface_material_override/0 = SubResource("mat_metal_dark")\n')
    added.append(
        '[node name="Strap" type="MeshInstance3D" parent="WorkWall/Credential"]\n'
        'position = Vector3(0, 0.064, 0.002)\n'
        'rotation_degrees = Vector3(0, 0, 3)\n'
        'mesh = SubResource("Box_CredStrap")\n'
        'surface_material_override/0 = SubResource("mat_strap")\n')
    added.append(
        '[node name="Card" type="MeshInstance3D" parent="WorkWall/Credential"]\n'
        'position = Vector3(0.004, -0.05, 0.004)\n'
        'rotation_degrees = Vector3(0, 0, 2)\n'
        'mesh = SubResource("Q_Credential")\n'
        'surface_material_override/0 = SubResource("Credential")\n')

    out = out.replace('\n[node name="Lighting" type="Node3D" parent="."]',
                      "".join(added) +
                      '\n[node name="Lighting" type="Node3D" parent="."]')

    # ---- lighting: re-balanced for the new surface albedo -----------------
    # A0's levels were tuned against dark matte surfaces (albedo ~0.13-0.20).
    # A1's working wall is now mostly paper (albedo ~0.89), which reflects
    # roughly seven times as much light for the same energy. Keeping A0's
    # numbers would blow the documents to featureless white, so the room is
    # re-balanced around the brighter surfaces. This is a re-audition of the
    # same lighting design, not a new one:
    #   - the spot raking the corkboard (A0's memorable gesture) is kept,
    #     pulled back only enough that the pinned documents stay readable;
    #   - the desk practical stays the warm centre of the working nucleus;
    #   - one soft top wash gives the nucleus its own pool of light.
    out = out.replace(
        '[node name="SpotKey" type="SpotLight3D" parent="Lighting"]\n'
        'position = Vector3(1.96, 2.42, -1.42)\n'
        'rotation_degrees = Vector3(-46, 30, 0)\n'
        'light_color = Color(1, 0.867, 0.69, 1)\n'
        'light_energy = 9.5',
        '[node name="SpotKey" type="SpotLight3D" parent="Lighting"]\n'
        'position = Vector3(1.96, 2.42, -1.42)\n'
        'rotation_degrees = Vector3(-46, 30, 0)\n'
        'light_color = Color(1, 0.867, 0.69, 1)\n'
        'light_energy = 5.0')

    out = out.replace(
        '[node name="DeskPractical" type="OmniLight3D" parent="Lighting"]\n'
        'position = Vector3(-0.75, 1.52, -1.58)\n'
        'light_color = Color(1, 0.831, 0.639, 1)\n'
        'light_energy = 3.4',
        '[node name="DeskPractical" type="OmniLight3D" parent="Lighting"]\n'
        'position = Vector3(-0.78, 1.46, -1.5)\n'
        'light_color = Color(1, 0.847, 0.667, 1)\n'
        'light_energy = 2.0')

    # The monitor is now artwork, not a dark slab; the bounce it throws is
    # correspondingly gentler.
    out = out.replace(
        '[node name="ScreenBounce" type="OmniLight3D" parent="Lighting"]\n'
        'position = Vector3(-0.62, 1.05, -1.68)\n'
        'light_color = Color(0.573, 0.698, 0.863, 1)\n'
        'light_energy = 1.25',
        '[node name="ScreenBounce" type="OmniLight3D" parent="Lighting"]\n'
        'position = Vector3(-0.62, 1.05, -1.62)\n'
        'light_color = Color(0.639, 0.725, 0.855, 1)\n'
        'light_energy = 0.85')

    out = out.replace(
        '\n[node name="Fill" type="DirectionalLight3D" parent="Lighting"]',
        '\n[node name="DeskWash" type="SpotLight3D" parent="Lighting"]\n'
        'position = Vector3(-0.88, 2.66, -1.38)\n'
        'rotation_degrees = Vector3(-74, 6, 0)\n'
        'light_color = Color(1, 0.925, 0.827, 1)\n'
        'light_energy = 2.6\n'
        'light_specular = 0.3\n'
        'light_size = 0.12\n'
        'shadow_enabled = true\n'
        'shadow_bias = 0.03\n'
        'shadow_normal_bias = 1.4\n'
        'spot_range = 4.6\n'
        'spot_attenuation = 1.2\n'
        'spot_angle = 46\n'
        'spot_angle_attenuation = 1.1\n'
        '\n[node name="Fill" type="DirectionalLight3D" parent="Lighting"]')

    # Cool fill keeps the dark half of the room in shape.
    out = out.replace("light_energy = 0.32\nlight_specular = 0.15",
                      "light_energy = 0.3\nlight_specular = 0.15")

    # The screen is emissive artwork: dial the self-lit term so it reads as a
    # live display without clipping the photograph on it.
    out = out.replace("emission_energy_multiplier = 0.42",
                      "emission_energy_multiplier = 0.22")

    # ---- rename root node -------------------------------------------------
    out = out.replace('[node name="RoomStudy_A_WorkWall" type="Node3D"]',
                      '[node name="RoomStudy_A1_WorkWall_Identity" type="Node3D"]')

    # ---- splice in the new ext/sub resources ------------------------------
    new_steps = base_steps + len(ext_lines) + len(sub_lines)
    out = re.sub(r"\[gd_scene load_steps=\d+ format=3\]",
                 f"[gd_scene load_steps={new_steps} format=3]", out, count=1)

    # externals go after the last existing ext_resource
    last_ext = out.rindex("[ext_resource")
    eol = out.index("\n", last_ext) + 1
    out = out[:eol] + "\n".join(ext_lines) + "\n" + out[eol:]

    # sub-resources go right before the first node
    first_node = out.index("[node ")
    out = out[:first_node] + "\n".join(sub_lines) + "\n" + out[first_node:]

    with open(DST, "w", encoding="utf-8") as f:
        f.write(out)

    print(f"wrote {os.path.relpath(DST, REPO)}")
    print(f"  load_steps {base_steps} -> {new_steps}")
    print(f"  +{len(ext_lines)} textures, +{len(sub_lines)} sub-resources")
    print(f"  board documents: {len(BOARD_ITEMS)}, wall sheets: {len(WALL_ITEMS)}")

    missing = []
    for line in ext_lines:
        p = re.search(r'path="res://([^"]+)"', line).group(1)
        if not os.path.exists(os.path.join(REPO, p)):
            missing.append(p)
    print("  missing textures:", missing if missing else "none")


if __name__ == "__main__":
    build()
