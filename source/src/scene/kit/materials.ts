// Hệ vật liệu dùng chung: kim loại gia công, polymer, kính, vải kỹ thuật, bê tông.
// Mỗi vật liệu có vi cấu trúc riêng (bump / roughness map sinh thủ tục) thay vì màu phẳng,
// để khi tiến sát vẫn thấy thớ xước chải, đường ghép tấm, đinh tán, sợi vải, hạt polymer.
import * as THREE from 'three'

type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => void

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function ctex(w: number, h: number, draw: Draw, repeat: [number, number] = [1, 1], srgb = false) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  draw(ctx, w, h)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(repeat[0], repeat[1])
  t.anisotropy = 8
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** Thớ xước chải theo một hướng: dùng cho roughness + bump. */
export const brushedTex = (repeat: [number, number] = [2, 2], seed = 3) =>
  ctex(256, 256, (g, w, h) => {
    const r = rng(seed)
    g.fillStyle = '#8c8c8c'
    g.fillRect(0, 0, w, h)
    for (let i = 0; i < 1400; i++) {
      const y = r() * h
      const l = 20 + r() * 220
      const x = r() * w
      const v = 90 + r() * 110
      g.strokeStyle = `rgba(${v},${v},${v},${0.12 + r() * 0.25})`
      g.lineWidth = 0.5 + r() * 1.1
      g.beginPath()
      g.moveTo(x, y)
      g.lineTo(x + l, y + (r() - 0.5) * 0.6)
      g.stroke()
      if (x + l > w) {
        g.beginPath()
        g.moveTo(x - w, y)
        g.lineTo(x - w + l, y)
        g.stroke()
      }
    }
  }, repeat)

/** Đường ghép tấm + đinh tán: bump map cho vỏ kim loại. */
export const panelTex = (repeat: [number, number] = [1, 1], cells = 4) =>
  ctex(512, 512, (g, w, h) => {
    g.fillStyle = '#b4b4b4'
    g.fillRect(0, 0, w, h)
    const cw = w / cells
    const r = rng(11)
    for (let i = 0; i < cells; i++)
      for (let j = 0; j < cells; j++) {
        const v = 168 + r() * 26
        g.fillStyle = `rgb(${v},${v},${v})`
        g.fillRect(i * cw + 3, j * cw + 3, cw - 6, cw - 6)
        g.strokeStyle = '#222'
        g.lineWidth = 3
        g.strokeRect(i * cw + 1.5, j * cw + 1.5, cw - 3, cw - 3)
        for (const [dx, dy] of [[10, 10], [cw - 10, 10], [10, cw - 10], [cw - 10, cw - 10]]) {
          const gr = g.createRadialGradient(i * cw + dx, j * cw + dy, 0, i * cw + dx, j * cw + dy, 4)
          gr.addColorStop(0, '#fff')
          gr.addColorStop(1, '#8a8a8a')
          g.fillStyle = gr
          g.beginPath()
          g.arc(i * cw + dx, j * cw + dy, 3.4, 0, Math.PI * 2)
          g.fill()
        }
      }
  }, repeat)

/** Hạt polymer / sơn nhám. */
export const grainTex = (repeat: [number, number] = [4, 4], seed = 7) =>
  ctex(128, 128, (g, w, h) => {
    const r = rng(seed)
    const id = g.createImageData(w, h)
    for (let i = 0; i < id.data.length; i += 4) {
      const v = 108 + r() * 40
      id.data[i] = id.data[i + 1] = id.data[i + 2] = v
      id.data[i + 3] = 255
    }
    g.putImageData(id, 0, 0)
  }, repeat)

/** Vải dệt kỹ thuật (acoustic cloth / nhung): bump + sắc độ. */
export const weaveTex = (repeat: [number, number] = [10, 10]) =>
  ctex(64, 64, (g, w, h) => {
    g.fillStyle = '#777'
    g.fillRect(0, 0, w, h)
    const n = 8
    const c = w / n
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const over = (i + j) % 2 === 0
        const gr = over ? g.createLinearGradient(i * c, 0, (i + 1) * c, 0) : g.createLinearGradient(0, j * c, 0, (j + 1) * c)
        gr.addColorStop(0, '#666')
        gr.addColorStop(0.5, '#f0f0f0')
        gr.addColorStop(1, '#666')
        g.fillStyle = gr
        g.fillRect(i * c + 0.5, j * c + 0.5, c - 1, c - 1)
      }
  }, repeat, true)

