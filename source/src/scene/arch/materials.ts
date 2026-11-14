import * as THREE from 'three'

// ---------------------------------------------------------------------------
// Deterministic Periodic Noise + Sobel Normal PBR Texture Synthesis
// Inspired by open-source procedural PBR pipelines (periodic tiling so seams
// never show across architectural walls, milled panels, timber, or fabrics).
// ---------------------------------------------------------------------------

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const sm = (t: number) => t * t * (3 - 2 * t)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

function tileNoise(size: number, freqX: number, freqY: number, rand: () => number): Float32Array {
  const g = new Float32Array(freqX * freqY)
  for (let i = 0; i < g.length; i++) g[i] = rand()
  const out = new Float32Array(size * size)
  for (let y = 0; y < size; y++) {
    const fy = (y / size) * freqY
    const y0 = Math.floor(fy) % freqY
    const y1 = (y0 + 1) % freqY
    const ty = sm(fy - Math.floor(fy))
    for (let x = 0; x < size; x++) {
      const fx = (x / size) * freqX
      const x0 = Math.floor(fx) % freqX
      const x1 = (x0 + 1) % freqX
      const tx = sm(fx - Math.floor(fx))
      const a = g[y0 * freqX + x0]
      const b = g[y0 * freqX + x1]
      const c = g[y1 * freqX + x0]
      const d = g[y1 * freqX + x1]
      out[y * size + x] = lerp(lerp(a, b, tx), lerp(c, d, tx), ty)
    }
  }
  return out
}

function fbmField(size: number, octaves: number, baseX: number, baseY: number, seed: number): Float32Array {
  const rand = mulberry32(seed)
  const out = new Float32Array(size * size)
  let amp = 1
  let sum = 0
  let fx = baseX
  let fy = baseY
  for (let o = 0; o < octaves; o++) {
    const layer = tileNoise(size, fx, fy, rand)
    for (let i = 0; i < out.length; i++) out[i] += layer[i] * amp
    sum += amp
    amp *= 0.5
    fx *= 2
    fy *= 2
  }
  for (let i = 0; i < out.length; i++) out[i] /= sum
  return out
}

function heightToNormalTex(height: Float32Array, size: number, strength = 2.0, repeat = 1): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(size, size)
  const d = img.data
  const at = (x: number, y: number) => height[((y + size) % size) * size + ((x + size) % size)]
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // 3x3 Sobel filter
      const tl = at(x - 1, y - 1)
      const tc = at(x, y - 1)
      const tr = at(x + 1, y - 1)
      const ml = at(x - 1, y)
      const mr = at(x + 1, y)
      const bl = at(x - 1, y + 1)
      const bc = at(x, y + 1)
      const br = at(x + 1, y + 1)
      const dx = (tr + 2 * mr + br - (tl + 2 * ml + bl)) * strength
      const dy = (bl + 2 * bc + br - (tl + 2 * tc + tr)) * strength
      const dz = 1.0
      const inv = 1 / Math.hypot(dx, dy, dz)
      const idx = (y * size + x) * 4
      d[idx] = Math.round((-dx * inv * 0.5 + 0.5) * 255)
      d[idx + 1] = Math.round((-dy * inv * 0.5 + 0.5) * 255)
      d[idx + 2] = Math.round((dz * inv * 0.5 + 0.5) * 255)
      d[idx + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(repeat, repeat)
  tex.anisotropy = 8
  return tex
}

