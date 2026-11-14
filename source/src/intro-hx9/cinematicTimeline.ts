/** Deterministic staging for the real HX-9 assemblies. Units are seconds/metres. */
export type AssemblyName = 'structure' | 'shell' | 'glass' | 'seat' | 'dashboard' | 'controls'
export type Cue = { name: AssemblyName; start: number; duration: number; offset: [number, number, number]; rotation: [number, number, number] }

// Whole, mechanically meaningful subassemblies, never hundreds of flying parts.
// Small negative overshoot is a controlled seating movement, not random shake.
export const ASSEMBLY_CUES: readonly Cue[] = [
  { name: 'seat', start: 2.5, duration: 3.8, offset: [0, 0, 0], rotation: [0, 0, 0] },
  { name: 'dashboard', start: 6.5, duration: 3.8, offset: [0, 0, 0], rotation: [0, 0, 0] },
  { name: 'controls', start: 10.5, duration: 3.6, offset: [0, 0, 0], rotation: [0, 0, 0] },
  { name: 'structure', start: 14.3, duration: 4.0, offset: [0, 0, 0], rotation: [0, 0, 0] },
  { name: 'shell', start: 18.5, duration: 3.7, offset: [0, 0, 0], rotation: [0, 0, 0] },
  { name: 'glass', start: 22.4, duration: 3.4, offset: [0, 0, 0], rotation: [0, 0, 0] },
]
export const CAMERA_DOCK_START = 26.8
export const CAMERA_DOCK_END = 33.8
export const POWER_START = 30.8
export const CINEMATIC_END = 36.8
const clamp = (v: number) => Math.max(0, Math.min(1, v))
/** Monotonic fifth-order ease has zero velocity and acceleration at both ends. */
export const smootherstep = (v: number) => { const t = clamp(v); return t*t*t*(t*(t*6-15)+10) }
export function assemblyPose(cue: Cue, elapsed: number) {
  const phase = clamp((elapsed - cue.start) / cue.duration)
  // A brief, low-amplitude seating stroke starts only after the main approach.
  if (phase >= 1 - 1e-9) return { visible: true, remaining: 0, locked: true }
  const approach = 1 - smootherstep(phase / .88)
  const seat = phase > .88 && phase < 1 ? Math.sin((phase - .88) / .12 * Math.PI) * .008 : 0
  return { visible: elapsed >= cue.start, remaining: approach + seat, locked: phase >= 1 }
}
export function cameraDock(elapsed: number) { return smootherstep((elapsed-CAMERA_DOCK_START)/(CAMERA_DOCK_END-CAMERA_DOCK_START)) }
export function screenPower(elapsed: number, index: number) { return smootherstep((elapsed - POWER_START - index*.65)/1.1) }
