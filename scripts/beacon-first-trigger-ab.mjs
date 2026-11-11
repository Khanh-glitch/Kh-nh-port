import {createRequire} from 'node:module'
import {mkdirSync,writeFileSync} from 'node:fs'
const require=createRequire(import.meta.url)
const {chromium}=require('../source/node_modules/playwright')
const modes=(process.env.BEACON_AB_MODES??'baseline,stable-lights').split(',')
const native=process.env.BEACON_BACKEND==='metal'
mkdirSync('browser-evidence/beacon',{recursive:true})
const browser=await chromium.launch({headless:true,args:native
  ? ['--enable-webgl','--enable-gpu','--ignore-gpu-blocklist','--use-angle=metal','--disable-software-rasterizer']
  : ['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']})
const results=[]
try{
  for(const mode of modes){
    const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1})
    const page=await context.newPage()
    const errors=[]
    page.on('pageerror',e=>errors.push(e.message))
    const query='?beaconProfile=1'+(mode==='stable-lights'?'&beaconStableLights=1':'')
    await page.goto('http://127.0.0.1:4173/'+query+'#at=-22,40,180,0&autostart&skip',
      {waitUntil:'domcontentloaded',timeout:120000})
    await page.waitForFunction(async()=>{
      const {useStore}=await import('orbita/store')
      return !!window.__orbitaBeaconTestTrigger&&useStore.getState().ready&&
        useStore.getState().phase==='playing'
    },null,{timeout:100000})
    const gpu=await page.evaluate(()=>{
      const gl=document.querySelector('canvas')?.getContext('webgl2')
      const dbg=gl?.getExtension('WEBGL_debug_renderer_info')
      return String(gl?.getParameter(dbg?.UNMASKED_RENDERER_WEBGL??gl.RENDERER))
    })
    if(native&&!/Metal/i.test(gpu))throw Error('Wrong Metal GPU: '+gpu)
    // Identical first and repeat signal with the EXACT production callback.
    const trials=[]
    for(let i=0;i<2;i++){
      if(i>0){
        await page.evaluate(async()=>{
          const {useStore}=await import('orbita/store')
          const s=useStore.getState()
          s.openPanel(null)
          s.setPaused(false)
        })
        await page.waitForTimeout(850)
      }else{
        await page.waitForTimeout(1200)
      }
      const before=await page.evaluate(()=>window.__orbitaBeaconProfiles?.length??0)
      await page.evaluate(()=>window.__orbitaBeaconTestTrigger())
      // IMPORTANT: a browser screenshot forces GPU readback/compositing.
      // Never capture it during a frame-pacing measurement: that would create
      // the very artificial hitch being diagnosed.
      await page.waitForFunction(n=>(window.__orbitaBeaconProfiles?.length??0)>n,
        before,{timeout:30000,polling:300})
      trials.push(await page.evaluate(()=>window.__orbitaBeaconProfiles?.at(-1)))
      await page.screenshot({path:'browser-evidence/beacon/'+mode+'-after-'+(i+1)+'.png',timeout:45000})
    }
    const record={mode,backend:gpu,trials,errors}
    results.push(record)
    console.log('BEACON_FIRST_TRIGGER_AB '+JSON.stringify(record))
    await context.close()
  }
  writeFileSync('browser-evidence/beacon/ab-results.json',JSON.stringify(results,null,2))
  if(results.some(x=>x.errors.length||x.trials.length!==2))process.exitCode=2
}catch(err){
  console.error('BEACON_FIRST_TRIGGER_AB_FAILED',String(err))
  process.exitCode=3
}finally{await browser.close()}
