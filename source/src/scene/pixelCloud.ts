import * as THREE from 'three'

/** Original 2.5D storm-cloud atlas, generated at pixel resolution.
 * Deliberately not smooth/volumetric: Ragnarok sprites use nearest-neighbor
 * pixel art, so the clouds need crisp painted silhouettes and pixel shading.
 */
export function makePixelStormClouds(): THREE.CanvasTexture[] {
  return Array.from({ length: 3 }, (_, variant) => {
    const W = 96
    const H = 56
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')!
    const image = ctx.createImageData(W, H)
    const u8 = image.data
    const hash = (x: number, y: number) => {
      let n = ((x + 47 * variant) * 374761393 + y * 668265263) | 0
      n = Math.imul(n ^ (n >>> 13), 1274126177)
      return ((n ^ (n >>> 16)) >>> 0) / 4294967295
    }
    const ellipses: Array<[number, number, number, number]> = [
      [18, 34, 18, 12], [31, 26, 19, 17], [46, 22, 19, 18],
      [62, 26, 20, 16], [79, 33, 15, 12], [48, 35, 39, 12],
    ]
    const palette = variant === 1
      ? [[20, 26, 45], [36, 43, 67], [60, 71, 100], [91, 105, 137]]
      : variant === 2
        ? [[21, 28, 45], [39, 48, 68], [64, 75, 105], [105, 114, 141]]
        : [[17, 24, 43], [33, 42, 65], [59, 71, 99], [92, 104, 133]]

    const mask = new Uint8Array(W * H)
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let covered = false
        for (const [cx, cy, rx, ry] of ellipses) {
          const dx = (x - cx) / rx
          const dy = (y - cy) / ry
          const wobble = (hash(Math.floor(x / 6), Math.floor(y / 6)) - 0.5) * 0.18
          if (dx * dx + dy * dy < 1 + wobble) { covered = true; break }
        }
        // Flatten broken storm-cloud base into softly jagged pixel ledges.
        if (x > 13 && x < 82 && y > 31 && y < 42 - Math.floor(hash(Math.floor(x / 9), 5) * 4)) covered = true
        mask[y * W + x] = covered ? 1 : 0
      }
    }
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const at = y * W + x
        if (!mask[at]) continue
        const edge = !mask[at - 1] || !mask[at + 1] || !mask[at - W] || !mask[at + W]
        const hi = y < 26 + 5 * Math.sin(x * 0.11) && hash(Math.floor(x / 5), Math.floor(y / 4)) > 0.20
        const low = y > 34 && hash(Math.floor(x / 5), Math.floor(y / 4)) > 0.15
        const depth = edge ? 0 : hi ? 3 : low ? 1 : 2
        const pix = palette[depth]
        const p = at * 4
        u8[p] = pix[0]; u8[p + 1] = pix[1]; u8[p + 2] = pix[2]
        u8[p + 3] = 255
        // Painterly internal cloud tufts, not random hard cube faces.
        if (!edge && y < 34 && hash(Math.floor(x / 8), Math.floor(y / 5)) > 0.91) {
          u8[p] = Math.min(255, pix[0] + 12)
          u8[p + 1] = Math.min(255, pix[1] + 13)
          u8[p + 2] = Math.min(255, pix[2] + 18)
        }
      }
    }
    ctx.putImageData(image, 0, 0)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.magFilter = THREE.NearestFilter
    tex.minFilter = THREE.NearestMipmapNearestFilter
    tex.generateMipmaps = true
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
    tex.anisotropy = 1
    return tex
  })
}
