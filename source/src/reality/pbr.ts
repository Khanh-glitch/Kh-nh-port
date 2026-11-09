// ORBITA · Procedural PBR Texture Kit — tạo bề mặt vật liệu kiến trúc & thiên nhiên có chiều sâu thực
// (albedo + bumpMap + roughnessMap), tránh cảm giác "nhựa phẳng".
import * as THREE from 'three'

function rnd(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

function makeCanvas(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  draw(ctx)
  return c
}

function toTex(c: HTMLCanvasElement, srgb: boolean, repX = 1, repY = 1) {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  t.wrapS = THREE.RepeatWrapping
  t.wrapT = THREE.RepeatWrapping
  t.repeat.set(repX, repY)
  t.anisotropy = 8
  return t
}

export interface PBRMaps {
  map: THREE.CanvasTexture
  bumpMap: THREE.CanvasTexture
  roughnessMap: THREE.CanvasTexture
}

// ------------------------------------------------------------------ Vỏ cây xà cừ / phượng vĩ
export function createBarkPBR(repX = 2, repY = 4): PBRMaps {
  const S = 512
  const r = rnd(101)
  const alb = makeCanvas(S, S, (c) => {
    c.fillStyle = '#4a382c'
    c.fillRect(0, 0, S, S)
    for (let i = 0; i < 650; i++) {
      const x = r() * S
      const y = r() * S
      const w = 3 + r() * 9
      const h = 40 + r() * 140
      c.fillStyle = r() > 0.45 ? `rgba(34,24,18,${0.25 + r() * 0.4})` : `rgba(112,92,74,${0.15 + r() * 0.25})`
      c.fillRect(x, y, w, h)
    }
    // mảng rêu ẩm dưới thân cây Sài Gòn
    for (let i = 0; i < 60; i++) {
      const x = r() * S
      const y = r() * S
      const rad = 10 + r() * 24
      const g = c.createRadialGradient(x, y, 0, x, y, rad)
      g.addColorStop(0, 'rgba(68,92,50,0.28)')
      g.addColorStop(1, 'rgba(68,92,50,0)')
      c.fillStyle = g
      c.fillRect(x - rad, y - rad, rad * 2, rad * 2)
    }
  })
  const bump = makeCanvas(S, S, (c) => {
    c.fillStyle = '#808080'
    c.fillRect(0, 0, S, S)
    const r2 = rnd(101)
    for (let i = 0; i < 650; i++) {
      const x = r2() * S
      const y = r2() * S
      const w = 3 + r2() * 9
      const h = 40 + r2() * 140
      const v = r2() > 0.45 ? 35 + Math.floor(r2() * 45) : 165 + Math.floor(r2() * 65)
      c.fillStyle = `rgba(${v},${v},${v},0.45)`
      c.fillRect(x, y, w, h)
    }
  })
  const rough = makeCanvas(S, S, (c) => {
    c.fillStyle = '#d8d8d8'
    c.fillRect(0, 0, S, S)
    const r3 = rnd(203)
    for (let i = 0; i < 400; i++) {
      const v = 175 + Math.floor(r3() * 65)
      c.fillStyle = `rgb(${v},${v},${v})`
      c.fillRect(r3() * S, r3() * S, 6 + r3() * 18, 20 + r3() * 80)
    }
  })
  return {
    map: toTex(alb, true, repX, repY),
    bumpMap: toTex(bump, false, repX, repY),
    roughnessMap: toTex(rough, false, repX, repY),
  }
}

// ------------------------------------------------------------------ Vữa tường vàng cổ Cơ sở A (59C Nguyễn Đình Chiểu)
export function createHeritagePlasterPBR(repX = 3, repY = 1.5): PBRMaps {
  const S = 512
  const r = rnd(307)
  const alb = makeCanvas(S, S, (c) => {
    c.fillStyle = '#dcc186'
    c.fillRect(0, 0, S, S)
    for (let i = 0; i < 1600; i++) {
      const warm = r() > 0.45
      c.fillStyle = warm ? `rgba(246,228,184,${0.06 + r() * 0.1})` : `rgba(148,118,70,${0.05 + r() * 0.08})`
      c.fillRect(r() * S, r() * S, 12 + r() * 48, 8 + r() * 34)
    }
    // vệt phong hóa nhẹ dưới chân / mái
    const g = c.createLinearGradient(0, 0, 0, S)
    g.addColorStop(0, 'rgba(90,70,40,0.12)')
    g.addColorStop(0.18, 'rgba(0,0,0,0)')
    g.addColorStop(0.84, 'rgba(0,0,0,0)')
    g.addColorStop(1, 'rgba(72,62,42,0.22)')
    c.fillStyle = g
    c.fillRect(0, 0, S, S)
  })
  const bump = makeCanvas(S, S, (c) => {
    c.fillStyle = '#808080'
    c.fillRect(0, 0, S, S)
    const r2 = rnd(309)
    for (let i = 0; i < 3500; i++) {
      const v = 100 + Math.floor(r2() * 60)
      c.fillStyle = `rgba(${v},${v},${v},0.3)`
      c.fillRect(r2() * S, r2() * S, 3 + r2() * 6, 3 + r2() * 6)
    }
  })
  const rough = makeCanvas(S, S, (c) => {
    c.fillStyle = '#dcdcdc'
    c.fillRect(0, 0, S, S)
    const r3 = rnd(311)
    for (let i = 0; i < 900; i++) {
      const v = 185 + Math.floor(r3() * 60)
      c.fillStyle = `rgb(${v},${v},${v})`
      c.fillRect(r3() * S, r3() * S, 10 + r3() * 30, 10 + r3() * 30)
    }
  })
  return {
    map: toTex(alb, true, repX, repY),
    bumpMap: toTex(bump, false, repX, repY),
    roughnessMap: toTex(rough, false, repX, repY),
  }
}

// ------------------------------------------------------------------ Ngói đất nung Cơ sở A
export function createTerracottaTilePBR(repX = 12, repY = 5): PBRMaps {
  const S = 256
  const r = rnd(401)
  const alb = makeCanvas(S, S, (c) => {
    c.fillStyle = '#9c432b'
    c.fillRect(0, 0, S, S)
    const cols = 8
    const rows = 6
    const cw = S / cols
    const rh = S / rows
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const shade = Math.floor((r() - 0.5) * 26)
        c.fillStyle = `rgb(${156 + shade},${66 + Math.floor(shade * 0.5)},${42 + Math.floor(shade * 0.35)})`
        c.fillRect(i * cw + 1, j * rh + 1, cw - 2, rh - 2)
        // bóng mép dưới viên ngói
        c.fillStyle = 'rgba(28,10,6,0.42)'
        c.fillRect(i * cw, (j + 1) * rh - 5, cw, 5)
        // sống ngói
        c.fillStyle = 'rgba(225,135,96,0.22)'
        c.fillRect(i * cw + cw * 0.35, j * rh + 2, cw * 0.28, rh - 6)
      }
    }
  })
  const bump = makeCanvas(S, S, (c) => {
    c.fillStyle = '#606060'
    c.fillRect(0, 0, S, S)
    const cols = 8
    const rows = 6
    const cw = S / cols
    const rh = S / rows
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const g = c.createLinearGradient(i * cw, 0, (i + 1) * cw, 0)
        g.addColorStop(0, '#444')
        g.addColorStop(0.5, '#eaeaea')
        g.addColorStop(1, '#444')
        c.fillStyle = g
        c.fillRect(i * cw, j * rh, cw, rh - 3)
        c.fillStyle = '#141414'
        c.fillRect(i * cw, (j + 1) * rh - 4, cw, 4)
      }
    }
  })
  const rough = makeCanvas(S, S, (c) => {
    c.fillStyle = '#b8b8b8'
    c.fillRect(0, 0, S, S)
  })
  return {
    map: toTex(alb, true, repX, repY),
    bumpMap: toTex(bump, false, repX, repY),
    roughnessMap: toTex(rough, false, repX, repY),
  }
}

