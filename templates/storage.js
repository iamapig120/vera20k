// One IndexedDB owner for imported retail blobs and user-written virtual files.
function createVeraStorage(name='vera20k-web',{timeoutMs=20000}={}) {
 let database,opening;
 async function open(){
  if(database)return;
  if(opening)return opening;
  opening=new Promise((resolve,reject)=>{
   let expired=false;
   const req=indexedDB.open(name,1);
   const fail=error=>{expired=true;clearTimeout(timer);reject(error);};
   const timer=setTimeout(()=>fail(Error('打开本机存储超时，请重试或重新选择目录')),timeoutMs);
   req.onblocked=()=>fail(Error('本机存储升级被其他页面占用，请关闭旧页面后重试'));
   req.onerror=()=>fail(req.error);
   req.onupgradeneeded=()=>{if(expired){req.transaction.abort();return;}for(const store of ['users','library'])req.result.createObjectStore(store);};
   req.onsuccess=()=>{
    if(expired){req.result.close();return;}
    clearTimeout(timer);database=req.result;
    const connection=database;
    connection.onversionchange=()=>{connection.close();if(database===connection)database=null;};
    resolve();
   };
  });
  try{await opening;}finally{opening=null;}
 }
 async function transaction(store,mode,work){
  await open();
  const tx=database.transaction(store,mode);
  return new Promise((resolve,reject)=>{
   let settled=false,result;
   const finish=error=>{if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve(result);};
   const timer=setTimeout(()=>{
    finish(Error('本机存储读写超时，请重试'));
    try{tx.abort();}catch{}
   },timeoutMs);
   tx.oncomplete=()=>finish();
   tx.onabort=()=>finish(tx.error||Error('存储事务已取消'));
   tx.onerror=()=>{};
   try{result=work(tx.objectStore(store));}
   catch(error){try{tx.abort();}catch{}finish(error);}
  });
 }
 return {
  open,
  async users(){let rows;await transaction('users','readonly',store=>{store.getAll().onsuccess=e=>{rows=e.target.result;};});return rows;},
  write(row){return transaction('users','readwrite',store=>store.put(row,row.path));},
  remove(path){return transaction('users','readwrite',store=>store.put({path,bytes:new Uint8Array(),deleted:true,modified_ms:Date.now()},path));},
  async library(){let value;await transaction('library','readonly',store=>{store.get('current').onsuccess=e=>{value=e.target.result;};});return value;},
  clearLibrary(){return transaction('library','readwrite',store=>store.delete('current'));},
  saveLibrary(folder,files){return transaction('library','readwrite',store=>store.put({folder,files},'current'));},
  // Merge backup entries atomically. Existing unrelated settings/saves survive.
  importUsers(rows){return transaction('users','readwrite',store=>{for(const row of rows)store.put(row,row.path);});},
  close(){database?.close();database=null;}
 };
}
globalThis.createVeraStorage=createVeraStorage;
globalThis.VeraStorage=createVeraStorage();