function grayFieldTex(field: Float32Array, size: number, mapFn: (v: number) => number, repeat = 1): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(size, size)
  const d = img.data
  for (let i = 0; i < size * size; i++) {
    const v = Math.round(clamp01(mapFn(field[i])) * 255)
    d[i * 4] = v
    d[i * 4 + 1] = v
    d[i * 4 + 2] = v
    d[i * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(repeat, repeat)
  tex.anisotropy = 8
  return tex
}

function makePanelMetalMaps(seed: number, repeat = 1) {
  const S = 256
  const brush = fbmField(S, 4, 4, 32, seed)
  const macro = fbmField(S, 3, 4, 4, seed + 17)
  const h = new Float32Array(S * S)
  const rough = new Float32Array(S * S)
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = y * S + x
      let v = brush[i] * 0.55 + macro[i] * 0.45
      // Precision recessed aerospace panel seam grid
      const sx = x % 128
      const sy = y % 128
      const seam = sx < 2 || sy < 2 ? -0.45 : sx === 2 || sy === 2 ? 0.08 : 0
      // Subtle fastener dimples at corners of panels
      const dx = Math.min(sx, 128 - sx)
      const dy = Math.min(sy, 128 - sy)
      const rivet = dx >= 6 && dx <= 10 && dy >= 6 && dy <= 10 && Math.hypot(dx - 8, dy - 8) < 2.2 ? -0.32 : 0
      h[i] = clamp01(0.5 + (v - 0.5) * 0.35 + seam + rivet)
      rough[i] = clamp01(0.28 + (1 - v) * 0.24 + (seam < 0 ? 0.3 : 0))
    }
  }
  return {
    normal: heightToNormalTex(h, S, 2.2, repeat),
    roughness: grayFieldTex(rough, S, (v) => v, repeat),
  }
}

