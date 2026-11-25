import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';

const dist=path.resolve(process.argv[2]), mime={'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.html':'text/html','.wasm':'application/wasm'};
const server=http.createServer(async(req,res)=>{
 try{
  const name=new URL(req.url,'http://127.0.0.1').pathname;
  const file=path.resolve(dist,name==='/'?'index.html':'.'+name);
  assert(file.startsWith(dist+'/'));
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');
  res.end(await readFile(file));
 }catch{res.statusCode=404;res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const site='http://127.0.0.1:'+server.address().port;
const temp=await mkdtemp(path.join(os.tmpdir(),'ra2-pages-headless-'));
const p=spawn(process.env.CHROME_BIN||'/usr/bin/chromium',['--headless','--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-webgpu','--enable-unsafe-swiftshader','--use-angle=swiftshader','--remote-debugging-port=0','--user-data-dir='+temp,site],{stdio:['ignore','ignore','ignore']});
let ws;
try{
 const until=async(f,t=25000)=>{const end=Date.now()+t;for(;;){try{const x=await f();if(x)return x;}catch{}if(Date.now()>end)throw Error('Condition timed out: '+f); await new Promise(r=>setTimeout(r,100));}};
 const port=(await until(()=>readFile(path.join(temp,'DevToolsActivePort'),'utf8'))).split('\n')[0];
 const tab=await until(async()=>(await (await fetch('http://127.0.0.1:'+port+'/json/list')).json()).find(t=>t.url.startsWith(site)));
 ws=new WebSocket(tab.webSocketDebuggerUrl);
 await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true});});
 const errors=[],pending=new Map();let counter=0;
 ws.addEventListener('message',e=>{
  const m=JSON.parse(e.data);if(m.id){pending.get(m.id)?.(m);pending.delete(m.id);}
  if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);
 });
 const call=(method,params={})=>new Promise((r,j)=>{const id=++counter;pending.set(id,m=>m.error?j(m.error):r(m.result));ws.send(JSON.stringify({id,method,params}));});
 await call('Runtime.enable');
 const evaluate=async expression=>{const m=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(m.exceptionDetails)throw Error(m.exceptionDetails.text);return m.result.value;};
 await until(()=>evaluate("document.querySelector('#environment')?.classList.contains('ready')"),45000);
 const state=()=>evaluate(`Object.fromEntries(['start','start-ra2','edition-switch','ra2-resource-note','environment-label'].map(id=>{let e=document.getElementById(id); return [id,{hidden:e.hidden,disabled:e.disabled,open:e.open,text:e.textContent.trim()}]}))`);
 assert.equal((await state())['edition-switch'].open,false);
 assert.equal((await state())['start'].disabled,true);
 const choose=names=>evaluate(`(()=>{const input=document.querySelector('#files'),dt=new DataTransfer();document.querySelector('#cache-resources').checked=false;for(const name of ${JSON.stringify(names)}){const f=new File(['TEST-NOT-RETAIL'],name);Object.defineProperty(f,'webkitRelativePath',{value:'Fixture/'+name});dt.items.add(f);}input.files=dt.files;input.dispatchEvent(new Event('change'));})()`);
 await choose(['RA2.MIX','RA2MD.MIX','MAPSMD03.MIX','LANGUAGE.MIX']);
 await until(async()=>!(await state())['start'].disabled);
 const missing=await state();
 assert.equal(missing['start-ra2'].disabled,true);
 assert.match(missing['ra2-resource-note'].text,/multi\.mix/);
 await choose(['RA2.MIX','RA2MD.MIX','MAPSMD03.MIX','LANGUAGE.MIX','MULTI.MIX']);
 await until(async()=>!(await state())['start-ra2'].disabled);
 assert.equal((await state())['edition-switch'].open,false);
 await call('Page.navigate',{url:site+'/index.html#start-ra2'});
 await until(()=>evaluate("location.hash==='#start-ra2'&&document.querySelector('#environment')?.classList.contains('ready')"),45000);
 await until(async()=>{const direct=await state();return direct['edition-switch'].open&&!direct['edition-switch'].hidden;});
 assert.equal((await state())['start'].hidden,true);
 await choose(['RA2.MIX','LANGUAGE.MIX']);
 await until(()=>evaluate("document.querySelector('#feedback').textContent.includes('multi.mix')"));
 assert.equal((await state())['start-ra2'].disabled,true);
 await choose(['RA2.MIX','LANGUAGE.MIX','MULTI.MIX','MAPS01.MIX']);
 await until(async()=>!(await state())['start-ra2'].disabled);
 const stores=await evaluate("indexedDB.databases().then(rows=>rows.map(row=>row.name))");
 assert(stores.includes('vera20k-pages-ra2-v1-library'));
 assert(stores.includes('vera20k-web-v2-library'));
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({engineReady:true,fragmentRevealsRa2:true,pureFolderAcceptedWithoutRa2md:true,yrHiddenOnRa2Route:true,isolatedResourceCache:true,optionalCollapsed:true,missingMultiKeepsYr:true,completeRootFilenamesEnableRa2:true,errors,retailUsed:false,launchedGame:false}));
}finally{
 ws?.close();p.kill('SIGTERM');server.close();await new Promise(r=>setTimeout(r,400));await rm(temp,{recursive:true,force:true,maxRetries:3});
}
