import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import {createHash} from 'node:crypto'

const source=readFileSync('source/src/scene/ShowcaseWarmup.tsx','utf8')
const integration=readFileSync('tests/integration-original-modules.json','utf8')
const html=readFileSync('index.html','utf8')
const key='orbita/scene/ShowcaseWarmup'
const apexKey='orbita/scene/ApexShowcase'
const tag='<script id="orbita-embedded-map" type="application/json">'
const start=html.indexOf(tag)
const end=html.indexOf('</script>',start+tag.length)
assert(start>=0&&end>start,'Deployed HTML import map must exist')
const map=JSON.parse(html.slice(start+tag.length,end))
const baseline=JSON.parse(integration)

test('cold first-click prewarm does not permanently give up when frames are late',()=>{
  assert.match(source,/const LASER_BUSY_RECHECK_INTERVAL_MS = 3500/)
  assert.match(source,/info.status = 'waiting-for-idle-renderer'/)
  assert.match(source,/await new Promise<void>\(resolve => window.setTimeout\(resolve, LASER_BUSY_BACKOFF_MS\)\)/)
  assert.doesNotMatch(source,/prewarm-skipped-busy-renderer/)
  assert.match(source,/if \(interrupted\(\)\) return false/)
})

test('first-click prewarm still cancels as soon as summon starts',()=>{
  assert.match(source,/const interrupted = \(\) => disposed \|\| arenaState.mode !== 'dormant'/)
  assert.match(source,/info.status = 'cancelled-on-summon'/)
})

test('published standalone contains corrected scheduler, not only source',()=>{
  const module=map[key]
  assert.match(module,/^data:text\/javascript;base64,/)
  const compiled=Buffer.from(module.split(',')[1],'base64').toString('utf8')
  assert.match(compiled,/waiting-for-idle-renderer/)
  assert.doesNotMatch(compiled,/prewarm-skipped-busy-renderer/)
  assert.equal(createHash('sha256').update(module).digest('hex'),baseline[key])
})

test('extra original-geometry batching remains opt-in, and published version matches source',()=>{
  const source=readFileSync('source/src/scene/ApexShowcase.tsx','utf8')
  const embedded=Buffer.from(map[apexKey].split(',')[1],'base64').toString('utf8')
  for(const text of [source,embedded]){
    assert.match(text,/colossusBatchProbe/)
    assert.match(text,/extended/)
    assert.match(text,/colossusMergedAway/)
  }
  assert.equal(createHash('sha256').update(map[apexKey]).digest('hex'),baseline[apexKey])
})

test('all frozen visual modules match accepted baseline',()=>{
  for(const [name,hash] of Object.entries(baseline)){
    assert.equal(createHash('sha256').update(map[name]??'').digest('hex'),hash,name+' changed')
  }
})
