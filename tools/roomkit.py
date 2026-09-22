"""
roomkit.py — shared composition toolkit for the room composition studies.

This is an art-direction tool, not runtime code. It does three things:

1. Measures the curated GLBs (real AABBs, so nothing floats or sinks).
2. Places assets by *anchor* (base-centre, back-face, etc.) instead of by
   guessed coordinates.
3. Emits Godot 4 `.tscn` text and reports what each canonical camera
   actually frames.

The emitted `.tscn` files are the deliverable and are meant to be opened and
tweaked in Godot. Re-running the builder overwrites them, so once a study is
being iterated on inside the editor, iterate there and retire the generator
for that study.
"""

from __future__ import annotations

import json
import math
import os
import struct

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KIT_DIR = "assets/3d/room-showcase"

# Two curated assets declare `EXT_meshopt_compression` + `KHR_mesh_quantization`
# in `extensionsRequired`, which Godot's glTF importer does not implement — it
# hard-fails those files rather than degrading. `tools/make-godot-compatible.mjs`
# writes decoded, geometry-identical copies under `godot-compatible/`, and the
# studies load those instead. The curated originals stay untouched.
KIT_PATHS = {
    "work-console": "core/work-console.glb",
    "chair": "core/chair.glb",
    "display": "core/display.glb",
    "bookcase-low": "core/bookcase-low.glb",
    "plant-small": "core/plant-small.glb",
    "spotlight": "event/spotlight.glb",
    "speaker-small": "music/speaker-small.glb",
    "headphones": "music/headphones.glb",
    "circuit-board": "godot-compatible/ai/circuit-board.glb",
    "books": "research/books.glb",
    "corkboard": "godot-compatible/research/corkboard.glb",
}


# --------------------------------------------------------------------------
# GLB measurement
# --------------------------------------------------------------------------

def _load_glb(path: str):
    data = open(path, "rb").read()
    _magic, _ver, length = struct.unpack("<III", data[:12])
    off, js = 12, None
    while off < length:
        clen, ctype = struct.unpack("<II", data[off:off + 8])
        if ctype == 0x4E4F534A:
            js = json.loads(data[off + 8:off + 8 + clen].decode("utf-8"))
        off += 8 + clen + ((4 - clen % 4) % 4 if clen % 4 else 0)
    return js


def _mat_mul(a, b):
    r = [0.0] * 16
    for i in range(4):
        for j in range(4):
            r[i * 4 + j] = sum(a[i * 4 + k] * b[k * 4 + j] for k in range(4))
    return r


def _node_matrix(node):
    if "matrix" in node:
        return list(node["matrix"])
    t = node.get("translation", [0, 0, 0])
    x, y, z, w = node.get("rotation", [0, 0, 0, 1])
    s = node.get("scale", [1, 1, 1])
    m = [1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 0,
         2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 0,
         2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y), 0,
         0, 0, 0, 1]
    for c in range(3):
        for k in range(4):
            m[c * 4 + k] *= s[c]
    m[12], m[13], m[14] = t
    return m


def _apply(m, p):
    x, y, z = p
    return (m[0] * x + m[4] * y + m[8] * z + m[12],
            m[1] * x + m[5] * y + m[9] * z + m[13],
            m[2] * x + m[6] * y + m[10] * z + m[14])


_MEASURE_CACHE: dict[str, dict] = {}


def measure(kit_id: str) -> dict:
    """Local-space AABB of a kit asset, in its own authored units."""
    if kit_id in _MEASURE_CACHE:
        return _MEASURE_CACHE[kit_id]
    rel = f"{KIT_DIR}/{KIT_PATHS[kit_id]}"
    js = _load_glb(os.path.join(REPO, rel))
    nodes, meshes, accs = js.get("nodes", []), js.get("meshes", []), js.get("accessors", [])
    lo = [1e30] * 3
    hi = [-1e30] * 3

    def walk(ni, parent):
        n = nodes[ni]
        world = _mat_mul(_node_matrix(n), parent)
        if "mesh" in n:
            for prim in meshes[n["mesh"]].get("primitives", []):
                a = accs[prim["attributes"]["POSITION"]]
                mn, mx = a["min"], a["max"]
                for c in range(8):
                    pt = [mx[i] if (c >> i) & 1 else mn[i] for i in range(3)]
                    w = _apply(world, pt)
                    for i in range(3):
                        lo[i] = min(lo[i], w[i])
                        hi[i] = max(hi[i], w[i])
        for ch in n.get("children", []):
            walk(ch, world)

    ident = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
    for r in js["scenes"][js.get("scene", 0)]["nodes"]:
        walk(r, ident)

    info = {"res": f"res://{rel}", "min": lo, "max": hi,
            "size": [hi[i] - lo[i] for i in range(3)]}
    _MEASURE_CACHE[kit_id] = info
    return info


