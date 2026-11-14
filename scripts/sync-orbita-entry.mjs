/** Update only the two entry/handoff modules without touching architecture modules. */
import {readFileSync, writeFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {dirname,relative,resolve} from 'node:path'
const ts=createRequire(import.meta.url)('../source/node_modules/typescript')
const root=resolve(import.meta.dirname,'..'), src=resolve(root,'source/src')
const path=resolve(root,'index.html'), html=readFileSync(path,'utf8')
const tag='<script id="orbita-embedded-map" type="application/json">'
const start=html.indexOf(tag), end=html.indexOf('</script>',start+tag.length)
if(start<0||end<0)throw Error('Standalone module map missing')
const map=JSON.parse(html.slice(start+tag.length,end))
for(const name of ['scene/Experience','ui/Overlay']){
 const file=resolve(src,name+'.tsx'), id='orbita/'+name
 if(!(id in map))throw Error('Missing '+id)
 const result=ts.transpileModule(readFileSync(file,'utf8'),{fileName:file,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,removeComments:false}})
 const errors=(result.diagnostics??[]).filter(d=>d.category===ts.DiagnosticCategory.Error)
 if(errors.length)throw Error(ts.formatDiagnostics(errors,{getCurrentDirectory:()=>root,getCanonicalFileName:x=>x,getNewLine:()=> '\n'}))
 const js=result.outputText.replace(/(\bfrom\s*['"])(\.{1,2}\/[^'"]+)(['"])/g,(_all,pre,spec,post)=>{
  const target='orbita/'+relative(src,resolve(dirname(file),spec)).replace(/\\/g,'/').replace(/\.(tsx?|jsx?)$/,'')
  if(!(target in map))throw Error(id+': missing import '+target)
  return pre+target+post
 })
 map[id]='data:text/javascript;base64,'+Buffer.from(js).toString('base64')
}
writeFileSync(path,html.slice(0,start+tag.length)+JSON.stringify(map)+html.slice(end))
console.log('ORBITA_ENTRY_MODULES_SYNCED')
