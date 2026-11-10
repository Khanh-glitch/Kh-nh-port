/**
 * Update only explicitly repaired ORBITA modules in the deployed standalone HTML.
 * Keep 56-module import map, the original stage, postprocessing and all media.
 * Run after npm ci --prefix source. Idempotent and safe for CI.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, posix, relative, resolve } from 'node:path'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const ts = require('../source/node_modules/typescript')
const root = resolve(import.meta.dirname, '..')
const htmlPath = resolve(root, 'index.html')
const srcRoot = resolve(root, 'source/src')
const tag = '<script id="orbita-embedded-map" type="application/json">'
const html = readFileSync(htmlPath, 'utf8')
const start = html.indexOf(tag)
const end = start < 0 ? -1 : html.indexOf('</script>', start + tag.length)
if (start < 0 || end < 0) throw new Error('Integrated root module map not found')
const jsonStart = start + tag.length
const original = JSON.parse(html.slice(jsonStart, end))
const keysBefore = Object.keys(original)
const targets = [
  'scene/ApexShowcase',
  'scene/RagnarokShowcase',
  'scene/ShowcaseWarmup',
  'scene/Robot',
]
const checkInternal = (name) => {
  const normalized = name.replace(/\\/g, '/').replace(/\.(tsx?|jsx?)$/, '')
  const key = 'orbita/' + normalized
  if (!(key in original)) throw new Error('Unexpected new import: ' + key)
  return key
}
for (const file of targets) {
  const name = file + '.tsx'
  const input = readFileSync(resolve(srcRoot, name), 'utf8')
  const output = ts.transpileModule(input, {
    fileName: name,
    reportDiagnostics: true,
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      removeComments: false,
    },
  })
  const errors = (output.diagnostics || []).filter(x => x.category === ts.DiagnosticCategory.Error)
  if (errors.length) throw new Error(name + ': ' + ts.formatDiagnosticsWithColorAndContext(errors, { getCanonicalFileName: x => x, getCurrentDirectory: () => root, getNewLine: () => '\n' }))
  const js = output.outputText.replace(/(\bfrom\s*['"])(\.{1,2}\/[^'"]+)(['"])/g, (_match, pre, spec, post) => {
    const abs = resolve(srcRoot, dirname(name), spec)
    const rel = relative(srcRoot, abs)
    if (rel.startsWith('..')) throw new Error('Forbidden out-of-tree import: ' + spec)
    return pre + checkInternal(rel) + post
  })
  // Fail closed if local imports escaped rewriting.
  if (/\bfrom\s*['"]\.{1,2}\//.test(js)) throw new Error('Unresolved import in ' + name)
  original['orbita/' + file] = 'data:text/javascript;base64,' + Buffer.from(js, 'utf8').toString('base64')
}
if (Object.keys(original).length !== keysBefore.length || keysBefore.some(k => !(k in original))) {
  throw new Error('Embedded module map was altered beyond requested four modules')
}
const updated = html.slice(0, jsonStart) + JSON.stringify(original) + html.slice(end)
if (updated === html) {
  console.log('[ORBITA] Standalone ESM map already synchronized')
} else {
  writeFileSync(htmlPath, updated)
  console.log('[ORBITA] Synchronized four Colossus source modules into integrated index.html')
}
