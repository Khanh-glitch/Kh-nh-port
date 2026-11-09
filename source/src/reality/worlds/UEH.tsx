// ORBITA · Thực tại UEH — "Mùa Hạ Thứ 18": tái hiện nghệ thuật sắc nét bản sắc kiến trúc UEH
// (Cơ sở B: tòa B1 15 tầng + lam đứng + nhận diện mallard/cam + cầu nối B1–B2 + tòa B2;
//  Cơ sở A 59C Nguyễn Đình Chiểu: kiến trúc Pháp cổ vàng kem, hành lang lô-gia, mái ngói đất nung;
//  Thư viện kính gỗ, sân khấu acoustic sân trường, góc bàn gỗ & xe máy sinh viên, cổng trường & cột cờ,
//  cùng cây phượng cổ thụ & tán lá thật dưới nắng chiều Sài Gòn).
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { EXHIBITS } from '../../layout'
import { canvasTex as ct, FONT } from '../../gfx'
import { patchNew } from '../mask'
import { createConcretePBR, createHeritagePlasterPBR, createTerracottaTilePBR, createWoodPBR } from '../pbr'
import { UEHFoliage } from '../foliage'
import { Drift, MemoryFrames, SkyDome, Underside, WU, reel } from '../kit'
import { SummerRain } from '../weather/SummerRain'
import { FlamboyantWind } from '../weather/FlamboyantWind'
import { useReality } from '../state'
import { TRACKS } from '../tracks'

const E = EXHIBITS
const canvasTex = (w: number, h: number, d: (c: CanvasRenderingContext2D) => void) => ct(w, h, d).tex
const UEH_TEAL = '#005f69'
const UEH_ORANGE = '#f26f33'

