// Loopback-only fixture service. No uploads, proxying, or production source defaults.
import {createServer} from 'node:http';
import {createReadStream,createWriteStream} from 'node:fs';
import {readdir,stat,mkdir,readFile,rename,unlink} from 'node:fs/promises';
import {pipeline} from 'node:stream/promises';
import {createBrotliCompress,constants} from 'node:zlib';
import {resolve,relative,extname,join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {once} from 'node:events';
import {setTimeout as wait} from 'node:timers/promises';

const gameType=/\.(mix|csf|fnt|shp|pal|ini|wav|aud|vxl|hva|tmp|tem|sno|urb|ubn|lun|des|pcx|png|jpg|jpeg|bag|idx|vqp|pkt)$|^subtitle(?:md)?\.txt$/i;
const deferredArchive=/^(maps|mapsmd|movies|movmd|multi|multimd)\d*\.mix$/i;
const personal=/^(ra2|ra2md|vera|spawn|keyboard)\.ini$/i;
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.wasm':'application/wasm','.png':'image/png'};
const root=resolve(fileURLToPath(new URL('../dist/',import.meta.url)));

export async function createRuntimeServer({assets,runtime,plan,delayMs=0,kilobitsPerSecond=0,scope='runtime',failOnce='',site=root,encoding='identity',encodingCache=resolve('.build/resource-encoding-cache'),bootstrapPaths}={}){
 if(plan){plan=JSON.parse(await readFile(plan,'utf8'));assets=plan.assets;bootstrapPaths=plan.bootstrapPaths;}
 const bodies=new Map(),files=[],bootstrap=[],onDemand={maps:{},movies:{},music:{},audio:{},archives:{}},counts=new Map();let next=0;
 const transfers=[],network={};
 function setNetwork(options){
  const value={...network,...options};
  if(!Number.isFinite(value.delayMs)||value.delayMs<0||!Number.isFinite(value.kilobitsPerSecond)||value.kilobitsPerSecond<0||!['runtime','all'].includes(value.scope))throw Error('Invalid payload network settings');
  Object.assign(network,value);
 }
 setNetwork({delayMs,kilobitsPerSecond,scope});
 if(!['identity','br'].includes(encoding))throw Error('Expected identity or br encoding');
 if(bootstrapPaths&&(!Array.isArray(bootstrapPaths)||bootstrapPaths.some(path=>typeof path!=='string'||/[\\/]/.test(path)||path==='.'||path==='..')))throw Error('Expected root filenames in bootstrap list');
 async function encoded(source,digest){
  await mkdir(encodingCache,{recursive:true});const path=join(encodingCache,digest+'.br');
  try{return {path,size:(await stat(path)).size};}catch(error){if(error.code!=='ENOENT')throw error;}
  const pending=path+'.'+randomUUID()+'.pending';
  try{
   await pipeline(createReadStream(source),createBrotliCompress({params:{[constants.BROTLI_PARAM_QUALITY]:4}}),createWriteStream(pending,{flags:'wx'}));
   await rename(pending,path);
  }finally{await unlink(pending).catch(error=>{if(error.code!=='ENOENT')throw error;});}
  return {path,size:(await stat(path)).size};
 }
 async function register(path,source,buffer,metadata={}){
  const id=String(next++),hash=createHash('sha256');let size=0;
  if(buffer){hash.update(buffer);size=buffer.length;}else for await(const part of createReadStream(source)){hash.update(part);size+=part.length;}
  const sha256=hash.digest('hex'),decodedSize=size;
  if(encoding==='br'&&source){const compressed=await encoded(source,sha256);source=compressed.path;size=compressed.size;}
  bodies.set(id,{source,buffer,path,size,decodedSize,encoding:encoding==='br'&&source?'br':undefined});files.push({path,url:`./payload/${id}`,size:decodedSize,sha256,...metadata});return id;
 }
 if(assets){
  for(const entry of await readdir(assets,{withFileTypes:true})){
   if(!entry.isFile()||!gameType.test(entry.name)||(!bootstrapPaths&&deferredArchive.test(entry.name))||personal.test(entry.name))continue;
   if(bootstrapPaths&&!bootstrapPaths.some(name=>name.toLowerCase()===entry.name.toLowerCase()))continue;
   await register(entry.name,join(assets,entry.name));bootstrap.push(entry.name);
  }
 }else{
  for(const name of ['ra2.mix','ra2md.mix']){await register(name,null,Buffer.from(`synthetic ${name}`));bootstrap.push(name);}
 }
 if(runtime){
  for(const entry of await readdir(runtime,{withFileTypes:true})){
   if(!entry.isFile()||! /\.(map|mpr|yrm|bik)$/i.test(entry.name))continue;
   await register(`runtime/${entry.name}`,join(runtime,entry.name));
   const group=/\.bik$/i.test(entry.name)?onDemand.movies:onDemand.maps;
   group[entry.name]=`runtime/${entry.name}`;
  }
 }else{
  const name='TEST.MAP';await register(`runtime/${name}`,null,Buffer.from('[Map]\nSize=0,0,2,2\n[IsoMapPack5]\n1=DwALABwBAAIA/////wAAABEAAA==\n'));
  onDemand.maps[name]=`runtime/${name}`;
  await register('runtime/TEST.BIK',null,Buffer.from('synthetic movie transport fixture'));
  onDemand.movies['TEST.BIK']='runtime/TEST.BIK';
 }
 if(bootstrapPaths&&bootstrap.length!==new Set(bootstrapPaths.map(p=>p.toLowerCase())).size)throw Error('Bootstrap list contains missing or excluded files');
 if(plan)for(const row of plan.runtimeFiles){
  if(!onDemand[row.kind]||!row.path.startsWith('runtime/'))throw Error('Invalid local stage plan');
  await register(row.path,row.source,undefined,{duration_seconds:row.duration_seconds,bank:row.bank});
  onDemand[row.kind][row.name]=row.path;
 }
 const startupBodies=[...bodies.values()].filter(row=>bootstrap.includes(row.path));
 const representation={encoding,bootstrapFiles:bootstrap.length,bootstrapDecodedBytes:startupBodies.reduce((n,row)=>n+row.decodedSize,0),bootstrapWireBytes:startupBodies.reduce((n,row)=>n+row.size,0)};
 const manifest={format:'vera20k-resources',version:1,label:assets?(bootstrapPaths?'显式启动清单测试':'完整目录传输夹具（不是最小启动集）'):'合成传输测试（不能用于实玩）',files,profiles:{bootstrap},runtime:onDemand};
 const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Expose-Headers','Content-Encoding,Content-Length');res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405).end();return;}
  if(['/manifest.json','/metrics.json','/transfers.json'].includes(url.pathname)){
   const value=url.pathname==='/manifest.json'?manifest:url.pathname==='/metrics.json'?Object.fromEntries(counts):{network,representation,transfers};
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));return;
  }
  const match=/^\/payload\/(\d+)$/.exec(url.pathname);
  if(match){
   const row=bodies.get(match[1]);if(!row){res.writeHead(404).end();return;}
   const attempt=(counts.get(row.path)||0)+1;counts.set(row.path,attempt);
   const shaped=network.scope==='all'||row.path.startsWith('runtime/');
   const settings=shaped?{...network}:{delayMs:0,kilobitsPerSecond:0,scope:network.scope};
   const started=performance.now(),controller=new AbortController();
   const transfer={path:row.path,attempt,method:req.method,...settings,startedAt:new Date().toISOString(),bytes:0,decodedSize:row.decodedSize,encoding:row.encoding||'identity',status:200};
   transfers.push(transfer);
   const finish=aborted=>{transfer.elapsedMs=performance.now()-started;transfer.aborted=aborted;controller.abort();};
   res.once('finish',()=>finish(false));res.once('close',()=>{if(!res.writableFinished)finish(true);});
   try{
    if(settings.delayMs)await wait(settings.delayMs,undefined,{signal:controller.signal});
    if(row.path===failOnce&&attempt===1){transfer.status=503;res.writeHead(503).end();return;}
    res.setHeader('Content-Length',row.size);res.setHeader('Content-Type','application/octet-stream');
    if(row.encoding)res.setHeader('Content-Encoding',row.encoding);
    res.flushHeaders();transfer.headersMs=performance.now()-started;
    if(req.method==='HEAD'){res.end();return;}
    const bodyStart=performance.now(),rate=settings.kilobitsPerSecond*1000/8;
    async function* chunks(){
     if(row.buffer){for(let i=0;i<row.buffer.length;i+=16384)yield row.buffer.subarray(i,i+16384);}
     else yield* createReadStream(row.source,{highWaterMark:16384});
    }
    // Per-response payload cap; no shared-link contention, TCP loss or jitter simulation.
    for await(const chunk of chunks()){
     const remaining=rate?(transfer.bytes+chunk.length)*1000/rate-(performance.now()-bodyStart):0;
     if(remaining>0)await wait(remaining,undefined,{signal:controller.signal});
     if(controller.signal.aborted)break;
     if(transfer.firstByteMs===undefined)transfer.firstByteMs=performance.now()-started;
     const writable=res.write(chunk);transfer.bytes+=chunk.length;
     if(!writable)await once(res,'drain',{signal:controller.signal});
    }
    if(!controller.signal.aborted)res.end();
   }catch(error){if(error.name!=='AbortError'){transfer.error=String(error);res.destroy();}}
   return;
  }
  try{
   const requested=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname);
   const path=resolve(site,'.'+requested),inside=relative(resolve(site),path);
   if(inside.startsWith('..')||! /\.(html|js|mjs|css|wasm|png|txt|d\.ts)$/i.test(path))throw Error('not a static asset');
   const info=await stat(path);if(!info.isFile())throw Error('not a file');
   res.setHeader('Content-Type',mime[extname(path)]||'text/plain');res.setHeader('Content-Length',info.size);
   if(req.method==='HEAD')res.end();else createReadStream(path).on('error',()=>res.destroy()).pipe(res);
  }catch{res.writeHead(404).end();}
 });
 return {server,manifest,counts,transfers,network,setNetwork,representation};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=Object.fromEntries(process.argv.slice(2).reduce((rows,value,index,all)=>value.startsWith('--')?[...rows,[value.slice(2),all[index+1]]]:rows,[]));
 const bootstrapPaths=args['bootstrap-list']?JSON.parse(await readFile(args['bootstrap-list'],'utf8')):undefined;
 const {server,network}=await createRuntimeServer({assets:args.assets,runtime:args.runtime,plan:args.plan,delayMs:Number(args.delay||0),kilobitsPerSecond:Number(args.kbps||0),scope:args.scope||'runtime',failOnce:args['fail-once']||'',encoding:args.encoding||'identity',encodingCache:args['encoding-cache']||resolve('.build/resource-encoding-cache'),bootstrapPaths});
 server.listen(Number(args.port||8774),'127.0.0.1',()=>console.log(`Fixture service: http://127.0.0.1:${server.address().port}/ — manifest.json (loopback only)`));
 console.log(JSON.stringify({network,note:'Artificial first-response delay and per-response payload cap; kbps=1000 bits/s; 0 means unlimited. Static site and manifest are unshaped.'}));
}
