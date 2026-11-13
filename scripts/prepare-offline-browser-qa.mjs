// Test-only: run build-pages first. Override external ESM imports in dist-pages
// with shared local bundles so browser QA can run without CDN access. This does
// not change source HTML or the deploy build; rerun build-pages to discard it.
import { createRequire } from 'node:module'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
const root = resolve(import.meta.dirname, '..')
const require = createRequire(resolve(root, 'source/package.json'))
const esbuild = require('esbuild')
const packages = {
  react: 'react', 'jsx-runtime': 'react/jsx-runtime', 'react-dom': 'react-dom',
  'react-dom-client': 'react-dom/client', three: 'three',
  buffergeometry: 'three/examples/jsm/utils/BufferGeometryUtils.js',
  roundedbox: 'three/examples/jsm/geometries/RoundedBoxGeometry.js',
  svgloader: 'three/examples/jsm/loaders/SVGLoader.js', fiber: '@react-three/fiber',
  drei: '@react-three/drei', 'postprocessing-r3f': '@react-three/postprocessing',
  postprocessing: 'postprocessing', zustand: 'zustand', clsx: 'clsx',
  'tailwind-merge': 'tailwind-merge',
}
const aliases = Object.fromEntries(Object.entries(packages).map(([name, spec]) => [spec, name]))
const tmp = mkdtempSync(join(tmpdir(), 'orbita-offline-'))
try {
  const entryPoints = {}
  for (const [name, spec] of Object.entries(packages)) {
    const file = join(tmp, name + '.js')
    const cjs = ['react', 'jsx-runtime', 'react-dom', 'react-dom-client'].includes(name)
    const keys = cjs ? Object.keys(require(spec)).filter(k => /^[A-Za-z_$][\w$]*$/.test(k) && k !== 'default') : []
    const exports = cjs ? `export {${keys.join(',')}} from ${JSON.stringify(spec)};` : `export * from ${JSON.stringify(spec)};`
    const defaultExport = ['react', 'react-dom', 'react-dom-client', 'clsx'].includes(name) ? `export {default} from ${JSON.stringify(spec)};` : ''
    writeFileSync(file, exports + defaultExport)
    entryPoints[name] = file
  }
  await esbuild.build({ entryPoints, outdir: resolve(root, 'dist-pages/__qa'), nodePaths: [resolve(root, 'source/node_modules')], bundle: true, splitting: true, format: 'esm', platform: 'browser', target: 'es2022', minify: true, define: { 'process.env.NODE_ENV': '"production"' } })
  const rootHtml = resolve(root, 'dist-pages/index.html')
  let html = readFileSync(rootHtml, 'utf8')
  const marker = '    return { imports: m };'
  if (!html.includes(marker)) throw new Error('Root import map builder not found')
  html = html.replace(marker, Object.entries(aliases).map(([spec, name]) => `    m[${JSON.stringify(spec)}] = '/__qa/${name}.js';`).join('\n') + '\n' + marker)
  writeFileSync(rootHtml, html)
  const shipHtml = resolve(root, 'dist-pages/assets/immersive/index.html')
  html = readFileSync(shipHtml, 'utf8')
  const match = html.match(/(<script type="importmap">)(.*?)(<\/script>)/s)
  if (!match) throw new Error('Spaceship import map not found')
  const map = JSON.parse(match[2])
  for (const [spec, name] of Object.entries(aliases)) if (spec in map.imports) map.imports[spec] = `/__qa/${name}.js`
  writeFileSync(shipHtml, html.replace(match[0], match[1] + JSON.stringify(map) + match[3]))
  console.log('OFFLINE_BROWSER_QA_READY: dist-pages only; rebuild for deployment')
} finally { rmSync(tmp, { recursive: true, force: true }) }
