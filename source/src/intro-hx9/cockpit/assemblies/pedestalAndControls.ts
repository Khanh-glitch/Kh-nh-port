import * as THREE from 'three';
import {
  buildCircuitBreaker,
  buildKnob,
  buildKorrySwitch,
  buildToggle,
  circleHolePath,
  corrugatedTube,
  fastenerInstances,
  filletPolygon2D,
  latheMachined,
  loftStations,
  machinedBezel,
  machinedPlate,
  polygonToShape,
  roundedRectPath,
  roundedRectShape,
  sweepProfile,
  tTrackProfile,
  type BoltPlacement,
  type LoftStation,
} from '../geometry';
import { cduScreenTexture } from '../textures';
import { DATUM, hullHalfWidth, type BuildContext } from '../datum';

export interface ControlHandles {
  setThrottle: (value: number) => void;
}

export function buildPedestalAndControls(ctx: BuildContext): ControlHandles {
  const { mats, mesh, box, decal, label, track, group, screenMeshes } = ctx;

  /* ═══ 1 · STRUCTURAL CENTER CONTROL PEDESTAL & FMS/CDU BAY ═══════════════ */

  const ped = new THREE.Group();
  ped.position.set(0, 0, 0);
  group.add(ped);

  // Flanged floor mounting base rails anchoring pedestal to deck spine (y = -0.90)
  for (const sx of [-1, 1]) {
    box(0.036, 0.024, 0.72, mats.brushed, sx * 0.195, DATUM.floorTopY + 0.012, -0.25, 0, 0, 0, 0.004, ped);
  }
  const pedBolts: BoltPlacement[] = [];
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      pedBolts.push({
        position: new THREE.Vector3(sx * 0.202, DATUM.floorTopY + 0.024, -0.56 + i * 0.155),
        normal: new THREE.Vector3(0, 1, 0),
        scale: 0.78,
      });
    }
  }

  // Side-profile stepped monocoque pedestal body: slopes up at 34° forward into MIP throat!
  // Profile in (Z, Y) extruded across X (-0.19 .. +0.19)
  const pedSideShape = polygonToShape([
    [-0.62, DATUM.floorTopY, 0.008],
    [0.08, DATUM.floorTopY, 0.012],
    [0.08, -0.49, 0.016],
    [-0.35, -0.48, 0.014],
    [-0.54, -0.37, 0.016],
    [-0.63, -0.37, 0.010],
  ], 0.01, 4);
  const pedShellGeo = machinedPlate(pedSideShape, {
    depth: 0.38,
    bevel: 0.006,
    centerZ: true,
  });
  // Rotate so shape (X=z, Y=y) maps to world (Z, Y) and extrusion Z maps to world X!
  mesh(pedShellGeo, mats.carbon, 0, 0, 0, 0, Math.PI / 2, 0, ped);

  // Side aluminium Dzus cheek rails & inspection access plates on pedestal sides
  for (const sx of [-1, 1]) {
    const cheekPlate = machinedPlate(roundedRectShape(0.42, 0.24, 0.012), {
      depth: 0.008,
      bevel: 0.0015,
      centerZ: true,
    });
    mesh(cheekPlate, mats.panel, sx * 0.192, -0.69, -0.22, 0, Math.PI / 2, 0, ped);

    // Swept Ti-6Al-4V knee/hand-hold guard rails properly parented to `ped`!
    const railPts = [
      new THREE.Vector3(sx * 0.202, -0.48, 0.05),
      new THREE.Vector3(sx * 0.205, -0.47, -0.33),
      new THREE.Vector3(sx * 0.202, -0.365, -0.55),
    ];
    const dRail = filletPolygon2D([
      [-0.008, -0.009, 0.003],
      [0.008, -0.009, 0.003],
      [0.009, 0.009, 0.004],
      [-0.009, 0.009, 0.004],
    ], 0.003, 3);
    mesh(sweepProfile(railPts, dRail, { steps: 24, up: new THREE.Vector3(0, 1, 0), caps: true }), mats.titanium, 0, 0, 0, 0, 0, 0, ped);
  }

  /* ── Forward Sloped FMS / Manoeuvre CDU Bay (34° Tilt, z = -0.45) ──────── */
  const cduBay = new THREE.Group();
  cduBay.position.set(0, -0.424, -0.455);
  cduBay.rotation.x = -0.96; // Faces up/aft toward pilot Design Eye Point!
  ped.add(cduBay);

  mesh(machinedPlate(roundedRectShape(0.35, 0.21, 0.012), { depth: 0.014, bevel: 0.002 }), mats.anodized, 0, 0, 0, 0, 0, 0, cduBay);

  // Left side of CDU bay: FMS Display + LSK keys; Right side: 24-key tactile keypad
  mesh(machinedBezel(0.19, 0.145, 0.152, 0.114, 0.010, 0.008, 0.005, 0.0015), mats.bezel, -0.068, 0.018, 0.016, 0, 0, 0, cduBay);
  const cduTex = track(cduScreenTexture());
  const cduScr = new THREE.Mesh(
    track(new THREE.PlaneGeometry(0.152, 0.114)),
    track(new THREE.MeshBasicMaterial({ map: cduTex, toneMapped: false })),
  );
  cduScr.position.set(-0.068, 0.018, 0.014);
  cduBay.add(cduScr);
  screenMeshes.push(cduScr);

  // Line-Select Keys flanking CDU screen
  for (const sx of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      box(0.010, 0.015, 0.005, mats.brushed, -0.068 + sx * 0.086, -0.032 + k * 0.028, 0.020, 0, 0, 0, 0.0012, cduBay);
    }
  }

  // Sculpted 4x6 Tactile Alphanumeric Keypad Matrix on right half of CDU bay
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 4; c++) {
      const isExec = r === 0 && c === 3;
      box(
        0.021,
        0.016,
        0.0065,
        isExec ? mats.green : r === 0 ? mats.caution : mats.panel,
        0.054 + c * 0.028,
        -0.062 + r * 0.026,
        0.017,
        0,
        0,
        0,
        0.0018,
        cduBay,
      );
    }
  }

  /* ── Aft Horizontal Flight-Control Deck: Slotted Throttles, Trim & Ball ── */
  const topDeckPlate = machinedPlate(roundedRectShape(0.36, 0.41, 0.012), {
    depth: 0.014,
    bevel: 0.002,
  });
  mesh(topDeckPlate, mats.anodized, 0, -0.484, -0.14, -Math.PI / 2, 0, 0, ped);

  // Dual-Slot CNC Throttle Quadrant Gate Plate (TWO REAL CUT-THROUGH SLOTS!)
  const tqGroup = new THREE.Group();
  tqGroup.position.set(-0.068, -0.47, -0.20);
  ped.add(tqGroup);

  const tqShape = roundedRectShape(0.175, 0.21, 0.012);
  const slotL = roundedRectPath(-0.036, 0, 0.018, 0.155, 0.005);
  const slotR = roundedRectPath(0.036, 0, 0.018, 0.155, 0.005);
  const tqGate = machinedPlate(tqShape, {
    holes: [slotL, slotR],
    depth: 0.024,
    bevel: 0.0022,
  });
  mesh(tqGate, mats.bezel, 0, 0, 0, -Math.PI / 2, 0, 0, tqGroup);

  // Dark recessed drum cavity underneath the open slots + notched detent comb teeth
  box(0.14, 0.028, 0.17, mats.dark, 0, -0.016, 0, 0, 0, 0, 0.004, tqGroup);
  for (let d = 0; d < 6; d++) {
    const dz = -0.065 + d * 0.026;
    box(0.022, 0.0035, 0.005, mats.titanium, 0, 0.025, dz, 0, 0, 0, 0.001, tqGroup);
  }

  // Spoked Star Friction-Lock Wheel on starboard cheek of throttle housing
  const fricWheel = buildKnob(0.020, 0.012, mats.brushed, mats.caution, 'fluted');
  fricWheel.rotation.z = -Math.PI / 2;
  fricWheel.position.set(0.092, 0.012, 0.02);
  tqGroup.add(fricWheel);

  // Twin CNC-Milled Pocketed Throttle Levers + Contoured Cross-Barrel Grips
  const levers: THREE.Group[] = [];
  for (let i = 0; i < 2; i++) {
    const pivot = new THREE.Group();
    pivot.position.set(-0.036 + i * 0.072, -0.012, 0.02);
    tqGroup.add(pivot);

    // Side-pocketed CNC lever web rising out of the slot!
    const armShape = polygonToShape([
      [-0.014, 0, 0.003],
      [0.014, 0, 0.003],
      [0.011, 0.122, 0.004],
      [-0.013, 0.122, 0.004],
    ], 0.003, 3);
    const armGeo = machinedPlate(armShape, {
      holes: [roundedRectPath(0, 0.052, 0.009, 0.042, 0.003), circleHolePath(0, 0.094, 0.0045)],
      depth: 0.012,
      bevel: 0.0014,
      centerZ: true,
    });
    mesh(armGeo, mats.brushed, 0, 0, 0, 0, Math.PI / 2, 0, pivot);

    // Forefinger Idle/Reverse Gate Latch Trigger Bar ahead of stem
    box(0.006, 0.052, 0.006, mats.caution, 0, 0.086, -0.015, -0.08, 0, 0, 0.0015, pivot);

    // Sculpted Horizontal Cross-Barrel Ergonomic Grip (Boeing / Shuttle style, NOT a vertical pill!)
    const gripProf = filletPolygon2D([
      [-0.017, -0.014, 0.006],
      [0.019, -0.014, 0.006],
      [0.021, 0.015, 0.007],
      [-0.015, 0.016, 0.006],
    ], 0.006, 4);
    const gx0 = i === 0 ? -0.030 : -0.026;
    const gx1 = i === 0 ? 0.026 : 0.030;
    mesh(
      sweepProfile(
        [new THREE.Vector3(gx0, 0.126, -0.004), new THREE.Vector3(gx1, 0.126, -0.004)],
        gripProf,
        { steps: 12, up: new THREE.Vector3(0, 1, 0), caps: true, creaseAngle: 1.0 },
      ),
      mats.rubber,
      0,
      0,
      0,
      0,
      0,
      0,
      pivot,
    );

    // Anodized Lane Identification End-Collar & Auto-Throttle Disconnect Thumb Switch
    const collarX = i === 0 ? gx0 - 0.003 : gx1 + 0.003;
    mesh(
      new THREE.CylinderGeometry(0.015, 0.015, 0.005, 20),
      i === 0 ? mats.warm : mats.cyan,
      collarX,
      0.126,
      -0.004,
      0,
      0,
      Math.PI / 2,
      pivot,
    );
    mesh(
      new THREE.CylinderGeometry(0.0065, 0.0065, 0.005, 14),
      mats.red,
      i === 0 ? gx1 + 0.002 : gx0 - 0.002,
      0.126,
      -0.004,
      0,
      0,
      Math.PI / 2,
      pivot,
    );

    levers.push(pivot);
  }

  // Spoked Pitch / Orbital Trim Wheel on Port Side of Pedestal (x = -0.204)
  const trimAssy = new THREE.Group();
  trimAssy.position.set(-0.204, -0.515, -0.18);
  ped.add(trimAssy);

  // 5-hole spoked CNC wheel disc + rubberized tire + white index stripe
  const wheelShape = new THREE.Shape();
  wheelShape.absarc(0, 0, 0.078, 0, Math.PI * 2, false);
  const wheelHoles = [circleHolePath(0, 0, 0.016)];
  for (let s = 0; s < 5; s++) {
    const a = (s / 5) * Math.PI * 2;
    wheelHoles.push(circleHolePath(Math.cos(a) * 0.044, Math.sin(a) * 0.044, 0.015));
  }
  mesh(
    machinedPlate(wheelShape, { holes: wheelHoles, depth: 0.016, bevel: 0.002, centerZ: true }),
    mats.anodized,
    0,
    0,
    0,
    0,
    Math.PI / 2,
    0,
    trimAssy,
  );
  const trimTire = new THREE.Mesh(track(new THREE.TorusGeometry(0.078, 0.0085, 10, 36)), mats.rubber);
  trimTire.rotation.y = Math.PI / 2;
  trimAssy.add(trimTire);
  box(0.019, 0.018, 0.006, mats.white, 0, 0.076, 0.01, 0, 0, 0, 0.001, trimAssy);

  // 6-DOF Cursor Control Trackball + Turned Collar + Stitched Leather Palm Cushion (x = +0.095)
  mesh(
    latheMachined([
      [0.019, 0],
      [0.036, 0],
      [0.034, 0.012],
      [0.023, 0.015],
      [0.020, 0.005],
    ], 28),
    mats.brushed,
    0.095,
    -0.47,
    -0.15,
    0,
    0,
    0,
    ped,
  );
  const trackBall = new THREE.Mesh(track(new THREE.SphereGeometry(0.020, 24, 18)), mats.anodized);
  trackBall.position.set(0.095, -0.460, -0.15);
  ped.add(trackBall);
  for (let b = 0; b < 3; b++) {
    const ba = -0.8 + b * 0.8;
    box(0.016, 0.005, 0.010, mats.titanium, 0.095 + Math.sin(ba) * 0.042, -0.468, -0.15 - Math.cos(ba) * 0.042, 0, -ba, 0, 0.0015, ped);
  }
  // Contoured Stitched Leather Wrist Rest Cushion behind Trackball
  box(0.145, 0.028, 0.095, mats.leather, 0.092, -0.462, -0.035, 0.05, 0, 0, 0.011, ped);

  // 2 Guarded Engine Cutoff Switches aft of Throttle Quadrant
  for (let k = 0; k < 2; k++) {
    const cutSw = buildToggle(mats.brushed, mats.red, mats.caution, true);
    cutSw.scale.setScalar(0.8);
    cutSw.position.set(-0.104 + k * 0.072, -0.47, -0.045);
    ped.add(cutSw);
  }

  const tqLbl = label('THRUST / RCS', 'IDLE · NOM · DETENT 04', 0.15, 0.028, '#ffc16b');
  const tqDec = decal(tqLbl.texture, tqLbl.w, tqLbl.h, ped);
  tqDec.position.set(-0.068, -0.468, -0.325);
  tqDec.rotation.x = -Math.PI / 2;

  ped.add(fastenerInstances(pedBolts, mats.brushed, 0.0044, 0.0032));

  /* ═══ 2 · CANTED SIDE CONSOLES + STARBOARD RHC & PORT 3-AXIS THC ═════════ */

  for (const s of [-1, 1]) {
    const sideCon = new THREE.Group();
    sideCon.position.set(s * 0.565, -0.52, -0.12);
    sideCon.rotation.z = s * 0.24; // 14° ergonomic inward cant toward seated wrist!
    group.add(sideCon);

    // Contoured knee-beveled CNC side-console chassis (eliminates blocky rectangular box!)
    const conProfile = polygonToShape([
      [-0.108, 0.004, 0.005],
      [0.145, 0.004, 0.005],
      [0.145, -0.145, 0.008],
      [-0.042, -0.145, 0.012],
      [-0.108, -0.048, 0.010],
    ], 0.006, 4);
    mesh(
      machinedPlate(conProfile, { depth: 0.84, bevel: 0.0035, centerZ: true }),
      mats.hull,
      s * 0.018,
      0,
      0,
      0,
      s > 0 ? 0 : Math.PI,
      0,
      sideCon,
    );

    // Longitudinal Dzus Avionics Mounting Rails & Recessed Bay Dividers along console edges
    for (const rx of [-0.102, 0.102]) {
      box(0.012, 0.012, 0.83, mats.brushed, rx, 0.008, 0, 0, 0, 0, 0.002, sideCon);
    }
    for (const dz of [-0.408, -0.145, 0.140, 0.408]) {
      box(0.215, 0.011, 0.012, mats.anodized, 0, 0.008, dz, 0, 0, 0, 0.002, sideCon);
    }

    // 3 Modular Dzus-Mounted Avionics Faceplates along the console
    for (const [pz, ph] of [[-0.275, 0.245], [0.0, 0.268], [0.272, 0.245]] as [number, number][]) {
      mesh(
        machinedPlate(roundedRectShape(0.192, ph, 0.007), { depth: 0.010, bevel: 0.0016 }),
        mats.panel,
        0,
        0.006,
        pz,
        -Math.PI / 2,
        0,
        0,
        sideCon,
      );
    }

    // Forward Modular Panel (z = -0.28): Comms / Audio / ECS Regulators
    for (let k = 0; k < 3; k++) {
      const kSw = buildToggle(mats.brushed, k === 0 ? mats.caution : mats.white, k === 0 ? mats.anodized : null, false);
      kSw.scale.setScalar(0.72);
      kSw.position.set(-0.055 + k * 0.055, 0.016, -0.34);
      sideCon.add(kSw);
    }
    for (let k = 0; k < 2; k++) {
      const rKnob = buildKnob(0.015, 0.015, mats.anodized, s < 0 ? mats.green : mats.cyan, k === 0 ? 'fluted' : 'encoder');
      rKnob.position.set(-0.042 + k * 0.084, 0.016, -0.23);
      sideCon.add(rKnob);
    }

    // Aft Modular Panel (z = +0.27): Contoured Forearm Support Pad + Secondary CBs
    // High-G Forearm Support Cushion aligned along X-axis (NASA Orion NTRS 20110013203!)
    const forearmPad = machinedPlate(roundedRectShape(0.135, 0.21, 0.024), { depth: 0.034, bevel: 0.010 });
    mesh(forearmPad, mats.leather, -s * 0.02, 0.018, 0.23, -Math.PI / 2, 0, 0, sideCon);
    // Raised lateral elbow cup lip
    box(0.024, 0.022, 0.16, mats.leather, s * 0.048, 0.058, 0.24, 0, 0, 0, 0.008, sideCon);

    // Secondary circuit breaker strip outboard of forearm pad
    for (let c = 0; c < 4; c++) {
      const cb = buildCircuitBreaker(mats.brushed, mats.white, mats.anodized, false);
      cb.scale.setScalar(0.85);
      cb.position.set(s * 0.078, 0.016, 0.18 + c * 0.042);
      sideCon.add(cb);
    }

    if (s > 0) {
      /* ── STARBOARD INCEPTOR: 3-AXIS ROTATIONAL HAND CONTROLLER (RHC) ───── */
      const rhc = new THREE.Group();
      rhc.position.set(-0.02, 0.016, -0.02);
      rhc.rotation.z = -0.18; // Level out partial console cant so stick stands ergonomically
      sideCon.add(rhc);

      // Machined circular gimbal bezel ring + 6 socket screws
      mesh(
        latheMachined([
          [0.032, 0],
          [0.068, 0],
          [0.066, 0.010],
          [0.050, 0.014],
          [0.044, 0.006],
        ], 32),
        mats.anodized,
        0,
        0,
        0,
        0,
        0,
        0,
        rhc,
      );

      // Seamless Corrugated Elastomer Gimbal Bellows Boot!
      const bootGeo = corrugatedTube(
        [
          new THREE.Vector3(0, 0.006, 0),
          new THREE.Vector3(0, 0.026, -0.003),
          new THREE.Vector3(0, 0.048, -0.008),
        ],
        0.028,
        0.007,
        4,
        24,
        40,
      );
      mesh(bootGeo, mats.rubber, 0, 0, 0, 0, 0, 0, rhc);

      // Multi-Station Lofted Ergonomic Pistol Grip (Orion / Fighter Sidestick Geometry!)
      const makeGripOval = (rx: number, rzFwd: number, rzAft: number, offsetX = 0) =>
        filletPolygon2D([
          [-rx + offsetX, -rzFwd, rx * 0.42],
          [rx + offsetX, -rzFwd, rx * 0.42],
          [rx * 0.92 + offsetX, rzAft, rx * 0.45],
          [-rx * 0.92 + offsetX, rzAft, rx * 0.45],
        ], rx * 0.38, 4);

      const xDir = new THREE.Vector3(1, 0, 0);
      const zDir = new THREE.Vector3(0, 0.16, 1).normalize();
      const gripStations: LoftStation[] = [
        { origin: new THREE.Vector3(0, 0.045, -0.008), xDir, yDir: zDir, profile: makeGripOval(0.017, 0.019, 0.019) },
        { origin: new THREE.Vector3(0, 0.072, -0.014), xDir, yDir: zDir, profile: makeGripOval(0.021, 0.025, 0.022, 0.002) },
        { origin: new THREE.Vector3(-0.002, 0.105, -0.022), xDir, yDir: zDir, profile: makeGripOval(0.022, 0.027, 0.023, 0.003) },
        { origin: new THREE.Vector3(-0.004, 0.138, -0.028), xDir, yDir: zDir, profile: makeGripOval(0.020, 0.024, 0.024, -0.002) },
        { origin: new THREE.Vector3(-0.005, 0.164, -0.024), xDir, yDir: new THREE.Vector3(0, 0.42, 0.91).normalize(), profile: makeGripOval(0.025, 0.024, 0.028, -0.004) },
      ];
      mesh(loftStations(gripStations, true, 0.95), mats.rubber, 0, 0, 0, 0, 0, 0, rhc);

      // Machined Lower Palm-Shelf Flange on right side of pistol grip
      const palmShelf = machinedPlate(
        polygonToShape([
          [-0.01, -0.026, 0.005],
          [0.036, -0.020, 0.008],
          [0.038, 0.024, 0.008],
          [-0.01, 0.022, 0.005],
        ], 0.006, 4),
        { depth: 0.007, bevel: 0.0018 },
      );
      mesh(palmShelf, mats.anodized, 0.008, 0.064, -0.012, -Math.PI / 2 + 0.14, 0, -0.08, rhc);

      // Castle 4-Way Trim Hat, Dish POV Hat, Red AP-Disconnect & Forefinger Trigger!
      mesh(
        latheMachined([[0.003, 0], [0.0035, 0.008], [0.0095, 0.012], [0.0085, 0.015], [0.003, 0.013]], 16),
        mats.anodized,
        -0.012,
        0.166,
        -0.016,
        0.48,
        0,
        0.12,
        rhc,
      );
      mesh(
        latheMachined([[0.003, 0], [0.009, 0.009], [0.007, 0.012], [0.001, 0.010]], 16),
        mats.titanium,
        0.009,
        0.168,
        -0.020,
        0.48,
        0,
        -0.08,
        rhc,
      );
      mesh(
        new THREE.CylinderGeometry(0.0055, 0.0055, 0.006, 16),
        mats.red,
        -0.018,
        0.152,
        -0.004,
        0.65,
        0,
        0.35,
        rhc,
      );
      // Index trigger ahead of grip
      box(0.007, 0.022, 0.012, mats.caution, -0.003, 0.136, -0.050, 0.28, 0, 0, 0.002, rhc);
    } else {
      /* ── PORT INCEPTOR: 3-AXIS TRANSLATIONAL HAND CONTROLLER (THC) ─────── */
      // Apollo / Space Shuttle / NASA Orion Rectilinear Square-Shroud T-Handle!
      const thc = new THREE.Group();
      thc.position.set(0.02, 0.016, -0.02);
      thc.rotation.set(0.32, 0, 0.16); // Canted toward pilot's left palm
      sideCon.add(thc);

      // Square-aperture CNC mounting housing & dust boot
      mesh(machinedBezel(0.115, 0.115, 0.052, 0.052, 0.016, 0.012, 0.006, 0.002), mats.anodized, 0, 0.008, 0, -Math.PI / 2, 0, 0, thc);
      box(0.056, 0.028, 0.056, mats.rubber, 0, 0.024, 0, 0, 0, 0, 0.006, thc);

      // Rectilinear square translation shaft (±X, ±Y, ±Z axes!)
      box(0.020, 0.078, 0.020, mats.brushed, 0, 0.068, 0, 0, 0, 0, 0.0025, thc);

      // Sculpted Horizontal T-Handle Bar with knurled end caps & Hover/Pulse button
      const tProf = filletPolygon2D([
        [-0.016, -0.015, 0.005],
        [0.016, -0.015, 0.005],
        [0.018, 0.015, 0.006],
        [-0.018, 0.015, 0.006],
      ], 0.005, 4);
      mesh(
        sweepProfile(
          [new THREE.Vector3(-0.058, 0.108, 0), new THREE.Vector3(0.058, 0.108, 0)],
          tProf,
          { steps: 16, up: new THREE.Vector3(0, 1, 0), caps: true, scaleFn: (t) => 0.92 + 0.14 * Math.sin(t * Math.PI) },
        ),
        mats.rubber,
        0,
        0,
        0,
        0,
        0,
        0,
        thc,
      );
      for (const ex of [-1, 1]) {
        mesh(
          latheMachined([[0.001, 0], [0.016, 0], [0.016, 0.008], [0.012, 0.011], [0.001, 0.011]], 20),
          mats.titanium,
          ex * 0.058,
          0.108,
          0,
          0,
          0,
          ex * (-Math.PI / 2),
          thc,
        );
      }
      // Right-thumb Pulse / Hover Hold button on inboard end of T-handle
      mesh(new THREE.CylinderGeometry(0.0065, 0.0065, 0.006, 16), mats.caution, 0.064, 0.108, 0, 0, 0, -Math.PI / 2, thc);

      const thcLbl = label('THC · 3-AXIS', '±X  ±Y  ±Z  DIRECT', 0.11, 0.024, '#7de6ff');
      const thcDec = decal(thcLbl.texture, thcLbl.w, thcLbl.h, thc);
      thcDec.position.set(0, 0.017, 0.044);
      thcDec.rotation.x = -Math.PI / 2;

      // Port Wall Suit O2 / Cooling Demand Regulator Quick-Disconnect Manifold!
      const o2WallX = -(hullHalfWidth(0.06, 0.72) - 0.036);
      mesh(
        machinedPlate(roundedRectShape(0.11, 0.14, 0.012), { depth: 0.014, bevel: 0.002, centerZ: true }),
        mats.anodized,
        o2WallX,
        -0.41,
        0.06,
        0,
        Math.PI / 2,
        0,
      );
      mesh(
        latheMachined([
          [0.014, 0],
          [0.032, 0],
          [0.032, 0.016],
          [0.036, 0.018],
          [0.036, 0.030],
          [0.026, 0.034],
          [0.024, 0.046],
        ], 24),
        mats.brushed,
        o2WallX + 0.006,
        -0.41,
        0.06,
        0,
        0,
        -Math.PI / 2,
      );
      const o2Korry = buildKorrySwitch(0.032, 0.018, mats.bezel, mats.green, mats.dark);
      o2Korry.rotation.z = -Math.PI / 2;
      o2Korry.position.set(o2WallX + 0.008, -0.355, 0.06);
      group.add(o2Korry);
    }
  }

  /* ═══ 3 · PARALLELOGRAM / TORQUE-TUBE RUDDER & TOE-BRAKE PEDALS ══════════ */

  const trackProf = tTrackProfile(0.032, 0.022, 0.022, 0.006, 0.008, 0.0012);

  for (const s of [-1, 1]) {
    const px = s * 0.23;

    // Twin T-slot guide rails inside each recessed footwell
    for (const rx of [-0.075, 0.075]) {
      mesh(
        sweepProfile(
          [new THREE.Vector3(px + rx, DATUM.deckY + 0.002, -0.88), new THREE.Vector3(px + rx, DATUM.deckY + 0.002, -0.46)],
          trackProf,
          { steps: 12, up: new THREE.Vector3(0, 1, 0), caps: true },
        ),
        mats.hull,
      );
    }

    const pedalGroup = new THREE.Group();
    pedalGroup.position.set(px, -0.80, -0.68);
    group.add(pedalGroup);

    // Sliding cast-aluminium carriage & heel-cup stirrup
    const heelCup = machinedPlate(
      polygonToShape([
        [-0.088, -0.02, 0.008],
        [0.088, -0.02, 0.008],
        [0.082, 0.055, 0.012],
        [-0.082, 0.055, 0.012],
      ], 0.008, 4),
      { depth: 0.028, bevel: 0.0025 },
    );
    mesh(heelCup, mats.castAl, 0, -0.105, 0.02, -Math.PI / 2, 0, 0, pedalGroup);
    // Raised heel retaining lip
    box(0.168, 0.026, 0.012, mats.castAl, 0, -0.082, 0.068, 0, 0, 0, 0.003, pedalGroup);

    // Transverse pedal pivot axle
    mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.19, 18), mats.brushed, 0, -0.072, 0.012, 0, 0, Math.PI / 2, pedalGroup);

    // Pivoted CNC-Pocketed Toe-Brake Pedal Faceplate (tilted 30° toward pilot shins!)
    const plateTilt = new THREE.Group();
    plateTilt.position.set(0, -0.072, 0.012);
    plateTilt.rotation.x = -0.52;
    pedalGroup.add(plateTilt);

    const pedalOutline = polygonToShape([
      [-0.078, 0, 0.008],
      [0.078, 0, 0.008],
      [0.086, 0.165, 0.018],
      [0, 0.188, 0.022],
      [-0.086, 0.165, 0.018],
    ], 0.012, 4);
    const pedalCutouts = [
      roundedRectPath(-0.036, 0.055, 0.042, 0.022, 0.005),
      roundedRectPath(0.036, 0.055, 0.042, 0.022, 0.005),
      roundedRectPath(-0.036, 0.110, 0.044, 0.022, 0.005),
      roundedRectPath(0.036, 0.110, 0.044, 0.022, 0.005),
    ];
    mesh(
      machinedPlate(pedalOutline, { holes: pedalCutouts, depth: 0.014, bevel: 0.002, centerZ: true }),
      mats.castAl,
      0,
      0.01,
      0,
      0,
      0,
      0,
      plateTilt,
    );

    // 5 Machined Titanium Anti-Slip Cleat Bars across upper toe-brake zone
    for (let r = 0; r < 5; r++) {
      box(0.145 - r * 0.008, 0.007, 0.007, mats.titanium, 0, 0.032 + r * 0.030, 0.009, 0, 0, 0, 0.0015, plateTilt);
    }

    // Twin Parallelogram Torque-Tube Arms & Hydraulic Toe-Brake Master Cylinder!
    for (const lx of [-0.072, 0.072]) {
      mesh(
        new THREE.CylinderGeometry(0.009, 0.010, 0.25, 14),
        mats.hull,
        lx,
        0.03,
        -0.095,
        0.72,
        0,
        0,
        pedalGroup,
      );
    }
    // Hydraulic master brake cylinder behind pedal
    mesh(
      latheMachined([
        [0.005, 0],
        [0.005, 0.05],
        [0.015, 0.052],
        [0.015, 0.135],
        [0.011, 0.142],
      ], 16),
      mats.brushed,
      0,
      -0.035,
      -0.085,
      1.15,
      0,
      0,
      pedalGroup,
    );
  }

  return {
    setThrottle: (value: number) => {
      const t = THREE.MathUtils.clamp(value, 0, 1);
      levers.forEach((lv, idx) => {
        // Negative X rotation pushes lever FORWARD (-Z)!
        lv.rotation.x = 0.34 - t * 0.72 + idx * 0.02;
      });
    },
  };
}
