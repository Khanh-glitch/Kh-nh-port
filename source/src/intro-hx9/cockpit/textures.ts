import * as THREE from 'three';
import type { CockpitSection, SectionId } from '../data/blueprint';

const TAU = Math.PI * 2;

export function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  return [c, ctx];
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function textureFromCanvas(canvas: HTMLCanvasElement, repeat = 1, srgb = true): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = 8;
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  return tex;
}

/**
 * Convert a tileable grayscale height canvas into a true tangent-space RGB normal map
 * using a wrapped 3x3 Sobel operator. Produces crisp close-range micro-surface relief.
 */
export function heightToNormalMap(
  heightCanvas: HTMLCanvasElement,
  strength = 2.0,
  repeat = 4,
): THREE.CanvasTexture {
  const w = heightCanvas.width;
  const h = heightCanvas.height;
  const srcCtx = heightCanvas.getContext('2d');
  if (!srcCtx) throw new Error('2D canvas unavailable');
  const src = srcCtx.getImageData(0, 0, w, h).data;

  const [outCanvas, outCtx] = makeCanvas(w, h);
  const outImg = outCtx.createImageData(w, h);
  const dst = outImg.data;

  const sample = (x: number, y: number) => {
    const xx = ((x % w) + w) % w;
    const yy = ((y % h) + h) % h;
    return src[(yy * w + xx) * 4] / 255;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tl = sample(x - 1, y - 1);
      const t = sample(x, y - 1);
      const tr = sample(x + 1, y - 1);
      const l = sample(x - 1, y);
      const r = sample(x + 1, y);
      const bl = sample(x - 1, y + 1);
      const b = sample(x, y + 1);
      const br = sample(x + 1, y + 1);

      const dx = (tr + 2 * r + br - (tl + 2 * l + bl)) * strength;
      const dy = (bl + 2 * b + br - (tl + 2 * t + tr)) * strength;
      const dz = 1.0;
      const invLen = 1 / Math.hypot(dx, dy, dz);

      const idx = (y * w + x) * 4;
      dst[idx] = Math.round((-dx * invLen * 0.5 + 0.5) * 255);
      dst[idx + 1] = Math.round((-dy * invLen * 0.5 + 0.5) * 255);
      dst[idx + 2] = Math.round((dz * invLen * 0.5 + 0.5) * 255);
      dst[idx + 3] = 255;
    }
  }
  outCtx.putImageData(outImg, 0, 0);
  return textureFromCanvas(outCanvas, repeat, false);
}

export interface SurfaceMapPair {
  roughness: THREE.CanvasTexture;
  normal: THREE.CanvasTexture;
}

/* ── 1. CNC-Milled 7075-T6 Aluminium (cycloidal tool marks + fine brush) ─── */
export function milledMetalMaps(seed = 11, repeat = 4): SurfaceMapPair {
  const [c, x] = makeCanvas(512, 512);
  x.fillStyle = '#808080';
  x.fillRect(0, 0, 512, 512);
  const r = rng(seed);

  // Subtle overlapping face-mill trochoidal arcs
  for (let row = 0; row < 8; row++) {
    const cy = row * 64 + 32;
    for (let i = -2; i < 28; i++) {
      const cx = i * 22 + (row % 2) * 11;
      const v = Math.floor(116 + r() * 26);
      x.strokeStyle = `rgba(${v},${v},${v},0.16)`;
      x.lineWidth = 1.1;
      x.beginPath();
      x.arc(cx, cy, 36, -0.95, 0.95);
      x.stroke();
    }
  }
  // Fine anisotropic linear grain
  for (let i = 0; i < 680; i++) {
    const y = r() * 512;
    const v = Math.floor(102 + r() * 52);
    x.strokeStyle = `rgba(${v},${v},${v},${0.08 + r() * 0.14})`;
    x.lineWidth = 0.5 + r() * 0.9;
    x.beginPath();
    x.moveTo(0, y);
    x.lineTo(512, y + (r() - 0.5) * 1.2);
    x.stroke();
  }
  return {
    roughness: textureFromCanvas(c, repeat, false),
    normal: heightToNormalMap(c, 1.35, repeat),
  };
}

/* ── 2. Cast / Bead-Blasted Aerospace Alloy (isotropic granular stipple) ─── */
export function castMetalMaps(seed = 29, repeat = 6): SurfaceMapPair {
  const [c, x] = makeCanvas(256, 256);
  x.fillStyle = '#848484';
  x.fillRect(0, 0, 256, 256);
  const r = rng(seed);
  for (let i = 0; i < 4800; i++) {
    const v = Math.floor(96 + r() * 68);
    x.fillStyle = `rgba(${v},${v},${v},${0.16 + r() * 0.22})`;
    const rad = 0.5 + r() * 1.4;
    x.beginPath();
    x.arc(r() * 256, r() * 256, rad, 0, TAU);
    x.fill();
  }
  return {
    roughness: textureFromCanvas(c, repeat, false),
    normal: heightToNormalMap(c, 1.5, repeat),
  };
}

