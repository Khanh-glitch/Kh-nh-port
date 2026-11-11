/**
 * Keep the REAL published root index.html byte-synchronized with changed HEX
 * source modules. Never ship only source/src edits: Cloudflare serves root HTML.
 * Does not alter the module count, visuals, public media or unrelated exhibits.
 */
import {readFileSync,writeFileSync} from 'node:fs'
import {dirname,relative,resolve} from 'node:path'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url)
const ts=require('../source/node_modules/typescript')
const root=resolve(import.meta.dirname,'..')
const src=resolve(root,'source/src')
const path=resolve(root,'index.html')
const html=readFileSync(path,'utf8')
const tag='<script id="orbita-embedded-map" type="application/json">'
const start=html.indexOf(tag)
const end=start<0?-1:html.indexOf('</script>',start+tag.length)
if(start<0||end<0)throw Error('HEX sync: standalone import map not found')
const a=start+tag.length
const map=JSON.parse(html.slice(a,end))
const keys=Object.keys(map)
const targets=['reality/RealityHost','reality/Front','reality/mask','reality/kit','store']
for(const f of targets){
 const extension = f==='reality/mask' || f==='store' ? '.ts' : '.tsx'
 const source=readFileSync(resolve(src,f+extension),'utf8')
 const tx=ts.transpileModule(source,{fileName:f+extension,reportDiagnostics:true,
  compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,
   module:ts.ModuleKind.ESNext,removeComments:false}})
 const errors=(tx.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error)
 if(errors.length)throw Error('HEX sync TS diagnostics: '+f+' '+errors.map(e=>e.messageText).join(' | '))
 const js=tx.outputText.replace(/(\bfrom\s*['"])(\.{1,2}\/[^'"]+)(['"])/g,(_all,pre,spec,post)=>{
  const dest=resolve(src,dirname(f+extension),spec)
  const rel=relative(src,dest).replace(/\\/g,'/')
  if(rel.startsWith('..'))throw Error('HEX sync: import escapes source '+spec)
  const id='orbita/'+rel.replace(/\.(tsx?|jsx?)$/,'')
  if(!(id in map))throw Error('HEX sync: missing embedded import '+id)
  return pre+id+post
 })
 if(/\bfrom\s*['"]\.{1,2}\//.test(js))throw Error('HEX sync: unresolved relative imports '+f)
 const id='orbita/'+f
 if(!(id in map))throw Error('HEX sync: missing target '+id)
 map[id]='data:text/javascript;base64,'+Buffer.from(js,'utf8').toString('base64')
}
if(keys.length!==Object.keys(map).length||keys.some(x=>!(x in map)))throw Error('HEX sync: module map keys changed')
const updated=html.slice(0,a)+JSON.stringify(map)+html.slice(end)
if(html!==updated){writeFileSync(path,updated);console.log('HEX_SYNC_UPDATED_ORBITA_STANDALONE')}
else console.log('HEX_SYNC_ALREADY_CURRENT')
