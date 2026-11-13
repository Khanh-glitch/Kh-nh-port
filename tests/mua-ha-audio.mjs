// Exercise real Music.start/update/stop with a deterministic media element.
// No browser autoplay policy or real decoding is simulated here.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const ts = require('../source/node_modules/typescript')
const pending = []
globalThis.window = { setTimeout: fn => (pending.push(fn), pending.length), setInterval: () => 1, clearInterval: () => {} }
const node = () => ({ gain: { value: 0, setTargetAtTime() {}, cancelScheduledValues() {} }, frequency: {}, Q: {}, connect() { return this }, disconnect() {}, start() {}, getByteFrequencyData() {} })
const ctx = { currentTime: 50, state: 'running', createGain: node, createAnalyser: node, createMediaElementSource: node }
globalThis.__testAudio = { prepared: false, ctx, prepare() { this.prepared = true }, master: node(), reverbSend: node() }
globalThis.__testRt = { rain: 0 }
globalThis.__testTracks = { 'mua-ha': { highlight: { start: 114, dur: 66 }, audioSrc: './reality/mua-ha-thu-18.mp3' } }
globalThis.__testProbe = async el => el.readyState >= 1
let element
class FakeAudio {
  constructor() { element = this; this.readyState = 1; this.duration = 284.6; this.currentTime = 0; this.events = new Map(); this.paused = true }
  addEventListener(name, fn) { this.events.set(name, fn) }
  play() { this.paused = false; return Promise.resolve() }
  pause() { this.paused = true }
}
globalThis.Audio = FakeAudio
let source = readFileSync('source/src/reality/music.ts', 'utf8')
let js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
js = js.replace("import { audio } from '../audio';", 'const audio = globalThis.__testAudio;')
  .replace("import { rt } from './state';", 'const rt = globalThis.__testRt;')
  .replace("import { TRACKS, probePlayable } from './tracks';", 'const TRACKS = globalThis.__testTracks, probePlayable = globalThis.__testProbe;')
assert.ok(!js.includes('import {'), 'all test imports must be substituted')
const { music } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))
await music.start('mua-ha', 0.35)
assert.equal(element.currentTime, 114, 'seek on the complete recording')
assert.equal(music.demo, false)
assert.ok(Math.abs(music.dur - 170.6) < 0.01, 'remaining duration comes from media metadata')
pending.shift()()
await Promise.resolve()
assert.equal(element.paused, false)
element.currentTime = 200
music.update(0.016)
assert.ok(Math.abs(music.elapsed - 86) < 0.01, 'progress follows media time')
assert.equal(music.ended, false, 'not cut off by the demo duration')
element.events.get('ended')()
assert.equal(music.ended, true, 'actual ended event ends the experience')
music.stop(0)
for (const cb of pending.splice(0)) cb()
assert.equal(element.paused, true)
console.log('MUA_HA_AUDIO_BEHAVIOR_PASS')
