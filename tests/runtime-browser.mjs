// Own headless Edge profile only; never attach to a user's browser or open a window.
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createRuntimeServer} from './serve-runtime.mjs';
import assert from 'node:assert/strict';
import {launchHeadless} from './headless.mjs';

const task=resolve('.build/runtime-browser');await mkdir(task,{recursive:true});
const site=resolve(task,'site');await mkdir(site,{recursive:true});
for(const name of ['runtime.mjs','resources.mjs'])await writeFile(resolve(site,name),await readFile(resolve('templates',name)));
await writeFile(resolve(site,'index.html'),`<!doctype html><script type="module">
import {readRemoteManifest} from './resources.mjs';
import {createRuntimeLoader} from './runtime.mjs';
window.run=async()=>{
 const catalog=(await readRemoteManifest(location.origin+'/manifest.json')).runtime;
 let loader,waiter;
 const completions=[],states=[];
 const options={catalog,complete:(id,data,cancel)=>completions.push({id,length:data.length,cancel}),onState:value=>{states.push(value);window.last=value;if(waiter&&value.phase==='error'){waiter.reject(Error(value.error));waiter=null;}else if(waiter&&value.phase===waiter.phase){waiter.resolve(value);waiter=null;}}};
 const wait=phase=>new Promise((resolve,reject)=>waiter={phase,resolve,reject});
 loader=createRuntimeLoader(options);
 let ready=wait('ready');loader.request(1,'map','TEST.MAP');await ready;
 const before=await(await fetch('/metrics.json')).json();
 ready=wait('ready');createRuntimeLoader(options).request(2,'map','TEST.MAP');await ready;
 const after=await(await fetch('/metrics.json')).json();
 loader.request(3,'map','TEST.MAP');loader.cancel();
 await new Promise(resolve=>setTimeout(resolve,150));
 const keys=await(await caches.open('vera20k-runtime-assets-v1')).keys();
 window.result={before,after,completions,keys:keys.map(key=>key.url),states:states.map(row=>row.phase),gpu:!!navigator.gpu};
 return window.result;
};
window.ready=true;</script>`);
const {server}=await createRuntimeServer({site,delayMs:80});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const address=`http://127.0.0.1:${server.address().port}`;
const browser=await launchHeadless(task);
try{
 await browser.call('Page.navigate',{url:address});
 await browser.waitFor('!!window.ready');
 const execution=await browser.call('Runtime.evaluate',{expression:'window.run()',awaitPromise:true,returnByValue:true});
 if(execution.exceptionDetails)throw Error(JSON.stringify(execution.exceptionDetails));
 const result=execution.result.value;
 assert.deepEqual(result.before,result.after);assert.deepEqual(result.completions.map(row=>[row.id,row.cancel]),[[1,false],[2,false],[3,true]]);
 assert.equal(result.keys.length,1);assert(result.keys.every(key=>!key.includes('/payload/')));
 await writeFile(resolve(task,'result.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify(result,null,2));
}finally{
 await browser.close();server.closeAllConnections();server.close();
}
