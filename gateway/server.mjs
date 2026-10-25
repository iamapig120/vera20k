import http from 'node:http';
import https from 'node:https';
import dgram from 'node:dgram';
import { fileURLToPath } from 'node:url';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';

export function createGateway({ lobby, relayHost, relayPort, origin, staticDir, allowHttp = false }) {
  const upstream = new URL(lobby);
  if (upstream.protocol !== 'https:' && !(allowHttp && upstream.protocol === 'http:')) throw new Error('HTTPS lobby required');
  if (!origin || !relayHost || !Number.isInteger(relayPort) || relayPort < 1 || relayPort > 65535) throw new Error('Invalid gateway configuration');
  const allowed = new URL(origin).origin;
  const sockets = new Set();
  const requests = new Set();
  const server = http.createServer(async (req, res) => {
    if (req.headers.origin && req.headers.origin !== allowed) { res.writeHead(403).end(); return; }
    if (req.headers.origin === allowed) {
      res.setHeader('Access-Control-Allow-Origin', allowed);
      res.setHeader('Vary', 'Origin');
    }
    const path = req.url || '';
    if (req.method === 'OPTIONS') {
      const method = req.headers['access-control-request-method'];
      const headers = (req.headers['access-control-request-headers'] || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
      if (!path.startsWith('/v1/') || req.headers.origin !== allowed
        || !['GET', 'POST'].includes(method)
        || headers.some(value => !['authorization', 'content-type'].includes(value))) {
        res.writeHead(403).end(); return;
      }
      res.writeHead(204, {
        'Access-Control-Allow-Methods': 'GET, POST',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Max-Age': '600',
        'Vary': 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers',
      }).end();
      return;
    }
    if (!/^\/v1\//.test(path) || !['GET', 'POST'].includes(req.method)) {
      if (staticDir && req.method === 'GET' && !path.startsWith('/v1/')) {
        try { await serveStatic(staticDir, path, res); } catch { if (!res.headersSent) res.writeHead(404); res.end(); }
      } else res.writeHead(404).end();
      return;
    }
    // Concatenate an observed path, never resolve a client-supplied authority.
    const url = new URL(upstream.origin + path);
    const chunks = [];
    let size = 0;
    req.setTimeout(15000, () => req.destroy());
    req.on('data', chunk => {
      size += chunk.length;
      if (size > 65536) { res.writeHead(413).end(); req.destroy(); }
      else chunks.push(chunk);
    });
    req.on('end', () => {
      if (size > 65536) return;
      const headers = { 'content-type': 'application/json', 'user-agent': 'VERA20k-web-gateway' };
      if (req.headers.authorization) headers.authorization = req.headers.authorization;
      const client = url.protocol === 'https:' ? https : http;
      const outgoing = client.request(url, { method: req.method, headers, timeout: 35000 }, incoming => {
        res.writeHead(incoming.statusCode, { 'content-type': 'application/json', 'cache-control': 'no-store' });
        let received = 0;
        incoming.on('data', chunk => {
          received += chunk.length;
          if (received > 4 * 1024 * 1024) { incoming.destroy(); res.destroy(); }
          else res.write(chunk);
        });
        incoming.on('end', () => res.end());
        incoming.on('error', () => res.destroy());
      });
      requests.add(outgoing);
      outgoing.on('close', () => requests.delete(outgoing));
      outgoing.on('timeout', () => outgoing.destroy());
      outgoing.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end(); });
      res.on('close', () => outgoing.destroy());
      outgoing.end(Buffer.concat(chunks));
    });
  });
  server.headersTimeout = 15000;
  server.requestTimeout = 20000;
  const wss = new WebSocketServer({ noServer: true, maxPayload: 2048, perMessageDeflate: false });
  server.on('upgrade', (req, socket, head) => {
    if (req.headers.origin !== allowed || !['/game/primary', '/game/alternate'].includes(req.url) || sockets.size >= 256) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return;
    }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws));
  });
  wss.on('connection', ws => {
    const udp = dgram.createSocket('udp4');
    sockets.add(ws);
    let ready = false;
    const pending = [];
    let closed = false;
    let alive = true;
    let packets = 0;
    let windowStart = Date.now();
    const finish = () => {
      if (closed) return;
      closed = true;
      sockets.delete(ws);
      clearInterval(timer);
      try { udp.close(); } catch {}
      ws.terminate();
    };
    const timer = setInterval(() => {
      if (!alive) return finish();
      alive = false;
      ws.ping();
    }, 30000);
    timer.unref();
    ws.on('pong', () => { alive = true; });
    ws.on('close', finish);
    ws.on('error', finish);
    udp.on('error', finish);
    const send = data => udp.send(data, error => { if (error) finish(); });
    udp.connect(relayPort, relayHost, () => {
      ready = true;
      if (!closed) for (const data of pending.splice(0)) send(data);
    });
    ws.on('message', (data, binary) => {
      if (Date.now() - windowStart >= 1000) { packets = 0; windowStart = Date.now(); }
      if (!binary || !data.length || data.length > 2048 || ++packets > 2048) { ws.close(1008, 'Invalid datagram'); return; }
      if (closed) return;
      if (ready) send(data);
      else if (pending.length < 16) pending.push(data);
      else ws.close(1008, 'Connection queue full');
    });
    udp.on('message', data => {
      if (data.length > 2048 || ws.readyState !== WebSocket.OPEN) return;
      if (ws.bufferedAmount > 1024 * 1024) return finish();
      ws.send(data, { binary: true });
    });
  });
  return {
    server,
    async close() {
      for (const request of requests) request.destroy();
      for (const ws of sockets) ws.terminate();
      wss.close();
      await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    },
  };
}

async function serveStatic(directory, requestPath, res) {
  const root = await realpath(directory);
  const pathname = decodeURIComponent(new URL(requestPath, 'http://local').pathname);
  const filename = await realpath(path.join(root, pathname === '/' ? 'index.html' : pathname));
  if (!filename.startsWith(root + path.sep) || !(await stat(filename)).isFile()) { res.writeHead(404).end(); return; }
  const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json' };
  res.writeHead(200, { 'content-type': mime[path.extname(filename)] || 'application/octet-stream', 'x-content-type-options': 'nosniff' });
  const stream = createReadStream(filename);
  stream.on('error', () => res.destroy());
  res.on('close', () => stream.destroy());
  stream.pipe(res);
}

export function gatewayOptionsFromEnv(env, args = []) {
  const lobby = env.VERA_LOBBY_URL || 'https://vera20k-lobby.hnr-enok.workers.dev';
  const url = new URL(lobby);
  const allowHttp = env.VERA_ALLOW_LOCAL_HTTP === '1'
    && url.protocol === 'http:'
    && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !allowHttp) throw new Error('HTTPS lobby required; local HTTP needs VERA_ALLOW_LOCAL_HTTP=1 and a loopback host');
  return {
    lobby,
    allowHttp,
    relayHost: env.VERA_RELAY_HOST,
    relayPort: Number(env.VERA_RELAY_PORT || 5000),
    origin: env.VERA_WEB_ORIGIN,
    staticDir: args.includes('--static') ? args[args.indexOf('--static') + 1] : env.VERA_STATIC_DIR,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const gateway = createGateway(gatewayOptionsFromEnv(process.env, process.argv.slice(2)));
  gateway.server.listen(Number(process.env.PORT || 8788), process.env.HOST || '127.0.0.1');
  process.once('SIGTERM', () => gateway.close());
  process.once('SIGINT', () => gateway.close());
}
