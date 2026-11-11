/**
 * Sync only explicitly reviewed HEX/Beacon source modules to the ONE HTML
 * actually shipped by Cloudflare Pages. Anything else MUST retain its byte
 * identical previously accepted import-map hash.
 * Run: npm ci --prefix source && node scripts/sync-hex-beacon-standalone.mjs
 */
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readFileSync,writeFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {relative,resolve} from 'node:path'
const require=createRequire(import.meta.url)
const ts=require('../source/node_modules/typescript')
const root=resolve(import.meta.dirname,'..')
const sourceRoot=resolve(root,'source/src')
const htmlPath=resolve(root,'index.html')
const freezePath=resolve(root,'tests/integration-original-modules.json')
const tag='<script id="orbita-embedded-map" type="application/json">'
const html=readFileSync(htmlPath,'utf8')
const begin=html.indexOf(tag)
const end=html.indexOf('</script>',begin+tag.length)
assert(begin>=0&&end>begin,'Standalone import map not found')
const dataBegin=begin+tag.length
const original=JSON.parse(html.slice(dataBegin,end))
const frozen=JSON.parse(readFileSync(freezePath,'utf8'))
const allow=['scene/Beacon','scene/SocialDrops']
const keys=new Set(allow.map(s=>'orbita/'+s))
for(const key of keys)assert(original[key]?.startsWith('data:text/javascript;base64,'),'Missing '+key)
for(const [key,hash] of Object.entries(frozen)){
  if(keys.has(key))continue
  assert.equal(createHash('sha256').update(original[key]??'').digest('hex'),hash,
    'ABORT: unrelated original graphical module changed: '+key)
}
const updated={...original}
const nextFrozen={...frozen}
for(const file of allow){
  const source=readFileSync(resolve(sourceRoot,file+'.tsx'),'utf8')
  if(file==='scene/Beacon'){
    assert(source.includes('beaconProfile'),'Beacon cold-trigger profiler missing')
    assert(source.includes('openPanel('),'Original Beacon panel must be retained')
  }
  if(file==='scene/SocialDrops'){
    assert(source.includes("get('beaconStableLights') === '1'"),
      'Lighting experiment must remain opt-in, never production default')
    assert(source.includes('intensity={2.6}'),'Original physical point light strength missing')
  }
  const result=ts.transpileModule(source,{
    fileName:file+'.tsx',reportDiagnostics:true,
    compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,
      module:ts.ModuleKind.ESNext,removeComments:false}
  })
  const errors=(result.diagnostics??[]).filter(d=>d.category===ts.DiagnosticCategory.Error)
  assert.equal(errors.length,0,'TypeScript transpilation failed for '+file)
  const folder=resolve(sourceRoot,file,'..')
  const js=result.outputText.replace(/(\bfrom\s*['"])(\.{1,2}\/[^'"]+)(['"])/g,
    (_m,start,path,end)=>{
      const abs=resolve(folder,path)
      const module=relative(sourceRoot,abs).replace(/\\/g,'/').replace(/\.(tsx?|jsx?)$/,'')
      assert(!module.startsWith('..'),'Unexpected import outside source: '+path)
      assert(original['orbita/'+module],'Missing transitive import '+module)
      return start+'orbita/'+module+end
    })
  assert(!/\bfrom\s*['"]\.{1,2}\//.test(js),'Unresolved import: '+file)
  const key='orbita/'+file
  updated[key]='data:text/javascript;base64,'+Buffer.from(js).toString('base64')
  nextFrozen[key]=createHash('sha256').update(updated[key]).digest('hex')
}
for(const key of Object.keys(original))
  if(!keys.has(key))assert.equal(updated[key],original[key],'Unexpected visual mutation: '+key)
const nextHtml=html.slice(0,dataBegin)+JSON.stringify(updated)+html.slice(end)
const nextFreeze=JSON.stringify(nextFrozen,null,2)+'\n'
if(html!==nextHtml)writeFileSync(htmlPath,nextHtml)
if(readFileSync(freezePath,'utf8')!==nextFreeze)writeFileSync(freezePath,nextFreeze)
console.log('HEX_BEACON_STANDALONE_SYNC_OK '+JSON.stringify([...keys])+
  '; all unrelated modules hash-identical.')
