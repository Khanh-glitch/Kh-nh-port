import type { CockpitLang } from '../lib/cockpitBus';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  Cockpit screen painter — "bàn hình" của buồng lái.
 *
 *  Every screen is one 2D canvas: real portfolio content is drawn onto it, and
 *  the canvas becomes the texture of a glass pane in the 3D cockpit.
 *
 *  Layout is authored against a single VIRTUAL surface of 1024×640. The small
 *  selector keys and the large primary display therefore share exactly one set
 *  of layout code, and `paintScreen` scales it to the real canvas.
 *
 *  Performance rules that this file must keep:
 *   • Painters never run per frame. They run on a section change or a language
 *     change only.
 *   • No blur, no filters, no shadows, no gradients per glyph. Flat fills and
 *     one horizontal gradient per screen.
 *   • Text is drawn once per repaint; nothing animates inside a screen.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Virtual authoring surface. Every coordinate below is in this space. */
const VW = 1024;
const VH = 640;

/** Physical canvas sizes. The primary display gets more pixels. */
export const SCREEN_W = 512;
export const SCREEN_H = 320;
export const MAIN_W = 1024;
export const MAIN_H = 640;

export interface ProjectEntry {
  name: string;
  tag: string;
  metric: string;
  note: { vi: string; en: string };
}

export interface ExperienceEntry {
  period: { vi: string; en: string };
  role: string;
  org: string;
  note: { vi: string; en: string };
}

export interface StackEntry {
  label: string;
  items: string[];
}

export interface ScreenData {
  name: string;
  callsign: string;
  title: { vi: string; en: string };
  focus: string[];
  availability: { vi: string; en: string };
  headline: { vi: string; en: string };
  stats: { value: string; label: { vi: string; en: string } }[];
  facts: { label: { vi: string; en: string }; value: { vi: string; en: string } }[];
  experience: ExperienceEntry[];
  projects: ProjectEntry[];
  stack: StackEntry[];
  contact: {
    github: { label: string; url: string };
    email: string;
  };
}

const C = {
  void: '#02040a',
  line: 'rgba(120, 190, 255, 0.30)',
  lineSoft: 'rgba(120, 190, 255, 0.13)',
  ice: '#eaf3ff',
  dim: 'rgba(206, 229, 255, 0.72)',
  faint: 'rgba(188, 218, 255, 0.46)',
  cyan: '#7ee7ff',
  amber: '#ffc271',
  green: '#7dffb0',
};

const MONO = '"JetBrains Mono", ui-monospace, monospace';
const SANS = '"Be Vietnam Pro", ui-sans-serif, system-ui, sans-serif';
const DISPLAY = '"Chakra Petch", "Be Vietnam Pro", ui-sans-serif, sans-serif';

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

/** Draw wrapped text, ellipsising the final line when it overflows. */
function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxW: number,
  lineH: number,
  maxLines: number,
): number {
  const words = text.split(/\s+/).filter(Boolean);
  let line = '';
  let lines = 0;
  let cursorY = y;
  for (let i = 0; i < words.length; i++) {
    const test = line ? line + ' ' + words[i] : words[i];
    if (ctx.measureText(test).width > maxW && line) {
      lines++;
      if (lines >= maxLines) {
        let cut = line;
        while (cut.length > 1 && ctx.measureText(cut + '…').width > maxW) cut = cut.slice(0, -1);
        ctx.fillText(cut + '…', x, cursorY);
        return cursorY + lineH;
      }
      ctx.fillText(line, x, cursorY);
      cursorY += lineH;
      line = words[i];
    } else {
      line = test;
    }
  }
  if (line) {
    ctx.fillText(line, x, cursorY);
    cursorY += lineH;
  }
  return cursorY;
}

