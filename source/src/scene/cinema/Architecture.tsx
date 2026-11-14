import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { rbox } from '../../gfx'
import { kit, led } from '../kit/materials'
import { hash, latheHard, merge, placed, plate, pleated, slotPath, strut, v3 } from '../kit/geo'

// ---------------------------------------------------------------------------
// MINI CINEMA — kiến trúc ngoại thất + nội thất.
//  Ngoại thất : khối nguyên khối bọc LAMEN đồng (rain-screen) có nhịp sóng, mái võng, sảnh kính
//               với tấm che nhô (canopy), bảng marquee bóng đèn và lightbox poster.
//  Nội thất   : hệ tường âm học 3 tầng (vải bọc – khe kỹ thuật – khuếch tán Schroeder QRD, dãy giếng
//               theo n² mod 7), trần mây vải + cove LED + trần sao sợi quang, rèm xếp ly, sàn thảm,
//               12 ghế recliner trên bậc khán đài, máy chiếu treo trần.
//  Giữ nguyên: mặt phẳng màn hình 8.3×3.64 tại z=-5.98, ô cửa tự động, vùng "inside" 10.1×12×5.75 m.
// ---------------------------------------------------------------------------

export interface CinemaArchProps {
  inside: boolean
  filmActive: boolean
  leftDoor: React.RefObject<THREE.Group | null>
  rightDoor: React.RefObject<THREE.Group | null>
  bulbs: React.RefObject<THREE.InstancedMesh | null>
  bulbCount: number
  marquee: THREE.Texture
  posters: THREE.Texture[]
  teaser: ReactNode
  screenTex: THREE.Texture
  beamGeo: THREE.BufferGeometry
  beamMat: THREE.Material
}

const ROWS = [-1.0, 1.3, 3.6]
const TIER = [0.1, 0.22, 0.34]
const SEAT_X = [2.5, 3.7]
const QRD = [0, 1, 4, 2, 2, 4, 1] // n² mod 7 — dãy giếng Schroeder

function buildSeat() {
  const shell: THREE.BufferGeometry[] = [
    placed(rbox(0.66, 0.2, 0.72, 0.09, 4), [0, 0.43, -0.02], [-0.07, 0, 0]),
    placed(plate(0.68, 0.98, 0.17, 0.22, 0.07), [0, 1.0, 0.36], [0.3, 0, 0]),
    placed(plate(0.42, 0.24, 0.12, 0.1, 0.04), [0, 1.62, 0.5], [0.4, 0, 0]),
    placed(rbox(0.56, 0.3, 0.1, 0.04, 3), [0, 0.3, -0.5], [0.12, 0, 0]),
  ]
  const hardware: THREE.BufferGeometry[] = [
    placed(rbox(0.82, 0.07, 0.86, 0.02, 2), [0, 0.06, 0]),
    placed(new THREE.CylinderGeometry(0.07, 0.09, 0.2, 12), [0, 0.2, 0]),
    placed(rbox(0.1, 0.05, 0.62, 0.02, 2), [-0.38, 0.62, -0.04]),
    placed(rbox(0.1, 0.05, 0.62, 0.02, 2), [0.38, 0.62, -0.04]),
    strut(v3(-0.38, 0.56, 0.2), v3(-0.3, 0.3, 0.28), 0.018, 0.018, 6),
    strut(v3(0.38, 0.56, 0.2), v3(0.3, 0.3, 0.28), 0.018, 0.018, 6),
  ]
  return { shell: merge(shell), hardware: merge(hardware) }
}

