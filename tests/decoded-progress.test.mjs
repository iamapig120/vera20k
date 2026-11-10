import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {brotliCompressSync,brotliDecompressSync} from 'node:zlib';
import {loadRemoteProfile} from '../templates/resources.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
for(const exposed of [false,true])test(`decoded resource progress uses manifest size, Content-Encoding exposed=${exposed}`,async()=>{
 const decoded=Buffer.alloc(65536,65),wire=brotliCompressSync(decoded),events=[];
 const row={path:'test.mix',url:'https://cdn.example/test.br',size:decoded.length,sha256:hash(decoded)};
 const remote={profiles:new Map([['test',[row]]])};
 const result=await loadRemoteProfile(remote,'test',{onProgress:e=>events.push(e),fetchImpl:async()=>new Response(brotliDecompressSync(wire),{headers:{'Content-Length':String(wire.length),...(exposed?{'Content-Encoding':'br'}:{})}})});
 assert.equal(hash(Buffer.from(await result[0].blob.arrayBuffer())),row.sha256);
 const bytes=events.filter(e=>e.decoded);assert(bytes.length);assert(bytes.every(e=>e.total===decoded.length&&e.loaded<=e.total));assert.equal(bytes.at(-1).loaded,decoded.length);
 await loadRemoteProfile(remote,'test',{cached:result,fetchImpl:()=>assert.fail('verified cache should not fetch')});
 await assert.rejects(loadRemoteProfile(remote,'test',{fetchImpl:async()=>new Response(Buffer.alloc(decoded.length,66),{headers:{'Content-Length':String(wire.length)}})}));
});
