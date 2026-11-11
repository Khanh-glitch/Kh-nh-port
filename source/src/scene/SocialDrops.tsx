import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'
import { SOCIAL_PATHS } from './socialLogoPaths'
import { useStore } from '../store'

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
  const {gl,scene}=useThree()
  const gpuPrewarm = typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('beaconGpuPrewarm') === '1'
  // Query-only A/B: stabilize the number of *real* point lights, not their
  // brightness. Production/default retains the exact original light hierarchy.
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

  // EXACT-RESOURCE / PRIVATE-FRAMEBUFFER GPU A/B, never active by default.
  // The source MeshPhysicalMaterial and original extruded source geometry
  // are submitted only while the Beacon is dormant and renderer is healthy.
  // No production mesh, light, visible framebuffer, shadow map, postprocessing
  // or actual signal animation is touched. Abort on a slow idle submission.
  useEffect(()=>{
    if(!gpuPrewarm)return
    let stopped=false
    const info={
      status:'waiting-for-idle',total:0,done:0,maxSubmitMs:0,
      maxFenceMs:0,maxIdleRafGapMs:0,errors:0,startedAt:performance.now(),
      gpuSynced:false,
    }
    ;(window as unknown as {__orbitaBeaconGpuPrewarm?:typeof info}).__orbitaBeaconGpuPrewarm=info
    const cancelled=()=>stopped||signal.send>-90
    let measuredFrame=0,traceRaf=0
    const traceIdle=()=>{
      if(stopped||signal.send>-90)return
      const now=performance.now()
      if(measuredFrame) info.maxIdleRafGapMs=Math.max(info.maxIdleRafGapMs,
        Math.round(now-measuredFrame))
      measuredFrame=now
      traceRaf=requestAnimationFrame(traceIdle)
    }
    const nextHealthyFrame=async():Promise<boolean>=>{
      let healthy=0,last=0
      for(let n=0;n<220&&!cancelled();n++){
        const timestamp=await new Promise<number>(resolve=>requestAnimationFrame(resolve))
        const dt=last?timestamp-last:0
        last=timestamp
        const free = useStore.getState().phase==='playing' &&
          document.visibilityState==='visible' &&
          !(navigator as Navigator & {
            scheduling?:{isInputPending?:()=>boolean}
          }).scheduling?.isInputPending?.()
        healthy=free && dt>0&&dt<55 ? healthy+1:0
        if(healthy>=2)return true
      }
      return false
    }
    const start=async()=>{
      if(!await nextHealthyFrame()){
        info.status=cancelled()?'cancelled':'skipped-busy-renderer'
        return
      }
      traceRaf=requestAnimationFrame(traceIdle)
      const target=new THREE.WebGLRenderTarget(40,40,
        {depthBuffer:true,stencilBuffer:false})
      target.texture.colorSpace=gl.outputColorSpace
      const stage=new THREE.Scene()
      stage.environment=scene.environment
      stage.fog=scene.fog
      const warmCamera=new THREE.PerspectiveCamera(55,1,0.1,50)
      warmCamera.position.set(0,0,9)
      warmCamera.lookAt(0,0,0)
      // Replicate the EXACT source light-count family. Using private light
      // clones avoids activating hidden production SocialDrops emitters.
      const clonedLights:THREE.Light[]=[]
      scene.traverseVisible(obj=>{
        if(!(obj as THREE.Light).isLight)return
        const source=obj as THREE.Light
        const clone=source.clone(false)
        if(clone.castShadow &&
           (clone as THREE.Light & {shadow?:THREE.LightShadow}).shadow){
          (clone as THREE.Light & {shadow:THREE.LightShadow})
            .shadow.mapSize.set(64,64)
        }
        stage.add(clone)
        clonedLights.push(clone)
      })
      if(!stableLights){
        for(const item of icons){
          const light=new THREE.PointLight(item.color,2.6,5,2)
          stage.add(light)
          clonedLights.push(light)
        }
      }
      // Mesh proxies share ORIGINAL source buffers and material identities.
      const queue:THREE.Mesh[]=icons.filter(item=>!!item.geometry)
        .map(item=>new THREE.Mesh(item.geometry!,item.material))
      const ring=rings.current.find((m):m is THREE.Mesh=>!!m)
      if(ring)queue.push(new THREE.Mesh(ring.geometry,ring.material))
      info.total=queue.length
      try{
        for(const mesh of queue){
          if(cancelled()){info.status='cancelled';return}
          if(!await nextHealthyFrame()){
            info.status='skipped-busy-renderer';return
          }
          info.status='submitting'
          const oldTarget=gl.getRenderTarget()
          const viewport=gl.getViewport(new THREE.Vector4()).clone()
          const scissor=gl.getScissor(new THREE.Vector4()).clone()
          const scissorTest=gl.getScissorTest()
          const xr=gl.xr.enabled
          const began=performance.now()
          let readback:Promise<unknown>|undefined
          try{
            mesh.position.set(0,0,0)
            mesh.frustumCulled=false
            stage.add(mesh)
            gl.xr.enabled=false
            gl.setRenderTarget(target)
            gl.setViewport(0,0,40,40)
            gl.setScissorTest(false)
            gl.clear(true,true,true)
            gl.render(stage,warmCamera)
            if(typeof gl.readRenderTargetPixelsAsync==='function')
              readback=gl.readRenderTargetPixelsAsync(target,0,0,1,1,new Uint8Array(4))
          }finally{
            stage.remove(mesh)
            gl.setRenderTarget(oldTarget)
            gl.setViewport(viewport)
            gl.setScissor(scissor)
            gl.setScissorTest(scissorTest)
            gl.xr.enabled=xr
          }
          const submitMs=performance.now()-began
          info.maxSubmitMs=Math.max(info.maxSubmitMs,Math.round(submitMs))
          if(submitMs>120){
            info.status='rejected-idle-frame-stall'
            return
          }
          if(readback){
            try{
              const fenceStart=performance.now()
              await readback
              info.maxFenceMs=Math.max(info.maxFenceMs,
                Math.round(performance.now()-fenceStart))
            }catch(err){
              info.errors++
              console.warn('[Beacon source VBO warmup] GPU fence',err)
              info.status='failed-fence'
              return
            }
          }
          info.done++
        }
        // Include the compositor frame immediately after the final GPU fence.
        await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()))
        await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()))
        if(info.maxIdleRafGapMs>120){
          info.status='rejected-idle-frame-stall'
          return
        }
        info.gpuSynced=typeof gl.readRenderTargetPixelsAsync==='function'
        info.status=info.gpuSynced?'ready':'submitted-no-gpu-fence'
      }finally{
        cancelAnimationFrame(traceRaf)
        stage.clear()
        clonedLights.forEach(l=>(l as THREE.Light & {
          shadow?:THREE.LightShadow
        }).shadow?.dispose())
        target.dispose()
      }
    }
    void start().catch(err=>{
      info.status='failed';info.errors++
      console.warn('[Beacon] original-resource idle prewarm',err)
    })
    return ()=>{stopped=true;cancelAnimationFrame(traceRaf);info.status='disposed'}
  },[gpuPrewarm,gl,scene,icons,signal,stableLights])

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
