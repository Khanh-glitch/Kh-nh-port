import * as THREE from 'three'

type G = CanvasRenderingContext2D

const OUT = '#140c14'

function hex(c: string): [number, number, number] {
  const n = parseInt(c.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function hash2(x: number, y: number, s = 0) {
  let n = Math.imul(x + s * 37, 374761393) + Math.imul(y - s * 19, 668265263)
  n = Math.imul(n ^ (n >>> 13), 1274126177)
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296
}

function outlineCanvas(c: HTMLCanvasElement, col = OUT) {
  const g = c.getContext('2d')!
  const d = g.getImageData(0, 0, c.width, c.height)
  const a = d.data
  const W = c.width
  const H = c.height
  const src = new Uint8Array(W * H)
  for (let i = 0; i < W * H; i++) src[i] = a[i * 4 + 3] > 40 ? 1 : 0
  const [r, gg, b] = hex(col)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x
      if (src[i]) continue
      if ((x > 0 && src[i - 1]) || (x < W - 1 && src[i + 1]) || (y > 0 && src[i - W]) || (y < H - 1 && src[i + W])) {
        a[i * 4] = r
        a[i * 4 + 1] = gg
        a[i * 4 + 2] = b
        a[i * 4 + 3] = 255
      }
    }
  }
  g.putImageData(d, 0, 0)
}

function mk(w: number, h: number, fn: (g: G) => void, outline: string | null = OUT) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  g.imageSmoothingEnabled = false
  fn(g)
  if (outline) outlineCanvas(c, outline)
  return c
}

const P = (g: G, x: number, y: number, c: string) => {
  g.fillStyle = c
  g.fillRect(x | 0, y | 0, 1, 1)
}
const R = (g: G, x: number, y: number, w: number, h: number, c: string) => {
  g.fillStyle = c
  g.fillRect(x | 0, y | 0, w | 0, h | 0)
}
function ell(g: G, cx: number, cy: number, rx: number, ry: number, c: string | ((nx: number, ny: number, x: number, y: number) => string | null)) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx
      const ny = (y + 0.5 - cy) / ry
      if (nx * nx + ny * ny > 1) continue
      const col = typeof c === 'string' ? c : c(nx, ny, x, y)
      if (col) P(g, x, y, col)
    }
  }
}
const shade = (b: string, l: string, d: string, s = 0) => (nx: number, ny: number, x: number, y: number) => {
  const v = -nx * 0.55 - ny * 0.8 + (hash2(x, y, s) - 0.5) * 0.35
  return v > 0.45 ? l : v < -0.35 ? d : b
}
function strs(g: G, ox: number, oy: number, rows: string[], pal: Record<string, string>, flip = false) {
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[flip ? row.length - 1 - x : x]
      if (ch !== '.' && pal[ch]) P(g, ox + x, oy + y, pal[ch])
    }
  })
}

const HEAD_DOWN = ['...hhhh...', '.hhhhhhhh.', 'hhhHhhHhhh', 'hHssssssHh', 'hseesseesh', 'hssssssssh', '.sssSSsss.', '..ssssss..', '...SSSS...']
const HEAD_SIDE = ['..hhhhh...', '.hhhhhhhh.', 'hhhhhhhhh.', 'hhhhsssss.', 'hhhssssesS', 'hhHsssssss', '.hHssssSs.', '..hsssss..', '...SSSS...']

function drawHeroFrame(g: G, side: boolean, f: number, swing: boolean) {
  const pal: Record<string, string> = {
    h: '#6a4024',
    H: '#442614',
    s: '#eebc98',
    S: '#c48462',
    e: '#201824',
    t: '#2f8f8a',
    T: '#1e5e66',
    l: '#d6a44e',
    p: '#36324d',
    k: '#281d18',
    a: '#ffe2b0',
  }
  const bob = f % 2
  const legY = 17
  if (side) {
    const step = [0, 2, 0, -2][f % 4]
    R(g, 7 + step, legY, 2, 4, pal.p)
    R(g, 7 - step, legY, 2, 4, '#252138')
    R(g, 7 + step, legY + 4, 3, 1, pal.k)
    R(g, 7 - step, legY + 4, 3, 1, pal.k)
  } else {
    const a = [0, -1, 0, 1][f % 4]
    R(g, 5, legY + Math.min(0, a), 2, 4, pal.p)
    R(g, 9, legY + Math.min(0, -a), 2, 4, pal.p)
    R(g, 5, legY + 4, 2, 1, pal.k)
    R(g, 9, legY + 4, 2, 1, pal.k)
  }
  const ty = 10 - bob
  R(g, 4, ty, 8, 7, pal.t)
  R(g, 10, ty, 2, 7, pal.T)
  R(g, 4, ty + 5, 8, 1, pal.l)
  P(g, 7, ty + 1, pal.a)
  const sw = [0, 1, 0, -1][f % 4]
  R(g, 3, ty + 1 + sw, 1, 5, pal.T)
  R(g, 12, ty + 1 - sw, 1, 5, pal.T)
  P(g, 3, ty + 6 + sw, pal.s)
  P(g, 12, ty + 6 - sw, pal.s)
  strs(g, 3, 1 - bob, side ? HEAD_SIDE : HEAD_DOWN, pal, false)
  // Sword held at hand
  if (swing) {
    R(g, 12, 8, 5, 2, '#e2eef8')
    R(g, 11, 9, 2, 2, '#d6a44e')
  } else {
    R(g, 13, 11 - bob, 1, 6, '#dbe8f5')
    R(g, 12, 14 - bob, 3, 1, '#d6a44e')
  }
}

