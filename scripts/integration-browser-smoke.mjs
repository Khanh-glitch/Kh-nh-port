import {createRequire} from 'node:module'
import {mkdirSync,writeFileSync} from 'node:fs'
const require=createRequire(import.meta.url)
const {chromium}=require('../source/node_modules/playwright')
mkdirSync('integration-evidence',{recursive:true})
const angle=process.env.ORBITA_TEST_ANGLE || (process.platform==='darwin'?'metal':'swiftshader')
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-webgl','--use-angle='+angle,'--ignore-gpu-blocklist']})
const ctx=await browser.newContext({viewport:{width:1440,height:810},deviceScaleFactor:1})
const page=await ctx.newPage(),report={errors:[],network:[],stages:[],ready:false}
page.on('pageerror',e=>report.errors.push(String(e)))
page.on('requestfailed',r=>report.network.push({url:r.url().slice(0,160),error:r.failure()?.errorText}))
try {
 await page.goto('http://127.0.0.1:4174/',{waitUntil:'domcontentloaded',timeout:120000})
 await page.waitForSelector('iframe[title*="Immersive Space Shift"]',{timeout:90000})
 const frame=page.frameLocator('iframe[title*="Immersive Space Shift"]')
 await frame.locator('.app').waitFor({state:'attached',timeout:120000})
 await frame.locator('.energy-gate').first().waitFor({state:'visible',timeout:30000})
 report.stages.push('space3d-rendered')
 report.warpButton=await frame.locator('.energy-gate button').first().textContent()
 report.hasCanvas=await frame.locator('canvas').count()
 report.hasParentCanvas=await page.locator('canvas').count()
 report.hasStageModule=await page.evaluate(()=>document.querySelector('script#orbita-embedded-map')?.textContent?.includes('orbita/stage/ShowSystem'))
 report.hasLogoModule=await page.evaluate(()=>document.querySelector('script#orbita-embedded-map')?.textContent?.includes('orbita/scene/SocialDrops'))
 await page.screenshot({path:'integration-evidence/entry-1440.png',timeout:90000})
 report.stages.push('entry-screenshot')
 await page.waitForTimeout(3000)
 report.gate=await page.evaluate(()=>{
   const frame=document.querySelector('iframe')
   const button=frame?.contentDocument?.querySelector('.energy-gate button')
   return {disabled:button?.disabled,label:button?.textContent,
     landed:window.__orbitaLandingPrewarm?.status||null,
     gameReady:window.__orbitaStore?.getState?.()?.ready||null}
 })
 if(report.hasCanvas<1||report.hasParentCanvas<1||!report.hasStageModule||!report.hasLogoModule)
   throw Error('One of the preserved original/space/show/social subsystems was not rendered')

 // This MUST exercise the actual energy CTA, not just photograph a disabled button.
 // A green iframe screenshot alone does NOT mean the visitor can enter the world.
 const state=await page.evaluate(async()=>{const m=await import('orbita/store');return {
   ready:m.useStore.getState().ready,loading:m.useStore.getState().loading,
   phase:m.useStore.getState().phase,
   landing:window.__orbitaLandingPrewarm?.status??null,
   shader:window.__orbitaHexShaderPrep?.status??null,
 }})
 report.stateBeforeWarp=state
 let normalReady=false
 try {
   await page.waitForFunction(()=>{
     const btn=document.querySelector('iframe')?.contentDocument?.querySelector('.energy-gate button')
     return btn instanceof HTMLButtonElement && !btn.disabled
   },null,{timeout:35000,polling:400})
   normalReady=true
 } catch {
   // Headless Linux SwiftShader frequently cannot finish the entire unchanged
   // UEH shader queue while two WebGL renderers are active. Verify the explicit
   // USER-CONTROLLED fallback instead of pretending preflight has completed.
   // This is a functional smoke pass only, NOT a GPU-smoothness release pass.
   const recovery=page.getByRole('button',{name:'VÀO THỬ · BỎ QUA CHỜ GPU'})
   await recovery.waitFor({state:'visible',timeout:15000})
   await recovery.click()
   report.degradedGpuRecovery=true
   await page.waitForFunction(()=>{
     const btn=document.querySelector('iframe')?.contentDocument?.querySelector('.energy-gate button')
     return btn instanceof HTMLButtonElement && !btn.disabled
   },null,{timeout:20000,polling:400})
 }
 report.normalGpuReady=normalReady
 report.ready=true
 report.stages.push('energy-filled')
 await frame.locator('.energy-gate button').first().click({timeout:30000})
 report.stages.push('warp-clicked')
 await page.waitForFunction(async()=>{
   const m=await import('orbita/store')
   return m.useStore.getState().phase==='playing'
 },null,{timeout:45000,polling:400})
 report.stages.push('original-island-descent-engaged')
 await page.waitForTimeout(1600)
 report.iframeAfterWarp=await page.locator('iframe[title*="Immersive Space Shift"]').count()
 report.playingState=await page.evaluate(async()=>{const m=await import('orbita/store');return m.useStore.getState().phase})
 await page.screenshot({path:'integration-evidence/island-after-warp.png',timeout:90000})
 if(report.iframeAfterWarp!==0||report.playingState!=='playing')
    throw Error('Space scene did not hand off to original island')
 if(report.errors.length)throw Error('Browser JS exceptions: '+JSON.stringify(report.errors.slice(0,5)))
} catch(error) {
 report.error=String(error)
} finally {
 writeFileSync('integration-evidence/report.json',JSON.stringify(report,null,2))
 console.log('ORBITA_INTEGRATION_BROWSER '+JSON.stringify(report).slice(0,12000))
 await ctx.close();await browser.close()
}
if(report.error)process.exitCode=5
