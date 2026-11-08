import {loadRemoteProfile} from './resources.mjs?v=0fbcbb6dfc9cdade5c5a97b4b3564f0c990bd2be';
export const RUNTIME_CACHE='vera20k-runtime-assets-v1';

// The host keeps URLs; the engine receives only names, size and content identity.
export function createRuntimeLoader({catalog,complete,onState=()=>{},cacheStorage=globalThis.caches,cache=true,pageUrl=globalThis.location?.href,fetchImpl=globalThis.fetch,cacheChunkBytes=16*1024**2}) {
 if(!Number.isSafeInteger(cacheChunkBytes)||cacheChunkBytes<=0||cacheChunkBytes>16*1024**2)throw Error('Invalid cache chunk size');
 let active;
 const cacheKey=row=>new URL(`./__vera_runtime/${row.sha256}`,pageUrl||'https://localhost/').href;
 const partKey=(key,index)=>key+'/part/'+index;
 async function readCached(storage,row){
  const key=cacheKey(row),hit=await storage.match(key);if(!hit)return;
  if(hit.headers.get('Content-Type')!=='application/x-vera-runtime-chunks+json')return hit.blob();
  const meta=await hit.json();
  if(meta.version!==1||meta.size!==row.size||!Number.isSafeInteger(meta.parts)||meta.parts<1||meta.parts>1024||!Number.isSafeInteger(meta.chunkBytes)||meta.chunkBytes<1||meta.chunkBytes>16*1024**2||Math.ceil(meta.size/meta.chunkBytes)!==meta.parts)throw Error('Invalid cached resource metadata');
  const blobs=[];
  for(let i=0;i<meta.parts;i++){
   const part=await storage.match(partKey(key,i));if(!part)throw Error('Incomplete resource cache');
   const blob=await part.blob();if(blob.size!==Math.min(meta.chunkBytes,meta.size-i*meta.chunkBytes))throw Error('Truncated resource cache');blobs.push(blob);
  }
  return new Blob(blobs);
 }
 async function writeCached(storage,row,blob){
  const key=cacheKey(row);if(blob.size<=cacheChunkBytes){await storage.put(key,new Response(blob));return;}
  const parts=Math.ceil(blob.size/cacheChunkBytes);
  for(let i=0;i<parts;i++)await storage.put(partKey(key,i),new Response(blob.slice(i*cacheChunkBytes,(i+1)*cacheChunkBytes)));
  // Publish the index last. Partial writes can never masquerade as a cache hit.
  await storage.put(key,new Response(JSON.stringify({version:1,size:blob.size,parts,chunkBytes:cacheChunkBytes}),{headers:{'Content-Type':'application/x-vera-runtime-chunks+json'}}));
 }
 const current=job=>active===job&&!job.controller.signal.aborted;
 async function run(job){
  job.busy=true;onState({phase:'loading',name:job.name});
  try{
   let storage,cached=[];
   if(cache&&cacheStorage)try{
    storage=await cacheStorage.open(RUNTIME_CACHE);
    const hit=await readCached(storage,job.row);
    if(hit)cached=[{path:job.row.path,blob:hit}];
   }catch{}
   const manifest={profiles:new Map([['request',[job.row]]])};
   const [entry]=await loadRemoteProfile(manifest,'request',{cached,signal:job.controller.signal,pageUrl,fetchImpl,
    onProgress:value=>{if(current(job))onState({...value,phase:'loading',name:job.name,stage:value.phase});}});
   if(!current(job))return;
   let cacheWarning=cache&&!storage?'资源缓存不可用，本次仍可使用已下载资源':undefined;
   complete(job.id,new Uint8Array(await entry.blob.arrayBuffer()),false);
   job.accepted=true;onState({phase:'committing',name:job.name});
   if(storage)try{await writeCached(storage,job.row,entry.blob);}catch(error){cacheWarning='资源未能缓存，本次仍可使用已下载资源';console.warn('Runtime resource cache write failed',job.name,error);}
   if(current(job)){active=undefined;onState({phase:'ready',name:job.name,warning:cacheWarning});}
  }catch(error){if(current(job)){job.busy=false;onState({phase:'error',name:job.name,error:error.message});}}
 }
 function close(){const job=active;active=undefined;job?.controller.abort();onState({phase:'closed'});}
 return {
  request(id,kind,name){
   if(kind==='cancel'){close();return;}
   if(kind==='error'){close();onState({phase:'fatal',name,error:name});return;}
   close();
   const row=catalog.get(`${kind}:${name.toUpperCase()}`);
   if(!row)throw Error('运行中资源不在当前清单中');
   active={id,name,row,controller:new AbortController(),busy:false};void run(active);
  },
  retry(){if(active&&!active.busy){active.controller=new AbortController();void run(active);}},
  cancel(){const job=active;close();if(job&&!job.accepted)complete(job.id,new Uint8Array(),true);},
  close,
  async clear(){await cacheStorage?.delete(RUNTIME_CACHE);}
 };
}
