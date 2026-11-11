import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { profile, ui, type Lang } from '../data/profile';
import { clamp, useFrame } from '../lib/flight';
import { LangToggle } from './Panels';

const d = (ms = 0) => ({ '--d': `${ms}ms` }) as CSSProperties;

/* ────────────────────────────────────────────────────────────────────────────
   Canopy frame + dashboard silhouette. Drawn in design units (16 = 1rem) for the
   exact stage size, so nothing is ever stretched whatever the aspect ratio.
   ──────────────────────────────────────────────────────────────────────────── */
export function CockpitFrame({ W, H }: { W: number; H: number }) {
  const cx = W / 2;
  const top = 40;
  const ax = 130;
  const wall = 24;
  const chamferY = 180;
  const shelfY = H - 208;
  const humpY = H - 236;
  const edgeY = H - 262;
  const shelfX = 150;
  const hx0 = cx - 232;
  const hx1 = cx - 208;
  const nIn = 152;
  const nOut = 170;
  const notchY = 60;

  const win =
    `M${ax} ${top}L${cx - nOut} ${top}L${cx - nIn} ${notchY}L${cx + nIn} ${notchY}L${cx + nOut} ${top}` +
    `L${W - ax} ${top}L${W - wall} ${chamferY}L${W - wall} ${H}L${wall} ${H}L${wall} ${chamferY}Z`;
  const dashTop =
    `M0 ${edgeY}L${shelfX} ${shelfY}L${hx0} ${shelfY}L${hx1} ${humpY}L${W - hx1} ${humpY}` +
    `L${W - hx0} ${shelfY}L${W - shelfX} ${shelfY}L${W} ${edgeY}`;

  const sTop = cx - 242;
  const sBot = cx - 280;
  const strut = (m: (x: number) => number) =>
    `M${m(sTop - 5)} ${top - 1}L${m(sTop + 6)} ${top - 1}L${m(sBot + 9)} ${shelfY + 3}L${m(sBot - 8)} ${shelfY + 3}Z`;
  const inner = (m: (x: number) => number) => `M${m(sTop + 6)} ${top}L${m(sBot + 9)} ${shelfY}`;
  const outer = (m: (x: number) => number) => `M${m(sTop - 5)} ${top}L${m(sBot - 8)} ${shelfY}`;
  const left = (x: number) => x;
  const right = (x: number) => W - x;

  const leds = ['#56e6b9', '#8dc6f2', '#8dc6f2', '#ffb048', '#8dc6f2', '#8dc6f2', '#56e6b9'];

  return (
    <svg className="frame" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="hull" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0d1727" />
          <stop offset="0.28" stopColor="#080d17" />
          <stop offset="1" stopColor="#04070c" />
        </linearGradient>
        <linearGradient id="dash" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#111c2e" />
          <stop offset="0.22" stopColor="#0a111d" />
          <stop offset="1" stopColor="#04060b" />
        </linearGradient>
        <linearGradient id="strutL" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#04070d" />
          <stop offset="0.6" stopColor="#172337" />
          <stop offset="1" stopColor="#0a111d" />
        </linearGradient>
        <linearGradient id="strutR" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0" stopColor="#04070d" />
          <stop offset="0.6" stopColor="#172337" />
          <stop offset="1" stopColor="#0a111d" />
        </linearGradient>
        <linearGradient id="sheen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.06" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="underglow" cx="0.5" cy="1" r="0.75">
          <stop offset="0" stopColor="#ffb048" stopOpacity="0.1" />
          <stop offset="1" stopColor="#ffb048" stopOpacity="0" />
        </radialGradient>
        <filter id="soft" x="-5%" y="-40%" width="110%" height="180%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>

      {/* glass reflections */}
      <path d={`M${ax + 46} ${top}L${ax + 150} ${top}L${wall + 24} ${top + 400}L${wall} ${top + 300}Z`} fill="url(#sheen)" />
      <path
        d={`M${W - ax - 150} ${top}L${W - ax - 96} ${top}L${W - wall - 96} ${top + 430}L${W - wall - 130} ${top + 430}Z`}
        fill="url(#sheen)"
        opacity="0.6"
      />

      {/* struts */}
      <path d={strut(left)} fill="url(#strutL)" />
      <path d={strut(right)} fill="url(#strutR)" />
      <path d={inner(left)} stroke="rgb(170 215 255)" strokeOpacity="0.34" strokeWidth="1" fill="none" />
      <path d={inner(right)} stroke="rgb(170 215 255)" strokeOpacity="0.34" strokeWidth="1" fill="none" />
      <path d={outer(left)} stroke="rgb(170 215 255)" strokeOpacity="0.1" strokeWidth="1" fill="none" />
      <path d={outer(right)} stroke="rgb(170 215 255)" strokeOpacity="0.1" strokeWidth="1" fill="none" />

      {/* canopy frame with the window cut out */}
      <path d={`M0 0H${W}V${H}H0Z ${win}`} fill="url(#hull)" fillRule="evenodd" />
      <path d={win} fill="none" stroke="rgb(120 190 255)" strokeOpacity="0.2" strokeWidth="6" filter="url(#soft)" />
      <path d={win} fill="none" stroke="rgb(170 215 255)" strokeOpacity="0.3" strokeWidth="1" />

      {/* overhead console housing the compass */}
      <rect x={cx - 146} y={3.5} width={292} height={52} rx={2} fill="#04080f" stroke="rgb(141 198 242)" strokeOpacity="0.2" />
      {[-1, 1].map((s) => (
        <g key={s} opacity="0.9">
          <circle cx={cx + s * 196} cy={20} r={2} fill="#56e6b9" />
          <circle cx={cx + s * 208} cy={20} r={2} fill="#22324c" />
          <circle cx={cx + s * 220} cy={20} r={2} fill="#ffb048" />
        </g>
      ))}

      {/* dashboard */}
      <path d={`${dashTop}V${H}H0Z`} fill="url(#dash)" />
      <rect x={cx - 420} y={humpY} width={840} height={236} fill="url(#underglow)" />
      <path d={dashTop} transform="translate(0 8)" fill="none" stroke="#000" strokeOpacity="0.6" strokeWidth="1" />
      <path d={dashTop} transform="translate(0 9)" fill="none" stroke="rgb(170 215 255)" strokeOpacity="0.09" strokeWidth="1" />
      <path d={dashTop} fill="none" stroke="rgb(110 185 255)" strokeOpacity="0.5" strokeWidth="6" filter="url(#soft)" />
      <path d={dashTop} fill="none" stroke="rgb(200 230 255)" strokeOpacity="0.8" strokeWidth="1.25" strokeLinejoin="round" />

      {/* panel seams */}
      {[hx0 - 10, W - hx0 + 10, shelfX - 8, W - shelfX + 8].map((x) => (
        <g key={x}>
          <line x1={x} y1={shelfY + 12} x2={x} y2={H} stroke="#000" strokeOpacity="0.55" />
          <line x1={x + 1} y1={shelfY + 12} x2={x + 1} y2={H} stroke="rgb(170 215 255)" strokeOpacity="0.07" />
        </g>
      ))}

      {/* status LEDs on the console lip */}
      {leds.map((c, i) => (
        <rect key={i} x={cx - 87 + i * 26} y={humpY + 4.5} width={18} height={2.5} rx={1} fill={c} opacity={i === 3 ? 1 : 0.75} />
      ))}
    </svg>
  );
}

