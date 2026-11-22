# YR Toy test corresponding source

This tree contains the Toy wrapper and a patch against VERA20k 79edebfa25eb3411105117409a3363497e4529b6.
Engine adaptation commit: a8dca8870db3e114321d56e391bf757331fc2196.
Wrapper integration commit: 4e4f4113c56df244fc5bec96c7bc1850ff66e6f4.
Upstream source: https://github.com/YuriPlanet/vera20k/tree/79edebfa25eb3411105117409a3363497e4529b6

## Rebuild

1. Check out that exact upstream engine revision, then apply engine.patch with git apply.
2. With Rust 1.97.0 and Cargo.lock unchanged, build the native snapshot layout tool:
   cargo build -p vera20k-core --bin snapshot-layout --profile fast --locked
3. Run the resulting snapshot-layout executable and put its decimal stdout in
   snapshot-layout.txt. Export that same value as VERA20K_SNAPSHOT_LAYOUT.
4. Build single-threaded browser bindings from the engine:
   cargo rustc -p vera20k --lib --target wasm32-unknown-unknown --no-default-features --features wasm-net --profile fast --locked --crate-type cdylib -- -C link-arg=-zstack-size=8388608
5. With wasm-bindgen CLI 0.2.127, run:
   wasm-bindgen --target web --out-dir pkg target/wasm32-unknown-unknown/fast/vera20k.wasm
   Copy the upstream font files (.ttf, .otf, .bin) and OFL*.txt from
   src/render/fonts into pkg/fonts. Preserve the generated pkg/snippets tree.
6. In wrapper, install locked esbuild 0.28.2 with:
   npm ci --ignore-scripts --prefix tools/toy-build
7. Point VERA_TOY_LOGO to the separately supplied authorized logo artwork.
   Its SHA-256 is 017a5021324b635e88d24bc37c8332bb6665d464a4c965f347627da429a7a5bd.
   Run:
   node tools/toy-build/package-online.cjs PATH_TO_PKG PATH_TO_LAYOUT_FILE a8dca8870db3e114321d56e391bf757331fc2196 NEW_OUTPUT_ROOT

The candidate directory under NEW_OUTPUT_ROOT contains the site. The release
receipt records exact file hashes and the immutable corresponding-source URL.
The measured Wasm SHA-256 is 297c152dd1ad6e8db2f48500a5ff0723a30611af258d2663f2b8eeef90b821cd.
Retail data, artwork, compiled output and player data are excluded from this
source tree. Refer to wrapper/LICENSE-GPL and wrapper/notices/ENGINE-LEGAL.md.