import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Sparkles } from '@react-three/drei'
import * as THREE from 'three'
import { EXHIBITS } from '../layout'
import { audio, type Bus } from '../audio'
import { toast } from '../store'
import { openPanel } from './Player'
import { FONT, beamGeometry, beamMaterial, canvasTex, rbox, roundRect } from '../gfx'
import { Hit } from './Hit'
import { Label } from './Label'
import { PadRing, isFacing, mats, useWorldColliders, worldPos } from './common'

const ex = EXHIBITS.products
const TW = 360
const TH = 740
const R = 4.7
const APPS = [
  { name:'EventFlow Pro',sub:'Event agency workspace',color:'#ff4fd8',tag:'TESTED DEMO',
    headline:'EVENT PRODUCTION',
    facts:['Client brief → scope','Production needs → BOQ','Quotation → PDF proposal'] },
  { name:'MathPath',sub:'Learning platform',color:'#38d9ff',tag:'WEB PROJECT',
    headline:'LEARNING SYSTEMS',
    facts:['Living Board','Skill maps & practice','Progress tracking'] },
  { name:'ORBITA',sub:'Interactive 3D portfolio',color:'#5dffb0',tag:'LIVE EXPERIENCE',
    headline:'CREATIVE WEBGL',
    facts:['Ship-first onboarding','3D exhibition & HUD','Interactive dossiers'] },
  { name:'Alphabet Engine',sub:'Systemic word combat',color:'#ffc23d',tag:'GAME PROTOTYPE',
    headline:'GAME SYSTEMS',
    facts:['Letters → words','Words → weapons','Systemic roguelite'] },
  { name:'APEX CHAOS',sub:'Browser arena game',color:'#9a6bff',tag:'GAME PROJECT',
    headline:'BROWSER GAME',
    facts:['Game engine','Characters & combat','Play and source evidence'] },
]

// The five existing physical holographic screens display VERIFIED project
// identity cards. These are explicitly NOT fake screenshots or fake metrics.
// Geometry, placement, illumination and on-scene motion remain unchanged.
function drawApp(ctx: CanvasRenderingContext2D, i: number, t: number) {
  const app = APPS[i]
  const W = TW, H = TH
  ctx.globalCompositeOperation = 'source-over'
  ctx.shadowBlur = 0
  const bg = ctx.createLinearGradient(0,0,W,H)
  bg.addColorStop(0,'#0e1831')
  bg.addColorStop(0.52,'#070d19')
  bg.addColorStop(1,'#03070e')
  ctx.fillStyle=bg
  ctx.fillRect(0,0,W,H)
  // Precise but inexpensive hologram grid; no synthetic business numbers.
  ctx.lineWidth=1
  for(let x=0;x<W;x+=30){
    ctx.strokeStyle='rgba(255,255,255,0.045)'
    ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()
  }
  for(let y=0;y<H;y+=30){
    ctx.strokeStyle='rgba(255,255,255,0.045)'
    ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()
  }
  const cx=W*0.5
  const pulse=0.65+0.35*Math.sin(t*1.3+i*0.85)
  const glow=ctx.createRadialGradient(cx,260,10,cx,260,230)
  glow.addColorStop(0,app.color+'58')
  glow.addColorStop(1,'rgba(0,0,0,0)')
  ctx.fillStyle=glow
  ctx.fillRect(0,0,W,H)
  ctx.fillStyle=app.color
  ctx.fillRect(25,23,4,31)
  ctx.textAlign='left'
  ctx.font='700 12px '+FONT
  ctx.fillText('LÊ QUỐC KHÁNH  /  PROJECT FILE',39,35)
  ctx.fillStyle='rgba(255,255,255,0.38)'
  ctx.fillText(String(i+1).padStart(2,'0')+'/05',305,35)
  ctx.fillStyle='rgba(255,255,255,0.68)'
  ctx.font='600 12px '+FONT
  ctx.fillText(app.tag,27,99)
  ctx.fillStyle='#fff'
  const names=app.name.split(' ')
  const titleSize=app.name.length>12?31:38
  ctx.font='800 '+titleSize+'px '+FONT
  if(app.name.length>14&&names.length>1){
    const mid=Math.ceil(names.length/2)
    ctx.fillText(names.slice(0,mid).join(' '),26,149)
    ctx.fillText(names.slice(mid).join(' '),26,187)
  }else ctx.fillText(app.name,26,159)
  ctx.fillStyle='rgba(255,255,255,0.63)'
  ctx.font='500 15px '+FONT
  ctx.fillText(app.sub,27,216)
  // Signature animated core with original phone palette; no business KPI.
  ctx.save()
  ctx.translate(cx,330)
  for(let n=0;n<4;n++){
    const radius=75+n*22
    ctx.strokeStyle=app.color+['aa','75','50','35'][n]
    ctx.lineWidth=n?1.5:3
    ctx.beginPath()
    ctx.ellipse(0,0,radius,radius*.61,Math.sin(t*.2+n)*.15,0,Math.PI*2)
    ctx.stroke()
  }
  for(let n=0;n<12;n++){
    const ang=n*Math.PI/6+t*.12
    const radius=102+Math.sin(t*.8+n)*3
    ctx.fillStyle=n%3===0?'#fff':app.color
    ctx.globalAlpha=.4+.6*pulse
    ctx.beginPath();ctx.arc(Math.cos(ang)*radius,Math.sin(ang)*radius*.62,2.4,0,Math.PI*2);ctx.fill()
  }
  ctx.globalAlpha=1
  ctx.fillStyle=app.color
  ctx.font='800 14px '+FONT
  ctx.textAlign='center'
  ctx.fillText(app.headline,cx,335)
  ctx.restore()
  ctx.fillStyle='rgba(255,255,255,0.18)'
  ctx.fillRect(27,467,W-54,1)
  ctx.textAlign='left'
  ctx.fillStyle='rgba(255,255,255,0.5)'
  ctx.font='700 13px '+FONT
  ctx.fillText('VERIFIED SOURCE · KEY FEATURES',28,493)
  app.facts.forEach((line,k)=>{
    const y=513+k*51
    ctx.fillStyle='rgba(255,255,255,0.055)'
    roundRect(ctx,25,y,W-50,42,10);ctx.fill()
    ctx.fillStyle=app.color
    ctx.fillRect(38,y+11,3,20)
    ctx.fillStyle='rgba(255,255,255,0.87)'
    ctx.font='600 14px '+FONT
    ctx.fillText(line,51,y+26)
  })
  ctx.fillStyle=app.color
  ctx.globalAlpha=.75+.25*pulse
  roundRect(ctx,26,686,W-52,32,16);ctx.fill()
  ctx.globalAlpha=1
  ctx.textAlign='center'
  ctx.fillStyle='#06101c'
  ctx.font='800 12px '+FONT
  ctx.fillText('CLICK  /  OPEN PROJECT DOSSIER',cx,707)
}

