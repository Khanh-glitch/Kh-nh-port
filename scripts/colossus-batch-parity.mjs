import {createRequire} from 'node:module'
import {mkdirSync,writeFileSync} from 'node:fs'
const require=createRequire(import.meta.url)
const {chromium}=require('../source/node_modules/playwright')
mkdirSync('browser-evidence',{recursive:true})
const browser=await chromium.launch({headless:true,args:[
 '--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
]})
const page=await browser.newPage({viewport:{width:640,height:400},deviceScaleFactor:1})
const errors=[]
page.on('pageerror',e=>errors.push(e.message))
const url='http://127.0.0.1:5173/tests/colossus-batch-parity.html'
try{
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:120000})
 await page.waitForFunction(()=>window.__ready===true,null,{timeout:60000})
 await page.evaluate(()=>window.__captureBatchFrame(.5))
 await page.screenshot({path:'browser-evidence/batch-original-50.png'})
 const result=await page.evaluate(()=>window.__runBatchParity())
 await page.evaluate(()=>window.__captureBatchFrame(.5))
 await page.screenshot({path:'browser-evidence/batch-merged-50.png'})
 const worst=Math.max(...result.results.map(x=>x.maxChannelDiff))
 const changed=result.results.reduce((n,x)=>n+x.mismatchedPixels,0)
 const verdict=errors.length===0&&result.counters.drawsSavedPerPass>=6&&changed===0
  ? 'PIXEL_EXACT_BATCH_PASS':'BATCH_PIXEL_MISMATCH'
 const report={sha:process.env.GITHUB_SHA,verdict,...result,errors}
 console.log('COLOSSUS_BATCH_PARITY '+JSON.stringify(report))
 writeFileSync('browser-evidence/colossus-batch-parity.json',JSON.stringify(report,null,2))
 if(verdict!=='PIXEL_EXACT_BATCH_PASS')process.exitCode=12
}catch(e){console.error('COLOSSUS_BATCH_PARITY_BLOCKED',String(e),errors);process.exitCode=4}
finally{await browser.close()}
