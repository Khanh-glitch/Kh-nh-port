import * as THREE from 'three';
import type { CockpitSection } from '../../data/blueprint';
import {
  buildAdelClamp,
  buildCircularConnector,
  buildKnob,
  buildKorrySwitch,
  buildToggle,
  circleHolePath,
  fastenerInstances,
  filletPolygon2D,
  latheMachined,
  loftThickShell,
  machinedBezel,
  machinedPlate,
  polygonToShape,
  roundedRectPath,
  roundedRectShape,
  sweepProfile,
  tube,
  type BoltPlacement,
} from '../geometry';
import { auxScreen, labelTexture, paintScreen } from '../textures';
import { DATUM, type BuildContext } from '../datum';

export interface DashHandles {
  updateScreen: (section: CockpitSection, throttle: number) => void;
}

export function buildDashAndHud(ctx: BuildContext): DashHandles {
  const { mats, mesh, box, decal, label, track, group, screenMeshes } = ctx;

  /* ═══ 1 · 3-SEGMENT WRAP-AROUND MIP ASSEMBLY (15° TILT TO DEP) ══════════ */

  const mip = new THREE.Group();
  mip.position.set(0, DATUM.mipY, DATUM.mipZ);
  mip.rotation.x = DATUM.mipTilt; // -15 deg so display normal meets Design Eye Point
  group.add(mip);

  // Central MIP structural chassis plate (0.67 x 0.39 m) with rear mounting pocket
  const centerPlateShape = roundedRectShape(0.67, 0.39, 0.016);
  const pfdCutout = roundedRectPath(0, 0.032, 0.49, 0.24, 0.01);
  const centerChassis = machinedPlate(centerPlateShape, {
    holes: [pfdCutout],
    depth: 0.042,
    bevel: 0.003,
    centerZ: false,
  });
  mesh(centerChassis, mats.panel, 0, 0, -0.028, 0, 0, 0, mip);

  // Rear electronics heat-sink backing box behind PFD aperture
  box(0.54, 0.29, 0.09, mats.hull, 0, 0.032, -0.075, 0, 0, 0, 0.01, mip);
  for (let f = 0; f < 9; f++) {
    box(0.01, 0.26, 0.025, mats.anodized, -0.20 + f * 0.05, 0.032, -0.125, 0, 0, 0, 0.002, mip);
  }

  /* ── Primary Wide-Format Flight Display (PFD) Multi-Part Bezel Stack ─────── */
  const pfdGroup = new THREE.Group();
  pfdGroup.position.set(0, 0.032, 0.016);
  mip.add(pfdGroup);

  // 1. Outer cast/milled bezel housing with true window aperture
  mesh(machinedBezel(0.565, 0.298, 0.488, 0.236, 0.022, 0.016, 0.009, 0.0025), mats.bezel, 0, 0, 0.008, 0, 0, 0, pfdGroup);
  // 2. Inner 45°-stepped anti-reflection sight-collar
  mesh(machinedBezel(0.502, 0.248, 0.476, 0.226, 0.012, 0.01, 0.007, 0.002), mats.anodized, 0, 0, 0.004, 0, 0, 0, pfdGroup);
  // 3. Compressed silicone perimeter dust/moisture gasket
  mesh(machinedBezel(0.482, 0.232, 0.470, 0.220, 0.006, 0.008, 0.006, 0.0012), mats.seal, 0, 0, 0.001, 0, 0, 0, pfdGroup);

  // 4. High-DPI 1536x768 Primary Display Canvas
  const mainCanvas = Object.assign(document.createElement('canvas'), { width: 1536, height: 768 });
  const mainTex = track(new THREE.CanvasTexture(mainCanvas));
  mainTex.colorSpace = THREE.SRGBColorSpace;
  mainTex.anisotropy = 8;
  const mainScreenMat = track(new THREE.MeshBasicMaterial({ map: mainTex, toneMapped: false }));
  const mainScreen = new THREE.Mesh(track(new THREE.PlaneGeometry(0.476, 0.226)), mainScreenMat);
  mainScreen.position.set(0, 0, -0.001);
  pfdGroup.add(mainScreen);
  screenMeshes.push(mainScreen);

  // 5. Recessed low-iron anti-reflective optical cover glass
  const pfdGlass = new THREE.Mesh(track(new THREE.PlaneGeometry(0.478, 0.228)), mats.screenGlass);
  pfdGlass.position.set(0, 0, 0.005);
  pfdGroup.add(pfdGlass);

  // 6. Sculpted tactile OSB bezel keys in machined guard wells (6 top, 6 bottom, 4 left, 4 right)
  for (const sy of [-1, 1]) {
    for (let k = 0; k < 6; k++) {
      const kx = -0.18 + k * 0.072;
      const ky = sy * 0.134;
      mesh(machinedBezel(0.032, 0.017, 0.025, 0.011, 0.005, 0.003, 0.002, 0.0008), mats.anodized, kx, ky, 0.019, 0, 0, 0, pfdGroup);
      box(0.023, 0.0095, 0.006, mats.brushed, kx, ky, 0.0205, 0, 0, 0, 0.0015, pfdGroup);
    }
  }
  for (const sx of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      const kx = sx * 0.264;
      const ky = -0.066 + k * 0.044;
      mesh(machinedBezel(0.017, 0.028, 0.011, 0.021, 0.005, 0.003, 0.002, 0.0008), mats.anodized, kx, ky, 0.019, 0, 0, 0, pfdGroup);
      box(0.0095, 0.019, 0.006, mats.brushed, kx, ky, 0.0205, 0, 0, 0, 0.0015, pfdGroup);
    }
    // Lower bezel corner brightness/contrast dual-concentric encoders
    const brt = buildKnob(0.011, 0.012, mats.anodized, mats.cyan, 'encoder');
    brt.rotation.x = Math.PI / 2;
    brt.position.set(sx * 0.262, -0.130, 0.019);
    pfdGroup.add(brt);
  }

  const mipBolts: BoltPlacement[] = [];
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      mipBolts.push({
        position: new THREE.Vector3(sx * 0.268, 0.032 + sy * 0.136, 0.035),
        normal: new THREE.Vector3(0, 0, 1),
        scale: 0.85,
      });
    }
  }

  /* ── Lower Central MIP Flight-Control & Standby Instrument Sub-Panel ────── */
  // Cleanly below PFD bezel (PFD bottom is at y = 0.032 - 0.149 = -0.117; sub-panel at y = -0.156)
  mesh(
    machinedPlate(roundedRectShape(0.62, 0.062, 0.008), { depth: 0.01, bevel: 0.0015 }),
    mats.anodized,
    0,
    -0.156,
    0.014,
    0,
    0,
    0,
    mip,
  );

  // Turned Standby Attitude / Cabin Pressure Dial Bezel on left (-0.23)
  mesh(
    latheMachined([
      [0.022, 0],
      [0.030, 0],
      [0.030, 0.012],
      [0.025, 0.015],
      [0.022, 0.015],
      [0.022, 0.002],
    ], 28),
    mats.brushed,
    -0.235,
    -0.156,
    0.024,
    Math.PI / 2,
    0,
    0,
    mip,
  );
  const stbyFace = new THREE.Mesh(
    track(new THREE.CircleGeometry(0.022, 24)),
    track(new THREE.MeshBasicMaterial({
      map: track(labelTexture('101.3', 'KPA STBY', '#8ff0c3', 256, 128)),
      toneMapped: false,
    })),
  );
  stbyFace.position.set(-0.235, -0.156, 0.026);
  mip.add(stbyFace);
  screenMeshes.push(stbyFace);

  // 4 Triplex FCC Lane Toggle Switches + 1 Guarded Emergency Attenuator Switch
  for (let i = 0; i < 5; i++) {
    const isArm = i === 4;
    const sw = buildToggle(
      mats.brushed,
      isArm ? mats.red : mats.white,
      isArm ? mats.caution : i === 0 ? mats.anodized : null,
      isArm,
    );
    sw.scale.setScalar(0.72);
    sw.rotation.x = Math.PI / 2;
    sw.position.set(-0.11 + i * 0.068, -0.156, 0.024);
    mip.add(sw);
  }

  /* ── Port & Starboard 24° Wrap-Around Wing Segments (ZERO Overlap!) ────── */

  for (const [idx, s] of [-1, 1].entries()) {
    // Hinge pivot sits EXACTLY at outer edge of Central MIP (x = s * 0.338)
    const wingHinge = new THREE.Group();
    wingHinge.position.set(s * 0.338, 0, 0.012);
    wingHinge.rotation.y = -s * 0.42; // 24° inward wrap per MIL-STD-1472H 5.10.4.1.2!
    mip.add(wingHinge);

    // Machined Titanium Splice Gusset Strip along the hinge line
    box(0.016, 0.37, 0.018, mats.titanium, 0, 0, 0, 0, 0, 0, 0.003, wingHinge);

    const wx = s * 0.182; // Center of 0.35 m wide wing panel
    const wingShape = roundedRectShape(0.35, 0.38, 0.014);
    const auxCutout = roundedRectPath(0, 0.046, 0.218, 0.164, 0.008);
    const wingPlate = machinedPlate(wingShape, {
      holes: [auxCutout],
      depth: 0.036,
      bevel: 0.0028,
      centerZ: false,
    });
    mesh(wingPlate, mats.panel, wx, 0, -0.034, 0, 0, 0, wingHinge);
    box(0.25, 0.20, 0.075, mats.hull, wx, 0.046, -0.072, 0, 0, 0, 0.008, wingHinge);

    // Auxiliary MFD Bezel Assembly (cleanly in UPPER zone y = +0.046)
    const auxGroup = new THREE.Group();
    auxGroup.position.set(wx, 0.046, 0.004);
    wingHinge.add(auxGroup);

    mesh(machinedBezel(0.272, 0.214, 0.218, 0.164, 0.018, 0.013, 0.007, 0.002), mats.bezel, 0, 0, 0.008, 0, 0, 0, auxGroup);
    mesh(machinedBezel(0.228, 0.174, 0.208, 0.154, 0.010, 0.008, 0.005, 0.0015), mats.anodized, 0, 0, 0.004, 0, 0, 0, auxGroup);
    mesh(machinedBezel(0.212, 0.158, 0.204, 0.150, 0.005, 0.006, 0.004, 0.001), mats.seal, 0, 0, 0.001, 0, 0, 0, auxGroup);

    const auxTex = track(auxScreen(idx === 0 ? 'system' : 'engine', idx === 0 ? '#8ff0c3' : '#ffc16b'));
    const auxMat = track(new THREE.MeshBasicMaterial({ map: auxTex, toneMapped: false }));
    const auxPlane = new THREE.Mesh(track(new THREE.PlaneGeometry(0.208, 0.154)), auxMat);
    auxPlane.position.z = -0.001;
    auxGroup.add(auxPlane);
    screenMeshes.push(auxPlane);

    const auxGlass = new THREE.Mesh(track(new THREE.PlaneGeometry(0.210, 0.156)), mats.screenGlass);
    auxGlass.position.z = 0.004;
    auxGroup.add(auxGlass);

    // 12 Tactile OSB Bezel Keys around each Aux MFD
    for (const sy of [-1, 1]) {
      for (let k = 0; k < 4; k++) {
        const kx = -0.069 + k * 0.046;
        const ky = sy * 0.094;
        box(0.022, 0.009, 0.006, mats.brushed, kx, ky, 0.017, 0, 0, 0, 0.0015, auxGroup);
      }
    }
    for (const sx of [-1, 1]) {
      for (let k = 0; k < 2; k++) {
        const kx = sx * 0.122;
        const ky = -0.024 + k * 0.048;
        box(0.009, 0.02, 0.006, mats.brushed, kx, ky, 0.017, 0, 0, 0, 0.0015, auxGroup);
      }
    }

    // Lower Wing Sub-Panel (cleanly BELOW Aux MFD at y = -0.126 — zero overlap!)
    mesh(
      machinedPlate(roundedRectShape(0.272, 0.084, 0.008), { depth: 0.009, bevel: 0.0015 }),
      mats.anodized,
      wx,
      -0.126,
      0.003,
      0,
      0,
      0,
      wingHinge,
    );

    if (s < 0) {
      // Port Wing Lower Panel: ECS / Cabin Pressure Korrys & Rotary Selectors
      for (let k = 0; k < 2; k++) {
        const korry = buildKorrySwitch(0.038, 0.022, mats.bezel, k === 0 ? mats.green : mats.cyan, mats.dark);
        korry.rotation.x = Math.PI / 2;
        korry.position.set(wx - 0.072 + k * 0.056, -0.126, 0.012);
        wingHinge.add(korry);
      }
      const ecsKnob = buildKnob(0.016, 0.016, mats.anodized, mats.white, 'pointer');
      ecsKnob.rotation.x = Math.PI / 2;
      ecsKnob.position.set(wx + 0.068, -0.126, 0.012);
      wingHinge.add(ecsKnob);
    } else {
      // Starboard Wing Lower Panel: Guarded RCS Thruster Quad Isolation Switches
      for (let k = 0; k < 3; k++) {
        const sw = buildToggle(mats.brushed, k === 2 ? mats.caution : mats.white, mats.anodized, k === 2);
        sw.scale.setScalar(0.68);
        sw.rotation.x = Math.PI / 2;
        sw.position.set(wx - 0.082 + k * 0.054, -0.126, 0.012);
        wingHinge.add(sw);
      }
      const xfeed = buildKnob(0.016, 0.016, mats.anodized, mats.warm, 'pointer');
      xfeed.rotation.x = Math.PI / 2;
      xfeed.position.set(wx + 0.082, -0.126, 0.012);
      wingHinge.add(xfeed);
    }

    const wingLbl = label(
      s < 0 ? 'SYS / ECLSS' : 'PROP / RCS',
      s < 0 ? 'DU-01 · LOOP A/B' : 'DU-02 · QUAD A–D',
      0.13,
      0.028,
      s < 0 ? '#8ff0c3' : '#ffc16b',
    );
    const wd = decal(wingLbl.texture, wingLbl.w, wingLbl.h, wingHinge);
    wd.position.set(wx, 0.172, 0.006);
  }

  mip.add(fastenerInstances(mipBolts, mats.brushed, 0.0046, 0.0035));

  /* ═══ 2 · DEEP OPTICAL GLARESHIELD, GCP/MCP PANEL & COLLIMATED HUD ═══════ */

  // Helper matching the 3-segment MIP planform with wrapped downward shoulder cheeks!
  const glareFrontPoint = (u: number) => {
    const sParam = (u - 0.5) * 2; // -1 .. +1
    const absS = Math.abs(sParam);
    const sign = Math.sign(sParam);
    if (absS <= 0.44) {
      const x = (sParam / 0.44) * 0.34;
      const crown = (1 - Math.pow(x / 0.35, 2)) * 0.022;
      return new THREE.Vector3(x, 0.224 + crown, 0.152);
    }
    if (absS <= 0.86) {
      const wingT = (absS - 0.44) / 0.42; // 0 .. 1 across Aux MFD top
      const wingLen = wingT * 0.345;
      const x = sign * (0.34 + Math.cos(0.42) * wingLen);
      const z = 0.152 + Math.sin(0.42) * wingLen * 0.96;
      const y = 0.224 - wingT * 0.024;
      return new THREE.Vector3(x, y, z);
    }
    // Smoothly wrap downward along outer cheek of each Aux MFD wing!
    const dropT = (absS - 0.86) / 0.14;
    const baseLen = 0.345 + Math.sin(dropT * Math.PI * 0.5) * 0.022;
    const x = sign * (0.34 + Math.cos(0.42) * baseLen);
    const z = 0.152 + Math.sin(0.42) * baseLen * 0.96 - dropT * 0.03;
    const y = 0.200 - Math.pow(dropT, 1.35) * 0.22;
    return new THREE.Vector3(x, y, z);
  };

  // 15 mm thick compound-curved optical light-baffle overhang + wrapped side cheeks!
  const glareshieldGeo = loftThickShell(
    (u, v, out) => {
      const pFront = glareFrontPoint(u);
      const pBack = new THREE.Vector3(
        pFront.x * 1.02,
        pFront.y - 0.028,
        pFront.z - (0.28 - Math.abs(u - 0.5) * 0.09),
      );
      out.lerpVectors(pBack, pFront, v);
      out.y += Math.sin(v * Math.PI) * 0.012;
    },
    0.015,
    46,
    12,
    0.78,
  );
  mesh(glareshieldGeo, mats.panel, 0, 0, 0, 0, 0, 0, mip);

  // Forward Anti-Glare Coaming Shroud Deck bridging MIP rear flange (-0.74) forward to Windshield Sill!
  const fwdShroudGeo = loftThickShell(
    (u, v, out) => {
      const lat = (u - 0.5) * 2;
      const zAft = -0.74 + Math.abs(lat) * 0.075;
      const zFwd = -1.04 - (1 - lat * lat) * 0.07;
      const yAft = -0.065 - Math.abs(lat) * 0.035;
      const yFwd = DATUM.sillY + (1 - lat * lat) * 0.155;
      const wAft = 0.66;
      const wFwd = 0.74;
      out.set(
        lat * THREE.MathUtils.lerp(wFwd, wAft, v),
        THREE.MathUtils.lerp(yFwd, yAft, v),
        THREE.MathUtils.lerp(zFwd, zAft, v),
      );
    },
    0.016,
    28,
    10,
    0.8,
  );
  mesh(fwdShroudGeo, mats.anodized);

  // Windshield Defogger Air-Distribution Louver Grilles along forward coaming deck
  for (const s of [-1, 1]) {
    const defog = machinedPlate(roundedRectShape(0.24, 0.055, 0.008), {
      holes: [
        roundedRectPath(-0.06, 0, 0.085, 0.022, 0.004),
        roundedRectPath(0.06, 0, 0.085, 0.022, 0.004),
      ],
      depth: 0.008,
      bevel: 0.0015,
    });
    mesh(defog, mats.castAl, s * 0.34, -0.095, -0.92, -Math.PI / 2 + 0.18, s * -0.15, 0);
  }

  // Rolled Stitched Leather Shock-Absorbing Brow Pad along entire wrapped front lip
  const browPts = Array.from({ length: 41 }, (_, i) => glareFrontPoint(i / 40));
  const browProfile = filletPolygon2D([
    [-0.013, -0.013, 0.005],
    [0.015, -0.011, 0.006],
    [0.017, 0.011, 0.006],
    [-0.011, 0.013, 0.005],
  ], 0.005, 4);
  mesh(sweepProfile(browPts, browProfile, { steps: 64, up: new THREE.Vector3(0, 1, 0), caps: true }), mats.leather, 0, 0, 0, 0, 0, 0, mip);

  // Anti-glare matte black optical louvers recessed on upper glareshield deck
  for (let i = 0; i < 11; i++) {
    const lx = -0.28 + i * 0.056;
    box(0.042, 0.005, 0.065, mats.dark, lx, 0.232, 0.01, 0.14, 0, 0, 0.0015, mip);
  }

  // Concealed indirect warm-amber LED floodlight strip tucked UP under brow overhang (clear of GCP!)
  const underFlood = new THREE.Mesh(track(new THREE.BoxGeometry(0.48, 0.0035, 0.008)), mats.warmLight);
  underFlood.position.set(0, 0.226, 0.128);
  mip.add(underFlood);
  screenMeshes.push(underFlood);

  /* ── Integrated Glareshield Guidance & Mode Control Panel (GCP / MCP) ──── */
  // Positioned cleanly between PFD bezel top (+0.181) and Glareshield brow (+0.235)!
  const gcp = new THREE.Group();
  gcp.position.set(0, 0.197, 0.088);
  gcp.rotation.x = -0.10;
  mip.add(gcp);

  mesh(
    machinedPlate(roundedRectShape(0.60, 0.044, 0.007), { depth: 0.016, bevel: 0.002 }),
    mats.anodized,
    0,
    0,
    0,
    0,
    0,
    0,
    gcp,
  );

  // Master Warning (Red) & Master Caution (Amber) Korry Push-Lenses flanking GCP
  for (const [sx, uMat] of [[-1, mats.red], [1, mats.caution]] as [number, THREE.Material][]) {
    const mw = buildKorrySwitch(0.036, 0.022, mats.brushed, uMat, mats.warm);
    mw.rotation.x = Math.PI / 2;
    mw.position.set(sx * 0.258, 0, 0.016);
    gcp.add(mw);
  }

  // 4 Tactile-Coded GCP Rotary Encoders (VEL, HDG, ALT, V/S)
  for (let i = 0; i < 4; i++) {
    const enc = buildKnob(0.0115, 0.014, mats.brushed, i % 2 === 0 ? mats.cyan : mats.white, 'encoder');
    enc.rotation.x = Math.PI / 2;
    enc.position.set(-0.165 + i * 0.11, -0.002, 0.016);
    gcp.add(enc);
  }
  // 5 Backlit Guidance Mode Pushbuttons
  for (let i = 0; i < 5; i++) {
    box(0.022, 0.009, 0.006, i === 2 ? mats.green : mats.cyan, -0.14 + i * 0.07, 0.013, 0.018, 0, 0, 0, 0.0015, gcp);
  }

  /* ── Collimated Head-Up Display (HUD) Optical Barrel & Framed Combiner ─── */
  const hudAssy = new THREE.Group();
  hudAssy.position.set(0, 0.222, -0.01);
  hudAssy.rotation.x = -DATUM.mipTilt; // Level in world frame!
  mip.add(hudAssy);

  // Machined collimator housing & recessed objective lens barrel
  mesh(
    machinedPlate(roundedRectShape(0.24, 0.14, 0.016), {
      holes: [circleHolePath(0, 0, 0.048)],
      depth: 0.024,
      bevel: 0.0025,
    }),
    mats.anodized,
    0,
    -0.008,
    0,
    -Math.PI / 2,
    0,
    0,
    hudAssy,
  );
  mesh(
    latheMachined([
      [0.01, -0.018],
      [0.052, -0.018],
      [0.052, 0.012],
      [0.046, 0.016],
      [0.042, 0.004],
      [0.002, 0.002],
    ], 32),
    mats.brushed,
    0,
    0,
    0,
    0,
    0,
    0,
    hudAssy,
  );
  const hudLens = new THREE.Mesh(track(new THREE.CircleGeometry(0.043, 28)), mats.hudGlass);
  hudLens.rotation.x = -Math.PI / 2;
  hudLens.position.y = 0.006;
  hudAssy.add(hudLens);

  // Twin CNC-milled swan-neck combiner support arms with lightening holes!
  for (const sx of [-1, 1]) {
    const armShape = polygonToShape([
      [-0.022, 0, 0.004],
      [0.022, 0, 0.004],
      [0.042, 0.135, 0.006],
      [0.016, 0.142, 0.006],
      [-0.012, 0.045, 0.008],
    ], 0.004, 4);
    const armGeo = machinedPlate(armShape, {
      holes: [circleHolePath(0.008, 0.048, 0.009), circleHolePath(0.020, 0.095, 0.008)],
      depth: 0.008,
      bevel: 0.0014,
      centerZ: true,
    });
    mesh(armGeo, mats.titanium, sx * 0.142, 0.006, 0.01, 0, Math.PI / 2, 0, hudAssy);
  }

  // Thick Beveled Optical Combiner Plate + Perimeter Frame + Conformal Symbology
  const combGroup = new THREE.Group();
  combGroup.position.set(0, 0.105, 0.042);
  combGroup.rotation.x = -0.56;
  hudAssy.add(combGroup);

  // Beveled 5 mm physical glass edge frame + titanium side clips
  mesh(machinedBezel(0.282, 0.142, 0.270, 0.130, 0.005, 0.012, 0.009, 0.0012), mats.glassEdge, 0, 0, 0, 0, 0, 0, combGroup);
  for (const sx of [-1, 1]) {
    box(0.012, 0.068, 0.011, mats.anodized, sx * 0.142, -0.01, 0, 0, 0, 0, 0.002, combGroup);
  }
  const combPane = new THREE.Mesh(track(new THREE.PlaneGeometry(0.272, 0.132)), mats.hudGlass);
  combGroup.add(combPane);

  const hudSymb = new THREE.Mesh(
    track(new THREE.PlaneGeometry(0.24, 0.105)),
    track(new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.55,
      color: 0x8ff0c3,
      depthWrite: false,
      map: track(labelTexture('HDG 042°  ▸  7812 M/S', 'FPA +1.4°   LVLH LOCK', '#8ff0c3', 512, 256)),
      toneMapped: false,
    })),
  );
  hudSymb.position.z = 0.003;
  combGroup.add(hudSymb);
  screenMeshes.push(hudSymb);

  /* ═══ 3 · SPLIT PADDED KNEE BOLSTERS & UNDER-DASH AVIONICS BAY ═══════════ */

  // Split around center pedestal (x = ±0.21 .. ±0.64) so legs & pedestal fit cleanly!
  for (const s of [-1, 1]) {
    const bolsterPts = [
      new THREE.Vector3(s * 0.215, -0.45, -0.56),
      new THREE.Vector3(s * 0.42, -0.45, -0.58),
      new THREE.Vector3(s * 0.62, -0.44, -0.52),
    ];
    const bolsterProf = filletPolygon2D([
      [-0.036, -0.045, 0.014],
      [0.038, -0.045, 0.016],
      [0.044, 0.038, 0.018],
      [-0.032, 0.042, 0.012],
    ], 0.014, 5);
    mesh(
      sweepProfile(bolsterPts, bolsterProf, { steps: 20, up: new THREE.Vector3(0, 1, 0), caps: true, creaseAngle: 0.95 }),
      mats.leather,
    );

    // Under-dash LRU Avionics Chassis + MIL-DTL-38999 Circular Connectors in each legwell
    const lruX = s * 0.38;
    box(0.24, 0.16, 0.18, mats.hull, lruX, -0.58, -0.82, 0, 0, 0, 0.008);
    for (let f = 0; f < 6; f++) {
      box(0.008, 0.13, 0.02, mats.titanium, lruX - 0.08 + f * 0.032, -0.58, -0.72, 0, 0, 0, 0.002);
    }
    for (let c = 0; c < 2; c++) {
      const conn = buildCircularConnector(0.016, mats.brushed, mats.titanium, mats.rubber);
      conn.rotation.x = Math.PI / 2;
      conn.position.set(lruX - 0.045 + c * 0.09, -0.63, -0.73);
      group.add(conn);
    }
  }

  // Braided Under-Dash Wire Harnesses retained by real Adel MS21919 Cushioned P-Clamps
  for (let b = 0; b < 2; b++) {
    const hPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 8; i++) {
      const x = -0.52 + (i / 8) * 1.04;
      hPts.push(new THREE.Vector3(
        x,
        -0.635 - b * 0.024 + Math.sin(i * 0.9) * 0.006,
        -0.67 - b * 0.018 + Math.cos(i * 1.1) * 0.008,
      ));
    }
    const rad = 0.009 - b * 0.0015;
    const hMesh = tube(hPts, rad, b === 0 ? mats.rubber : mats.caution, 12, 56);
    track(hMesh.geometry);
    group.add(hMesh);

    const curve = new THREE.CatmullRomCurve3(hPts);
    for (const u of [0.18, 0.38, 0.62, 0.82]) {
      const pt = curve.getPointAt(u);
      const clamp = buildAdelClamp(rad, mats.brushed, mats.seal);
      clamp.position.copy(pt);
      group.add(clamp);
    }
  }

  return {
    updateScreen: (section: CockpitSection, throttle: number) => {
      paintScreen(mainCanvas, section, throttle);
      mainTex.needsUpdate = true;
    },
  };
}
