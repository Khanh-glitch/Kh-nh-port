import { useCallback, useEffect, useRef, useState } from 'react';
import SpaceScene from './components/SpaceScene';
import { Boot } from './components/Boot';
import { CockpitFrame, Compass, Plx, Radar, Reticle, SpeedGauge, TargetMarker, TopHud } from './components/Cockpit';
import { Brief, Comms, Console, Cta, Experience, Facts, LangToggle, PilotPhoto, Projects, Stack } from './components/Panels';
import { profile, ui, type Lang } from './data/profile';
import { flight } from './lib/flight';
import { useViewport } from './lib/useViewport';

type Jump = 'idle' | 'charging' | 'flash' | 'notice';

export default function App() {
  const vp = useViewport();
  const [lang, setLang] = useState<Lang>('vi');
  const [live, setLive] = useState(false);
  const [jump, setJump] = useState<Jump>('idle');
  const [gate, setGate] = useState({ready:false,progress:0});
  const timers = useRef<number[]>([]);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = lang === 'vi' ? `${profile.name} — Buồng lái Portfolio` : `${profile.name} — Portfolio Cockpit`;
  }, [lang]);

  // drop out of "hyperspace" as the cockpit powers on
  const onBooted = useCallback(() => {
    flight.speed = flight.reduced ? 0.4 : 6;
    setLive(true);
  }, []);

  useEffect(() => {
    const onMessage=(event: MessageEvent)=>{
      if(event.source!==window.parent || event.origin!==window.location.origin)return;
      if(event.data?.type==='ORBITA_SPACE_READY')setGate({ready:event.data.ready===true,progress:Math.max(0,Math.min(100,Number(event.data.progress)||0))});
    };
    window.addEventListener('message',onMessage);
    return ()=>window.removeEventListener('message',onMessage);
  },[]);

  const clearTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  };

  /** Primary action: spool up, jump, then open the detailed portfolio. */
  const engage = useCallback(() => {
    if (jump === 'charging' || jump === 'flash' || !gate.ready) return;
    clearTimers();
    setJump('charging');
    flight.warp = true;
    window.parent.postMessage({type:'ORBITA_SPACE_ENGAGE'},window.location.origin);
    const lead = flight.reduced ? 250 : 1900;
    timers.current.push(
      window.setTimeout(() => {
        setJump('flash');
        timers.current.push(
          window.setTimeout(() => {
            flight.warp = false;
            if(window.parent!==window){
              window.parent.postMessage({type:'ORBITA_SPACE_WARP_COMPLETE'},window.location.origin);
            } else {
              setJump('notice');
            }
          }, 520),
        );
      }, lead),
    );
  }, [jump,gate.ready]);

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
  }, []);

  const jumping = jump === 'charging' || jump === 'flash';

  return (
    <div className="app" data-live={live} data-jump={jump}>
      <SpaceScene />
      <div className="vignette" aria-hidden="true" />

      {vp.mode === 'cockpit' ? (
        <>
          <Reticle />
          <TargetMarker lang={lang} />
          <CockpitFrame W={vp.W} H={vp.H} />
          <main className="stage" style={{ ['--extra' as string]: `${Math.max(0, vp.H - 810) / 16}rem` }}>
            <TopHud lang={lang} setLang={setLang} />
            <Compass />

            {/* nameplate + primary action come first in reading / tab order */}
            <div className="dash-centre">
              <Console lang={lang} delay={60} onEngage={engage} jumping={jumping} entryReady={gate.ready} entryProgress={gate.progress} />
            </div>

            <Plx depth={0.6} className="col col-left">
              <PilotPhoto lang={lang} delay={150} />
              <Facts lang={lang} delay={330} />
            </Plx>

            <Plx depth={0.32} className="centre">
              <Brief lang={lang} delay={520} />
            </Plx>

            <Plx depth={0.6} className="col col-right">
              <Experience lang={lang} delay={240} />
              <Projects lang={lang} delay={420} />
            </Plx>

            <div className="dash-left">
              <Stack lang={lang} delay={600} />
            </div>
            <div className="dash-right">
              <Comms lang={lang} delay={680} />
            </div>
            <SpeedGauge lang={lang} delay={760} />
            <Radar lang={lang} delay={760} />
          </main>
        </>
      ) : (
        <div className="compact">
          <header className="c-top">
            <div className="tophud-group">
              <span className="badge">{profile.callsign}</span>
              <span className="avail">
                <span className="dot" aria-hidden="true" />
                {profile.availability[lang]}
              </span>
            </div>
            <LangToggle lang={lang} setLang={setLang} />
          </header>
          <main className="c-main">
            <div className="span-2">
              <PilotPhoto lang={lang} delay={100} />
            </div>
            <div className="span-2">
              <Brief lang={lang} delay={200} />
            </div>
            <Facts lang={lang} delay={280} />
            <div className="o-exp">
              <Experience lang={lang} delay={340} />
            </div>
            <div className="o-prj">
              <Projects lang={lang} delay={400} />
            </div>
            <div className="o-stack">
              <Stack lang={lang} delay={460} />
            </div>
            <div className="span-2 o-comms">
              <Comms lang={lang} delay={520} />
            </div>
          </main>
          <footer className="c-console">
            <div className="c-console-inner">
              <h1 className="name">{profile.name}</h1>
              <Cta lang={lang} onEngage={engage} jumping={jumping} entryReady={gate.ready} entryProgress={gate.progress} />
            </div>
          </footer>
        </div>
      )}

      {jump === 'notice' && (
        <div className="holo notice" role="alert">
          <h2>{ui.noticeTitle[lang]}</h2>
          <p>{ui.noticeBody[lang]}</p>
          <button type="button" onClick={() => setJump('idle')}>
            {ui.dismiss[lang]}
          </button>
        </div>
      )}
      <div className="flash" aria-hidden="true" />
      <Boot lang={lang} onDone={onBooted} />
    </div>
  );
}
