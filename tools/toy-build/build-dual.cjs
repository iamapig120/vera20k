// Assemble two already built engines. Never infer layout IDs or select an engine.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {packageDependencies}=require('./package-files.cjs');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function safeFile(root,name){
 assert(!path.isAbsolute(name)&&!name.split(/[\\/]/).some(x=>x==='..'),'Unsafe package path');
 let current=root;for(const part of name.split('/')){current=path.join(current,part);assert(!fs.lstatSync(current).isSymbolicLink(),'Unexpected symlink: '+name);}
 assert(fs.statSync(current).isFile(),'Not a file: '+name);return current;
}
function buildDual({current,legacy,output,metadata,templatesDir=path.resolve(__dirname,'../../templates')}){
 const inputs={current:path.resolve(current),legacy:path.resolve(legacy)},out=path.resolve(output);
 assert(!fs.existsSync(out),'Refusing to overwrite output');
 for(const root of Object.values(inputs)){assert(fs.statSync(root).isDirectory()&&!fs.lstatSync(root).isSymbolicLink(),'Invalid site directory');const r=path.relative(root,out);assert(r.startsWith('..')||path.isAbsolute(r),'Output must not be inside an input site');}
 assert(metadata&&typeof metadata==='object','Expected explicit engine metadata');
 assert(metadata.current?.layout!==metadata.legacy?.layout,'Engines must have independent layouts');
 const prepared={};
 for(const [id,root] of Object.entries(inputs)){
  const expected=metadata[id];assert(/^[a-f0-9]{64}$/.test(expected?.expectedWasmSha256),'Missing expected Wasm SHA-256: '+id);assert(/^[a-f0-9]{8}$/.test(expected?.layout),'Missing snapshot layout: '+id);
  const actual=sha(fs.readFileSync(safeFile(root,'pkg/vera20k_bg.wasm')));assert.equal(actual,expected.expectedWasmSha256,'Wasm does not match supplied metadata: '+id);
  const info=fs.readFileSync(safeFile(root,'build-info.txt'),'utf8');const recorded=info.match(/^Snapshot layout (\d+)\s*$/m);if(recorded)assert.equal(Number(recorded[1]).toString(16).padStart(8,'0'),expected.layout,'Recorded snapshot layout mismatch: '+id);
  const html=fs.readFileSync(safeFile(root,'index.html'),'utf8');const launchers=[...html.matchAll(/<script\s+type="module"\s+src="\.\/(launcher\.[a-f0-9]{16}\.js)"\s*><\/script>/g)];assert.equal(launchers.length,1,'Expected exactly one fingerprinted launcher: '+id);
  assert(!html.includes('save-profiles.js'),'Input already has profile configuration');
  for(const folder of ['pkg','pkg/snippets','pkg/fonts'])if(fs.existsSync(path.join(root,folder)))assert(!fs.lstatSync(path.join(root,folder)).isSymbolicLink(),'Unexpected package directory symlink');
  const files=['index.html','launcher.css','lobby.js','network.js','LICENSE-GPL','build-info.txt','assets/RA2MD.png','pkg/vera20k.js','pkg/vera20k_bg.wasm',launchers[0][1],...packageDependencies(root)];
  for(const optional of ['LEGAL.txt'])if(fs.existsSync(path.join(root,optional)))files.push(optional);
  for(const f of files)safeFile(root,f);
  assert.equal([...html.matchAll(/<script src="\.\/storage\.js(?:\?[^"<>]*)?"><\/script>/g)].length,1,'Storage installation point missing');
  assert(html.includes('</head>')&&/<body(?:\s|>)/.test(html),'Missing HTML structure');
  prepared[id]={root,html,files,launcher:launchers[0][1],launcherTag:launchers[0][0],wasmSha256:actual,layout:expected.layout,source:expected.source||null};
 }
 for(const file of ['storage.js','save-profiles.js','engine-navigation.js','engine-selector.html','engine-selector.css','engine-selector.js'])safeFile(templatesDir,file);
 // Nothing has been written until both inputs and the shared profile code pass validation.
 fs.mkdirSync(out,{recursive:true});
 const receipt={format:'vera20k-dual-package',version:1,engines:{},files:{}};
 for(const [id,input] of Object.entries(prepared)){
  const folder=id==='current'?'new':'legacy',destination=path.join(out,folder);fs.mkdirSync(destination);
  for(const name of input.files){const p=path.join(destination,name);fs.mkdirSync(path.dirname(p),{recursive:true});fs.copyFileSync(path.join(input.root,name),p);}
  for(const name of ['storage.js','save-profiles.js','engine-navigation.js'])fs.copyFileSync(path.join(templatesDir,name),path.join(destination,name));
  const config={profile:id,currentLayout:prepared.current.layout,legacyLayout:prepared.legacy.layout,legacyName:'vera20k-web-v2',currentName:'vera20k-web-layout-'+prepared.current.layout,backupName:'vera20k-web-backup-before-'+prepared.current.layout};
  const installer='<script type="module">try{const {installProfile}=await import("./save-profiles.js");const {installEngineNavigation}=await import("./engine-navigation.js");installEngineNavigation(document);installProfile('+JSON.stringify(config)+');await import("./'+input.launcher+'");}catch(error){const status=document.getElementById("engine-bootstrap-error");status.hidden=false;status.textContent="版本准备失败，已停止继续启动以保护存档。请刷新页面重试，或返回版本选择。\\n"+String(error.message||error);const start=document.getElementById("start");if(start)start.disabled=true;}</script>';
  // Fail closed: the engine module is imported only after its profile installs.
  let html=input.html.replace(input.launcherTag,'');let count=0;html=html.replace(/<script src="\.\/storage\.js(?:\?[^"<>]*)?"><\/script>/g,()=>{count++;return '<script src="./storage.js?v='+sha(fs.readFileSync(path.join(destination,'storage.js'))).slice(0,16)+'"></script>\n'+installer;});assert.equal(count,1,'Storage installation point missing');
  html=html.replace('</head>','<style>.engine-version-nav{margin:12px 20px;font:14px system-ui}.engine-version-nav a{color:#b9dca2}body.playing .engine-version-nav{display:none}</style>\n</head>');
  html=html.replace(/<body([^>]*)>/,'<body$1><nav class="engine-version-nav"><a id="engine-return" href="../index.html">返回版本选择</a><span id="engine-return-status" role="alert"></span><p id="engine-bootstrap-error" role="alert" hidden></p> · '+(id==='current'?'新版：独立新进度':'旧版：继续现有进度')+'</nav>');
  fs.writeFileSync(path.join(destination,'index.html'),html);
  receipt.engines[id]={directory:folder,wasmSha256:input.wasmSha256,layout:input.layout,source:input.source,storage:config};
 }
 fs.copyFileSync(path.join(templatesDir,'engine-selector.html'),path.join(out,'index.html'));
 for(const name of ['engine-selector.css','engine-selector.js','storage.js','save-profiles.js'])fs.copyFileSync(path.join(templatesDir,name),path.join(out,name));
 const rootConfig={...receipt.engines.current.storage};delete rootConfig.profile;
 fs.writeFileSync(path.join(out,'engine-profile-config.js'),'export default '+JSON.stringify(rootConfig)+';\n');
 const walk=dir=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())walk(p);else receipt.files[path.relative(out,p).replaceAll('\\','/')]=sha(fs.readFileSync(p));}};walk(out);
 fs.writeFileSync(path.join(out,'dual-build-info.json'),JSON.stringify(receipt,null,2)+'\n');return receipt;
}
module.exports={buildDual};
if(require.main===module){try{const [current,legacy,output,metadataPath]=process.argv.slice(2);assert(current&&legacy&&output&&metadataPath,'Usage: node build-dual.cjs CURRENT_SITE LEGACY_SITE NEW_OUTPUT INPUT_METADATA_JSON');const receipt=buildDual({current,legacy,output,metadata:JSON.parse(fs.readFileSync(metadataPath,'utf8'))});console.log(JSON.stringify({output:path.resolve(output),engines:receipt.engines}));}catch(error){console.error(error);process.exitCode=1;}}
