import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
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
import { perfLadder, RUNG_CONCESSIONS, type PerfRung } from '../perfLadder'
import { DomOcclusion } from './domOcclusion'
import { RealityHost } from '../reality/RealityHost'
import { PANELS, type PanelContent, type PanelId } from '../content'
import { closePanel } from './Player'
import { Hit } from './Hit'
import { openExternal, NGAY_MAI_CUE, NGAY_MAI_VIDEO_ID, HEX_MAIN_STAGE_VIDEO_SRC } from '../layout'
import { loadYouTubeAPI, type YTPlayer } from '../stage/showState'
import { useReality } from '../reality/state'
import { music } from '../reality/music'
import { CanvasTexture } from 'three'
import { FONT } from '../gfx'
import { EXHIBITS } from '../layout'

function Lights({ shadowEdge = 2048 }: { shadowEdge?: 2048 | 1024 }) {
  const light = useRef<THREE.DirectionalLight>(null)
  const target = useMemo(() => new THREE.Object3D(), [])
  useEffect(() => {
    const l = light.current
    if (!l || l.shadow.mapSize.x === shadowEdge) return
    l.shadow.mapSize.set(shadowEdge, shadowEdge)
    l.shadow.map?.dispose()
    l.shadow.map = null
  }, [shadowEdge])
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

function Post({ low, filmPasses = true, bloomLevels }: { low: boolean; filmPasses?: boolean; bloomLevels?: number }) {
  const ca = useMemo(() => new THREE.Vector2(0.0007, 0.0009), [])
  return (
    <EffectComposer multisampling={low ? 0 : 4} enableNormalPass={false}>
      <Bloom intensity={low ? 0.9 : 1.25} luminanceThreshold={0.82} luminanceSmoothing={0.25} mipmapBlur radius={0.78} levels={bloomLevels ?? (low ? 5 : 8)} />
      <ChromaticAberration offset={ca} radialModulation modulationOffset={0.35} blendFunction={low ? BlendFunction.SKIP : BlendFunction.NORMAL} />
      {filmPasses && <Noise opacity={0.035} blendFunction={BlendFunction.SOFT_LIGHT} />}
      {filmPasses && <Vignette offset={0.25} darkness={0.55} />}
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

function PerfTierMeter() {
  useFrame((_, delta) => perfLadder.record(delta))
  return null
}

function HighGateMeter() {
  useFrame((state, delta) => {
    highGuard.record(delta, useStore.getState().quality, state.gl)
  })
  return null
}


// ===========================================================================
// Nội dung gộp từ scene/FloatingPanel.tsx và stage/VideoSurface.tsx.
//
// Cả hai nằm trong module này thay vì file riêng vì một lý do hạ tầng, không
// phải thẩm mỹ: bản standalone ở gốc repo chạy bằng import map nhúng với BỘ
// MODULE CỐ ĐỊNH (64 slot). Một file mới không có slot thì vite build được mà
// publish thì không — `sync-standalone-from-source.mjs` ném
// "missing embedded module". Thêm slot là thay đổi hạ tầng publish; gộp vào
// module đã có slot là thay đổi cục bộ.
// ===========================================================================
/**
 * A panel that floats in the world instead of covering it.
 *
 * The island already had one of these — the Main Stage's `InfoVeil` — and it is
 * the reference for this file: a plane a few metres in front of the visitor,
 * revealed by a shader wipe, no backdrop, the scene still visible behind and
 * around it. What it did NOT have was the rest: every exhibit's panel was a
 * full-height DOM card at `z-40` that took the whole viewport, dimmed nothing,
 * but blocked the canvas underneath and stopped the visitor moving.
 *
 * WHY A CANVAS TEXTURE AND NOT A DOM CARD MOVED INTO 3D
 *
 * The island is a walk-around scene: the thing that makes a panel feel present
 * is that it lives at a point in space, gets occluded, is readable from an
 * angle, and does not follow the camera. A DOM element can only do that if it is
 * reprojected every frame through a CSS homography, and then it inherits the
 * compositing cost the stage's video already pays for — plus it cannot be
 * occluded by a 3D object.
 *
 * The text is drawn once per open into a 1024-px canvas and uploaded once. That
 * is one draw call and one texture for the whole card, and because it is a real
 * mesh it sits in the scene graph like everything else.
 *
 * Layout is deliberately conservative: the shipped build carries a pre-built
 * Tailwind subset and the DOM fallback is still there, so nothing here depends
 * on a utility class existing.
 */

const PANEL_W = 1024
const PANEL_H = 1280
/** world size: 1.55 m wide reads comfortably at 2.4 m from the eye */
const WORLD_W = 1.55
const WORLD_H = (WORLD_W * PANEL_H) / PANEL_W
const DISTANCE = 2.4

function drawPanel(ctx: CanvasRenderingContext2D, p: PanelContent, w: number, h: number) {
  ctx.clearRect(0, 0, w, h)
  // Glass, not a card: the fill fades out at every edge so the panel has no
  // hard rectangle against the sky. This is why the stage's veil reads as
  // "floating" and a bordered div never does.
  const edge = ctx.createLinearGradient(0, 0, w, 0)
  edge.addColorStop(0, 'rgba(6,9,20,0)')
  edge.addColorStop(0.07, 'rgba(6,9,20,0.78)')
  edge.addColorStop(0.93, 'rgba(6,9,20,0.78)')
  edge.addColorStop(1, 'rgba(6,9,20,0)')
  // Alpha mask built as its own gradient. The stops must go from transparent to
  // OPAQUE to transparent: `destination-in` multiplies the canvas alpha by the
  // source alpha, so an alpha-0 stop at the top erases the whole panel there.
  // (An earlier version of this drew the vertical fade as a combined alpha+colour
  // gradient with OPAQUE stops at 5% and 95%, which is why only the top of the
  // card survived in the first render.)
  ctx.fillStyle = edge
  ctx.fillRect(0, 0, w, h)
  const fade = ctx.createLinearGradient(0, 0, 0, h)
  fade.addColorStop(0, 'rgba(0,0,0,0)')
  fade.addColorStop(0.045, 'rgba(0,0,0,1)')
  fade.addColorStop(0.955, 'rgba(0,0,0,1)')
  fade.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.globalCompositeOperation = 'destination-in'
  ctx.fillStyle = fade
  ctx.fillRect(0, 0, w, h)
  ctx.globalCompositeOperation = 'source-over'

  const L = 78
  const R = w - 78
  const A = p.accent

  // accent bar + kicker
  ctx.fillStyle = A
  ctx.fillRect(L - 26, 84, 4, 132)
  ctx.font = `700 21px ${FONT}`
  ctx.textAlign = 'left'
  ctx.fillStyle = A
  ctx.fillText(p.kicker, L, 104)

  // title (wrapped, 2 lines max)
  ctx.fillStyle = '#fff'
  ctx.font = `800 70px ${FONT}`
  ctx.shadowColor = A
  ctx.shadowBlur = 26
  const title = p.title
  const words = title.split(' ')
  let line = ''
  const lines: string[] = []
  for (const wd of words) {
    const test = line ? line + ' ' + wd : wd
    if (ctx.measureText(test).width > R - L && line) {
      lines.push(line)
      line = wd
    } else line = test
  }
  if (line) lines.push(line)
  lines.slice(0, 2).forEach((t, i) => ctx.fillText(t, L, 196 + i * 76))
  ctx.shadowBlur = 0

  // subtitle
  ctx.font = `500 27px ${FONT}`
  ctx.fillStyle = 'rgba(255,255,255,0.82)'
  let y = 196 + lines.slice(0, 2).length * 76 + 34
  y = wrap(ctx, p.subtitle, L, y, R - L, 36)

  // body
  ctx.font = `400 23px ${FONT}`
  ctx.fillStyle = 'rgba(255,255,255,0.62)'
  y += 12
  for (const b of p.body) y = wrap(ctx, b, L, y, R - L, 31) + 10

  // stats
  y += 4
  const colW = (R - L - 24) / 3
  p.stats.forEach((s, i) => {
    ctx.fillStyle = A
    ctx.font = `800 46px ${FONT}`
    ctx.fillText(s.v, L + i * (colW + 12), y + 44)
    ctx.fillStyle = 'rgba(255,255,255,0.45)'
    ctx.font = `600 16px ${FONT}`
    wrap(ctx, s.k.toUpperCase(), L + i * (colW + 12), y + 74, colW, 20)
  })
  y += 116

  // items
  ctx.fillStyle = 'rgba(255,255,255,0.34)'
  ctx.font = `700 16px ${FONT}`
  ctx.fillText(p.id === 'beacon' ? 'KÊNH LIÊN HỆ' : 'DỰ ÁN & NĂNG LỰC', L, y)
  y += 22
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'
  ctx.lineWidth = 2
  // Row height is MEASURED, not assumed. A fixed 96 px row overlapped the moment
  // a name wrapped or a description ran to two lines, and the collision showed
  // up on three of the four panels in the first render.
  for (let i = 0; i < p.items.length; i++) {
    const it = p.items[i]
    ctx.beginPath()
    ctx.moveTo(L, y)
    ctx.lineTo(R, y)
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,0.28)'
    ctx.font = `700 18px ${FONT}`
    ctx.fillText(String(i + 1).padStart(2, '0'), L, y + 34)
    ctx.fillStyle = '#fff'
    ctx.font = `600 25px ${FONT}`
    const afterName = wrap(ctx, it.name, L + 48, y + 36, R - L - 48, 30)
    ctx.fillStyle = A
    ctx.font = `700 15px ${FONT}`
    ctx.fillText(it.meta.toUpperCase(), L + 48, afterName + 12)
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.font = `400 20px ${FONT}`
    const afterDesc = wrap(ctx, it.desc, L + 48, afterName + 40, R - L - 48, 26)
    y = Math.max(y + 88, afterDesc + 12)
  }
  ctx.beginPath()
  ctx.moveTo(L, y)
  ctx.lineTo(R, y)
  ctx.stroke()

  // tags
  y += 30
  ctx.font = `600 17px ${FONT}`
  let tx = L
  for (const t of p.tags) {
    const tw = ctx.measureText(t).width + 30
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'
    ctx.beginPath()
    ctx.roundRect(tx, y, tw, 34, 17)
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.fillText(t, tx + 15, y + 23)
    tx += tw + 10
    if (tx > R - 80) {
      tx = L
      y += 44
    }
  }

  // footer hint — drawn only when it cannot collide with the last row
  if (h - 54 > y + 26) {
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.font = `600 18px ${FONT}`
    ctx.textAlign = 'center'
    ctx.fillText('ESC  ·  hoặc nhìn ra ngoài tấm bảng để đóng', w / 2, h - 40)
    ctx.textAlign = 'left'
  }
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number) {
  const words = text.split(' ')
  let line = ''
  for (const wd of words) {
    const test = line ? line + ' ' + wd : wd
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y)
      y += lh
      line = wd
    } else line = test
  }
  if (line) {
    ctx.fillText(line, x, y)
    y += lh
  }
  return y
}

