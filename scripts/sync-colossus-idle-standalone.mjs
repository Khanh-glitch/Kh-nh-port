/**
 * Synchronize ONLY the Colossus warmup scheduler into the actual standalone.
 * The material, lighting, geometry, and all other embedded modules are immutable.
 * Updates the frozen integration hash for this single intentionally changed module.
 *
 * Run: npm ci --prefix source && node scripts/sync-colossus-idle-standalone.mjs
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
const start=html.indexOf(tag)
const end=html.indexOf('</script>',start+tag.length)
assert(start>=0&&end>start,'Published standalone embedded module map missing')
const jsonStart=start+tag.length
const original=JSON.parse(html.slice(jsonStart,end))
const frozen=JSON.parse(readFileSync(baselinePath,'utf8'))
const key='orbita/scene/ShowcaseWarmup'
assert(original[key]?.startsWith('data:text/javascript;base64,'),'Original robot warmup missing')
for(const [name,expected] of Object.entries(frozen)){
  if(name===key)continue
  assert.equal(createHash('sha256').update(original[name]??'').digest('hex'),expected,
    'Refusing to publish: unrelated embedded module differs from frozen visual baseline: '+name)
}
const source=readFileSync(resolve(srcRoot,'scene/ShowcaseWarmup.tsx'),'utf8')
assert(source.includes('waiting-for-idle-renderer'),'Missing resumable busy-renderer state')
assert(!source.includes('prewarm-skipped-busy-renderer'),'Old permanent GPU warmup skip must be removed')
const output=ts.transpileModule(source,{
  fileName:'scene/ShowcaseWarmup.tsx',reportDiagnostics:true,
  compilerOptions:{
    jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,
    module:ts.ModuleKind.ESNext,removeComments:false,
  },
})
const errors=(output.diagnostics??[]).filter(x=>x.category===ts.DiagnosticCategory.Error)
assert.equal(errors.length,0,'TS warmup transpilation must succeed')
const js=output.outputText.replace(/(\bfrom\s*['"])(\.{1,2}\/[^'"]+)(['"])/g,(_all,before,importPath,after)=>{
  const abs=resolve(srcRoot,'scene',importPath)
  const name=relative(srcRoot,abs).replace(/\\/g,'/').replace(/\.(tsx?|jsx?)$/,'')
  assert(!name.startsWith('..'),'Forbidden external warmup import: '+importPath)
  assert(original['orbita/'+name],'Unresolved warmup import: '+name)
  return before+'orbita/'+name+after
})
assert(!/\bfrom\s*['"]\.{1,2}\//.test(js),'Unresolved local warmup import')
const updated={...original,[key]:'data:text/javascript;base64,'+Buffer.from(js,'utf8').toString('base64')}
for(const [name,value] of Object.entries(original)){
  if(name!==key)assert.equal(updated[name],value,'Standalone visual module changed: '+name)
}
const nextHash=createHash('sha256').update(updated[key]).digest('hex')
const updatedBaseline={...frozen,[key]:nextHash}
const updatedHtml=html.slice(0,jsonStart)+JSON.stringify(updated)+html.slice(end)
const updatedBaselineText=JSON.stringify(updatedBaseline,null,2)+'\n'
if(updatedHtml!==html)writeFileSync(htmlPath,updatedHtml)
if(readFileSync(baselinePath,'utf8')!==updatedBaselineText)
  writeFileSync(baselinePath,updatedBaselineText)
console.log('COLOSSUS_STANDALONE_SYNC_OK: only '+key+' changed; full visual baseline preserved; warmup SHA '+nextHash)
