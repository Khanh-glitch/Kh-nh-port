import { useCallback, useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { PANELS, STUDIO } from '../content'
import { EXHIBIT_LIST, DISC_R } from '../layout'
import { player, input, getTargets, getInteractive } from '../world'
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
        {/* Never reload the page from inside the experience: a reload throws
            away the visitor's position, and if it happens while an exhibit
            dossier is open it also destroys any interaction in progress. The
            island recovers in place instead. */}
        <button className="mt-3 rounded-full border border-cyan-300 px-5 py-2 text-sm"
          onClick={requestFallback}
          disabled={fallbackRequested && !islandReady}>THỬ LẠI ĐẢO 3D</button>
      </div>
    )}
  </div>
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
      <div className={`absolute bottom-5 left-5 transition-opacity duration-300 ${focus ? 'opacity-0' : 'opacity-100'}`}>
        <Minimap />
      </div>
      {toast && (
        <div className="absolute left-1/2 top-20 -translate-x-1/2 animate-[fadeUp_0.3s_ease-out_both] rounded-full border border-white/15 bg-black/55 px-6 py-2 text-xs tracking-[0.2em] backdrop-blur-md">{toast}</div>
      )}
    </div>
  )
}


/** Source-verified project dossiers, not the old universal 540px text drawer.
 * Main Stage 3D ShowSystem.tsx / case study is intentionally untouched.
 */
/** Read-only acceptance probe. It can only REPORT state that normal visitor
 * input already produced. It never opens, closes or selects anything, so it
 * cannot make a broken interaction look healthy. */
function useAcceptanceProbe() {
  useEffect(() => {
    const probe = {
      exhibits: EXHIBIT_LIST.map((e) => ({ id: e.id, name: e.name, x: e.x, z: e.z, rotY: e.rotY })),
      player: () => ({ x: player.pos.x, y: player.pos.y, z: player.pos.z,
        yaw: player.yaw, pitch: player.pitch }),
      panel: () => useStore.getState().panel,
      phase: () => useStore.getState().phase,
      paused: () => useStore.getState().paused,
      locked: () => useStore.getState().locked,
      freeMouse: () => useStore.getState().freeMouse,
      pointerLocked: () => document.pointerLockElement !== null,
      // Vertical field of view of the live island camera (degrees), read from
      // the actual canvas so the harness never guesses the projection.
      vfov: () => {
        const canvas = document.querySelector('#root canvas') as
          (HTMLCanvasElement & {__r3f?: {root?: {getState?: () => {camera?: {fov?: number}}}}}) | null
        const fov = canvas?.__r3f?.root?.getState?.()?.camera?.fov
        return typeof fov === 'number' ? fov : 72
      },
      dossiers: () => [...document.querySelectorAll('[data-project-dossier]')]
        .map((n) => n.getAttribute('data-project-dossier')),
      // Every hit volume a visitor can actually aim at, with its live world
      // position and the dossier it opens. Read from the real interaction
      // registry, so this can never disagree with what clicking does.
      hits: () => getTargets().map((o) => {
        const it = getInteractive(o)
        if (!it) return null
        const e = o.matrixWorld.elements
        return {
          id: it.id, label: it.label, panel: it.panel ?? null,
          maxDist: it.maxDist, x: e[12], y: e[13], z: e[14],
        }
      }).filter((h) => h !== null),
    }
    const w = window as unknown as { __orbitaProbe?: typeof probe }
    // Install once and keep it. Deleting it on effect teardown made harnesses
    // read an undefined probe between React commits.
    if (!w.__orbitaProbe) w.__orbitaProbe = probe
    return undefined
  }, [])
}

