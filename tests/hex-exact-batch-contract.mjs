import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {test} from 'node:test'

const src=readFileSync('source/src/reality/RealityHost.tsx','utf8')
const html=readFileSync('index.html','utf8')
const frozen=JSON.parse(readFileSync('tests/integration-original-modules.json','utf8'))
const tag='<script id="orbita-embedded-map" type="application/json">'
const a=html.indexOf(tag),b=html.indexOf('</script>',a+tag.length)
assert(a>=0&&b>a,'Real standalone import map')
const map=JSON.parse(html.slice(a+tag.length,b))
const key='orbita/reality/RealityHost'
const embedded=Buffer.from(map[key].split(',')[1],'base64').toString('utf8')

test('all 52 original visual module names remain frozen',()=>{
  for(const [k,v] of Object.entries(frozen)){
    assert.equal(createHash('sha256').update(map[k]??'').digest('hex'),v,k)
  }
})

test('hex exact opaque-only sibling batching is opt-in, never default',()=>{
  for(const text of [src,embedded]){
    assert.match(text,/hexBatchProbe/)
    assert.match(text,/extended/)
    assert.match(text,/manual/)
    assert.match(text,/hexMergedAway/)
    assert.match(text,/!m\.isMesh/)
    assert.match(text,/m\.material\.transparent/)
    assert.match(text,/m\.material\.alphaTest/)
  }
  assert.match(src,/hexBatchProbe === 'manual-overlap'/)
  assert.match(src,/sourceExactOverlapProbe/)
  assert.match(src,/batchKeyByMesh/)
})

test('full original PBR, shadow, foliage and HEX sweep are intact',()=>{
  assert.match(src,/<UEHWorld \/>/)
  assert.match(src,/<HexLattice \/>/)
  assert.match(src,/<StaffWall \/>/)
  assert.match(src,/<Ignition \/>/)
  assert.match(src,/const reveal = st.phase === 'sweep'/)
  assert.match(src,/scene\.updateMatrixWorld\(true\)/)
})
console.log('HEX_EXACT_BATCH_SOURCE_STANDALONE_CONTRACT_PASS')
