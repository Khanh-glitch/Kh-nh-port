import {createRequire} from 'node:module'
import {mkdirSync,writeFileSync} from 'node:fs'
const require=createRequire(import.meta.url)
const {chromium}=require('../candidate/source/node_modules/playwright')
mkdirSync('hex-visual-frames',{recursive:true})
const browser=await chromium.launch({headless:true,args:[
 '--enable-webgl','--enable-gpu','--ignore-gpu-blocklist',
 '--use-angle=metal','--disable-software-rasterizer'
]})
const report=[]
for(const [name,port] of [['main-4454511',4173],['hex-candidate',4174]]){
 const context=await browser.newContext({
  viewport:{width:1280,height:720},deviceScaleFactor:1,reducedMotion:'no-preference'
 })
 const page=await context.newPage(),r={name,frames:[],errors:[],network:[]}
 page.on('pageerror',e=>r.errors.push(e.message))
 page.on('requestfailed',e=>r.network.push(e.url().slice(0,150)))
 report.push(r)
 try{
  await page.goto('http://127.0.0.1:'+port+'/#at=-26,20,0,0&autostart&skip',
   {waitUntil:'domcontentloaded',timeout:120000})
  await page.waitForFunction(async()=>{
   const {useStore}=await import('orbita/store')
   return useStore.getState().phase==='playing'&&useStore.getState().ready
  },null,{timeout:120000})
  await page.waitForTimeout(2500)
  const snap=async(label)=>{
   await page.screenshot({path:'hex-visual-frames/'+name+'-'+label+'.png',timeout:120000})
   const state=await page.evaluate(()=>{
    const R=window.__orbitaReality
    const gl=document.querySelector('canvas')?.getContext('webgl2')
    return {phase:R?.useReality.getState().phase,
     track:R?.useReality.getState().track,
     front:R?.rt.front,
     debugFront:R?.rt.dbg,
     contextLost:gl?.isContextLost(),
     shaderPrep:window.__orbitaHexShaderPrep??null,
     cull:window.__orbitaHexCullStats??null}
   })
   r.frames.push({label,...state})
  }
  await snap('00-idle')
  await page.evaluate(()=>window.__orbitaReality.requestReality('mua-ha'))
  await page.waitForFunction(()=>window.__orbitaReality?.useReality.getState().phase==='sweep',null,{timeout:120000})
  for(const [label,front] of [['01-front-12',12],['02-front-60',60],['03-front-160',160],['04-front-260',260],['05-front-330',330]]){
   await page.evaluate(front=>{window.__orbitaReality.rt.dbg=front},front)
   await page.waitForTimeout(1300)
   await snap(label)
  }
  await page.evaluate(()=>window.__orbitaReality.requestReality('ngay-mai'))
  await page.waitForTimeout(2500)
  await snap('06-after-track-switch')
  await page.evaluate(()=>{
   window.__orbitaReality.rt.dbg=null
   window.__orbitaReality.dismissReality()
  })
  await page.waitForFunction(()=>window.__orbitaReality?.useReality.getState().phase==='idle',null,{timeout:120000})
  await page.waitForTimeout(1000)
  await snap('07-after-retract')
 }catch(e){r.error=String(e)}
 await context.close()
 writeFileSync('hex-visual-frames/report.json',JSON.stringify(report,null,2))
 console.log('HEX_VISUAL_PARITY '+JSON.stringify({name:r.name,frames:r.frames.map(x=>({label:x.label,phase:x.phase,front:x.front,cull:x.cull})),error:r.error,errors:r.errors}))
}
await browser.close()
if(report.some(r=>r.error||r.errors.length||r.network.length||r.frames.some(f=>f.contextLost)))process.exitCode=5
