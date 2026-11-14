import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, openSync, closeSync, ftruncateSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { oversizedPagesAssets, PAGES_MAX_ASSET_BYTES } from '../scripts/pages-asset-limit.mjs'
const root = mkdtempSync(join(tmpdir(), 'pages-asset-limit-'))
try {
  mkdirSync(join(root, 'nested'))
  for (const [name, size] of [['exact.mp4', PAGES_MAX_ASSET_BYTES], ['nested/too-large.mp4', PAGES_MAX_ASSET_BYTES + 1]]) {
    const fd = openSync(join(root, name), 'w')
    ftruncateSync(fd, size)
    closeSync(fd)
  }
  assert.deepEqual(oversizedPagesAssets(root), [{ path: join('nested', 'too-large.mp4'), bytes: PAGES_MAX_ASSET_BYTES + 1 }])
  console.log('PAGES_ASSET_LIMIT_PASS')
} finally { rmSync(root, { recursive: true, force: true }) }
