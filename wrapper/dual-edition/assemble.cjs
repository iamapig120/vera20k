'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const digestFile = file => digest(fs.readFileSync(file));
const auditHash = 'e0d07990668669792e84dffbaeba404bfacb9ba32957ce0c5312fd9221891602';
const pairedHash = '7c64fb691ca2ff7d39cfaaadd51097d572f5893767e226da650ffc89a31a44de';
const pairedGlue = 'e8e3218f0eeb05b78a1dab95fb01fb6d23729d8e02ebc58a1d8f5d9791caf21f';
const auditReceipt = 'current-build-info.json';
const integration = path.resolve(__dirname);
function safeFile(root, name) {
  assert(/^[a-zA-Z0-9_./-]+$/.test(name) && !path.isAbsolute(name) && !name.split('/').some(p => p === '..' || p === '.' || !p), 'unsafe name: '+name);
  let file = root;
  for (const part of name.split('/')) {
    file = path.join(file,part);
    assert(!fs.lstatSync(file).isSymbolicLink(),'No symlinks: '+name);
  }
  assert(fs.statSync(file).isFile(),'Expected file: '+name);
  return file;
}
function replaceOne(input, pattern, value) {
  assert.equal([...input.matchAll(pattern)].length,1,'Source changed: '+pattern);
  return input.replace(pattern, () => value);
}
function packagePicker(yrFrom, ra2From, target) {
  const yr = path.resolve(yrFrom), ra2 = path.resolve(ra2From), output = path.resolve(target);
  assert(!fs.existsSync(output),'Refusing to overwrite output');
  for (const root of [yr,ra2]) assert(!fs.lstatSync(root).isSymbolicLink() && fs.statSync(root).isDirectory() && !output.startsWith(root+path.sep),'Invalid artifact root');
  assert.equal(digestFile(safeFile(yr,'pkg/vera20k_bg.wasm')),auditHash);
  assert.equal(digestFile(safeFile(ra2,'pkg/vera20k_bg.wasm')),pairedHash);
  assert.equal(digestFile(safeFile(ra2,'pkg/vera20k.js')),pairedGlue);
  const manifest = JSON.parse(fs.readFileSync(safeFile(yr,auditReceipt),'utf8'));
  assert.equal(manifest.wasmSha256,auditHash);
  const assetPattern = /^(?:LEGAL\.txt|LICENSE-GPL|build-info\.txt|index\.html|launcher\.(?:css|[a-f0-9]{16}\.js)|storage\.js|lobby\.js|network\.js|assets\/RA2MD\.png|pkg\/(?:vera20k(?:_bg)?\.(?:js|wasm|d\.ts|wasm\.d\.ts)|fonts\/[\w.\-]+\.(?:ttf|otf|bin|txt)|snippets\/[a-zA-Z0-9_./-]+\.js))$/;
  for (const [name,hash] of Object.entries(manifest.files)) {
    assert(assetPattern.test(name),'Unexpected audited asset: '+name);
    assert.equal(digestFile(safeFile(yr,name)),name==='build-info.txt'?'bc6e22e67a593d2855eac831b0b8278c33d1193ce4c9f31c090dfcec472abd63':hash,'Audited file changed: '+name);
    if (name.startsWith('pkg/fonts/') || name.startsWith('pkg/snippets/'))
      assert.equal(digestFile(safeFile(ra2,name)),hash,'Cannot deduplicate changed dependency: '+name);
  }
  for (const name of ['index.html','storage.js','pkg/vera20k_bg.wasm','pkg/vera20k.js'])
    assert(Object.hasOwn(manifest.files,name),'Missing expected audited entry: '+name);
  let html = fs.readFileSync(safeFile(yr,'index.html'),'utf8');
  const js = fs.readFileSync(safeFile(integration,'picker.js'));
  const css = fs.readFileSync(safeFile(integration,'picker.css'));
  const controls = fs.readFileSync(safeFile(integration,'picker.html'),'utf8');
  const jsName = 'edition-picker.'+digest(js).slice(0,16)+'.js';
  const cssName = 'edition-picker.'+digest(css).slice(0,16)+'.css';
  html = replaceOne(html,/<title>[^<]+<\/title>/g,'<title>红色警戒 2 · 选择版本</title>');
  html = replaceOne(html,/<meta name="description" content="[^"]+">/g,'<meta name="description" content="选择红色警戒 2 原版或尤里的复仇，在浏览器中启动游戏。">');
  html = replaceOne(html,/<p class="import-title">[^<]+<\/p>/g,controls.trim());
  html = replaceOne(html,/<p class="expansion">[^<]+<\/p>/g,'<p class="expansion">网页版 · VERA20k</p>');
  html = html.replace('<img class="brand-icon" src="./assets/RA2MD.png" alt="尤里标志">','');
  html = replaceOne(html,/<\/head>/g,'<link rel="stylesheet" href="./'+cssName+'">\n</head>');
  html = replaceOne(html,/<\/body>/g,'<script type="module" src="./'+jsName+'"></script>\n</body>');
  assert(Buffer.byteLength(html)<1024*1024,'index.html exceeds the Toy limit');
  fs.mkdirSync(output,{recursive:true});
  for (const name of Object.keys(manifest.files)) {
    const dst = path.join(output,name); fs.mkdirSync(path.dirname(dst),{recursive:true});
    fs.copyFileSync(safeFile(yr,name),dst);
  }
  fs.writeFileSync(path.join(output,'index.html'),html);
  fs.writeFileSync(path.join(output,jsName),js);
  fs.writeFileSync(path.join(output,cssName),css);
  const prefix = 'pkg/vera20k-ra2.'+pairedHash.slice(0,16);
  fs.copyFileSync(safeFile(ra2,'pkg/vera20k.js'),path.join(output,prefix+'.js'));
  fs.copyFileSync(safeFile(ra2,'pkg/vera20k_bg.wasm'),path.join(output,prefix+'.wasm'));
  assert(js.toString().includes(prefix+'.js') && js.toString().includes(prefix+'.wasm'),'Bindings href mismatch');
  fs.appendFileSync(path.join(output,'build-info.txt'),'\nAdditional RA2 mode (separate build): '+pairedHash+'\nRA2 source pin: https://github.com/iamapig120/vera20k/tree/0676dc7a2eaaaf1878f77ca9bb5e9aead75eaccc\nRA2 local saves/profile database scope: vera20k-toy-ra2-layout-d6c75d57\n');
  const walk = dir => Object.fromEntries(fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry => {
    const file = path.join(dir,entry.name);
    return entry.isDirectory()?Object.entries(walk(file)):[[path.relative(output,file).split(path.sep).join('/'),digestFile(file)]];
  }));
  const receipt = {format:'vera20k-toy-dual-edition',version:1,engines:{yr:auditHash,ra2:pairedHash},files:walk(output)};
  fs.writeFileSync(path.join(output,'dual-edition-build-info.json'),JSON.stringify(receipt,null,2)+'\n');
  return receipt;
}
if (require.main === module) {
  const [yr,ra2,output] = process.argv.slice(2);
  assert(yr && ra2 && output,'Usage: node assemble.cjs AUDITED_YR_SITE PAIRED_RA2_SITE NEW_OUTPUT_DIRECTORY');
  packagePicker(yr,ra2,output);
}
module.exports = {packagePicker};
