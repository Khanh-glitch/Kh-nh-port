import {createRequire} from 'node:module'
import {mkdirSync,writeFileSync} from 'node:fs'
const require=createRequire(import.meta.url)
const {chromium}=require('../source/node_modules/playwright')
const variant=process.env.LANDING_GPU_VARIANT||'enabled'
if(!['enabled','off'].includes(variant))throw Error('Unknown landing GPU candidate')
mkdirSync('browser-evidence',{recursive:true})
const browser=await chromium.launch({headless:true,args:[
 '--enable-webgl','--enable-gpu','--ignore-gpu-blocklist','--use-angle=metal',
 '--disable-software-rasterizer'
]})
const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1})
const errors=[]
page.on('pageerror',e=>errors.push(e.message))
const base='http://127.0.0.1:4173/'
const url=base+(variant==='off'?'?landingGpuPreflight=off':'')+'#at=0,46,0,-2&skip'
const report={sha:process.env.GITHUB_SHA,variant,url,errors}
try{
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:120000})
 await page.waitForFunction(()=>{
  const landing=window.__orbitaLandingPrewarm
  const w=window.__orbitaColossusWarmup
  const btn=[...document.querySelectorAll('button')].find(b=>b.textContent?.includes('BƯỚC VÀO'))
  return landing &&
    (landing.status==='ready'||landing.status==='disabled') &&
    w?.status==='ready'&&w.uploadedProxies===w.totalProxies&&w.totalProxies>=120 &&
    btn&&!btn.disabled
 },null,{timeout:180000,polling:250})
 report.before=await page.evaluate(()=>{
  const canvas=document.querySelector('canvas')
  const gl=canvas?.getContext('webgl2')
  const dbg=gl?.getExtension('WEBGL_debug_renderer_info')
  return {landing:window.__orbitaLandingPrewarm,
    renderer:gl?.getParameter(dbg?.UNMASKED_RENDERER_WEBGL??gl.RENDERER),
    colossus:window.__orbitaColossusWarmup?.status}
 })
 if(!/Metal/.test(String(report.before.renderer))||/SwiftShader/.test(String(report.before.renderer)))
  throw Error('Actual Metal backend not confirmed: '+report.before.renderer)
 if(variant==='enabled'&&(!report.before.landing.gpuSynced||report.before.landing.passes!==2))
  throw Error('First-landing GPU preflight not verified')
 await page.screenshot({path:'browser-evidence/landing-'+variant+'-before.png'})
 const measure=async(ms)=>{
  return page.evaluate(async duration=>{
   const samples=[],start=performance.now()
   await new Promise(resolve=>{
    let last=0
    function tick(now){
     if(last>0)samples.push(now-last)
     last=now
     if(performance.now()-start>=duration){resolve(null);return}
     requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
   })
   const sorted=[...samples].sort((a,b)=>a-b)
   return {frames:samples.length,maxMs:Math.round(Math.max(0,...samples)),
    medianMs:Math.round(sorted[Math.floor((sorted.length-1)*.5)]||0),
    p95Ms:Math.round(sorted[Math.floor((sorted.length-1)*.95)]||0),
    framesOver120:samples.filter(x=>x>120).length}
  },ms)
 }
 report.idle=await measure(3500)
 await page.evaluate(()=>{
  window.__firstLandingMeasurements={start:performance.now(),times:[],last:0}
  const ref=window.__firstLandingMeasurements
  requestAnimationFrame(function tick(now){
   if(ref.last>0)ref.times.push(now-ref.last)
   ref.last=now
   if(performance.now()-ref.start<=7000)requestAnimationFrame(tick)
  })
 })
 await page.getByText('BƯỚC VÀO',{exact:true}).click({timeout:15000})
 await page.waitForTimeout(6500)
 report.landed=await page.evaluate(()=>{
  const a=window.__firstLandingMeasurements?.times||[]
  const sorted=[...a].sort((x,y)=>x-y)
  return {frames:a.length,maxMs:Math.round(Math.max(0,...a)),
    p95Ms:Math.round(sorted[Math.floor((sorted.length-1)*.95)]||0),
    framesOver120:a.filter(x=>x>120).length,canvasPresent:!!document.querySelector('canvas')}
 })
 await page.screenshot({path:'browser-evidence/landing-'+variant+'-after.png'})
 report.verdict=report.landed.maxMs<=120&&errors.length===0?'FIRST_ENTER_FRAME_PASS':'FIRST_ENTER_HITCH_REMAINS'
 console.log('ORBITA_FIRST_LANDING '+JSON.stringify(report))
 writeFileSync('browser-evidence/orbita-first-landing.json',JSON.stringify(report,null,2))
 if(report.verdict!=='FIRST_ENTER_FRAME_PASS')process.exitCode=12
}catch(e){
 report.verdict='LANDING_TEST_BLOCKED'
 report.blocker=String(e)
 report.warm=await page.evaluate(()=>({
  landing:window.__orbitaLandingPrewarm??null,
  colossus:window.__orbitaColossusWarmup??null
 })).catch(()=>null)
 console.error('ORBITA_FIRST_LANDING_BLOCKED '+JSON.stringify(report))
 writeFileSync('browser-evidence/orbita-first-landing.json',JSON.stringify(report,null,2))
 process.exitCode=4
}finally{await browser.close()}
