# Reconstruct the r04 Toy frontend

input-site/ holds the exact editable modules, versioned pre-bundle HTML/CSS and generated wasm-bindgen JavaScript used by r04. Supply the matching engine Wasm at input-site/pkg/vera20k_bg.wasm (SHA-256 8e201bc8c3686596bff4ce41eec9cb375378fc5f3a450566d4739aecc7ae540c) and your own licensed image at input-site/assets/RA2MD.png. Wasm and game artwork are intentionally not in this code publication.

From the repository root:

    npm ci --prefix tools/toy-build --ignore-scripts
    node tools/toy-build/build.cjs release/r04/input-site NEW_OUTPUT METADATA_JSON

Copy notices/ENGINE-LEGAL.md to NEW_OUTPUT/LEGAL.txt and retain LICENSE-GPL. The pinned compiler and exact text inputs produce launcher.d1b63dc4067ea89e.js. Changing the independent image changes the distribution but not the launcher JS. Build the engine from the pinned submodule plus the patch/overlays above; cross-toolchain or ZIP timestamp byte identity is not promised.

The manifest URL is configured in tools/toy-build/release.json. VERA_TOY_MANIFEST_URL is a build-time override used only by the loopback test service. The release uses the owner's supplied HTTPS URL, with the same local fixture identities verified before packaging. No signed URL, key or game bytes are embedded in the launcher.

For owned headless tests, provide matching legally obtained resource fixtures and run node tests/toy-release-game.mjs dist PATH_TO_OSS_FIXTURE NEW_OUTPUT modern (or legacy). VERA_ESBUILD_PATH may point to the pinned installed esbuild module. These tests start local servers and close them on completion.
