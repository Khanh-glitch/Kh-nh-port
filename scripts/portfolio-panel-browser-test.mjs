import {createRequire} from 'node:module'
import {mkdirSync,writeFileSync} from 'node:fs'
const require=createRequire(import.meta.url)
const {chromium}=require('../source/node_modules/playwright')
mkdirSync('browser-evidence/portfolio',{recursive:true})
const native=process.env.PORTFOLIO_BACKEND==='metal'
const browser=await chromium.launch({headless:true,args:native
  ? ['--enable-webgl','--enable-gpu','--ignore-gpu-blocklist','--use-angle=metal','--disable-software-rasterizer']
  : ['--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
    '--enable-unsafe-swiftshader','--ignore-gpu-blocklist']})
const suites=[
 {width:1280,height:720,tag:'desktop'},
 {width:390,height:844,tag:'mobile'},
 {width:1920,height:1080,tag:'wide'}
]
// A real pointer click through the browser input pipeline. Unlike
// locator.click(), it does not depend on Playwright's actionability/layout
// heuristics during three.js background shader compilation. This still
// requires the target to be under the pointer and its onClick to run.
async function pointerClick(page,locator,label){
  // On 390px phones the second tab is legitimately offscreen in an
  // overflow-x:auto scroller. Reveal it as a visitor would before tapping.
  await locator.evaluate(el=>el.scrollIntoView({
    behavior:'instant',block:'nearest',inline:'center'
  }))
  const hit=await locator.evaluate(el=>{
    const r=el.getBoundingClientRect()
    const x=r.x+r.width/2,y=r.y+r.height/2
    const top=document.elementFromPoint(x,y)
    return {x,y,w:r.width,h:r.height,hit:top===el||el.contains(top),
      html:top?.outerHTML?.slice(0,140),viewport:[innerWidth,innerHeight]}
  },{timeout:10000})
  if(!hit.hit||hit.w<8||hit.h<8)
    throw Error('Pointer target occluded '+label+': '+JSON.stringify(hit))
  await page.mouse.click(hit.x,hit.y,{delay:35})
}
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
    console.log('PORTFOLIO_PANEL_AUDIT '+JSON.stringify({suite:suite.tag,backend:native?'Metal':'SwiftShader',id,info}))
    const tabs=root.locator('[role="tab"]')
    if(info.tabs>=2){
      await pointerClick(page,tabs.nth(1),id+' tab 2')
      const second=await root.locator('[role="tab"][aria-selected="true"]').textContent()
      if(!second?.includes('02'))
        throw Error('Second project did not activate: '+id)
    }
    if(native && ['products','vng','robot','cinema','rubik','beacon'].includes(id)&&
       suite.tag!=='wide')
      await page.screenshot({path:'browser-evidence/portfolio/'+suite.tag+'-'+id+'.png',timeout:45000})
    // Native CDP pointer click rather than Playwright's actionability wait:
    // the 3D scene can keep the browser busy even when the button is visible.
    // This still tests the real DOM pointer/click path, NOT a state mutation.
    try {
      const button=await root.getByRole('button',{name:'Đóng hồ sơ dự án'}).evaluate(el=>{
        const rect=el.getBoundingClientRect()
        const x=rect.x+rect.width/2, y=rect.y+rect.height/2
        const hit=document.elementFromPoint(x,y)
        return {x,y,hitIsButton:hit===el||el.contains(hit),w:rect.width,h:rect.height}
      },{timeout:7000})
      if(!button.hitIsButton||button.w<16||button.h<16)
        throw Error('Close button not directly hit-testable: '+JSON.stringify(button))
      await page.mouse.click(button.x,button.y,{delay:45})
    } catch(error) {
      const state=await page.evaluate(id=>{
        const modal=document.querySelector('[data-project-dossier="'+id+'"] aside')
        const button=modal?.querySelector('header button')
        const box=button?.getBoundingClientRect()
        return {id,box:box?.toJSON(),
          hit:box?document.elementFromPoint(box.x+box.width/2,box.y+box.height/2)?.outerHTML?.slice(0,200):null,
          panel:document.querySelector('[data-project-dossier]')?.getAttribute('data-project-dossier')??null}
      },id).catch(e=>({id,error:String(e)}))
      console.error('PORTFOLIO_POINTER_CLOSE_FAILED '+JSON.stringify({suite:suite.tag,id,state,error:String(error)}))
      await page.screenshot({path:'browser-evidence/portfolio/'+suite.tag+'-'+id+'-POINTER-FAILED.png',timeout:30000}).catch(()=>{})
      throw error
    }
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
  // First case is a PRIVATE source repo (EventFlow Pro) and must NEVER
  // have a public GitHub CTA. Select public ORBITA for the real link check.
  const privateLinks=await page.locator('[data-project-dossier="products"] a[href*="eventflow-pro"]').count()
  if(privateLinks)throw Error('Private EventFlow repository exposed to recruiter')
  await pointerClick(page,page.locator('[data-project-dossier="products"] [role="tab"]').nth(2),'products public-source tab')
  const links=await page.locator('[data-project-dossier="products"] a[href^="https://github.com/"]').count()
  if(links<1)throw Error('Public ORBITA evidence CTA missing after tab selection')
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