export function CinemaArchitecture({ filmActive, leftDoor, rightDoor, bulbs, bulbCount, marquee, posters, teaser, screenTex, beamGeo, beamMat }: CinemaArchProps) {
  const K = kit()
  const dimRef = useRef({ v: 1 })
  const seatShell = useRef<THREE.InstancedMesh>(null)
  const seatHw = useRef<THREE.InstancedMesh>(null)
  const finsRef = useRef<THREE.InstancedMesh>(null)
  const qrdRef = useRef<THREE.InstancedMesh>(null)
  const starRef = useRef<THREE.Points>(null)

  const M = useMemo(() => {
    const big = (m: THREE.MeshStandardMaterial, rx: number, ry: number) => {
      const c = m.clone()
      if (m.bumpMap) {
        c.bumpMap = m.bumpMap.clone()
        c.bumpMap.repeat.set(rx, ry)
        c.bumpMap.needsUpdate = true
      }
      return c
    }
    return {
      wall: big(K.anodized, 5, 2),
      roof: big(K.anodized, 6, 6),
      plum: K.fabric('#4a1522', [2, 4]),
      charcoal: K.fabric('#20232b', [2, 4]),
      black: K.fabric('#09080b', [3, 3]),
      wood: new THREE.MeshStandardMaterial({ color: '#7d5535', roughness: 0.5, metalness: 0.08, bumpMap: K.titaniumLong.bumpMap, bumpScale: 0.5, envMapIntensity: 0.2 }),
      cove: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb070').multiplyScalar(2.2), toneMapped: false }),
      floorGlow: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffa060').multiplyScalar(1.6), toneMapped: false }),
      backlight: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff5a3c').multiplyScalar(1.6), toneMapped: false }),
    }
  }, [K])
  const seat = useMemo(buildSeat, [])
  const G = useMemo(() => {
    const roof = new THREE.Shape()
    roof.moveTo(-6.15, 0)
    roof.lineTo(6.15, 0)
    roof.lineTo(6.15, 0.2)
    roof.quadraticCurveTo(0, 1.05, -6.15, 0.2)
    roof.closePath()
    const roofG = new THREE.ExtrudeGeometry(roof, { depth: 13.9, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2, curveSegments: 18 })
    roofG.translate(0, 0, -6.95 - 0.1)
    const can = new THREE.Shape()
    can.moveTo(0, 0)
    can.lineTo(3.4, 0.02)
    can.quadraticCurveTo(3.7, 0.1, 3.62, 0.34)
    can.lineTo(0, 0.62)
    can.closePath()
    const canG = new THREE.ExtrudeGeometry(can, { depth: 9.6, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2, curveSegments: 10 })
    canG.rotateY(-Math.PI / 2)
    canG.translate(4.8, 0, 6.2)
    const lintel = plate(3.8, 1.1, 0.5, 0.05, 0.02)
    const doorFrame = merge([
      placed(rbox(0.12, 3.9, 0.5, 0.02, 2), [-1.86, 1.95, 0]),
      placed(rbox(0.12, 3.9, 0.5, 0.02, 2), [1.86, 1.95, 0]),
      placed(rbox(3.84, 0.12, 0.5, 0.02, 2), [0, 3.9, 0]),
    ])
    const leaf = merge([
      placed(rbox(0.08, 3.8, 0.12, 0.02, 2), [-0.76, 0, 0]),
      placed(rbox(0.08, 3.8, 0.12, 0.02, 2), [0.76, 0, 0]),
      placed(rbox(1.6, 0.1, 0.12, 0.02, 2), [0, 1.85, 0]),
      placed(rbox(1.6, 0.14, 0.12, 0.02, 2), [0, -1.83, 0]),
      placed(rbox(0.04, 1.2, 0.05, 0.015, 2), [0.5, 0, 0.1]),
    ])
    const glassPane = placed(new THREE.BoxGeometry(1.5, 3.6, 0.02), [0, 0, 0])
    // lăng trụ cột canopy
    const column = latheHard([[0.0, 0], [0.26, 0], [0.26, 0.12], [0.17, 0.2], [0.17, 5.5], [0.24, 5.62], [0, 5.62]], 24)
    // lightbox poster: khung đồng + kính + hốc
    const frame = merge([
      placed(rbox(1.2, 0.07, 0.14, 0.02, 2), [0, 0.8, 0]),
      placed(rbox(1.2, 0.07, 0.14, 0.02, 2), [0, -0.8, 0]),
      placed(rbox(0.07, 1.7, 0.14, 0.02, 2), [-0.565, 0, 0]),
      placed(rbox(0.07, 1.7, 0.14, 0.02, 2), [0.565, 0, 0]),
    ])
    const sub = merge([
      latheHard([[0.0, 0], [0.38, 0], [0.38, 0.5], [0.3, 0.58], [0.0, 0.58]], 20),
      placed(rbox(0.5, 0.5, 0.5, 0.04, 2), [0, 0.3, 0]),
    ])
    const speaker = merge([
      latheHard([[0.0, 0], [0.19, 0], [0.19, 0.035], [0.15, 0.06], [0.0, 0.06]], 20),
      latheHard([[0.2, 0], [0.22, 0], [0.22, 0.04], [0.2, 0.04]], 20),
    ])
    const projector = merge([
      placed(rbox(0.9, 0.5, 0.95, 0.09, 3), [0, 0, 0]),
      placed(plate(0.7, 0.2, 0.02, 0.01, 0.004, Array.from({ length: 5 }, (_, i) => slotPath(0, -0.07 + i * 0.035, 0.5, 0.012))), [0.46, 0.0, 0.0], [0, Math.PI / 2, 0]),
      placed(plate(0.7, 0.2, 0.02, 0.01, 0.004, Array.from({ length: 5 }, (_, i) => slotPath(0, -0.07 + i * 0.035, 0.5, 0.012))), [-0.46, 0.0, 0.0], [0, -Math.PI / 2, 0]),
    ])
    const lens = merge([
      latheHard([[0.2, 0], [0.2, 0.16], [0.17, 0.2], [0.17, 0.3], [0.14, 0.3], [0.14, 0.04]], 28),
      latheHard([[0.2, 0.0], [0.24, -0.02], [0.24, 0.0]], 28),
    ])
    return { roofG, canG, lintel, doorFrame, leaf, glassPane, column, frame, sub, speaker, projector, lens }
  }, [])
  const curtain = useMemo(() => pleated(0.95, 5.2, 5, 0.085), [])
  const valance = useMemo(() => pleated(10.0, 0.6, 22, 0.05, 6), [])
  const stars = useMemo(() => {
    const pos: number[] = []
    const colr: number[] = []
    for (let i = 0; i < 260; i++) {
      pos.push((hash(i) - 0.5) * 9.6, 5.73, (hash(i + 400) - 0.5) * 11.4)
      const b = 0.35 + hash(i + 800) * 1.4
      colr.push(b * 0.8, b * 0.85, b)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3))
    return g
  }, [])

  // ---- instanced: lamen mặt ngoài, giếng QRD, ghế
  useEffect(() => {
    const o = new THREE.Object3D()
    const f = finsRef.current
    if (f) {
      let n = 0
      for (const sx of [-1, 1])
        for (let k = 0; k < 30; k++) {
          const z = -5.95 + k * 0.4
          const d = 0.18 + 0.2 * Math.abs(Math.sin(k * 0.42 + (sx > 0 ? 0.6 : 0)))
          o.position.set(sx * (5.55 + d / 2 + 0.04), 2.85, z)
          o.scale.set(d, 5.2, 0.1)
          o.rotation.set(0, 0, 0)
          o.updateMatrix()
          f.setMatrixAt(n++, o.matrix)
        }
      for (let k = 0; k < 28; k++) {
        const x = -5.4 + k * 0.4
        const d = 0.18 + 0.2 * Math.abs(Math.sin(k * 0.42))
        o.position.set(x, 2.85, -6.55 - d / 2 - 0.04)
        o.scale.set(0.1, 5.2, d)
        o.updateMatrix()
        f.setMatrixAt(n++, o.matrix)
      }
      f.instanceMatrix.needsUpdate = true
    }
    const q = qrdRef.current
    if (q) {
      let n = 0
      const depthOf = (i: number) => 0.03 + QRD[i % 7] * 0.042
      for (const sx of [-1, 1])
        for (let k = 0; k < 77; k++) {
          const d = depthOf(k)
          o.position.set(sx * (5.05 - d / 2), 4.8, -5.4 + k * 0.1405)
          o.scale.set(d, 1.7, 0.135)
          o.updateMatrix()
          q.setMatrixAt(n++, o.matrix)
        }
      for (const sx of [-1, 1])
        for (let k = 0; k < 21; k++) {
          const d = depthOf(k)
          o.position.set(sx * (2.05 + k * 0.14), 3.2, 5.95 - d / 2)
          o.scale.set(0.135, 4.6, d)
          o.updateMatrix()
          q.setMatrixAt(n++, o.matrix)
        }
      q.instanceMatrix.needsUpdate = true
    }
    const s = seatShell.current
    const h = seatHw.current
    if (s && h) {
      let n = 0
      ROWS.forEach((z, ri) => {
        for (const sx of [-1, 1])
          for (const ax of SEAT_X) {
            o.position.set(sx * ax, TIER[ri], z)
            o.rotation.set(0, 0, 0)
            o.scale.setScalar(1)
            o.updateMatrix()
            s.setMatrixAt(n, o.matrix)
            h.setMatrixAt(n, o.matrix)
            n++
          }
      })
      s.instanceMatrix.needsUpdate = true
      h.instanceMatrix.needsUpdate = true
    }
  }, [])

  useFrame((state, dt) => {
    dimRef.current.v = THREE.MathUtils.damp(dimRef.current.v, filmActive ? 0.22 : 1, 3, dt)
    const d = dimRef.current.v
    M.cove.color.set('#ffb070').multiplyScalar(2.2 * d)
    M.floorGlow.color.set('#ffa060').multiplyScalar(1.6 * (0.35 + 0.65 * d))
    const t = state.clock.elapsedTime
    M.backlight.color.set('#ff5a3c').multiplyScalar(1.3 + Math.sin(t * 0.7) * 0.25)
    if (starRef.current) (starRef.current.material as THREE.PointsMaterial).opacity = 0.55 + 0.45 * Math.sin(t * 0.9) * 0.3 + 0.2
  })

  const sideZ = Array.from({ length: 7 }, (_, i) => -4.8 + i * 1.6)
  const sxs = [-1, 1]
  return (
    <>
      {/* =================== NGOẠI THẤT =================== */}
      <mesh position={[0, 0.1, 0.5]} geometry={rbox(13.2, 0.2, 16.2, 0.05, 2)} material={K.anodized} receiveShadow />
      <mesh position={[0, 0.215, 0.5]} geometry={rbox(12.7, 0.03, 15.7, 0.012, 1)} material={K.bronzeDark} />
      {/* lõi tường */}
      <mesh position={[0, 2.9, -6.3]} material={M.wall} castShadow receiveShadow><boxGeometry args={[11.1, 5.8, 0.5]} /></mesh>
      {sxs.map((s) => (
        <group key={s}>
          <mesh position={[s * 5.3, 2.9, 0]} material={M.wall} castShadow receiveShadow><boxGeometry args={[0.5, 5.8, 12.8]} /></mesh>
          <mesh position={[s * 3.65, 2.9, 6.2]} material={M.wall} castShadow receiveShadow><boxGeometry args={[3.7, 5.8, 0.5]} /></mesh>
          {/* khe sáng sau lamen */}
          <mesh position={[s * 5.57, 2.85, 0]} material={M.backlight}><boxGeometry args={[0.02, 5.0, 11.8]} /></mesh>
          <mesh position={[s * 1.84, 2.9, 6.5]} material={led('#ff3b3b', 2.8)}><boxGeometry args={[0.05, 5.8, 0.05]} /></mesh>
        </group>
      ))}
      <mesh position={[0, 2.85, -6.58]} material={M.backlight}><boxGeometry args={[10.4, 5.0, 0.02]} /></mesh>
      <instancedMesh ref={finsRef} args={[undefined, undefined, 30 * 2 + 28]} material={K.bronze} castShadow frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
      <mesh position={[0, 4.75, 6.2]} geometry={G.lintel} material={M.wall} castShadow />
      <mesh position={[0, 5.75, 0]} geometry={G.roofG} material={M.roof} castShadow receiveShadow />
      <mesh position={[0, 5.75, 0]} geometry={G.canG} material={K.anodized} castShadow />
      <mesh position={[0, 5.78, 9.78]} material={led('#ff4040', 2.4)}><boxGeometry args={[9.5, 0.04, 0.04]} /></mesh>
      <mesh position={[0, 5.62, 6.25]} material={led('#ffcf9a', 1.6)}><boxGeometry args={[9.4, 0.025, 0.025]} /></mesh>
      {sxs.map((s) => (
        <mesh key={s} position={[s * 4.7, 0.2, 9.1]} geometry={G.column} material={K.titaniumLong} castShadow />
      ))}
      {/* khung cửa + hai cánh trượt kính */}
      <mesh position={[0, 0, 6.2]} geometry={G.doorFrame} material={K.bronze} />
      {([[leftDoor, -2.47], [rightDoor, 2.47]] as [React.RefObject<THREE.Group | null>, number][]).map(([ref, x], i) => (
        <group key={i} ref={ref} position={[x, 1.9, 6.2]}>
          <mesh geometry={G.leaf} material={K.titanium} />
          <mesh geometry={G.glassPane} material={K.glass} />
        </group>
      ))}
      <mesh position={[0, 4.28, 6.2]} material={K.glass}><boxGeometry args={[3.6, 0.6, 0.03]} /></mesh>

      {/* marquee: khung đồng, bảng chữ, bóng đèn chạy */}
      <group position={[0, 4.75, 6.5]}>
        <mesh geometry={rbox(9.6, 1.8, 0.3, 0.1)} material={K.bronzeDark} castShadow />
        <mesh position={[0, 0, 0.17]}>
          <planeGeometry args={[8.7, 1.62]} />
          <meshBasicMaterial map={marquee} toneMapped={false} />
        </mesh>
        <instancedMesh ref={bulbs} args={[undefined, undefined, bulbCount]} position={[0, 0, 0.24]} frustumCulled={false}>
          <sphereGeometry args={[0.07, 10, 8]} />
          <meshBasicMaterial toneMapped={false} />
        </instancedMesh>
      </group>

      {/* lightbox poster — hai bên cửa */}
      {sxs.flatMap((s) =>
        posters.map((tex, i) => {
          const x = s * (4.85 - i * 1.2)
          return (
            <group key={`${s}-${i}`} position={[x, 2.3, 6.5]}>
              <mesh geometry={G.frame} material={K.bronze} />
              <mesh position={[0, 0, -0.02]} material={led('#fff1dc', 0.9)}><planeGeometry args={[1.06, 1.66]} /></mesh>
              <mesh position={[0, 0, 0.0]}>
                <planeGeometry args={[1.0, 1.5]} />
                <meshBasicMaterial map={tex} toneMapped={false} />
              </mesh>
              {s < 0 && i === 0 && teaser}
              <mesh position={[0, 0, 0.065]} material={K.glass}><planeGeometry args={[1.06, 1.64]} /></mesh>
            </group>
          )
        }),
      )}
      {/* đèn rọi chân tường phía trước */}
      {[-4.2, -2.9, 2.9, 4.2].map((x) => (
        <mesh key={x} position={[x, 0.26, 6.55]} material={led('#ffb070', 1.7)}><boxGeometry args={[0.6, 0.03, 0.05]} /></mesh>
      ))}

      {/* =================== NỘI THẤT =================== */}
      {/* sàn thảm + đường chỉ đồng */}
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} material={K.carpet} receiveShadow>
        <planeGeometry args={[10.1, 12.1]} />
      </mesh>
      {[-1.5, 1.5].map((x) => <mesh key={x} position={[x, 0.034, 0.3]} material={M.floorGlow}><boxGeometry args={[0.04, 0.012, 10.8]} /></mesh>)}
      <mesh position={[0, 0.034, -5.2]} material={K.bronze}><boxGeometry args={[9.9, 0.012, 0.06]} /></mesh>

      {/* hệ tường âm học */}
      {sxs.map((s) => (
        <group key={s}>
          <mesh position={[s * 4.96, 0.46, 0]} geometry={rbox(0.16, 0.9, 11.9, 0.03, 2)} material={M.charcoal} />
          {sideZ.map((z, i) => (
            <mesh key={i} position={[s * 4.94, 2.4, z]} geometry={rbox(0.18, 2.9, 1.46, 0.06, 3)} material={i % 2 ? M.plum : M.charcoal} />
          ))}
          {sideZ.slice(0, -1).map((z, i) => (
            <mesh key={i} position={[s * 4.9, 2.4, z + 0.8]} material={K.bronze}><boxGeometry args={[0.2, 3.0, 0.035]} /></mesh>
          ))}
          <mesh position={[s * 4.92, 3.88, 0]} material={M.cove}><boxGeometry args={[0.05, 0.035, 11.6]} /></mesh>
          <mesh position={[s * 4.94, 3.8, 0]} geometry={rbox(0.14, 0.08, 11.8, 0.02, 2)} material={K.bronze} />
          {[-3.2, 0, 3.2].map((z) => (
            <group key={z} position={[s * 4.84, 3.15, z]} rotation={[0, s * -Math.PI / 2, 0]}>
              <mesh geometry={G.speaker} rotation={[Math.PI / 2, 0, 0]} material={K.polymer} />
            </group>
          ))}
        </group>
      ))}
      <instancedMesh ref={qrdRef} args={[undefined, undefined, 77 * 2 + 21 * 2]} material={M.wood} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
      {/* tường sau: vải + đèn EXIT */}
      {sxs.map((s) => <mesh key={s} position={[s * 3.5, 0.9, 5.88]} geometry={rbox(2.9, 1.5, 0.14, 0.04, 2)} material={M.plum} />)}
      <mesh position={[0, 3.55, 5.86]} material={led('#2bff9a', 2.2)}><boxGeometry args={[0.5, 0.14, 0.02]} /></mesh>

      {/* tường màn hình: khung, viền che đen, rèm xếp ly */}
      <mesh position={[0, 2.95, -5.98]}>
        <planeGeometry args={[8.3, 3.64]} />
        <meshBasicMaterial map={screenTex} toneMapped={false} />
      </mesh>
      {sxs.map((s) => <mesh key={s} position={[s * 4.375, 2.95, -6.0]} geometry={rbox(0.15, 3.9, 0.12, 0.02, 2)} material={K.anodized} />)}
      {[-1, 1].map((s) => <mesh key={s} position={[0, 2.95 + s * 1.885, -6.0]} geometry={rbox(8.9, 0.13, 0.12, 0.02, 2)} material={K.anodized} />)}
      <mesh position={[0, 5.1, -6.0]} material={M.black}><boxGeometry args={[9.9, 1.2, 0.1]} /></mesh>
      <mesh position={[0, 0.9, -6.0]} material={M.black}><boxGeometry args={[9.9, 1.7, 0.1]} /></mesh>
      {sxs.map((s) => <mesh key={s} position={[s * 4.7, 2.95, -6.0]} material={M.black}><boxGeometry args={[0.7, 4.0, 0.1]} /></mesh>)}
      {sxs.map((s) => <mesh key={s} position={[s * 4.58, 2.85, -5.7]} geometry={curtain} material={K.velvet} castShadow />)}
      <mesh position={[0, 5.28, -5.62]} geometry={valance} material={K.velvet} />
      {sxs.map((s) => (
        <mesh key={s} position={[s * 4.5, 0.4, -5.45]} geometry={G.sub} material={K.polymer} castShadow />
      ))}

      {/* trần: mây vải + cove LED + trần sao sợi quang */}
      <mesh position={[0, 5.74, 0]} rotation={[Math.PI / 2, 0, 0]} material={M.black}><planeGeometry args={[10.1, 12.1]} /></mesh>
      <points ref={starRef} geometry={stars}>
        <pointsMaterial size={2.4} sizeAttenuation={false} vertexColors transparent opacity={0.8} depthWrite={false} toneMapped={false} />
      </points>
      {sxs.map((s) =>
        [-3.7, 0, 3.7].map((z) => (
          <group key={`${s}-${z}`} position={[s * 2.75, 5.43, z]}>
            <mesh geometry={rbox(3.7, 0.12, 3.3, 0.05, 3)} material={M.charcoal} />
            <mesh position={[-s * 1.86, -0.03, 0]} material={M.cove}><boxGeometry args={[0.04, 0.025, 3.1]} /></mesh>
            <mesh position={[0, -0.03, 1.68]} material={M.cove}><boxGeometry args={[3.5, 0.025, 0.04]} /></mesh>
          </group>
        )),
      )}
      {[-4.2, -1.2, 1.8, 4.2].map((z) => (
        <mesh key={z} position={[0, 5.72, z]} rotation={[Math.PI / 2, 0, 0]} material={led('#fff0d8', 1.4)}><circleGeometry args={[0.07, 14]} /></mesh>
      ))}

      {/* khán đài + ghế recliner */}
      {sxs.map((s) =>
        ROWS.map((z, ri) => (
          <group key={`${s}-${ri}`}>
            <mesh position={[s * 3.5, TIER[ri] / 2, z]} geometry={rbox(3.15, TIER[ri], 2.3, 0.02, 2)} material={K.carpet} receiveShadow />
            <mesh position={[s * 1.945, TIER[ri] - 0.01, z]} material={M.floorGlow}><boxGeometry args={[0.015, 0.012, 2.2]} /></mesh>
            {SEAT_X.length > 1 && (
              <group position={[s * 3.1, TIER[ri], z]}>
                <mesh position={[0, 0.36, -0.04]} geometry={rbox(0.2, 0.32, 0.78, 0.05, 3)} material={K.leather} />
                <mesh position={[0, 0.54, -0.2]} rotation={[Math.PI / 2, 0, 0]} material={K.titanium}><torusGeometry args={[0.055, 0.012, 6, 16]} /></mesh>
                <mesh position={[0, 0.535, -0.2]} rotation={[Math.PI / 2, 0, 0]} material={led('#ffb070', 2)}><ringGeometry args={[0.04, 0.05, 16]} /></mesh>
              </group>
            )}
          </group>
        )),
      )}
      <instancedMesh ref={seatShell} args={[undefined, undefined, 12]} geometry={seat.shell} material={K.leather} castShadow frustumCulled={false} />
      <instancedMesh ref={seatHw} args={[undefined, undefined, 12]} geometry={seat.hardware} material={K.gunmetal} frustumCulled={false} />

      {/* máy chiếu treo trần + chùm sáng */}
      <group position={[0, 4.9, 4.9]}>
        <mesh geometry={G.projector} material={K.paintWhite} castShadow />
        <mesh geometry={strut(v3(-0.25, 0.25, -0.25), v3(-0.25, 0.85, -0.25), 0.02, 0.02, 6)} material={K.titanium} />
        <mesh geometry={strut(v3(0.25, 0.25, 0.25), v3(0.25, 0.85, 0.25), 0.02, 0.02, 6)} material={K.titanium} />
        <mesh geometry={strut(v3(-0.25, 0.25, 0.25), v3(-0.25, 0.85, 0.25), 0.02, 0.02, 6)} material={K.titanium} />
        <mesh geometry={strut(v3(0.25, 0.25, -0.25), v3(0.25, 0.85, -0.25), 0.02, 0.02, 6)} material={K.titanium} />
        <mesh position={[0, 0.85, 0]} geometry={rbox(0.8, 0.04, 0.8, 0.01, 2)} material={K.gunmetal} />
        <mesh position={[0, 0, -0.5]} rotation={[-Math.PI / 2, 0, 0]} geometry={G.lens} material={K.gunmetal} />
        <mesh position={[0, 0, -0.8]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.13, 20]} /><meshBasicMaterial color={new THREE.Color('#c8e0ff').multiplyScalar(1.6)} toneMapped={false} /></mesh>
        <mesh position={[0.3, -0.27, -0.3]} material={led('#2bff9a', 2)}><boxGeometry args={[0.04, 0.012, 0.012]} /></mesh>
      </group>
      <mesh position={[0, 4.9, 4.2]} rotation={[-Math.PI / 2 - 0.19, 0, 0]} geometry={beamGeo} material={beamMat} />
    </>
  )
}
