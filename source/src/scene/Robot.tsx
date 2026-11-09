import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { EXHIBITS } from '../layout'
import { audio, type Bus } from '../audio'
import { toast } from '../store'
import { FONT, canvasTex, rbox, roundRect } from '../gfx'
import { Hit } from './Hit'
import { Label } from './Label'
import { PadRing, Spot, mats, useWorldColliders, worldPos } from './common'

const ex = EXHIBITS.robot
const SC = 0.78

const accent = new THREE.MeshStandardMaterial({ color: '#ff7a1f', emissive: '#ff4d00', emissiveIntensity: 0.55, metalness: 0.5, roughness: 0.4 })
const eyeColor = new THREE.Color('#ffa24a').multiplyScalar(3.2)
const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff8a2a').multiplyScalar(3), toneMapped: false })

type V3 = [number, number, number]
function Part({ s, p, r = 0.22, m = mats.white, rot, cast = true }: { s: V3; p: V3; r?: number; m?: THREE.Material; rot?: V3; cast?: boolean }) {
  return <mesh geometry={rbox(s[0], s[1], s[2], r)} material={m} position={p} rotation={rot} castShadow={cast} receiveShadow />
}

function Arm({ side, armRef, foreRef }: { side: 1 | -1; armRef: React.Ref<THREE.Group>; foreRef: React.Ref<THREE.Group> }) {
  return (
    <group ref={armRef} position={[side * 4.2, 11.6, 0]}>
      <mesh material={mats.darkMetal} castShadow>
        <sphereGeometry args={[1.25, 24, 18]} />
      </mesh>
      <Part s={[2.4, 1.1, 2.7]} p={[side * 0.35, 0.95, 0]} rot={[0, 0, side * 0.15]} r={0.35} />
      <Part s={[1.35, 3.0, 1.5]} p={[0, -1.9, 0]} />
      <Part s={[1.45, 0.3, 1.6]} p={[0, -1.0, 0]} m={accent} r={0.1} />
      <group ref={foreRef} position={[0, -3.5, 0]}>
        <mesh material={mats.darkMetal} castShadow>
          <sphereGeometry args={[0.85, 20, 14]} />
        </mesh>
        <Part s={[1.25, 2.9, 1.6]} p={[0, -1.7, 0.05]} />
        <Part s={[1.35, 0.3, 1.7]} p={[0, -0.9, 0.05]} m={accent} r={0.1} />
        <Part s={[1.5, 1.3, 1.2]} p={[0, -3.5, 0]} m={mats.darkMetal} />
        {[-0.45, 0, 0.45].map((x) => (
          <Part key={x} s={[0.36, 1.1, 0.4]} p={[x, -4.5, 0.1]} m={mats.darkMetal} r={0.1} />
        ))}
      </group>
    </group>
  )
}

