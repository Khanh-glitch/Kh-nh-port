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
  'shaderSource','attachShader','compileShader','linkProgram','getShaderParameter',
  'getProgramParameter','getProgramInfoLog','getShaderInfoLog','useProgram',
  'drawElementsInstanced','drawArraysInstanced','drawElements','drawArrays',
  'vertexAttribPointer','vertexAttribIPointer','vertexAttribDivisor',
  'bindVertexArray','createVertexArray','createFramebuffer','bindFramebuffer',
  'framebufferTexture2D','framebufferRenderbuffer','renderbufferStorage',
  'renderbufferStorageMultisample','clear','blitFramebuffer',
  'readPixels','finish','flush','getParameter','getError','getUniformLocation'
 ]
 const p={enabled:false,calls:{},slow:[],onAt:0,
   linked:[],clickStartLinkIndex:0}
 const sourceMeta=new WeakMap()
 const shaderTextByHash=new Map()
 const linkedShaders=new WeakMap()
 const programMeta=new WeakMap()
 const hashCode=s=>{
   let h=2166136261
   for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619)>>>0
   return h.toString(16).padStart(8,'0')
 }
 // Produce a tiny surgical GLSL diff, not a 100KB shader dump.
 p.programDeltas=()=>{
  const before=p.linked.slice(0,p.clickStartLinkIndex)
  const after=p.linked.slice(p.clickStartLinkIndex)
  const prefix=(a,b)=>{
   let n=0
   while(n<a.length&&n<b.length&&a.charCodeAt(n)===b.charCodeAt(n))n++
   return n
  }
  const suffix=(a,b,front)=>{
   let n=0
   while(n<a.length-front&&n<b.length-front&&
     a.charCodeAt(a.length-1-n)===b.charCodeAt(b.length-1-n))n++
   return n
  }
  return after.map(rec=>{
   const fs=rec.shaders[1],vs=rec.shaders[0]
   if(!fs||!vs)return {sig:rec.sig,error:'no attached fragment/vertex pair'}
   const newText=shaderTextByHash.get(fs.hash)
   if(!newText)return {sig:rec.sig,error:'missing fragment source'}
   const candidates=before.filter(old=>old.shaders[0]?.hash===vs.hash)
   let best=null
   for(const old of candidates){
    const oldFS=old.shaders[1]
    const oldText=shaderTextByHash.get(oldFS?.hash)
    if(!oldText)continue
    const front=prefix(oldText,newText)
    const tail=suffix(oldText,newText,front)
    const mismatch=(oldText.length-front-tail)+(newText.length-front-tail)
    if(!best||mismatch<best.mismatch){
      best={oldSig:old.sig,front,tail,mismatch,oldText}
    }
   }
   if(!best)return {sig:rec.sig,shaders:rec.shaders,
      error:'no prelinked vertex shader fingerprint match'}
   const {oldText,front,tail}=best
   return {sig:rec.sig,preSig:best.oldSig,
    vertexUnchanged:true,
    oldLength:oldText.length,newLength:newText.length,
    prefixChars:front,suffixChars:tail,
    oldChanged:oldText.slice(front,oldText.length-tail).slice(0,300),
    newChanged:newText.slice(front,newText.length-tail).slice(0,300),
    contextBefore:newText.slice(Math.max(0,front-100),front),
    contextAfter:newText.slice(newText.length-tail,newText.length-tail+100),
    mismatch:best.mismatch}
  })
 }
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
    // Track the actual GLSL variants linked by the GPU driver on each phase,
    // including when normal rAF/frame probes were not yet enabled.
    if(method==='shaderSource'&&typeof args[1]==='string'){
      const source=args[1]
      const hash=hashCode(source)
      shaderTextByHash.set(hash,source)
      sourceMeta.set(args[0],{hash,length:source.length,
        standard:/#define STANDARD\b/.test(source),
        physical:/#define PHYSICAL\b/.test(source),
        instanced:/#define USE_INSTANCING\b/.test(source),
        shadow:/#define USE_SHADOWMAP\b/.test(source),
        map:/#define USE_MAP\b/.test(source),
        alphaTest:/#define USE_ALPHATEST\b/.test(source),
        glslNew:source.includes('uRWGrowLen'),
        glslOld:source.includes('rwX(')&&!source.includes('uRWGrowLen')
      })
    }
    if(method==='attachShader'){
      const a=linkedShaders.get(args[0])||[]
      a.push(args[1]);linkedShaders.set(args[0],a)
    }
    if(method==='linkProgram'){
      const shaders=(linkedShaders.get(args[0])||[])
        .map(shader=>sourceMeta.get(shader)||{hash:'unknown',length:0})
      const sig=shaders.map(x=>x.hash).join('+')
      const rec={id:p.linked.length+1,sig,
        phase:p.enabled?'trigger':'preflight',atMs:Math.round(performance.now()),
        shaders}
      p.linked.push(rec)
      programMeta.set(args[0],rec)
    }
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
       program:method==='getProgramInfoLog'||method==='getProgramParameter'
         ? programMeta.get(args[0])?.sig:undefined,
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
  const q=(mode==='normal'?'':mode==='fast-program-logs'?'?hexSkipShaderLogs=1':mode==='real-scene-compile'?'?hexRealSceneCompile=1':'?hexGpuDiag='+mode)
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
  if(mode==='real-scene-compile'){
    await page.waitForFunction(()=>['ready','failed'].includes(window.__orbitaHexRealCompile?.status),null,
      {timeout:150000,polling:500})
    r.sceneCompile=await page.evaluate(()=>({...window.__orbitaHexRealCompile}))
    if(r.sceneCompile.status!=='ready')throw Error('Exact UEH scene compile failed '+JSON.stringify(r.sceneCompile))
    if(r.sceneCompile.compileSubmitMs>120)throw Error('Pre-HEX full-scene compile added a startup hitch '+JSON.stringify(r.sceneCompile))
  }
  r.debug=await page.evaluate(()=>window.__orbitaHexLogProbe??null)
  if(mode==='fast-program-logs' && !(r.debug?.enabled && r.debug.active===false))
    throw Error('Three.js renderer debug flag not actually disabled: '+JSON.stringify(r.debug))
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
   p.calls={};p.slow=[];p.clickStartLinkIndex=p.linked.length;
   p.enabled=true;p.onAt=performance.now()
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
    beforeClickProgramLinks:p.clickStartLinkIndex,
    prelinked:p.linked.slice(0,p.clickStartLinkIndex),
    programDeltas:p.programDeltas(),
    newProgramLinks:p.linked.length-p.clickStartLinkIndex,
    newlyLinked:p.linked.slice(p.clickStartLinkIndex).map(rec=>({
      ...rec,
      alreadyLinkedBeforeClick:p.linked.slice(0,p.clickStartLinkIndex)
        .some(old=>old.sig===rec.sig)
    })),
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
