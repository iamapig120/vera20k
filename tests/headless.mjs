import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

export async function launchHeadless(task,{gpu=false}={}){
 await mkdir(task,{recursive:true});const profile=resolve(task,`profile-${Date.now()}`);await mkdir(profile);
 await writeFile(resolve(task,'driver-pid.txt'),String(process.pid));
 let stderr='',socket,browserSocket,closed=false;
 const browser=spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',[
  '--headless=new','--guest','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-sync','--disable-breakpad',
  '--disable-crash-reporter','--mute-audio',...(gpu?['--enable-unsafe-webgpu']:['--disable-gpu']),'--enable-logging',`--log-file=${resolve(profile,'edge.log')}`,
  '--remote-debugging-port=0',`--user-data-dir=${profile}`,`--disk-cache-dir=${resolve(profile,'cache')}`,`--crash-dumps-dir=${resolve(profile,'crashes')}`,'about:blank'
 ],{windowsHide:true,env:{...process.env,TEMP:task,TMP:task},stdio:['ignore','pipe','pipe']});
 browser.stderr.on('data',chunk=>stderr+=chunk);browser.on('error',error=>stderr+=String(error));
 const bounded=(promise,ms=10000)=>{
  let timer;return Promise.race([promise,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('Headless operation timed out')),ms))]).finally(()=>clearTimeout(timer));
 };
 async function connect(url){
  const ws=new WebSocket(url);
  try{await bounded(new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;ws.onclose=()=>reject(Error('Headless connection closed'));}));}
  catch(error){ws.close();throw error;}
  return ws;
 }
 const close=async()=>{
  if(closed)return;closed=true;
  if(browserSocket?.readyState===WebSocket.OPEN){browserSocket.send(JSON.stringify({id:9999,method:'Browser.close'}));await bounded(new Promise(resolve=>browserSocket.onclose=resolve),3000).catch(()=>{});}
  socket?.close();browserSocket?.close();browser.kill();await writeFile(resolve(task,'browser-stderr.log'),stderr);
 };
 try{
  let port,path;
  for(let attempt=0;attempt<150;attempt++){
   try{[port,path]=(await readFile(resolve(profile,'DevToolsActivePort'),'utf8')).trim().split(/\r?\n/);break;}catch{}
   if(browser.exitCode!==null&&browser.exitCode!==0)throw Error('Headless browser exited: '+stderr.slice(-1000));
   await new Promise(resolve=>setTimeout(resolve,100));
  }
  if(!port)throw Error('No headless debug endpoint');
  browserSocket=await connect(`ws://127.0.0.1:${port}${path}`);
  const pages=await(await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(10000)})).json();
  socket=await connect(pages.find(page=>page.type==='page').webSocketDebuggerUrl);
  let sequence=0;const pending=new Map(),events=[];
  socket.onmessage=event=>{
   const row=JSON.parse(event.data);
   if(row.id){const request=pending.get(row.id);pending.delete(row.id);if(request)row.error?request.reject(Error(JSON.stringify(row.error))):request.resolve(row.result);}
   else events.push(row);
  };
  socket.onclose=()=>{for(const request of pending.values())request.reject(Error('Headless browser disconnected'));pending.clear();};
  const call=(method,params={})=>bounded(new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));}),30000);
  await call('Page.enable');await call('Runtime.enable');await call('Log.enable');
  await call('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  await call('Emulation.setFocusEmulationEnabled',{enabled:true});
  const evaluate=async(expression,{awaitPromise=true}={})=>{
   const value=await call('Runtime.evaluate',{expression,awaitPromise,returnByValue:true,userGesture:true});
   if(value.exceptionDetails)throw Error(JSON.stringify(value.exceptionDetails));return value.result.value;
  };
  const waitFor=async(expression,ms=30000)=>{
   const started=Date.now();for(;;){if(await evaluate(expression))return;if(Date.now()-started>ms)throw Error(`Wait timed out: ${expression}`);await new Promise(resolve=>setTimeout(resolve,250));}
  };
  return {call,evaluate,waitFor,events,profile,close,
   async screenshot(name){const result=await call('Page.captureScreenshot',{format:'png'});const path=resolve(task,name);await writeFile(path,Buffer.from(result.data,'base64'));return path;},
   async click(x,y){for(const type of ['mousePressed','mouseReleased'])await call('Input.dispatchMouseEvent',{type,x,y,button:'left',clickCount:1});}
  };
 }catch(error){await close();throw error;}
}
