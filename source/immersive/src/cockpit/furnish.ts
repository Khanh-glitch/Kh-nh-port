import * as THREE from 'three';
import { loadGlb, disposeTree, triangleCount } from './gltf';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  Đạo cụ buồng lái — dựng từ chính kit asset CC0 đã có trong repo.
 *
 *  `assets/3d/room-showcase` là kit Kiến trúc sư / Kenney Furniture + Poly
 *  Pizza (CC0). Manifest của kit ghi rõ ý định: "Real portfolio work should
 *  carry more identity than generic props" và "Treat display.glb as a shell.
 *  Put real portfolio imagery on a controlled surface".
 *
 *  Đó chính xác là kiến trúc ở đây:
 *    • `display.glb` là VỎ màn hình — tấm kính portfolio được đặt ĐÈ lên nó.
 *    • `work-console.glb` là bàn điều khiển dưới màn hình chính.
 *    • `chair.glb`, `bookcase-low.glb`, `speaker-small.glb`, `books.glb`,
 *      `plant-small.glb` tạo chất "một không gian làm việc thật".
 *    • `spotlight.glb` là hình học thiết bị; ánh sáng thật vẫn do three lo.
 *
 *  Tỉ lệ: các file dùng đơn vị khác nhau (spotlight có scale 100 trong node,
 *  work-console bbox chỉ 0.53m). Mỗi đạo cụ được chuẩn hoá bằng số đo thật
 *  trong bảng dưới, không đoán.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type PropId =
  | 'display'
  | 'work-console'
  | 'chair'
  | 'bookcase-low'
  | 'speaker-small'
  | 'books'
  | 'plant-small'
  | 'spotlight';

interface PropSpec {
  path: string;
  /** Desired real-world height in metres; the model is scaled to match. */
  height: number;
  /** Where it sits, in cockpit space. */
  position: [number, number, number];
  rotation?: [number, number, number];
  /** Recolour so the props belong to the ship rather than a living room. */
  tint?: number;
  tintStrength?: number;
}

/**
 * Placement is measured against the cockpit, not invented:
 *   • the primary screen sits at z = -2.02, y = +0.26
 *   • the selector keys sit at y = -0.48 and -0.90, z = -2.10
 *   • the floor plate is at y = -1.36
 * So: consoles below the screens, a chair behind the pilot, shelving off to
 * the sides, small props on the shelves. Nothing overlaps a screen.
 */
const PROPS: Record<PropId, PropSpec> = {
  /* ── behind the glass: the screen shell ───────────────────────────────────
     z = -2.30 puts it behind the primary glass at z = -2.02. It is EXPECTED to
     overlap the primary screen on screen: it is the bezel/mount for it, and the
     glass is drawn in front. Every other prop is kept clear of the screens —
     see the projection check in docs/immersive/COCKPIT_3D_20261112.md. */
  display: { path: 'core/display.glb', height: 0.54, position: [0, 0.04, -2.30], tint: 0x2a3a4e },

  /* ── on the dash, left of the selector keys ───────────────────────────────
     The keys occupy x 696..904 px and the primary display starts at y 524 px.
     This console lands at x 252..500 px, below 560 px, so it is fully visible
     and clear of both. It was previously tucked under the dash at y ~820 px,
     i.e. off the bottom of the frame.

     NOTE ON HEIGHT: the cockpit floor is at y = -1.36 and, at the camera's 58°
     fov, a floor-standing object's base projects below the bottom of the frame.
     So nothing here stands on the floor. Everything is bolted to the dash /
     side walls at eye level, which is what makes it read as a cockpit instead
     of as furniture floating in a void. */
  'work-console': { path: 'core/work-console.glb', height: 0.24, position: [-1.03, -0.60, -1.40], rotation: [0, 0.62, 0], tint: 0x2e3d52 },

  /* ── right-hand equipment bay ─────────────────────────────────────────────
     Projected with the real camera maths: the region x > 1140 px at
     z ~ 1.3..1.9 m is empty, so a low shelf with the speaker on it reads from
     the pilot's seat without touching a screen. */
  'bookcase-low': { path: 'core/bookcase-low.glb', height: 0.40, position: [0.92, -0.20, -1.75], rotation: [0, -1.15, 0], tint: 0x2b3849 },
  'speaker-small': { path: 'music/speaker-small.glb', height: 0.22, position: [0.92, 0.20, -1.75], rotation: [0, -1.15, 0], tint: 0x2d3a4a },
  'plant-small': { path: 'core/plant-small.glb', height: 0.22, position: [1.20, -0.76, -1.50], tint: 0x2f4a45 },

  /* ── up on the canopy rail, right of frame ────────────────────────────────
     Kept because its measured box lands at x 1137..1309, y 403..531: it is
     actually in shot, unlike the old position which crossed the dash. */
  spotlight: { path: 'event/spotlight.glb', height: 0.30, position: [1.10, 0.48, -1.55], rotation: [0, -1.0, 0], tint: 0x3a4658 },

  /* ── the seat. Directly below the camera, which is why it belongs to the
     "you are sitting in this" read even though it is not in frame. ───────── */
  chair: { path: 'core/chair.glb', height: 0.46, position: [0, -1.34, -0.92], rotation: [0, Math.PI, 0], tint: 0x25313f },

  /* On the bookcase deck. The deck top lands at y = +0.20 m once the shelf is
     wall-mounted, so the books sit there, not on the old floor-height value. */
  books: { path: 'research/books.glb', height: 0.09, position: [1.10, 0.24, -1.25], rotation: [0, 0.4, 0], tint: 0x3a4a63 },
};

