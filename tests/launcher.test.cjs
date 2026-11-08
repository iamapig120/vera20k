const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=name=>fs.readFileSync(`${__dirname}/../templates/${name}`,'utf8');
async function exitFixture(storage,globals={}){
 const {installFullscreen}=await import('../templates/fullscreen.mjs');
 const resources=await import('../templates/resources.mjs'),elements=new Map();
 let closeCalls=0;
 const canvas={hidden:false};
 const element=id=>{
  if(!elements.has(id))elements.set(id,{value:'',textContent:'',hidden:false,disabled:false,style:{},classList:{toggle(){},add(){},remove(){},contains(){return false;}},append(){},replaceChildren(...options){this.value=options[0]?.value||'';},querySelector(){return canvas;},setAttribute(){},addEventListener(){}});
  return elements.get(id);
 };
 const context=vm.createContext({...resources,installFullscreen,File,Blob,console,URL,Uint8Array,Map,Set,WeakMap,Date,Error,Number,Math,Promise,setTimeout,clearTimeout,setInterval:()=>1,clearInterval(){},AbortController,
  navigator:{gpu:{}},window:{addEventListener(){},close(){closeCalls++;}},document:{createElement(){return {};},getElementById:element,documentElement:element('document'),body:element('body'),addEventListener(){}},MutationObserver:class{observe(){}},
  fetch:async()=>({ok:true,headers:{get:()=>null},body:{getReader:()=>({read:async()=>({done:true})})}}),init:async()=>{},set_persistence_callbacks(){},
  VeraStorage:{open:async()=>{},library:async()=>null,users:async()=>[],...storage},import_file(){},prepare_audio(){},restore_user_file(){},start_game(){},...globals
 });
 vm.runInContext(source('launcher.js').replace(/^import .*;\r?\n/gm,'').replaceAll('import.meta.url',JSON.stringify('https://example.test/launcher.js')),context);
 await new Promise(setImmediate);
 return {context,element,canvas,get closeCalls(){return closeCalls;}};
}
test('exit waits for outstanding writes and deletions before one close attempt',async()=>{
 let finishWrite;const removed=[];
 const fixture=await exitFixture({write:()=>new Promise(resolve=>finishWrite=resolve),remove:async path=>removed.push(path)});
 fixture.context.vera20kPersistWrite('/saves/profile/VERA.INI',new Uint8Array([1]),1);
 fixture.context.vera20kPersistRemove('/saves/obsolete.sav');
 const exit=vm.runInContext('finishExit()',fixture.context);
 assert.equal(fixture.canvas.hidden,true);assert.equal(fixture.closeCalls,0);
 finishWrite();await exit;
 assert.deepEqual(removed,['/saves/obsolete.sav']);assert.equal(fixture.closeCalls,1);
 await vm.runInContext('finishExit()',fixture.context);assert.equal(fixture.closeCalls,1);
});

