import assert from 'node:assert/strict'
import * as THREE from 'three'
import { collectScanCullMeshes, updateScanCullMeshes, createMaterializeUniforms, patchMaterialize } from '../src/scene/materialize.ts'

const u = createMaterializeUniforms('#ff9b30')
const lowMaterial = patchMaterialize(new THREE.MeshStandardMaterial(), u, 'decorative-low-tag')
const highMaterial = patchMaterialize(new THREE.MeshStandardMaterial(), u, 'different-high-tag')
assert.equal(lowMaterial.customProgramCacheKey(), highMaterial.customProgramCacheKey(),
  'identical GLSL must not fork GPU shader programs by arbitrary material tag')

const root = new THREE.Group()
const low = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), lowMaterial)
const high = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), highMaterial)
const dynamic = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), highMaterial)
low.position.y = 0
high.position.y = 3
dynamic.position.y = 4
dynamic.visible = false
root.add(low, high, dynamic)
const entries = collectScanCullMeshes(root)
assert.equal(entries.length, 2, 'dynamic initially-hidden mesh must not be controlled')
updateScanCullMeshes(root, entries, 0.1, u.uWireHeight.value, false)
assert.equal(low.visible, true, 'visible base geometry preserved')
assert.equal(high.visible, false, 'entirely shader-discarded geometry must skip draw')
assert.equal(dynamic.visible, false, 'dynamic visibility ownership retained')
updateScanCullMeshes(root, entries, 2.2, u.uWireHeight.value, false)
assert.equal(high.visible, true, 'geometry comes back before any shader-visible fragment')
updateScanCullMeshes(root, entries, 0, u.uWireHeight.value, true)
assert.equal(high.visible, true, 'completed summon renders entire model')
const nested = new THREE.Group()
const tilted = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), highMaterial)
nested.position.y = 1.4
nested.rotation.z = Math.PI/4
nested.add(tilted)
root.add(nested)
const rotated = collectScanCullMeshes(nested)
assert.equal(rotated.length,1)
updateScanCullMeshes(nested, rotated, -8, u.uWireHeight.value, false)
assert.equal(tilted.visible,false,'world transforms used for threshold')
updateScanCullMeshes(nested, rotated, 8, u.uWireHeight.value, false)
assert.equal(tilted.visible,true,'no permanent hidden state')
console.log('PASS: conservative scan-culling world transforms, shader cache dedup and dynamic visibility custody')
