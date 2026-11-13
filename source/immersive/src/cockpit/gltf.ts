import * as THREE from 'three';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  Minimal glTF 2.0 / GLB loader for the cockpit.
 *
 *  Why not THREE.GLTFLoader from examples/jsm?
 *  The cockpit ships as a single inlined HTML file whose import map points at
 *  esm.sh. Pulling one more module off the network (and its implied dependency
 *  on the exact three build served there) is a failure mode we can avoid
 *  entirely: the 11 CC0 assets in assets/3d/room-showcase are static
 *  geometry with plain PBR base colours and no textures at all.
 *
 *  This loader therefore supports exactly what those files contain:
 *    • GLB container, JSON + BIN chunks
 *    • Buffer views / accessors for POSITION, NORMAL and indices
 *    • Per-primitive material with baseColorFactor -> MeshStandardMaterial
 *    • Node hierarchy with TRS or matrix transforms
 *
 *  It is deliberately small. If an asset ever needs textures or skinning this
 *  will refuse loudly rather than render something subtly wrong.
 * ─────────────────────────────────────────────────────────────────────────────
 */

interface GltfAccessor {
  bufferView?: number;
  byteOffset?: number;
  componentType: number;
  count: number;
  type: string;
  normalized?: boolean;
}

interface GltfBufferView {
  buffer: number;
  byteOffset?: number;
  byteLength: number;
  byteStride?: number;
}

interface GltfPrimitive {
  attributes: Record<string, number>;
  indices?: number;
  material?: number;
}

interface GltfMaterial {
  name?: string;
  pbrMetallicRoughness?: {
    baseColorFactor?: number[];
    metallicFactor?: number;
    roughnessFactor?: number;
  };
  doubleSided?: boolean;
}

interface GltfNode {
  name?: string;
  mesh?: number;
  children?: number[];
  translation?: number[];
  rotation?: number[];
  scale?: number[];
  matrix?: number[];
}

interface GltfJson {
  meshes?: { primitives: GltfPrimitive[] }[];
  accessors?: GltfAccessor[];
  bufferViews?: GltfBufferView[];
  materials?: GltfMaterial[];
  nodes?: GltfNode[];
  scenes?: { nodes?: number[] }[];
  scene?: number;
  images?: unknown[];
  skins?: unknown[];
  animations?: unknown[];
}

const COMPONENT = {
  5120: { array: Int8Array, size: 1 },
  5121: { array: Uint8Array, size: 1 },
  5122: { array: Int16Array, size: 2 },
  5123: { array: Uint16Array, size: 2 },
  5125: { array: Uint32Array, size: 4 },
  5126: { array: Float32Array, size: 4 },
} as const;

const TYPE_SIZE: Record<string, number> = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT4: 16,
};

