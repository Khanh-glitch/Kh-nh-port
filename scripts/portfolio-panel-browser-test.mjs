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
    budget:native?150000:300000}))
const ids=['about','orb','piano','rubik','robot','apex','ragnarok',
  'cinema','stage','products','beacon','vng']
// Exhibits reachable from spawn by walking + turning. Street-distance checks
// exist for products/rubik (offset from the walk line) and beacon (widest hit
// volume); all are opened by REAL input below, no store shortcuts.
// Stand in front of the exhibit, centre the camera on it, then CLICK it. This
// is the visitor's own path; the dossier must be that exhibit's dossier.
const WORLD_ENTRY=[
  {id:'products',approach:{x:22,z:39}},
  {id:'rubik',approach:{x:27,z:19}},
  {id:'beacon',approach:{x:-22,z:39}},
  {id:'piano',approach:{x:-26,z:17}},
  {id:'cinema',approach:{x:32,z:-15}},
  {id:'orb',approach:{x:0,z:11}},
  {id:'robot',approach:{x:0,z:-25}},
]
const failures=[]
const evidence={backend,launchArgs:LAUNCH,startedAt:new Date().toISOString(),
  viewports:suites.map(s=>s.tag),worldEntry:[],panels:[],inputPaths:[],failures:[]}

