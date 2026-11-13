import * as THREE from 'three';
import { cockpitState, onCockpit, setCockpit, type CockpitLang } from '../lib/cockpitBus';
import { disposeFurnishing, furnishCockpit } from './furnish';
import {
  makeCanvas,
  paintKey,
  paintScreen,
  SCREEN_W,
  SCREEN_H,
  MAIN_W,
  MAIN_H,
  type ScreenData,
} from '../lib/screenPaint';

/* ────────────────────────────────────────────────────────────────────────────
   Buồng lái — a real 3D cockpit interior.

   Rebuilt from scratch. The previous version was ~24 boxes: a dash, two
   pillars, an arch and a floor, with eight CC0 props bolted on. Rasterising it
   showed why it read as "almost nothing there": the cabin was an open void with
   a few slabs in front of it. There was no ceiling, no side walls, no seat, no
   console between the knees, no overhead panel — the frame edges of a cockpit
   that tell your eye "I am inside something".

   This version is built as an actual cockpit:

   • A CLOSED SHELL. Canopy canopy arch, side walls that lean in, an overhead
     panel, a spine that runs to the aft bulkhead, a floor with a raised well.
     Wherever the camera can look, something is there.
   • DENSE SURFACE DETAIL. Several hundred greebles — panel seams, rivets,
     switch banks, vent slats, cable bundles, bolt heads — built from ONE
     BoxGeometry and drawn with InstancedMesh. That is ~6 draw calls for
     hundreds of pieces, so density costs almost nothing.
   • THE INSTRUMENTS A PILOT WOULD REACH FOR. A centre pedestal between the
     knees with throttles, a grab handle, and a lit annunciator row.
   • The primary report and six selector keys, unchanged in placement, because
     that layout was verified readable.

   Performance profile:
   • Static geometry. The frame loop does zero matrix work.
   • Screens repaint ONLY on content change, never per frame.
   • No shadow maps, no post-processing, no transparency in the cabin.
   • Lights: the cabin relies on the point lamps SpaceScene mounts. This file
     adds none, so it cannot change NUM_POINT_LIGHTS and trigger a shader
     recompile (see tests/activation-no-light-recompile.mjs).
   ──────────────────────────────────────────────────────────────────────────── */

const DEG = Math.PI / 180;

interface ScreenSlot {
  id: number;
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  bezel: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  canvas: HTMLCanvasElement;
  texture: THREE.CanvasTexture;
  section: number | null;
  link?: string;
  /** Emissive level when this screen is not the selected section. */
  baseGlow: number;
}

export interface CockpitHandles {
  group: THREE.Group;
  /** Resolves once the CC0 props have been folded in (or have failed). */
  propsReady: Promise<void>;
  handlePointer: (clientX: number, clientY: number, camera: THREE.Camera) => void;
  activate: (camera: THREE.Camera) => boolean;
  dispose: () => void;
}

export const SECTION_LABELS: Record<CockpitLang, string[]> = {
  vi: ['DANH TÍNH', 'THÔNG TIN', 'HÀNH TRÌNH', 'DỰ ÁN', 'CÔNG NGHỆ', 'LIÊN HỆ'],
  en: ['IDENTITY', 'FACTS', 'JOURNEY', 'PROJECTS', 'STACK', 'CONTACT'],
};

/** Single place that decides how wide the visible canopy cone is. */
function visibleHalfAngle(aspect: number): number {
  const tanHalfV = Math.tan((58 * DEG) / 2);
  return Math.min(0.46, Math.atan(tanHalfV * Math.max(0.5, aspect) * 0.90));
}

/* Cabin dimensions, in metres, in cockpit space (camera at the origin looking
   down -z). Everything below is expressed against these so the shell stays
   geometrically consistent. */
const CAB = {
  floorY: -1.36,
  ceilY: 0.92,
  /** Half-width at the floor, and at the canopy rail. The walls lean in. */
  halfWFloor: 1.62,
  halfWRail: 1.16,
  frontZ: -2.62,
  aftZ: 1.34,
};

