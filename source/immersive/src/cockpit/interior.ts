import * as THREE from 'three';
import { cockpitState, onCockpit, setCockpit, type CockpitLang } from '../lib/cockpitBus';
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

   Layout follows a glass cockpit rather than a dashboard of equal small panes:
   one large PRIMARY display in the middle and six selector keys in two rows of
   three under it. That is what makes it readable: the selected section gets a
   big, comfortable surface instead of every fact fighting for the same small
   rectangle, and the keys act as labelled buttons rather than report panes.

   Performance profile:
   • ~24 untextured meshes sharing three materials, plus 8 screen quads.
   • Screen canvases repaint ONLY when their content changes: switching the
     primary section repaints one canvas; changing language repaints seven.
     Nothing here paints per frame.
   • The interior is static geometry, so the frame loop does no matrix work.
   ──────────────────────────────────────────────────────────────────────────── */

const DEG = Math.PI / 180;

interface ScreenSlot {
  id: number;
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  bezel: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  canvas: HTMLCanvasElement;
  texture: THREE.CanvasTexture;
  section: number | null;
  link?: string;
}

export interface CockpitHandles {
  group: THREE.Group;
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

export function buildCockpit(data: ScreenData): CockpitHandles {
  const group = new THREE.Group();
  group.name = 'cockpit-interior';

  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(o: T): T => {
    disposables.push(o);
    return o;
  };

  /* ── materials ────────────────────────────────────────────────────────── */
  const hullMat = track(new THREE.MeshStandardMaterial({
    color: 0x161f2b, roughness: 0.74, metalness: 0.58,
    emissive: 0x0a1420, emissiveIntensity: 0.55,
  }));
  const panelMat = track(new THREE.MeshStandardMaterial({
    color: 0x1e2a3c, roughness: 0.56, metalness: 0.64,
    emissive: 0x0c1a2c, emissiveIntensity: 0.45,
  }));
  const stripMat = track(new THREE.MeshBasicMaterial({ color: 0x63d8ff, toneMapped: false }));
  const warmStripMat = track(new THREE.MeshBasicMaterial({ color: 0xffbe72, toneMapped: false }));

  const box = (
    w: number, h: number, d: number,
    x: number, y: number, z: number,
    mat: THREE.Material, rx = 0, ry = 0, rz = 0,
  ) => {
    const m = new THREE.Mesh(track(new THREE.BoxGeometry(w, h, d)), mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    group.add(m);
    return m;
  };

  /* ── hull: dashboard mass ─────────────────────────────────────────────── */
  // Sloped shelf arcs under the primary display.
  for (const a of [-26, 0, 26]) {
    const rad = a * DEG;
    const r = 2.22;
    box(1.05, 0.10, 0.66, Math.sin(rad) * r, -0.50, -Math.cos(rad) * r, panelMat, -0.16, -rad, 0);
    box(1.05, 0.44, 0.09, Math.sin(rad) * r, -0.76, -Math.cos(rad) * r - 0.02, hullMat, -0.08, -rad, 0);
  }
  // Lower deck that carries the selector keys.
  box(1.90, 0.09, 0.58, 0, -0.86, -1.86, panelMat, -0.44, 0, 0);
  box(2.02, 0.26, 0.10, 0, -1.02, -1.56, hullMat, -0.26, 0, 0);
  // Floor and aft bulkhead complete the cabin so it is not a floating prop.
  box(3.0, 0.09, 1.9, 0, -1.36, -1.66, hullMat, -0.18, 0, 0);
  box(3.4, 2.6, 0.12, 0, -0.12, 1.32, hullMat, 0, 0, 0);

  /* ── hull: canopy frame ───────────────────────────────────────────────── */
  for (const s of [-1, 1]) {
    const pillar = new THREE.Mesh(track(new THREE.CylinderGeometry(0.045, 0.055, 1.5, 8)), hullMat);
    pillar.position.set(s * 1.04, -0.10, -1.74);
    pillar.rotation.set(-0.16, 0, s * 0.10);
    group.add(pillar);

    const brace = new THREE.Mesh(track(new THREE.CylinderGeometry(0.032, 0.038, 1.04, 6)), hullMat);
    brace.position.set(s * 1.18, 0.52, -1.30);
    brace.rotation.set(0.34, 0, s * 0.72);
    group.add(brace);
  }
  const arch = new THREE.Mesh(track(new THREE.TorusGeometry(1.32, 0.045, 6, 22, Math.PI)), hullMat);
  arch.position.set(0, 0.06, -1.56);
  arch.rotation.set(0.22, 0, 0);
  group.add(arch);
  box(2.14, 0.20, 0.40, 0, 0.76, -1.74, hullMat, 0.30, 0, 0);

  /* ── emissive detail ──────────────────────────────────────────────────── */
  const strip = (w: number, h: number, d: number, x: number, y: number, z: number, warm = false) => {
    const m = new THREE.Mesh(track(new THREE.BoxGeometry(w, h, d)), warm ? warmStripMat : stripMat);
    m.position.set(x, y, z);
    group.add(m);
  };
  strip(1.46, 0.016, 0.016, 0, -0.60, -2.02);
  strip(0.64, 0.014, 0.014, -0.54, -0.92, -1.60);
  strip(0.64, 0.014, 0.014, 0.54, -0.92, -1.60);
  strip(0.10, 0.020, 0.020, -0.90, -0.88, -1.62, true);
  strip(0.10, 0.020, 0.020, 0.90, -0.88, -1.62, true);
  strip(0.016, 0.62, 0.016, -1.05, 0.18, -1.72);
  strip(0.016, 0.62, 0.016, 1.05, 0.18, -1.72);

  /* ── screens ──────────────────────────────────────────────────────────── */
  const state = cockpitState();
  const screens: ScreenSlot[] = [];

  let mainSection = 0;

  const addScreen = (
    id: number,
    canvas: HTMLCanvasElement,
    width: number,
    section: number | null,
    link?: string,
  ): ScreenSlot => {
    const texture = track(new THREE.CanvasTexture(canvas));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.anisotropy = 4;

    const material = track(new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }));
    const height = (width * canvas.height) / canvas.width;
    const mesh = new THREE.Mesh(track(new THREE.PlaneGeometry(width, height)), material);
    mesh.name = 'cockpit-screen-' + id;
    group.add(mesh);

    const bezel = new THREE.Mesh(
      track(new THREE.PlaneGeometry(width + 0.038, height + 0.038)),
      hullMat,
    );
    bezel.renderOrder = -1;
    group.add(bezel);

    const slot: ScreenSlot = { id, mesh, bezel, canvas, texture, section, link };
    screens.push(slot);
    return slot;
  };

