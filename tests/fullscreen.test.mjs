import {test} from 'node:test';
import assert from 'node:assert/strict';
import {installFullscreen} from '../templates/fullscreen.mjs';

function fixture(){
 const events=new Map(),errors=[];let requests=0,exits=0,focus=0;
 const document={fullscreenElement:null,addEventListener:(name,fn)=>events.set(name,fn),async exitFullscreen(){exits++;this.fullscreenElement=null;events.get('fullscreenchange')();}};
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
 assert.equal(f.errors.length,1);assert.match(f.errors[0],/NotAllowedError/);
 assert.equal(f.button.disabled,false);
 f.root.requestFullscreen=async()=>{f.document.fullscreenElement=f.root;};await f.toggle();
 assert.equal(f.button['aria-pressed'],'true');assert.equal(f.errors.at(-1),'');
});
test('an unsupported API provides a message without leaving the button disabled',async()=>{
 const f=fixture();delete f.root.requestFullscreen;await f.toggle();
 assert.match(f.errors[0],/Fullscreen API/);assert.equal(f.button.disabled,false);
});
