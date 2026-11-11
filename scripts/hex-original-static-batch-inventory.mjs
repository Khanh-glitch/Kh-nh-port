import {createRequire} from 'node:module'
import {mkdirSync,writeFileSync} from 'node:fs'
const require=createRequire(import.meta.url)
const {chromium}=require('../source/node_modules/playwright')
const browser=await chromium.launch({headless:true,args:[
  '--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'
]})
mkdirSync('browser-evidence',{recursive:true})
const errors=[]
try {
  const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1})
  page.on('pageerror',e=>errors.push(e.message))
  await page.goto('http://127.0.0.1:4173/?hexGpuDiag=batch-inventory#at=-26,20,0,0&autostart&skip',
    {waitUntil:'domcontentloaded',timeout:120000})
  await page.waitForFunction(()=>!!window.__orbitaHexBatchInventory,null,{timeout:90000})
  const inventory=await page.evaluate(()=>window.__orbitaHexBatchInventory)
  const report={source:'actual original UEHWorld production standalone',
    changedGraphics:false,inventory,errors}
  writeFileSync('browser-evidence/hex-original-static-batching-inventory.json',JSON.stringify(report,null,2))
  console.log('HEX_BATCH_INVENTORY '+JSON.stringify(report))
  if(errors.length)process.exitCode=2
}catch(e){console.error('HEX_BATCH_INVENTORY_FAILED',String(e));process.exitCode=3}
finally{await browser.close()}
