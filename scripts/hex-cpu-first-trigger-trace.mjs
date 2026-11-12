import {createRequire} from 'node:module'
import {mkdirSync,writeFileSync} from 'node:fs'
const require=createRequire(import.meta.url)
const {chromium}=require('../source/node_modules/playwright')
mkdirSync('hex-cpu-trace',{recursive:true})
const modes=(process.env.HEX_CPU_MODES??'normal,prime-first-use').split(',')
const software=process.env.HEX_CPU_BACKEND==='software'
const browser=await chromium.launch({headless:true,args:software
  ? ['--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
     '--enable-unsafe-swiftshader']
  : ['--enable-webgl','--enable-gpu','--ignore-gpu-blocklist',
     '--use-angle=metal','--disable-software-rasterizer']})
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
  const flags=mode==='batch-control'
   ? '?hexCooperativeLinear=1&hexShadowProgramWarm=1&hexPrimeFirstUse=1&hexCinemaFarLightGate=1'
   : mode==='batch-exact'
   ? '?hexCooperativeLinear=1&hexShadowProgramWarm=1&hexPrimeFirstUse=1&hexCinemaFarLightGate=1&hexBatchProbe=extended'
   : mode==='batch-overlap'
   ? '?hexCooperativeLinear=1&hexShadowProgramWarm=1&hexPrimeFirstUse=1&hexCinemaFarLightGate=1&hexBatchProbe=extended-overlap'
   : mode==='cinema-cpu-control'
   ? '?hexCooperativeLinear=1&hexShadowProgramWarm=1&hexPrimeFirstUse=1&hexCinemaFarLightGate=1&hexCinemaCpuCanvas=1'
   : mode==='cinema-cpu-overlap'
   ? '?hexCooperativeLinear=1&hexShadowProgramWarm=1&hexPrimeFirstUse=1&hexCinemaFarLightGate=1&hexCinemaCpuCanvas=1&hexBatchProbe=extended-overlap'
   : mode==='prime-first-use'
   ? '?hexCooperativeLinear=1&hexShadowProgramWarm=1&hexPrimeFirstUse=1'
   : mode==='prime-checked-fast'
   ? '?hexCooperativeLinear=1&hexShadowProgramWarm=1&hexPrimeFirstUse=1&hexPrimeSkipLogs=1'
   : mode==='shadow-linear'
   ? '?hexCooperativeLinear=1&hexShadowProgramWarm=1'
   : mode==='cinema-cpu'
   ? '?hexCinemaCpuCanvas=1'
   : mode==='cinema-far-light'
   ? '?hexCinemaFarLightGate=1'
   : mode==='prime-cinema-far'
   ? '?hexCooperativeLinear=1&hexShadowProgramWarm=1&hexPrimeFirstUse=1&hexCinemaFarLightGate=1'
   : /^gpu-no-instance-[0-7]$/.test(mode)
   ? '?hexCooperativeLinear=1&hexShadowProgramWarm=1&hexPrimeFirstUse=1&hexCinemaFarLightGate=1&hexGpuDiag=no-ueh-instance-'+mode.slice(-1)
   : mode==='gpu-vertex-leaves'
   ? '?hexCooperativeLinear=1&hexShadowProgramWarm=1&hexPrimeFirstUse=1&hexCinemaFarLightGate=1&hexVertexGate=leaves'
   : mode==='gpu-vertex-all'
   ? '?hexCooperativeLinear=1&hexShadowProgramWarm=1&hexPrimeFirstUse=1&hexCinemaFarLightGate=1&hexVertexGate=all'
   : mode==='gpu-attribute-warm'
   ? '?hexCooperativeLinear=1&hexShadowProgramWarm=1&hexPrimeFirstUse=1&hexCinemaFarLightGate=1&hexInstanceBufferWarm=1'
   : mode==='gpu-no-instances'
   ? '?hexCooperativeLinear=1&hexShadowProgramWarm=1&hexPrimeFirstUse=1&hexCinemaFarLightGate=1&hexGpuDiag=no-ueh-instanced'
   : mode==='gpu-no-foliage'
   ? '?hexCooperativeLinear=1&hexShadowProgramWarm=1&hexPrimeFirstUse=1&hexCinemaFarLightGate=1&hexGpuDiag=no-ueh-foliage'
   : mode==='gpu-no-world'
   ? '?hexCooperativeLinear=1&hexShadowProgramWarm=1&hexPrimeFirstUse=1&hexCinemaFarLightGate=1&hexGpuDiag=no-world'
   : mode==='gpu-no-architecture'
   ? '?hexCooperativeLinear=1&hexShadowProgramWarm=1&hexPrimeFirstUse=1&hexCinemaFarLightGate=1&hexGpuDiag=no-ueh-architecture'
   : mode==='gpu-no-wind'
   ? '?hexCooperativeLinear=1&hexShadowProgramWarm=1&hexPrimeFirstUse=1&hexCinemaFarLightGate=1&hexGpuDiag=no-ueh-wind'
   : mode==='gpu-post-off'
   ? '?hexCooperativeLinear=1&hexShadowProgramWarm=1&hexPrimeFirstUse=1&hexCinemaFarLightGate=1&colossusPostProbe=off'
   : ''
  await page.goto('http://127.0.0.1:4174/'+(flags?flags+'&hexProfile=1':'?hexProfile=1')+'#at=-26,20,0,0&autostart&skip',
   {waitUntil:'domcontentloaded',timeout:120000})
  await page.waitForFunction(async()=>{
   const {useStore}=await import('orbita/store')
   return useStore.getState().ready&&useStore.getState().phase==='playing'
  },null,{timeout:120000})
  // A real visitor can open HEX before 83/83 shaders complete. Waiting
  // three minutes creates an artificial test that never reaches the click on
  // a busy GPU. Bound prep and record its true completeness at activation.
  const fullPrewarm=await page.waitForFunction(()=>{
   const p=window.__orbitaHexShaderPrep
   return p?.status==='complete-or-interrupted'&&
     p.compiledShaders===p.totalShaders&&
     p.uploadedTextures===p.totalTextures
  },null,{timeout:12000,polling:350}).then(()=>true,()=>false)
  r.prep=await page.evaluate(()=>({
    ...(window.__orbitaHexShaderPrep??{status:'not-started'})
  }))
  r.fullPrewarmBeforeClick=fullPrewarm
  r.backend=await page.evaluate(()=>window.__orbitaHexRenderer??'unavailable')
  if(software&&!/SwiftShader|Software|llvmpipe/i.test(r.backend))
    throw Error('Expected actual software GPU, got '+r.backend)
  if(!software&&!/Metal/i.test(r.backend))
    throw Error('Expected actual Metal GPU, got '+r.backend)
  if(mode==='gpu-attribute-warm'){
   await page.waitForFunction(()=>{
    const p=window.__orbitaHexInstanceBufferWarm
    return ['ready','failed','rejected-idle-stall','empty'].includes(p?.status)
   },null,{timeout:120000,polling:400})
   r.instanceBufferWarm=await page.evaluate(()=>({...window.__orbitaHexInstanceBufferWarm}))
   if(r.instanceBufferWarm.status!=='ready'||
      r.instanceBufferWarm.done!==r.instanceBufferWarm.total||
      r.instanceBufferWarm.maxSubmitMs>120||r.instanceBufferWarm.errors)
    throw Error('GPU attribute warm must not create idle hitch: '+JSON.stringify(r.instanceBufferWarm))
  }
  await page.evaluate(()=>{
   window.__hexCpuFrames=[]
   window.__hexCpuTasks=[]
   window.__hexCpuHeartbeats=[performance.now()]
   // Independent of rAF: distinguish main-thread stalls from compositor/GPU-only starvation.
   window.__hexCpuHeartbeat=setInterval(()=>window.__hexCpuHeartbeats.push(performance.now()),25)
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
  // Measure the no-click idle route separately. A successful fix must not
  // simply move a multi-second stall from clicking into visiting the area.
  r.noClickIdle=await page.evaluate(()=>new Promise(resolve=>{
    let first=0,last=0,max=0,over120=0,samples=0
    const tick=(t)=>{
      if(!first)first=t
      if(last){const dt=t-last;max=Math.max(max,dt);if(dt>120)over120++}
      last=t;samples++
      if(t-first<2500)requestAnimationFrame(tick)
      else resolve({maxGapMs:Math.round(max),over120,samples})
    }
    requestAnimationFrame(tick)
  }))
  const cdp=await context.newCDPSession(page)
  await cdp.send('Profiler.enable')
  await cdp.send('Profiler.setSamplingInterval',{interval:500})
  await cdp.send('Profiler.start')
  await page.evaluate(()=>{
    window.__hexCpuFrames=[]
    window.__hexCpuTasks=[]
    window.__hexCpuHeartbeats=[]
    window.__hexCpuClicked=performance.now()
    window.__hexCpuHeartbeats.push(window.__hexCpuClicked)
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
   const ticks=window.__hexCpuHeartbeats
   const timerGaps=ticks.slice(1).map((t,i)=>t-ticks[i])
   const now=performance.now()
   clearInterval(window.__hexCpuHeartbeat)
   const rafStall=Math.max(0,...gaps,now-(frames.at(-1)??window.__hexCpuClicked))
   const timerStall=Math.max(0,...timerGaps,now-(ticks.at(-1)??window.__hexCpuClicked))
   return {durationMs:Math.round(now-window.__hexCpuClicked),
    heartbeatSamples:ticks.length,
    maxTimerGapMs:Math.round(timerStall),
    timerGapsOver120Ms:timerGaps.filter(g=>g>120).length,
    maxRafMinusTimerGapMs:Math.round(rafStall-timerStall),
    timersStillActiveWhileRafStarved:rafStall-timerStall>1000,
    maxGapMs:Math.round(Math.max(0,...gaps,now-(frames.at(-1)??window.__hexCpuClicked))),
    longTaskMaxMs:Math.round(Math.max(0,...window.__hexCpuTasks.map(x=>x.duration))),
    topLongTasks:[...window.__hexCpuTasks].sort((a,b)=>b.duration-a.duration).slice(0,8),
    phase:window.__orbitaReality.useReality.getState().phase,
    front:window.__orbitaReality.rt.front,
    gpuDiag:window.__orbitaHexGpuDiagStats??null,
    exactBatch:window.__orbitaHexBatchStats??null,
    vertexGate:window.__orbitaHexVertexGate??null,
    shaderPrep:window.__orbitaHexShaderPrep,
    source:window.__orbitaHexTimings??null}
  })
  writeFileSync('hex-cpu-trace/'+mode+'-'+idx+'.cpuprofile',JSON.stringify(profile))
  await page.screenshot({path:'hex-cpu-trace/'+mode+'-'+idx+'.png',timeout:120000})
  console.log('HEX_CPU_TRACE '+JSON.stringify({mode,backend:r.backend,
   noClickIdle:r.noClickIdle,fullPrewarmBeforeClick:r.fullPrewarmBeforeClick,
   prep:r.prep,cpu:r.cpu.top.slice(0,15),
   render:r.render,instanceBufferWarm:r.instanceBufferWarm,error:r.error}).slice(0,12000))
 }catch(e){r.error=String(e);console.error('HEX_CPU_TRACE_ERROR '+mode+' '+r.error)}
 writeFileSync('hex-cpu-trace/results.json',JSON.stringify(results,null,2))
 await context.close()
}
await browser.close()
if(results.some(x=>x.error||x.errors.length||x.requests.length))process.exitCode=4