export function FloatingPanel({ canvas, tex }: { canvas: HTMLCanvasElement; tex: THREE.CanvasTexture }) {
  const id = useStore((s) => s.panel)
  const { camera } = useThree()
  const group = useRef<THREE.Group>(null)
  const reveal = useRef(0)
  const anchor = useRef({ pos: new THREE.Vector3(), rotY: 0 })
  const ctx = useMemo(() => canvas.getContext('2d')!, [canvas])

  const panel: PanelContent | null = id ? PANELS[id as PanelId] : null
  const url = panel?.action?.url

  useEffect(() => {
    if (!panel) return
    drawPanel(ctx, panel, PANEL_W, PANEL_H)
    tex.needsUpdate = true
    // Anchor the card where the visitor is standing *now* and stop following
    // them. A panel that tracks the camera never feels like an object.
    const dir = new THREE.Vector3()
    camera.getWorldDirection(dir)
    dir.y = 0
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1)
    dir.normalize()
    const foot = new THREE.Vector3(camera.position.x, 0, camera.position.z)
    const centre = foot.clone().addScaledVector(dir, DISTANCE)
    anchor.current.pos.set(centre.x, camera.position.y + 0.12 - WORLD_H * 0.06, centre.z)
    anchor.current.rotY = Math.atan2(dir.x, dir.z) + Math.PI
    if (group.current) {
      group.current.position.copy(anchor.current.pos)
      group.current.rotation.set(0, anchor.current.rotY, 0)
    }
  }, [panel, camera, ctx, tex])

  useFrame((state, dt) => {
    const want = panel ? 1 : 0
    reveal.current = THREE.MathUtils.damp(reveal.current, want, panel ? 9 : 14, dt)
    const g = group.current
    if (!g) return
    const r = reveal.current
    g.visible = r > 0.004
    if (!g.visible) return
    // scale-in + a slow breathing drift; both very small, so the card reads as
    // hovering rather than as an animation
    const s = 0.86 + r * 0.14
    g.scale.setScalar(s)
    g.position.y = anchor.current.pos.y + Math.sin(state.clock.elapsedTime * 0.7) * 0.012
  })

  if (!panel) return null
  return (
    <group ref={group} position={anchor.current.pos} rotation={[0, anchor.current.rotY, 0]} visible={false}>
      <mesh renderOrder={18}>
        <planeGeometry args={[WORLD_W, WORLD_H]} />
        <meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      {url && (
        <Hit
          id={`panel-action-${panel.id}`}
          label="MỞ LIÊN KẾT"
          hint="Mở trong tab mới"
          maxDist={4}
          size={[WORLD_W * 0.8, 0.16, 0.06]}
          position={[0, -WORLD_H * 0.36, 0.02]}
          onClick={() => openExternal(url)}
        />
      )}
      <Hit
        id={`panel-close-${panel.id}`}
        label="ĐÓNG"
        hint="Đóng bảng"
        maxDist={4}
        size={[WORLD_W, WORLD_H * 0.12, 0.06]}
        position={[0, -WORLD_H * 0.46, 0.02]}
        onClick={() => closePanel(true)}
      />
      {/* The card body swallows clicks. Without this, a click anywhere on the
          text would fall through to the dismiss target behind it and close the
          panel the visitor was reading. */}
      <Hit
        id={`panel-body-${panel.id}`}
        label={panel.title}
        hint=""
        maxDist={5}
        size={[WORLD_W, WORLD_H, 0.04]}
        position={[0, 0, 0.01]}
        onClick={() => undefined}
      />
      {/* Clicking beside the card still closes it — the same recovery path the
          DOM backdrop provided, now a real 3D target that sits behind the card. */}
      <Hit
        id={`panel-dismiss-${panel.id}`}
        label="Đóng bảng"
        hint="Nhìn ra ngoài tấm bảng để đóng"
        maxDist={6}
        size={[WORLD_W * 2.6, WORLD_H * 2.2, 0.05]}
        position={[0, 0, -0.08]}
        onClick={() => closePanel(true)}
      />
    </group>
  )
}

