// Binding resolution stays in the engine; this owner only uses the browser API.
export function installFullscreen(document, root, status, reportError) {
 let pending=false, wasActive=false, lockVersion=0;
 const view=document.defaultView;
 const keyboard=view?.navigator?.keyboard;
 // Keyboard Lock requires a top-level browsing context. Fullscreen permission
 // on an iframe does not grant Keyboard Lock permission.
 const isTopLevel=()=>{try{return !!view&&view.top===view;}catch{return false;}};
 let battlefieldAvailable=false;
 const sync=()=>{
  const active=document.fullscreenElement===root;
  status.setAttribute('data-fullscreen',String(active));
  status.setAttribute('data-fullscreen-pending',String(pending));
  if(active||wasActive)root.querySelector('canvas')?.focus({preventScroll:true});
  wasActive=active;
 };
 const syncKeyboard=async()=>{
  const version=++lockVersion;
  if(document.fullscreenElement!==root){
   if(isTopLevel())try{keyboard?.unlock?.();}catch{}
   status.setAttribute('data-esc-lock','inactive');reportError('');return;
  }
  reportError('若 Esc 先退出全屏，可再按一次 Esc 操作游戏。');
  if(!isTopLevel()){
   status.setAttribute('data-esc-lock','embedded');
   reportError('嵌入页面无法使用键盘锁；若 Esc 退出全屏，请再按一次操作游戏。');
   return;
  }
  if(!keyboard?.lock){status.setAttribute('data-esc-lock','unsupported');return;}
  status.setAttribute('data-esc-lock','pending');
  try{
   // Lock only Escape; the browser keeps its long-press escape hatch.
   await keyboard.lock(['Escape']);
   if(version===lockVersion&&document.fullscreenElement===root){
    status.setAttribute('data-esc-lock','granted');
    reportError('');
   }
  }catch(error){
   if(version===lockVersion&&document.fullscreenElement===root){
    status.setAttribute('data-esc-lock','rejected');
    reportError(`Esc 锁定未获准（${error.name||'Error'}：${error.message||'浏览器拒绝'}）；若先退出全屏，可再按一次 Esc 操作游戏。`);
   }
  } // Unsupported or refused locking must not prevent gameplay.
 };
 const toggle=async intent=>{
  if(pending||(intent==='battlefield'&&!battlefieldAvailable))return;
  const before=Boolean(document.fullscreenElement);
  const desired=typeof intent==='boolean'?intent:!before;
  if(desired===before)return;
  pending=true;reportError('');sync();
  try{
   if(!desired)await document.exitFullscreen();
   else{
    if(!root.requestFullscreen)throw Error('浏览器不支持 Fullscreen API，请使用浏览器的全屏功能。');
    await root.requestFullscreen({keyboardLock:'browser'});
   }
  }catch(error){reportError(`无法切换全屏：${error.message}`);}
  finally{pending=false;sync();}
 };
 document.addEventListener('fullscreenchange',()=>{sync();void syncKeyboard();});
 document.addEventListener('keydown',event=>{
  // Do not stop propagation: winit still needs Escape down/up to skip movies.
  if(document.fullscreenElement===root&&event.key==='Escape')event.preventDefault();
 });
 sync();
 toggle.setBattlefieldAvailable=available=>{
  battlefieldAvailable=available;
 };
 return toggle;
}
