import {createRequire} from 'node:module'
import {mkdirSync,writeFileSync} from 'node:fs'
const require=createRequire(import.meta.url)
const {chromium}=require('../candidate/source/node_modules/playwright')
mkdirSync('hex-evidence',{recursive:true})
const browser=await chromium.launch({headless:true,args:[
 '--enable-webgl','--enable-gpu','--ignore-gpu-blocklist',
 '--use-angle=metal','--disable-software-rasterizer'
]})
const reports=[]
const contexts=[{name:'baseline-main-4454511',port:4173},{name:'hex-candidate',port:4174}]
for(const test of contexts){
 const context=await browser.newContext({viewport:{width:960,height:540},deviceScaleFactor:1})
 const page=await context.newPage()
 page.setDefaultTimeout(60000)
 const report={name:test.name,errors:[],failures:[],samples:[],screenshots:[],steps:[]}
 reports.push(report)
 page.on('pageerror',e=>report.errors.push(e.message))
 page.on('requestfailed',r=>report.failures.push({url:r.url().slice(0,140),error:r.failure()?.errorText}))
 try{
  await page.goto('http://127.0.0.1:'+test.port+'/' + (test.port===4174?'?hexProfile=1':'') + '#at=-26,20,0,0&autostart&skip',
    {waitUntil:'domcontentloaded',timeout:120000})
  await page.waitForSelector('canvas',{timeout:120000})
  await page.waitForFunction(async()=>{
    const {useStore}=await import('orbita/store')
    return useStore.getState().phase==='playing'&&useStore.getState().ready
  },null,{timeout:120000})
  await page.waitForTimeout(4000)
  await page.evaluate(()=>{
    const {performance}=window
    window.__hexFrames=[]
    window.__hexLongTasks=[]
    window.__hexStamp=0
    const observer=new PerformanceObserver(list=>{
      for(const e of list.getEntries())window.__hexLongTasks.push({t:Math.round(e.startTime),d:Math.round(e.duration)})
    })
    try{observer.observe({type:'longtask',buffered:false})}catch{}
    window.__hexObserver=observer
    requestAnimationFrame(function loop(t){
      if(window.__hexStamp)window.__hexFrames.push({t:Math.round(t),dt:Math.round((t-window.__hexStamp)*10)/10})
      window.__hexStamp=t
      requestAnimationFrame(loop)
    })
  })
  const get=()=>page.evaluate(()=>{
   const phase=window.__orbitaReality?.useReality.getState().phase
   const track=window.__orbitaReality?.useReality.getState().track
   const f=window.__orbitaReality?.rt.front??0
   const gl=document.querySelector('canvas')?.getContext('webgl2')
   const ext=gl?.getExtension('WEBGL_debug_renderer_info')
   const backend=gl?.getParameter(ext?.UNMASKED_RENDERER_WEBGL??gl.RENDERER)
   return {phase,track,front:Math.round(f),backend,contextLost:gl?.isContextLost(),
     prewarm:window.__orbitaHexPrewarm ? {...window.__orbitaHexPrewarm}:null,
     cull:window.__orbitaHexCullStats ? {...window.__orbitaHexCullStats}:null,
     shaders:window.__orbitaHexShaderPrep ? {...window.__orbitaHexShaderPrep}:null}
  })
  async function measure(name,fn,duration){
   await page.evaluate(()=>{window.__hexFrames.length=0;window.__hexLongTasks.length=0})
   const start=await page.evaluate(()=>performance.now())
   const actionStarted=Date.now()
   await fn()
   const actionWallMs=Date.now()-actionStarted
   await page.waitForTimeout(duration)
   const sample=await page.evaluate(start=>{
    const e=performance.now(),frames=window.__hexFrames.filter(x=>x.t>=start&&x.t<=e)
    const tasks=window.__hexLongTasks.filter(x=>x.t>=start&&x.t<=e)
    const dt=frames.map(x=>x.dt).filter(x=>x>0).sort((a,b)=>a-b)
    return {durationMs:Math.round(e-start),frames:dt.length,maxMs:dt.at(-1)??null,
      p95Ms:dt[Math.min(dt.length-1,Math.floor(dt.length*.95))]??null,
      gapsOver120Ms:dt.filter(v=>v>120).length,
      longTasks:tasks.length,maxLongTaskMs:Math.max(0,...tasks.map(x=>x.d)),
      topGaps:dt.slice(-12).reverse(),stage:window.__orbitaReality?.useReality.getState().phase,
      front:Math.round(window.__orbitaReality?.rt.front??0)}
   },start)
   report.samples.push({name,actionWallMs,...sample})
   return sample
  }
  report.intro=await get()
  if(test.port===4174 && (report.intro.cull?.eligible??0)<200){
    throw Error('HEX source shader/cache change disabled scan culling: '+JSON.stringify(report.intro.cull))
  }
  await page.screenshot({path:'hex-evidence/'+test.name+'-idle.png',timeout:90000})
  report.screenshots.push('idle')
  await measure('idle_frametime',async()=>{},2600)
  await measure('first_hex_ignite_sweep',async()=>{
    await page.evaluate(()=>window.__orbitaReality.requestReality('mua-ha'))
  },9200)
  await page.waitForFunction(()=>['sweep','active'].includes(window.__orbitaReality?.useReality.getState().phase),null,{timeout:120000})
  await page.screenshot({path:'hex-evidence/'+test.name+'-hex-rain.png',timeout:90000})
  report.screenshots.push('hex-rain')
  report.steps.push(await get())
  await measure('switch_to_bluesky',async()=>{
   await page.evaluate(()=>window.__orbitaReality.requestReality('ngay-mai'))
  },3300)
  await page.screenshot({path:'hex-evidence/'+test.name+'-hex-blossom.png',timeout:90000})
  report.screenshots.push('hex-blossom')
  await measure('retract',async()=>{
   await page.evaluate(()=>window.__orbitaReality.dismissReality())
  },6700)
  await page.waitForFunction(()=>window.__orbitaReality?.useReality.getState().phase==='idle',null,{timeout:120000})
  await page.screenshot({path:'hex-evidence/'+test.name+'-retract.png',timeout:90000})
  report.screenshots.push('retract')
  report.steps.push(await get())
  await measure('second_hex_ignite_sweep',async()=>{
   await page.evaluate(()=>window.__orbitaReality.requestReality('mua-ha'))
  },9200)
  await page.screenshot({path:'hex-evidence/'+test.name+'-hex-second.png',timeout:90000})
  report.screenshots.push('hex-second')
  report.final=await get()
  report.hexTimings=await page.evaluate(()=>window.__orbitaHexTimings??[])
  await page.evaluate(()=>window.__hexObserver?.disconnect())
 }catch(e){report.error=String(e)}
 await context.close()
 writeFileSync('hex-evidence/bench.json',JSON.stringify(reports,null,2))
 console.log('HEX_BENCH '+JSON.stringify({name:report.name,gpu:report.intro?.backend,steps:report.samples,error:report.error,errors:report.errors,failures:report.failures}).slice(0,13500))
}
await browser.close()
if(reports.some(r=>r.error||r.errors.length||r.failures.length||r.final?.contextLost))process.exitCode=5
