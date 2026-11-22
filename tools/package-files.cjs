const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {inventory,checkImports,checkSourceLink}=require('./package-preflight.cjs');
const root=path.resolve(process.argv[2]);
const source=process.argv[3],engine=process.argv[4];
const names=['index.html','launcher.css','launcher.js','storage.js','user-data.mjs','resources.mjs','fullscreen.mjs','lobby.js','network.js','LICENSE-GPL','assets/RA2MD.png','build-info.txt'];
if(fs.existsSync(path.join(root,'LICENSES')))names.push(...inventory(path.join(root,'LICENSES')).map(entry=>'LICENSES/'+entry.path));
for(const entry of inventory(path.join(root,'pkg'))){
 assert(!/\.(?:mix|csf|sav|fnt|bik|vqa|bag|aud|wav|mp3|mp4|exe|dll|pem|key|pfx)$/i.test(entry.path),'Unexpected retail/private payload');
 names.push('pkg/'+entry.path);
}
for(const name of names){
 assert(!/[\r\n]/.test(name),'Unexpected newline in filename');
 const file=path.join(root,name),stat=fs.lstatSync(file);
 assert(stat.isFile()&&!stat.isSymbolicLink(),'Missing file or symlink: '+name);
}
checkImports(root);
checkSourceLink(fs.readFileSync(path.join(root,'build-info.txt'),'utf8'),source,engine);
process.stdout.write(names.join('\n')+'\n');
