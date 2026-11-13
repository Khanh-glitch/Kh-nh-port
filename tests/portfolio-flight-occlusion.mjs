import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
const require = createRequire(new URL('../source/package.json', import.meta.url))
const ts = require('typescript'), THREE = require('three')
const source = readFileSync('source/src/scene/domOcclusion.ts', 'utf8')
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const sandbox = { exports: {}, require, Array, Math, encodeURIComponent }
vm.runInNewContext(code, sandbox)
const { DomOcclusion } = sandbox.exports
const camera = new THREE.PerspectiveCamera(70, 1, .1, 100)
camera.position.set(0, 0, 0); camera.updateMatrixWorld(true)
const scene = new THREE.Scene()
const corners = [new THREE.Vector3(-2, 1, -10),new THREE.Vector3(2, 1, -10),new THREE.Vector3(-2,-1,-10),new THREE.Vector3(2,-1,-10)]
const layer = { style: {} }
function sample(occlusion, start = 1) { for (let i = 0; i < 24; i++) occlusion.update(layer, camera, scene, corners, start + i * .04) }
sample(new DomOcclusion())
assert.equal(layer.style.maskImage, '')
const cube = new THREE.Mesh(new THREE.BoxGeometry(1.5, 4, 1), new THREE.MeshBasicMaterial()); cube.position.set(0,0,-5); scene.add(cube); scene.updateMatrixWorld(true)
sample(new DomOcclusion())
assert.match(layer.style.maskImage, /^url\("data:image\/svg\+xml/)
scene.remove(cube); layer.style.maskImage = ''
const nearScreen = new THREE.Mesh(new THREE.PlaneGeometry(4,2),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));nearScreen.position.z=-10;scene.add(nearScreen);scene.updateMatrixWorld(true)
sample(new DomOcclusion())
assert.equal(layer.style.maskImage, '', 'screen surface must not mask itself')
const player = readFileSync('source/src/scene/Player.tsx','utf8')
assert.match(player, /Math\.sin\(player\.pitch\) \* fz/)
assert.match(player, /player\.pos\.y \+ vel\.y \* dt/)
assert.doesNotMatch(player, /yVel\.current -=/)
const layout = readFileSync('source/src/layout.ts','utf8')
for (const url of ['facebook.com/menisrealforeverbae', 'instagram.com/menisrealforeverbae/', 'tiktok.com/@menisrealforeverbae', 'linkedin.com/in/quockhanh-le/', 'github.com/Khanh-glitch']) assert.ok(layout.includes(url), url)
const cinema = readFileSync('source/src/scene/Cinema.tsx','utf8')
for (const id of ['1Q8fq-i-Of1jMqeuFCPNCpLhZTatq4j4h','1sR4CaGBWVUNnmaIQK-gWbmYP_0W4KDko','1O5hcaN86PB4KGd9Sb476Mdahqgv6W-bY']) assert.ok(cinema.includes(id), id)
assert.match(cinema, /frame.muted = useStore.getState\(\).muted/)
const host = readFileSync('source/src/reality/RealityHost.tsx','utf8')
assert.match(host, /S.warmCritical.length === 0 && S.warmTex.length === 0/)
assert.match(host, /performance.now\(\) - S.ignitionStartedAt >= 8000/)
const sceneCode = readFileSync('source/src/scene/Experience.tsx','utf8')
assert.match(sceneCode, /concessions\.renderScale/)
assert.match(sceneCode, /perfLadder\.record\(delta\)/)
console.log('FLIGHT_AND_OCCLUSION_TEST_PASS')
