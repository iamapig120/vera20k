# Local multiplayer services

From the independent Web project directory, `bash server.sh` builds the unchanged upstream relay and starts the whole local stack (lobby, relay, gateway and static game). Install gateway dependencies first with `(cd gateway && npm ci)`, and build the Web assets with `bash web.sh build`. Open `http://localhost:8788/`. Ctrl+C stops this stack. The individual entrypoints below are for separate process management.

Run from the repository root with Node.js supporting `node:sqlite` (tested with
Node 25.2.1):

```sh
node servers/local-lobby.mjs
```

The lobby listens only on `127.0.0.1:8790`. `LOBBY_PORT` changes the port.
The Web gateway forwards its same-origin `/v1/` requests to this address. Native
clients can use the same lobby protocol through their configured HTTPS endpoint;
this adapter reuses upstream `LobbyService` and `SqlStore` without separate game
or account behavior.

Accounts, rooms and sessions persist in `web/.build/server-data/lobby.sqlite`.
The first startup creates `web/.build/server-data/relay-ticket.key`, a random
64-hex-character secret with mode 0600. It is retained across restarts. Existing
credentials are read via `VERA_RELAY_TICKET_KEY_FILE`; the file must contain
exactly 64 hexadecimal characters (surrounding whitespace is ignored). Secrets
and databases stay in `.build`, outside published Web assets.

Start the existing upstream relay binary with the same secret file:

```sh
export VERA_RELAY_TICKET_KEY_FILE="$PWD/.build/server-data/relay-ticket.key"
export VERA_RELAY_BIND=127.0.0.1:5000
# Start your existing vera20k-relay binary here.
```

The lobby's `RELAY_ADDRESS` defaults to `127.0.0.1:5000`; set it to the relay
address clients can reach when running on different machines. `VERA_RELAY_BIND`
controls the relay UDP listener, while the Web gateway supplies browser transport.
Both relay and lobby must use the same key. This setup does not publish a public
endpoint or configure TLS. Keep the lobby listener on loopback behind the gateway.

HTTP bodies retain the upstream 64 KiB limit and 5-second streaming deadline;
the Node adapter additionally bounds headers and request arrival at 10 seconds.
No request bodies, passwords, tokens or relay secrets are logged.

Run the two focused real HTTP tests:

```sh
node --test servers/local-lobby.test.mjs
```

They cover account creation, login after a SQLite restart, rejection of an
incorrect password, and the HTTP body limit. Temporary test databases are cleaned
up under `web/.build/server-data`; the shared local relay secret is preserved.
