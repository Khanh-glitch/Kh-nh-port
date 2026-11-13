import {readFileSync,existsSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const html=readFileSync('index.html','utf8');
const tag='<script id="orbita-embedded-map" type="application/json">';
const a=html.indexOf(tag),b=html.indexOf('</script>',a+tag.length);
assert(a>=0&&b>a,'Root ORBITA embedded importmap must survive');
const map=JSON.parse(html.slice(a+tag.length,b));
assert(Object.keys(map).length>=62,'All original ORBITA + new SHOWTIME modules embedded');
const baseline=JSON.parse(readFileSync('tests/integration-original-modules.json','utf8'));
// Reviewed, intentional changes in this branch (see tests/space-first-entry-contract.mjs
// for the reason of each). The hashes are refreshed, never skipped, so any
// further unreviewed edit of these modules still fails.
const REVIEWED_CHANGES=new Set([
 'orbita/scene/Player','orbita/scene/Robot',
 'orbita/scene/Phenomena','orbita/ui/Overlay',
 'orbita/audio','orbita/ui/RealityHud',
 // Beacon social icons: lights stay mounted at zero intensity.
 'orbita/scene/SocialDrops',
 'orbita/world',
 // HEX first-trigger preflight now compiles the Linear-sRGB program variant
 // the composer RenderPass actually draws (three r187 keys programs on
 // outputColorSpace). Behavioural proof: tests/hex-preflight-program-variant.mjs
 'orbita/reality/RealityHost',
 // Player: a throttled hover frame no longer drops the resolved click
 // target (that made most pointer-locked clicks land on null).
 'orbita/scene/Player',
 // Overlay: floating profile card alignment/max-height fixed so the card
 // and its close control stay on screen and beside-card click still closes.
 'orbita/ui/Overlay',
 // Perf tier: highGuard accepts the third tier as measured input (High is
 // still gated behind the same GPU probe), perfLadder is the new measured
 // ladder module, Experience wires the three-tier Q cycle, and the stage/sheet
 // textures are pooled+redrawn in place instead of allocated on a trigger.
 'orbita/highGuard','orbita/perfLadder','orbita/scene/Experience',
 'orbita/stage/ShowSystem','orbita/reality/Sheets',
 // store: third tier in the union + perfTier entry point (low remains default).
 'orbita/store',
]);
let baselineDirty=false;
for(const [k,hash] of Object.entries(baseline)){
 if(REVIEWED_CHANGES.has(k))continue;
 assert.equal(createHash('sha256').update(map[k]??'').digest('hex'),hash,'An unrelated ORBITA or HEX module regressed: '+k);
}
for(const k of REVIEWED_CHANGES){
 assert.ok(map[k],'reviewed module must exist: '+k);
 const now=createHash('sha256').update(map[k]).digest('hex');
 if(baseline[k]!==now){baseline[k]=now;baselineDirty=true}
}
if(baselineDirty)writeFileSync('tests/integration-original-modules.json',JSON.stringify(baseline,null,2)+'\n');
function moduleSource(id) {
 const value=map['orbita/'+id];
 assert(value?.startsWith('data:text/javascript;base64,'),'Embedded module missing: '+id);
 return Buffer.from(value.split(',')[1],'base64').toString('utf8');
}
// The only former baseline module intentionally changed besides the three
// requested integrations is Experience: invisible island pixels are reduced
// ONLY while the opaque spacecraft covers it; gameplay original DPR returns.
const experience=moduleSource('scene/Experience');
assert(experience.includes("phase === 'intro' ? 0.5"),
  'Published scene throttles unseen island rasterization during spaceship');
const experienceSource=readFileSync('source/src/scene/Experience.tsx','utf8');
// The island is still rasterized at 0.5 DPR under the spacecraft, `high` still
// renders at the original [1, 1.6] range, and `low` still renders at 1x unless
// the visitor opts into the performance tier (whose rung 0 is also exactly 1x).
assert(experienceSource.includes("phase === 'intro' ? 0.5 : low ? concessions.renderScale : [1, 1.6]"),
  'Visible game DPR: intro 0.5, low rung0=1x, high original [1, 1.6]');
assert(/0: \{ dropFilmPasses: false, shadowMapSize: 2048, renderScale: 1/.test(
  readFileSync('source/src/perfLadder.ts','utf8')),
  'Performance rung 0 must be pixel-identical to low (1x, 2048 shadows, no pass removed)');
assert(experienceSource.includes('shadow-mapSize={[2048, 2048]}'),
  'Full original shadows must remain unchanged in the visible world');
const overlay=moduleSource('ui/Overlay');
const stage=moduleSource('scene/Stage');
const beacon=moduleSource('scene/Beacon');
const logos=moduleSource('scene/SocialDrops');
const meta=moduleSource('scene/socialLogoPaths');
const hex=moduleSource('reality/RealityHost');
assert(overlay.includes('assets/immersive/index.html'),'Immersive entry must replace original text intro');
assert(overlay.includes('ORBITA_SPACE_WARP_COMPLETE'),'Immersive warp must trigger original camera descent');
assert(overlay.includes('startGame()'),'Never discard existing camera descent');
assert(!overlay.includes('Một chiếc đĩa'),'Text-heavy ORBITA intro must be replaced');
assert(overlay.includes('gpuPreparationIsNonBlocking'),
  'The actual entry gate must not wait for distant HEX shader preflight')
assert(!overlay.includes('v.count>=90') && !overlay.includes('shadersOk'),
  'Never reintroduce the 70% rAF/shader deadlock into the cockpit CTA')
for (const id of ['stage/ShowSystem','stage/ledShow','stage/showState','stage/shows'])moduleSource(id);
assert(stage.includes('ShowSelector')&&stage.includes('ShowFX'),'Keep original main stage SHOWTIME behavior');
assert(beacon.includes('SocialDrops'),'Energy tower triggers icons without replacing original tower');
assert(logos.includes('signal.send < 0'),'Social media logos must be invisible until real beam interaction');
for (const name of ['tiktok','discord','facebook','instagram','github','linkedin'])assert(meta.includes(name),'Missing social logo '+name);
assert(hex.includes('__orbitaHexCullStats'),'HEX source optimization retained');
assert(existsSync('assets/stage/mcyt-crew-stage.jpg'),'Real provided stage photo must ship');
const ship=readFileSync('assets/immersive/index.html','utf8');
assert(ship.includes('ship/main'),'Full spaceship import must be embedded');
assert(!ship.includes('import "./index.css"'),'Standalone must not attempt unresolved CSS import');
assert(ship.includes('energy-gate'),'Ship warp CTA ring present');
const shipMapMatch=ship.match(/<script type="importmap">([^<]+)<\/script>/);
assert(shipMapMatch,'Spaceship import map missing');
const shipMap=JSON.parse(shipMapMatch[1]).imports;
assert(Object.keys(shipMap).filter(s=>s.startsWith('ship/')).length>=10,'Space source modules embedded');
const shipApp=Buffer.from(shipMap['ship/App'].split(',')[1],'base64').toString('utf8');
assert(shipApp.includes('ORBITA_SPACE_WARP_COMPLETE'),'Ship warp transition handshake missing');
assert(!shipApp.includes('ship/components/Boot'),
 'No second text-heavy boot/loading screen may cover the cockpit')
for(const [name,mod] of Object.entries(map)){
 const text=Buffer.from(mod.split(',')[1],'base64').toString('utf8');
 for(const m of text.matchAll(/\bfrom\s+['"](orbita\/[^'"]+)['"]/g))assert(map[m[1]],`Unresolved source module ${name} -> ${m[1]}`);
}
for(const [name,mod] of Object.entries(shipMap)){
 if(!name.startsWith('ship/'))continue;
 const text=Buffer.from(mod.split(',')[1],'base64').toString('utf8');
 for(const m of text.matchAll(/\bfrom\s+['"](ship\/[^'"]+)['"]/g))assert(shipMap[m[1]],`Unresolved spacecraft import ${name} -> ${m[1]}`);
}
console.log('ORBITA_INTEGRATION_REGRESSION_PASS: original HEX, 3D SHOWTIME, energy warp, 6 tower logos and source maps retained.');
