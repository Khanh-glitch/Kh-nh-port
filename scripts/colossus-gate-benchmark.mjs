import { createRequire } from 'node:module'
const require=createRequire(import.meta.url)
const { chromium }=require('../source/node_modules/playwright')
const variant=process.env.COL_VARIANT || 'gated'
const site=variant==='baseline'?'https://1cc1b13a.menniverse.pages.dev':'https://f5dacc10.menniverse.pages.dev'
const url=site+'/#at=0,-27,0,20&autostart&skip'
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']})
const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1})
const errors=[]
page.on('pageerror',e=>errors.push(e.message))
try {
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:120000})
  await page.waitForFunction(()=>!!window.__orbitaColossusWarmup,null,{timeout:100000,polling:1000})
  await page.waitForTimeout(6000)
  const metrics=await page.evaluate(async()=>{
    const result={samples:[],warmStatus:window.__orbitaColossusWarmup?.status,started:performance.now(),visible:document.visibilityState,focus:document.hasFocus()}
    await new Promise(resolve=>{
      let last=performance.now(), end=last+6500
      const step=now=>{
        result.samples.push(Math.round(now-last))
        last=now
        if(now>=end || result.samples.length>=400)resolve()
        else requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    })
    return {frames:result.samples.length,worst:Math.max(...result.samples),avg:Math.round(result.samples.reduce((a,b)=>a+b,0)/result.samples.length),longFrames:result.samples.filter(x=>x>=100),warmStatusStart:result.warmStatus,warmStatusEnd:window.__orbitaColossusWarmup?.status,focused:result.focus,visible:result.visible,actualSummon:window.__orbitaColossusProfile||null}
  })
  console.log('[DRAW GATE IDLE]',JSON.stringify({variant,url,metrics,errors}))
  if(errors.length)process.exitCode=2
} catch(e){console.error('Idle baseline error',e);process.exitCode=3}
finally{await browser.close()}