function rnd(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

const baseBox = (w: number, h: number, d: number) => {
  const g = new THREE.BoxGeometry(w, h, d)
  g.translate(0, h / 2, 0)
  return g
}

// ------------------------------------------------------------------ Mặt sân trường terrazzo + bó vỉa + ghế đá + guitar kỷ niệm
function CourtyardGround() {
  const { mat, stoneMat, woodMat, guitarMat } = useMemo(() => {
    const S = 2048
    const R = 59.4
    const m = (v: number) => ((v / R + 1) / 2) * S
    const r = (v: number) => (v / R) * (S / 2)
    const rn = rnd(19)

    const alb = canvasTex(S, S, (c) => {
      c.fillStyle = '#c8bdab'
      c.fillRect(0, 0, S, S)
      // hạt đá mài terrazzo + vết nắng/nước loang tự nhiên
      for (let i = 0; i < 4800; i++) {
        c.fillStyle = rn() > 0.5 ? `rgba(255,244,225,${0.03 + rn() * 0.05})` : `rgba(88,76,62,${0.03 + rn() * 0.06})`
        c.fillRect(rn() * S, rn() * S, 10 + rn() * 24, 10 + rn() * 24)
      }
      // lưới chỉ đồng sân gạch (2.4m x 2.4m)
      c.strokeStyle = 'rgba(84,72,58,0.34)'
      c.lineWidth = 2
      for (let i = -60; i <= 60; i += 2.4) {
        c.beginPath()
        c.moveTo(m(i), 0)
        c.lineTo(m(i), S)
        c.moveTo(0, m(i))
        c.lineTo(S, m(i))
        c.stroke()
      }
      // bồn đất & cỏ
      const bed = (x: number, z: number, rx: number, rz: number, rot: number) => {
        c.save()
        c.translate(m(x), m(z))
        c.rotate(rot)
        c.scale(1, rz / rx)
        c.fillStyle = '#756f64'
        c.beginPath()
        c.arc(0, 0, r(rx + 0.45), 0, Math.PI * 2)
        c.fill()
        const g = c.createRadialGradient(0, 0, 0, 0, 0, r(rx))
        g.addColorStop(0, '#5a7836')
        g.addColorStop(0.85, '#46612b')
        g.addColorStop(1, '#3b4e24')
        c.fillStyle = g
        c.beginPath()
        c.arc(0, 0, r(rx), 0, Math.PI * 2)
        c.fill()
        c.restore()
      }
      bed(-10, 22, 11.4, 6.8, 0.2)
      bed(13, 19, 9.8, 6.8, -0.3)
      bed(-15, -14, 10.8, 5.8, 0.45)
      bed(15, -13, 10.4, 6.3, -0.45)

      // lối đi lát đá granite sáng dẫn về các khu
      Object.values(E).forEach((e) => {
        if (e.id === 'orb') return
        c.strokeStyle = '#d6ccbc'
        c.lineWidth = r(3.4)
        c.beginPath()
        c.moveTo(m(0), m(0))
        c.lineTo(m(e.x), m(e.z))
        c.stroke()
        c.strokeStyle = 'rgba(70,60,48,0.28)'
        c.lineWidth = r(3.6)
        c.stroke()
        c.strokeStyle = '#d6ccbc'
        c.lineWidth = r(3.2)
        c.stroke()
        c.fillStyle = '#d3c8b6'
        c.beginPath()
        c.arc(m(e.x), m(e.z), r(7.8), 0, Math.PI * 2)
        c.fill()
      })
      // vòng sân trung tâm lát đá xám + chỉ viền trắng
      c.fillStyle = '#cfc5b4'
      c.beginPath()
      c.arc(m(0), m(0), r(9.5), 0, Math.PI * 2)
      c.fill()
      c.strokeStyle = '#8b8070'
      c.lineWidth = r(0.35)
      ;[9.6, 22.5, 51].forEach((rr) => {
        c.beginPath()
        c.arc(m(0), m(0), r(rr), 0, Math.PI * 2)
        c.stroke()
      })
      // bồn gốc cây phượng trung tâm
      c.fillStyle = '#3f3528'
      c.beginPath()
      c.arc(m(0), m(0), r(4.2), 0, Math.PI * 2)
      c.fill()
      // rìa bó vỉa quanh đĩa
      c.strokeStyle = '#6c6256'
      c.lineWidth = r(1.3)
      c.beginPath()
      c.arc(m(0), m(0), r(58.5), 0, Math.PI * 2)
      c.stroke()
    })

    const rough = canvasTex(512, 512, (c) => {
      c.fillStyle = '#b4b4b4'
      c.fillRect(0, 0, 512, 512)
      const r2 = rnd(23)
      for (let i = 0; i < 1600; i++) {
        const v = 135 + Math.floor(r2() * 90)
        c.fillStyle = `rgb(${v},${v},${v})`
        c.fillRect(r2() * 512, r2() * 512, 4 + r2() * 14, 4 + r2() * 14)
      }
      c.strokeStyle = '#ececec'
      c.lineWidth = 1.5
      for (let i = 0; i <= 512; i += 10) {
        c.beginPath()
        c.moveTo(i, 0)
        c.lineTo(i, 512)
        c.moveTo(0, i)
        c.lineTo(512, i)
        c.stroke()
      }
    })
    rough.colorSpace = THREE.NoColorSpace

    const bump = canvasTex(512, 512, (c) => {
      c.fillStyle = '#8a8a8a'
      c.fillRect(0, 0, 512, 512)
      c.strokeStyle = '#303030'
      c.lineWidth = 1.5
      for (let i = 0; i <= 512; i += 10) {
        c.beginPath()
        c.moveTo(i, 0)
        c.lineTo(i, 512)
        c.moveTo(0, i)
        c.lineTo(512, i)
        c.stroke()
      }
    })
    bump.colorSpace = THREE.NoColorSpace

    const stone = createConcretePBR('#cfcac0', 2, 1)
    const wood = createWoodPBR('#9b643b', 1, 1)

    const groundMat = new THREE.MeshStandardMaterial({
      map: alb,
      roughnessMap: rough,
      bumpMap: bump,
      bumpScale: 0.03,
      roughness: 0.84,
      metalness: 0.04,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    })
    // Sân trường ẩm ướt khi mưa mùa hạ: vũng nước tự nhiên + gợn sóng đồng tâm 5x5 + phản chiếu mềm
    groundMat.onBeforeCompile = (shader) => {
      let fs = shader.fragmentShader
      const wetHelpers = /* glsl */ `
        float gH(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float gN(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(gH(i), gH(i+vec2(1,0)), f.x), mix(gH(i+vec2(0,1)), gH(i+vec2(1,1)), f.x), f.y); }
        float gFbm(vec2 p){ float s = 0.0, a = 0.5; for(int i=0;i<4;i++){ s += a*gN(p); p = p*2.04+9.3; a*=0.5; } return s; }
        vec2 gRipples(vec2 uv, float time){
          vec2 cell = floor(uv);
          vec2 acc = vec2(0.0);
          for (int y = -1; y <= 1; y++) {
            for (int x = -1; x <= 1; x++) {
              vec2 c = cell + vec2(float(x), float(y));
              vec2 rnd = vec2(gH(c), gH(c + 19.3));
              vec2 p = c + 0.2 + rnd * 0.6;
              vec2 d = uv - p;
              float dist = length(d);
              float ph = fract(time * 0.65 + gH(c + 37.1));
              float ring = dist - ph * 1.45;
              float w = exp(-ring * ring * 90.0) * (1.0 - ph) * smoothstep(0.0, 0.12, ph);
              float slope = -ring * 180.0 * w;
              acc += normalize(d + 1e-4) * slope;
            }
          }
          return acc * 0.015;
        }
      `
      fs = fs.replace('#include <common>', `#include <common>\n${wetHelpers}`)
      fs = fs.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float rwWet = uRWenv.y;
        float rwPudRaw = gFbm(vRWp.xz * 0.14);
        float rwPud = smoothstep(0.45, 0.66, rwPudRaw) * rwWet * smoothstep(3.5, 9.0, length(vRWp.xz));
        diffuseColor.rgb *= mix(1.0, 0.54, rwWet * 0.62 + rwPud * 0.38);`,
      )
      fs = fs.replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.24, rwWet * 0.85);
        roughnessFactor = mix(roughnessFactor, 0.045, rwPud);`,
      )
      fs = fs.replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        vec2 rwRip = gRipples(vRWp.xz * 1.15, uRW.y) * (rwPud * 1.25 + rwWet * 0.25) * uRWenv.x;
        normal = normalize(normal + (viewMatrix * vec4(rwRip.x, 0.0, rwRip.y, 0.0)).xyz);`,
      )
      fs = fs.replace(
        '#include <tonemapping_fragment>',
        `if (rwWet > 0.005) {
          vec3 rwV = normalize(cameraPosition - vRWp);
          vec3 rwN = normalize(vec3(rwRip.x * 1.8, 1.0, rwRip.y * 1.8));
          vec3 rwR = reflect(-rwV, rwN);
          float rwFr = pow(1.0 - max(dot(rwN, rwV), 0.0), 3.4);
          vec3 rwSky = mix(vec3(0.68, 0.72, 0.78), vec3(0.24, 0.34, 0.46), smoothstep(0.0, 0.55, rwR.y));
          float rwSunR = pow(max(dot(rwR, normalize(uRWsun)), 0.0), 18.0);
          rwSky += vec3(1.0, 0.82, 0.62) * rwSunR * 0.45;
          // ánh đèn ấm từ B1 & đàn Piano phản chiếu trong vũng nước
          float pianoGlow = exp(-length(vRWp.xz - vec2(-26.0, 9.0)) * 0.14);
          float b1Glow = exp(-length(vRWp.xz - vec2(0.0, -35.0)) * 0.08);
          rwSky += vec3(1.0, 0.78, 0.42) * (pianoGlow * 0.42 + b1Glow * 0.35);
          float rwRefMask = clamp(rwPud * (0.28 + rwFr * 0.68) + rwWet * rwFr * 0.16, 0.0, 0.82);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, rwSky, rwRefMask);
        }
        #include <tonemapping_fragment>`,
      )
      shader.fragmentShader = fs
    }
    groundMat.customProgramCacheKey = () => 'ueh-wet-ground'

    return {
      mat: patchNew(groundMat, { grow: false, ao: false }),
      stoneMat: patchNew(new THREE.MeshStandardMaterial({ map: stone.map, bumpMap: stone.bumpMap, bumpScale: 0.02, roughness: 0.85 }), { grow: true, growLen: 8 }),
      woodMat: patchNew(new THREE.MeshStandardMaterial({ map: wood.map, bumpMap: wood.bumpMap, bumpScale: 0.02, roughness: 0.62 }), { grow: true, growLen: 8 }),
      guitarMat: patchNew(new THREE.MeshStandardMaterial({ color: '#b86e34', roughness: 0.35, metalness: 0.1 }), { grow: true, growLen: 8 }),
    }
  }, [])

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]} material={mat} receiveShadow>
        <circleGeometry args={[59.4, 128]} />
      </mesh>
      {/* bó vỉa bồn cây phượng trung tâm */}
      <mesh position={[0, 0.28, 0]} rotation={[Math.PI / 2, 0, 0]} material={stoneMat} castShadow receiveShadow>
        <torusGeometry args={[4.45, 0.32, 8, 48]} />
      </mesh>
      {/* ghế đá sân trường quanh gốc cây */}
      {[0.4, 1.9, 3.5, 5.1].map((a, i) => (
        <group key={i} position={[Math.cos(a) * 6.0, 0, Math.sin(a) * 6.0]} rotation={[0, -a + Math.PI * 0.5, 0]}>
          <mesh position={[0, 0.44, 0]} material={stoneMat} castShadow receiveShadow>
            <boxGeometry args={[2.2, 0.09, 0.54]} />
          </mesh>
          <mesh position={[0, 0.78, -0.22]} rotation={[-0.14, 0, 0]} material={stoneMat} castShadow>
            <boxGeometry args={[2.2, 0.44, 0.08]} />
          </mesh>
          {[-0.8, 0.8].map((x) => (
            <mesh key={x} position={[x, 0.22, 0]} material={stoneMat} castShadow>
              <boxGeometry args={[0.16, 0.44, 0.46]} />
            </mesh>
          ))}
        </group>
      ))}
      {/* cây đàn guitar gỗ tựa trên ghế đá & sổ tay kỷ niệm */}
      <group position={[Math.cos(1.9) * 6.0, 0.49, Math.sin(1.9) * 6.0]} rotation={[0, -1.9 + Math.PI * 0.5, 0]}>
        <group position={[0.42, 0.22, 0.02]} rotation={[-0.24, 0.18, -0.18]}>
          {/* thùng đàn số 8 liền khối */}
          <mesh position={[0, -0.04, 0]} rotation={[Math.PI / 2, 0, 0]} material={guitarMat} castShadow>
            <cylinderGeometry args={[0.17, 0.18, 0.09, 20]} />
          </mesh>
          <mesh position={[0, 0.14, 0]} rotation={[Math.PI / 2, 0, 0]} material={guitarMat} castShadow>
            <cylinderGeometry args={[0.135, 0.14, 0.09, 20]} />
          </mesh>
          <mesh position={[0, 0.05, 0]} material={guitarMat} castShadow>
            <boxGeometry args={[0.22, 0.18, 0.09]} />
          </mesh>
          {/* lỗ thoát âm + cần đàn */}
          <mesh position={[0, 0.1, 0.048]} material={woodMat}>
            <circleGeometry args={[0.048, 16]} />
          </mesh>
          <mesh position={[0, 0.44, 0.01]} material={woodMat} castShadow>
            <boxGeometry args={[0.048, 0.48, 0.025]} />
          </mesh>
          <mesh position={[0, 0.71, 0.01]} material={guitarMat}>
            <boxGeometry args={[0.07, 0.11, 0.026]} />
          </mesh>
        </group>
        <mesh position={[-0.35, 0.01, 0.04]} rotation={[0, 0.24, 0]} material={patchNew(new THREE.MeshStandardMaterial({ color: '#f3ebd8', roughness: 0.9 }), { grow: true, growLen: 6 })}>
          <boxGeometry args={[0.26, 0.024, 0.34]} />
        </mesh>
      </group>
    </group>
  )
}

