import {createRequire} from 'node:module'
import {mkdirSync,writeFileSync} from 'node:fs'
const {chromium}=createRequire(import.meta.url)('../source/node_modules/playwright')
mkdirSync('hx9-warp-evidence',{recursive:true})
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal']})
const page=await browser.newPage({viewport:{width:800,height:600},deviceScaleFactor:1})
const report={errors:[],events:[]}
const cdp=await page.context().newCDPSession(page)
await cdp.send('Profiler.enable')
let profiling=false
async function finishProfile(){
 if(!profiling)return
 profiling=false
 const {profile}=await cdp.send('Profiler.stop')
 const nodes=new Map(profile.nodes.map(n=>[n.id,n.callFrame]))
 const totals=new Map()
 for(let i=0;i<(profile.samples?.length??0);i++){
   const f=nodes.get(profile.samples[i]);if(!f)continue
   const key=JSON.stringify({fn:f.functionName||'(anonymous)',url:f.url?.slice(-120),line:f.lineNumber+1})
   totals.set(key,(totals.get(key)??0)+(profile.timeDeltas?.[i]??0))
 }
 report.cpu=Array.from(totals,([key,us])=>({...JSON.parse(key),ms:Math.round(us/1000)})).sort((a,b)=>b.ms-a.ms).slice(0,20)
}

