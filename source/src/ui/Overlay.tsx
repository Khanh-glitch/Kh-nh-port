import { useCallback, useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { STUDIO } from '../content'
import { EXHIBIT_LIST, DISC_R } from '../layout'
import { player, input } from '../world'
import { audio } from '../audio'
import { closePanel, resumeGame, startGame } from '../scene/Player'
import { useShow } from '../stage/showState'

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex min-w-7 items-center justify-center rounded-md border border-white/25 bg-white/10 px-2 py-0.5 text-[11px] font-semibold tracking-wider text-white shadow-[0_2px_0_rgba(255,255,255,0.15)]">
      {children}
    </span>
  )
}

type SpaceEntryCallbacks = {
  onSpacePresented: () => void
  onSpaceUnavailable: () => void
}

function Intro({ onSpacePresented, onSpaceUnavailable }: SpaceEntryCallbacks) {
  const islandReady = useStore((s) => s.ready)
  const frame = useRef<HTMLIFrameElement>(null)
  const warpStarted = useRef(false)
  const engaged = useRef(false)
  const spacePainted = useRef(false)
  const fallbackReported = useRef(false)
  const entry = useRef({ ready: false })
  const [failure, setFailure] = useState<string | null>(null)
  const [fallbackRequested, setFallbackRequested] = useState(false)
  const failureRef = useRef<string | null>(null)
  const failSpace = useCallback((reason: string) => {
    if (fallbackReported.current) return
    fallbackReported.current = true
    failureRef.current = reason
    entry.current.ready = false
    setFailure(reason)
    // Do NOT automatically mount the enormous island renderer while the
    // spacecraft has failed. On slow/mobile GPU this can starve the event
    // loop and hide the recovery controls for many seconds. Let the visitor
    // choose retry (fast) OR the real 3D island fallback (on demand).
  }, [])
  const [islandTrouble, setIslandTrouble] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const origin = window.location.origin
    const started = performance.now()
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== origin ||
          event.source !== frame.current?.contentWindow) return
      const data = event.data as { type?: string }
      if (data?.type === 'ORBITA_SPACE_FRAME_READY') {
        if (spacePainted.current || fallbackReported.current) return
        spacePainted.current = true
        setFailure(null)
        onSpacePresented()
      }
      if (data?.type === 'ORBITA_SPACE_RENDERER_FAILED')
        failSpace('Không khởi tạo được WebGL của phi thuyền.')
      if (data?.type === 'ORBITA_SPACE_ENGAGE' && entry.current.ready) {
        engaged.current = true
        void audio.start()
      }
      if (data?.type === 'ORBITA_SPACE_WARP_COMPLETE' &&
          engaged.current && entry.current.ready && !warpStarted.current) {
        warpStarted.current = true
        startGame()
      }
    }
    window.addEventListener('message', onMessage)

    // No percent is inferred from elapsed time, rAF ticks, or an unrelated
    // HEX/Colossus warmup. The island must actually render after Suspense
    // resolves and the spacecraft must have painted real WebGL content.
    const update = () => {
      const now = performance.now()
      const current = useStore.getState()
      const shipRendered = spacePainted.current
      const ready = current.ready && shipRendered && !failureRef.current
      entry.current.ready = ready
      const status = failureRef.current ? 'ship-failed'
        : ready ? 'ready'
        : !shipRendered ? 'rendering-space' : 'rendering-island'
      const progress = ready ? 100 : 0
      ;(window as unknown as { __orbitaEntryGate?: unknown }).__orbitaEntryGate = {
        ready, progress, status,
        shipRendered, islandReady: current.ready,
        loadingIsMeasured: true,
        shader: (window as unknown as {__orbitaHexShaderPrep?:{status?:string}})
          .__orbitaHexShaderPrep?.status ?? 'not-started',
        gpuPreparationIsNonBlocking: true,
      }
      frame.current?.contentWindow?.postMessage({
        type: 'ORBITA_SPACE_READY',
        ready, progress, status,
      }, origin)

      if (!shipRendered && !fallbackReported.current && now-started>18000)
        failSpace('Phi thuyền chưa dựng được khung hình đầu.')
      // If island loading fails, offer an actual retry, never a false 100%
      // or silently bypass the readiness gate.
      if ((shipRendered || fallbackReported.current) && !current.ready &&
          now-started>35000) setIslandTrouble(true)
      if (current.ready) setIslandTrouble(false)
    }
    const heartbeat = window.setInterval(update, 150)
    update()
    return () => {
      window.clearInterval(heartbeat)
      window.removeEventListener('message', onMessage)
    }
  }, [attempt, onSpacePresented, failSpace])

  const requestFallback = () => {
    if (!fallbackRequested) {
      setFallbackRequested(true)
      // Give the error/retry UI two actual paints before allocating the
      // secondary island GPU context. This is scheduling, not fake progress.
      requestAnimationFrame(() => requestAnimationFrame(onSpaceUnavailable))
      return
    }
    if (islandReady && useStore.getState().ready) startGame()
  }

  const retryShip = () => {
    failureRef.current = null
    setFailure(null)
    setIslandTrouble(false)
    setFallbackRequested(false)
    fallbackReported.current = false
    spacePainted.current = false
    entry.current.ready = false
    engaged.current = false
    warpStarted.current = false
    setAttempt((n) => n + 1)
  }

  return <div data-orbita-space-entry="true"
    className="absolute inset-0 z-30 overflow-hidden bg-[#02040a] text-white">
    <iframe key={attempt} ref={frame}
      src="assets/immersive/index.html"
      title="Immersive Space Shift · spaceship cockpit"
      className="absolute inset-0 h-full w-full border-0"
      allow="autoplay"
      onError={() => failSpace('Không tải được buồng lái không gian.')} />
    {failure && (
      <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-5 bg-[#02040a] px-6 text-center">
        <p className="text-base text-white/85">{failure}</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button onClick={retryShip}
            className="rounded-full border border-cyan-300 px-6 py-3">
            THỬ TẢI LẠI PHI THUYỀN
          </button>
          <button onClick={requestFallback}
            disabled={fallbackRequested && !islandReady}
            className="rounded-full border border-white/40 px-6 py-3 disabled:opacity-35">
            {!fallbackRequested ? 'TẢI ĐẢO DỰ PHÒNG'
              : islandReady ? 'VÀO ĐẢO 3D' : 'ĐẢO ĐANG KHỞI TẠO'}
          </button>
        </div>
      </div>
    )}
    {islandTrouble && !failure && (
      <div className="absolute bottom-6 left-1/2 z-40 w-[min(90vw,28rem)] -translate-x-1/2 rounded-xl border border-white/20 bg-[#050916]/95 p-4 text-center">
        <p className="text-sm">Đảo 3D chưa khởi tạo xong. Không thể vào khi chưa sẵn sàng.</p>
        <button className="mt-3 rounded-full border border-cyan-300 px-5 py-2 text-sm"
          onClick={() => window.location.reload()}>TẢI LẠI TRẢI NGHIỆM</button>
      </div>
    )}
  </div>
}

