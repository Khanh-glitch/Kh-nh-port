import * as THREE from 'three';
import type { ProjectorSlideId } from './types';

// Official VNG Corp. SVG Paths (viewBox 0 0 144 58 after translate(-2128, -1208))
const VNG_PATHS = [
  'M2171 1208 2171 1233.38 C2171.02 1251.37 2156.61 1265.98 2138.82 1266 C2138.8 1266 2138.77 1266 2138.75 1266 L2128 1266 2128 1208 2138.75 1208 2138.75 1255.26 C2150.68 1255.26 2160.35 1245.48 2160.35 1233.41 C2160.35 1233.4 2160.35 1233.39 2160.35 1233.38 L2160.35 1208 Z',
  'M2222 1224.33 2222 1266 2211 1266 2211 1224.3 C2211 1221.3 2208.55 1218.88 2205.52 1218.88 C2205.51 1218.88 2205.49 1218.88 2205.48 1218.88 L2189 1218.88 2189 1266 2178 1266 2178 1208 2205.48 1208 C2207.36 1207.99 2209.23 1208.31 2211 1208.93 C2215.65 1210.61 2219.3 1214.26 2220.95 1218.88 C2221.61 1220.62 2221.96 1222.47 2222 1224.33 Z',
  'M2246.88 1242.54 2261.22 1242.54 C2261.22 1242.54 2261.22 1249.45 2261.22 1249.8 C2261.22 1252.81 2258.8 1255.26 2255.82 1255.26 L2245.14 1255.26 C2242.22 1255.26 2239.82 1252.9 2239.75 1249.94 L2239.75 1224.37 C2239.75 1221.38 2242.15 1218.95 2245.11 1218.95 L2264.83 1218.95 2264.83 1208 2245.11 1208 C2243.28 1207.99 2241.47 1208.3 2239.75 1208.93 C2235.16 1210.59 2231.54 1214.24 2229.89 1218.88 C2229.29 1220.64 2228.99 1222.48 2229 1224.34 L2229 1249.66 C2228.99 1251.52 2229.29 1253.36 2229.89 1255.12 C2231.52 1259.77 2235.15 1263.43 2239.75 1265.07 C2241.47 1265.69 2243.28 1266.01 2245.11 1266 L2255.86 1266 C2257.68 1266.01 2259.5 1265.69 2261.22 1265.07 C2265.82 1263.43 2269.45 1259.78 2271.08 1255.12 C2271.67 1253.4 2271.98 1251.59 2272 1249.76 L2272 1231.63 2246.88 1231.63 Z',
];

function drawVngMarkOnCanvas(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  fillStyle: string | CanvasGradient = '#E65A26',
  strokeStyle?: string
) {
  const scale = width / 144;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.translate(-2128, -1208);
  ctx.fillStyle = fillStyle;
  for (const d of VNG_PATHS) {
    const path = new Path2D(d);
    ctx.fill(path, 'evenodd');
    if (strokeStyle) {
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = 1.4;
      ctx.stroke(path);
    }
  }
  ctx.restore();
}

function finalizeTexture(canvas: HTMLCanvasElement, repeat = false): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  if (repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
  }
  tex.needsUpdate = true;
  return tex;
}

export function createDeskSurfaceTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // Deep architectural slate-walnut gradient base
  const bg = ctx.createLinearGradient(0, 0, 2048, 1024);
  bg.addColorStop(0, '#14171f');
  bg.addColorStop(0.5, '#191d27');
  bg.addColorStop(1, '#12151c');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 2048, 1024);

  // Micro-brushed surface grain
  for (let i = 0; i < 4200; i++) {
    const gx = Math.random() * 2048;
    const gy = Math.random() * 1024;
    const len = 30 + Math.random() * 120;
    ctx.strokeStyle = i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx + len, gy);
    ctx.stroke();
  }

  // Subtle architectural CAD grid lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.032)';
  ctx.lineWidth = 1;
  const step = 64;
  for (let x = 0; x <= 2048; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 1024);
    ctx.stroke();
  }
  for (let y = 0; y <= 1024; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(2048, y);
    ctx.stroke();
  }

  // Subtle VNG Studio calibration border
  ctx.strokeStyle = 'rgba(230, 90, 38, 0.22)';
  ctx.lineWidth = 3;
  ctx.strokeRect(36, 36, 2048 - 72, 1024 - 72);

  // Corner crosshairs
  const corners = [
    [60, 60],
    [2048 - 60, 60],
    [60, 1024 - 60],
    [2048 - 60, 1024 - 60],
  ];
  ctx.strokeStyle = 'rgba(230, 90, 38, 0.45)';
  ctx.lineWidth = 2;
  for (const [cx, cy] of corners) {
    ctx.beginPath();
    ctx.moveTo(cx - 14, cy);
    ctx.lineTo(cx + 14, cy);
    ctx.moveTo(cx, cy - 14);
    ctx.lineTo(cx, cy + 14);
    ctx.stroke();
  }

  // Center architectural watermark
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.font = '600 18px "JetBrains Mono", monospace';
  ctx.fillText('VNG HARDWARE & 3D DESIGN STUDIO // WORKBENCH SURFACE REV 4.2', 74, 1024 - 56);

  return finalizeTexture(canvas);
}

