import * as THREE from 'three';
import {
  carbonTwillMaps,
  castMetalMaps,
  deckTreadMaps,
  leatherGrainMaps,
  milledMetalMaps,
  paintedPanelMaps,
  ripstopFabricMaps,
  webbingMaps,
} from './textures';

export interface MaterialLibrary {
  hull: THREE.MeshStandardMaterial;
  shell: THREE.MeshStandardMaterial;
  castAl: THREE.MeshStandardMaterial;
  panel: THREE.MeshPhysicalMaterial;
  anodized: THREE.MeshStandardMaterial;
  brushed: THREE.MeshPhysicalMaterial;
  titanium: THREE.MeshStandardMaterial;
  carbon: THREE.MeshPhysicalMaterial;
  fabric: THREE.MeshPhysicalMaterial;
  webbing: THREE.MeshPhysicalMaterial;
  leather: THREE.MeshPhysicalMaterial;
  rubber: THREE.MeshStandardMaterial;
  seal: THREE.MeshStandardMaterial;
  glass: THREE.MeshPhysicalMaterial;
  glassEdge: THREE.MeshPhysicalMaterial;
  hudGlass: THREE.MeshPhysicalMaterial;
  screenGlass: THREE.MeshPhysicalMaterial;
  bezel: THREE.MeshStandardMaterial;
  dark: THREE.MeshStandardMaterial;
  warm: THREE.MeshStandardMaterial;
  cyan: THREE.MeshStandardMaterial;
  red: THREE.MeshStandardMaterial;
  green: THREE.MeshStandardMaterial;
  white: THREE.MeshStandardMaterial;
  labels: THREE.MeshBasicMaterial;
  warmLight: THREE.MeshBasicMaterial;
  coolLight: THREE.MeshBasicMaterial;
  caution: THREE.MeshStandardMaterial;
  floor: THREE.MeshStandardMaterial;
  disposables: { dispose: () => void }[];
  all: THREE.Material[];
}

