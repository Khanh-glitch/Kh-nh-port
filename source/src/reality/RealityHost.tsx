// ORBITA · Reality Rewrite — Host điều phối toàn bộ trải nghiệm.
// Bảo toàn nguyên vẹn Grand Piano (tách clone vật liệu dùng chung trước khi vá thế giới gốc),
// chuẩn bị tài nguyên GPU phân bổ đều theo từng khung hình (không khựng khi lại gần đàn lần đầu),
// và chuyển bài mượt mà ngay bên trong không gian UEH (Mưa Mùa Hạ <-> Hoa Phượng Trong Gió).
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { audio } from '../audio'
import { setInteractiveFilter, player } from '../world'
import { useStore, toast } from '../store'
import { FRONT_MAX, RW, ease, frontReached, patchOld, patchNew } from './mask'
import { CENTER } from './site'
import { HexLattice, Ignition, StaffWall } from './Front'
import { Sheets } from './Sheets'
import { UEHWorld } from './worlds/UEH'
import { WU, reel } from './kit'
import { music } from './music'
import { TRACKS, type TrackId } from './tracks'
import { dismissReality, rt, useReality } from './state'

const IGNITE_S = 2.6
const SWEEP_S = 13
const RETRACT_S = 7.5
const curve = (u: number) => FRONT_MAX * Math.pow(Math.min(1, Math.max(0, u)), 1.5)

interface Managed {
  o: THREE.Object3D
  kind: 'mesh' | 'light' | 'sprite'
  c: THREE.Vector3
  r: number
  far: boolean
  hid: boolean
  castOrig: boolean
  inten: number
}

function underKeep(o: THREE.Object3D | null) {
  for (let p = o; p; p = p.parent) if (p.userData?.rwKeep) return true
  return false
}

// Bảng ánh sáng UEH: pha giữa "Hoa Phượng Trong Gió" (nắng chiều vàng) & "Cơn Mưa Mùa Hạ" (dịu mát man mác)
const GRADE_BLOSSOM = { sun: '#ffca82', sunI: 1.18, sky: '#a9c7e6', gnd: '#6b4e38', hemiI: 1.48, amb: '#ffd8a8', ambI: 1.85, env: 0.92 }
const GRADE_RAIN = { sun: '#c9d7ea', sunI: 0.82, sky: '#8fa6c4', gnd: '#484c54', hemiI: 1.55, amb: '#c4d2e6', ambI: 2.05, env: 0.85 }