/** Background, scanlines, border and corner ticks — identical on every screen. */
function chrome(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = C.void;
  ctx.fillRect(0, 0, VW, VH);

  const g = ctx.createLinearGradient(0, 0, 0, VH);
  g.addColorStop(0, '#0b1a2d');
  g.addColorStop(0.6, '#050d19');
  g.addColorStop(1, '#03080f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VW, VH);

  ctx.fillStyle = 'rgba(120,200,255,0.026)';
  for (let y = 0; y < VH; y += 4) ctx.fillRect(0, y, VW, 1);

  ctx.strokeStyle = C.line;
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, VW - 3, VH - 3);

  ctx.strokeStyle = C.cyan;
  ctx.lineWidth = 5;
  const t = 32;
  const corners: [number, number, number, number][] = [
    [0, 0, 1, 1],
    [VW, 0, -1, 1],
    [0, VH, 1, -1],
    [VW, VH, -1, -1],
  ];
  for (const [cx, cy, sx, sy] of corners) {
    ctx.beginPath();
    ctx.moveTo(cx + sx * 2, cy + sy * t);
    ctx.lineTo(cx + sx * 2, cy + sy * 2);
    ctx.lineTo(cx + sx * t, cy + sy * 2);
    ctx.stroke();
  }
}

/** Screen header: eyebrow, title, hairline, status pill. */
function header(
  ctx: CanvasRenderingContext2D,
  title: string,
  eyebrow: string,
  status: string,
  ok = true,
  compact = false,
) {
  const pad = compact ? 34 : 48;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  ctx.font = `600 ${compact ? 20 : 22}px ${MONO}`;
  ctx.fillStyle = C.faint;
  ctx.fillText(eyebrow.toUpperCase(), pad, compact ? 52 : 54);

  ctx.font = `700 ${compact ? 34 : 40}px ${DISPLAY}`;
  ctx.fillStyle = C.ice;
  ctx.fillText(title.toUpperCase(), pad, compact ? 96 : 106);

  ctx.strokeStyle = C.lineSoft;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pad, compact ? 114 : 126);
  ctx.lineTo(VW - pad, compact ? 114 : 126);
  ctx.stroke();

  // status pill, right aligned
  ctx.font = `600 ${compact ? 18 : 20}px ${MONO}`;
  const tw = ctx.measureText(status).width;
  const ph = compact ? 34 : 38;
  const py = compact ? 26 : 30;
  const px = VW - pad - tw - 40;
  ctx.fillStyle = ok ? 'rgba(60,255,150,0.10)' : 'rgba(255,180,80,0.10)';
  rr(ctx, px, py, tw + 40, ph, 5);
  ctx.fill();
  ctx.strokeStyle = ok ? 'rgba(110,255,170,0.45)' : 'rgba(255,190,110,0.45)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = ok ? C.green : C.amber;
  ctx.beginPath();
  ctx.arc(px + 17, py + ph / 2, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillText(status, px + 30, py + ph / 2 + 7);
}

const PAD = 48;

/* ── 1. DANH TÍNH — pilot identity ───────────────────────────────────────── */
export function paintIdentity(ctx: CanvasRenderingContext2D, d: ScreenData, lang: CockpitLang) {
  chrome(ctx);
  header(ctx, lang === 'vi' ? 'Danh tính phi công' : 'Pilot identity', d.callsign, d.availability[lang]);

  ctx.font = `700 86px ${DISPLAY}`;
  ctx.fillStyle = C.ice;
  ctx.fillText(d.name, PAD, 232);

  ctx.font = `500 30px ${SANS}`;
  ctx.fillStyle = C.cyan;
  ctx.fillText(d.title[lang], PAD, 276);

  ctx.font = `400 26px ${SANS}`;
  ctx.fillStyle = C.dim;
  wrap(ctx, d.headline[lang], PAD, 336, VW - PAD * 2, 36, 2);

  // focus chips
  ctx.font = `600 23px ${MONO}`;
  let cx = PAD;
  for (const f of d.focus) {
    const w = ctx.measureText(f).width + 34;
    ctx.fillStyle = 'rgba(80,180,255,0.10)';
    rr(ctx, cx, 396, w, 42, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,200,255,0.34)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = C.ice;
    ctx.fillText(f, cx + 17, 424);
    cx += w + 12;
  }

  // stat strip along the bottom
  const sw = (VW - PAD * 2) / d.stats.length;
  d.stats.forEach((s, i) => {
    const x = PAD + i * sw;
    ctx.font = `700 48px ${DISPLAY}`;
    ctx.fillStyle = C.cyan;
    ctx.fillText(s.value, x, 534);
    ctx.font = `500 20px ${SANS}`;
    ctx.fillStyle = C.faint;
    ctx.fillText(s.label[lang], x, 566, sw - 18);
    if (i) {
      ctx.strokeStyle = C.lineSoft;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 16, 496);
      ctx.lineTo(x - 16, 574);
      ctx.stroke();
    }
  });
}

