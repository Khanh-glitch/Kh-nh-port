import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SpaceScene from './components/SpaceScene';
import { Compass, Reticle, TopHud } from './components/Cockpit';
import { Cta, LangToggle } from './components/Panels';
import { profile } from './data/profile';
import { flight } from './lib/flight';
import { setCockpit } from './lib/cockpitBus';
import { useViewport } from './lib/useViewport';

type Jump = 'idle' | 'charging' | 'flash' | 'notice';

export default function App() {
  const vp = useViewport();
  const [lang, setLang] = useState<'vi' | 'en'>('vi');
  const [jump, setJump] = useState<Jump>('idle');
  const [gate, setGate] = useState<{ ready: boolean; progress: number }>({ ready: false, progress: 0 });
  const [spacePainted, setSpacePainted] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = lang === 'vi'
      ? `${profile.name} — Buồng lái Portfolio`
      : `${profile.name} — Portfolio Cockpit`;
    // Every painted screen in the 3D cockpit re-renders from this one call.
    setCockpit({ lang });
  }, [lang]);

  // Fade the original full-quality HUD ON TOP of the real first space frame,
  // not a timer or a fake boot screen. This leaves the finished HUD identical.
  useEffect(() => {
    const ready = () => setSpacePainted(true);
    if ((window as Window & { __orbitaSpacePainted?: boolean }).__orbitaSpacePainted) ready();
    window.addEventListener('ORBITA_SPACE_LOCAL_PAINTED', ready);
    return () => window.removeEventListener('ORBITA_SPACE_LOCAL_PAINTED', ready);
  }, []);

  // The cockpit is the FIRST visible screen. Do not stack a second text-heavy
  // boot/loading overlay above the spaceship or energy ring.
  useEffect(() => {
    flight.speed = flight.reduced ? 0.4 : 6;
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent || event.origin !== window.location.origin) return;
      if (event.data?.type === 'ORBITA_SPACE_READY') {
        const next = {
          ready: event.data.ready === true,
          progress: Math.max(0, Math.min(100, Number(event.data.progress) || 0)),
        };
        setGate(next);
        setCockpit({ ready: next.ready, progress: next.progress });
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const clearTimers = useCallback(() => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  }, []);

  /** Primary action: spool up, jump, then open the detailed portfolio. */
  const engage = useCallback(() => {
    if (jump === 'charging' || jump === 'flash' || !gate.ready) return;
    clearTimers();
    setJump('charging');
    flight.warp = true;
    window.parent.postMessage({ type: 'ORBITA_SPACE_ENGAGE' }, window.location.origin);
    const lead = flight.reduced ? 250 : 1900;
    timers.current.push(window.setTimeout(() => {
      setJump('flash');
      timers.current.push(window.setTimeout(() => {
        flight.warp = false;
        if (window.parent !== window) {
          window.parent.postMessage({ type: 'ORBITA_SPACE_WARP_COMPLETE' }, window.location.origin);
        } else {
          setJump('notice');
        }
      }, 520));
    }, lead));
  }, [jump, gate.ready, clearTimers]);

  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        flight.warp = false;
        setJump('idle');
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setJump((j) => (j === 'notice' ? 'idle' : j));
    };
    window.addEventListener('pageshow', onShow);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pageshow', onShow);
      window.removeEventListener('keydown', onKey);
      clearTimers();
      flight.warp = false;
    };
  }, [clearTimers]);

  const jumping = jump === 'charging' || jump === 'flash';
  const inCockpit = vp.mode === 'cockpit';

  const cta = useMemo(() => (
    <Cta
      lang={lang}
      onEngage={engage}
      jumping={jumping}
      entryReady={gate.ready}
      entryProgress={gate.progress}
    />
  ), [lang, engage, jumping, gate.ready, gate.progress]);

  return (
    <div className="app" data-live="true" data-jump={jump} data-space-painted={spacePainted}>
      <SpaceScene />
      <div className="vignette" aria-hidden="true" />

      {/* Only true instruments remain in the DOM: reticle, compass, top strip
          and the centre console. Every piece of portfolio content is now
          painted onto the physical screens inside the 3D cockpit. */}
      <Reticle />
      <TopHud lang={lang} setLang={setLang} />
      {inCockpit && <Compass />}

      <div className="dash-centre">
        <div className="console-plate">
          <p className="console-kicker">{profile.callsign} · {profile.availability[lang]}</p>
          <h1 className="console-name">{profile.name}</h1>
          <p className="console-role">{profile.title[lang]}</p>
          {cta}
          <p className="console-hint">
            {lang === 'vi'
              ? 'Rê chuột lên các bàn hình trong buồng lái để đọc hồ sơ.'
              : 'Hover the screens inside the cockpit to read the profile.'}
          </p>
        </div>
      </div>

      <div className="compact-dock">
        <LangToggle lang={lang} setLang={setLang} />
      </div>

      {jump === 'notice' && (
        <div className="holo notice" role="alert">
          <h2>{lang === 'vi' ? 'Chưa thiết lập đích đến' : 'Destination not set'}</h2>
          <p>
            {lang === 'vi'
              ? 'Thêm đường dẫn portfolio vào links.portfolio trong src/data/profile.ts để hoàn tất bước nhảy.'
              : 'Add your portfolio URL to links.portfolio in src/data/profile.ts to complete the jump.'}
          </p>
          <button type="button" onClick={() => setJump('idle')}>
            {lang === 'vi' ? 'Đóng' : 'Dismiss'}
          </button>
        </div>
      )}
      <div className="flash" aria-hidden="true" />
    </div>
  );
}
