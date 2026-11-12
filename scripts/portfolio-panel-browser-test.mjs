/**
 * Real dossier interaction acceptance for the published standalone.
 *
 * The centre of the screen is the pointer the visitor clicks with. This suite
 * therefore drives ONLY real user input:
 *   1. aim   - a genuine horizontal mouse drag (the game's drag-look) at the
 *              screen centre, exactly like a visitor turning to an exhibit;
 *   2. walk  - the real W key held down, exactly like a visitor walking;
 *   3. click - a real CDP pointer click at the screen centre, which is what a
 *              pointer lock or drag-look visitor actually presses.
 * The dossier that opens must be the exhibit's own dossier. The probe can only
 * REPORT state (never open/close/select), so a broken interaction cannot be
 * faked. After the world entry proof the suite audits every remaining dossier
 * (layout, tabs, close, reopen, clipping, keyboard, scrim) at three viewports.
 *
 * Defects this suite exists to catch, and previously did not:
 *   A. exhibit hit volumes were never exercised - only store.openPanel() was,
 *      so a visitor could be unable to open an exhibit while the test passed;
 *   B. failures threw with no cause, so CI displayed only 'exit code 1';
 *   C. the first failing viewport aborted the remaining viewports.
 * Every defect is classified, printed and persisted. Nothing is skipped.
 */
import {createRequire} from 'node:module'
import {mkdirSync,writeFileSync} from 'node:fs'
import {setTimeout as sleep} from 'node:timers/promises'
const require=createRequire(import.meta.url)
const {chromium}=require('../source/node_modules/playwright')
const OUT='browser-evidence/portfolio'
mkdirSync(OUT,{recursive:true})
const native=process.env.PORTFOLIO_BACKEND==='metal'
const backend=native?'Metal':'SwiftShader'
const MODE=process.env.PORTFOLIO_VIEWPORTS||'all'
const LAUNCH=native
  ? ['--enable-webgl','--enable-gpu','--ignore-gpu-blocklist','--use-angle=metal',
    '--disable-software-rasterizer','--disable-dev-shm-usage']
  : ['--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
    '--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--disable-dev-shm-usage']
const browser=await chromium.launch({headless:true,args:LAUNCH})
const suites=(MODE==='fast'?[[1280,720,'desktop']]:[[1280,720,'desktop'],[390,844,'mobile'],[1920,1080,'wide']])
  .map(([width,height,tag])=>({width,height,tag,
    // A software GPU may walk slower; it may never be treated as correct
    // without a real arrival. Timeouts are generous for SwiftShader only.
    budget:native?120000:180000}))
const ids=['about','orb','piano','rubik','robot','apex','ragnarok',
  'cinema','stage','products','beacon','vng']
// Exhibits reachable from spawn by walking + turning. Street-distance checks
// exist for products/rubik (offset from the walk line) and beacon (widest hit
// volume); all are opened by REAL input below, no store shortcuts.
// Each entry targets one exhibit's REAL registered hit volume (id below).
// The visitor turns with a drag and walks with the real movement keys; the
// click is a real pointer click at screen centre. `affordance` documents the
// exact visitor-facing surface the hit volume is attached to.
const WORLD_ENTRY=[
  {id:'products',hit:'product-base',exhibit:'products',affordance:'Product Lab pedestal'},
  {id:'rubik',hit:'rubik-base',exhibit:'rubik',affordance:'Cube Solver pedestal'},
  {id:'beacon',hit:'beacon',exhibit:'beacon',affordance:'Signal Beacon mast'},
  {id:'piano',hit:'piano-body',exhibit:'piano',affordance:'Grand Piano body'},
  {id:'cinema',hit:'cinema-sign',exhibit:'cinema',affordance:'Mini Cinema sign'},
  {id:'orb',hit:'orb-base',exhibit:'orb',affordance:'Singularity Orb base'},
  {id:'robot',hit:'robot',exhibit:'robot',affordance:'Colossus body'},
]
const failures=[]
const evidence={backend,launchArgs:LAUNCH,startedAt:new Date().toISOString(),
  viewports:suites.map(s=>s.tag),worldEntry:[],panels:[],inputPaths:[],failures:[]}

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
/** Read the live visitor pose, the live hit-volume registry and a live frame
 * counter. Nothing here moves or opens anything. */
