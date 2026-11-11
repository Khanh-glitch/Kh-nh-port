import { useEffect, useRef } from 'react';

/** Vertical position (0..1) of the flight vector / vanishing point on screen. */
export const VIEW_CENTER_Y = 0.385;

export interface Flight {
  /** raw pointer, -1..1 */
  pointerX: number;
  pointerY: number;
  /** smoothed look / steer, -1..1 */
  lookX: number;
  lookY: number;
  lookVX: number;
  lookVY: number;
  /** derived attitude (radians) */
  yaw: number;
  pitch: number;
  bank: number;
  /** 0..1 lever */
  throttle: number;
  boost: boolean;
  warp: boolean;
  /** smoothed speed factor (≈0.3 cruise … 10 warp) */
  speed: number;
  travel: number;
  time: number;
  /** destination marker in CSS px */
  targetX: number;
  targetY: number;
  targetR: number;
  targetVisible: boolean;
  /** px per rem for the current layout scale */
  rem: number;
  reduced: boolean;
}

export const flight: Flight = {
  pointerX: 0,
  pointerY: 0,
  lookX: 0,
  lookY: 0,
  lookVX: 0,
  lookVY: 0,
  yaw: 0,
  pitch: 0,
  bank: 0,
  throttle: 0.5,
  boost: false,
  warp: false,
  speed: 0,
  travel: 0,
  time: 0,
  targetX: -999,
  targetY: -999,
  targetR: 0,
  targetVisible: false,
  rem: 16,
  reduced: false,
};

type Listener = (f: Flight, dt: number) => void;
const listeners = new Set<Listener>();
let running = false;
let last = 0;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

function step(dt: number) {
  const f = flight;
  f.time += dt;

  // steering — eased toward the pointer
  const k = 1 - Math.exp(-dt * 4.2);
  const px = f.reduced ? 0 : f.pointerX;
  const py = f.reduced ? 0 : f.pointerY;
  const lx = f.lookX + (px - f.lookX) * k;
  const ly = f.lookY + (py - f.lookY) * k;
  const kv = 1 - Math.exp(-dt * 10);
  f.lookVX += ((lx - f.lookX) / dt - f.lookVX) * kv;
  f.lookVY += ((ly - f.lookY) / dt - f.lookVY) * kv;
  f.lookX = lx;
  f.lookY = ly;

  const drift = f.reduced ? 0 : 1;
  f.yaw = f.lookX * 0.16 + Math.sin(f.time * 0.05) * 0.035 * drift;
  f.pitch = f.lookY * 0.07 + Math.sin(f.time * 0.037 + 1.3) * 0.016 * drift;
  f.bank = f.lookX * 0.06 + clamp(f.lookVX, -3, 3) * 0.012;

  // propulsion
  let target = f.warp ? 10 : (0.3 + f.throttle * 1.3) * (f.boost ? 2.5 : 1);
  if (f.reduced) target = f.warp ? 1.2 : Math.min(target, 0.45);
  const rate = f.warp ? 1.5 : target < f.speed ? 1.4 : 2.6;
  f.speed += (target - f.speed) * (1 - Math.exp(-dt * rate));
  f.travel += f.speed * 55 * dt;
}

function loop(now: number) {
  requestAnimationFrame(loop);
  const dt = clamp((now - last) / 1000, 0.001, 0.05);
  last = now;
  step(dt);
  listeners.forEach((l) => l(flight, dt));
}

const isControl = (t: EventTarget | null) =>
  t instanceof HTMLElement && !!t.closest('input, textarea, select, button, a, [contenteditable]');

function bindInputs() {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  flight.reduced = mq.matches;
  mq.addEventListener?.('change', (e) => (flight.reduced = e.matches));

  window.addEventListener(
    'pointermove',
    (e) => {
      flight.pointerX = clamp((e.clientX / window.innerWidth) * 2 - 1, -1, 1);
      flight.pointerY = clamp((e.clientY / window.innerHeight) * 2 - 1, -1, 1);
    },
    { passive: true },
  );

  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const onControl = isControl(e.target);
    switch (e.code) {
      case 'KeyW':
        flight.throttle = clamp(flight.throttle + 0.06, 0, 1);
        break;
      case 'KeyS':
        flight.throttle = clamp(flight.throttle - 0.06, 0, 1);
        break;
      case 'ArrowUp':
        if (!onControl) {
          flight.throttle = clamp(flight.throttle + 0.06, 0, 1);
          e.preventDefault();
        }
        break;
      case 'ArrowDown':
        if (!onControl) {
          flight.throttle = clamp(flight.throttle - 0.06, 0, 1);
          e.preventDefault();
        }
        break;
      case 'Space':
        if (!onControl) {
          flight.boost = true;
          e.preventDefault();
        }
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        flight.boost = true;
        break;
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') flight.boost = false;
  });
  window.addEventListener('blur', () => (flight.boost = false));
}

/** Subscribe to the shared animation loop. Returns an unsubscribe function. */
export function onFrame(fn: Listener) {
  listeners.add(fn);
  if (!running && typeof window !== 'undefined') {
    running = true;
    last = performance.now();
    bindInputs();
    requestAnimationFrame(loop);
  }
  return () => {
    listeners.delete(fn);
  };
}

/** React hook: run a callback on every frame without re-rendering. */
export function useFrame(fn: Listener) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => onFrame((f, dt) => ref.current(f, dt)), []);
}

export { clamp };
