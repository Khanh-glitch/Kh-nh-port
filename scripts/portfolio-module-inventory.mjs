import {readFileSync} from 'node:fs'
const tags=[
  {name:'island',path:'index.html',marker:'<script id="orbita-embedded-map" type="application/json">',end:'</script>'},
  {name:'ship',path:'assets/immersive/index.html',marker:'<script type="importmap">',end:'</script>'},
]
for(const info of tags){
 const html=readFileSync(info.path,'utf8')
 const start=html.indexOf(info.marker)
 const end=html.indexOf(info.end,start+info.marker.length)
 if(start<0||end<0)throw Error(info.name+' import map not found')
 const parsed=JSON.parse(html.slice(start+info.marker.length,end))
 const map=info.name==='ship'?parsed.imports:parsed
 const interesting=Object.entries(map).filter(([k])=>
   /content|ui\/Overlay|scene\/Products|scene\/VngGallery|data\/profile|pilot|ship\/App/.test(k))
 const entries=interesting.map(([key,value])=>{
  const js=value.startsWith('data:text/javascript;base64,')
   ?Buffer.from(value.split(',')[1],'base64').toString('utf8'):'NON_DATA_URI'
  return {key,len:js.length,head:js.slice(0,1800),
    end:js.slice(-300),remoteImports:[...js.matchAll(/from\s+["']([^"']+)/g)].map(x=>x[1]).slice(0,14)}
 })
 console.log('PORTFOLIO_EMBEDDED_INVENTORY '+JSON.stringify({
  name:info.name,sourceFile:info.path,mapCount:Object.keys(map).length,
  entries,
 }).slice(0,17000))
}
