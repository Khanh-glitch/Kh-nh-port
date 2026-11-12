import {createRequire} from 'node:module'
import {mkdirSync,writeFileSync} from 'node:fs'
const require=createRequire(import.meta.url)
const {chromium}=require('../source/node_modules/playwright')
const experiments={
 'baseline':'',
 'no-colossus':'?colossusPrewarm=off',
 'no-hex':'?hexPrewarmIsolation=off',
 'no-both':'?colossusPrewarm=off&hexPrewarmIsolation=off',
}
const order=(process.env.PREWARM_ISOLATION_ORDER??'baseline,no-colossus,no-hex,no-both').split(',')
const sites=order.map(id=>{
  if(!(id in experiments))throw Error('Unknown isolation mode '+id)
  return {id,at:'0,28,0,0',query:experiments[id]}
})
const dir='browser-evidence/prewarm-isolation'
mkdirSync(dir,{recursive:true})
const browser=await chromium.launch({
  headless:true,
  args:['--enable-webgl','--enable-gpu','--ignore-gpu-blocklist',
    '--use-angle=metal','--disable-software-rasterizer'],
})
let backend='unknown'
try{
  const cdp=await browser.newBrowserCDPSession()
  const info=await cdp.send('SystemInfo.getInfo')
  backend=String(info.gpu?.auxAttributes?.glRenderer??
    info.gpu?.devices?.[0]?.deviceString??'unknown')
  await cdp.detach()
}catch(e){backend='GPU query failed: '+String(e)}
if(!/Metal/i.test(backend))throw Error('Native Metal GPU identity not proven: '+backend)
const results=[]
async function sample(page,seconds){
  return await page.evaluate((seconds)=>new Promise(resolve=>{
    const start=performance.now()
    const gaps=[]
    const timers=[]
    const long=[]
    let lastRaf=0, lastTimer=0, finished=false
    const observer=(()=>{try{
      const p=new PerformanceObserver(records=>{
        for(const entry of records.getEntries())long.push(entry.duration)
      })
      p.observe({entryTypes:['longtask']})
      return p
    }catch{return null}})()
    const timer=setInterval(()=>{
      const now=performance.now()
      if(lastTimer)timers.push(now-lastTimer)
      lastTimer=now
    },50)
    const finish=()=>{
      if(finished)return
      finished=true
      clearInterval(timer)
      observer?.disconnect()
      const dur=performance.now()-start
      const sort=[...gaps].sort((a,b)=>a-b)
      const q=p=>sort.length?sort[Math.min(sort.length-1,Math.floor((sort.length-1)*p))]:null
      resolve({
        totalMs:Math.round(dur),frames:gaps.length,
        avgFPS:Math.round(1000*gaps.length/dur*10)/10,
        p50Ms:Math.round(q(.5)??0),p95Ms:Math.round(q(.95)??0),
        p99Ms:Math.round(q(.99)??0),
        maxRafGapMs:Math.round(Math.max(0,...gaps,performance.now()-lastRaf)),
        gapsOver50:gaps.filter(x=>x>50).length,
        gapsOver120:gaps.filter(x=>x>120).length,
        gapsOver500:gaps.filter(x=>x>500).length,
        maxTimerGapMs:Math.round(Math.max(0,...timers)),
        maxLongTaskMs:Math.round(Math.max(0,...long)),
        longestLongTaskCount:long.filter(x=>x>100).length,
      })
    }
    const raf=at=>{
      if(finished)return
      if(lastRaf)gaps.push(at-lastRaf)
      lastRaf=at
      if(performance.now()-start>=seconds*1000)finish()
      else requestAnimationFrame(raf)
    }
    requestAnimationFrame(raf)
    setTimeout(finish,seconds*1000+6000)
  }),seconds)
}
try{
 for(const site of sites){
  const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1})
  const errors=[]
  page.on('pageerror',e=>errors.push(e.message))
  const url='http://127.0.0.1:4173/'+site.query+'#at='+site.at+'&autostart&skip'
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:120000})
  await page.evaluate(async()=>{
    window.__portfolioFpsStore=(await import('orbita/store')).useStore
  })
  await page.waitForFunction(()=>{
    const store=window.__portfolioFpsStore?.getState()
    return store?.phase==='playing' && store?.ready===true &&
      !!document.querySelector('#root canvas') &&
      document.querySelectorAll('iframe[title*="spaceship cockpit"]').length===0
  },null,{timeout:110000,polling:200})
  const record={site:site.id,query:site.query,backend,ready:true,
    firstTenSeconds:await sample(page,8)}
  // Idle remains a required part of first impression. No warmup is hidden
  // from these measurements or moved outside the measured interval.
  record.secondTenSeconds=await sample(page,8)
  record.background=await page.evaluate(()=>({
    hex:window.__orbitaHexShaderPrep?.status??'unknown',
    colossus:window.__orbitaColossusWarmup?.status??'unknown',
    island:window.__orbitaIslandBoot?.status??'unknown',
    canvasCount:document.querySelectorAll('#root canvas').length,
    panel:window.__portfolioFpsStore?.getState()?.panel??null,
    phase:window.__portfolioFpsStore?.getState()?.phase??null,
    quality:window.__portfolioFpsStore?.getState()?.quality??null,
  }))
  record.errors=errors
  results.push(record)
  console.log('PORTFOLIO_PREWARM_CONTENTION_AB '+JSON.stringify(record))
  // Screenshot ONLY after timing to avoid GL readback contamination.
  await page.screenshot({path:dir+'/'+site.id+'.png',timeout:30000}).catch(e=>
    console.warn('SCREENSHOT_DIAGNOSTIC_FAILED '+site.id+': '+String(e)))
  await page.close()
 }
}finally{
 writeFileSync(dir+'/report.json',JSON.stringify(results,null,2))
 await browser.close()
}
if(results.length!==sites.length||results.some(x=>x.errors.length))
  process.exitCode=2