  // Primary display — the big surface.
  const mainCanvas = makeCanvas(MAIN_W, MAIN_H);
  const main = addScreen(0, mainCanvas, 1.42, 0);

  // Six selector keys, one per section.
  const keys: ScreenSlot[] = [];
  for (let i = 0; i < 6; i++) {
    const canvas = makeCanvas(SCREEN_W, SCREEN_H);
    keys.push(addScreen(i + 1, canvas, 0.54, i));
  }

  /* ── placement (aspect aware, nothing can leave the frame) ────────────── */
  const PRIMARY = { y: 0.26, radius: 2.02, tilt: -0.06 };
  // Two rows of three. Six keys across one arc cannot fit: at the widest
  // canopy opening the arc is ~1.8 units long and six 0.40-wide panes need
  // 2.4, so they overlapped. Two rows halve that and every key stays legible.
  const KEY_ROW_Y = [-0.48, -0.90];
  const KEY_R = 2.10;

  const layoutAll = () => {
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    const half = visibleHalfAngle(aspect);

    // Primary display sits dead centre.
    main.mesh.position.set(0, PRIMARY.y, -PRIMARY.radius);
    main.mesh.rotation.set(PRIMARY.tilt, 0, 0);
    main.bezel.position.copy(main.mesh.position);
    main.bezel.rotation.copy(main.mesh.rotation);
    main.bezel.position.z += 0.012;

    // Selector keys: three per row, two rows.
    keys.forEach((key, i) => {
      const row = i < 3 ? 0 : 1;
      const col = i % 3;
      const u = col - 1; // -1, 0, 1
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
    const scale = 2;
    paintScreen(mainSection, main.canvas, data, lastLang, lastReady, lastProgress, scale);
    main.texture.needsUpdate = true;
  };

  paintKeys();
  paintMain();
  layoutAll();
  window.addEventListener('resize', layoutAll);

  /* ── late font repaint ────────────────────────────────────────────────────
     `document.fonts.ready` resolves after every embedded woff2 has loaded. A
     canvas painted before that falls back to a generic face, which looks wrong
     even though it is only temporary. Repaint exactly once when the real faces
     arrive — this is the only work that happens outside a state change. */
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

    // Selection highlight is a material tint, not a repaint.
    keys.forEach((key) => {
      const selected = key.section === mainSection;
      const hovered = next.hover === key.id;
      const tint = selected ? 1.0 : hovered ? 0.86 : 0.62;
      key.mesh.material.color.setScalar(tint);
    });
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
    keys.forEach((key) => {
      const selected = key.section === mainSection;
      const isHover = key.id === hit;
      key.mesh.material.color.setScalar(selected ? 1.0 : isHover ? 0.86 : 0.62);
    });
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
      keys.forEach((key) => {
        key.mesh.material.color.setScalar(key.section === mainSection ? 1.0 : 0.62);
      });
      return true;
    }
    return false;
  };

  const dispose = () => {
    window.removeEventListener('resize', layoutAll);
    unsubscribe();
    for (const d of disposables) d.dispose();
    group.clear();
    group.removeFromParent();
  };

  return { group, handlePointer, activate, dispose };
}
