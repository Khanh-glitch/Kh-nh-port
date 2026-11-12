/**
 * Publish only TWO opt-in original-visual experiments to actual standalone:
 * 1) Geometry-exact static HEX batching
 * 2) Source-identical original Cinema range-aware light readback
 * Every other embedded source module remains byte-for-byte intact.
 */
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readFileSync,writeFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {dirname,relative,resolve} from 'node:path'
const require=createRequire(import.meta.url)
const ts=require('../source/node_modules/typescript')
const root=resolve(import.meta.dirname,'..')
const srcRoot=resolve(root,'source/src')
const htmlPath=resolve(root,'index.html')
const baselinePath=resolve(root,'tests/integration-original-modules.json')
const tag='<script id="orbita-embedded-map" type="application/json">'
const html=readFileSync(htmlPath,'utf8')
const start=html.indexOf(tag),end=html.indexOf('</script>',start+tag.length)
assert(start>=0&&end>start,'Published root ORBITA map missing')
const original=JSON.parse(html.slice(start+tag.length,end))
const frozen=JSON.parse(readFileSync(baselinePath,'utf8'))
const sourceModules=['reality/RealityHost','scene/Cinema']
const allowed=new Set(sourceModules.map(s=>'orbita/'+s))
for(const key of allowed)
  assert(original[key]?.startsWith('data:text/javascript;base64,'),
    'Required original module missing '+key)
for(const [name,hash] of Object.entries(frozen)) {
  if(!allowed.has(name)) assert.equal(
    createHash('sha256').update(original[name]??'').digest('hex'),hash,
    'Refusing to change unrelated visual module '+name)
}
const updated={...original}
const baseline={...frozen}
for(const modulePath of sourceModules){
  const source=readFileSync(resolve(srcRoot,modulePath+'.tsx'),'utf8')
  if(modulePath==='reality/RealityHost'){
    assert(source.includes("hexBatchProbe === 'extended'"),'Batching must remain opt-in')
    assert(source.includes("hexBatchProbe === 'manual-overlap'"),
      'Original 18-stage overlap pixel verification missing')
    assert(source.includes('hexMergedAway'),'Original mesh custody missing')
  }
  if(modulePath==='scene/Cinema'){
    assert(source.includes("get('hexCinemaDistanceAwareLight') === '1'"),
      'Cinema distance-aware GPU readback MUST remain opt-in')
    assert(source.includes('const SW = 1024')&&source.includes('const SH = 450'),
      'The exact original movie resolution MUST be preserved')
    assert(source.includes('distanceToCinema > 24'),'Original light distance safety gate missing')
    assert(source.includes('screenTex.tex.needsUpdate = true'),
      'Original actual Cinema film drawing disabled')
  }
  const output=ts.transpileModule(source,{
    fileName:modulePath+'.tsx',reportDiagnostics:true,
    compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,
      module:ts.ModuleKind.ESNext,removeComments:false},
  })
  const errors=(output.diagnostics??[]).filter(x=>x.category===ts.DiagnosticCategory.Error)
  assert.equal(errors.length,0,'TypeScript failed in '+modulePath)
  const js=output.outputText.replace(/(\bfrom\s*['"])(\.{1,2}\/[^'"]+)(['"])/g,
    (_all,before,importPath,after)=>{
      const abs=resolve(srcRoot,dirname(modulePath),importPath)
      const name=relative(srcRoot,abs).replace(/\\/g,'/').replace(/\.(tsx?|jsx?)$/,'')
      assert(!name.startsWith('..'),'Invalid embedded import '+importPath)
      assert(original['orbita/'+name],'Missing embedded import '+name)
      return before+'orbita/'+name+after
    })
  assert(!/\bfrom\s*['"]\.{1,2}\//.test(js),'Unresolved source import '+modulePath)
  const key='orbita/'+modulePath
  updated[key]='data:text/javascript;base64,'+Buffer.from(js,'utf8').toString('base64')
  baseline[key]=createHash('sha256').update(updated[key]).digest('hex')
}
for(const [name,old] of Object.entries(original)){
  if(!allowed.has(name))assert.equal(updated[name],old,
    'Unrelated embedded visual module changed '+name)
}
assert.deepEqual(Object.keys(updated),Object.keys(original),'Original embedded module map changed')
const nextHtml=html.slice(0,start+tag.length)+JSON.stringify(updated)+html.slice(end)
const nextFrozen=JSON.stringify(baseline,null,2)+'\n'
if(nextHtml!==html)writeFileSync(htmlPath,nextHtml)
if(nextFrozen!==readFileSync(baselinePath,'utf8'))writeFileSync(baselinePath,nextFrozen)
console.log('HEX_CINEMA_STANDALONE_SYNC_OK: reviewed source '+[...allowed].join(',')+
  '; remaining 50 original module hashes frozen; '+JSON.stringify(
    Object.fromEntries([...allowed].map(k=>[k,baseline[k]]))))
