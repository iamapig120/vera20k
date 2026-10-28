// Launcher regressions without a browser, retail files, or Wasm compilation.
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import * as resourceApi from '../templates/resources.mjs';
import assert from 'node:assert/strict';
const source=readFileSync(new URL('../templates/launcher.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replaceAll('import.meta.url',JSON.stringify('https://example.test/launcher.js'));
function launcher(audioError=false,library=null,users=[],initPromise=null){
 const elements=new Map(), calls=[],writes=[],downloads=[],restored=[],bridge={},starts=[];
 const element=id=>{
  if(!elements.has(id))elements.set(id,{disabled:false,hidden:false,textContent:'',style:{},classList:{add(){},remove(){},toggle(){},contains(){return false;}},append(){},setAttribute(){},addEventListener(){}});
  return elements.get(id);
 };
 const context={...resourceApi,File,Blob,URL:class extends URL{static createObjectURL(blob){downloads.push(blob);return 'blob:fixture';}static revokeObjectURL(){}},window:{addEventListener(){}},VeraStorage:{open:async()=>{},library:async()=>library,users:async()=>users,write:async row=>{writes.push(row);users.push(row);},remove:async()=>{},saveLibrary:async()=>{}},restore_user_file(path,bytes,modified_ms,deleted){restored.push({path,bytes,modified_ms,deleted});calls.push(`restore:${path}`);},document:{createElement(){return {click(){}};},getElementById:element,addEventListener(){},body:element('body')},navigator:{gpu:{}},MutationObserver:class{observe(){}},init:async()=>{await initPromise;},set_persistence_callbacks(write,remove){bridge.write=write;bridge.remove=remove;},prepare_audio(){calls.push('audio');if(audioError)throw Error('blocked');},import_file(name){calls.push(name);},start_game(canvas,status){starts.push({canvas,status});calls.push('start');},setTimeout,clearTimeout,setInterval:()=>1,clearInterval(){},AbortController,fetch:async()=>({ok:true,headers:{get:()=>null},body:{getReader:()=>({read:async()=>({done:true})})}}),location:{reload(){}}};
 return {context,elements,calls,writes,downloads,restored,bridge,starts,run:async()=>{const api=await runInNewContext(`(async()=>{${source}\nreturn {selectResources,restoredUserRows};})()`,context);await initPromise;await new Promise(setImmediate);return api;}};
}
const resources=['ra2.mix','ra2md.mix','mapsmd03.mix','theme.mix','thememd.mix','audio.bag','audio.idx','voice.wav','sound.aud','movies01.mix','movmd03.mix','intro.bik','gamemd.exe','mod.custom','nested/override.bin'].map(name=>new File([new Uint8Array([0])],name));
{
 const fixture=launcher(), api=await fixture.run();
 api.selectResources(resources,'retail');
 await fixture.elements.get('start').onclick();
 assert.deepEqual(fixture.calls,['audio',...resources.map(file=>file.name),'start']);
}
{
 const fixture=launcher(true), api=await fixture.run();
 api.selectResources(resources,'retail');
 await fixture.elements.get('start').onclick();
 assert.deepEqual(fixture.calls,['audio']);
 assert.equal(fixture.elements.get('retry').hidden,false);
}
console.log('PASS: audio opens before resource reads; audio resources retained; output failure is visible');

{
 const cached={folder:'cached retail',files:resources.map(file=>({path:file.name,file}))};
 const fixture=launcher(false,cached,[{path:'/retail/RA2MD.INI',bytes:new Uint8Array([1]),modified_ms:123}]);
 await fixture.run();
 assert.equal(fixture.elements.get('start').disabled,false,'cached resources are ready without a folder picker');
 await fixture.elements.get('start').onclick();
 assert.equal(fixture.calls[0],'audio');
 for(const file of resources)assert.ok(fixture.calls.includes(file.name),`cached root file retained: ${file.name}`);
 assert.deepEqual(fixture.calls.slice(-2),['restore:/retail/RA2MD.INI','start'],'user settings override imported settings before engine startup');
}
console.log('PASS: cached resources skip folder selection; user data restores before startup');

{
 const fixture=launcher();await fixture.run();
 const bytes=new Uint8Array([89,82]);
 fixture.context.vera20kPersistWrite('/retail/RA2MD.INI',bytes,123);
 bytes.fill(0);
 await fixture.elements.get('export-data').onclick();
 const backup=JSON.parse(await fixture.downloads[0].text());
 assert.equal(backup.files[0].path,'/retail/RA2MD.INI');
 assert.deepEqual(backup.files[0].bytes,[89,82],'Wasm memory changes cannot corrupt queued settings');
 assert.equal(fixture.writes[0].modified_ms,123);
}
console.log('PASS: settings queue copies Wasm memory; user backup contains persisted bytes');

{
 let finishInit;const initialization=new Promise(resolve=>{finishInit=resolve;});
 const fixture=launcher(false,null,[],initialization),running=fixture.run();
 fixture.elements.get('files').files=resources.map(file=>{Object.defineProperty(file,'webkitRelativePath',{value:`retail/${file.name}`});return file;});
 fixture.elements.get('files').onchange();
 assert.equal(fixture.elements.get('start').disabled,true);
 assert.equal(fixture.elements.get('start-label').textContent,'正在准备游戏…');
 finishInit();await running;
 assert.equal(fixture.elements.get('start').disabled,false);
 assert.equal(fixture.elements.get('start-label').textContent,'开始游戏');
}
console.log('PASS: selecting a folder during engine loading shows why start is disabled and enables it after readiness');

{
 const f=launcher();const api=await f.run();api.selectResources(resources,'retail');
 await f.elements.get('start').onclick();
 assert.equal(f.bridge.write,f.context.vera20kPersistWrite);
 assert.equal(f.bridge.remove,f.context.vera20kPersistRemove);
 assert.equal(f.starts[0].canvas.tabIndex,0);
 assert.equal(typeof f.starts[0].status,'function');
}
console.log('PASS: official main receives a canvas/status callback and the durable bridge');
{
 const f=launcher();const api=await f.run();
 const rows=[{path:'/retail/VERA.INI',bytes:new Uint8Array([1]),modified_ms:1},
  {path:'/retail/VERARULES.INI',bytes:new Uint8Array(),modified_ms:2,deleted:true},
  {path:'/saves/profile/vera.ini',bytes:new Uint8Array(),modified_ms:3,deleted:true},
  {path:'/retail/mod.ini',bytes:new Uint8Array([2]),modified_ms:4}];
 const restored=api.restoredUserRows(rows);
 assert.equal(restored.length,5);
 assert.equal(restored[0].path,'/saves/profile/VERARULES.INI');
 assert.equal(restored[0].deleted,true);
 assert.ok(!restored.some(row=>row.path==='/saves/profile/VERA.INI'));
 assert.ok(!restored.some(row=>row.path==='/saves/profile/mod.ini'));
 assert.equal(restored.at(-1),rows.at(-1));
 assert.equal(rows.length,4);
}
console.log('PASS: legacy profile copy preserves deletions, current precedence and arbitrary root resources');