// ------------------------------------------------------------------ Bê tông kiến trúc / ván khuôn (dùng cho cột B1, đài & Pavilion)
export function createConcretePBR(tint = '#d8d6cf', repX = 2, repY = 2): PBRMaps {
  const S = 512
  const r = rnd(503)
  const col = new THREE.Color(tint)
  const alb = makeCanvas(S, S, (c) => {
    c.fillStyle = `#${col.getHexString()}`
    c.fillRect(0, 0, S, S)
    for (let i = 0; i < 2400; i++) {
      const dark = r() > 0.5
      c.fillStyle = dark ? `rgba(30,34,40,${0.03 + r() * 0.06})` : `rgba(255,255,255,${0.03 + r() * 0.05})`
      c.fillRect(r() * S, r() * S, 6 + r() * 24, 6 + r() * 24)
    }
    // khe ghép tấm bê tông
    c.strokeStyle = 'rgba(40,44,50,0.22)'
    c.lineWidth = 2
    for (let y = 0; y <= S; y += 128) {
      c.beginPath()
      c.moveTo(0, y)
      c.lineTo(S, y)
      c.stroke()
    }
    for (let x = 0; x <= S; x += 256) {
      c.beginPath()
      c.moveTo(x, 0)
      c.lineTo(x, S)
      c.stroke()
    }
  })
  const bump = makeCanvas(S, S, (c) => {
    c.fillStyle = '#848484'
    c.fillRect(0, 0, S, S)
    const r2 = rnd(509)
    for (let i = 0; i < 3000; i++) {
      const v = 110 + Math.floor(r2() * 44)
      c.fillStyle = `rgb(${v},${v},${v})`
      c.fillRect(r2() * S, r2() * S, 3 + r2() * 6, 3 + r2() * 6)
    }
    c.strokeStyle = '#303030'
    c.lineWidth = 3
    for (let y = 0; y <= S; y += 128) {
      c.beginPath()
      c.moveTo(0, y)
      c.lineTo(S, y)
      c.stroke()
    }
  })
  const rough = makeCanvas(S, S, (c) => {
    c.fillStyle = '#c2c2c2'
    c.fillRect(0, 0, S, S)
    const r3 = rnd(521)
    for (let i = 0; i < 800; i++) {
      const v = 165 + Math.floor(r3() * 65)
      c.fillStyle = `rgb(${v},${v},${v})`
      c.fillRect(r3() * S, r3() * S, 8 + r3() * 26, 8 + r3() * 26)
    }
  })
  return {
    map: toTex(alb, true, repX, repY),
    bumpMap: toTex(bump, false, repX, repY),
    roughnessMap: toTex(rough, false, repX, repY),
  }
}

