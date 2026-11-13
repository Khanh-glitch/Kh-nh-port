/** Publish the reviewed portfolio modules into the existing root ESM map.
 * Run after npm ci --prefix source; never rebuild the spaceship or replace the map. */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { dirname, relative, resolve } from 'node:path'
const require = createRequire(import.meta.url)
const ts = require('../source/node_modules/typescript')
const root = resolve(import.meta.dirname, '..'), src = resolve(root, 'source/src')
const htmlPath = resolve(root, 'index.html')
const tag = '<script id="orbita-embedded-map" type="application/json">'
const html = readFileSync(htmlPath, 'utf8'), begin = html.indexOf(tag), end = html.indexOf('</script>', begin + tag.length)
if (begin < 0 || end < 0) throw Error('Standalone module map missing')
const map = JSON.parse(html.slice(begin + tag.length, end))
const targets = ['layout', 'store', 'highGuard', 'perfLadder', 'reality/RealityHost', 'reality/Front', 'reality/foliage', 'reality/weather/SummerRain', 'reality/weather/FlamboyantWind', 'reality/kit', 'reality/music', 'reality/tracks', 'scene/Beacon', 'scene/Cinema', 'scene/domOcclusion', 'scene/Experience', 'scene/Player', 'scene/SocialDrops', 'scene/VngGallery', 'stage/ShowSystem', 'stage/showState', 'ui/Overlay']
if (!map['orbita/perfLadder']) map['orbita/perfLadder'] = 'pending'
if (!map['orbita/scene/domOcclusion']) map['orbita/scene/domOcclusion'] = 'pending'
for (const moduleName of targets) {
  const id = 'orbita/' + moduleName
  if (!(id in map) && moduleName !== 'scene/domOcclusion') throw Error('Missing embedded module ' + id)
  const path = resolve(src, moduleName + (existsSync(resolve(src, moduleName + '.tsx')) ? '.tsx' : '.ts'))
  const result = ts.transpileModule(readFileSync(path, 'utf8'), { fileName: path, reportDiagnostics: true,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, removeComments: false } })
  const errors = (result.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error)
  if (errors.length) throw Error(moduleName + ': ' + errors.map(e => ts.flattenDiagnosticMessageText(e.messageText, ' ')).join('\n'))
  const js = result.outputText.replace(/(\bfrom\s*['"])(\.{1,2}\/[^'"]+)(['"])/g, (_all, pre, spec, post) => {
    const name = relative(src, resolve(dirname(path), spec)).replace(/\\/g, '/').replace(/\.(tsx?|jsx?)$/, '')
    const target = 'orbita/' + name
    if (name.startsWith('..') || !(target in map)) throw Error(`${id}: missing import ${target}`)
    return pre + target + post
  })
  map[id] = 'data:text/javascript;base64,' + Buffer.from(js).toString('base64')
}
writeFileSync(htmlPath, html.slice(0, begin + tag.length) + JSON.stringify(map) + html.slice(end))
// The original-module regression baseline includes some intentionally changed modules.
// Refresh those exact entries; all other frozen hashes stay unchanged.
const baselinePath = resolve(root, 'tests/integration-original-modules.json')
const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'))
for (const name of targets) {
  const id = 'orbita/' + name
  if (id in baseline) baseline[id] = createHash('sha256').update(map[id]).digest('hex')
}
writeFileSync(baselinePath, JSON.stringify(baseline, null, 2) + '\n')
console.log('PORTFOLIO_STANDALONE_SYNCED', targets.length)