function drawBoar(g: G, f: number, tell: boolean) {
  const cr = tell ? 1 : 0
  ;[5, 8, 14, 17].forEach((x, i) => R(g, x, 15 - ((i + f) % 2), 1, 3, '#3a2418'))
  ell(g, 11, 11 + cr, 8, 5, shade('#7a4a2e', '#a0683e', '#4e2e1c', 3))
  for (let x = 5; x < 16; x += 2) P(g, x, 6 + cr + (x % 4 ? 0 : -1), '#2a1a12')
  ell(g, 19, 12 + cr, 3, 3, shade('#8a5434', '#b07a50', '#5a3420'))
  R(g, 21, 12 + cr, 2, 2, '#d08a8a')
  P(g, 20, 14 + cr, '#f4f0e0')
  P(g, 18, 10 + cr, tell ? '#ff3a20' : '#1a1010')
}

function drawWolf(g: G, f: number, tell: boolean) {
  const cr = tell ? 2 : 0
  ;[6, 8, 15, 17].forEach((x, i) => R(g, x, 15 - ((i + f) % 2), 1, 3, '#5a5e68'))
  ell(g, 12, 11 + cr * 0.5, 7, 4, shade('#8a909c', '#c0c6d0', '#5a5e68', 5))
  R(g, 2, 8 + (f % 2), 4, 2, '#8a909c')
  ell(g, 19, 9 + cr, 3, 3, shade('#9aa0aa', '#d0d6e0', '#5a5e68'))
  R(g, 21, 10 + cr, 3, 2, '#9aa0aa')
  P(g, 23, 10 + cr, '#1a1a20')
  P(g, 18, 5 + cr, '#5a5e68')
  P(g, 20, 5 + cr, '#5a5e68')
  P(g, 20, 8 + cr, tell ? '#ffd040' : '#e0e040')
}

function drawMagmaElder(g: G, f: number) {
  const b = f % 2
  ell(g, 24, 28 + b, 16, 13, shade('#4a3a36', '#6a5650', '#2a201e', 22))
  ell(g, 9, 30, 6, 8, shade('#4a3a36', '#6a5650', '#2a201e', 23))
  ell(g, 39, 30, 6, 8, shade('#4a3a36', '#6a5650', '#2a201e', 24))
  R(g, 14, 40, 6, 6, '#3a2c28')
  R(g, 28, 40, 6, 6, '#3a2c28')
  ell(g, 24, 14 + b, 7, 6, shade('#5a4842', '#7a645c', '#2a201e', 25))
  ell(g, 24, 27 + b, 5, 5, '#ffd040')
  ell(g, 24, 27 + b, 2.5, 2.5, '#fff4c0')
  P(g, 21, 14 + b, '#ffd040')
  P(g, 27, 14 + b, '#ffd040')
  for (let k = 0; k < 5; k++) P(g, 18 + k * 3, 7 + b - (k % 2), '#ff7a2a')
}

function drawTree(g: G, pine: boolean) {
  if (pine) {
    R(g, 14, 34, 4, 12, '#4a2e1a')
    R(g, 16, 34, 2, 12, '#684226')
    for (let layer = 0; layer < 4; layer++) {
      const y0 = 6 + layer * 7
      const hw = 4 + layer * 3
      for (let dy = 0; dy < 10; dy++) {
        const w = Math.max(1, ((hw * (dy + 2)) / 10) | 0)
        R(g, 16 - w, y0 + dy, w * 2, 1, dy < 3 ? '#4da84c' : dy > 7 ? '#1f4f28' : '#2f7a38')
      }
    }
  } else {
    R(g, 13, 30, 6, 16, '#5a3a22')
    R(g, 17, 30, 2, 16, '#7a5232')
    ell(g, 16, 20, 12, 10, shade('#3d8b3a', '#6ec458', '#225224', 11))
    ell(g, 10, 22, 6, 5, shade('#3d8b3a', '#6ec458', '#225224', 15))
    ell(g, 22, 22, 6, 5, shade('#3d8b3a', '#6ec458', '#225224', 19))
  }
}

