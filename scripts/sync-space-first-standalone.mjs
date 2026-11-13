/**
 * Keep the ONE public Cloudflare root HTML and the existing standalone ship
 * byte-faithful outside five reviewed modules. This is NOT a Vite rebuild.
 * Node 22 + npm ci --prefix source, then node scripts/sync-space-first-standalone.mjs
 */
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {existsSync,readFileSync,writeFileSync} from 'node:fs'
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
  // Round-6 added plain .ts modules (the cockpit state bus and the screen
  // painter), so resolve .tsx first and fall back to .ts.
  const tsx=resolve(srcRoot,modulePath+'.tsx')
  const path=existsSync(tsx)?tsx:resolve(srcRoot,modulePath+'.ts')
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
// The original single-file root contains an old pre-React, full-screen
// ORBITA text loader. It appears BEFORE the spaceship and obscures its first
// real WebGL frame, violating the user-facing ship-first experience. Keep
// its CDN import-map bootstrapping and error/retry logic, but NEVER render
// its spinner/ORBITA title or loading text during a normal launch.
const legacyBootStyle='<style id="orbita-no-legacy-loader">'+
  '#orbita-loading:not(.is-error){display:none!important}'+
  '#orbita-loading.is-error>.orbit,'+
  '#orbita-loading.is-error>b,'+
  '#orbita-loading.is-error>small{display:none!important}'+
  '</style>'
if(!html.includes('id="orbita-no-legacy-loader"')){
  const m=html.match(/<head[^>]*>/i)
  assert(m,'Original HTML head missing; cannot suppress old visual loader')
  html=html.replace(m[0],m[0]+legacyBootStyle)
}
// The old loader also waited for #root canvas to mount before allowing its
// CDN watchdog to stop. Now the island Canvas is intentionally NOT mounted
// until AFTER actual ship-first paint. Recognize the new React ship root,
// not a hidden island Canvas, while retaining existing real module-failure
// recovery and the separate IslandFirstPaintGate for entry authorization.
const bootstrapAnchor='window.__orbitaImported = function () {'
const at=html.indexOf(bootstrapAnchor)
assert(at>=0,'Original CDN error/retry module bootstrap missing')
const tail=html.slice(at)
const legacyCheck="document.querySelector('#root canvas')) {"
const nextCheck="document.querySelector('[data-orbita-space-entry=\"true\"]')) {"
assert(tail.includes(legacyCheck)||tail.includes(nextCheck),
  'Unexpected legacy boot condition; refuse to replace startup blindly')
if(tail.includes(legacyCheck)){
  const newTail=tail.replace(legacyCheck,nextCheck)
  assert(newTail!==tail,'Failed to redirect legacy boot watchdog')
  html=html.slice(0,at)+newTail
}
assert(html.includes('id="orbita-no-legacy-loader"') &&
  html.includes(nextCheck),'Legacy spinner must remain hidden and bootstrap ship-aware')
const shipPath=resolve(root,'assets/immersive/index.html')
let ship=readFileSync(shipPath,'utf8')

/* ── stylesheet ──────────────────────────────────────────────────────────────
   Only JavaScript modules used to be recompiled into the published standalone,
   so every CSS change was silently dropped. The cockpit's compositing cost
   (backdrop-filter over a live WebGL canvas, infinite keyframes, parallax
   will-change) lived entirely in CSS, which made those fixes invisible in
   production. Take the emitted stylesheet from the real build whenever it is
   available so the deployed page and ./source/immersive agree. */
const shipBuildPath=resolve(root,'source/immersive/dist/index.html')
if(existsSync(shipBuildPath)){
  const built=readFileSync(shipBuildPath,'utf8')
  const builtStyles=[...built.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
    .map(m=>m[1]).filter(css=>css.trim().length>0)
  assert(builtStyles.length>0,'Vite build produced no stylesheet for the ship')
  // Keep the small ship-first reveal style that this script owns.
  const hudStyle='<style id="orbita-space-first-hud">'+
    '.app[data-space-painted="false"] > :not(.space-host):not(.vignette)'+
    '{opacity:0;pointer-events:none}'+
    '.app[data-space-painted="true"] > :not(.space-host):not(.vignette)'+
    '{transition:opacity .7s ease-out}</style>'
  const css=builtStyles.join('\n')
  ship=ship.replace(
    /<style[^>]*>[\s\S]*?<\/style>(?=<style id="orbita-space-first-hud">|$)/,
    '<style>'+css+'</style>'
  )
  assert(ship.includes(css.slice(0,200)),'Failed to publish built stylesheet')
}

const match=ship.match(/<script type="importmap">([\s\S]*?)<\/script>/i)
assert(match,'Original standalone spaceship import map missing')
const shipMap=JSON.parse(match[1])
// Modules recompiled from ./source/immersive/src into the published standalone.
// Round 6 replaced the DOM glass cards with a real 3D cockpit, so the interior
// model and its screen painters are now part of the shipped source too.
// Leaf modules must come BEFORE anything that imports them: compileFile asserts
// that every relative import already has a map slot, so this list is ordered
// dependency-first rather than alphabetically.
const shipModules=[
  'lib/cockpitBus',
  'lib/screenPaint',
  'cockpit/gltf',
  'cockpit/furnish',
  'cockpit/interior',
  'App',
  'components/SpaceScene',
  'components/Panels',
]
const shipRoot=resolve(root,'source/immersive/src')
const existingShipMap=shipMap.imports
for(const path of shipModules){
  const key='ship/'+path
  // Round-6 modules are new, so they are inserted rather than required to
  // pre-exist; every older module must still be present byte-for-byte.
  if(existingShipMap[key]!==undefined)
    assert(existingShipMap[key].startsWith('data:text/javascript;base64,'),
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
  legacyRootSpinnerHiddenBeforeFirstPaint:true,
  legacyRootBootstrapWaitsForShipMount:true,
}))
