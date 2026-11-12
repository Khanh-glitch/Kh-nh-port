import { Fragment, useRef, useState, type CSSProperties, type ReactNode, type SVGProps } from 'react';
import { profile, ui, type Lang } from '../data/profile';
import { flight, useFrame } from '../lib/flight';

type P = { lang: Lang; delay?: number };

const cx = (...a: (string | false | undefined)[]) => a.filter(Boolean).join(' ');
const d = (ms = 0) => ({ '--d': `${ms}ms` }) as CSSProperties;

/* ── icons (inline so they stay crisp and inherit colour) ─────────────────── */
const svgBase: SVGProps<SVGSVGElement> = {
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};
const Check = () => (
  <svg {...svgBase} strokeWidth={2}>
    <path d="M3 8.5l3.2 3L13 4.5" />
  </svg>
);
const Chevrons = ({ className }: { className?: string }) => (
  <svg {...svgBase} strokeWidth={2} className={className}>
    <path d="M3 3.5L7.5 8 3 12.5M8.5 3.5L13 8l-4.5 4.5" />
  </svg>
);
const Mail = () => (
  <svg {...svgBase}>
    <rect x="1.75" y="3.25" width="12.5" height="9.5" rx="1" />
    <path d="M2 4l6 4.75L14 4" />
  </svg>
);
const Phone = () => (
  <svg {...svgBase}>
    <path d="M3.2 2.2h2.3l1.1 3-1.5 1a7.2 7.2 0 0 0 4.7 4.7l1-1.5 3 1.1v2.3a1 1 0 0 1-1.1 1A11.5 11.5 0 0 1 2.2 3.3a1 1 0 0 1 1-1.1z" />
  </svg>
);
const LinkedIn = () => (
  <svg {...svgBase}>
    <rect x="1.75" y="1.75" width="12.5" height="12.5" rx="1.5" />
    <path d="M4.75 7v4.25M4.75 4.7v.1M7.5 11.25V7m0 2c0-1.2.8-2 1.9-2s1.85.8 1.85 2v2.25" />
  </svg>
);
const GitHub = () => (
  <svg {...svgBase}>
    <path d="M6 14.2v-2.1c-2.6.7-3.1-1.2-4-1.5m8 3.6v-2.4c0-.7-.2-1.2-.6-1.6 2-.2 3.6-1 3.6-3.7 0-.8-.3-1.6-.8-2.2.2-.7.2-1.5-.1-2.2 0 0-.7-.2-2.2.8a7.6 7.6 0 0 0-3.8 0c-1.5-1-2.2-.8-2.2-.8-.3.7-.3 1.5-.1 2.2a3.3 3.3 0 0 0-.8 2.2c0 2.7 1.6 3.5 3.6 3.7-.4.4-.6.9-.6 1.6" />
  </svg>
);
const ArrowOut = ({ className }: { className?: string }) => (
  <svg {...svgBase} strokeWidth={1.8} className={className}>
    <path d="M5 11l6-6M6 5h5v5" />
  </svg>
);
const Download = () => (
  <svg {...svgBase} strokeWidth={1.8}>
    <path d="M8 2.5v8m0 0L4.8 7.4M8 10.5l3.2-3.1M3 13.5h10" />
  </svg>
);

/* ── chrome ───────────────────────────────────────────────────────────────── */
function Corners() {
  return (
    <>
      <i className="c tl" aria-hidden="true" />
      <i className="c tr" aria-hidden="true" />
      <i className="c bl" aria-hidden="true" />
      <i className="c br" aria-hidden="true" />
    </>
  );
}

function Head({ title, code }: { title: string; code: string }) {
  return (
    <header className="panel-head">
      <span className="sq" aria-hidden="true" />
      <h2>{title}</h2>
      <span className="code" aria-hidden="true">
        {code}
      </span>
    </header>
  );
}

function Holo({
  title,
  code,
  delay,
  className,
  children,
}: {
  title: string;
  code: string;
  delay?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cx('holo reveal', className)} style={d(delay)} aria-label={title}>
      <Corners />
      <Head title={title} code={code} />
      {children}
    </section>
  );
}

/* ── floating portrait screen ─────────────────────────────────────────────── */
export function PilotPhoto({ lang, delay }: P) {
  return (
    <div className="photo-wrap reveal" style={d(delay)}>
      <div className="photo">
        <img src={profile.photo} alt={ui.photoAlt[lang]} width={720} height={864} decoding="async" />
        <div className="photo-tint" aria-hidden="true" />
        <div className="photo-scan" aria-hidden="true" />
        <div className="photo-sweep" aria-hidden="true" />
        <Corners />
        <div className="photo-top">
          <span>
            {ui.pilotId[lang]} · {profile.callsign}
          </span>
          <span className="ok">
            <Check />
            {ui.verified[lang]}
          </span>
        </div>
        <div className="photo-cap">
          <strong>{profile.name}</strong>
          <span>{profile.title[lang]}</span>
        </div>
      </div>
    </div>
  );
}

