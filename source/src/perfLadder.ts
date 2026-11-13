/**
 * ORBITA performance tier — measured, ordered visual concessions.
 *
 * `high` and `low` are untouched. This module only drives the third tier,
 * `performance`, whose whole contract is: give up the least visible thing first,
 * and only keep a concession that measurably helped on THIS machine.
 *
 * How the decision is made (no guessing, no fixed assumption about the device):
 *
 *  1. The first ~1.2 s after entering the world is the baseline: the machine
 *     runs rung 0 (identical to `low`) and we record an SMOOTHED frame rate plus
 *     the input-to-frame latency seen by the scheduler.
 *  2. If the baseline already holds the target FPS, nothing is downgraded at all.
 *  3. Otherwise we adopt the next rung and let it settle (rung switches cost one
 *     texture/shadow reallocation, so the settling frames are discarded).
 *  4. After settling we compare the new window against the previous one. If it
 *     did not improve by a meaningful margin, the rung is marked `futile` and
 *     never proposed again: we stop spending visual quality for nothing.
 *  5. If FPS recovers comfortably above the target we step back DOWN one rung,
 *     so a machine that only needed one concession does not keep paying for more.
 *
 * Everything is exposed on `window.__orbitaPerf` so a real measurement can be
 * taken from any machine without console access to the internals.
 */

export type PerfRung = 0 | 1 | 2 | 3 | 4 | 5

/** What a rung removes. Read by the render path; never by the user directly. */
export interface PerfConcessions {
  /** Full-screen post passes that add film grain / framing only. */
  dropFilmPasses: boolean
  /** Shadow map edge in pixels (high/low use 2048 and never come here). */
  shadowMapSize: 2048 | 1024
  /** Linear multiplier applied to the CSS-pixel render scale. */
  renderScale: number
  /** Bloom mip levels. The glow's softness, not its scene content. */
  bloomLevels: number
}

export const RUNG_CONCESSIONS: Record<PerfRung, PerfConcessions> = {
  0: { dropFilmPasses: false, shadowMapSize: 2048, renderScale: 1, bloomLevels: 5 },
  1: { dropFilmPasses: true, shadowMapSize: 2048, renderScale: 1, bloomLevels: 5 },
  2: { dropFilmPasses: true, shadowMapSize: 2048, renderScale: 0.85, bloomLevels: 5 },
  3: { dropFilmPasses: true, shadowMapSize: 1024, renderScale: 0.85, bloomLevels: 5 },
  4: { dropFilmPasses: true, shadowMapSize: 1024, renderScale: 0.85, bloomLevels: 3 },
  5: { dropFilmPasses: true, shadowMapSize: 1024, renderScale: 0.72, bloomLevels: 3 },
}

/** Human-readable reason, shown in the toast so the trade is never silent. */
export const RUNG_LABEL: Record<PerfRung, string> = {
  0: 'nguyên bản',
  1: 'bỏ nhiễu phim + viền tối',
  2: 'độ phân giải 0.85×',
  3: 'bóng đổ 1024',
  4: 'quầng sáng Bloom gọn hơn',
  5: 'độ phân giải 0.72×',
}

const TARGET_FPS = 55
const GOOD_FPS = 58
/** A rung must add at least this many FPS to be worth its cost. */
const MEANINGFUL_GAIN = 3.5
const BASELINE_MS = 1200
const SETTLE_MS = 420
const WINDOW_MS = 1100

interface Sample {
  t: number
  dt: number
}

type Mode = 'baseline' | 'settling' | 'measuring' | 'done'

class PerfLadder {
  rung: PerfRung = 0
  /** Rungs proven not to help on this machine. */
  readonly futile = new Set<PerfRung>()
  /** FPS of the window that justified the current rung. */
  fps = 0
  /** Smoothed worst input-to-frame latency in ms for the current window. */
  worstFrameMs = 0
  mode: Mode = 'baseline'
  reason = 'measuring'
  /** Direction of the step being measured; see evaluate(). */
  direction: 'up' | 'down' = 'up'
  /** Lowest rung proven to reach the smooth target on this machine. */
  goodRung: PerfRung = 0