export function createVngPlaqueTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 1024, 256);
  grad.addColorStop(0, '#181a20');
  grad.addColorStop(0.5, '#232732');
  grad.addColorStop(1, '#14161b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 256);

  // Brushed metal streaks
  for (let i = 0; i < 400; i++) {
    ctx.strokeStyle = 'rgba(255,255,255,0.025)';
    ctx.beginPath();
    const y = Math.random() * 256;
    ctx.moveTo(0, y);
    ctx.lineTo(1024, y);
    ctx.stroke();
  }

  // Copper/orange outer trim
  ctx.strokeStyle = '#E65A26';
  ctx.lineWidth = 6;
  ctx.strokeRect(12, 12, 1000, 232);

  // Corner rivets
  ctx.fillStyle = '#d49a6a';
  for (const [rx, ry] of [
    [34, 34],
    [990, 34],
    [34, 222],
    [990, 222],
  ]) {
    ctx.beginPath();
    ctx.arc(rx, ry, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  // Small VNG logo left
  drawVngMarkOnCanvas(ctx, 72, 78, 175, '#E65A26');

  // Divider
  ctx.fillStyle = 'rgba(230, 90, 38, 0.55)';
  ctx.fillRect(280, 56, 3, 144);

  // Text
  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 38px "Space Grotesk", sans-serif';
  ctx.fillText('VNG CORPORATION', 316, 110);

  ctx.fillStyle = '#f59e0b';
  ctx.font = '600 22px "JetBrains Mono", monospace';
  ctx.fillText('BUILD TECHNOLOGIES & GROW PEOPLE', 316, 152);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '500 18px "JetBrains Mono", monospace';
  ctx.fillText('EST. 2004  •  HO CHI MINH CITY  •  VNG CAMPUS', 316, 192);

  return finalizeTexture(canvas);
}

export function createProjectorTopTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#252932';
  ctx.fillRect(0, 0, 1024, 512);

  // Fine radial brushed finish
  for (let i = 0; i < 600; i++) {
    ctx.strokeStyle = 'rgba(255,255,255,0.02)';
    const y = Math.random() * 512;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(1024, y);
    ctx.stroke();
  }

  // Border inset
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 3;
  ctx.strokeRect(24, 24, 976, 464);

  // Header badge
  ctx.fillStyle = '#E65A26';
  ctx.fillRect(54, 56, 10, 58);

  ctx.fillStyle = '#f1f5f9';
  ctx.font = '700 34px "Space Grotesk", sans-serif';
  ctx.fillText('LUMEN-X9  4K LASER', 82, 92);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '500 18px "JetBrains Mono", monospace';
  ctx.fillText('ULTRA-HD RGB LASER ENGINE  •  3,600 ANSI LUMENS  •  HDR10+', 82, 122);

  // Laser warning triangle
  ctx.save();
  ctx.translate(880, 88);
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, -28);
  ctx.lineTo(28, 22);
  ctx.lineTo(-28, 22);
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = '#f59e0b';
  ctx.font = '700 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('!', 0, 15);
  ctx.restore();

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '600 15px "JetBrains Mono", monospace';
  ctx.fillText('CLASS 1 LASER', 824, 134);

  // Dial labels
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '600 20px "JetBrains Mono", monospace';
  ctx.fillText('OPTICAL FOCUS', 110, 445);
  ctx.fillText('MOTORIZED ZOOM', 385, 445);
  ctx.fillText('KEYSTONE / INPUT / PWR', 660, 445);

  return finalizeTexture(canvas);
}

/** Projection artwork for the VNG *personal* portfolio corner.
 * The uploaded ZIP contains VNG corporate demo slides but no evidence about
 * the portfolio owner's own work. This intentionally avoids making up claims.
 * All slide content lives here and can be replaced with verified projects.
 */