function Minimap() {
  const arrow = useRef<SVGGElement>(null)
  // The arrow only changes when the player actually moves or turns, but the
  // loop used to rewrite the SVG matrix (and re-rasterise the panel) on every
  // animation frame, even while standing still. Comparing against the last
  // applied value skips all of that idle work and keeps the exact same pixels.
  // (The comparison is exact, not rounded, so a moving player still gets a
  // matrix update every frame — nothing is dropped, only idle frames.)
  useEffect(() => {
    let raf = 0
    let px = Number.NaN
    let pz = Number.NaN
    let prad = Number.NaN
    const loop = () => {
      const a = arrow.current
      if (a) {
        const x = (player.pos.x / DISC_R) * 50
        const z = (player.pos.z / DISC_R) * 50
        const rad = (-player.yaw * Math.PI) / 180
        if (x !== px || z !== pz || rad !== prad) {
          px = x
          pz = z
          prad = rad
          const c = Math.cos(rad)
          const sn = Math.sin(rad)
          // Same matrix as the previous `transform` attribute, applied through
          // the SVG transform list so nothing is parsed from a string.
          a.transform.baseVal.getItem(0).setMatrix(new DOMMatrix([c, sn, -sn, c, x, z]))
        }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <svg viewBox="-56 -56 112 112" className="h-32 w-32 sm:h-36 sm:w-36 drop-shadow-[0_0_20px_rgba(80,140,255,0.35)]">
      <circle r="52" fill="rgba(6,10,24,0.65)" stroke="rgba(120,200,255,0.55)" strokeWidth="0.8" />
      <circle r="34" fill="none" stroke="rgba(160,120,255,0.25)" strokeWidth="0.4" strokeDasharray="1.5 1.5" />
      <circle r="16" fill="none" stroke="rgba(120,200,255,0.25)" strokeWidth="0.4" />
      {EXHIBIT_LIST.map((e) => (
        <g key={e.id}>
          <circle cx={(e.x / DISC_R) * 50} cy={(e.z / DISC_R) * 50} r={e.id === 'orb' ? 3.4 : 2.4} fill={e.color} opacity={0.95} />
          <circle cx={(e.x / DISC_R) * 50} cy={(e.z / DISC_R) * 50} r={e.id === 'orb' ? 6 : 4.5} fill="none" stroke={e.color} strokeWidth="0.5" opacity={0.5} />
        </g>
      ))}
      {/* One identity transform exists up front so the rAF loop can set the
          matrix in place; identical rendering to the old attribute update. */}
      <g ref={arrow} transform="translate(0 0)">
        <path d="M0 -4.5 L3.2 3.2 L0 1.5 L-3.2 3.2 Z" fill="#fff" stroke="rgba(0,0,0,0.5)" strokeWidth="0.4" />
      </g>
      <text y="-46" textAnchor="middle" fontSize="5" fill="rgba(255,255,255,0.6)" letterSpacing="1">
        N
      </text>
    </svg>
  )
}

/**
 * PERFORMANCE TIER BADGE — shows the concessions this machine auto-selected.
 *
 * A visual trade must never be silent, so while the tier is active the rung is
 * always on screen. It polls `window.__orbitaPerf` (republished by the ladder on
 * every change) and writes text directly to the node: no React render, no
 * layout thrash in the render loop.
 */
function PerfBadge() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const tick = () => {
      const el = ref.current
      if (!el) return
      const api = (window as unknown as {
        __orbitaPerf?: { concession?: string; fps?: number; rung?: number }
      }).__orbitaPerf
      if (!api) return
      el.textContent = `mức ${api.rung ?? 0} · ${api.concession ?? ''}`
    }
    tick()
    const id = window.setInterval(tick, 500)
    return () => window.clearInterval(id)
  }, [])
  return (
    <div className="absolute bottom-5 right-5 text-right text-[10px] leading-relaxed tracking-[0.15em] text-white/45">
      <div>HIỆU NĂNG</div>
      <div ref={ref} style={{ minWidth: '8rem' }} />
    </div>
  )
}

