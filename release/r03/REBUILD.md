# Exact r03 frontend rebuild

input-site/ contains the exact pre-bundle JavaScript, editable modules, HTML/CSS, generated wasm-bindgen JavaScript, notices and build metadata used by r03. Compiled Wasm and game artwork are deliberately omitted.

Run from the repository root:

    npm ci --prefix tools/toy-build --ignore-scripts
    node tools/toy-build/build.cjs release/r03/input-site .build/r03-rebuilt .build/r03-metafile.json

Before running, supply release/r03/input-site/pkg/vera20k_bg.wasm from the matching local r03 package (SHA-256 905c64e7a1990f819e25da4fa4b60636e59a8d8d74c2278def6b80441f3d3671) or rebuild the pinned adapted engine, and supply a licensed image at release/r03/input-site/assets/RA2MD.png. The image does not participate in JavaScript compilation; changing it changes the resulting distribution. Copy notices/ENGINE-LEGAL.md to .build/r03-rebuilt/LEGAL.txt and retain LICENSE-GPL. ZIP the output root if needed.

With the matching compiler and these inputs, the output launcher is launcher.aadd281b72b4c749.js. The generated JS was reproduced byte-for-byte from the source supplement before publication. ZIP timestamps are not promised reproducible; a newly compiled engine is not promised byte-identical across toolchains.

The full engine source is the pinned upstream submodule plus patches/web-compat.patch and overlays/. No private source archive, retail game files, OSS access key, or model is required to obtain that source. The generated wrapper in input-site/pkg/vera20k.js is included for exact frontend reconstruction and is regenerated with the engine build.

The delivered r03 page retains its historical integration-source hyperlink. This branch is the matching modified source; use this branch URL when distributing it and update that hyperlink in future builds.