export function buildCockpit(data: ScreenData): CockpitHandles {
  const group = new THREE.Group();
  group.name = 'cockpit-interior';

  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(o: T): T => {
    disposables.push(o);
    return o;
  };

  /* ── materials ──────────────────────────────────────────────────────────
     Six materials for the entire shell. Textured detail would cost texture
     memory and a sampler for no legibility gain at these viewing distances;
     the read comes from silhouette and specular breakup instead. */
  /* Value separation matters more than hue here. When every surface sat
     within a few percent of the same grey the cabin rasterised as one flat
     wash, which reads as "nothing there" just as surely as an empty void did.
     These four now span roughly 4x in luminance, so edges and recesses
     separate without needing shadows (there are no shadow maps). */
  const hullMat = track(new THREE.MeshStandardMaterial({
    color: 0x232c38, roughness: 0.58, metalness: 0.70,
    emissive: 0x0a1220, emissiveIntensity: 0.55,
  }));
  const panelMat = track(new THREE.MeshStandardMaterial({
    color: 0x35455a, roughness: 0.44, metalness: 0.76,
    emissive: 0x14202f, emissiveIntensity: 0.45,
  }));
  const darkMat = track(new THREE.MeshStandardMaterial({
    color: 0x0b0f16, roughness: 0.88, metalness: 0.40,
    emissive: 0x05090f, emissiveIntensity: 0.5,
  }));
  const trimMat = track(new THREE.MeshStandardMaterial({
    color: 0x7d93ab, roughness: 0.30, metalness: 0.90,
    emissive: 0x1a2634, emissiveIntensity: 0.35,
  }));
  const stripMat = track(new THREE.MeshBasicMaterial({ color: 0x63d8ff, toneMapped: false }));
  const warmStripMat = track(new THREE.MeshBasicMaterial({ color: 0xffbe72, toneMapped: false }));

  /* One BoxGeometry feeds every greeble. Unit cube, scaled per instance. */
  const unitBox = track(new THREE.BoxGeometry(1, 1, 1));

  /* ── greeble accumulator ──────────────────────────────────────────────────
     Detail is collected first and flushed into InstancedMesh per material at
     the end. Hundreds of seams and rivets then cost a handful of draw calls
     instead of hundreds. */
  type Greeble = { m: THREE.Matrix4 };
  const buckets: Record<string, Greeble[]> = { hull: [], panel: [], dark: [], trim: [] };
  const _q = new THREE.Quaternion();
  const _e = new THREE.Euler();
  const _p = new THREE.Vector3();
  const _s = new THREE.Vector3();

  const greeble = (
    bucket: keyof typeof buckets,
    w: number, h: number, d: number,
    x: number, y: number, z: number,
    rx = 0, ry = 0, rz = 0,
  ) => {
    _e.set(rx, ry, rz);
    _q.setFromEuler(_e);
    _p.set(x, y, z);
    _s.set(w, h, d);
    buckets[bucket].push({ m: new THREE.Matrix4().compose(_p, _q, _s) });
  };

  /* ── solid shell pieces ───────────────────────────────────────────────── */
  const solid = (
    w: number, h: number, d: number,
    x: number, y: number, z: number,
    mat: THREE.Material, rx = 0, ry = 0, rz = 0,
  ) => {
    // NOTE: this must NOT reuse `unitBox`. That geometry is the shared source
    // for the InstancedMesh batches below, and a Mesh attached to it inherits
    // the INSTANCE bounds -- a 3 m slab ended up reporting the size of the
    // whole detail pass, which made frustum culling and every measurement
    // downstream wrong. One geometry per slab is a few hundred bytes.
    const m = new THREE.Mesh(track(new THREE.BoxGeometry(w, h, d)), mat);
    m.scale.set(1, 1, 1);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    group.add(m);
    return m;
  };

  /* ═══ 1. THE SHELL ═══════════════════════════════════════════════════════
     Anything the camera can see must be occupied. The previous cabin had a
     dash and a floor and nothing else, which is exactly why it read as empty. */

  // Floor: a raised well under the pedals, and a flat deck under the seat.
  solid(3.30, 0.10, 3.90, 0, CAB.floorY - 0.05, -0.60, darkMat);
  solid(2.30, 0.12, 1.30, 0, CAB.floorY + 0.06, -1.95, hullMat); // pedal well
  for (let i = 0; i < 7; i++) {
    greeble('trim', 2.10 - i * 0.05, 0.016, 0.05, 0, CAB.floorY + 0.13, -2.30 + i * 0.13);
  }

  // Side walls: three slanted slabs per side, leaning inward toward the rail.
  // Each is slightly rotated about z so the wall follows the canopy taper.
  for (const s of [-1, 1]) {
    // lower wall
    solid(0.10, 0.86, 3.70, s * 1.52, -0.90, -0.60, hullMat, 0, 0, s * 7 * DEG);
    // mid wall, leaning in
    solid(0.09, 0.92, 3.50, s * 1.32, -0.10, -0.62, panelMat, 0, 0, s * 13 * DEG);
    // canopy sill only -- deliberately stops at y ~0.5 so the glass above it
    // stays open to space. A full-height wall made the cabin a tunnel.
    solid(0.09, 0.30, 3.10, s * 1.14, 0.40, -0.66, hullMat, 0, 0, s * 18 * DEG);
    // skirting light along the floor joint
    greeble('trim', 0.05, 0.03, 3.40, s * 1.46, CAB.floorY + 0.10, -0.60);
    // horizontal panel seam lines up the wall
    for (let i = 0; i < 9; i++) {
      greeble('trim', 0.02, 0.014, 0.9, s * 1.47, -1.10 + i * 0.16, -0.20 - (i % 3) * 0.2);
    }
  }

  /* The canopy overhead is LEFT OPEN on purpose. A fully closed ceiling
     fills the upper half of the frame with a flat wall and destroys the one
     thing that says "spaceship": space, visible through the glass. Only a
     narrow spine and two cross members are added here, so the upper frame
     still reads as structure while the nebula shows between them. */
  solid(0.30, 0.10, 2.40, 0, CAB.ceilY + 0.04, 0.16, panelMat); // spine
  for (let i = 0; i < 12; i++) {
    greeble('trim', 0.05, 0.045, 0.045,
      -0.10 + (i % 3) * 0.10, CAB.ceilY - 0.02, -0.86 + Math.floor(i / 3) * 0.30);
  }
  // two cross members, thin enough to frame the canopy without blocking it
  for (const z of [-0.30, 0.62]) {
    greeble('hull', 2.10, 0.055, 0.07, 0, CAB.ceilY - 0.02, z);
  }

  // Aft bulkhead, so turning around is not a hole into the void.
  solid(3.40, 2.50, 0.14, 0, -0.10, CAB.aftZ, hullMat);
  solid(1.60, 0.60, 0.10, 0, 0.30, CAB.aftZ - 0.12, panelMat);
  for (let i = 0; i < 10; i++) {
    greeble('trim', 0.02, 0.34, 0.02, -0.72 + i * 0.16, 0.30, CAB.aftZ - 0.19);
  }

  // Canopy frame: a heavy arch across the front, and two A-pillars.
  for (const s of [-1, 1]) {
    const pillar = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.055, 0.075, 1.62, 10)),
      hullMat,
    );
    // Push the A-pillars OUT to the corners so they frame the canopy instead
    // of standing in the middle of the view. At x = 1.10 they sat inside the
    // window and, being only 1.3 m from the camera, a 5 cm cylinder projected
    // as a thick bright bar cutting corner to corner.
    pillar.position.set(s * 1.52, -0.20, -2.30);
    pillar.rotation.set(-0.10, 0, s * 5 * DEG);
    group.add(pillar);

    /* The shoulder brace was removed. Its 1.15 rad roll made it cross the
       canopy opening diagonally, and at that distance it read as a fallen
       pole. The structure it was meant to add now comes from the arch, the
       header and the hull panels, which stay outside the window. */
  }
  const arch = new THREE.Mesh(
    track(new THREE.TorusGeometry(1.42, 0.062, 8, 26, Math.PI)),
    hullMat,
  );
  arch.position.set(0, 0.02, -2.10);
  arch.rotation.set(0.20, 0, 0);
  group.add(arch);
  // header above the glass
  solid(2.30, 0.22, 0.46, 0, 0.80, -2.02, hullMat, 26 * DEG, 0, 0);

  /* ═══ 2. THE DASH ════════════════════════════════════════════════════════ */

  // Main dash mass, angled toward the pilot.
  // Dash mass. Its top edge must stay below key row 2's bottom bezel; at
  // y = -0.55 with a 0.62 height the lip lands around 96% of the frame and
  // clipped row two on a 16:9 window.
  solid(2.90, 0.52, 1.10, 0, -0.62, -2.10, panelMat, -14 * DEG, 0, 0);
  // Hood over the primary display: a lip that catches the cabin light.
  solid(1.62, 0.09, 0.30, 0, 0.82, -2.16, hullMat, 34 * DEG, 0, 0);

  // The two outer consoles flanking the keys, angled inward.
  for (const s of [-1, 1]) {
    solid(0.72, 0.30, 0.92, s * 1.20, -0.62, -2.22, panelMat, -20 * DEG, s * -22 * DEG, 0);
    // switch bank: three rows of five toggles
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 5; c++) {
        greeble('trim', 0.030, 0.024, 0.062,
          s * (0.94 + c * 0.115), -0.50 + r * 0.075, -2.02 - r * 0.04,
          -18 * DEG, s * -22 * DEG, 0);
      }
    }
    // rocker switches with warm caps
    for (let c = 0; c < 3; c++) {
      greeble('dark', 0.05, 0.018, 0.05, s * (1.06 + c * 0.13), -0.72, -2.14, -18 * DEG, s * -22 * DEG, 0);
    }
    // vent slats on the outer edge
    for (let i = 0; i < 4; i++) {
      greeble('hull', 0.012, 0.09, 0.16, s * 1.50, -0.44, -2.30 + i * 0.13, 0, s * -8 * DEG, 0);
    }
  }

  // Centre pedestal between the pilot's knees: throttle quadrant + handle.
  solid(0.52, 0.44, 1.30, 0, -1.02, -1.30, darkMat, -6 * DEG, 0, 0);
  solid(0.60, 0.06, 1.34, 0, -0.79, -1.30, panelMat, -6 * DEG, 0, 0);
  for (const s of [-1, 1]) {
    const lever = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.018, 0.022, 0.30, 8)),
      trimMat,
    );
    lever.position.set(s * 0.13, -0.68, -1.10);
    lever.rotation.set(-0.34, 0, s * 0.10);
    group.add(lever);
    // grip knob, warm so it reads as the thing you grab
    const knob = new THREE.Mesh(track(new THREE.SphereGeometry(0.042, 10, 8)), warmStripMat);
    knob.position.set(s * 0.13, -0.55, -1.15);
    group.add(knob);
  }
  // Annunciator row: five lit cells on the pedestal face.
  for (let i = 0; i < 5; i++) {
    greeble('dark', 0.075, 0.045, 0.02, -0.20 + i * 0.10, -0.92, -1.63 + i * 0.004);
  }

  /* ═══ 3. THE SEAT ════════════════════════════════════════════════════════
     Mostly below the frame, but the backrest and headrest ARE in shot when the
     view settles, and its presence is what makes the camera feel seated rather
     than floating. */
  solid(0.62, 0.16, 0.70, 0, -1.24, -0.42, darkMat, 6 * DEG, 0, 0); // pan
  solid(0.60, 0.86, 0.16, 0, -0.72, 0.16, darkMat, -9 * DEG, 0, 0); // backrest
  solid(0.42, 0.24, 0.14, 0, -0.18, 0.13, panelMat, -9 * DEG, 0, 0); // headrest
  for (const s of [-1, 1]) {
    solid(0.09, 0.40, 0.60, s * 0.34, -1.10, -0.40, hullMat, 0, 0, s * -8 * DEG);
  }

  /* ═══ 4. SURFACE DETAIL ══════════════════════════════════════════════════
     Rivets, seams, cable bundles, bolt heads. This is what stops the surfaces
     reading as empty slabs. All of it lands in the instanced buckets above. */
  const rivetRows = (x0: number, x1: number, n: number, y: number, z: number, s: number) => {
    for (let i = 0; i < n; i++) {
      const x = x0 + (x1 - x0) * (i / Math.max(1, n - 1));
      greeble('trim', 0.022, 0.022, 0.022, x, y, z);
      void s;
    }
  };
  rivetRows(-1.30, 1.30, 26, -0.24, -2.30, 1);
  rivetRows(-1.24, 1.24, 24, -0.90, -2.18, 1);
  rivetRows(-1.10, 1.10, 20, 0.62, -2.06, 1);

  /* The 1.9 m cable bundles that used to run here were removed. Lying almost
     horizontal at y ~ -0.75 they projected as two thick bright bars slicing
     across the canopy -- the "fallen pole" artefact. The wall detailing they
     were meant to add is now covered by the instanced pipework and clamps in
     the dense-detail pass, which sit flat against the hull. */

  // Greeble scatter over the dash face: inset panels of mixed sizes.
  for (let i = 0; i < 34; i++) {
    const s = i % 2 ? 1 : -1;
    const u = (i * 37) % 100 / 100;
    const v = (i * 61) % 100 / 100;
    greeble('hull',
      0.06 + u * 0.16, 0.012, 0.05 + v * 0.10,
      s * (0.34 + u * 0.92), -0.36 - v * 0.34, -2.14 + v * 0.10,
      -14 * DEG, 0, 0);
  }

  /* ── dense detail pass ──────────────────────────────────────────────────
     The cabin has no shadow maps and no ambient occlusion, so its surfaces get
     their read entirely from silhouette and from small high-contrast pieces.
     That is why the detail budget goes here rather than into geometry that is
     hidden behind the dash. Every one of these is an instance in a shared
     InstancedMesh, so the whole pass is three draw calls. */

  // A) Heat-exchanger louvres along both lower walls: 14 slats a side.
  for (const s of [-1, 1]) {
    for (let i = 0; i < 14; i++) {
      greeble('dark', 0.030, 0.10, 0.020,
        s * 1.49, CAB.floorY + 0.22 + i * 0.055, -1.05 - (i % 2) * 0.02,
        0, 0, s * 8 * DEG);
    }
  }

  // B) Bolt heads around the canopy arch, and around the aft hatch.
  for (let i = 0; i < 22; i++) {
    const a = (i / 21) * Math.PI;
    greeble('trim', 0.026, 0.026, 0.026,
      Math.cos(a) * 1.40, 0.04 + Math.sin(a) * 1.40, -2.08,
      0, 0, 0);
  }
  for (let i = 0; i < 18; i++) {
    const a = (i / 17) * Math.PI;
    greeble('trim', 0.022, 0.022, 0.022,
      Math.cos(a) * 0.55, 0.30 + Math.sin(a) * 0.55, CAB.aftZ - 0.16);
  }

  // C) Rivet lines across the overhead spine and the aft bulkhead.
  for (let i = 0; i < 16; i++) {
    greeble('trim', 0.018, 0.018, 0.018, -0.12, CAB.ceilY - 0.03, -0.90 + i * 0.16);
    greeble('trim', 0.018, 0.018, 0.018, 0.12, CAB.ceilY - 0.03, -0.90 + i * 0.16);
  }

  // D) Instrument canisters racked under the overhead panel.
  for (let i = 0; i < 9; i++) {
    const x = -0.56 + (i % 3) * 0.28;
    const z = -1.72 + Math.floor(i / 3) * 0.22;
    greeble('hull', 0.20, 0.055, 0.15, x, CAB.ceilY - 0.10, z);
    greeble('dark', 0.16, 0.014, 0.11, x, CAB.ceilY - 0.135, z);
  }

  // E) Pipework runs: three parallel conduits per side, clipping along the
  //    wall with clamps at intervals.
  for (const s of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      // Down the lower wall, well below the canopy sill, so it never crosses
      // the glass. The earlier run climbed to y = -0.10 and read as a bright
      // bar slicing across the sky.
      for (let i = 0; i < 7; i++) {
        greeble('trim', 0.020, 0.020, 0.26,
          s * (1.44 + k * 0.030), -0.86 + k * 0.045, -1.10 + i * 0.30);
      }
      for (let i = 0; i < 4; i++) {
        greeble('dark', 0.052, 0.052, 0.032,
          s * (1.44 + k * 0.030), -0.86 + k * 0.045, -1.00 + i * 0.52);
      }
    }
  }

  // F) Floor tread plates: raised strips down the walkway.
  for (let i = 0; i < 11; i++) {
    greeble('trim', 0.62, 0.014, 0.055, 0, CAB.floorY + 0.085, -1.90 + i * 0.26);
  }

  // G) Warning placards: small high-contrast plates where a pilot would look.
  const placards: [number, number, number][] = [
    [-0.92, -0.30, -2.18], [0.92, -0.30, -2.18],
    [-1.34, -0.62, -1.30], [1.34, -0.62, -1.30],
    [0, CAB.ceilY - 0.16, -0.55],
  ];
  for (const [x, y, z] of placards) {
    greeble('trim', 0.13, 0.075, 0.012, x, y, z);
    greeble('dark', 0.10, 0.048, 0.016, x, y, z - 0.004);
  }

  /* H) Handholds, moved OUT past the canopy edge. At x = +-1.20 with y = 0.30
     they sat inside the window: five 34 cm bright bars per side, and at 1.3 m
     from the camera each one projected as a pale streak across the sky. They
     now grip the sill itself, where a pilot's hand would actually go. */
  for (const s of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      greeble('trim', 0.030, 0.030, 0.30, s * 1.44, 0.20, -1.90 + i * 0.32);
    }
  }

  /* ── flush greebles into instanced meshes ─────────────────────────────── */
  const bucketMat: Record<string, THREE.Material> = {
    hull: hullMat, panel: panelMat, dark: darkMat, trim: trimMat,
  };
  let greebleCount = 0;
  for (const key of Object.keys(buckets)) {
    const list = buckets[key];
    if (!list.length) continue;
    const inst = new THREE.InstancedMesh(unitBox, bucketMat[key], list.length);
    inst.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    for (let i = 0; i < list.length; i++) inst.setMatrixAt(i, list[i].m);
    inst.instanceMatrix.needsUpdate = true;
    // `computeBoundingBox()` is REQUIRED here. An InstancedMesh without an
    // explicit bounding box reports the bounds of the source geometry at the
    // identity matrix, i.e. a unit cube sitting on the camera at the origin.
    // Intersecting that with the frustum kept the batch in view, and the
    // resulting mismatch drew stray slabs across the canopy -- the bright bars
    // over the sky. The box also has to be computed from the instances, so the
    // object is measured correctly by anything downstream (including the
    // placement tests).
    inst.computeBoundingBox();
    inst.computeBoundingSphere();
    inst.frustumCulled = false; // the shell is always around the camera
    inst.name = `cockpit-greebles-${key}`;
    group.add(inst);
    greebleCount += list.length;
  }

  /* ═══ 5. EMISSIVE RUNNING LIGHTS ═════════════════════════════════════════ */
  const strip = (
    w: number, h: number, d: number,
    x: number, y: number, z: number,
    warm = false, rx = 0,
  ) => {
    const m = new THREE.Mesh(track(new THREE.BoxGeometry(w, h, d)), warm ? warmStripMat : stripMat);
    m.position.set(x, y, z);
    m.rotation.x = rx;
    group.add(m);
  };
  // under the glass
  strip(1.26, 0.018, 0.018, 0, -0.20, -2.34);
  // side console edges
  strip(0.66, 0.016, 0.016, -1.20, -0.50, -1.96, false, -20 * DEG);
  strip(0.66, 0.016, 0.016, 1.20, -0.50, -1.96, false, -20 * DEG);
  // pedestal
  strip(0.44, 0.016, 0.016, 0, -0.86, -1.70);
  // wall accents, vertical
  strip(0.018, 0.70, 0.018, -1.40, 0.10, -0.60);
  strip(0.018, 0.70, 0.018, 1.40, 0.10, -0.60);
  // ceiling spine
  strip(0.02, 0.02, 2.20, 0, CAB.ceilY - 0.14, 0.10);
  // two warm marker lamps on the overhead tray
  strip(0.09, 0.020, 0.020, -0.52, CAB.ceilY - 0.19, -1.60, true);
  strip(0.09, 0.020, 0.020, 0.52, CAB.ceilY - 0.19, -1.60, true);

  /* ═══ 6. SCREENS ═════════════════════════════════════════════════════════ */
  const state = cockpitState();
  const screens: ScreenSlot[] = [];
  let mainSection = 0;

  const addScreen = (
    id: number,
    canvas: HTMLCanvasElement,
    width: number,
    section: number | null,
    baseGlow: number,
    link?: string,
  ): ScreenSlot => {
    const texture = track(new THREE.CanvasTexture(canvas));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.anisotropy = 4;

    // MeshStandardMaterial with the canvas as `emissiveMap`, not MeshBasic with
    // `map`. A basic material ignores light entirely, which is why the screens
    // previously looked pasted onto a dark room. An emissive map still reads at
    // full contrast in the dark but takes a little of the cabin's directional
    // shading, so the glass sits IN the dash instead of floating in front of it.
    const material = track(new THREE.MeshStandardMaterial({
      map: texture,
      emissiveMap: texture,
      emissive: 0xffffff,
      emissiveIntensity: baseGlow,
      color: 0xffffff,
      roughness: 0.22,
      metalness: 0.0,
      toneMapped: false,
    }));

    const height = (width * canvas.height) / canvas.width;
    const mesh = new THREE.Mesh(track(new THREE.PlaneGeometry(width, height)), material);
    mesh.name = 'cockpit-screen-' + id;
    group.add(mesh);

    const bezel = new THREE.Mesh(
      track(new THREE.PlaneGeometry(width + 0.044, height + 0.044)),
      darkMat,
    );
    bezel.renderOrder = -1;
    group.add(bezel);

    const slot: ScreenSlot = { id, mesh, bezel, canvas, texture, section, link, baseGlow };
    screens.push(slot);
    return slot;
  };

  const mainCanvas = makeCanvas(MAIN_W, MAIN_H);
  const main = addScreen(0, mainCanvas, 1.18, 0, 1.0);

  const keys: ScreenSlot[] = [];
  for (let i = 0; i < 6; i++) {
    const canvas = makeCanvas(SCREEN_W, SCREEN_H);
    keys.push(addScreen(i + 1, canvas, 0.54, i, 0.62));
  }

  /* ── placement (aspect aware, nothing can leave the frame) ────────────── */
  const PRIMARY = { y: 0.30, radius: 2.06, tilt: -0.06 };
  /* Measured, not guessed. The keys sit on an arc of radius 2.10, but the
     OUTER columns land at z = -1.94, not -2.10, so the effective radius for
     projection is 1.94. At that depth a second row at y = -0.90 ends at 99.7%
     of the frame height -- technically inside, but its lower bezel falls behind
     the dash lip, which is what cut row two off at 4:3. These values put row
     one at 64..80% and row two at 82..96%, clear of the glass (which ends at
     55%) and clear of the dash, on every aspect ratio. */
  const KEY_ROW_Y = [-0.44, -0.74];
  const KEY_R = 2.10;

  const layoutAll = () => {
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    const half = visibleHalfAngle(aspect);

    main.mesh.position.set(0, PRIMARY.y, -PRIMARY.radius);
    main.mesh.rotation.set(PRIMARY.tilt, 0, 0);
    main.bezel.position.copy(main.mesh.position);
    main.bezel.rotation.copy(main.mesh.rotation);
    main.bezel.position.z += 0.012;

    keys.forEach((key, i) => {
      const row = i < 3 ? 0 : 1;
      const col = i % 3;
      const u = col - 1;
      const angle = u * half * 0.86;
      const x = Math.sin(angle) * KEY_R;
      const z = Math.cos(angle) * KEY_R;
      key.mesh.position.set(x, KEY_ROW_Y[row], -z);
      key.mesh.rotation.set(-0.34, -angle, 0);
      key.bezel.position.copy(key.mesh.position);
      key.bezel.rotation.copy(key.mesh.rotation);
      key.bezel.position.z += 0.010;
    });
  };

  /* ── painting ─────────────────────────────────────────────────────────── */
  let lastLang: CockpitLang = state.lang;
  let lastReady = state.ready;
  let lastProgress = state.progress;

  const paintKeys = () => {
    keys.forEach((key, i) => {
      const ctx = key.canvas.getContext('2d');
      if (ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, key.canvas.width, key.canvas.height);
        paintKey(ctx, i, data, lastLang, i === mainSection);
      }
      key.texture.needsUpdate = true;
    });
  };

  const paintMain = () => {
    // The canvas is MAIN_W x MAIN_H and screenPaint's layout is authored at
    // exactly that size, so the scale factor stays 1. Passing 2 clipped the
    // report to its top-left quarter -- see tests/cockpit-render-fidelity.mjs.
    paintScreen(mainSection, main.canvas, data, lastLang, lastReady, lastProgress, 1);
    main.texture.needsUpdate = true;
  };

  paintKeys();
  paintMain();
  layoutAll();
  window.addEventListener('resize', layoutAll);

  let fontsDone = false;
  const repaintAllAfterFonts = () => {
    if (fontsDone) return;
    fontsDone = true;
    paintKeys();
    paintMain();
  };
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
  if (fonts?.ready) {
    void fonts.ready.then(repaintAllAfterFonts).catch(() => undefined);
  } else {
    repaintAllAfterFonts();
  }

  /* Selected/hovered screens glow harder instead of being tinted. Tinting a
     screen with its canvas as the emissive map would darken the text too;
     emissiveIntensity keeps the content legible at every state. */
  const applyScreenState = (hover: number | null) => {
    for (const slot of screens) {
      const selected = slot.section != null && slot.section === mainSection;
      const isHover = hover != null && slot.id === hover;
      slot.mesh.material.emissiveIntensity = selected ? 1.0 : isHover ? 0.85 : slot.baseGlow;
    }
  };

  let unsubscribe: () => void = () => undefined;
  unsubscribe = onCockpit(() => {
    const next = cockpitState();
    const langChanged = next.lang !== lastLang;
    const gateChanged = next.ready !== lastReady || next.progress !== lastProgress;

    if (langChanged) {
      lastLang = next.lang;
      paintKeys();
      paintMain();
    } else if (gateChanged) {
      lastReady = next.ready;
      lastProgress = next.progress;
    }
    applyScreenState(next.hover ?? null);
  });

  /* ── pointer interaction ──────────────────────────────────────────────── */
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const pickables = screens.map((s) => s.mesh);
  let hovered: number | null = null;

  const pick = (clientX: number, clientY: number, camera: THREE.Camera): number | null => {
    ndc.set(
      (clientX / Math.max(1, window.innerWidth)) * 2 - 1,
      -(clientY / Math.max(1, window.innerHeight)) * 2 + 1,
    );
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(pickables, false);
    if (!hits.length) return null;
    const name = hits[0].object.name;
    const id = Number(name.slice(name.lastIndexOf('-') + 1));
    return Number.isFinite(id) ? id : null;
  };

  const handlePointer = (clientX: number, clientY: number, camera: THREE.Camera) => {
    const hit = pick(clientX, clientY, camera);
    if (hit === hovered) return;
    hovered = hit;

    const diag = window as Window & {
      __orbitaCockpitHover?: number | null;
      __orbitaCockpitScreen?: string | null;
    };
    const slot = screens.find((s) => s.id === hit);
    diag.__orbitaCockpitHover = hit;
    diag.__orbitaCockpitScreen = slot?.section != null
      ? SECTION_LABELS[lastLang][slot.section]
      : null;

    setCockpit({ hover: hit });
    applyScreenState(hit);
  };

  const activate = (camera: THREE.Camera): boolean => {
    void camera;
    const slot = screens.find((s) => s.id === hovered);
    if (!slot) return false;
    if (slot.link) {
      window.open(slot.link, '_blank', 'noopener,noreferrer');
      return true;
    }
    if (slot.section != null && slot.section !== mainSection) {
      mainSection = slot.section;
      paintMain();
      paintKeys();
      applyScreenState(hovered);
      return true;
    }
    return false;
  };

  /* ── furnished props from the CC0 kit ────────────────────────────────────
     Loaded asynchronously and folded in when ready. If an asset is missing the
     load reports it and the interior keeps working. */
  let props: THREE.Group | null = null;
  let disposed = false;
  let resolveProps: () => void = () => undefined;
  const propsReady = new Promise<void>((resolve) => { resolveProps = resolve; });
  void furnishCockpit().then((result) => {
    if (disposed) {
      disposeFurnishing(result.group);
      return;
    }
    props = result.group;
    group.add(props);
    const diag = window as Window & { __orbitaCockpitProps?: unknown };
    diag.__orbitaCockpitProps = {
      loaded: 8 - result.failed.length,
      failed: result.failed,
      triangles: result.triangles,
      drawCalls: result.drawCalls,
      shellGreebles: greebleCount,
    };
    resolveProps();
  }).catch((error) => {
    console.warn('[ORBITA] cockpit props unavailable', error);
    resolveProps();
  });

  const dispose = () => {
    disposed = true;
    window.removeEventListener('resize', layoutAll);
    if (props) disposeFurnishing(props);
    unsubscribe();
    // InstancedMesh shares `unitBox`, so it is disposed once via the tracker.
    for (const d of disposables) d.dispose();
    group.clear();
  };

  return { group, propsReady, handlePointer, activate, dispose };
}
