"""
render_studies.py — offline canonical renders of the room composition studies.

**The `.tscn` files are the source of truth.** This tool reads them; it never
writes them. It parses a study scene, rebuilds it in Blender, renders the
canonical camera with Cycles CPU, and applies Godot's own post-processing
chain so the resulting image is a fair preview of the Godot scene rather
than a prettier parallel artwork.

Why this exists
---------------
Godot cannot be installed in this environment (the Debian mirrors are
unreachable), so the studies cannot be opened or screenshotted here. Rather
than guess, this tool maps each authored Godot construct onto its closest
reproducible Cycles equivalent and documents every approximation.

Deliberate constraints
----------------------
- Nothing is invented. Geometry, transforms, materials, lights and cameras
  all come from the `.tscn` and from `scripts/room_palette.gd`.
- No Cycles-only rescue effects: no volumetrics, no caustics, no extra
  bounce lights, no fog, no depth of field. If the composition is weak, the
  render is supposed to show that.
- Tonemapping, colour adjustment and glow are ports of Godot's own
  `tonemap.glsl`, so what you judge here is what Godot would show.

Usage
-----
    python3 tools/render_studies.py A --samples 32 --width 1280 --height 720

Run one study at a time. On a 2-core box a canonical frame takes a few
minutes.
"""

from __future__ import annotations

import argparse
import math
import os
import re
import struct
import sys
import zlib

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

STUDIES = {
    "A": ("RoomStudy_A_WorkWall", "A_WorkWall"),
    "B": ("RoomStudy_B_DiagonalStudio", "B_DiagonalStudio"),
    "C": ("RoomStudy_C_PresentationPlane", "C_PresentationPlane"),
}


# ===========================================================================
# 1. Godot `.tscn` parsing
# ===========================================================================

_VEC3 = re.compile(r"Vector3\(\s*([^)]*)\)")
_VEC2 = re.compile(r"Vector2\(\s*([^)]*)\)")
_COLOR = re.compile(r"Color\(\s*([^)]*)\)")
_SUBRES = re.compile(r'SubResource\(\s*"([^"]+)"\s*\)')
_EXTRES = re.compile(r'ExtResource\(\s*"([^"]+)"\s*\)')


def _parse_value(raw: str):
    raw = raw.strip()
    m = _VEC3.fullmatch(raw)
    if m:
        return ("vec3", tuple(float(x) for x in m.group(1).split(",")))
    m = _VEC2.fullmatch(raw)
    if m:
        return ("vec2", tuple(float(x) for x in m.group(1).split(",")))
    m = _COLOR.fullmatch(raw)
    if m:
        return ("color", tuple(float(x) for x in m.group(1).split(",")))
    m = _SUBRES.fullmatch(raw)
    if m:
        return ("sub", m.group(1))
    m = _EXTRES.fullmatch(raw)
    if m:
        return ("ext", m.group(1))
    if raw in ("true", "false"):
        return ("bool", raw == "true")
    if raw.startswith('"') and raw.endswith('"'):
        return ("str", raw[1:-1])
    try:
        return ("num", float(raw))
    except ValueError:
        return ("raw", raw)


def _header_attrs(header: str) -> dict:
    attrs = {}
    for k, v in re.findall(r'(\w+)\s*=\s*("(?:[^"]*)"|\S+)', header):
        attrs[k] = _parse_value(v)
    return attrs


class Scene:
    """A parsed `.tscn`: external resources, sub-resources and a node tree."""

    def __init__(self, path: str):
        self.path = path
        self.ext: dict[str, dict] = {}
        self.sub: dict[str, dict] = {}
        self.nodes: list[dict] = []
        self._parse()

    def _parse(self):
        text = open(self.path, encoding="utf-8").read()
        # Split on section headers while keeping the body that follows.
        chunks = re.split(r"^\[([^\]\n]+)\]\s*$", text, flags=re.M)
        # chunks[0] is preamble; then (header, body) pairs.
        for i in range(1, len(chunks), 2):
            header, body = chunks[i], chunks[i + 1]
            kind = header.split()[0]
            attrs = _header_attrs(header[len(kind):])
            props = {}
            for line in body.splitlines():
                line = line.strip()
                if not line or line.startswith(";") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                props[k.strip()] = _parse_value(v)
            if kind == "ext_resource":
                self.ext[attrs["id"][1]] = {"attrs": attrs, "props": props}
            elif kind == "sub_resource":
                self.sub[attrs["id"][1]] = {
                    "type": attrs["type"][1], "props": props}
            elif kind == "node":
                self.nodes.append({
                    "name": attrs["name"][1],
                    "type": attrs["type"][1] if "type" in attrs else None,
                    "parent": attrs["parent"][1] if "parent" in attrs else None,
                    "instance": attrs["instance"][1] if "instance" in attrs else None,
                    "props": props,
                })

    def node_path(self, node) -> str:
        if node["parent"] in (None, "."):
            return node["name"]
        return node["parent"] + "/" + node["name"]