function Hud() {
  const quality = useStore((s) => s.quality)
  const hover = useStore((s) => s.hover)
  const toast = useStore((s) => s.toast)
  const muted = useStore((s) => s.muted)
  const touch = useStore((s) => s.touch)
  const panel = useStore((s) => s.panel)
  const paused = useStore((s) => s.paused)
  const focus = useShow((s) => s.focus)
  const active = !panel && !paused && !focus

  return (
    <div className="pointer-events-none absolute inset-0 z-20 text-white">
      {/* crosshair */}
      {active && !touch && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className={`rounded-full border transition-all duration-200 ${hover ? 'h-9 w-9 border-white/90 bg-white/10 shadow-[0_0_24px_rgba(255,255,255,0.6)]' : 'h-1.5 w-1.5 border-white/70 bg-white/80'}`} />
        </div>
      )}
      {/* prompt */}
      {active && hover && (
        <div className="absolute left-1/2 top-[58%] flex -translate-x-1/2 flex-col items-center gap-2 animate-[fadeUp_0.25s_ease-out_both]">
          {/* Opaque instead of `backdrop-blur-md`: the pill sits on top of the
              live WebGL canvas and a backdrop-filter on it makes the compositor
              re-blur that region every frame while the crosshair moves. */}
          <div className="rounded-full border border-white/20 bg-black/55 px-5 py-1.5 text-[11px] font-semibold tracking-[0.35em] text-white">{hover.label.toUpperCase()}</div>
          {!touch && (
            <div className="flex items-center gap-4 text-[12px] text-white/85 drop-shadow">
              {hover.hint && (
                <span className="flex items-center gap-1.5">
                  <Kbd>CLICK</Kbd> {hover.hint}
                </span>
              )}
              {hover.hasPanel && (
                <span className="flex items-center gap-1.5">
                  <Kbd>E</Kbd> Xem hồ sơ
                </span>
              )}
            </div>
          )}
        </div>
      )}
      {/* brand */}
      <div className="absolute left-5 top-5 flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-[conic-gradient(from_200deg,#38d9ff,#a06bff,#ff4fd8,#38d9ff)] shadow-[0_0_24px_rgba(120,140,255,0.7)]" />
        <div>
          <div className="text-sm font-bold tracking-[0.35em]">{STUDIO.name}</div>
          <div className="text-[10px] tracking-[0.2em] text-white/55">{STUDIO.tagline.toUpperCase()}</div>
        </div>
      </div>
      {/* key hints */}
      {!touch && (
        <div className="absolute right-5 top-5 flex items-center gap-3 text-[11px] text-white/60">
          <span className="flex items-center gap-1">
            <Kbd>I</Kbd> giới thiệu
          </span>
          <span className="flex items-center gap-1">
            <Kbd>M</Kbd> {muted ? 'bật tiếng' : 'tắt tiếng'}
          </span>
          <span className="flex items-center gap-1">
            <Kbd>Q</Kbd>{' '}
            {quality === 'high' ? 'cao' : quality === 'performance' ? 'hiệu năng' : 'thấp'}
          </span>
        </div>
      )}
      {/* The minimap owns its own rAF loop; mount it only while it is really
          visible instead of animating an invisible SVG behind a panel. */}
      <div className={`absolute bottom-5 left-5 transition-opacity duration-300 ${focus ? 'opacity-0' : 'opacity-100'}`}>
        {!panel && !paused && <Minimap />}
      </div>
      {toast && (
        <div className="absolute left-1/2 top-20 -translate-x-1/2 animate-[fadeUp_0.3s_ease-out_both] rounded-full border border-white/20 bg-black/55 px-6 py-2 text-xs tracking-[0.2em]">{toast}</div>
      )}
      {/* PERFORMANCE TIER BADGE — the concessions this machine auto-selected,
          shown only while that tier is active so a visual trade is never silent.
          Reads `window.__orbitaPerf`, which the ladder republishes on every
          change, and polls at 500ms; it is a DOM write, not a React render. */}
      {quality === 'performance' && <PerfBadge />}
    </div>
  )
}

