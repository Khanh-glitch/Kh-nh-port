import {createRequire} from 'node:module'
import {mkdirSync,writeFileSync} from 'node:fs'
const require=createRequire(import.meta.url)
const {chromium}=require('../source/node_modules/playwright')
const backend=process.env.HEX_PARITY_BACKEND==='metal'?'metal':'software'
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
  await page.goto('http://127.0.0.1:4173/?hexBatchProbe=manual#at=-26,20,0,0&autostart&skip',
    {waitUntil:'domcontentloaded',timeout:120000})
  await page.waitForFunction(()=>!!window.__orbitaHexManualBatch,null,{timeout:120000})
  // This compares one exact synchronous WebGL frame with only the geometry
  // batch on/off. It is not a frame pacing test or a production quality toggle.
  const meta=await page.evaluate(()=>{
    const ctx=document.querySelector('canvas')?.getContext('webgl2')
    const dbg=ctx?.getExtension('WEBGL_debug_renderer_info')
    return {renderer:ctx?.getParameter(dbg?.UNMASKED_RENDERER_WEBGL??ctx.RENDERER)}
  })
  if(backend==='metal'&&!/Metal/i.test(String(meta.renderer)))
    throw new Error('Expected ANGLE Metal, got '+meta.renderer)
  if(backend==='software'&&!/SwiftShader|Software/i.test(String(meta.renderer)))
    throw new Error('Expected software GL, got '+meta.renderer)
  const result=await page.evaluate(()=>window.__orbitaHexManualBatch.runVisualParity())
  const report={commit:process.env.GITHUB_SHA,backend,...meta,errors,result,
    caveat:'Same-frame geometry/lighting/scan visual parity only; does not establish first-click frame pacing'}
  writeFileSync('hex-batch-evidence/18-stage-color-shadow-parity.json',JSON.stringify(report,null,2))
  console.log('HEX_EXACT_BATCH_PARITY '+JSON.stringify(report))
  if(result.viewCount!==3||result.stages.length!==18||
     result.drawsSavedPerPass<70||!result.visuallyEquivalent||errors.length)
    process.exitCode=2
}catch(e){
  console.error('HEX_EXACT_BATCH_PARITY_FAILED',String(e))
  process.exitCode=3
}finally{await browser.close()}
