import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { FONT, canvasTex } from '../gfx'

interface Props {
  title: string
  sub?: string
  color?: string
  position?: [number, number, number]
  scale?: number
  fadeNear?: number
  fadeFar?: number
}

// Bảng tên lơ lửng, luôn xoay về phía người xem, mờ dần khi quá gần/quá xa.
export function Label({ title, sub, color = '#ffffff', position = [0, 0, 0], scale = 1, fadeNear = 4, fadeFar = 85 }: Props) {
  const ref = useRef<THREE.Mesh>(null)
  const { tex, aspect } = useMemo(() => {
    const W = 1024
    const H = 256
    const { tex } = canvasTex(W, H, (ctx) => {
      ctx.clearRect(0, 0, W, H)
      ctx.textAlign = 'center'
      ctx.shadowColor = color
      ctx.shadowBlur = 24
      ctx.fillStyle = '#fff'
      ctx.font = `700 96px ${FONT}`
      ctx.fillText(title.toUpperCase(), W / 2, sub ? 118 : 150)
      if (sub) {
        ctx.shadowBlur = 10
        ctx.fillStyle = color
        ctx.font = `500 40px ${FONT}`
        ctx.fillText(sub.toUpperCase(), W / 2, 188)
      }
      ctx.shadowBlur = 0
      ctx.fillStyle = color
      ctx.fillRect(W / 2 - 120, 214, 240, 4)
    })
    return { tex, aspect: W / H }
  }, [title, sub, color])
  const mat = useRef<THREE.MeshBasicMaterial>(null)
  const wp = useMemo(() => new THREE.Vector3(), [])

  useFrame(({ camera }) => {
    const m = ref.current
    if (!m) return
    m.getWorldPosition(wp)
    const dx = camera.position.x - wp.x
    const dz = camera.position.z - wp.z
    m.rotation.y = Math.atan2(dx, dz)
    const d = Math.hypot(dx, camera.position.y - wp.y, dz)
    if (mat.current) {
      mat.current.opacity = THREE.MathUtils.smoothstep(d, fadeNear * 0.6, fadeNear) * (1 - THREE.MathUtils.smoothstep(d, fadeFar * 0.6, fadeFar))
    }
  })

  return (
    <mesh ref={ref} position={position} scale={scale} renderOrder={5}>
      <planeGeometry args={[4 * aspect * 0.5, 4 * 0.5]} />
      <meshBasicMaterial ref={mat} map={tex} transparent depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} />
    </mesh>
  )
}
