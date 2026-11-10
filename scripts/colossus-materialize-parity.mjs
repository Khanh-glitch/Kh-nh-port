import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
const require=createRequire(import.meta.url)
const {chromium}=require('../source/node_modules/playwright')
mkdirSync('browser-evidence',{recursive:true})
const browser=await chromium.launch({
 headless:true,
 args:['--enable-webgl','--enable-gpu','--ignore-gpu-blocklist','--use-angle=metal','--disable-software-rasterizer']
})
const base='http://127.0.0.1:5173/tests/materialize-parity-fixture.html'
const variants=[
 {name:'legacy',url:base,key:'orbita-materialize-shared-v1'},
 {name:'early',url:base+'?colossusEarlyDiscardProbe=on',key:'orbita-materialize-early-reject-v2'},
 {name:'fast',url:base+'?colossusEarlyDiscardProbe=fast',key:'orbita-materialize-fast-bound-v3'},
]
const problems=[]
const stages=[0,0.1,0.25,0.5,0.75,1]
const stagesReport=[]
try{
 for(const v of variants){
  v.page=await browser.newPage({viewport:{width:480,height:360},deviceScaleFactor:1})
  v.page.on('pageerror',e=>problems.push(v.name+':'+e.message))
  await v.page.goto(v.url,{waitUntil:'domcontentloaded',timeout:120000})
  await v.page.waitForFunction(()=>window.__materializeParityReady===true,null,{timeout:90000})
  v.keys=await v.page.evaluate(()=>window.__materializeShaderKeys)
  v.backend=await v.page.evaluate(()=>window.__materializeBackend)
  if(v.keys.some(key=>key!==v.key))throw Error('GLSL variant wrong '+v.name+' '+JSON.stringify(v.keys))
  if(!/Metal/.test(String(v.backend))||/SwiftShader/.test(String(v.backend)))throw Error('Not Metal: '+v.backend)
 }
 for(const pct of stages){
  const samples=[]
  for(const v of variants)samples.push(await v.page.evaluate(pct=>window.__captureMaterializeParity(pct),pct))
  const raw=samples.map(x=>Buffer.from(x.rgba,'base64'))
  const reference=raw[0]
  for(let j=1;j<variants.length;j++){
   if(raw[j].length!==reference.length)throw Error('RGBA data lengths mismatch')
   let diffPixels=0,maxChannelDiff=0,diffChannels=0
   for(let i=0;i<reference.length;i+=4){
    let worst=0
    for(let c=0;c<4;c++){
     const diff=Math.abs(reference[i+c]-raw[j][i+c])
     maxChannelDiff=Math.max(maxChannelDiff,diff)
     if(diff>0)diffChannels++
     worst=Math.max(worst,diff)
    }
    if(worst>0)diffPixels++
   }
   stagesReport.push({variant:variants[j].name,scanPct:pct,
     comparedPixels:reference.length/4,mismatchedPixels:diffPixels,
     maxChannelDiff,diffChannels})
  }
 }
 for(const v of variants){
  await v.page.evaluate(()=>window.__captureMaterializeParity(0.5))
  await v.page.screenshot({path:'browser-evidence/materialize-'+v.name+'-50.png'})
 }
 const accepted=problems.length===0&&stagesReport.every(r=>r.mismatchedPixels===0)
 const report={
  sha:process.env.GITHUB_SHA,
  variants:variants.map(({name,keys,backend})=>({name,keys,backend})),
  stages:stagesReport,errors:problems,
  verdict:accepted?'PIXEL_EXACT_SHADER_FIXTURE_PASS':'SHADER_FIXTURE_PIXEL_MISMATCH',
  caveat:'Isolated 480x360 mapped/unmapped Standard/Basic shader fixture on Apple Paravirtual Metal. Six scan progress stages per alternative. Exact pixels here do not certify the full live 3D scene or real physical GPU.'
 }
 console.log('MATERIALIZE_SHADER_PARITY '+JSON.stringify(report))
 writeFileSync('browser-evidence/materialize-shader-parity.json',JSON.stringify(report,null,2))
 if(!accepted)process.exitCode=12
}catch(e){console.error('MATERIALIZE_PARITY_BLOCKED',String(e));process.exitCode=4}
finally{await browser.close()}
