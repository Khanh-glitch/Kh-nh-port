import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { addCollider, type Collider } from '../world'
import type { ExhibitDef } from '../layout'

export type LocalCollider =
  | { type: 'circle'; x: number; z: number; r: number }
  | { type: 'box'; x: number; z: number; hw: number; hd: number; rot?: number }

// Đăng ký va chạm theo hệ tọa độ cục bộ của hạng mục (đã xoay theo rotY).
export function useWorldColliders(ex: ExhibitDef, list: LocalCollider[]) {
  useEffect(() => {
    const c = Math.cos(ex.rotY)
    const s = Math.sin(ex.rotY)
    const removers = list.map((l) => {
      const x = ex.x + l.x * c + l.z * s
      const z = ex.z - l.x * s + l.z * c
      const col: Collider =
        l.type === 'circle'
          ? { type: 'circle', x, z, r: l.r }
          : { type: 'box', x, z, hw: l.hw, hd: l.hd, rot: ex.rotY + (l.rot ?? 0) }
      return addCollider(col)
    })
    return () => removers.forEach((r) => r())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

const _fwd = new THREE.Vector3()
// true nếu hạng mục nằm trong tầm nhìn (hoặc rất gần) -> chỉ vẽ lại canvas khi cần
export function isFacing(camera: THREE.Camera, x: number, z: number, near = 24) {
  const dx = x - camera.position.x
  const dz = z - camera.position.z
  const d = Math.hypot(dx, dz)
  if (d < near) return true
  camera.getWorldDirection(_fwd)
  const h = Math.max(0.2, Math.hypot(_fwd.x, _fwd.z))
  return (_fwd.x * dx + _fwd.z * dz) / (d * h) > 0.2
}

export function worldPos(ex: ExhibitDef, lx: number, ly: number, lz: number) {
  const c = Math.cos(ex.rotY)
  const s = Math.sin(ex.rotY)
  return new THREE.Vector3(ex.x + lx * c + lz * s, ly, ex.z - lx * s + lz * c)
}

export function PadRing({ radius, color, y = 0.07, tube = 0.07, intensity = 2.6 }: { radius: number; color: string; y?: number; tube?: number; intensity?: number }) {
  const c = useMemo(() => new THREE.Color(color).multiplyScalar(intensity), [color, intensity])
  return (
    <mesh position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[radius, tube, 8, 128]} />
      <meshBasicMaterial color={c} toneMapped={false} />
    </mesh>
  )
}

interface SpotProps {
  position: [number, number, number]
  target: [number, number, number]
  color?: string
  intensity?: number
  angle?: number
  penumbra?: number
  distance?: number
}
export function Spot({ position, target, color = '#ffffff', intensity = 800, angle = 0.5, penumbra = 1, distance = 50 }: SpotProps) {
  const t = useMemo(() => new THREE.Object3D(), [])
  return (
    <>
      <spotLight position={position} target={t} color={color} intensity={intensity} angle={angle} penumbra={penumbra} distance={distance} decay={2} />
      <primitive object={t} position={target} />
    </>
  )
}

// vật liệu dùng chung
export const mats = {
  lacquer: new THREE.MeshPhysicalMaterial({ color: '#060608', metalness: 0.25, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 2.2 }),
  darkMetal: new THREE.MeshStandardMaterial({ color: '#14161e', metalness: 0.85, roughness: 0.35, envMapIntensity: 1.5 }),
  silver: new THREE.MeshStandardMaterial({ color: '#c9ced8', metalness: 0.9, roughness: 0.28, envMapIntensity: 1.6 }),
  white: new THREE.MeshStandardMaterial({ color: '#b9bfcc', metalness: 0.5, roughness: 0.36, envMapIntensity: 1.3 }),
  gold: new THREE.MeshStandardMaterial({ color: '#d4a74c', metalness: 1, roughness: 0.28, envMapIntensity: 1.6 }),
  rubber: new THREE.MeshStandardMaterial({ color: '#0d0e12', metalness: 0.1, roughness: 0.85 }),
}
