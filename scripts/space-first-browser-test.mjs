import {createRequire} from 'node:module'
import {mkdirSync,writeFileSync} from 'node:fs'
const require=createRequire(import.meta.url)
const {chromium}=require('../source/node_modules/playwright')
mkdirSync('browser-evidence/entry',{recursive:true})
const browser=await chromium.launch({headless:true,args:[
  '--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
  '--enable-unsafe-swiftshader','--ignore-gpu-blocklist',
]})
const results={jsErrors:[],failedRequests:[],events:[],route:'real-first-space-then-island'}
try{
  const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1})
  page.setDefaultTimeout(100000)
  page.on('pageerror',e=>results.jsErrors.push(String(e)))
  page.on('requestfailed',req=>{
    if(req.url().includes('immersive')||req.url().includes('esm.sh'))
      results.failedRequests.push(req.url().slice(0,160))
  })
  await page.addInitScript(()=>{
    const seen={firstSpaceMessageAt:0,firstIslandCanvasAt:0,islandBeforeSpace:false}
    Object.defineProperty(window,'__orbitaEntryFirstPaintAudit',{
      value:seen,writable:false,
    })
    window.addEventListener('message',e=>{
      if(e.data?.type==='ORBITA_SPACE_FRAME_READY' && !seen.firstSpaceMessageAt)
        seen.firstSpaceMessageAt=performance.now()
    })
    const observe=()=>{
      const check=()=>{
        if(seen.firstIslandCanvasAt||!document.querySelector('#root canvas'))return
        seen.firstIslandCanvasAt=performance.now()
        seen.islandBeforeSpace=!seen.firstSpaceMessageAt
      }
      const mo=new MutationObserver(check)
      mo.observe(document.documentElement,{childList:true,subtree:true})
      check()
    }
    if(document.readyState==='loading')
      document.addEventListener('DOMContentLoaded',observe,{once:true})
    else observe()
  })
  await page.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded',timeout:120000})
  const entryCount=await page.locator('[data-orbita-space-entry="true"]').count()
  if(entryCount!==1)throw Error('Public page did not mount spaceship-first entry')
  const spaceship=await page.waitForFunction(()=>{
    const g=window.__orbitaEntryGate
    return g?.shipRendered===true || g?.status==='ship-failed'
  },null,{timeout:85000,polling:400}).then(v=>v.jsonValue())
  if(spaceship===false)throw Error('Ship intro did not resolve')
  const probe=await page.evaluate(()=>({
    gate:window.__orbitaEntryGate,
    firstPaint:window.__orbitaEntryFirstPaintAudit,
    island:window.__orbitaIslandFirstPaint??null,
  }))
  if(probe.gate?.status==='ship-failed'){
    results.first=probe
    throw Error('Real spaceship first frame failed; no false-ready or bypass allowed')
  }
  results.first=probe
  await page.screenshot({path:'browser-evidence/entry/01-real-spaceship-first.png',timeout:120000})
  if(probe.firstPaint.islandBeforeSpace||
      !probe.firstPaint.firstSpaceMessageAt)
    throw Error('Full island map appeared before real ship first frame')
  await page.waitForFunction(()=>window.__orbitaEntryGate?.ready===true,
    null,{timeout:95000,polling:350})
  const gate=await page.evaluate(()=>({
    gate:window.__orbitaEntryGate,
    island:window.__orbitaIslandFirstPaint,
    firstPaint:window.__orbitaEntryFirstPaintAudit,
  }))
  results.ready=gate
  if(!gate.gate?.shipRendered||!gate.gate?.islandReady||
      gate.island?.status!=='ready'||gate.gate.progress!==100||
      gate.firstPaint.islandBeforeSpace)
    throw Error('Entry is a fake timer instead of confirmed dual-scene readiness')
  const shipFrame=page.frameLocator('iframe[title*="spaceship cockpit"]')
  const enter=shipFrame.locator('.energy-gate button.btn-primary')
  await enter.waitFor({state:'visible',timeout:45000})
  if(await enter.isDisabled())throw Error('Authentic ready gate never enabled spacecraft entry')
  await page.screenshot({path:'browser-evidence/entry/02-loaded-and-actually-enterable.png',timeout:120000})
  await enter.click({timeout:45000})
  await page.waitForFunction(async()=>{
    const {useStore}=await import('orbita/store')
    return useStore.getState().phase==='playing'
  },null,{timeout:40000,polling:300})
  results.entered=true
  await page.screenshot({path:'browser-evidence/entry/03-original-island-after-ship-warp.png',timeout:120000})
  console.log('SPACE_FIRST_REAL_LOADER_PASS '+JSON.stringify(results))
  if(results.jsErrors.length)process.exitCode=2
}catch(error){
  results.error=String(error)
  console.error('SPACE_FIRST_REAL_LOADER_FAILED '+JSON.stringify(results).slice(0,9000))
  process.exitCode=3
}finally{
  writeFileSync('browser-evidence/entry/first-paint-test.json',JSON.stringify(results,null,2))
  await browser.close()
}
