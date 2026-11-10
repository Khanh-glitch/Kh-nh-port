import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { PANELS, STUDIO } from '../content'
import { EXHIBIT_LIST, DISC_R } from '../layout'
import { player, input } from '../world'
import { audio } from '../audio'
import { closePanel, resumeGame, startGame } from '../scene/Player'

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex min-w-7 items-center justify-center rounded-md border border-white/25 bg-white/10 px-2 py-0.5 text-[11px] font-semibold tracking-wider text-white shadow-[0_2px_0_rgba(255,255,255,0.15)]">
      {children}
    </span>
  )
}

function Intro() {
  const loading = useStore((s) => s.loading)
  const ready = useStore((s) => s.ready)
  const arrivalReady = useStore((s) => s.arrivalReady)
  const arrivalProgress = useStore((s) => s.arrivalProgress)
  const arrivalStage = useStore((s) => s.arrivalStage)
  const arrival = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('arrival') === 'on'
  const canLand = ready && (!arrival || arrivalReady)
  // Fictional cockpit range tracks measured GPU readiness monotonically.
  const simulatedRange = Math.round(250 + (1 - arrivalProgress) * 11950)
  const touch = useStore((s) => s.touch)
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-between overflow-hidden px-6 py-8 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(2,4,14,0.1)_0%,rgba(2,3,10,0.55)_55%,rgba(1,2,6,0.92)_100%)]" />
      <div className="relative z-10 flex w-full max-w-6xl items-center justify-between text-[11px] tracking-[0.35em] text-white/60">
        <span className="font-semibold text-white">{STUDIO.name}</span>
        <span className="hidden sm:inline">LIVE PRODUCTION · DIGITAL PRODUCTS · CREATIVE TECH</span>
        <span>2026</span>
      </div>

      <div className="relative z-10 flex max-w-3xl flex-col items-center text-center">
        <div className="mb-5 text-[11px] tracking-[0.5em] text-cyan-200/80 animate-[fadeUp_1s_ease-out_both]">{arrival ? 'ORBITA ARRIVAL · PHI THUYỀN TỰ ĐỘNG · COCKPIT VIEW' : 'PORTFOLIO TƯƠNG TÁC · GÓC NHÌN THỨ NHẤT'}</div>
        <h1 className="font-display bg-gradient-to-b from-white via-white to-sky-300/70 bg-clip-text text-6xl font-bold leading-[0.95] tracking-tight text-transparent drop-shadow-[0_0_40px_rgba(120,160,255,0.45)] sm:text-8xl animate-[fadeUp_1.1s_0.1s_ease-out_both]">
          Một chiếc đĩa
          <br />
          giữa vũ trụ.
        </h1>
        <p className="mt-6 max-w-xl text-base leading-relaxed text-white/70 sm:text-lg animate-[fadeUp_1.1s_0.25s_ease-out_both]">
          Bước đi trên đĩa bay của <b className="text-white">{STUDIO.name}</b> — nghe cây grand piano tự chơi, xem khối Rubik tự giải, chạm vào quả cầu đen, đứng dưới chân người máy khổng lồ và bấm cue trên sân khấu thật.
        </p>

        {arrival && (
          <div className="mt-5 flex w-full max-w-md justify-between rounded-xl border border-cyan-300/40 bg-slate-950/75 px-4 py-3 font-mono text-[11px] tracking-wider text-cyan-100 backdrop-blur-xl">
            <div><div className="text-white/50">FLIGHT CONTROL</div><div className="mt-1 font-bold text-white">LÊ QUỐC KHÁNH</div></div>
            <div className="text-right"><div className="text-white/50">ORBITA / SIMULATED RANGE</div><div className="mt-1 font-bold">{simulatedRange.toLocaleString('vi-VN')} U</div></div>
          </div>
        )}
        <div className="mt-9 flex flex-col items-center gap-3 animate-[fadeUp_1.1s_0.4s_ease-out_both]">
          <button
            data-testid="arrival-land"
            disabled={!canLand}
            onClick={startGame}
            className="group relative overflow-hidden rounded-full border border-white/30 bg-white/10 px-10 py-4 text-sm font-semibold tracking-[0.3em] text-white backdrop-blur-md transition hover:scale-[1.04] hover:border-white/70 hover:bg-white/20 disabled:cursor-wait disabled:opacity-60"
          >
            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            <span className="relative">{canLand ? (arrival ? 'HẠ CÁNH · BƯỚC VÀO ORBITA' : 'BƯỚC VÀO') : !ready ? `ĐANG NẠP ÂM THANH ${Math.round(loading * 100)}%` : arrival ? `GIỮ QUỸ ĐẠO · GPU ${Math.round(arrivalProgress * 100)}%` : 'ĐANG CHUẨN BỊ'}</span>
          </button>
          <div className="h-[2px] w-56 overflow-hidden rounded-full bg-white/15">
            <div className="h-full bg-gradient-to-r from-cyan-300 to-fuchsia-400 transition-all duration-300" style={{ width: `${Math.round((arrival && ready ? arrivalProgress : loading) * 100)}%` }} />
          </div>
          <div className="text-[11px] tracking-[0.2em] text-white/60">{arrival ? (ready ? (arrivalReady ? 'GPU VERIFIED · APPROACH COMPLETE' : arrivalStage) : 'AUDIO ASSETS · RECEIVING') : '🎧 ĐEO TAI NGHE ĐỂ NGHE ÂM THANH 3D'}</div>
        </div>
      </div>

      <div className="relative z-10 flex w-full max-w-6xl flex-col items-center justify-between gap-4 text-[11px] text-white/55 sm:flex-row">
        {touch ? (
          <div className="flex items-center gap-3">Kéo trái dưới để đi · Kéo màn hình để nhìn · Chạm vật thể để tương tác</div>
        ) : (
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <span className="flex items-center gap-1">
              <Kbd>W</Kbd>
              <Kbd>A</Kbd>
              <Kbd>S</Kbd>
              <Kbd>D</Kbd> di chuyển
            </span>
            <span className="flex items-center gap-1">
              <Kbd>CHUỘT</Kbd> nhìn
            </span>
            <span className="flex items-center gap-1">
              <Kbd>CLICK</Kbd> kích hoạt
            </span>
            <span className="flex items-center gap-1">
              <Kbd>E</Kbd> hồ sơ
            </span>
            <span className="flex items-center gap-1">
              <Kbd>SHIFT</Kbd> chạy
            </span>
            <span className="flex items-center gap-1">
              <Kbd>SPACE</Kbd> nhảy
            </span>
          </div>
        )}
        <div className="hidden max-w-xs text-right text-[10px] leading-snug text-white/35 lg:block">
          Piano: Salamander Grand (A. Holm, CC-BY 3.0)
          <br />
          Cảm hứng: folio-2025 của Bruno Simon
        </div>
      </div>
    </div>
  )
}

