# YR Toy test corresponding source

Upstream base: `926a036e648a505e9d2d93b87ee7a5ccff7e7953` (VERA20k 0.4.2).
Apply `engine.patch` to that exact upstream revision with `git apply`. The
same adaptation, including the new-profile YR-style default and Internet-only
browser menu, is used by GitHub Pages. The browser uses the default
`wss://wss.vera20k.com` and no custom gateway, key, or browser LAN signaling.

Build the engine with Rust 1.100.0, matching wasm-bindgen 0.2.127 and Cargo.lock
unchanged. Leave WS_PROXY_URL unset. Generate the snapshot layout via the
native tool; the Wasm build script embeds it. To reproduce the build profile:

```sh
export CARGO_BUILD_JOBS=1 CARGO_INCREMENTAL=0
export CARGO_PROFILE_FAST_OPT_LEVEL=0 CARGO_PROFILE_FAST_DEBUG=0 CARGO_PROFILE_FAST_CODEGEN_UNITS=256 CARGO_PROFILE_FAST_LTO=off
export CARGO_PROFILE_WASM_LTO=off CARGO_PROFILE_WASM_CODEGEN_UNITS=32
export RUSTC_BOOTSTRAP=1 RUSTFLAGS="-Zunstable-options --jobs-backend=1 --jobs-frontend=1 -Zfewer-names=yes"
python3 tools/wasm/build.py --profile wasm --network
```

Keep the complete generated `pkg`, including fonts and snippets. In this source
tree install locked esbuild 0.28.2 with
`npm ci --ignore-scripts --prefix wrapper/tools/toy-build`.
Point VERA_TOY_LOGO at the separately supplied authorized logo
(SHA-256 017a5021324b635e88d24bc37c8332bb6665d464a4c965f347627da429a7a5bd).
Pass the generated pkg, decimal snapshot id file, the adapted engine commit,
and an unused output directory to `wrapper/tools/toy-build/package-online.cjs`.

This repository contains no retail data, player data, compiled output or logo.
