// Optional full-engine refresh regression, using local retail data and an owned muted browser.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createRuntimeServer} from './serve-runtime.mjs';
import {launchHeadless} from './headless.mjs';
const [plan,site,runtime]=process.argv.slice(2);
if(!plan||!site||!runtime)throw Error('Usage: node tests/manifest-restore-game.mjs PLAN SITE MAP_DIRECTORY');
const task=resolve(process.env.VERA_RESTORE_OUTPUT||'.build/manifest-restore-20261107/game');
await mkdir(task,{recursive:true});
const service=await createRuntimeServer({plan,site,runtime,encoding:'br',encodingCache:resolve('.build/startup-audit-20261106/brotli-cache'),delayMs:100,kilobitsPerSecond:100000,scope:'all'});
let unavailable=false;
const handler=service.server.listeners('request')[0];
service.server.removeListener('request',handler);
service.server.on('request',(req,res)=>{
 if(unavailable&&req.url==='/manifest.json'){res.writeHead(503,{'Content-Type':'text/plain'});res.end('Fixture manifest unavailable');}
 else handler(req,res);
});
await new Promise(resolve=>service.server.listen(0,'127.0.0.1',resolve));
const address=`http://127.0.0.1:${service.server.address().port}`,url=address+'/manifest.json';
let browser;
const checkpoints={address,url};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const state=()=>browser.evaluate("({url:document.getElementById('manifest-url').value,profile:document.getElementById('remote-profile').value,cache:document.getElementById('cache-resources').checked,startDisabled:document.getElementById('start').disabled,playing:document.body.classList.contains('playing'),error:document.getElementById('error-message').textContent,feedback:document.getElementById('feedback').textContent,saved:JSON.parse(localStorage.getItem('vera20k.remote-selection'))})");
const prepared=()=>browser.waitFor("!document.getElementById('start').disabled",120000);
const idle=async()=>{
 await browser.waitFor("document.body.classList.contains('playing')",180000);
 await browser.evaluate('window.testIdle=0');
 await browser.waitFor("(()=>{if(!document.getElementById('runtime-panel').hidden){window.testIdle=0;return false;}window.testIdle ||= performance.now();return performance.now()-window.testIdle>4000;})()",180000);
};
const start=async()=>{
 const p=await browser.evaluate("(()=>{const r=document.getElementById('start').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()");
 await browser.click(p.x,p.y);await idle();
};
const reload=async()=>{await browser.call('Page.reload',{ignoreCache:true});await browser.waitFor("typeof document.getElementById('manifest-form')?.onsubmit==='function'",30000);};
try{
 browser=await launchHeadless(task,{gpu:true});
 await browser.call('Page.navigate',{url:address});
 await browser.waitFor("typeof document.getElementById('manifest-form')?.onsubmit==='function'");
 await browser.evaluate(`document.getElementById('cache-resources').checked=true;document.getElementById('manifest-url').value=${JSON.stringify(url)};document.getElementById('manifest-form').requestSubmit()`);
 await prepared();assert.equal(service.transfers.length,0);
 await browser.evaluate("VeraStorage.write({path:'/saves/profile/VERA.INI',bytes:new TextEncoder().encode('[VERA]\\nSkipIntro=yes\\n[Intro]\\nPlay=no\\n'),modified_ms:1})");
 await start();await browser.screenshot('cold-main.png');
 checkpoints.cold=await state();checkpoints.coldTransfers=structuredClone(service.transfers);
 console.log('COLD_GAME_READY');
 const before=service.transfers.length,restoring=Date.now();
 await reload();await prepared();
 checkpoints.restored=await state();checkpoints.restoreMs=Date.now()-restoring;
 assert.equal(checkpoints.restored.url,url);assert.equal(checkpoints.restored.profile,'bootstrap');
 assert.deepEqual(checkpoints.restored.saved,{url,profile:'bootstrap',cache:true});
 assert.equal(checkpoints.restored.playing,false);assert.equal(checkpoints.restored.error,'');
 assert.equal(service.transfers.length,before,'refresh must only read the manifest before Start');
 await browser.screenshot('restored-ready.png');
 await start();await browser.screenshot('hot-main.png');
 assert.equal(service.transfers.length,before,'verified bootstrap and runtime cache must survive refresh');
 checkpoints.hot=await state();checkpoints.hotAdditionalRequests=service.transfers.length-before;
 console.log('HOT_GAME_READY_WITHOUT_REENTERING_URL');
 await browser.click(1115,520);await wait(2500);await browser.click(1115,330);
 await browser.waitFor("!document.getElementById('runtime-panel').hidden",10000);
 await idle();await wait(12000);await browser.screenshot('restored-runtime-movie.png');
 assert(service.transfers.some(row=>row.path==='runtime/movies/RENEGADE.BIK'&&row.status===200&&!row.aborted));
 for(const type of ['keyDown','keyUp'])await browser.call('Input.dispatchKeyEvent',{type,key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
 await wait(2500);await browser.screenshot('restored-runtime-return.png');
 checkpoints.runtimeRestored=true;
 const healthyExceptions=browser.events.filter(e=>e.method==='Runtime.exceptionThrown');assert.deepEqual(healthyExceptions,[]);
 unavailable=true;await reload();
 await browser.waitFor("document.getElementById('feedback').textContent.includes('503')",30000);
 await browser.waitFor("document.getElementById('environment-label').textContent==='浏览器已就绪'",120000);
 checkpoints.unavailable=await state();
 assert.equal(checkpoints.unavailable.startDisabled,true);assert.match(checkpoints.unavailable.feedback,/503/);
 assert.equal(checkpoints.unavailable.url,url);assert.equal(checkpoints.unavailable.saved.url,url);
 await browser.screenshot('manifest-unavailable.png');
 unavailable=false;await browser.evaluate("document.getElementById('manifest-form').requestSubmit()");await prepared();
 checkpoints.retried=await state();assert.equal(checkpoints.retried.url,url);assert.equal(checkpoints.retried.startDisabled,false);
 await browser.screenshot('manifest-retried.png');
 checkpoints.passed=true;
 console.log(JSON.stringify(checkpoints,null,2));
}catch(error){checkpoints.failure=String(error);if(browser)await browser.screenshot('failure.png').catch(()=>{});throw error;}
finally{
 await writeFile(resolve(task,'result.json'),JSON.stringify(checkpoints,null,2));
 await writeFile(resolve(task,'transfers.json'),JSON.stringify({network:service.network,representation:service.representation,transfers:service.transfers},null,2));
 if(browser){await writeFile(resolve(task,'events.json'),JSON.stringify(browser.events,null,2));await browser.close();}
 service.server.closeAllConnections();service.server.close();
}
