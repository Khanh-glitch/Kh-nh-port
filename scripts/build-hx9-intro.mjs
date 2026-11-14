import {readFileSync, writeFileSync} from 'node:fs'
import {createRequire} from 'node:module'
const require = createRequire(new URL('../source/package.json', import.meta.url))
const esbuild = require('esbuild')
const root = new URL('../', import.meta.url)
await esbuild.build({absWorkingDir:root.pathname, entryPoints:['source/src/intro-hx9/entry.ts'], bundle:true, format:'esm', minify:true, outfile:'assets/immersive/hx9.js', plugins:[{name:'shared-three',setup(build){build.onResolve({filter:/^three$/},()=>({path:'three',external:true}))}}]})
const path = new URL('assets/immersive/index.html', root)
let html = readFileSync(path,'utf8')
html = html.replace(/<script type="importmap">([\s\S]*?)<\/script>/, (_, text) => {
  const map = JSON.parse(text)
  for (const [name,file] of [['ship/App','App.js'],['ship/components/SpaceScene','SpaceScene.js']])
    map.imports[name] = 'data:text/javascript;base64,' + readFileSync(new URL('assets/immersive/src/'+file,root)).toString('base64')
  map.imports['ship/hx9'] = './hx9.js'
  for (const spec of ['three/examples/jsm/geometries/RoundedBoxGeometry.js','three/examples/jsm/utils/BufferGeometryUtils.js'])
    map.imports[spec] = 'https://esm.sh/three@0.187.0/' + spec.slice('three/'.length) + '?external=three'
  return '<script type="importmap">'+JSON.stringify(map)+'</script>'
})
const css = `<style id="orbita-hx9-ui">.hx9-status{position:absolute;bottom:7%;left:5%;z-index:5;max-width:min(440px,90vw);padding:22px 26px;color:#e8f7ff;background:linear-gradient(110deg,rgba(2,12,23,.86),rgba(3,20,30,.48));border-left:2px solid #8cecff;font-family:system-ui,sans-serif;letter-spacing:.02em;text-shadow:0 2px 12px #000}.hx9-eyebrow{font-size:11px;letter-spacing:.24em;color:#91e8ff}.hx9-title{font-size:clamp(19px,2vw,28px);font-weight:600;margin:9px 0}.hx9-copy{font-size:13px;min-height:2.5em;color:#c5dce8}.hx9-line{height:1px;background:#437382;margin:12px 0}.hx9-line span{display:block;width:35%;height:1px;background:#a6f4ff;animation:hx9scan 2s ease-in-out infinite alternate}@keyframes hx9scan{to{transform:translateX(185%)}}.hx9-enter{background:#b7efff;color:#06131c;border:0;border-radius:3px;padding:11px 20px;font-size:11px;letter-spacing:.16em;font-weight:700;cursor:pointer}.hx9-enter:disabled{background:#243a46;color:#a2bdca;cursor:wait}@media(prefers-reduced-motion:reduce){.hx9-line span{animation:none}}</style>`
html = html.replace(/<style id="orbita-hx9-ui">[\s\S]*?<\/style>/,'')
html = html.replace('</head>',css+'</head>')
writeFileSync(path,html)
