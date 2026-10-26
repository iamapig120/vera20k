#!/usr/bin/env bash
# Workflow regressions; no Rust build, network access, or retail assets.
set -euo pipefail
SOURCE_ROOT=$(cd "$(dirname "$0")/.." && pwd)
TEMP_ROOT=$(mktemp -d "${TMPDIR:-/tmp}/vera20k-web-tests.XXXXXX")
trap 'rm -rf "$TEMP_ROOT"' EXIT
WRAPPER="$TEMP_ROOT/wrapper"
UPSTREAM="$WRAPPER/vera20k"
mkdir -p "$WRAPPER/patches" "$WRAPPER/overlays/src" "$UPSTREAM/src"
cp "$SOURCE_ROOT/web.sh" "$WRAPPER/web.sh"

git_fixture() {
    git -C "$UPSTREAM" -c user.name='Web Test' \
        -c user.email='web-test@example.invalid' "$@"
}
fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }
expect_failure() {
    if "$@" >"$TEMP_ROOT/expected-error.log" 2>&1; then
        fail "command unexpectedly succeeded: $*"
    fi
}
prepare() {
    bash "$WRAPPER/web.sh" --ref "$1" prepare
}

printf '[package]\nname = "fixture"\nversion = "0.1.0"\nedition = "2024"\n' > "$UPSTREAM/Cargo.toml"
printf 'pub const PLATFORM: &str = "desktop";\n' > "$UPSTREAM/src/lib.rs"
git_fixture init --quiet
git_fixture add .
git_fixture commit --quiet -m 'Fixture upstream'
BASE=$(git_fixture rev-parse HEAD)
cp "$UPSTREAM/src/lib.rs" "$TEMP_ROOT/original.rs"
printf 'pub const PLATFORM: &str = "web";\n' > "$UPSTREAM/src/lib.rs"
cp "$UPSTREAM/src/lib.rs" "$TEMP_ROOT/patched.rs"
git_fixture diff > "$WRAPPER/patches/web-compat.patch"
git_fixture restore src/lib.rs
printf 'pub fn start() {}\n' > "$WRAPPER/overlays/src/web.rs"
cat > "$WRAPPER/web.config" <<CONFIG
BASE_REVISION='$BASE'
PATCH_FILE='patches/web-compat.patch'
OVERLAYS=('src/web.rs')
CONFIG

ENGINE=$(prepare "$BASE" | tail -n 1)
[[ -d "$ENGINE" ]] || fail 'prepare did not return its generated directory'
cmp "$UPSTREAM/src/lib.rs" "$TEMP_ROOT/original.rs"
[[ -z $(git_fixture status --porcelain) ]] || fail 'upstream was modified'
[[ $(git_fixture rev-parse HEAD) == "$BASE" ]] || fail 'upstream revision changed'
cmp "$ENGINE/src/lib.rs" "$TEMP_ROOT/patched.rs"
cmp "$ENGINE/src/web.rs" "$WRAPPER/overlays/src/web.rs"
[[ $(prepare "$BASE" | tail -n 1) == "$ENGINE" ]] || fail 'prepare was not idempotent'
printf '// local work\n' >> "$ENGINE/src/lib.rs"
cp "$ENGINE/src/lib.rs" "$TEMP_ROOT/dirty.rs"
expect_failure prepare "$BASE"
cmp "$ENGINE/src/lib.rs" "$TEMP_ROOT/dirty.rs"
git -C "$ENGINE" restore src/lib.rs
printf 'PASS: upstream isolation, repeated prepare, local work protection\n'

printf 'pub const PLATFORM: &str = "changed upstream";\n' > "$UPSTREAM/src/lib.rs"
git_fixture add .
git_fixture commit --quiet -m 'Conflicting upstream'
ADVANCED=$(git_fixture rev-parse HEAD)
expect_failure prepare "$ADVANCED"
cmp "$ENGINE/src/lib.rs" "$TEMP_ROOT/patched.rs"
[[ $(git_fixture rev-parse HEAD) == "$ADVANCED" ]] || fail 'advanced upstream changed'
[[ -z $(git_fixture status --porcelain) ]] || fail 'conflict dirtied upstream'
printf 'PASS: conflicting upstream preserves last good engine\n'

# An empty submodule must never fall back to an enclosing repository.
mv "$UPSTREAM" "$TEMP_ROOT/saved-upstream"
mkdir -p "$UPSTREAM"
expect_failure bash "$WRAPPER/web.sh" prepare
grep -F 'git submodule update --init --recursive' "$TEMP_ROOT/expected-error.log" >/dev/null
rmdir "$UPSTREAM"
mv "$TEMP_ROOT/saved-upstream" "$UPSTREAM"
printf 'PASS: missing submodule reports initialization command\n'