export function createProjectorSlideTexture(slideId: ProjectorSlideId, isPoweredOn: boolean): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 1280; canvas.height = 720
  const ctx = canvas.getContext('2d')!
  const W=1280,H=720
  ctx.fillStyle='#080c16'; ctx.fillRect(0,0,W,H)
  const grad=ctx.createRadialGradient(650,340,20,650,340,740)
  grad.addColorStop(0,'rgba(230,90,38,.21)')
  grad.addColorStop(1,'rgba(8,12,22,0)')
  ctx.fillStyle=grad;ctx.fillRect(0,0,W,H)
  ctx.strokeStyle='rgba(255,255,255,.045)';ctx.lineWidth=1
  for(let x=0;x<1280;x+=56){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}
  for(let y=0;y<720;y+=56){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
  // Brand mark and structural UI preserve the user's orange titanium aesthetic.
  drawVngMarkOnCanvas(ctx,80,65,202,'#e65a26')
  ctx.fillStyle='#f2b18b';ctx.font='600 22px sans-serif';ctx.textAlign='right'
  ctx.fillText('PORTFOLIO / VNG',1190,105)
  ctx.strokeStyle='rgba(230,90,38,.62)';ctx.lineWidth=3
  ctx.beginPath();ctx.moveTo(80,163);ctx.lineTo(1200,163);ctx.stroke()
  if(!isPoweredOn){ctx.fillStyle='#d5d9df';ctx.textAlign='center';ctx.font='500 36px sans-serif';ctx.fillText('PROJECTOR STANDBY',640,390);return finalizeTexture(canvas)}
  const slides=[
    {n:'01 / 04', title:'MY WORK AT VNG',subtitle:'A portfolio of real projects and creative contributions',tag:'WORK EXPERIENCE',foot:'SELECT PROJECTS · PRESS E ON CONTROL TO CONTINUE'},
    {n:'02 / 04', title:'SELECTED PROJECTS',subtitle:'Project visuals / video evidence will be connected here',tag:'PROJECT SHOWCASE',foot:'CONTENT PENDING VERIFIED PERSONAL ASSETS'},
    {n:'03 / 04', title:'PROCESS & CRAFT',subtitle:'From creative direction to production and delivery',tag:'BEHIND THE WORK',foot:'PERSONAL CASE STUDIES WILL REPLACE THIS PREVIEW'},
    {n:'04 / 04', title:'OUTCOMES & IMPACT',subtitle:'Only independently verified results and credits belong here',tag:'EVIDENCE FIRST',foot:'NO ASSUMED METRICS · NO FABRICATED ACHIEVEMENTS'},
  ]
  const item=slides[slideId] || slides[0]
  ctx.textAlign='left';ctx.fillStyle='#ffba90';ctx.font='700 28px sans-serif';ctx.fillText(item.tag,85,238)
  ctx.fillStyle='#f8fafc';ctx.font='800 69px sans-serif';ctx.fillText(item.title,85,353)
  ctx.fillStyle='#c3cad8';ctx.font='400 29px sans-serif';ctx.fillText(item.subtitle,86,427)
  const lineGrad=ctx.createLinearGradient(90,0,1190,0);lineGrad.addColorStop(0,'#e65a26');lineGrad.addColorStop(1,'rgba(230,90,38,.04)')
  ctx.fillStyle=lineGrad;ctx.fillRect(86,469,1110,4)
  ctx.fillStyle='#ffba90';ctx.font='700 27px sans-serif';ctx.fillText(item.n,87,550)
  ctx.fillStyle='#8190a6';ctx.font='500 19px sans-serif';ctx.fillText(item.foot,88,628)
  return finalizeTexture(canvas)
}

