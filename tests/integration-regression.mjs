import {readFileSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const html=readFileSync('index.html','utf8');
const tag='<script id="orbita-embedded-map" type="application/json">';
const a=html.indexOf(tag),b=html.indexOf('</script>',a+tag.length);
assert(a>=0&&b>a,'Root ORBITA embedded importmap must survive');
const map=JSON.parse(html.slice(a+tag.length,b));
assert(Object.keys(map).length>=62,'All original ORBITA + new SHOWTIME modules embedded');
const baseline=JSON.parse(readFileSync('tests/integration-original-modules.json','utf8'));
for(const [k,hash] of Object.entries(baseline)){
 assert.equal(createHash('sha256').update(map[k]??'').digest('hex'),hash,'An unrelated ORBITA or HEX module regressed: '+k);
}
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
assert(experienceSource.includes("phase === 'intro' ? 0.5 : low ? 1 : [1, 1.6]"),
  'Visible game original DPR and high quality range must be restored');
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
assert(Buffer.from(shipMap['ship/App'].split(',')[1],'base64').toString('utf8').includes('ORBITA_SPACE_WARP_COMPLETE'),'Ship warp transition handshake missing');
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
