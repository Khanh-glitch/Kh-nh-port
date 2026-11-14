import * as THREE from 'three';
import {
  buildAdelClamp,
  buildCircularConnector,
  buildKnob,
  circleHolePath,
  corrugatedTube,
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
  tTrackProfile,
  type BoltPlacement,
} from '../geometry';
import { DATUM, hullHalfWidth, type BuildContext } from '../datum';

export function buildSeatAndBulkhead(ctx: BuildContext): void {
  const { mats, mesh, box, decal, label, track, group } = ctx;

  /* ═══ 1 · ANTHROPOMETRIC COMPOSITE PILOT SEAT & SHOCK SUBFRAME ═══════════ */

  const seatAssy = new THREE.Group();
  seatAssy.position.set(0, 0, DATUM.seatZ); // SRP datum at z = +0.34
  group.add(seatAssy);

  // Twin Extruded T-Slot Seat Adjustment Tracks bolted to deck (z_local = -0.30 .. +0.52)
  const seatTrackProf = tTrackProfile(0.048, 0.032, 0.030, 0.008, 0.012, 0.0018);
  const seatBolts: BoltPlacement[] = [];

  for (const s of [-1, 1]) {
    const tx = s * 0.225;
    mesh(
      sweepProfile(
        [
          new THREE.Vector3(tx, DATUM.floorTopY, -0.30),
          new THREE.Vector3(tx, DATUM.floorTopY, 0.52),
        ],
        seatTrackProf,
        { steps: 16, up: new THREE.Vector3(0, 1, 0), caps: true },
      ),
      mats.hull,
      0,
      0,
      0,
      0,
      0,
      0,
      seatAssy,
    );

    // Detent pin notches along top of seat track
    for (let i = 0; i < 9; i++) {
      box(0.014, 0.004, 0.012, mats.dark, tx, DATUM.floorTopY + 0.031, -0.24 + i * 0.088, 0, 0, 0, 0.001, seatAssy);
    }

    // Front & Rear CNC-Milled Billet Roller Carriages
    for (const cz of [-0.14, 0.30]) {
      const carr = machinedPlate(roundedRectShape(0.11, 0.056, 0.009), {
        holes: [circleHolePath(-0.03, -0.006, 0.011), circleHolePath(0.03, -0.006, 0.011)],
        depth: 0.058,
        bevel: 0.0025,
        centerZ: true,
      });
      mesh(carr, mats.anodized, tx, DATUM.floorTopY + 0.036, cz, 0, Math.PI / 2, 0, seatAssy);
      for (const rz of [-0.03, 0.03]) {
        mesh(
          new THREE.CylinderGeometry(0.012, 0.012, 0.064, 16),
          mats.brushed,
          tx,
          DATUM.floorTopY + 0.030,
          cz + rz,
          0,
          0,
          Math.PI / 2,
          seatAssy,
        );
      }
    }

    // CNC-Pocketed Titanium Side-Truss Mounting Frame with 3 Circular Lightening Holes!
    const trussShape = polygonToShape([
      [-0.20, -0.84, 0.012],
      [0.34, -0.84, 0.012],
      [0.24, -0.44, 0.018],
      [-0.22, -0.53, 0.018],
    ], 0.012, 4);
    const trussHoles = [
      circleHolePath(-0.10, -0.68, 0.048),
      circleHolePath(0.06, -0.67, 0.052),
      circleHolePath(0.20, -0.69, 0.042),
    ];
    mesh(
      machinedPlate(trussShape, { holes: trussHoles, depth: 0.012, bevel: 0.002, centerZ: true }),
      mats.titanium,
      tx,
      0,
      0,
      0,
      Math.PI / 2,
      0,
      seatAssy,
    );

    // Inclined Hydraulic / Honeycomb Shock-Attenuation Strut (terminates cleanly on rear CFRP clevis!)
    const strut = new THREE.Group();
    strut.position.set(tx * 0.88, -0.83, 0.33);
    strut.rotation.x = -0.22;
    seatAssy.add(strut);

    mesh(
      latheMachined([
        [0.008, 0],
        [0.024, 0.01],
        [0.024, 0.20],
        [0.028, 0.21],
        [0.028, 0.24],
        [0.018, 0.25],
        [0.013, 0.25],
        [0.013, 0.39],
        [0.021, 0.40],
        [0.008, 0.415],
      ], 20),
      mats.brushed,
      0,
      0,
      0,
      0,
      0,
      0,
      strut,
    );
    mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.18, 20), mats.anodized, 0, 0.11, 0, 0, 0, 0, strut);
  }

  // Front Tubular Seat-Slide Release Bail Handle under pan front edge
  const bailProfile = filletPolygon2D([
    [-0.008, -0.008, 0.003],
    [0.008, -0.008, 0.003],
    [0.008, 0.008, 0.003],
    [-0.008, 0.008, 0.003],
  ], 0.003, 3);
  mesh(
    sweepProfile(
      [
        new THREE.Vector3(-0.15, -0.60, -0.22),
        new THREE.Vector3(-0.12, -0.62, -0.31),
        new THREE.Vector3(0.12, -0.62, -0.31),
        new THREE.Vector3(0.15, -0.60, -0.22),
      ],
      bailProfile,
      { steps: 22, up: new THREE.Vector3(0, 1, 0), caps: true },
    ),
    mats.caution,
    0,
    0,
    0,
    0,
    0,
    0,
    seatAssy,
  );

  /* ── 9-Station 3D-Contoured Autoclave CFRP Monocoque Seat Shell ────────── */
  // Spine curve defines the OUTER rear CFRP surface; cushions sit cleanly PROUD (-Z) of inner face!
  const spineCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.55, -0.28), // v=0.00: Front waterfall thigh lip
    new THREE.Vector3(0, -0.59, -0.08), // v=0.18: Deep thigh/ischial pan
    new THREE.Vector3(0, -0.56, 0.11),  // v=0.32: Rear pelvis pocket
    new THREE.Vector3(0, -0.35, 0.22),  // v=0.48: Lumbar curve
    new THREE.Vector3(0, -0.06, 0.295), // v=0.68: Thoracic shoulder wings
    new THREE.Vector3(0, 0.16, 0.335),  // v=0.84: Neck taper
    new THREE.Vector3(0, 0.35, 0.355),  // v=1.00: Rounded headrest crown
  ]);

  const evalSeatWidth = (v: number) => {
    if (v < 0.35) return 0.255 + 0.022 * Math.sin((v / 0.35) * Math.PI);
    if (v < 0.74) {
      const t = (v - 0.35) / 0.39;
      return 0.245 - 0.015 * Math.sin(t * Math.PI) + 0.055 * Math.pow(Math.sin(t * Math.PI * 0.85), 2);
    }
    const t = (v - 0.74) / 0.26;
    // Smooth arch taper over top of headrest!
    return 0.255 - 0.065 * Math.sin(t * Math.PI * 0.65) - 0.055 * Math.pow(t, 2.4);
  };

  const evalSeatWrap = (v: number) => {
    return (0.065 + 0.05 * Math.sin(v * Math.PI * 1.55)) * (1 - Math.pow(v, 4) * 0.55);
  };

  const evalSeatPoint = (u: number, v: number, out: THREE.Vector3) => {
    const lat = (u - 0.5) * 2; // -1 .. +1
    const spine = spineCurve.getPointAt(v);
    const wrapDir = new THREE.Vector3(0, 0.38 * (1 - v), -1).normalize();
    const hw = evalSeatWidth(v);
    const wrap = Math.pow(Math.abs(lat), 2.0) * evalSeatWrap(v);
    // Arch the top crown (v near 1) downward at edges so headrest hood is organically rounded!
    const crownDrop = v > 0.82 ? Math.pow((v - 0.82) / 0.18, 1.8) * lat * lat * 0.042 : 0;
    out.set(
      lat * hw,
      spine.y + wrapDir.y * wrap - crownDrop,
      spine.z + wrapDir.z * wrap,
    );
  };

  // Note: swap u -> 1-u so du x dv points AFT/DOWN, offsetting thickness AFT of inner bucket!
  const seatShellGeo = loftThickShell(
    (u, v, out) => evalSeatPoint(1 - u, v, out),
    0.016,
    28,
    36,
    0.82,
  );
  mesh(seatShellGeo, mats.carbon, 0, 0, 0, 0, 0, 0, seatAssy);

  // Rolled Rubber/Titanium Edge-Protection Trim Bead swept around both lateral edges & crown!
  const rimPts: THREE.Vector3[] = [];
  for (let i = 0; i <= 18; i++) {
    const p = new THREE.Vector3();
    evalSeatPoint(0, i / 18, p);
    rimPts.push(p);
  }
  for (let i = 1; i <= 10; i++) {
    const p = new THREE.Vector3();
    evalSeatPoint(i / 10, 1, p);
    rimPts.push(p);
  }
  for (let i = 17; i >= 0; i--) {
    const p = new THREE.Vector3();
    evalSeatPoint(1, i / 18, p);
    rimPts.push(p);
  }
  const rimBead = filletPolygon2D([
    [-0.008, -0.008, 0.003],
    [0.008, -0.008, 0.003],
    [0.009, 0.009, 0.004],
    [-0.009, 0.009, 0.004],
  ], 0.003, 3);
  mesh(sweepProfile(rimPts, rimBead, { steps: 72, up: new THREE.Vector3(0, 0, 1), caps: true }), mats.anodized, 0, 0, 0, 0, 0, 0, seatAssy);

  // Fastener row securing titanium side trusses to CFRP shell
  for (const s of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      seatBolts.push({
        position: new THREE.Vector3(s * 0.238, -0.52 + i * 0.022, -0.14 + i * 0.085),
        normal: new THREE.Vector3(s, -0.15, 0).normalize(),
        scale: 0.85,
      });
    }
  }

  /* ── Multi-Cell Tailored Nomex Cushions & Folding Billet Armrests ──────── */

  // 1. Split Left & Right Thigh Support Cushions (central gap for 5th-point crotch strap!)
  for (const sx of [-1, 1]) {
    const thighPad = machinedPlate(roundedRectShape(0.195, 0.20, 0.032), { depth: 0.046, bevel: 0.014 });
    mesh(thighPad, mats.fabric, sx * 0.112, -0.532, -0.165, -Math.PI / 2 + 0.16, 0, sx * -0.05, seatAssy);
  }
  // 2. Contoured Ischial Rear Seat Pan Cushion
  mesh(
    machinedPlate(roundedRectShape(0.42, 0.18, 0.034), { depth: 0.044, bevel: 0.014 }),
    mats.fabric,
    0,
    -0.542,
    0.02,
    -Math.PI / 2 + 0.06,
    0,
    0,
    seatAssy,
  );

  // 3. Lumbar Roll + 3 Ventilated Thoracic Backrest Cushion Segments
  // Note: machinedPlate extrudes toward +Z, so placing back at spine.z - 0.055 makes full 44mm cushion sit PROUD!
  const backPads: [number, number, number, number, number][] = [
    [-0.41, 0.185, 0.38, 0.108, -0.26], // Lumbar support roll (front at 0.141)
    [-0.27, 0.232, 0.40, 0.132, -0.24], // Lower thoracic pad (front at 0.188)
    [-0.11, 0.276, 0.42, 0.138, -0.21], // Mid thoracic pad (front at 0.232)
    [0.05, 0.308, 0.35, 0.122, -0.18],  // Upper scapular pad (front at 0.264)
  ];
  for (const [py, pz, pw, ph, rx] of backPads) {
    // Rotate Math.PI around Y so extrusion goes toward -Z (FORWARD toward pilot's back)!
    mesh(
      machinedPlate(roundedRectShape(pw, ph, 0.026), { depth: 0.044, bevel: 0.013 }),
      mats.fabric,
      0,
      py,
      pz,
      -rx,
      Math.PI,
      0,
      seatAssy,
    );
  }

  // 4. Angled Lateral Hip & Ribcage Containment Bolster Pads
  for (const sx of [-1, 1]) {
    box(0.068, 0.36, 0.082, mats.leather, sx * 0.228, -0.16, 0.225, -0.22, sx * -0.34, sx * 0.06, 0.024, seatAssy);

    // Folding CNC-Pocketed Billet Armrests with Turned Pivot Knuckles!
    const armX = sx * 0.305;
    mesh(
      latheMachined([[0.008, 0], [0.026, 0], [0.026, 0.032], [0.008, 0.032]], 20),
      mats.brushed,
      armX - sx * 0.016,
      -0.31,
      0.16,
      0,
      0,
      sx * (Math.PI / 2),
      seatAssy,
    );
    const armBeam = machinedPlate(
      polygonToShape([
        [-0.16, -0.020, 0.008],
        [0.14, -0.016, 0.008],
        [0.14, 0.018, 0.008],
        [-0.16, 0.022, 0.008],
      ], 0.006, 4),
      { holes: [roundedRectPath(-0.02, 0, 0.14, 0.014, 0.005)], depth: 0.028, bevel: 0.0025, centerZ: true },
    );
    mesh(armBeam, mats.anodized, armX, -0.31, 0.04, 0, Math.PI / 2, 0, seatAssy);
    // Stitched Leather Top Armrest Pad
    mesh(
      machinedPlate(roundedRectShape(0.076, 0.28, 0.018), { depth: 0.024, bevel: 0.008 }),
      mats.leather,
      armX,
      -0.292,
      0.03,
      -Math.PI / 2 + 0.03,
      0,
      0,
      seatAssy,
    );
  }

  // 5. Sculpted 3-Wing Headrest on Notched Stainless Adjustment Rods
  for (const sx of [-1, 1]) {
    mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.14, 14), mats.brushed, sx * 0.082, 0.18, 0.322, -0.16, 0, 0, seatAssy);
  }
  mesh(
    machinedPlate(roundedRectShape(0.22, 0.145, 0.028), { depth: 0.048, bevel: 0.014 }),
    mats.fabric,
    0,
    0.265,
    0.340,
    0.14,
    Math.PI,
    0,
    seatAssy,
  );
  for (const sx of [-1, 1]) {
    box(0.050, 0.135, 0.068, mats.leather, sx * 0.128, 0.265, 0.292, -0.14, sx * -0.42, 0, 0.018, seatAssy);
  }

  /* ── 5-Point Cam-Lock Aerospace Harness & Stamped Adjuster Hardware ────── */

  const beltSection = filletPolygon2D([
    [-0.022, -0.0025, 0.001],
    [0.022, -0.0025, 0.001],
    [0.022, 0.0025, 0.001],
    [-0.022, 0.0025, 0.001],
  ], 0.001, 2);

  for (const sx of [-1, 1]) {
    // Machined Titanium Shoulder Strap Pass-Through Grommet Bezel in upper backrest
    mesh(
      machinedBezel(0.068, 0.026, 0.050, 0.012, 0.014, 0.006, 0.003, 0.0015),
      mats.titanium,
      sx * 0.102,
      0.152,
      0.324,
      -0.18,
      0,
      0,
      seatAssy,
    );

    // Shoulder Webbing Strap draping cleanly 6 mm proud of every thoracic cushion!
    const shoulderPts = [
      new THREE.Vector3(sx * 0.102, 0.152, 0.322),
      new THREE.Vector3(sx * 0.112, 0.065, 0.256),
      new THREE.Vector3(sx * 0.108, -0.11, 0.224),
      new THREE.Vector3(sx * 0.092, -0.29, 0.168),
      new THREE.Vector3(sx * 0.036, -0.465, -0.025),
    ];
    mesh(
      sweepProfile(shoulderPts, beltSection, { steps: 32, up: new THREE.Vector3(0, 0, 1), caps: true, creaseAngle: 0.9 }),
      mats.webbing,
      0,
      0,
      0,
      0,
      0,
      0,
      seatAssy,
    );

    // Stamped Titanium Length-Adjuster Slide Buckle on chest strap
    mesh(
      machinedBezel(0.056, 0.036, 0.044, 0.016, 0.007, 0.005, 0.002, 0.0012),
      mats.brushed,
      sx * 0.108,
      -0.11,
      0.223,
      -0.22,
      0,
      sx * -0.05,
      seatAssy,
    );

    // Lap Belt Webbing anchored at hip truss clevis -> central cam-buckle
    const lapPts = [
      new THREE.Vector3(sx * 0.235, -0.49, 0.06),
      new THREE.Vector3(sx * 0.175, -0.48, 0.01),
      new THREE.Vector3(sx * 0.045, -0.475, -0.03),
    ];
    mesh(
      sweepProfile(lapPts, beltSection, { steps: 20, up: new THREE.Vector3(0, 1, 0), caps: true, creaseAngle: 0.9 }),
      mats.webbing,
      0,
      0,
      0,
      0,
      0,
      0,
      seatAssy,
    );
  }

  // 5th-Point Anti-Submarine Strap emerging between split thigh bolsters!
  mesh(
    sweepProfile(
      [
        new THREE.Vector3(0, -0.55, -0.22),
        new THREE.Vector3(0, -0.495, -0.14),
        new THREE.Vector3(0, -0.475, -0.045),
      ],
      beltSection,
      { steps: 16, up: new THREE.Vector3(0, 1, 0), caps: true },
    ),
    mats.webbing,
    0,
    0,
    0,
    0,
    0,
    0,
    seatAssy,
  );

  // Turned CNC 5-Point Rotary Cam-Lock Release Buckle (Simpson / Schroth Aerospace Style!)
  const buckle = new THREE.Group();
  buckle.position.set(0, -0.470, -0.032);
  buckle.rotation.x = -0.35;
  seatAssy.add(buckle);
  mesh(
    latheMachined([
      [0.001, 0],
      [0.036, 0],
      [0.036, 0.012],
      [0.031, 0.015],
      [0.028, 0.015],
      [0.028, 0.022],
      [0.024, 0.024],
      [0.001, 0.024],
    ], 28),
    mats.brushed,
    0,
    0,
    0,
    0,
    0,
    0,
    buckle,
  );
  // Amber quarter-turn release vane on top of cam-lock puck
  box(0.046, 0.006, 0.014, mats.caution, 0, 0.025, 0, 0, 0, 0, 0.002, buckle);

  seatAssy.add(fastenerInstances(seatBolts, mats.brushed, 0.0046, 0.0034));

  /* ── Seamless Corrugated Suit O2 Umbilical Hose + Quick-Disconnect ─────── */
  const o2WallX = -(hullHalfWidth(0.06, 0.72) - 0.068);
  const umbilicalPts = [
    new THREE.Vector3(o2WallX, -0.41, 0.06),
    new THREE.Vector3(-0.62, -0.56, 0.14),
    new THREE.Vector3(-0.46, -0.63, 0.25),
    new THREE.Vector3(-0.34, -0.54, 0.34),
    new THREE.Vector3(-0.275, -0.43, 0.38),
  ];
  mesh(corrugatedTube(umbilicalPts, 0.0155, 0.0038, 22, 20, 110), mats.seal);

  // Adel P-Clamp securing umbilical loop + Turned Bayonet Quick-Disconnect on left hip!
  const umbClamp = buildAdelClamp(0.018, mats.brushed, mats.rubber);
  umbClamp.position.set(-0.34, -0.54, 0.34);
  group.add(umbClamp);

  mesh(
    latheMachined([
      [0.002, 0],
      [0.022, 0],
      [0.022, 0.018],
      [0.026, 0.020],
      [0.026, 0.034],
      [0.020, 0.038],
      [0.002, 0.038],
    ], 24),
    mats.brushed,
    -0.275,
    -0.43,
    0.38,
    0.85,
    0,
    -0.35,
  );

  /* ═══ 2 · ORTHOGRID AFT PRESSURE BULKHEAD & EQUALISATION HATCH ═══════════ */

  const bhZ = DATUM.aftZ;
  const bhW = hullHalfWidth(bhZ, 0.6) * 2 + 0.02;

  // Main structural aft bulkhead plate with central rounded-square hatch cutout
  const bhShape = roundedRectShape(bhW, 1.68, 0.18);
  const hatchOpening = roundedRectPath(0, 0.02, 0.66, 0.76, 0.08);
  mesh(
    machinedPlate(bhShape, { holes: [hatchOpening], depth: 0.048, bevel: 0.004, centerZ: false }),
    mats.shell,
    0,
    -0.12,
    bhZ - 0.02,
    0,
    Math.PI,
    0,
  );

  // Orthogrid radial/vertical CNC stiffening ribs on bulkhead inner face
  for (const rx of [-0.66, -0.44, 0.44, 0.66]) {
    box(0.022, 1.46, 0.028, mats.hull, rx, -0.14, bhZ - 0.072, 0, 0, 0, 0.003);
  }
  for (const ry of [-0.68, -0.34, 0.38, 0.62]) {
    box(bhW - 0.16, 0.022, 0.026, mats.hull, 0, ry, bhZ - 0.070, 0, 0, 0, 0.003);
  }

  // Deep CNC-Milled Hatch Coaming Frame Ring + 16 Perimeter Bolts
  mesh(
    machinedBezel(0.78, 0.88, 0.65, 0.75, 0.038, 0.10, 0.075, 0.0035),
    mats.castAl,
    0,
    -0.10,
    bhZ - 0.082,
  );

  const hatchBolts: BoltPlacement[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const bx = Math.cos(a) * 0.355;
    const by = -0.10 + Math.sin(a) * 0.405;
    hatchBolts.push({
      position: new THREE.Vector3(bx, by, bhZ - 0.101),
      normal: new THREE.Vector3(0, 0, -1),
      scale: 0.9,
    });
  }
  group.add(fastenerInstances(hatchBolts, mats.brushed, 0.0052, 0.004));

  // Stepped Recessed Pressure Hatch Door + Circular Sight-Glass Viewport
  const doorShape = roundedRectShape(0.66, 0.76, 0.075);
  const sightHole = circleHolePath(0, 0.15, 0.085);
  mesh(
    machinedPlate(doorShape, { holes: [sightHole], depth: 0.032, bevel: 0.0035, centerZ: true }),
    mats.anodized,
    0,
    -0.10,
    bhZ - 0.072,
  );

  // Circular Hatch Sight-Glass Bezel + Glass Edge + Optical Pane
  mesh(
    machinedBezel(0.21, 0.21, 0.165, 0.165, 0.018, 0.105, 0.082, 0.002),
    mats.brushed,
    0,
    0.05,
    bhZ - 0.092,
  );
  const hatchGlass = new THREE.Mesh(track(new THREE.CircleGeometry(0.084, 28)), mats.glass);
  hatchGlass.position.set(0, 0.05, bhZ - 0.092);
  hatchGlass.rotation.y = Math.PI;
  group.add(hatchGlass);

  // Central Gearbox Hub + 6 Radial Dog-Latch Rods + 3-Spoke Locking Handwheel!
  const hubY = -0.18;
  mesh(
    latheMachined([[0.005, 0], [0.058, 0], [0.054, 0.022], [0.026, 0.028], [0.018, 0.055], [0.002, 0.055]], 28),
    mats.brushed,
    0,
    hubY,
    bhZ - 0.088,
    -Math.PI / 2,
    0,
    0,
  );
  // 6 Radial Over-Center Dog-Latch Rods engaging the coaming!
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.52;
    const len = 0.28;
    mesh(
      new THREE.CylinderGeometry(0.0055, 0.0055, len, 12),
      mats.titanium,
      Math.cos(a) * (len * 0.52),
      hubY + Math.sin(a) * (len * 0.52),
      bhZ - 0.096,
      0,
      0,
      a - Math.PI / 2,
    );
  }
  // 3-Spoke Pressure-Lock Handwheel Ring
  const wheelRing = new THREE.Mesh(track(new THREE.TorusGeometry(0.095, 0.009, 10, 32)), mats.caution);
  wheelRing.position.set(0, hubY, bhZ - 0.135);
  group.add(wheelRing);
  for (let k = 0; k < 3; k++) {
    const ka = (k / 3) * Math.PI * 2;
    mesh(
      new THREE.CylinderGeometry(0.006, 0.006, 0.094, 12),
      mats.brushed,
      Math.cos(ka) * 0.047,
      hubY + Math.sin(ka) * 0.047,
      bhZ - 0.132,
      0,
      0,
      ka - Math.PI / 2,
    );
  }

  // Flanking Aft ECLSS / Avionics Racks & Equalisation Valve
  for (const sx of [-1, 1]) {
    mesh(
      machinedPlate(roundedRectShape(0.18, 0.46, 0.012), { depth: 0.024, bevel: 0.002, centerZ: true }),
      mats.panel,
      sx * 0.55,
      -0.06,
      bhZ - 0.082,
    );
    const eqKnob = buildKnob(0.020, 0.018, mats.anodized, mats.caution, 'pointer');
    eqKnob.rotation.x = -Math.PI / 2;
    eqKnob.position.set(sx * 0.55, 0.08, bhZ - 0.095);
    group.add(eqKnob);

    const aftConn = buildCircularConnector(0.017, mats.brushed, mats.titanium, mats.rubber);
    aftConn.rotation.x = -Math.PI / 2;
    aftConn.position.set(sx * 0.55, -0.18, bhZ - 0.095);
    group.add(aftConn);
  }

  const hLbl = label('HATCH 02 · LOCKED', 'EQUALISE ΔP < 1.5 KPA', 0.20, 0.038, '#ffc16b');
  const hDec = decal(hLbl.texture, hLbl.w, hLbl.h);
  hDec.position.set(0, 0.23, bhZ - 0.104);
  hDec.rotation.y = Math.PI;
}
