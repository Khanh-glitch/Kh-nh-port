import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Bloom, ChromaticAberration, EffectComposer, Noise, ToneMapping, Vignette } from '@react-three/postprocessing'
import { BlendFunction, ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import { useStore, toast } from '../store'
import { Sky } from './Sky'
import { Phenomena, SUN_DIR } from './Phenomena'
import { Platform } from './Platform'
import { Player } from './Player'
import { Exhibits } from './Exhibits'
import { player } from '../world'
import { SPAWN, EYE } from '../layout'
import { highGuard } from '../highGuard'
import { RealityHost } from '../reality/RealityHost'

function Lights() {
  const light = useRef<THREE.DirectionalLight>(null)
  const target = useMemo(() => new THREE.Object3D(), [])
  useFrame(() => {
    const l = light.current
    if (!l) return
    // khung bóng đổ bám theo người chơi (làm tròn để tránh nhấp nháy)
    const cx = Math.round(player.pos.x / 2) * 2
    const cz = Math.round(player.pos.z / 2) * 2
    target.position.set(cx, 0, cz)
    l.position.set(cx + SUN_DIR.x * 90, SUN_DIR.y * 90, cz + SUN_DIR.z * 90)
    l.target.updateMatrixWorld()
  })
  return (
    <>
      <primitive object={target} />
      <directionalLight
        ref={light}
        target={target}
        color="#cfe0ff"
        intensity={2.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-38}
        shadow-camera-right={38}
        shadow-camera-top={38}
        shadow-camera-bottom={-38}
        shadow-camera-near={1}
        shadow-camera-far={220}
        shadow-bias={-0.0004}
        shadow-normalBias={0.05}
      />
      <hemisphereLight args={['#7a8cff', '#1a0f30', 0.55]} />
      <ambientLight intensity={0.12} color="#8090ff" />
    </>
  )
}

function Post({ low }: { low: boolean }) {
  const ca = useMemo(() => new THREE.Vector2(0.0007, 0.0009), [])
  return (
    <EffectComposer multisampling={low ? 0 : 4} enableNormalPass={false}>
      <Bloom intensity={low ? 0.9 : 1.25} luminanceThreshold={0.82} luminanceSmoothing={0.25} mipmapBlur radius={0.78} levels={low ? 5 : 8} />
      <ChromaticAberration offset={ca} radialModulation modulationOffset={0.35} blendFunction={low ? BlendFunction.SKIP : BlendFunction.NORMAL} />
      <Noise opacity={0.035} blendFunction={BlendFunction.SOFT_LIGHT} />
      <Vignette offset={0.25} darkness={0.55} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  )
}


/**
 * FIRST-LANDING GPU PREP — no spaceship UI and no altered visible scene.
 *
 * The public intro camera orbits at radius 88. On "BƯỚC VÀO", the camera
 * crosses previously unseen close-up geometry and world shadows. Render
 * those ACTUAL source meshes from the descent and spawn camera positions
 * into a private target while the intro remains open. Keep shader programs,
 * VAOs and textures resident; force a GPU fence, then let Colossus prewarm.
 *
 * Every render owns its private camera; no live sun/actor transform changes.
 * Reusing this subsystem from the user's existing spaceship prototype will
 * require NO recreation of ORBITA's models or quality settings.
 */
function LandingGpuPreflight() {
  const {gl,scene}=useThree()
  useLayoutEffect(()=>{
    const enabled=new URLSearchParams(location.search).get('landingGpuPreflight')!=='off'
    const info={
      enabled,status:enabled?'scheduled':'disabled',passes:0,
      compiled:false,gpuSynced:false,maxCpuDrawMs:0,
      longestInputWaitMs:0,error:'',renderer:'',
    }
    ;(window as unknown as {__orbitaLandingPrewarm:typeof info}).__orbitaLandingPrewarm=info
    if(!enabled)return
    let disposed=false
    let timer=0
    const target=new THREE.WebGLRenderTarget(320,180,{depthBuffer:true,stencilBuffer:false})
    target.texture.colorSpace=gl.outputColorSpace
    const withTarget=(fn:()=>void)=>{
      const oldTarget=gl.getRenderTarget()
      const viewport=gl.getViewport(new THREE.Vector4()).clone()
      const scissor=gl.getScissor(new THREE.Vector4()).clone()
      const test=gl.getScissorTest()
      const xr=gl.xr.enabled
      const clear=gl.autoClear
      try{
        gl.xr.enabled=false
        gl.autoClear=true
        gl.setRenderTarget(target)
        gl.setViewport(0,0,320,180)
        gl.setScissorTest(false)
        fn()
      } finally {
        gl.setRenderTarget(oldTarget)
        gl.setViewport(viewport)
        gl.setScissor(scissor)
        gl.setScissorTest(test)
        gl.xr.enabled=xr
        gl.autoClear=clear
      }
    }
    const cancelled=()=>disposed||useStore.getState().phase!=='intro'
    const healthyPaint=async()=>{
      let previous=0,consecutive=0
      const started=performance.now()
      while(!cancelled()){
        const t=await new Promise<number>(resolve=>requestAnimationFrame(resolve))
        const dt=previous?t-previous:0
        previous=t
        await new Promise<void>(resolve=>window.setTimeout(resolve,0))
        if(cancelled())return false
        const pending=(navigator as Navigator & {
          scheduling?:{isInputPending?:()=>boolean}
        }).scheduling?.isInputPending?.()??false
        const healthy=document.visibilityState==='visible'&&!pending&&dt>0&&dt<100
        consecutive=healthy?consecutive+1:0
        if(consecutive>=2){
          info.longestInputWaitMs=Math.max(info.longestInputWaitMs,
            Math.round(performance.now()-started))
          return true
        }
        if(performance.now()-started>3500)return false
      }
      return false
    }
    const makeCamera=(descent:boolean)=>{
      const cam=new THREE.PerspectiveCamera(72,320/180,.1,9000)
      if(descent){
        cam.position.set(SPAWN.x,24,SPAWN.z+34)
        cam.lookAt(0,4,0)
      }else{
        cam.position.copy(player.pos)
        cam.position.y=EYE
        cam.rotation.set(player.pitch,player.yaw,0,'YXZ')
      }
      cam.updateMatrixWorld(true)
      return cam
    }
    const work=async()=>{
      try{
        info.status='waiting-for-healthy-frame'
        if(!await healthyPaint()){info.status='skipped-busy-or-entered';return}
        const ctx=gl.getContext()
        const dbg=ctx.getExtension('WEBGL_debug_renderer_info')
        info.renderer=String(ctx.getParameter(dbg?.UNMASKED_RENDERER_WEBGL??ctx.RENDERER))
        // An already overloaded software renderer should not have more
        // first-visit work piled onto it. It remains fully functional.
        if(/SwiftShader|Software|llvmpipe/i.test(info.renderer)){
          info.status='skipped-software-renderer'
          return
        }
        const cameras=[makeCamera(true),makeCamera(false)]
        info.status='compiling-close-view'
        await gl.compileAsync(scene,cameras[1])
        info.compiled=true
        for(const camera of cameras){
          info.status=info.passes===0?'preparing-descent':'preparing-spawn'
          if(!await healthyPaint()){info.status='skipped-busy-or-entered';return}
          const start=performance.now()
          withTarget(()=>{gl.clear(true,true,false);gl.render(scene,camera)})
          info.passes++
          info.maxCpuDrawMs=Math.max(info.maxCpuDrawMs,Math.round(performance.now()-start))
        }
        if(cancelled()){info.status='skipped-entered';return}
        // Async readback of the final privately rendered frame proves that
        // previous geometry/shadow commands were GPU-scheduled and completed.
        if(typeof gl.readRenderTargetPixelsAsync==='function'){
          info.status='gpu-pending'
          let fence:Promise<unknown>=Promise.resolve()
          withTarget(()=>{fence=gl.readRenderTargetPixelsAsync(target,0,0,1,1,new Uint8Array(4))})
          await fence
          info.gpuSynced=true
          info.status='ready'
        }else{
          gl.getContext().flush()
          info.status='submitted-no-fence'
        }
      }catch(e){
        info.error=String(e)
        info.status='failed'
        console.warn('[ORBITA] first-landing GPU preflight failed; original scene intact',e)
      }finally{
        target.dispose()
      }
    }
    timer=window.setTimeout(()=>{void work()},0)
    return()=>{
      disposed=true
      clearTimeout(timer)
      if(info.status!=='ready'&&info.status!=='failed')info.status='cancelled'
      target.dispose()
    }
  },[gl,scene])
  return null
}

/**
 * Real island readiness: only after Suspense resolved and the renderer has
 * submitted actual scene frames, not after a timer or a synthetic percentage.
 * This is intentionally independent of optional HEX/robot shader prewarm.
 */
function IslandFirstPaintGate() {
  const { gl } = useThree()
  const done = useRef(false)
  const goodFrames = useRef(0)
  useFrame(() => {
    if (done.current) return
    const ctx=gl.getContext()
    const rendered=gl.info.render.frame
    const connected=gl.domElement.isConnected
    const valid=connected && gl.domElement.width>0 &&
      gl.domElement.height>0 && !ctx.isContextLost() && rendered>=2 &&
      (gl.info.programs?.length??0)>0
    goodFrames.current=valid?goodFrames.current+1:0
    const diag=window as unknown as {__orbitaIslandFirstPaint?:unknown}
    diag.__orbitaIslandFirstPaint={
      status:valid?'confirming-render':'rendering',
      frames:rendered,
      goodFrames:goodFrames.current,
      shaderPrograms:gl.info.programs?.length??0,
    }
    if(goodFrames.current<2)return
    done.current=true
    diag.__orbitaIslandFirstPaint={
      status:'ready',frames:rendered,
      shaderPrograms:gl.info.programs?.length??0,
    }
    useStore.getState().setReady()
  })
  return null
}

function HighGateMeter() {
  useFrame((state, delta) => {
    highGuard.record(delta, useStore.getState().quality, state.gl)
  })
  return null
}

export function Experience() {
  const quality = useStore((s) => s.quality)
  const phase = useStore((s) => s.phase)
  const panelOpen = useStore((s) => Boolean(s.panel))
  const low = quality === 'low'
  // DIAGNOSTIC ONLY: compare first-laser GPU scheduling with/without the
  // composer. Normal portfolio path always retains Bloom/AA/tonemapping.
  const postProbeOff = typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('colossusPostProbe') === 'off'

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyQ' || e.repeat || useStore.getState().phase !== 'playing') return
      if (useStore.getState().quality === 'high') {
        highGuard.resetToLow()
        useStore.getState().setQuality('low')
        toast('Chất lượng: THẤP')
        return
      }
      const verdict = highGuard.tryEnable()
      if (verdict.ok) {
        useStore.getState().setQuality('high')
        toast('Chất lượng: CAO — đã vượt qua kiểm tra GPU')
      } else if (verdict.reason) {
        // A rejected machine never enters High. Repeated Q is ignored.
        toast(verdict.reason, 3200)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <Canvas
      // The entire island Canvas is hidden beneath the opaque spacecraft in
      // intro. Keep its real scene, shaders, lighting and preflight active but
      // rasterize that unseen surface at 0.5 DPR (one quarter the pixels).
      // Restore the EXACT original visible DPR on 'playing' before descent.
      // This cuts concurrent WebGL pressure without simplifying a single
      // UEH/HEX mesh or reducing the game's 2048px shadow map.
      // While a dossier is open the island is fully covered by the dossier
      // itself, so its pixels are invisible. Render the covered surface at a
      // quarter resolution — the real exhibit behind it keeps every mesh,
      // shader, light and its full 2048px shadow map, and the exact visible
      // resolution returns the moment the dossier closes. This is the same
      // "invisible pixels cost less" rule already used under the spacecraft,
      // not a reduction of the world a visitor actually sees.
      dpr={phase === 'intro' || panelOpen ? 0.5 : low ? 1 : [1, 1.6]}
      shadows="percentage"
      camera={{ fov: 72, near: 0.1, far: 9000, position: [0, 17, 88] }}
      gl={{ antialias: false, powerPreference: 'high-performance', toneMapping: THREE.NoToneMapping, stencil: false }}
    >
      <HighGateMeter />
      <Suspense fallback={null}>
        <Sky />
        <Lights />
        <LandingGpuPreflight />
        <Phenomena />
        <Platform />
        <Exhibits />
        <Player />
        <RealityHost />
        {!postProbeOff && <Post low={low} />}
        <IslandFirstPaintGate />
      </Suspense>
    </Canvas>
  )
}
