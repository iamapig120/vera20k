# Toy release build

Install the pinned compiler with npm ci --prefix tools/toy-build --ignore-scripts. After the normal Web build, run node tools/toy-build/build.cjs dist NEW_OUTPUT METADATA_JSON. The output directory must be new.

release.json configures the fixed manifest URL. VERA_TOY_MANIFEST_URL overrides it at build time for local tests. The Toy profile hides resource controls, selects bootstrap, keeps caching on, and automatically reads metadata. Game data downloads after Start. The official Toy SDK is referenced externally; it is not redistributed here. The helpers are bundled into fingerprinted .js with the generated Wasm wrapper external in pkg/. Source .mjs files are not runtime upload dependencies.

Keep the full source, pinned engine revision, patch/overlays, GPL and upstream legal notice available with the matching release. Game data and independent artwork are separate from the code license. See release/r04/REBUILD.md for exact frontend reconstruction.
