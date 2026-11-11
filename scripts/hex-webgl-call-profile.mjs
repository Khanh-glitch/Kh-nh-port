import {createRequire} from 'node:module'
import {mkdirSync,writeFileSync} from 'node:fs'
const require=createRequire(import.meta.url)
const {chromium}=require('../source/node_modules/playwright')
mkdirSync('hex-gl-profile',{recursive:true})
const modes=(process.env.HEX_GL_MODES||'normal,no-ueh-instanced,basic-instances').split(',')
const browser=await chromium.launch({headless:true,args:[
 '--enable-webgl','--enable-gpu','--ignore-gpu-blocklist',
 '--use-angle=metal','--disable-software-rasterizer'
]})
const results=[]
const instrument=()=>{
 const seen=new Set()
 const methods=[
  'bufferData','bufferSubData','bindBuffer','createBuffer',
  'texImage2D','texSubImage2D','texStorage2D','texStorage3D','compressedTexImage2D',
  'compressedTexSubImage2D','generateMipmap',
  'shaderSource','compileShader','linkProgram','getShaderParameter',
  'getProgramParameter','getProgramInfoLog','getShaderInfoLog','useProgram',
  'drawElementsInstanced','drawArraysInstanced','drawElements','drawArrays',
  'vertexAttribPointer','vertexAttribIPointer','vertexAttribDivisor',
  'bindVertexArray','createVertexArray','createFramebuffer','bindFramebuffer',
  'framebufferTexture2D','framebufferRenderbuffer','renderbufferStorage',
  'renderbufferStorageMultisample','clear','blitFramebuffer',
  'readPixels','finish','flush','getParameter','getError','getUniformLocation'
 ]
 const p={enabled:false,calls:{},slow:[],onAt:0}
 window.__hexGlProfiler=p
 for(const ctor of [window.WebGLRenderingContext,window.WebGL2RenderingContext]){
  if(!ctor)continue
  for(const method of methods){
   const desc=Object.getOwnPropertyDescriptor(ctor.prototype,method)
   if(!desc||typeof desc.value!=='function'||!desc.configurable)continue
   const original=desc.value
   const key=ctor.name+':'+method
   if(seen.has(key))continue
   seen.add(key)
   Object.defineProperty(ctor.prototype,method,{...desc,value:function(...args){
    if(!p.enabled)return original.apply(this,args)
    const started=performance.now()
    try{return original.apply(this,args)}finally{
     const elapsed=performance.now()-started
     const rec=p.calls[method]||(p.calls[method]={count:0,total:0,max:0,over16:0,over50:0})
     rec.count++;rec.total+=elapsed
     rec.max=Math.max(rec.max,elapsed)
     if(elapsed>=16)rec.over16++
     if(elapsed>=50)rec.over50++
     if(elapsed>=16&&p.slow.length<180)
      p.slow.push({method,durationMs:Math.round(elapsed*10)/10,atMs:Math.round(started-p.onAt),
       args:method==='bufferData'||method==='bufferSubData'
        ? args.map(a=>typeof a==='number'?a:a?.byteLength??typeof a).slice(0,4):undefined})
    }
   }})
  }
 }
 p.hooks=[...seen]
}
for(const [idx,mode] of modes.entries()){
 const ctx=await browser.newContext({viewport:{width:960,height:540},deviceScaleFactor:1})
 await ctx.addInitScript(instrument)
 const page=await ctx.newPage()
 page.setDefaultTimeout(120000)
 const r={mode,idx,errors:[],network:[],started:new Date().toISOString()}
 page.on('pageerror',e=>r.errors.push(e.message))
 page.on('requestfailed',e=>r.network.push(e.url().slice(0,140)))
 results.push(r)
 try{
  const q=(mode==='normal'?'':'?hexGpuDiag='+mode)
  await page.goto('http://127.0.0.1:4174/'+q+'#at=-26,20,0,0&autostart&skip',
   {waitUntil:'domcontentloaded',timeout:120000})
  await page.waitForFunction(async()=>{
   const {useStore}=await import('orbita/store')
   return useStore.getState().phase==='playing'&&useStore.getState().ready
  },null,{timeout:120000})
  await page.waitForFunction(()=>{
    const p=window.__orbitaHexShaderPrep
    return p?.status==='complete-or-interrupted'&&
      p.compiledShaders===p.totalShaders&&
      p.uploadedTextures===p.totalTextures&&p.errors===0
  },null,{timeout:180000,polling:600})
  const before=await page.evaluate(()=>({...window.__orbitaHexShaderPrep}))
  await page.evaluate(()=>{
   window.__hexProfileFrames=[]
   window.__hexProfileTasks=[]
   const ob=new PerformanceObserver(list=>{
    for(const item of list.getEntries())
      window.__hexProfileTasks.push({t:item.startTime,d:item.duration})
   })
   try{ob.observe({type:'longtask',buffered:false})}catch{}
   window.__hexProfileOb=ob
   requestAnimationFrame(function raf(t){
    window.__hexProfileFrames.push(t)
    requestAnimationFrame(raf)
   })
  })
  await page.waitForTimeout(500)
  await page.evaluate(()=>{
   const p=window.__hexGlProfiler
   p.calls={};p.slow=[];p.enabled=true;p.onAt=performance.now()
   window.__hexProfileFrames.length=0
   window.__hexProfileTasks.length=0
   window.__hexProfileStart=performance.now()
   window.__orbitaReality.requestReality('mua-ha')
  })
  await page.waitForTimeout(11500)
  r.sample=await page.evaluate(()=>{
   const p=window.__hexGlProfiler
   p.enabled=false
   const now=performance.now()
   const frames=window.__hexProfileFrames
   const gaps=frames.slice(1).map((v,i)=>v-frames[i])
   const maxGap=Math.max(0,...gaps,now-(frames.at(-1)??window.__hexProfileStart))
   const ordered=Object.entries(p.calls).map(([method,v])=>({method,...v,
     total:Math.round(v.total),max:Math.round(v.max*10)/10}))
   ordered.sort((a,b)=>b.total-a.total)
   const dbg=window.__orbitaHexGpuDiagStats
   const view=document.querySelector('canvas')?.getContext('webgl2')
   return {elapsed:Math.round(now-window.__hexProfileStart),frameCount:frames.length,
    maxGapMs:Math.round(maxGap),lastFrameSilentMs:Math.round(now-(frames.at(-1)??window.__hexProfileStart)),
    largestLongTaskMs:Math.round(Math.max(0,...window.__hexProfileTasks.map(t=>t.d))),
    phase:window.__orbitaReality.useReality.getState().phase,
    front:window.__orbitaReality.rt.front,
    prep:window.__orbitaHexShaderPrep,
    isolated:dbg, contextLost:view?.isContextLost(),
    hookedMethods:p.hooks.length,
    orderedCalls:ordered,slowWebGLCalls:p.slow}
  })
  r.preflight=before
  await page.screenshot({path:'hex-gl-profile/'+mode+'-'+idx+'.png',timeout:120000})
  await page.evaluate(()=>window.__hexProfileOb.disconnect())
 }catch(err){r.error=String(err)}
 writeFileSync('hex-gl-profile/results.json',JSON.stringify(results,null,2))
 console.log('HEX_GL_PROFILE '+JSON.stringify({
  mode:r.mode,error:r.error,
  info:r.sample?{
   gap:r.sample.maxGapMs,longTask:r.sample.largestLongTaskMs,
   count:r.sample.frameCount,hooks:r.sample.hookedMethods,
   top:r.sample.orderedCalls.slice(0,12),
   slow:r.sample.slowWebGLCalls.slice(0,15)
  }:null,errors:r.errors}).slice(0,10000))
 await ctx.close()
}
await browser.close()
if(results.some(r=>r.error||r.errors.length||r.network.length||r.sample?.contextLost||
  !r.sample?.hookedMethods))process.exitCode=4