def fit_scale(kit_id: str, axis: str, target: float) -> float:
    """Uniform scale that makes `axis` of the asset measure `target` metres."""
    return target / measure(kit_id)["size"]["xyz".index(axis)]


# --------------------------------------------------------------------------
# transforms — Godot default euler order is YXZ (R = Ry * Rx * Rz)
# --------------------------------------------------------------------------

def _m3_mul(a, b):
    return [[sum(a[i][k] * b[k][j] for k in range(3)) for j in range(3)] for i in range(3)]


def basis_yxz(rx: float, ry: float, rz: float):
    sx, cx = math.sin(math.radians(rx)), math.cos(math.radians(rx))
    sy, cy = math.sin(math.radians(ry)), math.cos(math.radians(ry))
    sz, cz = math.sin(math.radians(rz)), math.cos(math.radians(rz))
    rxm = [[1, 0, 0], [0, cx, -sx], [0, sx, cx]]
    rym = [[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]]
    rzm = [[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]]
    return _m3_mul(_m3_mul(rym, rxm), rzm)


def _xf3(m, v):
    return tuple(m[i][0] * v[0] + m[i][1] * v[1] + m[i][2] * v[2] for i in range(3))


_ANCHOR = {"min": 0, "center": 1, "max": 2}


def solve_placement(kit_id, scale, rot=(0.0, 0.0, 0.0), anchor=("center", "min", "center"),
                    at=(0.0, 0.0, 0.0)):
    """Return (position, world_aabb) so the anchor point of the transformed
    asset lands exactly on `at`."""
    info = measure(kit_id)
    sc = (scale, scale, scale) if isinstance(scale, (int, float)) else scale
    m = basis_yxz(*rot)
    lo = [1e30] * 3
    hi = [-1e30] * 3
    for c in range(8):
        pt = [(info["max"][i] if (c >> i) & 1 else info["min"][i]) * sc[i] for i in range(3)]
        w = _xf3(m, pt)
        for i in range(3):
            lo[i] = min(lo[i], w[i])
            hi[i] = max(hi[i], w[i])
    apt = []
    for i in range(3):
        k = _ANCHOR[anchor[i]]
        apt.append(lo[i] if k == 0 else (hi[i] if k == 2 else 0.5 * (lo[i] + hi[i])))
    pos = tuple(at[i] - apt[i] for i in range(3))
    aabb = ([lo[i] + pos[i] for i in range(3)], [hi[i] + pos[i] for i in range(3)])
    return pos, aabb


# --------------------------------------------------------------------------
# .tscn emission
# --------------------------------------------------------------------------

def num(v) -> str:
    """Plain-decimal float formatting (no scientific notation for tiny scales)."""
    if isinstance(v, int) and not isinstance(v, bool):
        return str(v)
    if v == 0:
        return "0"
    s = f"{v:.9f}".rstrip("0").rstrip(".")
    return s if s not in ("", "-") else "0"


def vec3(v) -> str:
    return f"Vector3({num(v[0])}, {num(v[1])}, {num(v[2])})"


def vec2(v) -> str:
    return f"Vector2({num(v[0])}, {num(v[1])})"


def color(c) -> str:
    a = c[3] if len(c) > 3 else 1
    return f"Color({num(c[0])}, {num(c[1])}, {num(c[2])}, {num(a)})"


