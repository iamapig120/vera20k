import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {installFullscreen} from '../templates/fullscreen.mjs';

function fixture({deny=false}={}){
 const listeners=new Map(), status={setAttribute(name,value){this[name]=value;}}, trace=[];
 const canvas={focus(){trace.push('focus');}};
 const view={navigator:{},top:null};
 const document={addEventListener(type,fn){listeners.set(type,fn);},defaultView:view,fullscreenEnabled:true,fullscreenElement:null,
  exitFullscreen(){trace.push('exit');this.fullscreenElement=null;listeners.get('fullscreenchange')();return Promise.resolve();}};
 const root={querySelector:()=>canvas,requestFullscreen(){trace.push('request');
  if(deny)return Promise.reject(Error('rejected'));document.fullscreenElement=root;listeners.get('fullscreenchange')();return Promise.resolve();}};
 const toggle=installFullscreen(document,root,status,message=>trace.push(message));
 const externalExit=()=>{document.fullscreenElement=null;listeners.get('fullscreenchange')();};
 return {status,trace,root,document,toggle,externalExit};
}

test('same battlefield action enters and exits using actual browser state',async()=>{
 const {toggle,trace,status,document,root,externalExit}=fixture();
 assert.equal(status.onclick,undefined);
 await toggle('battlefield');assert.deepEqual(trace,[]);
 toggle.setBattlefieldAvailable(true);
 const entering=toggle('battlefield');
 assert.equal(document.fullscreenElement,root,'request occurs before first await');
 await entering;
 assert.equal(status['data-fullscreen'],'true');
 assert.equal(status['data-esc-lock'],'embedded');
 externalExit();
 assert.equal(document.fullscreenElement,null);
 await toggle('battlefield');
 assert.equal(document.fullscreenElement,root);
 await toggle('battlefield');
 assert.equal(document.fullscreenElement,null);
 assert.deepEqual(trace.filter(x=>x==='request'||x==='exit'),['request','request','exit']);
});

test('keyboard desired state shares the owner, rejection reports without adding a fallback',async()=>{
 const good=fixture();
 await good.toggle(true);await good.toggle(true);
 assert.equal(good.trace.filter(x=>x==='request').length,1);
 assert.equal(good.status['data-fullscreen'],'true');
 await good.toggle(false);assert.equal(good.status['data-fullscreen'],'false');
 const denied=fixture({deny:true});
 denied.toggle.setBattlefieldAvailable(true);
 await denied.toggle('battlefield');
 assert.equal(denied.status.onclick,undefined);
 assert.equal(denied.status['data-fullscreen-pending'],'false');
 assert(denied.trace.some(x=>/^无法切换全屏/.test(x)));
});
test('collapse or absent glyph does not create a floating control; hotkey remains available',async()=>{
 const f=fixture();f.toggle.setBattlefieldAvailable(true);f.toggle.setBattlefieldAvailable(false);
 assert.equal(f.status.onclick,undefined);
 await f.toggle('battlefield');assert.deepEqual(f.trace,[]);
 await f.toggle(true);assert.equal(f.document.fullscreenElement,f.root);
});

test('launcher markup and styles expose a passive message, never the old floating button',()=>{
 const html=readFileSync(new URL('../templates/index.html',import.meta.url),'utf8');
 const css=readFileSync(new URL('../templates/launcher.css',import.meta.url),'utf8');
 assert.doesNotMatch(html+css,/fullscreen-tools|toggle-fullscreen/);
 assert.match(html,/<span id="fullscreen-status" role="status">/);
 assert.match(css,/#fullscreen-status\{[^}]*pointer-events:none/);
});