/**
 * One video surface, for the island stage and for the HEX campus stage.
 *
 * WHY THIS IS ONE COMPONENT AND NOT TWO
 *
 * The island stage already renders a YouTube IFrame Player onto its LED wall by
 * projecting a DOM layer through a CSS homography — that is the only permitted
 * way to show a YouTube stream (their terms and CORS both rule out sampling it
 * into a texture). The HEX campus stage needs the owner's video on its backdrop
 * screen, and it needs it to behave like the *song's* screen, not the island's.
 *
 * Building a second player would have been the bug the owner warned about: two
 * YouTube players alive at once, one belonging to a stage that is no longer on
 * screen. So there is exactly one mounted player at a time, chosen by a single
 * source of truth, and its whole lifetime is owned by `useVideoSurface`:
 *
 *   · island stage  → show.clip.yt      (existing behaviour, unchanged)
 *   · HEX reality   → NGAY_MAI_VIDEO_ID (only while the reality is open)
 *   · nothing       → the player is destroyed and the iframe removed
 *
 * The last case is the important one. When HEX retracts, the campus screen must
 * go back to being a procedural backdrop, and no iframe may be left floating
 * over a stage the visitor has left. `active` is derived from the reality phase
 * every frame, so a retract cannot be missed.
 */

/** Where the HEX campus stage screen is, in island world space. */
const HEX_STAGE = EXHIBITS.stage
const HEX_SCREEN_LOCAL: [number, number, number] = [0, 4.4, -3.52]
const HEX_SCREEN_W = 9.6
const HEX_SCREEN_H = 5.4

