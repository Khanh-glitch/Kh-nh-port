import * as THREE from 'three'
import { useStore } from './store'

const pianoFiles = import.meta.glob('./assets/piano/*.mp3', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

const NOTE_OFFSET: Record<string, number> = { C: 0, Ds: 3, Fs: 6, A: 9 }

export interface Bus {
  id: string
  input: GainNode
  filter: BiquadFilterNode
  panner: PannerNode
  out: GainNode
  pos: THREE.Vector3
  maxDist: number
  dist: number
}

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12)

class AudioEngine {
  ctx!: AudioContext
  prepared = false
  started = false
  master!: GainNode
  sfx!: GainNode
  reverb!: ConvolverNode
  reverbSend!: GainNode
  noise!: AudioBuffer
  buses = new Map<string, Bus>()
  samples: { midi: number; buf: AudioBuffer }[] = []
  pianoReady = false
  kicks: number[] = []
  get bpm() {
    return this.beat.bpm
  }
  private ambientStarted = false

  // ---- beat / score ----
  private beat = { on: false, bus: null as Bus | null, step: 0, next: 0, bpm: 124, scene: 0, timer: 0 }
  private score = { on: false, bus: null as Bus | null, timer: 0, chord: 0, nextChord: 0, step: 0, nextStep: 0 }

  prepare() {
    if (this.prepared) return
    this.prepared = true
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    this.ctx = new AC({ latencyHint: 'interactive' })
    const ctx = this.ctx

    this.master = ctx.createGain()
    this.master.gain.value = 0.9
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -14
    comp.knee.value = 18
    comp.ratio.value = 4
    comp.attack.value = 0.01
    comp.release.value = 0.25
    this.master.connect(comp).connect(ctx.destination)

    this.sfx = ctx.createGain()
    this.sfx.gain.value = 0.8
    this.sfx.connect(this.master)

    this.reverb = ctx.createConvolver()
    this.reverb.buffer = this.makeIR(3.8, 2.4)
    const rg = ctx.createGain()
    rg.gain.value = 0.6
    this.reverb.connect(rg).connect(this.master)
    this.reverbSend = ctx.createGain()
    this.reverbSend.gain.value = 1
    this.reverbSend.connect(this.reverb)
    this.sfx.connect(this.reverbSend)

    // noise buffer
    const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const d = nb.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    this.noise = nb

    void this.loadPiano()
  }