/* ── 3. Powder-Coated / Painted Instrument Panel (subtle orange-peel) ────── */
export function paintedPanelMaps(seed = 43, repeat = 5): SurfaceMapPair {
  const [c, x] = makeCanvas(256, 256);
  x.fillStyle = '#8e8e8e';
  x.fillRect(0, 0, 256, 256);
  const r = rng(seed);
  for (let i = 0; i < 1600; i++) {
    const cx = r() * 256;
    const cy = r() * 256;
    const rad = 1.4 + r() * 3.2;
    const v = Math.floor(118 + r() * 36);
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, rad);
    g.addColorStop(0, `rgba(${v},${v},${v},0.18)`);
    g.addColorStop(1, 'rgba(142,142,142,0)');
    x.fillStyle = g;
    x.beginPath();
    x.arc(cx, cy, rad, 0, TAU);
    x.fill();
  }
  return {
    roughness: textureFromCanvas(c, repeat, false),
    normal: heightToNormalMap(c, 0.9, repeat),
  };
}

/* ── 4. 2x2 Twill CFRP Composite Weave ────────────────────────────────────── */
export function carbonTwillMaps(repeat = 9): SurfaceMapPair {
  const [c, x] = makeCanvas(256, 256);
  x.fillStyle = '#5c5c5c';
  x.fillRect(0, 0, 256, 256);
  const cell = 16;
  // 2x2 twill diagonal step pattern: (row + col) mod 4 < 2
  for (let row = 0; row < 16; row++) {
    for (let col = 0; col < 16; col++) {
      const warpOver = (row + col) % 4 < 2;
      const px = col * cell;
      const py = row * cell;
      const grad = warpOver
        ? x.createLinearGradient(px, py, px, py + cell)
        : x.createLinearGradient(px, py, px + cell, py);
      grad.addColorStop(0, '#444444');
      grad.addColorStop(0.25, warpOver ? '#a8a8a8' : '#949494');
      grad.addColorStop(0.5, warpOver ? '#c2c2c2' : '#adadad');
      grad.addColorStop(0.75, warpOver ? '#a8a8a8' : '#949494');
      grad.addColorStop(1, '#444444');
      x.fillStyle = grad;
      x.fillRect(px + 0.5, py + 0.5, cell - 1, cell - 1);

      // Individual carbon filament micro-striations inside each tow
      x.strokeStyle = 'rgba(20,20,20,0.22)';
      x.lineWidth = 0.8;
      for (let k = 3; k < cell - 2; k += 3) {
        x.beginPath();
        if (warpOver) {
          x.moveTo(px + k, py + 1);
          x.lineTo(px + k, py + cell - 1);
        } else {
          x.moveTo(px + 1, py + k);
          x.lineTo(px + cell - 1, py + k);
        }
        x.stroke();
      }
    }
  }
  return {
    roughness: textureFromCanvas(c, repeat, false),
    normal: heightToNormalMap(c, 2.2, repeat),
  };
}

/* ── 5. Nomex / Cordura Ripstop Technical Upholstery ──────────────────────── */
export function ripstopFabricMaps(repeat = 14): SurfaceMapPair {
  const [c, x] = makeCanvas(256, 256);
  x.fillStyle = '#7c7c7c';
  x.fillRect(0, 0, 256, 256);
  const step = 8;
  for (let row = 0; row < 32; row++) {
    for (let col = 0; col < 32; col++) {
      const over = (row + col) % 2 === 0;
      const rip = row % 8 === 0 || col % 8 === 0;
      const g = rip ? 168 : over ? 142 : 112;
      x.fillStyle = `rgb(${g},${g},${g})`;
      x.fillRect(col * step + 0.5, row * step + 0.5, step - 1, step - 1);
    }
  }
  return {
    roughness: textureFromCanvas(c, repeat, false),
    normal: heightToNormalMap(c, 2.1, repeat),
  };
}

/* ── 6. MIL-W-4088 Herringbone Seatbelt Webbing ───────────────────────────── */
export function webbingMaps(repeat = 16): SurfaceMapPair {
  const [c, x] = makeCanvas(256, 256);
  x.fillStyle = '#707070';
  x.fillRect(0, 0, 256, 256);
  x.strokeStyle = '#bcbcbc';
  x.lineWidth = 3.5;
  const cols = 8;
  const cw = 256 / cols;
  for (let col = 0; col < cols; col++) {
    const dir = col % 2 === 0 ? 1 : -1;
    const x0 = col * cw;
    for (let y = -32; y < 288; y += 10) {
      x.beginPath();
      x.moveTo(x0 + 1, y);
      x.lineTo(x0 + cw - 1, y + dir * 12);
      x.stroke();
    }
  }
  return {
    roughness: textureFromCanvas(c, repeat, false),
    normal: heightToNormalMap(c, 2.4, repeat),
  };
}

