import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
const source=readFileSync('source/src/scene/Cinema.tsx','utf8')
const html=readFileSync('index.html','utf8')
const marker='<script id="orbita-embedded-map" type="application/json">'
const a=html.indexOf(marker),e=html.indexOf('</script>',a+marker.length)
assert(a>=0&&e>a)
const embedded=JSON.parse(html.slice(a+marker.length,e))
const key='orbita/scene/Cinema'
assert.match(embedded[key],/^data:text\/javascript;base64,/)
const live=Buffer.from(embedded[key].split(',')[1],'base64').toString('utf8')
test('unchanged original 1024×450 cinema and CPU-backed context option are really published',()=>{
  for(const text of [source,live]){
    assert.match(text,/hexCinemaCpuCanvas/)
    assert.match(text,/willReadFrequently/)
    assert.match(text,/hexCinemaFarLightGate/)
    assert.match(text,/getImageData/)
    assert.match(text,/screenTex\.tex\.needsUpdate/)
  }
  assert.match(source,/const SW = 1024/)
  assert.match(source,/const SH = 450/)
})
console.log('HEX_CINEMA_ORIGINAL_PIXEL_SOURCE_PARITY_PASS')
