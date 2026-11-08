import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {createRuntimeLoader,RUNTIME_CACHE} from '../templates/runtime.mjs';
import {readRemoteManifest} from '../templates/resources.mjs';

const data=Buffer.from('synthetic runtime asset');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function cacheFixture({failWrite=false}={}){
 const stores=new Map();
 return {stores,async open(name){
  if(!stores.has(name))stores.set(name,new Map());const store=stores.get(name);
  return {match:async key=>store.get(key)?.clone(),put:async(key,value)=>{if(failWrite)throw Error('quota');store.set(key,value.clone());}};
 },async delete(name){return stores.delete(name);}};
}
async function setup(t,{failOnce=false,bad=false,delay=0,storage=cacheFixture()}={}){
 let count=0;
 const server=createServer((_req,res)=>{count++;setTimeout(()=>{
  if(failOnce&&count===1){res.writeHead(503).end();return;}
  res.end(bad?Buffer.alloc(data.length):data);
 },delay);});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>{server.closeAllConnections();server.close();});
 const base=`http://127.0.0.1:${server.address().port}`;
 const catalog=new Map([['map:TEST.MAP',{path:'test.map',url:base+'/test.map',size:data.length,sha256:hash(data)}]]);
 const completions=[],events=[];let notify;
 const options={catalog,cacheStorage:storage,pageUrl:base+'/',complete:(...args)=>completions.push(args),onState:value=>{events.push(value);notify?.(value);}};
 const wait=phase=>new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error(`No ${phase} state`)),2000);
  notify=value=>{if(value.phase===phase){clearTimeout(timer);notify=undefined;resolve(value);}};
 });
 return {options,storage,events,completions,wait,get count(){return count;}};
}

test('runtime manifest separates bootstrap files from later maps and movies',async()=>{
 const row=path=>({path,url:'./'+path,size:data.length,sha256:hash(data)});
 const source={format:'vera20k-resources',version:1,files:['ra2.mix','ra2md.mix','mission.map','intro.bik'].map(row),
  profiles:{bootstrap:['ra2.mix','ra2md.mix']},runtime:{maps:{'MISSION.MAP':'mission.map'},movies:{INTRO:'intro.bik'}}};
 let count=0;
 const parsed=await readRemoteManifest('https://example.test/manifest.json',{fetchImpl:async()=>{count++;return new Response(JSON.stringify(source));}});
 assert.equal(count,1);assert.equal(parsed.profiles.get('bootstrap').length,2);
 assert.equal(parsed.runtime.get('movie:INTRO.BIK').path,'intro.bik');
 source.runtime.maps['../bad.map']='mission.map';
 await assert.rejects(readRemoteManifest('https://example.test/manifest.json',{fetchImpl:async()=>new Response(JSON.stringify(source))}));
});

test('runtime bytes are requested on demand, survive a new loader through verified cache, and cache keys omit source URLs',async t=>{
 const f=await setup(t);const loader=createRuntimeLoader(f.options);
 assert.equal(f.count,0);let done=f.wait('ready');loader.request(4,'map','TEST.MAP');await done;
 assert.equal(f.count,1);assert.equal(f.completions[0][0],4);assert.deepEqual(Buffer.from(f.completions[0][1]),data);
 done=f.wait('ready');createRuntimeLoader(f.options).request(5,'map','TEST.MAP');await done;
 assert.equal(f.count,1);
 assert([...f.storage.stores.get(RUNTIME_CACHE).keys()].every(key=>key.endsWith(hash(data))&&!key.includes('test.map')));
});

test('HTTP errors retain the ticket for retry and corrupt bytes never reach the engine',async t=>{
 const f=await setup(t,{failOnce:true});const loader=createRuntimeLoader(f.options);
 let done=f.wait('error');loader.request(8,'map','TEST.MAP');await done;assert.equal(f.completions.length,0);
 done=f.wait('ready');loader.retry();await done;assert.equal(f.count,2);assert.equal(f.completions[0][0],8);
 const bad=await setup(t,{bad:true});done=bad.wait('error');createRuntimeLoader(bad.options).request(9,'map','TEST.MAP');
 assert.match((await done).error,/校验失败/);assert.equal(bad.completions.length,0);
});

test('cancel and replacement abort old downloads; late completions cannot commit into the next request',async t=>{
 const f=await setup(t,{delay:80});const loader=createRuntimeLoader(f.options);
 loader.request(1,'map','TEST.MAP');loader.cancel();
 assert.deepEqual(f.completions.map(([id,,cancel])=>[id,cancel]),[[1,true]]);
 loader.request(2,'map','TEST.MAP');const done=f.wait('ready');loader.request(3,'map','TEST.MAP');await done;
 assert.deepEqual(f.completions.map(([id,,cancel])=>[id,cancel]),[[1,true],[3,false]]);
});

test('cache corruption is refetched, quota failures still allow memory use, and clear affects only resource cache',async t=>{
 const storage=cacheFixture({failWrite:true});const f=await setup(t,{storage});const loader=createRuntimeLoader(f.options);
 const done=f.wait('ready');loader.request(7,'map','TEST.MAP');const result=await done;
 assert.match(result.warning,/\u672a\u80fd\u7f13\u5b58/);assert.equal(f.completions.length,1);
 storage.stores.set('user-data',new Map([['save',123]]));await loader.clear();assert.equal(storage.stores.get('user-data').get('save'),123);
 const normal=await setup(t);let ready=normal.wait('ready');createRuntimeLoader(normal.options).request(10,'map','TEST.MAP');await ready;
 const cache=normal.storage.stores.get(RUNTIME_CACHE);cache.set([...cache.keys()][0],new Response(Buffer.alloc(data.length)));
 ready=normal.wait('ready');createRuntimeLoader(normal.options).request(11,'map','TEST.MAP');await ready;
 assert.equal(normal.count,2);
});

test('an engine format rejection is shown and never persisted as a valid resource',async t=>{
 const f=await setup(t);f.options.complete=()=>{throw Error('Invalid remote map');};
 const loader=createRuntimeLoader(f.options),done=f.wait('error');loader.request(22,'map','TEST.MAP');
 assert.match((await done).error,/Invalid remote map/);
 assert.equal(f.storage.stores.get(RUNTIME_CACHE).size,0);
});

test('chunked cache survives a fresh loader; missing or corrupt chunks refetch before native admission',async t=>{
 const f=await setup(t);f.options.cacheChunkBytes=8;
 let done=f.wait('ready');createRuntimeLoader(f.options).request(30,'map','TEST.MAP');await done;
 const rows=f.storage.stores.get(RUNTIME_CACHE),keys=[...rows.keys()],part=keys.find(k=>k.endsWith('/part/0'));
 assert(part);assert.equal(rows.size,Math.ceil(data.length/8)+1);assert.equal(f.count,1);
 done=f.wait('ready');createRuntimeLoader(f.options).request(31,'map','TEST.MAP');await done;assert.equal(f.count,1);
 rows.delete(part);
 done=f.wait('ready');createRuntimeLoader(f.options).request(32,'map','TEST.MAP');await done;assert.equal(f.count,2);
 rows.set(part,new Response(Buffer.alloc(8)));
 done=f.wait('ready');createRuntimeLoader(f.options).request(33,'map','TEST.MAP');await done;assert.equal(f.count,3);
 assert(f.completions.every(row=>Buffer.from(row[1]).equals(data)));
});
