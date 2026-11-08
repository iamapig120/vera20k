const assert=require('node:assert/strict');
function replaceOnce(text,before,after){
 assert.equal(text.split(before).length,2,'Toy source changed: '+before.slice(0,70));
 return text.replace(before,after);
}
function removeBetween(text,start,end){
 const a=text.indexOf(start),b=text.indexOf(end,a);
 assert(a>=0&&b>a,'Toy source range changed: '+start);
 return text.slice(0,a)+text.slice(b);
}
function manifestOnlyLauncher(text){
 text=replaceOnce(text," $('choose-folder').disabled=exiting||busy||failed||selecting;\n",'');
 text=replaceOnce(text," $('change-folder').disabled=exiting||busy||failed||selecting;\n",'');
 text=replaceOnce(text,"['choose-zip','zip-url','download-zip','cache-resources'","['cache-resources'");
 text=replaceOnce(text,"$('choose-folder').hidden=true;",'');
 text=removeBetween(text,'files.onchange=()=>{','function selectRemoteProfile(){');
 text=removeBetween(text,"const dropZone=$('drop-zone');",'button.onclick=async()=>{');
 text=replaceOnce(text,"$('retry-import').onclick=()=>{if(lastImport)void lastImport();};","$('retry-import').onclick=()=>{if(remoteSource)void button.onclick();};");
 text=removeBetween(text,'  if(selection===selectionRevision&&!busy&&library?.files?.length){','  storageStatus(cachedSelection?');
 text=text.replaceAll('请选择游戏目录；如果正在恢复缓存，也可以稍候。','请输入资源清单 URL，读取后开始游戏。')
  .replaceAll('可以先选择游戏目录。','可以先读取资源清单。')
  .replaceAll('重新加载后，可再次选择目录','重新加载后，可再次读取资源清单')
  .replaceAll('仍可手动选择目录继续。','仍可重新读取资源清单。');
 assert(!/files\.onchange|chooseFolder\(|zip-form|download-zip|dropZone\.addEventListener/.test(text));
 return text;
}
function manifestOnlyHtml(html){
 const re=/<section\b[^>]*\bid="drop-zone"[^>]*>[\s\S]*?<\/section>/g;
 let count=0;
 html=html.replace(re,()=>{count++;return [
  '<section class="folder-selection manifest-only" aria-label="游戏资源清单">',
  '<h2>读取游戏资源清单</h2>',
  '<form id="manifest-form" class="zip-form"><label for="manifest-url">资源清单 URL</label><div><input id="manifest-url" type="url" placeholder="https://example.com/manifest.json" required><button id="load-manifest">读取清单</button></div><label for="remote-profile">资源分组</label> <select id="remote-profile" aria-label="资源分组"></select></form>',
  '<label class="cache-choice"><input id="cache-resources" type="checkbox" checked> 缓存资源，下次直接开始</label>',
  '<div id="folder-selected" hidden><div class="folder-name" id="folder-name"></div><div class="folder-meta" id="folder-meta"></div></div>',
  '<button class="menu-button launch-button" id="start" type="button" disabled><span id="start-label">开始游戏</span></button>',
  '<div class="import-controls"><button id="cancel-import" class="retry" type="button" hidden>取消加载</button><button id="retry-import" class="retry" type="button" hidden>重试加载</button><button id="retry-cache" class="retry" type="button" hidden>重试缓存</button></div>',
  '</section>'
 ].join('\n');});
 assert.equal(count,1,'Toy resource section changed');
 assert(!/id="(?:choose-folder|change-folder|choose-zip|zip-file|zip-url|zip-form|download-zip|files|drop-zone)"/.test(html));
 return html;
}
function manifestOnlyResources(text){
 return text.replaceAll('请重试或改用本地 ZIP','请检查资源服务后重试')
  .replaceAll('请让资源站允许本页面跨域读取，或先下载 ZIP 再从本机导入；本站不提供绕过代理。','请检查 OSS 是否允许当前 Toy 来源跨域读取，再重试清单或资源请求。');
}
module.exports={manifestOnlyLauncher,manifestOnlyHtml,manifestOnlyResources};