mkdir -p "$WRAPPER/dist/pkg" "$WRAPPER/dist/assets" "$WRAPPER/dist/local-assets" "$WRAPPER/local-assets"
for path in index.html standalone.html launcher.css launcher.js storage.js lobby.js network.js assets/RA2MD.png build-info.txt pkg/vera20k.js pkg/vera20k_bg.wasm; do
    printf 'public\n' > "$WRAPPER/dist/$path"
done
printf 'private\n' > "$WRAPPER/dist/local-assets/retail.mix"
printf 'private\n' > "$WRAPPER/local-assets/retail.mix"
printf 'private\n' > "$WRAPPER/dist/private.txt"
ARCHIVE="$WRAPPER/preview.zip"
bash "$WRAPPER/web.sh" --upstream "$UPSTREAM" --ref "$BASE" package --output "$ARCHIVE"
unzip -Z1 "$ARCHIVE" | sort > "$TEMP_ROOT/actual-archive.txt"
printf '%s\n' build-info.txt index.html launcher.css launcher.js storage.js lobby.js network.js assets/RA2MD.png pkg/vera20k.js pkg/vera20k_bg.wasm \
    | sort > "$TEMP_ROOT/expected-archive.txt"
cmp "$TEMP_ROOT/actual-archive.txt" "$TEMP_ROOT/expected-archive.txt"
printf 'PASS: static package excludes local assets and private files\n'

mkdir -p "$WRAPPER/templates"
cp "$SOURCE_ROOT/templates/.assetsignore" "$WRAPPER/templates/.assetsignore"
printf '// storage fixture\n' > "$WRAPPER/templates/storage.js"
printf '// lobby fixture\n' > "$WRAPPER/templates/lobby.js"
printf '// network fixture\n' > "$WRAPPER/templates/network.js"
mkdir -p "$WRAPPER/assets"
printf 'icon' > "$WRAPPER/assets/RA2MD.png"
cat > "$WRAPPER/templates/index.html" <<'HTML'
<!doctype html>
<link rel="icon" href="./assets/RA2MD.png">
<link rel="stylesheet" href="./launcher.css">
<script src="./lobby.js"></script>
<script src="./network.js"></script>
<script src="./storage.js"></script>
<script type="module" src="./launcher.js"></script>
HTML
printf 'body{background:#000}\n' > "$WRAPPER/templates/launcher.css"
cat > "$WRAPPER/templates/launcher.js" <<'JS'
import init, {start_game} from './pkg/vera20k.js';
async function engineBytes(){return fetch(new URL('./pkg/vera20k_bg.wasm',import.meta.url));}
const bytes=await engineBytes();
await init({module_or_path:bytes});
start_game();
JS
printf 'async function __wbg_init() {}\nexport function start_game() {}\nexport { __wbg_init as default };\n' > "$WRAPPER/dist/pkg/vera20k.js"
printf '\000asm' > "$WRAPPER/dist/pkg/vera20k_bg.wasm"
bash "$WRAPPER/web.sh" bundle
grep -E 'lobby.js\?v=[a-f0-9]{40}' "$WRAPPER/dist/index.html" >/dev/null
grep -E 'network.js\?v=[a-f0-9]{40}' "$WRAPPER/dist/index.html" >/dev/null
grep -E 'launcher.js\?v=[a-f0-9]{40}' "$WRAPPER/dist/index.html" >/dev/null
grep -E 'vera20k.js\?v=[a-f0-9]{40}' "$WRAPPER/dist/launcher.js" >/dev/null
grep -E 'vera20k_bg.wasm\?v=[a-f0-9]{40}' "$WRAPPER/dist/launcher.js" >/dev/null
[[ ! -e "$WRAPPER/dist/standalone.html" ]] || fail 'bundle retained the retired standalone page'
grep -F 'href="./assets/RA2MD.png"' "$WRAPPER/dist/index.html" >/dev/null
cmp "$WRAPPER/templates/storage.js" "$WRAPPER/dist/storage.js"
cmp "$WRAPPER/templates/launcher.css" "$WRAPPER/dist/launcher.css"
printf 'PASS: static site keeps external assets and removes the retired standalone page\n'
bash "$WRAPPER/web.sh" package --output "$ARCHIVE"
unzip -Z1 "$ARCHIVE" | sort > "$TEMP_ROOT/actual-archive.txt"
cmp "$TEMP_ROOT/actual-archive.txt" "$TEMP_ROOT/expected-archive.txt"
printf 'PASS: packaging works without a standalone page\n'
head -c 10000 /dev/zero | tr '\000' 'x' > "$WRAPPER/templates/index.html"
expect_failure bash "$WRAPPER/web.sh" bundle
printf 'PASS: index.html enforces the 10,000-byte limit\n'
