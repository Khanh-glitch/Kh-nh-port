import { memo, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { audio, type Bus } from '../audio'
import { toast } from '../store'
import { FONT, beamGeometry, beamMaterial, canvasTex, rand, roundRect } from '../gfx'
import { Hit } from './Hit'
import { Label } from './Label'
import { PadRing, isFacing } from './common'
import { collectScanCullMeshes, updateScanCullMeshes, createMaterializeUniforms, patchMaterialize } from './materialize'
import { applyUV, getRagnarokAtlas } from './ragnarokSprites'
import { RagnarokWeather } from './RagnarokWeather'
import type { ShowcaseProps } from './ApexShowcase'

type Weather = 0 | 1 | 2 // 0: Sunny Island, 1: Golden Dusk, 2: Ragnarok Storm
const WEATHER_NAMES = ['SUNNY ISLAND', 'GOLDEN DUSK', 'RAGNAROK STORM']
const WEATHER_COLORS = ['#5dffb0', '#ffaa44', '#a078ff']

function makeIslandDeckTex() {
  const S = 512
  const { tex } = canvasTex(S, S, (ctx) => {
    ctx.fillStyle = '#0e161b'
    ctx.fillRect(0, 0, S, S)
    ctx.strokeStyle = '#1e353f'
    ctx.lineWidth = 3
    for (let r = 64; r < S / 2; r += 40) {
      ctx.beginPath()
      ctx.arc(S / 2, S / 2, r, 0, Math.PI * 2)
      ctx.stroke()
    }
    // Rune tick marks
    ctx.strokeStyle = '#4de8a8'
    ctx.lineWidth = 4
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2
      ctx.beginPath()
      ctx.moveTo(S / 2 + Math.cos(a) * 195, S / 2 + Math.sin(a) * 195)
      ctx.lineTo(S / 2 + Math.cos(a) * 218, S / 2 + Math.sin(a) * 218)
      ctx.stroke()
    }
  })
  return tex
}

function makePixelPopupTex(text: string, color: string) {
  const { tex } = canvasTex(256, 96, (ctx) => {
    ctx.clearRect(0, 0, 256, 96)
    ctx.font = `800 44px ${FONT}`
    ctx.textAlign = 'center'
    ctx.lineWidth = 8
    ctx.strokeStyle = '#140c14'
    ctx.strokeText(text, 128, 62)
    ctx.fillStyle = color
    ctx.fillText(text, 128, 62)
  })
  return tex
}

