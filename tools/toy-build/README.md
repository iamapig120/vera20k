# Toy release build

Install the pinned compiler with npm ci --prefix tools/toy-build --ignore-scripts. After the normal Web build, run node tools/toy-build/build.cjs dist NEW_OUTPUT METADATA_JSON. The output directory must be new.

release.json configures the fixed manifest URL. VERA_TOY_MANIFEST_URL overrides it at build time for local tests. The Toy profile hides resource controls, selects bootstrap, keeps caching on, and automatically reads metadata. Game data downloads after Start. The official Toy SDK is referenced externally; it is not redistributed here. The helpers are bundled into fingerprinted .js with the generated Wasm wrapper external in pkg/. Source .mjs files are not runtime upload dependencies.

Keep the full source, pinned engine revision, patch/overlays, GPL and upstream legal notice available with the matching release. Game data and independent artwork are separate from the code license. See release/r04/REBUILD.md for exact frontend reconstruction.

## Toy single-player menu

Rebuild the engine and bindings before building this profile. The Toy launcher calls
configure_toy_menu(true) immediately before start_game. The default is false, and
changes after startup are rejected. Only Toy hides Internet and LAN, compacts the
remaining top rows, and updates the slide column; Single Player and offline
Skirmish remain available. This is product-specific UI policy, not retail parity.
The ordinary Web launcher does not call this export. Older Wasm/bindings are not
compatible with this new Toy launcher. No deployment is performed by these changes.

## Upstream separate-font package

The updated engine requires fonts_ready() after init() and before resource imports or Start. Keep the complete generated pkg/snippets/ tree (JavaScript only) and pkg/fonts/ tree (21 TTF/OTF faces, Unifont-CJK-15.bin and the three OFL licence notices) alongside the Wasm bindings. The Toy packager preserves their paths instead of bundling snippets: their import.meta.url resolves ../../fonts/<name>?v=<content SHA prefix>. NotoSans-VF.ttf and Unifont-CJK-15.bin preload before engine readiness; other faces are fetched only for missing glyphs. These are application files, not game resource-manifest entries. No OSS manifest or game resource checksum changes are needed. Use ordinary HTTP Content-Encoding compression if desired; do not rename the files to .br or serve compressed bytes without the matching header.

The build now traces the host snapshot layout before the Wasm compile and exports VERA20K_SNAPSHOT_LAYOUT. Both steps must use the same source revision. Full end-to-end browser validation remains required after any upstream update. Font preload failures block Start; this upstream version caches its failed preload promise, so a transient failure requires a page reload rather than only the Retry button.

## Dual-engine package (not deployment)

Build each engine as a standalone Toy site first. Then run:

```
node tools/toy-build/build-dual.cjs CURRENT_SITE LEGACY_SITE NEW_OUTPUT INPUT_METADATA_JSON
```

The input metadata must explicitly bind the tested layout IDs to the final packaged Wasm hashes, not the raw pre-bindgen binary:

```
{"current":{"layout":"d0a89b04","expectedWasmSha256":"<64 lowercase hex digits>"},"legacy":{"layout":"fbfc93bd","expectedWasmSha256":"<64 lowercase hex digits>"}}
```

The builder validates both hashes and any decimal `Snapshot layout` receipt in the inputs before copying. It refuses an existing output, preserves only the public-file allowlist and emits `dual-build-info.json` with output hashes. Source `storage.js` research wrappers are replaced with the canonical template plus explicit save-profile installation. The launcher is imported only after profile installation succeeds; configuration failure cannot start a new engine against the legacy default database.

The root page has explicit `new/` and `legacy/` choices and never downloads an engine on its own. It also offers user-triggered binary backup export and profile-checked restoration. Conflicting restores require a separate confirmation. Legacy uses `vera20k-web-v2`; current uses a layout-specific namespace and creates a byte-verified legacy snapshot before its first write. No save conversion or automatic engine selection occurs. Returning to the choice page requires the launcher's `vera20kPrepareNavigation()` save-flush hook; a missing hook or unsaved data blocks navigation.

Run `node --test tests/dual-build.test.cjs tests/engine-navigation.test.mjs tests/save-profiles.test.mjs` and a real-browser same-origin new/legacy round trip before distribution. This command does not upload or submit anything for review.

## Current-only package (active delivery path)

The current-only wrapper supersedes the dual-engine delivery design. It does not include or offer an older engine, migrate or read older saves, back them up, or delete them. The older dual-engine scripts above remain historical development tools, not the current release entry.

```
node tools/toy-build/build-current.cjs CURRENT_SITE NEW_OUTPUT INPUT_METADATA_JSON
```

Supply the tested final packaged Wasm hash and layout as either the metadata object itself or its `current` property: `{ "layout": "d0a89b04", "expectedWasmSha256": "<64 lowercase hex digits>" }`. Validation and the public-file allowlist match the package requirements. The output must be new. `current-build-info.json` records the actual hashes.

The wrapper copies canonical `storage.js`, synchronously installs `createVeraStorage('vera20k-web-layout-d0a89b04', {migrateLegacy:false})`, and only then imports the launcher. It never installs `save-profiles.js` or creates a backup namespace. Failure blocks startup with a readable message. A short pre-game notice explains that older saves are incompatible but their data is not deleted; it hides during gameplay. This packaging command never opens any browser database or uploads the package.

Test with `node --test tests/current-build.test.cjs` and the current-only real-browser smoke before distribution.
