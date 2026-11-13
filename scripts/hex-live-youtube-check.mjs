// Live-network diagnostic, deliberately no YouTube stub and no autoplay bypass.
// The diagnostic invokes the app's real reality API; it does not claim to test
// the physical sheet click or a real visitor's audio output device.
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
const require = createRequire(import.meta.url)
const { chromium } = require('../source/node_modules/playwright')
mkdirSync('youtube-evidence', { recursive: true })
const result = { observations: [], pageErrors: [], failedRequests: [] }
const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 960, height: 540 } })
page.on('pageerror', e => result.pageErrors.push(e.message))
page.on('requestfailed', r => { if (/youtube|googlevideo/i.test(r.url())) result.failedRequests.push({url:r.url().split('?')[0], error:r.failure()?.errorText}) })
try {
  await page.goto('http://127.0.0.1:4173/?hexOfficialYoutube=1#at=-26,20,0,0&autostart&skip', { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(() => !!window.__orbitaReality, null, { timeout: 120000 })
  // A real Playwright click gives the browser a transient user activation;
  // this test-only button calls the same request API, not the sheet geometry.
  await page.evaluate(() => {
    const button = document.createElement('button')
    button.textContent = 'QA: start real YouTube'
    button.style.cssText = 'position:fixed;top:0;left:0;z-index:10000'
    button.onclick = () => { window.__orbitaReality.requestReality('ngay-mai'); button.remove() }
    document.body.appendChild(button)
  })
  await page.getByRole('button', { name:'QA: start real YouTube' }).click()
  await page.waitForSelector('iframe[src*="youtube"]', { state:'attached', timeout: 120000 })
  const inspect = async label => {
    const frame = page.frames().find(f => /youtube(?:-nocookie)?\.com\/embed\//.test(f.url()))
    const data = frame ? await frame.evaluate(() => {
      const v = document.querySelector('video')
      return { url: location.href.split('?')[0], title: document.title,
        video: v ? {time:v.currentTime, paused:v.paused, muted:v.muted, readyState:v.readyState, error:v.error?.code ?? null} : null,
        errorText: document.querySelector('.ytp-error-content-wrap-reason')?.textContent?.trim() ?? null }
    }).catch(e => ({frameError:String(e)})) : null
    result.observations.push({ label, data })
    return data
  }
  await page.waitForTimeout(12000)
  let first = await inspect('initial')
  const recovery = page.getByRole('button', {name:'Phát video và âm thanh'})
  if (await recovery.isVisible().catch(() => false)) {
    await recovery.click({timeout:60000})
    await page.waitForTimeout(10000)
    first = await inspect('after-real-recovery-click')
  }
  await page.waitForTimeout(5000)
  const last = await inspect('five-seconds-later')
  await page.screenshot({path:'youtube-evidence/scene.png', timeout:60000})
  result.playbackVerified = !!(first?.video && last?.video && !last.video.paused && last.video.readyState >= 2 && first.video.time >= 80 && last.video.time > first.video.time + 1)
  await page.evaluate(() => window.__orbitaReality.dismissReality())
  await page.waitForFunction(() => !document.querySelector('iframe[src*="youtube-nocookie.com/embed/179btG24VE8"]'), null, {timeout:60000}).catch(() => {})
  result.iframesAfterDismiss = await page.locator('iframe[src*="youtube-nocookie.com/embed/179btG24VE8"]').count()
} catch (e) { result.error = String(e) }
await browser.close()
writeFileSync('youtube-evidence/report.json', JSON.stringify(result, null, 2))
console.log('LIVE_YOUTUBE_RESULT ' + JSON.stringify(result))
if (!result.playbackVerified || result.iframesAfterDismiss !== 0 || result.pageErrors.length) process.exitCode = 1
