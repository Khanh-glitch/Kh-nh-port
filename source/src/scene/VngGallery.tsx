import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PadRing } from './common'
import { Hit } from './Hit'
import { Label } from './Label'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { addCollider, player } from '../world'
import { toast } from '../store'
import { createVngMonument } from '../vng/models/vngLogo'
import { createProjectorSystem } from '../vng/models/projector'
import { createStuffCollection } from '../vng/models/stuffCollection'
import { createDeskSurfaceTexture } from '../vng/textures'
import { PROJECTOR_SLIDES, type ProjectorSlideId } from '../vng/types'

/** Right flank of Colossus, outside Ragnarok's summon beam and its footprint.
 * The front of the studio faces southwest, toward visitors walking north
 * from the central Orb. All positions below are in ORBITA's metre grid.
 * Colossus (0,-41), Ragnarok emitter (+8.5,-34.2), VNG gallery (+20,-40).
 */
export const VNG_GALLERY_POSITION = [20, 1.68, -40] as const
export const VNG_GALLERY_YAW = -0.68

function controlTexture(text: string, color: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 320
  canvas.height = 128
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#101722'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.strokeStyle = color
  ctx.lineWidth = 7
  ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10)
  ctx.fillStyle = '#f8fafc'
  ctx.font = '700 55px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 160, 67)
  const t = new THREE.CanvasTexture(canvas)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function MiniConsoleButton({ x, text, color, onClick }: { x: number; text: string; color: string; onClick: () => void }) {
  const tex = useMemo(() => controlTexture(text, color), [text, color])
  const buttonGeometry = useMemo(() => new RoundedBoxGeometry(1.24, 0.18, 0.74, 4, 0.08), [])
  useEffect(() => () => buttonGeometry.dispose(), [buttonGeometry])
  useEffect(() => () => tex.dispose(), [tex])
  return <group position={[x, 0.55, 3.63]}>
    <mesh geometry={buttonGeometry} castShadow>
      <meshStandardMaterial color="#171d27" metalness={0.72} roughness={0.3} emissive={color} emissiveIntensity={0.09} />
    </mesh>
    <mesh position={[0, 0.106, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[1.1, 0.43]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
    <Hit id={`vng-control-${text.toLowerCase()}`} label={`VNG · ${text === 'PREV' ? 'Slide trước' : 'Slide tiếp theo'}`}
      hint="Nhấn để chuyển thành quả trưng bày" maxDist={9} onClick={onClick}
      size={[1.28, 0.42, 0.85]} position={[0, 0.07, 0]} />
  </group>
}

function disposeGroup(group: THREE.Object3D) {
  const geo = new Set<THREE.BufferGeometry>()
  const mats = new Set<THREE.Material>()
  const textures = new Set<THREE.Texture>()
  group.traverse(o => {
    const mesh = o as THREE.Mesh
    if (mesh.geometry) geo.add(mesh.geometry)
    if (mesh.material) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(m => mats.add(m))
  })
  mats.forEach(mat => {
    const record = mat as unknown as Record<string, unknown>
    for (const v of Object.values(record)) if (v instanceof THREE.Texture) textures.add(v)
    // Shader materials store textures in uniforms rather than direct slots.
    const uniforms = (mat as THREE.ShaderMaterial).uniforms
    if (uniforms) Object.values(uniforms).forEach(({ value }) => { if (value instanceof THREE.Texture) textures.add(value) })
    mat.dispose()
  })
  textures.forEach(t => t.dispose())
  geo.forEach(g => g.dispose())
}

export function VngGallery() {
  // Reuse the actual Three.js geometry/art from the user's ZIP, but share the
  // parent ORBITA Canvas/renderer and R3F frame loop. No nested renderer.
  const assets = useMemo(() => {
    const monument = createVngMonument()
    monument.group.position.set(0, 0, -1.55)
    const projection = createProjectorSystem()
    const collection = createStuffCollection()
    const desk = new THREE.Group()
    const deskTexture = createDeskSurfaceTexture()
    const deskMat = new THREE.MeshStandardMaterial({ map: deskTexture, roughness: 0.42, metalness: 0.18 })
    const sideMat = new THREE.MeshStandardMaterial({ color: '#171c29', roughness: 0.35, metalness: 0.64 })
    const slab = new THREE.Mesh(new RoundedBoxGeometry(11.8, 0.24, 6.8, 4, 0.045), [sideMat, sideMat, deskMat, sideMat, sideMat, sideMat])
    slab.position.set(0, -0.12, 0)
    slab.receiveShadow = true
    slab.castShadow = true
    desk.add(slab)
    const trim = new THREE.Mesh(new RoundedBoxGeometry(11.84, 0.032, 6.84, 4, 0.014), new THREE.MeshStandardMaterial({ color: '#e65a26', metalness: 0.85, roughness: 0.22 }))
    trim.position.y = -0.25
    desk.add(trim)
    for (const x of [-4.9, 4.9]) {
      for (const z of [-2.5, 2.5]) {
        const leg = new THREE.Mesh(new RoundedBoxGeometry(0.18, 1.45, 0.18, 3, 0.03), sideMat)
        leg.position.set(x, -0.95, z)
        desk.add(leg)
      }
      const crossrail = new THREE.Mesh(new RoundedBoxGeometry(0.14, 0.12, 5.1, 3, 0.02), sideMat)
      crossrail.position.set(x, -1.52, 0)
      desk.add(crossrail)
    }
    return { monument, projection, collection, desk }
  }, [])
  const slide = useRef<ProjectorSlideId>(0)

  // Prevent walking through the substantial tabletop while leaving the open
  // approach between Robot console, Ragnarok and the VNG booth unobstructed.
  useEffect(() => {
    const remove = addCollider({ type: 'box', x: VNG_GALLERY_POSITION[0], z: VNG_GALLERY_POSITION[2],
      hw: 5.95, hd: 3.38, rot: VNG_GALLERY_YAW })
    return () => { remove(); disposeGroup(assets.monument.group); disposeGroup(assets.projection.group);
      disposeGroup(assets.collection.group); disposeGroup(assets.desk) }
  }, [assets])

  const changeSlide = (step: number) => {
    const count = PROJECTOR_SLIDES.length
    slide.current = ((slide.current + step + count) % count) as ProjectorSlideId
    assets.projection.setPowered(true)
    assets.projection.setSlide(slide.current)
    toast(`VNG Work Gallery · ${PROJECTOR_SLIDES[slide.current].title}`)
  }
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    // These update routines originate in the uploaded studio source.
    assets.monument.update(t, true, true)
    assets.projection.update(t)
    // Only animate small studio props while the visitor is nearby; the
    // meshes remain available to the scene / UEH reality rewrite.
    const dist = Math.hypot(player.pos.x - 20, player.pos.z + 40)
    if (dist < 35) assets.collection.update(t)
  })

  return <group position={VNG_GALLERY_POSITION as unknown as [number, number, number]} rotation={[0, VNG_GALLERY_YAW, 0]}
    name="vng-work-gallery">
    <group position={[0, -1.68, 0]}>
      <mesh position={[0, 0.016, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[6.75, 64]} />
        <meshStandardMaterial color="#0b111c" roughness={0.6} metalness={0.34} />
      </mesh>
      <PadRing radius={6.48} color="#e65a26" intensity={1.65} />
    </group>
    <primitive object={assets.desk} />
    <primitive object={assets.monument.group} />
    <primitive object={assets.projection.group} />
    <primitive object={assets.collection.group} />
    <pointLight position={[0, 3.8, 2.4]} color="#ff9655" intensity={12} distance={12} decay={2} />
    <pointLight position={[3.5, 4.1, -2]} color="#8fb8ff" intensity={8} distance={11} decay={2} />
    <Label title="VNG Work Gallery" sub="Dự án & thành quả · Điều khiển slide" color="#e65a26"
      position={[0, 6.0, 0]} scale={0.9} fadeNear={4} fadeFar={60} />
    <MiniConsoleButton x={-0.78} color="#e65a26" text="PREV" onClick={() => changeSlide(-1)} />
    <MiniConsoleButton x={0.78} color="#38bdf8" text="NEXT" onClick={() => changeSlide(1)} />
    <Hit id="vng-project-dossier" label="VNG · Hồ sơ cuộc thi" hint="Xem bài dự thi và chứng cứ"
      panel="vng" maxDist={16} size={[1.45, 0.6, 0.45]} position={[0, 0.65, 2.35]} />
    <Hit id="vng-screen-next" label="VNG · Màn trình chiếu" hint="Bấm để chuyển trang"
      maxDist={14} onClick={() => changeSlide(1)}
      size={[2.9, 1.8, 0.25]} position={[3.45, 1.5, -0.65]} rotation={[0, -1.32, 0]} />
  </group>
}
