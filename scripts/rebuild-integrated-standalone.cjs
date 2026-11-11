const fs=require('fs'),path=require('path'),ts=require('../source/node_modules/typescript');
const root=path.resolve(__dirname,'..'),payload=root;
const base=root;
const htmlPath=path.join(base,'index.html');
let html=fs.readFileSync(htmlPath,'utf8');
const tag='<script id="orbita-embedded-map" type="application/json">';const begin=html.indexOf(tag)+tag.length;const end=html.indexOf('</script>',begin);
if(begin<tag.length||end<0)throw Error('Invalid original ORBITA bundled map');
const map=JSON.parse(html.slice(begin,end));
const items=['scene/Experience','scene/Stage','scene/Beacon','scene/SocialDrops','scene/socialLogoPaths','stage/ShowSystem','stage/ledShow','stage/showState','stage/shows','ui/Overlay'];
const targetRoot=path.join(payload,'source','src');
function ext(f){return fs.existsSync(path.join(targetRoot,f+'.tsx'))?'.tsx':'.ts'}
function embed(rootFolder,f,modmap,prefix){
 const fullname=path.join(rootFolder,f+extFor(rootFolder,f));
 let source=fs.readFileSync(fullname,'utf8');
 if(f==='main' && prefix==='ship/') source=source.replace(/import\s+['"]\.\/index\.css['"]\s*;?/, '');
 if(f==='data/profile'){
  const photo=fs.readFileSync(path.join(rootFolder,'assets/pilot.jpg')).toString('base64');
  source=source.replace("import pilotPhoto from '../assets/pilot.jpg';",`const pilotPhoto = 'data:image/jpeg;base64,${photo}';`)
 }
 const tx=ts.transpileModule(source,{fileName:fullname,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,removeComments:false}});
 const errors=(tx.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
 if(errors.length)throw Error(f+': '+errors.map(e=>ts.flattenDiagnosticMessageText(e.messageText,' | ')).join('\n'));
 let js=tx.outputText.replace(/(\bfrom\s*['"])(\.{1,2}\/[^'"]+)(['"])/g,(_all,pre,spec,post)=>{
  const resolved=path.resolve(path.dirname(fullname),spec),rel=path.relative(rootFolder,resolved).replace(/\\/g,'/');
  if(rel.startsWith('..'))throw Error('Import escapes module root '+rel);
  let id=prefix+rel.replace(/\.(tsx?|jsx?)$/,'');
  if(!(id in modmap))throw Error('Missing embedded dependency '+id+' imported from '+f);
  return pre+id+post;
 });
 if(/\bfrom\s*['"]\.{1,2}\//.test(js))throw Error('Unresolved import '+f);
 const id=prefix+f;modmap[id]='data:text/javascript;base64,'+Buffer.from(js).toString('base64');
 return {name:id,bytes:js.length};
}
function extFor(r,f){return fs.existsSync(path.join(r,f+'.tsx'))?'.tsx':'.ts'}
// Declare all new modules first so recursive relative import rewriting resolves.
for(const f of items)map['orbita/'+f]='';
const created=items.map(f=>embed(targetRoot,f,map,'orbita/'));
// Preserve root HTML except application module map; no URL/asset/quality changes.
html=html.slice(0,begin)+JSON.stringify(map)+html.slice(end);
fs.writeFileSync(htmlPath,html);
console.log('ORBITA_ROOT',created,'total modules',Object.keys(map).length,'size',html.length);

// Ship: isolate its own React/Three WebGL runtime and original CSS from the island.
const shipRoot=path.join(payload,'source','immersive','src');
const shipNames=[];
(function walk(dir){for(const ent of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,ent.name);if(ent.isDirectory())walk(f);else if(/\.(ts|tsx)$/.test(ent.name)&&!ent.name.endsWith('.d.ts'))shipNames.push(path.relative(shipRoot,f).replace(/\\/g,'/').replace(/\.tsx?$/,''));}})(shipRoot);
const external={
 'react':'https://esm.sh/react@19.2.6',
 'react/jsx-runtime':'https://esm.sh/react@19.2.6/jsx-runtime',
 'react-dom/client':'https://esm.sh/react-dom@19.2.6/client?external=react',
 'three':'https://esm.sh/three@0.187.0',
 'clsx':'https://esm.sh/clsx@2.1.1',
 'tailwind-merge':'https://esm.sh/tailwind-merge@3.4.0',
};
for(const f of shipNames)external['ship/'+f]='';
for(const f of shipNames)embed(shipRoot,f,external,'ship/');
let css=fs.readFileSync(path.join(shipRoot,'index.css'),'utf8');
css=css.replace('@import "tailwindcss";',"@import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600;700&family=Chakra+Petch:wght@600;700&family=JetBrains+Mono:wght@500;700&display=swap');");
css=css.replace(/@font-face\s*\{[^}]+\}\s*/g,'');
css=css.replace(/@theme\s*\{/,':root {');
const esc=s=>s.replace(/<\/script/gi,'<\\/script').replace(/<\/style/gi,'<\\/style');
const shipHtml=`<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Immersive Space Shift — ORBITA</title><style>${esc(css)}</style><script type="importmap">${esc(JSON.stringify({imports:external}))}</script></head><body><div id="root"></div><script type="module">import('ship/main').catch(e=>{document.body.insertAdjacentHTML('beforeend','<pre style="color:#fff;background:#3d0d2c;padding:20px">Buồng lái không tải được: '+String(e)+'</pre>');console.error(e)})</script></body></html>`;
const dest=path.join(base,'assets','immersive','index.html');fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,shipHtml);
console.log('SPACE_STANDALONE',shipNames.length,'modules',shipHtml.length,'bytes');
// Stage asset exact byte provenance.
const stagePhoto=path.join(payload,'assets/stage/mcyt-crew-stage.jpg');fs.mkdirSync(path.join(base,'assets/stage'),{recursive:true});if (path.resolve(stagePhoto)!==path.resolve(base,'assets/stage/mcyt-crew-stage.jpg')) fs.copyFileSync(stagePhoto,path.join(base,'assets/stage/mcyt-crew-stage.jpg'));
const a=fs.readFileSync(stagePhoto);if(a.length<100000)throw Error('Stage image missing');