function makeCarbonMaps(repeat = 4) {
  const S = 128
  const h = new Float32Array(S * S)
  const r = new Float32Array(S * S)
  const c = document.createElement('canvas')
  c.width = c.height = S
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(S, S)
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = y * S + x
      // 2x2 twill carbon weave
      const phase = ((x >> 2) + (y >> 2)) % 4
      const warp = phase < 2
      const u = ((x & 3) + 0.5) / 4
      const v = ((y & 3) + 0.5) / 4
      const crown = warp ? Math.sin(u * Math.PI) : Math.sin(v * Math.PI)
      h[i] = 0.25 + crown * 0.55 + (warp ? 0.12 : 0)
      r[i] = warp ? 0.24 + (1 - crown) * 0.14 : 0.36 + (1 - crown) * 0.16
      const shade = Math.round((warp ? 24 : 16) + crown * 18)
      img.data[i * 4] = shade
      img.data[i * 4 + 1] = shade + 2
      img.data[i * 4 + 2] = shade + 5
      img.data[i * 4 + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  const map = new THREE.CanvasTexture(c)
  map.colorSpace = THREE.SRGBColorSpace
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  map.repeat.set(repeat, repeat)
  map.anisotropy = 8
  return {
    map,
    normal: heightToNormalTex(h, S, 2.4, repeat),
    roughness: grayFieldTex(r, S, (v) => v, repeat),
  }
}

function makeTimberMaps(repeat = 1) {
  const S = 256
  const grain = fbmField(S, 4, 24, 3, 73)
  const fine = fbmField(S, 3, 64, 8, 91)
  const h = new Float32Array(S * S)
  const r = new Float32Array(S * S)
  const c = document.createElement('canvas')
  c.width = c.height = S
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(S, S)
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = y * S + x
      const ring = 0.5 + 0.5 * Math.sin((x / S) * Math.PI * 18 + grain[i] * 5.2)
      const g = ring * 0.65 + fine[i] * 0.35
      h[i] = g
      r[i] = 0.42 + (1 - g) * 0.26
      // Smoked walnut architectural wood palette
      img.data[i * 4] = Math.round(lerp(48, 108, g))
      img.data[i * 4 + 1] = Math.round(lerp(28, 66, g))
      img.data[i * 4 + 2] = Math.round(lerp(18, 42, g))
      img.data[i * 4 + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  const map = new THREE.CanvasTexture(c)
  map.colorSpace = THREE.SRGBColorSpace
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  map.repeat.set(repeat, repeat)
  map.anisotropy = 8
  return {
    map,
    normal: heightToNormalTex(h, S, 1.4, repeat),
    roughness: grayFieldTex(r, S, (v) => v, repeat),
  }
}

function makeFabricMaps(seed: number, baseRgb: [number, number, number], repeat = 3) {
  const S = 128
  const nap = fbmField(S, 4, 16, 16, seed)
  const weave = new Float32Array(S * S)
  const c = document.createElement('canvas')
  c.width = c.height = S
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(S, S)
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = y * S + x
      const rib = ((x + y) & 1) * 0.22 + (x % 2 === 0 ? 0.08 : 0)
      const v = clamp01(nap[i] * 0.72 + rib * 0.28)
      weave[i] = v
      const k = 0.78 + v * 0.32
      img.data[i * 4] = Math.min(255, Math.round(baseRgb[0] * k))
      img.data[i * 4 + 1] = Math.min(255, Math.round(baseRgb[1] * k))
      img.data[i * 4 + 2] = Math.min(255, Math.round(baseRgb[2] * k))
      img.data[i * 4 + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  const map = new THREE.CanvasTexture(c)
  map.colorSpace = THREE.SRGBColorSpace
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  map.repeat.set(repeat, repeat)
  map.anisotropy = 8
  return {
    map,
    normal: heightToNormalTex(weave, S, 1.8, repeat),
    roughness: grayFieldTex(weave, S, (v) => 0.76 + (1 - v) * 0.2, repeat),
  }
}

function makePerforatedMaps(repeat = 6) {
  const S = 128
  const h = new Float32Array(S * S)
  const c = document.createElement('canvas')
  c.width = c.height = S
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(S, S)
  const cell = 16
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = y * S + x
      const row = Math.floor(y / cell)
      const ox = (x + (row % 2) * (cell * 0.5)) % cell
      const oy = y % cell
      const dist = Math.hypot(ox - cell * 0.5, oy - cell * 0.5)
      const hole = dist < cell * 0.31
      h[i] = hole ? 0.05 : 0.92
      const shade = hole ? 8 : 54
      img.data[i * 4] = shade
      img.data[i * 4 + 1] = shade + 3
      img.data[i * 4 + 2] = shade + 8
      img.data[i * 4 + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  const map = new THREE.CanvasTexture(c)
  map.colorSpace = THREE.SRGBColorSpace
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  map.repeat.set(repeat, repeat)
  map.anisotropy = 8
  return {
    map,
    normal: heightToNormalTex(h, S, 2.8, repeat),
    roughness: grayFieldTex(h, S, (v) => (v < 0.3 ? 0.95 : 0.34), repeat),
  }
}

function makeTreadMaps(repeat = 2) {
  const S = 128
  const h = new Float32Array(S * S)
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const cx = (x % 32) - 16
      const cy = (y % 32) - 16
      const odd = (((x >> 5) + (y >> 5)) & 1) === 1
      const lx = odd ? cy : cx
      const ly = odd ? cx : cy
      const diamond = Math.abs(lx) * 0.45 + Math.abs(ly) < 7.5 && Math.abs(lx) < 3.2
      h[y * S + x] = diamond ? 0.85 : 0.25
    }
  }
  return {
    normal: heightToNormalTex(h, S, 2.4, repeat),
    roughness: grayFieldTex(h, S, (v) => (v > 0.5 ? 0.34 : 0.66), repeat),
  }
}

export interface ArchMaterials {
  titaniumHull: THREE.MeshStandardMaterial
  anodizedSlate: THREE.MeshStandardMaterial
  machinedAlloy: THREE.MeshPhysicalMaterial
  ceramicShell: THREE.MeshPhysicalMaterial
  carbonWeave: THREE.MeshPhysicalMaterial
  precisionBrass: THREE.MeshStandardMaterial
  archGlass: THREE.MeshPhysicalMaterial
  darkGlass: THREE.MeshPhysicalMaterial
  acousticTimber: THREE.MeshStandardMaterial
  acousticFabric: THREE.MeshPhysicalMaterial
  cinemaVelour: THREE.MeshPhysicalMaterial
  cinemaLeather: THREE.MeshPhysicalMaterial
  perforatedGrille: THREE.MeshStandardMaterial
  dishMesh: THREE.MeshStandardMaterial
  rubberDeck: THREE.MeshStandardMaterial
  matteBlack: THREE.MeshStandardMaterial
}

let cachedMats: ArchMaterials | null = null

export function getArchMaterials(): ArchMaterials {
  if (cachedMats) return cachedMats

  const hullMaps = makePanelMetalMaps(11, 1)
  const alloyMaps = makePanelMetalMaps(37, 2)
  const carbonMaps = makeCarbonMaps(3)
  const timberMaps = makeTimberMaps(1)
  const velourMaps = makeFabricMaps(53, [142, 18, 38], 3)
  const acousticFabMaps = makeFabricMaps(67, [26, 28, 38], 2)
  const leatherMaps = makeFabricMaps(83, [28, 22, 24], 4)
  const perfMaps = makePerforatedMaps(5)
  const treadMaps = makeTreadMaps(3)

  cachedMats = {
    // Primary dark-titanium conversion-coated structural hulls & plinths
    titaniumHull: new THREE.MeshStandardMaterial({
      color: '#252d3b',
      metalness: 0.78,
      roughness: 0.42,
      normalMap: hullMaps.normal,
      normalScale: new THREE.Vector2(0.35, 0.35),
      roughnessMap: hullMaps.roughness,
      envMapIntensity: 1.45,
    }),
    // Deep anodized aerospace slate frames, mullions, trusses
    anodizedSlate: new THREE.MeshStandardMaterial({
      color: '#131822',
      metalness: 0.82,
      roughness: 0.36,
      normalMap: alloyMaps.normal,
      normalScale: new THREE.Vector2(0.24, 0.24),
      roughnessMap: alloyMaps.roughness,
      envMapIntensity: 1.55,
    }),
    // CNC-milled champagne-silver aerospace aluminum (gimbal collars, fasteners, rails)
    machinedAlloy: new THREE.MeshPhysicalMaterial({
      color: '#cfd6e2',
      metalness: 0.92,
      roughness: 0.24,
      clearcoat: 0.18,
      clearcoatRoughness: 0.22,
      normalMap: alloyMaps.normal,
      normalScale: new THREE.Vector2(0.22, 0.22),
      roughnessMap: alloyMaps.roughness,
      envMapIntensity: 1.75,
    }),
    // Satin architectural ceramic-composite fairing shell (high-contrast sci-fi shell)
    ceramicShell: new THREE.MeshPhysicalMaterial({
      color: '#ccd4e2',
      metalness: 0.16,
      roughness: 0.34,
      clearcoat: 0.45,
      clearcoatRoughness: 0.24,
      normalMap: hullMaps.normal,
      normalScale: new THREE.Vector2(0.16, 0.16),
      roughnessMap: hullMaps.roughness,
      envMapIntensity: 1.25,
    }),
    // 2x2 twill structural carbon fiber composite
    carbonWeave: new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      map: carbonMaps.map,
      normalMap: carbonMaps.normal,
      normalScale: new THREE.Vector2(0.45, 0.45),
      roughnessMap: carbonMaps.roughness,
      metalness: 0.35,
      roughness: 0.32,
      clearcoat: 0.55,
      clearcoatRoughness: 0.18,
      envMapIntensity: 1.4,
    }),
    // Warm machined architectural brass / champagne gold accents
    precisionBrass: new THREE.MeshStandardMaterial({
      color: '#d4ab62',
      metalness: 0.94,
      roughness: 0.26,
      normalMap: alloyMaps.normal,
      normalScale: new THREE.Vector2(0.16, 0.16),
      envMapIntensity: 1.7,
    }),
    // Crisp tinted low-iron architectural canopy / display glass
    archGlass: new THREE.MeshPhysicalMaterial({
      color: '#88c6eb',
      metalness: 0.08,
      roughness: 0.06,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      side: THREE.DoubleSide,
      envMapIntensity: 2.2,
    }),
    // Deep smoked glass (projection booth window, cabinet doors, optical shrouds)
    darkGlass: new THREE.MeshPhysicalMaterial({
      color: '#0e1726',
      metalness: 0.18,
      roughness: 0.08,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      transparent: true,
      opacity: 0.56,
      envMapIntensity: 2.0,
    }),
    // Fluted architectural smoked walnut (Cinema acoustic diffusers & lobby soffit)
    acousticTimber: new THREE.MeshStandardMaterial({
      color: '#ffffff',
      map: timberMaps.map,
      normalMap: timberMaps.normal,
      normalScale: new THREE.Vector2(0.42, 0.42),
      roughnessMap: timberMaps.roughness,
      metalness: 0.04,
      roughness: 0.52,
      envMapIntensity: 0.9,
    }),
    // Matte woven charcoal acoustic absorption wall panels
    acousticFabric: new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      map: acousticFabMaps.map,
      normalMap: acousticFabMaps.normal,
      normalScale: new THREE.Vector2(0.45, 0.45),
      roughnessMap: acousticFabMaps.roughness,
      metalness: 0.0,
      roughness: 0.88,
      sheen: 0.35,
      sheenRoughness: 0.8,
      sheenColor: new THREE.Color('#3b4258'),
      envMapIntensity: 0.45,
    }),
    // Rich boutique cinema crimson velvet / velour
    cinemaVelour: new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      map: velourMaps.map,
      normalMap: velourMaps.normal,
      normalScale: new THREE.Vector2(0.5, 0.5),
      roughnessMap: velourMaps.roughness,
      metalness: 0.0,
      roughness: 0.86,
      sheen: 0.78,
      sheenRoughness: 0.58,
      sheenColor: new THREE.Color('#e84a64'),
      envMapIntensity: 0.5,
    }),
    // Supple dark stitched bolster leather (FOH wrist rest, Cinema armrest pads)
    cinemaLeather: new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      map: leatherMaps.map,
      normalMap: leatherMaps.normal,
      normalScale: new THREE.Vector2(0.35, 0.35),
      roughnessMap: leatherMaps.roughness,
      metalness: 0.05,
      roughness: 0.48,
      clearcoat: 0.12,
      clearcoatRoughness: 0.45,
      envMapIntensity: 0.85,
    }),
    // Perforated acoustic speaker / equipment rack mesh
    perforatedGrille: new THREE.MeshStandardMaterial({
      color: '#ffffff',
      map: perfMaps.map,
      normalMap: perfMaps.normal,
      normalScale: new THREE.Vector2(0.7, 0.7),
      roughnessMap: perfMaps.roughness,
      metalness: 0.72,
      roughness: 0.42,
      envMapIntensity: 1.2,
    }),
    // High-reflectance precision perforated parabolic dish surface
    dishMesh: new THREE.MeshStandardMaterial({
      color: '#dde5f2',
      normalMap: perfMaps.normal,
      normalScale: new THREE.Vector2(0.32, 0.32),
      roughnessMap: perfMaps.roughness,
      metalness: 0.88,
      roughness: 0.24,
      side: THREE.DoubleSide,
      envMapIntensity: 1.85,
    }),
    // Industrial diamond-tread non-slip touring deck / steps
    rubberDeck: new THREE.MeshStandardMaterial({
      color: '#191d26',
      metalness: 0.45,
      roughness: 0.58,
      normalMap: treadMaps.normal,
      normalScale: new THREE.Vector2(0.65, 0.65),
      roughnessMap: treadMaps.roughness,
      envMapIntensity: 0.9,
    }),
    // Optical light-trap baffle matte black (projector baffles, screen masking)
    matteBlack: new THREE.MeshStandardMaterial({
      color: '#07080c',
      metalness: 0.05,
      roughness: 0.94,
      envMapIntensity: 0.2,
    }),
  }

  return cachedMats
}

