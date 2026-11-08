// Bundle the browser helpers; keep wasm-bindgen external so its import.meta.url stays in pkg/.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const esbuild=require(process.env.VERA_ESBUILD_PATH||'esbuild');
const config=require('./release.json');
const manifestUrl=process.env.VERA_TOY_MANIFEST_URL||config.manifestUrl;
const {releaseLauncher,releaseHtml,manifestOnlyResources}=require('./release.cjs');
async function main(){
 const [inputArg,outputArg,metadataArg]=process.argv.slice(2);
 if(!inputArg||!outputArg||!metadataArg)throw Error('Usage: node build.cjs INPUT_SITE NEW_OUTPUT_SITE METADATA_JSON');
 const input=path.resolve(inputArg),output=path.resolve(outputArg);
 assert(!fs.existsSync(output),'Refusing to overwrite an existing output directory');
 const files=['index.html','launcher.css','storage.js','lobby.js','network.js','LICENSE-GPL','build-info.txt','assets/RA2MD.png','pkg/vera20k.js','pkg/vera20k_bg.wasm'];
 for(const name of files)assert(fs.statSync(path.join(input,name)).isFile(),name);
 const built=await esbuild.build({
  entryPoints:[path.join(input,'launcher.js')],bundle:true,format:'esm',platform:'browser',
  target:'es2022',minify:true,legalComments:'eof',write:false,metafile:true,
  outfile:path.join(output,'launcher.js'),external:['./pkg/*'],
  plugins:[{name:'toy-profile',setup(build){
   build.onResolve({filter:/^\..*\.mjs(?:\?.*)?$/},args=>({path:path.resolve(args.resolveDir,args.path.split('?')[0])}));
   build.onLoad({filter:/launcher\.js$/},args=>({contents:releaseLauncher(fs.readFileSync(args.path,'utf8').replaceAll('\r\n','\n'),manifestUrl),loader:'js',resolveDir:path.dirname(args.path)}));
   build.onLoad({filter:/resources\.mjs$/},args=>({contents:manifestOnlyResources(fs.readFileSync(args.path,'utf8')),loader:'js',resolveDir:path.dirname(args.path)}));
  }}],
 });
 assert.deepEqual(built.warnings,[]);
 const contents=built.outputFiles[0].contents,code=Buffer.from(contents).toString();
 assert(!code.includes('.mjs'),'A runtime mjs reference survived bundling');
 const imports=Object.values(built.metafile.outputs).flatMap(row=>row.imports);
 assert.equal(imports.length,1);
 assert(imports[0].external&&/^\.\/pkg\/vera20k\.js(?:\?|$)/.test(imports[0].path));
 const inputs=Object.keys(built.metafile.inputs);
 for(const name of ['launcher.js','resources.mjs','runtime.mjs','fullscreen.mjs'])assert(inputs.some(p=>p.endsWith(name)),name);
 const filename='launcher.'+crypto.createHash('sha256').update(contents).digest('hex').slice(0,16)+'.js';
 fs.mkdirSync(output,{recursive:true});
 for(const name of files){const destination=path.join(output,name);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.copyFileSync(path.join(input,name),destination);}
 let html=releaseHtml(fs.readFileSync(path.join(output,'index.html'),'utf8')),replacements=0;
 html=html.replace(/\.\/launcher\.js(?:\?v=[a-f0-9]+)?/g,()=>{replacements++;return './'+filename;});
 assert.equal(replacements,1);assert(!html.includes('.mjs'));
 fs.writeFileSync(path.join(output,'index.html'),html);
 fs.writeFileSync(path.join(output,filename),contents);
 fs.appendFileSync(path.join(output,'build-info.txt'),'\nToy helpers bundled with esbuild '+esbuild.version+'; no runtime .mjs files.\nCorresponding source: https://github.com/iamapig120/vera20k/tree/web-ondemand-toy-20261108\n');
 const metadata={esbuild:esbuild.version,filename,inputFiles:inputs,externalImports:imports,wasmSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(output,'pkg/vera20k_bg.wasm'))).digest('hex'),metafile:built.metafile};
 fs.writeFileSync(path.resolve(metadataArg),JSON.stringify(metadata,null,2)+'\n');
 console.log(JSON.stringify({output,filename,esbuild:esbuild.version,wasmSha256:metadata.wasmSha256}));
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>esbuild.stop());
