import * as THREE from 'three';
import type { MaterialLibrary } from './materials';
import { makeLabelPlane, roundedBox } from './geometry';
import { labelTexture } from './textures';

export const DATUM = {
  deckY: -0.94,
  floorTopY: -0.90,
  sillY: -0.24,
  eyeY: 0.135,
  eyeZ: 0.38,
  fwdZ: -1.16,
  aftZ: 1.08,
  mipZ: -0.64,
  mipY: -0.235,
  mipTilt: -0.26, // ~15 deg aft tilt toward Design Eye Point
  seatZ: 0.34,
  seatSrpY: -0.54,
};

/** Half-width of outer pressure hull at longitudinal station z and vertical fraction v in [0,1] */
export function hullHalfWidth(z: number, v: number): number {
  const u = THREE.MathUtils.clamp((z - DATUM.fwdZ) / (DATUM.aftZ - DATUM.fwdZ), 0, 1);
  // Smooth aerospace fuselage planform taper
  const plan = 0.755 + 0.085 * Math.sin(Math.pow(u, 0.78) * Math.PI * 0.88);
  // Barrel section bulge between deck chine (v=0) and sill coaming (v=1)
  const barrel = -0.045 * (1 - v) + 0.042 * Math.sin(v * Math.PI) - 0.022 * v;
  return plan + barrel;
}

export function hullOuterPoint(s: number, u: number, v: number, out: THREE.Vector3): THREE.Vector3 {
  const z = DATUM.fwdZ + u * (DATUM.aftZ - DATUM.fwdZ);
  const y = DATUM.deckY + v * (DATUM.sillY - DATUM.deckY);
  const x = s * hullHalfWidth(z, v);
  return out.set(x, y, z);
}

/** Shared canopy spaceframe structural nodes (calibrated to FAR 25.773 21.5° upward sight cone) */
export const SPACEFRAME = {
  aBase: (s: number) => new THREE.Vector3(s * hullHalfWidth(-1.04, 1), DATUM.sillY, -1.04),
  aTop: (s: number) => new THREE.Vector3(s * 0.46, 0.54, -0.90),
  bBase: (s: number) => new THREE.Vector3(s * hullHalfWidth(-0.18, 1), DATUM.sillY, -0.18),
  bTop: (s: number) => new THREE.Vector3(s * 0.39, 0.62, -0.18),
  cBase: (s: number) => new THREE.Vector3(s * hullHalfWidth(0.74, 1), DATUM.sillY, 0.74),
  cTop: (s: number) => new THREE.Vector3(s * 0.37, 0.63, 0.74),
};

export interface BuildContext {
  group: THREE.Group;
  mats: MaterialLibrary;
  track: <T extends { dispose: () => void }>(v: T) => T;
  mesh: (
    geo: THREE.BufferGeometry,
    m: THREE.Material,
    x?: number,
    y?: number,
    z?: number,
    rx?: number,
    ry?: number,
    rz?: number,
    parent?: THREE.Object3D,
  ) => THREE.Mesh;
  box: (
    w: number,
    h: number,
    d: number,
    m: THREE.Material,
    x: number,
    y: number,
    z: number,
    rx?: number,
    ry?: number,
    rz?: number,
    r?: number,
    parent?: THREE.Object3D,
  ) => THREE.Mesh;
  decal: (texture: THREE.Texture, w: number, h: number, parent?: THREE.Object3D) => THREE.Mesh;
  label: (text: string, sub: string, w?: number, h?: number, color?: string) => { texture: THREE.CanvasTexture; w: number; h: number };
  screenMeshes: THREE.Mesh[];
  decals: THREE.Object3D[];
  ledMaterials: THREE.MeshStandardMaterial[];
}

export function createBuildContext(group: THREE.Group, mats: MaterialLibrary): BuildContext & { disposables: { dispose: () => void }[] } {
  const disposables: { dispose: () => void }[] = [];
  const screenMeshes: THREE.Mesh[] = [];
  const decals: THREE.Object3D[] = [];
  const ledMaterials: THREE.MeshStandardMaterial[] = [mats.warm, mats.cyan, mats.red, mats.green, mats.caution];

  const track = <T extends { dispose: () => void }>(v: T): T => {
    disposables.push(v);
    return v;
  };

  const mesh = (
    geo: THREE.BufferGeometry,
    m: THREE.Material,
    x = 0,
    y = 0,
    z = 0,
    rx = 0,
    ry = 0,
    rz = 0,
    parent: THREE.Object3D = group,
  ) => {
    track(geo);
    const obj = new THREE.Mesh(geo, m);
    obj.position.set(x, y, z);
    obj.rotation.set(rx, ry, rz);
    obj.castShadow = true;
    obj.receiveShadow = true;
    parent.add(obj);
    return obj;
  };

  const box = (
    w: number,
    h: number,
    d: number,
    m: THREE.Material,
    x: number,
    y: number,
    z: number,
    rx = 0,
    ry = 0,
    rz = 0,
    r = 0.005,
    parent: THREE.Object3D = group,
  ) => {
    const obj = new THREE.Mesh(track(roundedBox(w, h, d, r, 3)), m);
    obj.position.set(x, y, z);
    obj.rotation.set(rx, ry, rz);
    obj.castShadow = true;
    obj.receiveShadow = true;
    parent.add(obj);
    return obj;
  };

  const decal = (texture: THREE.Texture, w: number, h: number, parent: THREE.Object3D = group) => {
    const p = makeLabelPlane(texture, w, h);
    track(p.geometry);
    track(p.material as THREE.Material);
    decals.push(p);
    parent.add(p);
    return p;
  };

  const label = (text: string, sub: string, w = 0.12, h = 0.03, color = '#d0e2e8') => {
    const tex = track(labelTexture(text, sub, color, 512, 128));
    return { texture: tex, w, h };
  };

  return {
    group,
    mats,
    track,
    mesh,
    box,
    decal,
    label,
    screenMeshes,
    decals,
    ledMaterials,
    disposables,
  };
}
