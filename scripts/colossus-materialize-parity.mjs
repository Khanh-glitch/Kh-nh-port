import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
const require=createRequire(import.meta.url)
const {chromium}=require('../source/node_modules/playwright')
mkdirSync('browser-evidence',{recursive:true})
const browser=await chromium.launch({
 headless:true,
 args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']
})
const base='http://127.0.0.1:5173/tests/materialize-parity-fixture.html'
const legacy=await browser.newPage({viewport:{width:480,height:360},deviceScaleFactor:1})
const early=await browser.newPage({viewport:{width:480,height:360},deviceScaleFactor:1})
const problems=[]
for(const [page,name] of [[legacy,'legacy'],[early,'early']])page.on('pageerror',e=>problems.push(name+':'+e.message))
const stages=[0,0.1,0.25,0.5,0.75,1]
const stagesReport=[]
try{
 await legacy.goto(base,{waitUntil:'domcontentloaded',timeout:120000})
 await early.goto(base+'?colossusEarlyDiscardProbe=on',{waitUntil:'domcontentloaded',timeout:120000})
 await Promise.all([legacy,early].map(p=>p.waitForFunction(()=>window.__materializeParityReady===true,null,{timeout:90000})))
 const keys=await Promise.all([legacy,early].map(p=>p.evaluate(()=>window.__materializeShaderKeys)))
 if(keys[0].some(k=>k!=='orbita-materialize-shared-v1')||keys[1].some(k=>k!=='orbita-materialize-early-reject-v2'))throw Error('GLSL variants not isolated: '+JSON.stringify(keys))
 for(const pct of stages){
  const [old,nw]=await Promise.all([legacy,early].map(p=>p.evaluate(pct=>window.__captureMaterializeParity(pct),pct)))
  if(old.width!==nw.width||old.height!==nw.height)throw Error('Fixture dimension changed')
  const aa=Buffer.from(old.rgba,'base64'),bb=Buffer.from(nw.rgba,'base64')
  if(aa.length!==bb.length)throw Error('Encoded RGBA mismatch')
  let mismatched=0,maxChannelDiff=0,changedChannels=0
  for(let i=0;i<aa.length;i+=4){
   let pixelDiff=0
   for(let ch=0;ch<4;ch++){
    const delta=Math.abs(aa[i+ch]-bb[i+ch])
    maxChannelDiff=Math.max(maxChannelDiff,delta)
    if(delta>0){changedChannels++;pixelDiff=Math.max(pixelDiff,delta)}
   }
   if(pixelDiff>0)mismatched++
  }
  stagesReport.push({scanPct:pct,width:old.width,height:old.height,
   mismatchedPixels:mismatched,maxChannelDiff,changedChannels,
   totalPixels:old.width*old.height})
 }
 await legacy.evaluate(()=>window.__captureMaterializeParity(0.5))
 await early.evaluate(()=>window.__captureMaterializeParity(0.5))
 await legacy.screenshot({path:'browser-evidence/materialize-legacy-50.png'})
 await early.screenshot({path:'browser-evidence/materialize-early-50.png'})
 const accepted=problems.length===0&&stagesReport.every(s=>s.mismatchedPixels===0)
 const report={sha:process.env.GITHUB_SHA,backend:'SwiftShader test fixture (not final real-scene parity)',
  keys,stages:stagesReport,errors:problems,
  verdict:accepted?'PIXEL_EXACT_SHADER_FIXTURE_PASS':'SHADER_FIXTURE_PIXEL_MISMATCH',
  caveat:'This isolated shader fixture includes mapped/unmapped PBR+Basic, alpha test, lighting and shadow. It is not a complete rendered-portfiolio screenshot or physical Metal-GPU proof.'}
 console.log('MATERIALIZE_SHADER_PARITY '+JSON.stringify(report))
 writeFileSync('browser-evidence/materialize-shader-parity.json',JSON.stringify(report,null,2))
 if(!accepted)process.exitCode=12
}catch(e){console.error('MATERIALIZE_PARITY_BLOCKED',String(e));process.exitCode=4
}finally{await browser.close()}
