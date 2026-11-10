import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
const require = createRequire(import.meta.url)
const { chromium } = require('../source/node_modules/playwright')
const backend = process.env.COL_BACKEND || 'swiftshader'
const variant = process.env.COL_VARIANT || 'candidate'
const root = variant === 'baseline' ? 'https://e59cfc3b.menniverse.pages.dev' : 'https://1cc1b13a.menniverse.pages.dev'
const url = root + '/#at=0,-27,0,20&autostart&skip'
mkdirSync('browser-evidence', { recursive: true })
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--no-sandbox','--enable-webgl','--ignore-gpu-blocklist', ...(
    backend === 'swiftshader' ? ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] :
    backend === 'angle-gl' ? ['--use-gl=angle','--use-angle=gl','--enable-unsafe-swiftshader'] :
    ['--use-gl=egl','--enable-unsafe-swiftshader']
  )]
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
      gpu:(() => { const ext=gl?.getExtension('WEBGL_debug_renderer_info'); return gl ? {
        vendor:gl.getParameter(ext?.UNMASKED_VENDOR_WEBGL ?? gl.VENDOR),
        renderer:gl.getParameter(ext?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER),
        shadingLanguageVersion:gl.getParameter(gl.SHADING_LANGUAGE_VERSION)
      } : null })(),
      warmup:window.__orbitaColossusWarmup,
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
  await page.waitForFunction(() => !!window.__orbitaColossusProfile, null, {timeout:120000,polling:1000})
  await page.waitForTimeout(1000)
  const after=await page.evaluate(() => ({
    warmup:window.__orbitaColossusWarmup,
    profile:window.__orbitaColossusProfile || null,
    historyLength:window.__orbitaColossusProfiles?.length || 0,
  }))
  const report={
    url,elapsedMs:Date.now()-t0,attempted,before,after,
    backend,variant,errors,netFailed,
    notes:'NO screenshots before the click: avoid GPU readback contaminating first-laser measurement. Headless SwiftShader, not a real hardware certification'
  }
  writeFileSync('browser-evidence/summary.json',JSON.stringify(report,null,2))
  console.log(JSON.stringify({
    backend,variant,gpu:before.gpu,canvas:before.canvas,webgl2:before.webgl2,contextLost:before.contextLost,
    warmStatus:before.warmup?.status,initialPrograms:before.warmup?.programsAfter,
    attempted,profileRecorded:!!after.profile,
    reportedMaxFrameMs:after.profile?.maxFrameMs,
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
  if(!after.profile) process.exitCode=4
  if(errors.length) process.exitCode=3
  if(after.profile && !(after.profile.trace || []).some(x => x.mode === 'summon_apex' || x.mode === 'summon_rag')) process.exitCode=5
} catch(e) {
  console.error('Browser smoke could not complete', e)
  process.exitCode=4
} finally {
  await browser.close()
}
