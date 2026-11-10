import {test} from 'node:test';
import assert from 'node:assert/strict';
import {requestToyDisplay,observeToyContainer} from '../templates/toy.mjs';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require=createRequire(import.meta.url),{releaseLauncher,releaseHtml}=require('../tools/toy-build/release.cjs');

test('Start calls App landscape and browser fullscreen before any await',async()=>{
 const calls=[];let nativeResolve;
 const document={documentElement:{requestFullscreen(){calls.push('fullscreen');return new Promise(ok=>nativeResolve=ok);}}};
 const toy={setContainerMode(options){calls.push(options);return Promise.resolve();}};
 const screen={orientation:{lock(mode){calls.push(mode);return Promise.resolve();}}};
 const result=requestToyDisplay(document,{toy,screen});
 assert.deepEqual(calls,[{orientation:'landscape',immersive:true},'fullscreen']);
 nativeResolve();assert.equal(await result,true);assert.equal(calls.at(-1),'landscape');
});
test('SDK rejection permits browser fallback; host-only success and refusal are safe',async()=>{
 let calls=0;const warnings=[];
 const document={documentElement:{requestFullscreen(){calls++;return Promise.resolve();}}};
 const options={toy:{setContainerMode(){return Promise.reject(Error('unsupported'));}},screen:{},onWarning:m=>warnings.push(m)};
 assert.equal(await requestToyDisplay(document,options),true);assert.equal(calls,1);assert.deepEqual(warnings,[]);
 delete document.documentElement.requestFullscreen;
 assert.equal(await requestToyDisplay(document,{toy:{setContainerMode(){return Promise.resolve();}}}),true);
 assert.equal(await requestToyDisplay(document,options),false);assert.equal(warnings.length,1);
});
test('host viewport changes reach the existing browser resize owner',()=>{
 let listener,resizes=0;observeToyContainer({dispatchEvent(event){assert.equal(event.type,'resize');resizes++;}},{onContainerChange(fn){listener=fn;}});
 listener({orientation:'landscape',viewport:{width:900,height:500}});assert.equal(resizes,1);
});
test('release profile pins automatic manifest and hides resource configuration',()=>{
 const launcher=readFileSync(new URL('../templates/launcher.js',import.meta.url),'utf8').replaceAll('\r\n','\n');
 const output=releaseLauncher(launcher,'https://assets.example.test/game/manifest.json');
 assert(output.includes("void selectRemoteManifest(TOY_MANIFEST_URL,'bootstrap')"));
 assert(!output.includes('const rememberedRemote='));
 assert(output.indexOf('void requestToyDisplay',output.indexOf('button.onclick'))<output.indexOf('await importResources',output.indexOf('button.onclick')));
 const html=releaseHtml(readFileSync(new URL('../templates/index.html',import.meta.url),'utf8'));
 assert.match(html,/<form hidden id="manifest-form"/);assert.match(html,/<label hidden class="cache-choice"><input[^>]+checked>/);
 assert.match(html,/id="folder-name" hidden/);assert(!html.includes('id="choose-folder"'));
 assert.match(html,/s1\.hdslb\.com\/bfs\/seed\/toy\/app\/sdk\/toy-sdk\.js/);
});


test('only the Toy launcher enables single-player menu before engine start',()=>{
 const launcher=readFileSync(new URL('../templates/launcher.js',import.meta.url),'utf8').replaceAll('\r\n','\n');
 const output=releaseLauncher(launcher,'https://assets.example.test/game/manifest.json');
 assert(!launcher.includes('configure_toy_menu'));
 assert.match(output,/import init, \{configure_toy_menu,/);
 assert.equal(output.split('configure_toy_menu(true)').length,2);
 assert.match(output,/configure_toy_menu\(true\);\n  start_game\(canvas,engineStatus\);/);
});
