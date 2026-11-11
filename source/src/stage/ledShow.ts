import type { Show } from './shows'

export const LED_W = 1024
export const LED_H = 410
// vùng 16:9 ở giữa LED dành cho video (iframe YouTube phủ đúng vùng này)
export const VID_W = Math.round((LED_H * 16) / 9)
export const VID_X = Math.round((LED_W - VID_W) / 2)

const SANS = '"Space Grotesk", "Segoe UI", system-ui, sans-serif'
const SERIF = 'Georgia, "Times New Roman", serif'

const fract = (x: number) => x - Math.floor(x)
const hash = (n: number) => fract(Math.sin(n * 127.1) * 43758.5453)
const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))

export interface LedFrame {
  t: number // giây thế giới
  el: number // giây kể từ khi chọn show
  beat: number // 0..1, xung nhịp
  bar: number // số ô nhịp đã trôi qua
  video: number // độ phủ video 0..1
  imgs: HTMLImageElement[]
}

function kenBurns(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, p: number, seed: number, alpha: number) {
  if (alpha <= 0) return
  const iw = img.naturalWidth
  const ih = img.naturalHeight
  const s = Math.max(w / iw, h / ih) * (1.06 + 0.1 * p)
  const dw = iw * s
  const dh = ih * s
  const dx = x + (w - dw) * (0.5 + 0.35 * Math.sin(seed * 3.1) * (p - 0.5))
  const dy = y + (h - dh) * (0.5 + 0.3 * Math.cos(seed * 2.3) * (p - 0.5))
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()
  ctx.drawImage(img, dx, dy, dw, dh)
  ctx.restore()
}

/** Trình chiếu ảnh thật: crossfade + Ken Burns trong khung (x,y,w,h). */
function slideshow(ctx: CanvasRenderingContext2D, f: LedFrame, x: number, y: number, w: number, h: number, period = 7, alpha = 1) {
  const n = f.imgs.length
  if (!n) return false
  const k = f.el / period
  const i = Math.floor(k)
  const p = k - i
  const a = f.imgs[i % n]
  kenBurns(ctx, a, x, y, w, h, p, i, alpha)
  if (p > 0.82 && n > 1) kenBurns(ctx, f.imgs[(i + 1) % n], x, y, w, h, 0, i + 1, alpha * ease((p - 0.82) / 0.18))
  return true
}

function vignette(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, amt = 0.8) {
  const g = ctx.createRadialGradient(x + w / 2, y + h / 2, Math.min(w, h) * 0.25, x + w / 2, y + h / 2, Math.max(w, h) * 0.65)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(1, color)
  ctx.globalAlpha = amt
  ctx.fillStyle = g
  ctx.fillRect(x, y, w, h)
  ctx.globalAlpha = 1
}

function glowText(ctx: CanvasRenderingContext2D, txt: string, x: number, y: number, font: string, color: string, glow: string, blur = 24) {
  ctx.font = font
  ctx.shadowColor = glow
  ctx.shadowBlur = blur
  ctx.fillStyle = color
  ctx.fillText(txt, x, y)
  ctx.shadowBlur = blur * 0.4
  ctx.fillText(txt, x, y)
  ctx.shadowBlur = 0
}

