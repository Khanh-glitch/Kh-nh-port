import {createRequire} from 'node:module'
import {mkdirSync,writeFileSync} from 'node:fs'
const require=createRequire(import.meta.url)
const {chromium}=require('../source/node_modules/playwright')
mkdirSync('hex-gpu-isolation',{recursive:true})
const cases=(process.env.HEX_GPU_MODES??'normal,no-ignition,no-ignition-light,no-hex,no-world,no-sheets').split(',').map(x=>x.trim()).filter(Boolean)
const browser=await chromium.launch({headless:true,args:[
  '--enable-webgl','--enable-gpu','--ignore-gpu-blocklist',
  '--use-angle=metal','--disable-software-rasterizer'
]})
const results=[]
for(const mode of cases){
 const context=await browser.newContext({viewport:{width:960,height:540},deviceScaleFactor:1})
 const page=await context.newPage()
 page.setDefaultTimeout(120000)
 const r={mode,errors:[],requests:[],samples:[],preflight:null}
 page.on('pageerror',e=>r.errors.push(e.message))
 page.on('requestfailed',e=>r.requests.push(e.url()))
 results.push(r)
 try{
  await page.goto('http://127.0.0.1:4174/?hexGpuDiag='+mode+
    '&hexProfile=1#at=-26,20,0,0&autostart&skip',
    {waitUntil:'domcontentloaded',timeout:120000})
  await page.waitForFunction(async()=>{
    const {useStore}=await import('orbita/store')
    return useStore.getState().phase==='playing'&&useStore.getState().ready
  },null,{timeout:120000})
  // The current bottleneck survives after all source shader/texture preflight;
  // fully warm them in EVERY case so first drawing is the independent variable.
  await page.waitForFunction(()=>{
    const p=window.__orbitaHexShaderPrep
    return p?.status==='complete-or-interrupted' &&
      p.compiledShaders===p.totalShaders &&
      p.uploadedTextures===p.totalTextures && p.errors===0
  },null,{timeout:150000,polling:500})
  r.preflight=await page.evaluate(()=>({...window.__orbitaHexShaderPrep}))
  r.diag=await page.evaluate(()=>window.__orbitaHexGpuDiagStats??null)
  if(mode.startsWith('no-ueh-') && !(r.diag?.hiddenDrawables>0))
    throw Error('Diagnostic category is empty: '+JSON.stringify(r.diag))
  await page.waitForTimeout(500)
  await page.evaluate(()=>{
    window.__hfd={last:0,frames:[],tasks:[]}
    const observer=new PerformanceObserver(entries=>{
      for(const e of entries.getEntries())
        window.__hfd.tasks.push({start:e.startTime,duration:e.duration})
    })
    try{observer.observe({type:'longtask',buffered:false})}catch{}
    window.__hfd.observer=observer
    requestAnimationFrame(function loop(t){
      if(window.__hfd.last)window.__hfd.frames.push(t-window.__hfd.last)
      window.__hfd.last=t
      requestAnimationFrame(loop)
    })
  })
  await page.waitForTimeout(550)
  await page.evaluate(()=>{
    window.__hfd.frames=[]
    window.__hfd.tasks=[]
    window.__hfd.actionStart=performance.now()
    window.__orbitaReality.requestReality('mua-ha')
  })
  await page.waitForTimeout(9500)
  r.measure=await page.evaluate(()=>{
    const frames=window.__hfd.frames,ts=window.__hfd.tasks
    const t=performance.now()
    const count=frames.length
    const max=Math.max(0,...frames)
    return {
      elapsedMs:Math.round(t-window.__hfd.actionStart),
      maxFrameGapMs:Math.round(max),
      silentTailMs:Math.max(0,Math.round(t-window.__hfd.last)),
      over120:frames.filter(x=>x>120).length,
      frames:count,longTasks:ts.length,
      maxLongTaskMs:Math.round(Math.max(0,...ts.map(x=>x.duration))),
      phase:window.__orbitaReality.useReality.getState().phase,
      front:Math.round(window.__orbitaReality.rt.front),
      culling:window.__orbitaHexCullStats,
      shaderPrep:window.__orbitaHexShaderPrep,
      isolatedGroup:window.__orbitaHexGpuDiagStats??null
    }
  })
  await page.screenshot({path:'hex-gpu-isolation/'+mode+'.png',timeout:120000})
  await page.evaluate(()=>window.__hfd.observer.disconnect())
 }catch(e){r.error=String(e)}
 writeFileSync('hex-gpu-isolation/results.json',JSON.stringify(results,null,2))
 console.log('HEX_GPU_ISOLATION '+JSON.stringify(r).slice(0,15000))
 await context.close()
}
await browser.close()
const valid=results.filter(r=>r.measure).sort((a,b)=>a.measure.silentTailMs-b.measure.silentTailMs)
console.log('HEX_GPU_ISOLATION_RANK '+JSON.stringify(valid.map(x=>({mode:x.mode,ms:x.measure.silentTailMs,frameMs:x.measure.maxFrameGapMs,errors:x.errors}))))
if(results.some(r=>r.error||r.errors.length||r.requests.length))process.exitCode=4