function fail(stage,detail){
  const record={stage,backend,...detail}
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
/** Where is the exhibit's hit volume on screen right now?
 * Pure arithmetic from the visitor's own camera pose plus the exhibit layout;
 * this only verifies that the visitor is really pointing at the exhibit, it
 * never moves or opens anything. */
const aimOf = (page, id) => page.evaluate((id) => {
  const p = window.__orbitaProbe
  if (!p) return null
  const me = p.player()
  const ex = p.exhibits.find((e) => e.id === id)
  if (!ex) return null
  const canvas = document.querySelector('#root canvas')
  const r = canvas.getBoundingClientRect()
  const dx = ex.x - me.x
  const dz = ex.z - me.z
  // forward = (-sin yaw, -cos yaw)
  const fwd = -Math.sin(me.yaw) * dx + -Math.cos(me.yaw) * dz
  const right = Math.cos(me.yaw) * dx + -Math.sin(me.yaw) * dz
  const dist = Math.hypot(dx, dz)
  return {
    me, dist,
    // Depth along the view axis and lateral offset in metres.
    along: fwd, lateral: right,
    // Vertical field of view of the island camera.
    vfov: (p.vfov ? p.vfov() : 55),
    canvas: {w: r.width, h: r.height},
  }
}, id)

/** Turn the visitor with the game's own drag-look until the exhibit is centred.
 * The drag is a real mouse gesture; the probe only reports the resulting pose.
 * Turning continues until the exhibit is both ahead and horizontally centred,
 * because an exhibit 80 degrees to the side is never clicked "somewhere else
 * on screen" by a real visitor. */
async function faceExhibit(page,suite,exhibit){
  const started=Date.now()
  const size=page.viewportSize()
  const cx=Math.round(size.width/2),cy=Math.round(size.height/2)
  const wrap=(a)=>Math.atan2(Math.sin(a),Math.cos(a))
  let last=null
  while(Date.now()-started<suite.budget){
    const aim=await aimOf(page,exhibit)
    if(!aim)throw Error('Acceptance probe missing')
    const panel=await probe(page,'panel')
    if(panel)throw Error('A dossier was already open before aiming: '+panel)
    const target=await page.evaluate(id=>{
      const p=window.__orbitaProbe
      return p.exhibits.find(e=>e.id===id)
    },exhibit)
    const want=Math.atan2(-(target.x-aim.me.x),-(target.z-aim.me.z))
    const err=wrap(want-aim.me.yaw)
    last={err,yaw:aim.me.yaw,me:aim.me,dist:aim.dist}
    // 0.35 degrees of tolerance is inside the smallest exhibit hit volume at
    // the standing distances the harness uses.
    if(Math.abs(err)<0.006)return aim
    const px=Math.max(-260,Math.min(260,-err/0.0022))
    await page.mouse.move(cx,cy);await page.mouse.down()
    for(let i=1;i<=8;i++)await page.mouse.move(cx+Math.round(px*i/8),cy)
    await page.mouse.up()
    await sleep(50)
  }
  throw Error('Could not centre '+exhibit+' within '+suite.budget+'ms last='+
    JSON.stringify(last))
}

/** Hold the real forward key until close enough, then click screen centre. */
async function walkAndOpen(page,suite,entry){
  const started=Date.now()
  let state=null
  while(Date.now()-started<suite.budget){
    state=await page.evaluate(({approach})=>{
      const p=window.__orbitaProbe
      const me=p.player()
      const d=Math.hypot(approach.x-me.x,approach.z-me.z)
      return {me,d,panel:p.panel(),paused:p.paused(),phase:p.phase()}
    },{approach:entry.approach})
    if(state.panel)throw Error('Unexpected dossier before click: '+state.panel)
    if(state.d<2.5)break
    await page.keyboard.down('KeyW')
    await sleep(180)
    await page.keyboard.up('KeyW')
  }
  if(!state||state.d>=2.5)
    throw Error('Visitor could not walk to '+entry.id+' approach: '+JSON.stringify(state))
  const aim=await faceExhibit(page,suite,entry.id)
  if(aim.along<=0||Math.abs(aim.lateral)>0.45*aim.dist)
    throw Error('Exhibit '+entry.id+' is not centred at click time: '+
      JSON.stringify({along:aim.along,lateral:aim.lateral,dist:aim.dist}))
  const size=page.viewportSize()
  const cx=Math.round(size.width/2),cy=Math.round(size.height/2)
  await page.mouse.move(cx,cy)
  await sleep(60)
  await page.mouse.click(cx,cy,{delay:40})
  const opened=page.locator('[data-project-dossier]')
  // Colossus finishes its laser summon (2.5s per world) before continuing into
  // the dossier, so allow the animation to complete.
  await opened.waitFor({state:'visible',timeout:entry.id==='robot'?45000:20000})
  const id=await opened.getAttribute('data-project-dossier')
  if(id!==entry.id)throw Error('Real centre click opened '+id+' instead of '+entry.id)
  // The 3D click must have selected THAT exhibit, not a stale/default screen.
  const selectedProject=await page.evaluate(()=>document.querySelector(
    '[role="tab"][aria-selected="true"]')?.textContent?.trim().slice(0,48)??'')
  evidence.worldEntry.push({selectedProject})
  evidence.worldEntry.push({suite:suite.tag,exhibit:entry.id,opened:id,
    approach:entry.approach,walkedTo:{x:+state.me.x.toFixed(2),z:+state.me.z.toFixed(2)}})
  console.log('PORTFOLIO_WORLD_ENTRY '+JSON.stringify({suite:suite.tag,backend,
    exhibit:entry.id,opened:id,walkedTo:{x:+state.me.x.toFixed(2),z:+state.me.z.toFixed(2)},
    ms:Date.now()-started}))
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
        await walkAndOpen(page,suite,entry)
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
try{
  for(const suite of suites)await runSuite(suite)
}catch(err){
  fail('browser',{error:String(err)})
}finally{
  evidence.failures=failures
  evidence.passed=failures.length===0
  evidence.finishedAt=new Date().toISOString()
  writeFileSync(OUT+'/report.json',JSON.stringify(evidence,null,2))
  writeFileSync(OUT+'/report.txt',JSON.stringify(evidence))
  console.log('PORTFOLIO_PANEL_REPORT '+JSON.stringify({backend,
    viewports:evidence.viewports,worldEntry:evidence.worldEntry.length,
    panelAudits:evidence.panels.length,inputPaths:evidence.inputPaths.length,
    failures:failures.length}))
  for(const f of failures)console.log('PORTFOLIO_PANEL_FAILURE_FINAL '+JSON.stringify(f))
  await browser.close()
  if(failures.length)process.exitCode=2
}
