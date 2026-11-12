import assert from 'node:assert/strict'
import {test} from 'node:test'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
const html=readFileSync('index.html','utf8')
const tag='<script id="orbita-embedded-map" type="application/json">'
const start=html.indexOf(tag),end=html.indexOf('</script>',start+tag.length)
assert(start>=0&&end>start,'No deployed original ORBITA modules')
const map=JSON.parse(html.slice(start+tag.length,end))
const hashes=JSON.parse(readFileSync('tests/integration-original-modules.json','utf8'))
const social=readFileSync('source/src/scene/SocialDrops.tsx','utf8')
const beacon=readFileSync('source/src/scene/Beacon.tsx','utf8')
const js=key=>Buffer.from(map[key].split(',')[1],'base64').toString('utf8')
test('original visuals are custody-pinned in actual standalone',()=>{
  for(const [id,hash] of Object.entries(hashes))
    assert.equal(createHash('sha256').update(map[id]??'').digest('hex'),hash,id)
  assert.match(js('orbita/scene/SocialDrops'),/beaconStableLights/)
  assert.match(js('orbita/scene/Beacon'),/__orbitaBeaconTestTrigger/)
  assert.equal(Object.keys(map).length>=60,true,'No original 3D island missing')
})
test('opt-in stable lights preserve six source logos, EXTRUDE data and physical materials',()=>{
  const original=[
    'depth: 4.6, bevelEnabled: true',
    'bevelThickness: .7, bevelSize: .5, bevelSegments: 3, curveSegments: 10',
    'new THREE.MeshPhysicalMaterial',
    'clearcoat:1',
    'clearcoatRoughness:.18',
    'emissiveIntensity:.14',
    'g.position.set(bx*(.15+.85*x), 34 - 28.5*x + hover*x',
    'g.scale.setScalar(Math.max(0.005, Math.min(1, x*1.3)) * .82)',
    'g.rotation.set(.03*Math.sin(state.clock.elapsedTime+i)',
    '<pointLight color={entry.color} intensity={2.6} distance={5} decay={2}/>',
    'color={entry.color} intensity={0} distance={5} decay={2}',
    'light.position.copy(g.position);light.intensity=2.6',
    "get('beaconStableLights') === '1'",
  ]
  for(const line of original)assert.ok(social.includes(line),'Removed original logo visual: '+line)
  assert.match(social,/\{!stableLights && <pointLight/,
    'Default render must remain the EXACT original nested lights')
  assert.match(social,/\{stableLights && <pointLight/,
    'Experiment substitutes six real 0-intensity point lights')
  assert.match(beacon,/openPanel\('beacon'\)/)
  assert.match(beacon,/st\.pendingOpen = window\.setTimeout/)
  assert.match(beacon,/waves\.forEach/)
})
console.log('BEACON_STABLE_LIGHTS_ORIGINAL_VISUAL_STANDALONE_CONTRACT_PASS')
