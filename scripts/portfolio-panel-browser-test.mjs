/**
 * Real exhibit/dossier interaction acceptance for the published standalone.
 *
 * Interaction is proven in the ways a visitor actually has, never by calling
 * store.openPanel() and calling it done:
 *
 *  A. WORLD ENTRY (real pointer click on a real hit volume)
 *     The visitor is placed at a real standing point in front of the exhibit
 *     with the product's own shareable viewpoint deep link (#view=), which is
 *     a normal walking pose with normal collision and normal interaction rules.
 *     The camera is aimed with the game's drag-look, then a real CDP pointer
 *     click is dispatched at the screen centre. The dossier that opens must be
 *     that exhibit's dossier.
 *  B. KEYBOARD ENTRY ("E") with real key events, which is the other input path
 *     the HUD advertises.
 *  C. WALKING (real held movement keys) - only where rendering can sustain it.
 *     On Apple Metal the suite walks the visitor from spawn to the exhibit.
 *
 * Why walking is not attempted on SwiftShader: run 43202037146 measured this
 * runner rendering about one frame every 30 seconds while the whole island
 * scene is live. Movement is frame-driven, so no walk can complete there. That
 * is a property of the software rasteriser, not of the product, and it is
 * stated rather than hidden. DOM interaction (tabs, close, scrim, keyboard) is
 * still exercised on SwiftShader.
 */
import {createRequire} from 'node:module'
import {mkdirSync,writeFileSync} from 'node:fs'
import {setTimeout as sleep} from 'node:timers/promises'
const require=createRequire(import.meta.url)
const OUT='browser-evidence/portfolio'
mkdirSync(OUT,{recursive:true})
/** Never let a missing dependency or a launch failure end the process without
 * an explanation on disk: that is exactly how two CI runs produced no
 * diagnosis at all. */
function fatal(stage,error){
  const detail=String(error&&error.stack||error)
  const report={backend:process.env.PORTFOLIO_BACKEND==='metal'?'Metal':'SwiftShader',
    stage,passed:false,fatal:detail,
    failures:[{stage,verdict:'HARNESS_ERROR',error:detail}]}
  try{
    writeFileSync(OUT+'/report.json',JSON.stringify(report,null,2))
    writeFileSync(OUT+'/report.txt',JSON.stringify(report))
    writeFileSync(OUT+'/harness.log','HARNESS_FATAL '+stage+': '+detail+'\n')
  }catch{}
  console.error('PORTFOLIO_HARNESS_FATAL '+stage+': '+detail)
  process.exit(3)
}
let chromium
try{
  ;({chromium}=require('../source/node_modules/playwright'))
}catch(error){
  fatal('load-playwright',error)
}
const native=process.env.PORTFOLIO_BACKEND==='metal'
const backend=native?'Metal':'SwiftShader'
const MODE=(process.env.PORTFOLIO_VIEWPORTS||'all').trim()||'all'
// 'dom'    : SwiftShader-safe interaction proof (real E key + full DOM audit)
// 'native' : Metal proof, adds a real walked approach to every exhibit
const ENTRY=process.env.PORTFOLIO_ENTRY||(native?'native':'dom')
const LAUNCH=native
  ? ['--enable-webgl','--enable-gpu','--ignore-gpu-blocklist','--use-angle=metal',
    '--disable-software-rasterizer','--disable-dev-shm-usage']
  : ['--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
    '--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--disable-dev-shm-usage']
let browser
try{
  browser=await chromium.launch({headless:true,args:LAUNCH})
}catch(error){
  fatal('launch-chromium',error)
}
// Which viewports run which proof:
//  - A DOM suite exercises the dossier UI (tabs, close, scrim, keyboard) and is
//    cheap, so SwiftShader runs it at 390x844, 1280x720 and 1920x1080.
//  - A WORLD suite boots a whole 3D exhibit scene and dispatches real hit-volume
//    clicks. On Apple Metal it runs at 390x844, 1280x720 and 1920x1080; on the
//    software rasteriser one island frame costs about 30s, so there it runs at
//    1280x720 only and the smaller/larger layouts are covered on Metal plus by
//    the DOM suites. This is an explicit allocation, not a silent skip.
const suites=(()=>{
  const named={desktop:[1280,720,'desktop'],mobile:[390,844,'mobile'],wide:[1920,1080,'wide']}
  const raw=(process.env.PORTFOLIO_VIEWPORTS||'all').split(',').filter(Boolean)
  const unknown=raw.filter(n=>n!=='all'&&!named[n])
  if(unknown.length)
    throw Error('Unknown PORTFOLIO_VIEWPORTS value(s): '+unknown.join(', ')+
      ' (allowed: all, mobile, desktop, wide)')
  const only=MODE==='all'?null:MODE.split(',').filter(Boolean)
  const domSet = only ?? ['mobile','desktop','wide']
  const worldSet = native ? (only ?? ['mobile','desktop','wide'])
    : (only ?? ['desktop'])
  return {
    dom:domSet.map(n=>named[n]),
    world:worldSet.map(n=>named[n]),
  }
})()
const makeSuite=([width,height,tag],kind)=>({width,height,tag,kind,
  // A software rasteriser is slow, never correct: timeouts are generous, but
  // every claim still requires a real arrival and a real click.
  budget:native?120000:180000})
