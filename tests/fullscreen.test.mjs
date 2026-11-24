import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {installFullscreen} from '../templates/fullscreen.mjs';

function fixture(){
 const events=new Map(),errors=[];let requests=0,exits=0,focus=0;
 const document={fullscreenEnabled:true,fullscreenElement:null,addEventListener:(name,fn)=>events.set(name,fn),async exitFullscreen(){exits++;this.fullscreenElement=null;events.get('fullscreenchange')();}};
 const root={querySelector:()=>({focus:()=>focus++}),async requestFullscreen(){requests++;document.fullscreenElement=root;events.get('fullscreenchange')();}};
 const status={setAttribute(name,value){this[name]=value;}};
 const toggle=installFullscreen(document,root,status,message=>errors.push(message));
 return {document,root,status,toggle,events,errors,counts:()=>({requests,exits,focus})};
}

test('engine callback shares enter/exit with browser, external Esc updates state and focus',async()=>{
 const f=fixture();await f.toggle();
 assert.equal(f.status['data-fullscreen'],'true');assert.equal(f.counts().requests,1);
 f.document.fullscreenElement=null;f.events.get('fullscreenchange')();
 assert.equal(f.status['data-fullscreen'],'false');assert.ok(f.counts().focus>=2);
 await f.toggle();await f.toggle();
 assert.equal(f.counts().exits,1);assert.equal(f.status['data-fullscreen-pending'],'false');
});
test('an outstanding browser request cannot be toggled twice and rejection restores retry',async()=>{
 const f=fixture();let reject;
 f.root.requestFullscreen=()=>new Promise((_,no)=>{reject=no;});
 const first=f.toggle();await f.toggle();
 assert.equal(f.status['data-fullscreen-pending'],'true');reject(Error('NotAllowedError'));await first;
 assert.equal(f.errors.length,1);assert.match(f.errors[0],/NotAllowedError/);
 assert.equal(f.status['data-fullscreen-pending'],'false');
 f.root.requestFullscreen=async()=>{f.document.fullscreenElement=f.root;};await f.toggle();
 assert.equal(f.status['data-fullscreen'],'true');assert.equal(f.errors.at(-1),'');
});
test('an unsupported API provides a message and clears the pending state',async()=>{
 const f=fixture();delete f.root.requestFullscreen;await f.toggle();
 assert.match(f.errors[0],/Fullscreen API/);assert.equal(f.status['data-fullscreen-pending'],'false');
});

test('battlefield availability gates only battlefield actions; no floating control exists',async()=>{
 const f=fixture();
 assert.equal(f.status.onclick,undefined);
 await f.toggle('battlefield');assert.equal(f.counts().requests,0);
 await f.toggle(true);await f.toggle(true);assert.equal(f.counts().requests,1);
 await f.toggle(false);
 f.toggle.setBattlefieldAvailable(true);
 const entering=f.toggle('battlefield');assert.equal(f.document.fullscreenElement,f.root);
 await entering;
 f.document.fullscreenElement=null;f.events.get('fullscreenchange')();
 await f.toggle('battlefield');await f.toggle('battlefield');
 assert.equal(f.counts().requests,3);assert.equal(f.counts().exits,2);
 f.toggle.setBattlefieldAvailable(false);
 await f.toggle('battlefield');assert.equal(f.counts().requests,3);
});

test('launcher markup and styles expose a passive message, never the old floating button',()=>{
 const html=readFileSync(new URL('../templates/index.html',import.meta.url),'utf8');
 const css=readFileSync(new URL('../templates/launcher.css',import.meta.url),'utf8');
 assert.doesNotMatch(html+css,/fullscreen-tools|toggle-fullscreen/);
 assert.match(html,/<span id="fullscreen-status" role="status">/);
 assert.match(css,/#fullscreen-status\{[^}]*pointer-events:none/);
});
