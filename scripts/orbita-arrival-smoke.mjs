import {createRequire} from 'node:module'
import {mkdirSync,writeFileSync} from 'node:fs'
const require=createRequire(import.meta.url)
const {chromium}=require('../source/node_modules/playwright')
mkdirSync('browser-evidence',{recursive:true})
const browser=await chromium.launch({
 headless:true,
 args:['--enable-webgl','--enable-gpu','--ignore-gpu-blocklist','--use-angle=metal','--disable-software-rasterizer']
})
const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1})
const failures=[]
page.on('pageerror',e=>failures.push(e.message))
const landingVariant=process.env.ARRIVAL_LANDING_VARIANT||'primed'
if(!['primed','legacy','path','settled'].includes(landingVariant))throw Error('Unknown landing variant')
const targetUrl=new URL(process.env.ARRIVAL_URL||'http://127.0.0.1:4173/?arrival=on#at=0,-27,0,20&skip')
if(landingVariant==='legacy')targetUrl.searchParams.set('arrivalLandingPreflight','off')
if(landingVariant==='path')targetUrl.searchParams.set('arrivalFlightPathPreflight','on')
if(landingVariant==='settled')targetUrl.searchParams.set('arrivalGpuSettle','on')
const url=targetUrl.toString()
const report={sha:process.env.GITHUB_SHA||'local',url,landingVariant,errors:failures,initial:null,ready:null,afterLanding:null}
try{
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:120000})
 const button=page.getByTestId('arrival-land')
 await button.waitFor({timeout:120000})
 report.initial=await page.evaluate(()=>{
  const b=document.querySelector('[data-testid="arrival-land"]')
  return {label:b?.textContent?.trim(),disabled:b?.disabled??null,
   gpuStatus:window.__orbitaColossusWarmup?.status??'not-mounted'}
 })
 // It is a real readiness gate: initial audio progress cannot unlock landing.
 if(report.initial.disabled!==true)throw Error('Landing enabled prematurely before GPU readiness')
 await page.waitForFunction(()=>{
  const w=window.__orbitaColossusWarmup
  return w?.status==='ready'&&w.gpuSynced===true&&w.totalProxies>=120&&
    w.uploadedProxies===w.totalProxies&&w.nativeScenePrewarm===true&&
    w.nativeSceneRepeats===2&&w.nativeScenePasses===4&&
    w.landingScenePasses===(window.location.search.includes('arrivalLandingPreflight=off')?0:2)&&
    w.landingFlightPathPasses===(window.location.search.includes('arrivalFlightPathPreflight=on')?3:0)&&
    w.gpuSettlingWindows===(window.location.search.includes('arrivalGpuSettle=on')?3:0)
 },null,{timeout:180000,polling:250})
 await page.waitForFunction(()=>{
  const b=document.querySelector('[data-testid="arrival-land"]')
  return b && b.disabled===false && /HẠ CÁNH/.test(b.textContent)
 },null,{timeout:120000,polling:250})
 report.ready=await page.evaluate(()=>{
  const w=window.__orbitaColossusWarmup
  const canvas=document.querySelector('canvas')
  const gl=canvas?.getContext('webgl2')
  const dbg=gl?.getExtension('WEBGL_debug_renderer_info')
  return {label:document.querySelector('[data-testid="arrival-land"]')?.textContent?.trim(),
    gpu:gl?.getParameter(dbg?.UNMASKED_RENDERER_WEBGL??gl.RENDERER),
    status:w.status,gpuSynced:w.gpuSynced,proxies:w.uploadedProxies,
    totalProxies:w.totalProxies,nativePasses:w.nativeScenePasses,
    landingScenePasses:w.landingScenePasses,landingScenePeakCpuMs:w.landingScenePeakCpuMs,
    landingFlightPathPasses:w.landingFlightPathPasses,landingFlightPathPeakCpuMs:w.landingFlightPathPeakCpuMs,
    gpuSettlingWindows:w.gpuSettlingWindows,gpuSettlingMs:w.gpuSettlingMs}
 })
 if(!/Metal/.test(String(report.ready.gpu))||/SwiftShader/.test(String(report.ready.gpu)))
  throw Error('GPU not Metal: '+report.ready.gpu)
 // Snapshot actual entrance before modifying the scene. Cockpit HUD should show
 // this is an orbital arrival, not the audio-only intro.
 await page.screenshot({path:'browser-evidence/orbita-arrival-approach.png',timeout:60000})
 const before=await page.evaluate(()=>{
  window.__arrivalFrameEvidence={phase:'landing',last:0,samples:[]}
  const probe=window.__arrivalFrameEvidence
  requestAnimationFrame(function tick(t){
   if(probe.last>0)probe.samples.push(Math.round(t-probe.last))
   probe.last=t
   if(probe.samples.length<300)requestAnimationFrame(tick)
  })
  return !!document.querySelector('[data-testid="arrival-land"]')
 })
 if(!before)throw Error('Landing button disappeared')
 await button.click()
 await page.waitForFunction(()=>!document.querySelector('[data-testid="arrival-land"]'),null,{timeout:30000})
 await page.waitForTimeout(4500)
 report.afterLanding=await page.evaluate(()=>{
  const data=window.__arrivalFrameEvidence?.samples||[]
  const steps=window.__orbitaLandingTrace?.samples||[]
  const topR3f=[...steps].sort((a,b)=>b.gapMs-a.gapMs).slice(0,8)
  return {frames:data.length,maxFrameGapMs:Math.max(0,...data),
   framesOver120ms:data.filter(x=>x>120).length,
   frameP95Ms:[...data].sort((a,b)=>a-b)[Math.floor((data.length-1)*.95)]??null,
   r3fFrames:steps.length,
   r3fMaxGapMs:Math.max(0,...steps.map(s=>s.gapMs)),
   worstR3fFrames:topR3f,
   canvasStillPresent:!!document.querySelector('canvas')}
 })
 await page.screenshot({path:'browser-evidence/orbita-arrival-landed.png',timeout:60000})
 if(!report.afterLanding.canvasStillPresent)throw Error('WebGL canvas lost after landing')
 report.verdict=report.afterLanding.maxFrameGapMs<=120&&failures.length===0
   ? 'PASS_ARRIVAL_GATE_AND_FRAME' : 'ARRIVAL_GATE_PASS_FRAME_FAIL'
 console.log('ORBITA_ARRIVAL_SMOKE '+JSON.stringify(report))
 writeFileSync('browser-evidence/orbita-arrival-gate.json',JSON.stringify(report,null,2))
 if(report.verdict!=='PASS_ARRIVAL_GATE_AND_FRAME')process.exitCode=12
}catch(e){
 report.verdict='ARRIVAL_BLOCKED'
 report.blocker=String(e)
 report.warmup=await page.evaluate(()=>window.__orbitaColossusWarmup??null).catch(()=>null)
 console.error('ORBITA_ARRIVAL_BLOCKED '+JSON.stringify(report))
 writeFileSync('browser-evidence/orbita-arrival-gate.json',JSON.stringify(report,null,2))
 process.exitCode=4
}finally{await browser.close()}