class Scene:
    """Minimal, deterministic Godot 4 .tscn writer."""

    def __init__(self, root_name: str, root_type: str = "Node3D"):
        self.root_name = root_name
        self.root_type = root_type
        self.ext: list[tuple[str, str, str]] = []   # (type, path, id)
        self._ext_by_path: dict[str, str] = {}
        self.sub: list[tuple[str, str, list[str]]] = []  # (type, id, lines)
        self._sub_ids: set[str] = set()
        self.nodes: list[str] = []
        self.props: list[str] = []
        self.placed: list[dict] = []                # bookkeeping for reports

    # -- resources ---------------------------------------------------------
    def ext_res(self, res_type: str, path: str) -> str:
        if path in self._ext_by_path:
            return self._ext_by_path[path]
        rid = f"{len(self.ext) + 1}_{os.path.basename(path).split('.')[0].replace('-', '_')}"
        self.ext.append((res_type, path, rid))
        self._ext_by_path[path] = rid
        return rid

    def sub_res(self, res_type: str, rid: str, props: dict) -> str:
        if rid in self._sub_ids:
            return rid
        lines = [f"{k} = {v}" for k, v in props.items()]
        self.sub.append((res_type, rid, lines))
        self._sub_ids.add(rid)
        return rid

    # -- nodes -------------------------------------------------------------
    def node(self, name: str, ntype: str | None = None, parent: str = ".",
             instance: str | None = None, props: dict | None = None,
             position=None, rotation=None, scale=None):
        head = f'[node name="{name}"'
        if ntype:
            head += f' type="{ntype}"'
        head += f' parent="{parent}"'
        if instance:
            head += f' instance=ExtResource("{instance}")'
        head += "]"
        body = []
        if position is not None:
            body.append(f"position = {vec3(position)}")
        if rotation is not None and any(abs(r) > 1e-9 for r in rotation):
            body.append(f"rotation_degrees = {vec3(rotation)}")
        if scale is not None:
            sc = (scale, scale, scale) if isinstance(scale, (int, float)) else scale
            body.append(f"scale = {vec3(sc)}")
        for k, v in (props or {}).items():
            body.append(f"{k} = {v}")
        self.nodes.append(head + ("\n" + "\n".join(body) if body else ""))
        return f"{parent}/{name}" if parent != "." else name

    def render(self) -> str:
        steps = len(self.ext) + len(self.sub) + 1
        out = [f"[gd_scene load_steps={steps} format=3]", ""]
        for t, p, i in self.ext:
            out.append(f'[ext_resource type="{t}" path="{p}" id="{i}"]')
        out.append("")
        for t, i, lines in self.sub:
            out.append(f'[sub_resource type="{t}" id="{i}"]')
            out.extend(lines)
            out.append("")
        out.append(f'[node name="{self.root_name}" type="{self.root_type}"]')
        if self.props:
            out.extend(self.props)
        out.append("")
        out.append("\n\n".join(self.nodes))
        out.append("")
        return "\n".join(out)

    def write(self, rel_path: str) -> str:
        full = os.path.join(REPO, rel_path)
        os.makedirs(os.path.dirname(full), exist_ok=True)
        with open(full, "w") as fh:
            fh.write(self.render())
        return full


# --------------------------------------------------------------------------
# higher-level composition helpers
# --------------------------------------------------------------------------

