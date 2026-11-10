import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
const require = createRequire(import.meta.url)
const { chromium } = require('../source/node_modules/playwright')
const target = process.env.COLOSSUS_URL || 'https://b56b8753.menniverse.pages.dev'
mkdirSync('driver-evidence', { recursive:true })
const browser = await chromium.launch({
  channel:'chrome',headless:true,
  args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1})
const errors=[]
page.on('pageerror',e=>errors.push(e.message))
await page.addInitScript(() => {
  const methods = ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced',
    'bufferData','bufferSubData','texImage2D','texImage3D','texSubImage2D','texSubImage3D',
    'texStorage2D','compileShader','linkProgram','useProgram','shaderSource',
    'generateMipmap','readPixels','finish','flush','getProgramParameter',
    'getShaderParameter','framebufferTexture2D','checkFramebufferStatus',
    'uniformMatrix4fv','getError','bindTexture','bindBuffer','getUniformLocation']
  const result={total:{},slow:[],active:false}
  Object.defineProperty(window,'__glDriverTrace',{value:result,configurable:false})
  for(const constructor of [window.WebGL2RenderingContext,window.WebGLRenderingContext]){
    if(!constructor)continue
    for(const name of methods){
      const proto=constructor.prototype
      if(!Object.prototype.hasOwnProperty.call(proto,name))continue
      const original=proto[name]
      if(typeof original!=='function')continue
      try{
        Object.defineProperty(proto,name,{configurable:true,writable:true,value:function(...args){
          if(!result.active)return original.apply(this,args)
          const start=performance.now()
          try{return original.apply(this,args)}
          finally {
            const duration=performance.now()-start
            const stat=(result.total[name]??={count:0,time:0,max:0})
            stat.count++;stat.time+=duration;stat.max=Math.max(stat.max,duration)
            if(duration>25&&result.slow.length<100){
              result.slow.push({method:name,ms:Math.round(duration),atMs:Math.round(start-(result.clickAt??start)),
                target:args[0],byteLength:args.find(x=>typeof x==='object'&&x&&'byteLength'in x)?.byteLength??null})
            }
          }
        }})
      }catch(e){result.slow.push({method:name,error:String(e).slice(0,80)})}
    }
  }
})
const t0=Date.now()
let outcome
try{
  await page.goto(target+'/#at=0,-27,0,20&autostart&skip',{waitUntil:'domcontentloaded',timeout:120000})
  await page.waitForFunction(()=>!!document.querySelector('canvas'),null,{timeout:120000,polling:1000})
  await page.waitForTimeout(7000)
  const prior=await page.evaluate(()=>({warmup:window.__orbitaColossusWarmup,status:document.visibilityState}))
  const clicked=await page.evaluate(()=>{
    const trace=window.__glDriverTrace
    trace.total={};trace.slow=[];trace.active=true;trace.clickAt=performance.now()
    const canvas=document.querySelector('canvas')
    const rect=canvas.getBoundingClientRect()
    const obj={bubbles:true,cancelable:true,clientX:rect.left+rect.width/2,clientY:rect.top+rect.height/2,pointerId:1,pointerType:'mouse',isPrimary:true}
    canvas.dispatchEvent(new PointerEvent('pointermove',obj))
    canvas.dispatchEvent(new PointerEvent('pointerdown',obj))
    canvas.dispatchEvent(new PointerEvent('pointerup',obj))
    return !!canvas
  })
  await page.waitForFunction(() => !!window.__orbitaColossusProfile, null, {timeout:100000,polling:1000})
  await page.waitForTimeout(1000)
  outcome=await page.evaluate(()=>{
    const t=window.__glDriverTrace;t.active=false
    return {gpuCalls:t.total,slowCalls:t.slow,profile:window.__orbitaColossusProfile,afterWarmup:window.__orbitaColossusWarmup}
  })
  const summary={
    target,clicked,loadMs:Date.now()-t0,priorWarmup:prior.warmup?.status,
    afterWarmup:outcome.afterWarmup?.status,
    maxFrameMs:outcome.profile?.maxFrameMs,
    reactCommits:outcome.profile?.reactCommits,
    newShaders:outcome.profile?.newPrograms?.length,
    gpuTop:Object.entries(outcome.gpuCalls).map(([name,s])=>({name,...s})).sort((a,b)=>b.time-a.time).slice(0,25),
    slowCalls:outcome.slowCalls,errors
  }
  writeFileSync('driver-evidence/report.json',JSON.stringify({summary,outcome},null,2))
  console.log(JSON.stringify(summary,null,2))
  if(!clicked||errors.length||!outcome.profile)process.exitCode=4
}catch(e){
  console.error('Driver probe failure:',e)
  writeFileSync('driver-evidence/failure.json',JSON.stringify({message:String(e),errors},null,2))
  process.exitCode=6
}finally{await browser.close()}
