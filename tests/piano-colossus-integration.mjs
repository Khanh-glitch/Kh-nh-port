import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = p => readFileSync(new URL('../source/src/' + p, import.meta.url), 'utf8')
const robot=read('scene/Robot.tsx'), piano=read('scene/Piano.tsx'),
  host=read('reality/RealityHost.tsx'), audio=read('audio.ts'),
  experience=read('scene/Experience.tsx'), world=read('world.ts')
assert.match(robot, /ApexShowcase/, 'V3 APEX preserved')
assert.match(robot, /RagnarokShowcase/, 'V3 Ragnarok preserved')
assert.match(robot, /ShowcaseWarmup/, 'V3 GPU prewarm preserved')
assert.match(piano, /rwKeep/, 'Piano materials isolated during rewrite')
assert.match(piano, /suppressAutoPlay/, 'No competing autoplay in UEH')
assert.match(audio, /if \(!this\.pianoReady\)/, 'Main synthesizer fallback preserved')
assert.match(host, /<UEHWorld/, 'UEH reality mounted')
assert.match(experience, /<RealityHost \/>/, 'RealityHost mounted')
assert.match(world, /passesInteractiveFilter/, 'Hidden-world interactions filtered')
console.log('PASS: Piano+Colossus V3 static integration contracts')
