import * as THREE from 'three'
import { EXHIBITS } from '../layout'

const ex = EXHIBITS.piano
// Tâm trường biến đổi = cây đàn (hệ tọa độ thế giới)
export const CENTER = new THREE.Vector3(ex.x, 0, ex.z)

export function pianoLocal(lx: number, ly: number, lz: number) {
  const c = Math.cos(ex.rotY)
  const s = Math.sin(ex.rotY)
  return new THREE.Vector3(ex.x + lx * c + lz * s, ly, ex.z - lx * s + lz * c)
}
export const PIANO_ROT = ex.rotY
