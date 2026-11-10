# Toy 261110: RMG repair and Skirmish setup-entry removal

This corresponding-source snapshot retains the Toy single-player menu and fixed 261110 resource manifest, includes the tested single-threaded Wasm random-map and initial resource-stage repairs, and removes the VERA-only Save Setup / Load Setup entries from Skirmish. Existing [Skirmish]/[MultiPlayer] profile memory and saved setup files are preserved. See docs/TOY-SKIRMISH-SETUP-ENTRIES.md.

It does not include the separate touch movie-skip, Esc frontend or new localization changes. The pinned engine does not include later upstream PR #3892's full Last Setup implementation.

## Corresponding engine and frontend

- Upstream pin: 11eea2cec0e92c466d7dd3d1738d888a2f6015b7.
- Engine adaptations: patches/web-compat.patch and overlays/, with unchanged upstream submodule.
- Packaged engine Wasm SHA-256: 395bc907f6fb059dad0d5dc328f8328647020443603394631f626f8b2baa78e7.
- Complete reconstructed source matches the previously compiled and browser-tested engine after CRLF/LF normalization: 5802 files, content SHA-256 833cf77e059ea6730fff64b17683b2337adaacfd4d1b002c6a7d9e955c8764d8.
- Active resource manifest: https://cdn.simpad.store/yr_res/vera20k-zh_hans-ai-261110/manifest.json . Game resources are separate from this code snapshot.

Initialize the submodule with git submodule update --init --recursive, then run bash web.sh --ref 11eea2cec0e92c466d7dd3d1738d888a2f6015b7 prepare. Use the generated .build/engine and its tools.cargo_run runner. The tested engine used Rust 1.97.0, target wasm32-unknown-unknown, no default features, feature wasm, profile fast, crate type cdylib, and linker stack size 8388608. Bindings used wasm-bindgen 0.2.127 with target web, remove-name-section and remove-producers-section. Supply licensed independent artwork at assets/RA2MD.png before assembling the site. Run bash web.sh bundle with matching dist/pkg, then node tools/toy-build/build.cjs dist NEW_OUTPUT METADATA_JSON with esbuild 0.28.2. See tools/toy-build/README.md for the pinned compiler setup.

Packaging may set the visible source link and build-info.txt receipt to this snapshot's immutable public Git commit URL. Those metadata edits do not alter the compiled engine or loader logic. Preserve LICENSE-GPL, LEGAL.txt and upstream attribution. No retail resources, compiled Wasm, credentials or user saves are committed to this source repository. Older release/r03 and release/r04 files describe historical builds, not this one. The Wasm hash identifies the tested binary and is not a bit-for-bit rebuild guarantee across arbitrary toolchains or Git build metadata.

## Verification boundaries

A complete offline Wasm build passed. The actual reconstructed source recipe matched that engine; a second redundant Cargo build was not performed after Web documentation commits. All 75 JavaScript regressions passed. Owned desktop headless Edge checks covered removed hit areas, repeated clicks and drag cancellation, Tab/Enter, map chooser cancellation/re-entry/Use Map, player-name keyboard editing, Back/revisit setting retention, preservation of existing setup files, ordinary Skirmish startup and prior RMG generation/resource-stage repairs. No JS exceptions, failed requests or resource-stage errors appeared in those local runs.

The focused Rust regression is included but the native Rust unit suite was not run. Physical phone/Toy App gameplay, all viewport sizes, human audio listening and multiplayer are not claimed. Upload and review status are separate platform actions and must be verified from their receipts; this source snapshot alone is not evidence of deployment or approval.
