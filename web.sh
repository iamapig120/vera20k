#!/usr/bin/env bash
# Standalone Web build; upstream files are read only. Requires Bash 3.2+.
set -euo pipefail
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=web.config
source "$ROOT/web.config"
UPSTREAM=$(dirname "$ROOT")
REF=HEAD
BUILD="$ROOT/.build"
ENGINE="$BUILD/engine"
DIST="$ROOT/dist"
LOCKED=0
fail() { printf '%s\n' "$*" >&2; exit 1; }
cleanup() {
  if [[ "$LOCKED" == 1 ]]; then
    rm -f "$BUILD/workflow.lock/pid"
    rmdir "$BUILD/workflow.lock"
  fi
}
trap cleanup EXIT
trap 'exit 130' INT TERM
lock() {
  mkdir -p "$BUILD"
  mkdir "$BUILD/workflow.lock" 2>/dev/null || fail "Another Web workflow is active. If it crashed, confirm no build is running before removing .build/workflow.lock."
  LOCKED=1
  printf '%s\n' "$$" > "$BUILD/workflow.lock/pid"
}
safe_relative() {
  case "$1" in /*|../*|*/../*|*/..|..) fail "Unsafe overlay path: $1";; esac
}
identity() {
  {
    printf '%s\n%s\n' "$UPSTREAM" "$REVISION"
    cat "$ROOT/web.config" "$ROOT/$PATCH_FILE"
    for file in "${OVERLAYS[@]}"; do
      safe_relative "$file"
      printf '%s\n' "$file"
      cat "$ROOT/overlays/$file"
    done
  } | git hash-object --stdin
}
prepare() {
  UPSTREAM=$(cd "$UPSTREAM" && pwd)
  case "$UPSTREAM/" in "$ROOT/"*) fail 'Upstream must be outside the Web repository';; esac
  REVISION=$(git -C "$UPSTREAM" rev-parse --verify "$REF^{commit}")
  IDENTITY=$(identity)
  if [[ -d "$ENGINE" ]]; then
    [[ -d "$ENGINE/.git" ]] || fail "Refusing to replace unowned directory: $ENGINE"
    [[ -z "$(git -C "$ENGINE" status --porcelain --untracked-files=normal)" ]] || fail 'Generated source has edits; save them before preparing.'
    if [[ -f "$BUILD/source-state" && "$(cat "$BUILD/source-state")" == "$IDENTITY" ]]; then
      printf '%s\n' "$ENGINE"
      return
    fi
  fi
  stage=$(mktemp -d "$BUILD/prepare.XXXXXX")
  if ! git -C "$UPSTREAM" archive "$REVISION" | tar -xf - -C "$stage"; then
    rm -rf "$stage"
    fail 'Could not export upstream source'
  fi
  git -C "$stage" init -q -b feature/web-generated
  if ! git -C "$stage" apply --check "$ROOT/$PATCH_FILE"; then
    rm -rf "$stage"
    fail 'Web patch conflicts with upstream; previous source was preserved.'
  fi
  git -C "$stage" apply "$ROOT/$PATCH_FILE"
  for file in "${OVERLAYS[@]}"; do
    safe_relative "$file"
    if [[ -e "$stage/$file" || -L "$stage/$file" ]]; then
      rm -rf "$stage"
      fail "Upstream now owns overlay path $file; reconcile it first."
    fi
    mkdir -p "$stage/$(dirname "$file")"
    cp "$ROOT/overlays/$file" "$stage/$file"
  done
  git -C "$stage" add -f --all
  git -C "$stage" -c user.name='VERA20k Web Builder' -c user.email=build@localhost \
    -c commit.gpgsign=false commit -qm "Generated Web source from $REVISION"
  if [[ -d "$ENGINE" ]]; then
    previous=$(mktemp -d "$BUILD/previous.XXXXXX")
    rmdir "$previous"
    mv "$ENGINE" "$previous"
    printf 'Previous source retained: %s\n' "$previous" >&2
  fi
  mv "$stage" "$ENGINE"
  printf '%s\n' "$IDENTITY" > "$BUILD/source-state"
  printf '%s\n' "$REVISION" > "$BUILD/revision"
  printf '%s\n' "$ENGINE"
}
# One HTML file also works on file://: no fetch, module imports or backend.
bundle_static() {
  local directory=$1
  cp "$ROOT/templates/index.html" "$directory/index.html"
  {
    sed '/^<script type="module">/,$d' "$ROOT/templates/index.html"
    printf '%s\n' '<script type="module">'
    sed -E \
      -e 's/^export (const|class|function) /\1 /' \
      -e '/^export \{.*\};$/d' \
      -e 's@</script@<\\/script@g' "$directory/pkg/vera20k.js"
    printf '\nconst init=__wbg_init;\nconst bundledWasm=Uint8Array.from(atob("'
    base64 < "$directory/pkg/vera20k_bg.wasm" | tr -d '\r\n'
    printf '"), c=>c.charCodeAt(0));\n'
    sed -n '/^import init, /,$p' "$ROOT/templates/index.html" |
      sed -e '1d' -e 's/await init();/await init({module_or_path: bundledWasm});/'
  } > "$directory/standalone.html"
}
build() {
  prepare
  for tool in cargo rustc wasm-bindgen; do command -v "$tool" >/dev/null || fail "Missing $tool on PATH; see README.md"; done
  expected=$(awk '$0 == "name = \"wasm-bindgen\"" {seen=1;next} seen && $1 == "version" {gsub(/"/,"",$3);print $3;exit}' "$ENGINE/Cargo.lock")
  [[ -n "$expected" ]] || fail 'wasm-bindgen missing from Cargo.lock'
  actual=$(wasm-bindgen --version)
  [[ "$actual" == "wasm-bindgen $expected" ]] || fail "CLI version must match Cargo.lock: expected $expected, got $actual"
  (
    cd "$ENGINE"
    CARGO_INCREMENTAL="${CARGO_INCREMENTAL:-0}" cargo build -p vera20k --lib --locked \
      --target wasm32-unknown-unknown --no-default-features --profile fast --target-dir "$BUILD/target"
  )
  stage=$(mktemp -d "$BUILD/dist.XXXXXX")
  wasm-bindgen --target web --out-dir "$stage/pkg" "$BUILD/target/wasm32-unknown-unknown/fast/vera20k.wasm"
  bundle_static "$stage"
  printf 'Upstream: %s\nRevision: %s\nwasm-bindgen: %s\n' "$UPSTREAM_URL" "$REVISION" "$expected" > "$stage/build-info.txt"
  if [[ -d "$DIST" ]]; then rm -rf "$DIST"; fi
  mv "$stage" "$DIST"
  printf 'Ready: %s\n' "$DIST/standalone.html"
}
package() {
  local output=${1:-"$ROOT/vera20k-web.zip"}
  [[ -f "$DIST/index.html" && -f "$DIST/standalone.html" && -f "$DIST/build-info.txt" ]] || fail 'Run build before packaging'
  [[ -f "$DIST/pkg/vera20k.js" && -f "$DIST/pkg/vera20k_bg.wasm" ]] || fail 'Missing compiled bindings'
  mkdir -p "$(dirname "$output")"
  output=$(cd "$(dirname "$output")" && pwd)/$(basename "$output")
  case "$output" in "$DIST/"*) fail 'ZIP must be outside dist/';; esac
  local files=(index.html standalone.html build-info.txt pkg/vera20k.js pkg/vera20k_bg.wasm)
  for file in pkg/vera20k.d.ts pkg/vera20k_bg.wasm.d.ts; do
    if [[ -f "$DIST/$file" ]]; then files+=("$file"); fi
  done
  for file in "${files[@]}"; do [[ ! -L "$DIST/$file" ]] || fail "Unexpected symlink: $file"; done
  # Replace the ZIP rather than updating it, so stale members cannot survive.
  local zip_stage
  zip_stage=$(mktemp -d "$BUILD/zip.XXXXXX")
  (cd "$DIST" && zip -q "$zip_stage/site.zip" "${files[@]}")
  mv "$zip_stage/site.zip" "$output"
  rmdir "$zip_stage"
  printf '%s\n' "$output"
}
refresh_patch() {
  local adapted=$1 base=$2 revision file
  revision=$(git -C "$adapted" rev-parse --verify "$base^{commit}")
  local paths=(Cargo.toml Cargo.lock src)
  for file in "${OVERLAYS[@]}"; do paths+=(":(exclude)$file"); done
  local pending
  pending=$(mktemp "$BUILD/patch.XXXXXX")
  git -C "$adapted" diff --binary "$revision" -- "${paths[@]}" > "$pending"
  [[ -s "$pending" ]] || fail 'No compatibility changes against selected base'
  for file in "${OVERLAYS[@]}"; do [[ -f "$adapted/$file" ]] || fail "Missing overlay: $file"; done
  for file in "${OVERLAYS[@]}"; do
    mkdir -p "$ROOT/overlays/$(dirname "$file")"
    cp "$adapted/$file" "$ROOT/overlays/$file"
  done
  mv "$pending" "$ROOT/$PATCH_FILE"
  sed "s/^BASE_REVISION=.*/BASE_REVISION='$revision'/" "$ROOT/web.config" > "$BUILD/config.pending"
  mv "$BUILD/config.pending" "$ROOT/web.config"
  printf '%s\n' 'Refreshed patch and overlays; review and rebuild before committing.'
}
usage() {
  cat <<'EOF'
Usage: bash web.sh [--upstream PATH] [--ref REF] COMMAND
  prepare                         Export upstream and apply Web compatibility
  build                           Compile and emit static dist/ + standalone.html
  bundle                          Rebuild HTML from existing dist/pkg (no Cargo)
  package [--output PATH]          ZIP the fixed public-file allowlist
  refresh-patch --adapted PATH --base REF
No server or Python is used. Open dist/standalone.html directly in a browser.
EOF
}
while [[ $# -gt 0 ]]; do
  case "$1" in
    --upstream) UPSTREAM=$2; shift 2;;
    --ref) REF=$2; shift 2;;
    -h|--help) usage; exit 0;;
    *) break;;
  esac
done
[[ $# -gt 0 ]] || { usage; exit 1; }
command=$1; shift
lock
case "$command" in
  prepare) prepare;;
  build) build;;
  bundle) bundle_static "$DIST";;
  package)
    if [[ $# == 0 ]]; then package; elif [[ $# == 2 && "$1" == --output ]]; then package "$2"; else fail 'package: expected --output PATH'; fi;;
  refresh-patch)
    adapted=; base=
    while [[ $# -gt 0 ]]; do
      case "$1" in --adapted) adapted=$2; shift 2;; --base) base=$2; shift 2;; *) fail "Unknown option $1";; esac
    done
    [[ -n "$adapted" && -n "$base" ]] || fail 'refresh-patch requires --adapted and --base'
    refresh_patch "$adapted" "$base";;
  *) usage; fail "Unknown command: $command";;
esac
