import {readFileSync} from 'node:fs'
const html=readFileSync('index.html','utf8')
const terms=[
  'Đang tạo Canvas','Đã tải mã ứng dụng','khởi tạo scene 3D',
  'ORBITA','loading-screen','loading-overlay','loading-text',
  'loader-overlay','boot-overlay','loadingStage','canvas-status',
  '<body','id="root"','orbita-embedded-map'
]
const left=700,right=950
const reports=[]
for(const term of terms){
  const ids=[]
  let at=-1
  while((at=html.indexOf(term,at+1))>=0 && ids.length<6)
    ids.push(at)
  reports.push({term,indices:ids,excerpts:ids.map(i=>
    html.slice(Math.max(0,i-left),Math.min(html.length,i+right))
      .replace(/data:[^"'<> ]{100,}/g,'<HUGE_DATA_URI_REMOVED>')
      .slice(0,1850))})
}
console.log('ENTRY_ROOT_LOADER_INVENTORY '+JSON.stringify({
  length:html.length,
  terms:reports,
  tail:html.slice(-3400).replace(/data:[^"'<> ]{100,}/g,'<DATA_URI>')
}).slice(0,29000))
