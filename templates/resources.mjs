// ZIP32 layout: PKWARE APPNOTE 4.3.7, 4.3.12 and 4.3.16. No scripts are executed.
export const LIMITS = Object.freeze({ archive: 2 * 1024 ** 3, total: 2 * 1024 ** 3,
  entry: 1024 ** 3, entries: 12000, directory: 32 * 1024 ** 2, depth: 32 });
export const REQUIRED = ['ra2.mix', 'ra2md.mix', 'mapsmd03.mix'];
const crcTable = Uint32Array.from({length: 256}, (_, n) => {
  for (let i = 0; i < 8; i++) n = n & 1 ? (n >>> 1) ^ 0xedb88320 : n >>> 1;
  return n >>> 0;
});
export function crc32(bytes, previous = 0) {
  let value = previous ^ -1;
  for (const byte of bytes) value = crcTable[(value ^ byte) & 255] ^ (value >>> 8);
  return (value ^ -1) >>> 0;
}
function check(signal) { signal?.throwIfAborted(); }
export function safePath(value, limits = LIMITS) {
  if (typeof value !== 'string' || !value || value.length > 1024 || /[\x00-\x1f\x7f:]/.test(value)) throw Error('资源路径无效');
  const path = value.replaceAll('\\', '/').normalize('NFC');
  const parts = path.replace(/\/$/, '').split('/');
  if (path.startsWith('/') || parts.length > limits.depth || parts.some(p => !p || p === '.' || p === '..')) throw Error(`资源路径不安全：${value}`);
  return parts.join('/');
}
export function libraryFromEntries(entries, label, limits = LIMITS, required = REQUIRED) {
  if (!entries.length || entries.length > limits.entries) throw Error('资源条目为空或数量超过限制');
  const seen = new Set(); let total = 0;
  const valid = entries.map(entry => {
    const path = safePath(entry.path, limits), key = path.toLowerCase();
    if (seen.has(key)) throw Error(`存在重名资源（不区分大小写）：${path}`);
    seen.add(key);
    if (!(entry.blob instanceof Blob) || entry.blob.size > limits.entry) throw Error(`资源过大或无效：${path}`);
    total += entry.blob.size;
    if (total > limits.total) throw Error('资源总大小超过 2 GiB 限制');
    return {path, blob: entry.blob};
  });
  const roots = valid.filter(e => /(^|\/)ra2\.mix$/i.test(e.path)).map(e => e.path.slice(0, -7))
    .filter(root => valid.some(e => e.path.toLowerCase() === `${root}ra2md.mix`.toLowerCase()));
  if (roots.length !== 1) throw Error(roots.length ? '包含多个游戏目录，请只导入一个完整目录' : '缺少 ra2.mix 或 ra2md.mix，请选择完整尤里的复仇资源');
  const root = roots[0], rootKey = root.toLowerCase();
  const files = valid.filter(e => e.path.toLowerCase().startsWith(rootKey)).map(e => ({...e, path: e.path.slice(root.length)}));
  const names = new Set(files.map(e => e.path.toLowerCase()));
  const missing = required.filter(name => !names.has(name));
  if (missing.length) throw Error(`缺少必要资源：${missing.join('、')}`);
  return {label: String(label).slice(0, 160), files, bytes: files.reduce((n, e) => n + e.blob.size, 0), importedAt: Date.now()};
}
export async function entriesFromFolder(files, {signal, limits = LIMITS, onProgress = () => {}} = {}) {
  if (files.length > limits.entries) throw Error('文件条目数量超过限制');
  const entries = [];
  for (const file of files) {
    check(signal);
    entries.push({path: file.webkitRelativePath || file.name, blob: file});
    if (entries.length % 100 === 0) { onProgress({phase: '检查目录', loaded: entries.length, total: files.length}); await new Promise(r => setTimeout(r, 0)); }
  }
  return entries;
}
export async function entriesFromDrop(items, {signal, limits = LIMITS, onProgress = () => {}} = {}) {
  const entries = [];
  // DataTransfer access expires when the drop event returns; capture all handles first.
  const inputs = items.filter(item => item.kind === 'file').map(item => ({entry: item.webkitGetAsEntry?.(), blob: item.getAsFile?.()}));
  const read = action => new Promise((resolve, reject) => {
    const done = (callback, value) => { signal?.removeEventListener('abort', abort); callback(value); };
    const abort = () => done(reject, signal.reason);
    signal?.addEventListener('abort', abort, {once:true});
    if (signal?.aborted) { abort(); return; }
    action(value => done(resolve, value), error => done(reject, error));
  });
  async function visit(entry, prefix, depth) {
    check(signal);
    if (depth > limits.depth) throw Error('目录嵌套超过限制');
    const path = safePath(prefix ? `${prefix}/${entry.name}` : entry.name, limits);
    if (entry.isFile) {
      const blob = await read((resolve, reject) => entry.file(resolve, reject));
      check(signal); entries.push({path, blob});
      if (entries.length > limits.entries) throw Error('文件条目数量超过限制');
      onProgress({phase: '检查目录', loaded: entries.length});
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      for (;;) {
        check(signal);
        const batch = await read((resolve, reject) => reader.readEntries(resolve, reject));
        if (!batch.length) break;
        for (const child of batch) await visit(child, path, depth + 1);
      }
    } else throw Error('无法读取拖入内容，请改用选择文件夹');
  }
  for (const {entry, blob} of inputs) {
    if (entry) await visit(entry, '', 0);
    else if (blob) entries.push({path: blob.name, blob});
  }
  return entries;
}
async function range(blob, start, length) {
  if (!Number.isSafeInteger(start) || start < 0 || length < 0 || start + length > blob.size) throw Error('ZIP 数据被截断');
  return new Uint8Array(await blob.slice(start, start + length).arrayBuffer());
}
function view(bytes) { return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); }
function zipName(bytes) {
  try { return new TextDecoder('utf-8', {fatal: true}).decode(bytes); }
  catch { throw Error('ZIP 文件名不是 UTF-8，请重新压缩为 UTF-8 ZIP 或导入解压后的文件夹'); }
}
async function consume(stream, {signal, max, onChunk = () => {}}) {
  const reader = stream.getReader(), parts = []; let loaded = 0, crc = 0;
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal?.addEventListener('abort', cancel, {once: true});
  try {
    check(signal);
    for (;;) {
      const {value, done} = await reader.read(); check(signal);
      if (done) break;
      loaded += value.byteLength;
      if (loaded > max) throw Error('下载或解压后的实际体积超过限制');
      crc = crc32(value, crc); parts.push(value); onChunk(loaded);
    }
    return {blob: new Blob(parts), loaded, crc};
  } catch (error) { cancel(); throw error; }
  finally { signal?.removeEventListener('abort', cancel); reader.releaseLock(); }
}
export async function entriesFromZip(blob, {signal, limits = LIMITS, onProgress = () => {}} = {}) {
  check(signal);
  if (!(blob instanceof Blob) || blob.size > limits.archive || blob.size < 22) throw Error('ZIP 为空、损坏或超过 2 GiB 限制');
  const first = view(await range(blob, 0, 4)).getUint32(0, true);
  if (first !== 0x04034b50 && first !== 0x06054b50) throw Error('不是标准 ZIP 文件；安装程序和自解压文件不受支持');
  const tailStart = Math.max(0, blob.size - 65557), tail = await range(blob, tailStart, blob.size - tailStart), tv = view(tail);
  let at = -1;
  for (let i = tail.length - 22; i >= 0; i--) {
    if (tv.getUint32(i, true) === 0x06054b50 && i + 22 + tv.getUint16(i + 20, true) === tail.length) { at = i; break; }
  }
  if (at < 0) throw Error('ZIP 目录缺失或文件下载不完整');
  const count = tv.getUint16(at + 10, true), size = tv.getUint32(at + 12, true), offset = tv.getUint32(at + 16, true);
  if (tv.getUint16(at + 4, true) || tv.getUint16(at + 6, true) || tv.getUint16(at + 8, true) !== count) throw Error('不支持分卷 ZIP');
  if (count === 65535 || size === 0xffffffff || offset === 0xffffffff) throw Error('不支持 ZIP64，请分包或导入解压后的文件夹');
  if (count > limits.entries || size > limits.directory) throw Error('ZIP 条目或目录大小超过限制');
  if (offset + size !== tailStart + at) throw Error('ZIP 目录范围无效');
  const directory = await range(blob, offset, size), dv = view(directory), entries = [], seen = new Set();
  let p = 0, total = 0;
  for (let n = 0; n < count; n++) {
    check(signal);
    if (p + 46 > size || dv.getUint32(p, true) !== 0x02014b50) throw Error('ZIP 中央目录损坏');
    const flags = dv.getUint16(p + 8, true), method = dv.getUint16(p + 10, true);
    const compressed = dv.getUint32(p + 20, true), length = dv.getUint32(p + 24, true), local = dv.getUint32(p + 42, true);
    const nameLength = dv.getUint16(p + 28, true), extraLength = dv.getUint16(p + 30, true), commentLength = dv.getUint16(p + 32, true);
    const end = p + 46 + nameLength + extraLength + commentLength;
    if (end > size || dv.getUint16(p + 34, true)) throw Error('ZIP 目录损坏或为分卷格式');
    if (flags & 0x41) throw Error('不支持加密 ZIP，请解密后导入');
    if (![0, 8].includes(method)) throw Error('ZIP 压缩方式不受支持，请使用 Store/Deflate 或导入文件夹');
    if ([compressed, length, local].includes(0xffffffff)) throw Error('不支持 ZIP64');
    if (((dv.getUint32(p + 38, true) >>> 16) & 0xf000) === 0xa000) throw Error('ZIP 不允许符号链接');
    const rawName = zipName(directory.subarray(p + 46, p + 46 + nameLength)), path = safePath(rawName, limits), key = path.toLowerCase();
    if (seen.has(key)) throw Error(`ZIP 中存在重名文件：${path}`);
    seen.add(key);
    const isDirectory = rawName.endsWith('/') || rawName.endsWith('\\');
    if (length > limits.entry || (total += length) > limits.total) throw Error('ZIP 解压体积超过限制');
    if (isDirectory && length) throw Error('ZIP 目录条目无效');
    entries.push({path, isDirectory, flags, method, compressed, length, local, crc: dv.getUint32(p + 16, true)});
    p = end;
  }
  if (p !== size) throw Error('ZIP 目录条目数量不匹配');
  const spans = [];
  for (const entry of entries) {
    check(signal);
    const header = view(await range(blob, entry.local, 30));
    if (header.getUint32(0, true) !== 0x04034b50 || header.getUint16(6, true) !== entry.flags || header.getUint16(8, true) !== entry.method) throw Error('ZIP 本地文件头与目录不匹配');
    const names = header.getUint16(26, true), extra = header.getUint16(28, true);
    if (safePath(zipName(await range(blob, entry.local + 30, names)), limits) !== entry.path) throw Error('ZIP 文件名不一致');
    if (!(entry.flags & 8) && (header.getUint32(14, true) !== entry.crc || header.getUint32(18, true) !== entry.compressed || header.getUint32(22, true) !== entry.length)) throw Error('ZIP 文件大小或校验信息不一致');
    entry.start = entry.local + 30 + names + extra;
    const end = entry.start + entry.compressed;
    if (end > offset) throw Error('ZIP 文件内容越过目录边界');
    spans.push([entry.local, end]);
  }
  spans.sort((a, b) => a[0] - b[0]);
  if (spans.some((span, i) => i && span[0] < spans[i - 1][1])) throw Error('ZIP 文件内容范围重叠');
  let loaded = 0; const result = [];
  for (const entry of entries) {
    check(signal);
    let stream = blob.slice(entry.start, entry.start + entry.compressed).stream();
    if (entry.method === 8) {
      try { stream = stream.pipeThrough(new DecompressionStream('deflate-raw')); }
      catch { throw Error('此浏览器不支持 ZIP 解压，请更新浏览器或导入解压后的文件夹'); }
    }
    let value;
    try { value = await consume(stream, {signal, max: Math.min(entry.length, limits.entry), onChunk: n => onProgress({phase: '解压 ZIP', loaded: loaded + n, total, file: entry.path})}); }
    catch (error) { if (signal?.aborted) throw error; throw Error(`ZIP 无法解压：${entry.path}（${error.message}）`); }
    if (value.loaded !== entry.length || value.crc !== entry.crc) throw Error(`ZIP 文件校验失败：${entry.path}`);
    loaded += value.loaded;
    if (!entry.isDirectory) result.push({path: entry.path, blob: value.blob});
    await new Promise(r => setTimeout(r, 0));
  }
  return result;
}
export async function downloadZip(input, {signal, limits = LIMITS, onProgress = () => {}, timeoutMs = 30000, fetchImpl = fetch, pageUrl = globalThis.location?.href, resourceName = 'ZIP', redirect = 'follow'} = {}) {
  let url;
  try { url = new URL(input); } catch { throw Error('请输入完整 HTTPS ZIP 地址'); }
  const local = value => value.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(value.hostname);
  let development = false;
  try { development = local(new URL(pageUrl)) && local(url); } catch {}
  if ((url.protocol !== 'https:' && !development) || url.username || url.password) throw Error('资源地址必须使用 HTTPS，且不能包含用户名或密码');
  const controller = new AbortController(); let timer, timedOut = false;
  const cancel = () => controller.abort(signal.reason);
  const arm = () => { clearTimeout(timer); timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs); };
  signal?.addEventListener('abort', cancel, {once: true});
  try {
    check(signal); arm();
    const response = await fetchImpl(url.href, {signal: controller.signal, mode: 'cors', credentials: 'omit', referrerPolicy: 'strict-origin-when-cross-origin', redirect});
    if (response.url && new URL(response.url).protocol !== 'https:' && !(development && local(new URL(response.url)))) throw Error('资源地址重定向到了不安全的连接');
    if (!response.ok) throw Error(`下载失败：HTTP ${response.status}`);
    const encoded=!!response.headers.get('Content-Encoding');
    const total = encoded ? 0 : Number(response.headers.get('Content-Length')) || 0;
    if (total > limits.archive) throw Error(`${resourceName} 超过下载大小限制`);
    if (!response.body) throw Error('浏览器无法读取下载内容');
    const result = await consume(response.body, {signal: controller.signal, max: limits.archive, onChunk: loaded => { arm(); onProgress({phase: `${encoded?'接收解压':'下载'} ${resourceName}`, loaded, total,decoded:encoded}); }});
    return result.blob;
  } catch (error) {
    check(signal);
    if (timedOut) throw Error('下载连续 30 秒没有响应，请重试或改用本地 ZIP');
    if (error instanceof TypeError) throw Error('下载被网络或 CORS 限制阻止。请让资源站允许本页面跨域读取，或先下载 ZIP 再从本机导入；本站不提供绕过代理。');
    throw error;
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); }
}