// ------------------------------------------------------------------ Cơ sở B: Tòa nhà B1 (15 tầng) + Cầu nối kính + Tòa nhà B2 (5 tầng)
function CampusB() {
  const b1 = E.robot

  const { concreteMat, darkMetalMat, glassMat, tealMat, orangeMat, lobbyGlassMat, lobbyLightMat, finMat, b1SignMat, b2SignMat, pergolaWoodMat, roofGrassMat, b1Fins } = useMemo(() => {
    const conc = createConcretePBR('#e6e3db', 2, 4)
    const wood = createWoodPBR('#7e5232', 2, 1)

    // Bảng hiệu UEH · B1 đúng màu nhận diện xanh mallard (#005f69) & cam (#f26f33)
    const signB1 = canvasTex(512, 160, (c) => {
      c.fillStyle = UEH_TEAL
      c.fillRect(0, 0, 512, 160)
      c.fillStyle = UEH_ORANGE
      c.fillRect(0, 140, 512, 20)
      c.fillStyle = '#ffffff'
      c.font = `700 66px ${FONT}`
      c.textAlign = 'left'
      c.fillText('UEH', 42, 92)
      c.fillStyle = UEH_ORANGE
      c.fillRect(190, 36, 4, 72)
      c.fillStyle = '#e7f4f4'
      c.font = `600 28px ${FONT}`
      c.fillText('CƠ SỞ B · TÒA B1', 214, 68)
      c.font = `500 20px ${FONT}`
      c.fillStyle = '#a8d3d6'
      c.fillText('279 NGUYỄN TRI PHƯƠNG', 214, 102)
    })

    const signB2 = canvasTex(512, 128, (c) => {
      c.fillStyle = '#f2efe8'
      c.fillRect(0, 0, 512, 128)
      c.fillStyle = UEH_TEAL
      c.fillRect(0, 0, 18, 128)
      c.fillStyle = UEH_ORANGE
      c.fillRect(18, 0, 8, 128)
      c.fillStyle = UEH_TEAL
      c.font = `700 44px ${FONT}`
      c.textAlign = 'left'
      c.fillText('GIẢNG ĐƯỜNG B2', 48, 66)
      c.fillStyle = '#4c5e63'
      c.font = `500 22px ${FONT}`
      c.fillText('ENGLISH ZONE · PHÒNG HỌC', 48, 100)
    })

    // Vách kính mặt dựng tòa B1: phản chiếu nắng chiều + lộ nội thất ấm các tầng + tầng 6 thư viện + ký ức video
    const glass = patchNew(
      new THREE.ShaderMaterial({
        uniforms: { uTex: { value: reel.tex }, uMus: WU.uMus, uEnergy: WU.uEnergy, uT: WU.uTime },
        vertexShader: `varying vec2 vUv; varying vec3 vNn; varying vec3 vWp;
          void main(){ vUv = uv; vNn = normalize(mat3(modelMatrix) * normal);
            vec3 pp = position; pp.y *= rwGrow(vRWg, 34.0);
            vWp = (modelMatrix * vec4(pp, 1.0)).xyz;
            gl_Position = projectionMatrix * viewMatrix * vec4(vWp, 1.0); }`,
        fragmentShader: `uniform sampler2D uTex; uniform vec4 uMus; uniform float uEnergy; uniform float uT;
          varying vec2 vUv; varying vec3 vNn; varying vec3 vWp;
          float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
          void main(){
            vec3 V = normalize(cameraPosition - vWp);
            vec3 R = reflect(-V, vNn);
            float fr = 0.22 + 0.78 * pow(1.0 - max(dot(vNn, V), 0.0), 3.0);
            // phản xạ bầu trời chiều vàng - xanh
            vec3 skyRef = mix(vec3(0.95, 0.72, 0.48), vec3(0.18, 0.34, 0.52), smoothstep(0.0, 0.55, R.y));
            float sunRef = pow(max(dot(R, normalize(vec3(-0.55, 0.16, -0.82))), 0.0), 24.0);
            skyRef += vec3(1.0, 0.76, 0.42) * sunRef * 0.9;
            // lưới cửa kính 14 tầng x 12 ô
            float floorIdx = floor(vUv.y * 14.0);
            vec2 cell = fract(vec2(vUv.x * 12.0, vUv.y * 14.0));
            float mullion = step(cell.x, 0.06) + step(0.94, cell.x) + step(cell.y, 0.14) + step(0.92, cell.y);
            // tầng 6 (index 4-5 trong khối thân trên đế): thư viện thông minh sáng ấm xuyên kính
            float isLib = step(2.5, floorIdx) * step(floorIdx, 4.5);
            float lit = max(isLib * 0.9, step(0.55, h(vec2(floor(vUv.x * 12.0), floorIdx))));
            vec3 interior = mix(vec3(0.08, 0.14, 0.18), vec3(0.96, 0.76, 0.48) * (0.65 + isLib * 0.45), lit);
            // ánh ký ức video phản chiếu dịu trên các tầng kính
            vec3 vid = texture2D(uTex, vec2(vUv.x, vUv.y)).rgb;
            interior = mix(interior, vid * 0.95, clamp(uEnergy * 0.35 + uMus.y * 0.18, 0.0, 0.48) * lit);
            vec3 glassCol = mix(interior, skyRef, fr * 0.72);
            vec3 frameCol = vec3(0.22, 0.25, 0.28);
            vec3 col = mix(glassCol, frameCol, clamp(mullion, 0.0, 1.0));
            gl_FragColor = vec4(col, 1.0);
          }`,
        toneMapped: false,
      }),
      { grow: true, growLen: 34 },
    )

    // Kính sảnh đón tầng trệt trong suốt hơn để thấy cột và đèn ấm bên trong
    const lobbyGlass = patchNew(
      new THREE.MeshPhysicalMaterial({
        color: '#a9ced4',
        roughness: 0.08,
        metalness: 0.15,
        transparent: true,
        opacity: 0.45,
        clearcoat: 1,
        envMapIntensity: 1.8,
      }),
      { grow: true, growLen: 16 },
    )

    // tạo ma trận cho hệ lam đứng dọc mặt tiền B1
    const fins: { m: THREE.Matrix4; c: THREE.Color }[] = []
    const mat = new THREE.Matrix4()
    const col = new THREE.Color()
    const xs = [-8.4, -7.2, -6.0, -4.8, -3.6, -2.4, -1.2, 0, 1.2, 2.4, 3.6, 4.8, 6.0, 7.2, 8.4]
    xs.forEach((x, idx) => {
      for (const z of [5.45, -5.45]) {
        mat.makeTranslation(x, 29.5, z)
        // vài lam nhấn xanh mallard & cam UEH giống ngôn ngữ mặt đứng hiện đại
        if (idx === 3 || idx === 11) col.set(UEH_TEAL)
        else if (idx === 4) col.set(UEH_ORANGE)
        else col.set('#ece9e0')
        fins.push({ m: mat.clone(), c: col.clone() })
      }
    })

    return {
      concreteMat: patchNew(new THREE.MeshStandardMaterial({ map: conc.map, bumpMap: conc.bumpMap, bumpScale: 0.025, roughnessMap: conc.roughnessMap, roughness: 0.78 }), { grow: true, growLen: 34, wet: true }),
      darkMetalMat: patchNew(new THREE.MeshStandardMaterial({ color: '#273036', metalness: 0.75, roughness: 0.38 }), { grow: true, growLen: 30, wet: true }),
      glassMat: glass,
      tealMat: patchNew(new THREE.MeshStandardMaterial({ color: UEH_TEAL, roughness: 0.45, metalness: 0.15 }), { grow: true, growLen: 30, wet: true }),
      orangeMat: patchNew(new THREE.MeshStandardMaterial({ color: UEH_ORANGE, roughness: 0.45, metalness: 0.1 }), { grow: true, growLen: 30, wet: true }),
      lobbyGlassMat: lobbyGlass,
      lobbyLightMat: patchNew(new THREE.MeshBasicMaterial({ color: '#ffd599' }), { grow: true, growLen: 12 }),
      finMat: patchNew(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.55, metalness: 0.15 }), { grow: true, growLen: 34, wet: true }),
      b1SignMat: patchNew(new THREE.MeshStandardMaterial({ map: signB1, roughness: 0.35, emissive: new THREE.Color('#ffffff'), emissiveMap: signB1, emissiveIntensity: 0.25 }), { grow: true, growLen: 14 }),
      b2SignMat: patchNew(new THREE.MeshStandardMaterial({ map: signB2, roughness: 0.45 }), { grow: true, growLen: 14 }),
      pergolaWoodMat: patchNew(new THREE.MeshStandardMaterial({ map: wood.map, bumpMap: wood.bumpMap, bumpScale: 0.02, roughness: 0.7 }), { grow: true, growLen: 34, wet: true }),
      roofGrassMat: patchNew(new THREE.MeshStandardMaterial({ color: '#568538', roughness: 0.85 }), { grow: true, growLen: 34, wet: true }),
      b1Fins: fins,
    }
  }, [])

  const finRef = useRef<THREE.InstancedMesh>(null)
  useEffect(() => {
    const im = finRef.current
    if (!im) return
    b1Fins.forEach((f, i) => {
      im.setMatrixAt(i, f.m)
      im.setColorAt(i, f.c)
    })
    im.instanceMatrix.needsUpdate = true
    if (im.instanceColor) im.instanceColor.needsUpdate = true
  }, [b1Fins])

  useFrame(() => {
    glassMat.uniforms.uTex.value = reel.tex
  })

  return (
    <group position={[b1.x, 0, b1.z]}>
      {/* BẬC TAM CẤP SẢNH B1 */}
      {[0, 1, 2].map((s) => (
        <mesh key={s} position={[0, 0.12 + s * 0.18, 6.8 - s * 0.5]} material={concreteMat} receiveShadow>
          <boxGeometry args={[20 - s * 0.4, 0.18, 3.8]} />
        </mesh>
      ))}

      {/* KHỐI ĐẾ SẢNH B1 (TẦNG 1–3, cao 10.5m) */}
      <mesh position={[0, 5.2, -0.5]} material={concreteMat} castShadow receiveShadow>
        <boxGeometry args={[18.6, 10.4, 9.6]} />
      </mesh>
      {/* vách kính sảnh đón mặt trước */}
      <mesh position={[0, 4.8, 5.05]} material={lobbyGlassMat}>
        <boxGeometry args={[17.2, 8.6, 0.12]} />
      </mesh>
      {/* ánh đèn sảnh hắt ấm từ bên trong */}
      <mesh position={[0, 4.5, 4.2]} material={lobbyLightMat}>
        <planeGeometry args={[16, 7.6]} />
      </mesh>
      {/* hàng 6 cột khối đế B1 */}
      {[-8.2, -4.9, -1.65, 1.65, 4.9, 8.2].map((x) => (
        <mesh key={x} position={[x, 5.2, 5.45]} material={concreteMat} castShadow receiveShadow>
          <boxGeometry args={[0.75, 10.4, 0.85]} />
        </mesh>
      ))}
      {/* mái đón canopy sảnh B1 + bảng hiệu UEH B1 */}
      <mesh position={[0, 4.6, 7.1]} material={darkMetalMat} castShadow>
        <boxGeometry args={[11.6, 0.34, 3.4]} />
      </mesh>
      <mesh position={[0, 4.78, 8.81]} material={b1SignMat}>
        <planeGeometry args={[6.4, 2.0]} />
      </mesh>
      {/* dải sàn phân tách khối đế và thân tháp */}
      <mesh position={[0, 10.5, 0]} material={concreteMat} castShadow>
        <boxGeometry args={[19.4, 0.65, 11.4]} />
      </mesh>

      {/* THÂN THÁP B1 (TẦNG 4–14, cao từ 10.8m -> 48.8m) */}
      <mesh position={[0, 29.8, 0]} material={glassMat} castShadow receiveShadow>
        <boxGeometry args={[17.6, 38.0, 10.4]} />
      </mesh>
      {/* khung biên 2 đầu hồi tòa nhà (solid shear walls có rãnh nhận diện UEH) */}
      {[-8.95, 8.95].map((x) => (
        <mesh key={x} position={[x, 29.8, 0]} material={concreteMat} castShadow receiveShadow>
          <boxGeometry args={[0.7, 38.4, 11.2]} />
        </mesh>
      ))}
      {/* dải nhấn thương hiệu UEH dọc cạnh phải */}
      <mesh position={[9.32, 29.8, 2.6]} material={tealMat}>
        <boxGeometry args={[0.12, 37.6, 1.8]} />
      </mesh>
      <mesh position={[9.32, 29.8, 1.3]} material={orangeMat}>
        <boxGeometry args={[0.14, 37.6, 0.55]} />
      </mesh>
      {/* các gờ ngang phân tầng */}
      {Array.from({ length: 11 }).map((_, k) => (
        <mesh key={k} position={[0, 13.8 + k * 3.4, 0]} material={concreteMat}>
          <boxGeometry args={[18.2, 0.24, 11.1]} />
        </mesh>
      ))}
      {/* hệ lam đứng chắn nắng (30 thanh instanced) */}
      <instancedMesh ref={finRef} args={[undefined, finMat, b1Fins.length]} frustumCulled={false} castShadow>
        <boxGeometry args={[0.24, 38.2, 0.52]} />
      </instancedMesh>

      {/* TẦNG 15: CÔNG VIÊN TRÊN CAO + GIÀN PERGOLA */}
      <mesh position={[0, 49.1, 0]} material={concreteMat} castShadow>
        <boxGeometry args={[18.8, 0.7, 11.4]} />
      </mesh>
      <mesh position={[0, 49.55, 0]} material={roofGrassMat}>
        <boxGeometry args={[17.2, 0.25, 9.8]} />
      </mesh>
      <mesh position={[0, 50.2, 5.45]} material={lobbyGlassMat}>
        <boxGeometry args={[18.2, 1.3, 0.1]} />
      </mesh>
      {/* giàn pergola mái B1 */}
      {[-7.2, -3.6, 0, 3.6, 7.2].map((x) => (
        <mesh key={x} position={[x, 51.2, 0]} material={darkMetalMat}>
          <boxGeometry args={[0.35, 3.4, 0.35]} />
        </mesh>
      ))}
      <mesh position={[0, 52.8, 0]} material={pergolaWoodMat}>
        <boxGeometry args={[16.5, 0.28, 7.6]} />
      </mesh>

      {/* CẦU VƯỢT KÍNH NỐI B1 – B2 (cao độ tầng 3 ~ 11.2m) */}
      <group position={[-13.5, 11.2, 0]}>
        <mesh position={[0, -1.25, 0]} material={concreteMat} castShadow>
          <boxGeometry args={[9.4, 0.38, 3.6]} />
        </mesh>
        <mesh position={[0, 1.45, 0]} material={darkMetalMat}>
          <boxGeometry args={[9.4, 0.24, 3.6]} />
        </mesh>
        <mesh position={[0, 0.1, 0]} material={lobbyGlassMat}>
          <boxGeometry args={[9.2, 2.4, 3.2]} />
        </mesh>
        {[-3.2, -1.6, 0, 1.6, 3.2].map((x) => (
          <mesh key={x} position={[x, 0.1, 1.68]} material={darkMetalMat}>
            <boxGeometry args={[0.14, 2.7, 0.14]} />
          </mesh>
        ))}
      </group>

      {/* TÒA NHÀ B2 (5 TẦNG GIẢNG ĐƯỜNG + HÀNH LANG MỞ + ENGLISH ZONE) */}
      <group position={[-27.5, 0, 0]}>
        <mesh position={[0, 0.25, 0]} material={concreteMat} receiveShadow>
          <boxGeometry args={[20.8, 0.5, 11.4]} />
        </mesh>
        {/* thân 5 tầng lùi sâu tạo bóng hành lang */}
        <mesh position={[0, 9.2, -0.8]} material={concreteMat} castShadow receiveShadow>
          <boxGeometry args={[19.2, 17.6, 8.2]} />
        </mesh>
        {/* vách kính hành lang trong */}
        <mesh position={[0, 9.2, 3.35]} material={glassMat}>
          <boxGeometry args={[18.2, 16.4, 0.15]} />
        </mesh>
        {/* 5 sàn ban công hành lang ngoài trời + lan can kính */}
        {[3.6, 7.1, 10.6, 14.1, 17.6].map((y, idx) => (
          <group key={idx} position={[0, y, 4.3]}>
            <mesh material={concreteMat} castShadow receiveShadow>
              <boxGeometry args={[20.2, 0.28, 2.2]} />
            </mesh>
            {idx < 4 && (
              <mesh position={[0, 0.58, 1.02]} material={lobbyGlassMat}>
                <boxGeometry args={[19.8, 0.95, 0.08]} />
              </mesh>
            )}
          </group>
        ))}
        {/* cột nhịp hành lang B2 */}
        {[-9.2, -4.6, 0, 4.6, 9.2].map((x) => (
          <mesh key={x} position={[x, 9.2, 5.1]} material={concreteMat} castShadow>
            <boxGeometry args={[0.45, 17.8, 0.45]} />
          </mesh>
        ))}
        {/* dải lam nhấn mallard & cam ở góc B2 */}
        <mesh position={[9.8, 9.2, 2.2]} material={tealMat}>
          <boxGeometry args={[0.4, 17.8, 2.2]} />
        </mesh>
        <mesh position={[9.85, 9.2, 0.8]} material={orangeMat}>
          <boxGeometry args={[0.42, 17.8, 0.55]} />
        </mesh>
        <mesh position={[0, 4.1, 5.42]} material={b2SignMat}>
          <planeGeometry args={[6.4, 1.6]} />
        </mesh>
      </group>
    </group>
  )
}