/** Thảm tối có hoạ tiết hình học rất nhẹ (sàn rạp). */
export const carpetTex = (repeat: [number, number] = [3, 3]) =>
  ctex(512, 512, (g, w, h) => {
    g.fillStyle = '#240c14'
    g.fillRect(0, 0, w, h)
    const r = rng(5)
    for (let i = 0; i < 9000; i++) {
      const v = 18 + r() * 30
      g.fillStyle = `rgba(${v + 30},${v * 0.55},${v * 0.65},0.55)`
      g.fillRect(r() * w, r() * h, 1.5, 1.5)
    }
    g.strokeStyle = 'rgba(210,150,90,0.18)'
    g.lineWidth = 1.5
    const s = 64
    for (let i = 0; i <= w / s; i++)
      for (let j = 0; j <= h / s; j++) {
        g.beginPath()
        g.moveTo(i * s, j * s - s / 2)
        g.lineTo(i * s + s / 2, j * s)
        g.lineTo(i * s, j * s + s / 2)
        g.lineTo(i * s - s / 2, j * s)
        g.closePath()
        g.stroke()
      }
  }, repeat, true)

/** Bê tông đổ tại chỗ + khe co giãn. */
export const concreteTex = (repeat: [number, number] = [3, 3]) =>
  ctex(512, 512, (g, w, h) => {
    const r = rng(21)
    g.fillStyle = '#6e7178'
    g.fillRect(0, 0, w, h)
    for (let i = 0; i < 260; i++) {
      const v = 80 + r() * 60
      g.fillStyle = `rgba(${v},${v},${v + 4},0.12)`
      g.beginPath()
      g.arc(r() * w, r() * h, 10 + r() * 60, 0, Math.PI * 2)
      g.fill()
    }
    for (let i = 0; i < 6000; i++) {
      const v = r() * 255
      g.fillStyle = `rgba(${v},${v},${v},0.08)`
      g.fillRect(r() * w, r() * h, 1.5, 1.5)
    }
    g.strokeStyle = 'rgba(10,10,14,0.7)'
    g.lineWidth = 3
    g.strokeRect(0, 0, w, h)
  }, repeat, true)

/** Lưới thanh grating (bump) cho sàn thao tác. */
export const gratingTex = (repeat: [number, number] = [4, 4]) =>
  ctex(128, 128, (g, w, h) => {
    g.fillStyle = '#222'
    g.fillRect(0, 0, w, h)
    g.fillStyle = '#d0d0d0'
    for (let i = 0; i < 8; i++) g.fillRect(i * 16 + 2, 0, 5, h)
    g.fillStyle = '#9a9a9a'
    for (let i = 0; i < 4; i++) g.fillRect(0, i * 32 + 13, w, 4)
  }, repeat)

let cache: ReturnType<typeof build> | null = null
export const kit = () => (cache ??= build())

const ledCache = new Map<string, THREE.MeshBasicMaterial>()
/** Vật liệu phát sáng (không bị tone-map) dùng chung theo màu. */
export function led(color: string, k = 3) {
  const key = color + k
  let m = ledCache.get(key)
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), toneMapped: false })
    ledCache.set(key, m)
  }
  return m
}

