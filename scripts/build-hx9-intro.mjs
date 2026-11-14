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
  for (const [name,file] of [['ship/App','App.js'],['ship/components/SpaceScene','SpaceScene.js'],['ship/portfolioData','portfolioData.js']])
    map.imports[name] = 'data:text/javascript;base64,' + readFileSync(new URL('assets/immersive/src/'+file,root)).toString('base64')
  map.imports['ship/hx9'] = './hx9.js'
  for (const spec of ['three/examples/jsm/geometries/RoundedBoxGeometry.js','three/examples/jsm/utils/BufferGeometryUtils.js'])
    map.imports[spec] = 'https://esm.sh/three@0.187.0/' + spec.slice('three/'.length) + '?external=three'
  return '<script type="importmap">'+JSON.stringify(map)+'</script>'
})
const css = `<style id="orbita-hx9-ui">.hx9-status{position:absolute;bottom:7%;left:5%;z-index:5;max-width:min(440px,90vw);padding:22px 26px;color:#e8f7ff;background:linear-gradient(110deg,rgba(2,12,23,.86),rgba(3,20,30,.48));border-left:2px solid #8cecff;font-family:system-ui,sans-serif;letter-spacing:.02em;text-shadow:0 2px 12px #000}.hx9-eyebrow{font-size:11px;letter-spacing:.24em;color:#91e8ff}.hx9-title{font-size:clamp(19px,2vw,28px);font-weight:600;margin:9px 0}.hx9-copy{font-size:13px;min-height:2.5em;color:#c5dce8}.hx9-line{height:1px;background:#437382;margin:12px 0}.hx9-line span{display:block;width:35%;height:1px;background:#a6f4ff;animation:hx9scan 2s ease-in-out infinite alternate}@keyframes hx9scan{to{transform:translateX(185%)}}.hx9-enter{background:#b7efff;color:#06131c;border:0;border-radius:3px;padding:11px 20px;font-size:11px;letter-spacing:.16em;font-weight:700;cursor:pointer}.hx9-enter:disabled{background:#243a46;color:#a2bdca;cursor:wait}.hx9-sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}.hx9-status-ready{bottom:18px;left:18px;padding:12px 16px;max-width:280px}.hx9-status-ready .hx9-title,.hx9-status-ready .hx9-copy,.hx9-status-ready .hx9-line,.hx9-status-ready .hx9-eyebrow{display:none}.hx9-mobile-brief{display:none}.hx9-actions{position:absolute;bottom:18px;right:18px;z-index:6;display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;max-width:65vw}.hx9-actions a{font:700 10px system-ui,sans-serif;letter-spacing:.08em;text-decoration:none;color:#ddfaff;background:rgba(2,17,27,.86);border:1px solid rgba(124,220,236,.6);border-radius:3px;padding:11px 12px}.hx9-actions a:hover,.hx9-actions a:focus-visible{background:#b9f3ff;color:#06131c;outline:2px solid #fff;outline-offset:2px}@media(max-width:600px){.hx9-status-ready{left:10px;bottom:112px}.hx9-actions{left:10px;right:10px;bottom:10px;max-width:none;justify-content:flex-start}.hx9-actions a{font-size:10px;padding:14px 10px;min-height:44px;box-sizing:border-box}.hx9-mobile-brief{display:block;position:absolute;right:10px;bottom:112px;z-index:7;color:#ddfaff;background:rgba(2,17,27,.94);border:1px solid rgba(124,220,236,.6);border-radius:3px;font:600 12px system-ui,sans-serif;max-width:min(310px,75vw)}.hx9-mobile-brief summary{cursor:pointer;list-style:none;letter-spacing:.06em;padding:14px}.hx9-mobile-brief-body{padding:0 14px 12px;line-height:1.4}.hx9-mobile-brief-body strong{color:#a8f0ff}.hx9-mobile-brief-body p{margin:3px 0 9px}}@media(prefers-reduced-motion:reduce){.hx9-line span{animation:none}}</style>`
html = html.replace(/<style id="orbita-hx9-ui">[\s\S]*?<\/style>/,'')
html = html.replace('</head>',css+'</head>')
writeFileSync(path,html)
