import { create } from 'zustand'
import type { PanelId } from './content'

export type QualityTier = 'high' | 'low' | 'performance'

/**
 * Ordered visual concessions used ONLY by the `performance` tier.
 *
 * Nothing here touches the `high` or `low` render path. Each rung removes one
 * specific, measurable cost but keeps the scene readable:
 *
 *   0  nothing removed (entry rung; identical to today's low)
 *   1  drop the two full-screen post passes that cost the most per pixel and
 *      add no scene information (film Noise, Vignette). Bloom, ACES tonemapping
 *      and every light/material stay exactly as they are.
 *   2  render at 0.85x of CSS pixels. Every mesh, texture, shader, light and
 *      shadow map is unchanged; only the raster size shrinks. 15% linear.
 *   3  1024px shadow maps instead of 2048. Contact shadows stay, edges soften.
 *   4  zero extra frames of the CPU-side effect textures (see perfLadder):
 *      the offline canvas repaints that run when an exhibit is triggered are
 *      amortised across frames instead of blocking the trigger.
 *   5  render at 0.72x. Still far above the 0.5x seen during the intro.
 *
 * The ladder only applies rungs that actually help: it steps back down when a
 * rung does not raise FPS, and it never climbs on a machine that has already
 * failed to benefit.
 */
export const QUALITY_LADDER_NOTE = 'see perfLadder.ts'

export interface HoverInfo {
  label: string
  hint?: string
  hasPanel: boolean
}

interface State {
  phase: 'intro' | 'playing'
  loading: number
  ready: boolean
  locked: boolean
  freeMouse: boolean
  paused: boolean
  panel: PanelId | null
  hover: HoverInfo | null
  muted: boolean
  touch: boolean
  toast: string | null
  // Three user-visible tiers, cycled with Q:
  //   high        - untouched full fidelity (unchanged behaviour)
  //   low         - default; same scene and DPR, deeper under-the-hood work
  //   performance - budget auto-ladder (see perfLadder.ts)
  quality: QualityTier
  setLoading: (v: number) => void
  setReady: () => void
  setPhase: (p: 'intro' | 'playing') => void
  setLocked: (v: boolean) => void
  setFree: (v: boolean) => void
  setPaused: (v: boolean) => void
  openPanel: (p: PanelId | null) => void
  setHover: (h: HoverInfo | null) => void
  setMuted: (m: boolean) => void
  setToast: (t: string | null) => void
  setQuality: (q: QualityTier) => void
}

export const useStore = create<State>((set) => ({
  phase: 'intro',
  loading: 0,
  ready: false,
  locked: false,
  freeMouse: false,
  paused: false,
  panel: null,
  hover: null,
  muted: false,
  touch: typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches,
  toast: null,
  // Explicit CI-only high-fidelity HEX route; normal visitor defaults
  // remain unchanged and can still select high through the portfolio UI.
  // Explicit CI-only high-fidelity HEX route; normal visitor defaults remain
  // unchanged (low) and the three tiers are still cycled with Q.
  quality: typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('hexForceHigh') === '1'
    ? 'high'
    : typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('perfTier') === '1'
      ? 'performance'
      : 'low',
  setLoading: (loading) => set({ loading }),
  setReady: () => set({ ready: true, loading: 1 }),
  setPhase: (phase) => set({ phase }),
  setLocked: (locked) => set({ locked }),
  setFree: (freeMouse) => set({ freeMouse }),
  setPaused: (paused) => set({ paused }),
  openPanel: (panel) => set({ panel }),
  setHover: (hover) => set({ hover }),
  setMuted: (muted) => set({ muted }),
  setToast: (toast) => set({ toast }),
  setQuality: (quality) => set({ quality }),
}))

// Test / measurement hook. The performance report needs to switch tiers the
// same way the Q key does, from the console, on any machine.
if (typeof window !== 'undefined') {
  ;(window as unknown as { __orbitaStore?: typeof useStore }).__orbitaStore = useStore
}

let toastTimer: number | undefined
export function toast(msg: string, ms = 2600) {
  useStore.getState().setToast(msg)
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => useStore.getState().setToast(null), ms)
}
