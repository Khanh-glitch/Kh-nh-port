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
const browser = await chromium.launch({
  channel: 'chrome', headless: true,
  args: ['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']
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
    let lastAt = performance.now()
    const sample = (timestamp) => {
      const d = timestamp - lastAt
      lastAt = timestamp
      probe.callbackCount++
      probe.maxGapMs = Math.max(probe.maxGapMs,d)
      if (probe.gaps.length < 600) probe.gaps.push(Math.round(d))
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
      warmup:window.__orbitaColossusWarmup,
      count:p.callbackCount, maxGapMs:Math.round(p.maxGapMs),
      p95GapMs:gaps.length?gaps[Math.floor((gaps.length-1)*0.95)]:null,
      over100ms:gaps.filter(x=>x>=100).length,
      over1000ms:gaps.filter(x=>x>=1000).length,
      firstGaps:p.gaps.slice(0,30), longestGaps:gaps.slice(-12)
    }
  })
  const report = {commit:process.env.GITHUB_SHA,variant,url:url.toString(),data,errors,
    note:'ANGLE/SwiftShader SOFTWARE renderer. No user interaction in this trial. Visual screenshot captured AFTER timing sample.'}
  writeFileSync('browser-evidence/idle-summary.json',JSON.stringify(report,null,2))
  console.log('IDLE_PROBE '+JSON.stringify({variant,commits:report.commit, ...data, warmup:{status:data.warmup?.status,laserReady:data.warmup?.laserReady,materializeCompileMode:data.warmup?.materializeCompileMode,materializeShaderMs:data.warmup?.materializeShaderMs}}))
  await page.screenshot({path:'browser-evidence/colossus-idle.png',timeout:90000})
  if(errors.length || !data.validWebgl || data.contextLost) process.exitCode=2
} catch(err) {
  console.error('Idle probe failed:',err)
  process.exitCode=3
} finally {
  await browser.close()
}