export type VideoSurfaceHost = 'stage' | 'hex'

export function useVideoSurface(host: VideoSurfaceHost, hostEl: HTMLElement | null) {
  const phase = useReality((s) => s.phase)
  const track = useReality((s) => s.track)
  const [state, setState] = useState<'off' | 'loading' | 'playing' | 'blocked' | 'error'>('off')
  const player = useRef<YTPlayer | null>(null)
  const token = useRef(0)

  // The id this surface should be showing right now, or null.
  const videoId = useMemo(() => {
    if (host === 'stage') return null // the island stage keeps its own clip logic
    if (phase !== 'ignite' && phase !== 'sweep' && phase !== 'active') return null
    return track === 'ngay-mai' ? NGAY_MAI_VIDEO_ID : null
  }, [host, phase, track])

  const startAt = host === 'hex' ? NGAY_MAI_CUE : 0
  const muted = useStore((s) => s.muted)

  useEffect(() => {
    if (!hostEl || !videoId) return
    const mine = ++token.current
    let cancelled = false
    setState('loading')
    const el = document.createElement('div')
    hostEl.appendChild(el)
    loadYouTubeAPI()
      .then((YT) => {
        if (cancelled || mine !== token.current) return
        player.current = new YT.Player(el, {
          width: 1280,
          height: 720,
          videoId,
          host: 'https://www.youtube-nocookie.com',
          playerVars: {
            autoplay: 1,
            controls: 1,
            rel: 0,
            playsinline: 1,
            start: startAt,
            iv_load_policy: 3,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            origin: location.origin,
          },
          events: {
            onReady: (e: { target: YTPlayer }) => {
              if (cancelled || mine !== token.current) return
              // The official video is the only audio source for this song.
              if (useStore.getState().muted) e.target.mute()
              else { e.target.unMute(); e.target.setVolume(85) }
              e.target.playVideo()
            },
            onStateChange: (e: { data: number }) => {
              if (cancelled || mine !== token.current) return
              if (e.data === 1) setState('playing')
              else if (e.data === 2) setState('blocked')
              else if (e.data === 0) {
                music.ended = true
              }
            },
            onAutoplayBlocked: () => !cancelled && mine === token.current && setState('blocked'),
            onError: () => !cancelled && mine === token.current && setState('error'),
          },
        })
      })
      .catch(() => !cancelled && mine === token.current && setState('error'))
    return () => {
      cancelled = true
      token.current++
      try {
        player.current?.destroy()
      } catch {
        /* noop */
      }
      player.current = null
      el.remove()
      setState('off')
    }
  }, [hostEl, videoId, startAt])

  useEffect(() => {
    try { if (muted) player.current?.mute(); else player.current?.unMute() } catch { /* player may be loading */ }
  }, [muted])

  // Leaving HEX must stop the audio-less player immediately, not on the next
  // rebuild of the effect.
  useEffect(() => {
    if (videoId) return
    try {
      player.current?.destroy()
    } catch {
      /* noop */
    }
    player.current = null
  }, [videoId])

  return { state, videoId, resume: () => {
    try {
      if (!useStore.getState().muted) player.current?.unMute()
      player.current?.playVideo()
    } catch { setState('error') }
  } }
}