// ------------------------------------------------------------------ Cơ sở A — 59C Nguyễn Đình Chiểu (kiến trúc Pháp cổ vàng kem, hành lang lô-gia, mái ngói)
function CampusA() {
  const e = E.cinema
  const { wallMat, trimMat, roofMat, shutterMat, glassMat, stoneMat, signMat } = useMemo(() => {
    const plaster = createHeritagePlasterPBR(3, 1.4)
    const tile = createTerracottaTilePBR(10, 4)
    const conc = createConcretePBR('#f0e9d8', 2, 1)

    const sign = canvasTex(640, 110, (c) => {
      c.fillStyle = '#efe6cf'
      c.fillRect(0, 0, 640, 110)
      c.strokeStyle = UEH_TEAL
      c.lineWidth = 5
      c.strokeRect(6, 6, 628, 98)
      c.fillStyle = UEH_TEAL
      c.font = `700 28px ${FONT}`
      c.textAlign = 'center'
      c.fillText('ĐẠI HỌC KINH TẾ TP. HỒ CHÍ MINH', 320, 50)
      c.fillStyle = UEH_ORANGE
      c.font = `600 18px ${FONT}`
      c.fillText('CƠ SỞ A · 59C NGUYỄN ĐÌNH CHIỂU', 320, 82)
    })

    return {
      wallMat: patchNew(new THREE.MeshStandardMaterial({ map: plaster.map, bumpMap: plaster.bumpMap, bumpScale: 0.03, roughnessMap: plaster.roughnessMap, roughness: 0.88 }), { grow: true, growLen: 16, wet: true }),
      trimMat: patchNew(new THREE.MeshStandardMaterial({ color: '#f3ebd6', roughness: 0.65 }), { grow: true, growLen: 16, wet: true }),
      roofMat: patchNew(new THREE.MeshStandardMaterial({ map: tile.map, bumpMap: tile.bumpMap, bumpScale: 0.06, roughness: 0.78 }), { grow: true, growLen: 18, wet: true }),
      shutterMat: patchNew(new THREE.MeshStandardMaterial({ color: '#275743', roughness: 0.6 }), { grow: true, growLen: 16, wet: true }),
      glassMat: patchNew(new THREE.MeshStandardMaterial({ color: '#ffd89e', emissive: new THREE.Color('#ffaf58'), emissiveIntensity: 0.38, roughness: 0.2, metalness: 0.3 }), { grow: true, growLen: 16 }),
      stoneMat: patchNew(new THREE.MeshStandardMaterial({ map: conc.map, roughness: 0.82 }), { grow: true, growLen: 8, wet: true }),
      signMat: patchNew(new THREE.MeshStandardMaterial({ map: sign, roughness: 0.5 }), { grow: true, growLen: 16 }),
    }
  }, [])

  // tạo mái ngói dốc 4 phía cân đối chuẩn xác khớp thân nhà Cơ sở A (24.4m x 11.4m)
  const roofGeo = useMemo(() => {
    const hw = 12.2
    const hd = 5.7
    const rhw = 6.8
    const h = 3.2
    const pts = [
      // mặt trước
      -hw, 0, hd, hw, 0, hd, rhw, h, 0,
      -hw, 0, hd, rhw, h, 0, -rhw, h, 0,
      // mặt sau
      hw, 0, -hd, -hw, 0, -hd, -rhw, h, 0,
      hw, 0, -hd, -rhw, h, 0, rhw, h, 0,
      // đầu hồi phải
      hw, 0, hd, hw, 0, -hd, rhw, h, 0,
      // đầu hồi trái
      -hw, 0, -hd, -hw, 0, hd, -rhw, h, 0,
    ]
    const uvs = [
      0, 0, 1, 0, 0.78, 1, 0, 0, 0.78, 1, 0.22, 1,
      0, 0, 1, 0, 0.78, 1, 0, 0, 0.78, 1, 0.22, 1,
      0, 0, 1, 0, 0.5, 1,
      0, 0, 1, 0, 0.5, 1,
    ]
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    g.computeVertexNormals()
    return g
  }, [])

  return (
    <group position={[e.x, 0, e.z]} rotation={[0, e.rotY, 0]}>
      {/* BỆ ĐÁ GRANITE + TAM CẤP */}
      <mesh position={[0, 0.25, 0]} material={stoneMat} receiveShadow>
        <boxGeometry args={[24.6, 0.5, 11.2]} />
      </mesh>
      {[0, 1, 2].map((s) => (
        <mesh key={s} position={[0, 0.1 + s * 0.14, 6.2 - s * 0.38]} material={stoneMat} receiveShadow>
          <boxGeometry args={[8.4 - s * 0.4, 0.14, 1.4]} />
        </mesh>
      ))}

      {/* KHỐI TƯỜNG CHÍNH LÙI SÂU TẠO HÀNG HIÊN LÔ-GIA */}
      <mesh position={[0, 5.2, -0.7]} material={wallMat} castShadow receiveShadow>
        <boxGeometry args={[22.4, 9.4, 7.6]} />
      </mesh>
      {/* KHỐI SẢNH GIỮA NHÔ CAO TRANG NGHIÊM */}
      <mesh position={[0, 5.9, 0.2]} material={wallMat} castShadow receiveShadow>
        <boxGeometry args={[8.6, 10.8, 8.6]} />
      </mesh>
      <mesh position={[0, 11.4, 0.2]} material={trimMat}>
        <boxGeometry args={[9.0, 0.42, 9.0]} />
      </mesh>
      {/* BẢNG TÊN TRÊN TRÁN TƯỜNG CƠ SỞ A */}
      <mesh position={[0, 10.1, 4.53]} material={signMat}>
        <planeGeometry args={[6.8, 1.15]} />
      </mesh>

      {/* HÀNG CỘT ĐÔI HÀNH LANG LÔ-GIA + BAN CÔNG CON TIỆN TẦNG 2 */}
      <mesh position={[0, 4.95, 4.1]} material={trimMat} castShadow receiveShadow>
        <boxGeometry args={[23.2, 0.34, 2.2]} />
      </mesh>
      <mesh position={[0, 9.65, 4.1]} material={trimMat} castShadow>
        <boxGeometry args={[23.2, 0.38, 2.3]} />
      </mesh>
      {[-10.8, -7.8, -4.8, -2.1, 2.1, 4.8, 7.8, 10.8].map((x, idx) => (
        <group key={idx} position={[x, 0, 4.9]}>
          <mesh position={[0, 5.05, 0]} material={trimMat} castShadow>
            <boxGeometry args={[0.48, 9.2, 0.48]} />
          </mesh>
          <mesh position={[0, 0.7, 0]} material={trimMat}>
            <boxGeometry args={[0.64, 0.4, 0.64]} />
          </mesh>
        </group>
      ))}
      {/* lan can con tiện tầng 2 */}
      {[-9.3, -6.3, -3.45, 3.45, 6.3, 9.3].map((x, idx) => (
        <group key={idx} position={[x, 5.55, 4.95]}>
          <mesh position={[0, 0.38, 0]} material={trimMat}>
            <boxGeometry args={[2.55, 0.12, 0.18]} />
          </mesh>
          {[-0.9, -0.45, 0, 0.45, 0.9].map((bx) => (
            <mesh key={bx} position={[bx, 0, 0]} material={trimMat}>
              <cylinderGeometry args={[0.055, 0.075, 0.72, 8]} />
            </mesh>
          ))}
        </group>
      ))}

      {/* CỬA SỔ & CỬA CHỚP XANH CỔ VỊT LÙI VÀO TRONG TƯỜNG */}
      {[-9.3, -6.3, -3.45, -1.2, 1.2, 3.45, 6.3, 9.3].map((x, i) => (
        <group key={i}>
          {[2.4, 6.9].map((y, f) => (
            <group key={f} position={[x, y, Math.abs(x) < 2.2 ? 4.52 : 3.12]}>
              <mesh material={glassMat}>
                <planeGeometry args={[1.05, 2.15]} />
              </mesh>
              {[-0.65, 0.65].map((sx) => (
                <mesh key={sx} position={[sx, 0, 0.05]} material={shutterMat}>
                  <boxGeometry args={[0.24, 2.2, 0.08]} />
                </mesh>
              ))}
              <mesh position={[0, 1.22, 0.04]} material={trimMat}>
                <boxGeometry args={[1.6, 0.22, 0.14]} />
              </mesh>
            </group>
          ))}
        </group>
      ))}

      {/* MÁI ĐÓN SẢNH CHÍNH */}
      <mesh position={[0, 4.6, 5.5]} material={trimMat} castShadow>
        <boxGeometry args={[5.4, 0.28, 2.6]} />
      </mesh>

      {/* MÁI NGÓI ĐẤT NUNG CHÍNH */}
      <mesh position={[0, 9.85, -0.3]} geometry={roofGeo} material={roofMat} castShadow />
    </group>
  )
}