# ===========================================================================
# 2. `room_palette.gd` parsing  (single source of truth for kit materials)
# ===========================================================================

def parse_palette(gd_path: str) -> dict:
    """Read the GDScript palette so material values never drift from Godot."""
    src = open(gd_path, encoding="utf-8").read()
    src = re.sub(r"#[^\n]*", "", src)  # strip comments

    consts = {}
    for name, body in re.findall(r"const\s+(\w+)\s*:=\s*Color\(([^)]*)\)", src):
        consts[name] = tuple(float(x) for x in body.split(","))

    start = src.index("MATERIAL_FAMILIES")
    start = src.index("{", start)
    depth, end = 0, None
    for i in range(start, len(src)):
        if src[i] == "{":
            depth += 1
        elif src[i] == "}":
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    block = src[start:end]

    pos = 0

    def skip_ws():
        nonlocal pos
        while pos < len(block) and block[pos] in " \t\r\n,":
            pos += 1

    def parse_dict():
        nonlocal pos
        out = {}
        assert block[pos] == "{"
        pos += 1
        while True:
            skip_ws()
            if block[pos] == "}":
                pos += 1
                return out
            key = parse_value()
            skip_ws()
            assert block[pos] == ":", block[pos:pos + 30]
            pos += 1
            skip_ws()
            out[key] = parse_value()

    def parse_value():
        nonlocal pos
        skip_ws()
        ch = block[pos]
        if ch == "{":
            return parse_dict()
        if ch == '"':
            j = block.index('"', pos + 1)
            s = block[pos + 1:j]
            pos = j + 1
            return s
        if block.startswith("Color(", pos):
            j = block.index(")", pos)
            vals = tuple(float(x) for x in block[pos + 6:j].split(","))
            pos = j + 1
            return vals
        m = re.match(r"[A-Za-z_]\w*", block[pos:])
        if m:
            pos += m.end()
            return consts[m.group(0)]
        m = re.match(r"-?[\d.]+(?:e-?\d+)?", block[pos:])
        pos += m.end()
        return float(m.group(0))

    return parse_dict()


# ===========================================================================
# 3. Colour + maths helpers
# ===========================================================================

def srgb_to_linear(c):
    """Godot uploads Color uniforms through `source_color`, i.e. sRGB->linear."""
    return tuple(
        (v / 12.92) if v <= 0.04045 else (((v + 0.055) / 1.055) ** 2.4)
        for v in c[:3]
    )


def m3_mul(a, b):
    return [[sum(a[i][k] * b[k][j] for k in range(3)) for j in range(3)]
            for i in range(3)]


def basis_yxz(rx, ry, rz):
    """Godot's default euler order (Y * X * Z). Matches tools/roomkit.py."""
    sx, cx = math.sin(math.radians(rx)), math.cos(math.radians(rx))
    sy, cy = math.sin(math.radians(ry)), math.cos(math.radians(ry))
    sz, cz = math.sin(math.radians(rz)), math.cos(math.radians(rz))
    rxm = [[1, 0, 0], [0, cx, -sx], [0, sx, cx]]
    rym = [[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]]
    rzm = [[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]]
    return m3_mul(m3_mul(rym, rxm), rzm)


# Godot is Y-up, Blender is Z-up:  blender = (gx, -gz, gy)
C_G2B = [[1, 0, 0], [0, 0, -1], [0, 1, 0]]
C_B2G = [[1, 0, 0], [0, 0, 1], [0, -1, 0]]


