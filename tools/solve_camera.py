#!/usr/bin/env python3
"""
solve_camera.py — search for a canonical camera that frames a study's key
elements without clipping.

Authoring cameras by hand is guesswork when there is no renderer running. This
does a coarse grid search over eye position, aim point and FOV, scoring:

  - hard penalty for any "must be in frame" object crossing the frame edge
  - reward for the hero subject occupying a good share of the frame
  - reward for depth spread (foreground / midground / background all present)
  - mild penalty for very wide FOV, which distorts a portfolio view

It prints the best candidates; the chosen values are then written into
build_studies.py by hand so the scene files stay readable.

Run:  python3 tools/solve_camera.py <a|b|c>
"""

import itertools
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import build_studies  # noqa: E402
from roomkit import basis_yxz  # noqa: E402

ASPECT = 16 / 9
MARGIN = 0.94  # normalised frame edge that objects must stay inside


def frame(items, eye, target, fov, names):
    d = [target[i] - eye[i] for i in range(3)]
    yaw = math.degrees(math.atan2(-d[0], -d[2]))
    pitch = math.degrees(math.atan2(d[1], math.hypot(d[0], d[2])))
    b = basis_yxz(pitch, yaw, 0)
    right = (b[0][0], b[1][0], b[2][0])
    up = (b[0][1], b[1][1], b[2][1])
    fwd = (-b[0][2], -b[1][2], -b[2][2])
    tv = math.tan(math.radians(fov / 2))

    out = {}
    for n in names:
        if n not in items:
            continue
        lo, hi = items[n]["aabb"]
        xs, ys, zs = [], [], []
        for c in range(8):
            p = [hi[k] if (c >> k) & 1 else lo[k] for k in range(3)]
            dd = [p[k] - eye[k] for k in range(3)]
            z = sum(dd[k] * fwd[k] for k in range(3))
            if z <= 0.05:
                return None
            hh = z * tv
            hw = hh * ASPECT
            xs.append(sum(dd[k] * right[k] for k in range(3)) / hw)
            ys.append(sum(dd[k] * up[k] for k in range(3)) / hh)
            zs.append(z)
        out[n] = (min(xs), max(xs), min(ys), max(ys), min(zs))
    return out


def search(study, must_fit, hero, eye_grid, target_grid, fov_grid,
           hero_target=0.30, avoid=()):
    """Grid-search cameras.

    `avoid` lists objects that must not loom in the foreground -- a light
    stand between camera and subject reads as a pole through the frame.
    """
    items = {i["name"]: i for i in study.s.placed}
    names = list(set(must_fit) | {hero} | set(avoid))
    results = []

    for eye, target, fov in itertools.product(eye_grid, target_grid, fov_grid):
        r = frame(items, eye, target, fov, names)
        if r is None:
            continue
        penalty = 0.0
        for n in must_fit:
            if n not in r:
                continue
            x0, x1, y0, y1, _ = r[n]
            penalty += (max(0, x1 - MARGIN) + max(0, -MARGIN - x0) +
                        max(0, y1 - MARGIN) + max(0, -MARGIN - y0)) * 12

        # Foreground obstructions: penalise by how much frame they eat and
        # how much nearer they are than the hero.
        hero_depth = r[hero][4] if hero in r else 1e9
        for n in avoid:
            if n not in r:
                continue
            ax0, ax1, ay0, ay1, adepth = r[n]
            if adepth >= hero_depth:
                continue
            a_area = (max(0, min(ax1, 1) - max(ax0, -1))
                      * max(0, min(ay1, 1) - max(ay0, -1)) / 4)
            penalty += a_area * 30

        hx0, hx1, hy0, hy1, _ = r[hero]
        hero_area = max(0, min(hx1, 1) - max(hx0, -1)) * max(0, min(hy1, 1) - max(hy0, -1)) / 4
        penalty += abs(hero_area - hero_target) * 4

        depths = [v[4] for v in r.values()]
        spread = max(depths) - min(depths)
        penalty -= min(spread, 6.0) * 0.08
        penalty += max(0, fov - 46) * 0.05

        results.append((penalty, eye, target, fov, r))

    results.sort(key=lambda t: t[0])
    return results


def report(results, n=3):
    for score, eye, target, fov, r in results[:n]:
        print(f"\n  score {score:.3f}   eye={tuple(round(v, 2) for v in eye)} "
              f"target={tuple(round(v, 2) for v in target)} fov={fov}")
        for name, (x0, x1, y0, y1, z) in sorted(r.items(), key=lambda t: t[1][4]):
            clip = "  CLIPPED" if (x1 > 0.99 or x0 < -0.99 or y1 > 0.99 or y0 < -0.99) else ""
            print(f"    {name:<18} x[{x0:+.2f},{x1:+.2f}] y[{y0:+.2f},{y1:+.2f}] "
                  f"d={z:.2f}{clip}")


