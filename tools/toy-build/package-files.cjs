// Keep wasm-bindgen's snippets and import.meta.url-relative fonts intact.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
function packageDependencies(input){
 const files=[];
 for(const folder of ['pkg/snippets','pkg/fonts']){
  const root=path.join(input,folder);if(!fs.existsSync(root))continue;
  const visit=(directory)=>{for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
   const full=path.join(directory,entry.name);assert(!entry.isSymbolicLink(),'Unexpected package symlink: '+full);
   if(entry.isDirectory()){visit(full);continue;}
   const relative=path.relative(input,full).replaceAll('\\','/');
   assert(entry.isFile(),'Unexpected package entry: '+relative);
   const allowed=folder.endsWith('snippets')?entry.name.endsWith('.js'):/\.(ttf|otf|bin)$/.test(entry.name)||/^OFL.*\.txt$/.test(entry.name);
   assert(allowed,'Unexpected runtime package file: '+relative);files.push(relative);
  }};visit(root);
 }
 const bindings=fs.readFileSync(path.join(input,'pkg/vera20k.js'),'utf8');
 if(/\bfonts_ready\b/.test(bindings)){
  for(const file of ['NotoSans-VF.ttf','Unifont-CJK-15.bin','OFL.txt','OFL-CJK.txt','OFL-Unifont.txt'])
   assert(files.includes('pkg/fonts/'+file),'Missing upstream font dependency: '+file);
  assert(files.some(file=>file.startsWith('pkg/snippets/')),'Missing wasm-bindgen snippets');
 }
 return files.sort();
}
module.exports={packageDependencies};
if(require.main===module)process.stdout.write(packageDependencies(path.resolve(process.argv[2])).join('\n')+'\n');
