// Binding resolution stays in the engine; this owner only uses the browser API.
export function installFullscreen(document, root, button, reportError) {
 let pending=false, wasActive=false;
 const sync=()=>{
  const active=document.fullscreenElement===root;
  button.textContent=active?'退出全屏':'全屏';
  button.setAttribute('aria-pressed',String(active));
  button.disabled=pending;
  if(active||wasActive)root.querySelector('canvas')?.focus({preventScroll:true});
  wasActive=active;
 };
 const toggle=async()=>{
  if(pending)return;
  pending=true;sync();
  try{
   if(document.fullscreenElement)await document.exitFullscreen();
   else{
    if(!root.requestFullscreen)throw Error('浏览器不支持 Fullscreen API，请使用浏览器的全屏功能。');
    await root.requestFullscreen();
   }
   reportError('');
  }catch(error){reportError(`无法切换全屏：${error.message}`);}
  finally{pending=false;sync();}
 };
 document.addEventListener('fullscreenchange',sync);
 button.onclick=toggle;
 sync();
 return toggle;
}