/* ── 2. THÔNG TIN NHANH — quick facts ───────────────────────────────────── */
export function paintFacts(ctx: CanvasRenderingContext2D, d: ScreenData, lang: CockpitLang) {
  chrome(ctx);
  header(ctx, lang === 'vi' ? 'Thông tin nhanh' : 'Quick facts', 'FACTS', lang === 'vi' ? 'SẴN SÀNG' : 'READY');

  const rowH = 108;
  d.facts.forEach((f, i) => {
    const y = 210 + i * rowH;
    ctx.font = `600 22px ${MONO}`;
    ctx.fillStyle = C.faint;
    ctx.fillText(f.label[lang].toUpperCase(), PAD, y - 30);
    ctx.font = `600 38px ${SANS}`;
    ctx.fillStyle = C.ice;
    ctx.fillText(f.value[lang], PAD, y + 8, VW - PAD * 2);
    if (i < d.facts.length - 1) {
      ctx.strokeStyle = C.lineSoft;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(PAD, y + 40);
      ctx.lineTo(VW - PAD, y + 40);
      ctx.stroke();
    }
  });

  ctx.font = `500 21px ${SANS}`;
  ctx.fillStyle = C.faint;
  wrap(
    ctx,
    lang === 'vi'
      ? 'Mọi số liệu trên bàn hình được lấy trực tiếp từ hồ sơ portfolio.'
      : 'Every reading on these screens is taken directly from the portfolio.',
    PAD, VH - 52, VW - PAD * 2, 27, 1,
  );
}

/* ── 3. HÀNH TRÌNH — experience ─────────────────────────────────────────── */
export function paintExperience(ctx: CanvasRenderingContext2D, d: ScreenData, lang: CockpitLang) {
  chrome(ctx);
  header(ctx, lang === 'vi' ? 'Hành trình dự án' : 'Project journey', 'LOGBOOK', lang === 'vi' ? 'ĐÃ GHI' : 'LOGGED');

  // Fixed vertical budget: content lives between y=150 and y=600 so a fourth
  // entry could never push the last note off the glass.
  const rowH = 150;
  d.experience.forEach((e, i) => {
    const y = 186 + i * rowH;
    ctx.fillStyle = C.cyan;
    ctx.beginPath();
    ctx.arc(PAD + 12, y - 16, 7, 0, Math.PI * 2);
    ctx.fill();
    if (i < d.experience.length - 1) {
      ctx.strokeStyle = 'rgba(120,200,255,0.28)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(PAD + 12, y - 6);
      ctx.lineTo(PAD + 12, y + rowH - 40);
      ctx.stroke();
    }

    ctx.font = `600 21px ${MONO}`;
    ctx.fillStyle = C.amber;
    ctx.fillText(e.period[lang], PAD + 42, y - 28);

    ctx.font = `700 40px ${DISPLAY}`;
    ctx.fillStyle = C.ice;
    ctx.fillText(e.role, PAD + 42, y + 16, VW - PAD * 2 - 42);

    ctx.font = `500 24px ${SANS}`;
    ctx.fillStyle = C.cyan;
    ctx.fillText(e.org, PAD + 42, y + 50, VW - PAD * 2 - 42);

    ctx.font = `400 23px ${SANS}`;
    ctx.fillStyle = C.dim;
    wrap(ctx, e.note[lang], PAD + 42, y + 82, VW - PAD * 2 - 42, 28, 1);
  });
}

