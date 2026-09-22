#!/usr/bin/env python3
"""
preview_studies.py — composition previews rendered straight from the .tscn data.

These are NOT the deliverable screenshots. Godot is not installed in this
environment, so this draws each study's real geometry through each study's real
camera to check composition, occlusion and balance while authoring.

What it shows faithfully:
  - camera position, orientation and FOV
  - every object's true world-space footprint
  - depth ordering and overlap
  - where the reserved portfolio surfaces land in frame

What it does NOT show:
  - lighting, shadows, materials, tonemapping

Output: previews/<study>_<camera>.png

Run:  python3 tools/preview_studies.py
"""

import math
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import build_studies  # noqa: E402
from roomkit import REPO, basis_yxz  # noqa: E402

W, H = 1280, 720
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

# Role-based colouring so hierarchy is legible at a glance.
ROLE_COLORS = {
    "shell": "#3a3a3e",
    "desk": "#8a6a3f",
    "kit": "#b8b2a4",
    "hero": "#f2e4c4",
    "surface": "#4fa3d1",
    "light": "#e8b45c",
}

HERO = {"PrimaryDisplay", "Corkboard", "SpotFixture", "Chair"}
DESKISH = {"Top", "LegLF", "LegLB", "LegRF", "LegRB", "WallShelf", "Crate",
           "Bench", "PlanePanel", "Rug", "StandPole", "StandFoot", "HangRod",
           "PlaneReveal", "PlaneSkirt", "WallShelfBracketL", "WallShelfBracketR"}


def role_of(item):
    n = item["name"]
    if item["kind"] == "surface":
        return "surface"
    if n in HERO:
        return "hero"
    if n in DESKISH:
        return "desk"
    if item["kind"] == "shell":
        return "shell"
    return "kit"


def project(cam, aspect):
    eye, yaw, pitch, fov = cam["eye"], cam["yaw"], cam["pitch"], cam["fov"]
    b = basis_yxz(pitch, yaw, 0)
    right = (b[0][0], b[1][0], b[2][0])
    up = (b[0][1], b[1][1], b[2][1])
    fwd = (-b[0][2], -b[1][2], -b[2][2])
    tan_v = math.tan(math.radians(fov / 2))

    def to_screen(p):
        d = [p[i] - eye[i] for i in range(3)]
        z = sum(d[i] * fwd[i] for i in range(3))
        if z <= 0.02:
            return None
        hh = z * tan_v
        hw = hh * aspect
        nx = sum(d[i] * right[i] for i in range(3)) / hw
        ny = sum(d[i] * up[i] for i in range(3)) / hh
        return ((nx + 1) * 0.5 * W, (1 - ny) * 0.5 * H, z)

    return to_screen


EDGES = [(0, 1), (0, 2), (0, 4), (1, 3), (1, 5), (2, 3), (2, 6),
         (3, 7), (4, 5), (4, 6), (5, 7), (6, 7)]

# Box faces as corner-index quads, for solid shading.
FACES = [(0, 1, 3, 2), (4, 5, 7, 6), (0, 1, 5, 4),
         (2, 3, 7, 6), (0, 2, 6, 4), (1, 3, 7, 5)]


def _shade(hex_color, factor):
    r = int(hex_color[1:3], 16)
    g = int(hex_color[3:5], 16)
    b = int(hex_color[5:7], 16)
    r = max(0, min(255, int(r * factor)))
    g = max(0, min(255, int(g * factor)))
    b = max(0, min(255, int(b * factor)))
    return f"#{r:02x}{g:02x}{b:02x}"


def draw(study, cam_name, out_path, title):
    """Painter's-algorithm solid render of the study's real AABBs."""
    cam = study.cameras[cam_name]
    to_screen = project(cam, W / H)

    faces = []
    for item in study.s.placed:
        lo, hi = item["aabb"]
        pts = []
        ok = True
        for c in range(8):
            p = [hi[i] if (c >> i) & 1 else lo[i] for i in range(3)]
            sp = to_screen(p)
            if sp is None:
                ok = False
                break
            pts.append(sp)
        if not ok:
            continue
        role = role_of(item)
        # Skip the shell's own far faces so we see into the room.
        for fi, quad in enumerate(FACES):
            zs = [pts[i][2] for i in quad]
            depth = sum(zs) / 4
            faces.append((depth, role, item, [pts[i] for i in quad], fi))

    faces.sort(key=lambda t: -t[0])

    lines = [f'-size {W}x{H} xc:#0e0d10', f"-font '{FONT}'"]
    for depth, role, item, quad, fi in faces:
        base = ROLE_COLORS[role]
        # Cheap directional shading by face orientation.
        shade = [0.55, 0.95, 0.72, 0.72, 0.62, 0.86][fi]
        if role == "shell":
            shade *= 0.55
        fill = _shade(base, shade)
        alpha = {"shell": 0.85, "surface": 1.0}.get(role, 1.0)
        pts = " ".join(f"{x:.1f},{y:.1f}" for x, y, _ in quad)
        stroke = _shade(base, shade * 0.6)
        lines.append(f"-fill '{fill}' -stroke '{stroke}' -strokewidth 0.6 "
                     f"-draw 'polygon {pts}'")

    # labels
    lines.append("-stroke none -fill '#efe9dc' -pointsize 13")
    seen = set()
    for depth, role, item, quad, fi in sorted(faces, key=lambda t: t[0]):
        if role not in ("surface", "hero") or item["name"] in seen:
            continue
        seen.add(item["name"])
        cx = sum(q[0] for q in quad) / 4
        cy = sum(q[1] for q in quad) / 4
        if 10 < cx < W - 10 and 10 < cy < H - 10:
            lines.append(f"-draw \"text {cx - 30:.0f},{cy:.0f} '{item['name']}'\"")

    lines.append("-stroke none -fill '#9a958a' -pointsize 17 "
                 f"-draw \"text 20,30 '{title}'\"")
    lines.append("-fill '#5a574f' -pointsize 12 "
                 f"-draw \"text 20,{H - 16} "
                 "'solid AABB preview — real geometry + real camera, no lighting or materials'\"")
    lines.append(f"'{out_path}'")

    script = os.path.join("/tmp", "im_script.sh")
    with open(script, "w") as fh:
        fh.write("convert \\\n  " + " \\\n  ".join(lines) + "\n")
    subprocess.run(["bash", script], check=True)
    return out_path


def main():
    out_dir = os.path.join(REPO, "previews")
    os.makedirs(out_dir, exist_ok=True)

    studies = [
        (build_studies.study_a(), "A_WorkWall", "ROOM STUDY A — WORK WALL"),
        (build_studies.study_b(), "B_DiagonalStudio", "ROOM STUDY B — DIAGONAL STUDIO"),
        (build_studies.study_c(), "C_PresentationPlane", "ROOM STUDY C — PRESENTATION PLANE"),
    ]
    made = []
    for st, slug, title in studies:
        for cam in ("Canonical", "Secondary"):
            path = os.path.join(out_dir, f"{slug}_{cam}.png")
            draw(st, cam, path, f"{title}   [{cam.lower()} camera]")
            made.append(path)
            print(f"  wrote {os.path.relpath(path, REPO)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
