import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
const require = createRequire(import.meta.url)
const { chromium } = require('../source/node_modules/playwright')
const variant = process.env.COLOSSUS_PREWARM_VARIANT || 'ready'
if (!['ready','off'].includes(variant)) throw new Error('Invalid prewarm variant')
mkdirSync('browser-evidence', { recursive: true })
const browser = await chromium.launch({
  headless:true, args:['--enable-webgl','--enable-gpu','--ignore-gpu-blocklist',
    '--use-angle=metal','--disable-software-rasterizer']
})
const page = await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1})
const errors=[]
page.on('pageerror',error=>errors.push(error.message))
await page.addInitScript(() => {
  const originalGetContext = HTMLCanvasElement.prototype.getContext
  const patched = new WeakSet()
  const probe = {
    recording:false, startedAt:0, entries:[], totalCalls:0, slowCalls:0,
    maxCallMs:0, installedMethods:[], createProgramCount:0, programQueries:0
  }
  window.__colossusGLCallProbe = probe
  HTMLCanvasElement.prototype.getContext = function(type,...args) {
    const context = originalGetContext.call(this,type,...args)
    if (!context || !/^webgl(?:2)?$|^experimental-webgl$/.test(String(type)) || patched.has(context)) return context
    patched.add(context)
    const methods = [
      'getProgramParameter','getShaderParameter','getProgramInfoLog',
      'linkProgram','createProgram','getParameter','getError','getUniformLocation',
      'checkFramebufferStatus','finish','flush','readPixels','fenceSync','clientWaitSync',
      'drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced',
      'texImage2D','texSubImage2D','bufferData','bufferSubData','renderbufferStorage'
    ]
    for (const method of methods) {
      const fn = context[method]
      if (typeof fn !== 'function') continue
      try {
        context[method] = function(...arguments_) {
          if (!probe.recording) return fn.apply(context,arguments_)
          const start = performance.now()
          let result
          try { result = fn.apply(context,arguments_) }
          finally {
            const elapsed = performance.now() - start
            probe.totalCalls++
            if (method === 'createProgram') probe.createProgramCount++
            if (method === 'getProgramParameter') probe.programQueries++
            if (elapsed > probe.maxCallMs) probe.maxCallMs = elapsed
            if (elapsed >= 8) {
              probe.slowCalls++
              if (probe.entries.length < 150) probe.entries.push({
                method, ms:Math.round(elapsed), atMs:Math.round(start - probe.startedAt),
                param: method === 'getProgramParameter' ? String(arguments_[1]) : undefined
              })
            }
          }
          return result
        }
        probe.installedMethods.push(method)
      } catch { /* Read-only methods will be measured by Chromium trace instead. */ }
    }
    return context
  }
})
try {
  const url = new URL('http://127.0.0.1:4173/#at=0,-27,0,20&autostart&skip')
  if (variant === 'off') url.searchParams.set('colossusPrewarm','off')
  await page.goto(url.toString(),{waitUntil:'domcontentloaded',timeout:120000})
  await page.waitForFunction(()=>!!window.__orbitaColossusWarmup,null,{timeout:120000})
  if(variant==='ready') {
    await page.waitForFunction(()=>{
      const w=window.__orbitaColossusWarmup
      return w?.status==='ready' && w?.laserReady===true && w?.uploadedProxies===w?.totalProxies && w?.totalProxies>=120
    },null,{timeout:40000,polling:250})
  } else await page.waitForTimeout(6500)
  const before=await page.evaluate(()=>{
    const w=window.__orbitaColossusWarmup
    const gl=document.querySelector('canvas')?.getContext('webgl2')
    const dbg=gl?.getExtension('WEBGL_debug_renderer_info')
    return {warmup:{status:w?.status,totalProxies:w?.totalProxies,uploadedProxies:w?.uploadedProxies,laserReady:w?.laserReady},
      renderer:gl?.getParameter(dbg?.UNMASKED_RENDERER_WEBGL??gl.RENDERER)}
  })
  if(!/Metal/.test(String(before.renderer)) || /SwiftShader/.test(String(before.renderer)))
    throw new Error('Not Metal: '+before.renderer)
  const clicked=await page.evaluate(()=>{
    const c=document.querySelector('canvas')
    if(!c)return false
    const p=window.__colossusGLCallProbe
    p.entries.length=0
    p.totalCalls=0
    p.slowCalls=0
    p.maxCallMs=0
    p.createProgramCount=0
    p.programQueries=0
    p.startedAt=performance.now()
    p.recording=true
    const r=c.getBoundingClientRect()
    const init={bubbles:true,cancelable:true,clientX:r.left+r.width/2,
      clientY:r.top+r.height/2,pointerId:1,pointerType:'mouse',isPrimary:true}
    for(const event of ['pointermove','pointerdown','pointerup']) c.dispatchEvent(new PointerEvent(event,init))
    return true
  })
  await page.waitForFunction(()=>!!window.__orbitaColossusProfile,null,{timeout:80000,polling:300})
  await page.waitForFunction(()=>window.__orbitaColossusProfile?.firstBeamFrameAtMs!=null,
    null,{timeout:25000,polling:200}).catch(()=>{})
  await page.waitForTimeout(250)
  const after=await page.evaluate(()=>{
    const p=window.__colossusGLCallProbe
    p.recording=false
    const q=window.__orbitaColossusProfile
    return {probe:{...p,entries:p.entries.slice()},profile:{
      firstBeamMs:q?.firstBeamFrameAtMs,maxFrameMs:q?.maxFrameMs,
      firstFrameMs:q?.firstFrameFromClickMs,programDelta:q?.programDelta,
      browserTasks:q?.browserTasks?.slice(0,20)}}
  })
  const verdict = !clicked || after.profile.firstBeamMs == null ||
      after.profile.maxFrameMs > 120 ? 'UNACCEPTED_HITCH' : 'MEASURED_NOT_VISUAL_CERTIFIED'
  const result={commit:process.env.GITHUB_SHA,variant,backend:before.renderer,
    before,clicked,after,errors,verdict,
    caveat:'Instrumented WebGL calls perturb timings. This distinguishes synchronous WebGL API stalls from compositor-only stalls; Metal backend is paravirtual.'}
  console.log('GL_CALL_TIMING '+JSON.stringify(result))
  writeFileSync('browser-evidence/gl-call-timing.json',JSON.stringify(result,null,2))
  if(errors.length||!clicked||after.probe.installedMethods.length===0)process.exitCode=3
  else if(verdict!=='MEASURED_NOT_VISUAL_CERTIFIED')process.exitCode=12
} catch(e) {
  console.error('GL call timing probe failed',String(e))
  process.exitCode=4
} finally {
  await browser.close()
}