export function buildMaterials(): MaterialLibrary {
  const disposables: { dispose: () => void }[] = [];
  const trackTex = <T extends THREE.Texture>(t: T): T => {
    disposables.push(t);
    return t;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    disposables.push(m);
    return m;
  };

  const milled = milledMetalMaps(11, 4);
  const cast = castMetalMaps(29, 6);
  const painted = paintedPanelMaps(43, 5);
  const carbonMaps = carbonTwillMaps(9);
  const fabricMaps = ripstopFabricMaps(14);
  const webMaps = webbingMaps(18);
  const leatherMaps = leatherGrainMaps(7);
  const treadMaps = deckTreadMaps(7);

  for (const pair of [milled, cast, painted, carbonMaps, fabricMaps, webMaps, leatherMaps, treadMaps]) {
    trackTex(pair.roughness);
    trackTex(pair.normal);
  }

  // Primary structural 7075-T6 dark-slate conversion-coated frame extrusions
  const hull = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x313a40,
      roughness: 0.48,
      metalness: 0.68,
      roughnessMap: milled.roughness,
      normalMap: milled.normal,
      normalScale: new THREE.Vector2(0.28, 0.28),
      envMapIntensity: 1.05,
    }),
  );

  // Interior pressure-shell skin (chromate / satin polyurethane aerospace liner)
  const shell = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x4b575f,
      roughness: 0.58,
      metalness: 0.28,
      roughnessMap: painted.roughness,
      normalMap: painted.normal,
      normalScale: new THREE.Vector2(0.22, 0.22),
      envMapIntensity: 0.88,
    }),
  );

  // Investment-cast A356 / Ti housings (window frames, pedal stirrups, latch clevises)
  const castAl = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x5c666c,
      roughness: 0.56,
      metalness: 0.78,
      roughnessMap: cast.roughness,
      normalMap: cast.normal,
      normalScale: new THREE.Vector2(0.42, 0.42),
      envMapIntensity: 1.0,
    }),
  );

  // Powder-coated / MIL-PRF-85285 painted instrument panel fascia (dielectric topcoat!)
  const panel = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x242e34,
      roughness: 0.6,
      metalness: 0.16,
      roughnessMap: painted.roughness,
      normalMap: painted.normal,
      normalScale: new THREE.Vector2(0.26, 0.26),
      clearcoat: 0.16,
      clearcoatRoughness: 0.52,
      envMapIntensity: 0.92,
    }),
  );

  // MIL-A-8625 Type III Hard Black Anodized machined aluminium
  const anodized = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x151b20,
      roughness: 0.36,
      metalness: 0.76,
      roughnessMap: milled.roughness,
      normalMap: milled.normal,
      normalScale: new THREE.Vector2(0.2, 0.2),
      envMapIntensity: 1.3,
    }),
  );

  // Bare CNC-milled 7075-T6 bright aerospace aluminium (fasteners, rails, latches, collars)
  const brushed = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x9aa4a8,
      roughness: 0.3,
      metalness: 0.91,
      roughnessMap: milled.roughness,
      normalMap: milled.normal,
      normalScale: new THREE.Vector2(0.24, 0.24),
      clearcoat: 0.12,
      clearcoatRoughness: 0.28,
      envMapIntensity: 1.35,
    }),
  );

  // Bead-blasted Ti-6Al-4V Titanium (warm champagne-grey gunmetal)
  const titanium = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x767772,
      roughness: 0.42,
      metalness: 0.87,
      roughnessMap: cast.roughness,
      normalMap: cast.normal,
      normalScale: new THREE.Vector2(0.25, 0.25),
      envMapIntensity: 1.28,
    }),
  );

  // Autoclave 2x2 Twill CFRP composite monocoque under satin epoxy clearcoat
  const carbon = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x161a1d,
      roughness: 0.42,
      metalness: 0.24,
      roughnessMap: carbonMaps.roughness,
      normalMap: carbonMaps.normal,
      normalScale: new THREE.Vector2(0.55, 0.55),
      clearcoat: 0.64,
      clearcoatRoughness: 0.24,
      envMapIntensity: 1.05,
    }),
  );

  // Flame-retardant Nomex / Cordura ripstop flight upholstery with cloth sheen
  const fabric = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x2c3439,
      roughness: 0.88,
      metalness: 0.02,
      roughnessMap: fabricMaps.roughness,
      normalMap: fabricMaps.normal,
      normalScale: new THREE.Vector2(0.6, 0.6),
      sheen: 0.42,
      sheenRoughness: 0.76,
      sheenColor: new THREE.Color(0x56656e),
      envMapIntensity: 0.45,
    }),
  );

  // High-tensile MIL-W-4088 herringbone harness webbing (olive-taupe tactical grey)
  const webbing = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x626157,
      roughness: 0.8,
      metalness: 0.04,
      roughnessMap: webMaps.roughness,
      normalMap: webMaps.normal,
      normalScale: new THREE.Vector2(0.65, 0.65),
      sheen: 0.35,
      sheenRoughness: 0.65,
      sheenColor: new THREE.Color(0x8c8a7b),
      envMapIntensity: 0.5,
    }),
  );

  // Grained soft-touch flight leather (glareshield brow, armrest pads, knee bolster)
  const leather = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x191d20,
      roughness: 0.68,
      metalness: 0.03,
      roughnessMap: leatherMaps.roughness,
      normalMap: leatherMaps.normal,
      normalScale: new THREE.Vector2(0.48, 0.48),
      sheen: 0.16,
      sheenRoughness: 0.8,
      sheenColor: new THREE.Color(0x333a40),
      envMapIntensity: 0.58,
    }),
  );

  // Molded Shore-75A vulcanized grip elastomer (RHC/THC/throttle grips, bellows)
  const rubber = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x101416,
      roughness: 0.84,
      metalness: 0.02,
      normalMap: cast.normal,
      normalScale: new THREE.Vector2(0.32, 0.32),
      envMapIntensity: 0.35,
    }),
  );

  // Compressed 60-Shore-A silicone / EPDM pressure seal (subtle satin bulb highlight)
  const seal = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x0d1012,
      roughness: 0.56,
      metalness: 0.05,
      normalMap: leatherMaps.normal,
      normalScale: new THREE.Vector2(0.18, 0.18),
      envMapIntensity: 0.62,
    }),
  );

  // Multi-pane spacecraft glazing face
  const glass = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xaad4e0,
      roughness: 0.04,
      metalness: 0.0,
      transparent: true,
      opacity: 0.035,
      envMapIntensity: 1.25,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );

  // Physical beveled fused-silica / low-iron glass edge (catches cyan-green refraction rim!)
  const glassEdge = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x67b8ab,
      roughness: 0.14,
      metalness: 0.05,
      transparent: true,
      opacity: 0.48,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      envMapIntensity: 1.6,
    }),
  );

  // Dichroic collimated HUD combiner glass
  const hudGlass = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x6ef2c4,
      roughness: 0.05,
      metalness: 0.05,
      transparent: true,
      opacity: 0.11,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      envMapIntensity: 1.5,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );

  const screenGlass = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x9ec8d4,
      roughness: 0.07,
      metalness: 0,
      transparent: true,
      opacity: 0.04,
      clearcoat: 0.8,
      clearcoatRoughness: 0.08,
      envMapIntensity: 1.25,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );

  // Cast/milled matte black anti-reflection display bezel
  const bezel = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x0f1418,
      roughness: 0.48,
      metalness: 0.52,
      roughnessMap: cast.roughness,
      normalMap: cast.normal,
      normalScale: new THREE.Vector2(0.24, 0.24),
      envMapIntensity: 0.95,
    }),
  );

  const dark = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x12181c,
      roughness: 0.78,
      metalness: 0.2,
      envMapIntensity: 0.42,
    }),
  );

  const warm = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x4a3523,
      roughness: 0.44,
      metalness: 0.55,
      emissive: 0xffab5a,
      emissiveIntensity: 0.22,
      envMapIntensity: 0.85,
    }),
  );

  const cyan = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1b3c44,
      roughness: 0.34,
      metalness: 0.48,
      emissive: 0x74e8ff,
      emissiveIntensity: 0.4,
      envMapIntensity: 1.0,
    }),
  );

  const red = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x481612,
      roughness: 0.45,
      metalness: 0.22,
      emissive: 0xff4740,
      emissiveIntensity: 0.32,
    }),
  );

  const green = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x123a2e,
      roughness: 0.45,
      metalness: 0.22,
      emissive: 0x5cffc0,
      emissiveIntensity: 0.34,
    }),
  );

  const white = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd6e6ea,
      roughness: 0.36,
      metalness: 0.25,
    }),
  );

  const labels = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.86,
      depthWrite: false,
      toneMapped: false,
    }),
  );

  const warmLight = trackMat(
    new THREE.MeshBasicMaterial({ color: 0xffc472, toneMapped: false }),
  );
  const coolLight = trackMat(
    new THREE.MeshBasicMaterial({ color: 0x7ee8ff, toneMapped: false }),
  );

  // Master caution / pyrotechnic safety-amber anodized hardware
  const caution = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xc4741b,
      roughness: 0.42,
      metalness: 0.52,
      roughnessMap: milled.roughness,
      normalMap: milled.normal,
      normalScale: new THREE.Vector2(0.2, 0.2),
      emissive: 0x3b1c03,
      emissiveIntensity: 0.28,
    }),
  );

  // CNC-milled anti-slip flight deck floor plate
  const floor = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x2c3439,
      roughness: 0.68,
      metalness: 0.62,
      roughnessMap: treadMaps.roughness,
      normalMap: treadMaps.normal,
      normalScale: new THREE.Vector2(0.75, 0.75),
      envMapIntensity: 0.85,
    }),
  );

  const all = [
    hull, shell, castAl, panel, anodized, brushed, titanium, carbon,
    fabric, webbing, leather, rubber, seal, glass, glassEdge, hudGlass,
    screenGlass, bezel, dark, warm, cyan, red, green, white, labels,
    warmLight, coolLight, caution, floor,
  ];

  return {
    hull,
    shell,
    castAl,
    panel,
    anodized,
    brushed,
    titanium,
    carbon,
    fabric,
    webbing,
    leather,
    rubber,
    seal,
    glass,
    glassEdge,
    hudGlass,
    screenGlass,
    bezel,
    dark,
    warm,
    cyan,
    red,
    green,
    white,
    labels,
    warmLight,
    coolLight,
    caution,
    floor,
    disposables,
    all,
  };
}