def g2b_point(p):
    return (p[0], -p[2], p[1])


def g2b_basis(m):
    """For geometry whose local data was also converted (mesh case)."""
    return m3_mul(m3_mul(C_G2B, m), C_B2G)


def g2b_view_basis(m):
    """Cameras and lights: Godot and Blender share the -Z forward/+Y up
    local convention, so only the world change-of-basis applies."""
    return m3_mul(C_G2B, m)


# ===========================================================================
# 4. Building the Blender scene
# ===========================================================================

def build(scene: Scene, palette: dict, cam_name: str, log):
    import bpy
    from mathutils import Matrix

    # --- clean slate -------------------------------------------------------
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene

    def to_matrix(basis, pos):
        m = Matrix.Identity(4)
        for i in range(3):
            for j in range(3):
                m[i][j] = basis[i][j]
            m[i][3] = pos[i]
        return m

    def node_local(node):
        p = node["props"]
        pos = p["position"][1] if "position" in p else (0.0, 0.0, 0.0)
        rot = p["rotation_degrees"][1] if "rotation_degrees" in p else (0.0,) * 3
        scl = p["scale"][1] if "scale" in p else (1.0, 1.0, 1.0)
        b = basis_yxz(*rot)
        b = [[b[i][j] * scl[j] for j in range(3)] for i in range(3)]
        return b, pos

    # Resolve each node's world transform in Godot space by walking parents.
    by_path = {}
    for n in scene.nodes:
        by_path[scene.node_path(n)] = n

    world_cache = {}

    def world_of(node):
        path = scene.node_path(node)
        if path in world_cache:
            return world_cache[path]
        b, p = node_local(node)
        parent = node["parent"]
        if parent not in (None, "."):
            pb, pp = world_of(by_path[parent])
            b = m3_mul(pb, b)
            p = tuple(pp[i] + sum(pb[i][k] * p[k] for k in range(3))
                      for i in range(3))
        world_cache[path] = (b, p)
        return b, p

    # --- materials ---------------------------------------------------------
    mat_cache = {}

    def make_material(name, albedo, rough, metal, spec=0.42,
                      emission=None, emission_energy=1.0):
        key = (name, albedo, rough, metal, emission, emission_energy)
        if key in mat_cache:
            return mat_cache[key]
        mat = bpy.data.materials.new(name)
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes["Principled BSDF"]
        lin = srgb_to_linear(albedo)
        bsdf.inputs["Base Color"].default_value = (*lin, 1.0)
        bsdf.inputs["Roughness"].default_value = float(rough)
        bsdf.inputs["Metallic"].default_value = float(metal)
        if "Specular IOR Level" in bsdf.inputs:
            bsdf.inputs["Specular IOR Level"].default_value = float(spec)
        if emission is not None:
            em = srgb_to_linear(emission)
            bsdf.inputs["Emission Color"].default_value = (*em, 1.0)
            bsdf.inputs["Emission Strength"].default_value = float(emission_energy)
        mat_cache[key] = mat
        return mat

    def material_from_subresource(sub_id):
        s = scene.sub[sub_id]
        p = s["props"]
        albedo = p["albedo_color"][1] if "albedo_color" in p else (1, 1, 1, 1)
        rough = p["roughness"][1] if "roughness" in p else 0.5
        metal = p["metallic"][1] if "metallic" in p else 0.0
        spec = p["metallic_specular"][1] if "metallic_specular" in p else 0.42
        emission = None
        eng = 1.0
        if p.get("emission_enabled", ("bool", False))[1]:
            emission = p["emission"][1]
            eng = p.get("emission_energy_multiplier", ("num", 1.0))[1]
        name = p["resource_name"][1] if "resource_name" in p else sub_id
        return make_material(name, albedo, rough, metal, spec, emission, eng)

    # --- built geometry (BoxMesh / QuadMesh) -------------------------------
    def add_box(name, size, matrix, material):
        sx, sy, sz = size
        # Godot box local -> Blender local via C_G2B on each vertex.
        hx, hy, hz = sx / 2, sz / 2, sy / 2   # blender half-extents
        verts = [(-hx, -hy, -hz), (hx, -hy, -hz), (hx, hy, -hz), (-hx, hy, -hz),
                 (-hx, -hy, hz), (hx, -hy, hz), (hx, hy, hz), (-hx, hy, hz)]
        faces = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4),
                 (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
        me = bpy.data.meshes.new(name)
        me.from_pydata(verts, [], faces)
        me.update()
        ob = bpy.data.objects.new(name, me)
        ob.matrix_world = matrix
        ob.data.materials.append(material)
        sc.collection.objects.link(ob)
        return ob

    def add_quad(name, size, matrix, material):
        w, h = size
        # Godot QuadMesh: local XY plane, normal +Z.
        # Converted to Blender local: XZ plane, normal -Y.
        verts = [(-w / 2, 0, -h / 2), (w / 2, 0, -h / 2),
                 (w / 2, 0, h / 2), (-w / 2, 0, h / 2)]
        me = bpy.data.meshes.new(name)
        me.from_pydata(verts, [], [(0, 1, 2, 3)])
        me.update()
        ob = bpy.data.objects.new(name, me)
        ob.matrix_world = matrix
        ob.data.materials.append(material)
        sc.collection.objects.link(ob)
        return ob

    # --- GLB kit assets ----------------------------------------------------
    glb_cache = {}

    def load_glb(rel_path):
        """Import once; bake the importer's Y-up->Z-up conversion into the
        mesh data so instance transforms are pure Godot transforms."""
        if rel_path in glb_cache:
            return glb_cache[rel_path]
        abspath = os.path.join(REPO, rel_path)
        if not os.path.exists(abspath):
            raise SystemExit(f"MISSING ASSET: {rel_path}")
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=abspath)
        imported = [o for o in bpy.data.objects if o not in before]
        meshes = []
        for o in imported:
            if o.type == "MESH":
                o.data.transform(o.matrix_world)   # bake world transform
                meshes.append(o.data)
        for o in imported:
            bpy.data.objects.remove(o, do_unlink=True)
        glb_cache[rel_path] = meshes
        return meshes

    def surface_name(mat):
        return mat.name.split(".00")[0] if mat else ""

    def add_kit_instance(name, rel_path, kit_id, matrix):
        meshes = load_glb(rel_path)
        family = palette.get(kit_id, {})
        objs = []
        for idx, me in enumerate(meshes):
            ob = bpy.data.objects.new(f"{name}_{idx}" if idx else name, me.copy())
            ob.matrix_world = matrix
            sc.collection.objects.link(ob)
            # Re-surface per room_palette.gd (mirrors scripts/kit_instance.gd).
            for si, slot in enumerate(ob.data.materials):
                src_name = slot.name if slot else f"surface_{si}"
                # glTF material names may be suffixed by Blender on reuse.
                base = re.sub(r"\.\d{3}$", "", src_name)
                spec = family.get(base, family.get("_default"))
                if not spec:
                    continue
                tex = None
                if slot and slot.use_nodes:
                    for nd in slot.node_tree.nodes:
                        if nd.type == "TEX_IMAGE" and nd.image:
                            tex = nd.image
                            break
                newmat = make_material(
                    f"{kit_id}:{base}", spec["albedo"], spec["rough"],
                    spec.get("metal", 0.0), 0.42,
                    spec.get("emission"), spec.get("emission_energy", 1.0))
                if tex is not None:
                    # Preserve the one textured asset (headphones.glb).
                    newmat = newmat.copy()
                    nt = newmat.node_tree
                    bsdf = nt.nodes["Principled BSDF"]
                    tn = nt.nodes.new("ShaderNodeTexImage")
                    tn.image = tex
                    nt.links.new(tn.outputs["Color"], bsdf.inputs["Base Color"])
                ob.data.materials[si] = newmat
            objs.append(ob)
        return objs

    # --- walk the node tree ------------------------------------------------
    camera = None
    stats = {"mesh": 0, "kit": 0, "light": 0}

    for node in scene.nodes:
        props = node["props"]
        b, p = world_of(node)
        ntype = node["type"]

        if node["instance"]:
            rel = scene.ext[node["instance"]]["attrs"]["path"][1]
            rel = rel.replace("res://", "")
            kit_id = props["kit_id"][1] if "kit_id" in props else ""
            add_kit_instance(node["name"], rel, kit_id,
                             to_matrix(g2b_basis(b), g2b_point(p)))
            stats["kit"] += 1

        elif ntype == "MeshInstance3D":
            mesh_sub = props["mesh"][1]
            mres = scene.sub[mesh_sub]
            mat = None
            if "surface_material_override/0" in props:
                mat = material_from_subresource(
                    props["surface_material_override/0"][1])
            if mat is None:
                mat = make_material("untitled", (0.5, 0.5, 0.5), 0.8, 0.0)
            mtx = to_matrix(g2b_basis(b), g2b_point(p))
            if mres["type"] == "BoxMesh":
                add_box(node["name"], mres["props"]["size"][1], mtx, mat)
            elif mres["type"] == "QuadMesh":
                add_quad(node["name"], mres["props"]["size"][1], mtx, mat)
            stats["mesh"] += 1

        elif ntype in ("SpotLight3D", "OmniLight3D", "DirectionalLight3D"):
            energy = props.get("light_energy", ("num", 1.0))[1]
            color = srgb_to_linear(props.get("light_color",
                                             ("color", (1, 1, 1, 1)))[1])
            size = props.get("light_size", ("num", 0.0))[1]
            shadow = props.get("shadow_enabled", ("bool", False))[1]

            if ntype == "DirectionalLight3D":
                ld = bpy.data.lights.new(node["name"], type="SUN")
                # Godot pre-multiplies directional colour by PI, and its
                # Lambert lobe divides by PI, so outgoing radiance is
                #   albedo * NdotL * energy.
                # Cycles sun of strength S gives albedo/PI * NdotL * S.
                # => S = PI * energy.
                ld.energy = math.pi * energy
                ld.angle = math.radians(2.0)
            else:
                rng = props.get("omni_range", props.get("spot_range",
                                                        ("num", 5.0)))[1]
                atten = props.get("omni_attenuation",
                                  props.get("spot_attenuation", ("num", 1.0)))[1]
                # Godot's punctual falloff is a windowed inverse power, not
                # inverse-square, so the two only agree at one distance.
                # Calibrate at the distance the light actually does its work.
                #   Godot radiance  = albedo * NdotL * energy * atten(d)
                #   Cycles radiance = albedo/PI * NdotL * P/(4*PI*d^2)
                #   => P = 4 * PI^2 * d^2 * energy * atten(d)
                d_ref = 2.0 if ntype == "SpotLight3D" else 1.2
                window = max(1.0 - (d_ref / rng) ** 4, 0.0) ** 2
                atten_d = window * d_ref ** (-atten)
                watts = 4 * math.pi ** 2 * d_ref ** 2 * energy * atten_d
                if ntype == "SpotLight3D":
                    ld = bpy.data.lights.new(node["name"], type="SPOT")
                    sa = props.get("spot_angle", ("num", 45.0))[1]
                    saa = props.get("spot_angle_attenuation", ("num", 1.0))[1]
                    ld.spot_size = 2 * math.radians(sa)   # Godot = half-angle
                    ld.spot_blend = min(0.9, max(0.1, 1.0 - 0.5 * saa))
                else:
                    ld = bpy.data.lights.new(node["name"], type="POINT")
                ld.energy = watts
                ld.shadow_soft_size = size
            ld.color = color
            ld.use_shadow = bool(shadow)
            ob = bpy.data.objects.new(node["name"], ld)
            ob.matrix_world = to_matrix(g2b_view_basis(b), g2b_point(p))
            sc.collection.objects.link(ob)
            stats["light"] += 1
            log(f"    light {node['name']:<14} {ntype:<19} "
                f"E={energy:<6} -> {getattr(ld,'energy',0):.1f}")

        elif ntype == "Camera3D" and node["name"] == cam_name:
            cd = bpy.data.cameras.new(node["name"])
            cd.sensor_fit = "VERTICAL"      # Godot KEEP_HEIGHT
            cd.angle_y = math.radians(props.get("fov", ("num", 75.0))[1])
            cd.clip_start = props.get("near", ("num", 0.05))[1]
            cd.clip_end = props.get("far", ("num", 4000.0))[1]
            camera = bpy.data.objects.new(node["name"], cd)
            camera.matrix_world = to_matrix(g2b_view_basis(b), g2b_point(p))
            sc.collection.objects.link(camera)

    if camera is None:
        raise SystemExit(f"camera '{cam_name}' not found in {scene.path}")
    sc.camera = camera

    # --- world -------------------------------------------------------------
    env = None
    for node in scene.nodes:
        if node["type"] == "WorldEnvironment":
            env = scene.sub[node["props"]["environment"][1]]["props"]
    build_world(scene, env)

    log(f"    built: {stats['mesh']} built meshes, {stats['kit']} kit "
        f"instances, {stats['light']} lights")
    return env


