import {createRequire} from 'node:module'
const {chromium}=createRequire(import.meta.url)('../source/node_modules/playwright')
const variants=[
 ['default',['--enable-webgl','--ignore-gpu-blocklist']],
 ['metal',['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal']],
 ['opengl',['--enable-webgl','--ignore-gpu-blocklist','--use-angle=gl']],
]
for(const [name,args] of variants){
 let browser
 try {
  browser=await chromium.launch({headless:true,args})
  const page=await browser.newPage()
  const gpu=await page.evaluate(()=>{
    const c=document.createElement('canvas'), gl=c.getContext('webgl2')
    if(!gl)return {available:false}
    const debug=gl.getExtension('WEBGL_debug_renderer_info')
    return {available:true,renderer:gl.getParameter(gl.RENDERER),vendor:gl.getParameter(gl.VENDOR),
      unmaskedRenderer:debug&&gl.getParameter(debug.UNMASKED_RENDERER_WEBGL),
      unmaskedVendor:debug&&gl.getParameter(debug.UNMASKED_VENDOR_WEBGL),
      parallelCompile:!!gl.getExtension('KHR_parallel_shader_compile'),
      maxTextureSize:gl.getParameter(gl.MAX_TEXTURE_SIZE)}
  })
  console.log('::notice title=HX9 GPU '+name+'::'+JSON.stringify(gpu))
 } catch(error){console.log('::notice title=HX9 GPU '+name+'::'+JSON.stringify({error:String(error)}))}
 finally{await browser?.close()}
}
