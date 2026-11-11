import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=p=>readFileSync(p,'utf8')
const html=read('index.html')
const tag='<script id="orbita-embedded-map" type="application/json">'
const a=html.indexOf(tag),b=html.indexOf('</script>',a+tag.length)
assert.ok(a>=0&&b>a,'Original integrated ORBITA standalone import map exists')
const map=JSON.parse(html.slice(a+tag.length,b))
assert.ok(Object.keys(map).length>=56,'Standalone retains full exhibit import map')
for(const p of ['reality/RealityHost','reality/Front']){
 const id='orbita/'+p
 assert.ok(map[id]?.startsWith('data:text/javascript;base64,'),id+' embedded')
 const js=Buffer.from(map[id].split(',')[1],'base64').toString('utf8')
 assert.ok(js.length>2000,id+' non-placeholder code')
 if(p.endsWith('RealityHost')){
  assert.match(js,/paused-expensive-private-draw/,'Cooperative GPU safety budget embedded')
  assert.match(js,/new THREE\.WebGLRenderTarget\(96,\s*96/,'Private target not output resolution')
  assert.match(js,/RW\.uRW\.value\.copy\(rw\)/,'Global HEX uniforms restored')
  assert.match(js,/gl\.setRenderTarget\(oldTarget\)/,'Visible framebuffer restored')
 }
}
const source=read('source/src/reality/RealityHost.tsx')
assert.match(source,/<UEHWorld\s*\/>/,'Entire source 3D environment preserved')
assert.match(source,/<HexLattice\s*\/>/,'Source hexagonal prism mesh preserved')
assert.match(source,/<StaffWall\s*\/>/,'Source five-line wall preserved')
assert.match(source,/<Ignition\s*\/>/,'Ignition VFX preserved')
assert.match(source,/<Sheets\s*\/>/,'Musical sheet triggers preserved')
assert.match(source,/RW\.uRW\.value\.copy\(rw\)/,'Private preview restores original HEX state')
const mask=read('source/src/reality/mask.ts')
for(const scalar of ['uRWGrowLen','uRWGlow','uRWWind']){
 assert.ok(mask.includes(scalar),'HEX preserves material-specific '+scalar+' as a shared GLSL uniform')
}
assert.match(mask,/Number\(gl\.toFixed\(1\)\)/,'Original 0.1-unit growth precision preserved')
assert.match(mask,/Number\(glow\.toFixed\(2\)\)/,'Original 0.01-unit glow precision preserved')
assert.match(mask,/Number\(wind\.toFixed\(3\)\)/,'Original 0.001-unit wind precision preserved')
assert.match(mask,/rw-uniform-v2/,'Cache key tracks GLSL structure, not numeric settings')
assert.match(mask,/const originalKey = prevKey \? prevKey\.call\(m\) : ''/,'Prior user shader cache key retained')
const maskJs=Buffer.from(map['orbita/reality/mask'].split(',')[1],'base64').toString('utf8')
assert.match(maskJs,/rw-uniform-v2/,'Production HTML uses new shared material programs')
assert.match(maskJs,/uRWGrowLen/,'Production HTML preserves material-specific uniforms')
const front=read('source/src/reality/Front.tsx')
assert.match(front,/const WALL_H = 120/,'Original wall height unchanged')
assert.match(front,/new THREE\.CylinderGeometry\(1, 1, 1, 160, 24, true\)/,'Original wall mesh resolution retained')
assert.match(front,/const R = low \? 104 : 118/,'Original HEX cell radius high/low unchanged')
const world=read('source/src/reality/worlds/UEH.tsx')
assert.match(world,/export function UEHWorld\(\)/,'Original UEH world still complete')
const experience=read('source/src/scene/Experience.tsx')
assert.match(experience,/shadow-mapSize=\{\[2048,\s*2048\]\}/,'Real 2048-px shadow unchanged')
assert.match(experience,/<Bloom intensity=\{low \? 0\.9 : 1\.25\}/,'Original Bloom retained')
assert.match(experience,/<ToneMapping mode=\{ToneMappingMode\.ACES_FILMIC\}/,'Original tonemapping retained')
console.log('HEX_VISUAL_AND_STANDALONE_INVARIANTS PASS: 3D models/shaders/postprocessing/render resolution unchanged')
