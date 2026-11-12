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
    page.on('pageerror',e=>{
      errors.push(e.message)
      console.error('BEACON_PAGE_ERROR',e.message)
    })
    const stable=mode.includes('stable')
    const warm=mode.includes('warm')
    const query='?beaconProfile=1'+(stable?'&beaconStableLights=1':'')+
      (warm?'&beaconGpuPrewarm=1':'')+
      (mode.includes('no-panel')?'&beaconDiagNoPanel=1':'')+
      (mode.includes('no-social')?'&beaconDiagNoSocial=1':'')
    await page.goto('http://127.0.0.1:4173/'+query+'#at=-22,40,180,0&autostart&skip',
      {waitUntil:'domcontentloaded',timeout:120000})
    await page.waitForFunction(async()=>{
      const {useStore}=await import('orbita/store')
      return !!window.__orbitaBeaconTestTrigger&&useStore.getState().ready&&
        useStore.getState().phase==='playing'
    },null,{timeout:100000})
    // WebGL contexts cannot be recovered with a different contextType
    // (canvas.getContext('webgl2') is null if R3F created 'webgl'). Read the
    // ACTUAL renderer context, published by the instrumented Beacon.
    const audit=await page.evaluate(()=>({
      backend:window.__orbitaBeaconBackend??null,
      trigger:typeof window.__orbitaBeaconTestTrigger,
      canvasCount:document.querySelectorAll('canvas').length,
      mode:location.search,
    }))
    let cdpGpu=null
    try{
      const client=await browser.newBrowserCDPSession()
      const info=await client.send('SystemInfo.getInfo')
      cdpGpu={
        devices:info.gpu?.devices?.map(d=>({
          vendor:d.vendorString,device:d.deviceString
        })),
        glRenderer:info.gpu?.auxAttributes?.glRenderer??null,
        glVersion:info.gpu?.auxAttributes?.glVersion??null,
      }
      await client.detach()
    }catch(e){cdpGpu={error:String(e)}}
    const gpu=String(audit.backend??cdpGpu?.glRenderer??'unverified')
    const nativeVerified=/Metal/i.test(gpu)
    const softwareVerified=/SwiftShader|Software|llvmpipe/i.test(gpu)
    console.log('BEACON_GPU_AUDIT '+JSON.stringify({
      mode,audit,cdpGpu,gpu,nativeVerified,softwareVerified,errors
    }).slice(0,2600))
    // Continue gathering actual real-trigger evidence even when Chromium
    // hides the debug extension. Never label a GPU run as Metal unless
    // its identity can be independently established.
    // The warm trial is only valid when the original geometry has actually
    // reached the GPU. Refuse to mislabel a mid-warm click as a prewarmed one.
    let beforeIdle=null
    if(warm){
      // A busy virtual GPU is an experimental *outcome*, not a reason to
      // stall the whole benchmark until GitHub Actions times out.
      const ended=await page.waitForFunction(()=>{
        const w=window.__orbitaBeaconGpuPrewarm
        return ['ready','submitted-no-gpu-fence','rejected-idle-frame-stall',
          'skipped-busy-renderer','failed','failed-fence','cancelled'].includes(w?.status)
      },null,{timeout:30000,polling:300}).then(()=>true,()=>false)
      beforeIdle=await page.evaluate(()=>{
        const w=window.__orbitaBeaconGpuPrewarm
        return w?{...w}:{status:'not-started'}
      })
      if(!ended)beforeIdle.status='incomplete-after-30s'
    }
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
    const record={mode,backend:gpu,cdpGpu,
      backendVerified:native?nativeVerified:softwareVerified,
      beforeIdle,trials,errors}
    results.push(record)
    console.log('BEACON_FIRST_TRIGGER_AB '+JSON.stringify(record))
    await context.close()
  }
  writeFileSync('browser-evidence/beacon/ab-results.json',JSON.stringify(results,null,2))
  if(results.some(x=>x.errors.length||x.trials.length!==2||
    (native&&!x.backendVerified)))process.exitCode=2
}catch(err){
  console.error('BEACON_FIRST_TRIGGER_AB_FAILED',String(err))
  process.exitCode=3
}finally{await browser.close()}
