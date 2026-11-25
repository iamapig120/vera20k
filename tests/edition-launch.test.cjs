const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');

async function fixture(withBinding=true){
 const {planUserRestore}=await import('../templates/user-data.mjs');
 const noop=()=>{},elements=new Map(),calls=[];
 const element=id=>{
  if(!elements.has(id))elements.set(id,{hidden:false,disabled:false,textContent:'',style:{},classList:{toggle:noop,remove:noop,add:noop,contains:()=>false},setAttribute:noop,addEventListener:noop,append:noop,querySelector:()=>({focus:noop})});
  return elements.get(id);
 };
 const context=vm.createContext({File,Blob,URL,Uint8Array,setTimeout,clearTimeout,setInterval:()=>0,clearInterval:noop,AbortController,
  navigator:{gpu:{}},window:{addEventListener:noop},document:{getElementById:element,body:element('body'),createElement:()=>({}),addEventListener:noop},
  installFullscreen:noop,init:async()=>{},fonts_ready:async()=>{},planUserRestore,set_persistence_callbacks:noop,set_lifecycle_callback:noop,
  VeraStorage:{open:async()=>{},library:async()=>null,preservedUsers:async()=>null,preserveUsers:async()=>{},users:async()=>[
    {path:'/saves/profile/VERA.INI',bytes:new Uint8Array([1]),modified_ms:1},
    {path:'/saves/ra2/profile/VERA.INI',bytes:new Uint8Array([2]),modified_ms:1},
    {path:'/saves/ra2/campaign.sav',bytes:new Uint8Array([3]),modified_ms:1},
  ]},
  fetch:async()=>({ok:true,headers:{get:()=>null},body:{getReader:()=>({read:async()=>({done:true})})}}),
  import_file:noop,prepare_audio:noop,restore_user_file:path=>calls.push(path),start_game:()=>calls.push('YR'),
  ...(withBinding?{start_ra2:()=>calls.push('RA2')}:{})
 });
 vm.runInContext(fs.readFileSync(require.resolve('../templates/launcher.js'),'utf8').replace(/^import .*;\r?\n/gm,'').replaceAll('import.meta.url','"https://example.test/launcher.js"'),context);
 await new Promise(setImmediate);
 const choose=names=>vm.runInContext(`selectResources(${JSON.stringify(names)}.map(name=>({name,size:1,arrayBuffer:async()=>new ArrayBuffer(1)})),'local')`,context);
 return {element,choose,calls};
}
const full=['RA2.MIX','RA2MD.MIX','LANGUAGE.MIX','MULTI.MIX'];
test('RA2 gate requires all four root MIX files and leaves default YR available',async()=>{
 const f=await fixture();
 f.choose(full.slice(0,-1));
 assert.equal(f.element('start-ra2').disabled,true);
 assert.match(f.element('ra2-resource-note').textContent,/multi\.mix/);
 assert.equal(f.element('start').disabled,false);
 await f.element('start-ra2').onclick();
 assert.deepEqual(f.calls,[]);
 f.choose(full);
 assert.equal(f.element('start-ra2').disabled,false);
 const old=await fixture(false);old.choose(full);
 assert.equal(old.element('edition-switch').hidden,true);
 assert.equal(old.element('start').disabled,false);
});
test('RA2 selects its exact binding and saves; a simultaneous YR click cannot enter',async()=>{
 const f=await fixture();f.choose(full);
 await Promise.all([f.element('start-ra2').onclick(),f.element('start').onclick()]);
 assert.deepEqual(f.calls,['/saves/ra2/profile/VERA.INI','/saves/ra2/campaign.sav','RA2']);
});
test('normal YR remains default with complete assets and restores only YR choices',async()=>{
 const f=await fixture();f.choose(full);await f.element('start').onclick();
 assert.deepEqual(f.calls,['/saves/profile/VERA.INI','YR']);
});
