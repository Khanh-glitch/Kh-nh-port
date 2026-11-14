/** Deterministic staging for the real HX-9 assemblies. Units are seconds/metres. */
export type AssemblyName = 'structure' | 'shell' | 'glass' | 'seat' | 'dashboard' | 'controls'
export type Cue = { name: AssemblyName; start: number; duration: number; offset: [number, number, number]; rotation: [number, number, number] }

// Whole, mechanically meaningful subassemblies, never hundreds of flying parts.
// Small negative overshoot is a controlled seating movement, not random shake.
export const ASSEMBLY_CUES: readonly Cue[] = [
  { name: 'seat', start: 1.2, duration: 2.4, offset: [0, 0, 0], rotation: [0, 0, 0] },
  { name: 'dashboard', start: 3.6, duration: 2.4, offset: [0, 0, 0], rotation: [0, 0, 0] },
  { name: 'controls', start: 6, duration: 2.2, offset: [0, 0, 0], rotation: [0, 0, 0] },
  { name: 'structure', start: 8.2, duration: 2.5, offset: [0, 0, 0], rotation: [0, 0, 0] },
  { name: 'shell', start: 10.7, duration: 2.3, offset: [0, 0, 0], rotation: [0, 0, 0] },
  { name: 'glass', start: 13, duration: 2.1, offset: [0, 0, 0], rotation: [0, 0, 0] },
]
export const CAMERA_DOCK_START = 15.1
export const CAMERA_DOCK_END = 21
export const POWER_START = 18.5
export const CINEMATIC_END = 23
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
