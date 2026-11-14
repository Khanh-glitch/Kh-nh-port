import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
const hashes = {
  'social-1': 'ede973a34bfe000821823addb4a3604d74e8329509aa20537a338f225e1724a9',
  'social-2': '1e6d06708b8e0ae1d0312e258dc457ab6cf36560328d6a1d33c2f435f756e333',
  'social-3': '57039b69791885a484afda69db6744d1575f5c631fa2b6c90312a71fb30c314c',
}
for (const [name, expected] of Object.entries(hashes)) {
  const h = createHash('sha256')
  for (const i of ['00','01','02']) {
    const file = `source/public/portfolio/films/${name}/part-${i}`
    assert.ok(statSync(file).size <= 25 * 1024 * 1024)
    h.update(readFileSync(file))
  }
  assert.equal(h.digest('hex'), expected, `${name} fragmented MP4 content changed`)
}
console.log('CINEMA_PARTS_INTEGRITY_PASS')