// ---------------------------------------------------------------- GET DOWNTOWN
function drawGDT(ctx: CanvasRenderingContext2D, W: number, H: number, f: LedFrame) {
  const scene = Math.floor(f.bar / 4) % 4
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#12002b')
  bg.addColorStop(1, '#2a0040')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  const cx = W / 2
  const cy = H / 2
  if (scene === 0) {
    // marquee rạp phim neon
    ctx.textAlign = 'center'
    const bulbs = 38
    for (let i = 0; i < bulbs; i++) {
      const on = (i + Math.floor(f.t * 10)) % 3 === 0
      const bx = cx - 330 + (i / (bulbs - 1)) * 660
      for (const by of [cy - 120, cy + 110]) {
        ctx.fillStyle = on ? '#ffe9a8' : '#5a2a10'
        ctx.shadowColor = '#ffb84a'
        ctx.shadowBlur = on ? 14 : 0
        ctx.beginPath()
        ctx.arc(bx, by, 5, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.shadowBlur = 0
    glowText(ctx, 'GET DOWNTOWN', cx, cy - 22, `700 74px ${SANS}`, '#ffd6fb', '#ff2bd6', 30 + f.beat * 20)
    glowText(ctx, '|SI:N|', cx, cy + 62, `700 64px ${SANS}`, '#e6ffb0', '#c6ff1a', 26 + f.beat * 24)
    ctx.font = `600 15px ${SANS}`
    ctx.fillStyle = 'rgba(255,255,255,0.75)'
    ctx.fillText('T H E   S C E N E   Y O U   H A V E   E V E R   S E E N', cx, cy + 96)
  } else if (scene === 1) {
    // tia nắng xoay (LED sunburst như tiết mục thật)
    const rays = 22
    ctx.save()
    ctx.translate(cx, H * 1.05)
    ctx.rotate(f.t * 0.15)
    for (let i = 0; i < rays; i++) {
      ctx.fillStyle = i % 2 ? '#ff6a1a' : '#ffc23d'
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.arc(0, 0, W, (i / rays) * Math.PI * 2, ((i + 1) / rays) * Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
    vignette(ctx, 0, 0, W, H, '#3a0010', 0.9)
  } else if (scene === 2) {
    // sọc xiếc The Greatest Showman
    const sw = 64
    const off = (f.t * 40) % (sw * 2)
    for (let x = -sw * 2; x < W + sw * 2; x += sw * 2) {
      ctx.fillStyle = '#d4142a'
      ctx.fillRect(x + off, 0, sw, H)
      ctx.fillStyle = '#fff1e0'
      ctx.fillRect(x + off + sw, 0, sw, H)
    }
    const g = ctx.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, 'rgba(20,0,30,0.85)')
    g.addColorStop(0.45, 'rgba(20,0,30,0.1)')
    g.addColorStop(1, 'rgba(20,0,30,0.9)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
    ctx.textAlign = 'center'
    glowText(ctx, 'THE GREATEST SHOWMAN', cx, 78, `700 50px ${SANS}`, '#fff', '#ff2bd6', 24)
  } else {
    // ảnh thật như một cuộn phim chiếu với nhiễu máy chiếu
    if (!slideshow(ctx, f, 0, 0, W, H, 5.5)) {
      ctx.fillStyle = '#1a0030'
      ctx.fillRect(0, 0, W, H)
    }
    ctx.fillStyle = `rgba(255,240,220,${0.04 + 0.05 * hash(Math.floor(f.t * 24))})`
    ctx.fillRect(0, 0, W, H)
    vignette(ctx, 0, 0, W, H, 'rgba(10,0,20,1)', 0.85)
  }
  // dải phim chạy ngang ở mép trên/dưới — chữ ký "memory reel"
  const chap = ['CHILDHOOD', 'TEENAGE', 'ADULTHOOD', 'FINALE'][Math.floor(f.bar / 8) % 4]
  for (const y of [0, H - 26]) {
    ctx.fillStyle = 'rgba(0,0,0,0.85)'
    ctx.fillRect(0, y, W, 26)
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    const o = (f.t * 60) % 32
    for (let x = -32; x < W; x += 32) ctx.fillRect(x + o, y + 8, 14, 10)
  }
  ctx.textAlign = 'left'
  ctx.font = `700 12px ${SANS}`
  ctx.fillStyle = '#c6ff1a'
  ctx.fillText(`CHAPTER · ${chap}`, 16, 46)
}

// ------------------------------------------------------------ MỘT CHÚT YÊU THƯƠNG
function heart(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.beginPath()
  ctx.moveTo(x, y + s * 0.3)
  ctx.bezierCurveTo(x, y, x - s * 0.5, y - s * 0.1, x - s * 0.5, y + s * 0.3)
  ctx.bezierCurveTo(x - s * 0.5, y + s * 0.6, x, y + s * 0.8, x, y + s)
  ctx.bezierCurveTo(x, y + s * 0.8, x + s * 0.5, y + s * 0.6, x + s * 0.5, y + s * 0.3)
  ctx.bezierCurveTo(x + s * 0.5, y - s * 0.1, x, y, x, y + s * 0.3)
  ctx.fill()
}

function drawMCYT(ctx: CanvasRenderingContext2D, W: number, H: number, f: LedFrame) {
  const scene = Math.floor(f.el / 14) % 3
  const breath = 0.5 + 0.5 * Math.sin(f.t * ((Math.PI * 2) / (60 / 66)) * 0.25)
  if (scene === 1) {
    // trời mây xanh (như phần hợp xướng thật)
    const g = ctx.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, '#3f8fe0')
    g.addColorStop(0.7, '#a9d8ff')
    g.addColorStop(1, '#eaf6ff')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
    for (let i = 0; i < 16; i++) {
      const x = ((hash(i) * W + f.t * (6 + hash(i + 3) * 10)) % (W + 300)) - 150
      const y = H * (0.25 + hash(i + 9) * 0.55)
      const r = 60 + hash(i + 5) * 90
      const cg = ctx.createRadialGradient(x, y, 0, x, y, r)
      cg.addColorStop(0, 'rgba(255,255,255,0.75)')
      cg.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = cg
      ctx.fillRect(x - r, y - r, r * 2, r * 2)
    }
    const sg = ctx.createRadialGradient(W / 2, H * 0.32, 0, W / 2, H * 0.32, 160)
    sg.addColorStop(0, 'rgba(255,255,240,0.95)')
    sg.addColorStop(1, 'rgba(255,255,240,0)')
    ctx.fillStyle = sg
    ctx.fillRect(0, 0, W, H)
  } else {
    const g = ctx.createLinearGradient(0, 0, W, H)
    g.addColorStop(0, '#5a0a4a')
    g.addColorStop(0.5, '#d62a8a')
    g.addColorStop(1, '#7a2ad6')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
    if (scene === 2) slideshow(ctx, f, 0, 0, W, H, 6, 0.9)
    // trái tim trôi
    ctx.globalCompositeOperation = 'lighter'
    for (let i = 0; i < 26; i++) {
      const s = 18 + hash(i) * 70
      const x = hash(i + 1) * W + Math.sin(f.t * 0.4 + i) * 20
      const y = H + 60 - ((f.t * (10 + hash(i + 2) * 18) + hash(i + 3) * H) % (H + 140))
      ctx.fillStyle = `rgba(255,${120 + hash(i + 4) * 100},${190 + hash(i) * 60},${0.12 + 0.18 * hash(i + 6) + breath * 0.08})`
      heart(ctx, x, y, s)
    }
    ctx.globalCompositeOperation = 'source-over'
    if (scene === 2) vignette(ctx, 0, 0, W, H, 'rgba(90,10,70,1)', 0.75)
  }
  // chữ viết tay
  ctx.textAlign = 'center'
  const ink = scene === 1 ? '#ffffff' : '#fff2fa'
  glowText(ctx, 'Một Chút', W / 2 - 40, H / 2 - 18, `italic 600 62px ${SERIF}`, ink, '#ff5fb4', 30 + breath * 18)
  glowText(ctx, 'Yêu Thương', W / 2 + 30, H / 2 + 50, `italic 600 70px ${SERIF}`, ink, '#ff5fb4', 30 + breath * 18)
  ctx.fillStyle = '#ffffff'
  ctx.font = `700 12px ${SANS}`
  ctx.fillText('C H Ư Ơ N G   T R Ì N H   N G H Ệ   T H U Ậ T   ·   L Ầ N   3', W / 2, H / 2 + 86)
}

// ------------------------------------------------------------ BẢN GIAO HƯỞNG XANH
function tree(ctx: CanvasRenderingContext2D, x: number, base: number, h: number, sway: number, col: string) {
  ctx.strokeStyle = col
  ctx.fillStyle = col
  ctx.lineCap = 'round'
  const branch = (x0: number, y0: number, a: number, len: number, w: number, d: number) => {
    const x1 = x0 + Math.sin(a) * len
    const y1 = y0 - Math.cos(a) * len
    ctx.lineWidth = w
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    ctx.lineTo(x1, y1)
    ctx.stroke()
    if (d <= 0) {
      ctx.beginPath()
      ctx.arc(x1, y1, len * 0.9, 0, Math.PI * 2)
      ctx.fill()
      return
    }
    branch(x1, y1, a - 0.45 + sway, len * 0.74, w * 0.66, d - 1)
    branch(x1, y1, a + 0.4 + sway, len * 0.7, w * 0.66, d - 1)
  }
  branch(x, base, sway * 0.3, h * 0.36, h * 0.07, 4)
}

function drawBGHX(ctx: CanvasRenderingContext2D, W: number, H: number, f: LedFrame) {
  const scene = Math.floor(f.el / 16) % 3
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#0b1f2e')
  g.addColorStop(0.55, '#3e6f78')
  g.addColorStop(1, '#cfe9e4')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  if (scene === 2) slideshow(ctx, f, 0, 0, W, H, 7, 0.85)
  // các lớp rừng trong sương
  const layers = scene === 2 ? 1 : 3
  for (let l = 0; l < layers; l++) {
    const a = 0.25 + l * 0.22
    for (let i = 0; i < 7; i++) {
      const x = ((i + 0.5) / 7) * W + Math.sin(l * 3 + i) * 50
      tree(ctx, x, H + 10, H * (0.5 + l * 0.18 + hash(i + l * 7) * 0.2), Math.sin(f.t * 0.3 + i + l) * 0.03, `rgba(${10 + l * 8},${40 + l * 12},${48 + l * 10},${a})`)
    }
    const fog = ctx.createLinearGradient(0, H * 0.4, 0, H)
    fog.addColorStop(0, 'rgba(200,235,235,0)')
    fog.addColorStop(1, `rgba(210,240,236,${0.28 - l * 0.06})`)
    ctx.fillStyle = fog
    ctx.fillRect(0, 0, W, H)
  }
  // cây lớn trung tâm — như tán cây thật phía sau sân khấu ngoài trời
  if (scene !== 2) tree(ctx, W / 2, H + 20, H * 1.25, Math.sin(f.t * 0.25) * 0.02, 'rgba(4,22,26,0.82)')
  // tia sáng trời
  ctx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < 5; i++) {
    const x = W * (0.2 + i * 0.15) + Math.sin(f.t * 0.2 + i) * 30
    const rg = ctx.createLinearGradient(x, 0, x + 120, H)
    rg.addColorStop(0, 'rgba(230,255,250,0.22)')
    rg.addColorStop(1, 'rgba(230,255,250,0)')
    ctx.fillStyle = rg
    ctx.beginPath()
    ctx.moveTo(x - 20, 0)
    ctx.lineTo(x + 20, 0)
    ctx.lineTo(x + 180, H)
    ctx.lineTo(x + 40, H)
    ctx.fill()
  }
  // đom đóm / ánh nến
  for (let i = 0; i < 60; i++) {
    const x = (hash(i) * W + Math.sin(f.t * 0.5 + i) * 14) % W
    const y = H - ((f.t * (4 + hash(i + 1) * 8) + hash(i + 2) * H) % H)
    const a = 0.4 + 0.6 * Math.abs(Math.sin(f.t * 2 + i))
    ctx.fillStyle = `rgba(255,236,170,${a})`
    ctx.fillRect(x, y, 2.4, 2.4)
  }
  ctx.globalCompositeOperation = 'source-over'
  ctx.textAlign = 'center'
  glowText(ctx, 'Bản Giao Hưởng Xanh', W / 2, H * 0.3, `italic 500 58px ${SERIF}`, '#f2fffb', '#5ff2c8', 26)
  ctx.font = `700 12px ${SANS}`
  ctx.fillStyle = 'rgba(240,255,250,0.85)'
  ctx.fillText('K H A I   M Ạ C   T H Á N G   C Ô N G   N H Â N   L Ầ N   T H Ứ   1 8', W / 2, H * 0.3 + 30)
}

/** Vẽ một khung LED cho show. */
export function drawShowLED(ctx: CanvasRenderingContext2D, show: Show, f: LedFrame) {
  const W = LED_W
  const H = LED_H
  ctx.globalCompositeOperation = 'source-over'
  ctx.shadowBlur = 0
  ctx.globalAlpha = 1
  // 0 – 1.1s: blackout
  if (f.el < 1.1) {
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, W, H)
    const k = f.el / 1.1
    ctx.fillStyle = `rgba(255,255,255,${(1 - k) * 0.15})`
    ctx.fillRect(0, H / 2 - 1, W, 2)
    return
  }
  if (show.id === 'gdt') drawGDT(ctx, W, H, f)
  else if (show.id === 'mcyt') drawMCYT(ctx, W, H, f)
  else drawBGHX(ctx, W, H, f)

  // boot: đường quét sáng mở dần nội dung từ giữa ra
  const boot = (f.el - 1.1) / 1.6
  if (boot < 1) {
    const r = ease(boot) * (W / 2)
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, W / 2 - r, H)
    ctx.fillRect(W / 2 + r, 0, W / 2 - r, H)
    ctx.fillStyle = show.look.accent
    ctx.fillRect(W / 2 - r - 2, 0, 3, H)
    ctx.fillRect(W / 2 + r - 1, 0, 3, H)
  }
  // khi video phát: vùng giữa nhường cho iframe, hai cánh LED vẫn là nội dung của show
  if (f.video > 0) {
    ctx.fillStyle = `rgba(0,0,0,${f.video})`
    ctx.fillRect(VID_X, 0, VID_W, H)
    ctx.fillStyle = show.look.accent
    ctx.globalAlpha = f.video * (0.5 + 0.5 * f.beat)
    ctx.fillRect(VID_X - 3, 0, 2, H)
    ctx.fillRect(VID_X + VID_W + 1, 0, 2, H)
    ctx.globalAlpha = 1
  }
  // lưới điểm ảnh LED rất nhẹ
  ctx.fillStyle = 'rgba(0,0,0,0.12)'
  for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1)
}
