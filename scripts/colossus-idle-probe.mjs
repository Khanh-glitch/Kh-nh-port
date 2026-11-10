import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
const require = createRequire(import.meta.url)
const { chromium } = require('../source/node_modules/playwright')
const raw = process.env.COLOSSUS_SMOKE_URL
if (!raw) throw new Error('COLOSSUS_SMOKE_URL missing')
const variant = process.env.COLOSSUS_AB_VARIANT ?? 'enabled'
if (!['enabled', 'disabled'].includes(variant)) throw new Error('Invalid variant')
const url = new URL(raw)
if (variant === 'disabled') url.searchParams.set('colossusPrewarm', 'off')
mkdirSync('browser-evidence', { recursive: true })
const gpuMode = process.env.COLOSSUS_GPU_MODE ?? 'swiftshader'
const browser = await chromium.launch({
  ...(gpuMode === 'swiftshader' ? { channel:'chrome' } : {}),
  headless:true,
  args: gpuMode === 'metal'
    ? ['--enable-webgl','--enable-gpu','--ignore-gpu-blocklist','--use-angle=metal','--disable-software-rasterizer']
    : ['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']
})
const page = await browser.newPage({ viewport:{width:1280,height:720},deviceScaleFactor:1 })
const errors=[]
page.on('pageerror', err => errors.push(err.message))
try {
  await page.goto(url.toString(), {waitUntil:'domcontentloaded',timeout:120000})
  await page.waitForFunction(() => !!window.__orbitaColossusWarmup, null, {timeout:120000})
  await page.evaluate(() => {
    const probe = { startedAt:performance.now(), gaps:[], callbackCount:0, maxGapMs:0, lastAt:0 }
    window.__colossusIdleProbe = probe
    let lastAt = 0
    const sample = (timestamp) => {
      if (lastAt > 0) {
        const d = timestamp - lastAt
        probe.maxGapMs = Math.max(probe.maxGapMs,d)
        if (probe.gaps.length < 600) probe.gaps.push(Math.round(d))
      }
      lastAt = timestamp
      probe.callbackCount++
      probe.lastAt = timestamp
      requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  })
  await page.waitForTimeout(9000)
  const data = await page.evaluate(() => {
    const canvas = document.querySelector('canvas')
    const gl = canvas?.getContext('webgl2')
    const p = window.__colossusIdleProbe
    const gaps = [...p.gaps].sort((a,b)=>a-b)
    return {
      validCanvas:!!canvas, validWebgl:!!gl, contextLost:gl?.isContextLost(),
      renderer:gl?.getParameter(gl.getExtension('WEBGL_debug_renderer_info')?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER),
      warmup:window.__orbitaColossusWarmup,
      count:p.callbackCount, maxGapMs:Math.round(p.maxGapMs),
      p95GapMs:gaps.length?gaps[Math.floor((gaps.length-1)*0.95)]:null,
      over100ms:gaps.filter(x=>x>=100).length,
      over1000ms:gaps.filter(x=>x>=1000).length,
      firstGaps:p.gaps.slice(0,30), longestGaps:gaps.slice(-12)
    }
  })
  let lateClick = null
  let readiness = null
  if (process.env.COLOSSUS_IDLE_THEN_CLICK === '1') {
    const requireFullyReady = process.env.COLOSSUS_READY_GATE === '1'
    if (requireFullyReady) {
      const waitStart = Date.now()
      const reached = await page.waitForFunction(() => window.__orbitaColossusWarmup?.status === 'ready', null, {
        timeout: 45000, polling: 250
      }).then(() => true, () => false)
      readiness = await page.evaluate(() => {
        const w = window.__orbitaColossusWarmup
        return {status:w?.status, laserReady:w?.laserReady, gpuSynced:w?.gpuSynced,
          uploadedProxies:w?.uploadedProxies, totalProxies:w?.totalProxies,
          earlyShaderCompileStatus:w?.earlyShaderCompileStatus}
      })
      readiness.waitMs = Date.now() - waitStart
      readiness.confirmed = reached && readiness.status === 'ready' && readiness.gpuSynced === true &&
        readiness.totalProxies > 0 && readiness.uploadedProxies >= readiness.totalProxies
      console.log('FULL_READINESS '+JSON.stringify({variant,gpuMode,readiness}))
      if (!readiness.confirmed) process.exitCode = 14
    }
    // We do not silently label a timeout as "fully warm".
    if (requireFullyReady && !readiness.confirmed) {
      lateClick = {dispatched:false, readyBeforeClick:false, verdict:'BLOCKED_FULL_READINESS_NOT_REACHED'}
    } else {
    const dispatched = await page.evaluate(() => {
      const canvas = document.querySelector('canvas')
      if (!canvas) return false
      const r = canvas.getBoundingClientRect()
      const p = {bubbles:true,cancelable:true,clientX:r.left+r.width/2,clientY:r.top+r.height/2,pointerId:1,pointerType:'mouse',isPrimary:true}
      for (const type of ['pointermove','pointerdown','pointerup']) canvas.dispatchEvent(new PointerEvent(type,p))
      return true
    })
    await page.waitForFunction(() => !!window.__orbitaColossusProfile, null, {timeout:120000,polling:500}).catch(() => {})
    await page.waitForFunction(() => window.__orbitaColossusProfile?.firstBeamFrameAtMs != null, null, {timeout:25000,polling:250}).catch(() => {})
    const profile = await page.evaluate(() => window.__orbitaColossusProfile || null)
    lateClick = {
      dispatched,
      readyBeforeClick:requireFullyReady ? readiness.confirmed : data.warmup?.status === 'ready',
      statusBeforeClick:requireFullyReady ? readiness.status : data.warmup?.status,
      readinessWaitMs:readiness?.waitMs ?? 0,
      totalProxiesReady:readiness?.totalProxies ?? data.warmup?.totalProxies ?? 0,
      maxFrameMs:profile?.maxFrameMs ?? null,
      firstFrameMs:profile?.firstFrameFromClickMs ?? null,
      firstBeamMs:profile?.firstBeamFrameAtMs ?? null,
      newPrograms:profile?.programDelta ?? null,
      verdict:profile?.maxFrameMs != null && profile.maxFrameMs < 120 && profile?.firstBeamFrameAtMs != null && profile.firstBeamFrameAtMs < 500 ? 'SMOOTH_MEASURED_VIRTUAL_GPU' : 'UNACCEPTED_STUTTER'
    }
    console.log('DELAYED_CLICK '+JSON.stringify({variant,gpuMode,lateClick}))
    if (lateClick.verdict === 'UNACCEPTED_STUTTER') process.exitCode=12
    }
  }
  const report = {commit:process.env.GITHUB_SHA,variant,gpuMode,url:url.toString(),data,readiness,lateClick,errors,
    note:'ANGLE GPU fingerprint recorded. Snapshot AFTER timing. Metal Paravirtual is not bare physical-GPU certification.'}
  writeFileSync('browser-evidence/idle-summary.json',JSON.stringify(report,null,2))
  console.log('IDLE_PROBE '+JSON.stringify({variant,gpuMode,commit:report.commit, ...data, warmup:{status:data.warmup?.status,laserReady:data.warmup?.laserReady,earlyShaderCompileStatus:data.warmup?.earlyShaderCompileStatus}}))
  await page.screenshot({path:'browser-evidence/colossus-idle-then-click.png',timeout:90000})
  if(errors.length || !data.validWebgl || data.contextLost) process.exitCode=2
} catch(err) {
  console.error('Idle probe failed:',err)
  process.exitCode=3
} finally {
  await browser.close()
}
