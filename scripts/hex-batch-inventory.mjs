import {createRequire} from 'node:module'
import {mkdirSync,writeFileSync} from 'node:fs'
const {chromium}=createRequire(import.meta.url)('../source/node_modules/playwright')
mkdirSync('hex-batch-evidence',{recursive:true})
const browser=await chromium.launch({headless:true,args:[
 '--enable-webgl','--enable-gpu','--ignore-gpu-blocklist',
 '--use-angle=metal','--disable-software-rasterizer'
]})
const page=await browser.newPage({viewport:{width:960,height:540}})
const errors=[]
page.on('pageerror',e=>errors.push(e.message))
const result={errors}
try{
 await page.goto('http://127.0.0.1:4174/?hexGpuDiag=batch-inventory#at=-26,20,0,0&autostart&skip',
  {waitUntil:'domcontentloaded',timeout:120000})
 await page.waitForFunction(()=>window.__orbitaHexBatchInventory?.drawable>0,null,{timeout:120000})
 result.inventory=await page.evaluate(()=>window.__orbitaHexBatchInventory)
 await page.screenshot({path:'hex-batch-evidence/ueh-source.png',timeout:120000})
}catch(e){result.error=String(e)}
writeFileSync('hex-batch-evidence/inventory.json',JSON.stringify(result,null,2))
console.log('HEX_BATCH_INVENTORY '+JSON.stringify(result))
await browser.close()
if(result.error||errors.length||!(result.inventory?.drawable>0))process.exitCode=7
