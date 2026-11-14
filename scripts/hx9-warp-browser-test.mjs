import {createRequire} from 'node:module'
import {mkdirSync,writeFileSync} from 'node:fs'
const {chromium}=createRequire(import.meta.url)('../source/node_modules/playwright')
mkdirSync('hx9-warp-evidence',{recursive:true})
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']})
const page=await browser.newPage({viewport:{width:800,height:600},deviceScaleFactor:1})
const report={errors:[],events:[]}
page.on('pageerror',e=>report.errors.push(String(e)))
await page.addInitScript(()=>{
 if(window!==window.top)return
 window.__warpAudit={events:[],gaps:[]};let last=0
 function frame(t){if(last)window.__warpAudit.gaps.push({at:performance.timeOrigin+t,dt:t-last});last=t;requestAnimationFrame(frame)}requestAnimationFrame(frame)
 window.addEventListener('message',e=>{
   if(e.data?.type==='HX9_TEST_AUDIT')window.__warpAudit.events.push(e.data.event)
   if(['ORBITA_SPACE_FRAME_READY','ORBITA_SPACE_ENGAGE','ORBITA_SPACE_WARP_COMPLETE'].includes(e.data?.type))window.__warpAudit.events.push({type:e.data.type,at:performance.timeOrigin+performance.now(),ready:window.__orbitaEntryGate?.ready===true})
 })
})
try{
 await page.goto('http://127.0.0.1:4173/?hx9DiagnosticSpeed=25&hx9Isolate=1',{waitUntil:'domcontentloaded',timeout:120000})
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
 await page.frameLocator('iframe[title*="spaceship cockpit"]').locator('.hx9-enter').click({timeout:90000})
 await page.waitForSelector('[data-orbita-space-entry="true"]',{state:'detached',timeout:300000})
 await page.waitForTimeout(1200)
 const result=await page.evaluate(()=>({audit:window.__warpAudit,paint:window.__orbitaIslandFirstPaint,gate:window.__orbitaEntryGate}))
 report.events=result.audit.events;report.paint=result.paint;report.gate=result.gate
 const begin=report.events.find(e=>e.type==='ORBITA_SPACE_ENGAGE'), charging=report.events.find(e=>e.type==='charging'),flash=report.events.find(e=>e.type==='flash'),end=report.events.find(e=>e.type==='ORBITA_SPACE_WARP_COMPLETE')
 if(!begin||!charging||!charging.canvas||!flash||!flash.ready||!end||!end.ready)throw Error('Warp ordering or real gate failed')
 const gaps=result.audit.gaps.filter(x=>x.at>=begin.at&&x.at<=end.at+1000).map(x=>x.dt).sort((a,b)=>a-b)
 report.timing={chargeMs:Math.round(flash.at-begin.at),flashMs:Math.round(end.at-flash.at),maxGapMs:Math.round(gaps.at(-1)??0),p95Ms:Math.round(gaps[Math.floor(gaps.length*.95)]??0),frames:gaps.length,warpSpeedAtFlash:flash.speed,shipMaxGapMs:flash.shipMaxGapMs,shipFrameCount:flash.shipFrameCount,shipDurationMs:flash.shipDurationMs}
 if(report.errors.length)throw Error('Browser page errors')
 // A structurally correct handoff is not a performance pass if it visibly freezes.
 if(report.timing.shipMaxGapMs>250 || report.timing.shipFrameCount<10)throw Error('Spaceship frame gap exceeded 250ms or insufficient frames')
 if(report.timing.flashMs>900)throw Error('Flash to island exceeded 900ms')
 console.log('HX9_WARP_PASS '+JSON.stringify(report))
}catch(e){
 report.error=String(e)
 try{report.diagnostic=await page.evaluate(()=>({gate:window.__orbitaEntryGate,paint:window.__orbitaIslandFirstPaint,events:window.__warpAudit?.events}))}catch{}
 console.error('HX9_WARP_FAIL '+JSON.stringify(report));process.exitCode=1
}finally{writeFileSync('hx9-warp-evidence/result.json',JSON.stringify(report,null,2));await browser.close()}
