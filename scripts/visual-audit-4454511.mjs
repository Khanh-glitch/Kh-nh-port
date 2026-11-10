import {createRequire} from 'node:module'
import {mkdirSync,writeFileSync} from 'node:fs'
const require=createRequire(import.meta.url)
const {chromium}=require('../candidate/source/node_modules/playwright')
mkdirSync('visual-evidence',{recursive:true})
const reports=[]
const browser=await chromium.launch({headless:true,args:[
 '--enable-webgl','--enable-gpu','--ignore-gpu-blocklist',
 '--use-angle=metal','--disable-software-rasterizer'
]})
const variants=[
 {name:'main-8dd5ded',url:'http://127.0.0.1:4173/#at=0,-27,0,20&autostart&skip'},
 {name:'candidate-4454511',url:'http://127.0.0.1:4174/#at=0,-27,0,20&autostart&skip'},
]
try{
for(const variant of variants){
 const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1,reducedMotion:'no-preference'})
 const page=await context.newPage()
 const errors=[],failed=[]
 page.on('pageerror',e=>errors.push(e.message))
 page.on('requestfailed',r=>failed.push(r.url().slice(0,150)+':'+r.failure()?.errorText))
 const report={variant:variant.name,url:variant.url,images:[],errors,failed}
 try{
  await page.goto(variant.url,{waitUntil:'domcontentloaded',timeout:120000})
  await page.waitForSelector('canvas',{timeout:120000})
  await page.waitForTimeout(4500)
  report.status=await page.evaluate(()=>{
   const canvas=document.querySelector('canvas')
   const gl=canvas?.getContext('webgl2')
   const ext=gl?.getExtension('WEBGL_debug_renderer_info')
   const gpu=gl?.getParameter(ext?.UNMASKED_RENDERER_WEBGL??gl.RENDERER)
   return {gpu,contextLost:gl?.isContextLost(),canvasSize:[canvas?.width,canvas?.height],
      pageTitle:document.title,
      readyState:document.readyState,
      warmup:window.__orbitaColossusWarmup?.status??'not-present',
      landing:window.__orbitaLandingPrewarm?.status??'not-present',
      heading:document.body?.innerText?.slice(0,120)}
  })
  await page.screenshot({path:'visual-evidence/'+variant.name+'-dormant.png',timeout:90000,animations:'disabled'})
  report.images.push('dormant')
  const result=await page.evaluate(()=>{
    const canvas=document.querySelector('canvas')
    if(!canvas)return false
    const r=canvas.getBoundingClientRect()
    const point={bubbles:true,cancelable:true,clientX:r.left+r.width/2,clientY:r.top+r.height/2,
      pointerId:1,pointerType:'mouse',isPrimary:true}
    canvas.dispatchEvent(new PointerEvent('pointermove',point))
    canvas.dispatchEvent(new PointerEvent('pointerdown',point))
    canvas.dispatchEvent(new PointerEvent('pointerup',point))
    return true
  })
  report.clicked=result
  await page.waitForTimeout(1600)
  await page.screenshot({path:'visual-evidence/'+variant.name+'-laser-mid.png',timeout:90000,animations:'disabled'})
  report.images.push('laser-mid')
  await page.waitForTimeout(30000)
  await page.screenshot({path:'visual-evidence/'+variant.name+'-both-summoned.png',timeout:90000,animations:'disabled'})
  report.images.push('both-summoned')
  report.final=await page.evaluate(()=>({
   warmup:window.__orbitaColossusWarmup?.status??'not-present',
   laserProfile:window.__orbitaColossusProfile??null,
   canvasLost:document.querySelector('canvas')?.getContext('webgl2')?.isContextLost()
  }))
 }catch(error){report.error=String(error)}
 reports.push(report)
 writeFileSync('visual-evidence/audit.json',JSON.stringify(reports,null,2))
 await context.close()
}
}finally{await browser.close()}
console.log('VISUAL_PARITY_AUDIT '+JSON.stringify(reports.map(r=>({
 variant:r.variant,status:r.status,images:r.images,error:r.error,errors:r.errors,clicked:r.clicked
}))))
if(reports.some(r=>r.error||r.errors.length||r.images.length!==3))process.exitCode=3