const ids=['about','orb','piano','rubik','robot','apex','ragnarok',
  'cinema','stage','products','beacon','vng']
// One entry per exhibit: the real hit volume a visitor clicks, plus a standing
// pose that is a genuine walkable position in front of that exhibit. The pose
// is applied through the product's own #view deep link (normal pose, normal
// collision, normal interaction).
const EXHIBITS=[
  {id:'products',hit:'product-base',x:22,z:31,stand:{x:22,z:39,yaw:180,pitch:-6},
   affordance:'Product Lab pedestal'},
  {id:'rubik',hit:'rubik-base',x:27,z:9,stand:{x:27,z:17,yaw:180,pitch:-6},
   affordance:'Cube Solver pedestal'},
  {id:'beacon',hit:'beacon',x:-22,z:31,stand:{x:-22,z:38,yaw:180,pitch:-6},
   affordance:'Signal Beacon mast'},
  {id:'piano',hit:'piano-body',x:-26,z:9,stand:{x:-26,z:15,yaw:180,pitch:-6},
   affordance:'Grand Piano body'},
  {id:'cinema',hit:'cinema-sign',x:32,z:-27,stand:{x:32,z:-15,yaw:180,pitch:-6},
   affordance:'Mini Cinema sign'},
  {id:'orb',hit:'orb-base',x:0,z:0,stand:{x:0,z:10,yaw:180,pitch:-6},
   affordance:'Singularity Orb base'},
  {id:'robot',hit:'robot',x:0,z:-41,stand:{x:0,z:-28,yaw:180,pitch:-2},
   affordance:'Colossus body'},
]
// Exhibits whose visitor-facing surfaces are themselves interactive 3D
// furniture (stage FOH console, VNG kiosk controls). The HUD advertises "E" as
// the way to open a nearby exhibit, so that path is exercised with a real key.
const KEY_ENTRY=[
  {id:'stage',hit:'stage-body',stand:{x:-31,z:-14,yaw:180,pitch:-8},
   affordance:'Main Stage front of house'},
  {id:'vng',hit:'vng-project-dossier',stand:{x:20,z:-33,yaw:180,pitch:-16},
   affordance:'VNG competition kiosk'},
]
const STAGE={at:'config',suite:null,step:null}
function flushReport(){
  try{
    evidence.failures=failures
    evidence.stage={...STAGE}
    evidence.passed=failures.length===0
    evidence.finishedAt=evidence.finishedAt??null
    mkdirSync(OUT,{recursive:true})
    writeFileSync(OUT+'/report.json',JSON.stringify(evidence,null,2))
    writeFileSync(OUT+'/report.txt',JSON.stringify(evidence))
  }catch(error){console.error('PORTFOLIO_REPORT_WRITE_FAILED '+String(error))}
}
process.on('uncaughtException',(error)=>{
  console.error('PORTFOLIO_HARNESS_FATAL '+String(error&&error.stack||error))
  failures.push({stage:'fatal',verdict:'HARNESS_ERROR',error:String(error&&error.stack||error),
    at:{...STAGE}})
  flushReport()
  process.exit(3)
})
process.on('unhandledRejection',(reason)=>{
  console.error('PORTFOLIO_HARNESS_FATAL_REJECTION '+String(reason&&reason.stack||reason))
  failures.push({stage:'fatal-rejection',verdict:'HARNESS_ERROR',
    error:String(reason&&reason.stack||reason),at:{...STAGE}})
  flushReport()
  process.exit(3)
})
flushReport()
const failures=[]
const evidence={backend,launchArgs:LAUNCH,startedAt:new Date().toISOString(),
  viewports:suites.dom.map(s=>s[2]),
  worldViewports:suites.world.map(s=>s[2]),
  worldEntry:[],panels:[],inputPaths:[],failures:[]}

