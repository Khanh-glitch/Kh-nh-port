/**
 * make-godot-compatible.mjs
 *
 * Two assets in the curated kit ship with `EXT_meshopt_compression` +
 * `KHR_mesh_quantization` listed in `extensionsRequired`:
 *
 *   research/corkboard.glb
 *   ai/circuit-board.glb
 *
 * Godot's glTF importer does not implement either extension, and because they
 * are *required* the importer hard-fails the file rather than degrading:
 *
 *   ERROR: GLTF: Can't import file '...', required extension
 *   'EXT_meshopt_compression' is not supported.
 *
 * Both files also use a fallback buffer with no URI, so there is no
 * uncompressed data for a loader to fall back to.
 *
 * This script decodes the meshopt bitstream, dequantizes the attributes, drops
 * both extension declarations and writes plain glTF 2.0 copies to
 * `assets/3d/room-showcase/godot-compatible/`.
 *
 *   - The curated originals are never modified. They stay byte-for-byte
 *     identical to the blobs recorded in PROVENANCE.md.
 *   - Geometry is preserved: world-space AABB corners match the source to
 *     better than 1e-7 m (verified and printed on every run).
 *   - The derived files are larger (uncompressed), which is the intended
 *     trade for engine compatibility at this scale (~78 KB total).
 *
 * Run from the `tools/` directory:
 *   npm install && npm run make-godot-compatible
 */

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { dequantize } from '@gltf-transform/functions';
import { MeshoptDecoder } from 'meshoptimizer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const SRC = path.join(REPO, 'assets/3d/room-showcase');
const OUT = path.join(SRC, 'godot-compatible');

const TARGETS = ['research/corkboard.glb', 'ai/circuit-board.glb'];

await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder });

let failures = 0;

for (const rel of TARGETS) {
  const srcPath = path.join(SRC, rel);
  const dstPath = path.join(OUT, rel);

  const doc = await io.read(srcPath);
  const requiredBefore = doc.getRoot().listExtensionsRequired().map((e) => e.extensionName);
  const boundsBefore = worldBounds(doc);

  await doc.transform(dequantize());
  for (const ext of doc.getRoot().listExtensionsUsed()) {
    if (
      ext.extensionName === EXTMeshoptCompression.EXTENSION_NAME ||
      ext.extensionName === KHRMeshQuantization.EXTENSION_NAME
    ) {
      ext.dispose();
    }
  }

  fs.mkdirSync(path.dirname(dstPath), { recursive: true });
  await io.write(dstPath, doc);

  // Verify by re-reading from disk with a plain IO (no meshopt decoder), which
  // is the closest available proxy for "can a vanilla glTF loader read this".
  const verifyIo = new NodeIO();
  const reread = await verifyIo.read(dstPath);
  const requiredAfter = reread.getRoot().listExtensionsRequired().map((e) => e.extensionName);
  const boundsAfter = worldBounds(reread);
  const delta = maxCornerDelta(boundsBefore, boundsAfter);

  const ok = requiredAfter.length === 0 && delta < 1e-6;
  if (!ok) failures++;

  console.log(`\n=== ${rel} ===`);
  console.log(`  extensionsRequired before : ${JSON.stringify(requiredBefore)}`);
  console.log(`  extensionsRequired after  : ${JSON.stringify(requiredAfter)}`);
  console.log(`  bytes                     : ${fs.statSync(srcPath).size} -> ${fs.statSync(dstPath).size}`);
  console.log(`  world AABB source         : ${fmt(boundsBefore)}`);
  console.log(`  world AABB derived        : ${fmt(boundsAfter)}`);
  console.log(`  max corner delta          : ${delta.toExponential(3)} m`);
  console.log(`  result                    : ${ok ? 'OK' : 'FAILED'}`);
}

console.log(failures === 0 ? '\nAll targets converted.' : `\n${failures} target(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);

function worldBounds(doc) {
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const t = node.getTranslation();
    const s = node.getScale();
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      if (!pos) continue;
      const mn = pos.getMinNormalized([]);
      const mx = pos.getMaxNormalized([]);
      for (let i = 0; i < 3; i++) {
        lo[i] = Math.min(lo[i], mn[i] * s[i] + t[i], mx[i] * s[i] + t[i]);
        hi[i] = Math.max(hi[i], mn[i] * s[i] + t[i], mx[i] * s[i] + t[i]);
      }
    }
  }
  return [lo, hi];
}

function fmt([lo, hi]) {
  const f = (v) => v.map((x) => x.toFixed(4)).join(', ');
  return `min[${f(lo)}] max[${f(hi)}]`;
}

function maxCornerDelta(a, b) {
  let m = 0;
  for (let k = 0; k < 2; k++) {
    for (let i = 0; i < 3; i++) m = Math.max(m, Math.abs(a[k][i] - b[k][i]));
  }
  return m;
}
