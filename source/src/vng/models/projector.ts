import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { PROJECTOR_SLIDES, type ProjectorSlideId } from '../types';
import { createProjectorSlideTexture, createProjectorTopTexture } from '../textures';

export interface ProjectorSystemHandle {
  group: THREE.Group;
  projectorGroup: THREE.Group;
  screenGroup: THREE.Group;
  setPowered: (on: boolean) => void;
  setSlide: (slideId: ProjectorSlideId) => void;
  setBeamIntensity: (val: number) => void;
  setLensFocus: (val: number) => void;
  update: (elapsed: number) => void;
}

/**
 * Creates a smooth morphing beam mesh from circular lens aperture (radius r0)
 * at z=0 to a rounded 16:9 rectangle (w1 x h1) at z=length.
 */
function createFrustumBeamGeometry(
  r0: number,
  w1: number,
  h1: number,
  length: number,
  radialSegments = 64,
  lengthSegments = 24
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let iy = 0; iy <= lengthSegments; iy++) {
    const t = iy / lengthSegments;
    const z = t * length;

    for (let ix = 0; ix <= radialSegments; ix++) {
      const u = ix / radialSegments;
      const theta = u * Math.PI * 2;
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);

      // Circle coordinates
      const cx = cos * r0;
      const cy = sin * r0;

      // Superellipse / soft rectangle coordinates at screen end (p = 6 for rounded corners)
      const p = 6.0;
      const denom = Math.pow(Math.pow(Math.abs(cos), p) + Math.pow(Math.abs(sin), p), 1 / p);
      const rx = (cos / denom) * (w1 * 0.5);
      const ry = (sin / denom) * (h1 * 0.5);

      const x = THREE.MathUtils.lerp(cx, rx, t);
      const y = THREE.MathUtils.lerp(cy, ry, t);

      positions.push(x, y, z);
      uvs.push(u, t);
    }
  }

  const stride = radialSegments + 1;
  for (let iy = 0; iy < lengthSegments; iy++) {
    for (let ix = 0; ix < radialSegments; ix++) {
      const a = iy * stride + ix;
      const b = a + stride;
      const c = a + 1;
      const d = b + 1;
      indices.push(a, b, c);
      indices.push(c, b, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function createProjectorSystem(): ProjectorSystemHandle {
  const group = new THREE.Group();
  group.name = 'projector-system';

  // World-space placement so beam sweeps cleanly in front of VNG Monument
  const projOrigin = new THREE.Vector3(-3.05, 0, 1.05);
  const screenPos = new THREE.Vector3(3.45, 0, -0.65);

  const projectorGroup = new THREE.Group();
  projectorGroup.position.copy(projOrigin);
  group.add(projectorGroup);

  const screenGroup = new THREE.Group();
  screenGroup.position.copy(screenPos);
  group.add(screenGroup);

  // Aim projector toward screen horizontally + slight pitch
  const screenCenterWorld = new THREE.Vector3(screenPos.x, 1.48, screenPos.z);
  const projYaw = Math.atan2(screenPos.x - projOrigin.x, screenPos.z - projOrigin.z);
  projectorGroup.rotation.y = projYaw;
  screenGroup.rotation.y = projYaw + Math.PI; // Screen faces back toward projector

  // === Shared Precision Materials ===
  const chassisDarkMat = new THREE.MeshStandardMaterial({
    color: 0x1b1f27,
    metalness: 0.65,
    roughness: 0.34,
  });

  const topDeckMat = new THREE.MeshStandardMaterial({
    color: 0x353b47,
    metalness: 0.85,
    roughness: 0.25,
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xd8dee9,
    metalness: 0.96,
    roughness: 0.12,
  });

  const copperMat = new THREE.MeshStandardMaterial({
    color: 0xd96b27,
    metalness: 0.9,
    roughness: 0.22,
  });

  const rubberMat = new THREE.MeshStandardMaterial({
    color: 0x111317,
    metalness: 0.05,
    roughness: 0.88,
  });

  const vngAccentMat = new THREE.MeshStandardMaterial({
    color: 0xe65a26,
    metalness: 0.4,
    roughness: 0.25,
  });

  const powerLedMat = new THREE.MeshStandardMaterial({
    color: 0x10b981,
    emissive: 0x10b981,
    emissiveIntensity: 2.5,
  });

  const laserEmitterMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xff8c5a,
    emissiveIntensity: 4.0,
  });

  const sapphireLensMat = new THREE.MeshPhysicalMaterial({
    color: 0x60a5fa,
    metalness: 0.05,
    roughness: 0.04,
    transmission: 0.88,
    ior: 1.54,
    thickness: 0.35,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
    iridescence: 1.0,
    iridescenceIOR: 1.32,
    reflectivity: 1.0,
  });

  // === 1. Adjustable Machined Leveling Feet (4 corners) ===
  const footCoords: [number, number][] = [
    [-0.48, -0.45],
    [0.48, -0.45],
    [-0.48, 0.45],
    [0.48, 0.45],
  ];
  for (const [fx, fz] of footCoords) {
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.095, 0.04, 24), rubberMat);
    pad.position.set(fx, 0.02, fz);
    pad.castShadow = true;
    projectorGroup.add(pad);

    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.075, 0.045, 24), copperMat);
    collar.position.set(fx, 0.06, fz);
    projectorGroup.add(collar);
  }

  // === 2. Projector Main Body Chassis ===
  // Tilted slightly upward (pitch = ~8 deg) to aim at screen height!
  const bodyAssembly = new THREE.Group();
  bodyAssembly.position.set(0, 0.08, 0);
  // Compute exact vertical pitch from lens exit to screen center
  const horizDist = Math.hypot(screenPos.x - projOrigin.x, screenPos.z - projOrigin.z);
  const lensLocalY = 0.28;
  const lensLocalZ = 0.56;
  const dy = screenCenterWorld.y - (projOrigin.y + 0.08 + lensLocalY);
  const dz = horizDist - lensLocalZ;
  const aimPitch = Math.atan2(dy, dz);
  bodyAssembly.rotation.x = -aimPitch; // Negative X rotation tilts +Z upward!
  projectorGroup.add(bodyAssembly);

  // Lower hull
  const lowerHull = new THREE.Mesh(new RoundedBoxGeometry(1.24, 0.26, 1.18, 6, 0.05), chassisDarkMat);
  lowerHull.position.set(0, 0.16, 0);
  lowerHull.castShadow = true;
  lowerHull.receiveShadow = true;
  bodyAssembly.add(lowerHull);

  // Mid copper accent trim band
  const trimBand = new THREE.Mesh(new RoundedBoxGeometry(1.255, 0.028, 1.19, 4, 0.012), vngAccentMat);
  trimBand.position.set(0, 0.305, 0);
  bodyAssembly.add(trimBand);

  // Upper brushed aluminum deck
  const upperHull = new THREE.Mesh(new RoundedBoxGeometry(1.2, 0.16, 1.14, 6, 0.045), topDeckMat);
  upperHull.position.set(0, 0.39, 0);
  upperHull.castShadow = true;
  upperHull.receiveShadow = true;
  bodyAssembly.add(upperHull);

  // Top Control Silkscreen Plate
  const topTex = createProjectorTopTexture();
  const topPlate = new THREE.Mesh(
    new THREE.PlaneGeometry(0.96, 0.48),
    new THREE.MeshStandardMaterial({ map: topTex, metalness: 0.5, roughness: 0.35 })
  );
  topPlate.rotation.x = -Math.PI / 2;
  topPlate.position.set(0, 0.472, -0.05);
  bodyAssembly.add(topPlate);

  // Recessed Top Dials (Focus & Zoom)
  for (const [dx, label] of [
    [-0.28, 'focus'],
    [0.02, 'zoom'],
  ] as [number, string][]) {
    const bezel = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.11, 0.02, 32), chassisDarkMat);
    bezel.position.set(dx, 0.476, 0.12);
    bodyAssembly.add(bezel);

    const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.088, 0.032, 32), chromeMat);
    dial.position.set(dx, 0.49, 0.12);
    dial.name = `dial-${label}`;
    bodyAssembly.add(dial);

    // Indicator notch
    const notch = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.01, 0.04), vngAccentMat);
    notch.position.set(0, 0.018, 0.055);
    dial.add(notch);
  }

  // Tactile Illuminated Top Buttons
  const powerBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.042, 0.025, 24), chassisDarkMat);
  powerBtn.position.set(0.36, 0.48, 0.12);
  bodyAssembly.add(powerBtn);

  const powerRing = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.006, 12, 24), powerLedMat);
  powerRing.rotation.x = Math.PI / 2;
  powerRing.position.set(0.36, 0.494, 0.12);
  bodyAssembly.add(powerRing);

  for (let i = 0; i < 3; i++) {
    const btn = new THREE.Mesh(new RoundedBoxGeometry(0.045, 0.02, 0.032, 2, 0.005), chromeMat);
    btn.position.set(0.24 + i * 0.06, 0.478, 0.24);
    bodyAssembly.add(btn);
  }

  // === 3. Side Cooling Louvres + Internal Copper Heatsinks ===
  for (const side of [-1, 1]) {
    const recess = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.19, 0.78), rubberMat);
    recess.position.set(side * 0.605, 0.24, -0.02);
    bodyAssembly.add(recess);

    // Copper heat-pipe core visible inside grille
    const copperCore = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.15, 0.7), copperMat);
    copperCore.position.set(side * 0.595, 0.24, -0.02);
    bodyAssembly.add(copperCore);

    // 14 angled intake slats
    for (let i = 0; i < 14; i++) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.18, 0.014), chassisDarkMat);
      slat.position.set(side * 0.618, 0.24, -0.35 + i * 0.052);
      slat.rotation.y = side * 0.35;
      bodyAssembly.add(slat);
    }
  }

  // === 4. Front Multi-Element Optical Lens Assembly ===
  const lensGroup = new THREE.Group();
  lensGroup.position.set(-0.08, lensLocalY, 0.54);
  bodyAssembly.add(lensGroup);

  // Outer recessed lens shroud bay
  const shroudRing = new THREE.Mesh(new THREE.TorusGeometry(0.255, 0.032, 20, 48), chassisDarkMat);
  lensGroup.add(shroudRing);

  // Brushed chrome inner flange
  const chromeFlange = new THREE.Mesh(new THREE.TorusGeometry(0.225, 0.015, 16, 48), chromeMat);
  chromeFlange.position.z = 0.025;
  lensGroup.add(chromeFlange);

  // Outer lens barrel
  const outerBarrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.215, 0.225, 0.18, 48, 1, true),
    chassisDarkMat
  );
  outerBarrel.rotation.x = Math.PI / 2;
  outerBarrel.position.z = 0.06;
  lensGroup.add(outerBarrel);

  // Knurled Focus Collar (rotates when lensFocus changes!)
  const focusCollarGroup = new THREE.Group();
  focusCollarGroup.position.z = 0.11;
  lensGroup.add(focusCollarGroup);

  const collarRing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.218, 0.218, 0.065, 48),
    topDeckMat
  );
  collarRing.rotation.x = Math.PI / 2;
  focusCollarGroup.add(collarRing);

  // 36 CNC knurled ridges around the lens focus ring
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.058), chromeMat);
    ridge.position.set(Math.cos(a) * 0.218, Math.sin(a) * 0.218, 0);
    ridge.rotation.z = a;
    focusCollarGroup.add(ridge);
  }

  // Signature VNG orange optical ring accent on front barrel
  const orangeLensRing = new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.008, 14, 48), vngAccentMat);
  orangeLensRing.position.z = 0.145;
  lensGroup.add(orangeLensRing);

  // Internal matte optical baffle + aperture iris ring
  const baffle = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.175, 0.14, 36, 1, true), rubberMat);
  baffle.rotation.x = Math.PI / 2;
  baffle.position.z = 0.05;
  lensGroup.add(baffle);

  const irisRing = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.175, 10), chromeMat);
  irisRing.position.z = 0.04;
  lensGroup.add(irisRing);

  // Bright Laser Emitter Core deep inside lens
  const emitterCore = new THREE.Mesh(new THREE.CircleGeometry(0.1, 32), laserEmitterMat);
  emitterCore.position.z = 0.02;
  lensGroup.add(emitterCore);

  // Convex Sapphire Multi-Coated Front Glass Dome
  const glassDomeGeo = new THREE.SphereGeometry(0.185, 48, 32, 0, Math.PI * 2, 0, Math.PI * 0.42);
  const glassDome = new THREE.Mesh(glassDomeGeo, sapphireLensMat);
  glassDome.rotation.x = Math.PI / 2;
  glassDome.position.z = 0.025;
  lensGroup.add(glassDome);

  // Secondary Front Sensor / IR Receiver Window on front right
  const irWindow = new THREE.Mesh(new RoundedBoxGeometry(0.11, 0.07, 0.02, 3, 0.01), rubberMat);
  irWindow.position.set(0.38, 0.26, 0.59);
  bodyAssembly.add(irWindow);

  const frontBadge = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.022, 0.015), vngAccentMat);
  frontBadge.position.set(0.38, 0.17, 0.59);
  bodyAssembly.add(frontBadge);

  // === 5. Rear I/O Panel (HDMI x2, USB-C, RJ45, Power) ===
  const rearPlate = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.19, 0.02), rubberMat);
  rearPlate.position.set(0, 0.22, -0.585);
  bodyAssembly.add(rearPlate);

  // 2x HDMI ports with gold tongues
  for (const hx of [-0.32, -0.18]) {
    const hdmiShell = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.036, 0.025), chromeMat);
    hdmiShell.position.set(hx, 0.24, -0.595);
    bodyAssembly.add(hdmiShell);
    const hdmiInner = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.012, 0.028), copperMat);
    hdmiInner.position.set(hx, 0.24, -0.598);
    bodyAssembly.add(hdmiInner);
  }

  // USB-C + RJ45 Ethernet + AC Power Socket
  const rj45 = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.065, 0.025), chromeMat);
  rj45.position.set(-0.02, 0.23, -0.595);
  bodyAssembly.add(rj45);

  const usbC = new THREE.Mesh(new RoundedBoxGeometry(0.055, 0.024, 0.025, 2, 0.008), chromeMat);
  usbC.position.set(0.11, 0.24, -0.595);
  bodyAssembly.add(usbC);

  const acSocket = new THREE.Mesh(new RoundedBoxGeometry(0.13, 0.085, 0.025, 2, 0.01), chassisDarkMat);
  acSocket.position.set(0.31, 0.22, -0.595);
  bodyAssembly.add(acSocket);

  // === 6. Architectural Framed 16:9 Projection Screen ===
  // Screen width 2.75m, height 1.55m (16:9)
  const screenW = 2.75;
  const screenH = 1.55;

  // Dual heavy brushed-aluminum floor stand legs + crossbeam
  for (const sx of [-1.05, 1.05]) {
    const footBase = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.06, 0.72, 4, 0.02), chassisDarkMat);
    footBase.position.set(sx, 0.03, 0);
    footBase.castShadow = true;
    footBase.receiveShadow = true;
    screenGroup.add(footBase);

    const upright = new THREE.Mesh(new RoundedBoxGeometry(0.075, 2.28, 0.075, 4, 0.015), topDeckMat);
    upright.position.set(sx, 1.15, -0.05);
    upright.castShadow = true;
    screenGroup.add(upright);
  }

  const crossBar = new THREE.Mesh(new RoundedBoxGeometry(2.2, 0.06, 0.06, 4, 0.015), topDeckMat);
  crossBar.position.set(0, 0.35, -0.05);
  crossBar.castShadow = true;
  screenGroup.add(crossBar);

  // Slim aluminum bezel frame around screen
  const frameOuter = new THREE.Mesh(
    new RoundedBoxGeometry(screenW + 0.14, screenH + 0.14, 0.065, 4, 0.02),
    chassisDarkMat
  );
  frameOuter.position.set(0, 1.48, 0);
  frameOuter.castShadow = true;
  frameOuter.receiveShadow = true;
  screenGroup.add(frameOuter);

  const frameAccent = new THREE.Mesh(
    new RoundedBoxGeometry(screenW + 0.16, screenH + 0.16, 0.02, 4, 0.01),
    vngAccentMat
  );
  frameAccent.position.set(0, 1.48, -0.02);
  screenGroup.add(frameAccent);

  // Projection Surface Mesh
  let currentSlide: ProjectorSlideId = 0;
  let isPowered = true;
  let beamStrength = 1.0;
  let focusValue = 0.5;

  const initialSlideTex = createProjectorSlideTexture(currentSlide, isPowered);
  const screenMat = new THREE.MeshStandardMaterial({
    map: initialSlideTex,
    emissiveMap: initialSlideTex,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0.92,
    roughness: 0.42,
    metalness: 0.05,
  });

  const screenSurface = new THREE.Mesh(new THREE.PlaneGeometry(screenW, screenH), screenMat);
  screenSurface.position.set(0, 1.48, 0.036);
  screenGroup.add(screenSurface);

  // === 7. Volumetric 16:9 Laser Beam + Dust Motes + Real SpotLight ===
  // Compute exact world positions of lens exit and screen surface center
  projectorGroup.updateMatrixWorld(true);
  screenGroup.updateMatrixWorld(true);

  const lensWorldPos = new THREE.Vector3(0, 0, 0.14);
  glassDome.localToWorld(lensWorldPos);

  const screenWorldTarget = new THREE.Vector3(0, 0, 0.04);
  screenSurface.localToWorld(screenWorldTarget);

  const beamDist = lensWorldPos.distanceTo(screenWorldTarget);

  const beamUniforms = {
    uTime: { value: 0 },
    uPower: { value: 1.0 },
    uColor: { value: new THREE.Color('#ff7338') },
    uFocus: { value: 0.5 },
  };

  const beamMat = new THREE.ShaderMaterial({
    uniforms: beamUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vViewDir;
      void main() {
        vUv = uv;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vNormalView = normalize(normalMatrix * normal);
        vViewDir = normalize(-mvPosition.xyz);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uPower;
      uniform vec3 uColor;
      uniform float uFocus;
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vViewDir;
      void main() {
        float t = vUv.y;
        // Fade at lens tip and gently at screen arrival
        float axialFade = smoothstep(0.0, 0.06, t) * (1.0 - smoothstep(0.94, 1.0, t));
        // Distance attenuation (brighter near lens)
        float distFalloff = mix(1.0, 0.28, pow(t, 0.72));
        // Soft silhouette edges via view-normal fresnel
        float fresnel = pow(abs(dot(normalize(vNormalView), normalize(vViewDir))), 1.35);
        // Subtle animated laser ray striations
        float rays = 0.82 + 0.18 * sin(vUv.x * 62.8318 + uTime * 0.9) * sin(vUv.x * 25.1327 - uTime * 0.5);
        // Focus sharpness slightly modulates core density
        float focusCore = mix(0.85, 1.25, uFocus);
        float alpha = axialFade * distFalloff * fresnel * rays * focusCore * 0.24 * uPower;
        vec3 col = mix(vec3(1.0, 0.96, 0.92), uColor, 0.45 + 0.35 * t);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });

  const beamGeo = createFrustumBeamGeometry(0.145, screenW * 0.98, screenH * 0.98, beamDist, 64, 24);
  const beamMesh = new THREE.Mesh(beamGeo, beamMat);
  beamMesh.position.copy(lensWorldPos);
  beamMesh.lookAt(screenWorldTarget);
  group.add(beamMesh);

  // Floating Dust Motes inside the light beam
  const moteCount = 150;
  const motePos = new Float32Array(moteCount * 3);
  const moteSeeds = new Float32Array(moteCount * 3);
  for (let i = 0; i < moteCount; i++) {
    const t = 0.08 + Math.random() * 0.88;
    const rx = (Math.random() - 0.5) * THREE.MathUtils.lerp(0.24, screenW * 0.85, t);
    const ry = (Math.random() - 0.5) * THREE.MathUtils.lerp(0.24, screenH * 0.85, t);
    motePos[i * 3] = rx;
    motePos[i * 3 + 1] = ry;
    motePos[i * 3 + 2] = t * beamDist;
    moteSeeds[i * 3] = Math.random() * Math.PI * 2;
    moteSeeds[i * 3 + 1] = 0.4 + Math.random() * 0.8;
    moteSeeds[i * 3 + 2] = ry;
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  const moteMat = new THREE.PointsMaterial({
    color: 0xffd7c2,
    size: 0.028,
    transparent: true,
    opacity: 0.65,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const motes = new THREE.Points(moteGeo, moteMat);
  motes.position.copy(lensWorldPos);
  motes.lookAt(screenWorldTarget);
  group.add(motes);

  // Real SpotLight casting projected illumination onto the screen
  const spotTarget = new THREE.Object3D();
  spotTarget.position.copy(screenWorldTarget);
  group.add(spotTarget);

  const projSpotLight = new THREE.SpotLight(0xff8c5a, 14, 14, Math.PI * 0.22, 0.55, 1.2);
  projSpotLight.position.copy(lensWorldPos);
  projSpotLight.target = spotTarget;
  group.add(projSpotLight);

  // Tag items for raycasting
  projectorGroup.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      obj.userData.itemId = 'projector';
    }
  });
  screenGroup.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      obj.userData.itemId = 'projection-screen';
    }
  });

  const refreshSlideTexture = () => {
    const prev = screenMat.map;
    const nextTex = createProjectorSlideTexture(currentSlide, isPowered);
    screenMat.map = nextTex;
    screenMat.emissiveMap = nextTex;
    screenMat.emissiveIntensity = isPowered ? 0.95 : 0.04;
    screenMat.needsUpdate = true;
    if (prev) prev.dispose();

    const slideInfo = PROJECTOR_SLIDES[currentSlide];
    beamUniforms.uColor.value.set(slideInfo.accentHex);
    projSpotLight.color.set(slideInfo.accentHex);
    moteMat.color.set(slideInfo.accentHex).lerp(new THREE.Color('#ffffff'), 0.45);
    laserEmitterMat.emissive.set(slideInfo.accentHex).lerp(new THREE.Color('#ffffff'), 0.35);
  };

  const setPowered = (on: boolean) => {
    isPowered = on;
    refreshSlideTexture();
    powerLedMat.color.setHex(on ? 0x10b981 : 0xef4444);
    powerLedMat.emissive.setHex(on ? 0x10b981 : 0xef4444);
    powerLedMat.emissiveIntensity = on ? 2.5 : 1.0;
    laserEmitterMat.emissiveIntensity = on ? 4.2 : 0.0;
  };

  const setSlide = (slideId: ProjectorSlideId) => {
    currentSlide = slideId;
    refreshSlideTexture();
  };

  const setBeamIntensity = (val: number) => {
    beamStrength = val;
  };

  const setLensFocus = (val: number) => {
    focusValue = val;
    beamUniforms.uFocus.value = val;
    focusCollarGroup.rotation.z = (val - 0.5) * 1.4;
    const focusDial = bodyAssembly.getObjectByName('dial-focus');
    if (focusDial) focusDial.rotation.y = (val - 0.5) * 2.2;
  };

  const update = (elapsed: number) => {
    beamUniforms.uTime.value = elapsed;
    const targetPower = isPowered ? beamStrength : 0.0;
    beamUniforms.uPower.value = THREE.MathUtils.lerp(beamUniforms.uPower.value, targetPower, 0.1);
    beamMesh.visible = beamUniforms.uPower.value > 0.01;
    motes.visible = beamUniforms.uPower.value > 0.01;
    moteMat.opacity = 0.6 * beamUniforms.uPower.value;
    projSpotLight.intensity = 14 * beamUniforms.uPower.value;

    // Gentle drift of dust motes inside the beam
    if (motes.visible) {
      const posAttr = moteGeo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < moteCount; i++) {
        const seed = moteSeeds[i * 3];
        const speed = moteSeeds[i * 3 + 1];
        const baseY = moteSeeds[i * 3 + 2];
        posAttr.setY(i, baseY + Math.sin(elapsed * speed + seed) * 0.06);
      }
      posAttr.needsUpdate = true;
    }

    // Focus blur effect simulation on screen emissive pulse
    if (isPowered) {
      const sharpnessFactor = 1.0 - Math.abs(focusValue - 0.5) * 0.35;
      screenMat.emissiveIntensity = (0.88 + Math.sin(elapsed * 3.0) * 0.03) * sharpnessFactor * Math.max(0.45, beamStrength);
    }
  };

  return {
    group,
    projectorGroup,
    screenGroup,
    setPowered,
    setSlide,
    setBeamIntensity,
    setLensFocus,
    update,
  };
}
