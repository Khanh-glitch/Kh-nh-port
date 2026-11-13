/**
 * Sync the reviewed ORBITA source modules into the ONE deployed standalone
 * root index.html (Cloudflare Pages serves index.html, never source/).
 *
 * Rules that matter for this repository:
 *  - Byte-faithful: every module that still transpiles to the same JavaScript
 *    as the embedded copy is left untouched. Repeated runs are idempotent, so
 *    the shipped HTML can never drift away from its sources in small steps.
 *  - No silent stale modules: `--check` fails when any module differs, so a
 *    "source-only" change can not be published by accident.
 *  - Visual-freeze friendly: this script does not touch assets, scenes,
 *    quality settings or the module key set.
 *
 * Usage (after `npm ci --prefix source`):
 *   node scripts/sync-standalone-from-source.mjs
 *   node scripts/sync-standalone-from-source.mjs --check
 */
/**
 * Modules where the SHIPPED build is the visual reference and source/ merely
 * carries later comments/experiments. They are frozen here on purpose: writing
 * source over the published scene would change visible geometry/behaviour
 * without a measured visual comparison. Never add a module to this list just
 * to silence the checker.
 */
const FROZEN_DIVERGENCE = new Set([
  'scene/ApexShowcase.tsx',
  'scene/ShowcaseWarmup.tsx',
  'scene/VngGallery.tsx',
  'vng/models/projector.ts',
  'vng/models/stuffCollection.ts',
  'vng/models/vngLogo.ts',
  'vng/textures.ts',
])
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, relative, resolve } from 'node:path'

const require = createRequire(import.meta.url)
const ts = require('../source/node_modules/typescript')
const root = resolve(import.meta.dirname, '..')
const htmlPath = resolve(root, 'index.html')
const srcRoot = resolve(root, 'source/src')
const tag = '<script id="orbita-embedded-map" type="application/json">'
const checkOnly = process.argv.includes('--check')

const html = readFileSync(htmlPath, 'utf8')
const begin = html.indexOf(tag)
const end = begin < 0 ? -1 : html.indexOf('</script>', begin + tag.length)
if (begin < 0 || end < 0) throw new Error('standalone ESM map not found in index.html')
const jsonStart = begin + tag.length
const map = JSON.parse(html.slice(jsonStart, end))
const keysBefore = Object.keys(map)

// The standalone build lives in a browser without Vite: two constructs are
// resolved at build time by Vite and must be substituted here instead.
const PREPROCESS = [
  // `import.meta.glob` cannot survive as a bare specifier in the CDN import map.
  [/const pianoFiles = import\.meta\.glob\([\s\S]*?\) as Record<string, string>/, 'const pianoFiles = {} as Record<string, string>'],
  // The root document inlines Tailwind; a CSS import would be unresolved.
  [/^\s*import\s+['"]\.\/index\.css['"];?\s*$/m, ''],
]

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) out.push(full)
  }
  return out
}

function transpile(file) {
  let source = readFileSync(file, 'utf8')
  for (const [pattern, replacement] of PREPROCESS) source = source.replace(pattern, replacement)
  const result = ts.transpileModule(source, {
    fileName: file,
    reportDiagnostics: true,
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      removeComments: false,
    },
  })
  const errors = (result.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error)
  if (errors.length) throw new Error(file + ': ' + ts.flattenDiagnosticMessageText(errors[0].messageText, ' | '))
  const js = result.outputText.replace(/(\bfrom\s*['"])(\.{1,2}\/[^'"]+)(['"])/g, (_all, pre, spec, post) => {
    const target = resolve(dirname(file), spec)
    const rel = relative(srcRoot, target).replace(/\\/g, '/')
    if (rel.startsWith('..')) throw new Error('import escapes source root: ' + spec)
    const id = 'orbita/' + rel.replace(/\.(tsx?|jsx?)$/, '')
    if (!(id in map)) throw new Error('missing embedded module ' + id + ' imported by ' + file)
    return pre + id + post
  })
  if (/\bfrom\s*['"]\.{1,2}\//.test(js)) throw new Error('unresolved relative import in ' + file)
  return js
}

/** Same JavaScript modulo whitespace, comments already preserved verbatim. */
const canonical = js => js.replace(/\r/g, '').split('\n').map(l => l.trim()).filter(Boolean).join('\n')

let changed = 0
const unknown = []
const frozen = []
for (const file of walk(srcRoot)) {
  const rel = relative(srcRoot, file).replace(/\\/g, '/')
  const id = 'orbita/' + rel.replace(/\.tsx?$/, '')
  if (!(id in map)) { unknown.push(rel); continue }
  if (FROZEN_DIVERGENCE.has(rel)) { frozen.push(rel); continue }
  const js = transpile(file)
  const embedded = Buffer.from(map[id].split(',')[1], 'base64').toString('utf8')
  if (canonical(js) === canonical(embedded)) continue
  changed++
  if (checkOnly) console.log('STALE ' + rel)
  else map[id] = 'data:text/javascript;base64,' + Buffer.from(js, 'utf8').toString('base64')
}
if (unknown.length) throw new Error('source modules with no embedded slot: ' + unknown.join(', '))
if (Object.keys(map).length !== keysBefore.length || keysBefore.some(k => !(k in map))) {
  throw new Error('module map keys must not change')
}

if (checkOnly) {
  if (changed) { console.error(`[standalone] ${changed} module(s) out of sync with source/`); process.exit(1) }
  console.log(`[standalone] all reviewed modules are in sync with source/ (${frozen.length} deliberately frozen)`)
  process.exit(0)
}
if (!changed) { console.log('[standalone] already in sync'); process.exit(0) }

const updated = html.slice(0, jsonStart) + JSON.stringify(map) + html.slice(end)
writeFileSync(htmlPath, updated)
console.log(`[standalone] synced ${changed} module(s) into index.html (${(updated.length / 1048576).toFixed(2)} MiB)`)
