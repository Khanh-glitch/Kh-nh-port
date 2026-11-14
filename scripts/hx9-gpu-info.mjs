import {createRequire} from 'node:module'
const {chromium}=createRequire(import.meta.url)('../source/node_modules/playwright')
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']})
try {
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
 console.log('::notice title=HX9 GPU::'+JSON.stringify(gpu))
}finally{await browser.close()}
