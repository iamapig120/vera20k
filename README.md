EA has not endorsed and does not support this product.

# VERA20K browser preview

Single-player WebAssembly engine built from [libi's PR 3139](https://github.com/YuriPlanet/vera20k/pull/3139).

Engine commit: `41f7ff9446a15c9812ea4ff7678458c2003abb1d`.
The unchanged source is preserved on [pr-3139-wasm](https://github.com/iamapig120/vera20k/tree/pr-3139-wasm).
The HTML launcher is localized for this preview; its source is this branch's `index.html` and `host.js`.

Copyright © 2026 Halvor Nikolai Rusten and VERA20K contributors.
Engine source and this launcher are available under [GNU GPL version 3](LICENSE-GPL).
Game assets belong to their respective owners and are not included.
Select your own extracted retail resource folder. The launcher reads those files locally;
it contains no resource-upload endpoint. Settings and game saves use this site's IndexedDB.
Retail resources must be selected again after reload.

## Rebuild

Use Rust 1.97.0, Python 3.11+, and Git 2.31+ (the original build helper uses `--path-format`).

```sh
git clone https://github.com/iamapig120/vera20k.git
cd vera20k
git checkout 41f7ff9446a15c9812ea4ff7678458c2003abb1d
rustup toolchain install 1.97.0 --profile minimal --target wasm32-unknown-unknown
cargo +1.97.0 install wasm-bindgen-cli --version 0.2.114 --locked
# Select Rust 1.97.0 in the process environment before invoking the Python helper.
# PowerShell: $env:RUSTUP_TOOLCHAIN = '1.97.0'
# POSIX shell: export RUSTUP_TOOLCHAIN=1.97.0
python tools/wasm/build.py
python -m http.server 8000 --bind 127.0.0.1 --directory target/wasm-dist
```

The helper uses Cargo.lock, the `fast` optimized profile and an 8 MiB Wasm stack.
This preview uses wasm-bindgen-cli 0.2.114 and wgpu 29.0.4.
WebGPU and HTTPS or localhost are required. LAN/online multiplayer, random-map
generation and synchronous GPU capture are unavailable in this PR.
Successful compilation does not establish complete gameplay or save/load compatibility.
