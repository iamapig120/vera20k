import init, {import_file, prepare_audio, restore_user_file, start_game} from './pkg/vera20k.js?v=be8968ec612d99cfe20630faad3476cb11dccfd1';
import {entriesFromFolder,entriesFromDrop,entriesFromZip,downloadZip,libraryFromEntries} from './resources.mjs?v=be8968ec612d99cfe20630faad3476cb11dccfd1';
const $=id=>document.getElementById(id);
const status=$('status'), button=$('start'), files=$('files');
const gatewayInput=$('gateway-address'), gatewayStatus=$('gateway-status');
const gatewayKey='vera20k.gateway-origin';
function gatewayBase(){
 const value=gatewayInput.value.trim();
 if(!value)return '';
 if(!/^(https?|wss?):\/\/[^/?#\\]+\/?$/i.test(value))throw Error('联机配置错误：请填写 http(s) 网关地址，只包含协议、主机和端口。');
 let url;
 try{url=new URL(value);}catch{throw Error('联机配置错误：网关地址无效。');}
 if(url.username||url.password||value.includes('@'))throw Error('联机配置错误：网关地址不能包含用户名或密码。');
 if(url.protocol==='ws:')url.protocol='http:';
 if(url.protocol==='wss:')url.protocol='https:';
 return url.origin;
}
function updateGateway(persist=false){
 try{
  const base=gatewayBase();
  gatewayStatus.textContent=base?`配置使用 ${base}（不影响单机）`:'本站未部署联机网关；单机不受影响。可另行配置已有网关。';
  if(persist)try{globalThis.localStorage?.setItem(gatewayKey,base);}catch{}
 }catch(error){gatewayStatus.textContent=error.message;}
}
try{gatewayInput.value=globalThis.localStorage?.getItem(gatewayKey)||'';}catch{gatewayInput.value='';}
gatewayInput.oninput=()=>updateGateway(true);
globalThis.veraGatewayBase=gatewayBase;
updateGateway();

let selectionRevision=0, restoreRevision=0, engineLoading=false;
let ready=false, busy=false, failed=false, selecting=false, selected=[];
let importController,lastImport;
const store=globalThis.VeraStorage;
let storageAvailable=false, cachedSelection=false, saving=false;
const pending=new Map();
window.addEventListener('beforeunload',event=>{if(pending.size){event.preventDefault();event.returnValue='';}});
function storageStatus(message,error=false){$('storage-status').textContent=message;$('storage-status').classList.toggle('error',error);if(error)$('storage-panel').open=true;}
const userPath=path=>typeof path==='string'&&(path==='/config.toml'||/^\/(retail|saves)\/.+/.test(path))&&!path.split('/').some(part=>part==='..'||part==='.');
async function flushUserData(){
 if(saving||!storageAvailable)return;
 saving=true;storageStatus('正在保存到本机…');
 try{
  while(pending.size){
   const [path,row]=pending.entries().next().value;
   if(row)await store.write(row);else await store.remove(path);
   if(pending.get(path)===row)pending.delete(path);
  }
  $('retry-storage').hidden=true;storageStatus('本机数据已保存');
 }catch(error){storageStatus(`保存失败：${error.message}。请重试或导出备份。`,true);$('retry-storage').hidden=false;}
 finally{saving=false;}
}
globalThis.vera20kPersistWrite=(path,bytes,modified_ms)=>{
 if(!userPath(path))return;
 // wasm-bindgen lends a view into Wasm memory only for this call.
 pending.set(path,{path,bytes:bytes.slice(),modified_ms});void flushUserData();
};
globalThis.vera20kPersistRemove=path=>{if(userPath(path)){pending.set(path,null);void flushUserData();}};
$('export-data').onclick=async()=>{
 try{
  const rows=new Map((storageAvailable?await store.users():[]).map(row=>[row.path,row]));
  for(const [path,row] of pending){if(row)rows.set(path,row);else rows.set(path,{path,bytes:new Uint8Array(),modified_ms:Date.now(),deleted:true});}
  const data={format:'vera20k-web-user-data',version:1,files:[...rows.values()].map(row=>({...row,bytes:Array.from(row.bytes)}))};
  const url=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download='vera20k-backup.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }catch(error){storageStatus(`导出失败：${error.message}`,true);}
};
$('import-data').onclick=()=>{$('backup-file').value='';$('backup-file').click();};
$('backup-file').onchange=async()=>{
 const file=$('backup-file').files[0];if(!file)return;
 try{
  if(file.size>128*1024**2)throw Error('备份文件过大');
  const data=JSON.parse(await file.text());
  if(data.format!=='vera20k-web-user-data'||data.version!==1||!Array.isArray(data.files))throw Error('备份格式不受支持');
  const paths=new Set();
  const rows=data.files.map(row=>{
   if((row.deleted!==undefined&&typeof row.deleted!=='boolean')||!userPath(row.path)||paths.has(row.path)||!Number.isSafeInteger(row.modified_ms)||row.modified_ms<0||!Array.isArray(row.bytes)||!row.bytes.every(byte=>Number.isInteger(byte)&&byte>=0&&byte<=255))throw Error('备份含有无效数据');
   paths.add(row.path);return {...row,bytes:Uint8Array.from(row.bytes)};
  });
  await store.importUsers(rows);
  storageStatus('备份已导入，下次启动游戏时生效');
 }catch(error){storageStatus(`导入失败：${error.message}`,true);}
};
const droppedPaths=new WeakMap();
const relativePath=file=>droppedPaths.get(file) ?? (file.webkitRelativePath ? file.webkitRelativePath.split('/').slice(1).join('/') : file.name);
const sizeLabel=bytes=>bytes>=1024**3 ? `${(bytes/1024**3).toFixed(1)} GB` : `${Math.max(1,Math.round(bytes/1024**2))} MB`;
function syncButton(){
 button.disabled=!ready||busy||failed||selecting||!selected.length;
 $('start-label').textContent=busy?'正在进入战场…':!ready?'正在准备游戏…':'开始游戏';
 $('choose-folder').disabled=busy||failed||selecting;
 $('change-folder').disabled=busy||failed||selecting;
 for(const id of ['choose-zip','zip-url','download-zip','cache-resources','clear-cache','retry-cache'])$(id).disabled=busy||failed||selecting||document.body.classList.contains('playing');
 $('retry-import').hidden=!lastImport||busy||failed||selecting;
 $('import-data').disabled=busy||selecting||document.body.classList.contains('playing')||!storageAvailable;
}
function feedback(message,error=false){$('feedback').textContent=message;$('feedback').classList.toggle('error',error);}
function fail(message,detail=message){
 if(failed)return;
 failed=true;busy=false;document.body.classList.remove('playing');
 feedback(message,true);$('error-message').textContent=detail;$('error-details').hidden=false;$('retry').hidden=false;
 $('button-caption').textContent='重新加载后可以再次选择目录';syncButton();
}
function progress(value,detail){
 const percent=Math.max(0,Math.min(100,Math.round(value)));
 $('progress-area').hidden=false;$('progress-fill').style.width=`${percent}%`;
 $('progress').setAttribute('aria-valuenow',String(percent));$('progress-percent').textContent=`${percent}%`;$('progress-detail').textContent=detail;
}
function enterGame(){
 if(failed)return;
 busy=false;document.body.classList.add('playing');
 const canvas=$('game').querySelector('canvas');if(canvas)canvas.focus({preventScroll:true});
}
new MutationObserver(()=>{
 const message=status.textContent||'';
 if(message.startsWith('已启动'))enterGame();
 else if(/^(启动失败|资源加载失败|运行错误)/.test(message))fail('游戏未能正常启动，请检查游戏资源后重试。',message);
}).observe(status,{childList:true,characterData:true,subtree:true});
window.addEventListener('error',event=>{if(busy||document.body.classList.contains('playing'))fail('游戏运行出错，请查看错误详情。',event.message||String(event.error));});
window.addEventListener('unhandledrejection',event=>{if(busy||document.body.classList.contains('playing'))fail('游戏运行出错，请查看错误详情。',String(event.reason));});
$('retry').onclick=()=>{if(!ready){failed=false;$('retry').hidden=true;$('error-details').hidden=true;void prepareEngine();}else location.reload();};
function selectResources(chosen,folderName){
 selectionRevision++;
 const keep=chosen;
 const rootNames=new Set(keep.filter(file=>!relativePath(file).includes('/')).map(file=>file.name.toLowerCase()));
 if(!rootNames.has('ra2.mix')||!rootNames.has('ra2md.mix'))throw Error('请选择完整尤里的复仇资源；旧选择保留');
 selected=keep;cachedSelection=false;
 $('folder-name').textContent=folderName;
 $('folder-meta').textContent=`${selected.length} 个资源文件 · ${sizeLabel(selected.reduce((sum,file)=>sum+file.size,0))}`;
 $('choose-folder').hidden=true;$('folder-selected').hidden=false;
 $('button-caption').textContent='首次读取可能需要一些时间，请保持页面打开';
 feedback(ready?'资源已就绪，点击「开始游戏」。':'游戏目录已选好，正在准备网页引擎，请稍候…');syncButton();
}
function resourceFiles(library){
 return library.files.map(entry=>{
  const file=entry.blob instanceof File?entry.blob:new File([entry.blob],entry.path.split('/').at(-1),{type:entry.blob.type,lastModified:0});
  droppedPaths.set(file,entry.path);return file;
 });
}
async function saveSelection(chosen,label){
 await store.saveLibrary(label,chosen.map(file=>({path:relativePath(file),file})));
 cachedSelection=true;$('retry-cache').hidden=true;storageStatus('资源已缓存；设置与存档独立保留');
}
function resourceProgress(value){
 const detail=value.phase+(value.file?' · '+value.file:` · ${sizeLabel(value.loaded)}${value.total?' / '+sizeLabel(value.total):''}`);
 progress(value.total?value.loaded/value.total*100:0,detail);feedback(detail);
}
async function importResources(read,label){
 if(selecting||busy||failed||document.body.classList.contains('playing'))return;
 const controller=new AbortController();importController=controller;
 lastImport=()=>importResources(read,label);selectionRevision++;selecting=true;
 $('cancel-import').hidden=false;$('cancel-import').disabled=false;$('retry-cache').hidden=true;syncButton();
 try{
  const entries=await read({signal:controller.signal,onProgress:resourceProgress});controller.signal.throwIfAborted();
  const candidate=libraryFromEntries(entries,label),chosen=resourceFiles(candidate);controller.signal.throwIfAborted();
  let cached=false,cacheError;
  if($('cache-resources').checked){
   $('cancel-import').disabled=true;feedback('资源校验完成，正在原子保存缓存…');
   try{await saveSelection(chosen,candidate.label);cached=true;}catch(error){cacheError=error;}
  }
  selectResources(chosen,candidate.label);cachedSelection=cached;lastImport=undefined;
  if(cacheError){storageStatus(`缓存失败：${cacheError.message}。旧缓存保留，当前资源仍可启动。`,true);$('retry-cache').hidden=false;}
  else if(!cached)storageStatus('本次不缓存资源；旧缓存与用户数据保留');
 }catch(error){feedback(controller.signal.aborted?'已取消；旧资源、缓存和用户数据保留。':`${error.message}；旧资源、缓存和用户数据保留。`,!controller.signal.aborted);}
 finally{if(importController===controller){importController=undefined;selecting=false;$('cancel-import').hidden=true;$('progress-area').hidden=true;syncButton();}}
}
files.onchange=()=>{
 const chosen=[...files.files];if(!chosen.length)return;
 void importResources(options=>entriesFromFolder(chosen,options),chosen[0].webkitRelativePath.split('/')[0]||'本地资源');
};
function chooseFolder(){files.value='';files.click();}
$('choose-folder').onclick=chooseFolder;$('change-folder').onclick=chooseFolder;
$('choose-zip').onclick=()=>{$('zip-file').value='';$('zip-file').click();};
function importZip(file){return importResources(options=>entriesFromZip(file,options),file.name||'本地 ZIP');}
$('zip-file').onchange=()=>{const file=$('zip-file').files[0];if(file)void importZip(file);};
$('zip-form').onsubmit=event=>{
 event.preventDefault();const url=$('zip-url').value.trim();let label='远程 ZIP';
 try{label='ZIP · '+new URL(url).hostname;}catch{}
 void importResources(async options=>entriesFromZip(await downloadZip(url,options),options),label);
};
$('cancel-import').onclick=()=>importController?.abort();
$('retry-import').onclick=()=>{if(lastImport)void lastImport();};
$('retry-cache').onclick=async()=>{
 if(selecting||busy||failed||!selected.length)return;
 selecting=true;syncButton();
 try{await saveSelection(selected,$('folder-name').textContent);}catch(error){storageStatus(`缓存失败：${error.message}；旧缓存保留。`,true);}
 finally{selecting=false;syncButton();}
};
const dropZone=$('drop-zone');let dragDepth=0;
for(const type of ['dragenter','dragover','dragleave','drop'])document.addEventListener(type,event=>event.preventDefault());
dropZone.addEventListener('dragenter',()=>{if(!busy&&!failed&&!selecting){dragDepth++;dropZone.classList.add('dragging');}});
dropZone.addEventListener('dragleave',()=>{dragDepth=Math.max(0,dragDepth-1);if(!dragDepth)dropZone.classList.remove('dragging');});
dropZone.addEventListener('drop',event=>{
 dragDepth=0;dropZone.classList.remove('dragging');if(busy||failed||selecting)return;
 const items=[...event.dataTransfer.items].filter(item=>item.kind==='file'),file=items.length===1&&items[0].getAsFile();
 if(file&&/\.zip$/i.test(file.name)){void importZip(file);return;}
 void importResources(options=>entriesFromDrop(items,options),'拖入的游戏资源');
});
button.onclick=async()=>{
 if(button.disabled)return;
 busy=true;syncButton();feedback('正在读取游戏资源，请保持页面打开。');
 let loaded=0;const total=selected.reduce((sum,file)=>sum+file.size,0);
 try{
  prepare_audio();
  for(const file of selected){
   progress(loaded/total*90,`正在读取 ${file.name}`);
   import_file(relativePath(file),new Uint8Array(await file.arrayBuffer()));loaded+=file.size;
   await new Promise(resolve=>setTimeout(resolve,0));
  }
  progress(95,'正在准备战场…');feedback('游戏即将启动。');
  // Engine readiness and resource caching are independent of user data. Never
  // start from retail defaults while the durable settings database is opening.
  progress(95,'正在恢复设置与存档…');
  await store.open();storageAvailable=true;
  for(const row of await store.users())restore_user_file(row.path,row.bytes,row.modified_ms,!!row.deleted);
  $('import-data').disabled=true;
  start_game();
 }catch(error){fail('读取或启动失败，请重新加载后再试。',String(error));}
};

async function engineBytes(){
 const controller=new AbortController();
 let timer;
 const arm=()=>{clearTimeout(timer);timer=setTimeout(()=>controller.abort(),30000);};
 arm();
 try{
  const response=await fetch(new URL('./pkg/vera20k_bg.wasm?v=be8968ec612d99cfe20630faad3476cb11dccfd1',import.meta.url),{signal:controller.signal});
  if(!response.ok)throw Error(`下载引擎失败（HTTP ${response.status}）`);
  const encoding=response.headers.get('Content-Encoding');
  const total=encoding&&encoding!=='identity'?0:Number(response.headers.get('Content-Length'));
  const reader=response.body.getReader(),chunks=[];let loaded=0;
  for(;;){
   const {done,value}=await reader.read();if(done)break;
   chunks.push(value);loaded+=value.length;arm();
   const detail=`正在下载游戏引擎… ${(loaded/1024**2).toFixed(1)} MB${total?' / '+(total/1024**2).toFixed(1)+' MB':''}`;
   if(!selecting){feedback(detail);if(total)progress(loaded/total*100,detail);}
  }
  const bytes=new Uint8Array(loaded);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return bytes;
 }catch(error){if(error.name==='AbortError')throw Error('下载引擎连续 30 秒没有响应，请检查网络并重试');throw error;}
 finally{clearTimeout(timer);}
}
async function prepareEngine(){
 if(engineLoading)return;engineLoading=true;syncButton();
 const started=Date.now();let compiling=false;
 const timer=setInterval(()=>{if(compiling&&!selecting)feedback(`正在准备游戏引擎… 已等待 ${Math.floor((Date.now()-started)/1000)} 秒，较慢的设备可能需要更长时间。`);},8000);
 try{
  if(!navigator.gpu)throw Error('当前浏览器不支持 WebGPU，请使用支持 WebGPU 的新版桌面浏览器。');
  feedback('正在下载游戏引擎… 可以先选择游戏目录。');
  const bytes=await engineBytes();
  compiling=true;feedback('正在准备游戏引擎…');$('progress-area').hidden=true;
  await init({module_or_path:bytes});
  ready=true;failed=false;
  $('environment').className='environment ready';$('environment-label').textContent='浏览器已就绪';
  if(!selecting)feedback(selected.length?'资源已就绪，点击「开始游戏」。':'请选择游戏目录；如果正在恢复缓存，也可以稍候。');
 }catch(error){
  $('environment').className='environment error';$('environment-label').textContent='引擎准备失败';
  fail('游戏引擎未能准备好，请查看详情并重试。',String(error));
  $('retry').textContent='重试准备引擎';
 }finally{clearInterval(timer);engineLoading=false;syncButton();}
}
async function restoreStorage(){
 const revision=++restoreRevision,selection=selectionRevision,started=Date.now();
 storageStatus('正在打开本机存储…');
 try{
  await store.open();storageAvailable=true;syncButton();
  storageStatus('正在恢复上次的游戏资源…');
  const library=await store.library();
  if(revision!==restoreRevision)return;
  if(selection===selectionRevision&&!busy&&library?.files?.length){
   const checked=libraryFromEntries(library.files.map(entry=>({path:entry.path,blob:entry.file})),library.folder);
   selectResources(resourceFiles(checked),checked.label);
   cachedSelection=selected.length>0;
  }
  storageStatus(cachedSelection?'已恢复上次资源 · 本机数据就绪':'本机数据就绪 · 设置将自动保存');
  $('retry-storage').hidden=true;
 }catch(error){
  if(revision!==restoreRevision)return;
  storageStatus(`本机数据读取失败（${Math.round((Date.now()-started)/1000)} 秒）：${error.message}。可重新选择目录继续。`,true);
  $('retry-storage').hidden=false;
 }finally{$('export-data').disabled=false;syncButton();}
}
$('retry-storage').onclick=async()=>{await restoreStorage();await flushUserData();};
$('clear-cache').onclick=async()=>{
 try{++restoreRevision;await store.clearLibrary();cachedSelection=false;storageStatus('资源缓存已清除，设置与存档已保留');}
 catch(error){storageStatus(`清除缓存失败：${error.message}`,true);}
};
void restoreStorage();void prepareEngine();
