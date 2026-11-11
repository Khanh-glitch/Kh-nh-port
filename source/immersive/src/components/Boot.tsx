import { useCallback, useEffect, useRef, useState } from 'react';
import { profile, ui, type Lang } from '../data/profile';

/** Short power-on sequence. Skippable; skipped entirely for reduced-motion users. */
export function Boot({ lang, onDone }: { lang: Lang; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);
  const done = useRef(false);

  const finish = useCallback(() => {
    if (done.current) return;
    done.current = true;
    setLeaving(true);
    onDone();
    window.setTimeout(() => setGone(true), 800);
  }, [onDone]);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finish();
      return;
    }
    const ids = [300, 620, 940].map((ms, i) => window.setTimeout(() => setStep(i + 1), ms));
    ids.push(window.setTimeout(finish, 1650));
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') finish();
    };
    window.addEventListener('keydown', key);
    return () => {
      ids.forEach((id) => window.clearTimeout(id));
      window.removeEventListener('keydown', key);
    };
  }, [finish]);

  if (gone) return null;

  const lines = [ui.bootEngines[lang], ui.bootNav[lang], ui.bootPilot[lang]];

  return (
    <div className="boot" data-leaving={leaving}>
      <div className="boot-box">
        <span className="label">
          {profile.callsign} · {ui.bootTitle[lang]}
        </span>
        <p className="boot-name">{profile.name}</p>
        <ul className="boot-lines">
          {lines.slice(0, step).map((l) => (
            <li key={l}>
              <span>{l}</span>
              <b>OK</b>
            </li>
          ))}
        </ul>
        <div className="boot-bar" aria-hidden="true">
          <i />
        </div>
        <button type="button" className="boot-skip" onClick={finish}>
          {ui.skip[lang]}
        </button>
      </div>
    </div>
  );
}