export const PROP_BASE = 'assets/3d/room-showcase/';

export interface FurnishingResult {
  group: THREE.Group;
  /** Props that failed to load, so the caller can report instead of guessing. */
  failed: PropId[];
  triangles: number;
  drawCalls: number;
}

/** Measure the world-space bounding box of an object (after its own TRS). */
function measure(object: THREE.Object3D): THREE.Box3 {
  object.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(object);
}

function applyTint(root: THREE.Object3D, tint: number, strength: number) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    const material = mesh.material as THREE.MeshStandardMaterial | undefined;
    if (!material || Array.isArray(material)) return;
    // Keep the model's own value structure, shift only its hue. Writing the
    // original colour into userData means a second pass cannot darken it twice.
    if (material.userData.__tinted) return;
    material.userData.__tinted = true;
    const base = material.color.clone();
    const target = new THREE.Color(tint);
    material.color.copy(base).lerp(target, strength);
    // Cockpit fittings are matte metal, not varnished living-room wood.
    material.metalness = Math.min(0.9, material.metalness + 0.35);
    material.roughness = Math.max(0.35, material.roughness * 0.8);
    material.needsUpdate = true;
  });
}

/**
 * Load every cockpit prop. Never rejects: a prop that cannot be loaded is
 * reported in `failed` and simply omitted, exactly like the kit's own
 * guidance ("higher-cost assets only when their visible gain is proven").
 */
export async function furnishCockpit(baseUrl = PROP_BASE): Promise<FurnishingResult> {
  const group = new THREE.Group();
  group.name = 'cockpit-props';

  const failed: PropId[] = [];
  let triangles = 0;
  let drawCalls = 0;

  const entries = Object.entries(PROPS) as [PropId, PropSpec][];

  await Promise.all(entries.map(async ([id, spec]) => {
    try {
      const model = await loadGlb(baseUrl + spec.path);

      // Normalise scale from the measured height, whatever units the source
      // uses. This is why the spotlight (node scale 100) and the console
      // (0.53 m wide) can share one placement table.
      const box = measure(model);
      const size = new THREE.Vector3();
      box.getSize(size);
      const currentHeight = size.y;
      if (!Number.isFinite(currentHeight) || currentHeight <= 0) {
        throw new Error('degenerate bounding box');
      }
      const scale = spec.height / currentHeight;
      model.scale.multiplyScalar(scale);

      // Re-measure after scaling and drop the model so its base sits on the
      // requested point instead of floating around its own origin.
      model.updateMatrixWorld(true);
      const scaled = measure(model);
      const centre = new THREE.Vector3();
      scaled.getCenter(centre);
      model.position.set(
        spec.position[0] - centre.x,
        spec.position[1] - scaled.min.y,
        spec.position[2] - centre.z,
      );
      if (spec.rotation) model.rotation.set(...spec.rotation);

      applyTint(model, spec.tint ?? 0x2a3648, spec.tintStrength ?? 0.72);

      model.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.castShadow = false;
          mesh.receiveShadow = false;
          drawCalls++;
        }
      });
      triangles += triangleCount(model);

      group.add(model);
    } catch (error) {
      failed.push(id);
      console.warn(`[ORBITA] cockpit prop "${id}" skipped:`, error);
    }
  }));

  return { group, failed, triangles, drawCalls };
}

/** Dispose every loaded prop. */
export function disposeFurnishing(group: THREE.Object3D): void {
  disposeTree(group);
  group.clear();
  group.removeFromParent();
}
