const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function load(name, globals) {
  const context = vm.createContext(globals);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../templates', name), 'utf8'), context);
  return context;
}

function transport(protocol = 'https:') {
  const sockets = [];
  class Socket {
    static OPEN = 1;
    constructor(url) {
      this.url = String(url);
      this.readyState = 0;
      this.bufferedAmount = 0;
      this.sent = [];
      sockets.push(this);
    }
    send(bytes) { this.sent.push(Uint8Array.from(bytes)); }
    close() { this.closed = true; }
  }
  const api = load('network.js', {
    URL, WebSocket: Socket, ArrayBuffer, Uint8Array,
    location: {protocol, href: `${protocol}//game.example/nested/index.html`},
  });
  return {api, sockets};
}

function packet(socket, bytes) {
  socket.onmessage({data: Uint8Array.from(bytes).buffer});
}

test('socket bridge preserves datagrams and distinguishes pending, failure, and explicit close', () => {
  const {api, sockets} = transport();
  const id = api.veraSocketOpen('primary');
  const socket = sockets[0];
  assert.equal(socket.url, 'wss://game.example/game/primary');
  assert.equal(socket.binaryType, 'arraybuffer');
  assert.equal(api.veraSocketSend(id, new Uint8Array([1])), 1);
  assert.equal(api.veraSocketReceive(id), null);
  socket.readyState = 1;
  const outgoing = new Uint8Array(2048);
  assert.equal(api.veraSocketSend(id, outgoing), 0);
  assert.equal(api.veraSocketSend(id, new Uint8Array(2049)), 2);
  socket.bufferedAmount = 262145;
  assert.equal(api.veraSocketSend(id, outgoing), 1);
  assert.equal(socket.sent.length, 1);
  packet(socket, [1, 2]);
  packet(socket, [3]);
  assert.deepEqual([...api.veraSocketReceive(id)], [1, 2]);
  assert.deepEqual([...api.veraSocketReceive(id)], [3]);
  packet(socket, [4]);
  socket.onclose();
  assert.equal(api.veraSocketSend(id, outgoing), 2);
  assert.deepEqual([...api.veraSocketReceive(id)], [4]);
  assert.equal(api.veraSocketReceive(id), undefined);
  api.veraSocketClose(id);
  assert.equal(socket.closed, true);
  assert.equal(socket.onmessage, null);
  assert.equal(socket.onclose, null);
  assert.equal(socket.onerror, null);
  api.veraSocketClose(id);
  assert.equal(api.veraSocketReceive(id), undefined);
  assert.throws(() => api.veraSocketOpen('foreign'), /gateway/);
  const http = transport('http:');
  http.api.veraSocketOpen('alternate');
  assert.equal(http.sockets[0].url, 'ws://game.example/game/alternate');
  http.api.veraGatewayBase = () => 'https://relay.example:9443';
  http.api.veraSocketOpen('primary');
  assert.equal(http.sockets[1].url, 'wss://relay.example:9443/game/primary');
  assert.throws(() => transport('file:').api.veraSocketOpen('primary'), /gateway/);
});

test('socket receive queue is bounded and rejects oversized or nonbinary frames', () => {
  const {api, sockets} = transport();
  const id = api.veraSocketOpen('primary');
  for (let i = 0; i < 257; i++) packet(sockets[0], [i & 255]);
  for (let i = 0; i < 256; i++) assert.deepEqual([...api.veraSocketReceive(id)], [i]);
  assert.equal(api.veraSocketReceive(id), null);
  packet(sockets[0], new Uint8Array(2048));
  assert.equal(api.veraSocketReceive(id).length, 2048);
  packet(sockets[0], new Uint8Array(2049));
  assert.equal(sockets[0].closed, true);
  assert.equal(api.veraSocketReceive(id), undefined);
  const other = api.veraSocketOpen('alternate');
  sockets[1].onmessage({data: 'unexpected text'});
  assert.equal(sockets[1].closed, true);
  assert.equal(api.veraSocketReceive(other), undefined);
});