/* ── 4. DỰ ÁN — projects ────────────────────────────────────────────────── */
export function paintProjects(ctx: CanvasRenderingContext2D, d: ScreenData, lang: CockpitLang) {
  chrome(ctx);
  header(ctx, lang === 'vi' ? 'Dự án tiêu biểu' : 'Featured projects', 'PROJECTS', `${d.projects.length} LIVE`);

  const cardH = 136;
  const gap = 18;
  d.projects.forEach((p, i) => {
    const y = 170 + i * (cardH + gap);
    ctx.fillStyle = 'rgba(90,170,255,0.055)';
    rr(ctx, PAD, y, VW - PAD * 2, cardH, 6);
    ctx.fill();
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = i === 0 ? C.cyan : i === 1 ? C.amber : C.green;
    ctx.fillRect(PAD, y, 6, cardH);

    ctx.font = `700 40px ${DISPLAY}`;
    ctx.fillStyle = C.ice;
    ctx.fillText(p.name, PAD + 30, y + 50, VW - PAD * 2 - 330);

    ctx.font = `600 22px ${MONO}`;
    ctx.fillStyle = C.cyan;
    ctx.fillText(p.tag, PAD + 30, y + 82);

    ctx.font = `400 23px ${SANS}`;
    ctx.fillStyle = C.dim;
    wrap(ctx, p.note[lang], PAD + 30, y + 112, VW - PAD * 2 - 330, 26, 1);

    ctx.font = `700 24px ${MONO}`;
    const mw = ctx.measureText(p.metric).width;
    const bx = VW - PAD - 26 - mw - 30;
    ctx.fillStyle = 'rgba(120,230,255,0.10)';
    rr(ctx, bx, y + 30, mw + 30, 40, 4);
    ctx.fill();
    ctx.fillStyle = C.cyan;
    ctx.fillText(p.metric, bx + 15, y + 58);
  });
}

/* ── 5. CÔNG NGHỆ — stack ───────────────────────────────────────────────── */
export function paintStack(ctx: CanvasRenderingContext2D, d: ScreenData, lang: CockpitLang) {
  chrome(ctx);
  header(ctx, lang === 'vi' ? 'Công nghệ' : 'Tech stack', 'STACK', `${d.stack.length} NHÓM`);

  const colW = (VW - PAD * 2) / 2;
  const rowH = 148;
  let col = 0;
  let row = 0;
  d.stack.forEach((s) => {
    const x = PAD + col * colW;
    const y = 196 + row * rowH;

    ctx.font = `700 27px ${DISPLAY}`;
    ctx.fillStyle = C.cyan;
    ctx.fillText(s.label.toUpperCase(), x, y);

    ctx.strokeStyle = C.lineSoft;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y + 12);
    ctx.lineTo(x + colW - 44, y + 12);
    ctx.stroke();

    // Exactly one line of breathing room between the rule and the first item.
    s.items.forEach((item, i) => {
      const iy = y + 44 + i * 26;
      ctx.font = `500 22px ${SANS}`;
      ctx.fillStyle = C.faint;
      ctx.fillText('·', x, iy);
      ctx.fillStyle = C.ice;
      ctx.fillText(item, x + 16, iy, colW - 68);
    });

    col++;
    if (col > 1) { col = 0; row++; }
  });
}

