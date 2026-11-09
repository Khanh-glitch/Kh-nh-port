import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { registerInteractive, type Interactive } from '../world'

interface Props extends Omit<Interactive, 'id'> {
  id: string
  shape?: 'box' | 'sphere' | 'cylinder'
  size: [number, number, number]
  position?: [number, number, number]
  rotation?: [number, number, number]
}

// Vùng va chạm vô hình để đăng ký tương tác (raycast từ tâm màn hình).
export function Hit({ shape = 'box', size, position, rotation, ...data }: Props) {
  const ref = useRef<THREE.Mesh>(null)
  const dataRef = useRef<Interactive>(data)
  dataRef.current = data
  useEffect(() => {
    const m = ref.current
    if (!m) return
    return registerInteractive(m, () => dataRef.current)
  }, [])
  return (
    <mesh ref={ref} position={position} rotation={rotation} visible={false}>
      {shape === 'box' && <boxGeometry args={size} />}
      {shape === 'sphere' && <sphereGeometry args={[size[0], 16, 12]} />}
      {shape === 'cylinder' && <cylinderGeometry args={[size[0], size[0], size[1], 20]} />}
      <meshBasicMaterial side={THREE.DoubleSide} />
    </mesh>
  )
}
