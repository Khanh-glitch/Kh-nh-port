import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

// Cloudflare Pages accepts an individual asset up to 25 MiB.
export const PAGES_MAX_ASSET_BYTES = 25 * 1024 * 1024

export function oversizedPagesAssets(root, limit = PAGES_MAX_ASSET_BYTES) {
  const result = []
  function scan(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) scan(path)
      else if (entry.isFile()) {
        const bytes = statSync(path).size
        if (bytes > limit) result.push({ path: relative(root, path), bytes })
      }
    }
  }
  scan(root)
  return result.sort((a, b) => b.bytes - a.bytes)
}
