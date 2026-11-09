import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {
  createBookCoverTexture,
  createCameraDialTexture,
  createMonitorScreenTexture,
  createVinylLabelTexture,
  createVngMugTexture,
} from '../textures';

export interface StuffCollectionHandle {
  group: THREE.Group;
  lampLight: THREE.SpotLight;
  setLampOn: (on: boolean) => void;
  setTurntableSpin: (spin: boolean) => void;
  setDroneSpin: (spin: boolean) => void;
  update: (elapsed: number) => void;
}

function tagItem(root: THREE.Object3D, itemId: string) {
  root.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      obj.userData.itemId = itemId;
    }
  });
}

export function createStuffCollection(): StuffCollectionHandle {
  const group = new THREE.Group();
  group.name = 'stuff-collection';

  // Shared PBR materials
  const matteBlack = new THREE.MeshStandardMaterial({ color: 0x16181d, metalness: 0.25, roughness: 0.55 });
  const darkAnodized = new THREE.MeshStandardMaterial({ color: 0x242832, metalness: 0.78, roughness: 0.3 });
  const brushedSilver = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.92, roughness: 0.2 });
  const vngOrange = new THREE.MeshStandardMaterial({ color: 0xe65a26, metalness: 0.25, roughness: 0.28 });
  const warmWalnut = new THREE.MeshStandardMaterial({ color: 0x4a3222, metalness: 0.08, roughness: 0.62 });
  const feltMat = new THREE.MeshStandardMaterial({ color: 0x1e222b, metalness: 0.02, roughness: 0.92 });
  const glassVisorMat = new THREE.MeshPhysicalMaterial({
    color: 0x090d16,
    metalness: 0.1,
    roughness: 0.06,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    reflectivity: 1.0,
  });

  // =========================================================================
  // 1. DESK MAT + CUSTOM 75% MECHANICAL KEYBOARD + COIL CABLE + MOUSE + DAC
  // =========================================================================
  const workstationGroup = new THREE.Group();
  group.add(workstationGroup);

  // Stitched dark felt desk mat
  const deskMat = new THREE.Mesh(new RoundedBoxGeometry(2.75, 0.018, 1.18, 3, 0.008), feltMat);
  deskMat.position.set(0.25, 0.009, 1.98);
  deskMat.receiveShadow = true;
  workstationGroup.add(deskMat);

  // Mechanical Keyboard 75% Aluminum Case
  const kbGroup = new THREE.Group();
  kbGroup.position.set(-0.08, 0.018, 1.96);
  kbGroup.rotation.y = 0.03;
  workstationGroup.add(kbGroup);

  const kbCase = new THREE.Mesh(new RoundedBoxGeometry(1.18, 0.068, 0.44, 4, 0.016), darkAnodized);
  kbCase.position.y = 0.034;
  kbCase.rotation.x = 0.07;
  kbCase.castShadow = true;
  kbCase.receiveShadow = true;
  kbGroup.add(kbCase);

  const kbPlate = new THREE.Mesh(new THREE.BoxGeometry(1.11, 0.012, 0.37), vngOrange);
  kbPlate.position.set(0, 0.062, 0);
  kbPlate.rotation.x = 0.07;
  kbGroup.add(kbPlate);

  // Sculpted individual 3D keycaps (5 rows x 15 cols)
  const keyMatBase = new THREE.MeshStandardMaterial({ color: 0x2c323d, roughness: 0.45, metalness: 0.1 });
  const keyMatMod = new THREE.MeshStandardMaterial({ color: 0x1b1f27, roughness: 0.45, metalness: 0.12 });
  const keyMatAccent = new THREE.MeshStandardMaterial({ color: 0xe65a26, roughness: 0.32, metalness: 0.15 });
  const keyGeo = new RoundedBoxGeometry(0.056, 0.03, 0.056, 2, 0.008);

  for (let row = 0; row < 5; row++) {
    const rz = -0.138 + row * 0.068;
    const ry = 0.078 - row * 0.0045;
    for (let col = 0; col < 15; col++) {
      // Spacebar span on bottom row
      if (row === 4 && col >= 4 && col <= 8) {
        if (col === 6) {
          const spacebar = new THREE.Mesh(new RoundedBoxGeometry(0.32, 0.03, 0.056, 2, 0.008), keyMatMod);
          spacebar.position.set(-0.48 + 6 * 0.068, ry, rz);
          spacebar.rotation.x = 0.07;
          spacebar.castShadow = true;
          kbGroup.add(spacebar);
        }
        continue;
      }
      // Skip rotary knob slot top-right
      if (row === 0 && col === 14) continue;

      const isEsc = row === 0 && col === 0;
      const isEnter = row === 2 && col === 13;
      const isMod = col === 0 || col >= 13 || row === 4;
      const mat = isEsc || isEnter ? keyMatAccent : isMod ? keyMatMod : keyMatBase;

      const cap = new THREE.Mesh(keyGeo, mat);
      cap.position.set(-0.48 + col * 0.068, ry, rz);
      cap.rotation.x = 0.07;
      cap.castShadow = true;
      kbGroup.add(cap);
    }
  }

  // Brass rotary volume knob on keyboard top-right
  const kbKnob = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.03, 0.036, 24), brushedSilver);
  kbKnob.position.set(-0.48 + 14 * 0.068, 0.085, -0.138);
  kbKnob.castShadow = true;
  kbGroup.add(kbKnob);

  // Coiled Aviator USB Cable exiting back of keyboard
  const coilCurvePoints: THREE.Vector3[] = [];
  for (let i = 0; i <= 100; i++) {
    const t = i / 100;
    const angle = t * Math.PI * 2 * 10;
    coilCurvePoints.push(
      new THREE.Vector3(-0.35 + t * 0.28, 0.028 + Math.sin(angle) * 0.018, -0.28 + Math.cos(angle) * 0.018)
    );
  }
  const coilGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(coilCurvePoints), 96, 0.007, 8, false);
  const coilMesh = new THREE.Mesh(coilGeo, vngOrange);
  coilMesh.castShadow = true;
  kbGroup.add(coilMesh);

  const aviatorPlug = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.085, 16), brushedSilver);
  aviatorPlug.rotation.z = Math.PI / 2;
  aviatorPlug.position.set(-0.02, 0.028, -0.28);
  kbGroup.add(aviatorPlug);

  tagItem(kbGroup, 'keyboard');

  // Ergonomic Wireless Mouse
  const mouseGroup = new THREE.Group();
  mouseGroup.position.set(1.06, 0.018, 2.02);
  mouseGroup.rotation.y = -0.12;
  workstationGroup.add(mouseGroup);

  const mouseBody = new THREE.Mesh(new RoundedBoxGeometry(0.21, 0.09, 0.36, 6, 0.045), darkAnodized);
  mouseBody.position.y = 0.045;
  mouseBody.scale.set(1, 0.9, 1.05);
  mouseBody.castShadow = true;
  mouseGroup.add(mouseBody);

  const scrollWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.016, 20), vngOrange);
  scrollWheel.rotation.z = Math.PI / 2;
  scrollWheel.position.set(0, 0.082, -0.095);
  mouseGroup.add(scrollWheel);

  const dpiLed = new THREE.Mesh(
    new THREE.BoxGeometry(0.014, 0.008, 0.045),
    new THREE.MeshStandardMaterial({ color: 0xff6b35, emissive: 0xff5a1f, emissiveIntensity: 2.0 })
  );
  dpiLed.position.set(0, 0.091, -0.02);
  mouseGroup.add(dpiLed);
  tagItem(mouseGroup, 'keyboard');

  // Desktop Audio DAC / Amp on left of keyboard
  const dacGroup = new THREE.Group();
  dacGroup.position.set(-1.26, 0.018, 1.78);
  dacGroup.rotation.y = 0.25;
  workstationGroup.add(dacGroup);

  const dacBody = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.11, 0.34, 4, 0.02), darkAnodized);
  dacBody.position.y = 0.055;
  dacBody.castShadow = true;
  dacGroup.add(dacBody);

  const dacKnob = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.038, 0.032, 24), brushedSilver);
  dacKnob.rotation.x = Math.PI / 2;
  dacKnob.position.set(0.11, 0.055, 0.18);
  dacGroup.add(dacKnob);

  const dacScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.18, 0.055),
    new THREE.MeshStandardMaterial({ color: 0x0ea5e9, emissive: 0x38bdf8, emissiveIntensity: 1.5 })
  );
  dacScreen.position.set(-0.07, 0.058, 0.172);
  dacGroup.add(dacScreen);
  tagItem(dacGroup, 'audio-dac');

  // =========================================================================
  // 2. CURVED ULTRAWIDE STUDIO MONITOR + STUDIO SPEAKERS + AI COMPUTE CUBE
  // =========================================================================
  const monitorGroup = new THREE.Group();
  monitorGroup.position.set(-3.45, 0, -1.85);
  monitorGroup.rotation.y = 0.42;
  group.add(monitorGroup);

  // Aluminum Stand Base & Arm
  const monBase = new THREE.Mesh(new RoundedBoxGeometry(0.88, 0.032, 0.46, 4, 0.012), brushedSilver);
  monBase.position.set(0, 0.016, 0);
  monBase.castShadow = true;
  monBase.receiveShadow = true;
  monitorGroup.add(monBase);

  const monNeck = new THREE.Mesh(new RoundedBoxGeometry(0.14, 0.85, 0.08, 4, 0.02), darkAnodized);
  monNeck.position.set(0, 0.44, -0.14);
  monNeck.rotation.x = 0.12;
  monNeck.castShadow = true;
  monitorGroup.add(monNeck);

  // Curved Ultrawide Housing & Live VNG OS Display
  const monHousing = new THREE.Mesh(new RoundedBoxGeometry(2.35, 0.98, 0.07, 5, 0.025), matteBlack);
  monHousing.position.set(0, 0.88, -0.02);
  monHousing.castShadow = true;
  monitorGroup.add(monHousing);

  const monRearAccent = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.012, 12, 48), vngOrange);
  monRearAccent.position.set(0, 0.88, -0.058);
  monitorGroup.add(monRearAccent);

  const monTex = createMonitorScreenTexture();
  const monDisplay = new THREE.Mesh(
    new THREE.PlaneGeometry(2.26, 0.9),
    new THREE.MeshStandardMaterial({
      map: monTex,
      emissiveMap: monTex,
      emissive: 0xffffff,
      emissiveIntensity: 0.75,
      roughness: 0.2,
    })
  );
  monDisplay.position.set(0, 0.88, 0.018);
  monitorGroup.add(monDisplay);
  tagItem(monitorGroup, 'ultrawide-monitor');

  // Studio Monitor Speakers (Left & Right flanking the monitor/hero zone)
  const createSpeaker = (x: number, z: number, rotY: number) => {
    const spk = new THREE.Group();
    spk.position.set(x, 0, z);
    spk.rotation.y = rotY;

    const cab = new THREE.Mesh(new RoundedBoxGeometry(0.46, 0.72, 0.44, 5, 0.03), matteBlack);
    cab.position.y = 0.36;
    cab.castShadow = true;
    cab.receiveShadow = true;
    spk.add(cab);

    // Acoustic isolation pad
    const isoPad = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.03, 0.4), feltMat);
    isoPad.position.y = 0.015;
    spk.add(isoPad);

    // Signature Orange Kevlar Woofer Cone
    const wooferRing = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.018, 16, 36), darkAnodized);
    wooferRing.position.set(0, 0.27, 0.222);
    spk.add(wooferRing);

    const wooferCone = new THREE.Mesh(
      new THREE.ConeGeometry(0.14, 0.055, 36, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xe65a26, roughness: 0.42, metalness: 0.15, side: THREE.DoubleSide })
    );
    wooferCone.rotation.x = -Math.PI / 2;
    wooferCone.position.set(0, 0.27, 0.205);
    spk.add(wooferCone);

    const dustCap = new THREE.Mesh(new THREE.SphereGeometry(0.04, 24, 16), matteBlack);
    dustCap.position.set(0, 0.27, 0.195);
    spk.add(dustCap);

    // Silk Dome Tweeter + Waveguide
    const tweeterPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.015, 28), darkAnodized);
    tweeterPlate.rotation.x = Math.PI / 2;
    tweeterPlate.position.set(0, 0.54, 0.22);
    spk.add(tweeterPlate);

    const tweeterDome = new THREE.Mesh(new THREE.SphereGeometry(0.036, 20, 16), brushedSilver);
    tweeterDome.position.set(0, 0.54, 0.225);
    spk.add(tweeterDome);

    // Power LED
    const spkLed = new THREE.Mesh(
      new THREE.SphereGeometry(0.012, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xff6b35, emissive: 0xff5a1f, emissiveIntensity: 2.2 })
    );
    spkLed.position.set(0, 0.65, 0.222);
    spk.add(spkLed);

    tagItem(spk, 'speakers');
    group.add(spk);
  };

  createSpeaker(-4.95, -1.05, 0.62);
  createSpeaker(-2.35, -2.35, 0.25);

  // AI Compute / Mini Workstation Cube
  const aiCube = new THREE.Group();
  aiCube.position.set(-4.68, 0, -2.18);
  aiCube.rotation.y = 0.45;
  group.add(aiCube);

  const cubeBody = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.34, 0.62, 6, 0.04), brushedSilver);
  cubeBody.position.y = 0.17;
  cubeBody.castShadow = true;
  cubeBody.receiveShadow = true;
  aiCube.add(cubeBody);

  const cubeFrontSlot = new THREE.Mesh(new RoundedBoxGeometry(0.44, 0.035, 0.02, 2, 0.008), matteBlack);
  cubeFrontSlot.position.set(0, 0.09, 0.312);
  aiCube.add(cubeFrontSlot);

  const cubeLed = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.012, 0.025),
    new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x38bdf8, emissiveIntensity: 2.4 })
  );
  cubeLed.position.set(0, 0.26, 0.312);
  aiCube.add(cubeLed);
  tagItem(aiCube, 'ai-workstation');

  // =========================================================================
  // 3. PRO STUDIO HEADPHONES ON ALUMINUM STAND
  // =========================================================================
  const hpGroup = new THREE.Group();
  hpGroup.position.set(-2.35, 0, -1.05);
  hpGroup.rotation.y = 0.55;
  group.add(hpGroup);

  const hpBase = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.032, 32), darkAnodized);
  hpBase.position.y = 0.016;
  hpBase.castShadow = true;
  hpGroup.add(hpBase);

  const hpStem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.68, 16), brushedSilver);
  hpStem.position.y = 0.36;
  hpStem.castShadow = true;
  hpGroup.add(hpStem);

  const hpRest = new THREE.Mesh(new RoundedBoxGeometry(0.18, 0.045, 0.09, 3, 0.018), darkAnodized);
  hpRest.position.set(0, 0.71, 0);
  hpGroup.add(hpRest);

  // Headphones arch + earcups
  const hpArch = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.025, 16, 36, Math.PI), matteBlack);
  hpArch.position.set(0, 0.53, 0);
  hpArch.castShadow = true;
  hpGroup.add(hpArch);

  for (const side of [-1, 1]) {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.075, 28), darkAnodized);
    cup.rotation.z = Math.PI / 2;
    cup.position.set(side * 0.2, 0.45, 0);
    cup.castShadow = true;
    hpGroup.add(cup);

    const pad = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.028, 14, 28), matteBlack);
    pad.rotation.y = Math.PI / 2;
    pad.position.set(side * 0.16, 0.45, 0);
    hpGroup.add(pad);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.008, 12, 28), vngOrange);
    ring.rotation.y = Math.PI / 2;
    ring.position.set(side * 0.24, 0.45, 0);
    hpGroup.add(ring);
  }
  tagItem(hpGroup, 'headphones');

  // =========================================================================
  // 4. RETRO-MODERN VINYL TURNTABLE (SPINNING RECORD + TONEARM)
  // =========================================================================
  const ttGroup = new THREE.Group();
  ttGroup.position.set(-4.65, 0, 0.25);
  ttGroup.rotation.y = 0.22;
  group.add(ttGroup);

  const ttPlinth = new THREE.Mesh(new RoundedBoxGeometry(1.08, 0.13, 0.86, 5, 0.025), warmWalnut);
  ttPlinth.position.y = 0.065;
  ttPlinth.castShadow = true;
  ttPlinth.receiveShadow = true;
  ttGroup.add(ttPlinth);

  const ttPlatter = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.37, 0.032, 48), brushedSilver);
  ttPlatter.position.set(-0.09, 0.146, 0);
  ttPlatter.castShadow = true;
  ttGroup.add(ttPlatter);

  const vinylSpinGroup = new THREE.Group();
  vinylSpinGroup.position.set(-0.09, 0.166, 0);
  ttGroup.add(vinylSpinGroup);

  const vinylDisc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.34, 0.012, 64),
    new THREE.MeshPhysicalMaterial({ color: 0x0b0c10, roughness: 0.22, metalness: 0.15, clearcoat: 0.8 })
  );
  vinylSpinGroup.add(vinylDisc);

  // Subtle concentric record grooves
  for (const r of [0.18, 0.23, 0.28, 0.32]) {
    const groove = new THREE.Mesh(
      new THREE.RingGeometry(r, r + 0.004, 48),
      new THREE.MeshBasicMaterial({ color: 0x262933, side: THREE.DoubleSide })
    );
    groove.rotation.x = -Math.PI / 2;
    groove.position.y = 0.007;
    vinylSpinGroup.add(groove);
  }

  const vinylLabel = new THREE.Mesh(
    new THREE.CircleGeometry(0.115, 36),
    new THREE.MeshStandardMaterial({ map: createVinylLabelTexture(), roughness: 0.45 })
  );
  vinylLabel.rotation.x = -Math.PI / 2;
  vinylLabel.position.y = 0.0075;
  vinylSpinGroup.add(vinylLabel);

  const spindle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.04, 16), brushedSilver);
  spindle.position.y = 0.02;
  vinylSpinGroup.add(spindle);

  // Tonearm Assembly
  const armPivot = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.055, 24), darkAnodized);
  armPivot.position.set(0.36, 0.158, -0.24);
  ttGroup.add(armPivot);

  const armTube = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.48, 12), brushedSilver);
  armTube.rotation.x = Math.PI / 2;
  armTube.rotation.z = 0.28;
  armTube.position.set(0.28, 0.195, -0.02);
  ttGroup.add(armTube);

  const cartridge = new THREE.Mesh(new RoundedBoxGeometry(0.045, 0.032, 0.07, 2, 0.006), vngOrange);
  cartridge.position.set(0.21, 0.182, 0.2);
  cartridge.rotation.y = 0.28;
  ttGroup.add(cartridge);

  tagItem(ttGroup, 'turntable');

  // =========================================================================
  // 5. VINTAGE 35MM RANGEFINDER CAMERA
  // =========================================================================
  const camGroup = new THREE.Group();
  camGroup.position.set(-4.55, 0, 1.65);
  camGroup.rotation.y = 0.65;
  group.add(camGroup);

  const camBody = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.34, 0.24, 5, 0.03), matteBlack);
  camBody.position.y = 0.17;
  camBody.castShadow = true;
  camGroup.add(camBody);

  const camTopPlate = new THREE.Mesh(new RoundedBoxGeometry(0.625, 0.09, 0.245, 4, 0.02), brushedSilver);
  camTopPlate.position.y = 0.32;
  camTopPlate.castShadow = true;
  camGroup.add(camTopPlate);

  // Shutter Dial with printed markings
  const dialTop = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.058, 0.032, 24),
    new THREE.MeshStandardMaterial({ map: createCameraDialTexture(), metalness: 0.7, roughness: 0.3 })
  );
  dialTop.position.set(-0.14, 0.375, 0);
  camGroup.add(dialTop);

  // Shutter release button with orange soft-release cap
  const shutterBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.025, 20), vngOrange);
  shutterBtn.position.set(-0.23, 0.375, 0.04);
  camGroup.add(shutterBtn);

  // Multi-ring Rangefinder Lens
  const camLensBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.145, 0.2, 36), darkAnodized);
  camLensBarrel.rotation.x = Math.PI / 2;
  camLensBarrel.position.set(0.03, 0.165, 0.19);
  camLensBarrel.castShadow = true;
  camGroup.add(camLensBarrel);

  const camChromeRing = new THREE.Mesh(new THREE.TorusGeometry(0.134, 0.012, 12, 36), brushedSilver);
  camChromeRing.position.set(0.03, 0.165, 0.285);
  camGroup.add(camChromeRing);

  const camGlass = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.38),
    new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      metalness: 0.05,
      roughness: 0.05,
      transmission: 0.85,
      ior: 1.5,
      iridescence: 1.0,
    })
  );
  camGlass.rotation.x = Math.PI / 2;
  camGlass.position.set(0.03, 0.165, 0.21);
  camGroup.add(camGlass);

  // Viewfinder window
  const vfWindow = new THREE.Mesh(new RoundedBoxGeometry(0.085, 0.055, 0.02, 2, 0.008), glassVisorMat);
  vfWindow.position.set(0.19, 0.32, 0.125);
  camGroup.add(vfWindow);

  tagItem(camGroup, 'camera');

  // =========================================================================
  // 6. STACKED DESIGN BOOKS + FACETED CONCRETE PLANTER WITH 3D SUCCULENT
  // =========================================================================
  const booksGroup = new THREE.Group();
  booksGroup.position.set(-3.35, 0, 2.38);
  booksGroup.rotation.y = 0.18;
  group.add(booksGroup);

  const bookSpecs = [
    { w: 0.72, h: 0.085, d: 0.94, rot: 0.0, y: 0.0425, title: 'VNG 20 YEARS', sub: 'TECH & PEOPLE', bg: '#1e293b', acc: '#E65A26' },
    { w: 0.66, h: 0.075, d: 0.88, rot: 0.08, y: 0.1225, title: 'OPTICS & LASER', sub: '4K PROJECTION', bg: '#111827', acc: '#38BDF8' },
    { w: 0.6, h: 0.068, d: 0.82, rot: -0.06, y: 0.194, title: '3D SHADERS', sub: 'PBR ARCHITECTURE', bg: '#27272a', acc: '#F59E0B' },
  ];
  for (const b of bookSpecs) {
    const tex = createBookCoverTexture(b.title, b.sub, b.bg, b.acc);
    const coverMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 });
    const pagesMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.85 });
    const book = new THREE.Mesh(
      new THREE.BoxGeometry(b.w, b.h, b.d),
      [pagesMat, coverMat, coverMat, coverMat, pagesMat, pagesMat]
    );
    book.position.y = b.y;
    book.rotation.y = b.rot;
    book.castShadow = true;
    book.receiveShadow = true;
    booksGroup.add(book);
  }

  // Faceted Concrete Planter + Succulent sitting atop the books!
  const planter = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.14, 0.22, 8),
    new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.85 })
  );
  planter.position.set(0.05, 0.34, -0.05);
  planter.castShadow = true;
  booksGroup.add(planter);

  const soil = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 0.02, 8),
    new THREE.MeshStandardMaterial({ color: 0x271e17, roughness: 0.95 })
  );
  soil.position.set(0.05, 0.445, -0.05);
  booksGroup.add(soil);

  // Rosette Succulent Leaves (3 tiers)
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.45, metalness: 0.05 });
  for (let tier = 0; tier < 3; tier++) {
    const count = 8 - tier * 2;
    const radius = 0.095 - tier * 0.028;
    const yOff = 0.46 + tier * 0.032;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + tier * 0.4;
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.042 - tier * 0.008, 0.12 - tier * 0.02, 6), leafMat);
      leaf.position.set(0.05 + Math.cos(a) * radius, yOff, -0.05 + Math.sin(a) * radius);
      leaf.rotation.z = -Math.cos(a) * (0.95 - tier * 0.25);
      leaf.rotation.x = Math.sin(a) * (0.95 - tier * 0.25);
      leaf.castShadow = true;
      booksGroup.add(leaf);
    }
  }
  tagItem(booksGroup, 'books-plant');

  // =========================================================================
  // 7. VNG CERAMIC COFFEE MUG + COASTER + RISING STEAM
  // =========================================================================
  const mugGroup = new THREE.Group();
  mugGroup.position.set(1.52, 0, 1.58);
  mugGroup.rotation.y = -0.5;
  group.add(mugGroup);

  const coaster = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.018, 28), feltMat);
  coaster.position.y = 0.009;
  mugGroup.add(coaster);

  const mugCup = new THREE.Mesh(
    new THREE.CylinderGeometry(0.145, 0.135, 0.31, 36),
    new THREE.MeshStandardMaterial({ map: createVngMugTexture(), roughness: 0.22, metalness: 0.05 })
  );
  mugCup.position.y = 0.17;
  mugCup.castShadow = true;
  mugGroup.add(mugCup);

  const coffeeLiquid = new THREE.Mesh(
    new THREE.CircleGeometry(0.132, 32),
    new THREE.MeshStandardMaterial({ color: 0x2c1810, roughness: 0.15 })
  );
  coffeeLiquid.rotation.x = -Math.PI / 2;
  coffeeLiquid.position.y = 0.326;
  mugGroup.add(coffeeLiquid);

  const mugHandle = new THREE.Mesh(
    new THREE.TorusGeometry(0.095, 0.022, 14, 28, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0xf4f4f5, roughness: 0.25 })
  );
  mugHandle.rotation.z = -Math.PI / 2;
  mugHandle.position.set(0.135, 0.175, 0);
  mugGroup.add(mugHandle);

  // Subtle Steam Particles
  const steamParticles: THREE.Mesh[] = [];
  const steamGeo = new THREE.SphereGeometry(0.032, 10, 10);
  for (let i = 0; i < 6; i++) {
    const sMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.14, depthWrite: false });
    const puff = new THREE.Mesh(steamGeo, sMat);
    puff.position.set(0, 0.38 + i * 0.09, 0);
    mugGroup.add(puff);
    steamParticles.push(puff);
  }
  tagItem(mugGroup, 'vng-mug');

  // =========================================================================
  // 8. AUTONOMOUS TECH QUADCOPTER DRONE (SPINNING ROTORS)
  // =========================================================================
  const droneGroup = new THREE.Group();
  droneGroup.position.set(2.95, 0, 1.52);
  droneGroup.rotation.y = -0.62;
  group.add(droneGroup);

  // Landing skids
  for (const sx of [-0.22, 0.22]) {
    const skid = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.028, 0.56, 2, 0.008), matteBlack);
    skid.position.set(sx, 0.014, 0);
    skid.castShadow = true;
    droneGroup.add(skid);

    for (const sz of [-0.14, 0.14]) {
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.12, 10), darkAnodized);
      strut.position.set(sx * 0.85, 0.07, sz);
      strut.rotation.z = sx > 0 ? 0.25 : -0.25;
      droneGroup.add(strut);
    }
  }

  // Central aerodynamic body
  const droneBody = new THREE.Mesh(new RoundedBoxGeometry(0.32, 0.13, 0.62, 5, 0.04), darkAnodized);
  droneBody.position.y = 0.16;
  droneBody.castShadow = true;
  droneGroup.add(droneBody);

  const droneTopShell = new THREE.Mesh(new RoundedBoxGeometry(0.24, 0.04, 0.44, 4, 0.02), vngOrange);
  droneTopShell.position.set(0, 0.23, -0.02);
  droneGroup.add(droneTopShell);

  // Front Gimbal Camera
  const gimbalSphere = new THREE.Mesh(new THREE.SphereGeometry(0.058, 24, 24), matteBlack);
  gimbalSphere.position.set(0, 0.11, 0.31);
  droneGroup.add(gimbalSphere);

  const gimbalLens = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 20), glassVisorMat);
  gimbalLens.rotation.x = Math.PI / 2;
  gimbalLens.position.set(0, 0.11, 0.36);
  droneGroup.add(gimbalLens);

  // 4 Carbon Arms + Brushless Motors + Propellers
  const droneRotors: THREE.Group[] = [];
  const armAngles = [
    [0.42, 0.42],
    [-0.42, 0.42],
    [0.42, -0.42],
    [-0.42, -0.42],
  ];
  for (const [ax, az] of armAngles) {
    const armLen = Math.hypot(ax, az);
    const arm = new THREE.Mesh(new RoundedBoxGeometry(0.045, 0.028, armLen, 2, 0.008), matteBlack);
    arm.position.set(ax * 0.52, 0.16, az * 0.52);
    arm.rotation.y = Math.atan2(ax, az);
    arm.castShadow = true;
    droneGroup.add(arm);

    const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.06, 20), brushedSilver);
    motor.position.set(ax, 0.19, az);
    motor.castShadow = true;
    droneGroup.add(motor);

    const navLed = new THREE.Mesh(
      new THREE.SphereGeometry(0.015, 10, 10),
      new THREE.MeshStandardMaterial({
        color: az > 0 ? 0xff5a1f : 0x10b981,
        emissive: az > 0 ? 0xff5a1f : 0x10b981,
        emissiveIntensity: 2.2,
      })
    );
    navLed.position.set(ax, 0.15, az);
    droneGroup.add(navLed);

    const rotorGroup = new THREE.Group();
    rotorGroup.position.set(ax, 0.228, az);
    const blade = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.008, 0.042, 2, 0.003), matteBlack);
    blade.castShadow = true;
    rotorGroup.add(blade);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.025, 16), vngOrange);
    cap.position.y = 0.015;
    rotorGroup.add(cap);
    droneGroup.add(rotorGroup);
    droneRotors.push(rotorGroup);
  }
  tagItem(droneGroup, 'drone');

  // =========================================================================
  // 9. SPATIAL COMPUTING VR HEADSET
  // =========================================================================
  const vrGroup = new THREE.Group();
  vrGroup.position.set(4.35, 0, 1.15);
  vrGroup.rotation.y = -0.85;
  group.add(vrGroup);

  const vrVisor = new THREE.Mesh(new RoundedBoxGeometry(0.64, 0.28, 0.28, 8, 0.09), glassVisorMat);
  vrVisor.position.set(0, 0.15, 0.08);
  vrVisor.castShadow = true;
  vrGroup.add(vrVisor);

  const vrFrame = new THREE.Mesh(new RoundedBoxGeometry(0.65, 0.29, 0.14, 6, 0.06), brushedSilver);
  vrFrame.position.set(0, 0.15, 0.01);
  vrGroup.add(vrFrame);

  const vrCushion = new THREE.Mesh(new RoundedBoxGeometry(0.58, 0.25, 0.1, 6, 0.04), feltMat);
  vrCushion.position.set(0, 0.15, -0.07);
  vrGroup.add(vrCushion);

  const vrStrap = new THREE.Mesh(
    new THREE.TorusGeometry(0.25, 0.036, 12, 32, Math.PI * 1.15),
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.85 })
  );
  vrStrap.rotation.x = Math.PI / 2;
  vrStrap.rotation.z = -Math.PI * 0.08;
  vrStrap.position.set(0, 0.16, -0.14);
  vrGroup.add(vrStrap);

  const vrDial = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 20), vngOrange);
  vrDial.rotation.z = Math.PI / 2;
  vrDial.position.set(0.33, 0.19, 0.02);
  vrGroup.add(vrDial);
  tagItem(vrGroup, 'vr-headset');

  // =========================================================================
  // 10. ARTICULATED ARCHITECT DESK LAMP (WARM SPOTLIGHT)
  // =========================================================================
  const lampGroup = new THREE.Group();
  lampGroup.position.set(4.78, 0, 2.25);
  lampGroup.rotation.y = -2.3;
  group.add(lampGroup);

  const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.29, 0.065, 32), darkAnodized);
  lampBase.position.y = 0.0325;
  lampBase.castShadow = true;
  lampGroup.add(lampBase);

  const lowerArm = new THREE.Mesh(new RoundedBoxGeometry(0.04, 0.92, 0.04, 2, 0.01), brushedSilver);
  lowerArm.position.set(0, 0.48, -0.12);
  lowerArm.rotation.x = -0.28;
  lowerArm.castShadow = true;
  lampGroup.add(lowerArm);

  const elbowJoint = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.07, 20), vngOrange);
  elbowJoint.rotation.z = Math.PI / 2;
  elbowJoint.position.set(0, 0.91, -0.25);
  lampGroup.add(elbowJoint);

  const upperArm = new THREE.Mesh(new RoundedBoxGeometry(0.035, 0.86, 0.035, 2, 0.01), brushedSilver);
  upperArm.position.set(0, 1.18, 0.08);
  upperArm.rotation.x = 0.88;
  upperArm.castShadow = true;
  lampGroup.add(upperArm);

  const shadeGroup = new THREE.Group();
  shadeGroup.position.set(0, 1.42, 0.42);
  shadeGroup.rotation.x = 0.55;
  lampGroup.add(shadeGroup);

  const lampShade = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.28, 32, 1, true), darkAnodized);
  lampShade.castShadow = true;
  shadeGroup.add(lampShade);

  const lampBulbMat = new THREE.MeshStandardMaterial({
    color: 0xfff3d6,
    emissive: 0xffb347,
    emissiveIntensity: 3.2,
  });
  const lampBulb = new THREE.Mesh(new THREE.SphereGeometry(0.065, 20, 20), lampBulbMat);
  lampBulb.position.y = -0.06;
  shadeGroup.add(lampBulb);

  const lampTarget = new THREE.Object3D();
  lampTarget.position.set(0, 0, 1.3);
  lampGroup.add(lampTarget);

  const lampLight = new THREE.SpotLight(0xffcb80, 6.5, 9, Math.PI * 0.28, 0.65, 1.5);
  lampLight.position.set(0, 1.35, 0.42);
  lampLight.target = lampTarget;
  lampGroup.add(lampLight);
  tagItem(lampGroup, 'desk-lamp');

  // =========================================================================
  // 11. SERVER / NAS MINI-TOWER + DESK POLYHEDRON & PORTABLE SSDs
  // =========================================================================
  const nasGroup = new THREE.Group();
  nasGroup.position.set(4.78, 0, -2.18);
  nasGroup.rotation.y = -0.52;
  group.add(nasGroup);

  const nasBody = new THREE.Mesh(new RoundedBoxGeometry(0.56, 0.88, 0.74, 5, 0.035), darkAnodized);
  nasBody.position.y = 0.44;
  nasBody.castShadow = true;
  nasGroup.add(nasBody);

  // 4 Vertical Hot-Swap Drive Bays with glowing status strips
  for (let i = 0; i < 4; i++) {
    const bay = new THREE.Mesh(new RoundedBoxGeometry(0.095, 0.66, 0.03, 2, 0.006), matteBlack);
    bay.position.set(-0.175 + i * 0.116, 0.44, 0.372);
    nasGroup.add(bay);

    const bayLed = new THREE.Mesh(
      new THREE.BoxGeometry(0.015, 0.12, 0.01),
      new THREE.MeshStandardMaterial({
        color: i === 0 ? 0xe65a26 : 0x10b981,
        emissive: i === 0 ? 0xe65a26 : 0x10b981,
        emissiveIntensity: 2.0,
      })
    );
    bayLed.position.set(-0.175 + i * 0.116, 0.68, 0.388);
    nasGroup.add(bayLed);
  }
  tagItem(nasGroup, 'nas-tower');

  // Geometric Metallic Desk Sculpture + Portable NVMe SSDs (Foreground Right)
  const trinketGroup = new THREE.Group();
  trinketGroup.position.set(2.35, 0, 2.25);
  group.add(trinketGroup);

  const icosa = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.16, 0),
    new THREE.MeshStandardMaterial({ color: 0xe65a26, metalness: 0.88, roughness: 0.16 })
  );
  icosa.position.set(0, 0.145, 0);
  icosa.castShadow = true;
  trinketGroup.add(icosa);

  const ssd1 = new THREE.Mesh(new RoundedBoxGeometry(0.26, 0.028, 0.15, 3, 0.008), brushedSilver);
  ssd1.position.set(0.38, 0.014, -0.08);
  ssd1.rotation.y = 0.35;
  ssd1.castShadow = true;
  trinketGroup.add(ssd1);

  const ssd2 = new THREE.Mesh(new RoundedBoxGeometry(0.24, 0.026, 0.14, 3, 0.008), matteBlack);
  ssd2.position.set(0.45, 0.041, -0.05);
  ssd2.rotation.y = -0.18;
  ssd2.castShadow = true;
  trinketGroup.add(ssd2);

  const usbDrive = new THREE.Mesh(new RoundedBoxGeometry(0.14, 0.022, 0.048, 2, 0.006), vngOrange);
  usbDrive.position.set(-0.34, 0.011, 0.12);
  usbDrive.rotation.y = -0.45;
  usbDrive.castShadow = true;
  trinketGroup.add(usbDrive);
  tagItem(trinketGroup, 'desk-toys');

  // Animation states
  let spinTurntable = true;
  let spinDrone = true;

  const setLampOn = (on: boolean) => {
    lampLight.intensity = on ? 6.5 : 0;
    lampBulbMat.emissiveIntensity = on ? 3.2 : 0.05;
  };

  const setTurntableSpin = (spin: boolean) => {
    spinTurntable = spin;
  };

  const setDroneSpin = (spin: boolean) => {
    spinDrone = spin;
  };

  const update = (elapsed: number) => {
    if (spinTurntable) {
      vinylSpinGroup.rotation.y = -elapsed * 1.1;
    }
    if (spinDrone) {
      droneRotors.forEach((r, idx) => {
        r.rotation.y = elapsed * (idx % 2 === 0 ? 18 : -18);
      });
    }
    icosa.rotation.y = elapsed * 0.45;
    icosa.rotation.x = Math.sin(elapsed * 0.6) * 0.15;

    // Gentle rising coffee steam
    steamParticles.forEach((p, idx) => {
      const cycle = (elapsed * 0.45 + idx * 0.17) % 1;
      p.position.y = 0.36 + cycle * 0.55;
      p.position.x = Math.sin(elapsed * 1.8 + idx) * 0.03 * cycle;
      p.scale.setScalar(0.6 + cycle * 1.1);
      (p.material as THREE.MeshBasicMaterial).opacity = Math.sin(cycle * Math.PI) * 0.16;
    });
  };

  return {
    group,
    lampLight,
    setLampOn,
    setTurntableSpin,
    setDroneSpin,
    update,
  };
}
