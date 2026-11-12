import {createRequire} from 'node:module'
import {mkdirSync,writeFileSync} from 'node:fs'
const require=createRequire(import.meta.url)
const {chromium}=require('../source/node_modules/playwright')
mkdirSync('browser-evidence/portfolio',{recursive:true})
const browser=await chromium.launch({headless:true,args:[
  '--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
  '--enable-unsafe-swiftshader','--ignore-gpu-blocklist',
]})
const suites=[
 {width:1280,height:720,tag:'desktop'},
 {width:390,height:844,tag:'mobile'},
 {width:1920,height:1080,tag:'wide'}
]
const all=[]
const ids=['about','orb','piano','rubik','robot','apex','ragnarok',
  'cinema','stage','products','beacon','vng']
try{
 for(const suite of suites){
  const page=await browser.newPage({
   viewport:{width:suite.width,height:suite.height},deviceScaleFactor:1,
  })
  const errors=[]
  page.on('pageerror',e=>errors.push(String(e)))
  await page.goto('http://127.0.0.1:4173/#at=0,43,0,0&autostart&skip',
    {waitUntil:'domcontentloaded',timeout:120000})
  await page.waitForFunction(async()=>{
    const {useStore}=await import('orbita/store')
    return useStore.getState().phase==='playing' &&
      useStore.getState().ready &&
      document.querySelectorAll('iframe[title*="spaceship cockpit"]').length===0 &&
      document.querySelectorAll('#root canvas').length>0
  },null,{timeout:110000,polling:400})
  const out={viewport:suite,panels:[],errors}
  for(const id of ids){
    await page.evaluate(async id=>{
      const {useStore}=await import('orbita/store')
      useStore.getState().openPanel(id)
    },id)
    const root=page.locator('[data-project-dossier="'+id+'"]')
    await root.waitFor({state:'visible',timeout:12000})
    const info=await page.evaluate(id=>{
      const el=document.querySelector('[data-project-dossier="'+id+'"]')
      const modal=el?.querySelector('aside')
      const title=el?.querySelector('h2')
      const tabs=el?.querySelectorAll('[role="tab"]')??[]
      const rect=modal?.getBoundingClientRect()
      return {id,title:title?.textContent??'',
       tabs:tabs.length,dialog:modal?.getAttribute('role'),
       insideViewport:!!rect&&rect.left>=-1&&rect.right<=innerWidth+1&&
         rect.top>=-1&&rect.bottom<=innerHeight+1,
       horizontalOverflow:document.documentElement.scrollWidth>innerWidth+1,
       selected:el?.querySelector('[role="tab"][aria-selected="true"]')?.textContent??'',
       headingCount:el?.querySelectorAll('h2').length??0}
    },id)
    if(!info.insideViewport||info.horizontalOverflow||info.tabs<1||
       info.dialog!=='dialog'||!info.title)
      throw Error('Panel clipped or not truly interactive: '+JSON.stringify(info))
    const tabs=root.locator('[role="tab"]')
    if(info.tabs>=2){
      await tabs.nth(1).click()
      const second=await root.locator('[role="tab"][aria-selected="true"]').textContent()
      if(!second?.includes('02'))
        throw Error('Second project did not activate: '+id)
    }
    if(['products','vng','robot','cinema','rubik','beacon'].includes(id)&&
       suite.tag!=='wide')
      await page.screenshot({path:'browser-evidence/portfolio/'+suite.tag+'-'+id+'.png',timeout:45000})
    await root.getByRole('button',{name:'Đóng hồ sơ dự án'}).click()
    await root.waitFor({state:'detached',timeout:10000})
    out.panels.push(info)
  }
  // Reopen a panel to prove stale selection and overlay state do not leak.
  await page.evaluate(async()=>{
    const {useStore}=await import('orbita/store')
    useStore.getState().openPanel('products')
  })
  await page.waitForSelector('[data-project-dossier="products"]')
  const reset=await page.locator('[data-project-dossier="products"] [role="tab"][aria-selected="true"]').textContent()
  if(!reset?.includes('01'))throw Error('Product selection leaked across close/reopen: '+reset)
  out.reopenReset=true
  const links=await page.locator('[data-project-dossier="products"] a[href^="https://github.com/"]').count()
  if(links<1)throw Error('Verified project evidence CTA missing from product dossier')
  out.verifiedLinks=links
  if(errors.length)throw Error('Page errors: '+errors.join(';'))
  console.log('PORTFOLIO_PANEL_BROWSER_ACCEPTANCE '+JSON.stringify(out))
  all.push(out)
  await page.close()
 }
}catch(err){
  console.error('PORTFOLIO_PANEL_BROWSER_FAILED '+String(err))
  process.exitCode=2
}finally{
 writeFileSync('browser-evidence/portfolio/report.json',JSON.stringify(all,null,2))
 await browser.close()
}
