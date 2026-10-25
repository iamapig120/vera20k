import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import dgram from 'node:dgram';
import { once } from 'node:events';
import WebSocket from 'ws';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createGateway, gatewayOptionsFromEnv } from './server.mjs';

const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
async function fixture(t) {
  const udp = dgram.createSocket('udp4');
  udp.bind(0, '127.0.0.1');
  await once(udp, 'listening');
  const upstream = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', b => chunks.push(b));
    req.on('end', () => res.end(JSON.stringify({ path: req.url, auth: req.headers.authorization, body: Buffer.concat(chunks).toString() })));
  });
  await listen(upstream);
  const staticDir = await mkdtemp(path.join(tmpdir(), 'vera-gateway-'));
  await writeFile(path.join(staticDir, 'index.html'), '<title>Game</title>');
  const gateway = createGateway({ lobby: `http://127.0.0.1:${upstream.address().port}`, relayHost: '127.0.0.1', relayPort: udp.address().port, origin: 'https://game.example', staticDir, allowHttp: true });
  await listen(gateway.server);
  t.after(async () => { await gateway.close(); await new Promise(r => upstream.close(r)); udp.close(); await rm(staticDir, { recursive: true }); });
  return { udp, base: `http://127.0.0.1:${gateway.server.address().port}` };
}

test('HTTP proxy preserves lobby credentials and body, rejects foreign origin and oversized input', async t => {
  assert.equal(gatewayOptionsFromEnv({}).allowHttp, false);
  for (const host of ['localhost', '127.0.0.1', '[::1]']) {
    const env = { VERA_LOBBY_URL: `http://${host}:8790`, VERA_ALLOW_LOCAL_HTTP: '1' };
    assert.equal(gatewayOptionsFromEnv(env).allowHttp, true);
    assert.throws(() => gatewayOptionsFromEnv({ ...env, VERA_ALLOW_LOCAL_HTTP: '0' }), /HTTPS/);
  }
  for (const host of ['game.example', '192.168.1.2', '127.0.0.1.example']) {
    assert.throws(() => gatewayOptionsFromEnv({ VERA_LOBBY_URL: `http://${host}:8790`, VERA_ALLOW_LOCAL_HTTP: '1' }), /loopback/);
  }
  const { base } = await fixture(t);
  const response = await fetch(base + '/v1/commands', { method: 'POST', headers: { origin: 'https://game.example', authorization: 'Bearer fixture' }, body: '{"operation":"join"}' });
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://game.example');
  assert.deepEqual(await response.json(), { path: '/v1/commands', auth: 'Bearer fixture', body: '{"operation":"join"}' });
  const foreign = await fetch(base + '/v1/channels', { headers: { origin: 'https://foreign.example' } });
  assert.equal(foreign.status, 403);
  assert.equal(foreign.headers.get('access-control-allow-origin'), null);
  const preflight = headers => fetch(base + '/v1/commands', { method: 'OPTIONS', headers: { origin: 'https://game.example', 'access-control-request-method': 'POST', 'access-control-request-headers': 'authorization, content-type', ...headers } });
  const permitted = await preflight({});
  assert.equal(permitted.status, 204);
  assert.equal(permitted.headers.get('access-control-allow-origin'), 'https://game.example');
  assert.equal(permitted.headers.get('access-control-allow-methods'), 'GET, POST');
  assert.equal(permitted.headers.get('access-control-allow-headers'), 'Authorization, Content-Type');
  assert.equal((await preflight({ origin: 'https://foreign.example' })).status, 403);
  assert.equal((await preflight({ 'access-control-request-method': 'DELETE' })).status, 403);
  assert.equal((await preflight({ 'access-control-request-headers': 'x-arbitrary' })).status, 403);
  assert.equal((await fetch(base + '/v1/commands', { method: 'POST', body: 'x'.repeat(65537) })).status, 413);
  const page = await fetch(base + '/');
  assert.match(page.headers.get('content-type'), /text\/html/);
  assert.equal(await page.text(), '<title>Game</title>');
  assert.equal((await fetch(base + '/%2e%2e/server.mjs')).status, 404);
});

test('both websocket routes forward datagrams through separate connected UDP sockets', async t => {
  const { base, udp } = await fixture(t);
  const ports = new Set();
  udp.on('message', (data, peer) => { ports.add(peer.port); udp.send(data, peer.port, peer.address); });
  for (const route of ['primary', 'alternate']) {
    const ws = new WebSocket(base.replace('http:', 'ws:') + '/game/' + route, { origin: 'https://game.example' });
    await once(ws, 'open');
    const payload = Buffer.from([0, 255, 1, 42]);
    const received = once(ws, 'message');
    ws.send(payload);
    const [data, binary] = await received;
    assert.equal(binary, true);
    assert.deepEqual(data, payload);
    ws.close();
    await once(ws, 'close');
  }
  assert.equal(ports.size, 2);
});

test('websocket rejects a foreign origin and closes nonbinary messages', async t => {
  const { base } = await fixture(t);
  const url = base.replace('http:', 'ws:') + '/game/primary';
  const rejected = new WebSocket(url, { origin: 'https://foreign.example' });
  await once(rejected, 'error');
  const ws = new WebSocket(url, { origin: 'https://game.example' });
  await once(ws, 'open');
  ws.send('not a datagram');
  const [code] = await once(ws, 'close');
  assert.equal(code, 1008);
});
