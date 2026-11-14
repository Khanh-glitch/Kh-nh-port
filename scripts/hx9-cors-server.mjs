// Local QA server matching the public cross-origin headers for isolated HX-9.
import {createServer} from 'node:http'
import {createReadStream,statSync} from 'node:fs'
import {resolve,extname,sep} from 'node:path'
const root=resolve('dist-pages'), types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.json':'application/json','.mp4':'video/mp4','.mp3':'audio/mpeg','.png':'image/png','.jpg':'image/jpeg'}
createServer((req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost'), path=resolve(root,'.'+decodeURIComponent(url.pathname)),file=statSync(path).isDirectory()?resolve(path,'index.html'):path
  if(file!==root&&!file.startsWith(root+sep)){res.writeHead(403).end();return}
  const stat=statSync(file);res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Content-Type',types[extname(file)]||'application/octet-stream');res.setHeader('Content-Length',stat.size)
  if(req.method==='HEAD')res.end();else createReadStream(file).pipe(res)
 }catch{res.writeHead(404).end()}
}).listen(4173,'127.0.0.1')