class Study:
    """Wraps a Scene with the conventions shared by all three studies."""

    KIT_SCRIPT = "res://scripts/kit_instance.gd"

    def __init__(self, name: str):
        self.s = Scene(name)
        self.kit_script = self.s.ext_res("Script", self.KIT_SCRIPT)
        self.cameras: dict[str, dict] = {}

    # -- architecture ------------------------------------------------------
    def box(self, name, parent, size, center, mat_id, rotation=None, parent_xform=None):
        """Axis-aligned box. `parent_xform` = (origin, yaw_degrees) when the box
        lives under a rotated parent node, so bookkeeping stays in world space."""
        mesh = self.s.sub_res("BoxMesh", f"Box_{name}", {"size": vec3(size)})
        self.s.node(name, "MeshInstance3D", parent,
                    props={"mesh": f'SubResource("{mesh}")',
                           "surface_material_override/0": f'SubResource("{mat_id}")'},
                    position=center, rotation=rotation)
        if parent_xform is None:
            world_c = center
            m = basis_yxz(*(rotation or (0, 0, 0)))
        else:
            origin, yaw = parent_xform
            pm = basis_yxz(0, yaw, 0)
            rc = _xf3(pm, center)
            world_c = tuple(origin[i] + rc[i] for i in range(3))
            m = _m3_mul(pm, basis_yxz(*(rotation or (0, 0, 0))))
        lo = [1e30] * 3
        hi = [-1e30] * 3
        for c in range(8):
            pt = [(size[i] / 2) * (1 if (c >> i) & 1 else -1) for i in range(3)]
            w = _xf3(m, pt)
            for i in range(3):
                lo[i] = min(lo[i], w[i] + world_c[i])
                hi[i] = max(hi[i], w[i] + world_c[i])
        self.s.placed.append({"name": name, "kind": "shell", "aabb": (lo, hi)})

    def quad(self, name, parent, size, center, mat_id, rotation=None, track=True):
        mid = self.s.sub_res("QuadMesh", f"Quad_{name}", {"size": vec2(size)})
        self.s.node(name, "MeshInstance3D", parent,
                    props={"mesh": f'SubResource("{mid}")',
                           "surface_material_override/0": f'SubResource("{mat_id}")'},
                    position=center, rotation=rotation)
        if track:
            self.s.placed.append({
                "name": name, "kind": "surface",
                "aabb": ([center[0] - size[0] / 2, center[1] - size[1] / 2, center[2] - 0.01],
                         [center[0] + size[0] / 2, center[1] + size[1] / 2, center[2] + 0.01]),
            })

    def plane(self, name, parent, size, center, mat_id, rotation=None):
        mid = self.s.sub_res("PlaneMesh", f"Plane_{name}", {"size": vec2(size)})
        self.s.node(name, "MeshInstance3D", parent,
                    props={"mesh": f'SubResource("{mid}")',
                           "surface_material_override/0": f'SubResource("{mat_id}")'},
                    position=center, rotation=rotation)

    # -- kit assets --------------------------------------------------------
    def kit(self, name, parent, kit_id, scale, rot=(0, 0, 0),
            anchor=("center", "min", "center"), at=(0, 0, 0)):
        info = measure(kit_id)
        rid = self.s.ext_res("PackedScene", info["res"])
        pos, aabb = solve_placement(kit_id, scale, rot, anchor, at)
        self.s.node(name, None, parent, instance=rid,
                    props={"script": f'ExtResource("{self.kit_script}")',
                           "kit_id": f'"{kit_id}"'},
                    position=pos, rotation=rot, scale=scale)
        self.s.placed.append({"name": name, "kind": "kit", "kit": kit_id, "aabb": aabb})
        return aabb

    # -- camera ------------------------------------------------------------
    def camera(self, name, parent, eye, target, fov, current=False, far=40.0):
        d = [target[i] - eye[i] for i in range(3)]
        len_xz = math.hypot(d[0], d[2])
        yaw = math.degrees(math.atan2(-d[0], -d[2]))
        pitch = math.degrees(math.atan2(d[1], len_xz))
        self.s.node(name, "Camera3D", parent,
                    props={"fov": num(fov), "near": "0.05", "far": num(far),
                           "current": "true" if current else "false"},
                    position=eye, rotation=(pitch, yaw, 0))
        self.cameras[name] = {"eye": eye, "target": target, "fov": fov,
                              "yaw": yaw, "pitch": pitch}
        return name


# --------------------------------------------------------------------------
# framing report — substitutes for a render pass while Godot is unavailable
# --------------------------------------------------------------------------