// ---------------------------------------------------------------------------
// Shared GLSL Optical / Holographic Shader Factory
// Inspired by DimeDataCloud/portfolio holoMaterial.js
// ---------------------------------------------------------------------------

export function createHoloSurfaceMat(color: THREE.ColorRepresentation, alpha = 0.65) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uTime: { value: 0 },
      uAlpha: { value: alpha },
      uPulse: { value: 1.0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      varying vec3 vNormalW;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uTime;
      uniform float uAlpha;
      uniform float uPulse;
      varying vec3 vWorld;
      varying vec3 vNormalW;
      void main() {
        vec3 viewDir = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - abs(dot(viewDir, normalize(vNormalW))), 1.75);
        float scan = 0.76 + 0.24 * sin(vWorld.y * 42.0 - uTime * 5.2);
        float band = pow(0.5 + 0.5 * sin(vWorld.y * 3.5 - uTime * 1.4), 6.0) * 0.45;
        float a = (0.24 + 0.85 * fres + band) * uAlpha * scan * uPulse;
        gl_FragColor = vec4(uColor * (1.25 + fres * 1.2 + band), clamp(a, 0.0, 1.0));
      }
    `,
  })
}

export function createStatusArcMat(color: THREE.ColorRepresentation, segments = 32) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uTime: { value: 0 },
      uSegments: { value: segments },
      uEnergy: { value: 1.0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vLocal;
      void main() {
        vLocal = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uTime;
      uniform float uSegments;
      uniform float uEnergy;
      varying vec3 vLocal;
      void main() {
        float ang = atan(vLocal.z, vLocal.x);
        float norm = fract(ang / 6.2831853 + 1.0);
        float seg = fract(norm * uSegments);
        float mask = smoothstep(0.08, 0.16, seg) * smoothstep(0.92, 0.84, seg);
        float chase1 = pow(0.5 + 0.5 * sin((norm - uTime * 0.16) * 6.2831853 * 2.0), 5.0);
        float chase2 = pow(0.5 + 0.5 * sin((norm + uTime * 0.09) * 6.2831853 * 3.0), 8.0) * 0.6;
        float val = mask * (0.28 + chase1 * 1.35 + chase2) * uEnergy;
        gl_FragColor = vec4(uColor * (1.5 + chase1 * 1.1), clamp(val, 0.0, 1.0));
      }
    `,
  })
}