// ------------------------------------------------------------------ Thư viện Thông minh (Khối Kính–Gỗ ấm, nhìn xuyên vào kệ sách & video ký ức)
function SmartLibrary() {
  const e = E.rubik
  const { frameMat, woodMat, glassMat, lampMat, bookColors, screenMat } = useMemo(() => {
    const wood = createWoodPBR('#9a6840', 2, 1)
    const scr = patchNew(
      new THREE.ShaderMaterial({
        uniforms: { uTex: { value: reel.tex }, uMus: WU.uMus },
        vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: 'uniform sampler2D uTex; uniform vec4 uMus; varying vec2 vUv; void main(){ vec3 c=texture2D(uTex, vUv).rgb; gl_FragColor=vec4(c*(0.85+uMus.y*0.4), 0.92); }',
        transparent: true,
        toneMapped: false,
      }),
      { grow: true, growLen: 14 },
    )
    return {
      frameMat: patchNew(new THREE.MeshStandardMaterial({ color: '#242d34', metalness: 0.72, roughness: 0.35 }), { grow: true, growLen: 16 }),
      woodMat: patchNew(new THREE.MeshStandardMaterial({ map: wood.map, bumpMap: wood.bumpMap, bumpScale: 0.02, roughness: 0.65 }), { grow: true, growLen: 16 }),
      glassMat: patchNew(new THREE.MeshPhysicalMaterial({ color: '#d2eaee', transparent: true, opacity: 0.24, roughness: 0.06, metalness: 0.1, clearcoat: 1, depthWrite: false }), { grow: true, growLen: 16 }),
      lampMat: patchNew(new THREE.MeshStandardMaterial({ color: '#fff3d6', emissive: new THREE.Color('#ffbe66'), emissiveIntensity: 1.4, roughness: 0.3 }), { grow: true, growLen: 16 }),
      bookColors: [
        patchNew(new THREE.MeshStandardMaterial({ color: '#b44834', roughness: 0.8 }), { grow: true, growLen: 14 }),
        patchNew(new THREE.MeshStandardMaterial({ color: UEH_TEAL, roughness: 0.8 }), { grow: true, growLen: 14 }),
        patchNew(new THREE.MeshStandardMaterial({ color: '#d89b42', roughness: 0.8 }), { grow: true, growLen: 14 }),
      ],
      screenMat: scr,
    }
  }, [])
  useFrame(() => {
    screenMat.uniforms.uTex.value = reel.tex
  })
  return (
    <group position={[e.x, 0, e.z]} rotation={[0, -0.45, 0]}>
      {/* bệ thềm đá */}
      <mesh position={[0, 0.2, 0]} material={frameMat} receiveShadow>
        <boxGeometry args={[11.6, 0.4, 10.6]} />
      </mesh>
      {/* 3 sàn thư viện gỗ sồi ấm + kệ sách + đèn thả trần */}
      {[0.45, 3.85, 7.25].map((y, fl) => (
        <group key={fl}>
          <mesh position={[0, y, 0]} material={woodMat} castShadow receiveShadow>
            <boxGeometry args={[10.4, 0.24, 9.4]} />
          </mesh>
          {/* giá sách gỗ phía sau có hàng sách màu */}
          {[-3.0, 0, 3.0].map((x, si) => (
            <group key={si} position={[x, y + 0.12, -3.5]}>
              <mesh position={[0, 1.35, 0]} material={woodMat} castShadow>
                <boxGeometry args={[2.3, 2.7, 0.45]} />
              </mesh>
              {[0.55, 1.25, 1.95].map((sy, r) => (
                <mesh key={r} position={[0, sy, 0.15]} material={bookColors[(si + r + fl) % 3]}>
                  <boxGeometry args={[2.0, 0.32, 0.22]} />
                </mesh>
              ))}
            </group>
          ))}
          {/* bàn học nhóm + đèn thả */}
          {fl < 2 && (
            <group position={[0, y + 0.12, 1.1]}>
              <mesh position={[0, 0.74, 0]} material={woodMat} castShadow>
                <boxGeometry args={[5.4, 0.08, 1.4]} />
              </mesh>
              <mesh position={[0, 2.6, 0]} material={lampMat}>
                <boxGeometry args={[4.2, 0.08, 0.16]} />
              </mesh>
            </group>
          )}
        </group>
      ))}
      {/* bức tường màn ký ức lồng trong sảnh thư viện */}
      <mesh position={[-3.2, 4.0, -1.2]} rotation={[0, 0.35, 0]} material={screenMat}>
        <planeGeometry args={[3.6, 2.025]} />
      </mesh>
      {/* khung thép đen + mái */}
      {[[-5.3, -4.8], [5.3, -4.8], [-5.3, 4.8], [5.3, 4.8], [0, 4.8]].map(([x, z], i) => (
        <mesh key={i} position={[x, 5.5, z]} material={frameMat} castShadow>
          <boxGeometry args={[0.26, 10.6, 0.26]} />
        </mesh>
      ))}
      <mesh position={[0, 10.8, 0]} material={frameMat} castShadow>
        <boxGeometry args={[11.2, 0.36, 10.2]} />
      </mesh>
      {/* vách kính bao quanh */}
      <mesh position={[0, 5.5, 0]} material={glassMat}>
        <boxGeometry args={[10.5, 10.3, 9.5]} />
      </mesh>
    </group>
  )
}

