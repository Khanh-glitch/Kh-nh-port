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

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import build_studies  # noqa: E402
from roomkit import REPO, basis_yxz  # noqa: E402

W, H = 1280, 720

# Depth bias, in metres, for reserved content planes. They sit millimetres
# proud of a screen face, but the host display is drawn here as a solid AABB
# whose front is set by the stand foot -- and, for a rotated display, by the
# corner of the bounding box rather than the glass. Without this the z-buffer
# hides each plane inside its own host. Real meshes need no such bias; this is
# an artifact of previewing boxes instead of triangles. It stays well below
# the distance from any content plane to the nearest unrelated object.
DECAL_BIAS = 0.32
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


# Box faces as corner-index quads, wound so the normal points outward.
FACES = [(0, 2, 3, 1), (4, 5, 7, 6), (0, 1, 5, 4),
         (2, 6, 7, 3), (0, 4, 6, 2), (1, 3, 7, 5)]


def _rgb(hex_color, factor):
    r = int(hex_color[1:3], 16) * factor
    g = int(hex_color[3:5], 16) * factor
    b = int(hex_color[5:7], 16) * factor
    return (max(0.0, min(255.0, r)),
            max(0.0, min(255.0, g)),
            max(0.0, min(255.0, b)))


def draw(study, cam_name, out_path, title):
    """Z-buffered solid render of the study's real AABBs.

    A true per-pixel depth buffer, not a painter's sort: averaging a face's
    depth makes a large wall quad beat a small board lying flat against it,
    which silently hid Study B's corkboard behind its own wall.
    """
    cam = study.cameras[cam_name]
    eye = cam["eye"]
    to_screen = project(cam, W / H)

    color = np.zeros((H, W, 3), dtype=np.float32)
    color[:, :] = _rgb("#0e0d10", 1.0)
    zbuf = np.full((H, W), np.inf, dtype=np.float32)

    xx = np.arange(W, dtype=np.float32)[None, :]
    yy = np.arange(H, dtype=np.float32)[:, None]

    def tri(p0, p1, p2, rgb, bias=0.0):
        """Rasterise one triangle with perspective-correct depth."""
        minx = max(int(math.floor(min(p0[0], p1[0], p2[0]))), 0)
        maxx = min(int(math.ceil(max(p0[0], p1[0], p2[0]))), W - 1)
        miny = max(int(math.floor(min(p0[1], p1[1], p2[1]))), 0)
        maxy = min(int(math.ceil(max(p0[1], p1[1], p2[1]))), H - 1)
        if minx > maxx or miny > maxy:
            return
        area = ((p1[0] - p0[0]) * (p2[1] - p0[1])
                - (p2[0] - p0[0]) * (p1[1] - p0[1]))
        if abs(area) < 1e-9:
            return
        sx = xx[:, minx:maxx + 1]
        sy = yy[miny:maxy + 1, :]
        w0 = ((p1[0] - p0[0]) * (sy - p0[1]) - (sx - p0[0]) * (p1[1] - p0[1])) / area
        w1 = ((sx - p0[0]) * (p2[1] - p0[1]) - (p2[0] - p0[0]) * (sy - p0[1])) / area
        w2 = 1.0 - w0 - w1
        inside = (w0 >= -1e-6) & (w1 >= -1e-6) & (w2 >= -1e-6)
        if not inside.any():
            return
        # Interpolate 1/z linearly in screen space, then invert.
        inv = w2 / p0[2] + w1 / p1[2] + w0 / p2[2]
        inv = np.where(inv <= 1e-9, 1e-9, inv)
        depth = (1.0 / inv).astype(np.float32) - bias
        sub_z = zbuf[miny:maxy + 1, minx:maxx + 1]
        win = inside & (depth < sub_z)
        if not win.any():
            return
        sub_z[win] = depth[win]
        sub_c = color[miny:maxy + 1, minx:maxx + 1]
        sub_c[win] = rgb

    order = []
    for item in study.s.placed:
        lo, hi = item["aabb"]
        pts3 = []
        pts2 = []
        ok = True
        for c in range(8):
            p = [hi[i] if (c >> i) & 1 else lo[i] for i in range(3)]
            sp = to_screen(p)
            if sp is None:
                ok = False
                break
            pts3.append(p)
            pts2.append(sp)
        if not ok:
            continue
        role = role_of(item)
        base = ROLE_COLORS[role]
        for fi, quad in enumerate(FACES):
            a, b_, c_, d = (pts3[i] for i in quad)
            # Outward normal of this face.
            u = [b_[i] - a[i] for i in range(3)]
            v = [d[i] - a[i] for i in range(3)]
            n = (u[1] * v[2] - u[2] * v[1],
                 u[2] * v[0] - u[0] * v[2],
                 u[0] * v[1] - u[1] * v[0])
            centre = [(a[i] + c_[i]) * 0.5 for i in range(3)]
            view = [eye[i] - centre[i] for i in range(3)]
            facing = sum(n[i] * view[i] for i in range(3))
            # Backface cull, except for the shell: we look in through its walls.
            if facing <= 0 and role != "shell":
                continue
            nl = math.sqrt(sum(k * k for k in n)) or 1.0
            ndot = abs(n[1] / nl)
            shade = 0.58 + 0.42 * ndot
            if role == "shell":
                shade *= 0.5
            if facing <= 0:
                shade *= 0.72
            q = [pts2[i] for i in quad]
            rgb = _rgb(base, shade)
            tri(q[0], q[1], q[2], rgb, DECAL_BIAS if role == "surface" else 0.0)
            tri(q[0], q[2], q[3], rgb, DECAL_BIAS if role == "surface" else 0.0)
            if role in ("surface", "hero"):
                zc = sum(p[2] for p in q) / 4
                cx = sum(p[0] for p in q) / 4
                cy = sum(p[1] for p in q) / 4
                order.append((zc, item["name"], cx, cy, facing))

    png = out_path.replace(".png", ".ppm")
    img = np.clip(color, 0, 255).astype(np.uint8)
    with open(png, "wb") as fh:
        fh.write(b"P6\n%d %d\n255\n" % (W, H))
        fh.write(img.tobytes())

    # Label each named object once, at its nearest front-facing quad.
    seen = {}
    for zc, name, cx, cy, facing in sorted(order, key=lambda t: t[0]):
        if name in seen or facing <= 0:
            continue
        if 12 < cx < W - 12 and 12 < cy < H - 12:
            seen[name] = (cx, cy)

    lines = [f"'{png}'", f"-font '{FONT}'", "-stroke none"]
    for name, (cx, cy) in seen.items():
        lines.append("-fill '#12100d' -pointsize 13 "
                     f"-draw \"text {cx - 29:.0f},{cy + 1:.0f} '{name}'\"")
        lines.append("-fill '#f4eee2' -pointsize 13 "
                     f"-draw \"text {cx - 30:.0f},{cy:.0f} '{name}'\"")
    lines.append("-fill '#b9b3a6' -pointsize 17 "
                 f"-draw \"text 20,30 '{title}'\"")
    lines.append("-fill '#5a574f' -pointsize 12 "
                 f"-draw \"text 20,{H - 16} "
                 "'z-buffered AABB preview — real geometry + real camera, no lighting or materials'\"")
    lines.append(f"'{out_path}'")

    script = os.path.join("/tmp", "im_script.sh")
    with open(script, "w") as fh:
        fh.write("convert \\\n  " + " \\\n  ".join(lines) + "\n")
    subprocess.run(["bash", script], check=True)
    os.remove(png)
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