function Minimap() {
  const arrow = useRef<SVGGElement>(null)
  useEffect(() => {
    let raf = 0
    const loop = () => {
      const a = arrow.current
      if (a) {
        const x = (player.pos.x / DISC_R) * 50
        const z = (player.pos.z / DISC_R) * 50
        a.setAttribute('transform', `translate(${x.toFixed(2)} ${z.toFixed(2)}) rotate(${((-player.yaw * 180) / Math.PI).toFixed(1)})`)
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
      <g ref={arrow}>
        <path d="M0 -4.5 L3.2 3.2 L0 1.5 L-3.2 3.2 Z" fill="#fff" stroke="rgba(0,0,0,0.5)" strokeWidth="0.4" />
      </g>
      <text y="-46" textAnchor="middle" fontSize="5" fill="rgba(255,255,255,0.6)" letterSpacing="1">
        N
      </text>
    </svg>
  )
}

function Hud() {
  const hover = useStore((s) => s.hover)
  const toast = useStore((s) => s.toast)
  const muted = useStore((s) => s.muted)
  const touch = useStore((s) => s.touch)
  const panel = useStore((s) => s.panel)
  const paused = useStore((s) => s.paused)
  const active = !panel && !paused

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
          <div className="rounded-full border border-white/15 bg-black/45 px-5 py-1.5 text-[11px] font-semibold tracking-[0.35em] text-white backdrop-blur-md">{hover.label.toUpperCase()}</div>
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
            <Kbd>Q</Kbd> chất lượng
          </span>
        </div>
      )}
      <div className="absolute bottom-5 left-5">
        <Minimap />
      </div>
      {toast && (
        <div className="absolute left-1/2 top-20 -translate-x-1/2 animate-[fadeUp_0.3s_ease-out_both] rounded-full border border-white/15 bg-black/55 px-6 py-2 text-xs tracking-[0.2em] backdrop-blur-md">{toast}</div>
      )}
    </div>
  )
}

