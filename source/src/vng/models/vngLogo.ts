import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { createVngPlaqueTexture } from '../textures';

export interface VngMonumentHandle {
  group: THREE.Group;
  logoFloatGroup: THREE.Group;
  orbitalRing: THREE.Mesh;
  innerRing: THREE.Mesh;
  haloMaterial: THREE.MeshStandardMaterial;
  spotLight: THREE.PointLight;
  update: (elapsed: number, haloEnabled: boolean, levitateEnabled: boolean) => void;
}

function createVngLetterShapes(scale: number): THREE.Shape[] {
  const cx = 2200;
  const cy = 1237;
  const tx = (x: number) => (x - cx) * scale;
  const ty = (y: number) => -(y - cy) * scale;

  // 1. Letter V
  const v = new THREE.Shape();
  v.moveTo(tx(2171), ty(1208));
  v.lineTo(tx(2171), ty(1233.38));
  v.bezierCurveTo(tx(2171.02), ty(1251.37), tx(2156.61), ty(1265.98), tx(2138.82), ty(1266));
  v.bezierCurveTo(tx(2138.8), ty(1266), tx(2138.77), ty(1266), tx(2138.75), ty(1266));
  v.lineTo(tx(2128), ty(1266));
  v.lineTo(tx(2128), ty(1208));
  v.lineTo(tx(2138.75), ty(1208));
  v.lineTo(tx(2138.75), ty(1255.26));
  v.bezierCurveTo(tx(2150.68), ty(1255.26), tx(2160.35), ty(1245.48), tx(2160.35), ty(1233.41));
  v.bezierCurveTo(tx(2160.35), ty(1233.4), tx(2160.35), ty(1233.39), tx(2160.35), ty(1233.38));
  v.lineTo(tx(2160.35), ty(1208));
  v.closePath();

  // 2. Letter N
  const n = new THREE.Shape();
  n.moveTo(tx(2222), ty(1224.33));
  n.lineTo(tx(2222), ty(1266));
  n.lineTo(tx(2211), ty(1266));
  n.lineTo(tx(2211), ty(1224.3));
  n.bezierCurveTo(tx(2211), ty(1221.3), tx(2208.55), ty(1218.88), tx(2205.52), ty(1218.88));
  n.bezierCurveTo(tx(2205.51), ty(1218.88), tx(2205.49), ty(1218.88), tx(2205.48), ty(1218.88));
  n.lineTo(tx(2189), ty(1218.88));
  n.lineTo(tx(2189), ty(1266));
  n.lineTo(tx(2178), ty(1266));
  n.lineTo(tx(2178), ty(1208));
  n.lineTo(tx(2205.48), ty(1208));
  n.bezierCurveTo(tx(2207.36), ty(1207.99), tx(2209.23), ty(1208.31), tx(2211), ty(1208.93));
  n.bezierCurveTo(tx(2215.65), ty(1210.61), tx(2219.3), ty(1214.26), tx(2220.95), ty(1218.88));
  n.bezierCurveTo(tx(2221.61), ty(1220.62), tx(2221.96), ty(1222.47), tx(2222), ty(1224.33));
  n.closePath();

  // 3. Letter G
  const g = new THREE.Shape();
  g.moveTo(tx(2246.88), ty(1242.54));
  g.lineTo(tx(2261.22), ty(1242.54));
  g.lineTo(tx(2261.22), ty(1249.8));
  g.bezierCurveTo(tx(2261.22), ty(1252.81), tx(2258.8), ty(1255.26), tx(2255.82), ty(1255.26));
  g.lineTo(tx(2245.14), ty(1255.26));
  g.bezierCurveTo(tx(2242.22), ty(1255.26), tx(2239.82), ty(1252.9), tx(2239.75), ty(1249.94));
  g.lineTo(tx(2239.75), ty(1224.37));
  g.bezierCurveTo(tx(2239.75), ty(1221.38), tx(2242.15), ty(1218.95), tx(2245.11), ty(1218.95));
  g.lineTo(tx(2264.83), ty(1218.95));
  g.lineTo(tx(2264.83), ty(1208));
  g.lineTo(tx(2245.11), ty(1208));
  g.bezierCurveTo(tx(2243.28), ty(1207.99), tx(2241.47), ty(1208.3), tx(2239.75), ty(1208.93));
  g.bezierCurveTo(tx(2235.16), ty(1210.59), tx(2231.54), ty(1214.24), tx(2229.89), ty(1218.88));
  g.bezierCurveTo(tx(2229.29), ty(1220.64), tx(2228.99), ty(1222.48), tx(2229), ty(1224.34));
  g.lineTo(tx(2229), ty(1249.66));
  g.bezierCurveTo(tx(2228.99), ty(1251.52), tx(2229.29), ty(1253.36), tx(2229.89), ty(1255.12));
  g.bezierCurveTo(tx(2231.52), ty(1259.77), tx(2235.15), ty(1263.43), tx(2239.75), ty(1265.07));
  g.bezierCurveTo(tx(2241.47), ty(1265.69), tx(2243.28), ty(1266.01), tx(2245.11), ty(1266));
  g.lineTo(tx(2255.86), ty(1266));
  g.bezierCurveTo(tx(2257.68), ty(1266.01), tx(2259.5), ty(1265.69), tx(2261.22), ty(1265.07));
  g.bezierCurveTo(tx(2265.82), ty(1263.43), tx(2269.45), ty(1259.78), tx(2271.08), ty(1255.12));
  g.bezierCurveTo(tx(2271.67), ty(1253.4), tx(2271.98), ty(1251.59), tx(2272), ty(1249.76));
  g.lineTo(tx(2272), ty(1231.63));
  g.lineTo(tx(2246.88), ty(1231.63));
  g.closePath();

  return [v, n, g];
}

