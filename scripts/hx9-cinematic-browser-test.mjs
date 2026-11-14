import {createRequire} from 'node:module'
import {mkdirSync,writeFileSync} from 'node:fs'
const require=createRequire(import.meta.url),{chromium}=require('../source/node_modules/playwright')
mkdirSync('hx9-evidence',{recursive:true})
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']})
const data={errors:[],phases:[],failed:[]}
const page=await browser.newPage({viewport:{width:1100,height:720},deviceScaleFactor:1})
page.on('pageerror',e=>data.errors.push(String(e)))
page.on('requestfailed',r=>{if(r.url().includes('/model/'))data.failed.push(r.url()+':'+r.failure()?.errorText)})
await page.addInitScript(()=>{
  window.__hx9Frames=[];let last=0
  function frame(now){if(last)window.__hx9Frames.push(now-last);last=now;requestAnimationFrame(frame)}
  requestAnimationFrame(frame)
  if(window===window.top){window.__hx9Order={ship:0,island:0};window.addEventListener('message',e=>{if(e.data?.type==='ORBITA_SPACE_FRAME_READY'&&!window.__hx9Order.ship)window.__hx9Order.ship=performance.now()});new MutationObserver(()=>{if(!window.__hx9Order.island&&document.querySelector('#root canvas'))window.__hx9Order.island=performance.now()}).observe(document,{subtree:true,childList:true})}
})
try{
 await page.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded',timeout:120000})
 await page.waitForSelector('iframe[title*="spaceship cockpit"]',{timeout:90000})
 const frame=await (await page.$('iframe[title*="spaceship cockpit"]')).contentFrame()
 await frame.evaluate(()=>{window.__hx9Frames=[];let last=0;function loop(t){if(last)window.__hx9Frames.push(t-last);last=t;requestAnimationFrame(loop)}requestAnimationFrame(loop)})
 for(const [name,time] of [['seat',4],['dashboard',8],['controls',12],['structure',16],['shell',20],['glass',24],['pilot',36.5]]){
  await frame.waitForFunction(t=>window.__orbitaHx9?.time>=t,time,{timeout:90000})
  const stats=await frame.evaluate(()=>({hx:window.__orbitaHx9,frames:window.__hx9Frames.length,maxGap:Math.round(Math.max(0,...window.__hx9Frames))}))
  data.phases.push({name,...stats})
  // Screenshot readback can itself fence the GPU for seconds; keep the
  // no-stall measurement free from capture operations during the sequence.
 }
 data.gaps=await frame.evaluate(()=>{const a=window.__hx9Frames.slice().sort((x,y)=>x-y);return {max:Math.max(...a),p95:a[Math.floor(a.length*.95)],frames:a.length}})
 await page.screenshot({path:'hx9-evidence/pilot.png',timeout:120000})
 await page.frameLocator('iframe[title*="spaceship cockpit"]').locator('.hx9-enter').click({timeout:90000})
 await page.waitForFunction(()=>window.__orbitaEntryGate?.ready===true,null,{timeout:240000})
 data.gate=await page.evaluate(()=>({gate:window.__orbitaEntryGate,order:window.__hx9Order}))
 if(!data.gate.order.ship||data.gate.order.island<data.gate.order.ship)throw Error('Orbita mounted before completed cinematic')
 await page.waitForSelector('[data-orbita-space-entry="true"]',{state:'detached',timeout:120000})
 data.entered=true
 if(data.errors.length||data.failed.length)throw Error('Browser error or model request failed')
 console.log('HX9_CINEMATIC_PASS '+JSON.stringify(data))
}catch(e){try{const f=page.frames().find(f=>f.url().includes('immersive'));data.diagnostic=f?await f.evaluate(()=>({hx:window.__orbitaHx9,painted:window.__orbitaSpacePainted,text:document.body.innerText,frames:window.__hx9Frames?.length})):null}catch{}data.error=String(e);console.error('HX9_CINEMATIC_FAILED '+JSON.stringify(data));process.exitCode=1}finally{writeFileSync('hx9-evidence/result.json',JSON.stringify(data,null,2));await browser.close()}
