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
const earlyVariant=process.env.COLOSSUS_EARLY_VARIANT || 'legacy'
if(!['legacy','early','fast'].includes(earlyVariant))throw Error('Unknown early-discard variant')
const exhibitVariant=process.env.COLOSSUS_EXHIBIT_VARIANT || 'normal'
if(!['normal','noExhibits','noLaser'].includes(exhibitVariant)) throw Error('Unknown exhibit/laser diagnostic')
const fullLitVariant=process.env.COLOSSUS_FULL_LIT_VARIANT || 'legacy'
if(!['legacy','lit','deep'].includes(fullLitVariant))throw Error('Unknown complete-fragment variant')
const nativeVariant=process.env.COLOSSUS_NATIVE_VARIANT || 'legacy'
if(!['legacy','native','native2'].includes(nativeVariant))throw Error('Unknown native scene preflight variant')
const geometryVariant=process.env.COLOSSUS_GEOMETRY_VARIANT || 'stable'
if(!['legacy','stable'].includes(geometryVariant))throw Error('Unknown geometry lifecycle variant')
const apexShadowVariant=process.env.COLOSSUS_APEX_SHADOW_VARIANT || 'normal'
if(!['normal','off'].includes(apexShadowVariant))throw Error('Unknown APEX shadow probe')
const shadowVariant=process.env.COLOSSUS_SHADOW_VARIANT || 'normal'
if(!['normal','off'].includes(shadowVariant))throw Error('Unknown shadow variant')
const targetUrl=new URL(process.env.COLOSSUS_SMOKE_URL || 'http://127.0.0.1:4173/#at=0,-27,0,20&autostart&skip')
if(shadowVariant==='off')targetUrl.searchParams.set('colossusShadowProbe','off')
if(apexShadowVariant==='off')targetUrl.searchParams.set('colossusApexShadowProbe','off')
if(geometryVariant==='legacy')targetUrl.searchParams.set('colossusGeometryProbe','legacy')
if(nativeVariant==='native')targetUrl.searchParams.set('colossusNativePreflight','on')
if(nativeVariant==='native2')targetUrl.searchParams.set('colossusNativePreflight','double')
if(fullLitVariant==='lit')targetUrl.searchParams.set('colossusFullLitPrewarm','on')
if(fullLitVariant==='deep')targetUrl.searchParams.set('colossusDeepPrewarm','on')
if(exhibitVariant==='noExhibits')targetUrl.searchParams.set('colossusExhibitProbe','off')
if(exhibitVariant==='noLaser')targetUrl.searchParams.set('colossusLaserProbe','off')
if(earlyVariant==='early')targetUrl.searchParams.set('colossusEarlyDiscardProbe','on')
if(earlyVariant==='fast')targetUrl.searchParams.set('colossusEarlyDiscardProbe','fast')
const url=targetUrl.toString()
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
      totalProxies:w?.totalProxies,uploadedProxies:w?.uploadedProxies,
      fullLitPrewarm:w?.fullLitPrewarm,fullyLitBatches:w?.fullyLitBatches,
      fullyLitMeshesPrimed:w?.fullyLitMeshesPrimed,
      deepWorldPrewarm:w?.deepWorldPrewarm,
      nativeScenePrewarm:w?.nativeScenePrewarm,
      nativeScenePasses:w?.nativeScenePasses,
      nativeSceneRepeats:w?.nativeSceneRepeats,
      nativeScenePeakCpuMs:w?.nativeScenePeakCpuMs,
      longestPrivateBatchCpuMs:w?.longestPrivateBatchCpuMs
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
      reactCommits:profile?.reactCommits??[],
      // Locate the actual time of the slow frame relative to the scan and
      // the laser. This is derived from the existing opt-in R3F profile.
      slowFrames:(profile?.trace??[]).filter(x=>x.dtMs>=120).map(x=>({
        atMs:x.atMs,dtMs:x.dtMs,mode:x.mode,programs:x.programs
      })).slice(0,32)
    }
  })
  const report={sha:process.env.GITHUB_SHA??'local',shadowVariant,apexShadowVariant,nativeVariant,geometryVariant,exhibitVariant,earlyVariant,fullLitVariant,before,clicked,result,errors,
    verdict:result.afterClick.maxMs<=120&&(exhibitVariant==='noLaser'||(result.firstBeamMs!=null&&result.firstBeamMs<500))
      ? 'SMOOTH_VIRTUAL_MEASURED_NOT_REAL_GPU_CERTIFIED' : 'HITCH_NOT_ACCEPTED',
    limits:'Same-session idle vs click rAF callback comparison on Apple Paravirtual Metal. rAF is not presented frame timing and no physical device is certified; no visual settings changed.'}
  console.log('READY_IDLE_V_CLICK '+JSON.stringify(report))
  writeFileSync('browser-evidence/ready-idle-v-click.json',JSON.stringify(report,null,2))
  await page.screenshot({path:'browser-evidence/ready-idle-v-click.png',timeout:60000})
  if(errors.length || !clicked || (exhibitVariant!=='noLaser'&&result.firstBeamMs==null))process.exitCode=3
  else if(report.verdict==='HITCH_NOT_ACCEPTED')process.exitCode=12
} catch(e){
  console.error('READY_IDLE_V_CLICK_BLOCKED',String(e))
  process.exitCode=4
} finally {await browser.close()}