function PanelView() {
  const id = useStore((s) => s.panel)
  const [form, setForm] = useState({ name: '', msg: '' })
  if (!id) return null
  const p = PANELS[id]
  const send = () => {
    const sub = encodeURIComponent(`[Orbita] Liên hệ từ ${form.name || 'khách tham quan'}`)
    const body = encodeURIComponent(form.msg)
    window.location.href = `mailto:${STUDIO.email}?subject=${sub}&body=${body}`
  }
  return (
    <div className="absolute inset-0 z-40 flex items-stretch justify-end bg-gradient-to-l from-black/70 via-black/20 to-transparent text-white">
      <div className="absolute inset-0" onClick={() => closePanel(true)} />
      <aside
        className="relative m-3 flex w-full max-w-[540px] flex-col overflow-hidden rounded-3xl border border-white/15 bg-[rgba(8,10,22,0.72)] shadow-[0_30px_120px_rgba(0,0,0,0.8)] backdrop-blur-2xl animate-[slideIn_0.45s_cubic-bezier(.2,.8,.2,1)_both] sm:m-6"
        style={{ boxShadow: `0 0 0 1px ${p.accent}22, 0 30px 120px rgba(0,0,0,0.8), 0 0 80px ${p.accent}22` }}
      >
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-40 blur-3xl" style={{ background: p.accent }} />
        <div className="relative flex-1 overflow-y-auto p-7 sm:p-9">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-semibold tracking-[0.4em]" style={{ color: p.accent }}>
              {p.kicker}
            </div>
            <button onClick={() => closePanel(true)} className="rounded-full border border-white/20 px-3 py-1 text-[11px] tracking-widest text-white/80 transition hover:bg-white/15">
              ESC ✕
            </button>
          </div>
          <h2 className="font-display mt-5 text-5xl font-bold leading-none tracking-tight sm:text-6xl">{p.title}</h2>
          <p className="mt-4 text-lg leading-snug text-white/85">{p.subtitle}</p>
          <div className="mt-6 space-y-3 text-[14.5px] leading-relaxed text-white/65">
            {p.body.map((b, i) => (
              <p key={i}>{b}</p>
            ))}
          </div>

          <div className="mt-7 grid grid-cols-3 gap-3">
            {p.stats.map((s) => (
              <div key={s.k} className="rounded-2xl border border-white/10 bg-white/5 p-3.5">
                <div className="font-display text-2xl font-bold" style={{ color: p.accent }}>
                  {s.v}
                </div>
                <div className="mt-1 text-[10px] uppercase leading-tight tracking-[0.18em] text-white/50">{s.k}</div>
              </div>
            ))}
          </div>

          <div className="mt-8 text-[10px] font-semibold tracking-[0.4em] text-white/40">{id === 'beacon' ? 'KÊNH LIÊN HỆ' : 'DỰ ÁN & NĂNG LỰC'}</div>
          <div className="mt-3 divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/[0.03]">
            {p.items.map((it, i) => (
              <div key={it.name} className="flex gap-4 p-4">
                <div className="font-display w-6 pt-0.5 text-sm font-bold text-white/30">{String(i + 1).padStart(2, '0')}</div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <span className="break-all text-[15px] font-semibold">{it.name}</span>
                    <span className="text-[10px] uppercase tracking-[0.2em]" style={{ color: p.accent }}>
                      {it.meta}
                    </span>
                  </div>
                  <div className="mt-1 text-[13px] leading-snug text-white/55">{it.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {id === 'beacon' && (
            <div className="mt-6 space-y-3">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Tên của bạn"
                className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm outline-none placeholder:text-white/35 focus:border-white/50"
              />
              <textarea
                value={form.msg}
                onChange={(e) => setForm({ ...form, msg: e.target.value })}
                placeholder="Bạn đang nghĩ đến sự kiện / sản phẩm gì?"
                rows={4}
                className="w-full resize-none rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm outline-none placeholder:text-white/35 focus:border-white/50"
              />
              <button onClick={send} className="w-full rounded-xl px-5 py-3.5 text-sm font-bold tracking-[0.25em] text-black transition hover:brightness-110" style={{ background: p.accent }}>
                PHÁT TÍN HIỆU ➜
              </button>
            </div>
          )}

          {p.slotNote && (
            <div className="mt-6 rounded-2xl border border-dashed border-white/20 bg-white/[0.03] px-4 py-3 text-[12px] leading-relaxed text-white/65">
              <span className="mr-2 font-semibold uppercase tracking-[0.2em]" style={{ color: p.accent }}>
                NEXT PHASE ·
              </span>
              {p.slotNote}
            </div>
          )}

          {p.action && (
            <a
              href={p.action.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 flex w-full items-center justify-center rounded-xl px-5 py-3.5 text-xs font-bold tracking-[0.25em] text-black transition hover:brightness-110"
              style={{ background: p.accent }}
            >
              {p.action.label}
            </a>
          )}

          <div className="mt-6 flex flex-wrap gap-2">
            {p.tags.map((t) => (
              <span key={t} className="rounded-full border border-white/15 px-3 py-1 text-[11px] tracking-wider text-white/70">
                {t}
              </span>
            ))}
          </div>
        </div>
        <div className="relative border-t border-white/10 p-4 sm:p-5">
          <button onClick={() => closePanel(true)} className="w-full rounded-xl border border-white/20 bg-white/10 py-3 text-xs font-semibold tracking-[0.3em] transition hover:bg-white/20">
            TIẾP TỤC KHÁM PHÁ
          </button>
        </div>
      </aside>
    </div>
  )
}

function Paused() {
  const paused = useStore((s) => s.paused)
  const panel = useStore((s) => s.panel)
  const phase = useStore((s) => s.phase)
  if (!paused || panel || phase !== 'playing') return null
  return (
    <div className="absolute inset-0 z-30 flex cursor-pointer items-center justify-center bg-black/55 text-white backdrop-blur-sm" onClick={resumeGame}>
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

export function Overlay() {
  const phase = useStore((s) => s.phase)
  useEffect(() => {
    audio.prepare()
  }, [])
  return (
    <>
      <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,8,0.55)_100%)]" />
      {phase === 'intro' ? <Intro /> : <Hud />}
      <PanelView />
      <Paused />
      <TouchControls />
    </>
  )
}
