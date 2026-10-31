#!/usr/bin/env bash
# Standalone Web build; upstream files are read only. Requires Bash 3.2+.
set -euo pipefail
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=web.config
source "$ROOT/web.config"
UPSTREAM="$ROOT/vera20k"
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
  [[ -e "$UPSTREAM/.git" ]] || fail 'Upstream is not initialized. Run: git submodule update --init --recursive (or use --upstream PATH).'
  UPSTREAM=$(cd "$UPSTREAM" && pwd -P)
  git_root=$(git -C "$UPSTREAM" rev-parse --show-toplevel)
  [[ -d "$git_root" && "$(cd "$git_root" && pwd -P)" == "$UPSTREAM" ]] || fail 'Upstream must be a Git repository root'
  case "$UPSTREAM/" in "$ROOT/"|"$BUILD/"*) fail 'Upstream must not be the Web repository or generated source';; esac
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
# Assemble the static site and version its external assets.
bundle_static() {
  local directory=$1
  cp "$ROOT/templates/index.html" "$directory/index.html"
  [[ $(wc -c < "$directory/index.html") -lt 10000 ]] || fail 'index.html must be smaller than 10,000 bytes'
  cp "$ROOT/templates/.assetsignore" "$directory/.assetsignore"
  cp "$ROOT/templates/lobby.js" "$ROOT/templates/network.js" "$ROOT/templates/storage.js" "$ROOT/templates/resources.mjs" "$ROOT/templates/fullscreen.mjs" "$ROOT/templates/launcher.css" "$ROOT/templates/launcher.js" "$directory/"
  cp "$ROOT/LICENSE-GPL" "$directory/LICENSE-GPL"
  mkdir -p "$directory/assets"
  cp "$ROOT/assets/RA2MD.png" "$directory/assets/RA2MD.png"
  rm -f "$directory/standalone.html"
  # HTML and modules must never mix across releases. Python's static server
  # and regular static hosts can otherwise reuse old module/Wasm responses.
  local version
  version=$(cat "$directory/lobby.js" "$directory/network.js" "$directory/launcher.js" "$directory/storage.js" "$directory/resources.mjs" "$directory/fullscreen.mjs" "$directory/launcher.css" "$directory/pkg/vera20k.js" "$directory/pkg/vera20k_bg.wasm" | git hash-object --stdin)
  sed -e "s@./launcher.css@./launcher.css?v=$version@g" \
      -e "s@./lobby.js@./lobby.js?v=$version@g" \
      -e "s@./network.js@./network.js?v=$version@g" \
      -e "s@./storage.js@./storage.js?v=$version@g" \
      -e "s@./launcher.js@./launcher.js?v=$version@g" "$directory/index.html" > "$directory/index.versioned"
  mv "$directory/index.versioned" "$directory/index.html"
  sed -e "s@./pkg/vera20k.js'@./pkg/vera20k.js?v=$version'@g" \
      -e "s@./pkg/vera20k_bg.wasm'@./pkg/vera20k_bg.wasm?v=$version'@g" \
      -e "s@./resources.mjs'@./resources.mjs?v=$version'@g" \
      -e "s@./fullscreen.mjs'@./fullscreen.mjs?v=$version'@g" \
      "$directory/launcher.js" > "$directory/launcher.versioned"
  mv "$directory/launcher.versioned" "$directory/launcher.js"
}
build() {
  prepare
  for tool in cargo rustc wasm-bindgen python3; do command -v "$tool" >/dev/null || fail "Missing $tool on PATH; see README.md"; done
  expected=$(awk '$0 == "name = \"wasm-bindgen\"" {seen=1;next} seen && $1 == "version" {gsub(/"/,"",$3);print $3;exit}' "$ENGINE/Cargo.lock")
  [[ -n "$expected" ]] || fail 'wasm-bindgen missing from Cargo.lock'
  actual=$(wasm-bindgen --version)
  [[ "$actual" == "wasm-bindgen $expected" ]] || fail "CLI version must match Cargo.lock: expected $expected, got $actual"
  (
    cd "$ENGINE"
    CARGO_INCREMENTAL="${CARGO_INCREMENTAL:-0}" python3 "$ROOT/tools/build-remapped.py" "$ROOT" -m tools.cargo_run -- rustc -p vera20k --lib --locked \
      --target wasm32-unknown-unknown --no-default-features --features wasm --profile fast --crate-type cdylib \
      -- -C link-arg=-zstack-size=8388608
  )
  stage=$(mktemp -d "$BUILD/dist.XXXXXX")
  local cargo_target
  cargo_target=$(cd "$ENGINE" && python3 -c 'from pathlib import Path; from tools.cargo_run import build_store, owned_target; root=Path.cwd(); print(owned_target(root, build_store(root)[1]))')
  # Strip diagnostic metadata before the static site and its cache key are generated.
  wasm-bindgen --target web --remove-name-section --remove-producers-section \
    --out-dir "$stage/pkg" "$cargo_target/wasm32-unknown-unknown/fast/vera20k.wasm"
  bundle_static "$stage"
  printf 'Upstream: %s\nRevision: %s\nwasm-bindgen: %s\n' "$UPSTREAM_URL" "$REVISION" "$expected" > "$stage/build-info.txt"
  if [[ -d "$DIST" ]]; then rm -rf "$DIST"; fi
  mv "$stage" "$DIST"
  printf 'Ready: %s\n' "$DIST/index.html"
}
package() {
  local output=${1:-"$ROOT/vera20k-web.zip"}
  [[ -f "$DIST/index.html" && -f "$DIST/build-info.txt" ]] || fail 'Run build before packaging'
  [[ -f "$DIST/pkg/vera20k.js" && -f "$DIST/pkg/vera20k_bg.wasm" ]] || fail 'Missing compiled bindings'
  mkdir -p "$(dirname "$output")"
  output=$(cd "$(dirname "$output")" && pwd)/$(basename "$output")
  case "$output" in "$DIST/"*) fail 'ZIP must be outside dist/';; esac
  local files=(index.html launcher.css launcher.js storage.js resources.mjs fullscreen.mjs lobby.js network.js LICENSE-GPL assets/RA2MD.png build-info.txt pkg/vera20k.js pkg/vera20k_bg.wasm)
  for file in pkg/vera20k.d.ts pkg/vera20k_bg.wasm.d.ts; do
    if [[ -f "$DIST/$file" ]]; then files+=("$file"); fi
  done
  for file in "${files[@]}"; do
    [[ -f "$DIST/$file" && ! -L "$DIST/$file" ]] || fail "Missing file or unexpected symlink: $file"
  done
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
  build                           Compile and emit the static site in dist/
  bundle                          Rebuild HTML from existing dist/pkg (no Cargo)
  package [--output PATH]          ZIP the fixed public-file allowlist
  refresh-patch --adapted PATH --base REF
The output is static. Single-player needs no gateway; multiplayer uses an optional WebSocket gateway.
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