function drawCrystalNode(g: G) {
  ell(g, 12, 19, 9, 5, shade('#525866', '#727a8c', '#323640', 4))
  // Glowing cyan-blue island crystal shards
  const shards = [
    [10, 6, 4, 11],
    [15, 9, 4, 9],
    [6, 11, 3, 7],
  ]
  shards.forEach(([x, y, w, h]) => {
    R(g, x, y, w, h, '#28b8e6')
    R(g, x, y, 1, h, '#8af4ff')
    P(g, x + 1, y, '#ffffff')
  })
}

function drawChest(g: G, open: boolean) {
  R(g, 2, 8, 12, 7, '#7a441e')
  R(g, 2, 8, 12, 2, '#d8a438')
  R(g, 2, 14, 12, 1, '#4a2610')
  if (open) {
    R(g, 2, 3, 12, 4, '#5a3014')
    R(g, 3, 7, 10, 2, '#ffe870')
    P(g, 7, 8, '#ffffff')
  } else {
    R(g, 2, 5, 12, 3, '#9a5a2a')
    R(g, 7, 7, 2, 3, '#ffd448')
  }
}

function drawCampfire(g: G, f: number) {
  R(g, 3, 12, 10, 2, '#5a341c')
  R(g, 5, 11, 6, 2, '#7a4826')
  const h = [0, 1, -1][f % 3]
  ell(g, 8, 8 + h * 0.5, 4, 4, '#ff6818')
  ell(g, 8, 8, 2.5, 3, '#ffbe30')
  R(g, 7, 7 - h, 2, 2, '#fff8c8')
}

function drawSlash(g: G) {
  for (let a = -1.1; a <= 1.1; a += 0.08) {
    const r = 10
    const x = 12 + Math.cos(a) * r
    const y = 12 + Math.sin(a) * r
    R(g, x - 1, y - 1, 2, 2, '#ffd86a')
    R(g, x, y, 1, 1, '#ffffff')
  }
}

export interface UVRect {
  u0: number
  v0: number
  u1: number
  v1: number
}

export interface RagnarokAtlas {
  texture: THREE.CanvasTexture
  grassTex: THREE.CanvasTexture
  cliffTex: THREE.CanvasTexture
  uvs: Record<string, UVRect>
}

let cachedAtlas: RagnarokAtlas | null = null

