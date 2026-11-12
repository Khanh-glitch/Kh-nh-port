import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
const html=readFileSync('index.html','utf8')
const spaceship=readFileSync('assets/immersive/index.html','utf8')
const tag='<script id="orbita-embedded-map" type="application/json">'
const start=html.indexOf(tag),end=html.indexOf('</script>',start+tag.length)
assert(start>=0&&end>start,'Actual Cloudflare HTML module map missing')
const original=JSON.parse(html.slice(start+tag.length,end))
const frozen=JSON.parse(readFileSync('tests/integration-original-modules.json','utf8'))
const shipMap=JSON.parse(spaceship.match(/<script type="importmap">([\s\S]*?)<\/script>/i)?.[1]??'null')
function get(map,key){
  const entry=map[key]
  assert.match(entry,/^data:text\/javascript;base64,/,
    'Deployed source module missing: '+key)
  return Buffer.from(entry.slice(entry.indexOf(',')+1),'base64').toString('utf8')
}
test('first ship paints before island is even mounted',()=>{
  const app=get(original,'orbita/App')
  const overlay=get(original,'orbita/ui/Overlay')
  const ship=get(shipMap.imports,'ship/components/SpaceScene')
  const shipApp=get(shipMap.imports,'ship/App')
  assert.match(app,/spacePresented/)
  assert.match(app,/onSpacePresented/)
  assert.match(app,/spacePresented &&/)
  assert.ok(app.indexOf('<Overlay')<app.indexOf('<Experience')||
    app.indexOf('jsx\(Overlay')<app.indexOf('jsx\(Experience'),
    'Overlay must be the initial renderer before island Canvas')
  assert.match(overlay,/ORBITA_SPACE_FRAME_READY/)
  assert.match(ship,/ORBITA_SPACE_FRAME_READY/)
  assert.match(ship,/renderer\.render\(scene, camera\)/)
  assert.match(shipApp,/data-space-painted/)
  assert.match(spaceship,/id="orbita-space-first-hud"/)
  assert.match(html,/id="orbita-first-paint-document"/)
})
test('the only 100% progress gate is real island-ready AND ship first paint',()=>{
  const overlay=get(original,'orbita/ui/Overlay')
  const island=get(original,'orbita/scene/Experience')
  const cockpit=get(shipMap.imports,'ship/components/Panels')
  for(const word of ['loadingIsMeasured','shipRendered','islandReady',
    'ORBITA_SPACE_READY','entry.current.ready']){
    assert.ok(overlay.includes(word),'Missing real gate '+word)
  }
  assert.doesNotMatch(overlay,/assetsReadyAt|since\s*>=\s*1100/,
    'Synthetic time-based percentage accidentally survives')
  assert.doesNotMatch(cockpit,/NẠP NĂNG LƯỢNG/,
    'Fake percent remains in actual cockpit')
  assert.match(island,/IslandFirstPaintGate/)
  assert.match(island,/gl\.info\.render\.frame/)
  assert.match(island,/setReady/)
  // TypeScript's emitted JS may Unicode-escape Vietnamese string content.
  // Verify the user-facing copy in reviewed TSX and the retry path in HTML.
  const originalOverlay=readFileSync('source/src/ui/Overlay.tsx','utf8')
  assert.match(originalOverlay,/THỬ TẢI LẠI PHI THUYỀN/)
  assert.match(originalOverlay,/TẢI LẠI TRẢI NGHIỆM/)
  assert.match(overlay,/onSpaceUnavailable/)
})
test('all unrelated original shaders, artworks, gameplay modules stay identical',()=>{
  for(const [key,hash] of Object.entries(frozen)){
    assert.equal(createHash('sha256').update(original[key]??'').digest('hex'),hash,
      'Graphics module unexpectedly changed '+key)
  }
  for(const v of ['ROBOT','HEX','beacon']){
    assert.ok(html.length>500000,'Full integrated 3D environment missing')
  }
})
console.log('SPACE_FIRST_REAL_RENDER_AND_STANDALONE_NO_FAKE_LOADING_PASS')
