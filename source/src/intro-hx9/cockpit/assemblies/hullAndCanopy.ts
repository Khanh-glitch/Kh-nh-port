import * as THREE from 'three';
import {
  buildCircuitBreaker,
  buildKnob,
  buildKorrySwitch,
  buildToggle,
  cChannelProfile,
  circleHolePath,
  fastenerInstances,
  filletPolygon2D,
  iBeamProfile,
  latheMachined,
  loftSurface,
  loftThickShell,
  machinedBezel,
  machinedPlate,
  polygonToShape,
  roundedRectPath,
  roundedRectShape,
  sweepProfile,
  type BoltPlacement,
  type ProfilePoint,
} from '../geometry';
import { placardTexture } from '../textures';
import { DATUM, hullHalfWidth, hullOuterPoint, SPACEFRAME, type BuildContext } from '../datum';

export function buildHullAndCanopy(ctx: BuildContext): void {
  const { mats, mesh, box, decal, label, track, group } = ctx;

  /* ═══ 1 · STRUCTURAL DECK, FOOTWELL TROUGHS & CHINE LONGERONS ════════════ */

  // Sub-deck structural pan underneath footwells
  box(1.68, 0.045, 2.26, mats.hull, 0, DATUM.deckY - 0.032, -0.04, 0, 0, 0, 0.008);

  // Main CNC-machined deck plate with TWO TRUE CUT-OUT FOOTWELL TROUGHS
  const deckShape = roundedRectShape(1.62, 2.22, 0.04);
  const footwellL = roundedRectPath(-0.23, 0.62, 0.28, 0.56, 0.022);
  const footwellR = roundedRectPath(0.23, 0.62, 0.28, 0.56, 0.022);
  const deckGeo = machinedPlate(deckShape, {
    holes: [footwellL, footwellR],
    depth: 0.036,
    bevel: 0.003,
    centerZ: false,
  });
  // Rotate XY plate onto XZ floor: shape +Y maps to -Z (forward)!
  const deckMesh = mesh(deckGeo, mats.anodized, 0, DATUM.deckY - 0.01, -0.04, -Math.PI / 2, 0, 0);
  void deckMesh;

  // Recessed footwell scuff trays & heel-slide wear strips
  for (const s of [-1, 1]) {
    const wellBezel = machinedBezel(0.30, 0.58, 0.265, 0.545, 0.014, 0.024, 0.018, 0.002);
    mesh(wellBezel, mats.brushed, s * 0.23, DATUM.floorTopY + 0.003, -0.66, -Math.PI / 2, 0, 0);
    // Ribbed titanium heel wear-bars inside each footwell
    for (let k = 0; k < 7; k++) {
      box(0.22, 0.0035, 0.014, mats.titanium, s * 0.23, DATUM.deckY + 0.002, -0.44 - k * 0.042, 0, 0, 0, 0.0012);
    }
  }

  // Removable CNC-milled diamond-tread floor panels with flush perimeter seams
  const treadPositions: [number, number, number, number][] = [
    [-0.53, -0.22, 0.24, 1.38],
    [0.53, -0.22, 0.24, 1.38],
    [0, 0.42, 0.34, 0.96],
  ];
  const deckBolts: BoltPlacement[] = [];
  for (const [tx, tz, tw, td] of treadPositions) {
    const plate = machinedPlate(roundedRectShape(tw, td, 0.014), { depth: 0.007, bevel: 0.0015 });
    mesh(plate, mats.floor, tx, DATUM.floorTopY + 0.001, tz, -Math.PI / 2, 0, 0);
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const bz = tz - td * 0.42 + (i / 3) * td * 0.84;
        deckBolts.push({
          position: new THREE.Vector3(tx + sx * (tw * 0.42), DATUM.floorTopY + 0.008, bz),
          normal: new THREE.Vector3(0, 1, 0),
          scale: 0.82,
        });
      }
    }
  }

  // Longitudinal deck chine I-beams & recessed cargo/harness tie-down D-rings
  const chineI = iBeamProfile(0.044, 0.056, 0.007, 0.006, 0.002);
  for (const s of [-1, 1]) {
    const chinePts: THREE.Vector3[] = [];
    for (let i = 0; i <= 16; i++) {
      const u = i / 16;
      const z = DATUM.fwdZ + 0.06 + u * (DATUM.aftZ - DATUM.fwdZ - 0.12);
      chinePts.push(new THREE.Vector3(s * (hullHalfWidth(z, 0.02) - 0.032), DATUM.deckY + 0.028, z));
    }
    mesh(sweepProfile(chinePts, chineI, { steps: 32, up: new THREE.Vector3(0, 1, 0), caps: true }), mats.hull);

    // Forged tie-down D-rings seated in turned counterbored cups
    for (let i = 0; i < 3; i++) {
      const rz = -0.78 + i * 0.68;
      const rx = s * 0.66;
      mesh(
        latheMachined([
          [0.001, 0],
          [0.028, 0],
          [0.028, 0.004],
          [0.021, 0.004],
          [0.019, 0.001],
          [0.001, 0.001],
        ], 20),
        mats.anodized,
        rx,
        DATUM.floorTopY + 0.002,
        rz,
      );
      const dRing = new THREE.Mesh(track(new THREE.TorusGeometry(0.015, 0.0032, 8, 20, Math.PI * 1.35)), mats.brushed);
      dRing.position.set(rx, DATUM.floorTopY + 0.006, rz);
      dRing.rotation.x = Math.PI / 2 - 0.18;
      group.add(dRing);
    }
  }
  group.add(fastenerInstances(deckBolts, mats.brushed, 0.0046, 0.0034));

  /* ═══ 2 · BARREL PRESSURE SHELL, RING FORMERS & SILL COAMING ═════════════ */

  const frameStationsZ = [-1.02, -0.58, -0.18, 0.28, 0.74];
  const frameChannel = cChannelProfile(0.032, 0.046, 0.0055, 0.002);
  const sillBolts: BoltPlacement[] = [];

  for (const s of [-1, 1]) {
    // 24 mm thick watertight double-curvature pressure hull shell
    const shellGeo = loftThickShell(
      (u, v, out) => {
        if (s > 0) hullOuterPoint(1, u, v, out);
        else hullOuterPoint(-1, 1 - u, v, out);
      },
      0.024,
      36,
      18,
      0.72,
    );
    mesh(shellGeo, mats.shell);

    // 5 Transverse C-Channel Ring Formers swept along inner hull contour
    for (const fz of frameStationsZ) {
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k <= 12; k++) {
        const v = k / 12;
        const y = DATUM.deckY + 0.02 + v * (DATUM.sillY - DATUM.deckY - 0.03);
        const x = s * (hullHalfWidth(fz, v) - 0.034);
        pts.push(new THREE.Vector3(x, y, fz));
      }
      mesh(
        sweepProfile(pts, frameChannel, { steps: 24, up: new THREE.Vector3(0, 0, 1), caps: true }),
        mats.hull,
      );

      // Machined triangular knee gusset with circular lightening hole at sill & deck!
      const gussetShape = polygonToShape([
        [0, 0, 0.005],
        [0.095, 0, 0.006],
        [0, -0.11, 0.006],
      ], 0.005, 4);
      const gussetGeo = machinedPlate(gussetShape, {
        holes: [circleHolePath(0.028, -0.032, 0.015)],
        depth: 0.008,
        bevel: 0.0014,
        centerZ: true,
      });
      const sillX = s * (hullHalfWidth(fz, 0.96) - 0.028);
      const gMesh = mesh(gussetGeo, mats.titanium, sillX, DATUM.sillY - 0.015, fz);
      if (s > 0) gMesh.rotation.y = Math.PI;
    }

    // Quilted Nomex acoustic/thermal liner cushions seated cleanly between frames
    for (const [z0, z1] of [[-1.0, -0.60], [0.30, 0.72]] as [number, number][]) {
      for (let padIdx = 0; padIdx < 3; padIdx++) {
        const vLow = 0.16 + padIdx * 0.24;
        const vHigh = vLow + 0.21;
        const padGeo = loftThickShell(
          (u, v, out) => {
            const uu = s > 0 ? u : 1 - u;
            const z = z0 + uu * (z1 - z0);
            const vv = vLow + v * (vHigh - vLow);
            const pillow = Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * 0.009;
            const y = DATUM.deckY + vv * (DATUM.sillY - DATUM.deckY);
            const x = s * (hullHalfWidth(z, vv) - 0.026 - pillow);
            out.set(x, y, z);
          },
          0.012,
          14,
          8,
          0.95,
        );
        mesh(padGeo, mats.fabric);
      }
    }

    // Flush-hinged Avionics / ECLSS Pressurized Bay Door between z = -0.55..-0.21
    const doorZ = -0.38;
    const doorX = s * (hullHalfWidth(doorZ, 0.62) - 0.035);
    const doorFrame = machinedBezel(0.32, 0.30, 0.27, 0.25, 0.012, 0.016, 0.01, 0.002);
    mesh(doorFrame, mats.anodized, doorX, -0.49, doorZ, 0, s * (-Math.PI / 2), 0);
    const doorLeaf = machinedPlate(roundedRectShape(0.264, 0.244, 0.009), { depth: 0.01, bevel: 0.0018, centerZ: true });
    mesh(doorLeaf, mats.panel, doorX - s * 0.003, -0.49, doorZ, 0, s * (-Math.PI / 2), 0);

    // Recessed trigger paddle latch on bay door
    mesh(
      latheMachined([
        [0.001, 0],
        [0.02, 0],
        [0.02, 0.006],
        [0.014, 0.006],
        [0.013, 0.002],
        [0.001, 0.002],
      ], 20),
      mats.brushed,
      doorX - s * 0.008,
      -0.49,
      doorZ + 0.075,
      0,
      0,
      s * (Math.PI / 2),
    );
    box(0.006, 0.014, 0.036, mats.caution, doorX - s * 0.011, -0.49, doorZ + 0.075, 0, 0, 0, 0.002);

    // Correctly oriented FrontSide placard facing INWARD toward pilot (-s * X)!
    const bayPlacard = track(placardTexture(['BAY B-04', '540V / ECLSS', 'ISOLATE BUS'], '#ffc16b', 320, 144));
    const bp = decal(bayPlacard, 0.12, 0.054);
    bp.position.set(doorX - s * 0.011, -0.43, doorZ - 0.03);
    bp.rotation.y = s < 0 ? Math.PI / 2 : -Math.PI / 2;

    // Continuous CNC-Milled Canopy Sill Longeron + Extruded EPDM Bulb Pressure Seal
    const sillPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 24; i++) {
      const u = i / 24;
      const z = DATUM.fwdZ + 0.04 + u * (DATUM.aftZ - DATUM.fwdZ - 0.06);
      sillPts.push(new THREE.Vector3(s * (hullHalfWidth(z, 1) - 0.012), DATUM.sillY, z));
    }
    const sillProfile = filletPolygon2D([
      [-0.032, -0.022, 0.004],
      [0.028, -0.022, 0.004],
      [0.032, 0.012, 0.005],
      [0.014, 0.022, 0.004],
      [0.012, 0.008, 0.002],
      [-0.010, 0.008, 0.002], // Z-groove rabbet for EPDM seal!
      [-0.012, 0.020, 0.003],
      [-0.028, 0.018, 0.005],
    ], 0.003, 3);
    mesh(sweepProfile(sillPts, sillProfile, { steps: 48, up: new THREE.Vector3(0, 1, 0), caps: true }), mats.brushed);

    // Compressed hollow-bulb silicone pressure gasket seated directly inside the sill Z-rabbet!
    const bulbSealProfile = filletPolygon2D([
      [-0.010, 0, 0.002],
      [0.010, 0, 0.002],
      [0.013, 0.009, 0.004],
      [0.007, 0.018, 0.005],
      [-0.007, 0.018, 0.005],
      [-0.013, 0.009, 0.004],
    ], 0.003, 4);
    mesh(
      sweepProfile(
        sillPts.map((p) => new THREE.Vector3(p.x, p.y + 0.009, p.z)),
        bulbSealProfile,
        { steps: 48, up: new THREE.Vector3(0, 1, 0), caps: true, creaseAngle: 1.1 },
      ),
      mats.seal,
    );

    // Sill flange fasteners at uniform structural pitch
    for (let i = 0; i < 14; i++) {
      const z = -1.04 + (i / 13) * 1.98;
      sillBolts.push({
        position: new THREE.Vector3(s * (hullHalfWidth(z, 1) - 0.032), DATUM.sillY + 0.018, z),
        normal: new THREE.Vector3(s * -0.35, 0.94, 0).normalize(),
        scale: 0.85,
      });
    }

    // Swept D-section Ingress/Zero-G Restraint Grab Bar mounted on machined standoffs
    const grabStart = new THREE.Vector3(s * (hullHalfWidth(-0.84, 0.92) - 0.05), -0.31, -0.84);
    const grabMid1 = new THREE.Vector3(s * (hullHalfWidth(-0.66, 0.92) - 0.095), -0.30, -0.68);
    const grabMid2 = new THREE.Vector3(s * (hullHalfWidth(-0.44, 0.92) - 0.095), -0.30, -0.44);
    const grabEnd = new THREE.Vector3(s * (hullHalfWidth(-0.28, 0.92) - 0.05), -0.31, -0.28);
    const grabProfile = filletPolygon2D([
      [-0.009, -0.011, 0.004],
      [0.009, -0.011, 0.004],
      [0.011, 0.011, 0.005],
      [-0.011, 0.011, 0.005],
    ], 0.004, 4);
    mesh(
      sweepProfile([grabStart, grabMid1, grabMid2, grabEnd], grabProfile, {
        steps: 28,
        up: new THREE.Vector3(0, 1, 0),
        caps: true,
      }),
      mats.titanium,
    );
    for (const gp of [grabStart, grabEnd]) {
      mesh(
        latheMachined([[0.001, 0], [0.022, 0], [0.020, 0.008], [0.013, 0.016], [0.001, 0.016]], 18),
        mats.anodized,
        gp.x + s * 0.012,
        gp.y,
        gp.z,
        0,
        0,
        s * (Math.PI / 2),
      );
    }
  }
  group.add(fastenerInstances(sillBolts, mats.brushed, 0.0046, 0.0035));

  /* ═══ 3 · CLOSED LOAD-BEARING CANOPY SPACEFRAME & WINDOW FORGINGS ════════ */

  // Structural hollow-flanged trapezoidal mullion section with glazing step!
  const mullionSection = filletPolygon2D([
    [-0.024, -0.028, 0.004],
    [0.024, -0.028, 0.004],
    [0.028, -0.008, 0.003],
    [0.018, -0.006, 0.002], // Glazing step shoulder
    [0.016, 0.022, 0.004],
    [0.008, 0.030, 0.004],
    [-0.008, 0.030, 0.004],
    [-0.016, 0.022, 0.004],
    [-0.018, -0.006, 0.002],
    [-0.028, -0.008, 0.003],
  ], 0.003, 3);

  const sealBeadSection = filletPolygon2D([
    [-0.008, -0.005, 0.003],
    [0.008, -0.005, 0.003],
    [0.009, 0.006, 0.003],
    [-0.009, 0.006, 0.003],
  ], 0.003, 3);

  const glassRimSection: ProfilePoint[] = [
    [-0.005, -0.005],
    [0.005, -0.005],
    [0.005, 0.005],
    [-0.005, 0.005],
  ];

  // Helper to evaluate smooth pillar curves so frames, seals & glass panes share EXACT boundaries!
  const evalAPillar = (s: number, t: number) => {
    const p0 = SPACEFRAME.aBase(s);
    const p3 = SPACEFRAME.aTop(s);
    const curve = new THREE.CatmullRomCurve3([
      p0,
      new THREE.Vector3(s * 0.74, 0.03, -1.05),
      new THREE.Vector3(s * 0.65, 0.30, -1.00),
      new THREE.Vector3(s * 0.55, 0.46, -0.94),
      p3,
    ]);
    return curve.getPointAt(t);
  };

  const evalBPillar = (s: number, t: number) => {
    const curve = new THREE.CatmullRomCurve3([
      SPACEFRAME.bBase(s),
      new THREE.Vector3(s * 0.78, 0.09, -0.18),
      new THREE.Vector3(s * 0.63, 0.40, -0.18),
      SPACEFRAME.bTop(s),
    ]);
    return curve.getPointAt(t);
  };

  const evalCPillar = (s: number, t: number) => {
    const curve = new THREE.CatmullRomCurve3([
      SPACEFRAME.cBase(s),
      new THREE.Vector3(s * 0.75, 0.10, 0.74),
      new THREE.Vector3(s * 0.60, 0.41, 0.74),
      SPACEFRAME.cTop(s),
    ]);
    return curve.getPointAt(t);
  };

  const evalHeaderBow = (u: number) => {
    // u in [0,1] from left aTop(-1) to right aTop(+1)
    const x = -0.46 + u * 0.92;
    const arch = 1 - Math.pow(x / 0.46, 2);
    return new THREE.Vector3(x, 0.54 + arch * 0.055, -0.90 - arch * 0.065);
  };

  const evalFwdCowlBow = (u: number) => {
    const x = -hullHalfWidth(-1.04, 1) + u * 2 * hullHalfWidth(-1.04, 1);
    const arch = 1 - Math.pow(x / hullHalfWidth(-1.04, 1), 2);
    return new THREE.Vector3(x, DATUM.sillY + arch * 0.16, -1.04 - arch * 0.08);
  };

  const evalCrownLongeron = (s: number, u: number) => {
    const curve = new THREE.CatmullRomCurve3([
      SPACEFRAME.aTop(s),
      SPACEFRAME.bTop(s),
      new THREE.Vector3(s * 0.38, 0.64, 0.28),
      SPACEFRAME.cTop(s),
    ]);
    return curve.getPointAt(u);
  };

  // Sweep Forward Header Bow + Seal + Beveled Glass Edge + Header Bolts
  const headerPts = Array.from({ length: 25 }, (_, i) => evalHeaderBow(i / 24));
  mesh(sweepProfile(headerPts, mullionSection, { steps: 42, up: new THREE.Vector3(0, 1, 0), caps: true }), mats.hull);
  mesh(
    sweepProfile(headerPts.map((p) => p.clone().add(new THREE.Vector3(0, -0.028, 0.008))), sealBeadSection, {
      steps: 42,
      up: new THREE.Vector3(0, 1, 0),
      caps: true,
    }),
    mats.seal,
  );
  mesh(
    sweepProfile(headerPts.map((p) => p.clone().add(new THREE.Vector3(0, -0.036, 0.008))), glassRimSection, {
      steps: 42,
      up: new THREE.Vector3(0, 1, 0),
    }),
    mats.glassEdge,
  );

  // Forward Lower Windshield Sill / Cowling Ring
  const fwdCowlPts = Array.from({ length: 25 }, (_, i) => evalFwdCowlBow(i / 24));
  mesh(sweepProfile(fwdCowlPts, mullionSection, { steps: 42, up: new THREE.Vector3(0, 1, 0), caps: true }), mats.castAl);

  // Rear Canopy Roll-Hoop Crown Arch connecting cTop(-1) <-> cTop(+1)
  const rearArchPts: THREE.Vector3[] = [];
  for (let i = 0; i <= 18; i++) {
    const u = i / 18;
    const x = -0.37 + u * 0.74;
    const arch = 1 - Math.pow(x / 0.37, 2);
    rearArchPts.push(new THREE.Vector3(x, 0.63 + arch * 0.045, 0.74));
  }
  mesh(sweepProfile(rearArchPts, mullionSection, { steps: 32, up: new THREE.Vector3(0, 1, 0), caps: true }), mats.hull);

  const canopyBolts: BoltPlacement[] = [];
  for (let i = 0; i < 13; i++) {
    const p = evalHeaderBow((i + 0.5) / 13);
    canopyBolts.push({
      position: new THREE.Vector3(p.x, p.y - 0.004, p.z + 0.029),
      normal: new THREE.Vector3(0, -0.25, 0.97).normalize(),
      scale: 0.85,
    });
  }

  // Port & Starboard A-Pillars, B-Pillars, C-Pillars, Crown Longerons, Gussets, Latches & Glazing!
  for (const s of [-1, 1]) {
    const aPts = Array.from({ length: 21 }, (_, i) => evalAPillar(s, i / 20));
    const bPts = Array.from({ length: 17 }, (_, i) => evalBPillar(s, i / 16));
    const cPts = Array.from({ length: 17 }, (_, i) => evalCPillar(s, i / 16));
    const crownPts = Array.from({ length: 25 }, (_, i) => evalCrownLongeron(s, i / 24));

    mesh(sweepProfile(aPts, mullionSection, { steps: 36, up: new THREE.Vector3(0, 0, 1), caps: true }), mats.hull);
    mesh(sweepProfile(bPts, mullionSection, { steps: 28, up: new THREE.Vector3(0, 0, 1), caps: true }), mats.hull);
    mesh(sweepProfile(cPts, mullionSection, { steps: 28, up: new THREE.Vector3(0, 0, 1), caps: true }), mats.hull);
    mesh(sweepProfile(crownPts, mullionSection, { steps: 40, up: new THREE.Vector3(0, 1, 0), caps: true }), mats.hull);

    // Inner EPDM glazing seals + beveled glass thickness strips along A & B pillars
    mesh(
      sweepProfile(aPts.map((p) => p.clone().add(new THREE.Vector3(-s * 0.02, -0.006, 0.01))), sealBeadSection, {
        steps: 34,
        up: new THREE.Vector3(0, 0, 1),
      }),
      mats.seal,
    );
    mesh(
      sweepProfile(aPts.map((p) => p.clone().add(new THREE.Vector3(-s * 0.026, -0.008, 0.012))), glassRimSection, {
        steps: 34,
        up: new THREE.Vector3(0, 0, 1),
      }),
      mats.glassEdge,
    );

    // CNC-Machined 3-Way Spaceframe Node Gussets at A-top, B-top and C-top!
    for (const node of [SPACEFRAME.aTop(s), SPACEFRAME.bTop(s), SPACEFRAME.cTop(s)]) {
      const nodePlate = machinedPlate(roundedRectShape(0.088, 0.056, 0.012), {
        holes: [circleHolePath(-0.02, 0, 0.011), circleHolePath(0.02, 0, 0.011)],
        depth: 0.012,
        bevel: 0.002,
        centerZ: true,
      });
      mesh(nodePlate, mats.titanium, node.x - s * 0.014, node.y - 0.018, node.z, 0, Math.PI / 2, s * 0.42);
      for (const dz of [-0.032, 0.032]) {
        canopyBolts.push({
          position: new THREE.Vector3(node.x - s * 0.021, node.y - 0.016, node.z + dz),
          normal: new THREE.Vector3(-s * 0.9, -0.42, 0).normalize(),
          scale: 0.8,
        });
      }
    }

    // Kinematic Over-Center Canopy Hook Latch Assemblies (A-pillar & Mid-sill)
    const latchConfigs = [
      { pos: evalAPillar(s, 0.34), rot: [0.36, s * -0.18, s * 0.24] as [number, number, number], code: 'LATCH 01' },
      { pos: new THREE.Vector3(s * (hullHalfWidth(0.24, 1) - 0.024), DATUM.sillY + 0.028, 0.24), rot: [0, 0, s * 0.08] as [number, number, number], code: 'LATCH 02' },
    ];

    for (const lc of latchConfigs) {
      const lg = new THREE.Group();
      lg.position.copy(lc.pos);
      lg.rotation.set(...lc.rot);
      group.add(lg);

      // Machined clevis housing with open slot for hook & lever
      const sideCheek = machinedPlate(
        polygonToShape([
          [-0.018, -0.026, 0.004],
          [0.018, -0.026, 0.004],
          [0.022, 0.028, 0.005],
          [-0.016, 0.024, 0.005],
        ], 0.004, 4),
        { holes: [circleHolePath(0, 0.004, 0.0065)], depth: 0.007, bevel: 0.0012, centerZ: true },
      );
      mesh(sideCheek, mats.anodized, -s * 0.012, 0, -0.02, 0, Math.PI / 2, 0, lg);
      mesh(sideCheek.clone(), mats.anodized, -s * 0.012, 0, 0.02, 0, Math.PI / 2, 0, lg);

      // Striker pin & engaged Ti-6Al-4V locking hook claw
      mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.048, 14), mats.brushed, -s * 0.012, 0.016, 0, Math.PI / 2, 0, 0, lg);
      const hookShape = polygonToShape([
        [-0.008, -0.018, 0.002],
        [0.012, -0.018, 0.003],
        [0.016, 0.018, 0.004],
        [0.003, 0.026, 0.004],
        [-0.008, 0.018, 0.003],
        [-0.002, 0.011, 0.002],
        [0.006, 0.012, 0.002],
        [0.005, 0.002, 0.002],
        [-0.008, 0.001, 0.002],
      ], 0.002, 3);
      mesh(machinedPlate(hookShape, { depth: 0.012, bevel: 0.0012, centerZ: true }), mats.titanium, -s * 0.012, 0.002, 0, 0, Math.PI / 2, 0, lg);

      // Milled U-channel amber over-center release lever handle
      const handleProf = cChannelProfile(0.022, 0.014, 0.0028, 0.0015);
      mesh(
        sweepProfile(
          [
            new THREE.Vector3(-s * 0.024, -0.006, -0.008),
            new THREE.Vector3(-s * 0.032, -0.024, 0.022),
            new THREE.Vector3(-s * 0.030, -0.034, 0.056),
          ],
          handleProf,
          { steps: 14, up: new THREE.Vector3(1, 0, 0), caps: true },
        ),
        mats.caution,
        0,
        0,
        0,
        0,
        0,
        0,
        lg,
      );
      void lc.code;
    }

    // Forward Quarter Side Glazing (bounded cleanly by A-pillar, B-pillar, Sill & Crown!)
    const fwdSideGlass = loftSurface(
      (u, v, out) => {
        const pA = evalAPillar(s, v);
        const pB = evalBPillar(s, v);
        out.lerpVectors(pA, pB, u);
      },
      16,
      14,
    );
    mesh(fwdSideGlass, mats.glass);

    // Aft Side Observation Glazing (bounded cleanly by B-pillar, C-pillar, Sill & Crown!)
    const aftSideGlass = loftSurface(
      (u, v, out) => {
        const pB = evalBPillar(s, v);
        const pC = evalCPillar(s, v);
        out.lerpVectors(pB, pC, u);
      },
      16,
      14,
    );
    mesh(aftSideGlass, mats.glass);
  }

  // Forward Compound-Curved Windshield Glazing (bounded by FwdCowlBow, HeaderBow & both A-Pillars)
  const windshieldGeo = loftSurface(
    (u, v, out) => {
      // Coons patch interpolation so all 4 edges sit 100% inside the frame rabbets!
      const cBot = evalFwdCowlBow(u);
      const cTop = evalHeaderBow(u);
      const cLeft = evalAPillar(-1, v);
      const cRight = evalAPillar(1, v);
      const b00 = evalFwdCowlBow(0);
      const b10 = evalFwdCowlBow(1);
      const b01 = evalHeaderBow(0);
      const b11 = evalHeaderBow(1);

      const ruledUV = new THREE.Vector3().lerpVectors(cBot, cTop, v);
      const ruledVU = new THREE.Vector3().lerpVectors(cLeft, cRight, u);
      const bilin = new THREE.Vector3()
        .addScaledVector(b00, (1 - u) * (1 - v))
        .addScaledVector(b10, u * (1 - v))
        .addScaledVector(b01, (1 - u) * v)
        .addScaledVector(b11, u * v);

      out.copy(ruledUV).add(ruledVU).sub(bilin);
    },
    28,
    18,
  );
  mesh(windshieldGeo, mats.glass);
  group.add(fastenerInstances(canopyBolts, mats.brushed, 0.0048, 0.0036));

  /* ═══ 4 · OVERHEAD BUS & CIRCUIT-BREAKER STRUCTURAL BRIDGE ═══════════════ */

  // Structural bridge bolted directly between Crown Longerons at z = -0.28, y = +0.54
  const ovhBridge = new THREE.Group();
  ovhBridge.position.set(0, 0.54, -0.28);
  ovhBridge.rotation.x = 0.68; // 39 deg cant toward pilot Design Eye Point!
  group.add(ovhBridge);

  // Side mounting gusset brackets connecting bridge directly to Crown Longerons (x = ±0.38)
  for (const s of [-1, 1]) {
    const bracketShape = polygonToShape([
      [-0.14, -0.025, 0.008],
      [0.14, -0.025, 0.008],
      [0.11, 0.085, 0.012],
      [-0.11, 0.085, 0.012],
    ], 0.008, 4);
    const bracketGeo = machinedPlate(bracketShape, {
      holes: [circleHolePath(-0.045, 0.032, 0.018), circleHolePath(0.045, 0.032, 0.018)],
      depth: 0.012,
      bevel: 0.002,
      centerZ: true,
    });
    mesh(bracketGeo, mats.hull, s * 0.365, 0.032, 0, 0, Math.PI / 2, s * -0.14, ovhBridge);
  }

  // Main CNC-pocketed overhead bridge chassis (0.72 m span across crown longerons)
  const ovhChassis = machinedPlate(roundedRectShape(0.71, 0.31, 0.018), {
    depth: 0.038,
    bevel: 0.0035,
    centerZ: false,
  });
  mesh(ovhChassis, mats.hull, 0, -0.036, 0, Math.PI / 2, 0, 0, ovhBridge);

  // Outer perimeter Dzus rail frame
  const ovhRail = machinedBezel(0.70, 0.30, 0.65, 0.25, 0.012, 0.016, 0.01, 0.002);
  mesh(ovhRail, mats.anodized, 0, 0.004, 0, Math.PI / 2, 0, 0, ovhBridge);

  // Three modular sub-panels (Left: Guarded Bus Ties, Center: Pyro & Lighting, Right: CB Matrix)
  for (const px of [-0.215, 0, 0.215]) {
    const subPlate = machinedPlate(roundedRectShape(0.205, 0.242, 0.008), { depth: 0.008, bevel: 0.0015 });
    mesh(subPlate, mats.panel, px, 0.008, 0, Math.PI / 2, 0, 0, ovhBridge);
  }

  // Left sub-panel: Guarded Bus Tie & Fuel Cell / Reactor switches
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 3; c++) {
      const isCrit = r === 0 && c === 1;
      const sw = buildToggle(
        mats.brushed,
        isCrit ? mats.caution : mats.white,
        r === 0 ? (isCrit ? mats.caution : mats.anodized) : null,
        isCrit,
      );
      sw.scale.setScalar(0.84);
      sw.position.set(-0.275 + c * 0.06, 0.009, -0.055 + r * 0.085);
      ovhBridge.add(sw);
    }
  }

  // Center sub-panel: Korry master bus annunciators + dual floodlight dimmer knobs
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 3; c++) {
      const korry = buildKorrySwitch(
        0.042,
        0.026,
        mats.anodized,
        c === 1 && r === 0 ? mats.warm : mats.green,
        mats.dark,
      );
      korry.position.set(-0.062 + c * 0.062, 0.008, -0.072 + r * 0.052);
      ovhBridge.add(korry);
    }
  }
  for (const kx of [-0.048, 0.048]) {
    const dimmer = buildKnob(0.018, 0.016, mats.anodized, mats.warm, 'fluted');
    dimmer.position.set(kx, 0.009, 0.065);
    ovhBridge.add(dimmer);
  }

  // Right sub-panel: 3x4 Thermal Pull-Type Circuit Breaker Matrix
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      const cb = buildCircuitBreaker(mats.brushed, mats.white, mats.anodized, r === 1 && c === 2);
      cb.position.set(0.145 + c * 0.046, 0.009, -0.068 + r * 0.062);
      ovhBridge.add(cb);
    }
  }

  const ovhLbl = label('OVERHEAD BUS', '540V SSPC · GUARDED PYRO', 0.19, 0.034, '#8ff0c3');
  const ovhDec = decal(ovhLbl.texture, ovhLbl.w, ovhLbl.h, ovhBridge);
  ovhDec.position.set(0, 0.011, 0.112);
  ovhDec.rotation.x = -Math.PI / 2;
}
