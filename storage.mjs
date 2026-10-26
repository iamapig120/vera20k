// Resource-library replacement is one transaction; legacy user files have a separate owner.
export function createStorage({resourceName = 'vera20k-pr3139-resource-library', userName = 'vera20k-wasm-user-data', timeoutMs = 20000} = {}) {
  const connections = new Map(), opening = new Map();
  async function open(name, store, options) {
    if (connections.has(name)) return connections.get(name);
    if (opening.has(name)) return opening.get(name);
    const promise = new Promise((resolve, reject) => {
      const req = indexedDB.open(name, 1); let expired = false;
      const fail = error => { expired = true; clearTimeout(timer); reject(error); };
      const timer = setTimeout(() => fail(Error('打开本机存储超时，请关闭其他旧页面后重试')), timeoutMs);
      req.onblocked = () => fail(Error('本机存储被其他页面占用，请关闭旧页面后重试'));
      req.onerror = () => fail(req.error || Error('无法打开本机存储'));
      req.onupgradeneeded = () => { if (expired) req.transaction.abort(); else req.result.createObjectStore(store, options); };
      req.onsuccess = () => {
        if (expired) { req.result.close(); return; }
        clearTimeout(timer); const db = req.result;
        db.onversionchange = () => { db.close(); connections.delete(name); };
        connections.set(name, db); resolve(db);
      };
    });
    opening.set(name, promise);
    try { return await promise; } finally { opening.delete(name); }
  }
  async function transaction(kind, mode, work) {
    const name = kind === 'users' ? userName : resourceName, storeName = kind === 'users' ? 'files' : 'library';
    const db = await open(name, storeName, kind === 'users' ? {keyPath: 'path'} : undefined);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode); let value, settled = false;
      const finish = error => { if (settled) return; settled = true; clearTimeout(timer); error ? reject(error) : resolve(value); };
      const timer = setTimeout(() => { try { tx.abort(); } catch {} finish(Error('本机存储读写超时，请重试')); }, timeoutMs);
      tx.oncomplete = () => finish();
      tx.onerror = () => {};
      tx.onabort = () => finish(tx.error || Error('存储事务失败，原数据未被替换'));
      try { work(tx.objectStore(storeName), v => { value = v; }); }
      catch (error) { try { tx.abort(); } catch {} finish(error); }
    });
  }
  return {
    library: () => transaction('resources', 'readonly', (store, done) => { store.get('current').onsuccess = e => done(e.target.result); }),
    saveLibrary: value => transaction('resources', 'readwrite', store => store.put(value, 'current')),
    users: () => transaction('users', 'readonly', (store, done) => { store.getAll().onsuccess = e => done(e.target.result); }),
    writeUser: row => transaction('users', 'readwrite', store => store.put(row)),
    removeUser: path => transaction('users', 'readwrite', store => store.delete(path)),
    close() { for (const db of connections.values()) db.close(); connections.clear(); }
  };
}