function PanelView() {
  // The panel is 3D now: see `scene/FloatingPanel.tsx`. It floats in world space
  // next to the exhibit that was clicked, rotates with the visitor, and leaves
  // the scene fully visible — the same behaviour as the Main Stage's info veil,
  // which was the one surface that never covered the screen.
  //
  // What is left here is only the part that cannot live in the scene graph:
  //
  //   · the invisible WALK-THROUGH LAYER. It is what makes clicking beside the
  //     card feel like clicking beside a card: the wrapper stays click-through
  //     so the canvas keeps receiving input, while the strip over the half of
  //     the screen the card does not occupy swallows the click and closes it.
  //     Without it, clicking "past" the card would pick whatever exhibit is
  //     behind it and open a different panel.
  //
  // The card's own ink, type and hit areas are drawn in the 3D card, so there is
  // no duplicated content and no way for the two to disagree.
  const id = useStore((s) => s.panel)
  if (!id) return null
  return (
    <div
      className="absolute inset-0 z-40 flex"
      style={{
        justifyContent: 'flex-end',
        alignItems: 'flex-start',
        padding: '12px 12px 0 0',
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      <div
        onClick={() => closePanel(true)}
        style={{
          position: 'absolute',
          inset: '0 0 0 auto',
          width: 'min(62%, 720px)',
          pointerEvents: 'auto',
          cursor: 'pointer',
          background: 'transparent',
        }}
      />
      {/* One small control that is genuinely easier to hit with a mouse than a
          plane in the world, and doubles as the keyboard instruction. */}
      <button
        onClick={() => closePanel(true)}
        style={{
          position: 'absolute',
          right: 12,
          top: 12,
          pointerEvents: 'auto',
          borderRadius: 999,
          border: '1px solid rgba(255,255,255,0.2)',
          background: 'rgba(8,10,22,0.55)',
          color: 'rgba(255,255,255,0.8)',
          padding: '6px 12px',
          fontSize: 11,
          letterSpacing: '0.18em',
        }}
      >
        ESC ✕
      </button>
    </div>
  )
}

function Paused() {
  const paused = useStore((s) => s.paused)
  const panel = useStore((s) => s.panel)
  const phase = useStore((s) => s.phase)
  // A pointer-lock drop sets `paused` immediately — including a one-frame blip
  // while the browser re-acquires the lock. Painting a full-screen dark sheet
  // for that frame is exactly the "black flash" that was reported while
  // triggering exhibits, so the sheet only appears once the pause has really
  // lasted. Resuming/re-locking inside the delay cancels it, so gameplay never
  // sees a dark frame; a genuine pause still shows the same UI (just ~180ms
  // later). Nothing is removed, only delayed.
  const [visible, setVisible] = useState(false)
  const active = paused && !panel && phase === 'playing'
  useEffect(() => {
    if (!active) {
      setVisible(false)
      return
    }
    const id = window.setTimeout(() => setVisible(true), 180)
    return () => window.clearTimeout(id)
  }, [active])
  if (!active || !visible) return null
  return (
    // Deliberately no `backdrop-blur` here: a full-screen backdrop-filter makes
    // the compositor re-blur the whole WebGL surface every frame, which is
    // exactly the kind of stall that looked like a freeze. The flat scrim keeps
    // the original 55% black by using the class already present in the build.
    <div className="absolute inset-0 z-30 flex cursor-pointer items-center justify-center bg-black/55 text-white" onClick={resumeGame}>
      <div className="text-center animate-[fadeUp_0.4s_ease-out_both]">
        <div className="font-display text-4xl font-bold">Tạm dừng</div>
        <div className="mt-3 text-sm tracking-[0.3em] text-white/70">NHẤN ĐỂ TIẾP TỤC</div>
        <div className="mt-8 flex justify-center gap-2 text-[11px] text-white/50">
          <Kbd>W</Kbd>
          <Kbd>A</Kbd>
          <Kbd>S</Kbd>
          <Kbd>D</Kbd>
          <span>di chuyển ·</span>
          <Kbd>E</Kbd>
          <span>hồ sơ ·</span>
          <Kbd>I</Kbd>
          <span>giới thiệu</span>
        </div>
      </div>
    </div>
  )
}

function TouchControls() {
  const touch = useStore((s) => s.touch)
  const phase = useStore((s) => s.phase)
  const panel = useStore((s) => s.panel)
  const knob = useRef<HTMLDivElement>(null)
  const origin = useRef<{ x: number; y: number; id: number } | null>(null)
  if (!touch || phase !== 'playing' || panel) return null
  const set = (dx: number, dy: number) => {
    const max = 48
    const l = Math.hypot(dx, dy)
    const k = l > max ? max / l : 1
    const x = dx * k
    const y = dy * k
    if (knob.current) knob.current.style.transform = `translate(${x}px, ${y}px)`
    input.moveX = x / max
    input.moveY = -y / max
  }
  const key = (code: string, down: boolean) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }))
  return (
    <div className="absolute inset-0 z-30 select-none">
      <div
        className="absolute bottom-8 left-6 h-32 w-32 rounded-full border border-white/25 bg-white/5 backdrop-blur-sm"
        style={{ touchAction: 'none' }}
        onPointerDown={(e) => {
          origin.current = { x: e.clientX, y: e.clientY, id: e.pointerId }
          ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          if (origin.current?.id === e.pointerId) set(e.clientX - origin.current.x, e.clientY - origin.current.y)
        }}
        onPointerUp={() => {
          origin.current = null
          set(0, 0)
        }}
        onPointerCancel={() => {
          origin.current = null
          set(0, 0)
        }}
      >
        <div ref={knob} className="pointer-events-none absolute left-1/2 top-1/2 -ml-7 -mt-7 h-14 w-14 rounded-full bg-white/30 shadow-[0_0_20px_rgba(255,255,255,0.4)]" />
      </div>
      <div className="absolute bottom-10 right-6 flex flex-col gap-3">
        <button
          className="h-14 w-14 rounded-full border border-white/30 bg-white/15 text-sm font-bold text-white backdrop-blur-md active:scale-95"
          onPointerDown={() => key('KeyE', true)}
          onPointerUp={() => key('KeyE', false)}
        >
          E
        </button>
        <button
          className="h-14 w-14 rounded-full border border-white/30 bg-white/15 text-lg text-white backdrop-blur-md active:scale-95"
          onPointerDown={() => key('Space', true)}
          onPointerUp={() => key('Space', false)}
        >
          ⤒
        </button>
      </div>
    </div>
  )
}

export function Overlay({ onSpacePresented, onSpaceUnavailable }: SpaceEntryCallbacks) {
  const phase = useStore((s) => s.phase)
  useEffect(() => {
    audio.prepare()
  }, [])
  return (
    <>
      <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,8,0.55)_100%)]" />
      {phase === 'intro'
        ? <Intro onSpacePresented={onSpacePresented} onSpaceUnavailable={onSpaceUnavailable} />
        : <Hud />}
      <PanelView />
      <Paused />
      <TouchControls />
    </>
  )
}
