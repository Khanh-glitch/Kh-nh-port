#!/usr/bin/env python3
"""
build_studies.py — emits the three room composition studies as Godot 4 .tscn.

Why a generator instead of hand-written scenes:
  - every asset is placed by measured anchor (base-centre, back-face, wall
    plane), so nothing floats, sinks or intersects by accident;
  - the three studies share one room shell, one palette and one lighting rig,
    which is the "do not build three production architectures" requirement;
  - a framing report is printed for each canonical camera, which is how the
    compositions were checked without a running renderer.

Run:  python3 tools/build_studies.py
The .tscn files it writes are the deliverable and are meant to be opened and
adjusted in Godot. Once a study is being iterated on in the editor, stop
re-running this for that study.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from roomkit import (  # noqa: E402
    REPO, Study, fit_scale, frame_report, measure, num, solve_placement,
    validate_tscn, vec2, vec3, color,
)

# ---------------------------------------------------------------------------
# shared material language (mirrors scripts/room_palette.gd for shell surfaces)
# ---------------------------------------------------------------------------

SHELL_MATERIALS = {
    "mat_floor": dict(albedo=(0.128, 0.115, 0.104), rough=0.93, metal=0.0),
    "mat_wall": dict(albedo=(0.196, 0.190, 0.181), rough=0.96, metal=0.0),
    "mat_wall_dark": dict(albedo=(0.121, 0.119, 0.118), rough=0.95, metal=0.0),
    "mat_ceiling": dict(albedo=(0.156, 0.152, 0.147), rough=0.97, metal=0.0),
    "mat_desk_top": dict(albedo=(0.298, 0.226, 0.165), rough=0.78, metal=0.0),
    "mat_metal_dark": dict(albedo=(0.098, 0.100, 0.106), rough=0.55, metal=0.45),
    "mat_paper": dict(albedo=(0.706, 0.671, 0.608), rough=0.94, metal=0.0),
    "mat_paper_warm": dict(albedo=(0.741, 0.682, 0.569), rough=0.94, metal=0.0),
    "mat_screen": dict(albedo=(0.043, 0.047, 0.055), rough=0.16, metal=0.0),
    "mat_rug": dict(albedo=(0.184, 0.165, 0.149), rough=0.97, metal=0.0),
    "mat_cable": dict(albedo=(0.071, 0.071, 0.075), rough=0.8, metal=0.1),
}

# Placeholder surfaces reserved for real portfolio content. Deliberately
# neutral: a flat value + a faint warm tint so they read as "surface waiting
# for work", never as fake UI.
SURFACE_MATERIALS = {
    "mat_surface_primary": dict(albedo=(0.128, 0.132, 0.140), rough=0.34, metal=0.0,
                                emission=(0.180, 0.196, 0.212), emission_energy=0.55),
    "mat_surface_secondary": dict(albedo=(0.150, 0.146, 0.140), rough=0.62, metal=0.0,
                                  emission=(0.132, 0.128, 0.122), emission_energy=0.22),
    "mat_surface_print": dict(albedo=(0.678, 0.639, 0.576), rough=0.92, metal=0.0),
}


def register_materials(st: Study) -> dict:
    """Create the shared material resources once per scene."""
    ids = {}
    for name, spec in {**SHELL_MATERIALS, **SURFACE_MATERIALS}.items():
        props = {
            "resource_name": f'"{name}"',
            "albedo_color": color(spec["albedo"]),
            "roughness": num(spec["rough"]),
            "metallic": num(spec["metal"]),
            "metallic_specular": "0.42",
        }
        if "emission" in spec:
            props["emission_enabled"] = "true"
            props["emission"] = color(spec["emission"])
            props["emission_energy_multiplier"] = num(spec["emission_energy"])
        st.s.sub_res("StandardMaterial3D", name, props)
        ids[name] = name
    return ids


# ---------------------------------------------------------------------------
# shared room shell
# ---------------------------------------------------------------------------

def build_shell(st: Study, w: float, d: float, h: float, *,
                open_sides=("east",), back_material="mat_wall"):
    """Box room centred on origin in X/Z, floor at y=0.

    `open_sides` are omitted so the camera can sit outside the volume.
    """
    st.s.node("RoomShell", "Node3D", ".")
    t = 0.12  # wall thickness

    st.box("Floor", "RoomShell", (w, t, d), (0, -t / 2, 0), "mat_floor")
    st.box("Ceiling", "RoomShell", (w, t, d), (0, h + t / 2, 0), "mat_ceiling")

    if "north" not in open_sides:  # -Z
        st.box("WallNorth", "RoomShell", (w, h, t), (0, h / 2, -d / 2 - t / 2), back_material)
    if "south" not in open_sides:  # +Z
        st.box("WallSouth", "RoomShell", (w, h, t), (0, h / 2, d / 2 + t / 2), "mat_wall_dark")
    if "west" not in open_sides:  # -X
        st.box("WallWest", "RoomShell", (t, h, d), (-w / 2 - t / 2, h / 2, 0), "mat_wall")
    if "east" not in open_sides:  # +X
        st.box("WallEast", "RoomShell", (t, h, d), (w / 2 + t / 2, h / 2, 0), "mat_wall")


def build_environment(st: Study, *, sky_top, sky_horizon, energy, fog=False):
    """One WorldEnvironment shared in structure across the studies."""
    sky_mat = st.s.sub_res("ProceduralSkyMaterial", "SkyMat", {
        "sky_top_color": color(sky_top),
        "sky_horizon_color": color(sky_horizon),
        "sky_energy_multiplier": num(energy),
        "ground_bottom_color": color((0.055, 0.052, 0.050)),
        "ground_horizon_color": color(sky_horizon),
        "sun_angle_max": "18.0",
        "sun_curve": "0.25",
    })
    sky = st.s.sub_res("Sky", "Sky", {"sky_material": f'SubResource("{sky_mat}")'})
    env_props = {
        "background_mode": "2",
        "background_energy_multiplier": num(energy),
        "sky": f'SubResource("{sky}")',
        "ambient_light_source": "3",
        "ambient_light_color": color((0.318, 0.345, 0.404)),
        "ambient_light_sky_contribution": "0.55",
        "ambient_light_energy": "0.9",
        "reflected_light_source": "2",
        "tonemap_mode": "3",
        "tonemap_exposure": "1.0",
        "tonemap_white": "6.0",
        "ssao_enabled": "true",
        "ssao_radius": "0.8",
        "ssao_intensity": "1.6",
        "ssao_power": "1.8",
        "ssil_enabled": "false",
        "sdfgi_enabled": "false",
        "glow_enabled": "true",
        "glow_intensity": "0.28",
        "glow_strength": "0.85",
        "glow_bloom": "0.05",
        "glow_blend_mode": "1",
        "glow_hdr_threshold": "1.25",
        "adjustment_enabled": "true",
        "adjustment_brightness": "1.0",
        "adjustment_contrast": "1.06",
        "adjustment_saturation": "0.92",
    }
    if fog:
        # Used only in C, where the far presentation wall needs aerial
        # separation. Density is low enough to read as air, not atmosphere.
        env_props.update({
            "fog_enabled": "true",
            "fog_light_color": color((0.196, 0.208, 0.235)),
            "fog_light_energy": "0.6",
            "fog_density": "0.012",
            "fog_sky_affect": "0.0",
        })
    env = st.s.sub_res("Environment", "Env", env_props)

    cam_attrs = st.s.sub_res("CameraAttributesPractical", "CamAttrs", {
        "dof_blur_far_enabled": "false",
        "auto_exposure_enabled": "false",
    })
    st.s.node("WorldEnvironment", "WorldEnvironment", ".", props={
        "environment": f'SubResource("{env}")',
        "camera_attributes": f'SubResource("{cam_attrs}")',
    })


def add_practical_light(st: Study, name: str, parent: str, position, *,
                        energy=1.0, color_rgb=(1.0, 0.85, 0.68), range_m=4.0,
                        shadow=True, size=0.1, attenuation=1.6, specular=0.4):
    st.s.node(name, "OmniLight3D", parent, position=position, props={
        "light_color": color(color_rgb),
        "light_energy": num(energy),
        "light_specular": num(specular),
        "light_size": num(size),
        "shadow_enabled": "true" if shadow else "false",
        "shadow_bias": "0.04",
        "shadow_normal_bias": "1.2",
        "omni_range": num(range_m),
        "omni_attenuation": num(attenuation),
    })


def add_spot(st: Study, name: str, parent: str, position, rotation, *,
             energy=6.0, color_rgb=(1.0, 0.878, 0.702), range_m=9.0,
             angle=26.0, attenuation=1.1, angle_attenuation=0.6, shadow=True):
    st.s.node(name, "SpotLight3D", parent, position=position, rotation=rotation, props={
        "light_color": color(color_rgb),
        "light_energy": num(energy),
        "light_specular": num(0.5),
        "light_size": "0.06",
        "shadow_enabled": "true" if shadow else "false",
        "shadow_bias": "0.03",
        "shadow_normal_bias": "1.4",
        "spot_range": num(range_m),
        "spot_attenuation": num(attenuation),
        "spot_angle": num(angle),
        "spot_angle_attenuation": num(angle_attenuation),
    })


def add_cameras(st: Study, canonical, secondary):
    st.s.node("Cameras", "Node3D", ".", props={
        "script": f'ExtResource("{st.s.ext_res("Script", "res://scripts/study_camera.gd")}")'
    })
    st.camera("Canonical", "Cameras", canonical["eye"], canonical["target"],
              canonical["fov"], current=True)
    st.camera("Secondary", "Cameras", secondary["eye"], secondary["target"],
              secondary["fov"], current=False)


# ---------------------------------------------------------------------------
# recurring furniture groups
# ---------------------------------------------------------------------------

DESK_H = 0.735          # desk top height (m)
DESK_T = 0.045          # desk slab thickness


def build_desk(st: Study, parent: str, *, name="Desk", center, width, depth,
               rotation_y=0.0, material="mat_desk_top"):
    """A built desk slab + slim legs, placed under a rotated parent node.

    The kit's work-console is only 0.38 m tall, so it reads as an under-desk
    unit rather than a desk. Building the slab gives a believable 0.735 m
    working height and a real surface for objects to sit on.

    World-space bookkeeping is threaded through `parent_xform` so the checker
    sees the true rotated AABBs, not local ones.
    """
    st.s.node(name, "Node3D", parent, position=center, rotation=(0, rotation_y, 0))
    node = f"{parent}/{name}"
    px = (center, rotation_y)

    st.box("Top", node, (width, DESK_T, depth), (0, DESK_H - DESK_T / 2, 0),
           material, parent_xform=px)

    leg = 0.045
    for sx, tag in ((-1, "L"), (1, "R")):
        x = sx * (width / 2 - 0.09)
        st.box(f"Leg{tag}F", node, (leg, DESK_H - DESK_T, leg),
               (x, (DESK_H - DESK_T) / 2, depth / 2 - 0.08), "mat_metal_dark",
               parent_xform=px)
        st.box(f"Leg{tag}B", node, (leg, DESK_H - DESK_T, leg),
               (x, (DESK_H - DESK_T) / 2, -depth / 2 + 0.08), "mat_metal_dark",
               parent_xform=px)
    return node


def desk_surface_y() -> float:
    return DESK_H


# --- display content surface ----------------------------------------------
# Measured from the 2-triangle "metal" primitive inside core/display.glb,
# expressed as fractions of the shell's 0.6848 m width so any display scale
# lands the content plane exactly on the screen face.
SCREEN_W_FRAC = 0.975569
SCREEN_H_FRAC = 0.538069
SCREEN_CY_FRAC = 0.382813
SCREEN_Z_FRAC = 0.031250


def add_display(st: Study, name: str, parent: str, *, width: float, at, yaw: float,
                surface="mat_surface_primary"):
    """Place a display shell and its reserved content plane as one unit.

    `at` is the base-centre of the shell on its supporting surface. Returns the
    shell AABB. The content plane is offset along the display's own forward
    axis so it sits just proud of the screen face at any rotation.
    """
    scale = fit_scale("display", "x", width)
    aabb = st.kit(name, parent, "display", scale, rot=(0, yaw, 0),
                  anchor=("center", "min", "center"), at=at)

    a = math.radians(yaw)
    fwd = (math.sin(a), 0.0, math.cos(a))
    off = width * SCREEN_Z_FRAC + 0.004
    centre = (at[0] + fwd[0] * off,
              at[1] + width * SCREEN_CY_FRAC,
              at[2] + fwd[2] * off)
    st.quad(f"Content{name.replace('Display', '')}" if "Display" in name else f"{name}Content",
            parent, (width * SCREEN_W_FRAC, width * SCREEN_H_FRAC),
            centre, surface, rotation=(0, yaw, 0))
    return aabb


# ---------------------------------------------------------------------------
# STUDY A — WORK WALL
# ---------------------------------------------------------------------------

def study_a():
    st = Study("RoomStudy_A_WorkWall")
    register_materials(st)

    W, D, H = 5.4, 4.6, 2.85
    build_shell(st, W, D, H, open_sides=("south",), back_material="mat_wall_dark")
    build_environment(st, sky_top=(0.078, 0.094, 0.133), sky_horizon=(0.137, 0.141, 0.157),
                      energy=0.35)

    wall_z = -D / 2          # the working wall (-Z)
    st.s.node("WorkWall", "Node3D", ".")
    st.s.node("Floorfield", "Node3D", ".")

    # --- the wall itself: one continuous production surface -----------------
    # A shallow plinth/shelf runs the full width, tying desk and storage into
    # one horizontal gesture rather than separate furniture islands.
    st.box("WallShelf", "WorkWall", (4.3, 0.06, 0.28), (-0.15, 1.62, wall_z + 0.14),
           "mat_desk_top")
    st.box("WallShelfBracketL", "WorkWall", (0.04, 0.22, 0.2), (-1.95, 1.50, wall_z + 0.12),
           "mat_metal_dark")
    st.box("WallShelfBracketR", "WorkWall", (0.04, 0.22, 0.2), (1.55, 1.50, wall_z + 0.12),
           "mat_metal_dark")

    # Desk pushed against the wall, off-centre so the composition is asymmetric.
    desk = build_desk(st, "WorkWall", center=(-0.55, 0, wall_z + 0.42),
                      width=2.9, depth=0.78)

    # --- primary display: the dominant content surface ----------------------
    add_display(st, "PrimaryDisplay", "WorkWall", width=1.18,
                at=(-0.62, desk_surface_y(), wall_z + 0.34), yaw=0.0)

    # --- corkboard: research wall, deliberately adjacent to the screen ------
    cork_scale = fit_scale("corkboard", "x", 1.24)
    cork_aabb = st.kit("Corkboard", "WorkWall", "corkboard", cork_scale,
                       rot=(0, 0, 0), anchor=("center", "center", "min"),
                       at=(1.10, 1.50, wall_z + 0.02))

    # --- pinned sheets: printed evidence, slightly irregular ----------------
    st.s.node("PinnedSheets", "Node3D", "WorkWall")
    sheets = [
        (-2.02, 1.98, 0.30, 0.40, -2.5, "mat_surface_print"),
        (-1.70, 2.04, 0.22, 0.30, 1.8, "mat_paper"),
        (-1.80, 1.66, 0.26, 0.20, -0.8, "mat_paper_warm"),
        (0.26, 2.18, 0.42, 0.30, 1.2, "mat_surface_secondary"),
        (0.30, 1.80, 0.20, 0.26, -1.6, "mat_paper"),
    ]
    for i, (x, y, sw, sh, rot, mat) in enumerate(sheets):
        st.quad(f"Sheet{i}", "WorkWall/PinnedSheets", (sw, sh),
                (x, y, wall_z + 0.012), mat, rotation=(0, 0, rot))

    # --- secondary display surface, wall-mounted, turned slightly -----------
    st.quad("ContentSecondary", "WorkWall", (0.80, 0.50),
            (1.74, 0.82, wall_z + 0.05), "mat_surface_secondary", rotation=(0, -7, 0))

    # --- working material on the desk ---------------------------------------
    y = desk_surface_y()
    st.kit("Headphones", "WorkWall", "headphones", fit_scale("headphones", "x", 0.20),
           rot=(0, 24, 0), anchor=("center", "min", "center"), at=(0.30, y, wall_z + 0.52))
    st.kit("BooksDesk", "WorkWall", "books", fit_scale("books", "x", 0.26),
           rot=(0, -8, 0), anchor=("center", "min", "center"), at=(-1.72, y, wall_z + 0.46))
    st.kit("CircuitBoard", "WorkWall", "circuit-board", fit_scale("circuit-board", "x", 0.30),
           rot=(-90, 14, 0), anchor=("center", "min", "center"), at=(-1.28, y, wall_z + 0.56))

    # Speaker on the wall shelf: music sits inside the working zone.
    st.kit("SpeakerShelf", "WorkWall", "speaker-small", fit_scale("speaker-small", "y", 0.30),
           rot=(0, -16, 0), anchor=("center", "min", "center"), at=(0.86, 1.65, wall_z + 0.16))
    st.kit("PlantShelf", "WorkWall", "plant-small", fit_scale("plant-small", "y", 0.22),
           rot=(0, 0, 0), anchor=("center", "min", "center"), at=(-1.62, 1.65, wall_z + 0.16))

    # --- chair, pulled out and rotated: room reads as just-left -------------
    st.kit("Chair", "Floorfield", "chair", fit_scale("chair", "y", 0.94),
           rot=(0, 203, 0), anchor=("center", "min", "center"), at=(-1.32, 0, wall_z + 1.24))

    # --- depth: low storage on the side wall --------------------------------
    st.kit("Bookcase", "Floorfield", "bookcase-low", fit_scale("bookcase-low", "y", 0.86),
           rot=(0, 90, 0), anchor=("center", "min", "max"), at=(-W / 2 + 0.14, 0, 0.48))
    st.kit("BooksShelf", "Floorfield", "books", fit_scale("books", "x", 0.30),
           rot=(0, 96, 0), anchor=("center", "min", "center"), at=(-W / 2 + 0.44, 0.86, 0.30))
    st.kit("SpeakerFloor", "Floorfield", "speaker-small", fit_scale("speaker-small", "y", 0.46),
           rot=(0, 68, 0), anchor=("center", "min", "center"), at=(1.96, 0, wall_z + 1.02))

    st.box("Rug", "Floorfield", (2.6, 0.012, 1.7), (-0.35, 0.006, wall_z + 1.5), "mat_rug")

    # --- lighting -----------------------------------------------------------
    st.s.node("Lighting", "Node3D", ".")

    # Production fixture: real equipment clamped to the wall shelf, aimed
    # across the working wall at a rake. This is the memorable relationship.
    spot_scale = fit_scale("spotlight", "y", 0.62)
    st.kit("SpotFixture", "Lighting", "spotlight", spot_scale,
           rot=(-58, 24, 0), anchor=("center", "max", "center"),
           at=(2.02, 2.52, wall_z + 0.86))
    add_spot(st, "SpotKey", "Lighting", (1.96, 2.42, wall_z + 0.88), (-46, 30, 0),
             energy=9.5, color_rgb=(1.0, 0.867, 0.690), range_m=7.5, angle=30.0,
             angle_attenuation=0.75)

    # Practical working light over the desk — the reason the desk is readable.
    add_practical_light(st, "DeskPractical", "Lighting", (-0.75, 1.52, wall_z + 0.72),
                        energy=3.4, color_rgb=(1.0, 0.831, 0.639), range_m=3.6,
                        attenuation=1.5)
    # Screen bounce, no shadow: sells the display as a light source.
    add_practical_light(st, "ScreenBounce", "Lighting", (-0.62, 1.05, wall_z + 0.62),
                        energy=1.25, color_rgb=(0.573, 0.698, 0.863), range_m=2.0,
                        shadow=False, attenuation=2.0, specular=0.2)
    # Cool fill from the open side, so the wall does not go flat.
    st.s.node("Fill", "DirectionalLight3D", "Lighting",
              position=(2.4, 2.4, 2.6), rotation=(-24, 148, 0), props={
                  "light_color": color((0.616, 0.694, 0.855)),
                  "light_energy": "0.32",
                  "light_specular": "0.15",
                  "shadow_enabled": "false",
              })

    add_cameras(st,
                canonical=dict(eye=(1.78, 1.46, 2.42), target=(-0.18, 1.20, -2.10), fov=47),
                secondary=dict(eye=(-2.05, 1.62, 1.35), target=(0.55, 1.05, -2.15), fov=52))
    return st


# ---------------------------------------------------------------------------
# STUDY B — DIAGONAL STUDIO
# ---------------------------------------------------------------------------

def study_b():
    st = Study("RoomStudy_B_DiagonalStudio")
    register_materials(st)

    W, D, H = 5.8, 5.4, 2.9
    build_shell(st, W, D, H, open_sides=("south", "east"), back_material="mat_wall_dark")
    build_environment(st, sky_top=(0.086, 0.098, 0.129), sky_horizon=(0.149, 0.145, 0.153),
                      energy=0.38)

    st.s.node("Studio", "Node3D", ".")

    # The desk is the diagonal. Rotated ~34 deg, sitting away from both walls,
    # so the camera sees its end first and the wall behind it recedes.
    DESK_ROT = 34.0
    desk_center = (-0.35, 0, 0.15)
    build_desk(st, "Studio", center=desk_center, width=2.5, depth=0.8,
               rotation_y=DESK_ROT)

    y = desk_surface_y()

    def on_desk(u: float, v: float):
        """Local desk coords (u along width, v along depth) -> world."""
        a = math.radians(DESK_ROT)
        return (desk_center[0] + u * math.cos(a) + v * math.sin(a),
                y,
                desk_center[2] - u * math.sin(a) + v * math.cos(a))

    # Display sits on the desk, angled with it — not square to camera.
    dx, _, dz = on_desk(-0.42, -0.24)
    add_display(st, "PrimaryDisplay", "Studio", width=1.04,
                at=(dx, y, dz), yaw=DESK_ROT + 4)

    hx, _, hz = on_desk(0.52, 0.06)
    st.kit("Headphones", "Studio", "headphones", fit_scale("headphones", "x", 0.20),
           rot=(0, DESK_ROT - 40, 0), anchor=("center", "min", "center"), at=(hx, y, hz))
    bx, _, bz = on_desk(0.90, -0.16)
    st.kit("BooksDesk", "Studio", "books", fit_scale("books", "x", 0.28),
           rot=(0, DESK_ROT + 12, 0), anchor=("center", "min", "center"), at=(bx, y, bz))
    cx, _, cz = on_desk(0.18, 0.16)
    st.kit("CircuitBoard", "Studio", "circuit-board", fit_scale("circuit-board", "x", 0.32),
           rot=(-90, DESK_ROT - 18, 0), anchor=("center", "min", "center"), at=(cx, y, cz))

    # Chair completes the diagonal, angled away as if pushed back.
    chx, _, chz = on_desk(-0.30, 1.40)
    st.kit("Chair", "Studio", "chair", fit_scale("chair", "y", 0.94),
           rot=(0, DESK_ROT + 176, 0), anchor=("center", "min", "center"), at=(chx, 0, chz))

    # --- background wall (-Z): the research surface, seen past the desk -----
    wall_z = -D / 2
    cork_scale = fit_scale("corkboard", "x", 1.72)
    st.kit("Corkboard", "Studio", "corkboard", cork_scale,
           rot=(0, 0, 0), anchor=("center", "center", "min"), at=(-0.35, 1.56, wall_z + 0.02))
    st.s.node("PinnedSheets", "Node3D", "Studio")
    for i, (px, py, pw, ph, prot, mat) in enumerate([
        (1.02, 1.94, 0.52, 0.38, 1.4, "mat_surface_secondary"),
        (1.08, 1.44, 0.28, 0.34, -2.0, "mat_paper"),
        (1.52, 1.74, 0.24, 0.30, 0.9, "mat_paper_warm"),
        (-1.62, 1.86, 0.34, 0.26, -1.1, "mat_paper"),
    ]):
        st.quad(f"Sheet{i}", "Studio/PinnedSheets", (pw, ph),
                (px, py, wall_z + 0.012), mat, rotation=(0, 0, prot))

    # --- west wall: low storage, gives the diagonal something to cut across --
    st.kit("Bookcase", "Studio", "bookcase-low", fit_scale("bookcase-low", "y", 0.88),
           rot=(0, 90, 0), anchor=("center", "min", "max"), at=(-W / 2 + 0.14, 0, -0.55))
    st.kit("BooksShelf", "Studio", "books", fit_scale("books", "x", 0.30),
           rot=(0, 84, 0), anchor=("center", "min", "center"), at=(-2.62, 0.88, -1.24))
    st.kit("PlantShelf", "Studio", "plant-small", fit_scale("plant-small", "y", 0.26),
           rot=(0, 0, 0), anchor=("center", "min", "center"), at=(-2.72, 0.88, -0.66))

    # --- foreground anchor: speaker on a crate, closest to camera -----------
    st.box("Crate", "Studio", (0.52, 0.44, 0.46), (1.68, 0.22, 1.72), "mat_desk_top")
    st.kit("SpeakerFore", "Studio", "speaker-small", fit_scale("speaker-small", "y", 0.42),
           rot=(0, -122, 0), anchor=("center", "min", "center"), at=(1.68, 0.44, 1.72))
    st.kit("SpeakerBack", "Studio", "speaker-small", fit_scale("speaker-small", "y", 0.34),
           rot=(0, 52, 0), anchor=("center", "min", "center"), at=(-2.62, 0.88, -1.00))

    st.box("Rug", "Studio", (3.1, 0.012, 2.3), (-0.20, 0.006, 0.45), "mat_rug")

    # --- lighting -----------------------------------------------------------
    st.s.node("Lighting", "Node3D", ".")

    # Fixture on a floor stand, raking along the diagonal from the far corner.
    st.box("StandPole", "Lighting", (0.05, 2.18, 0.05), (-1.98, 1.09, 1.98), "mat_metal_dark")
    st.box("StandFoot", "Lighting", (0.46, 0.04, 0.46), (-1.98, 0.02, 1.98), "mat_metal_dark")
    st.kit("SpotFixture", "Lighting", "spotlight", fit_scale("spotlight", "y", 0.66),
           rot=(-34, 124, 0), anchor=("center", "max", "center"), at=(-1.92, 2.18, 1.94))
    add_spot(st, "SpotKey", "Lighting", (-1.86, 2.10, 1.88), (-30, 122, 0),
             energy=11.0, color_rgb=(1.0, 0.878, 0.714), range_m=9.0, angle=32.0,
             angle_attenuation=0.8)

    add_practical_light(st, "DeskPractical", "Lighting", (-0.30, 1.62, 0.30),
                        energy=3.0, color_rgb=(1.0, 0.839, 0.651), range_m=3.4,
                        attenuation=1.6)
    add_practical_light(st, "ScreenBounce", "Lighting", (dx + 0.18, y + 0.34, dz + 0.26),
                        energy=1.15, color_rgb=(0.565, 0.690, 0.859), range_m=1.9,
                        shadow=False, attenuation=2.0, specular=0.2)
    st.s.node("Fill", "DirectionalLight3D", "Lighting",
              position=(2.8, 2.6, 2.8), rotation=(-22, 152, 0), props={
                  "light_color": color((0.604, 0.686, 0.855)),
                  "light_energy": "0.34",
                  "light_specular": "0.15",
                  "shadow_enabled": "false",
              })

    add_cameras(st,
                canonical=dict(eye=(2.34, 1.42, 2.52), target=(-0.88, 1.06, -1.30), fov=50),
                secondary=dict(eye=(-2.35, 1.80, 2.95), target=(0.45, 0.95, -1.60), fov=54))
    return st


# ---------------------------------------------------------------------------
# STUDY C — WORKSPACE + PRESENTATION PLANE
# ---------------------------------------------------------------------------

def study_c():
    st = Study("RoomStudy_C_PresentationPlane")
    register_materials(st)

    # Longer room: the working nucleus is compressed at one end, the
    # presentation wall sits at the other. One space, two pressures.
    W, D, H = 5.2, 7.0, 3.25
    build_shell(st, W, D, H, open_sides=("south",), back_material="mat_wall")
    build_environment(st, sky_top=(0.075, 0.086, 0.118), sky_horizon=(0.133, 0.133, 0.145),
                      energy=0.32, fog=True)

    st.s.node("Nucleus", "Node3D", ".")
    st.s.node("Presentation", "Node3D", ".")

    wall_z = -D / 2

    # --- the presentation plane: a built, slightly proud wall panel ---------
    # Deliberately large and mostly empty. This is the surface reserved for
    # finished work; it earns its dominance by scale, not by content.
    st.box("PlanePanel", "Presentation", (4.3, 2.35, 0.08), (0.0, 1.62, wall_z + 0.06),
           "mat_wall_dark")
    st.quad("ContentPlane", "Presentation", (4.06, 2.14), (0.0, 1.62, wall_z + 0.105),
            "mat_surface_secondary")
    # A thin reveal strip above and below reads as a mounting detail and gives
    # the plane an edge to catch the wash light.
    st.box("PlaneReveal", "Presentation", (4.3, 0.025, 0.11), (0.0, 2.83, wall_z + 0.07),
           "mat_metal_dark")
    st.box("PlaneSkirt", "Presentation", (4.3, 0.025, 0.11), (0.0, 0.42, wall_z + 0.07),
           "mat_metal_dark")

    # Printed contact sheet leaning at the base — work in transit to the wall.
    st.quad("LeaningPrintA", "Presentation", (0.62, 0.86), (-1.52, 0.44, wall_z + 0.34),
            "mat_surface_print", rotation=(-9, 3, 0))
    st.quad("LeaningPrintB", "Presentation", (0.48, 0.66), (-1.12, 0.34, wall_z + 0.40),
            "mat_paper_warm", rotation=(-12, -6, 0))

    # --- the working nucleus, compressed into the near corner ---------------
    DESK_ROT = -18.0
    desk_center = (-0.72, 0, 2.05)
    build_desk(st, "Nucleus", center=desk_center, width=2.3, depth=0.76,
               rotation_y=DESK_ROT)

    y = desk_surface_y()

    def on_desk(u: float, v: float):
        a = math.radians(DESK_ROT)
        return (desk_center[0] + u * math.cos(a) + v * math.sin(a),
                y,
                desk_center[2] - u * math.sin(a) + v * math.cos(a))

    dx, _, dz = on_desk(-0.30, -0.22)
    add_display(st, "PrimaryDisplay", "Nucleus", width=1.0,
                at=(dx, y, dz), yaw=DESK_ROT + 6)

    hx, _, hz = on_desk(0.46, 0.08)
    st.kit("Headphones", "Nucleus", "headphones", fit_scale("headphones", "x", 0.20),
           rot=(0, DESK_ROT + 34, 0), anchor=("center", "min", "center"), at=(hx, y, hz))
    bx, _, bz = on_desk(0.84, -0.14)
    st.kit("BooksDesk", "Nucleus", "books", fit_scale("books", "x", 0.27),
           rot=(0, DESK_ROT - 10, 0), anchor=("center", "min", "center"), at=(bx, y, bz))
    cx, _, cz = on_desk(0.10, 0.18)
    st.kit("CircuitBoard", "Nucleus", "circuit-board", fit_scale("circuit-board", "x", 0.30),
           rot=(-90, DESK_ROT + 22, 0), anchor=("center", "min", "center"), at=(cx, y, cz))

    chx, _, chz = on_desk(-0.16, 1.16)
    st.kit("Chair", "Nucleus", "chair", fit_scale("chair", "y", 0.94),
           rot=(0, DESK_ROT + 184, 0), anchor=("center", "min", "center"), at=(chx, 0, chz))

    # Corkboard rides the side wall beside the desk: research stays attached
    # to the working nucleus, not to the presentation wall.
    st.kit("Corkboard", "Nucleus", "corkboard", fit_scale("corkboard", "x", 1.12),
           rot=(0, 90, 0), anchor=("min", "center", "center"), at=(-W / 2 + 0.03, 1.58, 1.95))
    st.s.node("PinnedSheets", "Node3D", "Nucleus")
    for i, (pz, py, pw, ph, prot, mat) in enumerate([
        (2.82, 1.78, 0.34, 0.26, 1.6, "mat_paper"),
        (2.78, 1.42, 0.22, 0.28, -1.2, "mat_surface_print"),
    ]):
        st.quad(f"Sheet{i}", "Nucleus/PinnedSheets", (pw, ph),
                (-W / 2 + 0.035, py, pz), mat, rotation=(0, 90, prot))

    spx, _, spz = on_desk(-1.02, -0.10)
    st.kit("SpeakerDesk", "Nucleus", "speaker-small", fit_scale("speaker-small", "y", 0.32),
           rot=(0, DESK_ROT - 46, 0), anchor=("center", "min", "center"), at=(spx, y, spz))
    st.kit("Bookcase", "Nucleus", "bookcase-low", fit_scale("bookcase-low", "y", 0.86),
           rot=(0, 0, 0), anchor=("center", "min", "max"), at=(1.62, 0, 2.92))
    st.kit("PlantShelf", "Nucleus", "plant-small", fit_scale("plant-small", "y", 0.24),
           rot=(0, 0, 0), anchor=("center", "min", "center"), at=(1.62, 0.86, 2.74))
    st.kit("BooksShelf", "Nucleus", "books", fit_scale("books", "x", 0.28),
           rot=(0, -14, 0), anchor=("center", "min", "center"), at=(1.28, 0.86, 2.80))

    st.box("Rug", "Nucleus", (2.9, 0.012, 2.1), (-0.42, 0.006, 2.35), "mat_rug")

    # Mid-room: a low bench keeps the middle from reading as empty floor and
    # gives the eye a step between nucleus and plane.
    st.box("Bench", "Presentation", (1.5, 0.42, 0.44), (1.18, 0.21, -0.55), "mat_desk_top")
    st.kit("SpeakerBench", "Presentation", "speaker-small", fit_scale("speaker-small", "y", 0.40),
           rot=(0, -158, 0), anchor=("center", "min", "center"), at=(1.30, 0.42, -0.55))

    # --- lighting -----------------------------------------------------------
    st.s.node("Lighting", "Node3D", ".")

    # The fixture hangs mid-room and washes the presentation plane. This is
    # the gesture: production equipment lighting a gallery surface.
    st.box("HangRod", "Lighting", (0.035, 0.62, 0.035), (-1.42, 2.94, -1.12), "mat_metal_dark")
    st.kit("SpotFixture", "Lighting", "spotlight", fit_scale("spotlight", "y", 0.72),
           rot=(-44, 26, 0), anchor=("center", "max", "center"), at=(-1.42, 2.64, -1.12))
    add_spot(st, "SpotKey", "Lighting", (-1.40, 2.54, -1.18), (-42, 24, 0),
             energy=14.0, color_rgb=(1.0, 0.882, 0.722), range_m=8.5, angle=34.0,
             angle_attenuation=0.85)

    # Grazing wash so the big plane has a gradient instead of a flat field.
    add_spot(st, "PlaneWash", "Lighting", (-1.55, 2.92, wall_z + 0.95), (-62, 22, 0),
             energy=5.0, color_rgb=(0.902, 0.898, 0.937), range_m=5.0, angle=42.0,
             angle_attenuation=1.2, shadow=False)

    add_practical_light(st, "DeskPractical", "Lighting", (-0.72, 1.58, 2.15),
                        energy=3.2, color_rgb=(1.0, 0.824, 0.627), range_m=3.3,
                        attenuation=1.6)
    add_practical_light(st, "ScreenBounce", "Lighting", (dx + 0.10, y + 0.32, dz + 0.28),
                        energy=1.1, color_rgb=(0.573, 0.694, 0.867), range_m=1.8,
                        shadow=False, attenuation=2.0, specular=0.2)
    st.s.node("Fill", "DirectionalLight3D", "Lighting",
              position=(2.2, 2.8, 3.4), rotation=(-26, 160, 0), props={
                  "light_color": color((0.588, 0.671, 0.843)),
                  "light_energy": "0.28",
                  "light_specular": "0.12",
                  "shadow_enabled": "false",
              })

    add_cameras(st,
                canonical=dict(eye=(2.02, 1.56, 3.90), target=(-0.55, 1.34, -2.90), fov=52),
                secondary=dict(eye=(-1.80, 1.70, 0.65), target=(0.85, 1.32, -3.10), fov=50))
    return st


# ---------------------------------------------------------------------------
# switcher scene
# ---------------------------------------------------------------------------

def build_switcher():
    from roomkit import Scene
    sc = Scene("StudySwitcher", "Node")
    rid = sc.ext_res("Script", "res://scripts/study_switcher.gd")
    sc.props.append(f'script = ExtResource("{rid}")')
    return sc


# ---------------------------------------------------------------------------

def main():
    outputs = [
        (study_a(), "scenes/RoomStudy_A_WorkWall.tscn"),
        (study_b(), "scenes/RoomStudy_B_DiagonalStudio.tscn"),
        (study_c(), "scenes/RoomStudy_C_PresentationPlane.tscn"),
    ]

    failed = False
    for st, path in outputs:
        st.s.write(path)
        errs = validate_tscn(path)
        status = "OK" if not errs else "ERRORS"
        print(f"\n{'=' * 78}\n{path}   [{status}]\n{'=' * 78}")
        for e in errs:
            failed = True
            print(f"  !! {e}")
        for cam in ("Canonical", "Secondary"):
            print(f"\n{frame_report(st, cam)}")

    sw = build_switcher()
    sw.write("scenes/StudySwitcher.tscn")
    errs = validate_tscn("scenes/StudySwitcher.tscn")
    print(f"\nscenes/StudySwitcher.tscn   [{'OK' if not errs else 'ERRORS'}]")
    for e in errs:
        failed = True
        print(f"  !! {e}")

    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
