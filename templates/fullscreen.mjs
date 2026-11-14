// Binding resolution stays in the engine; this owner only uses the browser API.
export function installFullscreen(document, root, button, reportError) {
 let pending=false, wasActive=false, lockVersion=0;
 const view=document.defaultView;
 const keyboard=view?.navigator?.keyboard;
 // Keyboard Lock requires a top-level browsing context. Fullscreen permission
 // on an iframe does not grant Keyboard Lock permission.
 const isTopLevel=()=>{try{return !!view&&view.top===view;}catch{return false;}};
 const sync=()=>{
  const active=document.fullscreenElement===root;
  button.textContent=active?'退出全屏':'全屏';
  button.setAttribute('aria-pressed',String(active));
  button.disabled=pending;
  if(active||wasActive)root.querySelector('canvas')?.focus({preventScroll:true});
  wasActive=active;
 };
 const syncKeyboard=async()=>{
  const version=++lockVersion;
  if(document.fullscreenElement!==root){
   if(isTopLevel())try{keyboard?.unlock?.();}catch{}
   button.setAttribute('data-esc-lock','inactive');reportError('');return;
  }
  reportError('若 Esc 先退出全屏，可再按一次 Esc 操作游戏。');
  if(!isTopLevel()){
   button.setAttribute('data-esc-lock','embedded');
   reportError('嵌入页面无法使用键盘锁；若 Esc 退出全屏，请再按一次操作游戏。');
   return;
  }
  if(!keyboard?.lock){button.setAttribute('data-esc-lock','unsupported');return;}
  button.setAttribute('data-esc-lock','pending');
  try{
   // Lock only Escape; the browser keeps its long-press escape hatch.
   await keyboard.lock(['Escape']);
   if(version===lockVersion&&document.fullscreenElement===root){
    button.setAttribute('data-esc-lock','granted');
    reportError('');
   }
  }catch(error){
   if(version===lockVersion&&document.fullscreenElement===root){
    button.setAttribute('data-esc-lock','rejected');
    reportError(`Esc 锁定未获准（${error.name||'Error'}：${error.message||'浏览器拒绝'}）；若先退出全屏，可再按一次 Esc 操作游戏。`);
   }
  } // Unsupported or refused locking must not prevent gameplay.
 };
 const toggle=async()=>{
  if(pending)return;
  pending=true;reportError('');sync();
  try{
   if(document.fullscreenElement)await document.exitFullscreen();
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
 button.onclick=toggle;
 sync();
 return toggle;
}
