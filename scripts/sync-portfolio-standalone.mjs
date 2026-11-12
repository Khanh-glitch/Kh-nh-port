/**
 * Compile only audited user-facing source modules into the two files actually
 * served by Cloudflare. All unrelated 3D shaders, Main Stage case studies,
 * ship galaxy/WebGL scene, geometry, lighting and source JPEG bytes stay exact.
 *
 * npm ci --prefix source
 * node scripts/sync-portfolio-standalone.mjs
 */
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readFileSync,writeFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {dirname,relative,resolve} from 'node:path'
const require=createRequire(import.meta.url)
const ts=require('../source/node_modules/typescript')
const root=resolve(import.meta.dirname,'..')
const sha=value=>createHash('sha256').update(value).digest('hex')
const islandFile=resolve(root,'index.html')
const shipFile=resolve(root,'assets/immersive/index.html')
const frozenFile=resolve(root,'tests/integration-original-modules.json')
const islandSource=resolve(root,'source/src')
const shipSource=resolve(root,'source/immersive/src')
const islandTag='<script id="orbita-embedded-map" type="application/json">'
const shipTag='<script type="importmap">'
const closeTag='</script>'
const islandModules=['content','ui/Overlay','scene/Products','scene/VngGallery','vng/types']
const islandModified=new Set(islandModules.map(x=>'orbita/'+x))
const shipModules=['data/profile']
function getMap(html,tag,ship=false){
 const start=html.indexOf(tag),end=html.indexOf(closeTag,start+tag.length)
 assert(start>=0&&end>start,'Missing deployed import map '+tag)
 const whole=JSON.parse(html.slice(start+tag.length,end))
 return {whole,map:ship?whole.imports:whole,start,end,tag}
}
function compile(srcRoot,name,prefix,map,removePilot=false){
 const ext=name==='content'||name==='data/profile'||name==='vng/types'?'.ts':'.tsx'
 const path=resolve(srcRoot,name+ext)
 let code=readFileSync(path,'utf8')
 if(removePilot){
   const importLine="import pilotPhoto from '../assets/pilot.jpg';"
   assert(code.includes(importLine),'Ship pilot photo import changed unexpectedly')
   code=code.replace(importLine,'')
 }
 const result=ts.transpileModule(code,{
  fileName:path,reportDiagnostics:true,
  compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,
   module:ts.ModuleKind.ESNext,removeComments:false},
 })
 const errors=(result.diagnostics??[]).filter(x=>x.category===ts.DiagnosticCategory.Error)
 assert.equal(errors.length,0,'Compilation errors '+name+': '+JSON.stringify(errors))
 const javascript=result.outputText.replace(
   /(\bfrom\s*['"])(\.{1,2}\/[^'"]+)(['"])/g,
   (_m,pre,spec,post)=>{
     const module=relative(srcRoot,resolve(dirname(path),spec))
       .replace(/\\/g,'/').replace(/\.(tsx?|jsx?)$/,'')
     assert(!module.startsWith('..'),'Import outside source '+spec)
     const id=prefix+module
     assert(map[id],'Unavailable standalone dependency '+id+' from '+name)
     return pre+id+post
   })
 assert(!/\bfrom\s*['"]\.{1,2}\//.test(javascript),'Unmapped import in '+name)
 return javascript
}
let html=readFileSync(islandFile,'utf8')
let ship=readFileSync(shipFile,'utf8')
const original=getMap(html,islandTag)
const old={...original.map}
const frozen=JSON.parse(readFileSync(frozenFile,'utf8'))
for(const [key,hash] of Object.entries(frozen)){
 if(!islandModified.has(key))
  assert.equal(sha(original.map[key]??''),hash,
   'ABORT unrelated original visual module mismatch '+key)
}
for(const name of islandModules){
 const key='orbita/'+name
 assert(old[key]?.startsWith('data:text/javascript;base64,'),'Missing island '+key)
 const javascript=compile(islandSource,name,'orbita/',old)
 original.map[key]='data:text/javascript;base64,'+
   Buffer.from(javascript,'utf8').toString('base64')
 frozen[key]=sha(original.map[key])
}
for(const [key,value] of Object.entries(old))
 if(!islandModified.has(key))
   assert.equal(original.map[key],value,'ABORT visual or main-stage change '+key)
assert.deepEqual(Object.keys(original.map),Object.keys(old),'Island module map keys changed')
html=html.slice(0,original.start+islandTag.length)+
  JSON.stringify(original.whole)+html.slice(original.end)
const uiStyle='<style id="orbita-project-dossier-css">'+
 '[data-project-dossier]{position:absolute;inset:0;z-index:40;display:flex;align-items:center;justify-content:center}'+
 '[data-project-dossier] aside{position:relative;display:flex;flex-direction:column;min-height:0;width:100%;max-width:1180px;overflow:hidden}'+
 '[data-project-dossier] [role=tablist]{display:flex;gap:8px;overflow-x:auto}'+
 '[data-project-dossier] [role=tab]{flex-shrink:0}'+
 '[data-project-dossier] [role=tabpanel]{min-height:0;overflow-y:auto}'+
 '@media(min-width:1024px){[data-project-dossier] aside>div:nth-child(3){display:grid;grid-template-columns:minmax(0,.95fr) minmax(0,1.05fr);min-height:0;flex:1}'+
 '[data-project-dossier] aside>div:nth-child(3)>div:first-child{border-right:1px solid #ffffff1a}}'+
 '@media(max-width:1023px){[data-project-dossier] aside>div:nth-child(3){display:flex;flex-direction:column;min-height:0;overflow-y:auto;flex:1}'+
 '[data-project-dossier] aside>div:nth-child(3)>div{min-height:auto;overflow-y:visible}'+
 '[data-project-dossier] [role=tabpanel]{overflow:visible}}'+
 '</style>'
if(!html.includes('id="orbita-project-dossier-css"')){
 const h=html.match(/<head[^>]*>/i)
 assert(h,'Root HTML head missing')
 html=html.replace(h[0],h[0]+uiStyle)
}
// Ship profile has a 350kB original inlined pilot JPEG. Never re-encode it or
// export/upload any photo asset; reuse EXACT original data URI module prefix.
const originalShip=getMap(ship,shipTag,true)
const oldShip={...originalShip.map}
const shipKey='ship/data/profile'
const encoded=oldShip[shipKey]
assert(encoded?.startsWith('data:text/javascript;base64,'),'Ship profile module missing')
const prior=Buffer.from(encoded.split(',')[1],'base64').toString('utf8')
const profileMarker='export const profile ='
const at=prior.indexOf(profileMarker)
assert(at>200000 && prior.startsWith("const pilotPhoto = 'data:image/jpeg;base64,"),
 'Original pilot image prefix absent; refuse to change photo')
const photoPrefix=prior.slice(0,at)
const fresh=compile(shipSource,'data/profile','ship/',oldShip,true)
assert(fresh.includes(profileMarker),'New ship profile export missing')
assert(!fresh.includes('DỮ LIỆU MẪU'),'Sample data warning survived')
const newShip=photoPrefix+fresh
originalShip.map[shipKey]='data:text/javascript;base64,'+
  Buffer.from(newShip,'utf8').toString('base64')
for(const [key,value] of Object.entries(oldShip))
 if(key!==shipKey)
  assert.equal(originalShip.map[key],value,'ABORT changed ship visual '+key)
assert.deepEqual(Object.keys(originalShip.map),Object.keys(oldShip))
ship=ship.slice(0,originalShip.start+shipTag.length)+
  JSON.stringify(originalShip.whole)+ship.slice(originalShip.end)
if(html!==readFileSync(islandFile,'utf8'))writeFileSync(islandFile,html)
if(ship!==readFileSync(shipFile,'utf8'))writeFileSync(shipFile,ship)
const nextHashes=JSON.stringify(frozen,null,2)+'\n'
if(nextHashes!==readFileSync(frozenFile,'utf8'))writeFileSync(frozenFile,nextHashes)
console.log('PORTFOLIO_ACTUAL_STANDALONE_SYNC_OK '+JSON.stringify({
 islandModules,shipModules,unchangedIslandModules:Object.keys(old).length-islandModules.length,
 unchangedShipModules:Object.keys(oldShip).length-1,
 originalPhotoPrefixSHA256:sha(photoPrefix),sourcePhotoRetained:true,
 stageCaseStudyUnchanged:true,
 fakeMetricsRemovedFromMostPanels:true
}))