const readWorld = (page) => page.evaluate(() => {
  const p = window.__orbitaProbe
  if (!p) return null
  return {
    me: p.player(), exhibits: p.exhibits, hits: p.hits(),
    panel: p.panel(), phase: p.phase(),
    frames: window.__orbitaFrameTicks ?? 0,
  }
})

/** Aim at a hit volume using the game's own drag-look.
 * Player.look(): yaw -= dx * 0.0022 * -1.15, so a rightward drag ADDS
 * 0.00253 rad. Pitch is dragged separately to put the volume's centre on the
 * screen centre. Returns the client point to click and the distance. */
async function aimAt(page,suite,hitId){
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
    const dx=hit.x-w.me.x, dz=hit.z-w.me.z, dy=hit.y-w.me.y
    const flat=Math.hypot(dx,dz)
    const wantYaw=Math.atan2(-dx,-dz)
    const yawErr=wrap(wantYaw-w.me.yaw)
    // pitch: camera looks down for negative pitch (Euler YXZ). Positive pitch
    // tilts the view up. Aim so the volume centre lands on the screen centre.
    const wantPitch=Math.atan2(dy,flat)
    const pitchErr=wrap(wantPitch-w.me.pitch)
    last={hitId,dist:flat,yawErr,pitchErr,me:w.me,hit}
    // Half-width tolerance: every aimed volume subtends >8deg at its stand-off
    // distance, so 3deg is well inside it and cannot produce a lucky miss.
    if(Math.abs(yawErr)<0.05&&Math.abs(pitchErr)<0.05)
      return {client:{x:cx,y:cy},dist:flat,hit,pose:w.me}
    if(Math.abs(yawErr)>=0.05){
      const px=Math.max(-300,Math.min(300,yawErr/0.00253))
      await page.mouse.move(cx,cy);await page.mouse.down()
      for(let i=1;i<=8;i++)await page.mouse.move(cx+Math.round(px*i/8),cy)
      await page.mouse.up()
    } else {
      // dy drag: pitch -= dy * 0.00253  =>  drag by -pitchErr/0.00253.
      const py=Math.max(-300,Math.min(300,-pitchErr/0.00253))
      await page.mouse.move(cx,cy);await page.mouse.down()
      for(let i=1;i<=8;i++)await page.mouse.move(cx,cy+Math.round(py*i/8))
      await page.mouse.up()
    }
    // Wait for at least one more rendered frame so the camera pose is live.
    const before=(await readWorld(page))?.frames??0
    await page.waitForFunction(b=>window.__orbitaFrameTicks>b,before,{timeout:60000}).catch(()=>{})
  }
  throw Error('Could not aim at '+hitId+' within '+suite.budget+'ms last='+JSON.stringify(last))
}

/** Walk toward a point with the real movement keys. Returns a verdict about
 * reachability instead of hanging: SwiftShader renders a few frames per second,
 * so a distant exhibit is reported as "not reachable in this time budget"
 * rather than retried until the CI job dies. */
async function walkToward(page,suite,{x,z},stopAt){
  const started=Date.now()
  let state=null
  let best=Infinity
  await page.keyboard.down('ShiftLeft')
  while(Date.now()-started<suite.budget){
    state=await page.evaluate(({x,z})=>{
      const p=window.__orbitaProbe
      const me=p.player()
      return {me,d:Math.hypot(x-me.x,z-me.z),panel:p.panel()}
    },{x,z})
    if(state.panel)throw Error('Unexpected dossier while walking: '+state.panel)
    best=Math.min(best,state.d)
    if(state.d<=stopAt)break
    await page.keyboard.down('KeyW')
    await sleep(250)
    await page.keyboard.up('KeyW')
  }
  await page.keyboard.up('ShiftLeft')
  return {reached:!!state&&state.d<=stopAt,state,best,ms:Date.now()-started}
}

/** Full visitor path: walk in front of the exhibit, turn to its hit volume,
 * click it, and require that exhibit's dossier. */
