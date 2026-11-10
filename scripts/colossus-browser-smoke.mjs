import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
const require = createRequire(import.meta.url)
const { chromium } = require('../source/node_modules/playwright')
const url = 'https://107d7b2c.menniverse.pages.dev/#at=0,-27,0,20&autostart&skip'
mkdirSync('browser-evidence', { recursive: true })
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']
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
  // Software WebGL can pause for many seconds; PASS only when a real
  // completed first-summon profile exists, never merely after dispatching click.
  await page.waitForFunction(() => !!window.__orbitaColossusProfile, null, {
    timeout: 100000, polling: 1000
  })
  await page.waitForTimeout(300)
  const after=await page.evaluate(() => ({
    warmup:window.__orbitaColossusWarmup,
    profile:window.__orbitaColossusProfile || null,
    historyLength:window.__orbitaColossusProfiles?.length || 0,
  }))
  const report={
    url,elapsedMs:Date.now()-t0,attempted,before,after,
    errors,netFailed,
    notes:'NO screenshots before the click: avoid GPU readback contaminating first-laser measurement. Headless SwiftShader, not a real hardware certification'
  }
  writeFileSync('browser-evidence/summary.json',JSON.stringify(report,null,2))
  console.log(JSON.stringify({
    canvas:before.canvas,webgl2:before.webgl2,contextLost:before.contextLost,
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
  if(errors.length) process.exitCode=3
  if(!after.profile) process.exitCode=4
  if(after.profile?.frameMeasureOrigin !== 'performance.now at click; never prior R3F dtRaw') process.exitCode=8
  if(after.profile?.trace?.length && Math.abs(after.profile.trace[0].dtMs - after.profile.trace[0].atMs) > 2) process.exitCode=7
  if(after.profile && !(after.profile.trace || []).some(x => x.mode === 'summon_apex' || x.mode === 'summon_rag')) process.exitCode=5
} catch(e) {
  console.error('Browser smoke could not complete', e)
  process.exitCode=4
} finally {
  await browser.close()
}
