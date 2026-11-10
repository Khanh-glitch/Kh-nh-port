import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
const require = createRequire(import.meta.url)
const { chromium } = require('../source/node_modules/playwright')
mkdirSync('browser-evidence', { recursive:true })
const browser = await chromium.launch({
  headless:true,
  args:['--enable-webgl','--enable-gpu','--ignore-gpu-blocklist','--use-angle=metal','--disable-software-rasterizer']
})
const page = await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1})
const errors=[]
page.on('pageerror',e=>errors.push(e.message))
const url=process.env.COLOSSUS_SMOKE_URL || 'http://127.0.0.1:4173/#at=0,-27,0,20&autostart&skip'
try {
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:120000})
  await page.waitForFunction(()=>!!window.__orbitaColossusWarmup,null,{timeout:120000})
  await page.waitForFunction(()=>{
    const w=window.__orbitaColossusWarmup
    return w?.status==='ready' && w?.laserReady===true && w?.gpuSynced===true &&
      w?.totalProxies>=120 && w?.uploadedProxies===w?.totalProxies
  },null,{timeout:60000,polling:250})
  const before=await page.evaluate(()=>{
    const canvas=document.querySelector('canvas')
    const gl=canvas?.getContext('webgl2')
    const ext=gl?.getExtension('WEBGL_debug_renderer_info')
    const renderer=gl?.getParameter(ext?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER)
    const w=window.__orbitaColossusWarmup
    return {renderer,webgl:!!gl,contextLost:gl?.isContextLost(),warmup:{
      status:w?.status,laserReady:w?.laserReady,gpuSynced:w?.gpuSynced,
      totalProxies:w?.totalProxies,uploadedProxies:w?.uploadedProxies
    }}
  })
  if(!/Metal/.test(String(before.renderer)) || /SwiftShader/.test(String(before.renderer)))
    throw new Error('Expected paravirtual Metal, got: '+before.renderer)
  await page.evaluate(()=>{
    const p={phase:'idle',lastAt:0,idle:[],afterClick:[],events:0}
    window.__colossusReadyComparative=p
    function sample(ts){
      const d=p.lastAt>0?ts-p.lastAt:0
      if(d>0 && p[p.phase]?.length<2000) p[p.phase].push(Math.round(d))
      p.lastAt=ts
      p.events++
      requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  })
  // AFTER complete GPU readiness, take an idle baseline on the same live
  // WebGL scene, GPU process, viewport and browser tab as the subsequent click.
  await page.waitForTimeout(5000)
  const idle=await page.evaluate(()=>{
    const p=window.__colossusReadyComparative
    return {samples:p.idle.length,lastAt:p.lastAt}
  })
  if(idle.samples<5) throw new Error('Too few healthy idle rAF samples')
  const clicked=await page.evaluate(()=>{
    const c=document.querySelector('canvas')
    if(!c) return false
    window.__colossusReadyComparative.phase='afterClick'
    const r=c.getBoundingClientRect()
    const args={bubbles:true,cancelable:true,clientX:r.left+r.width/2,
      clientY:r.top+r.height/2,pointerId:1,pointerType:'mouse',isPrimary:true}
    for(const type of ['pointermove','pointerdown','pointerup'])
      c.dispatchEvent(new PointerEvent(type,args))
    return true
  })
  await page.waitForFunction(()=>!!window.__orbitaColossusProfile,null,{timeout:50000,polling:250})
  await page.waitForTimeout(5000)
  const result=await page.evaluate(()=>{
    const p=window.__colossusReadyComparative
    const profile=window.__orbitaColossusProfile
    function summarize(values){
      const sorted=[...values].sort((a,b)=>a-b)
      return {
        count:values.length,
        maxMs:sorted.at(-1)??0,
        medianMs:sorted[Math.floor(sorted.length/2)]??0,
        p95Ms:sorted[Math.floor((sorted.length-1)*0.95)]??0,
        over120:values.filter(x=>x>120).length,
        over500:values.filter(x=>x>500).length,
        over1000:values.filter(x=>x>1000).length,
        worst10:sorted.slice(-10)
      }
    }
    return {
      idle:summarize(p.idle),
      afterClick:summarize(p.afterClick),
      firstBeamMs:profile?.firstBeamFrameAtMs??null,
      firstFrameMs:profile?.firstFrameFromClickMs??null,
      profileMaxFrameMs:profile?.maxFrameMs??null,
      newShaderPrograms:profile?.programDelta??null,
      reactCommits:profile?.reactCommits??[]
    }
  })
  const report={sha:process.env.GITHUB_SHA??'local',before,clicked,result,errors,
    verdict:result.afterClick.maxMs<=120&&result.firstBeamMs!=null&&result.firstBeamMs<500
      ? 'SMOOTH_VIRTUAL_MEASURED_NOT_REAL_GPU_CERTIFIED' : 'HITCH_NOT_ACCEPTED',
    limits:'Same-session idle vs click rAF callback comparison on Apple Paravirtual Metal. rAF is not presented frame timing and no physical device is certified; no visual settings changed.'}
  console.log('READY_IDLE_V_CLICK '+JSON.stringify(report))
  writeFileSync('browser-evidence/ready-idle-v-click.json',JSON.stringify(report,null,2))
  await page.screenshot({path:'browser-evidence/ready-idle-v-click.png',timeout:60000})
  if(errors.length || !clicked || result.firstBeamMs==null)process.exitCode=3
  else if(report.verdict==='HITCH_NOT_ACCEPTED')process.exitCode=12
} catch(e){
  console.error('READY_IDLE_V_CLICK_BLOCKED',String(e))
  process.exitCode=4
} finally {await browser.close()}
