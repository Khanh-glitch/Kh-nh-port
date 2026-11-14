import assert from 'node:assert/strict'
import {mkdtempSync,rmSync,readFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createRequire} from 'node:module'
const esbuild=createRequire(import.meta.url)('../source/node_modules/esbuild')
const dir=mkdtempSync(join(tmpdir(),'hx9-fabrication-'))
try {
 const file=join(dir,'test.mjs')
 await esbuild.build({entryPoints:['source/src/intro-hx9/fabrication.ts'],outfile:file,bundle:true,format:'esm'})
 const {fabricationScan,createFabricationUniforms,patchFabrication}=await import('file://'+file)
 const min=-1,max=2, u=createFabricationUniforms()
 assert(fabricationScan(min,max,0)+u.uWireHeight.value < min)
 assert(fabricationScan(min,max,1)>max)
 assert(fabricationScan(min,max,.5)>min && fabricationScan(min,max,.5)<max)
 const ship=readFileSync('assets/immersive/src/SpaceScene.js','utf8')
 assert(ship.includes('hx.patchFabrication(mat, uniforms)'))
 assert(!ship.includes('drawLaser('))
 assert(ship.includes('fabricationReady = true'))
 assert(ship.includes('await downloads[index]'))
 assert(ship.includes('if (index === 0) fabricationReady = true'))
 assert(!ship.includes('await Promise.all(downloads)'))
 assert(ship.includes('phase>=1?1:0'))
 assert(ship.includes("['seat', 'dashboard', 'controls', 'structure', 'shell', 'glass']"))
 assert.equal(typeof patchFabrication,'function')
 console.log('HX9_FABRICATION_SCAN_PASS')
} finally {rmSync(dir,{recursive:true,force:true})}