test('lobby uses same-origin authenticated requests and bounds success and error bodies', async () => {
  const calls = [], warnings = [], timers = new Set();
  let status = 200, chunks = [];
  const api = load('lobby.js', {
    console: {warn: (...args) => warnings.push(args.join(' '))},
    AbortController, Uint8Array, TextDecoder,
    setTimeout(fn) { timers.add(fn); return fn; },
    clearTimeout(id) { timers.delete(id); },
    async fetch(url, options) {
      calls.push({url, options});
      let index = 0;
      return {status, body: {getReader: () => ({
        async read() { return index < chunks.length ? {value: chunks[index++], done: false} : {done: true}; },
      })}};
    },
  });
  chunks = [Uint8Array.from([123]), Uint8Array.from([125])];
  assert.deepEqual(JSON.parse(await api.veraLobbyRequest('/v1/rooms', 'secret', '{}', 2)), [200, '{}']);
  const post = calls[0];
  assert.equal(post.url, '/v1/rooms');
  assert.equal(post.options.method, 'POST');
  assert.equal(post.options.headers.Authorization, 'Bearer secret');
  assert.equal(post.options.headers['Content-Type'], 'application/json');
  assert.equal(post.options.body, '{}');
  assert.equal(post.options.credentials, 'omit');
  assert.equal(post.options.redirect, 'error');
  assert.equal(post.options.cache, 'no-store');
  await api.veraLobbyRequest('/v1/rooms', '', undefined, 2);
  assert.equal(calls[1].options.method, 'GET');
  assert.equal(calls[1].options.headers.Authorization, undefined);
  assert.equal(calls[1].options.body, undefined);
  await assert.rejects(api.veraLobbyRequest('https://foreign.example/v1/rooms', '', undefined, 2), /invalid path/);
  assert.equal(calls.length, 2);
  for (const responseStatus of [200, 503]) {
    status = responseStatus;
    chunks = [new Uint8Array(2), new Uint8Array(1)];
    await assert.rejects(api.veraLobbyRequest('/v1/rooms', '', undefined, 2), /body too large/);
    assert.equal(calls.at(-1).options.signal.aborted, true);
  }
  api.veraGatewayBase = () => 'https://relay.example:9443';
  status = 200; chunks = [];
  await api.veraLobbyRequest('/v1/rooms', '', undefined, 2);
  assert.equal(calls.at(-1).url, 'https://relay.example:9443/v1/rooms');
  status = 401;
  assert.deepEqual(JSON.parse(await api.veraLobbyRequest('/v1/rooms', '', undefined, 2)), [401, '']);
  assert.equal(warnings.pop(), 'Lobby HTTP failure: status=401, endpoint=/v1/other, cursor_lost=false');
  const privateToken = 'fixture-bearer-keep-private';
  const privateBody = '{"password":"fixture-body-keep-private"}';
  for (const [responseStatus, endpoint, code, lost] of [
    [503, '/v1/commands', 'unavailable', false],
    [409, '/v1/events', 'history_expired', true],
    [409, '/v1/events', 'invalid_cursor', true],
  ]) {
    status = responseStatus;
    const responseBody = JSON.stringify({error: {code, message: 'fixture-server-message-private'}});
    chunks = [Buffer.from(responseBody)];
    const result = await api.veraLobbyRequest(endpoint + '?after=private-cursor', privateToken, privateBody, 1024);
    assert.deepEqual(JSON.parse(result), [responseStatus, responseBody]);
    assert.equal(warnings.at(-1), `Lobby HTTP failure: status=${responseStatus}, endpoint=${endpoint}, cursor_lost=${lost}`);
  }
  status = 401;
  await api.veraLobbyRequest('/v1/sessions/fixture-private-id', privateToken, privateBody, 1024);
  assert.equal(warnings.at(-1), 'Lobby HTTP failure: status=401, endpoint=/v1/sessions, cursor_lost=false');
  const diagnostics = warnings.join('\n');
  for (const secret of [privateToken, privateBody, 'fixture-server-message-private', 'private-cursor', 'fixture-private-id']) {
    assert.equal(diagnostics.includes(secret), false, 'diagnostics must omit credentials, bodies, and request details');
  }
  assert.equal(timers.size, 0);
});