function fail(stage,detail){
  const error=String(detail.error??'')
  const record={stage,backend,...detail,
    // A walk that ran out of wall clock on a software GPU is not proof that the
    // exhibit is unreachable; it is an unproven claim and is labelled as such.
    verdict:error.includes('WALK_BUDGET')?'UNPROVEN_TIME_BUDGET':
      error.includes('suite-timeout')?'UNPROVEN_TIME_BUDGET':'REAL_DEFECT'}
  failures.push(record)
  console.error('PORTFOLIO_PANEL_FAILURE '+JSON.stringify(record))
}
async function shot(page,name){
  try{await page.screenshot({path:OUT+'/'+name+'.png',timeout:60000})}
  catch(error){console.error('PORTFOLIO_SHOT_FAILED '+name+' '+String(error))}
}
const probe=(page,fn,...args)=>page.evaluate(([fn,args])=>{
  const p=window.__orbitaProbe
  if(!p)return null
  const f=p[fn]
  return typeof f==='function'?f(...args):f
},[fn,args])
async function boot(page,suite){
  STAGE.at='boot'
  flushReport()
  const errors=[]
  page.on('pageerror',e=>errors.push(String(e)))
  page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text().slice(0,200))})
  await page.goto('http://127.0.0.1:4173/#at=0,43,0,0&autostart&skip',
    {waitUntil:'domcontentloaded',timeout:120000})
  await page.waitForFunction(async()=>{
    const {useStore}=await import('orbita/store')
    return useStore.getState().phase==='playing' &&
      useStore.getState().ready &&
      document.querySelectorAll('iframe[title*="spaceship cockpit"]').length===0 &&
      document.querySelectorAll('#root canvas').length>0 &&
      Boolean(window.__orbitaProbe)
  },null,{timeout:suite.budget,polling:400})
  return errors
}
/** Real rendered frames must advance before any interaction is judged. */
async function waitForFrames(page,suite,label){
  const started=Date.now()
  await page.evaluate(()=>{window.__orbitaFrameTicks=0;
    const tick=()=>{window.__orbitaFrameTicks++;requestAnimationFrame(tick)}
    requestAnimationFrame(tick)})
  await page.waitForFunction(()=>window.__orbitaFrameTicks>5,null,
    {timeout:suite.budget,polling:120})
  const ms=Date.now()-started
  console.log('PORTFOLIO_FRAME_PROGRESS '+JSON.stringify({suite:suite.tag,backend,label,ms}))
  return ms
}
/** Read the live visitor pose and the live hit-volume registry. Read-only. */
const readWorld = (page) => page.evaluate(() => {
  const p = window.__orbitaProbe
  if (!p) return null
  return {me:p.player(),exhibits:p.exhibits,hits:p.hits(),panel:p.panel(),
    phase:p.phase(),frameTicks:window.__orbitaFrameTicks??0}
})

/** Aim the camera at a specific registered hit volume with the game's own
 * drag-look, then report the client point to click.
 * Player.look(): yaw -= dx * 0.0022 * -1.15 => a rightward drag ADDS 0.00253
 * rad; pitch -= dy * 0.00253. */
