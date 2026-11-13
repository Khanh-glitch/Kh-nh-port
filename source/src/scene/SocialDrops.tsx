import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'
import { SOCIAL_PATHS } from './socialLogoPaths'

/**
 * Original user-supplied social icon geometry, spatially linked to the existing
 * Beacon energy beam. No external API, extra renderer or secondary Canvas.
 * The icons are decorative until real per-platform profile URLs are supplied.
 */
const ease = (v: number) => 1 - Math.pow(1 - THREE.MathUtils.clamp(v, 0, 1), 3)
const textureCache = new Map<string, THREE.BufferGeometry | null>()
function logoGeometry(path: string) {
  if (textureCache.has(path)) return textureCache.get(path) ?? null
  let geo: THREE.BufferGeometry | null = null
  try {
    const loader = new SVGLoader()
    const parsed = loader.parse(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="${path}"/></svg>`)
    const shapes = parsed.paths.flatMap((p) => SVGLoader.createShapes(p))
    if (shapes.length) {
      // Supplied 3d-social-media-logos used 4.6 depth, 0.7 bevel, 3 bevel steps.
      geo = new THREE.ExtrudeGeometry(shapes, {
        steps: 1, depth: 4.6, bevelEnabled: true,
        bevelThickness: .7, bevelSize: .5, bevelSegments: 3, curveSegments: 10,
      })
      geo.center()
      geo.computeBoundingBox()
      const size = new THREE.Vector3()
      geo.boundingBox!.getSize(size)
      geo.scale(2.3 / Math.max(size.x, size.y, .001), 2.3 / Math.max(size.x, size.y, .001), 2.3 / Math.max(size.x, size.y, .001))
      geo.computeVertexNormals()
    }
  } catch (error) { console.warn('[ORBITA SocialDrops] icon geometry', error) }
  textureCache.set(path, geo)
  return geo
}

/**
 * FREEZE THE SCENE-WIDE POINT-LIGHT COUNT.
 *
 * Every point light that becomes visible adds a `NUM_POINT_LIGHTS` define and a
 * new shader Program for EVERY lit material in the whole island (the sun's
 * shadow variant too). The six icons used to carry their own point lights
 * inside `visible={false}` groups, so the very first beacon signal made the
 * renderer recompile hundreds of programs in a single frame — the freeze and
 * the black flash reported when activating the beacon.
 *
 * All six lights now live in an always-mounted root at zero intensity, and each
 * one is re-positioned onto its icon every frame. The light count never changes,
 * so activation compiles nothing; the lighting itself is identical because the
 * light still travels with the icon and only lights up while it is on screen.
 */
const DROP_LIGHT_INTENSITY = 2.6
const DROP_LIGHT_DISTANCE = 5

export function SocialDrops({ signal }: { signal: {send:number} }) {
  const nodes=useRef<Array<THREE.Group|null>>([])
  const rings=useRef<Array<THREE.Mesh|null>>([])
  const lights=useRef<Array<THREE.PointLight|null>>([])
  const icons=useMemo(() => SOCIAL_PATHS.map((l)=>({
    ...l, geometry:logoGeometry(l.path),
    material:new THREE.MeshPhysicalMaterial({
      color: l.color, metalness:.18, roughness:.24, clearcoat:1,
      clearcoatRoughness:.18, emissive:l.color, emissiveIntensity:.14,
    }),
  })),[])
  useEffect(()=>()=>{icons.forEach((l)=>l.material.dispose())},[icons])
  // Second half of the same fix: the icons use MeshPhysicalMaterial (clearcoat),
  // which is its own shader variant. Until it has been compiled once, the first
  // signal would compile it synchronously mid-frame. Prepare those few
  // programs asynchronously while the visitor is still walking around — the
  // SAME real materials, no dummy geometry, no reduced quality, and it yields
  // completely once a signal is actually sent.
  const { gl, scene, camera } = useThree()
  useEffect(()=>{
    if (signal.send > 0) return
    let cancelled = false
    let done = false
    let timer = 0
    const queue = icons.filter(i=>i.geometry).map(i=>i.geometry as THREE.BufferGeometry)
    const step = () => {
      if (cancelled || done || typeof gl.compileAsync !== 'function') return
      const geo = queue.shift()
      if (!geo || signal.send > 0) { done = true; return }
      const mat = icons.find(i=>i.geometry===geo)!.material
      const proxy = new THREE.Mesh(geo, mat)
      proxy.matrixAutoUpdate = false
      try { void gl.compileAsync(proxy, camera, scene).catch(()=>{}) } catch { /* ignore */ }
      timer = window.setTimeout(step, 320)
    }
    timer = window.setTimeout(step, 1200)
    return ()=>{ cancelled = true; window.clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[])

  useFrame((state)=>{
    const age = signal.send < 0 ? -100 : performance.now()/1000 - signal.send
    for(let i=0;i<icons.length;i++){
      const g=nodes.current[i]
      const halo=rings.current[i]
      if(!g)continue
      const t=age - i*.19 - .17
      const lamp=lights.current[i]
      if(t<0){
        g.visible=false;if(halo)halo.visible=false
        if(lamp&&lamp.intensity!==0)lamp.intensity=0
        continue
      }
      g.visible=true
      const x=ease(t/1.75)
      const angle = -Math.PI/2 + i*Math.PI*2/icons.length
      const radius = 3.6 + (i%2)*.6
      const bx=Math.cos(angle)*radius, bz=Math.sin(angle)*radius
      const hover = .16*Math.sin(state.clock.elapsedTime*1.4+i*.9)
      g.position.set(bx*(.15+.85*x), 34 - 28.5*x + hover*x, bz*(.15+.85*x))
      g.scale.setScalar(Math.max(0.005, Math.min(1, x*1.3)) * .82)
      g.rotation.set(.03*Math.sin(state.clock.elapsedTime+i), state.clock.elapsedTime*.24+i*.17, -0.12*Math.sin(t*2)*Math.exp(-t*.9))
      if(halo){halo.visible=t<2.8;halo.position.copy(g.position);halo.position.y-=.17;halo.scale.setScalar(1+.2*Math.sin(state.clock.elapsedTime*8+i))}
      // Same position/intensity as the original per-icon light, but the light
      // itself stays mounted so the shader define never changes. The icon's
      // wrapper group is an identity transform, so `g.position` is already in
      // this root's local space — no matrix work (and no one-frame lag).
      if(lamp){
        lamp.position.copy(g.position)
        if(lamp.intensity!==DROP_LIGHT_INTENSITY)lamp.intensity=DROP_LIGHT_INTENSITY
      }
    }
  })
  return <group>
    {/* Always-visible, zero-intensity carriers: see DROP_LIGHT_INTENSITY. */}
    {icons.map((entry,i)=>
      <pointLight key={`lamp-${entry.slug}`} ref={(r)=>{lights.current[i]=r}}
        color={entry.color} intensity={0} distance={DROP_LIGHT_DISTANCE} decay={2}/>)}
    {icons.map((entry,i)=>entry.geometry&&<group key={entry.slug}>
      <group ref={(r)=>{nodes.current[i]=r}} visible={false}>
        <mesh geometry={entry.geometry} material={entry.material} />
      </group>
      <mesh ref={(r)=>{rings.current[i]=r}} visible={false} rotation={[-Math.PI/2,0,0]}>
        <ringGeometry args={[.68,.75,32]}/>
        <meshBasicMaterial color={entry.color} transparent opacity={.26} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false}/>
      </mesh>
    </group>)}
  </group>
}