// ------------------------------------------------------------------ Sân khấu Acoustic Sân Trường (vị trí Stage)
function CampusStage() {
  const e = E.stage
  const bulbs = useRef<THREE.InstancedMesh>(null)
  const { woodMat, steelMat, scrMat, bulbMat } = useMemo(() => {
    const wood = createWoodPBR('#7f5233', 3, 2)
    const scr = patchNew(
      new THREE.ShaderMaterial({
        uniforms: { uTex: { value: reel.tex }, uMus: WU.uMus },
        vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: `uniform sampler2D uTex; uniform vec4 uMus; varying vec2 vUv;
          void main(){ vec3 c=texture2D(uTex, vUv).rgb;
            vec2 e = abs(vUv-0.5)*2.0; float vig = 1.0 - smoothstep(0.65, 1.02, max(e.x, e.y));
            gl_FragColor = vec4(c * (0.95 + uMus.y * 0.45) * (0.45 + vig * 0.65), 1.0); }`,
        toneMapped: false,
      }),
      { grow: true, growLen: 14 },
    )
    return {
      woodMat: patchNew(new THREE.MeshStandardMaterial({ map: wood.map, bumpMap: wood.bumpMap, bumpScale: 0.025, roughness: 0.65 }), { grow: true, growLen: 12 }),
      steelMat: patchNew(new THREE.MeshStandardMaterial({ color: '#1f252b', metalness: 0.78, roughness: 0.38 }), { grow: true, growLen: 14 }),
      scrMat: scr,
      bulbMat: patchNew(new THREE.MeshStandardMaterial({ color: '#ffe5b4', emissive: new THREE.Color('#ffaa44'), emissiveIntensity: 1.8, roughness: 0.25 }), { grow: true, growLen: 14 }),
    }
  }, [])
  useEffect(() => {
    const im = bulbs.current
    if (!im) return
    const m = new THREE.Matrix4()
    let i = 0
    for (let l = 0; l < 3; l++) {
      for (let k = 0; k < 20; k++) {
        const t = k / 19
        const x = -7 + t * 14
        const y = 7.2 - Math.sin(t * Math.PI) * 1.15
        m.makeTranslation(x, y, -2.5 + l * 2.5)
        im.setMatrixAt(i++, m)
      }
    }
    im.instanceMatrix.needsUpdate = true
  }, [])
  useFrame(() => {
    scrMat.uniforms.uTex.value = reel.tex
  })
  return (
    <group position={[e.x, 0, e.z]} rotation={[0, e.rotY, 0]}>
      <mesh position={[0, 0.48, 0]} material={woodMat} castShadow receiveShadow>
        <boxGeometry args={[14.6, 0.96, 8.2]} />
      </mesh>
      {[0, 1, 2].map((s) => (
        <mesh key={s} position={[0, 0.14 + s * 0.26, 4.4 - s * 0.25]} material={woodMat} receiveShadow>
          <boxGeometry args={[6.0, 0.26, 0.9]} />
        </mesh>
      ))}
      {/* khung giàn thép mảnh */}
      {[[-7.0, -3.8], [7.0, -3.8], [-7.0, 3.6], [7.0, 3.6]].map(([x, z], i) => (
        <mesh key={i} position={[x, 4.3, z]} material={steelMat} castShadow>
          <boxGeometry args={[0.28, 7.6, 0.28]} />
        </mesh>
      ))}
      <mesh position={[0, 8.1, 0]} material={steelMat}>
        <boxGeometry args={[14.6, 0.24, 8.0]} />
      </mesh>
      {/* backdrop gỗ + màn ký ức chính */}
      <mesh position={[0, 4.3, -3.7]} material={woodMat} castShadow>
        <boxGeometry args={[13.6, 6.8, 0.26]} />
      </mesh>
      <mesh position={[0, 4.4, -3.52]} material={scrMat}>
        <planeGeometry args={[9.6, 5.4]} />
      </mesh>
      {/* cặp loa đứng sân khấu */}
      {[-5.9, 5.9].map((x) => (
        <mesh key={x} position={[x, 2.0, 2.6]} material={steelMat} castShadow>
          <boxGeometry args={[0.85, 2.1, 0.85]} />
        </mesh>
      ))}
      <instancedMesh ref={bulbs} args={[undefined, bulbMat, 60]} frustumCulled={false}>
        <sphereGeometry args={[0.07, 6, 5]} />
      </instancedMesh>
    </group>
  )
}

