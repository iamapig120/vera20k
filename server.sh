#!/usr/bin/env bash
# Build the unchanged upstream relay, then start the local Web service stack.
set -euo pipefail
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
[[ -d "$ROOT/gateway/node_modules/ws" ]] || { printf '%s\n' 'Run: cd web/gateway && npm ci' >&2; exit 1; }
bash "$ROOT/web.sh" prepare
cd "$ROOT/.build/engine"
python3 -m tools.cargo_run -- build -p vera20k-relay --profile fast
relay=$(python3 -m tools.cargo_run --resolve vera20k-relay --profile fast)
cd "$ROOT"
exec node servers/start.mjs "$relay"
