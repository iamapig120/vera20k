import {ownedRa2Entries} from './ra2-retail.js';
const byId = id => document.getElementById(id);
const selector = byId('edition-picker');
const nativeYrStart = byId('start');
const start = byId('edition-start');
const ra2Panel = byId('ra2-import');
const feedback = byId('ra2-feedback');
const launchMode = () => selector.querySelector('input:checked').value;
let ra2Entries = [];
let ra2Engine, engineRead, ra2Store;
let running = false, ended = false, yrRequested = false;
let filesError = false;
const writes = new Map();
let writing;
const saveAlert = byId('ra2-save-alert');

// YR remains the exact audited launcher. Its enabled state and original
// user-gesture handler are authoritative for the visible shared action.
function sync() {
    const ra2 = launchMode() === 'ra2';
    document.body.dataset.gameEdition = ra2 ? 'ra2' : 'yr';
    const yrBusy = yrRequested && (nativeYrStart.disabled || document.body.classList.contains('playing'));
    if (yrRequested && !yrBusy) yrRequested = false;
    selector.disabled = running || ended || yrBusy || document.body.classList.contains('playing');
    ra2Panel.hidden = !ra2;
    for (const id of ['ra2-choose', 'ra2-multi']) byId(id).disabled = running || ended;
    start.disabled = ra2 ? running || ended || !ra2Engine || !ra2Entries.length : nativeYrStart.disabled;
    start.textContent = running && ra2 ? '正在启动…' : '启动游戏';
}
function inform(message, error = false) {
    feedback.textContent = message;
    feedback.classList.toggle('error', error);
}
async function preloadRa2() {
    if (ra2Engine || engineRead) return;
    const bound = './pkg/vera20k-ra2.__RA2_BUILD_HASH__.js';
    const binary = new URL('./pkg/vera20k-ra2.__RA2_BUILD_HASH__.wasm', import.meta.url);
    engineRead = (async () => {
        try {
            if (!ra2Entries.length && !filesError) inform('正在准备原版引擎…');
            const engine = await import(bound);
            const response = await fetch(binary, {signal: AbortSignal.timeout(90000)});
            if (!response.ok) throw Error('引擎下载失败（HTTP ' + response.status + '）');
            await engine.default({module_or_path: await response.arrayBuffer()});
            await engine.fonts_ready();
            if (typeof engine.probe_ra2 !== 'function' || typeof engine.start_ra2 !== 'function') throw Error('原版入口不可用');
            ra2Engine = engine;
            if (ra2Entries.length) inform('已选择 ' + ra2Entries.length + ' 个游戏文件。');
            else if (!filesError) inform('');
        } catch (error) {
            inform('无法准备原版引擎。请刷新后重试。' + (error.message ? '（' + error.message + '）' : ''), true);
        } finally {
            engineRead = undefined;
            sync();
        }
    })();
}
if (!('webkitdirectory' in byId('ra2-directory'))) byId('ra2-choose').hidden = true;
for (const [control, input] of [['ra2-choose','ra2-directory'],['ra2-multi','ra2-files']]) {
    const picker = byId(input);
    byId(control).onclick = () => { picker.value = ''; picker.click(); };
    picker.onchange = () => {
        if (!picker.files.length) return;
        try {
            ra2Entries = ownedRa2Entries([...picker.files]); filesError = false;
            inform('已选择 ' + ra2Entries.length + ' 个游戏文件。' + (ra2Engine ? '' : '正在准备引擎…'));
        } catch (error) {
            ra2Entries = []; filesError = true; inform(error.message, true);
        }
        sync();
    };
}
// Separate durable browser database; even common engine keys cannot affect YR.
function flushRa2() {
    if (!writing) {
        writing = (async () => {
            try {
                while (writes.size) {
                    const [key, row] = writes.entries().next().value;
                    if (row) await ra2Store.write(row);
                    else await ra2Store.remove(key);
                    if (writes.get(key) === row) writes.delete(key);
                }
                saveAlert.hidden = true;
            } catch {
                saveAlert.hidden = false;
                saveAlert.textContent = '无法保存 RA2 数据，请不要关闭页面。';
            } finally { writing = undefined; }
        })();
    }
    return writing;
}
const persistentPath = path => typeof path === 'string' && (path === '/config.toml' || /^\/(retail|saves)\/.+/.test(path)) && !path.slice(1).split('/').some(p => !p || p === '.' || p === '..');
function queue(path, row) { if (persistentPath(path)) { writes.set(path, row); void flushRa2(); } }
window.addEventListener('beforeunload', event => {
    if (writes.size) { event.preventDefault(); event.returnValue = ''; }
});
function requestDisplay() {
    const attempt = fn => {try { return Promise.resolve(fn()).catch(() => {}); } catch { return Promise.resolve(); }};
    if (globalThis.toy?.setContainerMode) void attempt(() => globalThis.toy.setContainerMode({orientation:'landscape',immersive:true}));
    const root = document.documentElement;
    if (root.requestFullscreen && !document.fullscreenElement) void attempt(() => root.requestFullscreen({keyboardLock:'browser'}));
}
async function endRa2(canvas, error) {
    running = false; ended = true; canvas?.remove();
    document.body.classList.remove('playing'); sync();
    if (writes.size) await flushRa2();
    inform(error ? '原版游戏未能启动：' + error : '原版游戏已退出。', !!error);
    byId('ra2-reset').hidden = false;
    byId('ra2-reset').textContent = writes.size ? '重试保存并返回' : '返回版本选择';
}
byId('ra2-reset').onclick = async () => {
    if (writes.size) await flushRa2();
    if (!writes.size) location.reload();
};
async function launchRa2() {
    if (!ra2Engine || !ra2Entries.length || running || ended) return;
    const engine = ra2Engine;
    running = true; sync();
    let canvas;
    try {
        requestDisplay();
        engine.prepare_audio();
        inform('正在读取原版游戏资源…');
        ra2Store ||= globalThis.createVeraStorage('vera20k-toy-ra2-layout-d6c75d57', {migrateLegacy:false});
        await ra2Store.open();
        let i = 0;
        for (const {path,file} of ra2Entries) {
            engine.import_file(path,new Uint8Array(await file.arrayBuffer()));
            inform('正在读取原版游戏资源… ' + ++i + '/' + ra2Entries.length);
            await new Promise(resolve => setTimeout(resolve, 0));
        }
        void engine.probe_ra2();
        for (const row of await ra2Store.users()) engine.restore_user_file(row.path,row.bytes,row.modified_ms,!!row.deleted);
        engine.set_persistence_callbacks(
            (path,bytes,modified_ms) => queue(path,{path,bytes:bytes.slice(),modified_ms}),
            path => queue(path,null),
        );
        canvas = document.createElement('canvas'); canvas.tabIndex = 0; byId('game').append(canvas);
        engine.set_lifecycle_callback(event => {
            if (event?.type === 'engine-ready') { document.body.classList.add('playing'); canvas.focus({preventScroll:true}); }
            else if (event?.type === 'engine-error' || event?.type === 'engine-exited') {
                void endRa2(canvas, event.type === 'engine-error' || event.reason === 'error' ? event.error || byId('status').textContent : '');
            }
        });
        engine.start_ra2(canvas,message => { byId('status').textContent = message; });
    } catch(error) { await endRa2(canvas, String(error.message || error)); }
}
selector.addEventListener('change', () => {
    sync();
    if (launchMode() === 'ra2') void preloadRa2();
});
start.onclick = () => {
    if (start.disabled) return;
    if (launchMode() === 'ra2') void launchRa2();
    else if (!nativeYrStart.disabled && typeof nativeYrStart.onclick === 'function') {
        yrRequested = true; void nativeYrStart.onclick(); sync();
    }
};
selector.querySelector('input[value=yr]').checked = true;
nativeYrStart.hidden = true;
new MutationObserver(sync).observe(nativeYrStart,{attributeFilter:['disabled']});
new MutationObserver(sync).observe(document.body,{attributeFilter:['class']});
sync();
