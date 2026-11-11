import {createRequire} from 'node:module'
import {mkdirSync,writeFileSync} from 'node:fs'
const require=createRequire(import.meta.url)
const {chromium}=require('../source/node_modules/playwright')
mkdirSync('hex-cpu-trace',{recursive:true})
const modes=(process.env.HEX_CPU_MODES??'normal,prime-first-use').split(',')
const browser=await chromium.launch({headless:true,args:[
 '--enable-webgl','--enable-gpu','--ignore-gpu-blocklist',
 '--use-angle=metal','--disable-software-rasterizer'
]})
const results=[]
for(const [idx,mode] of modes.entries()){
 const context=await browser.newContext({viewport:{width:960,height:540},deviceScaleFactor:1})
 const page=await context.newPage()
 page.setDefaultTimeout(120000)
 const r={mode,errors:[],requests:[]}
 page.on('pageerror',e=>r.errors.push(e.message))
 page.on('requestfailed',e=>r.requests.push(e.url().slice(0,140)))
 results.push(r)
 try{
  const flags=mode==='prime-first-use'
   ? '?hexCooperativeLinear=1&hexShadowProgramWarm=1&hexPrimeFirstUse=1'
   : mode==='prime-checked-fast'
   ? '?hexCooperativeLinear=1&hexShadowProgramWarm=1&hexPrimeFirstUse=1&hexPrimeSkipLogs=1'
   : mode==='shadow-linear'
   ? '?hexCooperativeLinear=1&hexShadowProgramWarm=1'
   : ''
  await page.goto('http://127.0.0.1:4174/'+(flags?flags+'&hexProfile=1':'?hexProfile=1')+'#at=-26,20,0,0&autostart&skip',
   {waitUntil:'domcontentloaded',timeout:120000})
  await page.waitForFunction(async()=>{
   const {useStore}=await import('orbita/store')
   return useStore.getState().ready&&useStore.getState().phase==='playing'
  },null,{timeout:120000})
  await page.waitForFunction(()=>{
   const p=window.__orbitaHexShaderPrep
   return p?.status==='complete-or-interrupted'&&
     p.compiledShaders===p.totalShaders&&
     p.uploadedTextures===p.totalTextures
  },null,{timeout:180000,polling:500})
  r.prep=await page.evaluate(()=>({...window.__orbitaHexShaderPrep}))
  await page.evaluate(()=>{
   window.__hexCpuFrames=[]
   window.__hexCpuTasks=[]
   const obs=new PerformanceObserver(entries=>{
     for(const entry of entries.getEntries()){
       window.__hexCpuTasks.push({at:entry.startTime,duration:entry.duration,name:entry.name})
     }
   })
   try{obs.observe({type:'longtask',buffered:false})}catch{}
   window.__hexCpuObserver=obs
   requestAnimationFrame(function raf(t){
    window.__hexCpuFrames.push(t)
    requestAnimationFrame(raf)
   })
  })
  await page.waitForTimeout(600)
  const cdp=await context.newCDPSession(page)
  await cdp.send('Profiler.enable')
  await cdp.send('Profiler.setSamplingInterval',{interval:500})
  await cdp.send('Profiler.start')
  await page.evaluate(()=>{
    window.__hexCpuFrames=[]
    window.__hexCpuTasks=[]
    window.__hexCpuClicked=performance.now()
    window.__orbitaReality.requestReality('mua-ha')
  })
  await page.waitForTimeout(11000)
  const {profile}=await cdp.send('Profiler.stop')
  await cdp.send('Profiler.disable')
  const self=new Map()
  const nodes=new Map(profile.nodes.map(n=>[n.id,n]))
  for(let i=0;i<(profile.samples?.length??0);i++){
   const id=profile.samples[i]
   const n=nodes.get(id)
   if(!n)continue
   const f=n.callFrame
   const key=[f.functionName,f.url?.startsWith('data:')?'embedded-js':f.url,f.lineNumber].join('|')
   const cur=self.get(key)??{function:f.functionName,url:key.split('|')[1],line:f.lineNumber,
     selfMs:0,samples:0}
   cur.selfMs+=(profile.timeDeltas?.[i]??500)/1000
   cur.samples++
   self.set(key,cur)
  }
  const top=[...self.values()].sort((a,b)=>b.selfMs-a.selfMs).slice(0,50)
  r.cpu={elapsedMs:Math.round((profile.endTime-profile.startTime)/1000),
   samples:profile.samples?.length??0,totalSelfMs:Math.round([...self.values()].reduce((sum,x)=>sum+x.selfMs,0)),
   top}
  r.render=await page.evaluate(()=>{
   const frames=window.__hexCpuFrames
   const gaps=frames.slice(1).map((t,i)=>t-frames[i])
   const now=performance.now()
   return {durationMs:Math.round(now-window.__hexCpuClicked),
    maxGapMs:Math.round(Math.max(0,...gaps,now-(frames.at(-1)??window.__hexCpuClicked))),
    longTaskMaxMs:Math.round(Math.max(0,...window.__hexCpuTasks.map(x=>x.duration))),
    topLongTasks:[...window.__hexCpuTasks].sort((a,b)=>b.duration-a.duration).slice(0,8),
    phase:window.__orbitaReality.useReality.getState().phase,
    front:window.__orbitaReality.rt.front,
    shaderPrep:window.__orbitaHexShaderPrep,
    source:window.__orbitaHexTimings??null}
  })
  writeFileSync('hex-cpu-trace/'+mode+'-'+idx+'.cpuprofile',JSON.stringify(profile))
  await page.screenshot({path:'hex-cpu-trace/'+mode+'-'+idx+'.png',timeout:120000})
  console.log('HEX_CPU_TRACE '+JSON.stringify({mode,prep:r.prep,cpu:r.cpu.top.slice(0,15),
   render:r.render,error:r.error}).slice(0,12000))
 }catch(e){r.error=String(e);console.error('HEX_CPU_TRACE_ERROR '+mode+' '+r.error)}
 writeFileSync('hex-cpu-trace/results.json',JSON.stringify(results,null,2))
 await context.close()
}
await browser.close()
if(results.some(x=>x.error||x.errors.length||x.requests.length))process.exitCode=4