export function createVngMonument(): VngMonumentHandle {
  const group = new THREE.Group();
  group.name = 'vng-monument';

  // Materials
  const obsidianMat = new THREE.MeshStandardMaterial({
    color: 0x161920,
    metalness: 0.45,
    roughness: 0.32,
  });

  const brushedTitaniumMat = new THREE.MeshStandardMaterial({
    color: 0x2c313d,
    metalness: 0.88,
    roughness: 0.24,
  });

  const copperTrimMat = new THREE.MeshStandardMaterial({
    color: 0xe65a26,
    metalness: 0.85,
    roughness: 0.22,
  });

  const vngOrangeFaceMat = new THREE.MeshPhysicalMaterial({
    color: 0xe65a26,
    metalness: 0.18,
    roughness: 0.14,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    reflectivity: 0.9,
    emissive: 0x6b1d04,
    emissiveIntensity: 0.18,
  });

  const haloMaterial = new THREE.MeshStandardMaterial({
    color: 0xff6b35,
    emissive: 0xff5a1f,
    emissiveIntensity: 2.2,
    roughness: 0.2,
    metalness: 0.1,
  });

  // === Architectural Stepped Pedestal ===
  // Base tier
  const tier1 = new THREE.Mesh(new RoundedBoxGeometry(4.1, 0.2, 1.85, 6, 0.04), obsidianMat);
  tier1.position.set(0, 0.1, 0);
  tier1.castShadow = true;
  tier1.receiveShadow = true;
  group.add(tier1);

  // Glowing perimeter strip between tier 1 and tier 2
  const glowStrip = new THREE.Mesh(new RoundedBoxGeometry(3.88, 0.035, 1.63, 4, 0.015), haloMaterial);
  glowStrip.position.set(0, 0.215, 0);
  group.add(glowStrip);

  // Tier 2 brushed titanium plinth
  const tier2 = new THREE.Mesh(new RoundedBoxGeometry(3.75, 0.22, 1.5, 6, 0.04), brushedTitaniumMat);
  tier2.position.set(0, 0.34, 0);
  tier2.castShadow = true;
  tier2.receiveShadow = true;
  group.add(tier2);

  // Top dark stage plate
  const tier3 = new THREE.Mesh(new RoundedBoxGeometry(3.45, 0.08, 1.25, 4, 0.025), obsidianMat);
  tier3.position.set(0, 0.49, 0);
  tier3.castShadow = true;
  tier3.receiveShadow = true;
  group.add(tier3);

  // Copper/Orange inlay border around top plate
  const trimRing = new THREE.Mesh(new RoundedBoxGeometry(3.52, 0.02, 1.32, 4, 0.01), copperTrimMat);
  trimRing.position.set(0, 0.455, 0);
  group.add(trimRing);

  // Engraved Front Nameplate
  const plaqueTex = createVngPlaqueTexture();
  const plaqueMat = new THREE.MeshStandardMaterial({
    map: plaqueTex,
    metalness: 0.65,
    roughness: 0.28,
  });
  const plaqueBacking = new THREE.Mesh(new RoundedBoxGeometry(1.78, 0.24, 0.05, 3, 0.01), brushedTitaniumMat);
  plaqueBacking.position.set(0, 0.26, 0.78);
  plaqueBacking.rotation.x = -0.32;
  group.add(plaqueBacking);

  const plaqueFace = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.2), plaqueMat);
  plaqueFace.position.set(0, 0.268, 0.807);
  plaqueFace.rotation.x = -0.32;
  group.add(plaqueFace);

  // 4 Corner Micro Uplight Projectors on the pedestal
  const uplightPositions: [number, number][] = [
    [-1.62, 0.56],
    [1.62, 0.56],
    [-1.62, -0.56],
    [1.62, -0.56],
  ];
  for (const [ux, uz] of uplightPositions) {
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.09, 16), brushedTitaniumMat);
    housing.position.set(ux, 0.56, uz);
    housing.castShadow = true;
    group.add(housing);

    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.015, 16), haloMaterial);
    lens.position.set(ux, 0.606, uz);
    group.add(lens);
  }

  // === Floating VNG Monument Sculpture ===
  const logoFloatGroup = new THREE.Group();
  logoFloatGroup.position.set(0, 1.48, 0);
  group.add(logoFloatGroup);

  const shapes = createVngLetterShapes(0.0235); // ~3.38m wide, ~1.36m tall

  // Layer 1: Brushed Titanium Backplate Chassis
  const backGeo = new THREE.ExtrudeGeometry(shapes, {
    depth: 0.18,
    bevelEnabled: true,
    bevelThickness: 0.035,
    bevelSize: 0.038,
    bevelSegments: 6,
    curveSegments: 48,
  });
  backGeo.center();
  const backMesh = new THREE.Mesh(backGeo, brushedTitaniumMat);
  backMesh.position.z = -0.14;
  backMesh.castShadow = true;
  backMesh.receiveShadow = true;
  logoFloatGroup.add(backMesh);

  // Layer 2: Glowing Emissive Core Layer (creates razor-sharp neon orange halo around letters)
  const coreGeo = new THREE.ExtrudeGeometry(shapes, {
    depth: 0.1,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.024,
    bevelSegments: 4,
    curveSegments: 48,
  });
  coreGeo.center();
  const coreMesh = new THREE.Mesh(coreGeo, haloMaterial);
  coreMesh.position.z = -0.02;
  logoFloatGroup.add(coreMesh);

  // Layer 3: Front Glossy Cinnabar Orange Official VNG Face
  const frontGeo = new THREE.ExtrudeGeometry(shapes, {
    depth: 0.24,
    bevelEnabled: true,
    bevelThickness: 0.045,
    bevelSize: 0.02,
    bevelSegments: 8,
    curveSegments: 48,
  });
  frontGeo.center();
  const frontMesh = new THREE.Mesh(frontGeo, vngOrangeFaceMat);
  frontMesh.position.z = 0.09;
  frontMesh.castShadow = true;
  frontMesh.receiveShadow = true;
  logoFloatGroup.add(frontMesh);

  // Precision Chrome/Titanium Mounting Spine behind letters
  const spineBar = new THREE.Mesh(new RoundedBoxGeometry(2.75, 0.12, 0.08, 4, 0.02), brushedTitaniumMat);
  spineBar.position.set(0, 0, -0.26);
  spineBar.castShadow = true;
  logoFloatGroup.add(spineBar);

  // Precision Architectural Orbital Rings framing the Monument
  const orbitalRing = new THREE.Mesh(
    new THREE.TorusGeometry(2.05, 0.022, 16, 128),
    brushedTitaniumMat
  );
  orbitalRing.position.set(0, 1.48, -0.18);
  orbitalRing.rotation.x = 0.18;
  orbitalRing.rotation.y = -0.14;
  group.add(orbitalRing);

  const innerRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.94, 0.01, 12, 128),
    haloMaterial
  );
  innerRing.position.set(0, 1.48, -0.18);
  innerRing.rotation.x = -0.22;
  innerRing.rotation.y = 0.2;
  group.add(innerRing);

  // Dedicated warm orange glow light around the monument
  const spotLight = new THREE.PointLight(0xff6b35, 3.2, 6.5, 1.8);
  spotLight.position.set(0, 1.45, 1.05);
  group.add(spotLight);

  // Tag all meshes for raycasting
  group.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      obj.userData.itemId = 'vng-monument';
    }
  });

  const update = (elapsed: number, haloEnabled: boolean, levitateEnabled: boolean) => {
    if (levitateEnabled) {
      logoFloatGroup.position.y = 1.48 + Math.sin(elapsed * 1.4) * 0.055;
      logoFloatGroup.rotation.y = Math.sin(elapsed * 0.6) * 0.04;
    } else {
      logoFloatGroup.position.y = THREE.MathUtils.lerp(logoFloatGroup.position.y, 1.48, 0.1);
      logoFloatGroup.rotation.y = THREE.MathUtils.lerp(logoFloatGroup.rotation.y, 0, 0.1);
    }

    orbitalRing.rotation.z = elapsed * 0.16;
    innerRing.rotation.z = -elapsed * 0.24;

    const targetIntensity = haloEnabled ? 2.1 + Math.sin(elapsed * 2.5) * 0.45 : 0.05;
    haloMaterial.emissiveIntensity = THREE.MathUtils.lerp(haloMaterial.emissiveIntensity, targetIntensity, 0.12);
    spotLight.intensity = haloEnabled ? 2.8 + Math.sin(elapsed * 2.5) * 0.5 : 0.2;
  };

  return {
    group,
    logoFloatGroup,
    orbitalRing,
    innerRing,
    haloMaterial,
    spotLight,
    update,
  };
}
