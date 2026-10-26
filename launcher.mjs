import {entriesFromFolder, entriesFromDrop, entriesFromZip, downloadZip, libraryFromEntries, safePath} from './resources.mjs';
import {createStorage} from './storage.mjs';
const $ = id => document.getElementById(id), store = createStorage();
let library, operation, lastImport, revision = 0, attempted = false, engine, usersReady = false;
const pending = new Map(); let flushing = false;
const size = n => `${(n / 1024 ** 2).toFixed(1)} MiB`;
function message(id, text, error = false) { $(id).textContent = text; $(id).classList.toggle('error', error); }
function sync() {
  for (const id of ['choose-folder','choose-zip','download','zip-url','cache']) $(id).disabled = !!operation || attempted;
  $('start').disabled = !library || !engine || !usersReady || !!operation || attempted;
  $('retry').hidden = !lastImport || !!operation || attempted;
}
function showLibrary() { message('library', library ? `${library.label} · ${library.files.length} 个资源 · ${size(library.bytes)}` : '尚未导入资源'); sync(); }
function progress(value) {
  $('progress').hidden = false;
  if (value.total) $('progress').value = Math.min(1, value.loaded / value.total); else $('progress').removeAttribute('value');
  message('feedback', `${value.phase} · ${value.total ? `${Math.round(value.loaded / value.total * 100)}% · ` : ''}${value.file || size(value.loaded)}${value.total && !value.file ? ` / ${size(value.total)}` : ''}`);
}
async function saveCache(value) {
  try { await store.saveLibrary(value); message('cache-status', '资源已缓存；下次访问同一地址可直接开始。设置与存档保持独立。'); $('retry-cache').hidden = true; }
  catch (error) { message('cache-status', `缓存失败：${error.message}。旧缓存未被替换；当前资源仍可不缓存启动。`, true); $('retry-cache').hidden = false; }
}
async function importResources(read, label) {
  if (operation || attempted) return;
  lastImport = () => importResources(read, label);
  const controller = new AbortController(), mine = ++revision;
  operation = controller; $('cancel').hidden = false; $('cancel').disabled = false; $('retry-cache').hidden = true; sync();
  try {
    const entries = await read({signal: controller.signal, onProgress: progress});
    controller.signal.throwIfAborted();
    const candidate = libraryFromEntries(entries, label);
    controller.signal.throwIfAborted();
    // Only fully validated candidates can replace a committed cache record.
    $('cancel').disabled = true;
    if ($('cache').checked) { message('feedback', '校验完成，正在保存资源缓存…'); await saveCache(candidate); }
    else message('cache-status', '本次不写资源缓存；原有缓存和用户数据均保留。');
    if (mine !== revision) return;
    library = candidate; showLibrary(); message('feedback', '资源已就绪，可以开始游戏。'); lastImport = undefined;
  } catch (error) {
    message('feedback', controller.signal.aborted ? '已取消，原有资源与用户数据保留。' : `${error.message}；原有资源与用户数据保留。`, !controller.signal.aborted);
  } finally {
    if (mine === revision) { operation = undefined; $('cancel').hidden = true; $('progress').hidden = true; showLibrary(); }
  }
}
$('choose-folder').onclick = () => { $('folder').value = ''; $('folder').click(); };
$('choose-zip').onclick = () => { $('zip').value = ''; $('zip').click(); };
$('folder').onchange = () => {
  const files = [...$('folder').files]; if (files.length) void importResources(o => entriesFromFolder(files, o), files[0].webkitRelativePath.split('/')[0] || '本地文件夹');
};
function importZip(file) { return importResources(o => entriesFromZip(file, o), file.name || '本地 ZIP'); }
$('zip').onchange = () => { const file = $('zip').files[0]; if (file) void importZip(file); };
$('url-form').onsubmit = event => {
  event.preventDefault(); const url = $('zip-url').value.trim();
  let label = '远程 ZIP'; try { label = `ZIP · ${new URL(url).hostname}`; } catch {}
  void importResources(async options => entriesFromZip(await downloadZip(url, options), options), label);
};
$('cancel').onclick = () => operation?.abort();
$('retry').onclick = () => { if (lastImport) void lastImport(); };
$('retry-cache').onclick = async () => { if (!library || operation || attempted) return; $('retry-cache').disabled = true; await saveCache(library); $('retry-cache').disabled = false; };
let dragDepth = 0;
for (const type of ['dragenter','dragover','dragleave','drop']) document.addEventListener(type, event => event.preventDefault());
$('drop-zone').ondragenter = () => { if (!operation && !attempted) { dragDepth++; $('drop-zone').classList.add('dragging'); } };
$('drop-zone').ondragleave = () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) $('drop-zone').classList.remove('dragging'); };
$('drop-zone').ondrop = event => {
  dragDepth = 0; $('drop-zone').classList.remove('dragging');
  if (operation || attempted) return;
  const items = [...event.dataTransfer.items].filter(i => i.kind === 'file');
  const file = items.length === 1 && items[0].getAsFile();
  if (file && /\.zip$/i.test(file.name)) { void importZip(file); return; }
  void importResources(o => entriesFromDrop(items, o), '拖入的游戏目录');
};
function validUser(row) {
  if (!row || typeof row.path !== 'string' || !row.path.startsWith('/saves/')) throw Error('用户数据路径无效');
  safePath(row.path.slice(1));
  const bytes = row.bytes instanceof Uint8Array ? row.bytes : row.bytes instanceof ArrayBuffer ? new Uint8Array(row.bytes) : undefined;
  if (!bytes || bytes.byteLength > 128 * 1024 ** 2 || !Number.isFinite(row.modified) || row.modified < 0) throw Error('设置或存档记录损坏；不会自动清空');
  return {...row, bytes};
}
async function userRecords() { return (await store.users()).map(validUser); }
async function prepareUsers() {
  try { const rows = await userRecords(); usersReady = true; message('user-status', `设置与存档已就绪 · ${rows.length} 个文件，与资源缓存独立`); $('retry-user').hidden = true; }
  catch (error) { usersReady = false; message('user-status', `无法恢复用户数据：${error.message}。请重试后开始，原数据不会删除。`, true); $('retry-user').hidden = false; }
  sync();
}
async function flushUsers() {
  if (flushing || !pending.size) return; flushing = true;
  message('user-status', '正在保存设置与存档…');
  try {
    while (pending.size) {
      const [path, row] = pending.entries().next().value;
      if (row) await store.writeUser(row); else await store.removeUser(path);
      if (pending.get(path) === row) pending.delete(path);
    }
    message('user-status', '设置与存档已保存'); $('retry-user').hidden = true;
  } catch (error) { message('user-status', `用户数据保存失败：${error.message}，请重试，暂勿关闭页面。`, true); $('retry-user').hidden = false; }
  finally { flushing = false; }
}
$('retry-user').onclick = async () => { await prepareUsers(); await flushUsers(); };
window.addEventListener('beforeunload', event => { if (pending.size) { event.preventDefault(); event.returnValue = ''; } });
$('reload').onclick = () => location.reload();
$('start').onclick = async () => {
  if ($('start').disabled) return;
  attempted = true; sync();
  try {
    try { engine.prepare_audio(); } catch (error) { message('game-status', `音频准备失败：${error.message}`, true); }
    const users = await userRecords();
    for (const row of users) engine.restore_user_file(row.path, row.bytes, row.modified);
    engine.set_persistence_callbacks((path, bytes, modified) => {
      if (!path.startsWith('/saves/')) return;
      pending.set(path, {path, bytes: bytes.slice(), modified}); void flushUsers();
    }, path => { if (path.startsWith('/saves/')) { pending.set(path, null); void flushUsers(); } });
    let imported = 0;
    for (const file of library.files) {
      progress({phase: '导入引擎', loaded: imported, total: library.bytes, file: file.path});
      engine.import_file(file.path, new Uint8Array(await file.blob.arrayBuffer()));
      imported += file.blob.size; await new Promise(r => setTimeout(r, 0));
    }
    $('game').hidden = false; $('reload').hidden = false; $('progress').hidden = true;
    engine.start_game($('game'), text => message('game-status', text, /error|could not|failed/i.test(text)));
    document.body.classList.add('playing'); $('game').focus();
  } catch (error) { message('game-status', `启动失败：${error.message}。请重新加载以重试；资源缓存与用户数据保留。`, true); $('reload').hidden = false; }
};
async function prepareEngine() {
  try { const module = await import('./pkg/vera20k.js'); await module.default(); engine = module; message('engine-status', '已验证引擎 41f7ff9 · 准备完成'); }
  catch (error) { message('engine-status', `引擎准备失败：${error.message}，可重新加载重试。`, true); $('reload').hidden = false; }
  sync();
}
const initialRevision = revision;
void store.library().then(cached => {
  if (cached && initialRevision === revision) { library = libraryFromEntries(cached.files, cached.label); message('cache-status', '已恢复上次缓存，无需再次导入。'); }
  if (initialRevision === revision) showLibrary();
}).catch(error => { message('cache-status', `资源缓存暂不可用：${error.message}，可以重新导入。旧缓存未被删除。`, true); if (initialRevision === revision) showLibrary(); });
void prepareEngine(); void prepareUsers();
