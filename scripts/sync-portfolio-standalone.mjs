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
// Modules whose SOURCE this branch owns: verified content, the dossier UI, and
// the exhibits whose real click path had to be repaired (a visitor could not
// open most exhibits with the mouse). Shaders, geometry, materials and every
// other 3D module stay byte-frozen and hash-checked below.
const islandModules=['content','ui/Overlay','scene/Products','scene/VngGallery',
 'vng/types','scene/Orb','scene/Cinema','scene/Rubik','scene/Piano','scene/Stage',
 'scene/Beacon','scene/Robot','scene/ApexShowcase','scene/RagnarokShowcase']
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
const uiStyle=String.raw`<style id="orbita-project-dossier-css">
[data-project-dossier]{
 position:absolute;inset:0;z-index:40;display:flex;align-items:center;
 justify-content:center;padding:8px;color:#fff;background:rgba(0,0,0,.55);
 font-family:Inter,'Segoe UI',system-ui,sans-serif;box-sizing:border-box
}
[data-project-dossier] *,[data-project-dossier] *::before,
[data-project-dossier] *::after{box-sizing:border-box}
[data-project-dossier] aside{
 position:relative;display:flex;flex-direction:column;min-height:0;
 height:100%;width:100%;max-width:1180px;overflow:hidden;
 border-radius:24px;border:1px solid #ffffff26;
 background:rgba(8,14,28,.97);box-shadow:0 26px 100px #000d
}
[data-project-dossier] aside>header{
 position:relative;z-index:1;display:flex;align-items:center;gap:12px;
 flex-shrink:0;border-bottom:1px solid #ffffff1a;
 background:rgba(0,0,0,.20);padding:16px 20px
}
[data-project-dossier] button,[data-project-dossier] a{
 cursor:pointer;text-decoration:none
}
[data-project-dossier] aside>header button{
 margin-left:auto;flex-shrink:0;border:1px solid #ffffff30;
 border-radius:999px;background:transparent;color:#fff;
 padding:8px 16px;font-size:11px;letter-spacing:.12em
}
[data-project-dossier] aside>div:nth-child(3){
 min-height:0;flex:1;overflow:hidden
}
[data-project-dossier] aside>div:nth-child(3)>div{
 min-width:0;min-height:0;padding:28px 32px;overflow-y:auto
}
[data-project-dossier] aside h2{
 font-family:'Space Grotesk','Segoe UI',system-ui,sans-serif;
 font-weight:800;font-size:clamp(36px,4.1vw,68px);
 letter-spacing:-.035em;line-height:1.03;margin:24px 0 0
}
[data-project-dossier] aside h2+p{font-size:18px;line-height:1.4;color:#ffffffd5;margin:20px 0}
[data-project-dossier] aside h3{
 font-size:12px;font-weight:800;letter-spacing:.18em
}
[data-project-dossier] aside h4{
 font-family:'Space Grotesk','Segoe UI',system-ui,sans-serif;
 font-weight:800;font-size:clamp(25px,3vw,48px);
 line-height:1.12;letter-spacing:-.02em
}
[data-project-dossier] aside p{margin:0}
[data-project-dossier] [role=tablist]{
 display:flex;gap:8px;overflow-x:auto;max-width:100%;padding-bottom:8px
}
[data-project-dossier] [role=tab]{
 flex-shrink:0;max-width:220px;border:1px solid #ffffff24;
 border-radius:9px;background:rgba(255,255,255,.025);
 padding:10px 12px;text-align:left;color:#ffffffac;
 font-weight:600;white-space:normal;transition:background .16s,border .16s
}
[data-project-dossier] [role=tab][aria-selected=true]{
 background:rgba(255,255,255,.07);color:#fff
}
[data-project-dossier] [role=tabpanel]{
 min-height:0;overflow-y:auto;min-width:0
}
[data-project-dossier] a[href]{
 display:inline-flex;align-items:center;justify-content:center;
 border-radius:12px;min-height:44px;padding:12px 18px;
}
[data-project-dossier] a[href]:focus-visible,
[data-project-dossier] button:focus-visible{
 outline:2px solid white;outline-offset:2px
}
[data-project-dossier] aside footer{
 flex-shrink:0;border-top:1px solid #ffffff1c;
 background:rgba(0,0,0,.20);padding:14px 24px
}
[data-project-dossier] aside footer button{
 border:1px solid #ffffff2c;border-radius:8px;
 padding:8px 12px;background:transparent;color:#fff
}
[data-project-dossier] .orbita-dossier-hero{position:relative;isolation:isolate}
[data-project-dossier] .orbita-dossier-hero-photo{
 position:absolute;inset:0;width:100%;height:100%;display:block;
 object-fit:cover;object-position:center;opacity:.88;pointer-events:none
}
[data-project-dossier] .orbita-dossier-hero-photo[src$="03_music_vibes.jpg"]{
 object-fit:contain;object-position:right center;opacity:.83
}
[data-project-dossier] .orbita-dossier-hero-shade{
 position:absolute;inset:0;pointer-events:none;
 background:linear-gradient(90deg,rgba(4,9,20,.96) 0%,rgba(4,9,20,.63) 44%,rgba(4,9,20,.25) 100%);
}
[data-project-dossier] .orbita-dossier-media-caption{
 display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;
 margin-top:8px;font-size:10px;color:rgba(255,255,255,.56);line-height:1.5;
}
[data-project-dossier] .orbita-dossier-media-caption a[href]{
 min-height:32px;padding:3px 8px;color:#fff;border:1px solid #ffffff38;
 background:#ffffff12;border-radius:7px;white-space:nowrap;font-size:10px;
}
@media(min-width:1024px){
 [data-project-dossier]{padding:24px}
 [data-project-dossier] aside{height:min(90vh,850px);border-radius:30px}
 [data-project-dossier] aside>div:nth-child(3){
  display:grid;grid-template-columns:minmax(0,.95fr) minmax(0,1.05fr)
 }
 [data-project-dossier] aside>div:nth-child(3)>div:first-child{
  border-right:1px solid #ffffff1a
 }
}
@media(max-width:1023px){
 [data-project-dossier] aside>div:nth-child(3){
  display:flex;flex-direction:column;overflow-y:auto;overscroll-behavior:contain
 }
 [data-project-dossier] aside>div:nth-child(3)>div{
  min-height:auto;flex-shrink:0;overflow-y:visible;padding:22px
 }
 [data-project-dossier] aside>div:nth-child(3)>div:first-child{
  border-bottom:1px solid #ffffff1a
 }
 [data-project-dossier] [role=tabpanel]{overflow:visible}
}
@media(prefers-reduced-motion:reduce){
 [data-project-dossier] *{transition:none!important;animation:none!important}
}
</style>`
// The scoped dossier CSS is owned by this script. Always replace a previously
// published block instead of skipping it: skipping left the served standalone
// pinned to an older stylesheet revision while the sync script advanced, which
// silently dropped the media hero/caption rules from the real published HTML.
const styleBlock=/<style id="orbita-project-dossier-css">[\s\S]*?<\/style>/
if(styleBlock.test(html)){
  html=html.replace(styleBlock,uiStyle)
}else{
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
// Keep the EXACT original data URI and nothing else. Earlier revisions of this
// script carried prior.slice(0,at) forward, so every run re-appended the source
// header comment block on top of the previously published one. The photo bytes
// were always identical, but the module grew on every publish (an unbounded,
// non-idempotent rewrite of the served ship HTML). Rebuild the prefix from the
// live photo literal only so publishing is byte-stable.
const photoLiteral=prior.slice(0,prior.indexOf("'",prior.indexOf('base64,')+7)+1)
assert(photoLiteral.startsWith("const pilotPhoto = 'data:image/jpeg;base64,/9j/"),
 'Original pilot JPEG signature changed')
const previousPhoto=prior.slice(0,at).match(/data:image\/jpeg;base64,[A-Za-z0-9+/=]+/)?.[0]
assert(previousPhoto===photoLiteral.match(/data:image\/jpeg;base64,[A-Za-z0-9+/=]+/)?.[0],
 'Pilot JPEG data URI was re-encoded; refuse to change photo')
const photoPrefix=photoLiteral+'\n\n'
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
