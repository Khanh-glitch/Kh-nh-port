import {createRequire} from 'node:module'
import {mkdirSync,writeFileSync} from 'node:fs'
const require=createRequire(import.meta.url)
const {chromium}=require('../source/node_modules/playwright')
mkdirSync('integration-evidence',{recursive:true})
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-webgl','--use-angle=swiftshader','--ignore-gpu-blocklist']})
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
 if(report.errors.length)throw Error('Browser JS exceptions: '+JSON.stringify(report.errors.slice(0,5)))
} catch(error) {
 report.error=String(error)
} finally {
 writeFileSync('integration-evidence/report.json',JSON.stringify(report,null,2))
 console.log('ORBITA_INTEGRATION_BROWSER '+JSON.stringify(report).slice(0,12000))
 await ctx.close();await browser.close()
}
if(report.error)process.exitCode=5
