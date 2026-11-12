import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
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

export function SocialDrops({ signal }: { signal: {send:number} }) {
  // Diagnostic A/B only until original-source pixel parity + no-click idle
  // are accepted. Keeps the same original six point lights, colors,
  // intensity, falloff, trajectory, geometry and materials; but preserves
  // their shader *count* even while original icon groups are invisible.
  const stableLights = typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('beaconStableLights') === '1'
  const lightRefs=useRef<Array<THREE.PointLight|null>>([])
  const nodes=useRef<Array<THREE.Group|null>>([])
  const rings=useRef<Array<THREE.Mesh|null>>([])
  const icons=useMemo(() => SOCIAL_PATHS.map((l)=>({
    ...l, geometry:logoGeometry(l.path),
    material:new THREE.MeshPhysicalMaterial({
      color: l.color, metalness:.18, roughness:.24, clearcoat:1,
      clearcoatRoughness:.18, emissive:l.color, emissiveIntensity:.14,
    }),
  })),[])
  useEffect(()=>()=>{icons.forEach((l)=>l.material.dispose())},[icons])
  useFrame((state)=>{
    const age = signal.send < 0 ? -100 : performance.now()/1000 - signal.send
    for(let i=0;i<icons.length;i++){
      const g=nodes.current[i]
      const halo=rings.current[i]
      if(!g)continue
      const t=age - i*.19 - .17
      const light=lightRefs.current[i]
      if(t<0){
        g.visible=false
        if(halo)halo.visible=false
        if(light)light.intensity=0
        continue
      }
      g.visible=true
      const x=ease(t/1.75)
      const angle = -Math.PI/2 + i*Math.PI*2/icons.length
      const radius = 3.6 + (i%2)*.6
      const bx=Math.cos(angle)*radius, bz=Math.sin(angle)*radius
      const hover = .16*Math.sin(state.clock.elapsedTime*1.4+i*.9)
      g.position.set(bx*(.15+.85*x), 34 - 28.5*x + hover*x, bz*(.15+.85*x))
      if(light){light.position.copy(g.position);light.intensity=2.6}
      g.scale.setScalar(Math.max(0.005, Math.min(1, x*1.3)) * .82)
      g.rotation.set(.03*Math.sin(state.clock.elapsedTime+i), state.clock.elapsedTime*.24+i*.17, -0.12*Math.sin(t*2)*Math.exp(-t*.9))
      if(halo){halo.visible=t<2.8;halo.position.copy(g.position);halo.position.y-=.17;halo.scale.setScalar(1+.2*Math.sin(state.clock.elapsedTime*8+i))}
    }
  })
  return <group>
    {icons.map((entry,i)=>entry.geometry&&<group key={entry.slug}>
      <group ref={(r)=>{nodes.current[i]=r}} visible={false}>
        <mesh geometry={entry.geometry} material={entry.material} />
        {!stableLights && <pointLight color={entry.color} intensity={2.6} distance={5} decay={2}/>}
      </group>
      {stableLights && <pointLight ref={(r)=>{lightRefs.current[i]=r}}
        color={entry.color} intensity={0} distance={5} decay={2}/>}
      <mesh ref={(r)=>{rings.current[i]=r}} visible={false} rotation={[-Math.PI/2,0,0]}>
        <ringGeometry args={[.68,.75,32]}/>
        <meshBasicMaterial color={entry.color} transparent opacity={.26} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false}/>
      </mesh>
    </group>)}
  </group>
}
