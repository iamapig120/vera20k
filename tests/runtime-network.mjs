// Actual browser fetch + Cache Storage, on an owned loopback service and profile.
import {mkdir,writeFile,readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {createRuntimeServer} from './serve-runtime.mjs';
import {launchHeadless} from './headless.mjs';

const runtime=process.argv[2];
if(!runtime)throw Error('Usage: node tests/runtime-network.mjs LOOSE_MAP_AND_BIK_DIRECTORY');
const names=await readdir(runtime);
const mapName=names.find(n=>n.toUpperCase()==='ALL01UMD.MAP')||names.find(n=>/\.(map|mpr|yrm)$/i.test(n));
const movieName=names.find(n=>n.toUpperCase()==='A01_F00E.BIK')||names.find(n=>/\.bik$/i.test(n));
if(!mapName||!movieName)throw Error('Need a loose map and a BIK larger than 32 KiB');
const task=resolve(`.build/runtime-network-${new Date().toISOString().replace(/[:.]/g,'-')}`);
const site=resolve(task,'site');await mkdir(site,{recursive:true});
for(const name of ['runtime.mjs','resources.mjs'])await writeFile(resolve(site,name),await readFile(resolve('templates',name)));
await writeFile(resolve(site,'index.html'),`<!doctype html><script type="module">
import {readRemoteManifest} from './resources.mjs';
import {createRuntimeLoader,RUNTIME_CACHE} from './runtime.mjs';
window.begin=(mode,clear)=>{
 window.done=null;window.failure=null;window.progress={};
 void (async()=>{
  if(clear)await caches.delete(RUNTIME_CACHE);
  const catalog=(await readRemoteManifest(location.origin+'/manifest.json')).runtime;
  const map=[...catalog.keys()].find(k=>k==='map:ALL01UMD.MAP')||[...catalog.keys()].find(k=>k.startsWith('map:'));
  const movie=[...catalog.keys()].find(k=>k==='movie:A01_F00E.BIK')||[...catalog.keys()].find(k=>k.startsWith('movie:'));
  if(!map||!movie)throw Error('Need both a map and a BIK');
  const started=performance.now(),requests=[],completions=[],states=[];let waiter,loader,retries=0,last;
  const fetchImpl=async(input,options)=>{
   const transfer={path:new URL(input).pathname,startedMs:performance.now()-started,bytes:0};requests.push(transfer);
   const response=await fetch(input,options);transfer.status=response.status;transfer.headersMs=performance.now()-started;
   return new Response(response.body?.pipeThrough(new TransformStream({transform(chunk,controller){transfer.bytes+=chunk.byteLength;controller.enqueue(chunk);},flush(){transfer.endedMs=performance.now()-started;}})),{status:response.status,headers:response.headers});
  };
  loader=createRuntimeLoader({catalog,fetchImpl,complete:(id,bytes,cancel)=>{completions.push({id,bytes:bytes.length,cancel});if(cancel)waiter?.resolve();},onState:value=>{
   window.progress=value;
   const key=value.phase+':'+value.name;if(last!==key){states.push({phase:value.phase,name:value.name,error:value.error,atMs:performance.now()-started});last=key;}
   if(mode==='cancel'&&value.phase==='loading'&&value.loaded>=32768){loader.cancel();return;}
   if(value.phase==='ready')waiter?.resolve();
   if(value.phase==='error'){
    if(mode==='retry'&&!retries++){setTimeout(()=>loader.retry(),200);}
    else waiter?.reject(Error(value.error));
   }
  }});
  let id=0;
  for(const key of mode==='cancel'?[movie]:mode==='retry'?[map]:[map,movie]){
   const [kind,...rest]=key.split(':');
   const ready=new Promise((resolve,reject)=>waiter={resolve,reject});loader.request(++id,kind,rest.join(':'));await ready;
  }
  const elapsedMs=performance.now()-started;
  loader.close();
  window.done={mode,elapsedMs,bytes:requests.reduce((n,r)=>n+r.bytes,0),requests,completions,states,retries};
 })().catch(error=>window.failure=String(error));
};window.ready=true;</script>`);

const profiles=[
 {name:'local',delayMs:0,kilobitsPerSecond:0},
 {name:'broadband',delayMs:40,kilobitsPerSecond:50000},
 {name:'limited',delayMs:150,kilobitsPerSecond:10000},
 {name:'slow',delayMs:400,kilobitsPerSecond:2000},
 {name:'retry',delayMs:150,kilobitsPerSecond:10000,mode:'retry'},
 {name:'cancel',delayMs:400,kilobitsPerSecond:2000,mode:'cancel'}
];
const results=[];let browser,service;
try{
 browser=await launchHeadless(task);
 for(const profile of profiles){
  service=await createRuntimeServer({site,runtime,...profile,failOnce:profile.mode==='retry'?`runtime/${mapName}`:''});
  await new Promise(resolve=>service.server.listen(0,'127.0.0.1',resolve));
  const address=`http://127.0.0.1:${service.server.address().port}`;
  await browser.call('Page.navigate',{url:address});await browser.waitFor('!!window.ready');
  const phases=[];
  for(const phase of profile.mode?['cold']:['cold','hot']){
   const offset=service.transfers.length;
   await browser.evaluate(`window.begin(${JSON.stringify(profile.mode||'load')},${phase==='cold'})`);
   const deadline=Date.now()+240000;let printed=0;
   for(;;){
    const state=await browser.evaluate('({done:window.done,failure:window.failure,progress:window.progress})');
    if(state.failure)throw Error(state.failure);
    if(state.done){
     await new Promise(resolve=>setTimeout(resolve,100));
     const result={phase,...state.done,serverTransfers:service.transfers.slice(offset)};
     if(phase==='hot')assert.equal(result.bytes,0,'warm verified cache must avoid payload GETs');
     if(!profile.mode&&phase==='cold'){
      assert.equal(result.completions.length,2);assert(result.completions.every(row=>!row.cancel));
      assert.equal(result.bytes,result.completions.reduce((n,row)=>n+row.bytes,0));
      for(const row of result.serverTransfers)if(profile.kilobitsPerSecond)assert(row.elapsedMs>=row.bytes*8/profile.kilobitsPerSecond+profile.delayMs-25,'measured response must respect the cap');
     }
     if(profile.mode==='retry'){assert.equal(result.requests.length,2);assert.equal(result.requests[0].status,503);assert.equal(result.completions.length,1);}
     if(profile.mode==='cancel'){assert.equal(result.completions[0].cancel,true);assert(result.bytes<service.manifest.files.find(r=>r.path===`runtime/${movieName}`).size);}
     phases.push(result);console.log(JSON.stringify({profile:profile.name,phase,elapsedMs:result.elapsedMs,bytes:result.bytes,requests:result.requests.length}));break;
    }
    if(Date.now()>deadline)throw Error('Network test deadline');
    if(Date.now()-printed>15000){console.log(JSON.stringify({profile:profile.name,phase,progress:state.progress}));printed=Date.now();}
    await new Promise(resolve=>setTimeout(resolve,500));
   }
  }
  results.push({profile,phases});
  await writeFile(resolve(task,'result.json'),JSON.stringify({task,scope:'Runtime payload responses only; per-response cap, artificial initial delay; static/bootstrap and manifest unshaped',results},null,2));
  service.server.closeAllConnections();await new Promise(resolve=>service.server.close(resolve));service=null;
 }
 console.log(`RESULT: ${resolve(task,'result.json')}`);
}finally{
 if(browser){await writeFile(resolve(task,'events.json'),JSON.stringify(browser.events,null,2));await browser.close();}
 if(service){service.server.closeAllConnections();service.server.close();}
}
