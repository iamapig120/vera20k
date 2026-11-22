const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');

test('package membership keeps complete generated pkg and rejects missing imports or retail payloads',()=>{
 const base=path.join(root,'.build');fs.mkdirSync(base,{recursive:true});
 const stage=fs.mkdtempSync(path.join(base,'synthetic-package-'));
 const put=(name,value)=>{const target=path.join(stage,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,value);};
 for(const name of ['index.html','launcher.css','launcher.js','storage.js','user-data.mjs','resources.mjs','fullscreen.mjs','lobby.js','network.js','LICENSE-GPL','assets/RA2MD.png'])put(name,'');
 const source='a'.repeat(40),engine='79edebfa25eb3411105117409a3363497e4529b6';
 put('build-info.txt',`SYNTHETIC FIXTURE ONLY\nRevision: ${engine}\nWeb integration: ${source}\n`);
 put('pkg/vera20k.js',"import './snippets/example/screenshot.js';\n");
 put('pkg/vera20k_bg.wasm',Buffer.from([0,97,115,109,1,0,0,0]));
 put('pkg/snippets/example/screenshot.js','export const fixture=true;');
 put('pkg/fonts/example.bin','SYNTHETIC FONT TABLE');put('pkg/fonts/OFL-test.txt','SYNTHETIC NOTICE');
 put('pkg/extra-generated/support.txt','SYNTHETIC EXTRA OUTPUT');put('LICENSES/fixture.txt','SYNTHETIC NOTICE');
 const run=()=>spawnSync(process.execPath,['--experimental-vm-modules',path.join(root,'tools/package-files.cjs'),stage,source,engine],{encoding:'utf8'});
 const passed=run();assert.equal(passed.status,0,passed.stderr);
 const names=passed.stdout.trim().split(/\r?\n/);
 for(const name of ['user-data.mjs','pkg/snippets/example/screenshot.js','pkg/fonts/example.bin','pkg/fonts/OFL-test.txt','pkg/extra-generated/support.txt','LICENSES/fixture.txt'])assert(names.includes(name),name);
 fs.unlinkSync(path.join(stage,'pkg/snippets/example/screenshot.js'));assert.notEqual(run().status,0);
 put('pkg/snippets/example/screenshot.js','export const fixture=true;');
 put('pkg/retail.mix','SYNTHETIC FORBIDDEN NAME');assert.notEqual(run().status,0);
});
