import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
const sourceB=readFileSync('source/src/scene/Beacon.tsx','utf8')
const sourceS=readFileSync('source/src/scene/SocialDrops.tsx','utf8')
const html=readFileSync('index.html','utf8')
const tag='<script id="orbita-embedded-map" type="application/json">'
const start=html.indexOf(tag)
const end=html.indexOf('</script>',start+tag.length)
assert(start>=0&&end>start,'Actual Cloudflare embedded module map exists')
const map=JSON.parse(html.slice(start+tag.length,end))
const frozen=JSON.parse(readFileSync('tests/integration-original-modules.json','utf8'))
const unembed=(key)=>{
  const value=map['orbita/'+key]
  assert.match(value,/^data:text\/javascript;base64,/)
  assert.equal(createHash('sha256').update(value).digest('hex'),frozen['orbita/'+key])
  return Buffer.from(value.split(',')[1],'base64').toString('utf8')
}
test('published Beacon callback and GPU identity equal reviewed source',()=>{
  const out=unembed('scene/Beacon')
  for(const token of ['__orbitaBeaconTestTrigger','__orbitaBeaconBackend',
    '__orbitaBeaconProfiles','__orbitaBeaconPanelEvents']){
    assert.ok(sourceB.includes(token),'Source lacks '+token)
    assert.ok(out.includes(token),'Deployed HTML lacks '+token)
  }
  assert.match(sourceB,/openPanel\('beacon'\)/)
  assert.match(out,/openPanel\('beacon'\)/)
})
test('original six logos/materials and zero-intensity light branch are opt-in',()=>{
  const out=unembed('scene/SocialDrops')
  for(const token of ['beaconStableLights','beaconGpuPrewarm',
    '__orbitaBeaconGpuPrewarm','waiting-for-idle','MeshPhysicalMaterial',
    'beaconShaderOnly','shader-ready-unfenced']){
    assert.ok(sourceS.includes(token),'Source missing '+token)
    assert.ok(out.includes(token),'HTML missing '+token)
  }
  assert.match(sourceS,/get\('beaconStableLights'\) === '1'/)
  assert.match(sourceS,/get\('beaconGpuPrewarm'\) === '1'/)
  assert.match(sourceS,/get\('beaconShaderOnly'\) === '1'/)
})
test('every other frozen module retains byte-identical visual baseline',()=>{
  for(const [key,hash] of Object.entries(frozen))
    assert.equal(createHash('sha256').update(map[key]??'').digest('hex'),hash,key)
})
console.log('BEACON_SOURCE_ACTUAL_STANDALONE_PARITY_PASS')
