import test from 'node:test';
import assert from 'node:assert/strict';
import {crc32, safePath, libraryFromEntries, entriesFromZip, entriesFromFolder, entriesFromDrop, downloadZip, LIMITS} from '../templates/resources.mjs';
import {zip, gameEntries, gameNames} from './zip-fixtures.mjs';
const blob = entries => new Blob([zip(entries)]);
test('CRC32 matches the independent standard vector', () => assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926));
test('deflated nested UTF-8 ZIP and empty directories import exact bytes', async () => {
  const entries = await entriesFromZip(blob([{name:'演示资源/'}, ...gameEntries]));
  const result = libraryFromEntries(entries, 'sample');
  assert.deepEqual(result.files.map(f => f.path), gameNames);
  assert.equal(await result.files[0].blob.text(), gameEntries[0].text);
});
test('stored ZIP preserves arbitrary root files as inert resource bytes', async () => {
  const result = libraryFromEntries(await entriesFromZip(blob([...gameEntries.map(e => ({...e,method:0})),{name:'演示资源/setup.exe',text:'not run'}])), 'sample');
  assert.equal(result.files.length, 5);
  assert.equal(await result.files.find(file => file.path === 'setup.exe').blob.text(), 'not run');
});

test('root movies, loose MOD files and nested overrides survive import unchanged', async () => {
  const extra = ['intro.bik','movies01.mix','movmd02.mix','mod.custom','nested/override.bin','__MACOSX/local.data'];
  const result = libraryFromEntries(await entriesFromZip(blob([...gameEntries,
    ...extra.map(name => ({name:`演示资源/${name}`,text:`bytes:${name}`}))])), 'root');
  for (const path of extra) assert.equal(await result.files.find(file => file.path === path).blob.text(), `bytes:${path}`);
});