def frame_report(study: Study, cam_name: str, aspect: float = 16 / 9) -> str:
    cam = study.cameras[cam_name]
    eye, yaw, pitch, fov = cam["eye"], cam["yaw"], cam["pitch"], cam["fov"]
    b = basis_yxz(pitch, yaw, 0)
    right = (b[0][0], b[1][0], b[2][0])
    up = (b[0][1], b[1][1], b[2][1])
    fwd = (-b[0][2], -b[1][2], -b[2][2])
    tan_v = math.tan(math.radians(fov / 2))

    rows = []
    for item in study.s.placed:
        lo, hi = item["aabb"]
        inside, depths, xs, ys = 0, [], [], []
        for c in range(8):
            p = [hi[i] if (c >> i) & 1 else lo[i] for i in range(3)]
            d = [p[i] - eye[i] for i in range(3)]
            zv = sum(d[i] * fwd[i] for i in range(3))
            if zv <= 0.01:
                depths.append(zv)
                continue
            xv = sum(d[i] * right[i] for i in range(3))
            yv = sum(d[i] * up[i] for i in range(3))
            hh, hw = zv * tan_v, zv * tan_v * aspect
            nx, ny = xv / hw, yv / hh
            xs.append(nx)
            ys.append(ny)
            depths.append(zv)
            if abs(nx) <= 1 and abs(ny) <= 1:
                inside += 1
        rows.append({
            "name": item["name"], "kind": item["kind"], "inside": inside,
            "depth": min(depths) if depths else 0,
            "x": (min(xs), max(xs)) if xs else None,
            "y": (min(ys), max(ys)) if ys else None,
        })

    rows.sort(key=lambda r: r["depth"])
    out = [f"  camera '{cam_name}'  eye={tuple(round(v,2) for v in eye)} "
           f"yaw={yaw:.1f} pitch={pitch:.1f} fov={fov}",
           f"  {'object':<30}{'depth':>7}  {'x-range':>15}  {'y-range':>15}  corners"]
    for r in rows:
        xr = f"{r['x'][0]:+.2f}..{r['x'][1]:+.2f}" if r["x"] else "  behind cam  "
        yr = f"{r['y'][0]:+.2f}..{r['y'][1]:+.2f}" if r["y"] else "              "
        flag = "" if r["inside"] else "   <-- fully outside frame"
        out.append(f"  {r['name']:<30}{r['depth']:>7.2f}  {xr:>15}  {yr:>15}  {r['inside']}/8{flag}")
    return "\n".join(out)


# --------------------------------------------------------------------------
# structural validation — catches broken .tscn before Godot ever sees it
# --------------------------------------------------------------------------

def validate_tscn(rel_path: str) -> list[str]:
    full = os.path.join(REPO, rel_path)
    txt = open(full).read()
    errs: list[str] = []
    lines = txt.splitlines()

    header = lines[0]
    if not header.startswith("[gd_scene ") or "format=3" not in header:
        errs.append("bad gd_scene header")
    declared = int(header.split("load_steps=")[1].split()[0])

    ext_ids, sub_ids, paths = set(), set(), []
    n_ext = n_sub = 0
    for ln in lines:
        if ln.startswith("[ext_resource"):
            n_ext += 1
            rid = ln.split('id="')[1].split('"')[0]
            path = ln.split('path="')[1].split('"')[0]
            ext_ids.add(rid)
            paths.append(path)
        elif ln.startswith("[sub_resource"):
            n_sub += 1
            sub_ids.add(ln.split('id="')[1].split('"')[0])

    if declared != n_ext + n_sub + 1:
        errs.append(f"load_steps={declared} but ext({n_ext})+sub({n_sub})+1={n_ext + n_sub + 1}")

    for p in paths:
        if not p.startswith("res://"):
            errs.append(f"non-res path {p}")
            continue
        if not os.path.exists(os.path.join(REPO, p[len("res://"):])):
            errs.append(f"MISSING RESOURCE {p}")

    for ln in lines:
        for token, pool, label in ((' ExtResource("', ext_ids, "ExtResource"),
                                   ('SubResource("', sub_ids, "SubResource")):
            idx = 0
            while True:
                i = ln.find(token, idx)
                if i < 0:
                    break
                rid = ln[i + len(token):].split('"')[0]
                if rid not in pool:
                    errs.append(f"undefined {label}('{rid}')")
                idx = i + 1

    known = {""}
    first = True
    for ln in lines:
        if not ln.startswith("[node "):
            continue
        name = ln.split('name="')[1].split('"')[0]
        if first:
            if 'parent=' in ln:
                errs.append("root node must not declare a parent")
            known.add(name)
            known.add(".")
            first = False
            continue
        parent = ln.split('parent="')[1].split('"')[0]
        if parent not in known:
            errs.append(f"node '{name}' has unknown parent '{parent}'")
        known.add(name if parent == "." else f"{parent}/{name}")

    dup: dict[str, int] = {}
    for ln in lines:
        if ln.startswith("[node "):
            key = ln.split("]")[0]
            dup[key] = dup.get(key, 0) + 1
    for k, v in dup.items():
        if v > 1:
            errs.append(f"duplicate node declaration {k}")
    return errs
