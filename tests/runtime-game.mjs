// Optional real-install smoke test, entirely inside an owned headless browser.
import {createInterface} from 'node:readline';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createRuntimeServer} from './serve-runtime.mjs';
import {launchHeadless} from './headless.mjs';
const [assets,runtime]=process.argv.slice(2);
if(!assets||!runtime)throw Error('Usage: node tests/runtime-game.mjs RETAIL_DIRECTORY RUNTIME_FIXTURE_DIRECTORY');
const task=resolve(process.env.VERA_RUNTIME_OUTPUT||'.build/runtime-game');await mkdir(task,{recursive:true});
const service=await createRuntimeServer({assets,runtime,plan:process.env.VERA_RUNTIME_PLAN,site:process.env.VERA_RUNTIME_SITE||undefined,delayMs:Number(process.env.VERA_RUNTIME_DELAY_MS??2000),kilobitsPerSecond:Number(process.env.VERA_RUNTIME_KBPS||0),scope:process.env.VERA_RUNTIME_SCOPE||'runtime',failOnce:process.env.VERA_RUNTIME_FAIL||'',encoding:process.env.VERA_RUNTIME_ENCODING||'identity',encodingCache:process.env.VERA_ENCODING_CACHE||resolve('.build/resource-encoding-cache')});
await new Promise(resolve=>service.server.listen(0,'127.0.0.1',resolve));
const address=`http://127.0.0.1:${service.server.address().port}`;
console.log(JSON.stringify({address,task,network:service.network,...service.representation,runtime:[...Object.keys(service.manifest.runtime.maps),...Object.keys(service.manifest.runtime.movies)]}));
let browser,closed=false;
const close=async()=>{
 if(closed)return;closed=true;
 if(browser){
  await writeFile(resolve(task,'events.json'),JSON.stringify(browser.events,null,2));
  const performance=await browser.evaluate("({timeOrigin:performance.timeOrigin,resources:performance.getEntriesByType('resource').map(({name,encodedBodySize,transferSize,duration,initiatorType})=>({name,encodedBodySize,transferSize,duration,initiatorType}))})").catch(()=>null);
  await writeFile(resolve(task,'page-performance.json'),JSON.stringify(performance,null,2));await browser.close();
 }
 await writeFile(resolve(task,'metrics.json'),JSON.stringify(Object.fromEntries(service.counts),null,2));
 await writeFile(resolve(task,'transfers.json'),JSON.stringify({network:service.network,representation:service.representation,transfers:service.transfers},null,2));
 service.server.closeAllConnections();service.server.close();
};
process.once('SIGINT',()=>{void close().finally(()=>process.exit(130));});
const deadline=setTimeout(()=>{console.error('Test deadline reached');void close().finally(()=>process.exit(1));},10*60*1000);
try{
 browser=await launchHeadless(task,{gpu:true});
 await browser.call('Page.navigate',{url:address});
 await browser.waitFor("typeof document.getElementById('manifest-form')?.onsubmit==='function'");
 await browser.evaluate('performance.setResourceTimingBufferSize(5000)');
 await browser.evaluate(`document.getElementById('cache-resources').checked=${process.env.VERA_RUNTIME_CACHE==='true'};document.getElementById('manifest-url').value=${JSON.stringify(address+'/manifest.json')};document.getElementById('manifest-form').requestSubmit();`);
 const preparing=Date.now();
 while(await browser.evaluate("document.getElementById('start').disabled")){
  const state=await browser.evaluate("({feedback:document.getElementById('feedback').textContent,error:document.getElementById('error-message').textContent,environment:document.getElementById('environment-label').textContent,folder:document.getElementById('folder-name').textContent})");
  console.log(JSON.stringify(state));
  if(state.error||Date.now()-preparing>120000)throw Error('Preparation failed: '+JSON.stringify(state));
  await new Promise(resolve=>setTimeout(resolve,3000));
 }
 await browser.evaluate(`(async()=>{
  const script=document.querySelector('script[src*="launcher.js"]').src;
  window.engine=await import('./pkg/vera20k.js?v='+new URL(script).searchParams.get('v'));
  engine.restore_user_file('/saves/profile/VERA.INI',new TextEncoder().encode('[VERA]\\nSkipIntro=yes\\n[Intro]\\nPlay=no\\n'),0,false);
 })()`);
 const button=await browser.evaluate("(()=>{const r=document.getElementById('start').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()");
 await browser.click(button.x,button.y);
 console.log('Waiting for real engine startup');
 const started=Date.now(),startedPerformance=await browser.evaluate('performance.now()');
 while(!await browser.evaluate("document.body.classList.contains('playing')")){
  const status=await browser.evaluate("({feedback:document.getElementById('feedback').textContent,error:document.getElementById('error-message').textContent,status:document.getElementById('status').textContent})");
  if(status.error)throw Error(JSON.stringify(status));
  if(Date.now()-started>180000)throw Error('Real engine startup deadline: '+JSON.stringify(status));
  console.log(JSON.stringify(status));await new Promise(resolve=>setTimeout(resolve,3000));
 }
 await writeFile(resolve(task,'boot.json'),JSON.stringify({elapsedMs:Date.now()-started,startedPerformance,readyPerformance:await browser.evaluate('performance.now()'),network:service.network,payloadRequests:service.transfers.length,payloadBytes:service.transfers.reduce((n,row)=>n+row.bytes,0)},null,2));
 await browser.screenshot('startup.png');console.log('ENGINE_READY; JSON commands: snapshot, click{x,y}, key{key,code}, eval{expression}, quit');
 const input=createInterface({input:process.stdin,terminal:false});
 for await(const line of input){
  let command;
  try{
   command=JSON.parse(line);
   if(command.action==='quit')break;
   if(command.action==='wait'){if(command.reset)await browser.evaluate(command.reset);await browser.waitFor(command.expression,command.timeoutMs||30000);}
   if(command.action==='checkpoint'){
    const state=await browser.evaluate("({now:performance.now(),remote:document.getElementById('runtime-message').textContent,waiting:!document.getElementById('runtime-panel').hidden,status:document.getElementById('status').textContent})");
    if(!/^[a-zA-Z0-9_.-]+$/.test(command.name))throw Error('Expected a checkpoint name');
    await writeFile(resolve(task,command.name+'.json'),JSON.stringify({state,transfers:service.transfers},null,2));console.log(JSON.stringify({checkpoint:command.name,state}));
   }
   if(command.action==='click')await browser.click(command.x,command.y);
   if(command.action==='key')for(const type of ['keyDown','keyUp'])await browser.call('Input.dispatchKeyEvent',{type,key:command.key,code:command.code||command.key,windowsVirtualKeyCode:command.keyCode||0});
   if(command.action==='eval'){
    const value=await browser.evaluate(command.expression);
    if(command.save){
     if(!/^[a-zA-Z0-9_.-]+\.json$/.test(command.save))throw Error('Expected a JSON filename within the test output');
     await writeFile(resolve(task,command.save),JSON.stringify(value,null,2));
     console.log(JSON.stringify({saved:command.save}));
    }else console.log(JSON.stringify(value));
   }
   if(command.action==='snapshot'){
    const path=await browser.screenshot(command.name||'snapshot.png');
    console.log(JSON.stringify({path,status:await browser.evaluate("({remote:document.getElementById('runtime-message').textContent,waiting:!document.getElementById('runtime-panel').hidden,status:document.getElementById('status').textContent})"),runtimeRequests:Object.fromEntries([...service.counts].filter(([path])=>path.startsWith('runtime/')))}));
   }
  }catch(error){console.error(String(error));if(command?.action==='wait')throw error;}
 }
 input.close();process.stdin.pause();process.stdin.unref?.();
}catch(error){if(browser){await browser.screenshot('failure.png').catch(()=>{});await writeFile(resolve(task,'failure.txt'),String(error));}throw error;}
finally{clearTimeout(deadline);await close();}
