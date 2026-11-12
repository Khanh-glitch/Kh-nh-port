/**
 * Keep the ONE public Cloudflare root HTML and the existing standalone ship
 * byte-faithful outside five reviewed modules. This is NOT a Vite rebuild.
 * Node 22 + npm ci --prefix source, then node scripts/sync-space-first-standalone.mjs
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
const script='<script id="orbita-embedded-map" type="application/json">'
const rootPath=resolve(root,'index.html')
const frozenPath=resolve(root,'tests/integration-original-modules.json')
let html=readFileSync(rootPath,'utf8')
const begin=html.indexOf(script),end=html.indexOf('</script>',begin+script.length)
assert(begin>=0&&end>begin,'Missing original production ESM map')
const original=JSON.parse(html.slice(begin+script.length,end))
const frozen=JSON.parse(readFileSync(frozenPath,'utf8'))
const sourceRoot=resolve(root,'source/src')
const rootModules=['App','ui/Overlay','scene/Experience']
const allowed=new Set(rootModules.map(x=>'orbita/'+x))
assert(original['orbita/main'],'Original entry module missing')
for(const [key,oldHash] of Object.entries(frozen)){
  if(!allowed.has(key))
    assert.equal(sha(original[key]??''),oldHash,
      'Unrelated production graphics module hash mismatch: '+key)
}
function compileFile(srcRoot,modulePath,prefix,map){
  const path=resolve(srcRoot,modulePath+'.tsx')
  const source=readFileSync(path,'utf8')
  const result=ts.transpileModule(source,{
    fileName:path,reportDiagnostics:true,
    compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,
      module:ts.ModuleKind.ESNext,removeComments:false},
  })
  const errors=(result.diagnostics??[]).filter(x=>x.category===ts.DiagnosticCategory.Error)
  assert.equal(errors.length,0,'TypeScript transpilation errors in '+path)
  const javascript=result.outputText.replace(
    /(\bfrom\s*['"])(\.{1,2}\/[^'"]+)(['"])/g,
    (_all,pre,spec,post)=>{
      const resolved=resolve(dirname(path),spec)
      const rel=relative(srcRoot,resolved).replace(/\\/g,'/')
        .replace(/\.(tsx?|jsx?)$/,'')
      assert(!rel.startsWith('..'),'Unapproved import '+spec)
      const id=prefix+rel
      assert(map[id],'Missing existing embedded module dependency '+id)
      return pre+id+post
    })
  assert(!/\bfrom\s*['"]\.{1,2}\//.test(javascript),
    'Unresolved relative import in '+path)
  return 'data:text/javascript;base64,'+
    Buffer.from(javascript,'utf8').toString('base64')
}
const mainMap={...original}
for(const path of rootModules){
  const key='orbita/'+path
  assert(original[key]?.startsWith('data:text/javascript;base64,'),
    'Missing source island module '+key)
  mainMap[key]=compileFile(sourceRoot,path,'orbita/',original)
  frozen[key]=sha(mainMap[key])
}
for(const [key,value] of Object.entries(original))
  if(!allowed.has(key))assert.equal(mainMap[key],value,'Unreviewed island changed: '+key)
assert.deepEqual(Object.keys(mainMap),Object.keys(original))
html=html.slice(0,begin+script.length)+JSON.stringify(mainMap)+html.slice(end)
const firstPaintStyle='<style id="orbita-first-paint-document">'+
  'html,body,#root{min-height:100%;background:#02040a!important}'+
  'body{margin:0}</style>'
if(!html.includes('id="orbita-first-paint-document"')){
  const m=html.match(/<head[^>]*>/i)
  assert(m,'Root HTML head is missing')
  html=html.replace(m[0],m[0]+firstPaintStyle)
}
const shipPath=resolve(root,'assets/immersive/index.html')
let ship=readFileSync(shipPath,'utf8')
const match=ship.match(/<script type="importmap">([\s\S]*?)<\/script>/i)
assert(match,'Original standalone spaceship import map missing')
const shipMap=JSON.parse(match[1])
const shipModules=['App','components/SpaceScene','components/Panels']
const shipRoot=resolve(root,'source/immersive/src')
const existingShipMap=shipMap.imports
for(const path of shipModules){
  const key='ship/'+path
  assert(existingShipMap[key]?.startsWith('data:text/javascript;base64,'),
    'Missing built ship source module '+key)
  existingShipMap[key]=compileFile(shipRoot,path,'ship/',shipMap.imports)
}
ship=ship.replace(match[0],'<script type="importmap">'+
  JSON.stringify(shipMap)+'</script>')
// A cosmetic reveal, not a preloader. It only delays original cockpit HUD
// until actual full-quality space has painted; it never covers the galaxy.
const cockpitStyle='<style id="orbita-space-first-hud">'+
  '.app[data-space-painted="false"] > :not(.space-host):not(.vignette)'+
  '{opacity:0;pointer-events:none}'+
  '.app[data-space-painted="true"] > :not(.space-host):not(.vignette)'+
  '{transition:opacity .7s ease-out}</style>'
if(!ship.includes('id="orbita-space-first-hud"')){
  assert(ship.includes('</style>'),'Original cockpit CSS missing')
  ship=ship.replace('</style>','</style>'+cockpitStyle)
}
if(html!==readFileSync(rootPath,'utf8'))writeFileSync(rootPath,html)
const nextFrozen=JSON.stringify(frozen,null,2)+'\n'
if(nextFrozen!==readFileSync(frozenPath,'utf8'))writeFileSync(frozenPath,nextFrozen)
if(ship!==readFileSync(shipPath,'utf8'))writeFileSync(shipPath,ship)
console.log('SPACE_FIRST_PUBLISHED_STANDALONE_OK '+JSON.stringify({
  islandModules:rootModules,shipModules,
  unchangedIslandModules:Object.keys(original).length-rootModules.length,
  rootBytes:Buffer.byteLength(html),shipBytes:Buffer.byteLength(ship),
  bootTextRemovedFromReviewedOverlay:true,
}))