function build() {
  const brushed = brushedTex([3, 3])
  const brushedLong = brushedTex([1, 6], 9)
  const panel = panelTex([1, 1])
  const grain = grainTex([6, 6])
  const grainFine = grainTex([14, 14], 17)
  const concrete = concreteTex([2, 2])
  const grating = gratingTex([6, 6])

  const titanium = new THREE.MeshStandardMaterial({ color: '#aeb6c4', metalness: 1, roughness: 1, roughnessMap: brushed, bumpMap: brushed, bumpScale: 0.6, envMapIntensity: 1.35 })
  const titaniumLong = new THREE.MeshStandardMaterial({ color: '#a9b1bf', metalness: 1, roughness: 1, roughnessMap: brushedLong, bumpMap: brushedLong, bumpScale: 0.5, envMapIntensity: 1.35 })
  const gunmetal = new THREE.MeshStandardMaterial({ color: '#4c5362', metalness: 1, roughness: 1, roughnessMap: brushed, bumpMap: brushed, bumpScale: 0.5, envMapIntensity: 1.3 })
  const anodized = new THREE.MeshStandardMaterial({ color: '#1b1f29', metalness: 0.9, roughness: 0.45, bumpMap: panel, bumpScale: 0.9, envMapIntensity: 1.25 })
  const polymer = new THREE.MeshStandardMaterial({ color: '#14161d', metalness: 0.05, roughness: 0.62, bumpMap: grain, bumpScale: 0.35, envMapIntensity: 0.7 })
  const polymerSoft = new THREE.MeshStandardMaterial({ color: '#0d0f14', metalness: 0, roughness: 0.82, bumpMap: grainFine, bumpScale: 0.5, envMapIntensity: 0.4 })
  const rubber = new THREE.MeshStandardMaterial({ color: '#0a0b0e', metalness: 0, roughness: 0.92, bumpMap: grainFine, bumpScale: 0.6 })
  const paintWhite = new THREE.MeshPhysicalMaterial({ color: '#d9dde6', metalness: 0.1, roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.3, bumpMap: grain, bumpScale: 0.25, envMapIntensity: 1.1 })
  const paintRed = new THREE.MeshPhysicalMaterial({ color: '#c8281f', metalness: 0.1, roughness: 0.4, clearcoat: 0.7, clearcoatRoughness: 0.25, envMapIntensity: 1.0 })
  const zinc = new THREE.MeshStandardMaterial({ color: '#b9c0cc', metalness: 0.9, roughness: 0.55, bumpMap: grainFine, bumpScale: 0.8, envMapIntensity: 1.1 })
  const bronze = new THREE.MeshStandardMaterial({ color: '#b07a45', metalness: 1, roughness: 1, roughnessMap: brushed, bumpMap: brushed, bumpScale: 0.4, envMapIntensity: 1.3 })
  const bronzeDark = new THREE.MeshStandardMaterial({ color: '#4a3220', metalness: 1, roughness: 0.55, bumpMap: panel, bumpScale: 0.6, envMapIntensity: 1.1 })
  const concreteM = new THREE.MeshStandardMaterial({ color: '#cfd3da', map: concrete, roughness: 0.92, metalness: 0, bumpMap: concrete, bumpScale: 1.4, envMapIntensity: 0.5 })
  const gratingM = new THREE.MeshStandardMaterial({ color: '#8d94a1', metalness: 0.85, roughness: 0.5, bumpMap: grating, bumpScale: 1.2, envMapIntensity: 1.0 })
  const glass = new THREE.MeshPhysicalMaterial({ color: '#bfe6ff', metalness: 0, roughness: 0.04, transparent: true, opacity: 0.16, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 2.4, side: THREE.DoubleSide, depthWrite: false })
  const glassSmoke = new THREE.MeshPhysicalMaterial({ color: '#0b1220', metalness: 0.2, roughness: 0.05, transparent: true, opacity: 0.55, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 2.2, side: THREE.DoubleSide, depthWrite: false })
  const screenGlass = new THREE.MeshPhysicalMaterial({ color: '#05070b', metalness: 0.3, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 2.0 })
  const fabric = (color: string, repeat: [number, number] = [8, 8]) => {
    const wt = weaveTex(repeat)
    return new THREE.MeshStandardMaterial({ color, map: wt, bumpMap: wt, bumpScale: 1.6, roughness: 1, metalness: 0, envMapIntensity: 0.25 })
  }
  const velvet = new THREE.MeshPhysicalMaterial({ color: '#7c1022', roughness: 0.9, metalness: 0, sheen: 1, sheenRoughness: 0.45, sheenColor: new THREE.Color('#ff6a7e'), bumpMap: grainFine, bumpScale: 0.4, envMapIntensity: 0.2, side: THREE.DoubleSide })
  const leather = new THREE.MeshPhysicalMaterial({ color: '#3a0d16', roughness: 0.52, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.45, sheen: 0.4, sheenColor: new THREE.Color('#a02a40'), bumpMap: grain, bumpScale: 0.45, envMapIntensity: 0.5 })
  const carpet = new THREE.MeshStandardMaterial({ color: '#ffffff', map: carpetTex([2.4, 2.6]), roughness: 1, metalness: 0, envMapIntensity: 0.1 })

  return {
    titanium, titaniumLong, gunmetal, anodized, polymer, polymerSoft, rubber, paintWhite, paintRed, zinc, bronze, bronzeDark,
    concrete: concreteM, grating: gratingM, glass, glassSmoke, screenGlass, fabric, velvet, leather, carpet,
  }
}
