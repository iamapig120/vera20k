import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {readRemoteManifest, loadRemoteProfile} from '../templates/resources.mjs';

const paths = ['ra2.mix', 'ra2md.mix', 'mapsmd03.mix', 'movmd03.mix'];
const bytes = path => Buffer.from(`synthetic fixture: ${path}`);
const sha256 = value => createHash('sha256').update(value).digest('hex');
const manifest = () => ({format: 'vera20k-resources', version: 1, files: paths.map(path => ({
  path, url: `./${path}`, size: bytes(path).length, sha256: sha256(bytes(path))
})), profiles: {skirmish: paths.slice(0, 3), campaign: paths}});

test('staged manifest preserves music metadata and selected bank identity without fetching payloads', async () => {
 const data=manifest();data.runtime={music:{'BULLY.WAV':'music/bully.wav'},audio:{'AUDIOMD.MIX':'audio/audiomd.mix'},archives:{'RA2.MIX':'graphics/ra2.mix'}};
 const bank={size:123,sha256:'1'.repeat(64),index_sha256:'2'.repeat(64),source_archive:'audiomd.mix',archive_name:'AUDIOMD.MIX'};
 for(const row of [{path:'music/bully.wav',duration_seconds:123},{path:'audio/audiomd.mix',bank},{path:'graphics/ra2.mix'}])data.files.push({size:456,sha256:'3'.repeat(64),url:'./payload',...row});
 let requests=0;
 const read=()=>readRemoteManifest('https://cdn.example/manifest.json',{fetchImpl:async()=>{requests++;return new Response(JSON.stringify(data));}});
 const remote=await read();assert.equal(requests,1);assert.equal(remote.runtime.get('music:BULLY.WAV').duration_seconds,123);assert.deepEqual(remote.runtime.get('audio:AUDIOMD.MIX').bank,bank);
 data.files.find(r=>r.duration_seconds).duration_seconds=-1;await assert.rejects(read(),/duration/);
 data.files.find(r=>r.duration_seconds).duration_seconds=123;bank.index_sha256='invalid';await assert.rejects(read(),/bank/);
});

test('real HTTP loads only metadata until requested, then only the selected profile; verified cache avoids requests', async t => {
  const requested = [], data = manifest();
  const server = createServer((request, response) => {
    requested.push(request.url);
    response.end(request.url === '/resources.json' ? JSON.stringify(data) : bytes(request.url.slice(1)));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => {server.closeAllConnections(); server.close();});
  const base = `http://127.0.0.1:${server.address().port}`;
  const options = {pageUrl: `${base}/index.html`};
  const remote = await readRemoteManifest(`${base}/resources.json`, options);
  assert.deepEqual(requested, ['/resources.json']);
  const entries = await loadRemoteProfile(remote, 'skirmish', options);
  assert.deepEqual(requested, ['/resources.json', ...paths.slice(0, 3).map(path => `/${path}`)]);
  assert.deepEqual(entries.map(entry => entry.path), paths.slice(0, 3));
  assert.equal(await entries[0].blob.text(), bytes(paths[0]).toString());
  await loadRemoteProfile(remote, 'skirmish', {...options, cached: entries});
  assert.equal(requested.length, 4);
  await loadRemoteProfile(remote, 'campaign', {...options, cached: entries});
  assert.deepEqual(requested.slice(4), ['/movmd03.mix']);
});

test('untrusted manifests fail before any resource request', async () => {
  const cases = [
    data => {data.files[0] = null;},
    data => {data.files[0].path = '../ra2.mix';},
    data => {data.files[0].url = 'http://cdn.example/ra2.mix';},
    data => {data.files[0].url = 'https://user:secret@cdn.example/ra2.mix';},
    data => {data.files.push({...data.files[0], path: 'RA2.MIX'});},
    data => {data.files[0].path = 'run.js';},
    data => {data.files[0].size = 2 ** 40;},
    data => {data.files[0].sha256 = 'bad';},
    data => {data.profiles.skirmish = ['ra2.mix'];}
  ];
  for (const mutate of cases) {
    const data = manifest(); mutate(data); let requests = 0;
    await assert.rejects(readRemoteManifest('https://cdn.example/resources.json', {
      fetchImpl: async (_url, options) => {
        requests++; assert.equal(options.credentials, 'omit'); assert.equal(options.redirect, 'error');
        return new Response(JSON.stringify(data));
      }
    }));
    assert.equal(requests, 1);
  }
});

test('corrupt cached bytes are refetched; integrity errors and cancellation never yield a partial profile', async () => {
  const remote = await readRemoteManifest('https://cdn.example/resources.json', {
    fetchImpl: async () => new Response(JSON.stringify(manifest()))
  });
  const cached = paths.slice(0, 3).map(path => ({path, blob: new Blob([bytes(path)])}));
  cached[0].blob = new Blob([Buffer.alloc(bytes(paths[0]).length)]);
  const requested = [];
  await loadRemoteProfile(remote, 'skirmish', {cached, fetchImpl: async url => {
    requested.push(url); return new Response(bytes(paths[0]));
  }});
  assert.deepEqual(requested, ['https://cdn.example/ra2.mix']);
  await assert.rejects(loadRemoteProfile(remote, 'skirmish', {fetchImpl: async () => new Response(Buffer.alloc(bytes(paths[0]).length))}), /校验失败/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(loadRemoteProfile(remote, 'skirmish', {signal: controller.signal, fetchImpl: async () => {assert.fail('cancelled request reached network');}}), {name: 'AbortError'});
});