/* ── 7. Grained Aerospace Leather / Soft-Touch Pad ────────────────────────── */
export function leatherGrainMaps(repeat = 7): SurfaceMapPair {
  const [c, x] = makeCanvas(256, 256);
  x.fillStyle = '#868686';
  x.fillRect(0, 0, 256, 256);
  const r = rng(88);
  for (let i = 0; i < 3200; i++) {
    const v = Math.floor(92 + r() * 84);
    x.fillStyle = `rgba(${v},${v},${v},${0.22 + r() * 0.22})`;
    x.beginPath();
    x.arc(r() * 256, r() * 256, 0.7 + r() * 1.9, 0, TAU);
    x.fill();
  }
  for (let i = 0; i < 34; i++) {
    x.strokeStyle = 'rgba(48,48,48,0.2)';
    x.lineWidth = 0.9;
    x.beginPath();
    let px = r() * 256;
    let py = r() * 256;
    x.moveTo(px, py);
    for (let k = 0; k < 6; k++) {
      px += (r() - 0.5) * 20;
      py += (r() - 0.5) * 20;
      x.lineTo(px, py);
    }
    x.stroke();
  }
  return {
    roughness: textureFromCanvas(c, repeat, false),
    normal: heightToNormalMap(c, 1.75, repeat),
  };
}

/* ── 8. Machined Anti-Slip Flight Deck Tread (polished worn diamond tops) ── */
export function deckTreadMaps(repeat = 7): SurfaceMapPair {
  const [hCan, hx] = makeCanvas(256, 256);
  const [rCan, rx] = makeCanvas(256, 256);
  hx.fillStyle = '#585858';
  hx.fillRect(0, 0, 256, 256);
  rx.fillStyle = '#b8b8b8'; // Matte recessed deck valleys
  rx.fillRect(0, 0, 256, 256);

  const r = rng(51);
  const step = 32;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const cx = col * step + 16;
      const cy = row * step + 16;
      const alt = (row + col) % 2 === 0;
      hx.save();
      hx.translate(cx, cy);
      hx.rotate(alt ? Math.PI / 4 : -Math.PI / 4);
      hx.fillStyle = '#d2d2d2';
      hx.fillRect(-9, -3.2, 18, 6.4);
      hx.restore();

      // Worn lower-roughness specular top on raised cleats
      rx.save();
      rx.translate(cx, cy);
      rx.rotate(alt ? Math.PI / 4 : -Math.PI / 4);
      rx.fillStyle = '#5a5a5a';
      rx.fillRect(-8, -2.5, 16, 5);
      rx.restore();
    }
  }
  for (let i = 0; i < 450; i++) {
    const gx = r() * 256;
    const gy = r() * 256;
    rx.fillStyle = 'rgba(190,190,190,0.22)';
    rx.fillRect(gx, gy, 1.6, 1.6);
  }
  return {
    roughness: textureFromCanvas(rCan, repeat, false),
    normal: heightToNormalMap(hCan, 2.8, repeat),
  };
}

/* Legacy helpers kept for compatibility */
export function brushedMetalMap(seed = 3): THREE.CanvasTexture {
  return milledMetalMaps(seed, 3).roughness;
}
export function weaveMap(carbon = true): THREE.CanvasTexture {
  return carbon ? carbonTwillMaps(8).roughness : ripstopFabricMaps(12).roughness;
}
export function leatherMap(): THREE.CanvasTexture {
  return leatherGrainMaps(6).roughness;
}
export function treadMap(): THREE.CanvasTexture {
  return deckTreadMaps(6).roughness;
}

/* ── Silk-screened aerospace placards & panel legends ─────────────────────── */

