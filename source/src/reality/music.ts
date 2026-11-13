// ORBITA · Reality Rewrite — engine âm nhạc cho từng thực tại.
// • Nếu track có audioSrc hợp lệ  -> phát file thật (đoạn highlight) qua analyser.
// • Nếu không                     -> bản phối DEMO thủ tục (nhiều lớp: trống, bass, pad, guitar/chuông,
//   giọng "ooh/aah" tổng hợp) — luôn được gắn nhãn DEMO, KHÔNG phải tác phẩm thật.
// Mọi thế giới đọc cùng một giao diện: bass / mid / high / kick / energy / progress.
import { audio } from '../audio'
import { toast } from '../store'
import { rt } from './state'
import { TRACKS, probePlayable, type TrackId } from './tracks'

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12)
function mulberry(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Song {
  bpm: number
  chords: number[][] // mỗi hợp âm: các nốt midi (pad/arp)
  roots: number[]
  sectionOf: (bar: number) => number // 0 intro · 1 verse · 2 chorus · 3 lift · 4 outro
  arp: 'pluck' | 'bell'
  formant: [number, number, number]
  voiceBase: number
  seed: number
}
const SONGS: Record<TrackId, Song> = {
  // D · A · Bm · G — ấm, sáng, hoài niệm
  'mua-ha': {
    bpm: 92,
    chords: [[62, 66, 69, 74], [57, 61, 64, 69], [59, 62, 66, 71], [55, 59, 62, 67]],
    roots: [38, 33, 35, 31],
    sectionOf: (b) => (b < 4 ? 0 : b < 12 ? 1 : b < 20 ? 2 : b < 24 ? 3 : 4),
    arp: 'pluck',
    formant: [800, 1150, 2900],
    voiceBase: 69,
    seed: 18,
  },
  // Am · F · C · G — đêm dài chờ bình minh, lên giọng ở đoạn cuối
  'ngay-mai': {
    bpm: 76,
    chords: [[57, 60, 64, 69], [53, 57, 60, 65], [60, 64, 67, 72], [55, 59, 62, 67]],
    roots: [33, 29, 36, 31],
    sectionOf: (b) => (b < 4 ? 0 : b < 10 ? 1 : b < 18 ? 2 : b < 22 ? 3 : 4),
    arp: 'bell',
    formant: [450, 800, 2830],
    voiceBase: 64,
    seed: 7,
  },
}
const ENERGY = [0.28, 0.5, 1, 0.85, 0.3]

class Music {
  playing = false
  ended = false
  demo = true
  trackId: TrackId | null = null
  bass = 0
  mid = 0
  high = 0
  kick = 0
  energy = 0.3
  progress = 0
  section = 0
  elapsed = 0
  dur = 60
  private out: GainNode | null = null
  private an: AnalyserNode | null = null
  private fft = new Uint8Array(128)
  private timer = 0
  private t0 = 0
  private nextStep = 0
  private step = 0
  private kicks: number[] = []
  private rnd = Math.random
  private el: HTMLAudioElement | null = null
  private src: MediaElementAudioSourceNode | null = null
  private voices: AudioNode[] = []
  private rainGain: GainNode | null = null
  private rainSrc: AudioBufferSourceNode | null = null
  private token = 0
  private retryCleanup: (() => void) | null = null
  private videoClock: { element: HTMLVideoElement; cue: number } | null = null

  followVideo(element: HTMLVideoElement, cue: number) { this.videoClock = { element, cue } }
  unfollowVideo(element: HTMLVideoElement) { if (this.videoClock?.element === element) this.videoClock = null }

  private ensureRainBed() {
    if (this.rainGain || !audio.prepared || !audio.noise) return
    const ctx = audio.ctx
    const src = ctx.createBufferSource()
    src.buffer = audio.noise
    src.loop = true
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 1850
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 680
    bp.Q.value = 0.55
    const g = ctx.createGain()
    g.gain.value = 0.0001
    src.connect(lp).connect(g)
    src.connect(bp).connect(g)
    g.connect(audio.master)
    src.start()
    this.rainSrc = src
    this.rainGain = g
  }

  async start(id: TrackId, delay = 0, crossfade = 0.08) {
    this.stop(crossfade)
    this.ensureRainBed()
    const tr = TRACKS[id]
    const tok = ++this.token
    audio.prepare()
    const ctx = audio.ctx
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    this.trackId = id
    this.ended = false
    this.playing = true
    this.progress = 0
    this.elapsed = 0
    this.dur = tr.highlight.dur
    // Media probing is async; do not let a previous track's clock end this one.
    this.t0 = ctx.currentTime + delay
    this.demo = false
    this.kicks = []
    this.out = ctx.createGain()
    this.out.gain.value = 0.0001
    this.an = ctx.createAnalyser()
    this.an.fftSize = 256
    this.an.smoothingTimeConstant = 0.78
    this.out.connect(this.an)
    this.an.connect(audio.master)
    const send = ctx.createGain()
    send.gain.value = 0.22
    this.out.connect(send).connect(audio.reverbSend)
    this.out.gain.setTargetAtTime(0.9, ctx.currentTime + delay, 0.6)

    // Wait for metadata before seeking to the owner's cue; a successful HEAD
    // request alone does not prove that the browser can decode the file.
    // The official player owns this song's audio, not the DEMO arrangement.
    if (tr.videoId) {
      this.demo = false
      this.t0 = ctx.currentTime + delay
      return
    }
    let el: HTMLAudioElement | null = null
    if (tr.audioSrc) {
      const candidate = new Audio()
      candidate.crossOrigin = 'anonymous'
      candidate.preload = 'metadata'
      candidate.src = tr.audioSrc
      const playable = await probePlayable(candidate)
      if (tok !== this.token) return
      // Keep the supplied track even after a timeout/error. Never substitute a
      // synthetic arrangement for the owner's audio. A later user gesture can
      // retry this same element if the browser/network temporarily blocked it.
      el = candidate
      if (!playable) toast('Audio chưa sẵn sàng · bấm để thử phát lại', 4000)
    }
    if (tok !== this.token) return
    this.t0 = ctx.currentTime + delay
    if (el) {
      this.demo = false
      // Only a same-origin/CORS-clean element may enter the WebAudio graph, and
      // that is exactly what probePlayable confirmed above.
      const seekCue = () => {
        if (tok === this.token && el && el.currentTime < tr.highlight.start) el.currentTime = tr.highlight.start
      }
      if (el.readyState >= 1) seekCue()
      else el.addEventListener('loadedmetadata', seekCue, { once: true })
      if (Number.isFinite(el.duration)) this.dur = Math.max(0.01, el.duration - tr.highlight.start)
      this.el = el
      el.addEventListener('ended', () => { if (tok === this.token) this.ended = true }, { once: true })
      this.src = ctx.createMediaElementSource(el)
      this.src.connect(this.out)
      const retry = () => {
        if (tok !== this.token || !el) return
        if (ctx.state === 'suspended') void ctx.resume().catch(() => {})
        void el.play().then(() => { if (tok === this.token) this.retryCleanup?.() }).catch(() => {})
      }
      const armRetry = () => {
        if (tok !== this.token || this.retryCleanup) return
        toast('Bấm hoặc nhấn phím để phát audio Mùa Hạ', 4000)
        window.addEventListener('pointerdown', retry)
        window.addEventListener('keydown', retry)
        this.retryCleanup = () => {
          window.removeEventListener('pointerdown', retry)
          window.removeEventListener('keydown', retry)
          this.retryCleanup = null
        }
      }
      window.setTimeout(() => {
        if (tok !== this.token || !el) return
        void el.play().catch(armRetry)
      }, delay * 1000)
    } else {
      this.demo = true
      const s = SONGS[id]
      this.rnd = mulberry(s.seed)
      this.step = 0
      this.nextStep = this.t0
      this.timer = window.setInterval(() => this.schedule(id), 40)
    }
  }

  stop(fade = 2.5) {
    this.token++
    this.retryCleanup?.()
    this.playing = false
    window.clearInterval(this.timer)
    const out = this.out
    const ctx = audio.ctx
    if (out && ctx) {
      out.gain.cancelScheduledValues(ctx.currentTime)
      out.gain.setTargetAtTime(0.0001, ctx.currentTime, Math.max(0.02, fade / 4))
      const el = this.el
      const src = this.src
      const an = this.an
      window.setTimeout(() => {
        el?.pause()
        try {
          src?.disconnect()
          out.disconnect()
          an?.disconnect()
        } catch {
          /* noop */
        }
      }, fade * 1000 + 300)
    }
    if (this.rainGain && ctx) {
      this.rainGain.gain.setTargetAtTime(0.0001, ctx.currentTime, Math.max(0.05, fade / 4))
    }
    this.el = null
    this.src = null
    this.out = null
    this.kick = 0
    void this.rainSrc
  }

  update(dt: number) {
    if (!this.playing || !this.an) {
      this.bass *= 0.9
      this.mid *= 0.9
      this.high *= 0.9
      this.kick *= 0.9
      this.energy += (0.2 - this.energy) * Math.min(1, dt)
      return
    }
    const ctx = audio.ctx
    this.elapsed = this.el && !this.demo
      ? Math.max(0, this.el.currentTime - TRACKS[this.trackId!].highlight.start)
      : this.trackId === 'ngay-mai' && this.videoClock
        ? Math.max(0, this.videoClock.element.currentTime - this.videoClock.cue)
        : Math.max(0, ctx.currentTime - this.t0)
    this.progress = Math.min(1, this.elapsed / this.dur)
    // Real media ends on its own event, not at the demo's fixed duration.
    if (!this.ended && this.demo && this.elapsed >= this.dur) this.ended = true
    this.an.getByteFrequencyData(this.fft)
    const avg = (a: number, b: number) => {
      let s = 0
      for (let i = a; i < b; i++) s += this.fft[i]
      return s / ((b - a) * 255)
    }
    const k = 1 - Math.exp(-dt * 14)
    this.bass += (avg(0, 3) - this.bass) * k
    this.mid += (avg(3, 24) - this.mid) * k
    this.high += (avg(24, 90) - this.high) * k
    while (this.kicks.length && this.kicks[0] <= ctx.currentTime) {
      this.kick = 1
      this.kicks.shift()
    }
    this.kick *= Math.exp(-dt * 5.5)
    const song = this.trackId ? SONGS[this.trackId] : null
    if (song) {
      const bar = Math.floor(this.elapsed / ((60 / song.bpm) * 4))
      this.section = song.sectionOf(bar)
      this.energy += (ENERGY[this.section] - this.energy) * Math.min(1, dt * 0.8)
    }
    if (this.rainGain && audio.ctx) {
      const targetRainVol = this.playing && rt.rain > 0.01 ? 0.045 * rt.rain : 0.0001
      this.rainGain.gain.setTargetAtTime(targetRainVol, audio.ctx.currentTime, 0.25)
    }
  }

  // ---------------- bộ lập lịch (demo) ----------------
  private schedule(id: TrackId) {
    const ctx = audio.ctx
    const s = SONGS[id]
    const spb = 60 / s.bpm
    const s16 = spb / 4
    while (this.nextStep < ctx.currentTime + 0.3) {
      const when = this.nextStep
      const st = this.step
      const bar = Math.floor(st / 16)
      if (when - this.t0 < this.dur + 0.5) this.play16(s, st, bar, when, spb, id)
      this.step++
      this.nextStep += s16
    }
  }

  private play16(s: Song, st: number, bar: number, when: number, spb: number, id: TrackId) {
    const o = this.out!
    const sec = s.sectionOf(bar)
    const q = st % 16
    const ch = s.chords[bar % 4]
    const root = s.roots[bar % 4]
    const r = this.rnd
    const fade = Math.min(1, Math.max(0, (this.dur - (when - this.t0)) / 3.5)) // thu nhỏ ở cuối đoạn
    const lead = id === 'mua-ha'

    // ---- trống ----
    const drums = sec >= 1
    if (drums) {
      const full = sec === 2 || sec === 3
      const kickAt = lead ? [0, 6, 8, 14] : full ? [0, 7, 10] : [0]
      if (kickAt.includes(q) && (full || q === 0 || sec === 1)) {
        audio.tone(o, 'sine', 140, 42, 0.32, 0.9 * fade, when, 0.002)
        this.kicks.push(when)
      }
      if (q === 4 || q === 12) {
        audio.noiseBurst(o, 0.16, 'bandpass', 1900, 0.8, (full ? 0.34 : 0.18) * fade, when)
        audio.tone(o, 'triangle', 220, 150, 0.1, 0.18 * fade, when, 0.001)
      }
      if (q % 2 === 0 || (full && q % 1 === 0)) audio.noiseBurst(o, 0.04, 'highpass', 7500, 0.5, (q % 4 === 2 ? 0.12 : 0.06) * (full ? 1.3 : 0.8) * fade, when)
    }
    // ---- bass ----
    if (sec >= 1 && (q === 0 || q === 6 || q === 10 || (lead && q === 14))) {
      const m = q === 10 ? root + 12 : root
      audio.tone(o, 'sawtooth', mtof(m), mtof(m), spb * 1.4, 0.2 * fade, when, 0.01)
      audio.tone(o, 'sine', mtof(m - 12), mtof(m - 12), spb * 1.6, 0.5 * fade, when, 0.01)
    }
    // ---- pad ----
    if (q === 0) {
      const padLen = spb * 4
      ch.forEach((m, i) => {
        const g = audio.ctx.createGain()
        const f = audio.ctx.createBiquadFilter()
        f.type = 'lowpass'
        f.frequency.value = sec === 2 ? 3200 : 1500
        g.gain.setValueAtTime(0.0001, when)
        g.gain.linearRampToValueAtTime((sec === 0 ? 0.05 : 0.07) * fade, when + 0.9)
        g.gain.linearRampToValueAtTime(0.0001, when + padLen + 0.8)
        f.connect(g).connect(o)
        ;[-7, 7].forEach((det) => {
          const osc = audio.ctx.createOscillator()
          osc.type = 'sawtooth'
          osc.frequency.value = mtof(m - 12 + (sec === 3 ? 12 : 0))
          osc.detune.value = det + i * 2
          osc.connect(f)
          osc.start(when)
          osc.stop(when + padLen + 1)
        })
      })
    }
    // ---- arpeggio: guitar (pluck) / chuông (bell) ----
    const arpOn = sec !== 4 || q < 8
    if (arpOn && q % 2 === 0) {
      const idx = [0, 1, 2, 3, 2, 1, 3, 2][(q / 2) % 8]
      const m = ch[idx] + (sec === 2 ? 12 : 0)
      const vel = (sec === 0 ? 0.2 : 0.14) * fade
      if (s.arp === 'pluck') {
        audio.tone(o, 'triangle', mtof(m), mtof(m) * 0.995, 0.5, vel, when, 0.002)
        audio.tone(o, 'sine', mtof(m + 12), mtof(m + 12), 0.25, vel * 0.4, when, 0.002)
      } else {
        audio.tone(o, 'sine', mtof(m + 12), mtof(m + 12), 1.6, vel * 0.9, when, 0.003)
        audio.tone(o, 'sine', mtof(m + 12) * 2.76, mtof(m + 12) * 2.76, 0.5, vel * 0.25, when, 0.003)
      }
    }
    // ---- riser trước điệp khúc / lúc bình minh (bài 2) ----
    if (!lead && q === 0 && (bar === 8 || bar === 16)) audio.noiseBurst(o, spb * 8, 'bandpass', 500, 1.5, 0.22 * fade, when, 6500)
    if (lead && q === 0 && bar === 10) audio.noiseBurst(o, spb * 8, 'bandpass', 600, 1.2, 0.16 * fade, when, 5000)
    // ---- giọng (formant) ----
    if (sec >= 1 && sec <= 3 && q % 4 === 0 && (bar % 2 === 0 || sec >= 2 || r() > 0.4)) {
      const pool = ch.filter((_, i) => i !== 0)
      const base = s.voiceBase + (sec >= 2 ? 7 : 0) + (sec === 3 ? 5 : 0)
      let m = pool[Math.floor(r() * pool.length)]
      while (m < base) m += 12
      while (m > base + 11) m -= 12
      if (r() > 0.78) m += r() > 0.5 ? 2 : -2
      this.voice(m, when, spb * (sec === 1 ? 1.9 : 0.95 + r() * 0.8), s.formant, (sec === 2 ? 0.34 : 0.26) * fade)
    }
  }

  private voice(m: number, when: number, dur: number, f: [number, number, number], vol: number) {
    const ctx = audio.ctx
    const o = this.out!
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(mtof(m) * 0.985, when)
    osc.frequency.linearRampToValueAtTime(mtof(m), when + 0.08)
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 5.4
    const lg = ctx.createGain()
    lg.gain.value = mtof(m) * 0.012
    lfo.connect(lg).connect(osc.frequency)
    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, when)
    env.gain.linearRampToValueAtTime(vol, when + 0.07)
    env.gain.setTargetAtTime(0.0001, when + dur, 0.12)
    f.forEach((fr, i) => {
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = fr
      bp.Q.value = 6 + i * 3
      const g = ctx.createGain()
      g.gain.value = [1, 0.55, 0.25][i]
      osc.connect(bp).connect(g).connect(env)
    })
    env.connect(o)
    osc.start(when)
    lfo.start(when)
    osc.stop(when + dur + 0.8)
    lfo.stop(when + dur + 0.8)
    this.voices.push(env)
    if (this.voices.length > 16) this.voices.shift()
  }
}

export const music = new Music()
