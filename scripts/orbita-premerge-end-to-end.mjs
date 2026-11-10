import {createRequire} from 'node:module'
import {mkdirSync,writeFileSync} from 'node:fs'
const require=createRequire(import.meta.url)
const {chromium}=require('../candidate/source/node_modules/playwright')

mkdirSync('premerge-evidence',{recursive:true})
const base='http://127.0.0.1:'
const TARGETS=[
 {id:'orb',x:0,z:0},{id:'piano',x:-26,z:9},
 {id:'rubik',x:27,z:9},{id:'robot',x:0,z:-41},
 {id:'cinema',x:32,z:-27},{id:'stage',x:-31,z:-26},
 {id:'products',x:22,z:31},{id:'beacon',x:-22,z:31},
]
const results=[]
const browser=await chromium.launch({headless:true,args:[
 '--enable-webgl','--enable-gpu','--ignore-gpu-blocklist',
 '--use-angle=metal','--disable-software-rasterizer'
]})
async function probe(page){
 return await page.evaluate(async()=>{
  const {useStore}=await import('orbita/store')
  const {player,getTargets,getInteractive}=await import('orbita/world')
  const canvas=document.querySelector('canvas')
  const gl=canvas?.getContext('webgl2')
  const ext=gl?.getExtension('WEBGL_debug_renderer_info')
  return {
   store:{phase:useStore.getState().phase,ready:useStore.getState().ready,
     panel:useStore.getState().panel,paused:useStore.getState().paused,
     quality:useStore.getState().quality},
   player:{x:player.pos.x,z:player.pos.z,yaw:player.yaw},
   interactives:getTargets().map(x=>getInteractive(x)?.id).filter(Boolean),
   gpu:gl?.getParameter(ext?.UNMASKED_RENDERER_WEBGL??gl.RENDERER)??'none',
   contextLost:gl?.isContextLost()??true,
   canvas:[canvas?.width,canvas?.height],
   reality:window.__orbitaReality?.useReality.getState().phase??'unavailable',
   colossus:window.__orbitaColossusWarmup?.status??'unavailable',
  }
 })
}
const readySelector='button:has-text("BƯỚC VÀO")'
async function boot(page,port,description) {
 await page.goto(base+port+'/',{waitUntil:'domcontentloaded',timeout:120000})
 await page.waitForSelector('canvas',{timeout:120000})
 await page.getByRole('button',{name:'BƯỚC VÀO'}).waitFor({timeout:120000})
 const before=await probe(page)
 if(before.store.phase!=='intro'||!before.store.ready||before.contextLost)throw Error(description+': intro not ready '+JSON.stringify(before))
 return before
}
async function record(caseRec,id,fn){
 try {const value=await fn();caseRec.tests.push({id,status:'PASS',value});return value}
 catch(e){caseRec.tests.push({id,status:'FAIL',error:String(e)});return null}
}
async function snap(page,p){
 try{await page.screenshot({path:'premerge-evidence/'+p+'.png',animations:'disabled',timeout:60000})}
 catch(e){return String(e)}
 return null
}
async function teleport(page,x,z,yaw=0){
 return page.evaluate(async({x,z,yaw})=>{
  const {player}=await import('orbita/world')
  const {useStore}=await import('orbita/store')
  player.pos.x=x;player.pos.z=z;player.pos.y=1.7
  player.yaw=yaw;player.pitch=0
  useStore.getState().setPaused(false)
  useStore.getState().setFree(true)
  useStore.getState().openPanel(null)
 },{x,z,yaw})
}
async function hit(page,id) {
 return page.evaluate(async(id)=>{
  const {getTargets,getInteractive}=await import('orbita/world')
  const it=getTargets().map(t=>getInteractive(t)).find(it=>it?.id===id)
  if(!it)return {found:false}
  if(typeof it.onClick!=='function')return {found:true,callable:false}
  it.onClick()
  return {found:true,callable:true}
 },id)
}
for(const variant of [{id:'main-8dd5ded',port:4173},{id:'candidate-4454511',port:4174}]){
 const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1,
    permissions:[],reducedMotion:'no-preference'})
 const page=await context.newPage()
 page.setDefaultTimeout(18000)
 const v={variant:variant.id,tests:[],pageErrors:[],networkFailed:[],contextLossEvents:0,started:new Date().toISOString()}
 results.push(v)
 page.on('pageerror',e=>v.pageErrors.push(e.message))
 page.on('requestfailed',r=>v.networkFailed.push({url:r.url().slice(0,150),error:r.failure()?.errorText}))
 page.on('console',m=>{if(m.type()==='error'&&v.consoleErrors?.length<30)(v.consoleErrors??=[]).push(m.text().slice(0,200))})
 page.on('domcontentloaded',()=>page.evaluate(()=>document.querySelector('canvas')?.addEventListener('webglcontextlost',()=>window.__auditLost=(window.__auditLost||0)+1)).catch(()=>{}))
 const prefix=variant.id
 await record(v,'cold_intro_ready',async()=>{
  const p=await boot(page,variant.port,'cold');v.gpu=p.gpu
  await snap(page,prefix+'-intro')
  return {phase:p.store.phase,ready:p.store.ready,canvas:p.canvas,gpu:p.gpu,glLost:p.contextLost}
 })
 await record(v,'enter_by_actual_button_and_land',async()=>{
  await page.getByRole('button',{name:'BƯỚC VÀO'}).click({timeout:15000})
  await page.waitForFunction(async()=>{const {useStore}=await import('orbita/store');return useStore.getState().phase==='playing'},null,{timeout:45000})
  await page.waitForTimeout(3600)
  const p=await probe(page)
  if(p.store.phase!=='playing'||p.contextLost)throw Error('did not land '+JSON.stringify(p))
  await snap(page,prefix+'-landed')
  return {phase:p.store.phase,position:p.player,contextLost:p.contextLost}
 })
 await record(v,'keyboard_walk_quality_mute',async()=>{
  await teleport(page,0,37,0)
  const before=await probe(page)
  await page.keyboard.down('KeyW');await page.waitForTimeout(350);await page.keyboard.up('KeyW')
  const after=await probe(page)
  if(!(after.player.z<before.player.z-0.05))throw Error('W not moving: '+JSON.stringify([before.player,after.player]))
  await page.keyboard.press('KeyQ')
  const q=await probe(page)
  if(q.store.quality===before.store.quality)throw Error('Q quality did not toggle')
  await page.keyboard.press('KeyQ')
  await page.keyboard.press('KeyM')
  const m=await page.evaluate(async()=>{const {useStore}=await import('orbita/store');return useStore.getState().muted})
  if(!m)throw Error('M did not mute')
  await page.keyboard.press('KeyM')
  return {distance:before.player.z-after.player.z,quality:q.store.quality,mutedAfterM:m}
 })
 for(const t of TARGETS){
  await record(v,'area_'+t.id+'_profile_key_E',async()=>{
   await teleport(page,t.x,t.z+9,0)
   await page.waitForTimeout(400)
   await page.keyboard.press('KeyE')
   await page.waitForTimeout(200)
   const p=await probe(page)
   if(p.store.panel!==t.id)throw Error('E opened '+p.store.panel+' (expected '+t.id+')')
   const heading=await page.locator('aside h2').first().textContent()
   await snap(page,prefix+'-area-'+t.id)
   await page.getByRole('button',{name:'TIẾP TỤC KHÁM PHÁ'}).click()
   const close=await probe(page)
   if(close.store.panel!==null)throw Error('panel did not close')
   return {panel:p.store.panel,title:heading,closed:true,glLost:p.contextLost}
  })
 }
 await record(v,'colossus_summon_both_retract_resummon',async()=>{
   await teleport(page,0,-31,0);await page.waitForTimeout(500)
   const p=await probe(page)
   if(!p.interactives.includes('console-summon'))throw Error('summon hit target not registered')
   const first=await hit(page,'console-summon')
   if(!first.callable)throw Error('main summon not callable')
   await page.waitForFunction(()=>window.__orbitaColossusProfile?.trace?.some(x=>x.mode==='summon_apex'||x.mode==='summon_rag'),null,{timeout:40000}).catch(()=>{})
   await page.waitForTimeout(10500)
   await snap(page,prefix+'-colossus-summoned')
   const a=await hit(page,'console-summon')
   await page.waitForTimeout(4300)
   await snap(page,prefix+'-colossus-retracted')
   const b=await hit(page,'console-summon')
   await page.waitForTimeout(10500)
   await snap(page,prefix+'-colossus-resummoned')
   const after=await probe(page)
   if(after.contextLost)throw Error('lost 3D context')
   return {targets:[first,a,b],warmup:after.colossus,profiles:await page.evaluate(()=>window.__orbitaColossusProfiles?.length??0)}
 })
 await record(v,'colossus_individual_apex_ragnarok',async()=>{
  // Return to dormant if active, then trigger individual action callbacks.
  await hit(page,'console-summon');await page.waitForTimeout(4100)
  const apex=await hit(page,'console-apex');await page.waitForTimeout(6500)
  await snap(page,prefix+'-apex-individual')
  await hit(page,'console-summon');await page.waitForTimeout(4100)
  const rag=await hit(page,'console-rag');await page.waitForTimeout(6500)
  await snap(page,prefix+'-rag-individual')
  if(!apex.callable||!rag.callable)throw Error('missing game controls')
  return {apex,rag,glLost:(await probe(page)).contextLost}
 })
 await record(v,'piano_ueh_mua_ha_switch_ngay_mai_retract',async()=>{
  await teleport(page,-26,18,0)
  const ok=await page.evaluate(()=>!!window.__orbitaReality)
  if(!ok)throw Error('Reality runtime missing')
  await page.evaluate(()=>window.__orbitaReality.requestReality('mua-ha'))
  await page.waitForFunction(()=>['sweep','active'].includes(window.__orbitaReality?.useReality.getState().phase),null,{timeout:45000})
  const before=await page.evaluate(()=>{const s=window.__orbitaReality.useReality.getState();return {phase:s.phase,track:s.track,switchSeq:s.switchSeq}})
  if(before.track!=='mua-ha')throw Error('mua-ha not started')
  await snap(page,prefix+'-ueh-rain')
  const switching=page.getByRole('button',{name:/Chuyển · Nếu ngày mai/})
  await switching.waitFor({timeout:20000})
  await switching.click({timeout:20000})
  await page.waitForFunction(()=>window.__orbitaReality?.useReality.getState().track==='ngay-mai',null,{timeout:30000})
  const changed=await page.evaluate(()=>{const s=window.__orbitaReality.useReality.getState();return {phase:s.phase,track:s.track,switchSeq:s.switchSeq}})
  if(changed.phase==='idle'||changed.switchSeq<=before.switchSeq)throw Error('wrong switch semantics')
  await page.waitForTimeout(2000)
  await snap(page,prefix+'-ueh-blossom')
  await page.getByRole('button',{name:/Thu hồi/}).first().click()
  await page.waitForFunction(()=>window.__orbitaReality?.useReality.getState().phase==='idle',null,{timeout:35000})
  const done=await page.evaluate(()=>window.__orbitaReality.useReality.getState().phase)
  await snap(page,prefix+'-ueh-retracted')
  return {before,changed,after:done}
 })
 await record(v,'reload_new_intro_and_enter_again',async()=>{
  const p=await boot(page,variant.port,'reload')
  await page.getByRole('button',{name:'BƯỚC VÀO'}).click()
  await page.waitForFunction(async()=>{const {useStore}=await import('orbita/store');return useStore.getState().phase==='playing'},null,{timeout:45000})
  await page.waitForTimeout(3000)
  const r=await probe(page);if(r.contextLost)throw Error('WebGL context lost')
  await snap(page,prefix+'-reloaded')
  return {introReady:p.store.ready,reentered:r.store.phase,glLost:r.contextLost}
 })
 v.final=await probe(page).catch(e=>({error:String(e)}))
 v.finished=new Date().toISOString()
 writeFileSync('premerge-evidence/results.json',JSON.stringify(results,null,2))
 await context.close()
}
await browser.close()
const combined={variants:results.map(v=>({variant:v.variant,gpu:v.gpu,
 pass:v.tests.filter(t=>t.status==='PASS').length,
 fail:v.tests.filter(t=>t.status==='FAIL').length,
 failures:v.tests.filter(t=>t.status==='FAIL').map(t=>({id:t.id,error:t.error})),
 errors:v.pageErrors,networkFailures:v.networkFailed.slice(0,10),
 contextLost:v.final?.contextLost
}))}
writeFileSync('premerge-evidence/summary.json',JSON.stringify(combined,null,2))
console.log('PREMERGE_AUDIT_SUMMARY '+JSON.stringify(combined))
if(results.some(v=>v.tests.some(t=>t.status==='FAIL')||v.pageErrors.length||v.final?.contextLost))process.exitCode=10
