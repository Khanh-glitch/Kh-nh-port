import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { FONT, canvasTex } from '../gfx'
import { Hit } from './Hit'
import { isFacing } from './common'
import { EXHIBITS } from '../layout'
import { showById, showElapsed, useShow } from '../stage/showState'
import {
  MeshBinBuilder,
  aeroRibProfile,
  bevelBox,
  disposeBinGeos,
  filletPoly2D,
  hexBoltGeo,
  shapeFromPoints,
  extrudeShape,
  strutGeo,
  sweepRMF,
  xf,
} from './arch/geomBuilder'
import { getArchMaterials } from './arch/materials'

export interface FohSceneDef {
  name: string
  colors: string[]
}

export interface FohLiveState {
  scene: number
  beatOn: boolean
  kick: number
  press: number[]
}

export interface FohProps {
  scenes: FohSceneDef[]
  liveState: FohLiveState
  onSelectScene: (i: number) => void
  onToggleBeat: () => void
  onFire: () => void
}

const FADER_COUNT = 24
const ex = EXHIBITS.stage

// ---------------------------------------------------------------------------
// Static Industrial FOH Structure (Deck, 3-Bay Wrap Console, Racks, Canopy, Monitors)
// All coordinates are local to the FOH group mounted at [0, 0, 12] in Stage space.
// Visitor stands at +Z looking toward -Z (Main Stage).
// ---------------------------------------------------------------------------
export function buildFohArchitecture() {
  const b = new MeshBinBuilder()

  // 1. Raised Modular Touring Deck (7.8m x 3.1m, stepped riser y=0..0.16)
  b.add('anodizedSlate', xf(bevelBox(7.9, 0.12, 3.2, 0.14, 0.025), { pos: [0, 0.06, 0.35] }), 0.5)
  b.add('rubberDeck', xf(bevelBox(7.55, 0.05, 2.86, 0.1, 0.012), { pos: [0, 0.145, 0.35] }), 0.75)
  // Front/rear chamfered aluminum kick-plates & step ramps
  b.add('machinedAlloy', xf(bevelBox(7.7, 0.04, 0.14, 0.015, 0.008), { pos: [0, 0.14, 1.88] }), 1.0)
  b.add('machinedAlloy', xf(bevelBox(7.7, 0.04, 0.14, 0.015, 0.008), { pos: [0, 0.14, -1.18] }), 1.0)
  // Heavy yellow/slate stage-snake cable bridge running from FOH toward Main Stage (-Z)
  b.add('anodizedSlate', xf(bevelBox(0.76, 0.08, 7.6, 0.04, 0.018), { pos: [0, 0.04, -5.0] }), 0.6)
  for (const s of [-0.26, 0, 0.26]) {
    b.add('titaniumHull', xf(new THREE.CylinderGeometry(0.055, 0.055, 7.5, 10), { rot: [Math.PI / 2, 0, 0], pos: [s, 0.055, -5.0] }), 1.0)
  }
  for (let i = 0; i < 8; i++) {
    b.add('precisionBrass', xf(bevelBox(0.82, 0.03, 0.12, 0.01, 0.005), { pos: [0, 0.085, -1.6 - i * 0.96] }), 1.2)
  }

  // 2. Sculpted Console Side-Cheek Stanchions & Under-Desk 19" Touring Flight Racks
  const legProfile = shapeFromPoints(filletPoly2D([
    [-0.78, 0.0, 0.04],
    [0.52, 0.0, 0.04],
    [0.56, 0.66, 0.06],
    [0.74, 0.88, 0.06],
    [-0.66, 1.06, 0.08],
    [-0.84, 0.88, 0.06],
  ], 0.04, 4))

  for (const x of [-1.42, 1.42]) {
    const leg = extrudeShape(legProfile, 0.14, 0.018, 8, false)
    leg.rotateY(Math.PI / 2)
    leg.translate(x - 0.07, 0.16, 0.05)
    b.add('titaniumHull', leg, 0.75)
  }

  // Under-desk 19-inch touring flight-case equipment racks (Left & Right under wings)
  for (const s of [-1, 1]) {
    const rx = s * 2.15
    const rz = 0.15
    const ry = -s * 0.24
    // Rack chassis
    b.add('anodizedSlate', xf(bevelBox(1.22, 0.72, 0.78, 0.05, 0.018), { rot: [0, ry, 0], pos: [rx, 0.52, rz] }), 0.7)
    // Perforated vent & 4U amplifier / DSP rack units facing operator (+Z)
    for (let u = 0; u < 4; u++) {
      const uy = 0.28 + u * 0.155
      const ox = Math.sin(ry) * 0.39
      const oz = Math.cos(ry) * 0.39
      b.add('titaniumHull', xf(bevelBox(1.06, 0.13, 0.04, 0.01, 0.004), { rot: [0, ry, 0], pos: [rx + ox, uy, rz + oz] }), 1.2)
      b.add('perforatedGrille', xf(bevelBox(0.68, 0.08, 0.02, 0.008, 0.002), { rot: [0, ry, 0], pos: [rx + ox + Math.cos(ry) * (-0.08 * s), uy, rz + oz - Math.sin(ry) * (-0.08 * s)] }), 2.2)
    }
    // Wireless IEM / DMX antenna paddles at outer rear corners of racks
    b.add('carbonWeave', xf(bevelBox(0.24, 0.26, 0.025, 0.04, 0.006), { rot: [0, ry + s * 0.3, 0], pos: [s * 3.12, 1.38, -0.35] }), 1.2)
    b.add('machinedAlloy', strutGeo([s * 3.12, 0.92, -0.35], [s * 3.12, 1.26, -0.35], 0.018, 0.018, 8), 1.5)
  }

  // Center Console Bay (x = -1.45..+1.45, sleek low-profile top so ShowSelector & Pills stay 100% clear!)
  b.add('anodizedSlate', xf(bevelBox(2.96, 0.16, 1.28, 0.06, 0.02), { rot: [0.18, 0, 0], pos: [0, 1.0, 0.04] }), 0.7)
  b.add('carbonWeave', xf(bevelBox(2.74, 0.04, 1.06, 0.03, 0.008), { rot: [0.18, 0, 0], pos: [0, 1.085, 0.04] }), 1.2)
  // Padded leather ergonomic wrist bolster across center bay front edge
  b.add('cinemaLeather', xf(bevelBox(2.94, 0.095, 0.17, 0.04, 0.018), { rot: [0.18, 0, 0], pos: [0, 0.93, 0.66] }), 1.4)
  // Center recessed angled monitoring strip housing (peaking below y=1.32 so Pill at y=1.48 floats above cleanly!)
  b.add('titaniumHull', xf(bevelBox(2.68, 0.36, 0.11, 0.035, 0.014), { rot: [-0.42, 0, 0], pos: [0, 1.2, -0.44] }), 0.9)
  b.add('ceramicShell', xf(bevelBox(2.86, 0.14, 0.36, 0.05, 0.018), { pos: [0, 0.92, -0.58] }), 0.7)

  // Left Wing (Audio Mixing Console Bay) & Right Wing (Media Server / Show Control Bay)
  for (const s of [-1, 1]) {
    const wx = s * 2.28
    const wz = 0.24
    const wy = -s * 0.26
    const cosY = Math.cos(wy)
    const sinY = Math.sin(wy)
    const toWing = (lx: number, ly: number, lz: number): [number, number, number] => [
      wx + lx * cosY + lz * sinY,
      ly,
      wz - lx * sinY + lz * cosY,
    ]

    // Wing main chassis slab
    b.add('anodizedSlate', xf(bevelBox(1.88, 0.16, 1.22, 0.06, 0.02), { rot: [0.18, wy, 0], pos: toWing(0, 1.0, 0) }), 0.7)
    b.add('carbonWeave', xf(bevelBox(1.68, 0.04, 1.02, 0.03, 0.008), { rot: [0.18, wy, 0], pos: toWing(0, 1.085, 0) }), 1.2)
    // Ceramic outer end-cheek fairing
    b.add('ceramicShell', xf(bevelBox(0.14, 0.26, 1.32, 0.05, 0.018), { rot: [0.18, wy, 0], pos: toWing(s * 0.94, 1.04, 0) }), 0.8)
    // Leather palm rest
    b.add('cinemaLeather', xf(bevelBox(1.84, 0.09, 0.16, 0.038, 0.016), { rot: [0.18, wy, 0], pos: toWing(0, 0.92, 0.59) }), 1.4)
    // Angled widescreen production monitor bezel hood (peaking at y=1.58m — dramatic FOH bridge!)
    b.add('titaniumHull', xf(bevelBox(1.64, 0.68, 0.12, 0.04, 0.016), { rot: [-0.28, wy, 0], pos: toWing(0, 1.34, -0.44) }), 0.85)
    b.add('ceramicShell', xf(bevelBox(1.68, 0.08, 0.26, 0.025, 0.01), { rot: [0.05, wy, 0], pos: toWing(0, 1.66, -0.48) }), 0.85)
    // Rotary encoder & channel strip knobs + milled fader-slot tracks on each wing
    for (let k = 0; k < 6; k++) {
      const kx = -0.62 + k * 0.248
      b.add('machinedAlloy', xf(new THREE.CylinderGeometry(0.03, 0.034, 0.055, 14), { rot: [0.18, wy, 0], pos: toWing(kx, 1.13, -0.14) }), 2.0)
      b.add('precisionBrass', xf(new THREE.CylinderGeometry(0.022, 0.024, 0.048, 12), { rot: [0.18, wy, 0], pos: toWing(kx, 1.11, 0.02) }), 2.0)
    }
    for (let fi = 0; fi < 12; fi++) {
      const lx = -0.68 + (fi / 11) * 1.36
      b.add('matteBlack', xf(bevelBox(0.024, 0.012, 0.36, 0.004, 0.002), { rot: [0.18, wy, 0], pos: toWing(lx, 1.072, 0.21) }), 2.0)
    }
  }

  // Dual High-Precision Master Jog / Encoder Wheels & A/B T-Bar Crossfader on Center Bay
  for (const x of [-0.95, 0.95]) {
    b.add('machinedAlloy', xf(new THREE.CylinderGeometry(0.11, 0.12, 0.045, 24), { rot: [0.18, 0, 0], pos: [x, 1.13, -0.14] }), 1.8)
    b.add('anodizedSlate', xf(new THREE.CylinderGeometry(0.08, 0.085, 0.055, 20), { rot: [0.18, 0, 0], pos: [x, 1.14, -0.14] }), 1.8)
  }
  // Master T-Bar Crossfader
  b.add('anodizedSlate', xf(bevelBox(0.14, 0.03, 0.34, 0.012, 0.004), { rot: [0.18, 0, 0], pos: [0, 1.11, -0.1] }), 1.8)
  b.add('machinedAlloy', xf(new THREE.CylinderGeometry(0.016, 0.016, 0.14, 10), { rot: [-0.25, 0, 0], pos: [0, 1.18, -0.12] }), 2.0)
  b.add('ceramicShell', xf(bevelBox(0.24, 0.042, 0.055, 0.015, 0.008), { rot: [0.18, 0, 0], pos: [0, 1.24, -0.15] }), 1.8)

  // 3. Swept Cantilevered Open-Front Acoustic & Glare-Shield FOH Canopy Arch
  // Springs from two heavy flanking pylons at x = +/-3.55, z = 0.85 soaring cleanly to y = 3.65
  const archProfile = aeroRibProfile(0.24, 0.14, 0.36, 0.02)
  const canopyOuterProfile = aeroRibProfile(0.16, 0.09, 0.22, 0.015)

  for (const s of [-1, 1]) {
    // Swept C-cantilever main structural rib from rear deck up and forward over FOH desk
    const ribPts = [
      new THREE.Vector3(s * 3.55, 0.16, 1.38),
      new THREE.Vector3(s * 3.65, 1.55, 1.48),
      new THREE.Vector3(s * 3.42, 3.05, 1.18),
      new THREE.Vector3(s * 2.75, 3.62, 0.35),
      new THREE.Vector3(s * 1.45, 3.74, -0.12),
      new THREE.Vector3(0, 3.76, -0.22),
    ]
    b.add('anodizedSlate', sweepRMF(ribPts, archProfile, {
      steps: 28,
      up: new THREE.Vector3(0, 0, 1),
      scaleFn: (t) => [1.1 - t * 0.3, 1.15 - t * 0.35],
    }), 0.6)

    // Secondary ceramic cladding shell along outer pylon back
    const cladPts = ribPts.slice(0, 4).map((p, idx) =>
      p.clone().add(new THREE.Vector3(s * 0.14, idx * 0.04, 0.16)),
    )
    b.add('ceramicShell', sweepRMF(cladPts, canopyOuterProfile, {
      steps: 18,
      up: new THREE.Vector3(0, 0, 1),
      scaleFn: (t) => [1.05 - t * 0.35, 1.0 - t * 0.3],
    }), 0.6)

    // Floor anchor collar & bolts for canopy pylon
    b.add('titaniumHull', xf(bevelBox(0.56, 0.18, 0.68, 0.05, 0.018), { pos: [s * 3.55, 0.22, 1.38] }), 0.8)
    for (const dz of [-0.22, 0.22]) {
      b.add('machinedAlloy', xf(hexBoltGeo(0.032, 0.022), { pos: [s * 3.74, 0.31, 1.38 + dz] }), 2)
    }

    // Articulated Genelec-style FOH Near-Field Reference Studio Monitors (unified exact local matrix!)
    const mx = s * 3.16
    const my = 1.98
    const mz = 0.05
    // Sculpted vibration-damped pedestal stand rising cleanly from wing outer cheek
    b.add('anodizedSlate', strutGeo([s * 3.24, 1.05, 0.12], [mx, my - 0.28, mz], 0.042, 0.032, 10), 1.2)
    b.add('machinedAlloy', xf(new THREE.CylinderGeometry(0.11, 0.13, 0.05, 16), { pos: [s * 3.24, 1.08, 0.12] }), 1.6)
    const monMat = new THREE.Matrix4().compose(
      new THREE.Vector3(mx, my, mz),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0.14, -s * 0.48, 0, 'YXZ')),
      new THREE.Vector3(1, 1, 1),
    )
    const monBody = bevelBox(0.36, 0.54, 0.32, 0.075, 0.025)
    monBody.applyMatrix4(monMat)
    b.add('titaniumHull', monBody, 1.2)
    const woofer = new THREE.CylinderGeometry(0.115, 0.115, 0.024, 20)
    woofer.rotateX(Math.PI / 2)
    woofer.translate(0, -0.09, 0.155)
    woofer.applyMatrix4(monMat)
    b.add('perforatedGrille', woofer, 2.2)
    const tweeter = new THREE.TorusGeometry(0.055, 0.012, 8, 20)
    tweeter.translate(0, 0.12, 0.16)
    tweeter.applyMatrix4(monMat)
    b.add('machinedAlloy', tweeter, 2.0)

    // Gooseneck FOH task lamps arching over left/right wings
    const lampPts = [
      new THREE.Vector3(s * 1.44, 1.22, -0.45),
      new THREE.Vector3(s * 1.44, 1.62, -0.42),
      new THREE.Vector3(s * 1.36, 1.72, -0.15),
    ]
    b.add('machinedAlloy', sweepRMF(lampPts, filletPoly2D([[-0.014, -0.014], [0.014, -0.014], [0.014, 0.014], [-0.014, 0.014]], 0.006, 2), { steps: 14 }), 2.0)
    b.add('anodizedSlate', xf(bevelBox(0.14, 0.045, 0.08, 0.012, 0.005), { rot: [0.35, 0, 0], pos: [s * 1.34, 1.71, -0.12] }), 1.8)
  }

  // Overhead Canopy Acoustic Slats & Recessed Longitudinal Spar (tucked snugly under canopy arch!)
  b.add('titaniumHull', xf(bevelBox(5.5, 0.11, 0.22, 0.035, 0.012), { pos: [0, 3.56, 0.72] }), 0.7)
  for (let i = -7; i <= 7; i++) {
    const x = i * 0.35
    const archDrop = (x * x) * 0.024
    b.add('carbonWeave', xf(bevelBox(0.075, 0.13, 1.05, 0.015, 0.006), { pos: [x, 3.58 - archDrop, 0.28] }), 1.2)
  }

  return b.build()
}