function RagnarokShowcaseImpl({ position, worldPosition, rotationY, summoned, scanProgressRef, scanWorldYRef, activeRef, onRequestSummon, onFocus }: ShowcaseProps) {
  const busRef = useRef<Bus | null>(null)
  const exhibitRef = useRef<THREE.Group>(null)
  const showcaseRootRef = useRef<THREE.Group>(null)
  const fireLightAnchor = useRef<THREE.Group>(null)
  const islandLightAnchor = useRef<THREE.Group>(null)
  const lightWorld = useMemo(() => new THREE.Vector3(), [])
  const plinthRef = useRef<THREE.Group>(null)
  const titleRef = useRef<THREE.Group>(null)
  const treeRefs = useRef<Array<THREE.Group | null>>([])
  const weatherRef = useRef<Weather>(0)
  const islandGroup = useRef<THREE.Group>(null)
  const scanCullEntries = useRef<ReturnType<typeof collectScanCullMeshes> | null>(null)
  const scanRingRef = useRef<THREE.Mesh>(null)
  const holoBeamRef = useRef<THREE.Mesh>(null)
  const hudCardRef = useRef<THREE.Mesh>(null)
  const islandLight = useRef<THREE.PointLight>(null)
  const fireLight = useRef<THREE.PointLight>(null)

  // Pixel Sprite Mesh Refs
  const heroMesh = useRef<THREE.Mesh>(null)
  const heroGeo = useMemo(() => new THREE.PlaneGeometry(0.74, 1.08), [])
  const heroShadow = useRef<THREE.Mesh>(null)
  const monsterMesh = useRef<THREE.Mesh>(null)
  const monsterGeo = useMemo(() => new THREE.PlaneGeometry(0.92, 0.76), [])
  const bossMesh = useRef<THREE.Mesh>(null)
  const bossGeo = useMemo(() => new THREE.PlaneGeometry(1.5, 1.5), [])
  const fireMesh = useRef<THREE.Mesh>(null)
  const fireGeo = useMemo(() => new THREE.PlaneGeometry(0.55, 0.55), [])
  const chestMesh = useRef<THREE.Mesh>(null)
  const chestGeo = useMemo(() => new THREE.PlaneGeometry(0.54, 0.54), [])
  const slashMesh = useRef<THREE.Mesh>(null)
  const slashGeo = useMemo(() => new THREE.PlaneGeometry(0.75, 0.75), [])
  const coinMesh = useRef<THREE.Mesh>(null)
  const coinGeo = useMemo(() => new THREE.PlaneGeometry(0.32, 0.32), [])
  const gemMesh = useRef<THREE.Mesh>(null)
  const gemGeo = useMemo(() => new THREE.PlaneGeometry(0.32, 0.32), [])
  const popupMesh = useRef<THREE.Mesh>(null)
  const sparksRef = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const tmpColor = useMemo(() => new THREE.Color(), [])
  const wp = useMemo(() => new THREE.Vector3(), [])

  const atlas = useMemo(() => getRagnarokAtlas(), [])
  const matUniforms = useMemo(() => createMaterializeUniforms('#5dffb0'), [])
  useEffect(() => {
    if (islandGroup.current) {
      // Dynamic pixel actors have independent visibility/ability rules.
      // Culling only controls otherwise-static, shader-clipped island meshes.
      const skip = new Set<THREE.Object3D>()
      for (const x of [heroMesh.current, monsterMesh.current, bossMesh.current,
        fireMesh.current, chestMesh.current, slashMesh.current,
        coinMesh.current, gemMesh.current, popupMesh.current]) {
        if (x) skip.add(x)
      }
      scanCullEntries.current = collectScanCullMeshes(islandGroup.current, skip)
    }
    return () => { scanCullEntries.current = null }
  }, [])

  // Pre-build static UVs for trees & crystal node
  const treePineGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(1.15, 1.72)
    applyUV(g, atlas.uvs.tree_pine)
    return g
  }, [atlas])
  const treeOakGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(1.15, 1.72)
    applyUV(g, atlas.uvs.tree_oak)
    return g
  }, [atlas])
  const crystalGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(0.72, 0.72)
    applyUV(g, atlas.uvs.crystal)
    return g
  }, [atlas])

  const popupTexes = useMemo(
    () => ({
      hit: makePixelPopupTex('-28', '#ff644a'),
      crit: makePixelPopupTex('CRIT -56!', '#ffd440'),
      loot: makePixelPopupTex('+LOOT!', '#5dffb0'),
      ore: makePixelPopupTex('+1 CRYSTAL', '#64ecff'),
    }),
    [],
  )

  const materials = useMemo(() => {
    const grass = patchMaterialize(
      new THREE.MeshStandardMaterial({ map: atlas.grassTex, roughness: 0.85, metalness: 0.05 }),
      matUniforms,
      'rag-grass',
    )
    const cliff = patchMaterialize(
      new THREE.MeshStandardMaterial({ map: atlas.cliffTex, roughness: 0.9, metalness: 0.1 }),
      matUniforms,
      'rag-cliff',
    )
    const rune = patchMaterialize(
      new THREE.MeshStandardMaterial({
        color: '#46f0ff',
        emissive: '#18c8ff',
        emissiveIntensity: 1.8,
        roughness: 0.2,
        metalness: 0.4,
      }),
      matUniforms,
      'rag-rune',
    )
    const spriteMat = patchMaterialize(new THREE.MeshBasicMaterial({
      map: atlas.texture,
      transparent: true,
      alphaTest: 0.35,
      side: THREE.DoubleSide,
    }), matUniforms, 'rag-pixel-sprite')
    const deckMat = new THREE.MeshStandardMaterial({ map: makeIslandDeckTex(), roughness: 0.55, metalness: 0.7 })
    return { grass, cliff, rune, spriteMat, deckMat }
  }, [atlas, matUniforms])

  // Translucent Pixel-Water Shader
  const waterMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: { uTime: { value: 0 }, uWeather: { value: 0 }, uAlpha: { value: 0 }, uReveal: { value: 0 } },
        vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: /* glsl */ `
          varying vec2 vP;
          uniform float uTime, uWeather, uAlpha, uReveal;
          void main(){
            float r = length(vP);
            // Materialize the horizontal water surface as a moving pixel-wave,
            // only AFTER the laser reaches the water plane (never a pre-made disc).
            vec2 cells = floor(vP * 21.0);
            float pixelNoise = fract(sin(dot(cells, vec2(12.9898,78.233))) * 43758.5453);
            if (uReveal < 0.999 && (r / 2.85) * 0.80 + pixelNoise * 0.20 > uReveal) discard;
            // Quantize coords for pixel-art ocean feel!
            vec2 q = floor(vP * 14.0) / 14.0;
            float wave = sin(q.x * 5.0 + uTime * 2.2) * cos(q.y * 5.0 - uTime * 1.8);
            float shore = smoothstep(2.15, 1.98, r);
            float foam = step(0.45, fract(r * 3.5 - uTime * 0.5 + wave * 0.15)) * shore;
            vec3 dayWater = mix(vec3(0.08, 0.55, 0.72), vec3(0.18, 0.78, 0.88), 0.5 + 0.5 * wave);
            vec3 stormWater = mix(vec3(0.06, 0.22, 0.45), vec3(0.28, 0.35, 0.78), 0.5 + 0.5 * wave);
            vec3 col = mix(dayWater, stormWater, clamp(uWeather * 0.5, 0.0, 1.0));
            col = mix(col, vec3(0.88, 0.98, 1.0), foam * 0.65);
            float rim = smoothstep(2.72, 2.55, r);
            gl_FragColor = vec4(col, (0.72 + foam * 0.22) * rim * uAlpha);
          }`,
      }),
    [],
  )

  const hud = useMemo(() => {
    const W = 512
    const H = 192
    const c = canvasTex(W, H, () => {})
    return { ...c, W, H }
  }, [])

  const sim = useRef({
    weather: 0 as Weather,
    loopT: 0,
    phase: 0, // 0: patrol/mine, 1: approach monster, 2: combat clash, 3: loot pickup, 4: campfire rest
    hx: 0.2,
    hz: 0.4,
    hFlip: false,
    mx: -0.9,
    mz: 0.6,
    mKind: 'boar' as 'boar' | 'wolf',
    mAlive: true,
    bossOn: false,
    bossT: 0,
    chestOpen: false,
    lootOn: false,
    lx: -0.8,
    lz: 0.6,
    slashT: 99,
    popT: 99,
    popType: 'hit' as 'hit' | 'crit' | 'loot' | 'ore',
    popX: 0,
    popZ: 0,
    kills: 0,
    loots: 0,
    lastHudKey: '',
    sparks: Array.from({ length: 30 }, () => ({ life: 0, dur: 0.6, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 })),
    sparkIdx: 0,
  }).current

  const drawHud = (active: boolean) => {
    const { ctx, W, H, tex } = hud
    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = 'rgba(8, 16, 18, 0.84)'
    roundRect(ctx, 8, 8, W - 16, H - 16, 20)
    ctx.fill()
    ctx.strokeStyle = active ? WEATHER_COLORS[sim.weather] : '#586278'
    ctx.lineWidth = 3
    ctx.stroke()

    ctx.fillStyle = WEATHER_COLORS[sim.weather]
    ctx.font = `700 16px ${FONT}`
    ctx.textAlign = 'left'
    ctx.fillText('RAGNAROK // 2.5D', 28, 44)

    ctx.textAlign = 'right'
    ctx.fillStyle = active ? '#5dffb0' : '#9aa4b8'
    ctx.fillText(active ? WEATHER_NAMES[sim.weather] : 'STANDBY', W - 28, 44)

    ctx.textAlign = 'left'
    ctx.fillStyle = '#ffffff'
    ctx.font = `800 32px ${FONT}`
    ctx.fillText(sim.bossOn ? 'ELDER BOSS SURGE!' : 'THE LAST ISLAND', 28, 96)

    ctx.fillStyle = 'rgba(93, 255, 176, 0.14)'
    roundRect(ctx, 28, 118, W - 56, 46, 10)
    ctx.fill()
    ctx.fillStyle = '#d4ffe8'
    ctx.font = `600 17px ${FONT}`
    ctx.fillText(
      active ? `KILLS ${sim.kills} · LOOT ${sim.loots} · CLICK: BOSS SURGE` : 'CHỜ TRIỆU HỒI TỪ COLOSSUS',
      42,
      148,
    )
    tex.needsUpdate = true
  }

  useEffect(() => {
    const posV = new THREE.Vector3(...worldPosition)
    busRef.current = audio.createBus('ragnarok', posV, { ref: 4.5, rolloff: 1.25, maxDist: 95, reverb: 0.35, gain: 0.9 })
    drawHud(false)
    applyUV(heroGeo, atlas.uvs.hero_walk_side_0)
    applyUV(monsterGeo, atlas.uvs.boar_0)
    applyUV(bossGeo, atlas.uvs.elder_0)
    applyUV(fireGeo, atlas.uvs.fire_0)
    applyUV(chestGeo, atlas.uvs.chest_closed)
    applyUV(slashGeo, atlas.uvs.slash)
    applyUV(coinGeo, atlas.uvs.coin)
    applyUV(gemGeo, atlas.uvs.gem)
    const sp = sparksRef.current
    if (sp) {
      dummy.scale.setScalar(0)
      dummy.updateMatrix()
      for (let i = 0; i < 30; i++) {
        sp.setMatrixAt(i, dummy.matrix)
        sp.setColorAt(i, tmpColor.set('#5dffb0'))
      }
      sp.instanceMatrix.needsUpdate = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const spawnPixelSparks = (x: number, y: number, z: number, count: number, colorHex: string) => {
    const sp = sparksRef.current
    if (!sp) return
    for (let i = 0; i < count; i++) {
      const idx = sim.sparkIdx++ % sim.sparks.length
      const p = sim.sparks[idx]
      p.life = p.dur = rand(0.35, 0.75)
      p.x = x
      p.y = y
      p.z = z
      const a = rand(0, Math.PI * 2)
      const spd = rand(0.8, 2.4)
      p.vx = Math.cos(a) * spd
      p.vy = rand(1.1, 2.6)
      p.vz = Math.sin(a) * spd
      sp.setColorAt(idx, tmpColor.set(colorHex).multiplyScalar(2.4))
    }
    if (sp.instanceColor) sp.instanceColor.needsUpdate = true
  }

  const triggerBossSurge = () => {
    if (!activeRef.current) {
      onRequestSummon()
      return
    }
    onFocus?.()
    sim.weather = ((sim.weather + 1) % 3) as Weather
    weatherRef.current = sim.weather
    sim.bossOn = true
    sim.bossT = 7.5
    sim.chestOpen = true
    sim.lootOn = true
    sim.lx = 0.65
    sim.lz = 0.75
    sim.phase = 2
    sim.loopT = 0
    sim.slashT = 0
    sim.popT = 0
    sim.popType = 'crit'
    sim.popX = -0.35
    sim.popZ = 0.35
    spawnPixelSparks(-0.35, 0.6, 0.35, 18, '#ff9030')
    spawnPixelSparks(0.65, 0.5, 0.75, 12, '#ffd440')
    if (busRef.current) audio.pixelBoss(busRef.current)
    toast(`Ragnarok · ${WEATHER_NAMES[sim.weather]} & Boss Surge!`)
  }

  const oceanRimMat = useMemo(() => patchMaterialize(
    new THREE.MeshBasicMaterial({ color: '#1da8c8', transparent: true, opacity: 0.45,
      side: THREE.DoubleSide, depthWrite: false }), matUniforms, 'rag-ocean-rim'), [matUniforms])
  const runeHaloMat = useMemo(() => patchMaterialize(
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#46f0ff').multiplyScalar(2.0), toneMapped: false }),
    matUniforms, 'rag-rune-halo'), [matUniforms])
  const scanBeamMat = useMemo(() => beamMaterial('#5dffb0', 0.9), [])
  const scanBeamGeo = useMemo(() => beamGeometry(4.4, 2.35, 2.35, 32), [])

  useFrame((s, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const t = s.clock.elapsedTime
    const prog = scanProgressRef.current
    const isAct = activeRef.current

    matUniforms.uTime.value = t
    matUniforms.uScanY.value = scanWorldYRef.current
    matUniforms.uComplete.value = prog >= 0.999 ? 1.0 : 0.0
    waterMat.uniforms.uTime.value = t
    waterMat.uniforms.uWeather.value += (sim.weather - waterMat.uniforms.uWeather.value) * (1 - Math.exp(-3 * dt))
    // The original implementation drew the plinth even while dormant and
    // exposed ALL unpatched sprites / water as soon as progress passed 0.005.
    // Reveal the emitter first; start its island only after the physical scan.
    const plinthReveal = THREE.MathUtils.smoothstep(prog, 0.005, 0.17)
    if (plinthRef.current) {
      plinthRef.current.visible = plinthReveal > 0.0001
      plinthRef.current.scale.set(plinthReveal, Math.max(0.0001, plinthReveal), plinthReveal)
    }
    // CI-only causal isolation; normal portfolio renders the entire original island.
    const omitExhibitForProbe = typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('colossusExhibitProbe') === 'off'
    if (exhibitRef.current) exhibitRef.current.visible = prog > 0.19 && !omitExhibitForProbe
    if (titleRef.current) {
      const titleReveal = THREE.MathUtils.smoothstep(prog, 0.83, 0.99)
      titleRef.current.visible = titleReveal > 0.001
      titleRef.current.scale.setScalar(Math.max(titleReveal, 0.001))
    }
    // Water is a horizontal sheet; give it its own materialization ripple.
    const waterReveal = THREE.MathUtils.smoothstep(prog, 0.26, 0.42)
    waterMat.uniforms.uReveal.value = waterReveal
    waterMat.uniforms.uAlpha.value = waterReveal
    weatherRef.current = sim.weather
    // Weather only starts after completed, with actual atmospheric motion.
    const sway = sim.weather === 2 && isAct ? 0.095 : sim.weather === 1 && isAct ? 0.028 : 0.012
    treeRefs.current.forEach((tree, i) => {
      if (!tree) return
      tree.rotation.z = Math.sin(t * (sim.weather === 2 ? 4.4 : 1.1) + i * 1.7) * sway
      tree.rotation.x = Math.sin(t * (sim.weather === 2 ? 3.6 : 0.9) + i * 2.1) * sway * 0.62
    })

    // Laser fabrication scan ring
    if (scanRingRef.current) {
      const fabricating = prog > 0.01 && prog < 0.999
      scanRingRef.current.visible = fabricating
      if (fabricating) {
        const localY = Math.max(0.15, scanWorldYRef.current - position[1])
        scanRingRef.current.position.y = localY
        scanRingRef.current.rotation.z = -t * 3.5
      }
    }
    if (holoBeamRef.current) {
      holoBeamRef.current.visible = prog > 0.01 && prog < 0.999
    }

    // Floating bob of the island terrarium
    if (islandGroup.current) {
      islandGroup.current.position.y = 1.65 + Math.sin(t * 1.15 + 0.8) * 0.09
      islandGroup.current.rotation.y = Math.sin(t * 0.25) * 0.12
    }

    // Autonomous Survival / Combat / Loot Loop (runs whenever active!)
    const facing = isFacing(s.camera, worldPosition[0], worldPosition[2], 32)
    if (isAct) {
      sim.loopT += dt
      if (sim.bossOn) {
        sim.bossT -= dt
        if (sim.bossT <= 0) sim.bossOn = false
      }

      // 8-second continuous action cycle
      const cyc = sim.loopT % 8.0
      let tx = 0
      let tz = 0
      if (cyc < 2.0) {
        // Mine crystal node
        tx = 0.85
        tz = -0.35
        if (sim.phase !== 0) {
          sim.phase = 0
          sim.mAlive = true
          sim.chestOpen = false
          sim.mKind = sim.mKind === 'boar' ? 'wolf' : 'boar'
          sim.popT = 0
          sim.popType = 'ore'
          sim.popX = 0.9
          sim.popZ = -0.35
          spawnPixelSparks(0.95, 0.55, -0.4, 8, '#4beeff')
        }
      } else if (cyc < 4.4) {
        // Engage monster
        tx = -0.55
        tz = 0.45
        if (sim.phase !== 1) {
          sim.phase = 1
        }
        if (cyc > 3.5 && sim.mAlive) {
          // Strike & defeat monster!
          sim.mAlive = false
          sim.lootOn = true
          sim.lx = sim.mx
          sim.lz = sim.mz
          sim.slashT = 0
          sim.popT = 0
          sim.popType = Math.random() < 0.4 ? 'crit' : 'hit'
          sim.popX = sim.mx
          sim.popZ = sim.mz
          sim.kills++
          spawnPixelSparks(sim.mx, 0.45, sim.mz, 14, '#ff7040')
          if (facing && busRef.current) audio.pixelSlash(busRef.current)
        }
      } else if (cyc < 6.4) {
        // Pick up dropped loot & open chest
        tx = sim.lx
        tz = sim.lz
        if (sim.phase !== 3 && cyc > 5.0 && sim.lootOn) {
          sim.phase = 3
          sim.lootOn = false
          sim.chestOpen = true
          sim.loots += 2
          sim.popT = 0
          sim.popType = 'loot'
          sim.popX = sim.lx
          sim.popZ = sim.lz
          spawnPixelSparks(sim.lx, 0.45, sim.lz, 10, '#ffd840')
          if (facing && busRef.current) audio.pixelLoot(busRef.current)
        }
      } else {
        // Rest & warm up by campfire
        tx = -0.05
        tz = 0.35
        sim.phase = 4
      }

      const dx = tx - sim.hx
      const dz = tz - sim.hz
      const dist = Math.hypot(dx, dz)
      if (dist > 0.05) {
        sim.hx += (dx / dist) * Math.min(dist, dt * 1.15)
        sim.hz += (dz / dist) * Math.min(dist, dt * 1.15)
        if (Math.abs(dx) > 0.02) sim.hFlip = dx < 0
      }

      // Monster subtle patrol when alive
      sim.mx = -0.78 + Math.sin(t * 1.3) * 0.22
      sim.mz = 0.55 + Math.cos(t * 1.1) * 0.18
    }

    // Billboard pixel actors around Y axis toward camera so pixels are crisp 360°!
    let camYaw = 0
    if (islandGroup.current) {
      islandGroup.current.getWorldPosition(wp)
      camYaw = Math.atan2(s.camera.position.x - wp.x, s.camera.position.z - wp.z) - rotationY - islandGroup.current.rotation.y
    }

    // Hero sprite update
    if (heroMesh.current) {
      const f = Math.floor(t * 7) % 4
      const slashing = sim.slashT < 0.28
      applyUV(heroGeo, slashing ? atlas.uvs.hero_slash : atlas.uvs[`hero_walk_side_${f}`], sim.hFlip)
      heroMesh.current.position.set(sim.hx, 0.62, sim.hz)
      heroMesh.current.rotation.y = camYaw
    }
    if (heroShadow.current) {
      heroShadow.current.position.set(sim.hx, 0.17, sim.hz)
    }

    // Monster sprite update
    if (monsterMesh.current) {
      monsterMesh.current.visible = sim.mAlive && !sim.bossOn
      const tell = sim.phase === 1 && (sim.loopT % 8.0) > 2.8
      const f = Math.floor(t * 5) % 2
      applyUV(monsterGeo, tell ? atlas.uvs[`${sim.mKind}_tell`] : atlas.uvs[`${sim.mKind}_${f}`], true)
      monsterMesh.current.position.set(sim.mx, 0.38, sim.mz)
      monsterMesh.current.rotation.y = camYaw
    }

    // Boss sprite update
    if (bossMesh.current) {
      bossMesh.current.visible = sim.bossOn
      const f = Math.floor(t * 4) % 2
      applyUV(bossGeo, atlas.uvs[`elder_${f}`])
      bossMesh.current.position.set(-0.45, 0.72 + Math.sin(t * 3) * 0.05, 0.28)
      bossMesh.current.rotation.y = camYaw
    }

    // Campfire animation + flickering light
    if (fireMesh.current) {
      const ff = Math.floor(t * 9) % 3
      applyUV(fireGeo, atlas.uvs[`fire_${ff}`])
      fireMesh.current.rotation.y = camYaw
    }
    if (fireLight.current) {
      fireLight.current.intensity = prog > 0.19 ? (isAct ? 14 : 0) + Math.sin(t * 17) * 3.5 + Math.cos(t * 23) * 2 : 0
    }
    if (islandLight.current) {
      const c = sim.weather === 0 ? '#d8ffe8' : sim.weather === 1 ? '#ffb258' : '#9c8aff'
      islandLight.current.color.set(c)
      islandLight.current.intensity = prog > 0.19 ? (sim.weather === 2 && Math.sin(t * 11) > 0.93 ? 45 : 16) : 0
    }

    // Chest state
    if (chestMesh.current) {
      applyUV(chestGeo, sim.chestOpen ? atlas.uvs.chest_open : atlas.uvs.chest_closed)
      chestMesh.current.rotation.y = camYaw
    }

    // Slash arc
    if (slashMesh.current) {
      sim.slashT += dt
      const show = sim.slashT < 0.32
      slashMesh.current.visible = show
      if (show) {
        slashMesh.current.position.set(sim.mx + 0.15, 0.45, sim.mz)
        slashMesh.current.rotation.y = camYaw
        slashMesh.current.scale.setScalar(0.8 + sim.slashT * 1.4)
      }
    }

    // Bouncing Loot Coins & Gems
    if (coinMesh.current && gemMesh.current) {
      coinMesh.current.visible = sim.lootOn
      gemMesh.current.visible = sim.lootOn
      if (sim.lootOn) {
        const bounce = Math.abs(Math.sin(t * 5.2)) * 0.18
        coinMesh.current.position.set(sim.lx - 0.16, 0.25 + bounce, sim.lz + 0.12)
        coinMesh.current.rotation.y = camYaw
        gemMesh.current.position.set(sim.lx + 0.18, 0.25 + Math.abs(Math.cos(t * 5.2)) * 0.18, sim.lz - 0.1)
        gemMesh.current.rotation.y = camYaw
      }
    }

    // Floating Damage / Loot Popup
    if (popupMesh.current) {
      sim.popT += dt
      const on = sim.popT < 1.15
      popupMesh.current.visible = on
      if (on) {
        ;(popupMesh.current.material as THREE.MeshBasicMaterial).map = popupTexes[sim.popType]
        ;(popupMesh.current.material as THREE.MeshBasicMaterial).opacity = 1 - Math.pow(sim.popT / 1.15, 2)
        popupMesh.current.position.set(sim.popX, 0.9 + sim.popT * 0.65, sim.popZ)
        popupMesh.current.rotation.y = camYaw
      }
    }

    // Update pixel sparks
    const sp = sparksRef.current
    if (sp) {
      let dirty = false
      for (let i = 0; i < sim.sparks.length; i++) {
        const p = sim.sparks[i]
        if (p.life <= 0) continue
        dirty = true
        p.life -= dt
        p.vy -= 4.5 * dt
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.z += p.vz * dt
        dummy.position.set(p.x, Math.max(0.12, p.y), p.z)
        dummy.rotation.set(0, 0, 0)
        dummy.scale.setScalar(p.life > 0 ? 0.05 * (p.life / p.dur) : 0)
        dummy.updateMatrix()
        sp.setMatrixAt(i, dummy.matrix)
      }
      if (dirty) sp.instanceMatrix.needsUpdate = true
    }

    if (hudCardRef.current) {
      hudCardRef.current.visible = prog > 0.75
      hudCardRef.current.position.y = 4.62 + Math.sin(t * 1.4 + 1) * 0.06
      hudCardRef.current.rotation.y = Math.atan2(s.camera.position.x - worldPosition[0], s.camera.position.z - worldPosition[2]) - rotationY
    }
    const hk = `${sim.weather}-${sim.kills}-${sim.loots}-${sim.bossOn}-${isAct}`
    if (hk !== sim.lastHudKey) {
      sim.lastHudKey = hk
      drawHud(isAct)
    }
    // A shader-discarded mesh consumes no pixels. Reveal the static island
    // geometry only as its world-space bounds intersect the EXISTING scanline
    // and hologram band; character/combat visibility remains untouched.
    if (islandGroup.current && scanCullEntries.current) {
      if (prog > 0.19 && prog < 0.999)
        updateScanCullMeshes(islandGroup.current, scanCullEntries.current, scanWorldYRef.current, matUniforms.uWireHeight.value, false)
      else if (prog >= 0.999)
        updateScanCullMeshes(islandGroup.current, scanCullEntries.current, scanWorldYRef.current, matUniforms.uWireHeight.value, true)
    }
    // Freeze shader light-count without changing the original visible lighting.
    // Anchors retain the animated island position; only zero-intensity lights
    // stay in the renderable hierarchy while the miniature is hidden.
    if (showcaseRootRef.current) {
      if (fireLight.current && fireLightAnchor.current) {
        fireLightAnchor.current.getWorldPosition(lightWorld)
        showcaseRootRef.current.worldToLocal(lightWorld)
        fireLight.current.position.copy(lightWorld)
      }
      if (islandLight.current && islandLightAnchor.current) {
        islandLightAnchor.current.getWorldPosition(lightWorld)
        showcaseRootRef.current.worldToLocal(lightWorld)
        islandLight.current.position.copy(lightWorld)
      }
    }
  })

  const treeCoords: [number, number, boolean][] = [
    [-1.25, -0.85, true],
    [1.18, -1.05, true],
    [-1.38, 0.15, false],
    [1.32, 0.35, false],
  ]

  return (
    <group ref={showcaseRootRef} name="ragnarok-showcase-root" position={position} rotation={[0, rotationY, 0]}>
      <pointLight ref={fireLight} color="#ff8828" intensity={0} distance={4.5} decay={2} />
      <pointLight ref={islandLight} color="#d8ffe8" intensity={0} distance={7} decay={2} />
      {/* Emitter is fabricated with the laser, never visible in the dormant scene. */}
      <group ref={plinthRef} visible={false}>
      <PadRing radius={3.4} color="#5dffb0" y={0.06} tube={0.045} intensity={summoned ? 2.4 : 1.1} />
      <mesh position={[0, 0.2, 0]} material={materials.deckMat} receiveShadow castShadow>
        <cylinderGeometry args={[2.75, 3.05, 0.4, 40]} />
      </mesh>
      <mesh position={[0, 0.43, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.5, 0.045, 8, 64]} />
        <meshBasicMaterial color={new THREE.Color('#5dffb0').multiplyScalar(1.9)} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.41, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.1, 1.55, 32]} />
        <meshBasicMaterial color={new THREE.Color('#5dffb0').multiplyScalar(1.4)} transparent opacity={0.45} toneMapped={false} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      </group>

      {/* Laser Fabrication Scan Ring + Cone */}
      <mesh ref={scanRingRef} position={[0, 1, 0]} rotation={[Math.PI / 2, 0, 0]} visible={false}>
        <torusGeometry args={[2.45, 0.04, 8, 64]} />
        <meshBasicMaterial color={new THREE.Color('#5dffb0').multiplyScalar(2.6)} toneMapped={false} />
      </mesh>
      <mesh ref={holoBeamRef} position={[0, 0.42, 0]} geometry={scanBeamGeo} material={scanBeamMat} visible={false} />

      <group ref={titleRef} visible={false}>
        <Label title="Ragnarok" sub="The Last Island · Pixel Survival" color="#5dffb0" position={[0, 6.1, 0]} scale={0.92} fadeNear={3} fadeFar={65} />
      </group>

      {/* Materialized Floating Pixel-Art Island Diorama */}
      <group ref={exhibitRef} name="ragnarok-exhibit-content" visible={false}>
        <group ref={islandGroup} position={[0, 1.65, 0]}>
          {/* Translucent Glowing Voxel Ocean Block + Rim */}
          <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} material={waterMat}>
            <circleGeometry args={[2.78, 16]} />
          </mesh>
          <mesh position={[0, -0.14, 0]}>
            <cylinderGeometry args={[2.72, 2.55, 0.24, 16, 1, true]} />
            <primitive object={oceanRimMat} attach="material" />
          </mesh>

          {/* Main Octagonal Stepped Island Plateau (Pixel Grass + Cliff Strata) */}
          <mesh position={[0, 0.05, 0]} material={materials.grass} receiveShadow castShadow>
            <cylinderGeometry args={[2.05, 1.92, 0.22, 8]} />
          </mesh>
          <mesh position={[0, -0.22, 0]} material={materials.cliff} castShadow>
            <cylinderGeometry args={[1.9, 1.45, 0.38, 8]} />
          </mesh>
          <mesh position={[0, -0.56, 0]} material={materials.cliff} castShadow>
            <cylinderGeometry args={[1.38, 0.72, 0.38, 7]} />
          </mesh>
          {/* Floating Underside Rune Crystal Core + Halo */}
          <mesh position={[0, -0.98, 0]} rotation={[0.2, 0.4, 0.1]} material={materials.rune}>
            <octahedronGeometry args={[0.38, 0]} />
          </mesh>
          <mesh position={[0, -0.95, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.72, 0.022, 6, 32]} />
            <primitive object={runeHaloMat} attach="material" />
          </mesh>

          {/* Raised Northern Cliff Terrace */}
          <mesh position={[0.1, 0.24, -0.82]} material={materials.grass} receiveShadow castShadow>
            <boxGeometry args={[2.1, 0.22, 1.05]} />
          </mesh>

          {/* Crossed 2.5D Pixel Trees (3D volume from 360 deg!) */}
          {treeCoords.map(([x, z, isPine], idx) => (
            <group key={idx} ref={(node) => { treeRefs.current[idx] = node }} position={[x, z < -0.4 ? 0.92 : 0.72, z]}>
              <mesh geometry={isPine ? treePineGeo : treeOakGeo} material={materials.spriteMat} />
              <mesh geometry={isPine ? treePineGeo : treeOakGeo} material={materials.spriteMat} rotation={[0, Math.PI / 2, 0]} />
            </group>
          ))}

          {/* Crystal Ore Resource Node */}
          <group position={[0.98, 0.44, -0.45]}>
            <mesh geometry={crystalGeo} material={materials.spriteMat} />
            <mesh geometry={crystalGeo} material={materials.spriteMat} rotation={[0, Math.PI / 2, 0]} />
          </group>

          {/* Campfire + Warm Flickering Light */}
          <mesh ref={fireMesh} position={[-0.08, 0.34, 0.06]} geometry={fireGeo} material={materials.spriteMat} />
          <group ref={fireLightAnchor} position={[-0.08, 0.7, 0.06]} />
          <group ref={islandLightAnchor} position={[0, 2.2, 0.4]} />

          {/* Treasure Chest */}
          <mesh ref={chestMesh} position={[0.68, 0.34, 0.78]} geometry={chestGeo} material={materials.spriteMat} />

          {/* Living Autonomous Pixel Actors + Ground Shadow */}
          <mesh ref={heroShadow} position={[0.2, 0.17, 0.4]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.24, 12]} />
            <meshBasicMaterial color="#121c14" transparent opacity={0.45} depthWrite={false} />
          </mesh>
          <mesh ref={heroMesh} position={[0.2, 0.62, 0.4]} geometry={heroGeo} material={materials.spriteMat} />
          <mesh ref={monsterMesh} position={[-0.78, 0.38, 0.55]} geometry={monsterGeo} material={materials.spriteMat} />
          <mesh ref={bossMesh} position={[-0.45, 0.72, 0.28]} geometry={bossGeo} material={materials.spriteMat} visible={false} />
          <mesh ref={slashMesh} geometry={slashGeo} material={materials.spriteMat} visible={false} />
          <mesh ref={coinMesh} geometry={coinGeo} material={materials.spriteMat} visible={false} />
          <mesh ref={gemMesh} geometry={gemGeo} material={materials.spriteMat} visible={false} />

          {/* Floating Pixel Damage / Loot Popup */}
          <mesh ref={popupMesh} visible={false}>
            <planeGeometry args={[0.95, 0.35]} />
            <meshBasicMaterial transparent toneMapped={false} depthWrite={false} />
          </mesh>

          {/* Miniature physical weather — clouds, slant rain, gusts and water ripples */}
          <RagnarokWeather weatherRef={weatherRef} scanProgressRef={scanProgressRef} activeRef={activeRef} worldPosition={worldPosition} />

          {/* Pixel Combat / Loot Particles */}
          <instancedMesh ref={sparksRef} args={[undefined, undefined, 30]} frustumCulled={false}>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial toneMapped={false} />
          </instancedMesh>
        </group>

        {/* Diegetic Hologram Card */}
        <mesh ref={hudCardRef} position={[0, 4.32, -0.2]}>
          <planeGeometry args={[2.45, 0.92]} />
          <meshBasicMaterial map={hud.tex} transparent toneMapped={false} depthWrite={false} />
        </mesh>
      </group>

      {/* Interactive Hitbox */}
      <Hit
        id="ragnarok-island"
        label={summoned ? 'Ragnarok: The Last Island' : 'Bệ phóng Ragnarok'}
        hint={summoned ? 'Triệu hồi Boss Surge & đổi thời tiết' : 'Triệu hồi đảo sinh tồn bằng laser'}
        panel="ragnarok"
        maxDist={40}
        shape="cylinder"
        size={[2.65, 4.6, 0]}
        position={[0, 2.3, 0]}
        onClick={triggerBossSurge}
      />
    </group>
  )
}

// Avoid re-rendering the entire densely modeled exhibit when the console
// changes state; re-render only when its own public props change.
export const RagnarokShowcase = memo(RagnarokShowcaseImpl)