export function getRagnarokAtlas(): RagnarokAtlas {
  if (cachedAtlas) return cachedAtlas

  const W = 512
  const H = 512
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false

  const uvs: Record<string, UVRect> = {}
  const place = (name: string, x: number, y: number, sprite: HTMLCanvasElement) => {
    ctx.drawImage(sprite, x, y)
    // Flip V correctly for Three.js UV space (0 bottom, 1 top)
    uvs[name] = {
      u0: x / W,
      u1: (x + sprite.width) / W,
      v1: 1 - y / H,
      v0: 1 - (y + sprite.height) / H,
    }
  }

  // Row 0: Hero frames (16x24)
  for (let f = 0; f < 4; f++) {
    place(`hero_walk_side_${f}`, f * 20, 0, mk(16, 24, (g) => drawHeroFrame(g, true, f, false)))
    place(`hero_walk_down_${f}`, 80 + f * 20, 0, mk(16, 24, (g) => drawHeroFrame(g, false, f, false)))
  }
  place('hero_slash', 160, 0, mk(20, 24, (g) => drawHeroFrame(g, true, 1, true)))

  // Row 1 (y=32): Boar (24x20) & Wolf (24x20)
  for (let f = 0; f < 2; f++) {
    place(`boar_${f}`, f * 28, 32, mk(24, 20, (g) => drawBoar(g, f, false)))
    place(`wolf_${f}`, 84 + f * 28, 32, mk(24, 20, (g) => drawWolf(g, f, false)))
  }
  place('boar_tell', 56, 32, mk(24, 20, (g) => drawBoar(g, 0, true)))
  place('wolf_tell', 140, 32, mk(24, 20, (g) => drawWolf(g, 0, true)))

  // Row 2 (y=64): Elder Boss (48x48)
  place('elder_0', 0, 64, mk(48, 48, (g) => drawMagmaElder(g, 0)))
  place('elder_1', 52, 64, mk(48, 48, (g) => drawMagmaElder(g, 1)))

  // Row 3 (y=120): Trees (32x48)
  place('tree_oak', 0, 120, mk(32, 48, (g) => drawTree(g, false)))
  place('tree_pine', 36, 120, mk(32, 48, (g) => drawTree(g, true)))

  // Row 4 (y=176): Crystal Node (24x24), Chests (16x16), Campfire (16x16), Loot, Slash
  place('crystal', 0, 176, mk(24, 24, drawCrystalNode))
  place('chest_closed', 28, 176, mk(16, 16, (g) => drawChest(g, false)))
  place('chest_open', 48, 176, mk(16, 16, (g) => drawChest(g, true)))
  for (let f = 0; f < 3; f++) {
    place(`fire_${f}`, 68 + f * 20, 176, mk(16, 16, (g) => drawCampfire(g, f)))
  }
  place('coin', 128, 176, mk(12, 12, (g) => {
    ell(g, 6, 6, 4, 4, '#ffd038')
    R(g, 5, 4, 2, 4, '#fff6a8')
  }))
  place('gem', 144, 176, mk(12, 12, (g) => {
    R(g, 4, 2, 4, 8, '#3cf0ff')
    R(g, 3, 4, 6, 4, '#3cf0ff')
    R(g, 5, 3, 2, 2, '#ffffff')
  }))
  place('slash', 164, 176, mk(24, 24, drawSlash, null))

  const texture = new THREE.CanvasTexture(canvas)
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  texture.generateMipmaps = false
  texture.colorSpace = THREE.SRGBColorSpace

  // Crisp 64x64 pixel-art Grass Tile Texture
  const gCan = document.createElement('canvas')
  gCan.width = gCan.height = 64
  const gx = gCan.getContext('2d')!
  const grassCols = ['#3c7a34', '#4a8e3d', '#589f46', '#336a2c']
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const r = Math.hypot(x - 32, y - 32)
      if (r < 9 && hash2(x, y, 7) > 0.25) {
        // Stone campfire plaza in center
        gx.fillStyle = hash2(x, y, 12) > 0.5 ? '#5b5f6c' : '#474a55'
      } else {
        gx.fillStyle = grassCols[Math.floor(hash2(x, y, 3) * grassCols.length)]
      }
      gx.fillRect(x, y, 1, 1)
    }
  }
  const grassTex = new THREE.CanvasTexture(gCan)
  grassTex.magFilter = THREE.NearestFilter
  grassTex.minFilter = THREE.NearestFilter
  grassTex.generateMipmaps = false
  grassTex.colorSpace = THREE.SRGBColorSpace

  // Crisp 32x32 pixel-art Cliff/Soil Strata Texture
  const cCan = document.createElement('canvas')
  cCan.width = cCan.height = 32
  const cx = cCan.getContext('2d')!
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      if (y < 4) cx.fillStyle = hash2(x, y, 1) > 0.4 ? '#4a8e3d' : '#356a2c'
      else if (y < 11) cx.fillStyle = hash2(x, y, 2) > 0.5 ? '#6e472d' : '#533420'
      else cx.fillStyle = hash2(x, y, 5) > 0.5 ? '#484a58' : '#353744'
      cx.fillRect(x, y, 1, 1)
    }
  }
  const cliffTex = new THREE.CanvasTexture(cCan)
  cliffTex.magFilter = THREE.NearestFilter
  cliffTex.minFilter = THREE.NearestFilter
  cliffTex.generateMipmaps = false
  cliffTex.colorSpace = THREE.SRGBColorSpace

  cachedAtlas = { texture, grassTex, cliffTex, uvs }
  return cachedAtlas
}

// Sprite UVs are animated at 4–9fps, not every 60fps render frame.
// Avoid full GPU buffer upload when an atlas frame has not changed.
const lastUV = new WeakMap<THREE.PlaneGeometry, { uv: UVRect; flip: boolean }>()
export function applyUV(geo: THREE.PlaneGeometry, uv: UVRect, flipX = false) {
  const old = lastUV.get(geo)
  if (old?.uv === uv && old.flip === flipX) return
  lastUV.set(geo, { uv, flip: flipX })
  const attr = geo.attributes.uv as THREE.BufferAttribute
  const u0 = flipX ? uv.u1 : uv.u0
  const u1 = flipX ? uv.u0 : uv.u1
  attr.setXY(0, u0, uv.v1)
  attr.setXY(1, u1, uv.v1)
  attr.setXY(2, u0, uv.v0)
  attr.setXY(3, u1, uv.v0)
  attr.needsUpdate = true
}
