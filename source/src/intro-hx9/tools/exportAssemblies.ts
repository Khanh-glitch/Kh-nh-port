import * as THREE from 'three'
import {createStagedCockpit} from '../stagedCockpit'
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import {GLTFExporter} from 'three/examples/jsm/exporters/GLTFExporter.js'
// Bake world transforms and batch only opaque, static, single-material meshes
// with identical vertex layouts. No decimation, texture changes or remeshing.
// Transparent meshes, hardware instances and instrument screens remain separate.
function batchPart(objects: THREE.Object3D[], name: string): THREE.Group {
 const group = new THREE.Group(); group.name='HX9_'+name
 const batches = new Map<string,{material:THREE.Material; geometries:THREE.BufferGeometry[];cast:boolean;receive:boolean;order:number}>()
 for (const root of objects) {
  root.updateWorldMatrix(true,true)
  root.traverse(object => {
   const mesh=object as THREE.Mesh
   if(!mesh.isMesh || !mesh.geometry || !mesh.material) return
   const mats=Array.isArray(mesh.material)?mesh.material:[mesh.material]
   const geom=mesh.geometry
   const attrs=Object.entries(geom.attributes).sort(([a],[b])=>a.localeCompare(b)).map(([k,a])=>`${k}:${a.itemSize}:${a.normalized}:${a.array.constructor.name}`).join('|')
   const shouldKeep=(mesh as THREE.InstancedMesh).isInstancedMesh || mats.length!==1 || mats[0].transparent || mesh.userData.hx9Screen!==undefined || Object.keys(geom.morphAttributes).length>0 || geom.drawRange.start!==0 || geom.drawRange.count!==Infinity
   if(shouldKeep){
    const copy=mesh.clone(false);copy.matrixAutoUpdate=false;copy.matrix.copy(mesh.matrixWorld);group.add(copy);return
   }
   const key=`${mats[0].uuid}/${Boolean(geom.index)}/${attrs}/${mesh.castShadow}/${mesh.receiveShadow}/${mesh.renderOrder}`
   const baked=geom.clone();baked.applyMatrix4(mesh.matrixWorld);baked.clearGroups()
   const b=batches.get(key) ?? {material:mats[0],geometries:[],cast:mesh.castShadow,receive:mesh.receiveShadow,order:mesh.renderOrder}
   b.geometries.push(baked);batches.set(key,b)
  })
 }
 for(const {material,geometries,cast,receive,order} of batches.values()){
  const merged=mergeGeometries(geometries,false)
  if(!merged) throw new Error('Could not merge geometry layouts')
  const mesh=new THREE.Mesh(merged,material);mesh.castShadow=cast;mesh.receiveShadow=receive;mesh.renderOrder=order;group.add(mesh)
 }
 return group
}
async function run(){
 const c=createStagedCockpit(), stages: THREE.Object3D[][]=[]
 for(let i=0;i<4;i++){const start=c.group.children.length;c.buildNext();stages.push(c.group.children.slice(start))}
 c.screens.forEach((m,i)=>{m.userData.hx9Screen=i})
 const buckets:Record<string,THREE.Object3D[]>={structure:[],shell:[],glass:[],dashboard:[],controls:[],seat:[]}
 for(const m of stages[0]){const material=(m as THREE.Mesh).material;const mat=Array.isArray(material)?material[0]:material;if(mat===c.materials.shell)buckets.shell.push(m);else if(mat===c.materials.glass)buckets.glass.push(m);else buckets.structure.push(m)}
 for(const [name,arr] of [['dashboard',stages[1]],['controls',stages[2]],['seat',stages[3]]] as const)buckets[name].push(...arr)
 const out=[]
 for(const [name,objects] of Object.entries(buckets)){
  const group=batchPart(objects,name)
  const data=await new GLTFExporter().parseAsync(group,{binary:true,onlyVisible:false}) as ArrayBuffer
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([data]));a.download=`${name}.glb`;a.click()
  out.push({name,objects:objects.length,bytes:data.byteLength})
  await new Promise(r=>setTimeout(r,1000))
 }
 ;(window as unknown as {result:unknown}).result=out
}
run().catch(e=>{console.error(e);(window as unknown as {result:unknown}).result={error:String(e)}})
