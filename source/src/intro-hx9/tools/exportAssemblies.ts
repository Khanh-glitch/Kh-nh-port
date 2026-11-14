import * as THREE from 'three'
import {createStagedCockpit} from '../stagedCockpit'
import {GLTFExporter} from 'three/examples/jsm/exporters/GLTFExporter.js'
async function run(){
 const c=createStagedCockpit(), stages: THREE.Object3D[][]=[]
 for(let i=0;i<4;i++){const start=c.group.children.length;c.buildNext();stages.push(c.group.children.slice(start))}
 c.screens.forEach((m,i)=>{m.userData.hx9Screen=i})
 const buckets:Record<string,THREE.Object3D[]>={structure:[],shell:[],glass:[],dashboard:[],controls:[],seat:[]}
 for(const m of stages[0]){const material=(m as THREE.Mesh).material;const mat=Array.isArray(material)?material[0]:material;if(mat===c.materials.shell)buckets.shell.push(m);else if(mat===c.materials.glass)buckets.glass.push(m);else buckets.structure.push(m)}
 for(const [name,arr] of [['dashboard',stages[1]],['controls',stages[2]]] as const)buckets[name].push(...arr)
 const previous=stages[0].length+stages[1].length+stages[2].length
 const boundary=Number(c.group.userData.hx9AftStart)-previous
 if(!Number.isInteger(boundary)||boundary<=0||boundary>=stages[3].length)throw Error('Missing seat / aft bulkhead boundary')
 buckets.seat.push(...stages[3].slice(0,boundary))
 buckets.shell.push(...stages[3].slice(boundary))
 const out=[]
 for(const [name,objects] of Object.entries(buckets)){
  const group=new THREE.Group();group.name='HX9_'+name;group.add(...objects)
  const data=await new GLTFExporter().parseAsync(group,{binary:true,onlyVisible:false}) as ArrayBuffer
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([data]));a.download=`${name}.glb`;a.click()
  out.push({name,objects:objects.length,bytes:data.byteLength})
  await new Promise(r=>setTimeout(r,1000))
 }
 ;(window as unknown as {result:unknown}).result=out
}
run().catch(e=>{console.error(e);(window as unknown as {result:unknown}).result={error:String(e)}})
