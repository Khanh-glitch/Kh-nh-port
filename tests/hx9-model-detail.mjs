import {readFileSync,statSync} from 'node:fs'
import assert from 'node:assert/strict'
const expected={structure:482410,shell:16848,seat:221293,dashboard:481032,controls:322998,glass:1571}
for(const [name,count] of Object.entries(expected)){
 const path=`assets/immersive/model/${name}.glb`, bytes=readFileSync(path)
 assert(bytes.toString('ascii',0,4)==='glTF');assert(statSync(path).size<25*1024*1024)
 const n=bytes.readUInt32LE(12),gltf=JSON.parse(bytes.subarray(20,20+n).toString('utf8'))
 const vertices=gltf.meshes.flatMap(m=>m.primitives).reduce((sum,p)=>sum+gltf.accessors[p.attributes.POSITION].count,0)
 assert.equal(vertices,count,`${name}: vertex count changed`)
 if(name==='dashboard')assert(gltf.nodes.some(n=>n.extras?.hx9Screen===0),'primary display must remain independently controllable')
 console.log(`${name}: ${vertices} original vertices, ${gltf.meshes.length} draw meshes`)
}
