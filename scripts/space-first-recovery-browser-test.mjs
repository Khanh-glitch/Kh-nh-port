import {createRequire} from 'node:module'
import {mkdirSync,writeFileSync} from 'node:fs'
const require=createRequire(import.meta.url)
const {chromium}=require('../source/node_modules/playwright')
mkdirSync('browser-evidence/entry-recovery',{recursive:true})
const browser=await chromium.launch({headless:true,args:[
  '--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
  '--enable-unsafe-swiftshader','--ignore-gpu-blocklist'
]})
const report={viewport:'mobile-390x844',firstShipRequest:'abort-once',
  falseReadyNeverAllowed:true,checks:[],jsErrors:[]}
try{
  const page=await browser.newPage({viewport:{width:390,height:844},
    deviceScaleFactor:1,isMobile:true,hasTouch:true})
  page.setDefaultTimeout(85000)
  page.on('pageerror',e=>report.jsErrors.push(String(e)))
  page.on('request',q=>{
    if(q.url().includes('immersive'))
      (report.requests??=[]).push(q.url().slice(0,160))
  })
  page.on('requestfailed',q=>{
    if(q.url().includes('immersive'))
      (report.failedRequests??=[]).push(q.url().slice(0,160))
  })
  let blocked=false
  await page.route('**/assets/immersive/index.html',async route=>{
    if(!blocked){blocked=true;await route.abort('failed')}
    else await route.continue()
  })
  await page.goto('http://127.0.0.1:4173/',
    {waitUntil:'domcontentloaded',timeout:120000})
  await page.waitForSelector('[data-orbita-space-entry="true"]',
    {timeout:70000})
  const first=await page.evaluate(()=>({
    gate:window.__orbitaEntryGate,
    legacy:document.getElementById('orbita-loading')
      ?getComputedStyle(document.getElementById('orbita-loading')).display
      :'removed',
  }))
  if(first.legacy!=='none' && first.legacy!=='removed')
    throw Error('Legacy ORBITA loading text appears during ship failure')
  if(first.gate?.ready)throw Error('False ready before any real spaceship render')
  report.checks.push('no-legacy-spinner-or-false-ready')
  const recognized=await page.waitForFunction(
    ()=>window.__orbitaEntryGate?.status==='ship-failed',
    null,{timeout:45000,polling:300}).then(()=>true,()=>false)
  if(!recognized){
    report.debug=await page.evaluate(()=>({
      gate:window.__orbitaEntryGate??null,
      rootText:document.body?.innerText.slice(0,900),
      iframe:document.querySelector('iframe')?.src,
      legacyDisplay:document.getElementById('orbita-loading')
        ?getComputedStyle(document.getElementById('orbita-loading')).display:'none',
      entryCount:document.querySelectorAll('[data-orbita-space-entry]').length,
      canvasCount:document.querySelectorAll('#root canvas').length,
    })).catch(e=>({evaluateError:String(e)}))
    report.blocked=blocked
    console.error('ENTRY_FAILURE_TIMEOUT_DIAGNOSTIC '+JSON.stringify(report).slice(0,7000))
    await page.screenshot({
      path:'browser-evidence/entry-recovery/mobile-failed-first-request.png',
      timeout:25000,
    }).catch(e=>report.jsErrors.push('screenshot: '+String(e)))
    throw Error('No recoverable ship failure state after first request aborted')
  }
  report.checks.push('ship-loading-error-is-explicit')
  const retry=page.getByRole('button',{name:'THỬ TẢI LẠI PHI THUYỀN'})
  await retry.waitFor({state:'visible',timeout:7000})
  const islandFallback=page.getByRole('button',{name:/VÀO ĐẢO 3D|ĐẢO ĐANG KHỞI TẠO/})
  await islandFallback.waitFor({state:'visible',timeout:7000})
  // The fallback island button is NEVER unlocked by a timeout or progress
  // percentage. It can unlock only once the real island Canvas has painted.
  const fallbackInfo=await page.evaluate(()=>({
    state:window.__orbitaEntryGate,
    island:window.__orbitaIslandFirstPaint??null,
  }))
  if(fallbackInfo.state?.ready)throw Error('Failed ship incorrectly unlocked normal warp')
  if(fallbackInfo.island?.status!=='ready' && await islandFallback.isEnabled())
    throw Error('Fallback island unlocked without real renderer')
  report.checks.push('real-render-gated-fallback-not-fake')
  await retry.click()
  await page.waitForFunction(()=>window.__orbitaEntryGate?.shipRendered===true,
    null,{timeout:90000,polling:350})
  await page.waitForFunction(()=>window.__orbitaEntryGate?.ready===true,
    null,{timeout:95000,polling:350})
  if(!blocked)throw Error('Did not exercise failed first network request')
  report.checks.push('mobile-ship-retry-renders-original-galaxy')
  const button=page.frameLocator('iframe[title*="spaceship cockpit"]')
    .locator('.energy-gate button.btn-primary')
  await button.waitFor({state:'visible',timeout:15000})
  if(await button.isDisabled())throw Error('No entry despite both real 3D scenes ready')
  await page.screenshot({path:'browser-evidence/entry-recovery/mobile-recovered-cockpit.png'})
  await button.click()
  await page.waitForSelector('iframe[title*="spaceship cockpit"]',
    {state:'detached',timeout:60000})
  const island=await page.waitForFunction(()=>{
    const canvas=document.querySelector('#root canvas')
    return !!canvas && canvas.getBoundingClientRect().width>250
  },null,{timeout:40000,polling:400}).then(()=>true,()=>false)
  if(!island)throw Error('Fallback+retry path did not enter original 3D island')
  report.checks.push('mobile-retry-real-warp-and-island-visible')
  if(report.jsErrors.length)throw Error('Browser errors: '+report.jsErrors.join(';'))
  console.log('SPACE_FIRST_ERROR_RECOVERY_PASS '+JSON.stringify(report))
}catch(error){
  report.error=String(error)
  console.error('SPACE_FIRST_ERROR_RECOVERY_FAILED '+JSON.stringify(report))
  process.exitCode=2
}finally{
  writeFileSync('browser-evidence/entry-recovery/recovery.json',
    JSON.stringify(report,null,2))
  await browser.close()
}
