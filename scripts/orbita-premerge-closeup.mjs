import {createRequire} from 'node:module'
import {mkdirSync,writeFileSync} from 'node:fs'
const require=createRequire(import.meta.url)
const {chromium}=require('../candidate/source/node_modules/playwright')
mkdirSync('closeup-evidence',{recursive:true})
const b=await chromium.launch({headless:true,args:['--enable-webgl','--enable-gpu','--ignore-gpu-blocklist','--use-angle=metal','--disable-software-rasterizer']})
const reports=[]
async function teleport(page,x,z,yaw=0,pitch=0) {
 await page.evaluate(async({x,z,yaw,pitch})=>{
  const {player}=await import('orbita/world')
  const {useStore}=await import('orbita/store')
  player.pos.set(x,1.7,z);player.yaw=yaw;player.pitch=pitch
  useStore.getState().setPaused(false);useStore.getState().setFree(true);useStore.getState().openPanel(null)
 },{x,z,yaw,pitch})
 await page.waitForTimeout(800)
}
for(const [name,port] of [['main-8dd5ded',4173],['candidate-4454511',4174]]) {
 const c=await b.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1})
 const p=await c.newPage();p.setDefaultTimeout(30000)
 const report={name,errors:[],images:[],status:'starting'}
 p.on('pageerror',e=>report.errors.push(e.message))
 reports.push(report)
 try {
  await p.goto('http://127.0.0.1:'+port+'/#at=0,-31,0,14&autostart&skip',{waitUntil:'domcontentloaded',timeout:120000})
  await p.waitForFunction(async()=>{
   const {useStore}=await import('orbita/store')
   return useStore.getState().phase==='playing'
  },null,{timeout:120000})
  await p.waitForTimeout(2700)
  const trigger=await p.evaluate(async()=>{
   const {getTargets,getInteractive}=await import('orbita/world')
   const it=getTargets().map(o=>getInteractive(o)).find(x=>x?.id==='console-summon')
   if(!it?.onClick)return false
   it.onClick();return true
  })
  if(!trigger)throw Error('Console summon callback missing')
  await p.waitForTimeout(1500)
  await teleport(p,-8.5,-29,0,-0.11)
  await p.screenshot({path:'closeup-evidence/'+name+'-apex-laser-mid.png',timeout:90000})
  report.images.push('apex-laser-mid')
  await p.waitForTimeout(12500)
  await teleport(p,-8.5,-29,0,-0.11)
  await p.screenshot({path:'closeup-evidence/'+name+'-apex-final.png',timeout:90000})
  report.images.push('apex-final')
  await teleport(p,8.5,-29,0,-0.12)
  await p.screenshot({path:'closeup-evidence/'+name+'-ragnarok-final.png',timeout:90000})
  report.images.push('ragnarok-final')
  report.status='complete'
 }catch(e){report.status='failed';report.error=String(e)}
 await c.close()
 writeFileSync('closeup-evidence/report.json',JSON.stringify(reports,null,2))
}
await b.close()
console.log('CLOSEUP_VISUAL_EVIDENCE '+JSON.stringify(reports))
if(reports.some(r=>r.status!=='complete'||r.errors.length))process.exitCode=6