test('preserving all root files does not remove total-size protection', () => {
  const entries = gameEntries.map(entry => ({path:entry.name,blob:new Blob([entry.text])}));
  const large = new Blob(['metadata-only size fixture']);
  Object.defineProperty(large,'size',{value:LIMITS.entry});
  assert.throws(() => libraryFromEntries([...entries,
    {path:'演示资源/first.custom',blob:large},{path:'演示资源/second.custom',blob:large}], 'large'), /2 GiB/);
});
for (const path of ['../x.mix','C:/x.mix','/x.mix','a/../x.mix','a\\..\\x.mix','//server/x.mix','a/./x.mix','a\0.mix']) {
  test(`unsafe path is rejected: ${JSON.stringify(path)}`, () => assert.throws(() => safePath(path)));
}
test('archive path traversal is rejected before extraction', async () => assert.rejects(entriesFromZip(blob([{name:'../ra2.mix',text:'x'}])), /不安全/));
test('case-insensitive duplicates and slash aliases are rejected', async () => {
  await assert.rejects(entriesFromZip(blob([{name:'A/x.mix',text:'a'},{name:'a\\X.mix',text:'b'}])), /重名/);
  assert.throws(() => libraryFromEntries([{path:'RA2.mix',blob:new Blob(['a'])},{path:'ra2.mix',blob:new Blob(['b'])}], 'bad'), /重名/);
});
test('CRC corruption and truncated archive fail', async () => {
  const bytes = zip(gameEntries); bytes[30 + Buffer.byteLength(gameEntries[0].name) + 2] ^= 0xff;
  await assert.rejects(entriesFromZip(new Blob([bytes])), /解压|校验/);
  await assert.rejects(entriesFromZip(new Blob([zip(gameEntries).subarray(0,-3)])), /目录|完整/);
});
test('declared and actual expansion limits are both enforced', async () => {
  await assert.rejects(entriesFromZip(blob(gameEntries), {limits:{...LIMITS,total:20}}), /体积/);
  await assert.rejects(entriesFromZip(blob([{name:'small.mix',text:'x'.repeat(1000),declared:3}])), /实际体积/);
  await assert.rejects(entriesFromZip(blob(gameEntries), {limits:{...LIMITS,entries:3}}), /条目/);
});
test('encrypted, symlink, split and ZIP64 archives fail explicitly', async () => {
  await assert.rejects(entriesFromZip(blob([{...gameEntries[0],flags:0x801}])), /加密/);
  await assert.rejects(entriesFromZip(blob([{...gameEntries[0],attrs:0xa1ff0000}])), /符号链接/);
  const split = zip(gameEntries); split.writeUInt16LE(1, split.length - 18);
  await assert.rejects(entriesFromZip(new Blob([split])), /分卷/);
  const zip64 = zip(gameEntries); zip64.writeUInt16LE(65535, zip64.length-14); zip64.writeUInt16LE(65535, zip64.length-12);
  await assert.rejects(entriesFromZip(new Blob([zip64])), /ZIP64/);
});
test('mismatched local header cannot alias central filenames', async () => {
  const bytes = zip(gameEntries); bytes[30 + Buffer.byteLength(gameEntries[0].name) - 1] = 'X'.charCodeAt(0);
  await assert.rejects(entriesFromZip(new Blob([bytes])), /文件名不一致/);
});
test('movies are optional; missing map resources and multiple roots fail', () => {
  const entries = gameEntries.map(e => ({path:e.name,blob:new Blob([e.text])}));
  assert.equal(libraryFromEntries(entries.slice(0,3), 'without movies').files.length,3);
  assert.throws(() => libraryFromEntries(entries.slice(0,2), 'bad'), /mapsmd03/);
  assert.throws(() => libraryFromEntries([...entries,...entries.map(e=>({...e,path:'other/'+e.path}))], 'bad'), /多个游戏目录/);
});
test('folder selection preserves nested relative paths', async () => {
  const files = gameEntries.map(e => { const file = new File([e.text], e.name.split('/').at(-1)); Object.defineProperty(file,'webkitRelativePath',{value:e.name}); return file; });
  assert.equal(libraryFromEntries(await entriesFromFolder(files), 'folder').files.length, 4);
});
test('dropped folder readers consume all batches', async () => {
  const children=gameEntries.map(e=>({name:e.name.split('/').at(-1),isFile:true,file:resolve=>resolve(new Blob([e.text]))}));
  let batch=0;
  const directory={name:'拖入目录',isDirectory:true,createReader:()=>({readEntries:resolve=>resolve(batch++===0?children.slice(0,2):batch===2?children.slice(2):[])})};
  const entries=await entriesFromDrop([{kind:'file',webkitGetAsEntry:()=>directory}]);
  assert.equal(libraryFromEntries(entries,'drop').files.length,4);
});
test('HTTPS download streams progress, omits credentials, and feeds real ZIP extraction', async () => {
  const bytes=zip(gameEntries), progress=[];
  const downloaded=await downloadZip('https://fixture.example/game.zip?temporary=secret', {onProgress:p=>progress.push(p),fetchImpl:async(url,options)=>{
    assert.equal(options.credentials,'omit'); assert.equal(options.mode,'cors'); assert.equal(options.referrerPolicy,'no-referrer');
    return new Response(new ReadableStream({start(c){c.enqueue(bytes.subarray(0,50));c.enqueue(bytes.subarray(50));c.close();}}),{headers:{'Content-Length':String(bytes.length)}});
  }});
  assert.equal(libraryFromEntries(await entriesFromZip(downloaded),'remote').files.length,4);
  assert.equal(progress.at(-1).loaded,bytes.length);
});
test('drop handles are captured before the event expires, and pending readers cancel', async () => {
  let expired = false;
  const items = ['a.mix','b.mix'].map(name=>({kind:'file',webkitGetAsEntry:()=>expired?null:{name,isFile:true,file:resolve=>queueMicrotask(()=>{expired=true;resolve(new Blob(['x']));})}}));
  assert.equal((await entriesFromDrop(items)).length,2);
  const controller = new AbortController();
  const pending = entriesFromDrop([{kind:'file',webkitGetAsEntry:()=>({name:'folder',isDirectory:true,createReader:()=>({readEntries(){}})})}],{signal:controller.signal});
  controller.abort();
  await assert.rejects(pending,error=>error.name==='AbortError');
});
test('HTTP, embedded credentials, CORS and HTTP errors have no fallback proxy', async () => {
  await assert.rejects(downloadZip('http://fixture.example/game.zip'),/HTTPS/);
  await assert.rejects(downloadZip('https://user:pass@fixture.example/game.zip'),/用户名/);
  await assert.rejects(downloadZip('https://fixture.example/game.zip',{fetchImpl:async()=>{throw TypeError('Failed to fetch');}}),/CORS.*本机导入/);
  await assert.rejects(downloadZip('https://fixture.example/game.zip',{fetchImpl:async()=>new Response('',{status:404})}),/HTTP 404/);
});
test('download inactivity timeout and user cancellation terminate streams', async () => {
  const waiting=async()=>new Response(new ReadableStream({start(){}}));
  await assert.rejects(downloadZip('https://fixture.example/slow.zip',{fetchImpl:waiting,timeoutMs:10}),/没有响应/);
  const controller=new AbortController();
  const pending=downloadZip('https://fixture.example/cancel.zip',{fetchImpl:waiting,signal:controller.signal});
  setTimeout(()=>controller.abort(),10);
  await assert.rejects(pending,error=>error.name==='AbortError');
});
test('HTTP development exception requires both page and resource to be loopback', async () => {
  const ok = async () => new Response('fixture');
  assert.equal(await (await downloadZip('http://localhost:8771/test.zip', {pageUrl:'http://127.0.0.1:8771/',fetchImpl:ok})).text(), 'fixture');
  await assert.rejects(downloadZip('http://localhost:8771/test.zip', {pageUrl:'https://public.example/',fetchImpl:ok}), /HTTPS/);
  await assert.rejects(downloadZip('http://remote.example/test.zip', {pageUrl:'http://localhost:8771/',fetchImpl:ok}), /HTTPS/);
  await assert.rejects(downloadZip('http://localhost.evil.example/test.zip', {pageUrl:'http://localhost:8771/',fetchImpl:ok}), /HTTPS/);
  await assert.rejects(downloadZip('http://localhost:8771/test.zip', {pageUrl:'http://localhost:8771/',fetchImpl:async()=>({url:'http://remote.example/test.zip'})}), /不安全/);
});
test('ZIP extraction cancellation does not produce a partial candidate', async () => {
  const controller=new AbortController();
  await assert.rejects(entriesFromZip(blob(gameEntries),{signal:controller.signal,onProgress:()=>controller.abort()}),error=>error.name==='AbortError');
});