async function aimAt(page,suite,hitId){
  STAGE.at='aimAt:'+hitId
  flushReport()
  const size=page.viewportSize()
  const cx=Math.round(size.width/2),cy=Math.round(size.height/2)
  const wrap=(a)=>Math.atan2(Math.sin(a),Math.cos(a))
  const started=Date.now()
  let last=null
  while(Date.now()-started<suite.budget){
    const w=await readWorld(page)
    if(!w)throw Error('Acceptance probe missing (window.__orbitaProbe undefined)')
    if(w.panel)throw Error('A dossier was already open before aiming: '+w.panel)
    const hit=w.hits.find(h=>h.id===hitId)
    if(!hit)throw Error('Hit volume '+hitId+' is not registered by the live scene')
    const dx=hit.x-w.me.x,dz=hit.z-w.me.z,dy=hit.y-w.me.y
    const flat=Math.hypot(dx,dz)
    const yawErr=wrap(Math.atan2(-dx,-dz)-w.me.yaw)
    const pitchErr=wrap(Math.atan2(dy,flat)-w.me.pitch)
    last={hitId,dist:flat,yawErr,pitchErr,me:w.me,hit}
    // Every aimed volume subtends more than 8deg at these stand-off distances,
    // so 3deg of tolerance cannot produce a lucky off-target click.
    if(Math.abs(yawErr)<0.05&&Math.abs(pitchErr)<0.03)
      return {client:{x:cx,y:cy},dist:flat,hit,pose:w.me}
    if(Math.abs(yawErr)>=0.05){
      const px=Math.max(-300,Math.min(300,yawErr/0.00253))
      await page.mouse.move(cx,cy);await page.mouse.down()
      for(let i=1;i<=8;i++)await page.mouse.move(cx+Math.round(px*i/8),cy)
      await page.mouse.up()
    }else{
      const py=Math.max(-300,Math.min(300,-pitchErr/0.00253))
      await page.mouse.move(cx,cy);await page.mouse.down()
      for(let i=1;i<=8;i++)await page.mouse.move(cx,cy+Math.round(py*i/8))
      await page.mouse.up()
    }
    await sleep(60)
  }
  throw Error('Could not aim at '+hitId+' within '+suite.budget+'ms last='+JSON.stringify(last))
}

/** Re-enter the world at a real standing pose using the product's deep link. */
async function standAt(page,suite,pose){
  STAGE.at='standAt:navigate'
  flushReport()
  const errors=[]
  page.on('pageerror',e=>errors.push(String(e)))
  await page.goto('http://127.0.0.1:4173/#view='+pose.x+','+pose.z+','+pose.yaw+','+
    pose.pitch+'&autostart&skip',{waitUntil:'domcontentloaded',timeout:120000})
  await page.waitForFunction(async()=>{
    const {useStore}=await import('orbita/store')
    const p=window.__orbitaProbe
    return useStore.getState().phase==='playing'&&useStore.getState().ready&&
      Boolean(p)&&p.panel()===null
  },null,{timeout:suite.budget,polling:300})
  const me=(await readWorld(page)).me
  const drift=Math.hypot(me.x-pose.x,me.z-pose.z)
  if(drift>3)
    throw Error('Deep-linked viewpoint placed the visitor '+drift.toFixed(1)+
      'm from the requested walkable pose')
  return {me,errors}
}

/** A: real pointer click on the exhibit's hit volume. */
async function clickWorldEntry(page,suite,entry){
  STAGE.at='clickWorldEntry:'+entry.id
  flushReport()
  const started=Date.now()
  const {me}=await standAt(page,suite,entry.stand)
  const aim=await aimAt(page,suite,entry.hit)
  await page.mouse.move(aim.client.x,aim.client.y)
  await sleep(80)
  await page.mouse.click(aim.client.x,aim.client.y,{delay:40})
  const opened=page.locator('[data-project-dossier]')
  await opened.waitFor({state:'visible',timeout:entry.id==='robot'?60000:25000})
  const id=await opened.getAttribute('data-project-dossier')
  if(id!==entry.id)
    throw Error('Real click on '+entry.hit+' opened '+id+' instead of '+entry.id)
  const selectedProject=await page.evaluate(()=>document.querySelector(
    '[role="tab"][aria-selected="true"]')?.textContent?.trim().slice(0,48)??'')
  const record={suite:suite.tag,backend,via:'pointer click on '+entry.hit,
    exhibit:entry.id,affordance:entry.affordance,opened:id,selectedProject,
    pose:{x:+me.x.toFixed(2),z:+me.z.toFixed(2)},dist:+aim.dist.toFixed(2),
    ms:Date.now()-started}
  evidence.worldEntry.push(record)
  console.log('PORTFOLIO_WORLD_ENTRY '+JSON.stringify(record))
}

/** B: real "E" key entry from a standing pose, for exhibits whose controls are
 * themselves interactive 3D furniture (Main Stage FOH, VNG kiosk). */
