const profiles=new Map(['VERA.INI','VERARULES.INI','RA2MD.INI','KeyboardMD.ini','wolinfoMD.ini','coopsave.ini']
 .map(name=>[name.toLowerCase(),name]));

export function planUserRestore(rows){
 const chosen=new Map(),retained=[];
 for(const row of rows){
  const legacy=/^\/retail\/([^/]+)$/i.exec(row.path);
  const current=/^\/saves\/profile\/([^/]+)$/i.exec(row.path);
  const profile=profiles.get((legacy?.[1]??current?.[1]??'').toLowerCase());
  if(!row.path.startsWith('/saves/')&&!(legacy&&profile)){retained.push(row.path);continue;}
  const path=profile?'/saves/profile/'+profile:row.path;
  const candidate={...row,path,legacy:!!legacy,source:row.path,profile};
  const previous=chosen.get(path);
  // Explicit profile records win over legacy aliases, including deletions.
  if(!previous||Number(candidate.legacy)<Number(previous.legacy)||
   candidate.legacy===previous.legacy&&(candidate.modified_ms>previous.modified_ms||
    candidate.modified_ms===previous.modified_ms&&(Number(!!candidate.deleted)>Number(!!previous.deleted)||
     !!candidate.deleted===!!previous.deleted&&candidate.source<previous.source)))chosen.set(path,candidate);
 }
 const imports=[],files=[];
 for(const row of chosen.values()){
  if(row.deleted&&!row.profile)continue;
  const bytes=row.deleted?new Uint8Array():row.bytes;
  if(row.profile==='RA2MD.INI'||row.profile==='KeyboardMD.ini'){
   // The upstream profile importer merges these retail inputs into VERA.INI.
   imports.push({name:row.profile,bytes});
  }else{
   // An empty deleted profile prevents importing old retail preferences again.
   files.push({path:row.path,bytes,modified_ms:row.modified_ms});
  }
 }
 return {imports,files,retained};
}