  private makeIR(seconds: number, decay: number) {
    const ctx = this.ctx
    const len = Math.floor(ctx.sampleRate * seconds)
    const buf = ctx.createBuffer(2, len, ctx.sampleRate)
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch)
      let lp = 0
      for (let i = 0; i < len; i++) {
        const t = i / len
        const k = 0.06 + 0.9 * Math.pow(1 - t, 2)
        lp += ((Math.random() * 2 - 1) - lp) * k
        data[i] = lp * Math.pow(1 - t, decay) * (i < 400 ? i / 400 : 1)
      }
    }
    return buf
  }

  private async loadPiano() {
    const entries = Object.entries(pianoFiles)
    let done = 0
    const store = useStore.getState()
    await Promise.all(
      entries.map(async ([path, url]) => {
        try {
          const m = path.match(/\/([A-Za-z]+)(\d)\.mp3$/)
          if (!m) return
          const midi = 12 * (parseInt(m[2]) + 1) + NOTE_OFFSET[m[1]]
          const res = await fetch(url)
          const arr = await res.arrayBuffer()
          const buf = await this.ctx.decodeAudioData(arr)
          this.samples.push({ midi, buf })
        } catch (e) {
          console.warn('piano sample failed', path, e)
        } finally {
          done++
          store.setLoading(done / entries.length)
        }
      }),
    )
    this.samples.sort((a, b) => a.midi - b.midi)
    this.pianoReady = this.samples.length > 0
    useStore.getState().setReady()
  }

  async start() {
    this.prepare()
    if (this.ctx.state !== 'running') {
      try {
        await this.ctx.resume()
      } catch {
        /* ignore */
      }
    }
    if (this.started) return
    this.started = true
    this.startAmbient()
  }

  setMuted(m: boolean) {
    if (!this.prepared) return
    this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.08)
  }

  // ---------- Nguồn âm không gian ----------
  createBus(id: string, pos: THREE.Vector3, opts: { ref?: number; rolloff?: number; maxDist?: number; reverb?: number; gain?: number } = {}) {
    this.prepare()
    const existing = this.buses.get(id)
    if (existing) {
      existing.pos.copy(pos)
      this.applyPos(existing)
      return existing
    }
    const ctx = this.ctx
    const input = ctx.createGain()
    input.gain.value = opts.gain ?? 1
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 18000
    filter.Q.value = 0.3
    const panner = ctx.createPanner()
    panner.panningModel = 'HRTF'
    panner.distanceModel = 'inverse'
    panner.refDistance = opts.ref ?? 5
    panner.rolloffFactor = opts.rolloff ?? 1.15
    panner.maxDistance = 10000
    const out = ctx.createGain()
    input.connect(filter).connect(panner).connect(out).connect(this.master)
    const send = ctx.createGain()
    send.gain.value = opts.reverb ?? 0.35
    panner.connect(send).connect(this.reverbSend)
    const bus: Bus = { id, input, filter, panner, out, pos: pos.clone(), maxDist: opts.maxDist ?? 140, dist: 999 }
    this.applyPos(bus)
    this.buses.set(id, bus)
    return bus
  }

  private applyPos(bus: Bus) {
    const p = bus.panner
    if (p.positionX) {
      p.positionX.value = bus.pos.x
      p.positionY.value = bus.pos.y
      p.positionZ.value = bus.pos.z
    } else {
      ;(p as unknown as { setPosition: (x: number, y: number, z: number) => void }).setPosition(bus.pos.x, bus.pos.y, bus.pos.z)
    }
  }

  private fwd = new THREE.Vector3()
  update(camera: THREE.Camera) {
    if (!this.started) return
    const l = this.ctx.listener
    const p = camera.position
    camera.getWorldDirection(this.fwd)
    if (l.positionX) {
      l.positionX.value = p.x
      l.positionY.value = p.y
      l.positionZ.value = p.z
      l.forwardX.value = this.fwd.x
      l.forwardY.value = this.fwd.y
      l.forwardZ.value = this.fwd.z
      l.upX.value = 0
      l.upY.value = 1
      l.upZ.value = 0
    } else {
      const ll = l as unknown as {
        setPosition: (x: number, y: number, z: number) => void
        setOrientation: (a: number, b: number, c: number, d: number, e: number, f: number) => void
      }
      ll.setPosition(p.x, p.y, p.z)
      ll.setOrientation(this.fwd.x, this.fwd.y, this.fwd.z, 0, 1, 0)
    }
    const now = this.ctx.currentTime
    this.buses.forEach((b) => {
      b.dist = b.pos.distanceTo(p)
      const f = THREE.MathUtils.clamp(20000 * Math.exp(-b.dist / 60), 900, 20000)
      b.filter.frequency.setTargetAtTime(f, now, 0.12)
      const fade = 1 - THREE.MathUtils.smoothstep(b.dist, b.maxDist * 0.65, b.maxDist)
      b.out.gain.setTargetAtTime(fade, now, 0.15)
    })
  }

  // ---------- Primitive tạo âm ----------
  tone(dest: AudioNode, type: OscillatorType, f0: number, f1: number, dur: number, vol: number, when = this.ctx.currentTime, attack = 0.005) {
    const ctx = this.ctx
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = type
    o.frequency.setValueAtTime(f0, when)
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), when + dur)
    g.gain.setValueAtTime(0.0001, when)
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), when + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
    o.connect(g).connect(dest)
    o.start(when)
    o.stop(when + dur + 0.05)
  }

  noiseBurst(dest: AudioNode, dur: number, ftype: BiquadFilterType, freq: number, q: number, vol: number, when = this.ctx.currentTime, freqEnd?: number) {
    const ctx = this.ctx
    const s = ctx.createBufferSource()
    s.buffer = this.noise
    const f = ctx.createBiquadFilter()
    f.type = ftype
    f.frequency.setValueAtTime(freq, when)
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, when + dur)
    f.Q.value = q
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, when)
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), when + Math.min(0.01, dur / 3))
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
    s.connect(f).connect(g).connect(dest)
    s.start(when, rand(0, 1.5))
    s.stop(when + dur + 0.05)
  }

  // ---------- Piano ----------
  playPiano(bus: Bus, midi: number, vel: number, when: number, dur: number) {
    if (!this.started) return
    // Original ZIP has no piano MP3 assets; the single-file HTML already
    // provides this physically spatialized, synthesized fallback.
    if (!this.pianoReady) {
      const whenSafe = Math.max(this.ctx.currentTime, when ?? this.ctx.currentTime)
      const freq = 440 * Math.pow(2, (midi - 69) / 12)
      const ctx = this.ctx
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.0001, whenSafe)
      gain.gain.exponentialRampToValueAtTime(Math.max(0.001, (vel ?? 0.55) * 0.24), whenSafe + 0.012)
      gain.gain.exponentialRampToValueAtTime(0.0001, whenSafe + Math.max(0.35, dur ?? 0.9) * 1.7)
      gain.connect(bus.input)
      for (const [harmonic, amplitude] of [[1, 1], [2, 0.28], [3, 0.13]]) {
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.value = freq * harmonic
        const g = ctx.createGain()
        g.gain.value = amplitude
        osc.connect(g).connect(gain)
        osc.start(whenSafe)
        osc.stop(whenSafe + Math.max(0.45, dur ?? 0.9) * 1.75 + 0.04)
      }
      return
    }
    let best = this.samples[0]
    let bd = 999
    for (const s of this.samples) {
      const d = Math.abs(s.midi - midi)
      if (d < bd) {
        bd = d
        best = s
      }
    }
    const ctx = this.ctx
    const src = ctx.createBufferSource()
    src.buffer = best.buf
    src.playbackRate.value = Math.pow(2, (midi - best.midi) / 12)
    const g = ctx.createGain()
    const v = Math.pow(THREE.MathUtils.clamp(vel, 0.05, 1), 1.4)
    g.gain.setValueAtTime(v * 1.5, when)
    const rel = when + Math.max(0.2, dur)
    g.gain.setValueAtTime(v * 1.5, rel)
    g.gain.setTargetAtTime(0, rel, 0.35)
    src.connect(g).connect(bus.input)
    src.start(when)
    src.stop(rel + 2.5)
  }

  // ---------- Ambient vũ trụ ----------
  private startAmbient() {
    if (this.ambientStarted) return
    this.ambientStarted = true
    const ctx = this.ctx
    const bed = ctx.createGain()
    bed.gain.value = 0
    bed.gain.setTargetAtTime(0.5, ctx.currentTime, 2.5)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 700
    const lfoF = ctx.createOscillator()
    lfoF.frequency.value = 0.04
    const lfoFG = ctx.createGain()
    lfoFG.gain.value = 320
    lfoF.connect(lfoFG).connect(lp.frequency)
    lfoF.start()
    lp.connect(bed)
    bed.connect(this.master)
    const send = ctx.createGain()
    send.gain.value = 0.7
    bed.connect(send).connect(this.reverbSend)

    const freqs = [55, 82.41, 110, 164.81, 220, 277.18]
    freqs.forEach((f, i) => {
      const o = ctx.createOscillator()
      o.type = i % 2 ? 'sine' : 'triangle'
      o.frequency.value = f
      o.detune.value = rand(-8, 8)
      const g = ctx.createGain()
      g.gain.value = 0.07
      const lfo = ctx.createOscillator()
      lfo.frequency.value = rand(0.03, 0.09)
      const lg = ctx.createGain()
      lg.gain.value = 0.05
      lfo.connect(lg).connect(g.gain)
      lfo.start()
      o.connect(g).connect(lp)
      o.start()
    })
    // gió vũ trụ
    const ns = ctx.createBufferSource()
    ns.buffer = this.noise
    ns.loop = true
    const nf = ctx.createBiquadFilter()
    nf.type = 'lowpass'
    nf.frequency.value = 260
    const ng = ctx.createGain()
    ng.gain.value = 0.12
    ns.connect(nf).connect(ng).connect(bed)
    ns.start()

    // chuông pha lê ngẫu nhiên
    const scale = [74, 76, 78, 81, 83, 86, 88, 90, 93]
    const bell = () => {
      if (ctx.state === 'running') {
        const m = scale[Math.floor(Math.random() * scale.length)]
        const f = mtof(m)
        const g = ctx.createGain()
        g.gain.value = 0.05
        g.connect(this.master)
        const sd = ctx.createGain()
        sd.gain.value = 1.4
        g.connect(sd).connect(this.reverbSend)
        this.tone(g, 'sine', f, f, 4.5, 0.6, ctx.currentTime, 0.02)
        this.tone(g, 'sine', f * 2.76, f * 2.76, 2.2, 0.15, ctx.currentTime, 0.02)
      }
      window.setTimeout(bell, rand(4500, 11000))
    }
    window.setTimeout(bell, 3000)
  }

  // ---------- SFX ----------
  step() {
    if (!this.started) return
    this.noiseBurst(this.sfx, 0.08, 'bandpass', rand(200, 300), 1.1, 0.05)
    this.tone(this.sfx, 'sine', 95, 48, 0.1, 0.07)
  }
  uiClick() {
    if (!this.started) return
    this.tone(this.sfx, 'sine', 1200, 1800, 0.07, 0.07)
  }
  uiOpen() {
    if (!this.started) return
    const t = this.ctx.currentTime
    this.tone(this.sfx, 'sine', 660, 660, 0.4, 0.07, t)
    this.tone(this.sfx, 'sine', 990, 990, 0.5, 0.06, t + 0.07)
    this.tone(this.sfx, 'sine', 1320, 1320, 0.6, 0.05, t + 0.14)
  }
  jump() {
    if (!this.started) return
    this.tone(this.sfx, 'sine', 180, 420, 0.25, 0.05)
  }
  land() {
    if (!this.started) return
    this.noiseBurst(this.sfx, 0.14, 'lowpass', 500, 0.8, 0.12)
    this.tone(this.sfx, 'sine', 80, 40, 0.18, 0.12)
  }
  cubeClick(bus: Bus, pitch = 1) {
    if (!this.started) return
    this.noiseBurst(bus.input, 0.045, 'bandpass', 2600 * pitch, 2, 0.35)
    this.tone(bus.input, 'triangle', 520 * pitch, 380 * pitch, 0.06, 0.18)
  }
  cubeWin(bus: Bus) {
    if (!this.started) return
    const t = this.ctx.currentTime
    ;[72, 76, 79, 84, 88].forEach((m, i) => this.tone(bus.input, 'sine', mtof(m), mtof(m), 1.6, 0.18, t + i * 0.08))
  }
  orbCharge(bus: Bus) {
    if (!this.started) return
    const t = this.ctx.currentTime
    this.tone(bus.input, 'sawtooth', 60, 800, 1.1, 0.25, t, 0.4)
    this.noiseBurst(bus.input, 1.1, 'bandpass', 300, 2, 0.3, t, 5000)
    this.tone(bus.input, 'sine', 55, 30, 2.2, 0.8, t + 1.05)
    this.noiseBurst(bus.input, 1.8, 'lowpass', 900, 0.6, 0.7, t + 1.05, 80)
    for (let i = 0; i < 6; i++) this.zap(bus, t + 1.1 + i * 0.12)
  }
  zap(bus: Bus, when = this.ctx.currentTime) {
    if (!this.started) return
    this.tone(bus.input, 'sawtooth', rand(1500, 3200), rand(60, 200), rand(0.08, 0.2), 0.12, when)
    this.noiseBurst(bus.input, 0.1, 'highpass', 3500, 0.7, 0.2, when)
  }
  orbHum(bus: Bus) {
    if (!this.started) return
    const ctx = this.ctx
    ;[48, 72.1, 96.3].forEach((f, i) => {
      const o = ctx.createOscillator()
      o.type = i === 0 ? 'sine' : 'triangle'
      o.frequency.value = f
      const g = ctx.createGain()
      g.gain.value = i === 0 ? 0.5 : 0.18
      const lfo = ctx.createOscillator()
      lfo.frequency.value = 0.2 + i * 0.13
      const lg = ctx.createGain()
      lg.gain.value = 0.12
      lfo.connect(lg).connect(g.gain)
      lfo.start()
      o.connect(g).connect(bus.input)
      o.start()
    })
  }
  servo(bus: Bus, dur = 0.8) {
    if (!this.started) return
    const t = this.ctx.currentTime
    const f = ctx_rand(this)
    this.tone(bus.input, 'sawtooth', f, f * 1.8, dur, 0.18, t, 0.1)
    this.noiseBurst(bus.input, dur, 'bandpass', 900, 3, 0.18, t, 1800)
    this.tone(bus.input, 'square', f / 2, f, dur * 0.8, 0.07, t, 0.1)
  }
  robotBoom(bus: Bus) {
    if (!this.started) return
    const t = this.ctx.currentTime
    this.tone(bus.input, 'sine', 90, 35, 0.9, 0.8, t)
    this.noiseBurst(bus.input, 0.5, 'lowpass', 600, 0.7, 0.5, t, 80)
  }
  ping(bus: Bus) {
    if (!this.started) return
    const t = this.ctx.currentTime
    ;[0, 0.28, 0.56].forEach((d, i) => {
      this.tone(bus.input, 'sine', 880 * (i + 1) * 0.75, 880 * (i + 1) * 0.75, 2.2, 0.3 / (i + 1), t + d)
      this.tone(bus.input, 'sine', 1320, 1320, 1.6, 0.12, t + d)
    })
  }
  confetti(bus: Bus) {
    if (!this.started) return
    const t = this.ctx.currentTime
    this.noiseBurst(bus.input, 0.12, 'lowpass', 1200, 0.7, 0.9, t, 200)
    this.noiseBurst(bus.input, 0.9, 'highpass', 4000, 0.5, 0.25, t + 0.05)
  }
  stageHit(bus: Bus) {
    if (!this.started) return
    const t = this.ctx.currentTime
    this.tone(bus.input, 'sine', 200, 40, 0.5, 0.7, t)
    this.noiseBurst(bus.input, 0.4, 'highpass', 6000, 0.6, 0.3, t)
  }

  speak(text: string) {
    try {
      const synth = window.speechSynthesis
      if (!synth) return
      synth.cancel()
      const u = new SpeechSynthesisUtterance(text)
      const voices = synth.getVoices()
      const vi = voices.find((v) => v.lang.toLowerCase().startsWith('vi'))
      if (vi) {
        u.voice = vi
        u.lang = vi.lang
      } else u.lang = 'vi-VN'
      u.pitch = 0.35
      u.rate = 0.88
      u.volume = 0.8
      synth.speak(u)
    } catch {
      /* ignore */
    }
  }

  // ---------- Beat sân khấu ----------
  isBeatOn() {
    return this.beat.on
  }
  startBeat(bus: Bus, scene: number) {
    if (!this.started) return
    const b = this.beat
    b.scene = scene
    b.bus = bus
    if (b.on) return
    b.on = true
    b.step = 0
    b.next = this.ctx.currentTime + 0.1
    b.timer = window.setInterval(() => this.beatTick(), 25)
  }
  setBeatScene(scene: number) {
    this.beat.scene = scene
    this.beat.bpm = [124, 112, 138, 100][scene] ?? 124
  }
  stopBeat() {
    this.beat.on = false
    window.clearInterval(this.beat.timer)
  }
  private beatTick() {
    const b = this.beat
    if (!b.on || !b.bus) return
    while (b.next < this.ctx.currentTime + 0.12) {
      this.beatStep(b.step, b.next, b.bus, b.scene)
      b.next += 60 / b.bpm / 4
      b.step = (b.step + 1) % 16
    }
  }
  private beatStep(s: number, t: number, bus: Bus, scene: number) {
    const dest = bus.input
    if (s % 4 === 0) {
      this.kicks.push(t)
      if (this.kicks.length > 6) this.kicks.shift()
      this.tone(dest, 'sine', 160, 42, 0.32, 0.9, t, 0.002)
      this.noiseBurst(dest, 0.02, 'lowpass', 3000, 0.5, 0.35, t)
    }
    if (s % 4 === 2) this.noiseBurst(dest, 0.06, 'highpass', 7500, 0.6, 0.22, t)
    if (s % 2 === 1) this.noiseBurst(dest, 0.025, 'highpass', 9000, 0.6, 0.08, t)
    if (s === 4 || s === 12) this.noiseBurst(dest, 0.16, 'bandpass', 1500, 0.9, 0.5, t)
    const root = [55, 61.74, 49, 65.41][scene] ?? 55
    const bassPat = [0, -1, 12, -1, 7, 0, -1, 10, 0, -1, 12, -1, 5, 0, 7, -1]
    const n = bassPat[s]
    if (n >= 0 && s % 4 !== 0) {
      const f = root * Math.pow(2, n / 12)
      this.tone(dest, 'sawtooth', f, f, 0.2, 0.28, t, 0.004)
    }
    const arp = [0, 3, 7, 10, 12, 10, 7, 3]
    if (s % 2 === 0) {
      const f = root * 4 * Math.pow(2, arp[(s / 2) % 8] / 12)
      this.tone(dest, 'square', f, f, 0.12, 0.07, t, 0.003)
    }
  }

  // ---------- Nhạc phim rạp ----------
  startScore(bus: Bus) {
    if (!this.started || this.score.on) return
    const sc = this.score
    sc.on = true
    sc.bus = bus
    sc.nextChord = this.ctx.currentTime + 0.2
    sc.nextStep = this.ctx.currentTime + 0.2
    sc.timer = window.setInterval(() => this.scoreTick(), 50)
  }
  private scoreTick() {
    const sc = this.score
    if (!sc.on || !sc.bus) return
    const chords = [
      [57, 60, 64, 67],
      [53, 57, 60, 64],
      [48, 55, 60, 64],
      [55, 59, 62, 66],
    ]
    const now = this.ctx.currentTime
    const dest = sc.bus.input
    while (sc.nextChord < now + 0.3) {
      const c = chords[sc.chord % chords.length]
      c.forEach((m) => {
        const f = mtof(m)
        const t = sc.nextChord
        ;[-7, 7].forEach((det) => {
          const o = this.ctx.createOscillator()
          o.type = 'sawtooth'
          o.frequency.value = f
          o.detune.value = det
          const lp = this.ctx.createBiquadFilter()
          lp.type = 'lowpass'
          lp.frequency.value = 900
          const g = this.ctx.createGain()
          g.gain.setValueAtTime(0.0001, t)
          g.gain.linearRampToValueAtTime(0.045, t + 2)
          g.gain.linearRampToValueAtTime(0.0001, t + 7.5)
          o.connect(lp).connect(g).connect(dest)
          o.start(t)
          o.stop(t + 7.6)
        })
      })
      sc.chord++
      sc.nextChord += 6
    }
    while (sc.nextStep < now + 0.3) {
      const c = chords[Math.max(0, sc.chord - 1) % chords.length]
      const m = c[sc.step % c.length] + 24
      this.tone(dest, 'triangle', mtof(m), mtof(m), 0.8, 0.12, sc.nextStep, 0.01)
      sc.step++
      sc.nextStep += 0.75
    }
  }
}

function ctx_rand(a: AudioEngine) {
  void a
  return rand(90, 150)
}

export const audio = new AudioEngine()