async function keyWorldEntry(page,suite,entry){
  const started=Date.now()
  const {me}=await standAt(page,suite,entry.stand)
  await aimAt(page,suite,entry.hit)
  await page.keyboard.press('KeyE')
  const opened=page.locator('[data-project-dossier]')
  await opened.waitFor({state:'visible',timeout:25000})
  const id=await opened.getAttribute('data-project-dossier')
  if(id!==entry.id)
    throw Error('Real E key while aiming at '+entry.hit+' opened '+id+' instead of '+entry.id)
  const record={suite:suite.tag,backend,via:'E key while aiming at '+entry.hit,
    exhibit:entry.id,affordance:entry.affordance,opened:id,
    pose:{x:+me.x.toFixed(2),z:+me.z.toFixed(2)},ms:Date.now()-started}
  evidence.worldEntry.push(record)
  console.log('PORTFOLIO_WORLD_ENTRY '+JSON.stringify(record))
}

/** C: walk the visitor from spawn to the exhibit with real held keys. Metal. */
async function walkedWorldEntry(page,suite,entry){
  const started=Date.now()
  await standAt(page,suite,{x:0,z:43,yaw:180,pitch:0})
  const before=(await readWorld(page)).me
  const startDist=Math.hypot(before.x-entry.x,before.z-entry.z)
  // Point the visitor at the exhibit and hold the real forward key.
  const wantYaw=Math.atan2(-(entry.stand.x-before.x),-(entry.stand.z-before.z))
  const err=Math.atan2(Math.sin(wantYaw-before.yaw),Math.cos(wantYaw-before.yaw))
  const size=page.viewportSize()
  const cx=Math.round(size.width/2),cy=Math.round(size.height/2)
  const px=Math.max(-300,Math.min(300,err/0.00253))
  await page.mouse.move(cx,cy);await page.mouse.down()
  for(let i=1;i<=8;i++)await page.mouse.move(cx+Math.round(px*i/8),cy)
  await page.mouse.up()
  await page.keyboard.down('KeyW')
  let reached=false
  const walkStarted=Date.now()
  while(Date.now()-walkStarted<suite.budget){
    const me=(await readWorld(page)).me
    if(Math.hypot(me.x-entry.stand.x,me.z-entry.stand.z)<2.5){reached=true;break}
    await sleep(250)
  }
  await page.keyboard.up('KeyW')
  if(!reached)
    throw Error('WALK_BUDGET: walk from spawn '+startDist.toFixed(1)+
      'm toward '+entry.affordance+' did not finish in '+suite.budget+'ms')
  const aim=await aimAt(page,suite,entry.hit)
  await page.mouse.move(aim.client.x,aim.client.y)
  await sleep(80)
  await page.mouse.click(aim.client.x,aim.client.y,{delay:40})
  const opened=page.locator('[data-project-dossier]')
  await opened.waitFor({state:'visible',timeout:entry.id==='robot'?60000:25000})
  const id=await opened.getAttribute('data-project-dossier')
  if(id!==entry.id)throw Error('After walking, clicking opened '+id+' instead of '+entry.id)
  const record={suite:suite.tag,backend,via:'walked '+startDist.toFixed(1)+
    'm then pointer click on '+entry.hit,exhibit:entry.id,affordance:entry.affordance,
    opened:id,walkMs:Date.now()-walkStarted,ms:Date.now()-started}
  evidence.worldEntry.push(record)
  console.log('PORTFOLIO_WORLD_ENTRY '+JSON.stringify(record))
}

