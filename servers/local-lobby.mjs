// Node HTTP/SQLite adapter only: upstream owns all lobby and protocol behavior.
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { Readable } from 'node:stream';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, chmod } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { LobbyService, SqlStore } from '../vera20k/services/lobby/service.js';

export const serverData = fileURLToPath(new URL('../.build/server-data/', import.meta.url));

export async function ticketKey(file = resolve(serverData, 'relay-ticket.key')) {
  if (resolve(file) === resolve(serverData, 'relay-ticket.key')) {
    await mkdir(serverData, { recursive: true, mode: 0o700 });
    try { await writeFile(file, randomBytes(32).toString('hex') + '\n', { flag: 'wx', mode: 0o600 }); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
  }
  const key = (await readFile(file, 'utf8')).trim();
  if (!/^[a-fA-F0-9]{64}$/.test(key)) throw new Error('Relay key file must contain 64 hexadecimal characters.');
  return key;
}

export async function startLobby({
  port = 8790, database = resolve(serverData, 'lobby.sqlite'),
  keyFile = process.env.VERA_RELAY_TICKET_KEY_FILE || resolve(serverData, 'relay-ticket.key'),
  relayAddress = process.env.RELAY_ADDRESS || '127.0.0.1:5000',
} = {}) {
  const key = await ticketKey(keyFile);
  if (!/^[^\s/:]+:\d{1,5}$/.test(relayAddress) || +relayAddress.split(':').at(-1) > 65535) {
    throw new Error('RELAY_ADDRESS must be host:port.');
  }
  await mkdir(dirname(database), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(database);
  await chmod(database, 0o600);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
  const sql = { exec(query, ...args) {
    const statement = db.prepare(query);
    if (/^\s*SELECT/i.test(query)) return { toArray: () => statement.all(...args) };
    statement.run(...args); return { toArray: () => [] };
  } };
  const store = new SqlStore(sql, fn => {
    db.exec('BEGIN');
    try { const result = fn(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  });
  const service = new LobbyService(store, { RELAY_TICKET_KEY: key, RELAY_ADDRESS: relayAddress });
  const server = createServer({ requestTimeout: 10000, headersTimeout: 10000, maxHeaderSize: 16384 }, async (req, res) => {
    try {
      // Host and forwarding headers never decide the destination or account limiter.
      const headers = new Headers();
      for (const name of ['authorization', 'content-type', 'content-length']) {
        if (req.headers[name]) headers.set(name, req.headers[name]);
      }
      headers.set('CF-Connecting-IP', req.socket.remoteAddress || 'local');
      const method = req.method || 'GET';
      const request = new Request(`http://localhost${req.url?.startsWith('/') ? req.url : '/'}`, {
        method, headers,
        ...(method === 'POST' ? { body: Readable.toWeb(req), duplex: 'half' } : {}),
      });
      // Upstream caps streamed bodies at 64 KiB and cancels incomplete reads at 5 s.
      const response = await service.fetch(request);
      res.writeHead(response.status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch {
      if (!res.headersSent) res.writeHead(503, { 'content-type': 'application/json' });
      res.end('{"error":{"code":"service_unavailable","message":"Service unavailable."}}');
    }
  });
  server.keepAliveTimeout = 5000;
  await new Promise((accept, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', accept);
  }).catch(error => { db.close(); throw error; });
  return { server, url: `http://127.0.0.1:${server.address().port}`,
    async close() { await new Promise((accept, reject) => server.close(error => error ? reject(error) : accept())); db.close(); } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const lobby = await startLobby({ port: Number(process.env.LOBBY_PORT || 8790) });
    console.log(`Local lobby listening at ${lobby.url}`);
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void lobby.close().then(() => process.exit(0)); });
  } catch { console.error('Local lobby could not start. Check the local database, relay address and key file.'); process.exitCode = 1; }
}
