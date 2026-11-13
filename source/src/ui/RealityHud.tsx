import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { dismissReality, requestReality, rt, useReality } from '../reality/state'
import { music } from '../reality/music'
import { TRACKS, TRACK_LIST } from '../reality/tracks'

// HUD của "Reality Rewrite" — nhẹ, không chắn tầm nhìn; mọi hành động đều có phím tắt + nút cho cảm ứng.
export function RealityHud() {
  const phase = useReality((s) => s.phase)
  const trackId = useReality((s) => s.track)
  const switchSeq = useReality((s) => s.switchSeq)
  const demo = useReality((s) => s.demo)
  const playing = useStore((s) => s.phase === 'playing')
  const touch = useStore((s) => s.touch)
  const [near, setNear] = useState(false)
  const [title, setTitle] = useState(false)
  const bar = useRef<HTMLDivElement>(null)

  // The old 120ms interval wrote two pieces of state — `near` (a boolean that
  // only matters while the piano is idle) and the track progress percent — on
  // every tick, forever. Each tick re-rendered this HUD even when neither value
  // could possibly have changed. Now the poll only commits values that can
  // actually move, and the progress bar is written straight to its DOM node, so
  // it keeps its original 120ms cadence without any React render at all.
  useEffect(() => {
    if (!playing) return
    const id = window.setInterval(() => {
      // Returning the same value lets React bail out of the re-render.
      setNear((v) => ((rt.presence > 0.55) === v ? v : !v))
      const pct = Math.round(music.progress * 100)
      if (bar.current) bar.current.style.width = `${pct}%`
    }, 120)
    return () => window.clearInterval(id)
  }, [playing])
  useEffect(() => {
    const isLive = phase === 'sweep' || phase === 'active'
    if (phase === 'sweep' || (switchSeq > 0 && isLive)) {
      setTitle(true)
      const t = window.setTimeout(() => setTitle(false), switchSeq > 0 ? 4800 : 6500)
      return () => window.clearTimeout(t)
    }
    if (phase === 'retract' || phase === 'idle') setTitle(false)
  }, [phase, switchSeq])
  // Paint the bar once when it (re)appears; the interval above owns it after.
  useEffect(() => {
    if (bar.current) bar.current.style.width = `${Math.round(music.progress * 100)}%`
  }, [phase])

  if (!playing) return null
  const tr = trackId ? TRACKS[trackId] : null
  const live = phase === 'sweep' || phase === 'active'

  return (
    <div className="pointer-events-none absolute inset-0 z-20 select-none font-sans text-white">
      {/* gợi ý khi lại gần đàn */}
      {phase === 'idle' && near && (
        <div className="absolute left-1/2 top-[14%] -translate-x-1/2 text-center" style={{ top: '14%', animation: 'fadeUp .8s ease both' }}>
          <div className="text-[11px] uppercase tracking-[0.35em] text-amber-200/80">Grand Piano · Reality Rewrite</div>
          <div className="mt-2 text-sm text-white/85 sm:text-base">Hai tờ sheet nhạc đang lơ lửng. Nhìn vào một tờ rồi {touch ? 'chạm' : 'nhấn E hoặc click'} để chọn.</div>
          <div className="mt-3 flex justify-center gap-3 text-xs text-white/70">
            {TRACK_LIST.map((t) => (
              <span key={t.id} className="rounded-full border border-white/20 bg-black/35 px-3 py-1 backdrop-blur" style={{ borderColor: t.accent + '88' }}>
                {t.title}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* thẻ tiêu đề điện ảnh khi trường biến đổi mở ra */}
      {tr && title && (
        <div className="absolute inset-x-0 top-[30%] text-center" style={{ animation: 'fadeUp 1.4s ease both' }}>
          <div className="text-[11px] uppercase tracking-[0.5em]" style={{ color: tr.accent }}>
            {tr.worldName}
          </div>
          <div className="mt-3 font-[Space_Grotesk] text-4xl font-bold tracking-wide drop-shadow-[0_0_30px_rgba(255,190,90,.65)] sm:text-6xl" style={{ textShadow: '0 0 30px rgba(255,190,90,.65)' }}>{tr.title}</div>
          <div className="mt-3 text-sm text-white/80">{tr.role}</div>
        </div>
      )}

      {/* thanh trạng thái khi đang trong thực tại */}
      {tr && (live || phase === 'retract' || phase === 'ignite') && (
        <div className="absolute left-3 top-3 w-[min(64vw,340px)] rounded-xl border border-white/15 bg-black/40 p-2.5 sm:rounded-2xl sm:p-3 backdrop-blur-md sm:left-5 sm:top-5" style={{ width: 'min(64vw, 340px)', backgroundColor: 'rgba(0,0,0,.4)', boxShadow: `0 0 40px ${tr.accent}33` }}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em]" style={{ color: tr.accent }}>
                {phase === 'ignite' ? 'Sheet đang bốc cháy' : phase === 'retract' ? 'Thu hồi thực tại' : tr.worldName}
              </div>
              <div className="text-base font-semibold leading-tight">{tr.title}</div>
              <div className="text-[11px] text-white/60">{tr.role}</div>
            </div>
            {live && (
              <button
                onClick={() => dismissReality()}
                className="pointer-events-auto shrink-0 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-medium hover:bg-white/20 active:scale-95"
              >
                Thu hồi{!touch && ' [R]'}
              </button>
            )}
          </div>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/15">
            {/* width is driven imperatively at 120ms — see the interval above */}
            <div ref={bar} className="h-full rounded-full" style={{ width: '0%', willChange: 'width', background: `linear-gradient(90deg, ${tr.accent}, #fff2c8)` }} />
          </div>
          {demo && (
            <div className="mt-2 rounded-lg border border-amber-300/30 bg-amber-300/10 px-2 py-1 text-[10px] leading-snug text-amber-100/90">
              <b>DEMO</b> — bản phối thủ tục minh họa, không phải bản thu thật.
              <span className="hidden sm:inline"> Đặt file thật vào <code>public/reality/</code> để thay thế.</span>
            </div>
          )}
          <div className="pointer-events-auto mt-2 hidden flex-wrap gap-2 sm:flex">
            {tr.links.map((l) => (
              <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-white/85 underline-offset-2 hover:bg-white/20 hover:underline">
                {l.label} ↗
              </a>
            ))}
          </div>
          {live && (
            <div className="pointer-events-auto mt-2 flex flex-wrap gap-2">
              {TRACK_LIST.filter((t) => t.id !== trackId).map((t) => (
                <button key={t.id} onClick={() => requestReality(t.id)} className="rounded-full border border-white/20 px-2.5 py-1 text-[11px] text-white/80 hover:bg-white/15">
                  Chuyển · {t.title}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