// ------------------------------------------------------------------ Góc Sinh Viên & Nhà Xe (vị trí Products)
function StudentCorner() {
  const e = E.products
  const { steelMat, polyRoofMat, woodMat, bikeBodyMat, chromeMat, tireMat, seatMat, paperMat, boardMat } = useMemo(() => {
    const wood = createWoodPBR('#9e683e', 2, 1)
    const board = canvasTex(360, 240, (c) => {
      c.fillStyle = '#f3eee2'
      c.fillRect(0, 0, 360, 240)
      c.fillStyle = UEH_TEAL
      c.fillRect(0, 0, 360, 46)
      c.fillStyle = '#ffffff'
      c.font = `700 22px ${FONT}`
      c.fillText('BẢNG TIN SINH VIÊN · UEH', 18, 30)
      c.fillStyle = '#334047'
      c.font = `600 16px ${FONT}`
      c.fillText('• Tuyến xe buýt qua 279 Nguyễn Tri Phương:', 18, 86)
      c.fillStyle = UEH_ORANGE
      c.font = `700 22px ${FONT}`
      c.fillText('   07  ·  10  ·  45  ·  59  ·  150', 18, 118)
      c.fillStyle = '#4c585f'
      c.font = `500 15px ${FONT}`
      c.fillText('• Câu lạc bộ & Không gian tự học B1/B2', 18, 160)
      c.fillText('• Acoustic Chiều Thứ Sáu — Sân giữa', 18, 190)
    })
    return {
      steelMat: patchNew(new THREE.MeshStandardMaterial({ color: '#2b343b', metalness: 0.72, roughness: 0.38 }), { grow: true, growLen: 12 }),
      polyRoofMat: patchNew(new THREE.MeshPhysicalMaterial({ color: '#e6decb', transparent: true, opacity: 0.78, roughness: 0.25, side: THREE.DoubleSide }), { grow: true, growLen: 14 }),
      woodMat: patchNew(new THREE.MeshStandardMaterial({ map: wood.map, bumpMap: wood.bumpMap, bumpScale: 0.02, roughness: 0.6 }), { grow: true, growLen: 10 }),
      bikeBodyMat: patchNew(new THREE.MeshStandardMaterial({ color: '#27313b', roughness: 0.35, metalness: 0.55 }), { grow: true, growLen: 10 }),
      chromeMat: patchNew(new THREE.MeshStandardMaterial({ color: '#cfd6dc', roughness: 0.2, metalness: 0.92 }), { grow: true, growLen: 10 }),
      tireMat: patchNew(new THREE.MeshStandardMaterial({ color: '#141618', roughness: 0.88 }), { grow: true, growLen: 10 }),
      seatMat: patchNew(new THREE.MeshStandardMaterial({ color: '#3b2418', roughness: 0.75 }), { grow: true, growLen: 10 }),
      paperMat: patchNew(new THREE.MeshStandardMaterial({ color: '#f5efe0', roughness: 0.9 }), { grow: true, growLen: 10 }),
      boardMat: patchNew(new THREE.MeshStandardMaterial({ map: board, roughness: 0.5 }), { grow: true, growLen: 12 }),
    }
  }, [])

  return (
    <group position={[e.x, 0, e.z]} rotation={[0, -0.45, 0]}>
      {/* mái che kính mờ khung thép thanh mảnh */}
      {[[-4.6, -2.6], [4.6, -2.6], [-4.6, 2.6], [4.6, 2.6]].map(([x, z], i) => (
        <mesh key={i} position={[x, 1.9, z]} material={steelMat} castShadow>
          <cylinderGeometry args={[0.09, 0.1, 3.8, 10]} />
        </mesh>
      ))}
      <mesh position={[0, 3.85, 0]} rotation={[0.06, 0, 0]} material={polyRoofMat} castShadow>
        <boxGeometry args={[10.4, 0.12, 6.4]} />
      </mesh>
      {/* 2 bàn gỗ dài sinh viên ngồi học bài + sổ tay */}
      {[-2.2, 2.2].map((x, idx) => (
        <group key={idx} position={[x, 0, 0]}>
          <mesh position={[0, 0.76, 0]} material={woodMat} castShadow receiveShadow>
            <boxGeometry args={[2.6, 0.08, 1.05]} />
          </mesh>
          {[-1.05, 1.05].map((lx) => (
            <mesh key={lx} position={[lx, 0.38, 0]} material={steelMat}>
              <boxGeometry args={[0.08, 0.76, 0.88]} />
            </mesh>
          ))}
          {[-0.82, 0.82].map((bz) => (
            <mesh key={bz} position={[0, 0.44, bz]} material={woodMat} castShadow>
              <boxGeometry args={[2.4, 0.06, 0.36]} />
            </mesh>
          ))}
          <mesh position={[0.2 * (idx ? -1 : 1), 0.81, 0.1]} rotation={[0, 0.28, 0]} material={paperMat}>
            <boxGeometry args={[0.32, 0.025, 0.24]} />
          </mesh>
        </group>
      ))}
      {/* bảng tin UEH & tuyến xe buýt */}
      <group position={[5.6, 0, -1.2]} rotation={[0, -0.4, 0]}>
        <mesh position={[-1.1, 1.3, 0]} material={steelMat} castShadow>
          <cylinderGeometry args={[0.05, 0.05, 2.6, 8]} />
        </mesh>
        <mesh position={[1.1, 1.3, 0]} material={steelMat} castShadow>
          <cylinderGeometry args={[0.05, 0.05, 2.6, 8]} />
        </mesh>
        <mesh position={[0, 1.7, 0.02]} material={boardMat} castShadow>
          <boxGeometry args={[2.4, 1.6, 0.08]} />
        </mesh>
      </group>
      {/* dãy xe máy sinh viên dựng gọn (chi tiết 2 bánh, phuộc, yên da, gương) */}
      {Array.from({ length: 6 }).map((_, i) => (
        <group key={i} position={[-3.6 + i * 1.45, 0, 5.2]} rotation={[0, Math.PI * 0.5 + (i % 2 ? 0.08 : -0.05), 0]}>
          {/* bánh trước + sau */}
          {[-0.58, 0.58].map((wx) => (
            <group key={wx} position={[wx, 0.28, 0]}>
              <mesh rotation={[Math.PI / 2, 0, 0]} material={tireMat} castShadow>
                <torusGeometry args={[0.24, 0.065, 8, 16]} />
              </mesh>
              <mesh rotation={[Math.PI / 2, 0, 0]} material={chromeMat}>
                <cylinderGeometry args={[0.16, 0.16, 0.05, 10]} />
              </mesh>
            </group>
          ))}
          {/* thân xe thuôn + yên da + tay lái + gương */}
          <mesh position={[-0.1, 0.52, 0]} rotation={[0, 0, -0.08]} material={bikeBodyMat} castShadow>
            <boxGeometry args={[1.15, 0.28, 0.34]} />
          </mesh>
          <mesh position={[-0.22, 0.69, 0]} material={seatMat} castShadow>
            <boxGeometry args={[0.68, 0.1, 0.28]} />
          </mesh>
          <mesh position={[0.45, 0.66, 0]} rotation={[0, 0, 0.32]} material={bikeBodyMat}>
            <boxGeometry args={[0.24, 0.56, 0.28]} />
          </mesh>
          <mesh position={[0.38, 0.96, 0]} material={chromeMat}>
            <boxGeometry args={[0.05, 0.05, 0.62]} />
          </mesh>
          {[-0.26, 0.26].map((mz) => (
            <mesh key={mz} position={[0.36, 1.07, mz]} material={chromeMat}>
              <boxGeometry args={[0.03, 0.12, 0.08]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

// ------------------------------------------------------------------ Cổng Trường UEH & Cột Cờ Lá Cờ Bay Theo Gió (vị trí Beacon)
function CampusGate() {
  const e = E.beacon
  const { stoneMat, tealMat, orangeMat, chromeMat, signMat, flagMat } = useMemo(() => {
    const conc = createConcretePBR('#e6e0d4', 1, 2)
    const sign = canvasTex(768, 160, (c) => {
      c.fillStyle = UEH_TEAL
      c.fillRect(0, 0, 768, 160)
      c.fillStyle = UEH_ORANGE
      c.fillRect(0, 142, 768, 18)
      c.fillStyle = '#ffffff'
      c.font = `700 68px ${FONT}`
      c.textAlign = 'left'
      c.fillText('UEH', 44, 98)
      c.fillStyle = '#d7ecef'
      c.font = `600 25px ${FONT}`
      c.fillText('UNIVERSITY OF ECONOMICS', 220, 66)
      c.fillText('HO CHI MINH CITY', 220, 102)
    })
    const flagTex = canvasTex(256, 170, (c) => {
      c.fillStyle = '#c81d25'
      c.fillRect(0, 0, 256, 170)
      c.fillStyle = '#ffda38'
      c.beginPath()
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5
        const r = i % 2 ? 22 : 54
        c.lineTo(128 + Math.cos(a) * r, 85 + Math.sin(a) * r)
      }
      c.fill()
    })
    const flagShader = patchNew(
      new THREE.ShaderMaterial({
        uniforms: { uTex: { value: flagTex }, uT: WU.uTime },
        vertexShader: `uniform float uT; varying vec2 vUv; varying float vShade;
          void main(){ vUv = uv; vec3 p = position;
            float w = uv.x * (sin(uv.x * 7.0 - uT * 4.2) * 0.22 + cos(uv.y * 4.0 - uT * 2.8) * 0.08);
            p.z += w;
            vShade = 0.85 + cos(uv.x * 7.0 - uT * 4.2) * 0.16;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
        fragmentShader: `uniform sampler2D uTex; varying vec2 vUv; varying float vShade;
          void main(){ vec3 c = texture2D(uTex, vUv).rgb * vShade; gl_FragColor = vec4(c, 1.0); }`,
        side: THREE.DoubleSide,
      }),
      { grow: true, growLen: 26 },
    )
    return {
      stoneMat: patchNew(new THREE.MeshStandardMaterial({ map: conc.map, bumpMap: conc.bumpMap, bumpScale: 0.02, roughness: 0.78 }), { grow: true, growLen: 14 }),
      tealMat: patchNew(new THREE.MeshStandardMaterial({ color: UEH_TEAL, roughness: 0.42, metalness: 0.12 }), { grow: true, growLen: 14 }),
      orangeMat: patchNew(new THREE.MeshStandardMaterial({ color: UEH_ORANGE, roughness: 0.42 }), { grow: true, growLen: 14 }),
      chromeMat: patchNew(new THREE.MeshStandardMaterial({ color: '#d8dee2', metalness: 0.9, roughness: 0.22 }), { grow: true, growLen: 24 }),
      signMat: patchNew(new THREE.MeshStandardMaterial({ map: sign, roughness: 0.35 }), { grow: true, growLen: 14 }),
      flagMat: flagShader,
    }
  }, [])

  return (
    <group position={[e.x, 0, e.z]} rotation={[0, 0.28, 0]}>
      {/* 2 trụ cổng đá + dải màu nhận diện */}
      {[-4.2, 4.2].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh material={stoneMat} castShadow receiveShadow>
            <primitive object={baseBox(1.3, 5.8, 1.3)} attach="geometry" />
          </mesh>
          <mesh position={[0, 2.9, 0.67]} material={tealMat}>
            <boxGeometry args={[0.32, 5.4, 0.08]} />
          </mesh>
          <mesh position={[0.24, 2.9, 0.67]} material={orangeMat}>
            <boxGeometry args={[0.14, 5.4, 0.08]} />
          </mesh>
        </group>
      ))}
      {/* xà ngang cổng + bảng tên UEH */}
      <mesh position={[0, 5.9, 0]} material={tealMat} castShadow>
        <boxGeometry args={[10.4, 1.5, 1.35]} />
      </mesh>
      <mesh position={[0, 5.9, 0.69]} material={signMat}>
        <planeGeometry args={[7.4, 1.54]} />
      </mesh>
      {/* cột cờ inox 15m + đế đá + lá cờ bay thật */}
      <group position={[8.6, 0, 0.8]}>
        <mesh position={[0, 0.35, 0]} material={stoneMat} receiveShadow>
          <cylinderGeometry args={[1.1, 1.3, 0.7, 16]} />
        </mesh>
        <mesh material={chromeMat} castShadow>
          <primitive object={baseBox(0.18, 15.2, 0.18)} attach="geometry" />
        </mesh>
        <mesh position={[1.55, 13.8, 0]} material={flagMat}>
          <planeGeometry args={[3.1, 2.05, 18, 8]} />
        </mesh>
      </group>
    </group>
  )
}

export function UEHWorld() {
  const track = useReality((s) => s.track) ?? 'mua-ha'
  const tr = TRACKS[track]
  return (
    <group>
      <SkyDome world="ueh" />
      <Underside palette="ueh" />
      <CourtyardGround />
      <CampusB />
      <CampusA />
      <SmartLibrary />
      <CampusStage />
      <StudentCorner />
      <CampusGate />
      <UEHFoliage />
      <SummerRain />
      <FlamboyantWind />
      <Drift mode="rise" count={140} colA="#ffe0a3" colB="#fff4d8" size={0.55} />
      <MemoryFrames id={track} accent={tr.accent} />
    </group>
  )
}