export function labelTexture(
  text: string,
  sub = '',
  color = '#d2e2e8',
  width = 512,
  height = 128,
): THREE.CanvasTexture {
  const [c, x] = makeCanvas(width, height);
  x.clearRect(0, 0, width, height);
  x.fillStyle = 'rgba(10, 15, 18, 0.82)';
  x.fillRect(2, 2, width - 4, height - 4);
  x.strokeStyle = 'rgba(205, 226, 234, 0.38)';
  x.lineWidth = 2.5;
  x.strokeRect(3, 3, width - 6, height - 6);

  // Corner mounting rivet dots on placard
  x.fillStyle = 'rgba(190, 212, 220, 0.45)';
  for (const [rx, ry] of [[12, 12], [width - 12, 12], [12, height - 12], [width - 12, height - 12]]) {
    x.beginPath();
    x.arc(rx, ry, 3, 0, TAU);
    x.fill();
  }

  x.fillStyle = color;
  x.font = `700 ${Math.round(height * 0.29)}px "JetBrains Mono", monospace`;
  x.textBaseline = 'middle';
  x.fillText(text, 24, sub ? height * 0.37 : height * 0.52);
  if (sub) {
    x.fillStyle = 'rgba(204, 224, 230, 0.68)';
    x.font = `500 ${Math.round(height * 0.175)}px "JetBrains Mono", monospace`;
    x.fillText(sub, 24, height * 0.72);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function placardTexture(
  lines: string[],
  accent = '#ffc16b',
  width = 320,
  height = 144,
): THREE.CanvasTexture {
  const [c, x] = makeCanvas(width, height);
  x.fillStyle = 'rgba(11, 15, 18, 0.94)';
  x.fillRect(0, 0, width, height);
  x.strokeStyle = 'rgba(210, 228, 234, 0.34)';
  x.lineWidth = 3;
  x.strokeRect(5, 5, width - 10, height - 10);
  x.fillStyle = accent;
  x.fillRect(15, 16, 8, height - 32);
  x.fillStyle = '#e0ecef';
  x.font = `600 ${lines.length > 2 ? 21 : 25}px "JetBrains Mono", monospace`;
  lines.forEach((l, i) => x.fillText(l, 34, 42 + i * 28));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/* ── Studio / Orbital HDR-like reflection environment ────────────────────── */

export function environmentTexture(): THREE.CanvasTexture {
  const [c, x] = makeCanvas(1024, 512);
  const sky = x.createLinearGradient(0, 0, 0, 512);
  sky.addColorStop(0, '#0c1c28');
  sky.addColorStop(0.38, '#142632');
  sky.addColorStop(0.54, '#242e34');
  sky.addColorStop(0.72, '#0c1115');
  sky.addColorStop(1, '#040709');
  x.fillStyle = sky;
  x.fillRect(0, 0, 1024, 512);

  // Solar specular key lobe (creates crisp rim highlights on CNC chamfers)
  const warm = x.createRadialGradient(260, 148, 3, 260, 148, 280);
  warm.addColorStop(0, 'rgba(255, 240, 214, 1)');
  warm.addColorStop(0.05, 'rgba(255, 202, 138, 0.88)');
  warm.addColorStop(0.26, 'rgba(145, 112, 76, 0.26)');
  warm.addColorStop(1, 'rgba(0, 0, 0, 0)');
  x.fillStyle = warm;
  x.fillRect(0, 0, 1024, 512);

  // Earth-limb cyan bounce lobe
  const cool = x.createRadialGradient(780, 236, 8, 780, 236, 340);
  cool.addColorStop(0, 'rgba(148, 232, 255, 0.92)');
  cool.addColorStop(0.16, 'rgba(84, 168, 208, 0.36)');
  cool.addColorStop(1, 'rgba(0, 0, 0, 0)');
  x.fillStyle = cool;
  x.fillRect(0, 0, 1024, 512);

  // Subtle horizon specular band so brushed/milled edges catch continuous light
  const band = x.createLinearGradient(0, 218, 0, 262);
  band.addColorStop(0, 'rgba(200, 230, 242, 0)');
  band.addColorStop(0.5, 'rgba(212, 236, 246, 0.22)');
  band.addColorStop(1, 'rgba(200, 230, 242, 0)');
  x.fillStyle = band;
  x.fillRect(0, 218, 1024, 44);

  const t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ── Space backdrop pieces ────────────────────────────────────────────────── */

export function nebulaTexture(seed: number, hue = 196): THREE.CanvasTexture {
  const [c, x] = makeCanvas(512, 512);
  const r = rng(seed);
  x.clearRect(0, 0, 512, 512);
  for (let i = 0; i < 70; i++) {
    const cx = r() * 512;
    const cy = r() * 512;
    const rad = 30 + r() * 190;
    const g = x.createRadialGradient(cx, cy, 1, cx, cy, rad);
    const light = 40 + r() * 50;
    g.addColorStop(0, `rgba(${light + 30},${light + 55},${light + 75},${0.014 + r() * 0.035})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.beginPath();
    x.arc(cx, cy, rad, 0, TAU);
    x.fill();
  }
  for (let i = 0; i < 1400; i++) {
    const v = 130 + r() * 125;
    x.fillStyle = `rgba(${v},${v},${Math.min(255, v + 14)},${0.16 + r() * 0.7})`;
    const s = r() < 0.92 ? 1 : 1.8;
    x.fillRect(r() * 512, r() * 512, s, s);
  }
  x.globalCompositeOperation = 'lighter';
  const band = x.createLinearGradient(0, 180, 512, 360);
  band.addColorStop(0, 'rgba(0,0,0,0)');
  band.addColorStop(0.45, `hsla(${hue}, 60%, 60%, .05)`);
  band.addColorStop(0.7, 'rgba(0,0,0,0)');
  x.fillStyle = band;
  x.fillRect(0, 0, 512, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function planetTexture(): THREE.CanvasTexture {
  const [c, x] = makeCanvas(1024, 512);
  const r = rng(731);
  const ocean = x.createLinearGradient(0, 0, 0, 512);
  ocean.addColorStop(0, '#050d12');
  ocean.addColorStop(0.5, '#081b25');
  ocean.addColorStop(1, '#050e14');
  x.fillStyle = ocean;
  x.fillRect(0, 0, 1024, 512);

  for (let i = 0; i < 24; i++) {
    const cx = r() * 1024;
    const cy = 80 + r() * 360;
    const rx = 40 + r() * 160;
    const ry = 18 + r() * 80;
    const g = x.createRadialGradient(cx, cy, 2, cx, cy, rx);
    const green = r() > 0.78;
    g.addColorStop(0, green ? 'rgba(42,63,50,.65)' : 'rgba(24,44,52,.65)');
    g.addColorStop(0.6, green ? 'rgba(28,46,38,.36)' : 'rgba(18,34,40,.36)');
    g.addColorStop(1, 'rgba(10,22,27,0)');
    x.save();
    x.translate(cx, cy);
    x.rotate(r() * TAU);
    x.scale(1, ry / rx);
    x.fillStyle = g;
    x.beginPath();
    x.arc(0, 0, rx, 0, TAU);
    x.fill();
    x.restore();
  }
  x.fillStyle = 'rgba(205,226,232,.34)';
  x.fillRect(0, 0, 1024, 22);
  x.fillRect(0, 492, 1024, 20);
  for (let i = 0; i < 54; i++) {
    x.strokeStyle = `rgba(218,238,244,${0.02 + r() * 0.055})`;
    x.lineWidth = 2 + r() * 10;
    x.beginPath();
    const sy = 45 + r() * 420;
    x.moveTo(-20, sy);
    x.bezierCurveTo(280, sy + (r() - 0.5) * 40, 640, sy + (r() - 0.5) * 55, 1044, sy + (r() - 0.5) * 25);
    x.stroke();
  }
  const shade = x.createLinearGradient(0, 0, 1024, 0);
  shade.addColorStop(0, 'rgba(2,7,10,.68)');
  shade.addColorStop(0.34, 'rgba(2,7,10,.04)');
  shade.addColorStop(0.62, 'rgba(2,7,10,.02)');
  shade.addColorStop(1, 'rgba(2,7,10,.86)');
  x.fillStyle = shade;
  x.fillRect(0, 0, 1024, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

/* ── Avionics Primary, Auxiliary & CDU Displays ───────────────────────────── */

const PALETTE: Record<SectionId, { main: string; dim: string }> = {
  flight: { main: '#7de6ff', dim: '#287286' },
  power: { main: '#ffc16b', dim: '#8a5f2c' },
  life: { main: '#8ff0c3', dim: '#327a5f' },
  orbit: { main: '#b9a8ff', dim: '#5b4f96' },
  comms: { main: '#87d0ff', dim: '#2e688a' },
  log: { main: '#ffd3a0', dim: '#856644' },
};

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number, color: string, step = 32) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  for (let i = 0; i < w; i += step) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke();
  }
  for (let i = 0; i < h; i += step) {
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(w, i); ctx.stroke();
  }
}

function drawAttitudeSphere(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, main: string) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.clip();

  const skyG = ctx.createLinearGradient(0, cy - r, 0, cy);
  skyG.addColorStop(0, '#072a38');
  skyG.addColorStop(1, '#0e4559');
  ctx.fillStyle = skyG;
  ctx.fillRect(cx - r, cy - r, r * 2, r);

  const gndG = ctx.createLinearGradient(0, cy, 0, cy + r);
  gndG.addColorStop(0, '#2a1d10');
  gndG.addColorStop(1, '#140e07');
  ctx.fillStyle = gndG;
  ctx.fillRect(cx - r, cy, r * 2, r);

  // Pitch ladder with conformal degree ticks
  ctx.strokeStyle = 'rgba(218, 244, 250, 0.85)';
  ctx.fillStyle = 'rgba(218, 244, 250, 0.85)';
  ctx.lineWidth = 1.8;
  ctx.font = '600 11px "JetBrains Mono", monospace';
  for (let i = -4; i <= 4; i++) {
    if (i === 0) continue;
    const y = cy + i * (r * 0.19);
    const halfW = i % 2 === 0 ? r * 0.34 : r * 0.18;
    ctx.beginPath();
    ctx.moveTo(cx - halfW, y);
    ctx.lineTo(cx - halfW * 0.28, y);
    ctx.moveTo(cx + halfW * 0.28, y);
    ctx.lineTo(cx + halfW, y);
    ctx.stroke();
    if (i % 2 === 0) {
      const deg = Math.abs(i * 5);
      ctx.fillText(String(deg), cx + halfW + 5, y + 4);
    }
  }
  // Horizon line
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(cx - r, cy);
  ctx.lineTo(cx + r, cy);
  ctx.stroke();
  ctx.restore();

  // Outer roll scale ring
  ctx.strokeStyle = main;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.stroke();

  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * TAU - Math.PI / 2;
    const len = i % 3 === 0 ? 11 : 5;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * (r + 2), cy + Math.sin(a) * (r + 2));
    ctx.lineTo(cx + Math.cos(a) * (r + 2 + len), cy + Math.sin(a) * (r + 2 + len));
    ctx.stroke();
  }

  // Aircraft/Spacecraft bore-sight W-reference & Flight Path Vector (FPV)
  ctx.strokeStyle = '#ffc16b';
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.moveTo(cx - 34, cy);
  ctx.lineTo(cx - 12, cy);
  ctx.lineTo(cx - 7, cy + 7);
  ctx.moveTo(cx + 34, cy);
  ctx.lineTo(cx + 12, cy);
  ctx.lineTo(cx + 7, cy + 7);
  ctx.stroke();
  ctx.fillStyle = '#ffc16b';
  ctx.fillRect(cx - 3, cy - 3, 6, 6);

  // Velocity vector (FPV)
  ctx.strokeStyle = '#8ff0c3';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx + 6, cy - 10, 7, 0, TAU);
  ctx.moveTo(cx - 9, cy - 10); ctx.lineTo(cx - 1, cy - 10);
  ctx.moveTo(cx + 13, cy - 10); ctx.lineTo(cx + 21, cy - 10);
  ctx.moveTo(cx + 6, cy - 17); ctx.lineTo(cx + 6, cy - 24);
  ctx.stroke();
}

export function paintScreen(canvas: HTMLCanvasElement, section: CockpitSection, throttle = 0.62): void {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const p = PALETTE[section.id];
  const s = section.screen;

  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#05161c');
  bg.addColorStop(0.55, '#030e13');
  bg.addColorStop(1, '#02080b');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.globalAlpha = 0.16;
  drawGrid(ctx, w, h, p.dim, Math.round(w / 32));
  ctx.restore();

  // Top mode annunciator header (FMA style)
  const headH = Math.round(h * 0.12);
  ctx.fillStyle = 'rgba(2, 9, 12, 0.9)';
  ctx.fillRect(0, 0, w, headH);
  ctx.fillStyle = p.main;
  ctx.fillRect(0, headH - 2, w, 2);
  ctx.fillRect(28, Math.round(headH * 0.22), 6, Math.round(headH * 0.56));

  ctx.font = `600 ${Math.round(h * 0.042)}px "Chakra Petch", sans-serif`;
  ctx.fillText(s.heading, 46, Math.round(headH * 0.64));
  ctx.font = `500 ${Math.round(h * 0.026)}px "JetBrains Mono", monospace`;
  ctx.fillStyle = 'rgba(208, 232, 238, 0.72)';
  ctx.textAlign = 'right';
  ctx.fillText(`${s.sub}  ·  THR ${Math.round(throttle * 100)}%`, w - 28, Math.round(headH * 0.62));
  ctx.textAlign = 'left';

  // Soft-key labels along top/bottom OSB positions
  const osbTop = ['PFD', 'ORB', 'SYS', 'RCS', 'ECS', 'LOG'];
  ctx.font = `600 ${Math.round(h * 0.021)}px "JetBrains Mono", monospace`;
  osbTop.forEach((lbl, idx) => {
    const ox = w * (0.16 + idx * 0.136);
    ctx.fillStyle = idx === 0 ? p.main : 'rgba(180,214,224,0.46)';
    ctx.fillText(lbl, ox - 14, headH + 20);
  });

  const cx = w * 0.38;
  const cy = h * 0.54;

  if (section.id === 'flight') {
    drawAttitudeSphere(ctx, cx, cy, h * 0.26, p.main);

    // Velocity & Altitude precision tapes
    for (const [bx, label, baseVal, stepVal] of [
      [w * 0.085, 'VEL M/S', 7800, 4],
      [w * 0.665, 'ALT KM', 410, 1],
    ] as [number, string, number, number][]) {
      ctx.fillStyle = 'rgba(6, 22, 28, 0.78)';
      ctx.fillRect(bx - 36, h * 0.22, 82, h * 0.60);
      ctx.strokeStyle = 'rgba(175, 220, 232, 0.34)';
      ctx.lineWidth = 1.4;
      ctx.strokeRect(bx - 36, h * 0.22, 82, h * 0.60);
      ctx.fillStyle = p.main;
      ctx.font = `600 ${Math.round(h * 0.023)}px "JetBrains Mono", monospace`;
      ctx.fillText(label, bx - 32, h * 0.20);

      for (let i = 0; i < 9; i++) {
        const yy = h * (0.26 + i * 0.066);
        ctx.strokeStyle = i === 4 ? p.main : 'rgba(165, 210, 222, 0.42)';
        ctx.beginPath();
        ctx.moveTo(bx - 36, yy);
        ctx.lineTo(bx - (i === 4 ? 18 : 26), yy);
        ctx.stroke();
        ctx.fillStyle = i === 4 ? '#ffffff' : 'rgba(205, 234, 240, 0.72)';
        ctx.font = `${i === 4 ? '700' : '500'} ${Math.round(h * 0.024)}px "JetBrains Mono", monospace`;
        ctx.fillText(String(baseVal + (4 - i) * stepVal), bx - 12, yy + 4);
      }
    }

    // Right-hand orbital & RCS status column
    const rx = w * 0.76;
    ctx.fillStyle = 'rgba(8, 24, 30, 0.82)';
    ctx.fillRect(rx, h * 0.22, w * 0.20, h * 0.60);
    ctx.strokeStyle = 'rgba(170, 216, 228, 0.28)';
    ctx.strokeRect(rx, h * 0.22, w * 0.20, h * 0.60);
    s.rows.forEach((row, i) => {
      const yy = h * (0.29 + i * 0.13);
      ctx.fillStyle = 'rgba(186, 218, 226, 0.62)';
      ctx.font = `500 ${Math.round(h * 0.022)}px "JetBrains Mono", monospace`;
      ctx.fillText(row.label, rx + 14, yy);
      ctx.fillStyle = '#e8f7fa';
      ctx.font = `600 ${Math.round(h * 0.026)}px "JetBrains Mono", monospace`;
      ctx.fillText(row.value, rx + 14, yy + 22);
      ctx.fillStyle = 'rgba(120, 168, 180, 0.24)';
      ctx.fillRect(rx + 14, yy + 30, w * 0.16, 5);
      ctx.fillStyle = p.main;
      ctx.fillRect(rx + 14, yy + 30, w * 0.16 * row.bar, 5);
    });
  } else if (section.id === 'orbit') {
    const rr = h * 0.27;
    ctx.strokeStyle = 'rgba(140,220,240,.32)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, rr, 0, TAU); ctx.stroke();
    ctx.strokeStyle = p.main;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, rr, -1.35, 1.15); ctx.stroke();
    const px = cx + Math.cos(0.4) * rr;
    const py = cy + Math.sin(0.4) * rr;
    ctx.fillStyle = p.main;
    ctx.beginPath(); ctx.arc(px, py, 7, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(190,220,255,.65)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, rr * 0.52, 0, TAU); ctx.stroke();

    s.rows.forEach((row, i) => {
      const yy = h * (0.28 + i * 0.13);
      ctx.fillStyle = 'rgba(200,230,238,.62)';
      ctx.font = `500 ${Math.round(h * 0.024)}px "JetBrains Mono", monospace`;
      ctx.fillText(row.label, w * 0.64, yy);
      ctx.fillStyle = '#eef8fb';
      ctx.font = `600 ${Math.round(h * 0.03)}px "JetBrains Mono", monospace`;
      ctx.fillText(row.value, w * 0.76, yy);
      ctx.fillStyle = 'rgba(130,170,180,.25)';
      ctx.fillRect(w * 0.64, yy + 10, w * 0.28, 7);
      ctx.fillStyle = p.main;
      ctx.fillRect(w * 0.64, yy + 10, w * 0.28 * row.bar, 7);
    });
  } else {
    ctx.fillStyle = '#e8f6fa';
    ctx.font = `600 ${Math.round(h * 0.15)}px "Chakra Petch", sans-serif`;
    ctx.fillText(s.primary, w * 0.07, h * 0.50);
    ctx.fillStyle = 'rgba(182,218,228,.7)';
    ctx.font = `500 ${Math.round(h * 0.028)}px "JetBrains Mono", monospace`;
    ctx.fillText(s.unit, w * 0.072, h * 0.56);
    ctx.fillStyle = p.main;
    ctx.fillRect(w * 0.072, h * 0.60, w * 0.24 * (0.45 + throttle * 0.55), 6);

    s.rows.forEach((row, i) => {
      const yy = h * (0.27 + i * 0.135);
      ctx.fillStyle = 'rgba(200,230,236,.6)';
      ctx.font = `500 ${Math.round(h * 0.025)}px "JetBrains Mono", monospace`;
      ctx.fillText(row.label, w * 0.56, yy);
      ctx.fillStyle = '#ebf7fa';
      ctx.font = `600 ${Math.round(h * 0.03)}px "JetBrains Mono", monospace`;
      ctx.fillText(row.value, w * 0.72, yy);
      ctx.fillStyle = 'rgba(130,170,180,.25)';
      ctx.fillRect(w * 0.56, yy + 12, w * 0.34, 8);
      ctx.fillStyle = p.main;
      ctx.fillRect(w * 0.56, yy + 12, w * 0.34 * row.bar, 8);
    });
  }

  // Footer status bar
  ctx.strokeStyle = 'rgba(190,225,235,.18)';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(18, headH + 8, w - 36, h - headH - 54);
  ctx.fillStyle = p.main;
  ctx.font = `500 ${Math.round(h * 0.024)}px "JetBrains Mono", monospace`;
  ctx.fillText(s.readout, 28, h - 18);
  ctx.fillStyle = 'rgba(200,225,232,.52)';
  ctx.textAlign = 'right';
  ctx.fillText(`HX-9 · ${section.code} · REV 05`, w - 28, h - 18);
  ctx.textAlign = 'left';
}

export function auxScreen(kind: 'system' | 'engine', color: string): THREE.CanvasTexture {
  const [c, x] = makeCanvas(512, 420);
  x.fillStyle = '#030d12';
  x.fillRect(0, 0, 512, 420);
  drawGrid(x, 512, 420, 'rgba(120,170,180,.10)', 28);
  x.strokeStyle = 'rgba(196,228,236,.36)';
  x.lineWidth = 2;
  x.strokeRect(12, 12, 488, 396);

  x.fillStyle = 'rgba(4, 18, 24, 0.92)';
  x.fillRect(14, 14, 484, 48);
  x.fillStyle = color;
  x.fillRect(14, 61, 484, 2);
  x.font = '600 19px "JetBrains Mono", monospace';
  x.fillText(kind === 'system' ? 'ECS / BUS SYNOPSIS' : 'PROPULSION & RCS', 28, 44);

  if (kind === 'system') {
    // Dual electrical & ECLSS bus diagram
    const nodes = [
      [120, 130, 'BUS A', '540V'],
      [392, 130, 'BUS B', '540V'],
      [120, 265, 'O₂ LOOP', '101.3'],
      [392, 265, 'THERMAL', '284K'],
    ] as [number, number, string, string][];
    x.strokeStyle = color;
    x.lineWidth = 2;
    x.beginPath();
    x.moveTo(120, 155); x.lineTo(120, 240);
    x.moveTo(392, 155); x.lineTo(392, 240);
    x.moveTo(175, 130); x.lineTo(337, 130);
    x.stroke();

    for (const [nx, ny, t1, t2] of nodes) {
      x.fillStyle = '#081b22';
      x.fillRect(nx - 56, ny - 26, 112, 52);
      x.strokeStyle = color;
      x.strokeRect(nx - 56, ny - 26, 112, 52);
      x.fillStyle = '#d8eef2';
      x.font = '600 14px "JetBrains Mono", monospace';
      x.fillText(t1, nx - 42, ny - 4);
      x.fillStyle = color;
      x.font = '700 16px "JetBrains Mono", monospace';
      x.fillText(t2, nx - 42, ny + 17);
    }
  } else {
    // Twin engine gauges + 4-quad RCS status
    for (const [gx, lbl, pct] of [[146, 'ENG 1', 0.84], [366, 'ENG 2', 0.83]] as [number, string, number][]) {
      x.strokeStyle = 'rgba(150,195,205,0.25)';
      x.lineWidth = 10;
      x.beginPath(); x.arc(gx, 184, 62, Math.PI * 0.75, Math.PI * 2.25); x.stroke();
      x.strokeStyle = color;
      x.beginPath(); x.arc(gx, 184, 62, Math.PI * 0.75, Math.PI * (0.75 + 1.5 * pct)); x.stroke();
      x.fillStyle = '#e6f6f9';
      x.font = '700 24px "Chakra Petch", sans-serif';
      x.fillText(`${Math.round(pct * 100)}%`, gx - 24, 190);
      x.fillStyle = 'rgba(185,220,230,0.7)';
      x.font = '600 13px "JetBrains Mono", monospace';
      x.fillText(lbl, gx - 22, 222);
    }
    x.fillStyle = 'rgba(195,228,236,0.75)';
    x.font = '500 13px "JetBrains Mono", monospace';
    x.fillText('RCS QUADS A/B/C/D · ARMED · N₂O₄/MMH NOMINAL', 36, 326);
  }

  x.fillStyle = 'rgba(175,212,222,.6)';
  x.font = '500 12px "JetBrains Mono", monospace';
  x.fillText('CH A/B SYNC · 0 FAULTS', 28, 388);
  x.textAlign = 'right';
  x.fillText('HX-9 MFD', 484, 388);
  x.textAlign = 'left';

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function cduScreenTexture(): THREE.CanvasTexture {
  const [c, x] = makeCanvas(512, 384);
  x.fillStyle = '#030c10';
  x.fillRect(0, 0, 512, 384);
  x.strokeStyle = 'rgba(143, 240, 195, 0.35)';
  x.lineWidth = 2;
  x.strokeRect(10, 10, 492, 364);
  x.fillStyle = '#8ff0c3';
  x.font = '700 18px "JetBrains Mono", monospace';
  x.fillText('FMS / MANOEUVRE PLAN   1/3', 26, 42);
  const rows = [
    ['TGT SHELL', 'ISS-NODE2 / PORT 09'],
    ['TIG BURN 02', '00:14:22.4  ΔV +18.2'],
    ['PERI / APO', '411.8 × 413.4 KM'],
    ['ATT MODE', 'LVLH HOLD ±0.5°'],
    ['PROP REM', '842.6 KG   MARGIN +31%'],
  ];
  rows.forEach(([k, v], i) => {
    const yy = 88 + i * 52;
    x.fillStyle = 'rgba(180, 220, 210, 0.62)';
    x.font = '500 13px "JetBrains Mono", monospace';
    x.fillText(k, 28, yy);
    x.fillStyle = '#d9fff0';
    x.font = '600 16px "JetBrains Mono", monospace';
    x.fillText(v, 28, yy + 22);
  });
  x.fillStyle = '#ffc16b';
  x.font = '600 14px "JetBrains Mono", monospace';
  x.fillText('[EXEC ARMED]  ▸  SCRATCHPAD READY_', 28, 356);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
