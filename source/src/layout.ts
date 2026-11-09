// Bố cục thế giới: đơn vị = 1 mét. Trục -Z là "phía bắc" nhìn từ điểm xuất phát.
export const DISC_R = 60
export const EYE = 1.7
export const SPAWN = { x: 0, z: 46 }

export type ExhibitId =
  | 'orb'
  | 'piano'
  | 'rubik'
  | 'robot'
  | 'cinema'
  | 'stage'
  | 'products'
  | 'beacon'

export interface ExhibitDef {
  id: ExhibitId
  name: string
  x: number
  z: number
  rotY: number
  color: string
}

export const EXHIBITS: Record<ExhibitId, ExhibitDef> = {
  orb: { id: 'orb', name: 'Singularity Orb', x: 0, z: 0, rotY: 0, color: '#b66bff' },
  robot: { id: 'robot', name: 'Colossus', x: 0, z: -41, rotY: 0, color: '#ff8a3d' },
  piano: { id: 'piano', name: 'Grand Piano', x: -26, z: 9, rotY: -0.62, color: '#ffd27a' },
  rubik: { id: 'rubik', name: 'Cube Solver', x: 27, z: 9, rotY: 0, color: '#4dd8ff' },
  stage: { id: 'stage', name: 'Main Stage', x: -31, z: -26, rotY: 0.88, color: '#ff3dcb' },
  cinema: { id: 'cinema', name: 'Mini Cinema', x: 32, z: -27, rotY: -0.86, color: '#ff4d4d' },
  products: { id: 'products', name: 'Product Lab', x: 22, z: 31, rotY: 0, color: '#5dffb0' },
  beacon: { id: 'beacon', name: 'Signal Beacon', x: -22, z: 31, rotY: 0, color: '#6aa8ff' },
}

export const EXHIBIT_LIST = Object.values(EXHIBITS)