/**
 * The owner's HEX video link.
 *
 * A Drive URL is a viewer page, not a media file, so it cannot feed a
 * VideoTexture. It is offered as an explicit link from the campus stage instead
 * of being silently dropped — the visitor can always reach the real footage.
 */
export function HexStageVideoLink() {
  const phase = useReality((s) => s.phase)
  const track = useReality((s) => s.track)
  const ref = useRef<THREE.Mesh>(null)
  const tex = useMemo(
    () =>
      new CanvasTexture(
        (() => {
          const c = document.createElement('canvas')
          c.width = 512
          c.height = 128
          const g = c.getContext('2d')!
          g.fillStyle = 'rgba(6,10,20,0.82)'
          g.fillRect(0, 0, 512, 128)
          g.strokeStyle = 'rgba(255,255,255,0.35)'
          g.lineWidth = 3
          g.strokeRect(6, 6, 500, 116)
          g.fillStyle = '#fff'
          g.font = '600 30px sans-serif'
          g.textAlign = 'center'
          g.fillText('▶  MỞ VIDEO GỐC', 256, 58)
          g.fillStyle = 'rgba(255,255,255,0.6)'
          g.font = '400 20px sans-serif'
          g.fillText('Drive · phát toàn màn hình', 256, 92)
          return c
        })(),
      ),
    [],
  )
  useEffect(() => () => tex.dispose(), [tex])
  useFrame((s, dt) => {
    const m = ref.current
    if (!m) return
    const want = phase !== 'idle' && track === 'mua-ha' ? 1 : 0
    m.scale.setScalar(THREE.MathUtils.damp(m.scale.x, Math.max(0.001, want), 6, dt))
    m.visible = m.scale.x > 0.01
    if (m.visible) m.position.y = 1.55 + Math.sin(s.clock.elapsedTime * 0.8) * 0.03
  })
  return (
    <mesh
      ref={ref}
      position={[HEX_STAGE.x, 1.55, HEX_STAGE.z]}
      rotation={[0, HEX_STAGE.rotY, 0]}
      onClick={() => openExternal(HEX_MAIN_STAGE_VIDEO_SRC)}
      visible={false}
    >
      <planeGeometry args={[2.4, 0.6]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

/** Release pointer lock deliberately so an embedded player's controls can be
 * operated when the browser blocks autoplay. No persistent DOM overlay. */
function HexPlayerControls() {
  const phase = useReality((s) => s.phase)
  if (phase !== 'sweep' && phase !== 'active') return null
  return <group position={[HEX_STAGE.x, 0, HEX_STAGE.z]} rotation={[0, HEX_STAGE.rotY, 0]}>
    <Hit id="hex-video-controls" label="Điều khiển video" hint="Nhả chuột để bấm phát trên màn hình"
      maxDist={28} size={[3.5, 0.7, 0.4]} position={[0, 1.0, -3.0]}
      onClick={() => {
        useStore.getState().setFree(true)
        if (document.pointerLockElement) document.exitPointerLock()
        toast('Bấm nút phát trên màn hình sân khấu')
      }} />
  </group>
}

/** World-space rectangle of the HEX campus screen, for the DOM projection. */
export function hexScreenCorners(): [number, number, number][] {
  const hw = HEX_SCREEN_W / 2
  const hh = HEX_SCREEN_H / 2
  const [lx, ly, lz] = HEX_SCREEN_LOCAL
  const c = Math.cos(HEX_STAGE.rotY)
  const s = Math.sin(HEX_STAGE.rotY)
  const toWorld = (x: number, y: number, z: number): [number, number, number] => [
    HEX_STAGE.x + (lx + x) * c + (lz + z) * s,
    y,
    HEX_STAGE.z - (lx + x) * s + (lz + z) * c,
  ]
  return [
    toWorld(-hw, ly + hh, 0),
    toWorld(hw, ly + hh, 0),
    toWorld(-hw, ly - hh, 0),
    toWorld(hw, ly - hh, 0),
  ]
}

export { HEX_SCREEN_LOCAL, HEX_SCREEN_H, HEX_SCREEN_W }

/**
 * Projects a YouTube player onto the HEX campus stage screen.
 *
 * The DOM layer is only appended while the reality is open. That single rule is
 * what keeps the two worlds from leaking into each other: the island's LED wall
 * is invisible during HEX, so its player is suspended by its own visibility
 * check; and this layer cannot outlive `phase !== 'idle'`, so closing HEX can
 * never leave a video floating over the campus.
 */
export function HexVideoLayer() {
  const phase = useReality((s) => s.phase)
  const track = useReality((s) => s.track)
  const { gl, camera, scene } = useThree()
  const occlusion = useMemo(() => new DomOcclusion(), [])
  const worldCorners = useMemo(() => Array.from({ length: 4 }, () => new THREE.Vector3()), [])
  const dom = useMemo(() => {
    const d = document.createElement('div')
    Object.assign(d.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      width: '1280px',
      height: '720px',
      transformOrigin: '0 0',
      pointerEvents: 'none',
      mixBlendMode: 'screen',
      opacity: '0',
      visibility: 'hidden',
      background: '#000',
      overflow: 'hidden',
    })
    const h = document.createElement('div')
    Object.assign(h.style, { width: '100%', height: '100%', pointerEvents: 'none', filter: 'saturate(1.08) contrast(1.04)' })
    d.appendChild(h)
    return { d, h }
  }, [])
  // Load the API ahead of the user's sheet click, so playback does not wait
  // for a late script request after the browser's gesture window has expired.
  useEffect(() => { void loadYouTubeAPI().catch(() => {}) }, [])
  const inHex = phase === 'ignite' || phase === 'sweep' || phase === 'active'
  const wanted = inHex && (track === 'ngay-mai' || track === 'mua-ha')
  useEffect(() => {
    const parent = gl.domElement.parentElement
    if (!parent || !wanted) return
    // Controls remain clickable if the browser blocks unmuted autoplay.
    dom.d.style.pointerEvents = 'auto'
    dom.h.style.pointerEvents = 'auto'
    parent.appendChild(dom.d)
    return () => dom.d.remove()
  }, [gl, dom, wanted])
  const yt = useVideoSurface('hex', wanted && track === 'ngay-mai' ? dom.h : null)
  useEffect(() => {
    if (!wanted || track !== 'ngay-mai' || (yt.state !== 'blocked' && yt.state !== 'error')) return
    const button = document.createElement('button')
    button.textContent = yt.state === 'blocked' ? '▶ Phát video và âm thanh' : 'Mở video gốc trên YouTube ↗'
    button.style.cssText = 'position:absolute;left:50%;bottom:24px;transform:translateX(-50%);z-index:5;padding:16px 24px;background:#111;color:white;border:1px solid white;border-radius:8px;pointer-events:auto;cursor:pointer;font:600 24px sans-serif'
    button.onclick = () => yt.state === 'blocked' ? yt.resume() : openExternal('https://youtu.be/179btG24VE8?t=82')
    dom.d.appendChild(button)
    return () => button.remove()
  }, [wanted, track, yt.state, dom])
  // Drive's supported preview is a player, not a CORS-safe VideoTexture.
  // Keep it inside this layer and remove it immediately when HEX closes.
  useEffect(() => {
    if (!wanted || track !== 'mua-ha') return
    const frame = document.createElement('iframe')
    frame.src = 'https://drive.google.com/file/d/1gkTtTvvEgyD7lLRFFc3VhXtq1rF8h1wB/preview?autoplay=1&mute=1'
    frame.title = 'Video sân khấu Mùa Hạ Thứ 18'
    frame.allow = 'autoplay; fullscreen'
    frame.referrerPolicy = 'strict-origin-when-cross-origin'
    frame.style.cssText = 'width:100%;height:100%;border:0;pointer-events:auto'
    dom.d.style.pointerEvents = 'auto'
    dom.h.style.pointerEvents = 'auto'
    dom.h.appendChild(frame)
    return () => { frame.remove(); dom.d.style.pointerEvents = 'none'; dom.h.style.pointerEvents = 'none' }
  }, [wanted, track, dom])

  const corners = useMemo(
    () => [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()],
    [],
  )
  const local = useMemo(() => hexScreenCorners(), [])
  useFrame(() => {
    const w = dom.d
    if (!w.parentElement) return
    const cw = gl.domElement.clientWidth
    const ch = gl.domElement.clientHeight
    const pts: number[] = []
    let behind = false
    for (let i = 0; i < 4; i++) {
      const v = corners[i].set(local[i][0], local[i][1], local[i][2])
      const cam = v.clone().applyMatrix4(camera.matrixWorldInverse).z
      if (cam > -0.2) behind = true
      worldCorners[i].copy(v)
      v.project(camera)
      pts.push(((v.x + 1) / 2) * cw, ((1 - v.y) / 2) * ch)
    }
    const dx = camera.position.x - HEX_STAGE.x
    const dz = camera.position.z - HEX_STAGE.z
    const localZ = dx * Math.sin(HEX_STAGE.rotY) + dz * Math.cos(HEX_STAGE.rotY)
    if (behind || localZ < HEX_SCREEN_LOCAL[2] || Math.hypot(dx, dz) > 85) {
      w.style.visibility = 'hidden'
      w.style.opacity = '0'
      return
    }
    // Build the same homography the island LED uses: map the source 1280x720
    // rectangle onto the four projected corners.
    const [x0, y0, x1, y1, x2, y2, x3, y3] = pts
    const W = 1280
    const H = 720
    const src = [
      [0, 0],
      [W, 0],
      [0, H],
      [W, H],
    ]
    const dst = [
      [x0, y0],
      [x1, y1],
      [x2, y2],
      [x3, y3],
    ]
    const m = homography(src, dst)
    if (!m) {
      w.style.visibility = 'hidden'
      return
    }
    w.style.visibility = 'visible'
    w.style.opacity = '1'
    w.style.transform = `matrix3d(${m.join(',')})`
    occlusion.update(w, camera, scene, worldCorners, performance.now() / 1000)
  })
  return null
}

/** 3x3 projective map from four src points to four dst points (row-major, 8 dof). */
function homography(src: number[][], dst: number[][]): number[] | null {
  const A: number[][] = []
  const b: number[] = []
  for (let i = 0; i < 4; i++) {
    const [u, v] = src[i]
    const [x, y] = dst[i]
    A.push([u, v, 1, 0, 0, 0, -u * x, -v * x])
    b.push(x)
    A.push([0, 0, 0, u, v, 1, -u * y, -v * y])
    b.push(y)
  }
  // Gaussian elimination with partial pivoting.
  const n = 8
  for (let col = 0; col < n; col++) {
    let piv = col
    for (let r = col + 1; r < n; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r
    if (Math.abs(A[piv][col]) < 1e-9) return null
    ;[A[col], A[piv]] = [A[piv], A[col]]
    ;[b[col], b[piv]] = [b[piv], b[col]]
    const d = A[col][col]
    for (let c = col; c < n; c++) A[col][c] /= d
    b[col] /= d
    for (let r = 0; r < n; r++) {
      if (r === col) continue
      const f = A[r][col]
      if (!f) continue
      for (let c = col; c < n; c++) A[r][c] -= f * A[col][c]
      b[r] -= f * b[col]
    }
  }
  const h = b
  // CSS matrix3d is column-major: columns (h11 h21 h31 h41) ...
  return [h[0], h[3], 0, h[6], h[1], h[4], 0, h[7], 0, 0, 1, 0, h[2], h[5], 0, 1]
}

export function Experience() {
  const quality = useStore((s) => s.quality)
  // One panel canvas and one texture for the whole session. Allocating them per
  // open would upload a fresh 1024x1280 texture and drop the old one while the
  // card may still be fading out.
  const panelCanvas = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = PANEL_W
    c.height = PANEL_H
    return c
  }, [])
  const panelTex = useMemo(() => {
    const t = new CanvasTexture(panelCanvas)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    return t
  }, [panelCanvas])
  useEffect(() => () => panelTex.dispose(), [panelTex])
  const phase = useStore((s) => s.phase)
  const low = quality !== 'high'
  const performanceMode = quality === 'performance'
  const rung: PerfRung = useSyncExternalStore(
    performanceMode ? perfLadder.subscribe.bind(perfLadder) : () => () => {},
    () => performanceMode ? perfLadder.rung : 0,
    () => 0,
  )
  const concessions = RUNG_CONCESSIONS[performanceMode ? rung : 0]
  useEffect(() => { if (!performanceMode) perfLadder.reset() }, [performanceMode])
  // DIAGNOSTIC ONLY: compare first-laser GPU scheduling with/without the
  // composer. Normal portfolio path always retains Bloom/AA/tonemapping.
  const postProbeOff = typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('colossusPostProbe') === 'off'

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.code !== 'KeyQ' && e.code !== 'KeyH') || e.repeat || useStore.getState().phase !== 'playing') return
      if (e.code === 'KeyH') {
        const verdict = highGuard.tryEnable()
        if (verdict.ok) { useStore.getState().setQuality('high'); toast('Chất lượng: HIGH') }
        else if (verdict.reason) toast(verdict.reason, 3200)
        return
      }
      const current = useStore.getState().quality
      if (current === 'low') {
        const verdict = highGuard.tryEnable()
        if (verdict.ok) {
          useStore.getState().setQuality('high')
          toast('Chất lượng: HIGH')
        } else {
          perfLadder.reset()
          useStore.getState().setQuality('performance')
          toast(verdict.reason ? `${verdict.reason} Chuyển sang PERFORMANCE.` : 'Chất lượng: PERFORMANCE — tự đo', 3600)
        }
      } else if (current === 'high') {
        perfLadder.reset()
        useStore.getState().setQuality('performance')
        toast('Chất lượng: PERFORMANCE — tự đo')
      } else {
        highGuard.resetToLow()
        useStore.getState().setQuality('low')
        toast('Chất lượng: LOW')
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
      dpr={phase === 'intro' ? 0.5 : low ? concessions.renderScale : [1, 1.6]}
      shadows="percentage"
      camera={{ fov: 72, near: 0.1, far: 9000, position: [0, 17, 88] }}
      gl={{ antialias: false, powerPreference: 'high-performance', toneMapping: THREE.NoToneMapping, stencil: false }}
    >
      <HighGateMeter />
      {performanceMode && <PerfTierMeter />}
      <Suspense fallback={null}>
        <Sky />
        <Lights shadowEdge={concessions.shadowMapSize} />
        <LandingGpuPreflight />
        <Phenomena />
        <Platform />
        <Exhibits />
        <Player />
        <RealityHost />
        <FloatingPanel canvas={panelCanvas} tex={panelTex} />
        <HexVideoLayer />
        <HexStageVideoLink />
        <HexPlayerControls />
        {!postProbeOff && <Post low={low} filmPasses={!concessions.dropFilmPasses} bloomLevels={performanceMode ? concessions.bloomLevels : undefined} />}
        <IslandFirstPaintGate />
      </Suspense>
    </Canvas>
  )
}
