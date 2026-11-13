import * as THREE from 'three'
import type { PanelId } from './content'
import { EYE, SPAWN } from './layout'

// ---------- Registry các vật thể tương tác (raycast từ tâm màn hình) ----------
export interface Interactive {
  id: string
  label: string
  hint?: string
  maxDist: number
  panel?: PanelId
  onClick?: (hit: THREE.Intersection) => void
}

const registry = new Map<THREE.Object3D, () => Interactive>()
let targetList: THREE.Object3D[] = []
// Every `Hit` registers/unregisters itself, and hits mount in batches whenever
// a show, summon or panel swaps its contents. Rebuilding the whole target array
// on each of those calls allocated a fresh array per object — easy GC churn in
// exactly the frames that must stay smooth. Mark it stale instead and rebuild
// once, lazily, the next time a raycast actually asks for the list.
let targetsDirty = false

export function registerInteractive(obj: THREE.Object3D, get: () => Interactive) {
  registry.set(obj, get)
  targetsDirty = true
  return () => {
    registry.delete(obj)
    targetsDirty = true
  }
}
export const getTargets = () => {
  if (targetsDirty) {
    targetList = Array.from(registry.keys())
    targetsDirty = false
  }
  return targetList
}
// Bộ lọc tương tác tùy chọn (Reality Rewrite dùng để vô hiệu hóa tương tác "ma" của vật thể đã bị biến đổi).
let interactiveFilter: ((o: THREE.Object3D) => boolean) | null = null
export const setInteractiveFilter = (f: ((o: THREE.Object3D) => boolean) | null) => {
  interactiveFilter = f
}
export const passesInteractiveFilter = (o: THREE.Object3D) => !interactiveFilter || interactiveFilter(o)
export const getInteractive = (o: THREE.Object3D) => registry.get(o)?.()

// ---------- Trạng thái người chơi dùng chung ----------
export const player = {
  pos: new THREE.Vector3(SPAWN.x, EYE, SPAWN.z),
  yaw: 0,
  pitch: -0.04,
  speed: 0,
  grounded: true,
}

export const input = { moveX: 0, moveY: 0, lookX: 0, lookY: 0 }

export const canvasRef: { el: HTMLCanvasElement | null } = { el: null }

// ---------- Va chạm ----------
export type Collider =
  | { type: 'circle'; x: number; z: number; r: number }
  | { type: 'box'; x: number; z: number; hw: number; hd: number; rot: number }

const colliders = new Set<Collider>()
export function addCollider(c: Collider) {
  colliders.add(c)
  return () => {
    colliders.delete(c)
  }
}

export function resolveCollisions(p: THREE.Vector3, radius = 0.55) {
  colliders.forEach((c) => {
    if (c.type === 'circle') {
      const dx = p.x - c.x
      const dz = p.z - c.z
      const d = Math.hypot(dx, dz)
      const min = c.r + radius
      if (d < min) {
        const k = d < 1e-4 ? 0 : min / d
        if (k === 0) {
          p.x = c.x + min
        } else {
          p.x = c.x + dx * k
          p.z = c.z + dz * k
        }
      }
    } else {
      const cos = Math.cos(c.rot)
      const sin = Math.sin(c.rot)
      const dx = p.x - c.x
      const dz = p.z - c.z
      const lx = dx * cos - dz * sin
      const lz = dx * sin + dz * cos
      const cx = THREE.MathUtils.clamp(lx, -c.hw, c.hw)
      const cz = THREE.MathUtils.clamp(lz, -c.hd, c.hd)
      let nx = lx
      let nz = lz
      const ddx = lx - cx
      const ddz = lz - cz
      const d = Math.hypot(ddx, ddz)
      if (d < 1e-5) {
        // bên trong hộp: đẩy ra theo trục nông nhất
        const px = c.hw + radius - Math.abs(lx)
        const pz = c.hd + radius - Math.abs(lz)
        if (px < pz) nx = Math.sign(lx || 1) * (c.hw + radius)
        else nz = Math.sign(lz || 1) * (c.hd + radius)
      } else if (d < radius) {
        nx = cx + (ddx / d) * radius
        nz = cz + (ddz / d) * radius
      } else return
      p.x = c.x + nx * cos + nz * sin
      p.z = c.z - nx * sin + nz * cos
    }
  })
}
