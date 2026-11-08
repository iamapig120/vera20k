// Local, owned headless regression. Supply your own matching resource fixture.
import fs from 'node:fs';
import {createServer} from 'node:http';
import {resolve,join,relative,extname} from 'node:path';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {launchHeadless} from './headless.mjs';
const [siteArg,ossArg,outArg,mode='modern']=process.argv.slice(2);
assert(siteArg&&ossArg&&outArg,'Usage: node tests/toy-release-game.mjs SITE_OR_INPUT OSS_FIXTURE NEW_OUTPUT [modern|legacy|old]');
const siteInput=resolve(siteArg),ossRoot=resolve(ossArg),out=resolve(outArg);
assert(!fs.existsSync(out),'New output directory required');fs.mkdirSync(out,{recursive:true});
const manifest=JSON.parse(fs.readFileSync(join(ossRoot,'manifest.json'))),byUrl=new Map(manifest.files.map(row=>['/'+row.url.slice(2),row]));
const transfers=[],requests=[],rejectedMjs=[];let manifestFailed=false,bootstrapFailed=false;
let siteRoot=siteInput,browser;
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.wasm':'application/wasm','.css':'text/css','.json':'application/json','.png':'image/png'};
function server(folder,prefix,tracking=false){return createServer((req,res)=>{
 const url=new URL(req.url,'http://'+req.headers.host),row=byUrl.get(url.pathname);
 res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Cache-Control','no-store');
 requests.push({url:url.href,referer:req.headers.referer||null,tracking});
 if(tracking&&url.pathname==='/manifest.json'&&mode==='modern'&&!manifestFailed){manifestFailed=true;res.writeHead(503).end('Manifest retry fixture');return;}
 if(tracking&&row?.path==='audiomd.mix'&&mode==='modern'&&!bootstrapFailed){bootstrapFailed=true;res.writeHead(503).end('Bootstrap retry fixture');return;}
 if(url.pathname.endsWith('.mjs')){rejectedMjs.push(url.pathname);res.writeHead(404).end();return;}
 if(!url.pathname.startsWith(prefix)){res.writeHead(404).end();return;}
 let name=decodeURIComponent(url.pathname.slice(prefix.length))||'index.html';
 if(!tracking&&name==='sdk-stub.js'){res.setHeader('Content-Type',mime['.js']);res.end('globalThis.__toyModes=[];globalThis.toy={setContainerMode:async value=>{__toyModes.push(value);},onContainerChange:fn=>{globalThis.__toyResize=fn;return()=>{};}};');return;}
 const base=tracking?folder:siteRoot,file=resolve(base,name),inside=relative(base,file);
 if(inside.startsWith('..')){res.writeHead(403).end();return;}
 try{const stat=fs.statSync(file);assert(stat.isFile());res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');
  if(name==='index.html'&&!tracking){res.end(fs.readFileSync(file,'utf8').replace('https://s1.hdslb.com/bfs/seed/toy/app/sdk/toy-sdk.js','./sdk-stub.js'));return;}
  res.setHeader('Content-Length',stat.size);
  const transfer=row&&tracking?{path:row.path,bytes:0,referer:req.headers.referer||null}:null;if(transfer)transfers.push(transfer);
  const send=()=>{const stream=fs.createReadStream(file);if(transfer)stream.on('data',chunk=>transfer.bytes+=chunk.length);stream.on('error',()=>res.destroy());stream.pipe(res);};
  // Leave actual map/movie loading observable in fullscreen, without changing
  // global network settings or touching the fixture bytes.
  if(tracking&&row?.path.startsWith('runtime/'))setTimeout(send,400);else send();
 }catch{res.writeHead(404).end();}
});}
const oss=server(ossRoot,'/',true),toy=server(siteRoot,'/toy/vera/');
for(const service of [oss,toy])await new Promise(ok=>service.listen(0,'127.0.0.1',ok));
const ossUrl='http://127.0.0.1:'+oss.address().port,toyOrigin='http://127.0.0.1:'+toy.address().port,toyUrl=toyOrigin+'/toy/vera/index.html';
const result={mode,ossUrl,toyUrl,muted:true,headless:true},wait=ms=>new Promise(ok=>setTimeout(ok,ms));
async function clickId(id){const p=await browser.evaluate(`(()=>{const r=document.getElementById(${JSON.stringify(id)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);await browser.click(p.x,p.y);}
async function idle(){await browser.evaluate('globalThis.__idle=0');await browser.waitFor("(()=>{if(!document.getElementById('runtime-panel').hidden){__idle=0;return false;}__idle ||= performance.now();return performance.now()-__idle>2500;})()",180000);}
async function start(){await clickId('start');
 if(mode==='modern'&&!result.bootstrapRetry){await browser.waitFor("document.getElementById('feedback').textContent.includes('503')",30000);await browser.screenshot('bootstrap-error-fullscreen.png');await clickId('retry-import');result.bootstrapRetry=true;}
 await browser.waitFor("document.body.classList.contains('playing')",180000);await idle();
}
try{
 if(mode!=='old'){
  siteRoot=join(out,'site');
  execFileSync(process.execPath,['tools/toy-build/build.cjs',siteInput,siteRoot,join(out,'metafile.json')],{env:{...process.env,VERA_TOY_MANIFEST_URL:ossUrl+'/manifest.json'},windowsHide:true});
 }
 browser=await launchHeadless(join(out,'browser'),{gpu:true});
 await browser.call('Page.addScriptToEvaluateOnNewDocument',{source:"globalThis.__fullscreenEvents=[];document.addEventListener('fullscreenchange',()=>__fullscreenEvents.push({event:'change',tag:document.fullscreenElement?.tagName,id:document.fullscreenElement?.id}));const request=Element.prototype.requestFullscreen;Element.prototype.requestFullscreen=function(...args){__fullscreenEvents.push({event:'request',tag:this.tagName,id:this.id});return request.apply(this,args).then(value=>{__fullscreenEvents.push({event:'accepted'});return value;},error=>{__fullscreenEvents.push({event:'rejected',message:String(error)});throw error;});};"});
 if(mode!=='modern')await browser.call('Page.addScriptToEvaluateOnNewDocument',{source:"globalThis.__removedAdapterInfo=typeof GPUAdapter==='function'&&delete GPUAdapter.prototype.info;"});
 await browser.call('Page.navigate',{url:toyUrl});
 if(mode==='old'){
  await browser.waitFor("typeof document.getElementById('manifest-form')?.onsubmit==='function'");
  await browser.evaluate(`document.getElementById('manifest-url').value=${JSON.stringify(ossUrl+'/manifest.json')};document.getElementById('manifest-form').requestSubmit()`);
 }else if(mode==='modern'){
  await browser.waitFor("document.getElementById('feedback').textContent.includes('503')");
  await clickId('retry-import');result.manifestRetry=true;
 }
 await browser.waitFor("!document.getElementById('start').disabled",120000);
 if(mode!=='old'){
  result.hiddenControls=await browser.evaluate("document.getElementById('manifest-form').hidden&&document.getElementById('cache-resources').closest('label').hidden&&document.getElementById('cache-resources').checked");assert(result.hiddenControls);
 }
 await browser.evaluate("VeraStorage.write({path:'/saves/profile/VERA.INI',bytes:new TextEncoder().encode('[VERA]\\nSkipIntro=yes\\n[Intro]\\nPlay=no\\n'),modified_ms:1})");
 if(mode==='old'){
  await clickId('start');await browser.waitFor("document.getElementById('error-message').textContent.includes('description')",180000);
  result.reproducedDescriptionCrash=true;await browser.screenshot('description-crash.png');
 }else{
  await start();await browser.screenshot('cold-main.png');
  result.fullscreenEvents=await browser.evaluate('globalThis.__fullscreenEvents');
  result.fullscreenElement=await browser.evaluate('document.fullscreenElement?.tagName||null');
  result.fullscreenRoot=await browser.evaluate('document.fullscreenElement===document.documentElement');
  if(!result.fullscreenRoot){assert(result.fullscreenEvents.some(e=>e.event==='request'&&e.tag==='HTML'));assert(result.fullscreenEvents.some(e=>e.event==='rejected'));result.nativeFullscreenDenied=true;}
  result.toyModes=await browser.evaluate('globalThis.__toyModes');assert(result.toyModes.some(x=>x.orientation==='landscape'&&x.immersive));
  result.renderer=browser.events.filter(e=>e.method==='Runtime.consoleAPICalled').flatMap(e=>e.params.args.map(a=>a.value||a.description||'')).filter(s=>/Using GPU adapter|WebGL2 fallback/.test(s));
  if(mode==='legacy')assert(result.renderer.some(s=>s.includes('WebGL2 fallback')));
  const visible=await browser.evaluate('document.body.innerText');assert(!visible.includes('bootstrap'));assert(!visible.includes('冻结 AI'));
  result.coldMenu={requests:transfers.length,bytes:transfers.reduce((n,r)=>n+r.bytes,0)};
  if(mode==='modern'){
   await browser.click(1115,584);await wait(2000);await browser.screenshot('settings.png');await browser.click(1115,835);await wait(1500);
   await browser.click(1115,330);await wait(1500);await browser.click(1115,456);await wait(1500);await browser.screenshot('skirmish.png');await browser.click(1115,835);await wait(1200);await browser.click(1115,835);await wait(1500);
   await browser.click(1115,330);await wait(1500);await browser.click(1115,330);await wait(1500);await browser.click(510,200);
   await browser.waitFor("!document.getElementById('runtime-panel').hidden",60000);
   result.runtimeOverlayInRequestedRoot=await browser.evaluate("(document.fullscreenElement||document.documentElement).contains(document.getElementById('runtime-panel'))&&getComputedStyle(document.getElementById('runtime-panel')).display!=='none'");assert(result.runtimeOverlayInRequestedRoot);
   await browser.screenshot('runtime-fullscreen-progress.png');await idle();await wait(6000);await browser.screenshot('campaign-movie-subtitles.png');
   for(const type of ['keyDown','keyUp'])await browser.call('Input.dispatchKeyEvent',{type,key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
   await idle();await wait(15000);await browser.screenshot('campaign-battlefield.png');
   const before=transfers.length;await browser.call('Page.reload',{ignoreCache:true});await browser.waitFor("!document.getElementById('start').disabled",120000);await start();assert.equal(transfers.length,before);result.hotMenuAdditionalRequests=0;
  }
  result.exceptions=browser.events.filter(e=>e.method==='Runtime.exceptionThrown');assert.deepEqual(result.exceptions,[]);assert.deepEqual(rejectedMjs,[]);
  const cross=requests.filter(r=>r.tracking);result.referrers=cross.map(r=>r.referer);assert(cross.length>0);assert(cross.every(r=>r.referer===toyOrigin+'/'));
 }
 result.passed=true;console.log(JSON.stringify({...result,referrers:result.referrers?.slice(0,3)},null,2));
}catch(error){result.error=String(error);await browser?.screenshot('failure.png').catch(()=>{});throw error;}
finally{
 fs.writeFileSync(join(out,'result.json'),JSON.stringify(result,null,2));fs.writeFileSync(join(out,'transfers.json'),JSON.stringify(transfers,null,2));
 if(browser){fs.writeFileSync(join(out,'events.json'),JSON.stringify(browser.events,null,2));await browser.close();}
 for(const service of [toy,oss]){service.closeAllConnections();service.close();}
}