/* ── parallax layer: holograms drift against the hull as the ship turns ───── */
export function Plx({ depth, className, children }: { depth: number; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef('');
  useFrame((f) => {
    const el = ref.current;
    if (!el) return;
    const dpr = window.devicePixelRatio || 1;
    // snap to device pixels so text stays razor sharp at rest
    const x = Math.round(-f.lookX * depth * f.rem * dpr) / dpr;
    const y = Math.round(-f.lookY * depth * 0.6 * f.rem * dpr) / dpr;
    const ry = clamp(f.lookVX * 1.3, -2.6, 2.6);
    const rx = clamp(-f.lookVY * 1.0, -1.8, 1.8);
    const moving = Math.abs(ry) > 0.05 || Math.abs(rx) > 0.05;
    const tf = moving
      ? `translate3d(${x}px,${y}px,0) rotateY(${ry.toFixed(2)}deg) rotateX(${rx.toFixed(2)}deg)`
      : `translate3d(${x}px,${y}px,0)`;
    if (tf !== last.current) {
      last.current = tf;
      el.style.transform = tf;
    }
  });
  return (
    <div ref={ref} className={`plx ${className ?? ''}`}>
      {children}
    </div>
  );
}

/* ── top HUD ──────────────────────────────────────────────────────────────── */
function Clock() {
  const ref = useRef<HTMLTimeElement>(null);
  useEffect(() => {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: profile.timezone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const tick = () => {
      if (ref.current) ref.current.textContent = fmt.format(new Date());
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <time ref={ref} className="clock">
      --:--:--
    </time>
  );
}

export function TopHud({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  return (
    <header className="tophud">
      <div className="tophud-group">
        <span className="badge">{profile.callsign}</span>
        <span className="label">{ui.pilot[lang]}</span>
        <span className="tophud-name">{profile.name}</span>
      </div>
      <div className="tophud-group">
        <span className="label">{ui.localTime[lang]}</span>
        <Clock />
        <span className="label">UTC+7</span>
        <span className="sep" aria-hidden="true" />
        <LangToggle lang={lang} setLang={setLang} />
      </div>
    </header>
  );
}

const PX_PER_DEG = 3.2;
const DEG_FROM = -90;
const DEG_TO = 450;
const CARDINAL: Record<number, string> = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };

export function Compass() {
  const ref = useRef<SVGSVGElement>(null);
  useFrame((f) => {
    if (!ref.current) return;
    const hdg = (((42 + f.yaw * 57.3 * 1.25) % 360) + 360) % 360;
    ref.current.style.transform = `translate3d(${(-(hdg - DEG_FROM) * PX_PER_DEG * f.rem) / 16}px,0,0)`;
  });
  const ticks: ReactNode[] = [];
  for (let deg = DEG_FROM; deg <= DEG_TO; deg += 5) {
    const x = (deg - DEG_FROM) * PX_PER_DEG;
    const major = deg % 15 === 0;
    const norm = ((deg % 360) + 360) % 360;
    ticks.push(
      <line key={`l${deg}`} x1={x} x2={x} y1={14} y2={major ? 24 : 19} stroke="currentColor" strokeOpacity={major ? 0.95 : 0.5} strokeWidth={1} />,
    );
    if (major) {
      const card = CARDINAL[norm];
      ticks.push(
        <text
          key={`t${deg}`}
          x={x}
          y={39}
          textAnchor="middle"
          fontSize={card ? 12 : 10}
          fontWeight={card ? 700 : 500}
          fill={card ? '#ffc470' : 'currentColor'}
          fillOpacity={card ? 1 : 0.85}
        >
          {card ?? String(norm).padStart(3, '0')}
        </text>,
      );
    }
  }
  const width = (DEG_TO - DEG_FROM) * PX_PER_DEG;
  return (
    <div className="compass" aria-hidden="true">
      <i className="compass-caret" />
      <svg
        ref={ref}
        viewBox={`0 0 ${width} 49.6`}
        style={{ width: `${width / 16}rem`, color: 'rgb(205 232 255)', fontFamily: 'var(--font-mono)' }}
      >
        {ticks}
      </svg>
    </div>
  );
}

/* ── canopy HUD: flight-path reticle with bank indicator ──────────────────── */
export function Reticle() {
  const wings = useRef<SVGGElement>(null);
  useFrame((f) => {
    wings.current?.setAttribute('transform', `rotate(${(f.bank * 57.3 * 3).toFixed(2)} 88 88)`);
  });
  return (
    <div className="reticle" aria-hidden="true">
      <svg viewBox="0 0 176 176" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
        <circle cx="88" cy="88" r="26" strokeOpacity="0.5" strokeDasharray="2 5" />
        <path d="M88 50v8" strokeOpacity="0.9" />
        <path d="M88 79v5M88 92v5M79 88h5M92 88h5" />
        <circle cx="88" cy="88" r="1.3" fill="currentColor" stroke="none" />
        <g ref={wings}>
          <path d="M32 88h24l4 4M144 88h-24l-4 4" strokeOpacity="0.95" />
          <path d="M32 88v4M144 88v4" strokeOpacity="0.6" />
        </g>
      </svg>
    </div>
  );
}

/* ── destination lock: brackets + readout glued to the planet ─────────────── */
export function TargetMarker({ lang }: { lang: Lang }) {
  const ref = useRef<HTMLDivElement>(null);
  const info = useRef<HTMLElement>(null);
  const label = useRef<HTMLDivElement>(null);
  const st = useRef({ size: 0, tick: 1, limit: Infinity, fade: -1 });
  useFrame((f, dt) => {
    const el = ref.current;
    if (!el) return;
    const dpr = window.devicePixelRatio || 1;
    const snap = (v: number) => Math.round(v * dpr) / dpr;
    const half = f.targetR * 1.07;
    el.style.transform = `translate3d(${snap(f.targetX - half)}px,${snap(f.targetY - half)}px,0)`;
    const size = snap(half * 2);
    if (Math.abs(size - st.current.size) > 0.75) {
      st.current.size = size;
      el.style.width = el.style.height = `${size}px`;
    }
    const vis = f.targetVisible && f.targetR > 1 ? '1' : '0';
    if (el.style.opacity !== vis) el.style.opacity = vis;

    // fade the readout out before it can collide with the overview copy
    const bottom = f.targetY + half + 3.9 * f.rem;
    const fade = Math.round(clamp((st.current.limit - bottom + 1.2 * f.rem) / (1.2 * f.rem), 0, 1) * 20) / 20;
    if (label.current && fade !== st.current.fade) {
      st.current.fade = fade;
      label.current.style.opacity = String(fade);
    }

    st.current.tick += dt;
    if (st.current.tick > 0.2 && info.current) {
      st.current.tick = 0;
      st.current.limit = document.querySelector('.centre')?.getBoundingClientRect().top ?? Infinity;
      const dist = Math.max(0.08, 2.4 - f.travel * 0.00002);
      const eta = (dist * 118) / Math.max(f.speed, 0.05);
      const mm = String(Math.min(99, Math.floor(eta / 60))).padStart(2, '0');
      const ss = String(Math.floor(eta % 60)).padStart(2, '0');
      info.current.textContent = `${dist.toFixed(3)} AU · ETA ${mm}:${ss}`;
    }
  });
  return (
    <div ref={ref} className="target" aria-hidden="true">
      <div ref={label} className="target-label">
        <span className="label">{ui.destination[lang]}</span>
        <strong>PORTFOLIO PRIME</strong>
        <em ref={info}>2.400 AU · ETA --:--</em>
      </div>
    </div>
  );
}

/* ── dashboard instruments ────────────────────────────────────────────────── */
const GC = { x: 50, y: 52, r: 42 };
const polar = (deg: number, r: number) => {
  const a = (deg * Math.PI) / 180;
  return [GC.x + r * Math.sin(a), GC.y - r * Math.cos(a)] as const;
};

export function SpeedGauge({ lang, delay }: { lang: Lang; delay?: number }) {
  const needle = useRef<SVGGElement>(null);
  const out = useRef<SVGTextElement>(null);
  const last = useRef('');
  useFrame((f) => {
    const over = f.speed > 3.4 ? Math.sin(f.time * 38) * 1.4 : 0;
    const a = -130 + clamp(f.speed / 3.4, 0, 1) * 260 + over;
    needle.current?.setAttribute('transform', `rotate(${a.toFixed(1)} ${GC.x} ${GC.y})`);
    const txt = `${(f.speed * 0.31).toFixed(2)}c`;
    if (out.current && txt !== last.current) {
      last.current = txt;
      out.current.textContent = txt;
    }
  });
  const [x0, y0] = polar(-130, GC.r);
  const [x1, y1] = polar(130, GC.r);
  const [xh, yh] = polar(72, GC.r);
  const ticks = Array.from({ length: 11 }, (_, i) => -130 + i * 26);
  return (
    <div className="gauge gauge-left reveal" style={d(delay)} role="img" aria-label={ui.velocity[lang]}>
      <svg viewBox="0 0 100 92" fill="none">
        <circle cx={GC.x} cy={GC.y} r={47} fill="#060b14" stroke="#22324c" />
        <path d={`M${x0} ${y0}A${GC.r} ${GC.r} 0 1 1 ${x1} ${y1}`} stroke="rgb(141 198 242)" strokeOpacity="0.5" strokeWidth="1.5" />
        <path d={`M${xh} ${yh}A${GC.r} ${GC.r} 0 0 1 ${x1} ${y1}`} stroke="#ffb048" strokeWidth="2.5" />
        {ticks.map((t, i) => {
          const [ax, ay] = polar(t, i % 2 === 0 ? 34 : 37);
          const [bx, by] = polar(t, 40);
          return <line key={t} x1={ax} y1={ay} x2={bx} y2={by} stroke="rgb(205 232 255)" strokeOpacity={i % 2 === 0 ? 0.9 : 0.5} strokeWidth="1" />;
        })}
        <g ref={needle} transform={`rotate(-130 ${GC.x} ${GC.y})`}>
          <line x1={GC.x} y1={GC.y + 6} x2={GC.x} y2={GC.y - 35} stroke="#ffc470" strokeWidth="1.8" strokeLinecap="round" />
        </g>
        <circle cx={GC.x} cy={GC.y} r={4} fill="#0b1525" stroke="#ffc470" strokeWidth="1.2" />
        <text
          ref={out}
          x={GC.x}
          y={GC.y + 27}
          textAnchor="middle"
          fontSize="11"
          fontWeight="700"
          fill="#ffc470"
          style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}
        >
          0.00c
        </text>
      </svg>
      <span className="label">{ui.velocity[lang]}</span>
    </div>
  );
}

export function Radar({ lang, delay }: { lang: Lang; delay?: number }) {
  return (
    <div className="gauge gauge-right reveal" style={d(delay)} role="img" aria-label={ui.radar[lang]}>
      <svg viewBox="0 0 100 100" fill="none">
        <defs>
          <linearGradient id="radar-sweep" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#8dc6f2" stopOpacity="0" />
            <stop offset="1" stopColor="#8dc6f2" stopOpacity="0.5" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="47" fill="#060b14" stroke="#22324c" />
        <g stroke="rgb(141 198 242)" strokeOpacity="0.4" strokeWidth="0.8">
          <circle cx="50" cy="50" r="42" />
          <circle cx="50" cy="50" r="28" />
          <circle cx="50" cy="50" r="14" />
          <path d="M50 8v84M8 50h84" strokeOpacity="0.25" />
        </g>
        <g className="radar-sweep">
          <path d="M50 50L50 8A42 42 0 0 1 79.7 20.3Z" fill="url(#radar-sweep)" />
          <path d="M50 50L79.7 20.3" stroke="#cde8ff" strokeOpacity="0.8" strokeWidth="0.8" />
        </g>
        <circle cx="50" cy="50" r="1.6" fill="#cde8ff" />
        <circle cx="62" cy="27" r="2.6" fill="#ffb048" />
        <circle cx="62" cy="27" r="5.2" stroke="#ffb048" strokeOpacity="0.6" strokeWidth="0.8" />
        <circle cx="31" cy="61" r="1.6" fill="#8dc6f2" />
        <circle cx="70" cy="68" r="1.6" fill="#8dc6f2" />
        <circle cx="38" cy="34" r="1.2" fill="#8dc6f2" fillOpacity="0.7" />
      </svg>
      <span className="label">{ui.radar[lang]}</span>
    </div>
  );
}