const REMOTE_TYPES = /\.(mix|csf|fnt|shp|pal|ini|map|mpr|mmx|yrm|wav|aud|bik|vxl|hva|tmp|tem|sno|urb|ubn|lun|des|pcx|png|jpg|jpeg|bag|idx|vqp|pkt)$|(?:^|\/)subtitle(?:md)?\.txt$/i;
function remoteUrl(input, base, pageUrl) {
  const url = new URL(input, base);
  const local = value => value.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(value.hostname);
  let development = false;
  try { development = local(new URL(pageUrl)) && local(url); } catch {}
  if ((url.protocol !== 'https:' && !development) || url.username || url.password || url.hash) throw Error('资源地址必须使用 HTTPS，且不能包含凭据或片段');
  return url.href;
}
export async function readRemoteManifest(input, options = {}) {
  const pageUrl = options.pageUrl ?? globalThis.location?.href;
  const source = remoteUrl(input, undefined, pageUrl);
  const blob = await downloadZip(source, {...options, limits: {...LIMITS, archive: 2 * 1024 ** 2}, resourceName: '资源清单', redirect: 'error'});
  const data = JSON.parse(await blob.text());
  if (!data || data.format !== 'vera20k-resources' || data.version !== 1 || !Array.isArray(data.files) || !data.files.length || data.files.length > LIMITS.entries) throw Error('不支持的资源清单');
  const files = new Map(); let total = 0;
  for (const row of data.files) {
    if (!row || typeof row !== 'object') throw Error('无效资源条目');
    const path = safePath(row.path), key = path.toLowerCase();
    if (!REMOTE_TYPES.test(path) || files.has(key) || !Number.isSafeInteger(row.size) || row.size <= 0 || row.size > LIMITS.entry || typeof row.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(row.sha256)) throw Error(`无效资源条目：${path}`);
    total += row.size;
    if (total > LIMITS.total) throw Error('资源清单超过 2 GiB 限制');
    if (typeof row.url !== 'string' || !row.url) throw Error(`缺少资源地址：${path}`);
    files.set(key, {path, size: row.size, sha256: row.sha256.toLowerCase(), url: remoteUrl(row.url, source, pageUrl),duration_seconds:row.duration_seconds,bank:row.bank});
  }
  if (!data.profiles || Array.isArray(data.profiles) || typeof data.profiles !== 'object') throw Error('缺少资源分组');
  const runtime = new Map();
  if (data.runtime !== undefined && (!data.runtime || Array.isArray(data.runtime) || typeof data.runtime !== 'object')) throw Error('无效的运行中资源目录');
  for (const [group, kind, extension] of [['maps','map',/\.(map|mpr|yrm)$/i],['movies','movie',/\.bik$/i],['music','music',/\.wav$/i],['audio','audio',/\.mix$/i],['archives','archive',/\.mix$/i]]) {
    const rows=data.runtime?.[group]??{};
    if (!rows || Array.isArray(rows) || typeof rows!=='object') throw Error('无效的运行中资源分组');
    for (const [logical,path] of Object.entries(rows)) {
      const name=safePath(logical),row=files.get(safePath(path).toLowerCase());
      if (kind==='music'&&(!/\.wav$/i.test(name)||!Number.isSafeInteger(row?.duration_seconds)||row.duration_seconds<0||row.duration_seconds>86400)) throw Error('Invalid music duration metadata');
      if (['audio','archive'].includes(kind)&&(name.includes('/')||!extension.test(name))) throw Error('Expected a root MIX stage');
      if (kind==='audio') {
        const bank=row?.bank;
        if (!bank||Array.isArray(bank)||typeof bank!=='object'||!Number.isSafeInteger(bank.size)||bank.size<=0||bank.size>LIMITS.entry||!['sha256','index_sha256'].every(k=>typeof bank[k]==='string'&&/^[a-f0-9]{64}$/.test(bank[k]))||typeof bank.source_archive!=='string'||safePath(bank.source_archive)!==bank.source_archive||typeof bank.archive_name!=='string'||bank.archive_name.toUpperCase()!==name.toUpperCase()||[...runtime.keys()].some(k=>k.startsWith('audio:'))) throw Error('Invalid selected sound bank metadata');
      }
      if (!row || !extension.test(row.path) || (kind==='map'&&!extension.test(name))) throw Error(`无效的运行中资源：${name}`);
      const id=`${kind}:${(kind==='movie'&&!/\.bik$/i.test(name)?name+'.BIK':name).toUpperCase()}`;
      if(runtime.has(id))throw Error(`重复的运行中资源：${name}`);
      runtime.set(id,row);
    }
  }
  const profiles = new Map(),required=runtime.size?REQUIRED.slice(0,2):REQUIRED;
  for (const [name, paths] of Object.entries(data.profiles)) {
    if (!name || name.length > 80 || !Array.isArray(paths) || !paths.length || paths.length > LIMITS.entries) throw Error('无效资源分组');
    const keys = paths.map(path => safePath(path).toLowerCase());
    if (new Set(keys).size !== keys.length || keys.some(key => !files.has(key)) || required.some(key => !keys.includes(key))) throw Error(`资源分组缺少必要文件或包含无效路径：${name}`);
    profiles.set(name, keys.map(key => files.get(key)));
  }
  if (!profiles.size || profiles.size > 32) throw Error('资源分组数量无效');
  return {label: String(data.label || '远程资源').slice(0, 160), profiles, runtime};
}
export async function loadRemoteProfile(manifest, profile, {cached = [], ...options} = {}) {
  const files = manifest.profiles.get(profile);
  if (!files) throw Error('未知资源分组');
  const digest = async blob => [...new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))].map(byte => byte.toString(16).padStart(2, '0')).join('');
  const previous = new Map(cached.map(row => [row.path.toLowerCase(), row.file ?? row.blob]));
  const result = [];
  for (const row of files) {
    check(options.signal);
    let blob = previous.get(row.path.toLowerCase());
    if (!(blob instanceof Blob) || blob.size !== row.size || await digest(blob) !== row.sha256) {
      blob = await downloadZip(row.url, {...options, limits: {...LIMITS, archive: row.size}, resourceName: row.path, redirect: 'error'});
      if (blob.size !== row.size || await digest(blob) !== row.sha256) throw Error(`资源校验失败：${row.path}`);
    }
    check(options.signal);
    result.push({path: row.path, blob});
    options.onProgress?.({phase: '资源就绪', file: row.path, loaded: result.length, total: files.length});
  }
  return result;
}
