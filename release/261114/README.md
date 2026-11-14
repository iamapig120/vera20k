# Localized current-engine Toy source

Engine base: 3978fd185f123ca2ad217b38d8664aec453e24f9. Apply web.config, patches/web-compat.patch and overlays using `bash web.sh build`. Do not compile the unmodified submodule. The normal build generates bindings, fonts and browser helpers in dist. Install the pinned packager with `npm ci --prefix tools/toy-build --ignore-scripts`.

For the exact 261114 Toy page, replace dist/index.html with release/261114/source-index.html after building. This is the precise pre-Toy-build HTML input; it contains no game assets. Refresh its `?v=` cache suffixes to the freshly compiled Wasm SHA-256 prefix (40 hex characters). web.sh versions the generated launcher/runtime imports similarly.

Create metadata.json with `{"current":{"layout":"d0a89b04","expectedWasmSha256":"<actual SHA-256 of dist/pkg/vera20k_bg.wasm>"}}` and record `Snapshot layout 3500710660` in dist/build-info.txt for the matching build. Then:

```
node tools/toy-build/build.cjs dist toy-input bundler-report.json
node tools/toy-build/build-current.cjs toy-input toy-output metadata.json
```

Both output directories must be new. Keep the generated pkg/fonts and pkg/snippets trees. The second step installs the layout-specific save namespace without migrating, reading or deleting legacy saves. Update the public source hyperlinks and build-info to the published source commit before distributing the final package. Game resources remain separately supplied by the configured manifest.

This source includes upstream integration, reviewed Chinese options with Toy's Chinese default, saved language overrides, Space-release movie skipping, iframe-safe Keyboard Lock, mobile layout, initial total progress and independent current-engine save storage. No withdrawn GAME.FNT status-card experiment is included. Native i18n regression tests are present but were not executed in the Wasm-only verification run.

