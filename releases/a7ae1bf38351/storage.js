// New stores are independent of legacy databases, which are only read during migration.
function createVeraStorage(name='vera20k-web-v2',{timeoutMs=20000,migrateLegacy=name==='vera20k-web-v2',legacyNames={users:'vera20k-wasm-user-data',library:'vera20k-pr3139-resource-library',upstream:'vera20k-web'}}={}) {
 const connections=new Map(),opening=new Map(),migration=new Map();
 const marker='legacy-copy-v1';
 const validPath=path=>typeof path==='string'&&path.length<=1024&&!/[\\:\x00-\x1f\x7f]/.test(path)&&(path==='/config.toml'||/^\/(retail|saves)\/.+/.test(path))&&!path.slice(1).split('/').some(part=>!part||part==='.'||part==='..');
 function userRow(row){
  const modified_ms=row?.modified_ms??row?.modified;
  const bytes=row?.bytes instanceof Uint8Array?row.bytes:row?.bytes instanceof ArrayBuffer?new Uint8Array(row.bytes):null;
  if(!validPath(row?.path)||!bytes||bytes.byteLength>128*1024**2||!Number.isSafeInteger(modified_ms)||modified_ms<0||(row.deleted!==undefined&&typeof row.deleted!=='boolean'))throw Error('设置或存档记录无效；原数据保留');
  return {path:row.path,bytes,modified_ms,...(row.deleted?{deleted:true}:{})};
 }
 async function database(kind){
  if(connections.has(kind))return connections.get(kind);
  if(opening.has(kind))return opening.get(kind);
  const promise=new Promise((resolve,reject)=>{
   let expired=false;
   const req=indexedDB.open(`${name}-${kind}`,1);
   const fail=error=>{expired=true;clearTimeout(timer);reject(error);};
   const timer=setTimeout(()=>fail(Error('打开本机存储超时，请关闭旧页面后重试')),timeoutMs);
   req.onblocked=()=>fail(Error('本机存储被其他页面占用，请关闭旧页面后重试'));
   req.onerror=()=>fail(req.error||Error('无法打开本机存储'));
   req.onupgradeneeded=()=>{
    if(expired){req.transaction.abort();return;}
    req.result.createObjectStore(kind);req.result.createObjectStore('meta');
   };
   req.onsuccess=()=>{
    if(expired){req.result.close();return;}
    clearTimeout(timer);const db=req.result;
    db.onversionchange=()=>{db.close();connections.delete(kind);};
    connections.set(kind,db);resolve(db);
   };
  });
  opening.set(kind,promise);
  try{return await promise;}finally{opening.delete(kind);}
 }
 async function transaction(kind,mode,work){
  const db=await database(kind),tx=db.transaction([kind,'meta'],mode);
  return new Promise((resolve,reject)=>{
   let settled=false,result;
   const finish=error=>{if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve(result);};
   const fail=error=>{try{tx.abort();}catch{}finish(error);};
   const timer=setTimeout(()=>fail(Error('本机存储读写超时，请重试；旧记录保留')),timeoutMs);
   const guard=callback=>event=>{try{callback(event);}catch(error){fail(error);}};
   tx.oncomplete=()=>finish();tx.onabort=()=>finish(tx.error||Error('存储事务已取消，旧记录保留'));tx.onerror=()=>{};
   try{work({data:tx.objectStore(kind),meta:tx.objectStore('meta'),done:value=>{result=value;},guard});}catch(error){fail(error);}
  });
 }
 // Opening without a version cannot upgrade existing legacy data; abort absent databases.
 async function legacy(databaseName,storeName,key){
  return new Promise((resolve,reject)=>{
   let db,missing=false,settled=false;
   const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);db?.close();error?reject(error):resolve(value);};
   const timer=setTimeout(()=>finish(Error('读取旧数据超时；未修改旧数据库')),timeoutMs);
   const req=indexedDB.open(databaseName);
   req.onupgradeneeded=()=>{missing=true;req.transaction.abort();};
   req.onblocked=()=>finish(Error('旧数据被其他页面占用，请关闭旧页面后重试'));
   req.onerror=()=>finish(missing?null:req.error);
   req.onsuccess=()=>{
    db=req.result;if(settled){db.close();return;}
    if(!db.objectStoreNames.contains(storeName)){finish(null);return;}
    const tx=db.transaction(storeName,'readonly'),store=tx.objectStore(storeName);let value;
    const read=key===undefined?store.getAll():store.get(key);
    read.onsuccess=()=>{value=read.result;};
    tx.oncomplete=()=>finish(null,value);tx.onabort=()=>finish(tx.error||Error('读取旧数据失败'));tx.onerror=()=>{};
   };
  });
 }
 async function migrate(kind){
  if(!migrateLegacy)return;
  if(migration.has(kind))return migration.get(kind);
  const promise=(async()=>{
   const complete=await transaction(kind,'readonly',({meta,done})=>{meta.get(marker).onsuccess=e=>done(e.target.result);});
   if(complete)return;
   let copied;
   if(kind==='users'){
    const [original,upstream]=await Promise.all([legacy(legacyNames.users,'files'),legacy(legacyNames.upstream,'users')]);
    const rows=new Map();let bytes=0;
    for(const source of [original||[],upstream||[]])for(const item of source){
     const row=userRow(item);bytes+=row.bytes.byteLength;
     if(rows.size>=12000||bytes>256*1024**2)throw Error('旧用户数据超过迁移限制；原数据库保留');
     if(!rows.has(row.path)||rows.get(row.path).modified_ms<row.modified_ms)rows.set(row.path,row);
    }
    copied=[...rows.values()];
   }else{
    const original=await legacy(legacyNames.library,'library','current');
    const upstream=original?null:await legacy(legacyNames.upstream,'library','current');
    const library=original||upstream;
    if(library){
     if(!Array.isArray(library.files)||library.files.length>12000)throw Error('旧资源缓存格式无效；原缓存保留');
     let total=0;const paths=new Set();
     const files=library.files.map(entry=>{
      const path=entry.path,blob=entry.file??entry.blob;
      if(typeof path!=='string'||path.length>1024||/[\\:\x00-\x1f\x7f]/.test(path)||path.split('/').some(part=>!part||part==='.'||part==='..')||!(blob instanceof Blob)||blob.size>1024**3)throw Error('旧资源缓存条目无效；原缓存保留');
      const key=path.normalize('NFC').toLowerCase();if(paths.has(key))throw Error('旧资源缓存有重复路径');paths.add(key);
      total+=blob.size;if(total>2*1024**3)throw Error('旧资源缓存超过大小限制');
      return {path,file:blob instanceof File?blob:new File([blob],path.split('/').at(-1),{type:blob.type,lastModified:0})};
     });
     copied={folder:String(library.folder??library.label??'已迁移资源').slice(0,160),files};
    }
   }
   // The marker and copied data commit together; retries never overwrite newer records.
   await transaction(kind,'readwrite',({data,meta,guard})=>{
    meta.get(marker).onsuccess=guard(event=>{
     if(event.target.result)return;
     if(kind==='users')data.getAllKeys().onsuccess=guard(event=>{
      const existing=new Set(event.target.result);for(const row of copied)if(!existing.has(row.path))data.put(row,row.path);
      meta.put(true,marker);
     });
     else data.get('current').onsuccess=guard(event=>{if(!event.target.result&&copied)data.put(copied,'current');meta.put(true,marker);});
    });
   });
  })();
  migration.set(kind,promise);
  try{await promise;}catch(error){migration.delete(kind);throw error;}
 }
 async function open(){await database('users');await migrate('users');}
 async function libraryReady(){await database('library');await migrate('library');}
 return {
  open,
  async users(){await open();return transaction('users','readonly',({data,done,guard})=>{data.getAll().onsuccess=guard(e=>done(e.target.result.map(userRow)));});},
  async write(row){await open();const checked=userRow(row);return transaction('users','readwrite',({data})=>data.put(checked,checked.path));},
  remove(path){return this.write({path,bytes:new Uint8Array(),modified_ms:Date.now(),deleted:true});},
  async library(){await libraryReady();return transaction('library','readonly',({data,done})=>{data.get('current').onsuccess=e=>done(e.target.result);});},
  async clearLibrary(){await libraryReady();return transaction('library','readwrite',({data})=>data.delete('current'));},
  async saveLibrary(folder,files){await libraryReady();return transaction('library','readwrite',({data})=>data.put({folder,files},'current'));},
  async importUsers(rows){
   if(!Array.isArray(rows)||rows.length>12000)throw Error('备份条目数量无效');
   const checked=rows.map(userRow);if(checked.reduce((n,row)=>n+row.bytes.byteLength,0)>256*1024**2)throw Error('备份数据过大');
   await open();return transaction('users','readwrite',({data})=>{for(const row of checked)data.put(row,row.path);});
  },
  close(){for(const db of connections.values())db.close();connections.clear();migration.clear();}
 };
}
globalThis.createVeraStorage=createVeraStorage;
globalThis.VeraStorage=createVeraStorage();
