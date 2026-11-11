/**
 * HEX release acceptance (not a diagnostic PASS):
 * require frame pacing throughout idle, first reveal, track switch,
 * retract, and second reveal on the real published standalone.
 * A green build or visual-preservation test never overrides a freeze.
 *
 * No query flags here: this is the ACTUAL visitor-facing default.
 */
import {readFileSync} from 'node:fs'
import {strict as assert} from 'node:assert'
const reports=JSON.parse(readFileSync('hex-evidence/bench.json','utf8'))
const candidate=reports.find(r=>r.name==='hex-candidate')
assert.ok(candidate,'Benchmark must include real published HEX candidate')
assert.equal(candidate.error,undefined,'HEX browser run must complete')
assert.equal(candidate.errors?.length,0,'No browser page exceptions allowed')
assert.equal(candidate.failures?.length,0,'No missing visual/audio assets allowed')
assert.equal(candidate.final?.contextLost,false,'WebGL context must survive lifecycle')
const stages=['idle_frametime','first_hex_ignite_sweep','switch_to_bluesky','retract','second_hex_ignite_sweep']
const byName=new Map(candidate.samples.map(s=>[s.name,s]))
const failures=[]
for(const name of stages){
 const sample=byName.get(name)
 if(!sample){failures.push(name+': MISSING stage');continue}
 if(!(sample.frames>=10&&sample.durationMs>0)){
  failures.push(name+': no usable rAF evidence')
  continue
 }
 // A single multi-second silent tail or freeze is an automatic rejection.
 // 120ms max frame (upper limit, not an aspirational quality target);
 // p95 <= 34ms protects subjective continuity on a native GPU.
 const max=Math.max(sample.maxObservedGapMs??Infinity,sample.silentTailMs??Infinity)
 const p95=sample.p95Ms??Infinity
 const longTask=sample.maxLongTaskMs??Infinity
 if(max>120)failures.push(name+': visible rAF freeze '+max+'ms (>120ms)')
 if(p95>34)failures.push(name+': p95 '+p95+'ms (>34ms)')
 if(longTask>120)failures.push(name+': main-thread long task '+longTask+'ms (>120ms)')
}
console.log('HEX_NO_HITCH_RELEASE_GATE '+JSON.stringify({
 candidateHead:'actual-default',stages:stages.map(name=>{
 const s=byName.get(name)
 return {name,maxRafGapMs:s?.maxObservedGapMs,silentTailMs:s?.silentTailMs,
 p95Ms:s?.p95Ms,maxLongTaskMs:s?.maxLongTaskMs,frames:s?.frames}
 }),failureCount:failures.length,failures
},null,2))
if(failures.length){
 console.error('HEX_RELEASE_REJECTED: authentic first appearance/continuous switch/retract/replay still janks. No merge.')
 process.exitCode=1
}
