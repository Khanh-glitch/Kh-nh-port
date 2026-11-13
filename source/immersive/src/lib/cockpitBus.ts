/**
 * Tiny shared state bus for the 3D cockpit.
 *
 * The cockpit screens live inside the three.js scene, but a few of their
 * values (language, entry-gate readiness) are owned by React. Rather than
 * re-rendering React on every change — or lifting the whole cockpit into
 * React — we publish plain values here and let the texture painter read them.
 *
 * Nothing in here runs per frame. Subscribers are only notified when a value
 * actually changes, and the painter decides whether a repaint is needed.
 */

export type CockpitLang = 'vi' | 'en';

export interface CockpitSnapshot {
  /** UI language for every painted screen. */
  lang: CockpitLang;
  /** True once island + ship are both really ready (real gate, not a timer). */
  ready: boolean;
  /** 0..100, only ever 0 or 100 today; kept numeric for the ring. */
  progress: number;
  /** Screen id the pointer is currently over, or null. */
  hover: number | null;
  /** Screen id that was last activated (for the press flash). */
  active: number | null;
}

type Listener = (next: CockpitSnapshot, prev: CockpitSnapshot) => void;

const state: CockpitSnapshot = {
  lang: 'vi',
  ready: false,
  progress: 0,
  hover: null,
  active: null,
};

const listeners = new Set<Listener>();

export function cockpitState(): Readonly<CockpitSnapshot> {
  return state;
}

export function setCockpit(patch: Partial<CockpitSnapshot>): void {
  let changed = false;
  for (const key of Object.keys(patch) as (keyof CockpitSnapshot)[]) {
    const value = patch[key];
    if (value !== undefined && state[key] !== value) {
      (state as unknown as Record<string, unknown>)[key] = value;
      changed = true;
    }
  }
  if (!changed) return;
  for (const listener of listeners) listener(state, state);
}

export function onCockpit(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
