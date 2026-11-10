const assert=require('node:assert/strict');
const {manifestOnlyLauncher,manifestOnlyHtml,manifestOnlyResources}=require('./profile.cjs');
function once(text,before,after){assert.equal(text.split(before).length,2,'Release source drift: '+before.slice(0,80));return text.replace(before,after);}
function releaseLauncher(text,manifestUrl){
 const url=new URL(manifestUrl);assert(['https:','http:'].includes(url.protocol));
 text=manifestOnlyLauncher(text);
 // Only the Toy transformation opts into the engine menu policy. Ordinary Web
 // templates and desktop launches retain Internet and LAN.
 text=once(text,'import init, {','import init, {configure_toy_menu,');
 text=once(text,'  start_game(canvas,engineStatus);','  configure_toy_menu(true);\n  start_game(canvas,engineStatus);');
 text="import {requestToyDisplay,observeToyContainer} from './toy.mjs';\n"+text;
 text=once(text,"button.onclick=async()=>{","button.onclick=async()=>{");
 // The existing guard is the first statement. Make the display request before
 // resource/network awaits, but never start from an invalid/disabled state.
 const start=text.indexOf('button.onclick=async()=>{'),end=text.indexOf('\n try{',start);
 assert(end>start);text=text.slice(0,end)+"\n void requestToyDisplay(document,{onWarning:message=>{$('fullscreen-status').textContent=message;}});"+text.slice(end);
 const restore=/const rememberedRemote=savedRemoteSelection\(\);[\s\S]*?void prepareEngine\(\);/;
 assert(restore.test(text));
 text=text.replace(restore,"const TOY_MANIFEST_URL="+JSON.stringify(manifestUrl)+";\n$('manifest-url').value=TOY_MANIFEST_URL;\n$('cache-resources').checked=true;\nvoid selectRemoteManifest(TOY_MANIFEST_URL,'bootstrap');\nobserveToyContainer(window);\nvoid prepareEngine();");
 const begin=text.indexOf('async function selectRemoteManifest('),finish=text.indexOf("$('manifest-form').onsubmit",begin);
 let selection=text.slice(begin,finish);
 selection=once(selection,' }catch(error){feedback('," }catch(error){lastImport=()=>selectRemoteManifest(TOY_MANIFEST_URL,'bootstrap');feedback(");
 text=text.slice(0,begin)+selection+text.slice(finish);
 text=once(text,"$('retry-import').onclick=()=>{if(remoteSource)void button.onclick();};","$('retry-import').onclick=()=>{if(remoteSource)void button.onclick();else void selectRemoteManifest(TOY_MANIFEST_URL,'bootstrap');};");
 return text;
}
function releaseHtml(html){
 html=manifestOnlyHtml(html);
 html=once(html,'<form id="manifest-form"','<form hidden id="manifest-form"');
 html=once(html,'<label class="cache-choice">','<label hidden class="cache-choice">');
 html=once(html,'id="folder-name"','id="folder-name" hidden');
 html=once(html,'id="folder-meta"','id="folder-meta" hidden');
 html=html.replace(/<title>[\s\S]*?<\/title>/,'<title>YR Web · 尤里的复仇</title>');
 html=html.replace(/<div class="edition">[\s\S]*?<\/div>/,'<div class="edition">YR WEB · 非官方修改版，基于 VERA20K</div>');
 html=html.replace('https://github.com/libi/vera20k-web','https://github.com/iamapig120/vera20k/tree/web-ondemand-toy-20261108');
 return html.replace('</head>','<script async src="https://s1.hdslb.com/bfs/seed/toy/app/sdk/toy-sdk.js"></script>\n</head>');
}
module.exports={releaseLauncher,releaseHtml,manifestOnlyResources};
