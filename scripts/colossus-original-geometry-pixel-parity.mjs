import {createRequire} from 'node:module'
import {mkdirSync,writeFileSync} from 'node:fs'
const require=createRequire(import.meta.url)
const {chromium}=require('../source/node_modules/playwright')
mkdirSync('browser-evidence',{recursive:true})
const browser=await chromium.launch({headless:true,args:[
  '--enable-webgl','--enable-gpu','--ignore-gpu-blocklist',
  '--use-angle=metal','--disable-software-rasterizer'
]})
const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1})
page.setDefaultTimeout(240000)
const errors=[]
page.on('pageerror',e=>errors.push(e.message))
try{
  await page.goto('http://127.0.0.1:4173/?colossusBatchProbe=manual#at=0,-27,0,20&autostart&skip',
    {waitUntil:'domcontentloaded',timeout:120000})
  await page.waitForFunction(()=>!!window.__orbitaApexManualBatch,null,{timeout:120000})
  const warmupReady=await page.waitForFunction(()=>window.__orbitaColossusWarmup?.status==='ready',
    null,{timeout:85000,polling:250}).then(()=>true,()=>false)
  if(!warmupReady)throw new Error('PARITY_GPU_NOT_IDLE: do not capture while laser preflight is running')
  const meta=await page.evaluate(()=>{
    const ctx=document.querySelector('canvas')?.getContext('webgl2')
    const dbg=ctx?.getExtension('WEBGL_debug_renderer_info')
    return {renderer:ctx?.getParameter(dbg?.UNMASKED_RENDERER_WEBGL??ctx.RENDERER)}
  })
  if(!/Metal/i.test(String(meta.renderer))||/SwiftShader/i.test(String(meta.renderer)))
    throw new Error('Invalid native Metal backend '+meta.renderer)
  const report=await page.evaluate(()=>window.__orbitaApexManualBatch.runVisualParity())
  const evidence={...meta,source:'unchanged scene, camera, geometry, uniforms, full 2048 shadows',
    report,errors,commit:process.env.GITHUB_SHA,
    acceptance:'strict zero changed color/shadow pixels at each scan stage'}
  writeFileSync('browser-evidence/colossus-original-geometry-pixel-parity.json',
    JSON.stringify(evidence,null,2))
  console.log('COLOSSUS_PIXEL_PARITY '+JSON.stringify(evidence))
  if(!report.pixelPerfect||report.drawsSavedPerPass<10||errors.length)
    process.exitCode=2
}catch(error){
  console.error('COLOSSUS_PIXEL_PARITY_FAILED',String(error))
  process.exitCode=3
}finally{await browser.close()}