export function createHoloConeMat(color: THREE.ColorRepresentation, height: number, alpha = 0.28) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uTime: { value: 0 },
      uHeight: { value: height },
      uAlpha: { value: alpha },
      uEnergy: { value: 1.0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vLocal;
      varying vec3 vWorld;
      varying vec3 vNormalW;
      void main() {
        vLocal = position;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uTime;
      uniform float uHeight;
      uniform float uAlpha;
      uniform float uEnergy;
      varying vec3 vLocal;
      varying vec3 vWorld;
      varying vec3 vNormalW;
      void main() {
        float h = clamp(vLocal.y / max(0.001, uHeight), 0.0, 1.0);
        float fade = pow(1.0 - h, 1.35) * smoothstep(0.0, 0.08, h);
        vec3 vDir = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - abs(dot(vDir, normalize(vNormalW))), 1.5);
        float scan = 0.8 + 0.2 * sin(vLocal.y * 22.0 - uTime * 4.5);
        float a = fade * (0.3 + 0.85 * fres) * scan * uAlpha * uEnergy;
        gl_FragColor = vec4(uColor * 1.6, clamp(a, 0.0, 1.0));
      }
    `,
  })
}

/** Expanding parabolic RF carrier wavefront shader for Signal Beacon. */
export function createRfWaveMat(color: THREE.ColorRepresentation) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uAlpha: { value: 0.0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uAlpha;
      varying vec2 vUv;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 1.2);
        float edgeFade = smoothstep(0.0, 0.18, vUv.y) * smoothstep(1.0, 0.65, vUv.y);
        float a = (0.35 + 0.85 * rim) * edgeFade * uAlpha;
        gl_FragColor = vec4(uColor * 2.2, clamp(a, 0.0, 1.0));
      }
    `,
  })
}