  private samples: Sample[] = []
  private phaseStart = 0
  private lastFps = 0
  private listeners = new Set<() => void>()
  private started = false

  subscribe(fn: () => void) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  reset() {
    this.rung = 0
    this.futile.clear()
    this.fps = 0
    this.worstFrameMs = 0
    this.mode = 'baseline'
    this.reason = 'measuring'
    this.direction = 'up'
    this.goodRung = 0
    this.samples.length = 0
    this.phaseStart = 0
    this.lastFps = 0
    this.started = false
    this.emit()
  }

  /** Called once per rendered frame by the perf-only frame hook. */
  record(dtSeconds: number) {
    if (typeof document === 'undefined' || document.hidden) return
    const now = performance.now()
    if (!this.started) {
      this.started = true
      this.phaseStart = now
      return
    }
    const dt = dtSeconds * 1000
    // A tab switch or a long task is not a rendering rate; drop the window.
    if (!Number.isFinite(dt) || dt <= 0 || dt > 250) {
      this.samples.length = 0
      return
    }
    this.samples.push({ t: now, dt })
    const horizon = now - (WINDOW_MS + 400)
    while (this.samples.length && this.samples[0].t < horizon) this.samples.shift()

    const elapsed = now - this.phaseStart
    if (this.mode === 'baseline') {
      if (elapsed >= BASELINE_MS) this.evaluate(now)
    } else if (this.mode === 'settling') {
      if (elapsed >= SETTLE_MS) {
        this.mode = 'measuring'
        this.phaseStart = now
        this.samples.length = 0
        this.reason = `đo mức ${this.rung}`
        this.emit()
      }
    } else if (this.mode === 'measuring') {
      if (elapsed >= WINDOW_MS) this.evaluate(now)
    }
    this.publish()
  }

  private windowStats(now: number) {
    const from = now - WINDOW_MS
    let frames = 0
    let span = 0
    let worst = 0
    let lastT = 0
    for (const s of this.samples) {
      if (s.t < from) continue
      frames++
      if (lastT) span += s.t - lastT
      lastT = s.t
      if (s.dt > worst) worst = s.dt
    }
    const fps = span > 0 ? (1000 * Math.max(0, frames - 1)) / span : 0
    return { fps, frames, worst }
  }

  private evaluate(now: number) {
    const { fps, frames, worst } = this.windowStats(now)
    // Not enough frames to judge: keep the current rung and re-measure.
    if (frames < 20) {
      this.phaseStart = now
      this.samples.length = 0
      return
    }
    this.fps = Math.round(fps * 10) / 10
    this.worstFrameMs = Math.round(worst)
    const rounding = 0.5
    const meetsTarget = fps >= TARGET_FPS - rounding
    const comfortablySmooth = fps >= GOOD_FPS

    // ---- baseline: nothing has been given up yet -------------------------
    if (this.mode === 'baseline') {
      this.lastFps = fps
      if (meetsTarget) {
        this.finish(`máy đã đạt ${this.fps} FPS — giữ nguyên hình ảnh`)
        return
      }
      this.advance(now, 'up')
      return
    }

    // ---- we just stepped DOWN a rung, testing whether it is still smooth --
    if (this.direction === 'down') {
      if (meetsTarget) {
        // Still smooth without the previous concession: keep giving more back.
        this.lastFps = fps
        if (this.rung === 0) {
          this.finish(`máy đạt ${this.fps} FPS ở mức nguyên bản`)
          return
        }
        this.advance(now, 'down')
        return
      }
      // Too slow now, so the rung we just left was the one that was needed.
      // Return to it and stop; never record it as futile.
      this.rung = Math.min(5, this.rung + 1) as PerfRung
      this.finish(`giữ ${RUNG_LABEL[this.rung]} để đạt mượt`)
      return
    }

    // ---- we just stepped UP a rung, measuring the gain --------------------
    const gain = fps - this.lastFps
    this.lastFps = fps
    if (comfortablySmooth) {
      // This rung is enough. Try to give back what we no longer need.
      this.goodRung = this.rung
      if (this.rung === 0) {
        this.finish(`máy đạt ${this.fps} FPS ở mức nguyên bản`)
        return
      }
      this.advance(now, 'down')
      return
    }
    if (gain < MEANINGFUL_GAIN) {
      // This concession bought nothing measurable. Undo it and stop: spending
      // visual quality without a real gain is exactly what this tier must
      // never do.
      this.futile.add(this.rung)
      if (this.rung === 0) {
        this.finish(`máy giới hạn ở ${this.fps} FPS ngay cả khi chưa giảm gì`)
        return
      }
      this.rung = (this.rung - 1) as PerfRung
      this.finish(`giảm thêm không cải thiện (${this.fps} FPS) — giữ ${RUNG_LABEL[this.rung]}`)
      return
    }
    if (this.rung >= 5) {
      this.finish(`đã dùng hết mức giảm, đạt ${this.fps} FPS`)
      return
    }
    this.advance(now, 'up')
  }

