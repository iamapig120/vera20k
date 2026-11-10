// Initiate both requests inside Start's user gesture. The App-only Toy bridge
// may reject on Web, where the browser Fullscreen API remains available.
export async function requestToyDisplay(document, {toy=globalThis.toy,screen=globalThis.screen,onWarning=()=>{}}={}) {
 const attempt=fn=>{try{return Promise.resolve(fn()).then(()=>true,()=>false);}catch{return Promise.resolve(false);}};
 const host=toy?.setContainerMode?attempt(()=>toy.setContainerMode({orientation:'landscape',immersive:true})):Promise.resolve(false);
 const root=document.documentElement;
 const native=document.fullscreenElement?Promise.resolve(true):root.requestFullscreen?attempt(()=>root.requestFullscreen({keyboardLock:'browser'})):Promise.resolve(false);
 const browser=await native;
 if(browser&&screen?.orientation?.lock)await attempt(()=>screen.orientation.lock('landscape'));
 const supported=await host;
 if(!browser&&!supported)onWarning('当前容器未允许全屏横屏，可继续游戏或使用全屏按钮重试。');
 return browser||supported;
}

export function observeToyContainer(window, toy=globalThis.toy) {
 if(typeof toy?.onContainerChange!=='function')return;
 try{return toy.onContainerChange(()=>{window.dispatchEvent(new Event('resize'));});}catch{}
}