def build_world(scene: Scene, env):
    """Godot separates *background* (what the camera sees) from *ambient*
    (flat fill). Cycles has no flat ambient, so a Light Path switch gives
    camera rays the sky and shading rays the ambient colour — the same split
    Godot makes, with real occlusion instead of SSAO."""
    import bpy

    world = bpy.data.worlds.new("World")
    bpy.context.scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()

    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])

    if env is None:
        bg.inputs["Color"].default_value = (0.02, 0.02, 0.025, 1)
        bg.inputs["Strength"].default_value = 1.0
        return

    sky_props = {}
    if "sky" in env:
        sky = scene.sub[env["sky"][1]]["props"]
        sky_props = scene.sub[sky["sky_material"][1]]["props"]

    def col(key, default):
        return srgb_to_linear(sky_props.get(key, ("color", default))[1])

    top = col("sky_top_color", (0.08, 0.09, 0.13, 1))
    hor = col("sky_horizon_color", (0.14, 0.14, 0.16, 1))
    ghor = col("ground_horizon_color", (0.14, 0.14, 0.16, 1))
    gbot = col("ground_bottom_color", (0.05, 0.05, 0.05, 1))
    sky_e = sky_props.get("sky_energy_multiplier", ("num", 1.0))[1]
    bg_e = env.get("background_energy_multiplier", ("num", 1.0))[1]

    geo = nt.nodes.new("ShaderNodeNewGeometry")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(geo.outputs["Incoming"], sep.inputs["Vector"])
    mr = nt.nodes.new("ShaderNodeMapRange")
    mr.inputs["From Min"].default_value = -1.0
    mr.inputs["From Max"].default_value = 1.0
    nt.links.new(sep.outputs["Z"], mr.inputs["Value"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    cr = ramp.color_ramp
    cr.elements[0].position = 0.0
    cr.elements[0].color = (*gbot, 1)
    cr.elements[1].position = 0.48
    cr.elements[1].color = (*ghor, 1)
    e2 = cr.elements.new(0.52)
    e2.color = (*hor, 1)
    e3 = cr.elements.new(1.0)
    e3.color = (*top, 1)
    nt.links.new(mr.outputs["Result"], ramp.inputs["Fac"])

    sky_scale = nt.nodes.new("ShaderNodeMix")
    sky_scale.data_type = "RGBA"
    sky_scale.blend_type = "MULTIPLY"
    sky_scale.inputs["Factor"].default_value = 1.0
    nt.links.new(ramp.outputs["Color"], sky_scale.inputs[6])
    s = sky_e * bg_e
    sky_scale.inputs[7].default_value = (s, s, s, 1)

    # Godot ambient: mix(ambient_light_color, sky, sky_contribution) * energy
    amb_c = srgb_to_linear(env.get("ambient_light_color",
                                   ("color", (0.3, 0.3, 0.3, 1)))[1])
    amb_e = env.get("ambient_light_energy", ("num", 1.0))[1]
    contrib = env.get("ambient_light_sky_contribution", ("num", 1.0))[1]
    sky_avg = tuple((top[i] + hor[i] + ghor[i]) / 3 * sky_e for i in range(3))
    ambient = tuple((amb_c[i] * (1 - contrib) + sky_avg[i] * contrib) * amb_e
                    for i in range(3))

    lp = nt.nodes.new("ShaderNodeLightPath")
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.inputs[6].default_value = (*ambient, 1)      # non-camera rays
    nt.links.new(sky_scale.outputs[2], mix.inputs[7])  # camera rays
    nt.links.new(lp.outputs["Is Camera Ray"], mix.inputs["Factor"])
    nt.links.new(mix.outputs[2], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = 1.0


# ===========================================================================
# 5. Godot's post-processing chain, ported
# ===========================================================================

ACES_IN = [[0.59719, 0.35458, 0.04823],
           [0.07600, 0.90834, 0.01566],
           [0.02840, 0.13383, 0.83777]]
ACES_OUT = [[1.60475, -0.53108, -0.07367],
            [-0.10208, 1.10813, -0.00605],
            [-0.00327, -0.07276, 1.07602]]


def _rrt_odt_fit(v):
    a = v * (v + 0.0245786) - 0.000090537
    b = v * (0.983729 * v + 0.432951) + 0.238081
    return a / b


def tonemap_aces(rgb, white, np):
    """Port of Godot 4 `tonemap_aces()` from servers/.../tonemap.glsl."""
    bias = 1.8
    c = rgb * bias
    c = c @ np.array(ACES_IN).T
    c = _rrt_odt_fit(c)
    c = c @ np.array(ACES_OUT).T
    w = white * bias
    wt = (w * (w + 0.0245786) - 0.000090537) / (w * (0.983729 * w + 0.432951) + 0.238081)
    return c / wt


def linear_to_srgb(c, np):
    return np.where(c <= 0.0031308, c * 12.92,
                    1.055 * np.maximum(c, 1e-8) ** (1 / 2.4) - 0.055)


def apply_glow(rgb, env, np):
    """Approximation of Godot's glow: threshold -> multi-scale blur -> blend.
    Godot uses a mip pyramid; this uses successive box blurs, which is close
    enough for judging whether the screen reads as a light source."""
    if not env or not env.get("glow_enabled", ("bool", False))[1]:
        return rgb
    thr = env.get("glow_hdr_threshold", ("num", 1.0))[1]
    bloom = env.get("glow_bloom", ("num", 0.0))[1]
    intensity = env.get("glow_intensity", ("num", 0.8))[1]
    strength = env.get("glow_strength", ("num", 1.0))[1]
    mode = int(env.get("glow_blend_mode", ("num", 2.0))[1])

    luma = rgb.max(axis=2)
    t = np.clip((luma - thr) / max(1e-4, thr), 0.0, 1.0)
    t = t * t * (3 - 2 * t)                       # smoothstep
    fac = np.maximum(t, bloom)[..., None]
    bright = rgb * fac

    acc = np.zeros_like(bright)
    cur = bright
    for level in range(4):
        k = 2 ** (level + 1)
        cur = _box_blur(cur, k, np)
        acc += cur
    acc /= 4.0
    acc *= strength

    if mode == 0:       # additive
        return rgb + acc * intensity
    if mode == 1:       # screen
        return 1.0 - (1.0 - rgb) * (1.0 - np.clip(acc * intensity, 0, 1))
    return rgb + acc * intensity


def _box_blur(img, radius, np):
    k = max(1, int(radius))
    pad = np.pad(img, ((k, k), (k, k), (0, 0)), mode="edge")
    cs = pad.cumsum(axis=0)
    cs = np.vstack([np.zeros((1,) + cs.shape[1:]), cs])
    h = img.shape[0]
    out = (cs[2 * k + 1:2 * k + 1 + h] - cs[:h]) / (2 * k + 1)
    cs = out.cumsum(axis=1)
    cs = np.hstack([np.zeros((cs.shape[0], 1, cs.shape[2])), cs])
    w = img.shape[1]
    return (cs[:, 2 * k + 1:2 * k + 1 + w] - cs[:, :w]) / (2 * k + 1)


def apply_bcs(srgb, env, np):
    """Godot `apply_bcs()`, applied after linear_to_srgb (as in tonemap.glsl)."""
    if not env or not env.get("adjustment_enabled", ("bool", False))[1]:
        return srgb
    b = env.get("adjustment_brightness", ("num", 1.0))[1]
    c = env.get("adjustment_contrast", ("num", 1.0))[1]
    s = env.get("adjustment_saturation", ("num", 1.0))[1]
    out = srgb * b
    out = 0.5 + (out - 0.5) * c
    grey = (out.sum(axis=2) / 3.0)[..., None]
    out = grey + (out - grey) * s
    return out


def post_process(linear, env, np):
    white = env.get("tonemap_white", ("num", 1.0))[1] if env else 1.0
    exposure = env.get("tonemap_exposure", ("num", 1.0))[1] if env else 1.0
    mode = int(env.get("tonemap_mode", ("num", 0.0))[1]) if env else 0

    c = linear * exposure
    c = apply_glow(c, env, np)
    if mode == 3:
        c = tonemap_aces(c, white, np)
    elif mode == 2:                                  # filmic
        c = np.clip(c, 0, None)
        c = (c * (6.2 * c + 0.5)) / (c * (6.2 * c + 1.7) + 0.06)
    elif mode == 1:                                  # reinhard
        c = c / (1.0 + c)
    c = np.clip(c, 0.0, 1.0)
    c = linear_to_srgb(c, np)
    c = apply_bcs(c, env, np)
    return np.clip(c, 0.0, 1.0)


# ===========================================================================
# 6. PNG output
# ===========================================================================

def write_png(path, rgb8):
    h, w, _ = rgb8.shape
    raw = bytearray()
    for y in range(h):
        raw.append(0)
        raw += rgb8[y].tobytes()

    def chunk(tag, data):
        return (struct.pack(">I", len(data)) + tag + data +
                struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF))

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 6))
    png += chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)


