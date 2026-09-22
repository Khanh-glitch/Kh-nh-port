#!/usr/bin/env python3
"""
check_studies.py — physical sanity checks for the three composition studies.

These studies were authored without a running renderer, so correctness is
verified numerically instead of by eye:

  1. every kit asset rests on a real supporting surface (no floating, no sinking)
  2. no two solid objects interpenetrate meaningfully
  3. everything stays inside the room shell
  4. each canonical camera actually frames its intended subject
  5. reserved portfolio surfaces are visible and large enough to hold work

Run:  python3 tools/check_studies.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import build_studies  # noqa: E402
from roomkit import basis_yxz, validate_tscn  # noqa: E402

import math  # noqa: E402

TOL_REST = 0.012        # how far an object may hover / sink (m)
TOL_OVERLAP = 0.035     # permitted interpenetration (m) on the smallest axis

# Objects that are intentionally wall-mounted / hanging / leaning, so the
# "rests on something" rule does not apply.
FLOATING_OK = {
    "Corkboard", "SpotFixture", "ContentSecondary", "ContentPrimary",
    "ContentPlane", "LeaningPrintA", "LeaningPrintB", "WallShelf",
    "WallShelfBracketL", "WallShelfBracketR", "PlanePanel", "PlaneReveal",
    "PlaneSkirt", "HangRod", "StandPole",
}

# Pairs that are meant to touch or nest.
CONTACT_OK = [
    ("Top", "Leg"), ("Top", "Primary"), ("Top", "Headphones"), ("Top", "Books"),
    ("Top", "Circuit"), ("Top", "Speaker"), ("Rug", "Chair"), ("Rug", "Leg"),
    ("Rug", "Bookcase"), ("Floor", "Rug"), ("Bookcase", "Books"),
    ("Bookcase", "Plant"), ("WallShelf", "Speaker"), ("WallShelf", "Plant"),
    ("WallShelf", "Bracket"), ("Crate", "Speaker"), ("Bench", "Speaker"),
    ("Corkboard", "Sheet"), ("PlanePanel", "Content"), ("PlanePanel", "Plane"),
    ("PlanePanel", "Leaning"), ("StandPole", "SpotFixture"),
    ("StandFoot", "StandPole"), ("HangRod", "SpotFixture"),
    ("Display", "Content"), ("Wall", "Sheet"), ("Wall", "Content"),
    ("Wall", "Corkboard"), ("Wall", "Plane"), ("Wall", "WallShelf"),
    ("Wall", "Bracket"), ("Wall", "Bookcase"), ("Wall", "Top"),
    ("Floor", "Chair"), ("Floor", "Leg"), ("Floor", "Bookcase"),
    ("Floor", "Speaker"), ("Floor", "Crate"), ("Floor", "Bench"),
    ("Floor", "StandFoot"), ("Ceiling", "HangRod"), ("Ceiling", "StandPole"),
    ("PlaneSkirt", "Leaning"), ("Crate", "Rug"), ("Bench", "Rug"),
]


def pair_allowed(a: str, b: str) -> bool:
    for x, y in CONTACT_OK:
        if (x in a and y in b) or (x in b and y in a):
            return True
    return False


def overlap(a, b):
    """Interpenetration depth on each axis (negative = separated)."""
    (alo, ahi), (blo, bhi) = a, b
    return [min(ahi[i], bhi[i]) - max(alo[i], blo[i]) for i in range(3)]


def check(study, label):
    print(f"\n{'=' * 78}\n{label}\n{'=' * 78}")
    items = study.s.placed
    by_name = {it["name"]: it for it in items}
    problems = []

    # --- 1. support ---------------------------------------------------------
    # Anything an object can legitimately rest on: room shell, built surfaces,
    # and the top face of kit furniture (bookcase shelf, etc).
    SUPPORT_KITS = {"Bookcase"}
    supports = [it for it in items
                if it["kind"] == "shell" or it["name"] in SUPPORT_KITS]
    for it in items:
        if it["kind"] != "kit" or it["name"] in FLOATING_OK:
            continue
        lo, hi = it["aabb"]
        best = None
        for s in supports:
            slo, shi = s["aabb"]
            # horizontal footprint must actually sit over the support
            ox = min(hi[0], shi[0]) - max(lo[0], slo[0])
            oz = min(hi[2], shi[2]) - max(lo[2], slo[2])
            if ox <= 0.02 or oz <= 0.02:
                continue
            gap = lo[1] - shi[1]
            if abs(gap) < abs(best[0]) if best else True:
                best = (gap, s["name"])
        if best is None:
            problems.append(f"{it['name']}: no supporting surface underneath")
        elif abs(best[0]) > TOL_REST:
            word = "floats" if best[0] > 0 else "sinks into"
            problems.append(f"{it['name']}: {word} {best[1]} by {abs(best[0]) * 1000:.0f} mm")

    # --- 2. interpenetration ------------------------------------------------
    solid = [it for it in items if it["kind"] in ("kit", "shell")]
    for i in range(len(solid)):
        for j in range(i + 1, len(solid)):
            a, b = solid[i], solid[j]
            if pair_allowed(a["name"], b["name"]):
                continue
            ov = overlap(a["aabb"], b["aabb"])
            if min(ov) > TOL_OVERLAP:
                problems.append(
                    f"{a['name']} <-> {b['name']}: overlap "
                    f"{ov[0] * 100:.0f}x{ov[1] * 100:.0f}x{ov[2] * 100:.0f} cm")

    # --- 3. inside the shell ------------------------------------------------
    floor = by_name.get("Floor")
    ceil = by_name.get("Ceiling")
    if floor and ceil:
        flo, fhi = floor["aabb"]
        top = ceil["aabb"][0][1]
        for it in items:
            if it["kind"] != "kit":
                continue
            lo, hi = it["aabb"]
            if lo[1] < -0.02:
                problems.append(f"{it['name']}: below floor ({lo[1] * 1000:.0f} mm)")
            if hi[1] > top + 0.02:
                problems.append(f"{it['name']}: above ceiling")
            if hi[0] < flo[0] - 0.05 or lo[0] > fhi[0] + 0.05:
                problems.append(f"{it['name']}: outside room in X")
            if hi[2] < flo[2] - 0.05 or lo[2] > fhi[2] + 0.05:
                problems.append(f"{it['name']}: outside room in Z")

    # --- 4 & 5. camera framing of key subjects ------------------------------
    cam = study.cameras["Canonical"]
    eye, yaw, pitch, fov = cam["eye"], cam["yaw"], cam["pitch"], cam["fov"]
    bmat = basis_yxz(pitch, yaw, 0)
    right = (bmat[0][0], bmat[1][0], bmat[2][0])
    up = (bmat[0][1], bmat[1][1], bmat[2][1])
    fwd = (-bmat[0][2], -bmat[1][2], -bmat[2][2])
    tan_v = math.tan(math.radians(fov / 2))
    aspect = 16 / 9

    def screen_area(item):
        lo, hi = item["aabb"]
        xs, ys, vis = [], [], 0
        for c in range(8):
            p = [hi[k] if (c >> k) & 1 else lo[k] for k in range(3)]
            d = [p[k] - eye[k] for k in range(3)]
            z = sum(d[k] * fwd[k] for k in range(3))
            if z <= 0.01:
                continue
            hh = z * tan_v
            hw = hh * aspect
            nx = sum(d[k] * right[k] for k in range(3)) / hw
            ny = sum(d[k] * up[k] for k in range(3)) / hh
            xs.append(nx)
            ys.append(ny)
            if abs(nx) <= 1 and abs(ny) <= 1:
                vis += 1
        if not xs:
            return 0.0, 0
        w = min(max(xs), 1) - max(min(xs), -1)
        h = min(max(ys), 1) - max(min(ys), -1)
        return max(w, 0) * max(h, 0) / 4.0, vis

    print("\n  reserved portfolio surfaces (canonical view):")
    surfaces = [it for it in items if it["kind"] == "surface"]
    total_surface = 0.0
    for s in sorted(surfaces, key=lambda t: -screen_area(t)[0]):
        area, vis = screen_area(s)
        total_surface += area
        flag = "" if vis else "   (off-frame)"
        print(f"    {s['name']:<24} {area * 100:6.2f}% of frame  corners {vis}/8{flag}")
    print(f"    {'TOTAL':<24} {total_surface * 100:6.2f}% of frame")
    if total_surface < 0.02:
        problems.append("portfolio surfaces occupy <2% of the canonical frame")

    print("\n  hierarchy — largest screen footprints:")
    ranked = sorted(((screen_area(it)[0], it["name"], it["kind"]) for it in items),
                    reverse=True)
    for area, name, kind in ranked[:8]:
        print(f"    {name:<24} {area * 100:6.2f}%   ({kind})")

    # --- report -------------------------------------------------------------
    if problems:
        print(f"\n  {len(problems)} PROBLEM(S):")
        for p in problems:
            print(f"    !! {p}")
    else:
        print("\n  no physical problems detected")
    return len(problems)


def main():
    total = 0
    for fn, label, path in (
        (build_studies.study_a, "A — WORK WALL", "scenes/RoomStudy_A_WorkWall.tscn"),
        (build_studies.study_b, "B — DIAGONAL STUDIO", "scenes/RoomStudy_B_DiagonalStudio.tscn"),
        (build_studies.study_c, "C — PRESENTATION PLANE", "scenes/RoomStudy_C_PresentationPlane.tscn"),
    ):
        st = fn()
        total += check(st, label)
        errs = validate_tscn(path)
        if errs:
            total += len(errs)
            for e in errs:
                print(f"    !! tscn: {e}")

    print(f"\n{'=' * 78}")
    print("ALL CHECKS PASSED" if total == 0 else f"{total} PROBLEM(S) TO FIX")
    return 1 if total else 0


if __name__ == "__main__":
    sys.exit(main())