export function RealityHost() {
  const { scene, camera, gl } = useThree()
  const ueh = useRef<THREE.Group>(null)
  const hostRoot = useRef<THREE.Group>(null)
  // Diagnostic only: the default page has no opt-in flags or visual changes.
  const hexGpuDiag = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('hexGpuDiag') : null
  // Query-only GPU experiment: geometry-only sibling consolidation.
  // No tree/flower/instance, shader, light, shadow, motion or material changes.
  const hexBatchProbe = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('hexBatchProbe') : null
  useLayoutEffect(() => {
    if (hexBatchProbe !== 'extended' && hexBatchProbe !== 'manual') return
    const root = ueh.current
    if (!root) return
    const merge = () => {
      const undo: Array<() => void> = []
      const parents: THREE.Object3D[] = []
      root.traverse(parent => parents.push(parent))
      let sourceMeshes = 0, savedCalls = 0, batches = 0
      for (const parent of parents) {
        // Never cross an animation hierarchy boundary or move individual actors.
        const candidates = parent.children.filter(o => {
          const m = o as THREE.Mesh
          if (!m.isMesh || (m as THREE.InstancedMesh).isInstancedMesh ||
              o.children.length !== 0 || !o.visible ||
              Array.isArray(m.material) || !m.material ||
              m.material.transparent || m.material.alphaTest > 0 ||
              m.material.userData?.__rwPatchMode !== 'new' ||
              (m.material as THREE.ShaderMaterial).isShaderMaterial ||
              // Source wind is a LOCAL-space vector offset; preserve it by
              // leaving those meshes original until a separately validated
              // axis-preserving batch shader exists.
              !m.material.customProgramCacheKey().includes('-still-') ||
              !m.geometry || Object.keys(m.geometry.morphAttributes).length ||
              m.userData.hexMergedAway || m.userData.rwKeep) return false
          return true
        }) as THREE.Mesh[]
        const buckets = new Map<string, THREE.Mesh[]>()
        for (const mesh of candidates) {
          const geometry = mesh.geometry
          const names = Object.keys(geometry.attributes).sort()
          const signature = names.map(name => {
            const a = geometry.getAttribute(name)
            return [name,a.itemSize,a.normalized,a.array.constructor.name].join(':')
          }).join(',')
          const key = [mesh.material.uuid,mesh.castShadow,mesh.receiveShadow,
            mesh.renderOrder,mesh.frustumCulled,mesh.layers.mask,signature].join('|')
          const group = buckets.get(key) ?? []
          group.push(mesh)
          buckets.set(key,group)
        }
        // A merged drawable has one renderer-sort slot instead of many.
        // Any overlapping sibling may depend on the ORIGINAL front/back
        // ordering, including surfaces of a different material. Decline
        // that optimization, rather than risking even one visible z-fight.
        const siblingBounds = new Map<THREE.Mesh,THREE.Box3>()
        for (const child of parent.children) {
          const m = child as THREE.Mesh
          if (!m.isMesh || !m.visible || !m.geometry) continue
          if (!m.geometry.boundingBox) m.geometry.computeBoundingBox()
          if (!m.geometry.boundingBox) continue
          m.updateMatrix()
          siblingBounds.set(m,m.geometry.boundingBox.clone().applyMatrix4(m.matrix))
        }
        for (const members of buckets.values()) {
          const group=members.filter(mesh=>{
            const bounds=siblingBounds.get(mesh)
            if(!bounds)return false
            for(const [other,box] of siblingBounds){
              if(other!==mesh && bounds.intersectsBox(box))return false
            }
            return true
          })
          if (group.length < 2) continue
          // Preserve source Float32 position, normals, UV and unchanged
          // triangle topology, baking only each sibling's LOCAL transform.
          const copies = group.map(mesh => {
            mesh.updateMatrix()
            return mesh.geometry.clone().applyMatrix4(mesh.matrix)
          })
          try {
            const names = Object.keys(copies[0].attributes).sort()
            if (!names.includes('position') || !names.includes('normal') ||
                !copies.every(g => Object.keys(g.attributes).sort().join('|') === names.join('|') &&
                  names.every(name => {
                    const a = g.getAttribute(name), first = copies[0].getAttribute(name)
                    return a.itemSize === first.itemSize &&
                      a.normalized === first.normalized &&
                      a.array instanceof Float32Array &&
                      first.array instanceof Float32Array &&
                      // Indexed and non-indexed are both legal, but all
                      // per-attribute vertex arrays must be self-consistent.
                      a.array.length === a.count * a.itemSize
                  }))) continue
            const vertexCount = copies.reduce((n,g) => n+g.getAttribute('position').count, 0)
            const indexCount = copies.reduce((n,g) => n+(g.index?.count ??
              g.getAttribute('position').count), 0)
            const geometry = new THREE.BufferGeometry()
            for (const name of names) {
              const first = copies[0].getAttribute(name)
              const data = new Float32Array(vertexCount * first.itemSize)
              let offset = 0
              for (const g of copies) {
                const from = g.getAttribute(name).array as Float32Array
                data.set(from,offset)
                offset += from.length
              }
              geometry.setAttribute(name,new THREE.BufferAttribute(data,first.itemSize,first.normalized))
            }
            const indices = vertexCount > 65535 ? new Uint32Array(indexCount) : new Uint16Array(indexCount)
            let indexOffset = 0,vertexOffset = 0
            for (const g of copies) {
              const ix = g.index, count = g.getAttribute('position').count
              if (ix) for (let i=0;i<ix.count;i++) indices[indexOffset++] = ix.getX(i)+vertexOffset
              else for (let i=0;i<count;i++) indices[indexOffset++] = i+vertexOffset
              vertexOffset += count
            }
            geometry.setIndex(new THREE.BufferAttribute(indices,1))
            // HEX's ORIGINAL 'new' vertex GLSL computes vRWg from each
            // mesh's LOCAL ORIGIN (modelMatrix * vec4(0,0,0,1)), not from
            // its visible vertices. A merged mesh otherwise uses its
            // parent's shared origin, breaking per-object growth timing.
            // Preserve each exact old origin alongside its unmodified UVs
            // and geometry, with no loss of individual reveal behavior.
            const origins = new Float32Array(vertexCount * 3)
            const growDeltas = new Float32Array(vertexCount * 3)
            let baseVertex = 0
            const origin = new THREE.Vector3()
            for (let k=0;k<group.length;k++) {
              origin.setFromMatrixPosition(group[k].matrix)
              const count = copies[k].getAttribute('position').count
              const originalPositions = group[k].geometry.getAttribute('position')
              // A source mesh grows by scaling its own local vertex Y
              // BEFORE its local translation/rotation/scale are applied.
              // The baked combined mesh must add back that exact displaced
              // local-Y direction rather than scaling its parent-space Y.
              const m=group[k].matrix.elements
              for(let v=0;v<count;v++) {
                const n=(baseVertex+v)*3
                origins[n]=origin.x
                origins[n+1]=origin.y
                origins[n+2]=origin.z
                const y=originalPositions.getY(v)
                growDeltas[n]=m[4]*y
                growDeltas[n+1]=m[5]*y
                growDeltas[n+2]=m[6]*y
              }
              baseVertex+=count
            }
            geometry.setAttribute('aRWOrigin',new THREE.BufferAttribute(origins,3))
            geometry.setAttribute('aRWGrowDelta',new THREE.BufferAttribute(growDeltas,3))
            geometry.computeBoundingSphere()
            geometry.computeBoundingBox()
            const originalMaterial = group[0].material
            const combinedMaterial = originalMaterial.clone()
            const originalKey = originalMaterial.customProgramCacheKey.bind(originalMaterial)
            combinedMaterial.customProgramCacheKey = () =>
              originalKey() + '|hex-static-source-origin-v1'
            combinedMaterial.onBeforeCompile = (shader,renderer) => {
              // Keep ORIGINAL PBR/Wet/Growth/Wind/Lighting and all uniforms.
              // Alter only the per-mesh reveal ORIGIN for batched triangles.
              originalMaterial.onBeforeCompile(shader,renderer)
              const originalExpr = 'rwX((rwM * vec4(0.0,0.0,0.0,1.0)).xyz, rwEd0)'
              if (!shader.vertexShader.includes(originalExpr))
                throw new Error('UEH_PATCHED_GROWTH_SHADER_MISSING: refusing unsafe batching')
              const growExpr='transformed.y *= rwGrow(vRWg, uRWGrowLen);'
              const grown=shader.vertexShader.replaceAll(originalExpr,
                'rwX((rwM * vec4(aRWOrigin,1.0)).xyz, rwEd0)')
                .replaceAll(growExpr,
                  'transformed += aRWGrowDelta * (rwGrow(vRWg, uRWGrowLen) - 1.0);')
              if (originalMaterial.customProgramCacheKey().includes('-g-') &&
                  !shader.vertexShader.includes(growExpr))
                throw new Error('UEH_LOCAL_GROWTH_SHADER_MISSING: refuse unsafe batching')
              shader.vertexShader =
                'attribute vec3 aRWOrigin;\nattribute vec3 aRWGrowDelta;\n' + grown
            }
            const combined = new THREE.Mesh(geometry,combinedMaterial)
            combined.name = 'ueh-exact-opaque-batch'
            combined.castShadow = group[0].castShadow
            combined.receiveShadow = group[0].receiveShadow
            combined.frustumCulled = group[0].frustumCulled
            combined.renderOrder = group[0].renderOrder
            combined.layers.mask = group[0].layers.mask
            for (const mesh of group) {
              mesh.visible = false
              mesh.userData.hexMergedAway = true
            }
            parent.add(combined)
            batches++
            sourceMeshes += group.length
            savedCalls += group.length-1
            undo.push(() => {
              parent.remove(combined)
              geometry.dispose()
              combinedMaterial.dispose()
              for (const mesh of group) {
                mesh.visible = true
                delete mesh.userData.hexMergedAway
              }
            })
          } finally { for (const g of copies) g.dispose() }
        }
      }
      ;(window as unknown as {__orbitaHexBatchStats?:unknown}).__orbitaHexBatchStats = {
        mode:hexBatchProbe,sourceMeshes,batches,drawsSavedPerPass:savedCalls,
        sourceGeometryAndMaterialsPreserved:true,
      }
      return () => { for (let i=undo.length-1;i>=0;i--)undo[i]() }
    }
    if (hexBatchProbe === 'extended') {
      const undo=merge()
      return () => {undo();delete (window as unknown as {__orbitaHexBatchStats?:unknown}).__orbitaHexBatchStats}
    }
    // Manual means no mutation until the synchronous screenshot test asks.
    const runVisualParity = () => {
      const width=320,height=180
      const target=new THREE.WebGLRenderTarget(width,height,{depthBuffer:true,stencilBuffer:false})
      target.texture.colorSpace=gl.outputColorSpace
      const oldTarget=gl.getRenderTarget(), viewport=gl.getViewport(new THREE.Vector4()).clone(),
        scissor=gl.getScissor(new THREE.Vector4()).clone(),scissorTest=gl.getScissorTest(),
        xr=gl.xr.enabled
      const oldVisible=root.visible, front=RW.uRW.value.x, on=RW.uRW.value.z
      const oldCameraPos=camera.position.clone(), oldCameraQ=camera.quaternion.clone()
      const stages=[
        {name:'ignition',front:0},{name:'early',front:32},
        {name:'middle',front:82},{name:'city',front:145},
        {name:'near-complete',front:250},{name:'complete',front:FRONT_MAX},
      ]
      const viewpoints=[
        {name:'front',offset:[0,25,55]},
        {name:'left',offset:[-45,27,30]},
        {name:'right',offset:[45,27,30]},
      ]
      const cases=viewpoints.flatMap(v=>stages.map(stage=>({...stage,view:v.name,offset:v.offset})))
      const setCase=(stage:typeof cases[number])=>{
        root.visible=true
        RW.uRW.value.x=stage.front
        RW.uRW.value.z=1
        camera.position.set(CENTER.x+stage.offset[0],CENTER.y+stage.offset[1],CENTER.z+stage.offset[2])
        camera.lookAt(CENTER.x,6,CENTER.z)
        camera.updateMatrixWorld(true)
      }
      const capture=()=>{
        const bytes=new Uint8Array(width*height*4)
        gl.setRenderTarget(target)
        gl.setViewport(0,0,width,height)
        gl.setScissorTest(false)
        gl.clear(true,true,true)
        gl.render(scene,camera)
        gl.readRenderTargetPixels(target,0,0,width,height,bytes)
        return bytes
      }
      let undo: (()=>void)|undefined
      try {
        const baseline=cases.map(stage=>{setCase(stage);return capture()})
        undo=merge()
        const rows=cases.map((stage,i)=>{
          setCase(stage)
          const actual=capture()
          let pixelDifferences=0,maxDelta=0
          for(let p=0;p<actual.length;p+=4){
            let different=false
            for(let channel=0;channel<4;channel++){
              const d=Math.abs(actual[p+channel]-baseline[i][p+channel])
              if(d>maxDelta)maxDelta=d
              if(d)different=true
            }
            if(different)pixelDifferences++
          }
          return {view:stage.view,stage:stage.name,pixelDifferences,maxDelta}
        })
        const stats=(window as unknown as {__orbitaHexBatchStats?: {
          sourceMeshes:number;batches:number;drawsSavedPerPass:number
        }}).__orbitaHexBatchStats
        return {width,height,viewCount:viewpoints.length,stages:rows,
          ...stats,pixelPerfect:rows.every(x=>x.pixelDifferences===0),
          visuallyEquivalent:rows.every(x=>x.pixelDifferences<=2&&x.maxDelta<=1)}
      } finally {
        undo?.()
        root.visible=oldVisible
        RW.uRW.value.x=front
        RW.uRW.value.z=on
        camera.position.copy(oldCameraPos)
        camera.quaternion.copy(oldCameraQ)
        camera.updateMatrixWorld(true)
        gl.setRenderTarget(oldTarget)
        gl.setViewport(viewport)
        gl.setScissor(scissor)
        gl.setScissorTest(scissorTest)
        gl.xr.enabled=xr
        target.dispose()
      }
    }
    ;(window as unknown as {__orbitaHexManualBatch?:{runVisualParity:typeof runVisualParity}})
      .__orbitaHexManualBatch={runVisualParity}
    return ()=>{delete (window as unknown as {__orbitaHexManualBatch?:unknown}).__orbitaHexManualBatch}
  },[scene,camera,gl,hexBatchProbe])

  // DIAGNOSTIC ONLY: Three.js documents this as a release-build option.
  // Checking link diagnostic logs can synchronize the driver for >1s
  // per WebGLProgram even when shader compilation is otherwise successful.
  // No shaders, lights, geometry, postprocessing or rendering state change.
  const hexSkipShaderLogs = typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('hexSkipShaderLogs') === '1'
  useEffect(()=>{
    if(!hexSkipShaderLogs)return
    const original=gl.debug.checkShaderErrors
    gl.debug.checkShaderErrors=false
    ;(window as unknown as {__orbitaHexLogProbe?:unknown}).__orbitaHexLogProbe={
      enabled:true,original,active:gl.debug.checkShaderErrors
    }
    return ()=>{gl.debug.checkShaderErrors=original}
  },[gl,hexSkipShaderLogs])

  const S = useRef({
    managed: [] as Managed[],
    lights: [] as { o: THREE.Light; color: THREE.Color; gcolor?: THREE.Color; inten: number }[],
    envI: 1,
    baseFov: 72,
    u: 0,
    musicOn: false,
    lastPhase: 'idle',
    lastTrack: null as TrackId | null,
    lastSwitchSeq: 0,
    ignT: 0,
    warmStarted: false,
    warmTex: [] as THREE.Texture[],
    warmMesh: [] as THREE.Object3D[],
    warmCritical: [] as THREE.Object3D[],
    warmCompilePending: false,
    warmErrors: 0,
    warmShaderDone: 0,
    warmTextureDone: 0,
    warmShaderTotal: 0,
    warmTextureTotal: 0,
    warmLinearMaxSubmitMs: 0,
    warmLinearSubmissions: 0,
    warmLinearRestoreErrors: 0,
    warmShadowTotal: 0,
    warmShadowDone: 0,
    warmShadowErrors: 0,
    warmProgramCreated: [] as Array<{
      isReady:()=>boolean;getUniforms:()=>unknown;getAttributes:()=>unknown
    }>,
    warmProgramSeen: new Set<unknown>(),
    warmPrimeQueue: [] as Array<{
      isReady:()=>boolean;getUniforms:()=>unknown;getAttributes:()=>unknown
    }>,
    warmPrimeSeeded:false,
    warmPrimeTotal:0,warmPrimeDone:0,
    warmPrimeMaxMs:0,warmPrimeErrors:0,warmPrimePaused:false,
    warmPrimeLinkFailures:0,warmPrimeCheckedWithoutLogs:0,
    warmHealthyPaints: 0,
    warmPass: 0, // 0: đang upload tex/compile, 1: đang bật 1 frame silent shadow warm, 2: xong hoàn toàn
  }).current

  const tmp = useMemo(() => new THREE.Vector3(), [])
  const tc = useMemo(() => new THREE.Color(), [])
  const tc2 = useMemo(() => new THREE.Color(), [])

  // Preserve exact HEX pixels: skip only opaque UEH meshes whose original
  // materialization shader would discard every fragment at this front radius.
  // The failed 96px private GPU prewarm is REMOVED entirely: it consumed
  // 200-450ms in an idle frame, did not finish, and created 399 idle proxies.
  const hexCull = useRef([] as Array<{
    mesh: THREE.Mesh; threshold: number; hidden: boolean
  }>).current
  const hexFarSkies = useRef([] as THREE.Mesh[]).current
  // Only populated if an explicit test URL isolates a draw category.
  // Production is unaffected: every original UEH object remains renderable.
  const hexProbeSuppressed = useRef([] as Array<{
    object: THREE.Object3D; originallyVisible: boolean
  }>).current
  const hexShadowSuppressed = useRef([] as Array<{
    object: THREE.Mesh; castOrig: boolean
  }>).current
  const hexBasicDiagnostic = useRef([] as Array<{
    mesh: THREE.InstancedMesh
    original: THREE.Material
    basic: THREE.MeshBasicMaterial
  }>).current
  useEffect(() => {
    hexCull.length = 0
    hexFarSkies.length = 0
    hexProbeSuppressed.length = 0
    hexShadowSuppressed.length = 0
    hexBasicDiagnostic.length = 0
    const cullCenter = new THREE.Vector3()
    const cullScale = new THREE.Vector3()
    ueh.current?.traverse((source) => {
      const draw = source as THREE.Mesh
      if (draw.isMesh && source.userData?.rwFarSky) hexFarSkies.push(draw)
      if (draw.isMesh && !(draw as THREE.InstancedMesh).isInstancedMesh &&
          draw.visible && !Array.isArray(draw.material) &&
          !draw.material.transparent && !draw.material.alphaTest &&
          !(draw.material as THREE.ShaderMaterial).isShaderMaterial &&
          draw.material.userData.__rwPatchMode === 'new') {
        const geo = draw.geometry
        if (!geo.boundingSphere) geo.computeBoundingSphere()
        if (geo.boundingSphere) {
          draw.updateWorldMatrix(true, false)
          cullCenter.copy(geo.boundingSphere.center).applyMatrix4(draw.matrixWorld)
          cullScale.setFromMatrixScale(draw.matrixWorld)
          const radius = geo.boundingSphere.radius *
            Math.max(cullScale.x, cullScale.y, cullScale.z)
          const nearEdge = Math.max(0,
            Math.hypot(cullCenter.x - CENTER.x, cullCenter.z - CENTER.z) - radius)
          const minY = Math.max(0, cullCenter.y - radius)
          // 16m is larger than HEX snapping/jitter and UEH wind deformation.
          // Far-field materialization starts at >=150m; cap our threshold at
          // 130 so even far-world fragments are submitted before they appear.
          const threshold = Math.min(130, Math.max(0,
            nearEdge - 16 + minY * 0.55))
          if (threshold > 0) hexCull.push({mesh:draw,threshold,hidden:false})
        }
      }
    })
    if (hexGpuDiag === 'batch-inventory') {
      // No modifications. Determine whether the APEX sibling batching
      // strategy has enough eligible same-material UEH plates to matter.
      const parents:THREE.Object3D[]=[]
      ueh.current?.traverse(parent=>parents.push(parent))
      let drawable=0,eligible=0,mergeGroups=0,savedCalls=0
      const samples:Array<{parent:string;material:string;count:number;saved:number}>= []
      for(const parent of parents){
        const candidates=parent.children.filter(o=>{
          const m=o as THREE.Mesh
          if(!m.isMesh||(m as THREE.InstancedMesh).isInstancedMesh||
            m.children.length>0||!m.visible||Array.isArray(m.material)||
            m.material.transparent||m.material.alphaTest>0||
            Object.keys(m.geometry?.morphAttributes??{}).length>0||
            m.material.userData.__rwPatchMode!=='new')return false
          return true
        }) as THREE.Mesh[]
        eligible+=candidates.length
        const buckets=new Map<string,THREE.Mesh[]>()
        for(const m of candidates){
          const geom=m.geometry
          const attrs=Object.keys(geom.attributes).sort()
          const signature=attrs.map(k=>{
            const a=geom.getAttribute(k)
            return [k,a.itemSize,a.normalized,a.array.constructor.name].join(':')
          }).join(',')
          const key=[m.material.uuid,m.castShadow,m.receiveShadow,
            m.renderOrder,m.frustumCulled,m.layers.mask,signature].join('|')
          const group=buckets.get(key)??[]
          group.push(m)
          buckets.set(key,group)
        }
        for(const group of buckets.values()){
          if(group.length<2)continue
          mergeGroups++
          savedCalls+=group.length-1
          if(samples.length<40)samples.push({
            parent:parent.name||parent.type,material:group[0].material.name||
              group[0].material.type,count:group.length,saved:group.length-1
          })
        }
      }
      ueh.current?.traverse(o=>{
        const m=o as THREE.Mesh
        if(m.isMesh)drawable++
      })
      ;(window as unknown as {__orbitaHexBatchInventory?:unknown}).__orbitaHexBatchInventory={
        drawable,eligible,mergeGroups,savedCalls,samples
      }
    }
    if (hexGpuDiag === 'basic-instances') {
      ueh.current?.traverse(o=>{
        const mesh=o as THREE.InstancedMesh
        if (!mesh.isInstancedMesh || Array.isArray(mesh.material))return
        const original=mesh.material
        const basic=patchNew(new THREE.MeshBasicMaterial({
          color:0xffffff,side:THREE.DoubleSide,
          vertexColors:!!mesh.geometry.getAttribute('color'),
        }),{grow:false,haze:false,ao:false,wind:0})
        hexBasicDiagnostic.push({mesh,original,basic})
        mesh.material=basic
      })
      ;(window as unknown as {__orbitaHexGpuDiagStats?:unknown}).__orbitaHexGpuDiagStats={
        mode:'basic-instances',replacedOriginalMaterials:hexBasicDiagnostic.length,
      }
    }
    if (hexGpuDiag?.startsWith('no-ueh-')) {
      const filter = hexGpuDiag.slice('no-ueh-'.length)
      let total = 0
      let instancedIndex = 0
      const instancedManifest: Array<{index:number;group:string;count:number;shadow:boolean;material:string}> = []
      ueh.current?.traverse(o => {
        const d = o as THREE.Mesh
        if (!d.isMesh && !(o as THREE.Points).isPoints &&
            !(o as THREE.Line).isLine && !(o as THREE.Sprite).isSprite) return
        total++
        const mat = d.material
        const mats = Array.isArray(mat) ? mat : mat ? [mat] : []
        const instanced = (d as THREE.InstancedMesh).isInstancedMesh === true
        const shader = mats.some(m => (m as THREE.ShaderMaterial).isShaderMaterial)
        const transparent = mats.some(m => m.transparent || m.alphaTest > 0)
        const kind = instanced ? 'instanced' : shader ? 'shader' :
          transparent ? 'alpha' : 'opaque'
        // Stable creation order from UEHWorld: underside roots, B1 fins,
        // campus bulbs; then phượng leaves/blossoms/grass; then wind petals.
        // This is a TEST-ONLY grouping. No production mesh is changed.
        const idx = instanced ? instancedIndex++ : -1
        const instanceGroup = idx < 0 ? '' :
          idx < 3 ? 'architecture' : idx < 6 ? 'foliage' : 'wind'
        if (instanced) instancedManifest.push({
          index:idx,group:instanceGroup,count:(d as THREE.InstancedMesh).count,
          shadow:d.castShadow,material:mats.map(m=>m.type).join(','),
        })
        const shadowDiagnostic = filter === 'shadows' ||
          filter === 'instanced-shadows'
        if (shadowDiagnostic) {
          if(d.isMesh && d.castShadow &&
              (filter === 'shadows' || instanced)){
            hexShadowSuppressed.push({object:d,castOrig:d.castShadow})
            d.castShadow=false
          }
        } else if(kind === filter || (instanced && (instanceGroup === filter || filter === `instance-${idx}` || filter === `foliage-${idx}` && instanceGroup === 'foliage'))) {
          hexProbeSuppressed.push({object:o,originallyVisible:o.visible})
        }
      })
      ;(window as unknown as {__orbitaHexGpuDiagStats?:unknown}).__orbitaHexGpuDiagStats = {
        mode:hexGpuDiag,totalDrawables:total,hiddenDrawables:hexProbeSuppressed.length,
        shadowsOff:hexShadowSuppressed.length,
        instances:instancedManifest,
      }
    }
    return () => {
      for(const d of hexProbeSuppressed) d.object.visible=d.originallyVisible
      for(const d of hexShadowSuppressed) d.object.castShadow=d.castOrig
      for(const d of hexBasicDiagnostic) {d.mesh.material=d.original;d.basic.dispose()}
      hexBasicDiagnostic.length=0
      hexProbeSuppressed.length=0
      hexShadowSuppressed.length=0
      for (const entry of hexCull) if (entry.hidden) entry.mesh.visible = true
      for (const sky of hexFarSkies) sky.visible = true
      hexCull.length = 0
      hexFarSkies.length = 0
    }
  }, [scene])

  // DIAGNOSTIC ONLY: source shaders must be precompiled for the SAME
  // output color space the postprocessing composer uses at real first draw.
  // Instrumentation proved 22/25 click-only fragments differ from their
  // warm variants by EXACTLY "sRGB" -> "Linear" in linearToOutputTexel.
  // A private 4x4 LINEAR render target is bound ONLY during compileAsync,
  // with no draw, then every renderer/global state is restored synchronously.
  // This never changes any visible color, PBR, Bloom, HDR, light or geometry.
  const hexRealSceneCompile = typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('hexRealSceneCompile') === '1'
  const hexLinearTargetCompile = typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('hexLinearTargetCompile') === '1'
  const hexRealCompile = useRef({
    started:false,
    report:{
      status:'disabled',target:'default',
      programCountBefore:0,programCountAfter:0,
      compileSubmitMs:0,compileWallMs:0,
      beforeOutputColorSpace:'',afterOutputColorSpace:'',
      error:''
    }
  }).current
  useFrame(()=>{
    if ((!hexRealSceneCompile&&!hexLinearTargetCompile) ||
        hexRealCompile.started || !ueh.current ||
        useReality.getState().phase!=='idle' ||
        useStore.getState().phase!=='playing' ||
        S.warmPass!==2 || S.warmCompilePending ||
        document.visibilityState!=='visible')return
    const landing=(window as unknown as {
      __orbitaLandingPrewarm?:{status:string}
    }).__orbitaLandingPrewarm
    if(landing&&!['ready','disabled','failed','cancelled',
      'skipped-entered','skipped-busy-or-entered',
      'skipped-software-renderer','submitted-no-fence'].includes(landing.status))
      return
    const group=ueh.current
    hexRealCompile.started=true
    const report=hexRealCompile.report
    const count=()=>gl.info.programs?.length??0
    const previousTarget=gl.getRenderTarget()
    const previousViewport=gl.getViewport(new THREE.Vector4()).clone()
    const previousScissor=gl.getScissor(new THREE.Vector4()).clone()
    const previousScissorTest=gl.getScissorTest()
    const originalVisibility=group.visible
    const scratch=hexLinearTargetCompile?
      new THREE.WebGLRenderTarget(4,4,{depthBuffer:false,stencilBuffer:false}):
      null
    if(scratch)scratch.texture.colorSpace=THREE.LinearSRGBColorSpace
    report.target=scratch?'private-linear-srgb':'default'
    report.beforeOutputColorSpace=gl.getRenderTarget()?.texture.colorSpace??gl.outputColorSpace
    report.programCountBefore=count()
    const started=performance.now()
    report.status='compiling'
    try {
      if(scratch)gl.setRenderTarget(scratch)
      group.visible=true
      const pending=gl.compileAsync(group,camera,scene)
      report.compileSubmitMs=Math.round(performance.now()-started)
      void pending.then(()=>{
        report.compileWallMs=Math.round(performance.now()-started)
        report.programCountAfter=count()
        report.status='ready'
      }).catch(err=>{
        report.status='failed'
        report.error=String(err)
      }).finally(()=>scratch?.dispose())
    } catch(err) {
      report.status='failed'
      report.error=String(err)
      scratch?.dispose()
    } finally {
      // Absolutely no temporary color-space or scene visibility leaks into
      // the live R3F/postprocessing draw: restore before this callback exits.
      group.visible=originalVisibility
      gl.setRenderTarget(previousTarget)
      gl.setViewport(previousViewport)
      gl.setScissor(previousScissor)
      gl.setScissorTest(previousScissorTest)
      report.afterOutputColorSpace=gl.getRenderTarget()?.texture.colorSpace??gl.outputColorSpace
    }
    ;(window as unknown as {__orbitaHexRealCompile:typeof report})
      .__orbitaHexRealCompile=report
  })

  // TEST ONLY: submit the original UEH InstancedBufferAttributes to the
  // GPU in healthy idle frames. This uses borrowed ORIGINAL geometry,
  // instanceMatrix and instanceColor attributes; no foliage or PBR material
  // is removed, downsampled or modified. A 2px private target never appears
  // in the portfolio. Keep disabled unless opposite-order Metal results
  // prove the first HEX becomes smoother without intro/idle frame stalls.
  const hexInstanceBufferWarm = typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('hexInstanceBufferWarm') === '1'
  const instanceBufferWarm = useRef({
    status:'disabled', queue:[] as THREE.InstancedMesh[],
    scene:null as THREE.Scene|null, target:null as THREE.WebGLRenderTarget|null,
    camera:null as THREE.PerspectiveCamera|null,
    mat:null as THREE.MeshBasicMaterial|null,
    total:0,done:0,maxSubmitMs:0,errors:0,paused:false,healthy:0,
    frameBudgetExceeded:false,
  }).current
  useEffect(()=>{
    if(!hexInstanceBufferWarm)return
    const sources:THREE.InstancedMesh[]=[]
    ueh.current?.traverse(node=>{
      const m=node as THREE.InstancedMesh
      if(m.isInstancedMesh&&m.count>0&&m.geometry&&!Array.isArray(m.material))
        sources.push(m)
    })
    const scratch=new THREE.Scene()
    const mat=new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false})
    const proxies=sources.map(source=>{
      // Instance data MUST be the very same BufferAttributes that the
      // visible UEH mesh later binds; copied arrays would only warm a fake.
      const proxy=new THREE.InstancedMesh(source.geometry,mat,source.count)
      proxy.instanceMatrix=source.instanceMatrix
      proxy.instanceColor=source.instanceColor
      proxy.frustumCulled=false
      proxy.matrixAutoUpdate=false
      source.updateWorldMatrix(true,false)
      proxy.matrix.copy(source.matrixWorld)
      return proxy
    })
    const target=new THREE.WebGLRenderTarget(2,2,{
      depthBuffer:false,stencilBuffer:false
    })
    target.texture.colorSpace=THREE.LinearSRGBColorSpace
    const warmCamera=new THREE.PerspectiveCamera(72,1,0.1,9000)
    warmCamera.position.copy(camera.position)
    warmCamera.lookAt(CENTER)
    warmCamera.updateMatrixWorld(true)
    Object.assign(instanceBufferWarm,{
      status:proxies.length?'warming':'empty',
      queue:proxies,scene:scratch,target,camera:warmCamera,mat,
      total:proxies.length,done:0,maxSubmitMs:0,errors:0,paused:false,
      frameBudgetExceeded:false,healthy:0,
    })
    ;(window as unknown as {__orbitaHexInstanceBufferWarm?:unknown})
      .__orbitaHexInstanceBufferWarm={
        status:instanceBufferWarm.status,total:proxies.length,done:0,
        maxSubmitMs:0,errors:0,paused:false,frameBudgetExceeded:false,
      }
    return ()=>{
      target.dispose()
      mat.dispose()
      scratch.clear()
      Object.assign(instanceBufferWarm,{
        status:'disposed',queue:[],scene:null,target:null,camera:null,mat:null,
      })
    }
  },[gl,scene,camera,hexInstanceBufferWarm])

  useFrame((_state,rawDt)=>{
    if(!hexInstanceBufferWarm)return
    const w=instanceBufferWarm
    if(w.status!=='warming')return
    if(S.warmPass!==2||useReality.getState().phase!=='idle'||
       useStore.getState().phase!=='playing'||
       document.visibilityState!=='visible'){
      w.healthy=0
      return
    }
    const inputPending=(navigator as Navigator & {
      scheduling?:{isInputPending?:()=>boolean}
    }).scheduling?.isInputPending?.()??false
    w.healthy=rawDt>0&&rawDt<0.08&&!inputPending?w.healthy+1:0
    if(w.healthy<2)return
    w.healthy=0
    const proxy=w.queue[w.done]
    if(!proxy||!w.scene||!w.target||!w.camera){
      w.status='ready'
      return
    }
    const previousTarget=gl.getRenderTarget()
    const previousViewport=gl.getViewport(new THREE.Vector4()).clone()
    const previousScissor=gl.getScissor(new THREE.Vector4()).clone()
    const previousScissorTest=gl.getScissorTest()
    const previousAutoClear=gl.autoClear
    const previousXr=gl.xr.enabled
    const start=performance.now()
    try{
      w.scene.add(proxy)
      gl.xr.enabled=false
      gl.autoClear=true
      gl.setRenderTarget(w.target)
      gl.setViewport(0,0,2,2)
      gl.setScissorTest(false)
      gl.clear(true,true,false)
      gl.render(w.scene,w.camera)
      w.done++
      w.status=w.done===w.total?'ready':'warming'
    }catch(error){
      w.errors++
      w.status='failed'
      console.warn('[HEX GPU attribute warmup] preserved production render',error)
    }finally{
      w.scene.remove(proxy)
      gl.setRenderTarget(previousTarget)
      gl.setViewport(previousViewport)
      gl.setScissor(previousScissor)
      gl.setScissorTest(previousScissorTest)
      gl.autoClear=previousAutoClear
      gl.xr.enabled=previousXr
      const elapsed=performance.now()-start
      w.maxSubmitMs=Math.max(w.maxSubmitMs,elapsed)
      if(elapsed>120){
        w.frameBudgetExceeded=true
        w.paused=true
        w.status='rejected-idle-stall'
      }
    }
    ;(window as unknown as {
      __orbitaHexInstanceBufferWarm?:{
        status:string;total:number;done:number;maxSubmitMs:number;
        errors:number;paused:boolean;frameBudgetExceeded:boolean;
      }
    }).__orbitaHexInstanceBufferWarm={
      status:w.status,total:w.total,done:w.done,
      maxSubmitMs:Math.round(w.maxSubmitMs),
      errors:w.errors,paused:w.paused,
      frameBudgetExceeded:w.frameBudgetExceeded,
    }
  })

  const recordHexTiming = (step: string, started: number) => {
    if (typeof window === 'undefined' || new URLSearchParams(location.search).get('hexProfile') !== '1') return
    const host = window as unknown as {__orbitaHexTimings?: Array<{step:string;ms:number;at:number}>}
    const rows = host.__orbitaHexTimings ?? (host.__orbitaHexTimings = [])
    rows.push({ step, ms: Math.round((performance.now()-started)*10)/10, at: Math.round(performance.now()) })
    if (rows.length > 100) rows.shift()
  }

  // Tách riêng vật liệu dùng chung trên các đối tượng cần giữ nguyên (như Grand Piano dùng chung mats.lacquer/gold/silver)
  // để patchOld KHÔNG bao giờ vô tình cắt mất thân đàn, nắp đàn, chân và bàn đạp!
  const isolateKeepMaterials = () => {
    const keepObjs: THREE.Mesh[] = []
    const outsideMats = new Set<THREE.Material>()

    const visit = (o: THREE.Object3D) => {
      if (o === hostRoot.current) return
      const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined
      if (m) {
        if (underKeep(o)) keepObjs.push(o as THREE.Mesh)
        else (Array.isArray(m) ? m : [m]).forEach((mat) => outsideMats.add(mat))
      }
      o.children.forEach(visit)
    }
    visit(scene)

    const clonedMap = new Map<THREE.Material, THREE.Material>()
    const getIsolated = (mat: THREE.Material) => {
      if (mat.userData?.__rwIsolated) return mat
      if (!outsideMats.has(mat)) return mat
      let copy = clonedMap.get(mat)
      if (!copy) {
        copy = mat.clone()
        copy.userData = { ...copy.userData, __rwIsolated: true }
        clonedMap.set(mat, copy)
      }
      return copy
    }

    keepObjs.forEach((o) => {
      const m = o.material
      if (Array.isArray(m)) o.material = m.map(getIsolated)
      else o.material = getIsolated(m)
    })
  }

  const patchAll = () => {
    const started = performance.now()
    isolateKeepMaterials()
    const visit = (o: THREE.Object3D) => {
      if (o.userData?.rwKeep) return
      const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined
      if (m) patchOld(m)
      o.children.forEach(visit)
    }
    visit(scene)
    recordHexTiming('patch-all', started)
  }

  const collect = () => {
    const started = performance.now()
    S.managed.length = 0
    S.lights.length = 0
    scene.updateMatrixWorld(true)
    const visit = (o: THREE.Object3D) => {
      if (o.userData?.rwKeep) return
      const any = o as THREE.Object3D & { isMesh?: boolean; isPoints?: boolean; isLine?: boolean; isSprite?: boolean; isLight?: boolean; geometry?: THREE.BufferGeometry }
      if (any.isLight) {
        if (any instanceof THREE.PointLight || any instanceof THREE.SpotLight) {
          const p = new THREE.Vector3().setFromMatrixPosition(any.matrixWorld)
          S.managed.push({ o, kind: 'light', c: p, r: 0, far: false, hid: false, castOrig: false, inten: any.intensity })
        } else if (any instanceof THREE.DirectionalLight || any instanceof THREE.HemisphereLight || any instanceof THREE.AmbientLight) {
          const l = any as THREE.Light
          S.lights.push({ o: l, color: l.color.clone(), gcolor: l instanceof THREE.HemisphereLight ? l.groundColor.clone() : undefined, inten: l.intensity })
        }
      } else if (any.isSprite) {
        S.managed.push({ o, kind: 'sprite', c: new THREE.Vector3().setFromMatrixPosition(o.matrixWorld), r: 0, far: false, hid: false, castOrig: false, inten: 0 })
      } else if ((any.isMesh || any.isPoints || any.isLine) && o.visible && any.geometry) {
        const g = any.geometry
        const im = o as THREE.InstancedMesh
        if ((o as THREE.InstancedMesh).isInstancedMesh) im.computeBoundingSphere()
        const bs = (o as THREE.InstancedMesh).isInstancedMesh && im.boundingSphere ? im.boundingSphere : (g.boundingSphere ?? (g.computeBoundingSphere(), g.boundingSphere))
        if (bs) {
          const c = bs.center.clone().applyMatrix4(o.matrixWorld)
          const sc = new THREE.Vector3().setFromMatrixScale(o.matrixWorld)
          const r = bs.radius * Math.max(sc.x, sc.y, sc.z)
          const d3 = c.distanceTo(CENTER)
          S.managed.push({ o, kind: 'mesh', c, r, far: d3 > 120 || r > 200, hid: false, castOrig: (o as THREE.Mesh).castShadow, inten: 0 })
        }
      }
      o.children.forEach(visit)
    }
    visit(scene)
    S.envI = (scene as unknown as { environmentIntensity?: number }).environmentIntensity ?? 1
    recordHexTiming('collect', started)
  }

  const restoreAll = () => {
    S.managed.forEach((m) => {
      if (m.kind === 'light') (m.o as THREE.PointLight).intensity = m.inten
      else {
        if (m.hid) m.o.visible = true
        if (m.kind === 'mesh') (m.o as THREE.Mesh).castShadow = m.castOrig
      }
      m.hid = false
    })
    S.lights.forEach((l) => {
      l.o.color.copy(l.color)
      l.o.intensity = l.inten
      if (l.gcolor) (l.o as THREE.HemisphereLight).groundColor.copy(l.gcolor)
    })
    ;(scene as unknown as { environmentIntensity: number }).environmentIntensity = S.envI
    if (camera instanceof THREE.PerspectiveCamera && Math.abs(camera.fov - S.baseFov) > 1e-3) {
      camera.fov = S.baseFov
      camera.updateProjectionMatrix()
    }
  }

  // Test-only successor to the REJECTED one-shot 32-variant Linear precompile.
  // Keep the EXISTING one-material-per-healthy-frame schedule, but use the
  // same Linear-sRGB output variant as the native postprocessing composer.
  // gl.compileAsync is called with the private target bound synchronously;
  // every R3F renderer state is restored before the callback returns.
  // No original mesh, PBR material, texture, shadow or final framebuffer
  // is replaced. Normal portfolio visits do not enable this experiment.
  const hexCooperativeLinear = typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('hexCooperativeLinear') === '1'
  const hexCooperativeTarget = useRef<THREE.WebGLRenderTarget | null>(null)
  useEffect(()=>{
    if(!hexCooperativeLinear)return
    const target=new THREE.WebGLRenderTarget(4,4,{
      depthBuffer:false,stencilBuffer:false
    })
    target.texture.colorSpace=THREE.LinearSRGBColorSpace
    hexCooperativeTarget.current=target
    return ()=>{
      if(hexCooperativeTarget.current===target)
        hexCooperativeTarget.current=null
      target.dispose()
    }
  },[gl,hexCooperativeLinear])

  // Three.js r187 WebGLProgram.getUniforms()/getAttributes() call
  // onFirstUse lazily, after compileAsync has resolved. The real HEX click
  // was still synchronizing 27 shader diagnostic logs for those programs.
  // TEST ONLY: initialize one original cached GPU program per healthy
  // idle frame, with full original shader error checking still enabled.
  const hexPrimeFirstUse=hexCooperativeLinear &&
    new URLSearchParams(window.location.search).get('hexShadowProgramWarm')==='1' &&
    typeof window!=='undefined' &&
    new URLSearchParams(window.location.search).get('hexPrimeFirstUse')==='1'

  // Optional second diagnostic: after KHR program completion, initialize
  // first-use with the release-mode shader-log setting, while explicitly
  // checking LINK_STATUS. Restore renderer.debug before returning. The
  // original GLSL and visible rendering are NEVER changed.
  const hexPrimeSkipLogs=hexPrimeFirstUse &&
    new URLSearchParams(window.location.search).get('hexPrimeSkipLogs')==='1'

  const compileHexCooperatively=(obj:THREE.Object3D)=>{
    const scratch=hexCooperativeLinear?hexCooperativeTarget.current:null
    if(!scratch)return gl.compileAsync(obj,camera,scene)
    const originalTarget=gl.getRenderTarget()
    const originalViewport=gl.getViewport(new THREE.Vector4()).clone()
    const originalScissor=gl.getScissor(new THREE.Vector4()).clone()
    const originalScissorTest=gl.getScissorTest()
    const started=performance.now()
    try {
      gl.setRenderTarget(scratch)
      S.warmLinearSubmissions++
      const seenBefore=hexPrimeFirstUse?
        new Set(gl.info.programs??[]):null
      const pending=gl.compileAsync(obj,camera,scene)
      if(seenBefore){
        const actual=(gl.info.programs??[]) as unknown as Array<{
          isReady:()=>boolean;getUniforms:()=>unknown;getAttributes:()=>unknown
        }>
        for(const program of actual){
          if(!seenBefore.has(program as never)&&
              !S.warmProgramSeen.has(program)){
            S.warmProgramSeen.add(program)
            S.warmProgramCreated.push(program)
          }
        }
      }
      return pending
    }finally{
      gl.setRenderTarget(originalTarget)
      gl.setViewport(originalViewport)
      gl.setScissor(originalScissor)
      gl.setScissorTest(originalScissorTest)
      const elapsed=performance.now()-started
      S.warmLinearMaxSubmitMs=Math.max(S.warmLinearMaxSubmitMs,elapsed)
      if(gl.getRenderTarget()!==originalTarget)
        S.warmLinearRestoreErrors++
    }
  }

  // TEST ONLY: precompile the ORIGINAL shadow-depth program variants.
  // WebGLShadowMap builds MeshDepthMaterial from each source material and
  // reverses FrontSide/BackSide for the shadow pass. These variants were the
  // final three uncached GPU programs after 83 cooperative Linear shaders.
  // We use source geometry/InstancedMesh flags, but NEVER draw a preview,
  // change 2048px shadow resolution, or touch original source materials.
  const hexShadowProgramWarm = hexCooperativeLinear &&
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('hexShadowProgramWarm')==='1'
  const hexShadowQueue = useRef({
    items:[] as THREE.Object3D[],
    ownedMaterials:[] as THREE.Material[]
  }).current

  useEffect(()=>{
    if(!hexShadowProgramWarm)return
    const variants=new Set<string>()
    const programs:THREE.Object3D[]=[]
    const owned:THREE.Material[]=[]
    ueh.current?.traverse(node=>{
      const mesh=node as THREE.Mesh
      if(!mesh.isMesh||!mesh.castShadow||
          !mesh.geometry||Array.isArray(mesh.material)||!mesh.material)return
      const source=mesh.material as THREE.MeshStandardMaterial
      const instanced=(mesh as THREE.InstancedMesh).isInstancedMesh===true
      const isAlpha=source.alphaTest>0||source.alphaToCoverage===true
      const side=source.shadowSide!==null?source.shadowSide:
        source.side===THREE.FrontSide?THREE.BackSide:
        source.side===THREE.BackSide?THREE.FrontSide:THREE.DoubleSide
      const key=[
        instanced?'inst':'mesh',
        source.type,
        source.map?'map':'nomap',
        source.alphaMap?'alphamap':'none',
        isAlpha?'cutout':'opaque',
        source.alphaToCoverage?'atc':'noatc',
        source.displacementMap?'displacement':'plain',
        side,
        source.wireframe?'wire':'solid'
      ].join('|')
      if(variants.has(key))return
      variants.add(key)
      const mat=mesh.customDepthMaterial ?? new THREE.MeshDepthMaterial()
      if(!mesh.customDepthMaterial){
        const depth=mat as THREE.MeshDepthMaterial
        depth.side=side
        depth.map=source.map
        depth.alphaMap=source.alphaMap
        depth.alphaTest=source.alphaToCoverage?0.5:source.alphaTest
        depth.displacementMap=source.displacementMap
        depth.displacementScale=source.displacementScale
        depth.displacementBias=source.displacementBias
        depth.wireframe=source.wireframe
        depth.clipShadows=source.clipShadows
        depth.clippingPlanes=source.clippingPlanes
        depth.clipIntersection=source.clipIntersection
        owned.push(depth)
      }
      const proxy=mesh.clone(false) as THREE.Mesh
      proxy.material=mat
      proxy.frustumCulled=false
      proxy.castShadow=false
      programs.push(proxy)
    })
    hexShadowQueue.items=programs
    hexShadowQueue.ownedMaterials=owned
    S.warmShadowTotal=programs.length
    return ()=>{
      hexShadowQueue.items.length=0
      for(const material of owned)material.dispose()
      owned.length=0
    }
  },[scene,hexShadowProgramWarm])

  // Hàng đợi chuẩn bị tài nguyên UEH phân bổ đều (texture + shader) để KHÔNG khựng khi lại gần đàn lần đầu
  const buildWarmQueues = () => {
    if (S.warmStarted) return
    const started = performance.now()
    S.warmStarted = true
    const seenTex = new Set<THREE.Texture>()
    const seenMat = new Set<THREE.Material>()
    const scan = (root: THREE.Object3D | null) => {
      if (!root) return
      root.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined
        if (!m) return
        const list = Array.isArray(m) ? m : [m]
        let needCompile = false
        list.forEach((mat) => {
          if (!seenMat.has(mat)) {
            seenMat.add(mat)
            needCompile = true
          }
          const rec = mat as unknown as Record<string, unknown>
          ;['map', 'bumpMap', 'roughnessMap', 'normalMap', 'emissiveMap'].forEach((k) => {
            const t = rec[k]
            if (t instanceof THREE.Texture && !seenTex.has(t)) {
              seenTex.add(t)
              S.warmTex.push(t)
            }
          })
          const unif = (mat as THREE.ShaderMaterial).uniforms
          if (unif) {
            Object.values(unif).forEach((u) => {
              if (u?.value instanceof THREE.Texture && !seenTex.has(u.value)) {
                seenTex.add(u.value)
                S.warmTex.push(u.value)
              }
            })
          }
        })
        if (needCompile) S.warmMesh.push(o)
      })
    }
    // Prepare Piano sheets and GoldZone before the hidden UEH campus.
    if (hostRoot.current) for (const child of hostRoot.current.children) if (child !== ueh.current) scan(child)
    scan(ueh.current)
    // Shader programs must be compiled BEFORE 41 texture uploads. The old
    // texture-first queue reached a visitor click with 0/83 shaders ready.
    // Use exact source meshes/materials but prime the nearby unique program
    // variants first, rather than compiling the same GLSL 83 times.
    scene.updateMatrixWorld(true)
    const position = new THREE.Vector3()
    const distance = (obj: THREE.Object3D) => {
      obj.getWorldPosition(position)
      return Math.hypot(position.x-CENTER.x,position.z-CENTER.z)
    }
    S.warmMesh.sort((a,b)=>distance(a)-distance(b))
    const variantKey = (obj: THREE.Object3D) => {
      const m = (obj as THREE.Mesh).material
      const mats = Array.isArray(m) ? m : m ? [m] : []
      return [
        (obj as THREE.InstancedMesh).isInstancedMesh ? 'instanced' : 'plain',
        ...mats.map(mat => {
          const p = mat as THREE.MeshStandardMaterial
          return [mat.type,mat.customProgramCacheKey(),
            // Two custom ShaderMaterials can share the same default cache key
            // while containing completely different GLSL (rain/reel/sparks).
            // Compile BOTH original programs rather than wrongly deduplicating.
            mat instanceof THREE.ShaderMaterial ?
              mat.vertexShader+'@@'+mat.fragmentShader : '',
            p.map?'map':'nomap',p.normalMap?'normal':'',
            p.bumpMap?'bump':'',p.roughnessMap?'rough':'',
            p.alphaMap?'alpha':'',p.emissiveMap?'emissive':'',
            mat.transparent?'blend':'opaque',mat.side
          ].join(':')
        }),
      ].join('|')
    }
    const seenVariants = new Set<string>()
    S.warmCritical = S.warmMesh.filter(obj=>{
      const key=variantKey(obj)
      if(seenVariants.has(key))return false
      seenVariants.add(key)
      return true
    })
    const critical=new Set(S.warmCritical)
    S.warmMesh=S.warmMesh.filter(obj=>!critical.has(obj))
    S.warmShaderTotal = S.warmMesh.length + S.warmCritical.length
    S.warmTextureTotal = S.warmTex.length
    recordHexTiming('warm-queue-build', started)
  }

  useEffect(() => {
    patchAll()
    buildWarmQueues()
    const t = window.setTimeout(patchAll, 2500)
    if (camera instanceof THREE.PerspectiveCamera) S.baseFov = camera.fov
    return () => {
      window.clearTimeout(t)
      music.stop(0.1)
      RW.uRW.value.z = 0
      rt.suppressAutoPlay = false
      restoreAll()
      setInteractiveFilter(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // phím R: thu hồi thực tại
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyR' && !e.repeat && useStore.getState().phase === 'playing') dismissReality()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // bộ lọc tương tác: vật thể gốc đã bị quét thì không còn nhận tương tác "ma"
  useEffect(() => {
    setInteractiveFilter((o) => {
      if (RW.uRW.value.z < 0.5 || underKeep(o)) return true
      o.getWorldPosition(tmp)
      return frontReached(Math.hypot(tmp.x - CENTER.x, tmp.z - CENTER.z), tmp.y) < 0
    })
  }, [tmp])

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, rt.maxDt)
    const st = useReality.getState()
    rt.t = state.clock.elapsedTime

    // --- 1. Intro-only GPU preflight. No synchronous shader compilation during gameplay.
    const pendingShaderInput = (navigator as Navigator & {
      scheduling?:{isInputPending?:()=>boolean}
    }).scheduling?.isInputPending?.() ?? false
    const shaderHealthy = rawDt > 0 && rawDt <= 0.10 &&
      document.visibilityState === 'visible' && !pendingShaderInput
    S.warmHealthyPaints = shaderHealthy ? S.warmHealthyPaints + 1 : 0
    const warmOpportunity = S.warmHealthyPaints >= 2
    if (warmOpportunity) S.warmHealthyPaints = 0
    if (S.warmPass < 2 && (st.phase === 'idle' || st.phase === 'ignite') && warmOpportunity) {
      // Interleave critical program compilation and texture uploads. An
      // all-shader-first queue can leave every large UEH texture cold when a
      // visitor activates the piano after only a few seconds.
      if (S.warmCritical.length && !S.warmCompilePending &&
          (S.warmShaderDone <= S.warmTextureDone || !S.warmTex.length)) {
        const obj=S.warmCritical.shift()!
        S.warmCompilePending=true
        if(typeof gl.compileAsync==='function') {
          void compileHexCooperatively(obj).catch(err=>{
            S.warmErrors++;console.warn('[HEX preflight] critical shader',err)
          }).finally(()=>{S.warmCompilePending=false;S.warmShaderDone++})
        } else {
          try{gl.compile(obj,camera,scene)}
          catch(err){S.warmErrors++;console.warn('[HEX preflight] critical shader fallback',err)}
          S.warmCompilePending=false
          S.warmShaderDone++
        }
      } else if(S.warmCompilePending) {
        // Let async compilation complete before starting the next resource.
      } else if (S.warmTex.length) {
        const tex = S.warmTex.shift()!
        try {
          gl.initTexture(tex)
          S.warmTextureDone++
        } catch (err) { S.warmErrors++; console.warn('[Piano preflight] texture', err) }
      } else if (S.warmMesh.length && !S.warmCompilePending) {
        const obj = S.warmMesh.shift()!
        S.warmCompilePending = true
        if (typeof gl.compileAsync === 'function') {
          void compileHexCooperatively(obj).catch(err => {
            S.warmErrors++
            console.warn('[Piano preflight] shader', err)
          }).finally(() => { S.warmCompilePending = false; S.warmShaderDone++ })
        } else {
          try { gl.compile(obj, camera, scene) }
          catch (err) { S.warmErrors++; console.warn('[Piano preflight] shader fallback', err) }
          S.warmCompilePending = false
          S.warmShaderDone++
        }
      } else if (hexShadowProgramWarm && hexShadowQueue.items.length &&
          !S.warmCompilePending) {
        const shadowProxy=hexShadowQueue.items.shift()!
        S.warmCompilePending=true
        void compileHexCooperatively(shadowProxy).then(()=>{
          S.warmShadowDone++
        }).catch(err=>{
          S.warmShadowErrors++
          console.warn('[HEX preflight] native depth program',err)
        }).finally(()=>{S.warmCompilePending=false})
      } else if (hexPrimeFirstUse && !S.warmPrimeSeeded &&
          !S.warmCompilePending) {
        S.warmPrimeSeeded=true
        S.warmPrimeQueue=[...S.warmProgramCreated]
        S.warmPrimeTotal=S.warmPrimeQueue.length
      } else if (hexPrimeFirstUse && S.warmPrimeQueue.length &&
          !S.warmCompilePending) {
        const program=S.warmPrimeQueue.shift()!
        if(!program.isReady()){
          S.warmPrimeQueue.push(program)
        }else{
          const began=performance.now()
          try{
            if(hexPrimeSkipLogs){
              const gpu=gl.getContext()
              // .isReady() was checked above; querying LINK_STATUS here
              // protects against masking a real compilation failure.
              const compiled=program as typeof program & {program:WebGLProgram}
              if(!gpu.getProgramParameter(compiled.program,gpu.LINK_STATUS)){
                S.warmPrimeLinkFailures++
                throw Error('GPU program failed LINK_STATUS before first use')
              }
              const previous=gl.debug.checkShaderErrors
              try{
                gl.debug.checkShaderErrors=false
                program.getUniforms()
                program.getAttributes()
              }finally{
                gl.debug.checkShaderErrors=previous
              }
              S.warmPrimeCheckedWithoutLogs++
            }else{
              program.getUniforms()
              program.getAttributes()
            }
            S.warmPrimeDone++
          }catch(err){
            S.warmPrimeErrors++
            console.warn('[HEX GPU first-use preflight]',err)
          }
          const took=performance.now()-began
          S.warmPrimeMaxMs=Math.max(S.warmPrimeMaxMs,took)
          // A 200ms idle call is NOT a fix. Record, stop immediately and
          // leave the option off in production if any such call occurs.
          if(took>120){
            S.warmPrimePaused=true
            S.warmPrimeQueue.length=0
          }
        }
      } else if (!S.warmCompilePending) {
        // The old one-frame ENTIRE-UEH visibility preflight caused a large
        // first GPU submission. Private source-mesh batches above replace it.
        // Keep the real world hidden until the real HEX state machine reveals it.
        S.warmPass = 2
      }
    }
        ;(window as unknown as {__orbitaHexShaderPrep?: unknown}).__orbitaHexShaderPrep = {
      status: S.warmPass === 2 ? 'complete-or-interrupted' : S.warmCompilePending ? 'compiling' : 'warming',
      totalShaders: S.warmShaderTotal,
      totalTextures: S.warmTextureTotal,
      compiledShaders: S.warmShaderDone,
      uploadedTextures: S.warmTextureDone,
      remainingShaders: S.warmMesh.length+S.warmCritical.length,
      criticalRemaining: S.warmCritical.length,
      remainingTextures: S.warmTex.length,
      errors: S.warmErrors,
      preflightTarget: hexCooperativeLinear?'linear-per-material':'default',
      linearSubmissions:S.warmLinearSubmissions,
      linearMaxSubmitMs:Math.round(S.warmLinearMaxSubmitMs),
      linearRestoreErrors:S.warmLinearRestoreErrors,
      programCount:gl.info.programs?.length??0,
      shadowVariantTotal:S.warmShadowTotal,
      shadowVariantDone:S.warmShadowDone,
      shadowVariantErrors:S.warmShadowErrors,
      primeTotal:S.warmPrimeTotal,
      primeDone:S.warmPrimeDone,
      primeErrors:S.warmPrimeErrors,
      primeMaxMs:Math.round(S.warmPrimeMaxMs),
      primePaused:S.warmPrimePaused,
      primeLinkFailures:S.warmPrimeLinkFailures,
      primeCheckedWithoutLogs:S.warmPrimeCheckedWithoutLogs,
    }
    // Continue the cooperative material/texture queue AFTER entering the
    // world: the old intro-exit handler discarded every remaining UEH shader
    // before the visitor could reach the piano. That forced first-HEX
    // material compilation on the interaction frame. There is no more
    // full-world visibility preflight to clean up at intro exit.
    if (S.warmPass < 2 &&
        (st.phase === 'sweep' || st.phase === 'active' || st.phase === 'retract')) {
      // Stop GPU prep when the first visible HEX sweep begins; all future
      // rendering follows the authentic HEX sweep/materialization state.
      S.warmTex.length = 0
      S.warmMesh.length = 0
      S.warmCritical.length = 0
      S.warmPrimeQueue.length=0
      S.warmPass = 2
    }
    // --- 2. Hiện diện của người chơi quanh đàn ---
    const dist = Math.hypot(player.pos.x - CENTER.x, player.pos.z - CENTER.z)
    const pt = 1 - ease.smooth(8, 15, dist)
    rt.presence += (pt - rt.presence) * (1 - Math.exp(-dt * 3))

    // --- 3. Máy trạng thái & Chuyển bài liên tục trong không gian UEH ---
    if (st.phase !== S.lastPhase) {
      if (st.phase === 'ignite') {
        S.ignT = 0
        S.u = 0
        rt.ignite = 0
        audio.prepare()
        collect()
        patchAll()
        const reelStarted = performance.now()
        reel.use(st.track!)
        recordHexTiming('reel-use-call', reelStarted)
        S.lastTrack = st.track
        S.lastSwitchSeq = st.switchSeq
        toast(`Triệu hồi · ${TRACKS[st.track!].title}`, 2400)
      }
      if (st.phase === 'sweep') {
        RW.uRW.value.z = 1
        S.u = 0
        rt.flash = 1
        rt.suppressAutoPlay = true
        music.start(st.track!, 0.35, 0.08)
        S.musicOn = true
        useReality.getState().set({ demo: true })
      }
      if (st.phase === 'retract') {
        S.u = Math.max(0.0001, Math.pow(rt.front / FRONT_MAX, 1 / 1.5))
        rt.suppressAutoPlay = false
        music.stop(3)
        reel.stop()
        S.musicOn = false
      }
      S.lastPhase = st.phase
    }

    // Chuyển bài mượt mà ngay trong UEH (KHÔNG thu hồi về vũ trụ!)
    if ((st.phase === 'sweep' || st.phase === 'active') && st.switchSeq !== S.lastSwitchSeq && st.track) {
      S.lastSwitchSeq = st.switchSeq
      S.lastTrack = st.track
      reel.use(st.track)
      music.start(st.track, 0.25, 0.85)
      S.musicOn = true
      useReality.getState().set({ demo: true })
      toast(`Chuyển sang · ${TRACKS[st.track].title}`, 2400)
    }

    if (st.phase === 'ignite') {
      S.ignT += dt / IGNITE_S
      rt.ignite = ease.inOut(Math.min(1, S.ignT))
      if (S.ignT >= 1) useReality.getState().setPhase('sweep')
    } else if (st.phase === 'sweep') {
      S.u += dt / SWEEP_S
      rt.front = curve(S.u)
      rt.ignite = Math.max(0, rt.ignite - dt * 0.5)
      if (S.u >= 1) useReality.getState().setPhase('active')
    } else if (st.phase === 'active') {
      rt.front = FRONT_MAX
      rt.ignite = 0
      if (S.musicOn && music.playing) useReality.getState().set({ demo: music.demo })
      if (music.ended && rt.dbg === null) useReality.getState().setPhase('retract')
    } else if (st.phase === 'retract') {
      S.u -= dt / RETRACT_S
      rt.front = curve(Math.max(0, S.u))
      rt.ignite = 0
      if (S.u <= 0) {
        rt.front = 0
        RW.uRW.value.z = 0
        restoreAll()
        S.managed.length = 0
        S.lastTrack = null
        useReality.getState().set({ track: null, phase: 'idle' })
        S.lastPhase = 'idle'
      }
    }
    if (rt.dbg !== null && (st.phase === 'sweep' || st.phase === 'active')) rt.front = rt.dbg
    rt.flash = Math.max(0, rt.flash - dt * 0.7)

    // --- 4. Hai linh hồn thiên nhiên trên cùng sân trường UEH ---
    const inUEH = st.phase === 'sweep' || st.phase === 'active'
    const wantRain = inUEH && st.track === 'mua-ha' ? 1 : 0
    const wantBlossom = inUEH && st.track === 'ngay-mai' ? 1 : 0

    rt.rain += (wantRain - rt.rain) * (1 - Math.exp(-dt * (wantRain ? 0.75 : 1.1)))
    rt.blossom += (wantBlossom - rt.blossom) * (1 - Math.exp(-dt * (wantBlossom ? 0.8 : 1.3)))
    const wantWet = wantRain ? 1 : 0
    rt.wetness += (wantWet - rt.wetness) * (1 - Math.exp(-dt * (wantWet ? 0.35 : 0.22)))
    const wantWind = wantBlossom ? 0.65 + music.energy * 0.35 : wantRain ? 0.26 : 0.2
    rt.wind += (wantWind - rt.wind) * (1 - Math.exp(-dt * 1.2))

    if (st.phase === 'idle') {
      rt.rain = 0
      rt.wetness = 0
      rt.blossom = 0
    }

    // --- 5. Uniform toàn cục ---
    music.update(dt)
    const lvl = Math.min(1, music.bass * 0.7 + music.mid * 0.4 + music.kick * 0.35)
    RW.uRW.value.x = rt.front
    RW.uRW.value.w += (lvl - RW.uRW.value.w) * (1 - Math.exp(-dt * 12))
    RW.uRWc.value.copy(CENTER)
    RW.uRWt.value.w = st.track === 'ngay-mai' ? 1 : 0
    RW.uRWenv.value.set(rt.rain, rt.wetness, rt.blossom, rt.wind)

    const rK = rt.rain
    RW.uRWhaze.value.set(
      THREE.MathUtils.lerp(0.95, 0.62, rK),
      THREE.MathUtils.lerp(0.68, 0.66, rK),
      THREE.MathUtils.lerp(0.44, 0.72, rK),
      THREE.MathUtils.lerp(0.0072, 0.0094, rK),
    )
    RW.uRWsun.value.set(-0.55, 0.16, -0.82).normalize()

    WU.uTime.value = state.clock.elapsedTime
    WU.uMus.value.set(music.bass, music.mid, music.high, music.kick)
    WU.uProg.value = music.progress
    WU.uEnergy.value = music.energy

    const on = RW.uRW.value.z > 0.5
    // --- 6. Vật thể gốc: ẩn khi đã bị quét hoàn toàn, khôi phục khi thu hồi ---
    if (on) {
      for (const m of S.managed) {
        if (m.kind === 'light') {
          const xc = frontReached(Math.hypot(m.c.x - CENTER.x, m.c.z - CENTER.z), m.c.y)
          ;(m.o as THREE.PointLight).intensity = m.inten * (1 - ease.smooth(-8, 10, xc))
          continue
        }
        const dxz = Math.hypot(m.c.x - CENTER.x, m.c.z - CENTER.z)
        const xc = frontReached(dxz, m.c.y)
        let swept: boolean
        if (m.kind === 'sprite') swept = xc > 0
        else {
          const x = m.far ? rt.front - 306 : frontReached(dxz + m.r * 1.25 + 4, m.c.y + m.r * 1.25)
          swept = x > 0
          const noCast = m.far ? false : xc > 0
          ;(m.o as THREE.Mesh).castShadow = m.castOrig && !noCast
        }
        if (swept && !m.hid) {
          m.o.visible = false
          m.hid = true
        } else if (!swept && m.hid) {
          m.o.visible = true
          m.hid = false
        }
      }
    }

    // --- 7. Ánh sáng toàn cục pha mượt theo mặt trận & thời tiết ---
    const g = ease.smooth(25, 240, rt.front)
    rt.grade = g
    if (g > 0.001) {
      S.lights.forEach((l) => {
        if (l.o instanceof THREE.DirectionalLight) {
          tc.set(GRADE_BLOSSOM.sun).lerp(tc2.set(GRADE_RAIN.sun), rK)
          l.o.color.copy(l.color).lerp(tc, g)
          const sunI = THREE.MathUtils.lerp(GRADE_BLOSSOM.sunI, GRADE_RAIN.sunI, rK)
          l.o.intensity = THREE.MathUtils.lerp(l.inten, l.inten * sunI, g)
        } else if (l.o instanceof THREE.HemisphereLight) {
          tc.set(GRADE_BLOSSOM.sky).lerp(tc2.set(GRADE_RAIN.sky), rK)
          l.o.color.copy(l.color).lerp(tc, g)
          tc.set(GRADE_BLOSSOM.gnd).lerp(tc2.set(GRADE_RAIN.gnd), rK)
          l.o.groundColor.copy(l.gcolor!).lerp(tc, g)
          const hemiI = THREE.MathUtils.lerp(GRADE_BLOSSOM.hemiI, GRADE_RAIN.hemiI, rK)
          l.o.intensity = THREE.MathUtils.lerp(l.inten, l.inten * hemiI, g)
        } else if (l.o instanceof THREE.AmbientLight) {
          tc.set(GRADE_BLOSSOM.amb).lerp(tc2.set(GRADE_RAIN.amb), rK)
          l.o.color.copy(l.color).lerp(tc, g)
          const ambI = THREE.MathUtils.lerp(GRADE_BLOSSOM.ambI, GRADE_RAIN.ambI, rK)
          l.o.intensity = THREE.MathUtils.lerp(l.inten, l.inten * ambI, g)
        }
      })
      const envTarget = THREE.MathUtils.lerp(GRADE_BLOSSOM.env, GRADE_RAIN.env, rK)
      ;(scene as unknown as { environmentIntensity: number }).environmentIntensity = THREE.MathUtils.lerp(S.envI, S.envI * envTarget, g)
    }

    // FOV "thở" khi trường mở ra
    if (camera instanceof THREE.PerspectiveCamera) {
      const f = S.baseFov + rt.flash * rt.flash * 9 + (st.phase === 'sweep' ? music.kick * 1.1 : 0)
      if (Math.abs(camera.fov - f) > 0.01) {
        camera.fov = f
        camera.updateProjectionMatrix()
      }
    }

    // Drop draw calls for zero-visible-pixel UEH geometry during the
    // advancing and retracting scan. Nothing is hidden once HEX is complete.
    // Only restore visibility for meshes hidden by this specific culler.
    let culled = 0
    for (const entry of hexCull) {
      const shouldDraw = st.phase === 'idle' || st.phase === 'active' ||
        rt.front >= entry.threshold
      if (!shouldDraw && !entry.hidden) {
        entry.mesh.visible = false
        entry.hidden = true
      } else if (shouldDraw && entry.hidden) {
        entry.mesh.visible = true
        entry.hidden = false
      }
      if (entry.hidden) culled++
    }
    if (typeof window !== 'undefined') {
      ;(window as unknown as {__orbitaHexCullStats?:{eligible:number;culled:number;front:number}})
        .__orbitaHexCullStats = { eligible:hexCull.length, culled, front:rt.front }
    }

    // The original far-world sky material uses:
    // rwX = front - (150 + abs(y / radius)*150) - hash*6.
    // Therefore no sky fragment can exist at front < 150. Keep its exact
    // original mesh/shader but omit the entire GPU draw until front=140,
    // ten units BEFORE its earliest possible visible fragment.
    for (const sky of hexFarSkies) {
      const shouldRender = rt.front >= 140 &&
        (st.phase === 'sweep' || st.phase === 'active' || st.phase === 'retract')
      if (sky.visible !== shouldRender) sky.visible = shouldRender
    }
    // The original newly generated world is completely shader-discarded
    // before HEX sweep begins. Do not submit its entire GPU geometry during
    // the 2.6s ignition. Actual scan/active/retract render remains unchanged.
    if (ueh.current) {
      const reveal = st.phase === 'sweep' || st.phase === 'active' || st.phase === 'retract'
      ueh.current.visible = reveal && hexGpuDiag !== 'no-world'
      // Category ablation is enabled exclusively by the benchmark query.
      // This runs last so local weather/foliage animation cannot re-enable
      // a deliberately isolated diagnostic drawable during its own useFrame.
      for (const d of hexProbeSuppressed) d.object.visible=false
      if (reveal) {
        S.warmPass = 2
        S.warmTex.length = 0
        S.warmMesh.length = 0
      }
    }
  })

  return (
    <group ref={hostRoot} userData={{ rwKeep: true }}>
      <group ref={ueh} visible={false}>
        <UEHWorld />
      </group>
      <HexLattice />
      <StaffWall />
      <Ignition />
      {hexGpuDiag !== 'no-sheets' && <Sheets />}
    </group>
  )
}