// ---------------------------------------------------------------------------
// Live High-DPI Multi-Screen FOH Telemetry Atlas (1536 x 420 -> 3 screens)
// Left [0..512]: 24-ch Audio VU Meter Bridge + Parametric EQ + Master L/R
// Center [512..1024]: Live Stage DMX Moving-Head Pre-Viz + Cue Stack + SMPTE
// Right [1024..1536]: Media Server LED Output + Run-of-Show Timeline + Intercom
// ---------------------------------------------------------------------------
function drawFohAtlas(
  ctx: CanvasRenderingContext2D,
  t: number,
  scenes: FohSceneDef[],
  live: FohLiveState,
  activeShowTitle: string | null,
  activeShowAccent: string | null,
  activeChapters: string[] | null,
  showEl: number,
) {
  const W = 1536
  const H = 420
  const sc = scenes[live.scene] ?? scenes[0]
  const accent = activeShowAccent ?? sc.colors[0]
  const accent2 = sc.colors[1] ?? '#2bd9ff'

  ctx.fillStyle = '#060911'
  ctx.fillRect(0, 0, W, H)

  // Common panel border helper
  const panelFrame = (x0: number, title: string, badge: string, col: string) => {
    ctx.fillStyle = '#090e1a'
    ctx.fillRect(x0 + 8, 8, 496, H - 16)
    ctx.strokeStyle = 'rgba(130, 175, 255, 0.24)'
    ctx.lineWidth = 2
    ctx.strokeRect(x0 + 8, 8, 496, H - 16)
    ctx.fillStyle = 'rgba(255,255,255,0.05)'
    ctx.fillRect(x0 + 8, 8, 496, 40)
    ctx.fillStyle = col
    ctx.fillRect(x0 + 8, 8, 5, 40)
    ctx.textAlign = 'left'
    ctx.fillStyle = '#e8f1ff'
    ctx.font = `700 17px ${FONT}`
    ctx.fillText(title, x0 + 22, 34)
    ctx.textAlign = 'right'
    ctx.fillStyle = col
    ctx.font = `700 14px ${FONT}`
    ctx.fillText(badge, x0 + 492, 33)
  }

  // ==================== SCREEN 1: AUDIO MIXER / VU BRIDGE ====================
  panelFrame(0, 'FOH AUDIO · QUANTUM 338', live.beatOn || activeShowTitle ? '48 kHz · LIVE' : '48 kHz · STANDBY', '#2bd9ff')

  // 24-channel animated peak/RMS VU bars
  const energy = live.beatOn || activeShowTitle ? 0.92 : 0.34
  const chLabels = ['KCK', 'SNR', 'HAT', 'BAS', 'SYN', 'GTR', 'KEY', 'VOX', 'FX1', 'FX2', 'SUB', 'L-R']
  for (let i = 0; i < 24; i++) {
    const bx = 22 + i * 19.8
    const by = 66
    const bh = 186
    const wave = 0.5 + 0.5 * Math.sin(t * (3.2 + (i % 5) * 0.9) + i * 0.72)
    const bassBoost = i < 6 ? live.kick * 0.52 : live.kick * 0.22
    const lvl = Math.min(0.98, (0.16 + wave * 0.52 + bassBoost) * energy)

    ctx.fillStyle = '#0e1626'
    ctx.fillRect(bx, by, 14, bh)
    const segs = 16
    const lit = Math.round(lvl * segs)
    for (let s = 0; s < lit; s++) {
      const sy = by + bh - (s + 1) * (bh / segs) + 2
      ctx.fillStyle = s >= 14 ? '#ff385c' : s >= 11 ? '#ffd23d' : '#2bffb0'
      ctx.fillRect(bx + 1, sy, 12, bh / segs - 3)
    }
    if (i % 2 === 0) {
      ctx.textAlign = 'center'
      ctx.fillStyle = 'rgba(180,210,255,0.65)'
      ctx.font = `600 10px ${FONT}`
      ctx.fillText(chLabels[i >> 1] ?? '', bx + 7, by + bh + 16)
    }
  }

  // Parametric EQ curve plot along bottom of Screen 1
  const eqX = 22
  const eqY = 282
  const eqW = 468
  const eqH = 114
  ctx.fillStyle = '#050912'
  ctx.fillRect(eqX, eqY, eqW, eqH)
  ctx.strokeStyle = 'rgba(43,217,255,0.22)'
  ctx.strokeRect(eqX, eqY, eqW, eqH)
  ctx.beginPath()
  for (let x = 0; x <= eqW; x += 6) {
    const u = x / eqW
    const curve =
      Math.exp(-Math.pow((u - 0.16) * 8, 2)) * (0.34 + live.kick * 0.28) -
      Math.exp(-Math.pow((u - 0.44) * 9, 2)) * 0.18 +
      Math.exp(-Math.pow((u - 0.74) * 7, 2)) * 0.26 +
      Math.sin(u * 26 + t * 2.5) * 0.03 * energy
    const py = eqY + eqH * 0.58 - curve * eqH * 0.65
    if (x === 0) ctx.moveTo(eqX + x, py)
    else ctx.lineTo(eqX + x, py)
  }
  ctx.strokeStyle = '#38e1ff'
  ctx.lineWidth = 2.5
  ctx.stroke()
  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(155,220,255,0.75)'
  ctx.font = `600 12px ${FONT}`
  ctx.fillText('MASTER BUS EQ · L-ISA SPATIAL ARRAY · -0.8 dBFS PEAK', eqX + 10, eqY + 20)

  // ==================== SCREEN 2: LIGHTING / DMX PRE-VIZ ====================
  panelFrame(512, 'LIGHTING · GRANDMA3 DMX', activeShowTitle ? 'SHOWTIME LOCK' : `CUE 0${live.scene + 1} · ${sc.name}`, accent)

  // Live Stage Truss & 7 Moving-Head Beam Cone Pre-Viz Diagram
  const px = 532
  const py = 64
  const pw = 456
  const ph = 180
  ctx.fillStyle = '#040710'
  ctx.fillRect(px, py, pw, ph)
  ctx.strokeStyle = 'rgba(255,255,255,0.16)'
  ctx.strokeRect(px, py, pw, ph)
  // Stage truss bar
  ctx.strokeStyle = '#8b99b5'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(px + 28, py + 24)
  ctx.lineTo(px + pw - 28, py + 24)
  ctx.stroke()

  // 7 Fixture beams fanning dynamically
  for (let i = 0; i < 7; i++) {
    const fx = px + 56 + i * ((pw - 112) / 6)
    const sweep = Math.sin(t * (live.beatOn ? 1.4 : 0.6) + i * 0.9) * 62
    const c = sc.colors[i % sc.colors.length]
    const grad = ctx.createLinearGradient(fx, py + 24, fx + sweep, py + ph - 12)
    grad.addColorStop(0, c)
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = grad
    ctx.globalAlpha = 0.25 + live.kick * 0.4
    ctx.beginPath()
    ctx.moveTo(fx - 4, py + 24)
    ctx.lineTo(fx + 4, py + 24)
    ctx.lineTo(fx + sweep + 34, py + ph - 8)
    ctx.lineTo(fx + sweep - 34, py + ph - 8)
    ctx.closePath()
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(fx - 5, py + 20, 10, 8)
  }

  // Cue Stack / SMPTE Timecode Readout
  const tcSec = activeShowTitle ? showEl : t
  const mm = String(Math.floor(tcSec / 60) % 60).padStart(2, '0')
  const ss = String(Math.floor(tcSec) % 60).padStart(2, '0')
  const ff = String(Math.floor((tcSec * 30) % 30)).padStart(2, '0')
  ctx.fillStyle = '#0d1526'
  ctx.fillRect(532, 256, 456, 56)
  ctx.strokeStyle = accent
  ctx.lineWidth = 1.5
  ctx.strokeRect(532, 256, 456, 56)
  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(255,255,255,0.65)'
  ctx.font = `600 12px ${FONT}`
  ctx.fillText('SMPTE LTC TIMECODE', 546, 276)
  ctx.fillStyle = '#ffffff'
  ctx.font = `700 26px ${FONT}`
  ctx.fillText(`01:${mm}:${ss}:${ff}`, 546, 304)
  ctx.textAlign = 'right'
  ctx.fillStyle = accent
  ctx.font = `700 20px ${FONT}`
  ctx.fillText(activeShowTitle ? activeShowTitle.slice(0, 18) : `SCENE: ${sc.name}`, 974, 294)

  // 4 Scene Cue Tiles at bottom of Screen 2
  scenes.forEach((s, i) => {
    const cx = 532 + i * 116
    const active = !activeShowTitle && live.scene === i
    ctx.fillStyle = active ? s.colors[0] + '44' : '#0b1020'
    ctx.fillRect(cx, 326, 108, 68)
    ctx.strokeStyle = active ? s.colors[0] : 'rgba(255,255,255,0.18)'
    ctx.lineWidth = active ? 2.5 : 1
    ctx.strokeRect(cx, 326, 108, 68)
    ctx.textAlign = 'left'
    ctx.fillStyle = s.colors[0]
    ctx.font = `700 12px ${FONT}`
    ctx.fillText(`CUE 0${i + 1}`, cx + 10, 348)
    ctx.fillStyle = '#fff'
    ctx.font = `700 16px ${FONT}`
    ctx.fillText(s.name, cx + 10, 374)
  })

  // ==================== SCREEN 3: SHOW CONTROL / MEDIA SERVER ====================
  panelFrame(1024, 'MEDIA · RUN OF SHOW', 'DISGUISE GX3 · SYNC', accent2)

  // Run-of-Show Timeline Tracks
  const tracks = [
    { name: 'LED WALL', col: '#ff3dcb', blocks: [0.05, 0.38, 0.72] },
    { name: 'LX RIG', col: '#2bd9ff', blocks: [0.12, 0.46, 0.78] },
    { name: 'AUDIO PA', col: '#5dffb0', blocks: [0.02, 0.34, 0.66] },
    { name: 'SFX/PYRO', col: '#ffd23d', blocks: [0.24, 0.58, 0.85] },
  ]
  const tx = 1042
  const ty = 66
  const tw = 460
  const playhead = ((t * 0.08) % 1) * (tw - 88)

  tracks.forEach((tr, idx) => {
    const ry = ty + idx * 46
    ctx.fillStyle = '#0d1424'
    ctx.fillRect(tx, ry, tw, 38)
    ctx.textAlign = 'left'
    ctx.fillStyle = tr.col
    ctx.font = `700 12px ${FONT}`
    ctx.fillText(tr.name, tx + 8, ry + 24)
    tr.blocks.forEach((b0) => {
      const bx = tx + 88 + b0 * (tw - 110)
      ctx.fillStyle = tr.col + '40'
      ctx.fillRect(bx, ry + 6, 86, 26)
      ctx.strokeStyle = tr.col
      ctx.lineWidth = 1.5
      ctx.strokeRect(bx, ry + 6, 86, 26)
    })
  })
  // Playhead cursor
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(tx + 88 + playhead, ty - 4)
  ctx.lineTo(tx + 88 + playhead, ty + 184)
  ctx.stroke()

  // Show Chapters or Intercom Comms Status Grid
  const chapters = activeChapters ?? ['OPENING', 'BUILD', 'PEAK DROP', 'FINALE']
  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(190,220,255,0.72)'
  ctx.font = `600 12px ${FONT}`
  ctx.fillText('SHOW CUE CHAPTERS & CLEAR-COM INTERCOM', 1042, 276)
  chapters.slice(0, 4).forEach((ch, i) => {
    const cx = 1042 + i * 116
    const cur = Math.floor((t * 0.25) % 4) === i
    ctx.fillStyle = cur ? 'rgba(92,225,255,0.22)' : '#0b1222'
    ctx.fillRect(cx, 288, 108, 42)
    ctx.strokeStyle = cur ? '#5ce1ff' : 'rgba(255,255,255,0.16)'
    ctx.strokeRect(cx, 288, 108, 42)
    ctx.textAlign = 'center'
    ctx.fillStyle = cur ? '#ffffff' : 'rgba(255,255,255,0.7)'
    ctx.font = `700 12px ${FONT}`
    ctx.fillText(ch.slice(0, 11), cx + 54, 314)
  })

  // Intercom channel status lights (authentic live production roles!)
  const comms = ['DIR', 'STAGE MGR', 'LX OPS', 'FOH SND', 'STAGE WING']
  comms.forEach((cName, i) => {
    const cx = 1042 + i * 93
    const talking = Math.sin(t * 2.1 + i * 2.4) > 0.68
    ctx.fillStyle = talking ? 'rgba(93,255,176,0.25)' : '#0a101d'
    ctx.fillRect(cx, 344, 86, 48)
    ctx.strokeStyle = talking ? '#5dffb0' : 'rgba(130,170,220,0.25)'
    ctx.strokeRect(cx, 344, 86, 48)
    ctx.fillStyle = talking ? '#5dffb0' : '#4a6484'
    ctx.beginPath()
    ctx.arc(cx + 14, 368, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.textAlign = 'left'
    ctx.fillStyle = '#e6f2ff'
    ctx.font = `700 11px ${FONT}`
    ctx.fillText(cName, cx + 24, 372)
  })
}

export function FohStation({ scenes, liveState, onSelectScene, onToggleBeat, onFire }: FohProps) {
  const arch = useMemo(() => getArchMaterials(), [])
  const geos = useMemo(() => buildFohArchitecture(), [])

  // One full-resolution CPU atlas plus three independently cropped GPU textures.
  // Each monitor retains its original 512×420 source pixels. The older clone/repeat
  // path uploaded the *entire* 1536×420 atlas THREE times every 18Hz update;
  // cropping before upload saves bandwidth without lowering image resolution.
  const screens = useMemo(() => {
    const atlas = canvasTex(1536, 420, (ctx) => drawFohAtlas(ctx, 0, scenes, liveState, null, null, null, 0))
    const crops = [0, 1, 2].map((i) => {
      const crop = canvasTex(512, 420, (ctx) => {
        ctx.drawImage(atlas.canvas, i * 512, 0, 512, 420, 0, 0, 512, 420)
      })
      crop.tex.colorSpace = THREE.SRGBColorSpace
      return crop
    })
    return { atlas, crops, left: crops[0].tex, center: crops[1].tex, right: crops[2].tex }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 24 motorized backlit fader caps (12 left wing + 12 right wing) via InstancedMesh
  const faderCaps = useRef<THREE.InstancedMesh>(null)
  const faderPipes = useRef<THREE.InstancedMesh>(null)
  const padGroups = useRef<(THREE.Group | null)[]>([])
  const padMats = useMemo(
    () => scenes.map((s) => new THREE.MeshBasicMaterial({ color: new THREE.Color(s.colors[0]), toneMapped: false })),
    [scenes],
  )
  const playMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff3b5c'), toneMapped: false }), [])
  const boomMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd23d'), toneMapped: false }), [])
  const canopyTrimMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color('#2bd9ff').multiplyScalar(2.0), toneMapped: false }), [])

  const dummy = useMemo(() => new THREE.Object3D(), [])
  const tmpCol = useMemo(() => new THREE.Color(), [])
  const lastDraw = useRef(0)

  // Precompute local coordinates of 24 motorized fader tracks across left & right wing bays
  const faderSlots = useMemo(() => {
    const slots: { wx: number; wz: number; wy: number; lx: number; wing: number; idx: number }[] = []
    for (let wing = 0; wing < 2; wing++) {
      const s = wing === 0 ? -1 : 1
      const wx = s * 2.28
      const wz = 0.24
      const wy = -s * 0.26
      for (let i = 0; i < 12; i++) {
        const lx = -0.68 + (i / 11) * 1.36
        slots.push({ wx, wz, wy, lx, wing, idx: wing * 12 + i })
      }
    }
    return slots
  }, [])

  useEffect(() => {
    return () => {
      disposeBinGeos(geos)
      screens.atlas.tex.dispose()
      screens.left.dispose()
      screens.center.dispose()
      screens.right.dispose()
      padMats.forEach((m) => m.dispose())
      playMat.dispose()
      boomMat.dispose()
      canopyTrimMat.dispose()
    }
  }, [geos, screens, padMats, playMat, boomMat, canopyTrimMat])

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    const ss = useShow.getState()
    const activeShow = showById(ss.active)
    const showEl = activeShow ? showElapsed() : 0
    const sc = scenes[liveState.scene] ?? scenes[0]
    const accent = activeShow?.look.accent ?? sc.colors[0]
    const accent2 = activeShow?.look.colors[1] ?? sc.colors[1] ?? '#2bd9ff'

    // Update cue & transport pad feedback + physical key depression
    padMats.forEach((m, i) => {
      const active = !activeShow && liveState.scene === i
      m.color.set(scenes[i].colors[0]).multiplyScalar(active ? 2.8 + liveState.kick * 1.3 : 0.48)
    })
    playMat.color.set(liveState.beatOn ? '#2bffb0' : '#ff3b5c').multiplyScalar(liveState.beatOn ? 2.6 + liveState.kick * 0.8 : 0.95)
    boomMat.color.set('#ffd23d').multiplyScalar(1.0 + liveState.press[5] * 2.4)
    canopyTrimMat.color.set(accent).multiplyScalar(1.35 + liveState.kick * 0.9)

    for (let i = 0; i < 6; i++) {
      liveState.press[i] = Math.max(0, liveState.press[i] - dt * 4.2)
      const g = padGroups.current[i]
      if (g) g.position.y = 1.07 - 0.032 * liveState.press[i]
    }

    // Animate 24 motorized grandMA3-style backlit faders reacting smoothly to music/show
    const caps = faderCaps.current
    const pipes = faderPipes.current
    if (caps && pipes) {
      const activeAmp = liveState.beatOn || activeShow ? 1.0 : 0.32
      for (let i = 0; i < FADER_COUNT; i++) {
        const sl = faderSlots[i]
        const wave = 0.5 + 0.5 * Math.sin(t * (1.8 + (i % 5) * 0.45) + i * 0.65)
        const val = THREE.MathUtils.clamp(0.18 + wave * 0.55 * activeAmp + liveState.kick * (i % 3 === 0 ? 0.25 : 0.1), 0.05, 0.95)
        const lz = 0.38 - val * 0.34 // fader throw 34 cm along tilted wing deck
        const cosY = Math.cos(sl.wy)
        const sinY = Math.sin(sl.wy)
        const px = sl.wx + sl.lx * cosY + lz * sinY
        const pz = sl.wz - sl.lx * sinY + lz * cosY
        const py = 1.106 - lz * Math.sin(0.18) // exact sloped wing deck plane

        dummy.rotation.order = 'YXZ'
        dummy.position.set(px, py + 0.024, pz)
        dummy.rotation.set(0.18, sl.wy, 0)
        dummy.scale.set(1, 1, 1)
        dummy.updateMatrix()
        caps.setMatrixAt(i, dummy.matrix)

        // Glowing light-pipe beneath each fader slot
        const pipeZ = 0.21
        const ppx = sl.wx + sl.lx * cosY + pipeZ * sinY
        const ppz = sl.wz - sl.lx * sinY + pipeZ * cosY
        dummy.position.set(ppx, 1.106 - pipeZ * Math.sin(0.18) + 0.004, ppz)
        dummy.scale.set(1, 1, Math.max(0.15, val))
        dummy.updateMatrix()
        pipes.setMatrixAt(i, dummy.matrix)
        tmpCol.set(sl.wing === 0 ? accent2 : accent).multiplyScalar(0.9 + val * 1.8)
        pipes.setColorAt(i, tmpCol)
      }
      caps.instanceMatrix.needsUpdate = true
      pipes.instanceMatrix.needsUpdate = true
      if (pipes.instanceColor) pipes.instanceColor.needsUpdate = true
    }

    // Update live 3-screen FOH production atlas at 18 Hz when near stage
    if (t - lastDraw.current > 1 / 18 && isFacing(state.camera, ex.x, ex.z, 34)) {
      lastDraw.current = t
      drawFohAtlas(
        screens.atlas.ctx,
        t,
        scenes,
        liveState,
        activeShow?.title ?? null,
        activeShow?.look.accent ?? null,
        activeShow?.chapters ?? null,
        showEl,
      )
      screens.crops.forEach((crop, i) => {
        crop.ctx.clearRect(0, 0, 512, 420)
        crop.ctx.drawImage(screens.atlas.canvas, i * 512, 0, 512, 420, 0, 0, 512, 420)
        crop.tex.needsUpdate = true
      })
    }
  })

  const padX = [-0.72, -0.24, 0.24, 0.72]

  return (
    <group position={[0, 0, 12]}>
      {/* Merged High-Detail Touring Deck, 3-Bay Console, Flight Racks, Canopy Arch & Monitors */}
      {Object.entries(geos).map(([key, geo]) => (
        <mesh
          key={key}
          geometry={geo}
          material={arch[key as keyof typeof arch]}
          castShadow
          receiveShadow
        />
      ))}

      {/* Subtle Canopy Cove Edge Strip & Deck Step Guide Strips */}
      <mesh position={[0, 3.58, -0.22]} material={canopyTrimMat}>
        <boxGeometry args={[5.2, 0.025, 0.035]} />
      </mesh>
      <mesh position={[0, 0.175, 1.82]} material={canopyTrimMat}>
        <boxGeometry args={[7.4, 0.015, 0.025]} />
      </mesh>

      {/* Gooseneck Task Lamp Warm Optical Strips */}
      {[-1.34, 1.34].map((x) => (
        <mesh key={x} position={[x, 1.68, -0.12]} rotation={[0.35, 0, 0]}>
          <boxGeometry args={[0.11, 0.014, 0.05]} />
          <meshBasicMaterial color={new THREE.Color('#ffe2b8').multiplyScalar(3.2)} toneMapped={false} />
        </mesh>
      ))}

      {/* 3 Live High-DPI FOH Production Screens (exact nested Y->X bezel transforms) */}
      {/* Left Wing Screen: 24-ch Audio VU & EQ */}
      <group position={[-2.393, 1.34, -0.185]} rotation={[0, 0.26, 0]}>
        <group rotation={[-0.28, 0, 0]}>
          <mesh position={[0, 0, 0.066]}>
            <planeGeometry args={[1.52, 0.58]} />
            <meshBasicMaterial map={screens.left} toneMapped={false} />
          </mesh>
        </group>
      </group>
      {/* Center Low-Profile Command Strip: DMX Pre-Viz & SMPTE (clears ShowSelector/Pills completely) */}
      <group position={[0, 1.2, -0.44]} rotation={[-0.42, 0, 0]}>
        <mesh position={[0, 0, 0.062]}>
          <planeGeometry args={[2.54, 0.31]} />
          <meshBasicMaterial map={screens.center} toneMapped={false} />
        </mesh>
      </group>
      {/* Right Wing Screen: Disguise Media Server & Run-of-Show Timeline */}
      <group position={[2.393, 1.34, -0.185]} rotation={[0, -0.26, 0]}>
        <group rotation={[-0.28, 0, 0]}>
          <mesh position={[0, 0, 0.066]}>
            <planeGeometry args={[1.52, 0.58]} />
            <meshBasicMaterial map={screens.right} toneMapped={false} />
          </mesh>
        </group>
      </group>

      {/* 24 Animated Motorized Backlit Faders + RGB Light Pipes */}
      <instancedMesh ref={faderCaps} args={[undefined, undefined, FADER_COUNT]} frustumCulled={false}>
        <boxGeometry args={[0.045, 0.035, 0.08]} />
        <meshStandardMaterial color="#d4dce8" metalness={0.86} roughness={0.28} />
      </instancedMesh>
      <instancedMesh ref={faderPipes} args={[undefined, undefined, FADER_COUNT]} frustumCulled={false}>
        <boxGeometry args={[0.018, 0.008, 0.34]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>

      {/* Center Tactile Illuminated Cue Pads (NEON, SUNSET, STROBE, AURORA) */}
      {scenes.map((s, i) => (
        <group key={s.name} ref={(r) => { padGroups.current[i] = r }} position={[padX[i], 1.07, 0.34]} rotation={[0.18, 0, 0]}>
          <mesh material={arch.anodizedSlate} position={[0, -0.02, 0]}>
            <boxGeometry args={[0.42, 0.04, 0.34]} />
          </mesh>
          <mesh material={padMats[i]}>
            <boxGeometry args={[0.36, 0.035, 0.28]} />
          </mesh>
          <Hit
            id={`stage-cue-${i}`}
            label={`FOH Cue ${i + 1} · ${s.name}`}
            hint="Đổi cảnh ánh sáng + bật nhạc"
            maxDist={8}
            panel="stage"
            size={[0.46, 0.42, 0.44]}
            position={[0, 0.08, 0]}
            onClick={() => onSelectScene(i)}
          />
        </group>
      ))}

      {/* Left Master Transport PLAY / STOP Illuminated Tactile Key */}
      <group ref={(r) => { padGroups.current[4] = r }} position={[-1.18, 1.07, 0.34]} rotation={[0.18, 0, 0]}>
        <mesh material={arch.machinedAlloy} position={[0, -0.02, 0]}>
          <cylinderGeometry args={[0.17, 0.19, 0.045, 24]} />
        </mesh>
        <mesh material={playMat}>
          <cylinderGeometry args={[0.14, 0.145, 0.04, 24]} />
        </mesh>
        <Hit
          id="stage-play"
          label="FOH Transport · PLAY / STOP"
          hint="Bật / tắt DJ set"
          maxDist={8}
          panel="stage"
          size={[0.48, 0.42, 0.48]}
          position={[0, 0.08, 0]}
          onClick={() => {
            liveState.press[4] = 1
            onToggleBeat()
          }}
        />
      </group>

      {/* Right Guarded PYRO / CONFETTI Launch Switch */}
      <group ref={(r) => { padGroups.current[5] = r }} position={[1.18, 1.07, 0.34]} rotation={[0.18, 0, 0]}>
        <mesh material={arch.precisionBrass} position={[0, -0.02, 0]}>
          <cylinderGeometry args={[0.17, 0.19, 0.045, 24]} />
        </mesh>
        <mesh material={boomMat}>
          <cylinderGeometry args={[0.14, 0.145, 0.04, 24]} />
        </mesh>
        <Hit
          id="stage-fire"
          label="FOH Pyro · PHÁO GIẤY & SFX"
          hint="Kích hoạt pháo sân khấu!"
          maxDist={8}
          panel="stage"
          size={[0.48, 0.42, 0.48]}
          position={[0, 0.08, 0]}
          onClick={onFire}
        />
      </group>
    </group>
  )
}
