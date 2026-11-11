import { useLayoutEffect, useState } from 'react';
import { flight } from './flight';

/** Design canvas for the cockpit: everything is authored in rem at 1440 × 810. */
const DESIGN_W = 1440;
const DESIGN_H = 810;

export interface Viewport {
  mode: 'cockpit' | 'compact';
  /** stage size in design units (≥ 1440 × 810 in cockpit mode) */
  W: number;
  H: number;
  scale: number;
}

function measure(): Viewport {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cockpit = vw >= 1180 && vh >= 620 && vw / vh >= 1.2;
  if (!cockpit) return { mode: 'compact', W: vw, H: vh, scale: 1 };
  const scale = Math.min(vw / DESIGN_W, vh / DESIGN_H);
  return { mode: 'cockpit', scale, W: vw / scale, H: vh / scale };
}

/**
 * Cockpit mode scales the root font-size so the whole rem-based layout grows and
 * shrinks with the window while text stays natively rendered (no blurry transforms).
 * Small / portrait / heavily zoomed viewports fall back to a scrolling compact layout.
 */
export function useViewport(): Viewport {
  const [vp, setVp] = useState<Viewport>(measure);

  useLayoutEffect(() => {
    const apply = () => {
      const next = measure();
      const root = document.documentElement;
      root.dataset.mode = next.mode;
      root.style.fontSize = next.mode === 'cockpit' ? `${(16 * next.scale).toFixed(3)}px` : '';
      flight.rem = next.mode === 'cockpit' ? 16 * next.scale : 16;
      setVp((prev) =>
        prev.mode === next.mode && Math.abs(prev.W - next.W) < 0.5 && Math.abs(prev.H - next.H) < 0.5
          ? prev
          : next,
      );
    };
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, []);

  return vp;
}
