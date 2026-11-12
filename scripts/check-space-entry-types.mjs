import {spawnSync} from 'node:child_process'
import {readFileSync} from 'node:fs'
import assert from 'node:assert/strict'
const tsc='source/node_modules/typescript/bin/tsc'
const run=spawnSync(process.execPath,[tsc,'--noEmit','--pretty','false',
  '--project','source/tsconfig.entry.json'],{encoding:'utf8',timeout:180000})
if(run.error)throw run.error
const lines=(run.stdout+'\n'+run.stderr).split(/\r?\n/)
  .filter(x=>/error TS\d+:/.test(x))
const known=[
  ['RealityHost.tsx','TS2339',"Property 'uuid'"],
  ['RealityHost.tsx','TS2339',"Property 'name'"],
  ['RealityHost.tsx','TS2339',"Property 'type'"],
  ['kit.tsx','TS6133',"'phase' is declared"],
]
// Four pre-existing upstream errors, outside the reviewed entry modules.
// Never mask NEW errors in App, Overlay, Experience or their other imports.
const matches=lines.map(line=>known.findIndex(([file,code,msg])=>
  line.includes(file)&&line.includes(code)&&line.includes(msg)))
const unexpected=lines.filter((line,i)=>matches[i]===-1)
const duplicate=known.map((_,i)=>matches.filter(m=>m===i).length!==1)
console.log('ISLAND_ENTRY_TYPECHECK '+JSON.stringify({
  compilerExit:run.status,errors:lines.length,
  existingDebt:lines.filter((_,i)=>matches[i]>=0),
  newErrors:unexpected,
},null,2))
assert.equal(unexpected.length,0,
  'New TypeScript errors introduced by real startup route:\n'+unexpected.join('\n'))
if(lines.length){
  assert.equal(lines.length,known.length,
    'Existing error baseline changed: audit required')
  assert(!duplicate.includes(true),'TypeScript legacy debt signature changed')
}else assert.equal(run.status,0,'Unexpected TypeScript compiler failure')
for(const file of ['source/src/App.tsx','source/src/ui/Overlay.tsx',
  'source/src/scene/Experience.tsx']){
  const source=readFileSync(file,'utf8')
  assert(!source.includes('assetsReadyAt'),'Synthetic entry timer regressed')
}
console.log('ISLAND_ENTRY_TYPECHECK_NO_NEW_ERRORS_PASS (4 explicitly reported legacy errors)')