export function createMonitorScreenTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1600;
  canvas.height = 680;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 0, 1600, 680);

  // Top OS Bar
  ctx.fillStyle = '#111827';
  ctx.fillRect(0, 0, 1600, 46);
  drawVngMarkOnCanvas(ctx, 24, 11, 62, '#E65A26');
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '600 18px "JetBrains Mono", monospace';
  ctx.fillText('VNG STUDIO OS 4.0  |  3D RENDER PIPELINE', 105, 30);

  ctx.fillStyle = '#10b981';
  ctx.fillText('● GPU 60 FPS  •  BLOOM ACTIVE', 1240, 30);

  // Left sidebar
  ctx.fillStyle = '#0f1623';
  ctx.fillRect(20, 66, 320, 594);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.strokeRect(20, 66, 320, 594);

  const layers = [
    '01. VNG_Logo_Monument',
    '02. LumenX9_Projector',
    '03. Sapphire_Lens_Stack',
    '04. Volumetric_Laser_Beam',
    '05. Ultrawide_Display',
    '06. Mechanical_KB_75',
    '07. Vinyl_Turntable',
    '08. Rangefinder_35mm',
    '09. Tech_Quadcopter',
  ];
  layers.forEach((l, i) => {
    const y = 104 + i * 54;
    if (i < 2) {
      ctx.fillStyle = 'rgba(230, 90, 38, 0.2)';
      ctx.fillRect(34, y - 24, 292, 42);
    }
    ctx.fillStyle = i < 2 ? '#fb923c' : '#94a3b8';
    ctx.font = '500 17px "JetBrains Mono", monospace';
    ctx.fillText(l, 48, y + 4);
  });

  // Center Viewport Preview
  ctx.fillStyle = '#050811';
  ctx.fillRect(360, 66, 860, 594);
  ctx.strokeStyle = 'rgba(230, 90, 38, 0.45)';
  ctx.lineWidth = 2;
  ctx.strokeRect(360, 66, 860, 594);

  // Perspective grid lines in monitor viewport
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
  for (let i = -6; i <= 6; i++) {
    ctx.beginPath();
    ctx.moveTo(790 + i * 25, 360);
    ctx.lineTo(790 + i * 110, 660);
    ctx.stroke();
  }
  drawVngMarkOnCanvas(ctx, 565, 220, 450, '#E65A26');

  // Right inspector
  ctx.fillStyle = '#0f1623';
  ctx.fillRect(1240, 66, 340, 594);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.strokeRect(1240, 66, 340, 594);

  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 20px "Space Grotesk", sans-serif';
  ctx.fillText('MATERIAL & OPTICS', 1265, 110);

  const bars = [
    { label: 'CLEARCOAT', val: 0.92, col: '#E65A26' },
    { label: 'METALNESS', val: 0.85, col: '#38bdf8' },
    { label: 'LASER FLUX', val: 0.96, col: '#fbbf24' },
    { label: 'IOR GLASS', val: 0.76, col: '#a78bfa' },
  ];
  bars.forEach((b, i) => {
    const by = 160 + i * 90;
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 16px "JetBrains Mono", monospace';
    ctx.fillText(b.label, 1265, by);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(1265, by + 16, 290, 16);
    ctx.fillStyle = b.col;
    ctx.fillRect(1265, by + 16, 290 * b.val, 16);
  });

  // Audio waveform at bottom right
  for (let i = 0; i < 28; i++) {
    const h = 15 + Math.abs(Math.sin(i * 0.45)) * 75;
    ctx.fillStyle = i % 3 === 0 ? '#E65A26' : '#38bdf8';
    ctx.fillRect(1265 + i * 10, 620 - h, 6, h);
  }

  return finalizeTexture(canvas);
}

export function createVngMugTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#f4f4f5';
  ctx.fillRect(0, 0, 1024, 512);

  // Subtle ceramic warm band
  ctx.fillStyle = '#E65A26';
  ctx.fillRect(0, 448, 1024, 64);

  // VNG logo centered on front & back of cylinder wrap
  drawVngMarkOnCanvas(ctx, 180, 160, 260, '#E65A26');
  drawVngMarkOnCanvas(ctx, 680, 160, 260, '#E65A26');

  ctx.fillStyle = '#334155';
  ctx.font = '600 22px "Space Grotesk", sans-serif';
  ctx.fillText('WE ARE VNG', 240, 315);
  ctx.fillText('WE ARE VNG', 740, 315);

  return finalizeTexture(canvas);
}

export function createVinylLabelTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#E65A26';
  ctx.beginPath();
  ctx.arc(256, 256, 256, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#18181b';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(256, 256, 210, 0, Math.PI * 2);
  ctx.stroke();

  drawVngMarkOnCanvas(ctx, 166, 130, 180, '#ffffff');

  ctx.fillStyle = '#18181b';
  ctx.font = '700 22px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('VNG STUDIO SESSIONS', 256, 355);
  ctx.font = '600 18px "JetBrains Mono", monospace';
  ctx.fillText('33⅓ RPM • SIDE A', 256, 390);

  return finalizeTexture(canvas);
}

export function createBookCoverTexture(title: string, subtitle: string, bgHex: string, accentHex: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = bgHex;
  ctx.fillRect(0, 0, 512, 512);

  ctx.fillStyle = accentHex;
  ctx.fillRect(0, 0, 512, 24);
  ctx.fillRect(36, 110, 80, 8);

  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 38px "Space Grotesk", sans-serif';
  ctx.fillText(title, 36, 175);

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '500 20px "JetBrains Mono", monospace';
  ctx.fillText(subtitle, 36, 220);

  drawVngMarkOnCanvas(ctx, 36, 385, 130, accentHex);

  return finalizeTexture(canvas);
}

export function createCameraDialTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#18181b';
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = '#d4d4d8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(128, 128, 110, 0, Math.PI * 2);
  ctx.stroke();

  const marks = ['A', '1000', '500', '250', '125', '60', '30', '15'];
  ctx.fillStyle = '#f4f4f5';
  ctx.font = '700 18px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  marks.forEach((m, i) => {
    const angle = (i / marks.length) * Math.PI * 2;
    const x = 128 + Math.cos(angle) * 78;
    const y = 128 + Math.sin(angle) * 78;
    ctx.fillStyle = m === 'A' ? '#E65A26' : '#f4f4f5';
    ctx.fillText(m, x, y);
  });

  return finalizeTexture(canvas);
}