const remoteKey='vera20k.remote-selection';
function rememberedFixture(value){
 const values=new Map(value?[[remoteKey,JSON.stringify(value)]]:[]);
 return {values,getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
}
function remoteFixture(){
 const rows=['ra2.mix','ra2md.mix'].map(path=>({path,size:1}));
 return {label:'remembered remote',profiles:new Map([['bootstrap',rows],['campaign',rows]]),runtime:new Map([['map:TEST.MAP',{size:1,sha256:'a'.repeat(64)}]])};
}

test('validated manifest URL, selected profile and cache choice survive refresh without fetching payloads',async()=>{
 const localStorage=rememberedFixture(),manifest=remoteFixture();let downloads=0,starts=0;
 const first=await exitFixture({}, {localStorage,readRemoteManifest:async()=>manifest});
 first.element('manifest-url').value='https://cdn.example/resources.json';
 first.element('cache-resources').checked=true;
 await first.element('manifest-form').onsubmit({preventDefault(){}});
 first.element('remote-profile').value='campaign';first.element('remote-profile').onchange();
 assert.deepEqual(JSON.parse(localStorage.getItem(remoteKey)),{url:'https://cdn.example/resources.json',profile:'campaign',cache:true});
 first.element('manifest-url').value='https://unvalidated.example/typed-only.json';
 assert.equal(JSON.parse(localStorage.getItem(remoteKey)).url,'https://cdn.example/resources.json');
 first.context.readRemoteManifest=async()=>{throw Error('invalid replacement manifest');};
 await first.element('manifest-form').onsubmit({preventDefault(){}});
 assert.equal(JSON.parse(localStorage.getItem(remoteKey)).url,'https://cdn.example/resources.json');
 assert.equal(first.element('start').disabled,false,'failed replacement retains the previous selection');
 first.element('cache-resources').checked=false;first.element('cache-resources').onchange();
 assert.equal(JSON.parse(localStorage.getItem(remoteKey)).cache,false);
 const cached={folder:'old remote bootstrap',remoteRequired:true,files:['ra2.mix','ra2md.mix'].map(path=>({path,file:new File(['x'],path)}))};
 const restored=await exitFixture({library:async()=>cached},{localStorage,readRemoteManifest:async url=>{assert.equal(url,'https://cdn.example/resources.json');return manifest;},
  loadRemoteProfile:async(_manifest,profile,options)=>{downloads++;assert.equal(profile,'campaign');assert.equal(options.cached,cached.files);return cached.files.map(row=>({path:row.path,blob:row.file}));},
  createRuntimeLoader:()=>({request(){}}),configure_remote_assets(){},finish_remote_asset(){},start_game(){starts++;}});
 assert.equal(downloads,0);assert.equal(starts,0);
 assert.equal(restored.element('manifest-url').value,'https://cdn.example/resources.json');
 assert.equal(restored.element('remote-profile').value,'campaign');
 assert.equal(restored.element('cache-resources').checked,false);
 assert.equal(restored.element('start').disabled,false);
 assert.equal(vm.runInContext('needsRemoteConfig',restored.context),false);
 await restored.element('start').onclick();assert.equal(downloads,1);assert.equal(starts,1);
 assert.equal(JSON.parse(localStorage.getItem(remoteKey)).profile,'campaign','remote import must retain the remembered source');
});

test('remembered remote selection wins over a late cached folder',async()=>{
 const localStorage=rememberedFixture({url:'https://cdn.example/resources.json',profile:'campaign'});let restore;
 const fixture=await exitFixture({library:()=>new Promise(resolve=>restore=resolve)},{localStorage,readRemoteManifest:async()=>remoteFixture()});
 assert.match(fixture.element('folder-name').textContent,/remembered remote/);
 restore({folder:'stale cached local',files:['ra2.mix','ra2md.mix','mapsmd03.mix'].map(path=>({path,file:new File(['x'],path)}))});
 await new Promise(setImmediate);
 assert.match(fixture.element('folder-name').textContent,/remembered remote/);
 assert.equal(fixture.element('remote-profile').value,'campaign');
});

test('failed restored manifest remains retryable and never starts a cached remote bootstrap without its catalog',async()=>{
 const localStorage=rememberedFixture({url:'https://cdn.example/resources.json',profile:'campaign'});let unavailable=true;
 const fixture=await exitFixture({library:async()=>({folder:'cached',remoteRequired:true,files:['ra2.mix','ra2md.mix'].map(path=>({path,file:new File(['x'],path)}))})},
  {localStorage,readRemoteManifest:async()=>{if(unavailable)throw Error('HTTP 503');return remoteFixture();}});
 assert.equal(fixture.element('start').disabled,true);
 assert.match(fixture.element('feedback').textContent,/HTTP 503/);
 assert.equal(fixture.element('manifest-url').value,'https://cdn.example/resources.json');
 assert.equal(fixture.element('load-manifest').disabled,false);
 assert.equal(JSON.parse(localStorage.getItem(remoteKey)).profile,'campaign');
 fixture.element('cancel-import').disabled=true;
 unavailable=false;await fixture.element('manifest-form').onsubmit({preventDefault(){}});
 assert.equal(fixture.element('start').disabled,false);
 assert.equal(fixture.element('cancel-import').disabled,false);
});

test('a removed remembered profile requires explicit reselection instead of silently choosing another',async()=>{
 const localStorage=rememberedFixture({url:'https://cdn.example/resources.json',profile:'removed'});
 const fixture=await exitFixture({}, {localStorage,readRemoteManifest:async()=>remoteFixture()});
 assert.equal(fixture.element('start').disabled,true);assert.match(fixture.element('feedback').textContent,/removed/);
 assert.equal(JSON.parse(localStorage.getItem(remoteKey)).profile,'removed');
 await fixture.element('manifest-form').onsubmit({preventDefault(){}});
 assert.equal(fixture.element('start').disabled,false);
 assert.equal(JSON.parse(localStorage.getItem(remoteKey)).profile,'bootstrap');
});

test('cancelling a restored manifest and choosing local resources prevents late selection and clears its remembered URL',async()=>{
 const localStorage=rememberedFixture({url:'https://cdn.example/resources.json',profile:'campaign'});let resolveManifest;
 const fixture=await exitFixture({}, {localStorage,readRemoteManifest:()=>new Promise(resolve=>resolveManifest=resolve)});
 fixture.element('cancel-import').onclick();
 vm.runInContext("selectResources(['ra2.mix','ra2md.mix'].map(name=>({name,size:1})),'manual local')",fixture.context);
 resolveManifest(remoteFixture());await new Promise(setImmediate);
 assert.equal(fixture.element('folder-name').textContent,'manual local');
 assert.equal(fixture.element('start').disabled,false);assert.equal(localStorage.getItem(remoteKey),null);
 assert.equal(vm.runInContext('remoteSource',fixture.context),undefined);
});

test('invalid or blocked remembered storage leaves manual resource selection available',async()=>{
 for(const localStorage of [{getItem:()=>'{broken',removeItem(){},setItem(){}},{getItem(){throw Error('blocked');},removeItem(){throw Error('blocked');},setItem(){throw Error('blocked');}}]){
  const fixture=await exitFixture({}, {localStorage,readRemoteManifest:()=>assert.fail('invalid preference must not be fetched')});
  vm.runInContext("selectResources(['ra2.mix','ra2md.mix'].map(name=>({name,size:1})),'manual')",fixture.context);
  assert.equal(fixture.element('start').disabled,false);
 }
});

test('an explicit engine preparation retry clears its old error while retaining the restored manifest',async()=>{
 let attempts=0;
 const fixture=await exitFixture({}, {localStorage:rememberedFixture({url:'https://cdn.example/resources.json',profile:'bootstrap'}),readRemoteManifest:async()=>remoteFixture(),init:async()=>{if(++attempts===1)throw Error('initial compilation failed');}});
 assert.equal(fixture.element('start').disabled,true);
 fixture.element('retry').onclick();await new Promise(setImmediate);
 assert.equal(attempts,2);assert.equal(fixture.element('start').disabled,false);
 assert.match(fixture.element('feedback').textContent,/资源已就绪/);
});

test('remote selection waits until Start, imports only verified completed downloads, and retains selection on failure',async()=>{
 for(const failDownload of [false,true]){
  const fixture=await exitFixture({});const calls=[];
  const rows=['ra2.mix','ra2md.mix','mapsmd03.mix'].map(path=>({path,size:1}));
  fixture.context.readRemoteManifest=async()=>({label:'test',profiles:new Map([['skirmish',rows]])});
  fixture.element('remote-profile').replaceChildren=(...options)=>{fixture.element('remote-profile').value=options[0].value;};
  fixture.element('manifest-url').value='https://example.test/resources.json';
  let release;
  fixture.context.loadRemoteProfile=async(_manifest,profile)=>{
   calls.push(profile);await new Promise(resolve=>release=resolve);
   if(failDownload)throw Error('integrity failure');
   return rows.map(row=>({path:row.path,blob:new Blob(['x'])}));
  };
  fixture.context.import_file=name=>calls.push(name);
  fixture.context.start_game=()=>calls.push('start');
  await fixture.element('manifest-form').onsubmit({preventDefault(){}});
  assert.deepEqual(calls,[]);assert.equal(fixture.element('start').disabled,false);
  const starting=fixture.element('start').onclick();
  await new Promise(setImmediate);
  assert.deepEqual(calls,['skirmish']);
  release();await starting;
  assert.deepEqual(calls,failDownload?['skirmish']:['skirmish',...rows.map(row=>row.path),'start']);
  if(failDownload){assert.equal(fixture.element('start').disabled,false);assert.match(fixture.element('feedback').textContent,/integrity failure/);}
 }
});

test('remote startup reports audio activation errors before downloading',async()=>{
 const fixture=await exitFixture({});
 vm.runInContext("selectResources([{name:'ra2.mix',size:1},{name:'ra2md.mix',size:1}],'remote'); remoteSource={profile:'test'}",fixture.context);
 fixture.context.prepare_audio=()=>{throw Error('audio activation failed');};
 fixture.context.loadRemoteProfile=()=>assert.fail('audio failure must stop the download');
 await fixture.element('start').onclick();
 assert.match(fixture.element('error-message').textContent,/audio activation failed/);
 assert.equal(fixture.element('start').disabled,true);
});

test('runtime startup configures logical identities before engine start and keeps resource URLs in the host',async()=>{
 const fixture=await exitFixture({});const calls=[];
 fixture.context.createRuntimeLoader=options=>{calls.push(['loader',options.catalog]);return {request(){}};};
 fixture.context.configure_remote_assets=(catalog,handler)=>{calls.push(['catalog',JSON.parse(catalog),typeof handler]);};
 fixture.context.finish_remote_asset=()=>{};
 fixture.context.start_game=()=>calls.push(['start']);
 vm.runInContext("selectResources(['ra2.mix','ra2md.mix'].map(name=>({name,size:1,arrayBuffer:async()=>new ArrayBuffer(1)})),'remote');runtimeManifest={runtime:new Map([['map:TEST.MAP',{size:123,sha256:'abcd',url:'https://private.example/map'}]])}",fixture.context);
 await fixture.element('start').onclick();
 assert.equal(calls[0][0],'loader');
 assert.deepEqual(calls[1],['catalog',{'map:TEST.MAP':{size:123,sha256:'abcd'}},'function']);
 assert.deepEqual(calls[2],['start']);
});

test('cached remote bootstrap requires the manifest again, and choosing local resources clears that requirement',async()=>{
 const fixture=await exitFixture({library:async()=>({folder:'cached',remoteRequired:true,files:['ra2.mix','ra2md.mix'].map(path=>({path,file:new File(['x'],path)}))})});
 assert.equal(fixture.element('start').disabled,true);
 assert.equal(vm.runInContext('needsRemoteConfig',fixture.context),true);
 vm.runInContext("selectResources(['ra2.mix','ra2md.mix'].map(name=>({name,size:1})),'local')",fixture.context);
 assert.equal(fixture.element('start').disabled,false);
 assert.equal(vm.runInContext('needsRemoteConfig',fixture.context),false);
});
test('failed exit saves retain pending data and never close the page',async()=>{
 const fixture=await exitFixture({write:async()=>{throw Error('transaction aborted');}});
 fixture.context.vera20kPersistWrite('/saves/profile/VERA.INI',new Uint8Array([7]),1);
 await vm.runInContext('finishExit()',fixture.context);
 assert.equal(fixture.closeCalls,0);assert.match(fixture.element('feedback').textContent,/尚未保存/);
 assert.equal(vm.runInContext('pending.size',fixture.context),1);
 assert.equal(fixture.element('retry-storage').hidden,false);
});
test('a normal tab refusing close keeps the saved exit message and cannot restart',async()=>{
 const fixture=await exitFixture({});
 await vm.runInContext('finishExit()',fixture.context);
 assert.equal(fixture.closeCalls,1);assert.match(fixture.element('feedback').textContent,/请手动关闭此标签页/);
 assert.equal(fixture.element('start').disabled,true);
 assert.equal(fixture.element('choose-folder').disabled,true);
});
test('blocked database rejects and closes a late connection',async()=>{
 const req={};let closed=false;
 const context=vm.createContext({indexedDB:{open:()=>req},setTimeout,clearTimeout,Uint8Array,Date});
 vm.runInContext(source('storage.js'),context);
 const opening=context.VeraStorage.open();req.onblocked();
 await assert.rejects(opening,/其他页面/);
 req.result={close(){closed=true;}};req.onsuccess();assert.ok(closed);
});
test('database timeout rejects and permits retry',async()=>{
 let expire;const requests=[];
 const context=vm.createContext({indexedDB:{open:()=>{const req={};requests.push(req);return req;}},setTimeout:fn=>{expire=fn;return 1;},clearTimeout(){},Uint8Array,Date});
 vm.runInContext(source('storage.js'),context);
 const store=context.createVeraStorage('timeout-fixture',{migrateLegacy:false});
 const opening=store.open();expire();await assert.rejects(opening,/超时/);
 const retry=store.open();requests[1].result={close(){}};requests[1].onsuccess();await retry;
 assert.equal(requests.length,2);
});
test('manual folder wins over late cache restoration and storage does not gate engine',async()=>{
 const {installFullscreen}=await import('../templates/fullscreen.mjs');
 const resources=await import('../templates/resources.mjs');
 let restore;const elements=new Map();
 const element=id=>{if(!elements.has(id))elements.set(id,{textContent:'',hidden:false,disabled:false,style:{},classList:{toggle(){},add(){},remove(){},contains(){return false;}},append(){},setAttribute(){},addEventListener(){}});return elements.get(id);};
 const context=vm.createContext({...resources,installFullscreen,File,Blob,console,URL,Uint8Array,Map,Set,WeakMap,Date,Error,Number,Math,Promise,
 setTimeout,clearTimeout,setInterval:()=>1,clearInterval(){},
 navigator:{gpu:{}},window:{addEventListener(){}},document:{createElement(){return {};},getElementById:element,documentElement:element('document'),body:{classList:element('body').classList},addEventListener(){}},
 MutationObserver:class{observe(){}},
 fetch:async()=>({ok:true,headers:{get:()=>null},body:{getReader:()=>({read:async()=>({done:true})})}}),
 AbortController,init:async()=>{},set_persistence_callbacks(){},VeraStorage:{open:async()=>{},library:()=>new Promise(resolve=>restore=resolve)},
 import_file(){},prepare_audio(){},restore_user_file(){},start_game(){}
 });
 vm.runInContext(source('launcher.js').replace(/^import .*;\r?\n/gm,'').replaceAll('import.meta.url',JSON.stringify('https://example.test/launcher.js')),context);
 await new Promise(setImmediate);
 vm.runInContext("selectResources([{name:'ra2.mix',size:1},{name:'ra2md.mix',size:1}],'manual')",context);
 assert.equal(element('start').disabled,false);
 restore({folder:'cached',files:['ra2.mix','ra2md.mix','mapsmd03.mix'].map(path=>({path,file:new File(['fixture'],path)}))});
 await new Promise(setImmediate);
 assert.equal(element('folder-name').textContent,'manual');
});

test('startup waits for saved preferences even when storage opens after the engine',async()=>{
 const {installFullscreen}=await import('../templates/fullscreen.mjs');
 const resources=await import('../templates/resources.mjs');
 let openStorage;const calls=[],elements=new Map();
 const element=id=>{if(!elements.has(id))elements.set(id,{textContent:'',hidden:false,disabled:false,style:{},classList:{toggle(){},add(){},remove(){},contains(){return false;}},append(){},setAttribute(){},addEventListener(){}});return elements.get(id);};
 const opening=new Promise(resolve=>openStorage=resolve);
 const context=vm.createContext({...resources,installFullscreen,File,Blob,console,URL,Uint8Array,Map,Set,WeakMap,Date,Error,Number,Math,Promise,setTimeout,clearTimeout,setInterval:()=>1,clearInterval(){},AbortController,
 navigator:{gpu:{}},window:{addEventListener(){}},document:{createElement(){return {};},getElementById:element,documentElement:element('document'),body:element('body'),addEventListener(){}},MutationObserver:class{observe(){}},
 fetch:async()=>({ok:true,headers:{get:()=>null},body:{getReader:()=>({read:async()=>({done:true})})}}),init:async()=>{},set_persistence_callbacks(){},
 VeraStorage:{open:()=>opening,library:async()=>null,users:async()=>[{path:'/retail/RA2MD.INI',bytes:new Uint8Array([89]),modified_ms:1}],saveLibrary:async()=>{}},
 prepare_audio(){},import_file(name){calls.push(name);},restore_user_file(path){calls.push(path);},start_game(){calls.push('start');}
 });
 vm.runInContext(source('launcher.js').replace(/^import .*;\r?\n/gm,'').replaceAll('import.meta.url',JSON.stringify('https://example.test/launcher.js')),context);
 await new Promise(setImmediate);
 vm.runInContext("selectResources(['ra2.mix','ra2md.mix'].map(name=>({name,size:1,arrayBuffer:async()=>new ArrayBuffer(1)})),'manual')",context);
 const starting=element('start').onclick();
 await new Promise(resolve=>setTimeout(resolve,20));
 assert.ok(!calls.includes('start'),'must not boot with defaults while preferences are still opening');
 openStorage();await starting;
 assert.deepEqual(calls.slice(-2),['/retail/RA2MD.INI','start']);
});

test('optional gateway restores and validates origins without probing or gating single-player',async()=>{
 const {installFullscreen}=await import('../templates/fullscreen.mjs');
 const resources=await import('../templates/resources.mjs');
 const elements=new Map(),writes=[],requests=[];
 let startCalls=0;
 const element=id=>{
  if(!elements.has(id))elements.set(id,{value:'',textContent:'',hidden:false,disabled:false,style:{},classList:{toggle(){},add(){},remove(){},contains(){return false;}},append(){},setAttribute(){},addEventListener(){}});
  return elements.get(id);
 };
 const context=vm.createContext({...resources,installFullscreen,File,Blob,console,URL,Uint8Array,Map,Set,WeakMap,Date,Error,Number,Math,Promise,
 setTimeout,clearTimeout,setInterval:()=>1,clearInterval(){},AbortController,
 localStorage:{getItem:()=> 'wss://gateway.example:8443/',setItem(key,value){writes.push([key,value]);}},
 navigator:{gpu:{}},window:{addEventListener(){}},document:{createElement(){return {};},getElementById:element,documentElement:element('document'),body:element('body'),addEventListener(){}},MutationObserver:class{observe(){}},
 fetch:async url=>{requests.push(String(url));return {ok:true,headers:{get:()=>null},body:{getReader:()=>({read:async()=>({done:true})})}};},
 init:async()=>{},set_persistence_callbacks(){},VeraStorage:{open:async()=>{},library:async()=>null,users:async()=>[],saveLibrary:async()=>{}},
 import_file(){},prepare_audio(){},restore_user_file(){},start_game(){startCalls++;}
 });
 vm.runInContext(source('launcher.js').replace(/^import .*;\r?\n/gm,'').replaceAll('import.meta.url',JSON.stringify('https://example.test/launcher.js')),context);
 await new Promise(setImmediate);
 assert.equal(context.veraGatewayBase(),'https://gateway.example:8443');
 const input=element('gateway-address');
 input.value='ws://localhost:9090';input.oninput();
 assert.equal(context.veraGatewayBase(),'http://localhost:9090');
 assert.deepEqual(writes.at(-1),['vera20k.gateway-origin','http://localhost:9090']);
 for(const value of ['https://name:secret@example.test','https://example.test/path','https://example.test/?key=x','https://example.test/#room','ftp://example.test','https://example.test/../']){
  input.value=value;input.oninput();
  assert.throws(()=>context.veraGatewayBase(),/联机配置错误/);
  assert.match(element('gateway-status').textContent,/联机配置错误/);
 }
 vm.runInContext("selectResources(['ra2.mix','ra2md.mix'].map(name=>({name,size:1,arrayBuffer:async()=>new ArrayBuffer(1)})),'manual')",context);
 assert.equal(element('start').disabled,false);
 await element('start').onclick();
 assert.equal(startCalls,1);
 assert.equal(requests.length,1,'only the Wasm engine is fetched, never a gateway probe');
 assert.ok(requests[0].startsWith('https://example.test/'));
 input.value='';input.oninput();assert.equal(context.veraGatewayBase(),'');
 Object.defineProperty(context,'localStorage',{get(){throw Error('storage blocked');}});
 input.value='https://other.example';assert.doesNotThrow(()=>input.oninput());
 assert.equal(context.veraGatewayBase(),'https://other.example');
});
