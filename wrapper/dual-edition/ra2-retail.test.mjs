import assert from 'node:assert/strict';
import test from 'node:test';
import {ownedRa2Entries,isRa2RetailPath} from './ra2-retail.mjs';
const f=(name,size=1)=>({name,size});
const root=[f('RA2.MIX'),f('LANGUAGE.MIX'),f('MULTI.MIX')];
test('original RA2 alone: original theater and nested movies, case insensitive',()=>{
 const names=['Game/RA2.MIX','game/LANGUAGE.MIX','GAME/MULTI.MIX','gAmE/MIXFILES/MoViEs01.MIX','game/TEMPERAT.MIX'];
 const entries=ownedRa2Entries(names.map(webkitRelativePath=>({name:webkitRelativePath.split('/').at(-1),webkitRelativePath,size:1})));
 assert.deepEqual(entries.map(row=>row.path.toLowerCase()),['ra2.mix','language.mix','multi.mix','mixfiles/movies01.mix','temperat.mix']);
});
test('strict allowlist discards YR and unrelated oversized files before byte budgets',()=>{
 const ignored=['ra2md.mix','langmd.mix','AUDIOmd.mix','EXPANDMD12.MIX','mapsmd03.mix','movmd03.mix','ECACHEMD.MIX','ELOCALMD22.MIX','coopcampmd.ini','ra2md.csf','rules.ini','other.mix','GAME.EXE'];
 const result=ownedRa2Entries([...root,f('ECACHE01.MIX'),...ignored.map(n=>f(n, 3*1024**3))],4);
 assert.deepEqual(result.map(row=>row.path),['RA2.MIX','LANGUAGE.MIX','MULTI.MIX','ECACHE01.MIX']);
 assert(ignored.every(n=>!isRa2RetailPath(n)));
});
test('missing classic multi is an explicit failure even if YR multi was selected',()=>{
 assert.throws(()=>ownedRa2Entries([root[0],root[1],f('MULTIMD.MIX')]),/multi\.mix/);
});
test('owned-file validation still rejects duplicates, ambiguous roots and oversized retained inputs',()=>{
 assert.throws(()=>ownedRa2Entries([...root,f('language.mix')]),/重复/);
 assert.throws(()=>ownedRa2Entries([...root,f('other/ra2.mix')]),/多套资源/);
 assert.throws(()=>ownedRa2Entries([...root, f('movies01.mix', 1024**3+1)]),/过大/);
 assert.throws(()=>ownedRa2Entries(root,2),/超过/);
 assert.throws(()=>ownedRa2Entries(root.map(({name,size})=>({name,size,webkitRelativePath:'../'+name}))),/路径/);
});
