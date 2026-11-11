import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
const require = createRequire(import.meta.url)
const { chromium } = require('../source/node_modules/playwright')
const traceMode=process.env.COLOSSUS_TRACE_MODE === 'mixed' ? 'mixed' : 'full'
const evidenceDir=process.env.COLOSSUS_TRACE_MODE ? 'browser-evidence/'+traceMode : 'browser-evidence'
mkdirSync(evidenceDir, {recursive:true})
const browser = await chromium.launch({headless:true,args:[
  '--enable-webgl','--enable-gpu','--ignore-gpu-blocklist',
  '--use-angle=metal','--disable-software-rasterizer'
]})
const page = await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1})
const failures=[]
page.on('pageerror',e=>failures.push(e.message))
try {
  await page.goto('http://127.0.0.1:4173/' + (traceMode === 'mixed' ? '?colossusNativePassMode=mixed' : '') + '#at=0,-27,0,20&autostart&skip',
    {waitUntil:'domcontentloaded',timeout:120000})
  await page.waitForFunction(()=>!!window.__orbitaColossusWarmup,null,{timeout:120000})
  await page.waitForTimeout(6500)
  // Crucial causal control: diagnose ONLY the hitch which remains after
  // every cached shader, texture and vertex proxy is GPU-synchronized.
  // The earlier trace started while warmup was still 'scheduled' and could
  // not distinguish render/compositor from unfinished program linking.
  const fullyReady = await page.waitForFunction(() => {
    const w = window.__orbitaColossusWarmup
    return w?.status === 'ready' && w.gpuSynced === true &&
      w.totalProxies > 0 && w.uploadedProxies >= w.totalProxies
  },null,{timeout:45000,polling:200}).then(()=>true,()=>false)
  if (!fullyReady) throw new Error('FULL_READY_PRECONDITION_FAILED: refuse confounded trace')
  // Include the five-second no-click idle window: a candidate must not
  // "fix" first click by moving the same perceptible stall into the visit.
  const idleProbe=await page.evaluate(()=>new Promise(resolve=>{
    const gaps=[]
    let previous=0
    let first=0
    const collect=(time)=>{
      if(!first)first=time
      if(previous)gaps.push(time-previous)
      previous=time
      if(time-first>=5000){
        resolve({maxGapMs:Math.round(Math.max(0,...gaps)),
          samples:gaps.length,over120ms:gaps.filter(ms=>ms>120).length})
      }else requestAnimationFrame(collect)
    }
    requestAnimationFrame(collect)
  }))
  const baseline=await page.evaluate(()=>{
    const gl=document.querySelector('canvas')?.getContext('webgl2')
    const dbg=gl?.getExtension('WEBGL_debug_renderer_info')
    return {
      renderer:gl?.getParameter(dbg?.UNMASKED_RENDERER_WEBGL??gl.RENDERER),
      warmup:window.__orbitaColossusWarmup
    }
  })
  if (!/Metal/i.test(String(baseline.renderer)) || /SwiftShader/i.test(String(baseline.renderer)))
    throw new Error('No ANGLE Metal GPU: '+baseline.renderer)
  const cdp=await page.context().newCDPSession(page)
  const done=new Promise(resolve=>cdp.once('Tracing.tracingComplete',resolve))
  await cdp.send('Tracing.start',{
    categories:'toplevel,devtools.timeline,disabled-by-default-devtools.timeline,cc,viz,gpu,renderer.scheduler,disabled-by-default-gpu.service,disabled-by-default-cc.debug,disabled-by-default-viz.debug',
    transferMode:'ReturnAsStream'
  })
  const started=Date.now()
  const attempted=await page.evaluate(()=>{
    const c=document.querySelector('canvas')
    if(!c)return false
    const r=c.getBoundingClientRect()
    const p={bubbles:true,cancelable:true,clientX:r.left+r.width/2,clientY:r.top+r.height/2,pointerId:1,pointerType:'mouse',isPrimary:true}
    for(const n of ['pointermove','pointerdown','pointerup'])c.dispatchEvent(new PointerEvent(n,p))
    return true
  })
  await page.waitForFunction(()=>!!window.__orbitaColossusProfile,null,{timeout:100000,polling:300})
  await page.waitForFunction(()=>window.__orbitaColossusProfile?.firstBeamFrameAtMs!=null,null,{timeout:25000,polling:200}).catch(()=>{})
  const profile=await page.evaluate(()=>window.__orbitaColossusProfile)
  await cdp.send('Tracing.end')
  const complete=await Promise.race([done,new Promise((_,reject)=>setTimeout(()=>reject(new Error('trace timeout')),25000))])
  if(!complete.stream)throw new Error('Chrome did not return trace stream')
  const parts=[]
  let total=0
  for(;;){
    const part=await cdp.send('IO.read',{handle:complete.stream,size:1048576})
    const buf=part.base64Encoded?Buffer.from(part.data,'base64'):Buffer.from(part.data,'utf8')
    total+=buf.length
    if(total>150_000_000)throw new Error('Trace exceeds 150 MB budget')
    parts.push(buf)
    if(part.eof)break
  }
  await cdp.send('IO.close',{handle:complete.stream})
  await cdp.detach()
  const bytes=Buffer.concat(parts)
  writeFileSync(evidenceDir+'/gpu-trace.json',bytes)
  const parsed=JSON.parse(bytes.toString('utf8'))
  const events=parsed.traceEvents??[]
  const long=events.filter(x=>x.ph==='X' && Number(x.dur)>=30000)
    .map(x=>({name:String(x.name),cat:String(x.cat),ms:Math.round(x.dur/1000),atUs:x.ts,pid:x.pid,tid:x.tid}))
    .sort((x,y)=>y.ms-x.ms).slice(0,100)
  const graphics=events.filter(x=>/gpu|viz|compositor|shadow|render|raster|swap/i.test(String(x.cat)+' '+String(x.name)))
  const report={commit:process.env.GITHUB_SHA,attempted,backend:baseline.renderer,
    warmupAtClick:baseline.warmup?.status,laserReadyAtClick:baseline.warmup?.laserReady,
    preClickIdle:idleProbe,nativePassMode:baseline.warmup?.nativePassMode,
    nativeHologramPasses:baseline.warmup?.nativeHologramPasses,
    nativeScenePeakCpuMs:baseline.warmup?.nativeScenePeakCpuMs,
    fullyReadyBeforeClick:fullyReady,uploadedProxies:baseline.warmup?.uploadedProxies,
    totalProxies:baseline.warmup?.totalProxies,gpuSynced:baseline.warmup?.gpuSynced,
    recordedForMs:Date.now()-started,profile:{
      firstFrameMs:profile?.firstFrameFromClickMs,firstBeamMs:profile?.firstBeamFrameAtMs,
      maxGapMs:profile?.maxFrameMs,newShaderPrograms:profile?.programDelta
    },totalEvents:events.length,graphicsEvents:graphics.length,
    traceBytes:bytes.length,longEvents:long,errors:failures,
    caveat:'Trace recording changes timing. This is causal diagnosis only, not visual or smoothness acceptance. Apple Paravirtual Metal is not physical GPU certification.'
  }
  writeFileSync(evidenceDir+'/gpu-trace-summary.json',JSON.stringify(report,null,2))
  console.log('GPU_PIPELINE_TRACE '+JSON.stringify(report))
  if(!attempted||!profile||failures.length)process.exitCode=3
} catch(err){console.error('GPU TRACE FAILED',String(err));process.exitCode=4}
finally{await browser.close()}
