import {createRequire} from 'node:module'
import {mkdirSync,writeFileSync} from 'node:fs'
const require=createRequire(import.meta.url)
const {chromium}=require('../candidate/source/node_modules/playwright')
mkdirSync('visual-evidence-small',{recursive:true})
const browser=await chromium.launch({channel:'chrome',headless:true,args:[
 '--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'
]})
const reports=[]
for (const [name,port] of [['main-8dd5ded',4173],['candidate-4454511',4174]]) {
 const context=await browser.newContext({viewport:{width:384,height:216},deviceScaleFactor:1})
 await context.addInitScript(() => {
  let seed=3157341
  Math.random=()=>{seed|=0;seed=(seed+0x6D2B79F5)|0;let t=Math.imul(seed^(seed>>>15),1|seed);t^=t+Math.imul(t^(t>>>7),61|t);return ((t^(t>>>14))>>>0)/4294967296}
 })
 const page=await context.newPage()
 const report={name,errors:[],frames:0}
 page.on('pageerror',e=>report.errors.push(e.message))
 try{
  await page.goto('http://127.0.0.1:'+port+'/#at=0,-27,0,20&autostart&skip',
    {waitUntil:'domcontentloaded',timeout:120000})
  await page.waitForSelector('canvas',{timeout:90000})
  await page.waitForTimeout(2500)
  await page.evaluate(()=>{
    const can=document.querySelector('canvas'),r=can.getBoundingClientRect()
    window.__auditRafCount=0
    requestAnimationFrame(function tick(){window.__auditRafCount++;requestAnimationFrame(tick)})
    const point={bubbles:true,cancelable:true,clientX:r.left+r.width/2,clientY:r.top+r.height/2,
       pointerId:1,pointerType:'mouse',isPrimary:true}
    can.dispatchEvent(new PointerEvent('pointermove',point))
    can.dispatchEvent(new PointerEvent('pointerdown',point))
    can.dispatchEvent(new PointerEvent('pointerup',point))
  })
  // Wait for at least 160 animation callbacks, allowing the 5s of
  // dt-clamped original APEX/Ragnarok scan to finish even on SwiftShader.
  await page.waitForFunction(()=>window.__auditRafCount>=160,null,{timeout:600000,polling:1000})
  report.frames=await page.evaluate(()=>window.__auditRafCount)
  await page.setViewportSize({width:1280,height:720})
  await page.waitForTimeout(1500)
  await page.screenshot({path:'visual-evidence-small/'+name+'-full-models.png',timeout:90000})
  report.gpu=await page.evaluate(()=>{
   const gl=document.querySelector('canvas')?.getContext('webgl2')
   return gl?.getParameter(gl?.getExtension('WEBGL_debug_renderer_info')?.UNMASKED_RENDERER_WEBGL??gl.RENDERER)
  })
 } catch(e) {report.error=String(e)}
 reports.push(report)
 writeFileSync('visual-evidence-small/small-then-full.json',JSON.stringify(reports,null,2))
 await context.close()
}
await browser.close()
console.log('SMALL_THEN_FULL '+JSON.stringify(reports))
if(reports.some(x=>x.error||x.errors.length))process.exitCode=3