async function closeDossier(page,id){
  const root=page.locator('[data-project-dossier="'+id+'"]')
  const button=await root.getByRole('button',{name:'Đóng hồ sơ dự án'}).evaluate(el=>{
    const r=el.getBoundingClientRect()
    const x=r.x+r.width/2,y=r.y+r.height/2
    const top=document.elementFromPoint(x,y)
    return {x,y,w:r.width,h:r.height,hit:top===el||el.contains(top),
      html:top?.outerHTML?.slice(0,120)}
  },{timeout:8000})
  if(!button.hit||button.w<16||button.h<16)
    throw Error('Close button not directly hit-testable: '+JSON.stringify(button))
  await page.mouse.click(button.x,button.y,{delay:45})
  await root.waitFor({state:'detached',timeout:12000})
}
async function auditPanel(page,suite,id){
  STAGE.at='auditPanel:'+id
  flushReport()
  const root=page.locator('[data-project-dossier="'+id+'"]')
  await root.waitFor({state:'visible',timeout:15000})
  const info=await page.evaluate(id=>{
    const el=document.querySelector('[data-project-dossier="'+id+'"]')
    const modal=el?.querySelector('aside')
    const title=el?.querySelector('h2')
    const tabs=el?.querySelectorAll('[role="tab"]')??[]
    const rect=modal?.getBoundingClientRect()
    const controls=el?[...el.querySelectorAll('a[href],button')].filter(n=>{
      const r=n.getBoundingClientRect()
      return r.width>0&&r.height>0
    }).length:0
    return {id,title:title?.textContent??'',tabs:tabs.length,
      dialog:modal?.getAttribute('role'),
      insideViewport:!!rect&&rect.left>=-1&&rect.right<=innerWidth+1&&
        rect.top>=-1&&rect.bottom<=innerHeight+1,
      horizontalOverflow:document.documentElement.scrollWidth>innerWidth+1,
      selected:el?.querySelector('[role="tab"][aria-selected="true"]')?.textContent??'',
      heroPhoto:!!el?.querySelector('.orbita-dossier-hero-photo'),
      mediaCaption:!!el?.querySelector('.orbita-dossier-media-caption'),
      controls}
  },id)
  if(!info.insideViewport||info.horizontalOverflow||info.tabs<1||
     info.dialog!=='dialog'||!info.title)
    throw Error('Panel clipped or not truly interactive: '+JSON.stringify(info))
  const tabs=root.locator('[role="tab"]')
  if(info.tabs>=2){
    const tab=tabs.nth(1)
    await tab.evaluate(el=>el.scrollIntoView({behavior:'instant',block:'nearest',inline:'center'}))
    const hit=await tab.evaluate(el=>{
      const r=el.getBoundingClientRect()
      const x=r.x+r.width/2,y=r.y+r.height/2
      const top=document.elementFromPoint(x,y)
      return {x,y,w:r.width,h:r.height,hit:top===el||el.contains(top)}
    })
    if(!hit.hit||hit.w<8||hit.h<8)
      throw Error('Pointer target occluded tab '+id+': '+JSON.stringify(hit))
    await page.mouse.click(hit.x,hit.y,{delay:35})
    const second=await root.locator('[role="tab"][aria-selected="true"]').textContent()
    if(!second?.includes('02'))
      throw Error('Second project did not activate: '+id+' selected='+second)
    info.secondTabActivated=second.trim().slice(0,40)
  }
  await closeDossier(page,id)
  info.probeAfterClose=await probe(page,'panel')
  if(info.probeAfterClose!==null)
    throw Error('Dossier state survived close for '+id)
  console.log('PORTFOLIO_PANEL_AUDIT '+JSON.stringify({suite:suite.tag,backend,info}))
  return info
}
async function runSuite(suite){
  STAGE.suite=suite.tag
  STAGE.at='suite-start'
  flushReport()
  const page=await browser.newPage({viewport:{width:suite.width,height:suite.height},
    deviceScaleFactor:1})
  STAGE.at='suite-boot'
  const out={viewport:suite.tag,kind:suite.kind,
    size:suite.width+'x'+suite.height,panels:[],errors:null}
  try{
    out.errors=await boot(page,suite)
    await waitForFrames(page,suite,'boot')
    // A. Real pointer click on each exhibit's own hit volume. On Metal the
    // visitor also WALKS there from spawn first; on SwiftShader the walk is
    // physically impossible (the renderer sustains about one frame per 30s),
    // so the same click is proven from a real standing pose instead, and the
    // walk is attempted only where it can actually complete.
    for(const entry of (suite.kind==='world'?EXHIBITS:[])){
      const skipped=[]
      try{
        if(ENTRY==='native')await walkedWorldEntry(page,suite,entry)
        else await clickWorldEntry(page,suite,entry)
        const info=await auditPanel(page,suite,entry.id)
        out.panels.push(entry.id)
        evidence.panels.push({suite:suite.tag,backend,id:entry.id,
          via:ENTRY==='native'?'walked + 3D pointer click':'3D pointer click',
          tabs:info.tabs,heroPhoto:info.heroPhoto,
          mediaCaption:info.mediaCaption,controls:info.controls})
        await shot(page,suite.tag+'-world-'+entry.id)
      }catch(error){
        const walkBudget=String(error).includes('WALK_BUDGET')
        fail('world-entry:'+entry.id,{suite:suite.tag,error:String(error)})
        skipped.push({exhibit:entry.id,reason:walkBudget?'walk budget':'click path'})
        await shot(page,suite.tag+'-'+entry.id+'-WORLD-ENTRY-FAILED')
        await page.keyboard.up('KeyW').catch(()=>{})
        await page.evaluate(async()=>{
          const {useStore}=await import('orbita/store')
          useStore.getState().openPanel(null)
        }).catch(()=>{})
        // A walk-budget miss is a hardware limit; the click path itself is then
        // still proven from a standing pose so the report distinguishes them.
        if(walkBudget&&ENTRY==='native'){
          try{
            await clickWorldEntry(page,suite,entry)
            const info=await auditPanel(page,suite,entry.id)
            out.panels.push(entry.id)
            evidence.panels.push({suite:suite.tag,backend,id:entry.id,
              via:'3D pointer click (walk skipped: budget)',tabs:info.tabs,
              heroPhoto:info.heroPhoto,mediaCaption:info.mediaCaption,
              controls:info.controls})
          }catch(inner){
            fail('world-entry-click:'+entry.id,{suite:suite.tag,error:String(inner)})
          }
        }
      }
      if(skipped.length)out.walkSkipped=(out.walkSkipped??[]).concat(skipped)
    }
    // B. Real "E" key entry for the exhibits whose own controls are 3D
    // furniture (Main Stage FOH console and the VNG competition kiosk).
    for(const entry of (suite.kind==='world'?KEY_ENTRY:[])){
      try{
        await keyWorldEntry(page,suite,entry)
        const info=await auditPanel(page,suite,entry.id)
        out.panels.push(entry.id)
        evidence.panels.push({suite:suite.tag,backend,id:entry.id,
          via:'E key from standing pose',tabs:info.tabs,
          heroPhoto:info.heroPhoto,mediaCaption:info.mediaCaption,
          controls:info.controls})
      }catch(error){
        fail('key-entry:'+entry.id,{suite:suite.tag,error:String(error)})
        await shot(page,suite.tag+'-'+entry.id+'-KEY-ENTRY-FAILED')
        await page.evaluate(async()=>{
          const {useStore}=await import('orbita/store')
          useStore.getState().openPanel(null)
        }).catch(()=>{})
      }
    }
    // C. Every dossier's own UI: layout, real tab click, real close, no
    // clipping, at every allocated viewport.
    for(const id of ids){
      try{
        await page.evaluate(async id=>{
          const {useStore}=await import('orbita/store')
          useStore.getState().openPanel(id)
        },id)
        const info=await auditPanel(page,suite,id)
        out.panels.push(id)
        evidence.panels.push({suite:suite.tag,backend,id,via:'dossier audit',
          tabs:info.tabs,secondTab:info.secondTabActivated??null,
          heroPhoto:info.heroPhoto,mediaCaption:info.mediaCaption,
          controls:info.controls})
        if(['products','vng','robot','cinema','rubik','beacon','piano'].includes(id))
          await shot(page,suite.tag+'-'+id)
      }catch(error){
        fail('panel:'+id,{suite:suite.tag,error:String(error)})
        await shot(page,suite.tag+'-'+id+'-PANEL-FAILED')
        await page.evaluate(async()=>{
          const {useStore}=await import('orbita/store')
          useStore.getState().openPanel(null)
        }).catch(()=>{})
      }
    }
    try{
      // Keyboard I opens About from the world, ESC closes it, scrim closes it.
      await page.keyboard.press('KeyI')
      const about=page.locator('[data-project-dossier="about"]')
      await about.waitFor({state:'visible',timeout:15000})
      await page.keyboard.press('Escape')
      await about.waitFor({state:'detached',timeout:12000})
      await page.keyboard.press('KeyI')
      await about.waitFor({state:'visible',timeout:15000})
      const scrim=about.locator('> div').first()
      const scrimHit=await scrim.evaluate(el=>{
        const r=el.getBoundingClientRect()
        const x=r.left+6,y=r.top+r.height/2
        const top=document.elementFromPoint(x,y)
        return {x,y,hit:top===el||el.contains(top)}
      })
      if(!scrimHit.hit)throw Error('Scrim click target occluded')
      await page.mouse.click(scrimHit.x,scrimHit.y,{delay:35})
      await about.waitFor({state:'detached',timeout:12000})
      // Close/reopen must not leak the previous project selection.
      await page.evaluate(async()=>{
        const {useStore}=await import('orbita/store')
        useStore.getState().openPanel('products')
      })
      await page.waitForSelector('[data-project-dossier="products"]')
      const reset=await page.locator('[data-project-dossier="products"] [role="tab"][aria-selected="true"]').textContent()
      if(!reset?.includes('01'))throw Error('Product selection leaked across close/reopen: '+reset)
      const privateLinks=await page.locator('[data-project-dossier="products"] a[href*="eventflow-pro"]').count()
      if(privateLinks)throw Error('Private EventFlow repository exposed to recruiter')
      const tab=page.locator('[data-project-dossier="products"] [role="tab"]').nth(2)
      await tab.evaluate(el=>el.scrollIntoView({behavior:'instant',block:'nearest',inline:'center'}))
      const hit=await tab.evaluate(el=>{
        const r=el.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2
        const top=document.elementFromPoint(x,y)
        return {x,y,hit:top===el||el.contains(top)}
      })
      if(!hit.hit)throw Error('Public source tab occluded')
      await page.mouse.click(hit.x,hit.y,{delay:35})
      const links=await page.locator('[data-project-dossier="products"] a[href^="https://github.com/"]').count()
      if(links<1)throw Error('Public ORBITA evidence CTA missing after tab selection')
      await page.keyboard.press('Escape')
      await page.locator('[data-project-dossier="products"]').waitFor({state:'detached',timeout:10000})
      const record={suite:suite.tag,backend,verifiedLinks:links,reopenReset:true,
        keyboardEscape:true,keyIReopen:true,scrimClose:true}
      evidence.inputPaths.push(record)
      console.log('PORTFOLIO_INPUT_PATHS '+JSON.stringify(record))
    }catch(error){
      fail('input-paths',{suite:suite.tag,error:String(error)})
      await shot(page,suite.tag+'-INPUT-PATHS-FAILED')
    }
    if(out.errors.length)fail('page-errors',{suite:suite.tag,errors:out.errors})
    out.done=true
    console.log('PORTFOLIO_PANEL_BROWSER_ACCEPTANCE '+JSON.stringify(out))
  }catch(error){
    fail('suite:'+suite.tag,{error:String(error)})
    await shot(page,suite.tag+'-SUITE-FAILED')
  }finally{
    await page.close()
  }
  evidence.suites=(evidence.suites??[]).concat(out)
  return out
}
const started=Date.now()
/** Hard per-suite watchdog. The point is that a genuine hang is REPORTED with
 * its cause and the remaining viewports still run, instead of the CI job being
 * cancelled at its timeout with no diagnosis (which is what happened before). */
