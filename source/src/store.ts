import { create } from 'zustand'
import type { PanelId } from './content'

export interface HoverInfo {
  label: string
  hint?: string
  hasPanel: boolean
}

interface State {
  phase: 'intro' | 'playing'
  loading: number
  ready: boolean
  // Audio ready and GPU scene-ready are independent. The spaceship arrival
  // never treats decoded piano samples as proof that rendering is ready.
  arrivalProgress: number
  arrivalStage: string
  arrivalReady: boolean
  arrivalApproach: number
  arrivalApproachSettled: boolean
  locked: boolean
  freeMouse: boolean
  paused: boolean
  panel: PanelId | null
  hover: HoverInfo | null
  muted: boolean
  touch: boolean
  toast: string | null
  quality: 'high' | 'low'
  setLoading: (v: number) => void
  setReady: () => void
  setArrivalReadiness: (progress: number, stage: string, ready: boolean) => void
  setArrivalApproach: (progress: number, settled: boolean) => void
  setPhase: (p: 'intro' | 'playing') => void
  setLocked: (v: boolean) => void
  setFree: (v: boolean) => void
  setPaused: (v: boolean) => void
  openPanel: (p: PanelId | null) => void
  setHover: (h: HoverInfo | null) => void
  setMuted: (m: boolean) => void
  setToast: (t: string | null) => void
  setQuality: (q: 'high' | 'low') => void
}

export const useStore = create<State>((set) => ({
  phase: 'intro',
  loading: 0,
  ready: false,
  arrivalProgress: 0,
  arrivalStage: 'ĐANG KHỞI TẠO',
  arrivalReady: false,
  arrivalApproach: 0,
  arrivalApproachSettled: false,
  locked: false,
  freeMouse: false,
  paused: false,
  panel: null,
  hover: null,
  muted: false,
  touch: typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches,
  toast: null,
  quality: 'low',
  setLoading: (loading) => set({ loading }),
  setReady: () => set({ ready: true, loading: 1 }),
  setArrivalReadiness: (progress, stage, ready) => set((state) => {
    const p = Math.max(0, Math.min(ready ? 1 : 0.99, progress))
    if (state.arrivalProgress === p && state.arrivalStage === stage && state.arrivalReady === ready) return state
    return { arrivalProgress: Math.max(state.arrivalProgress,p), arrivalStage: stage, arrivalReady: ready }
  }),
  setArrivalApproach: (progress, settled) => set((state) => {
    const p = Math.max(state.arrivalApproach, Math.min(1, Math.max(0,progress)))
    if (p === state.arrivalApproach && settled === state.arrivalApproachSettled) return state
    return {arrivalApproach:p,arrivalApproachSettled:settled}
  }),
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

let toastTimer: number | undefined
export function toast(msg: string, ms = 2600) {
  useStore.getState().setToast(msg)
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => useStore.getState().setToast(null), ms)
}