def solve_b():
    st = build_studies.study_b()
    print("=== STUDY B — DIAGONAL STUDIO ===")
    res = search(
        st,
        must_fit=["PrimaryDisplay", "ContentPrimary", "Corkboard", "SpotFixture",
                  "Chair", "Top", "Bookcase"],
        hero="ContentPrimary",
        eye_grid=[(x, 1.48, z) for x in (2.3, 2.7, 3.1) for z in (2.6, 3.0, 3.4)],
        target_grid=[(x, 1.05, -1.4) for x in (-0.9, -0.6, -0.3)],
        fov_grid=[46, 50, 54, 58],
        hero_target=0.055,
    )
    report(res)


def solve_b2():
    """Secondary view for B, from the open east side looking back.

    The first hand-authored secondary put the camera behind the light stand,
    so a 2 m pole bisected the frame and the fixture filled a third of it.
    """
    st = build_studies.study_b()
    print("=== STUDY B — SECONDARY ===")
    res = search(
        st,
        must_fit=["PrimaryDisplay", "ContentPrimary", "Corkboard", "Top",
                  "Chair", "Crate"],
        hero="Corkboard",
        # East side, which the shell leaves open: a genuinely different
        # angle from the canonical, and clear of the light stand.
        eye_grid=[(x, 1.58, z) for x in (2.6, 3.2, 3.8)
                  for z in (-0.8, 0.0, 0.8, 1.6)],
        target_grid=[(x, 1.20, z) for x in (-1.4, -1.0, -0.6)
                     for z in (-1.8, -1.2)],
        fov_grid=[46, 50, 54, 58],
        hero_target=0.06,
        avoid=["StandPole", "StandArm", "SpotFixture"],
    )
    report(res)


def solve_c():
    st = build_studies.study_c()
    print("=== STUDY C — PRESENTATION PLANE ===")
    res = search(
        st,
        must_fit=["ContentPlane", "PlanePanel", "ContentPrimary", "SpotFixture",
                  "Bench", "Chair"],
        hero="ContentPlane",
        eye_grid=[(x, 1.55, z) for x in (1.3, 1.7, 2.1) for z in (4.2, 4.8, 5.4)],
        target_grid=[(x, 1.35, -3.2) for x in (-0.9, -0.6, -0.3)],
        fov_grid=[46, 50, 54, 58, 62],
        hero_target=0.16,
    )
    report(res)


def solve_a():
    st = build_studies.study_a()
    print("=== STUDY A — WORK WALL ===")
    res = search(
        st,
        must_fit=["PrimaryDisplay", "ContentPrimary", "Corkboard",
                  "ContentSecondary", "SpotFixture", "Chair"],
        hero="ContentPrimary",
        eye_grid=[(x, 1.46, z) for x in (1.5, 1.78, 2.0) for z in (2.2, 2.4, 2.7)],
        target_grid=[(x, 1.2, -2.1) for x in (-0.3, -0.18, 0.0)],
        fov_grid=[44, 47, 50],
        hero_target=0.05,
    )
    report(res)


def solve_c2():
    """Secondary for C: an oblique read of the plane, not a face-on crop.

    The hand-authored one sat ~2 m from a 4 m plane, so the plane overflowed
    the frame and the hanging fixture masked the corner.
    """
    st = build_studies.study_c()
    print("=== STUDY C — SECONDARY ===")
    res = search(
        st,
        must_fit=["ContentPlane", "PlanePanel", "Bench", "Top",
                  "PrimaryDisplay", "Corkboard"],
        hero="ContentPlane",
        # South-east of the nucleus, far enough back that a 4 m plane fits,
        # and off the canonical axis so it is a genuinely different read.
        eye_grid=[(x, 1.66, z) for x in (-1.7, -1.1, -0.5)
                  for z in (3.6, 4.2, 4.8)],
        target_grid=[(x, 1.34, z) for x in (0.2, 0.7, 1.2)
                     for z in (-2.9, -2.3)],
        fov_grid=[42, 46, 50, 54],
        hero_target=0.22,
        avoid=["SpotFixture", "HangRod"],
    )
    report(res)


if __name__ == "__main__":
    which = (sys.argv[1] if len(sys.argv) > 1 else "abc").lower()
    if "a" in which:
        solve_a()
    if "b" in which:
        solve_b()
        solve_b2()
    if "c" in which:
        solve_c()
        solve_c2()
