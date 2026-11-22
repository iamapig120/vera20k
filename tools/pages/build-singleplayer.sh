#!/usr/bin/env bash
# Future handoff only. This script has not been run or used for a build.
set -euo pipefail
[[ "$(uname -s)" == Linux ]] || { echo 'Use the designated Linux build environment.' >&2; exit 2; }
HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ENGINE_PIN="$(python3 - "$HERE/release-plan.json" <<'PY'
import json, re, sys
plan = json.load(open(sys.argv[1], encoding='utf-8'))
pin = plan.get('confirmedEngineCommit')
if not plan['gates']['commonEnginePinConfirmed'] or not isinstance(pin, str) or not re.fullmatch('[0-9a-f]{40}', pin):
    sys.exit('Stop: parent has not confirmed the common engine commit.')
print(pin)
PY
)"
RUN_ROOT="${1:?Supply a NEW absolute directory on the designated build volume}"
[[ "$RUN_ROOT" == /* && ! -e "$RUN_ROOT" ]] || { echo 'Build directory must be absolute and absent; nothing overwritten.' >&2; exit 2; }
mkdir -- "$RUN_ROOT"
mkdir -- "$RUN_ROOT/tmp" "$RUN_ROOT/cache" "$RUN_ROOT/cargo-home"
export TMPDIR="$RUN_ROOT/tmp"
export CARGO_HOME="$RUN_ROOT/cargo-home"
export CARGO_TARGET_DIR="$RUN_ROOT/cache"
export CARGO_BUILD_JOBS=2
unset RUSTFLAGS CARGO_ENCODED_RUSTFLAGS CARGO_BUILD_TARGET RUSTUP_TOOLCHAIN WS_PROXY_URL
git clone --no-checkout https://github.com/YuriPlanet/vera20k.git "$RUN_ROOT/engine"
git -C "$RUN_ROOT/engine" checkout --detach "$ENGINE_PIN"
[[ "$(git -C "$RUN_ROOT/engine" rev-parse HEAD)" == "$ENGINE_PIN" ]]
[[ -z "$(git -C "$RUN_ROOT/engine" status --porcelain)" ]]
cd -- "$RUN_ROOT/engine"
# The upstream owner first builds snapshot-layout, then the wasm library.
# No --network, --lan or --threads. No toolchain/CLI installation step;
# the upstream command uses its locked Cargo dependencies.
python3 tools/wasm/build.py --profile wasm 2>&1 | tee "$RUN_ROOT/build.log"
node --experimental-vm-modules "$HERE/../package-preflight.cjs" check-imports \
    "$RUN_ROOT/engine/target/wasm-dist" > "$RUN_ROOT/raw-engine-imports.json"
printf '%s\n' "$ENGINE_PIN" > "$RUN_ROOT/engine-commit.txt"
printf 'Raw asset-free engine output: %s\nNOT a Pages release: the reviewed Pages persistence/import adapter is still required.\n' \
    "$RUN_ROOT/engine/target/wasm-dist"