  /**
   * Moves one rung. `up` means "more concessions" (slower machine),
   * `down` means "hand visual quality back" (machine recovered).
   * Rungs already proven futile by an up-step are skipped going up, which stops
   * the ladder from re-testing a concession that measurably does nothing.
   */
  private advance(now: number, direction: 'up' | 'down') {
    const next = direction === 'up'
      ? (this.rung + 1) as PerfRung
      : (this.rung - 1) as PerfRung
    this.direction = direction
    this.rung = Math.max(0, Math.min(5, next)) as PerfRung
    this.mode = 'settling'
    this.phaseStart = now
    this.samples.length = 0
    this.reason = direction === 'up'
      ? `thử ${RUNG_LABEL[this.rung]}`
      : `trả lại ${RUNG_LABEL[this.rung]}`
    this.emit()
  }

  private finish(reason: string) {
    this.mode = 'done'
    this.reason = reason
    this.emit()
  }

  private publish() {
    this.emit()
  }

  private emit() {
    const api = {
      tier: 'performance',
      rung: this.rung,
      concession: RUNG_LABEL[this.rung],
      fps: this.fps,
      worstFrameMs: this.worstFrameMs,
      mode: this.mode,
      reason: this.reason,
      futile: [...this.futile],
      targetFps: TARGET_FPS,
    }
    ;(globalThis as unknown as { __orbitaPerf?: typeof api }).__orbitaPerf = api
    this.listeners.forEach((fn) => fn())
  }
}

export const perfLadder = new PerfLadder()

/**
 * Measurement hook for `perfReport.ts`.
 *
 * Forces a rung so a human can compare all six on their own hardware. This is
 * deliberately explicit and test-only in spirit: it changes nothing unless it
 * is called, and the ladder immediately resumes its own decisions if it is.
 */
export function forcePerfRung(rung: PerfRung) {
  perfLadder.rung = Math.max(0, Math.min(5, rung)) as PerfRung
  ;(perfLadder as unknown as { mode: string }).mode = 'done'
  ;(perfLadder as unknown as { reason: string }).reason =
    `đo thủ công mức ${perfLadder.rung}`
  ;(perfLadder as unknown as { emit: () => void }).emit()
}

if (typeof window !== 'undefined') {
  ;(window as unknown as { __orbitaPerfForceRung?: typeof forcePerfRung })
    .__orbitaPerfForceRung = forcePerfRung
}

/**
 * Set by the render path so the frame hook knows whether the current rung also
 * asks for CPU effect work to be amortised. Kept deliberately tiny: the
 * consumers read it once per trigger, never per frame.
 */
export const AMORTISE_EFFECTS_QUERY = 'perfAmortise'
