// Wrap one already-built engine in an independent save namespace. No migration.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {packageDependencies}=require('./package-files.cjs');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function safeFile(root,name){assert(!path.isAbsolute(name)&&!name.split(/[\\/]/).some(p=>p==='..'),'Unsafe package path');let file=root;for(const p of name.split('/')){file=path.join(file,p);assert(!fs.lstatSync(file).isSymbolicLink(),'Unexpected symlink: '+name);}assert(fs.statSync(file).isFile(),'Not a file: '+name);return file;}
function buildCurrent({input,output,metadata,templatesDir=path.resolve(__dirname,'../../templates')}){
 const source=path.resolve(input),destination=path.resolve(output);
 assert(!fs.existsSync(destination),'Refusing to overwrite output');assert(fs.statSync(source).isDirectory()&&!fs.lstatSync(source).isSymbolicLink(),'Invalid input site');
 const relative=path.relative(source,destination);assert(relative.startsWith('..')||path.isAbsolute(relative),'Output must not be inside input');
 assert(/^[a-f0-9]{64}$/.test(metadata?.expectedWasmSha256),'Missing expected Wasm SHA-256');assert(/^[a-f0-9]{8}$/.test(metadata?.layout),'Missing snapshot layout');
 const actual=sha(fs.readFileSync(safeFile(source,'pkg/vera20k_bg.wasm')));assert.equal(actual,metadata.expectedWasmSha256,'Wasm metadata mismatch');
 const info=fs.readFileSync(safeFile(source,'build-info.txt'),'utf8'),recorded=info.match(/^Snapshot layout (\d+)\s*$/m);if(recorded)assert.equal(Number(recorded[1]).toString(16).padStart(8,'0'),metadata.layout,'Recorded snapshot layout mismatch');
 let html=fs.readFileSync(safeFile(source,'index.html'),'utf8');
 const launchers=[...html.matchAll(/<script\s+type="module"\s+src="\.\/(launcher\.[a-f0-9]{16}\.js)"\s*><\/script>/g)];assert.equal(launchers.length,1,'Expected one fingerprinted launcher');
 assert(!/save-profiles\.js|engine-selector|engine-navigation|engine-return/.test(html),'Input already wrapped');
 assert.equal([...html.matchAll(/<script src="\.\/storage\.js(?:\?[^"<>]*)?"><\/script>/g)].length,1,'Storage installation point missing');assert(html.includes('</head>')&&/<body(?:\s|>)/.test(html),'Missing HTML structure');
 for(const folder of ['pkg','pkg/fonts','pkg/snippets'])if(fs.existsSync(path.join(source,folder)))assert(!fs.lstatSync(path.join(source,folder)).isSymbolicLink(),'Unexpected package directory symlink');
 const files=['index.html','launcher.css','lobby.js','network.js','LICENSE-GPL','build-info.txt','assets/RA2MD.png','pkg/vera20k.js','pkg/vera20k_bg.wasm',launchers[0][1],...packageDependencies(source)];if(fs.existsSync(path.join(source,'LEGAL.txt')))files.push('LEGAL.txt');for(const file of files)safeFile(source,file);
 const storageSource=safeFile(templatesDir,'storage.js'),namespace='vera20k-web-layout-'+metadata.layout;
 // Validate everything above before writing a new output directory.
 fs.mkdirSync(destination,{recursive:true});for(const name of files){const target=path.join(destination,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(source,name),target);}fs.copyFileSync(storageSource,path.join(destination,'storage.js'));
 const installer='<script type="module">try{if(typeof globalThis.createVeraStorage!=="function")throw Error("Storage module unavailable");globalThis.VeraStorage=globalThis.createVeraStorage('+JSON.stringify(namespace)+',{migrateLegacy:false});await import("./'+launchers[0][1]+'");}catch(error){const note=document.getElementById("current-bootstrap-error");note.hidden=false;note.textContent="新版准备失败，已停止继续启动。请刷新页面重试。\\n"+String(error.message||error);const start=document.getElementById("start");if(start)start.disabled=true;}</script>';
 html=html.replace(launchers[0][0],'').replace(/<script src="\.\/storage\.js(?:\?[^"<>]*)?"><\/script>/,'<script src="./storage.js?v='+sha(fs.readFileSync(storageSource)).slice(0,16)+'"></script>\n'+installer);
 html=html.replace('</head>','<style>.current-save-notice{margin:12px 20px;padding:10px 14px;border:1px solid #65715b;border-radius:6px;color:#d4dfcc;font:14px/1.6 system-ui}body.playing .current-save-notice{display:none}</style>\n</head>').replace(/<body([^>]*)>/,'<body$1><aside class="current-save-notice">新版不兼容旧存档，将使用独立的新进度；原有数据不会删除。<p id="current-bootstrap-error" role="alert" hidden></p></aside>');
 fs.writeFileSync(path.join(destination,'index.html'),html);
 fs.appendFileSync(path.join(destination,'build-info.txt'),'\nLOCAL CANDIDATE ONLY - NOT PUBLISHED. Existing source URLs above identify earlier releases, not this candidate; corresponding source publication is pending.\nSingle current engine. Snapshot layout: '+metadata.layout+'; save namespace: '+namespace+'; migrateLegacy=false. No old-store access or compatibility layer.\n');
 const receipt={format:'vera20k-current-package',version:1,published:false,wasmSha256:actual,layout:metadata.layout,sourceRevision:metadata.sourceRevision||null,source:metadata.source||null,storage:{name:namespace,migrateLegacy:false},files:{}};
 const walk=directory=>{for(const entry of fs.readdirSync(directory,{withFileTypes:true})){const p=path.join(directory,entry.name);if(entry.isDirectory())walk(p);else receipt.files[path.relative(destination,p).replaceAll('\\','/')]=sha(fs.readFileSync(p));}};walk(destination);fs.writeFileSync(path.join(destination,'current-build-info.json'),JSON.stringify(receipt,null,2)+'\n');return receipt;
}
module.exports={buildCurrent};
if(require.main===module){try{const [input,output,metadataPath]=process.argv.slice(2);assert(input&&output&&metadataPath,'Usage: node build-current.cjs CURRENT_SITE NEW_OUTPUT INPUT_METADATA_JSON');const parsed=JSON.parse(fs.readFileSync(metadataPath,'utf8'));const receipt=buildCurrent({input,output,metadata:parsed.current||parsed});console.log(JSON.stringify({output:path.resolve(output),wasmSha256:receipt.wasmSha256,layout:receipt.layout,storage:receipt.storage}));}catch(error){console.error(error);process.exitCode=1;}}