// ------------------------------------------------------------------ Gỗ tếch / sồi ấm (bàn ghế sân trường, thư viện, cầu gỗ)
export function createWoodPBR(baseHex = '#8d5d38', repX = 2, repY = 1): PBRMaps {
  const S = 512
  const r = rnd(601)
  const alb = makeCanvas(S, S, (c) => {
    c.fillStyle = baseHex
    c.fillRect(0, 0, S, S)
    for (let y = 0; y < S; y += 3) {
      c.fillStyle = r() > 0.5 ? `rgba(38,20,10,${0.05 + r() * 0.14})` : `rgba(220,175,120,${0.04 + r() * 0.09})`
      c.fillRect(0, y, S, 1 + r() * 3)
    }
    // khe ván gỗ
    c.fillStyle = 'rgba(20,12,6,0.45)'
    for (let y = 64; y < S; y += 64) c.fillRect(0, y, S, 2)
  })
  const bump = makeCanvas(S, S, (c) => {
    c.fillStyle = '#828282'
    c.fillRect(0, 0, S, S)
    const r2 = rnd(607)
    for (let y = 0; y < S; y += 3) {
      const v = 112 + Math.floor(r2() * 34)
      c.fillStyle = `rgb(${v},${v},${v})`
      c.fillRect(0, y, S, 2)
    }
    c.fillStyle = '#242424'
    for (let y = 64; y < S; y += 64) c.fillRect(0, y, S, 3)
  })
  const rough = makeCanvas(S, S, (c) => {
    c.fillStyle = '#a0a0a0'
    c.fillRect(0, 0, S, S)
  })
  return {
    map: toTex(alb, true, repX, repY),
    bumpMap: toTex(bump, false, repX, repY),
    roughnessMap: toTex(rough, false, repX, repY),
  }
}
