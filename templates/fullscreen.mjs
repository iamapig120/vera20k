// Binding resolution stays in the engine; this owner only uses the browser API.
export function installFullscreen(document, root, status, reportError) {
 let pending=false, wasActive=false;
 let battlefieldAvailable=false;
 const sync=()=>{
  const active=document.fullscreenElement===root;
  status.setAttribute('data-fullscreen',String(active));
  status.setAttribute('data-fullscreen-pending',String(pending));
  if(active||wasActive)root.querySelector('canvas')?.focus({preventScroll:true});
  wasActive=active;
 };
 const toggle=async intent=>{
  if(pending||(intent==='battlefield'&&!battlefieldAvailable))return;
  const before=Boolean(document.fullscreenElement);
  const desired=typeof intent==='boolean'?intent:!before;
  if(desired===before)return;
  pending=true;sync();
  try{
   if(!desired)await document.exitFullscreen();
   else{
    if(!root.requestFullscreen)throw Error('浏览器不支持 Fullscreen API，请使用浏览器的全屏功能。');
    await root.requestFullscreen();
   }
   reportError('');
  }catch(error){reportError(`无法切换全屏：${error.message}`);}
  finally{pending=false;sync();}
 };
 document.addEventListener('fullscreenchange',sync);
 sync();
 toggle.setBattlefieldAvailable=available=>{
  battlefieldAvailable=available;
 };
 return toggle;
}
