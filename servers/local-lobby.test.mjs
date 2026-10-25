import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { startLobby, serverData } from './local-lobby.mjs';

async function post(url, path, body) {
  const response = await fetch(url + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}

test('real HTTP account survives a SQLite reopen and signs in with the same identity', async () => {
  await mkdir(serverData, { recursive: true, mode: 0o700 });
  const directory = await mkdtemp(join(serverData, 'lobby-test-'));
  let lobby;
  try {
    const options = { port: 0, database: join(directory, 'lobby.sqlite') };
    lobby = await startLobby(options);
    const account = { nickname: 'LocalTest', password: 'long-local-test-password', protocol: 3 };
    const created = await post(lobby.url, '/v1/accounts', account);
    assert.equal(created.status, 200);
    assert.equal(created.body.nickname, account.nickname);
    assert.equal(typeof created.body.token, 'string');
    await lobby.close(); lobby = null;
    lobby = await startLobby(options);
    const login = await post(lobby.url, '/v1/sessions', account);
    assert.equal(login.status, 200);
    assert.equal(login.body.player_id, created.body.player_id);
    const wrong = await post(lobby.url, '/v1/sessions', { ...account, password: 'wrong-local-password' });
    assert.equal(wrong.status, 401);
  } finally { if (lobby) await lobby.close(); await rm(directory, { recursive: true }); }
});

test('real HTTP adapter retains upstream request size limit', async () => {
  const lobby = await startLobby({ port: 0, database: join(serverData, `limit-test-${process.pid}.sqlite`) });
  try {
    const response = await post(lobby.url, '/v1/accounts', { padding: 'x'.repeat(65537) });
    assert.equal(response.status, 413);
  } finally {
    await lobby.close();
    for (const suffix of ['', '-wal', '-shm']) await rm(join(serverData, `limit-test-${process.pid}.sqlite${suffix}`), { force: true });
  }
});
