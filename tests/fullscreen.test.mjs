import {test} from 'node:test';
import assert from 'node:assert/strict';
import {installFullscreen} from '../templates/fullscreen.mjs';

function fixture(keyboard){
 const events=new Map(),errors=[];let requests=0,exits=0,focus=0;
 const document={defaultView:{navigator:{keyboard}},fullscreenElement:null,addEventListener:(name,fn)=>events.set(name,fn),async exitFullscreen(){exits++;this.fullscreenElement=null;events.get('fullscreenchange')();}};
 document.defaultView.top=document.defaultView;
 const root={querySelector:()=>({focus:()=>focus++}),async requestFullscreen(){requests++;document.fullscreenElement=root;events.get('fullscreenchange')();}};
 const button={setAttribute(name,value){this[name]=value;}};
 const toggle=installFullscreen(document,root,button,message=>errors.push(message));
 return {document,root,button,toggle,events,errors,counts:()=>({requests,exits,focus})};
}

test('button and engine callback share enter/exit, external Esc updates state and focus',async()=>{
 const f=fixture();await f.toggle();
 assert.equal(f.button['aria-pressed'],'true');assert.equal(f.counts().requests,1);
 f.document.fullscreenElement=null;f.events.get('fullscreenchange')();
 assert.equal(f.button['aria-pressed'],'false');assert.ok(f.counts().focus>=2);
 await f.button.onclick();await f.toggle();
 assert.equal(f.counts().exits,1);assert.equal(f.button.disabled,false);
});
test('an outstanding browser request cannot be toggled twice and rejection restores retry',async()=>{
 const f=fixture();let reject;
 f.root.requestFullscreen=()=>new Promise((_,no)=>{reject=no;});
 const first=f.toggle();await f.toggle();
 assert.equal(f.button.disabled,true);reject(Error('NotAllowedError'));await first;
 assert.match(f.errors.at(-1),/NotAllowedError/);
 assert.equal(f.button.disabled,false);
 f.root.requestFullscreen=async()=>{f.document.fullscreenElement=f.root;};await f.toggle();
 assert.equal(f.button['aria-pressed'],'true');assert.equal(f.errors.at(-1),'');
});
test('an unsupported API provides a message without leaving the button disabled',async()=>{
 const f=fixture();delete f.root.requestFullscreen;await f.toggle();
 assert.match(f.errors.at(-1),/Fullscreen API/);assert.equal(f.button.disabled,false);
});

const settle=()=>new Promise(resolve=>setImmediate(resolve));

test('fullscreen requests use browser keyboard lock mode; Escape remains available to the engine',async()=>{
 const f=fixture();let options,prevented=0;
 f.root.requestFullscreen=async value=>{options=value;f.document.fullscreenElement=f.root;f.events.get('fullscreenchange')();};
 f.events.get('keydown')({key:'Escape',preventDefault:()=>prevented++});
 await f.toggle();
 assert.deepEqual(options,{keyboardLock:'browser'});
 f.events.get('keydown')({key:'Escape',preventDefault:()=>prevented++});
 f.events.get('keydown')({key:'Enter',preventDefault:()=>prevented++});
 assert.equal(prevented,1);
 assert.match(f.errors.at(-1),/再按一次/);
 await f.toggle();
 f.events.get('keydown')({key:'Escape',preventDefault:()=>prevented++});
 assert.equal(prevented,1);
});

test('only Escape is locked once per fullscreen entry, including Toy/external entries',async()=>{
 const keys=[];let unlocks=0;
 const f=fixture({lock:async codes=>keys.push(codes),unlock:()=>unlocks++});
 await f.toggle();await settle();
 assert.deepEqual(keys,[['Escape']]);assert.equal(f.errors.at(-1),'');
 await f.toggle();assert.equal(unlocks,1);assert.equal(f.errors.at(-1),'');
 f.document.fullscreenElement=f.root;f.events.get('fullscreenchange')();await settle();
 assert.deepEqual(keys,[['Escape'],['Escape']]);
});

