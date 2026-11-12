import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {test} from 'node:test'
const root=readFileSync('index.html','utf8')
const spaceship=readFileSync('assets/immersive/index.html','utf8')
function readMap(html,tag,ship=false){
 const a=html.indexOf(tag),b=html.indexOf('</script>',a+tag.length)
 assert(a>=0&&b>a,'Missing published import map')
 const all=JSON.parse(html.slice(a+tag.length,b))
 return ship?all.imports:all
}
const island=readMap(root,'<script id="orbita-embedded-map" type="application/json">')
const ship=readMap(spaceship,'<script type="importmap">',true)
const freeze=JSON.parse(readFileSync('tests/integration-original-modules.json','utf8'))
const js=(map,id)=>Buffer.from(map[id].split(',')[1],'base64').toString('utf8')
const content=js(island,'orbita/content')
const overlay=js(island,'orbita/ui/Overlay')
const products=js(island,'orbita/scene/Products')
const vng=js(island,'orbita/scene/VngGallery')
const vngSlides=js(island,'orbita/vng/types')
const profile=js(ship,'ship/data/profile')
test('truthful public identity, sources, no invented agency/phone/impact statistics',()=>{
 for(const token of ['LÊ QUỐC KHÁNH','EventFlow Pro','MathPath','APEX CHAOS','Soul of Hero','Quê Quá Quao','VNG Project Gallery'])
  assert.ok(content.includes(token),'Missing real project: '+token)
 for(const token of ['Lâm Anh Khoa','hello@orbita.studio','+84 90 123 4567',
   '1.8M+','38.000','99.99%','Vé xử lý / giờ','Năm kinh nghiệm']){
   assert.ok(!content.includes(token),'Fictitious public claim '+token)
 }
 assert.match(content,/NOT production-ready|CHƯA production-ready|chưa production-ready/)
 assert.match(content,/Khanh-glitch\/eventflow-pro/)
 assert.match(content,/Khanh-glitch\/MathPath/)
 assert.match(content,/Khanh-glitch\/APEX-CHAOS/)
 assert.match(content,/Khanh-glitch\/Soul-of-Hero/)
})
test('actual 5 physical holograms correspond to verified source projects and correct selectable dossier',()=>{
 const expected=['EventFlow Pro','MathPath','ORBITA','Alphabet Engine','APEX CHAOS']
 for(const name of expected) assert.ok(products.includes(name),'Missing hologram name '+name)
 for(const fake of ['TicketFlow','LiveSync','Wayfinder AR','Pulse Poll','CueDeck'])
   assert.ok(!products.includes(fake),'Fictitious product screen still published '+fake)
 assert.match(products,/__orbitaPanelSelection/)
 assert.match(products,/openPanel\(['"]products['"]\)/)
 assert.match(overlay,/__orbitaPanelSelection/)
 assert.match(overlay,/role: "dialog"|role="dialog"/)
 assert.match(overlay,/data-project-dossier/)
 assert.match(root,/id="orbita-project-dossier-css"/)
})
test('source VNG booth has genuine contest dossier entrance, original Main Stage untouched',()=>{
 assert.match(vng,/vng-project-dossier/)
 assert.match(vng,/panel: "vng"|panel="vng"/)
 assert.match(vngSlides,/VNG Competition/)
 assert.ok(!vngSlides.includes('My Work at VNG'),'No unverifiable employer implication')
 for(const id of ['orbita/scene/Stage','orbita/stage/ShowSystem',
   'orbita/stage/shows','orbita/scene/Experience']){
   assert.ok(island[id]?.startsWith('data:text/javascript;base64,'),'Original visual not found '+id)
 }
})
test('public cockpit profile retains original inlined photo and project-only CV summary',()=>{
 assert.match(profile,/^const pilotPhoto = 'data:image\/jpeg;base64,/)
 assert.match(profile,/LÊ QUỐC KHÁNH/)
 assert.match(profile,/EventFlow Pro/)
 assert.match(profile,/MathPath/)
 assert.ok(!profile.includes('DỮ LIỆU MẪU'))
 assert.ok(!profile.includes('Résumé details pending'))
 assert.ok(profile.length>300000,'Original pilot portrait unexpectedly removed')
})
test('all original unmodified 3D modules match frozen release hashes',()=>{
 for(const [id,value] of Object.entries(freeze))
   assert.equal(createHash('sha256').update(island[id]??'').digest('hex'),value,
    'Unexpected mutation of source or original art '+id)
})
console.log('PORTFOLIO_TRUTH_DOSSIERS_FIVE_PRODUCT_SCREENS_AND_SHIP_PARITY_PASS')
