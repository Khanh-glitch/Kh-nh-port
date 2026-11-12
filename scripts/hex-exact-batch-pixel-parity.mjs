import {createRequire} from 'node:module'
import {mkdirSync,writeFileSync} from 'node:fs'
const require=createRequire(import.meta.url)
const {chromium}=require('../source/node_modules/playwright')
const backend=process.env.HEX_PARITY_BACKEND==='metal'?'metal':'software'
const batchProbe=process.env.HEX_BATCH_PROBE_MODE==='manual-overlap'?'manual-overlap':'manual'
const skipDriverLogs=process.env.HEX_PARITY_EXTRA_QUERY==='skip-driver-logs'
const args=backend==='software'
  ? ['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']
  : ['--enable-webgl','--enable-gpu','--ignore-gpu-blocklist','--use-angle=metal','--disable-software-rasterizer']
mkdirSync('hex-batch-evidence',{recursive:true})
const browser=await chromium.launch({headless:true,args})
const page=await browser.newPage({viewport:{width:960,height:540},deviceScaleFactor:1})
page.setDefaultTimeout(240000)
const errors=[]
page.on('pageerror',error=>errors.push(error.message))
try{
  await page.goto('http://127.0.0.1:4173/?hexProfile=1&hexBatchProbe='+batchProbe+
    (skipDriverLogs?'&hexSkipDriverShaderLogs=1':'')+
    '#at=-26,20,0,0&autostart&skip',
    {waitUntil:'domcontentloaded',timeout:120000})
  await page.waitForFunction(async()=>{
    const {useStore}=await import('orbita/store')
    return !!window.__orbitaHexManualBatch &&
      useStore.getState().ready &&
      useStore.getState().phase==='playing' &&
      document.querySelectorAll('#root canvas').length===1 &&
      document.querySelectorAll('iframe[title*="spaceship cockpit"]').length===0
  },null,{timeout:120000,polling:400})
  // React runs manual parity registration in useLayoutEffect, while the
  // authoritative WebGL backend is published in a later passive useEffect.
  // Never reject Metal because the profiler ref is one frame behind.
  await page.waitForFunction(()=>typeof window.__orbitaHexRenderer==='string',
    null,{timeout:40000,polling:300})
  // This compares one exact synchronous WebGL frame with only the geometry
  // batch on/off. It is not a frame pacing test or a production quality toggle.
  const meta=await page.evaluate(()=>({
    renderer:window.__orbitaHexRenderer??null,
    spaceIframeCount:document.querySelectorAll('iframe[title*="spaceship cockpit"]').length,
    islandCanvasCount:document.querySelectorAll('#root canvas').length,
  }))
  if(backend==='metal'&&!/Metal/i.test(String(meta.renderer)))
    throw new Error('Expected ANGLE Metal, got '+meta.renderer)
  if(backend==='software'&&!/SwiftShader|Software/i.test(String(meta.renderer)))
    throw new Error('Expected software GL, got '+meta.renderer)
  const result=await page.evaluate(()=>window.__orbitaHexManualBatch.runVisualParity())
  const report={commit:process.env.GITHUB_SHA,backend,batchProbe,...meta,errors,result,skipDriverLogs,
    caveat:'Same-frame geometry/lighting/scan visual parity only; does not establish first-click frame pacing'}
  writeFileSync('hex-batch-evidence/18-stage-color-shadow-parity-'+batchProbe+'.json',JSON.stringify(report,null,2))
  console.log('HEX_EXACT_BATCH_PARITY '+JSON.stringify(report))
  // This test proves image equivalence and nonzero EXACT source batching,
  // not a speculative 70-draw target from a far less safe inventory. Native
  // GPU frame-pacing A/B is the separate strict performance release gate.
  if(result.viewCount!==3||result.stages.length!==18||
     result.drawsSavedPerPass<20||!result.visuallyEquivalent||errors.length)
    process.exitCode=2
}catch(e){
  console.error('HEX_EXACT_BATCH_PARITY_FAILED',String(e))
  process.exitCode=3
}finally{await browser.close()}