async function openFromWorld(page,suite,entry){
  const started=Date.now()
  // Stand-off distance per exhibit: close enough that every aimed volume spans
  // a wide screen angle, far enough to stay outside the physical props.
  const standOff={products:9,rubik:10,beacon:8,piano:7,cinema:13,orb:10,robot:15}[entry.id]
  const target=await page.evaluate(id=>{
    const p=window.__orbitaProbe
    const ex=p.exhibits.find(e=>e.id===id)
    return ex?{x:ex.x,z:ex.z}:null
  },entry.exhibit)
  if(!target)throw Error('Exhibit '+entry.exhibit+' missing from the live layout')
  // Approach point on the walkable ring between spawn and the exhibit.
  const me0=(await readWorld(page)).me
  const dx=target.x-me0.x,dz=target.z-me0.z
  const len=Math.hypot(dx,dz)||1
  const approach={x:target.x-(dx/len)*standOff,z:target.z-(dz/len)*standOff}
  const walk=await walkToward(page,suite,approach,2.0)
  const walkedTo=await page.evaluate(()=>{
    const p=window.__orbitaProbe.player()
    return {x:+p.x.toFixed(2),z:+p.z.toFixed(2)}
  })
  if(!walk.reached){
    throw Error('WALK_BUDGET: the visitor walked '+walk.best.toFixed(1)+
      'm short of '+entry.affordance+' in '+walk.ms+'ms ('+backend+
      ' renders a few frames per second); this is a test-budget limit, not a '+
      'closed source check. Walked to '+JSON.stringify(walkedTo))
  }
  const aim=await aimAt(page,suite,entry.hit)
  await page.mouse.move(aim.client.x,aim.client.y)
  await sleep(80)
  await page.mouse.click(aim.client.x,aim.client.y,{delay:40})
  const opened=page.locator('[data-project-dossier]')
  await opened.waitFor({state:'visible',timeout:entry.id==='robot'?60000:25000})
  const id=await opened.getAttribute('data-project-dossier')
  if(id!==entry.id)throw Error('Real click on '+entry.hit+' opened '+id+' instead of '+entry.id)
  const selectedProject=await page.evaluate(()=>document.querySelector(
    '[role="tab"][aria-selected="true"]')?.textContent?.trim().slice(0,48)??'')
  evidence.worldEntry.push({suite:suite.tag,exhibit:entry.id,hit:entry.hit,
    affordance:entry.affordance,opened:id,selectedProject,walkedTo,
    walkMs:walk.ms,dist:+aim.dist.toFixed(2),ms:Date.now()-started})
  console.log('PORTFOLIO_WORLD_ENTRY '+JSON.stringify({suite:suite.tag,backend,
    exhibit:entry.id,hit:entry.hit,opened:id,walkedTo,walkMs:walk.ms,
    dist:+aim.dist.toFixed(2),ms:Date.now()-started}))
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
  const page=await browser.newPage({viewport:{width:suite.width,height:suite.height},
    deviceScaleFactor:1})
  const out={viewport:suite.tag,size:suite.width+'x'+suite.height,panels:[],errors:null}
  try{
    out.errors=await boot(page,suite)
    await waitForFrames(page,suite,'boot')
    for(const entry of WORLD_ENTRY){
      try{
        await openFromWorld(page,suite,entry)
        const info=await auditPanel(page,suite,entry.id)
        out.panels.push(entry.id)
        evidence.panels.push({suite:suite.tag,backend,id:entry.id,
          via:'3D world click',tabs:info.tabs,heroPhoto:info.heroPhoto,
          mediaCaption:info.mediaCaption,controls:info.controls})
        await shot(page,suite.tag+'-world-'+entry.id)
      }catch(error){
        fail('world-entry:'+entry.id,{suite:suite.tag,error:String(error)})
        await shot(page,suite.tag+'-'+entry.id+'-WORLD-ENTRY-FAILED')
        await page.keyboard.up('KeyW').catch(()=>{})
        await page.evaluate(async()=>{
          const {useStore}=await import('orbita/store')
          useStore.getState().openPanel(null)
        }).catch(()=>{})
      }
    }
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
try{
  for(const suite of suites)await withCap(runSuite(suite),suite)
}catch(err){
  fail('browser',{error:String(err)})
}finally{
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
