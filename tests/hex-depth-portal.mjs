import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(new URL('../source/package.json', import.meta.url))
const THREE = require('three')
const source = readFileSync('source/src/scene/Experience.tsx', 'utf8')
const map = JSON.parse(readFileSync('index.html', 'utf8').match(/<script id="orbita-embedded-map" type="application\/json">(.*?)<\/script>/s)[1])
const embedded = Buffer.from(map['orbita/scene/Experience'].split(',')[1], 'base64').toString()
for (const text of [source, embedded]) {
  assert.match(text, /class HexDepthPortalEffect extends Effect/)
  assert.match(text, /EffectAttribute\.DEPTH/)
  assert.match(text, /BlendFunction\.SRC/)
  assert.match(text, /portalProjectionInverse/)
  assert.match(text, /portalCameraWorld/)
  assert.match(text, /portalStageInverse/)
  assert.match(text, /canvas\.style\.zIndex = ['"]1['"]/) 
  assert.match(text, /dom\.d\.style\.zIndex = ['"]0['"]/) 
  assert.match(text, /orbita-hex-video-interact/)
}
// Verify the exact camera-depth reconstruction for the rotated stage, and
// that a foreground object at the same screen pixel is not classified as the
// display. The real GPU and DOM compositing are additionally smoke-tested.
const stage = new THREE.Matrix4().compose(new THREE.Vector3(-31, 0, -26),
  new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), .88), new THREE.Vector3(1,1,1))
const inverse = stage.clone().invert()
const camera = new THREE.PerspectiveCamera(72, 480/320, .1, 9000)
camera.position.copy(new THREE.Vector3(0,4.4,9).applyMatrix4(stage))
camera.lookAt(new THREE.Vector3(0,4.4,-3.52).applyMatrix4(stage))
camera.updateMatrixWorld(); camera.updateProjectionMatrix()
function isScreen(point) {
  const ndc = point.clone().project(camera)
  const sample = ndc.clone().unproject(camera).applyMatrix4(inverse)
  return Math.abs(sample.z + 3.52) < .015 && Math.abs(sample.x) < 4.8 && Math.abs(sample.y - 4.4) < 2.7
}
assert.ok(isScreen(new THREE.Vector3(-2,4.4,-3.52).applyMatrix4(stage)))
assert.ok(!isScreen(new THREE.Vector3(-2,4.4,-3.1).applyMatrix4(stage)), 'foreground must remain opaque')
assert.ok(!isScreen(new THREE.Vector3(4.81,4.4,-3.52).applyMatrix4(stage)), 'outside the screen must remain opaque')
console.log('HEX_DEPTH_PORTAL_OK')