test('rejected and synchronously throwing keyboard locks preserve fullscreen and fallback',async()=>{
 for(const lock of [()=>Promise.reject(Error('NotAllowedError')),()=>{throw Error('NotSupportedError');}]){
  const f=fixture({lock});await f.toggle();await settle();
  assert.equal(f.document.fullscreenElement,f.root);
  assert.equal(f.button.disabled,false);assert.match(f.errors.at(-1),/再按一次/);
  await f.toggle();assert.equal(f.document.fullscreenElement,null);
 }
});

test('a late keyboard lock completion cannot replace a newer fullscreen state',async()=>{
 const resolves=[];let unlocks=0;
 const f=fixture({lock:()=>new Promise(resolve=>resolves.push(resolve)),unlock:()=>unlocks++});
 await f.toggle();await f.toggle();
 resolves.shift()();await settle();
 assert.equal(f.errors.at(-1),'');assert.equal(unlocks,1);
 await f.toggle();const old=resolves.shift();await f.toggle();await f.toggle();
 old();await settle();assert.match(f.errors.at(-1),/再按一次/);
 resolves.shift()();await settle();assert.equal(f.errors.at(-1),'');
});


test('keyboard lock state and the concrete rejection are visible for a trusted manual diagnosis',async()=>{
 const f=fixture({lock:()=>Promise.reject(Object.assign(Error('Top-level context required'),{name:'InvalidStateError'}))});
 await f.toggle();await settle();
 assert.equal(f.button['data-esc-lock'],'rejected');
 assert.match(f.errors.at(-1),/InvalidStateError/);assert.match(f.errors.at(-1),/Top-level context required/);
 await f.toggle();assert.equal(f.button['data-esc-lock'],'inactive');
});

test('resolved and missing keyboard APIs expose distinct states',async()=>{
 const f=fixture({lock:async()=>{}});await f.toggle();await settle();assert.equal(f.button['data-esc-lock'],'granted');
 const unsupported=fixture();await unsupported.toggle();assert.equal(unsupported.button['data-esc-lock'],'unsupported');
});


test('successful locking is silent while failure diagnostics and explicit exit remain available',async()=>{
 const f=fixture({lock:async()=>{},unlock:()=>{}});await f.toggle();await settle();
 assert.equal(f.button['data-esc-lock'],'granted');assert.equal(f.errors.at(-1),'');
 assert.equal(f.button.textContent,'退出全屏');await f.button.onclick();
 assert.equal(f.document.fullscreenElement,null);assert.equal(f.counts().exits,1);
});


test('embedded fullscreen never requests Keyboard Lock and preserves Escape propagation',async()=>{
 for(const context of ['same-origin','cross-origin','unreadable-top']){
  let locks=0,unlocks=0,prevented=0;
  const f=fixture({lock:async()=>{locks++;},unlock:()=>{unlocks++;}});
  if(context==='unreadable-top')Object.defineProperty(f.document.defaultView,'top',{get(){throw Error('SecurityError');}});
  else f.document.defaultView.top=context==='same-origin'?{}:new Proxy({},{get(){throw Error('Cross-origin access forbidden');}});
  await f.toggle();await settle();
  assert.equal(locks,0);assert.equal(f.button['data-esc-lock'],'embedded');assert.equal(f.document.fullscreenElement,f.root);
  assert.match(f.errors.at(-1),/Esc/);assert.equal(f.button.disabled,false);
  f.events.get('keydown')({key:'Escape',preventDefault(){prevented++;},stopPropagation(){throw Error('Engine input swallowed');},stopImmediatePropagation(){throw Error('Engine input swallowed');}});
  assert.equal(prevented,1);assert.equal(f.events.has('keyup'),false);
  await f.toggle();assert.equal(unlocks,0);assert.equal(f.button['data-esc-lock'],'inactive');assert.equal(f.errors.at(-1),'');
 }
});