page.on('pageerror',e=>report.errors.push(String(e)))
await page.addInitScript(()=>{
 if(window!==window.top)return
 // Capture *where* the browser blocks rather than attributing a frame gap to
 // the GPU solely from rAF timing. Instrumentation exists only in this test.
 window.__warpProfile={calls:{},longTasks:[],animationFrames:[]}
 for(const ctor of [window.WebGLRenderingContext,window.WebGL2RenderingContext]){
   if(!ctor)continue
   for(const name of Object.getOwnPropertyNames(ctor.prototype)){
     if(name==='constructor')continue
     const original=Object.getOwnPropertyDescriptor(ctor.prototype,name)?.value
     if(typeof original!=='function'||!Object.hasOwn(ctor.prototype,name))continue
     ctor.prototype[name]=function(...args){
       const started=performance.now()
       try{return original.apply(this,args)}finally{
         const duration=performance.now()-started
         const calls=window.__warpProfile.calls
         const record=calls[name] ||= {count:0,totalMs:0,maxMs:0,slow:[]}
         record.count++;record.totalMs+=duration;record.maxMs=Math.max(record.maxMs,duration)
         if(duration>=100&&record.slow.length<12)record.slow.push({at:Math.round(performance.timeOrigin+started),ms:Math.round(duration)})
       }
     }
   }
 }
 try{new PerformanceObserver(list=>{for(const e of list.getEntries())
   window.__warpProfile.longTasks.push({at:Math.round(performance.timeOrigin+e.startTime),ms:Math.round(e.duration)})
 }).observe({type:'longtask',buffered:true})}catch{}
 try{new PerformanceObserver(list=>{for(const e of list.getEntries()){
   window.__warpProfile.animationFrames.push({at:Math.round(performance.timeOrigin+e.startTime),
     ms:Math.round(e.duration),blockingMs:Math.round(e.blockingDuration),
     scripts:Array.from(e.scripts??[],s=>({ms:Math.round(s.duration),source:s.sourceURL?.slice(-160),function:s.sourceFunctionName,invoker:s.invokerType})).sort((a,b)=>b.ms-a.ms).slice(0,5)})
 }}).observe({type:'long-animation-frame',buffered:true})}catch{}
 window.__warpAudit={events:[],gaps:[]};let last=0
 function frame(t){if(last)window.__warpAudit.gaps.push({at:performance.timeOrigin+t,dt:t-last});last=t;requestAnimationFrame(frame)}requestAnimationFrame(frame)
 window.addEventListener('message',e=>{
   if(e.data?.type==='HX9_TEST_AUDIT')window.__warpAudit.events.push(e.data.event)
   if(['ORBITA_SPACE_FRAME_READY','ORBITA_SPACE_ENGAGE','ORBITA_SPACE_WARP_COMPLETE'].includes(e.data?.type))window.__warpAudit.events.push({type:e.data.type,at:performance.timeOrigin+performance.now(),ready:window.__orbitaEntryGate?.ready===true})
 })
})
try{
 await page.goto('http://127.0.0.1:4173/?hx9DiagnosticSpeed=25&hx9AsyncCompile=1',{waitUntil:'domcontentloaded',timeout:120000})
 await page.waitForFunction(()=>window.__orbitaEntryGate?.shipRendered===true,null,{timeout:240000})
 const frame=page.frames().find(f=>f.url().includes('immersive/index.html'))
 if(!frame)throw Error('Spaceship frame missing')
 await frame.evaluate(async()=>{
   const flight=(await import('ship/lib/flight')).flight, node=document.querySelector('.hx9-app')
   let active=false,last=0,frames=0,maxGap=0,first=0
   function tick(t){if(active){if(last)maxGap=Math.max(maxGap,t-last);else first=t;last=t;frames++}requestAnimationFrame(tick)}
   requestAnimationFrame(tick)
   new MutationObserver(()=>{
     const state=node.dataset.jump
     if(state==='charging'&&!active){active=true;last=0;frames=0;maxGap=0}
     parent.postMessage({type:'HX9_TEST_AUDIT',event:{type:state,at:performance.timeOrigin+performance.now(),ready:node.dataset.islandReady==='true',speed:flight.speed,canvas:!!document.querySelector('canvas'),shipFrameCount:frames,shipMaxGapMs:Math.round(maxGap),shipDurationMs:Math.round(last-first)}},location.origin)
   }).observe(node,{attributes:true,attributeFilter:['data-jump']})
 })
 await cdp.send('Profiler.start'); profiling=true
 await page.frameLocator('iframe[title*="spaceship cockpit"]').locator('.hx9-enter').click({timeout:90000})
 await page.waitForSelector('[data-orbita-space-entry="true"]',{state:'detached',timeout:300000})
 await page.waitForTimeout(1200)
 await finishProfile()
 const result=await page.evaluate(()=>({audit:window.__warpAudit,paint:window.__orbitaIslandFirstPaint,gate:window.__orbitaEntryGate,shaderCompile:window.__orbitaIslandShaderCompile,profile:window.__warpProfile}))
 report.events=result.audit.events;report.paint=result.paint;report.gate=result.gate;report.shaderCompile=result.shaderCompile;report.profile=result.profile
 const begin=report.events.find(e=>e.type==='ORBITA_SPACE_ENGAGE'), charging=report.events.find(e=>e.type==='charging'),flash=report.events.find(e=>e.type==='flash'),end=report.events.find(e=>e.type==='ORBITA_SPACE_WARP_COMPLETE')
 if(!begin||!charging||!charging.canvas||!flash||!flash.ready||!end||!end.ready)throw Error('Warp ordering or real gate failed')
 if(flash.speed<9)throw Error('Flash started before visible warp acceleration')
 const gaps=result.audit.gaps.filter(x=>x.at>=begin.at&&x.at<=end.at+1000).map(x=>x.dt).sort((a,b)=>a-b)
 report.timing={chargeMs:Math.round(flash.at-begin.at),flashMs:Math.round(end.at-flash.at),maxGapMs:Math.round(gaps.at(-1)??0),p95Ms:Math.round(gaps[Math.floor(gaps.length*.95)]??0),frames:gaps.length,warpSpeedAtFlash:flash.speed,shipMaxGapMs:flash.shipMaxGapMs,shipFrameCount:flash.shipFrameCount,shipDurationMs:flash.shipDurationMs}
 if(report.errors.length)throw Error('Browser page errors')
 // A structurally correct handoff is not a performance pass if it visibly freezes.
 if(report.timing.shipMaxGapMs>250 || report.timing.shipFrameCount<10)throw Error('Spaceship frame gap exceeded 250ms or insufficient frames')
 if(report.timing.flashMs>900)throw Error('Flash to island exceeded 900ms')
 console.log('HX9_WARP_PASS '+JSON.stringify(report))
}catch(e){
 report.error=String(e)
 try{await finishProfile()}catch{}
 try{report.diagnostic=await page.evaluate(()=>({gate:window.__orbitaEntryGate,paint:window.__orbitaIslandFirstPaint,events:window.__warpAudit?.events,shaderCompile:window.__orbitaIslandShaderCompile,profile:window.__warpProfile}))}catch{}
 const profile=report.profile??report.diagnostic?.profile
 const summary={error:report.error,timing:report.timing,events:report.events,cpu:report.cpu,
   calls:profile?.calls,longTasks:profile?.longTasks?.sort((a,b)=>b.ms-a.ms).slice(0,15),animationFrames:profile?.animationFrames?.sort((a,b)=>b.ms-a.ms).slice(0,5)}
 console.error('HX9_WARP_FAIL '+JSON.stringify(summary));process.exitCode=1
}finally{writeFileSync('hx9-warp-evidence/result.json',JSON.stringify(report,null,2));await browser.close()}