/* ── 6. LIÊN HỆ — contact ───────────────────────────────────────────────── */
export function paintContact(ctx: CanvasRenderingContext2D, d: ScreenData, lang: CockpitLang) {
  chrome(ctx);
  header(ctx, lang === 'vi' ? 'Liên hệ trực tiếp' : 'Direct contact', 'COMMS', d.availability[lang]);

  ctx.font = `700 46px ${DISPLAY}`;
  ctx.fillStyle = C.ice;
  ctx.fillText(d.name, PAD, 196);

  ctx.font = `500 27px ${SANS}`;
  ctx.fillStyle = C.dim;
  wrap(
    ctx,
    lang === 'vi'
      ? 'Đang nhận dự án mới về thiết kế trải nghiệm, tương tác 3D và công cụ AI.'
      : 'Open to new work in experience design, interactive 3D and AI tooling.',
    PAD, 238, VW - PAD * 2, 34, 2,
  );

  ctx.font = `600 21px ${MONO}`;
  ctx.fillStyle = C.faint;
  ctx.fillText(lang === 'vi' ? 'NHẬN VIỆC' : 'OPEN TO', PAD, 308);

  ctx.font = `600 23px ${MONO}`;
  let cx = PAD;
  for (const f of d.focus) {
    const w = ctx.measureText(f).width + 34;
    ctx.fillStyle = 'rgba(80,180,255,0.10)';
    rr(ctx, cx, 324, w, 42, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,200,255,0.34)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = C.ice;
    ctx.fillText(f, cx + 17, 352);
    cx += w + 12;
  }

  const w = VW - PAD * 2;
  const h = 96;
  const y = 400;
  ctx.fillStyle = 'rgba(90,170,255,0.075)';
  rr(ctx, PAD, y, w, h, 6);
  ctx.fill();
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = C.cyan;
  ctx.fillRect(PAD, y, 5, h);

  ctx.font = `600 21px ${MONO}`;
  ctx.fillStyle = C.faint;
  ctx.fillText('GITHUB — ' + (lang === 'vi' ? 'MỞ KÊNH' : 'OPEN CHANNEL'), PAD + 30, y + 34);
  ctx.font = `600 30px ${SANS}`;
  ctx.fillStyle = C.ice;
  ctx.fillText(d.contact.github.label, PAD + 30, y + 72, w - 60);

  ctx.font = `500 21px ${SANS}`;
  ctx.fillStyle = C.faint;
  wrap(
    ctx,
    lang === 'vi'
      ? 'Ấn vào tấm kính này để mở GitHub. Email và LinkedIn đang được cập nhật.'
      : 'Press this pane to open GitHub. Email and LinkedIn are being updated.',
    PAD, VH - 58, w, 27, 1,
  );
}

/* ── 0. PHÍM CHỌN — selector key ──────────────────────────────────────────
   These panes are only ~220 px wide on screen, so a full report can never be
   legible on them. Each key shows its index, its name and one line of
   substance; pressing it loads the whole section into the primary display. */
const SECTION_TITLES: Record<CockpitLang, string[]> = {
  vi: ['Danh tính', 'Thông tin', 'Hành trình', 'Dự án', 'Công nghệ', 'Liên hệ'],
  en: ['Identity', 'Facts', 'Journey', 'Projects', 'Stack', 'Contact'],
};