export function Facts({ lang, delay }: P) {
  return (
    <Holo title={ui.facts[lang]} code="ID/FACTS" delay={delay}>
      <dl className="facts">
        {profile.facts.map((f) => (
          <Fragment key={f.label.en}>
            <dt>{f.label[lang]}</dt>
            <dd>{f.value[lang]}</dd>
          </Fragment>
        ))}
      </dl>
    </Holo>
  );
}

/* ── overview: the one-glance pitch ───────────────────────────────────────── */
export function Brief({ lang, delay }: P) {
  return (
    <section className="brief reveal" style={d(delay)} aria-label={ui.overview[lang]}>
      <span className="label brief-kicker">
        {ui.overview[lang]} · {profile.title[lang]}
      </span>
      <p className="brief-head">{profile.headline[lang]}</p>
      <p className="brief-sum">{profile.summary[lang]}</p>
      <ul className="stats">
        {profile.stats.map((s) => (
          <li className="stat" key={s.label.en}>
            <b>{s.value}</b>
            <span>{s.label[lang]}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Experience({ lang, delay }: P) {
  return (
    <Holo title={ui.experience[lang]} code={`EXP/${String(profile.experience.length).padStart(2, '0')}`} delay={delay}>
      <ul className="log">
        {profile.experience.map((e) => (
          <li key={e.org + e.role}>
            <div className="row1">
              <h3>{e.role}</h3>
              <time>{e.period[lang]}</time>
            </div>
            <p>
              <b>{e.org}</b> — {e.note[lang]}
            </p>
          </li>
        ))}
      </ul>
    </Holo>
  );
}

export function Projects({ lang, delay }: P) {
  return (
    <Holo title={ui.projects[lang]} code={`PRJ/${String(profile.projects.length).padStart(2, '0')}`} delay={delay}>
      <ul className="prj">
        {profile.projects.map((p) => (
          <li key={p.name}>
            <div className="row1">
              <div className="prj-name">
                <h3>{p.name}</h3>
                <span className="tag">{p.tag}</span>
              </div>
              <span className="metric">{p.metric}</span>
            </div>
            <p>{p.note[lang]}</p>
          </li>
        ))}
      </ul>
    </Holo>
  );
}

/* ── dashboard displays ───────────────────────────────────────────────────── */
export function Stack({ lang, delay }: P) {
  return (
    <section className="mfd reveal" style={d(delay)} aria-label={ui.stack[lang]}>
      <Head title={ui.stack[lang]} code="SYS/STACK" />
      <dl className="stack">
        {profile.stack.map((g) => (
          <div key={g.label}>
            <dt>{g.label}</dt>
            <dd>
              {g.items.map((i) => (
                <span className="chip" key={i}>
                  {i}
                </span>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function Comms({ lang, delay }: P) {
  const { email, phone, linkedin, github } = profile.contact;
  const [copied, setCopied] = useState(false);
  const timer = useRef<number>(0);
  const copy = async () => {
    if (!email) return;
    try { await navigator.clipboard.writeText(email); }
    catch {
      const ta=document.createElement('textarea');ta.value=email;ta.style.position='fixed';ta.style.opacity='0';
      document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();
    }
    setCopied(true);window.clearTimeout(timer.current);
    timer.current=window.setTimeout(()=>setCopied(false),1800);
  };
  return <section className="mfd reveal" style={d(delay)} aria-label={ui.contact[lang]}>
    <Head title={ui.contact[lang]} code="COMMS" />
    <div className="comms">
      {email ? <div className="comms-email">
        <a className="comms-row" href={`mailto:${email}`}><Mail /><span className="sr-only">Email</span><span className="v">{email}</span></a>
        <button type="button" className="copy-btn" onClick={copy} aria-live="polite">{copied ? ui.copied[lang] : ui.copy[lang]}</button>
      </div> : <div className="comms-row"><Mail /><span className="v">Email · đang cập nhật</span></div>}
      {phone && <a className="comms-row" href={`tel:${phone.replace(/\\s+/g,'')}`}><Phone /><span className="v">{phone}</span></a>}
      {linkedin.url ? <a className="comms-row" href={linkedin.url} target="_blank" rel="noreferrer"><LinkedIn /><span className="v">{linkedin.label}</span><ArrowOut className="go" /></a> :
      <div className="comms-row"><LinkedIn /><span className="v">{linkedin.label}</span></div>}
      <a className="comms-row" href={github.url} target="_blank" rel="noreferrer"><GitHub /><span className="v">{github.label}</span><ArrowOut className="go" /></a>
    </div>
    <p className="comms-foot"><span className="dot" aria-hidden="true" />{ui.responds[lang]}</p>
  </section>;
}

/* ── calls to action ──────────────────────────────────────────────────────── */
export function Cta({ lang, onEngage, jumping,entryReady,entryProgress }: { lang: Lang; onEngage: () => void; jumping: boolean; entryReady:boolean; entryProgress:number }) {
  const { cv } = profile.links;
  return (
    <div className="cta">
      <div className="energy-gate" data-ready={entryReady} data-warp={jumping} style={{['--charge' as string]:`${entryProgress}%`}}>
        <span className="energy-ring" aria-hidden="true" />
        <span className="energy-particles" aria-hidden="true" />
        <button type="button" className="btn btn-primary" onClick={onEngage} disabled={!entryReady||jumping} aria-busy={!entryReady}>
          {jumping ? ui.jumping[lang] : entryReady ? ui.enter[lang] : (lang === 'vi' ? 'ĐANG CHUẨN BỊ CẢNH 3D' : 'PREPARING 3D WORLD')}
          <Chevrons className="chev" />
        </button>
      </div>
      {cv ? (
        <a className="btn btn-ghost" href={cv} download>
          <Download />
          {ui.cv[lang]}
        </a>
      ) : (
        <a className="btn btn-ghost" href={profile.contact.github.url} target="_blank" rel="noreferrer">
          <Mail />
          {ui.reach[lang]}
        </a>
      )}
    </div>
  );
}

/* ── centre console: nameplate + flight controls ──────────────────────────── */
export function Console({
  lang,
  delay,
  onEngage,
  jumping,
  entryReady,
  entryProgress,
}: P & { onEngage: () => void; jumping: boolean; entryReady:boolean; entryProgress:number }) {
  const range = useRef<HTMLInputElement>(null);
  const out = useRef<HTMLOutputElement>(null);
  const boost = useRef<HTMLButtonElement>(null);
  const shown = useRef(-1);

  useFrame((f) => {
    const v = Math.round(f.throttle * 100);
    if (range.current && v !== shown.current) {
      shown.current = v;
      range.current.value = String(v);
      range.current.style.setProperty('--v', `${v}%`);
    }
    if (out.current) {
      const txt = `${(f.speed * 0.31).toFixed(2)}c`;
      if (out.current.textContent !== txt) out.current.textContent = txt;
    }
    if (boost.current) {
      const on = String(f.boost || f.warp);
      if (boost.current.dataset.on !== on) boost.current.dataset.on = on;
    }
  });

  const setBoost = (on: boolean) => () => {
    flight.boost = on;
  };

  return (
    <section className="mfd console reveal" style={d(delay)} aria-label={`${ui.pilot[lang]} ${profile.name}`}>
      <div className="console-top">
        <span className="label">
          {ui.pilot[lang]} · {profile.callsign}
        </span>
        <span className="avail">
          <span className="dot" aria-hidden="true" />
          {profile.availability[lang]}
        </span>
      </div>
      <h1 className="name">{profile.name}</h1>
      <p className="role">
        {profile.title[lang]}
        {profile.focus.map((x) => (
          <Fragment key={x}>
            <i aria-hidden="true">/</i>
            {x}
          </Fragment>
        ))}
      </p>
      <Cta lang={lang} onEngage={onEngage} jumping={jumping} entryReady={entryReady} entryProgress={entryProgress} />
      <div className="thr">
        <label htmlFor="throttle" className="label">
          {ui.throttle[lang]}
        </label>
        <input
          ref={range}
          id="throttle"
          className="throttle"
          type="range"
          min={0}
          max={100}
          step={1}
          defaultValue={50}
          aria-label={ui.throttleLong[lang]}
          onChange={(e) => {
            flight.throttle = Number(e.currentTarget.value) / 100;
          }}
        />
        <output ref={out} aria-label={ui.velocity[lang]}>
          0.00c
        </output>
        <button
          ref={boost}
          type="button"
          className="boost-btn"
          data-on="false"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            flight.boost = true;
          }}
          onPointerUp={setBoost(false)}
          onPointerCancel={setBoost(false)}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') flight.boost = true;
          }}
          onKeyUp={setBoost(false)}
          onBlur={setBoost(false)}
        >
          {ui.boost[lang]}
        </button>
      </div>
      <p className="hints">{ui.hints[lang]}</p>
    </section>
  );
}

export function LangToggle({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  return (
    <div className="lang" role="group" aria-label={ui.language[lang]}>
      {(['vi', 'en'] as Lang[]).map((l) => (
        <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)} lang={l}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