export function Products() {
  const busRef = useRef<Bus | null>(null)
  const ring = useRef<THREE.Group>(null)
  const holo = useRef<THREE.Mesh>(null)
  const holo2 = useRef<THREE.Mesh>(null)
  const rings = [useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null)]
  const phones = useRef<(THREE.Group | null)[]>([])
  const st = useRef({ sel: 0, ringAngle: 0, lastClick: -100, nextAuto: 7, last: [0, 0, 0, 0, 0], init: false }).current
  const texes = useMemo(() => APPS.map(() => canvasTex(TW, TH, () => {})), [])
  const beam = useMemo(() => beamGeometry(5.4, 0.45, 0.45, 20), [])
  const beamMat = useMemo(() => beamMaterial('#5dffb0', 1.1), [])

  useWorldColliders(ex, [{ type: 'circle', x: 0, z: 0, r: 1.7 }])
  useEffect(() => {
    busRef.current = audio.createBus('products', worldPos(ex, 0, 3.5, 0), { ref: 4, rolloff: 1.4, maxDist: 70, reverb: 0.3, gain: 0.8 })
    APPS.forEach((_, i) => {
      drawApp(texes[i].ctx, i, i * 1.3)
      texes[i].tex.needsUpdate = true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const select = (i: number) => {
    st.sel = i
    st.lastClick = performance.now() / 1000
    ;(window as unknown as {__orbitaPanelSelection?:{panel:string;index:number}})
      .__orbitaPanelSelection={panel:'products',index:i}
    openPanel('products')
    toast(`Product Lab · ${APPS[i].name}`)
    if (busRef.current) audio.cubeClick(busRef.current, 1.9)
  }

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    const cam = state.camera.position
    const dx = cam.x - ex.x
    const dz = cam.z - ex.z
    const dist = Math.hypot(dx, dz)
    const now = performance.now() / 1000
    if (now - st.lastClick > 12 && t > st.nextAuto) {
      st.sel = (st.sel + 1) % APPS.length
      st.nextAuto = t + 7
    }
    // xoay vòng sao cho màn hình được chọn hướng về người xem
    const target = Math.atan2(dx, dz) - (st.sel * Math.PI * 2) / APPS.length
    let diff = target - st.ringAngle
    diff = Math.atan2(Math.sin(diff), Math.cos(diff))
    if (!st.init) {
      st.init = true
      st.ringAngle = target
    } else st.ringAngle += diff * (1 - Math.exp(-2.2 * dt))
    if (ring.current) ring.current.rotation.y = st.ringAngle

    phones.current.forEach((g, i) => {
      if (!g) return
      const selected = i === st.sel
      const s = selected ? 1.3 : 0.88
      g.scale.setScalar(g.scale.x + (s - g.scale.x) * (1 - Math.exp(-5 * dt)))
      const y = (selected ? 0.5 : 0) + Math.sin(t * 1.1 + i * 1.7) * 0.12
      g.position.y += (y - g.position.y) * (1 - Math.exp(-5 * dt))
      const interval = selected ? 1 / 22 : 0.6
      if (dist < 90 && isFacing(state.camera, ex.x, ex.z, 20) && t - st.last[i] > interval) {
        st.last[i] = t
        drawApp(texes[i].ctx, i, t)
        texes[i].tex.needsUpdate = true
      }
    })
    if (holo.current) holo.current.rotation.set(t * 0.4, t * 0.6, 0)
    if (holo2.current) holo2.current.rotation.set(-t * 0.7, t * 0.3, t * 0.5)
    rings.forEach((r, i) => {
      if (r.current) r.current.rotation.set(Math.PI / 2 + Math.sin(t * 0.5 + i) * 0.5, t * (0.5 + i * 0.25), i)
    })
  })

  return (
    <group position={[ex.x, 0, ex.z]}>
      <PadRing radius={7.2} color={ex.color} />
      <PadRing radius={5.1} color="#ffffff" y={0.08} tube={0.03} intensity={1.2} />
      <Label title="Product Lab" sub="Digital Products" color={ex.color} position={[0, 8.6, 0]} scale={1.1} />

      <mesh position={[0, 0.3, 0]} material={mats.darkMetal} castShadow receiveShadow>
        <cylinderGeometry args={[1.5, 1.8, 0.6, 40]} />
      </mesh>
      <mesh position={[0, 0.65, 0]} material={mats.lacquer}>
        <cylinderGeometry args={[1.0, 1.35, 0.14, 40]} />
      </mesh>
      <PadRing radius={1.45} color={ex.color} y={0.6} tube={0.04} />
      <mesh position={[0, 0.75, 0]} geometry={beam} material={beamMat} />

      <group position={[0, 3.8, 0]}>
        <mesh ref={holo}>
          <icosahedronGeometry args={[1.15, 1]} />
          <meshBasicMaterial color={new THREE.Color('#5dffb0').multiplyScalar(2.2)} wireframe toneMapped={false} />
        </mesh>
        <mesh ref={holo2}>
          <octahedronGeometry args={[0.55, 0]} />
          <meshBasicMaterial color={new THREE.Color('#5dffb0').multiplyScalar(2)} toneMapped={false} transparent opacity={0.6} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        {rings.map((r, i) => (
          <mesh key={i} ref={r}>
            <torusGeometry args={[1.6 + i * 0.3, 0.015, 8, 100]} />
            <meshBasicMaterial color={new THREE.Color('#9ff').multiplyScalar(2.4)} toneMapped={false} />
          </mesh>
        ))}
        <Sparkles count={70} scale={[3.4, 6, 3.4]} size={4} speed={0.5} color="#5dffb0" position={[0, -1, 0]} />
        <pointLight color="#5dffb0" intensity={60} distance={14} decay={2} />
      </group>

      <group ref={ring} position={[0, 4.0, 0]}>
        {APPS.map((a, i) => {
          const ang = (i / APPS.length) * Math.PI * 2
          return (
            <group key={a.name} position={[Math.sin(ang) * R, 0, Math.cos(ang) * R]} rotation={[0, ang, 0]}>
              <group ref={(r) => { phones.current[i] = r }}>
                <mesh position={[0, 0, -0.012]} geometry={rbox(1.62, 3.26, 0.16, 0.24)}>
                  <meshBasicMaterial color={new THREE.Color(a.color).multiplyScalar(1.7)} toneMapped={false} />
                </mesh>
                <mesh geometry={rbox(1.56, 3.2, 0.18, 0.22)} material={mats.lacquer} castShadow />
                <mesh position={[0, 0, 0.095]}>
                  <planeGeometry args={[1.42, 2.92]} />
                  <meshBasicMaterial map={texes[i].tex} toneMapped={false} />
                </mesh>
                <mesh position={[0, -1.7, 0]} rotation={[0, 0, 0]}>
                  <planeGeometry args={[0.01, 0.01]} />
                  <meshBasicMaterial visible={false} />
                </mesh>
                <Hit id={`product-${i}`} label={`${a.name} · ${a.sub}`} hint="Chọn ứng dụng" maxDist={40} panel="products" size={[1.8, 3.4, 0.6]} position={[0, 0, 0.1]} onClick={() => select(i)} />
              </group>
            </group>
          )
        })}
      </group>
      <Hit id="product-base" label="Product Lab" hint="Xem danh mục sản phẩm" maxDist={30} panel="products" shape="cylinder" size={[1.8, 1.4, 0]} position={[0, 0.7, 0]} />
    </group>
  )
}