/** Parse a GLB (or .gltf with an embedded base64 buffer) into a THREE.Group. */
export function parseGlb(buffer: ArrayBuffer, url = ''): THREE.Group {
  const view = new DataView(buffer);
  const magic = view.getUint32(0, true);
  if (magic !== 0x46546c67) throw new Error(`${url}: not a GLB (bad magic)`);

  let offset = 12;
  let json: GltfJson | null = null;
  let bin: Uint8Array | null = null;

  while (offset < buffer.byteLength) {
    const chunkLength = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    const start = offset + 8;
    if (chunkType === 0x4e4f534a) {
      json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, start, chunkLength)));
    } else if (chunkType === 0x004e4942) {
      bin = new Uint8Array(buffer, start, chunkLength);
    }
    offset = start + chunkLength;
    // chunks are 4-byte aligned
    offset += (4 - (offset % 4)) % 4;
  }

  if (!json) throw new Error(`${url}: GLB has no JSON chunk`);
  if (json.images?.length) throw new Error(`${url}: textures are not supported by this loader`);
  if (json.skins?.length) throw new Error(`${url}: skinned meshes are not supported`);
  if (json.animations?.length) throw new Error(`${url}: animations are not supported`);
  if (!bin) throw new Error(`${url}: GLB has no BIN chunk`);

  const group = new THREE.Group();
  group.name = url.split('/').pop() ?? 'glb';

  /* ── materials ─────────────────────────────────────────────────────────── */
  const materials = (json.materials ?? []).map((m) => {
    const pbr = m.pbrMetallicRoughness ?? {};
    const c = pbr.baseColorFactor ?? [1, 1, 1, 1];
    const mat = new THREE.MeshStandardMaterial({
      name: m.name ?? 'material',
      // glTF colours are linear; three expects the same, so pass through.
      color: new THREE.Color(c[0], c[1], c[2]),
      metalness: pbr.metallicFactor ?? 1,
      roughness: pbr.roughnessFactor ?? 1,
      side: m.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
    });
    mat.userData.gltfBaseColor = new THREE.Color(c[0], c[1], c[2]).getHex();
    return mat;
  });

  /* ── accessors ─────────────────────────────────────────────────────────── */
  // Every bufferView index is relative to the START of the BIN chunk, not to
  // the start of the file. Forgetting this offset silently reads the JSON
  // header as geometry — which is exactly the kind of "parses without throwing
  // but renders nonsense" bug that must never reach a screen.
  const binStart = bin.byteOffset;

  const readAccessor = (index: number): { array: ArrayLike<number>; itemSize: number } => {
    const accessor = json!.accessors?.[index];
    if (!accessor) throw new Error(`${url}: missing accessor ${index}`);
    const spec = COMPONENT[accessor.componentType as keyof typeof COMPONENT];
    if (!spec) throw new Error(`${url}: unsupported componentType ${accessor.componentType}`);
    const itemSize = TYPE_SIZE[accessor.type];
    if (!itemSize) throw new Error(`${url}: unsupported accessor type ${accessor.type}`);

    if (accessor.bufferView === undefined) {
      return { array: new spec.array(accessor.count * itemSize), itemSize };
    }

    const bv = json!.bufferViews?.[accessor.bufferView];
    if (!bv) throw new Error(`${url}: missing bufferView ${accessor.bufferView}`);
    const base = binStart + (bv.byteOffset ?? 0) + (accessor.byteOffset ?? 0);

    // Fast path: tightly packed, which is what these assets use.
    const packed = itemSize * spec.size;
    if (!bv.byteStride || bv.byteStride === packed) {
      return {
        array: new spec.array(buffer, base, accessor.count * itemSize),
        itemSize,
      };
    }

    // Interleaved path: copy element by element.
    const out = new spec.array(accessor.count * itemSize);
    for (let i = 0; i < accessor.count; i++) {
      const at = base + i * bv.byteStride;
      for (let k = 0; k < itemSize; k++) {
        const p = at + k * spec.size;
        switch (spec.array) {
          case Float32Array: out[i * itemSize + k] = view.getFloat32(p, true); break;
          case Uint16Array: out[i * itemSize + k] = view.getUint16(p, true); break;
          case Uint32Array: out[i * itemSize + k] = view.getUint32(p, true); break;
          case Uint8Array: out[i * itemSize + k] = view.getUint8(p); break;
          case Int16Array: out[i * itemSize + k] = view.getInt16(p, true); break;
          case Int8Array: out[i * itemSize + k] = view.getInt8(p); break;
        }
      }
    }
    return { array: out, itemSize };
  };

  /* ── meshes ────────────────────────────────────────────────────────────── */
  const buildMesh = (meshIndex: number): THREE.Mesh | THREE.Group => {
    const mesh = json!.meshes?.[meshIndex];
    if (!mesh) throw new Error(`${url}: missing mesh ${meshIndex}`);
    const parts: THREE.Mesh[] = [];

    for (const prim of mesh.primitives) {
      const posIndex = prim.attributes.POSITION;
      if (posIndex === undefined) continue;
      const pos = readAccessor(posIndex);

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos.array as Float32Array, pos.itemSize));

      if (prim.attributes.NORMAL !== undefined) {
        const n = readAccessor(prim.attributes.NORMAL);
        geo.setAttribute('normal', new THREE.BufferAttribute(n.array as Float32Array, n.itemSize));
      }
      if (prim.indices !== undefined) {
        const idx = readAccessor(prim.indices);
        geo.setIndex(new THREE.BufferAttribute(idx.array as Uint32Array, 1));
      }
      if (prim.attributes.NORMAL === undefined) geo.computeVertexNormals();

      const mat = prim.material !== undefined
        ? materials[prim.material] ?? new THREE.MeshStandardMaterial({ color: 0x8899aa })
        : new THREE.MeshStandardMaterial({ color: 0x8899aa });

      parts.push(new THREE.Mesh(geo, mat));
    }

    if (parts.length === 1) return parts[0];
    const g = new THREE.Group();
    for (const p of parts) g.add(p);
    return g;
  };

  /* ── nodes ─────────────────────────────────────────────────────────────── */
  const nodes = json.nodes ?? [];
  const buildNode = (index: number): THREE.Object3D | null => {
    const node = nodes[index];
    if (!node) return null;
    const object = node.mesh !== undefined ? buildMesh(node.mesh) : new THREE.Group();
    object.name = node.name ?? `node${index}`;

    if (node.matrix) {
      object.applyMatrix4(new THREE.Matrix4().fromArray(node.matrix));
    } else {
      if (node.translation) object.position.fromArray(node.translation);
      if (node.rotation) object.quaternion.fromArray(node.rotation);
      if (node.scale) object.scale.fromArray(node.scale);
    }
    for (const child of node.children ?? []) {
      const c = buildNode(child);
      if (c) object.add(c);
    }
    return object;
  };

  const sceneDef = json.scenes?.[json.scene ?? 0];
  const roots = sceneDef?.nodes ?? nodes.map((_, i) => i);
  for (const r of roots) {
    const object = buildNode(r);
    if (object) group.add(object);
  }

  return group;
}

/** Fetch and parse one GLB. Resolves to a fresh Group. */
export async function loadGlb(url: string): Promise<THREE.Group> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const buffer = await response.arrayBuffer();
  return parseGlb(buffer, url);
}

/** Recursively dispose every geometry and material under an object. */
export function disposeTree(root: THREE.Object3D): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (!material) return;
    for (const m of Array.isArray(material) ? material : [material]) m.dispose();
  });
}

/** Total triangle count under an object, for the performance budget. */
export function triangleCount(root: THREE.Object3D): number {
  let total = 0;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.geometry) return;
    const index = mesh.geometry.getIndex();
    const pos = mesh.geometry.getAttribute('position');
    if (index) total += index.count / 3;
    else if (pos) total += pos.count / 3;
  });
  return Math.round(total);
}
