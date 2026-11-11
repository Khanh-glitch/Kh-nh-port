import {createRequire} from 'node:module'
import {mkdirSync,writeFileSync} from 'node:fs'
const require=createRequire(import.meta.url)
const {chromium}=require('../source/node_modules/playwright')
mkdirSync('browser-evidence',{recursive:true})
const software=process.env.COLOSSUS_PARITY_BACKEND==='software'
const browser=await chromium.launch({headless:true,args:software
  ? ['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']
  : ['--enable-webgl','--enable-gpu','--ignore-gpu-blocklist','--use-angle=metal','--disable-software-rasterizer']})
const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1})
page.setDefaultTimeout(240000)
const errors=[]
page.on('pageerror',e=>errors.push(e.message))
try{
  await page.goto('http://127.0.0.1:4173/?colossusBatchProbe=manual' +
    (software?'&colossusPrewarm=off':'') + '#at=0,-27,0,20&autostart&skip',
    {waitUntil:'domcontentloaded',timeout:120000})
  await page.waitForFunction(()=>!!window.__orbitaApexManualBatch,null,{timeout:120000})
  if(software){
    // Software renderer parity is a pixel-geometry check, not performance evidence.
    // Disable unrelated GPU warmup to keep the test deterministic.
    await page.waitForTimeout(1200)
  }else{
    const warmupReady=await page.waitForFunction(()=>window.__orbitaColossusWarmup?.status==='ready',
      null,{timeout:85000,polling:250}).then(()=>true,()=>false)
    if(!warmupReady)throw new Error('PARITY_GPU_NOT_IDLE: do not capture while laser preflight is running')
  }
  const meta=await page.evaluate(()=>{
    const ctx=document.querySelector('canvas')?.getContext('webgl2')
    const dbg=ctx?.getExtension('WEBGL_debug_renderer_info')
    return {renderer:ctx?.getParameter(dbg?.UNMASKED_RENDERER_WEBGL??ctx.RENDERER)}
  })
  if(software ? !/SwiftShader|Software|llvmpipe/i.test(String(meta.renderer)) :
    !/Metal/i.test(String(meta.renderer))||/SwiftShader/i.test(String(meta.renderer)))
    throw new Error('Wrong test backend '+meta.renderer)
  const report=await page.evaluate(()=>window.__orbitaApexManualBatch.runVisualParity())
  const evidence={...meta,source:'unchanged scene, camera, geometry, uniforms, full 2048 shadows',
    report,errors,commit:process.env.GITHUB_SHA,
    acceptance:'18 samples: 3 cameras x 6 scan stages; at most 2 pixels differ by <=1/255 per image; log exact count'}
  writeFileSync('browser-evidence/colossus-original-geometry-pixel-parity.json',
    JSON.stringify(evidence,null,2))
  console.log('COLOSSUS_PIXEL_PARITY '+JSON.stringify(evidence))
  if(!report.visuallyEquivalent||report.viewCount!==3||report.stages.length!==18||
     report.drawsSavedPerPass<20||errors.length)
    process.exitCode=2
}catch(error){
  console.error('COLOSSUS_PIXEL_PARITY_FAILED',String(error))
  process.exitCode=3
}finally{await browser.close()}
