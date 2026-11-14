import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { oversizedPagesAssets, PAGES_MAX_ASSET_BYTES } from './pages-asset-limit.mjs'

// ORBITA Cloudflare Pages: publish the integrated standalone root HTML, NOT
// a fresh Vite build from the older source/ workspace.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'dist-pages')
const html = readFileSync(join(root, 'index.html'), 'utf8')

if (!/<html\b/i.test(html) || !/<\/html>/i.test(html) || !html.includes('orbita-embedded-map') || !html.includes('orbita/main')) {
  throw new Error('Root index.html is not an ORBITA standalone build; refusing to deploy the wrong scene.')
}
if (/import\.meta\.glob\s*\(/.test(html)) {
  throw new Error('Untransformed Vite import.meta.glob in standalone HTML; aborting deployment.')
}

rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
writeFileSync(join(out, 'index.html'), html)

// Keep public art, project media and optional future MP3/MP4 files available.
// Never publish source/, large reference ZIPs, or superseded robot builds.
if (existsSync(join(root, 'assets'))) {
  cpSync(join(root, 'assets'), join(out, 'assets'), { recursive: true })
}
if (existsSync(join(root, 'source', 'public'))) {
  cpSync(join(root, 'source', 'public'), out, {
    recursive: true,
    filter: (path) => path !== join(root, 'source', 'public', 'index.html'),
  })
}
for (const name of readdirSync(root)) {
  const path = join(root, name)
  if (!statSync(path).isFile()) continue
  if (!['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif', '.ico', '.mp3', '.mp4', '.webm', '.pdf', '.glb', '.gltf'].includes(extname(name).toLowerCase())) continue
  cpSync(path, join(out, name))
}

const oversized = oversizedPagesAssets(out)
if (oversized.length) {
  const files = oversized.map(({ path, bytes }) => `  ${path}: ${(bytes / 1024 / 1024).toFixed(2)} MiB`).join('\n')
  throw new Error(`Cloudflare Pages rejects assets over ${PAGES_MAX_ASSET_BYTES / 1024 / 1024} MiB. Reduce these files before deploying:\n${files}`)
}

writeFileSync(join(out, '_headers'), '/index.html\n  Cache-Control: no-cache, must-revalidate\n')
console.log(`[ORBITA Pages] Ready: ${out} — standalone HTML ${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MiB`)
console.log('[ORBITA Pages] Build output: dist-pages | Production branch: main')
