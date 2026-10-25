// Local orchestration. All service behavior stays in its existing owner.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { startLobby, serverData } from './local-lobby.mjs';
import { createGateway } from '../gateway/server.mjs';

const binary = process.argv[2];
if (!binary) throw new Error('Use bash web/server.sh to build and start the local stack.');
const keyFile = resolve(serverData, 'relay-ticket.key');
const port = Number(process.env.PORT || 8788);
const origin = process.env.VERA_WEB_ORIGIN || `http://localhost:${port}`;
let lobby, gateway, relay;
let stopping;
function stop(code = 0) {
  if (stopping) return stopping;
  stopping = (async () => {
    relay?.kill('SIGTERM');
    await gateway?.close();
    await lobby?.close();
    process.exitCode = code;
  })();
  return stopping;
}
try {
  lobby = await startLobby({ port: 0, keyFile, relayAddress: '127.0.0.1:5000' });
  relay = spawn(binary, [], { env: { ...process.env, VERA_RELAY_BIND: '127.0.0.1:5000', VERA_RELAY_TICKET_KEY_FILE: keyFile }, stdio: ['ignore', 'inherit', 'inherit'] });
  await new Promise((accept, reject) => { relay.once('spawn', accept); relay.once('error', reject); });
  relay.once('exit', () => { if (!stopping) { console.error('Relay stopped.'); void stop(1); } });
  gateway = createGateway({ lobby: lobby.url, allowHttp: true, relayHost: '127.0.0.1', relayPort: 5000, origin,
    staticDir: fileURLToPath(new URL('../dist/', import.meta.url)) });
  await new Promise((accept, reject) => { gateway.server.once('error', reject); gateway.server.listen(port, process.env.HOST || '127.0.0.1', accept); });
  console.log(`Web game and gateway: ${origin}`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void stop(); });
} catch {
  console.error('Could not start local multiplayer services. Check ports, dependencies and dist/.');
  await stop(1);
}