# ===========================================================================
# 7. Main
# ===========================================================================

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("study", choices=sorted(STUDIES))
    ap.add_argument("--camera", default="Canonical")
    ap.add_argument("--width", type=int, default=1280)
    ap.add_argument("--height", type=int, default=720)
    ap.add_argument("--samples", type=int, default=32)
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    def log(msg):
        print(msg, flush=True)

    scene_name, out_stem = STUDIES[args.study]
    tscn = os.path.join(REPO, "scenes", f"{scene_name}.tscn")
    log(f"[{args.study}] reading {os.path.relpath(tscn, REPO)}")
    scene = Scene(tscn)
    palette = parse_palette(os.path.join(REPO, "scripts", "room_palette.gd"))

    import bpy
    import numpy as np

    env = build(scene, palette, args.camera, log)

    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = args.samples
    sc.cycles.use_denoising = True
    sc.cycles.use_adaptive_sampling = True
    sc.cycles.adaptive_threshold = 0.02
    # Modest bounce budget: enough for the room to read, not a GI showcase.
    sc.cycles.max_bounces = 4
    sc.cycles.diffuse_bounces = 3
    sc.cycles.glossy_bounces = 2
    sc.cycles.transmission_bounces = 2
    sc.cycles.transparent_max_bounces = 2
    sc.cycles.volume_bounces = 0
    sc.cycles.caustics_reflective = False
    sc.cycles.caustics_refractive = False
    sc.render.resolution_x = args.width
    sc.render.resolution_y = args.height
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = False
    # Raw linear out; Godot's own chain is applied afterwards in numpy.
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.look = "None"
    sc.render.image_settings.file_format = "OPEN_EXR"
    sc.render.image_settings.color_depth = "32"
    sc.render.image_settings.color_mode = "RGB"

    exr = f"/tmp/render_{args.study}_{args.camera}.exr"
    sc.render.filepath = exr
    log(f"[{args.study}] rendering {args.width}x{args.height} "
        f"@ {args.samples} samples (Cycles CPU, denoised)")
    bpy.ops.render.render(write_still=True)

    img = bpy.data.images.load(exr)
    w, h = img.size
    buf = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(buf)
    lin = buf.reshape(h, w, 4)[::-1, :, :3].astype(np.float64)

    log(f"[{args.study}] linear stats  min={lin.min():.4f} "
        f"max={lin.max():.3f} mean={lin.mean():.4f} "
        f"p99={np.percentile(lin, 99):.3f}")

    srgb = post_process(lin, env, np)
    out = args.out or os.path.join(REPO, "renders", f"{out_stem}_{args.camera}.png")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    write_png(out, (srgb * 255.0 + 0.5).astype(np.uint8))

    g = srgb.mean()
    log(f"[{args.study}] output mean={g:.3f}  "
        f"dark<0.05={(srgb.max(axis=2) < 0.05).mean() * 100:.1f}%  "
        f"bright>0.9={(srgb.max(axis=2) > 0.9).mean() * 100:.1f}%")
    log(f"[{args.study}] wrote {os.path.relpath(out, REPO)}")


if __name__ == "__main__":
    main()