function PanelView() {
  useAcceptanceProbe()
  const id = useStore((state) => state.panel)
  const [selected, setSelected] = useState(0)
  const [form, setForm] = useState({ name: '', msg: '' })
  useEffect(() => {
    const w=window as unknown as {__orbitaPanelSelection?:{panel:string;index:number}}
    const requested=w.__orbitaPanelSelection
    const matched=requested && requested.panel===id
    setSelected(matched ? Math.max(0,Math.floor(requested.index)) : 0)
    if(matched)delete w.__orbitaPanelSelection
  }, [id])
  useEffect(() => {
    if (!id) return
    const handle = (event: KeyboardEvent) => {
      if (event.code === 'Escape') { event.preventDefault(); closePanel(true) }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [id])
  if (!id) return null
  const p = PANELS[id]
  const active = p.items[Math.min(selected, p.items.length - 1)]
  const hasEmail = Boolean(STUDIO.email && STUDIO.email.includes('@'))
  const send = () => {
    if (!hasEmail || !form.msg.trim()) return
    const subject = encodeURIComponent('[Portfolio] Liên hệ từ ' + (form.name || 'khách tham quan'))
    const body = encodeURIComponent(form.msg.trim())
    window.location.href = 'mailto:' + STUDIO.email + '?subject=' + subject + '&body=' + body
  }
  const proofLabel = active?.evidence === 'source'
    ? 'SOURCE CÔNG KHAI'
    : active?.evidence === 'private' ? 'DỰ ÁN ĐÃ ĐỐI CHIẾU · SOURCE RIÊNG TƯ'
    : active?.evidence === 'cv' ? 'THÔNG TIN TRONG CV · CHƯA XÁC MINH ĐỘC LẬP'
    : active?.evidence === 'brief' ? 'DỰ ÁN DO CHỦ SỞ HỮU CUNG CẤP'
    : 'CHỜ ĐỐI CHIẾU TƯ LIỆU'
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/55 px-2 py-2 text-white sm:px-6 sm:py-6"
      data-project-dossier={id}>
      {/* The scrim closes the dossier, and it must never win a hit test over
          the dossier itself. Explicit stacking order makes that a guarantee
          instead of a consequence of paint order. */}
      <div className="absolute inset-0 z-0" onClick={() => closePanel(true)} aria-hidden="true" />
      <aside role="dialog" aria-modal="true" aria-labelledby="dossier-title"
        className="relative z-10 flex h-full w-full max-w-[1180px] flex-col overflow-hidden rounded-[24px] border border-white/15 bg-[#080e1c]/95 shadow-[0_24px_96px_rgba(0,0,0,0.8)] sm:h-[min(90vh,850px)] sm:rounded-[30px]"
        style={{ boxShadow: '0 0 0 1px ' + p.accent + '35, 0 26px 100px #000d' }}>
        <div className="pointer-events-none absolute -right-16 -top-36 h-80 w-80 rounded-full opacity-10 blur-[90px]"
          style={{ background: p.accent }} />
        <header className="relative z-10 flex shrink-0 items-center gap-3 border-b border-white/10 bg-black/20 px-5 py-4 sm:px-8">
          <div className="h-8 w-1 rounded-full" style={{ background: p.accent }} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[10px] font-bold tracking-[0.25em] text-white/40">PROJECT DOSSIER / {id.toUpperCase()}</div>
            <div className="truncate text-xs font-semibold tracking-wider" style={{ color: p.accent }}>{p.kicker}</div>
          </div>
          <div className="hidden shrink-0 items-center gap-2 text-[10px] tracking-widest text-white/45 sm:flex">
            <span>{String(p.items.length).padStart(2,'0')} HỒ SƠ</span><span className="text-white/20">/</span>
            <span>LÊ QUỐC KHÁNH</span>
          </div>
          <button type="button" onClick={() => closePanel(true)}
            className="shrink-0 rounded-full border border-white/20 px-4 py-2 text-[11px] tracking-[0.2em] transition-colors hover:border-white/60 hover:bg-white/10"
            aria-label="Đóng hồ sơ dự án">ESC ✕</button>
        </header>
        <div className="relative grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="min-h-0 overflow-y-auto border-b border-white/10 px-6 py-6 lg:border-b-0 lg:border-r lg:px-9 lg:py-9">
            <div className="mb-6 flex items-center justify-between text-[10px] font-bold tracking-[0.25em] text-white/40">
              <span>OVERVIEW</span><span>CASE FILES / {String(p.items.length).padStart(2,'0')}</span>
            </div>
            <h2 id="dossier-title" className="max-w-[16ch] font-display text-[clamp(2.4rem,4vw,4.3rem)] font-bold leading-[0.98] tracking-tight">{p.title}</h2>
            <p className="mt-5 max-w-xl text-lg leading-snug text-white/80">{p.subtitle}</p>
            <div className="mt-6 space-y-3 text-[13px] leading-[1.75] text-white/60">
              {p.body.map((paragraph,i) => <p key={i}>{paragraph}</p>)}
            </div>
            <div className="mt-7 grid grid-cols-3 gap-2 sm:gap-3">
              {p.stats.map(stat => <div key={stat.k} className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-4">
                <div className="font-display text-[clamp(0.92rem,2vw,1.5rem)] font-bold leading-tight" style={{color:p.accent}}>{stat.v}</div>
                <div className="mt-2 text-[9px] uppercase leading-tight tracking-[0.14em] text-white/45">{stat.k}</div>
              </div>)}
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {p.tags.map(t => <span key={t} className="rounded-full border border-white/15 px-3 py-1.5 text-[10px] tracking-[0.07em] text-white/60">{t}</span>)}
            </div>
          </div>
          <div className="flex min-h-0 flex-col overflow-hidden">
            <div className="shrink-0 border-b border-white/10 px-5 py-5 sm:px-8">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xs font-bold tracking-[0.24em] text-white/65">CHỌN DỰ ÁN / BẰNG CHỨNG</h3>
                <span className="text-[10px] tabular-nums text-white/45">{String(selected+1).padStart(2,'0')} / {String(p.items.length).padStart(2,'0')}</span>
              </div>
              <div className="mt-4 flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Danh sách dự án">
                {p.items.map((item,i) => <button key={item.name} type="button" role="tab"
                    aria-selected={selected === i} onClick={() => setSelected(i)}
                    className="max-w-[220px] shrink-0 rounded-lg border px-3 py-2.5 text-left text-[11px] font-semibold leading-tight transition-colors"
                    style={selected === i ? {borderColor:p.accent,backgroundColor:p.accent + '22',color:'#fff'} : {borderColor:'#ffffff24',color:'#ffffff99'}}>
                    <span className="mr-2 text-[9px] opacity-55">{String(i+1).padStart(2,'0')}</span>{item.name}
                  </button>)}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8 sm:py-8" role="tabpanel">
              {active && <>
                <div className="orbita-dossier-hero relative flex min-h-[168px] flex-col justify-between overflow-hidden rounded-[20px] border border-white/15 bg-[#0e1529] p-5 sm:min-h-[208px] sm:p-7"
                  style={{backgroundImage:'linear-gradient(120deg, ' + p.accent + '20 0%, transparent 62%)'}}>
                  {active.visual && <>
                    <img className="orbita-dossier-hero-photo" src={active.visual.src}
                      alt={active.visual.alt} loading="lazy" decoding="async" />
                    <div className="orbita-dossier-hero-shade" aria-hidden="true"/>
                  </>}
                  {!active.visual && <div className="pointer-events-none absolute -right-6 -bottom-20 h-56 w-56 rounded-full border-[32px] opacity-10" style={{borderColor:p.accent}} />}
                  <div className="relative flex items-center justify-between gap-2 text-[10px] font-bold tracking-[0.25em]">
                    <span style={{color:active.visual?'#fff':p.accent}}>{active.meta}</span><span className="text-white/75">CASE / {String(selected+1).padStart(2,'0')}</span>
                  </div>
                  <h4 className="relative mt-8 max-w-[20ch] font-display text-[clamp(1.75rem,3vw,3rem)] font-bold leading-tight"
                    style={active.visual?{textShadow:'0 2px 20px #000d'}:undefined}>{active.name}</h4>
                </div>
                {active.visual && <div className="orbita-dossier-media-caption">
                  <span>{active.visual.caption}</span>
                  <a href={active.visual.src} target="_blank" rel="noopener noreferrer"
                    aria-label={'Xem ảnh tư liệu gốc: '+active.visual.alt}>XEM ẢNH GỐC ↗</a>
                </div>}
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[10px] font-semibold tracking-wider text-white/70">
                    <span className="h-1.5 w-1.5 rounded-full" style={{background:p.accent}} />{proofLabel}
                  </span>
                  {active.kind && <span className="text-[10px] uppercase tracking-[0.2em] text-white/40">{active.kind}</span>}
                </div>
                <p className="mt-5 text-[14px] leading-[1.85] text-white/70">{active.desc}</p>
                {active.url ? (
                  <a href={active.url} target="_blank" rel="noopener noreferrer"
                    className="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-xl px-5 py-3 text-center text-xs font-bold tracking-[0.16em] text-black transition-opacity hover:opacity-85"
                    style={{background:p.accent}}>{active.kind === 'contact' ? 'MỞ KÊNH LIÊN HỆ ↗' : 'MỞ BẰNG CHỨNG / SOURCE ↗'}</a>
                ) : <div className="mt-7 rounded-xl border border-dashed border-white/20 bg-white/[0.025] px-4 py-3 text-xs leading-relaxed text-white/50">
                  {active.evidence === 'private'
                    ? 'Mã nguồn hiện chưa được công bố công khai. Cần bản demo hoặc case study được phép chia sẻ.'
                    : 'Không hiển thị liên kết hoặc media chưa được xác minh là của dự án này.'}
                </div>}
              </>}
              {id === 'beacon' && hasEmail && <div className="mt-7 space-y-3">
                <input aria-label="Tên người liên hệ" value={form.name} onChange={ev => setForm({...form,name:ev.target.value})}
                  placeholder="Tên của bạn" className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm outline-none focus:border-white/50" />
                <textarea aria-label="Nội dung liên hệ" value={form.msg} onChange={ev => setForm({...form,msg:ev.target.value})}
                  placeholder="Lời nhắn của bạn" rows={3} className="w-full resize-y rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm outline-none focus:border-white/50" />
                <button type="button" onClick={send} disabled={!form.msg.trim()}
                  className="w-full rounded-xl px-4 py-3 text-xs font-bold text-black disabled:opacity-40"
                  style={{background:p.accent}}>SOẠN EMAIL LIÊN HỆ</button>
              </div>}
              {p.slotNote && <div className="mt-6 rounded-xl border-l-2 bg-white/[0.025] px-4 py-3 text-[11px] leading-relaxed text-white/55"
                style={{borderLeftColor:p.accent}}>{p.slotNote}</div>}
              {p.action && <a href={p.action.url} target="_blank" rel="noopener noreferrer"
                className="mt-5 inline-block text-xs font-bold tracking-[0.12em] hover:underline" style={{color:p.accent}}>{p.action.label} ↗</a>}
            </div>
            <footer className="shrink-0 border-t border-white/10 bg-black/20 px-5 py-3 text-[10px] tracking-[0.12em] text-white/40 sm:px-8">
              <span className="flex items-center justify-between gap-3">
                <span>ĐÓNG ĐỂ TIẾP TỤC KHÁM PHÁ</span>
                <button className="rounded-md border border-white/15 px-3 py-2 text-white/75 hover:bg-white/10" onClick={() => closePanel(true)}>TIẾP TỤC ✕</button>
              </span>
            </footer>
          </div>
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