export function Robot() {
  const head = useRef<THREE.Group>(null)
  const torso = useRef<THREE.Group>(null)
  const armR = useRef<THREE.Group>(null)
  const armL = useRef<THREE.Group>(null)
  const foreR = useRef<THREE.Group>(null)
  const foreL = useRef<THREE.Group>(null)
  const eyes = useRef<THREE.MeshBasicMaterial>(null)
  const reactor = useRef<THREE.Mesh>(null)
  const reactorLight = useRef<THREE.PointLight>(null)
  const busRef = useRef<Bus | null>(null)
  const st = useRef({ wave: -100, yaw: 0, pitch: 0, servoAcc: 0, lastServo: 0, lastDraw: 0, key: '' }).current

  useWorldColliders(ex, [
    { type: 'circle', x: -2.1, z: 0.5, r: 1.9 },
    { type: 'circle', x: 2.1, z: 0.5, r: 1.9 },
    { type: 'circle', x: 0, z: -2, r: 1.5 },
  ])
  useEffect(() => {
    busRef.current = audio.createBus('robot', worldPos(ex, 0, 6, 1), { ref: 8, rolloff: 1.0, maxDist: 170, reverb: 0.4, gain: 1 })
  }, [])

  const disp = useMemo(() => canvasTex(640, 200, () => {}), [])
  const draw = (t: number, waving: boolean) => {
    const { ctx, tex } = disp
    const W = 640
    const H = 200
    ctx.fillStyle = '#05080f'
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = 'rgba(255,140,40,0.06)'
    for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1)
    if (waving) {
      ctx.textAlign = 'center'
      ctx.fillStyle = '#7fe9ff'
      ctx.shadowColor = '#38d9ff'
      ctx.shadowBlur = 20
      ctx.font = `700 78px ${FONT}`
      ctx.fillText('XIN CHÀO!', W / 2, 100)
      ctx.font = `500 26px ${FONT}`
      ctx.fillStyle = '#fff'
      ctx.fillText('COLOSSUS · ORBITA STUDIO', W / 2, 150)
      ctx.shadowBlur = 0
    } else {
      const stats = [
        ['SHOWS', '212'],
        ['AUDIENCE', '1.8M+'],
        ['UPTIME', '99.99%'],
        ['LED AREA', '1,200 m²'],
      ]
      const i = Math.floor(t / 2.2) % stats.length
      ctx.textAlign = 'left'
      ctx.fillStyle = '#ff9a3d'
      ctx.font = `600 22px ${FONT}`
      ctx.fillText('COLOSSUS // ONLINE', 28, 40)
      ctx.fillStyle = '#5dffb0'
      ctx.beginPath()
      ctx.arc(W - 40, 32, 8 + Math.sin(t * 4) * 2, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#9aa7c2'
      ctx.font = `500 26px ${FONT}`
      ctx.fillText(stats[i][0], 28, 100)
      ctx.fillStyle = '#fff'
      ctx.font = `700 64px ${FONT}`
      ctx.fillText(stats[i][1], 28, 160)
      for (let b = 0; b < 22; b++) {
        const h = 10 + (Math.sin(t * 3 + b * 0.8) * 0.5 + 0.5) * 70
        ctx.fillStyle = `hsl(${25 + b * 3},100%,${50 + (h / 80) * 20}%)`
        roundRect(ctx, 370 + b * 11, 190 - h, 7, h, 2)
        ctx.fill()
      }
    }
    tex.needsUpdate = true
  }

  const wave = () => {
    const now = performance.now() / 1000
    if (now - st.wave < 4.4) return
    st.wave = now
    const bus = busRef.current
    if (bus) {
      audio.servo(bus, 1.3)
      audio.robotBoom(bus)
    }
    audio.speak('Xin chào! Tôi là Colossus, người máy khổng lồ của Orbita. Rất vui được gặp bạn.')
    toast('Colossus: "Xin chào!"')
  }

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    const now = performance.now() / 1000
    const cam = state.camera.position
    const dx = cam.x - ex.x
    const dz = cam.z - ex.z
    const dist = Math.hypot(dx, dz)
    const yawT = THREE.MathUtils.clamp(Math.atan2(dx, dz), -1.15, 1.15)
    const pitchT = THREE.MathUtils.clamp(Math.atan2(11 - cam.y, Math.max(8, dist)), -0.3, 0.5)
    const k = 1 - Math.exp(-2.2 * dt)
    const oldYaw = st.yaw
    st.yaw += (yawT - st.yaw) * k
    st.pitch += (pitchT - st.pitch) * k
    st.servoAcc += Math.abs(st.yaw - oldYaw)
    if (st.servoAcc > 0.22 && now - st.lastServo > 1.8 && busRef.current && dist < 90) {
      st.servoAcc = 0
      st.lastServo = now
      audio.servo(busRef.current, 0.55)
    }
    if (head.current) {
      head.current.rotation.y = st.yaw
      head.current.rotation.x = st.pitch
    }
    if (torso.current) {
      torso.current.rotation.y = st.yaw * 0.28
      torso.current.scale.y = 1 + Math.sin(t * 1.2) * 0.006
    }

    const kk = now - st.wave
    const waving = kk >= 0 && kk < 4.4
    const raise = waving ? THREE.MathUtils.smoothstep(kk, 0, 0.9) * (1 - THREE.MathUtils.smoothstep(kk, 3.5, 4.4)) : 0
    if (armR.current) {
      armR.current.rotation.z = raise * 2.55 + Math.sin(t * 0.7) * 0.025 * (1 - raise)
      armR.current.rotation.x = -raise * 0.25 + Math.sin(t * 0.55) * 0.03 * (1 - raise)
    }
    if (foreR.current) foreR.current.rotation.z = raise * Math.sin(kk * 7) * 0.6 + (1 - raise) * 0.05
    if (armL.current) {
      armL.current.rotation.z = -0.05 - Math.sin(t * 0.7 + 1) * 0.025
      armL.current.rotation.x = Math.sin(t * 0.5 + 2) * 0.03
    }
    if (foreL.current) foreL.current.rotation.z = -0.05
    if (eyes.current) {
      const blink = Math.sin(t * 0.7) > 0.985 ? 0.1 : 1
      const flash = waving ? 1 : 0
      eyes.current.color.copy(eyeColor).lerp(new THREE.Color(3, 3.4, 4), flash * 0.7).multiplyScalar(0.85 + 0.15 * Math.sin(t * 3) * blink)
    }
    const pulse = 0.75 + 0.25 * Math.sin(t * 2.2) + (waving ? 0.5 : 0)
    if (reactor.current) reactor.current.scale.setScalar(pulse)
    if (reactorLight.current) reactorLight.current.intensity = 160 * pulse

    if (t - st.lastDraw > 0.2 && dist < 110) {
      st.lastDraw = t
      draw(t, waving)
    }
  })

  return (
    <group position={[ex.x, 0, ex.z]}>
      <PadRing radius={12.2} color={ex.color} />
      <PadRing radius={9.6} color="#ffffff" y={0.08} tube={0.04} intensity={1.2} />
      <Label title="Colossus" sub="Robotics · Kinetic · Activation" color={ex.color} position={[0, 17.5, 0]} scale={1.5} fadeFar={140} />
      <Spot position={[10, 26, 28]} target={[0, 6, 0]} color="#ffe6cc" intensity={3200} angle={0.36} distance={110} />
      <pointLight position={[0, 13, -11]} color="#ff8a3d" intensity={900} distance={50} decay={2} />

      <mesh position={[0, 0.2, 0]} material={mats.darkMetal} receiveShadow>
        <cylinderGeometry args={[11.8, 12.2, 0.4, 64]} />
      </mesh>

      <group position={[0, 0.4, 0]} scale={SC}>
        {/* chân */}
        {[-1, 1].map((s) => (
          <group key={s}>
            <Part s={[3.1, 0.8, 4.6]} p={[s * 2.7, 0.4, 0.6]} r={0.3} />
            <Part s={[3.1, 0.3, 1.1]} p={[s * 2.7, 0.55, 2.7]} m={accent} r={0.1} />
            <mesh position={[s * 2.7, 1.2, 0]} rotation={[0, 0, Math.PI / 2]} material={mats.darkMetal} castShadow>
              <cylinderGeometry args={[0.75, 0.75, 1.9, 24]} />
            </mesh>
            <Part s={[1.9, 3.0, 2.3]} p={[s * 2.7, 2.7, 0]} />
            <Part s={[1.5, 2.4, 0.4]} p={[s * 2.7, 2.8, 1.2]} m={mats.silver} r={0.12} />
            <Part s={[1.95, 0.25, 2.35]} p={[s * 2.7, 1.7, 0]} m={accent} r={0.08} />
            <mesh position={[s * 2.7, 4.5, 0.2]} material={mats.darkMetal} castShadow>
              <sphereGeometry args={[1.1, 24, 18]} />
            </mesh>
            <Part s={[1.7, 1.2, 1.0]} p={[s * 2.7, 4.5, 1.3]} r={0.3} />
            <Part s={[2.15, 2.6, 2.5]} p={[s * 2.7, 6.0, 0]} />
            <mesh position={[s * 2.8, 7.4, 0]} material={mats.darkMetal} castShadow>
              <sphereGeometry args={[1.15, 24, 18]} />
            </mesh>
          </group>
        ))}
        <Part s={[7.6, 1.7, 3.1]} p={[0, 7.7, 0]} m={mats.darkMetal} r={0.45} />
        <Part s={[7.7, 0.25, 3.2]} p={[0, 8.1, 0]} m={accent} r={0.08} />

        {/* thân */}
        <group ref={torso} position={[0, 0, 0]}>
          <Part s={[3.8, 1.5, 2.5]} p={[0, 8.85, 0]} m={mats.darkMetal} r={0.4} />
          <Part s={[6.6, 3.7, 3.5]} p={[0, 10.7, 0]} r={0.65} />
          <Part s={[5.4, 0.7, 3.1]} p={[0, 12.6, 0]} m={mats.darkMetal} r={0.3} />
          <Part s={[4.2, 1.5, 0.35]} p={[0, 11.35, 1.78]} m={mats.darkMetal} r={0.12} />
          <mesh position={[0, 11.35, 1.97]}>
            <planeGeometry args={[3.9, 1.22]} />
            <meshBasicMaterial map={disp.tex} toneMapped={false} />
          </mesh>
          {/* lò phản ứng */}
          <mesh position={[0, 9.75, 1.78]} rotation={[Math.PI / 2, 0, 0]} material={mats.darkMetal}>
            <torusGeometry args={[0.95, 0.16, 12, 40]} />
          </mesh>
          <mesh ref={reactor} position={[0, 9.75, 1.82]} rotation={[Math.PI / 2, 0, 0]} material={glowMat}>
            <cylinderGeometry args={[0.7, 0.7, 0.2, 32]} />
          </mesh>
          <pointLight ref={reactorLight} position={[0, 9.75, 3.2]} color="#ff7a2a" intensity={160} distance={16} decay={2} />
          {[-1.9, 1.9].map((x) =>
            [0, 1, 2].map((i) => <Part key={x + '-' + i} s={[1.3, 0.12, 0.1]} p={[x, 9.9 + i * 0.28, 1.78]} m={mats.darkMetal} r={0.04} />),
          )}
          {/* ba lô + động cơ */}
          <Part s={[3.8, 3.2, 1.3]} p={[0, 10.8, -2.3]} m={mats.darkMetal} r={0.4} />
          {[-1.1, 1.1].map((x) => (
            <group key={x} position={[x, 9.6, -2.4]}>
              <mesh rotation={[Math.PI / 2, 0, 0]} material={mats.silver}>
                <cylinderGeometry args={[0.6, 0.75, 1.1, 20]} />
              </mesh>
              <mesh position={[0, 0, -0.58]} rotation={[Math.PI / 2, 0, 0]} material={glowMat}>
                <circleGeometry args={[0.5, 20]} />
              </mesh>
            </group>
          ))}

          <Arm side={1} armRef={armR} foreRef={foreR} />
          <Arm side={-1} armRef={armL} foreRef={foreL} />

          {/* cổ + đầu */}
          <mesh position={[0, 13.2, 0]} material={mats.darkMetal} castShadow>
            <cylinderGeometry args={[0.65, 0.8, 0.9, 20]} />
          </mesh>
          <group ref={head} position={[0, 13.5, 0]}>
            <Part s={[3.2, 2.4, 3.0]} p={[0, 1.2, 0]} r={0.7} />
            <Part s={[2.7, 1.0, 0.35]} p={[0, 1.3, 1.45]} m={mats.lacquer} r={0.2} />
            {[-0.68, 0.68].map((x) => (
              <mesh key={x} position={[x, 1.3, 1.64]} geometry={rbox(0.82, 0.3, 0.06, 0.1)}>
                <meshBasicMaterial ref={x < 0 ? eyes : undefined} color={eyeColor} toneMapped={false} />
              </mesh>
            ))}
            <Part s={[0.55, 0.5, 2.4]} p={[0, 2.6, -0.1]} m={accent} r={0.18} />
            {[-1, 1].map((s) => (
              <group key={s}>
                <mesh position={[s * 1.75, 1.2, 0]} rotation={[0, 0, Math.PI / 2]} material={mats.darkMetal} castShadow>
                  <cylinderGeometry args={[0.6, 0.6, 0.55, 20]} />
                </mesh>
                <mesh position={[s * 2.04, 1.2, 0]} rotation={[0, 0, Math.PI / 2]} material={glowMat}>
                  <cylinderGeometry args={[0.35, 0.35, 0.05, 20]} />
                </mesh>
                <mesh position={[s * 1.0, 3.3, -0.4]} material={mats.silver}>
                  <cylinderGeometry args={[0.06, 0.06, 1.8, 8]} />
                </mesh>
                <mesh position={[s * 1.0, 4.25, -0.4]} material={glowMat}>
                  <sphereGeometry args={[0.18, 12, 10]} />
                </mesh>
              </group>
            ))}
          </group>
        </group>
      </group>

      <Hit id="robot" label="Colossus" hint="Vẫy chào" panel="robot" maxDist={75} size={[9, 12.8, 5.4]} position={[0, 6.6, 0]} onClick={wave} />
    </group>
  )
}