export function paintKey(
  ctx: CanvasRenderingContext2D,
  index: number,
  d: ScreenData,
  lang: CockpitLang,
  selected: boolean,
) {
  chrome(ctx);
  const summary: string[] = [
    d.availability[lang],
    d.facts[0] ? d.facts[0].value[lang] : '',
    d.experience[0] ? d.experience[0].role : '',
    d.projects[0] ? d.projects[0].name : '',
    d.stack[0] ? d.stack[0].label : '',
    d.contact.github.label,
  ];
  const labels = SECTION_TITLES[lang];

  ctx.textAlign = 'left';
  ctx.font = `700 44px ${MONO}`;
  ctx.fillStyle = selected ? C.cyan : C.faint;
  ctx.fillText(String(index + 1).padStart(2, '0'), PAD, 118);

  ctx.font = `700 62px ${DISPLAY}`;
  ctx.fillStyle = C.ice;
  wrap(ctx, labels[index].toUpperCase(), PAD, 236, VW - PAD * 2, 66, 2);

  ctx.strokeStyle = C.lineSoft;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAD, 360);
  ctx.lineTo(VW - PAD, 360);
  ctx.stroke();

  ctx.font = `500 34px ${SANS}`;
  ctx.fillStyle = C.dim;
  wrap(ctx, summary[index] ?? '', PAD, 428, VW - PAD * 2, 42, 3);

  if (selected) {
    ctx.fillStyle = C.cyan;
    ctx.fillRect(PAD, VH - PAD - 6, VW - PAD * 2, 6);
    ctx.font = `600 26px ${MONO}`;
    ctx.fillStyle = C.cyan;
    ctx.fillText(lang === 'vi' ? 'ĐANG MỞ' : 'ON SCREEN', PAD, VH - PAD - 28);
  } else {
    ctx.font = `600 26px ${MONO}`;
    ctx.fillStyle = C.faint;
    ctx.fillText(lang === 'vi' ? 'ẤN ĐỂ MỞ' : 'PRESS TO OPEN', PAD, VH - PAD - 28);
  }
}

/* ── 7. CỬA CHUYỂN TIẾP — transfer gate ─────────────────────────────────── */
export function paintGate(
  ctx: CanvasRenderingContext2D,
  d: ScreenData,
  lang: CockpitLang,
  ready: boolean,
  progress: number,
) {
  chrome(ctx);
  header(
    ctx,
    lang === 'vi' ? 'Cửa chuyển tiếp' : 'Transfer gate',
    d.callsign,
    ready ? (lang === 'vi' ? 'THÔNG' : 'CLEAR') : lang === 'vi' ? 'ĐANG NẠP' : 'CHARGING',
    ready,
    true,
  );

  const cx = VW / 2;
  const cy = 300;
  const R = 96;

  ctx.strokeStyle = C.lineSoft;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = ready ? C.green : C.cyan;
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  const frac = Math.max(0, Math.min(1, progress / 100));
  ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
  ctx.stroke();
  ctx.lineCap = 'butt';

  ctx.textAlign = 'center';
  ctx.font = `700 54px ${DISPLAY}`;
  ctx.fillStyle = C.ice;
  ctx.fillText(`${Math.round(progress)}%`, cx, cy + 18);
  ctx.font = `600 19px ${MONO}`;
  ctx.fillStyle = C.faint;
  ctx.fillText(ready ? (lang === 'vi' ? 'SẴN SÀNG' : 'READY') : lang === 'vi' ? 'ĐANG DỰNG' : 'BUILDING', cx, cy + 50);

  ctx.font = `400 23px ${SANS}`;
  ctx.fillStyle = C.dim;
  const line = ready
    ? lang === 'vi'
      ? 'Hệ thống sẵn sàng. Ấn “Vào portfolio” để bắt đầu.'
      : 'All systems ready. Press “Enter portfolio” to begin.'
    : lang === 'vi'
      ? 'Đang dựng cảnh không gian. Cửa mở khi khung hình thật hiện ra.'
      : 'Building the space scene. Opens once real frames paint.';
  ctx.fillText(line, cx, cy + 116, VW - 80);
  ctx.textAlign = 'left';
}

export const SCREENS = [
  paintIdentity,
  paintFacts,
  paintExperience,
  paintProjects,
  paintStack,
  paintContact,
] as const;

/**
 * Paint one screen into its canvas.
 *
 * All painters are authored on a 1024×640 virtual surface, so the small
 * selector keys and the big primary display share one layout and differ only
 * in pixel density.
 */
export function paintScreen(
  index: number,
  canvas: HTMLCanvasElement,
  d: ScreenData,
  lang: CockpitLang,
  ready: boolean,
  progress: number,
  scale = 1,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  if (index === 6) {
    paintGate(ctx, d, lang, ready, progress);
  } else {
    const fn = SCREENS[index];
    if (fn) fn(ctx, d, lang);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

export { VW, VH };
