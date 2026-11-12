/**
 * Publish only the query-flagged source-identical UEH batching experiment.
 * All other frozen ORBITA modules, including Colossus, stay byte-for-byte.
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
const start=html.indexOf(tag),end=html.indexOf('</script>',start+tag.length)
assert(start>=0&&end>start,'Published root ORBITA map missing')
const original=JSON.parse(html.slice(start+tag.length,end))
const frozen=JSON.parse(readFileSync(baselinePath,'utf8'))
const key='orbita/reality/RealityHost'
assert(original[key]?.startsWith('data:text/javascript;base64,'),'Original HEX module missing')
for(const [name,hash] of Object.entries(frozen)) {
  if(name!==key)assert.equal(createHash('sha256').update(original[name]??'').digest('hex'),
    hash,'Refuse visual changes to unrelated module: '+name)
}
const source=readFileSync(resolve(srcRoot,'reality/RealityHost.tsx'),'utf8')
assert(source.includes("hexBatchProbe === 'extended'"),'Experiment must remain query-only')
assert(source.includes("hexBatchProbe === 'manual-overlap'"),'Original-scene overlap image parity diagnostic missing')
assert(source.includes('hexMergedAway'),'Original geometry custody marker missing')
const output=ts.transpileModule(source,{
  fileName:'reality/RealityHost.tsx',reportDiagnostics:true,
  compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,
    module:ts.ModuleKind.ESNext,removeComments:false},
})
const errors=(output.diagnostics??[]).filter(x=>x.category===ts.DiagnosticCategory.Error)
assert.equal(errors.length,0,'HEX transpilation failed')
const js=output.outputText.replace(/(\bfrom\s*['"])(\.{1,2}\/[^'"]+)(['"])/g,
  (_all,before,importPath,after)=>{
    const abs=resolve(srcRoot,'reality',importPath)
    const name=relative(srcRoot,abs).replace(/\\/g,'/').replace(/\.(tsx?|jsx?)$/,'')
    assert(!name.startsWith('..'),'Invalid import: '+importPath)
    assert(original['orbita/'+name],'Missing embedded HEX import: '+name)
    return before+'orbita/'+name+after
  })
assert(!/\bfrom\s*['"]\.{1,2}\//.test(js),'Unresolved relative HEX import')
const value='data:text/javascript;base64,'+Buffer.from(js,'utf8').toString('base64')
const updated={...original,[key]:value}
const baseline={...frozen,[key]:createHash('sha256').update(value).digest('hex')}
for(const [name,old] of Object.entries(original))if(name!==key)
  assert.equal(updated[name],old,'Unrelated embedded visual module changed: '+name)
assert.deepEqual(Object.keys(updated),Object.keys(original),'Original standalone module map changed')
const nextHtml=html.slice(0,start+tag.length)+JSON.stringify(updated)+html.slice(end)
const nextFrozen=JSON.stringify(baseline,null,2)+'\n'
if(nextHtml!==html)writeFileSync(htmlPath,nextHtml)
if(nextFrozen!==readFileSync(baselinePath,'utf8'))writeFileSync(baselinePath,nextFrozen)
console.log('HEX_EXACT_BATCH_STANDALONE_SYNC_OK: only '+key+' changed; 51 unchanged source module hashes preserved; '+baseline[key])
