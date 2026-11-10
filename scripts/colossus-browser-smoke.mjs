import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
const require = createRequire(import.meta.url)
const { chromium } = require('../source/node_modules/playwright')
const inputURL = process.env.COLOSSUS_SMOKE_URL
const abVariant = process.env.COLOSSUS_AB_VARIANT || 'enabled'
if (!['enabled','disabled'].includes(abVariant)) throw new Error('Unknown A/B variant: '+abVariant)
const parsedURL = inputURL ? new URL(inputURL) : null
if (abVariant === 'disabled' && parsedURL) parsedURL.searchParams.set('colossusPrewarm', 'off')
const url = parsedURL?.toString() ?? ''
if (!url || !/^https?:\/\//.test(url)) {
  throw new Error('COLOSSUS_SMOKE_URL is required: never test a stale deployed preview as if it were branch HEAD')
}
mkdirSync('browser-evidence', { recursive: true })
const gpuMode = process.env.COLOSSUS_GPU_MODE || 'swiftshader'
if (!['swiftshader','metal'].includes(gpuMode)) throw new Error('Unknown COLOSSUS_GPU_MODE')
const browser = await chromium.launch({
  ...(gpuMode === 'metal' ? {} : {channel: 'chrome'}),
  headless: true,
  args: gpuMode === 'metal'
    ? ['--enable-webgl','--enable-gpu','--ignore-gpu-blocklist','--use-angle=metal','--disable-software-rasterizer']
    : ['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']
})
const page = await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1})
const errors=[]
const netFailed=[]
page.on('pageerror', e => errors.push(e.message))
page.on('requestfailed', r => netFailed.push(r.url().slice(0,150) + ': ' + r.failure()?.errorText))
const t0=Date.now()
try {
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:120000})
  await page.waitForFunction(() => !!window.__orbitaColossusWarmup, null, {timeout:120000,polling:1000})
  await page.waitForTimeout(6000)
  const before=await page.evaluate(() => {
    const canvas=document.querySelector('canvas')
    const gl=canvas?.getContext('webgl2')
    return {
      canvas:!!canvas,webgl2:!!gl,contextLost:gl?.isContextLost(),
      gpuRenderer:gl ? gl.getParameter(gl.getExtension('WEBGL_debug_renderer_info')?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER) : null,
      warmup:window.__orbitaColossusWarmup,
      verifiedCandidate: typeof window.__orbitaColossusWarmup?.laserSubmitted === 'boolean' &&
        typeof window.__orbitaColossusWarmup?.showcaseDrawBatches === 'number',
      canvasSize:canvas ? [canvas.width,canvas.height] : null,
      pageTitle:document.title,
      overlay:document.getElementById('menniverse-laser-probe')?.textContent?.slice(0,200)
    }
  })
  const attempted=await page.evaluate(() => {
    const canvas=document.querySelector('canvas')
    if(!canvas) return false
    const r=canvas.getBoundingClientRect()
    const point={bubbles:true,cancelable:true,clientX:r.left+r.width/2,clientY:r.top+r.height/2,pointerId:1,pointerType:'mouse',isPrimary:true}
    canvas.dispatchEvent(new PointerEvent('pointermove',point))
    canvas.dispatchEvent(new PointerEvent('pointerdown',point))
    canvas.dispatchEvent(new PointerEvent('pointerup',point))
    return true
  })
  // Software WebGL can pause for many seconds; PASS only when a real
  // completed first-summon profile exists, never merely after dispatching click.
  await page.waitForFunction(() => !!window.__orbitaColossusProfile, null, {
    timeout: 100000, polling: 1000
  })
  // A successful click handler or a completed 3-second telemetry profile is
  // NOT proof that the player ever saw the beam. Continue waiting for the
  // source's actual first visible beam submission before evaluating outcomes.
  await page.waitForFunction(() => window.__orbitaColossusProfile?.firstBeamFrameAtMs != null, null, {
    timeout: 25000, polling: 250
  }).catch(() => {})
  await page.waitForTimeout(300)
  const after=await page.evaluate(() => ({
    warmup:window.__orbitaColossusWarmup,
    profile:window.__orbitaColossusProfile || null,
    historyLength:window.__orbitaColossusProfiles?.length || 0,
  }))
  const realGpuVerified = gpuMode === 'metal' && /Metal|Apple M1|Apple GPU/i.test(String(before.gpuRenderer ?? '')) && !/SwiftShader|Software|llvmpipe/i.test(String(before.gpuRenderer ?? ''))
  const softwareStutter = !after.profile ||
    (after.profile.maxFrameMs ?? Infinity) > 120 ||
    (after.profile.firstFrameFromClickMs ?? Infinity) > 120 ||
    after.profile.firstBeamFrameAtMs == null
  const report={
    url,abVariant,commit:process.env.GITHUB_SHA ?? 'local',
    gpuMode, realGpuVerified,
    performanceVerdict: softwareStutter
      ? (realGpuVerified ? 'UNACCEPTED_METAL_HARDWARE' : 'UNACCEPTED_SOFTWARE_GPU')
      : (realGpuVerified ? 'METAL_MEASUREMENT_PENDING_VISUAL_PARITY' : 'MEASURED_NOT_HARDWARE_CERTIFIED'),
    elapsedMs:Date.now()-t0,attempted,before,after,
    errors,netFailed,
    notes:'NO screenshots before the click: avoid GPU readback contaminating first-laser measurement. Headless SwiftShader, not a real hardware certification'
  }
  writeFileSync('browser-evidence/summary.json',JSON.stringify(report,null,2))
  // Readback/screenshots must happen AFTER the timing window.
  try { await page.screenshot({path:'browser-evidence/after-laser.png', timeout:90000}) }
  catch(err) { console.warn('After-trigger screenshot unavailable:',String(err)) }
  console.log(JSON.stringify({
    performanceVerdict:report.performanceVerdict,
    gpuMode, realGpuVerified,
    gpuRenderer:before.gpuRenderer,
    canvas:before.canvas,webgl2:before.webgl2,contextLost:before.contextLost,
    verifiedCandidate:before.verifiedCandidate,
    abVariant,
    laserSubmitted:after.warmup?.laserSubmitted,
    laserGpuSynced:after.warmup?.laserGpuSynced,
    laserBatchCpuMs:after.warmup?.laserBatchCpuMs,
    materializeVariantKeys:after.warmup?.materializeVariantKeys,
    earlyShaderCompileStatus:after.warmup?.earlyShaderCompileStatus,
    earlyShaderCompileMs:after.warmup?.earlyShaderCompileMs,
    earlyShaderVariantKeys:after.warmup?.earlyShaderVariantKeys,
    materializeCompileMode:after.warmup?.materializeCompileMode,
    materializeShaderMs:after.warmup?.materializeShaderMs,
    showcaseDrawBatches:after.warmup?.showcaseDrawBatches,
    warmStatus:before.warmup?.status,initialPrograms:before.warmup?.programsAfter,
    attempted,profileRecorded:!!after.profile,
    reportedMaxFrameMs:after.profile?.maxFrameMs,
    firstFrameFromClickMs:after.profile?.firstFrameFromClickMs,
    firstBeamFrameAtMs:after.profile?.firstBeamFrameAtMs,
    frameMeasureOrigin:after.profile?.frameMeasureOrigin,
    newShaderPrograms:after.profile?.programDelta,
    errors,netFailed:netFailed.slice(0,8),
    warmAfter:after.warmup?.status, actualModes: [...new Set(after.profile?.trace?.map(x => x.mode) || [])],
    reactCommits:after.profile?.reactCommits,
    newPrograms:after.profile?.newPrograms?.slice(0,30),
    browserTasks:after.profile?.browserTasks?.slice(0,30),
    longFrames:after.profile?.longFrames?.slice(0,20),
    firstFrames:after.profile?.trace?.slice(0,12),
    warmupDetails:after.warmup
  },null,2))
  if(!before.canvas || !before.webgl2) process.exitCode=2
  if(!before.verifiedCandidate) process.exitCode=9
  if(errors.length) process.exitCode=3
  if(!after.profile) process.exitCode=4
  if(after.profile?.frameMeasureOrigin !== 'performance.now at click; never prior R3F dtRaw') process.exitCode=8
  if(after.profile?.trace?.length && Math.abs(after.profile.trace[0].dtMs - after.profile.trace[0].atMs) > 2) process.exitCode=7
  if(after.profile && !(after.profile.trace || []).some(x => x.mode === 'summon_apex' || x.mode === 'summon_rag')) process.exitCode=5
  if(after.profile?.firstBeamFrameAtMs == null) {
    console.error('UNACCEPTED: no visible beam submission recorded within extra 25 seconds')
    process.exitCode=11
  }
  if(gpuMode === 'metal' && !realGpuVerified) {
    console.error('UNFIT_HARDWARE_PROBE: Metal GPU not actually exposed; reject any hardware PASS claim')
    process.exitCode=13
  }
  if(softwareStutter) {
    console.error('UNACCEPTED: first-trigger hitch >120ms or beam missing on selected renderer; do not merge')
    process.exitCode=12
  }
} catch(e) {
  console.error('Browser smoke could not complete', e)
  process.exitCode=4
} finally {
  await browser.close()
}
