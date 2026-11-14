import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
const require=createRequire(import.meta.url), esbuild=require('../source/node_modules/esbuild')
const dir=mkdtempSync(join(tmpdir(),'hx9-timeline-'))
try {
 const file=join(dir,'timeline.mjs')
 await esbuild.build({entryPoints:['source/src/intro-hx9/cinematicTimeline.ts'],outfile:file,bundle:true,format:'esm'})
 const {ASSEMBLY_CUES,assemblyPose,cameraDock,screenPower,CINEMATIC_END}=await import('file://'+file)
 assert.deepEqual(ASSEMBLY_CUES.map(c=>c.name),['seat','dashboard','controls','structure','shell','glass'])
 for(let i=1;i<ASSEMBLY_CUES.length;i++) assert(Math.abs(ASSEMBLY_CUES[i].start - (ASSEMBLY_CUES[i-1].start + ASSEMBLY_CUES[i-1].duration)) < 1e-9)
 for(const cue of ASSEMBLY_CUES){
  assert.equal(assemblyPose(cue,cue.start-.01).visible,false)
  assert.equal(assemblyPose(cue,cue.start).remaining,1)
  assert.equal(assemblyPose(cue,cue.start+cue.duration).remaining,0)
  assert.equal(assemblyPose(cue,cue.start+cue.duration).locked,true)
 }
 assert.equal(cameraDock(0),0);assert.equal(cameraDock(CINEMATIC_END),1)
 assert.equal(screenPower(0,0),0);assert.equal(screenPower(CINEMATIC_END,0),1)
 console.log('HX9_CINEMATIC_TIMELINE_PASS')
} finally {rmSync(dir,{recursive:true,force:true})}