const SUITE_CAP=Number(process.env.PORTFOLIO_SUITE_CAP_MS||
  (native?9*60*1000:7*60*1000))
const withCap=(promise,suite)=>Promise.race([
  promise,
  sleep(SUITE_CAP).then(()=>{
    fail('suite-timeout',{suite:suite.tag,error:'exceeded '+SUITE_CAP+'ms'})
    return {viewport:suite.tag,timedOut:true}
  }),
])
const plan=[...suites.dom.map(x=>makeSuite(x,'dom')),
  ...suites.world.map(x=>makeSuite(x,'world'))]
evidence.plan=plan.map(x=>({viewport:x.tag,kind:x.kind}))
try{
  for(const suite of plan)await withCap(runSuite(suite),suite)
}catch(err){
  fail('browser',{error:String(err)})
}finally{
  // Record how far the plan got, so a report never looks like "nothing ran"
  // for a reason the reader has to guess.
  evidence.failures=failures
  evidence.passed=failures.length===0
  evidence.finishedAt=new Date().toISOString()
  evidence.totalMs=Date.now()-started
  writeFileSync(OUT+'/report.json',JSON.stringify(evidence,null,2))
  writeFileSync(OUT+'/report.txt',JSON.stringify(evidence))
  console.log('PORTFOLIO_PANEL_REPORT '+JSON.stringify({backend,
    viewports:evidence.viewports,worldEntry:evidence.worldEntry.length,
    panelAudits:evidence.panels.length,inputPaths:evidence.inputPaths.length,
    realDefects:failures.filter(f=>f.verdict==='REAL_DEFECT').length,
    unproven:failures.filter(f=>f.verdict!=='REAL_DEFECT').length,
    totalMs:evidence.totalMs}))
  for(const f of failures)console.log('PORTFOLIO_PANEL_FAILURE_FINAL '+JSON.stringify(f))
  await browser.close()
  if(failures.length)process.exitCode=2
}
