/**
 * Publish only the Colossus preparation scheduler and original-geometry
 * batching experiment into the real Cloudflare standalone.
 * All unrelated embedded modules MUST remain byte-for-byte unchanged.
 * Experimental extra batching is opt-in; default visual geometry is untouched.
 */
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readFileSync,writeFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {relative,resolve} from 'node:path'
const require=createRequire(import.meta.url)
const ts=require('../source/node_modules/typescript')
const root=resolve(import.meta.dirname,'..')
const srcRoot=resolve(root,'source/src')
const htmlPath=resolve(root,'index.html')
const baselinePath=resolve(root,'tests/integration-original-modules.json')
const tag='<script id="orbita-embedded-map" type="application/json">'
const html=readFileSync(htmlPath,'utf8')
const start=html.indexOf(tag)
const end=html.indexOf('</script>',start+tag.length)
assert(start>=0&&end>start,'Published standalone embedded module map missing')
const jsonStart=start+tag.length
const original=JSON.parse(html.slice(jsonStart,end))
const frozen=JSON.parse(readFileSync(baselinePath,'utf8'))
const targets=['scene/ShowcaseWarmup','scene/ApexShowcase']
const allowed=new Set(targets.map(t=>'orbita/'+t))
for(const key of allowed)
  assert(original[key]?.startsWith('data:text/javascript;base64,'),'Required Colossus module missing: '+key)
for(const [name,expected] of Object.entries(frozen)){
  if(allowed.has(name))continue
  assert.equal(createHash('sha256').update(original[name]??'').digest('hex'),expected,
    'Refusing to publish: unrelated embedded module differs from frozen visual baseline: '+name)
}
const updated={...original}
const updatedBaseline={...frozen}
for(const target of targets){
  const file=target+'.tsx'
  const key='orbita/'+target
  const source=readFileSync(resolve(srcRoot,file),'utf8')
  if(target==='scene/ShowcaseWarmup'){
    assert(source.includes('waiting-for-idle-renderer'),'Missing resumable busy-renderer state')
    assert(!source.includes('prewarm-skipped-busy-renderer'),'Old permanent GPU skip must be removed')
    assert(source.includes('colossusMergedAway'),'Merged-away geometry must not waste the GPU preflight budget')
  }
  if(target==='scene/ApexShowcase'){
    assert(source.includes("get('colossusBatchProbe') === 'extended'"),
      'Extra static geometry batching must remain opt-in')
    assert(source.includes('colossusMergedAway = true'),'Merged geometry custody marker missing')
  }
  const output=ts.transpileModule(source,{
    fileName:file,reportDiagnostics:true,
    compilerOptions:{
      jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,
      module:ts.ModuleKind.ESNext,removeComments:false,
    },
  })
  const errors=(output.diagnostics??[]).filter(x=>x.category===ts.DiagnosticCategory.Error)
  assert.equal(errors.length,0,'TypeScript transpilation must succeed: '+file)
  const js=output.outputText.replace(/(\bfrom\s*['"])(\.{1,2}\/[^'"]+)(['"])/g,
    (_all,before,importPath,after)=>{
      const abs=resolve(srcRoot,'scene',importPath)
      const name=relative(srcRoot,abs).replace(/\\/g,'/').replace(/\.(tsx?|jsx?)$/,'')
      assert(!name.startsWith('..'),'Forbidden external Colossus import: '+importPath)
      assert(original['orbita/'+name],'Unresolved Colossus import: '+name)
      return before+'orbita/'+name+after
    })
  assert(!/\bfrom\s*['"]\.{1,2}\//.test(js),'Unresolved local Colossus import: '+file)
  updated[key]='data:text/javascript;base64,'+Buffer.from(js,'utf8').toString('base64')
  updatedBaseline[key]=createHash('sha256').update(updated[key]).digest('hex')
}
for(const [name,value] of Object.entries(original)){
  if(!allowed.has(name))assert.equal(updated[name],value,'Forbidden visual module mutation: '+name)
}
assert.deepEqual(Object.keys(updated),Object.keys(original),'Standalone import map keys changed')
const updatedHtml=html.slice(0,jsonStart)+JSON.stringify(updated)+html.slice(end)
const updatedBaselineText=JSON.stringify(updatedBaseline,null,2)+'\n'
if(updatedHtml!==html)writeFileSync(htmlPath,updatedHtml)
if(readFileSync(baselinePath,'utf8')!==updatedBaselineText)
  writeFileSync(baselinePath,updatedBaselineText)
console.log('COLOSSUS_STANDALONE_SYNC_OK: exact allowlist '+[...allowed].join(',')+
  '; all other visual module hashes preserved; '+JSON.stringify(
    Object.fromEntries([...allowed].map(k=>[k,updatedBaseline[k]]))))
