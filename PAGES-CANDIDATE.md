# Internet-enabled Pages source

Upstream engine `926a036e648a505e9d2d93b87ee7a5ccff7e7953` with `patches/pages-shared-engine.patch`: default Original YR Style for a fresh profile; explicit saved yes/no still wins. The launcher uses the matching official JS transports. Browser multiplayer is Internet-only via the upstream default `wss://wss.vera20k.com`; this package does not enable browser LAN, include a custom gateway, or require a key.

Use `bash tools/pages/build-network.sh /absolute/new/build-directory` with the matching official toolchain and wasm-bindgen. Keep the entire engine-generated pkg tree; don't include retail data.

After independently checking the cloud archive's engine pin and SHA256, copy its pkg to a NEW staging `dist/pkg` and bundle without Cargo:

```sh
node --experimental-vm-modules tools/package-preflight.cjs copy-pkg /cloud-output/pkg dist/pkg
bash web.sh bundle --expected-wasm-sha CLOUD_MANIFEST_SHA256
bash web.sh package --output /outside/dist/pages-candidate.zip
```

Bundling requires a clean committed source checkout, the expected full Wasm SHA256 and the pinned engine gitlink. It writes an immutable corresponding-source link and validates static module imports. The ZIP includes the entire pkg tree. Dynamic URLs, actual fonts, WebGPU PNG capture and real game startup still require runtime acceptance. No publishing is performed by these commands.

Before an engine starts, this wrapper atomically preserves user-data bytes in the existing users database's meta store. A failed snapshot stops startup and leaves the original data. The archive is made once per engine pin and is not overwritten when the same save slot is reused. Resources are not copied. Return to the launcher and use the upgrade-backup button to export the original-format JSON; the old wrapper can import it without clearing other records. Existing deleted records retain their deletion flags.

This preserves bytes, not binary save-format compatibility. The previous engine `b6ef13b1` accepts envelope v1; this pin writes and loads v2. Its metadata reader can list v1 saves, but its strict world loader rejects them. The previous engine rejects v2. These explicit version checks are in `src/sim/snapshot.rs`; this wrapper does not convert the format. A code rollback requires the original pre-upgrade bytes. The original config.toml remains exportable but is not passed into the new engine, which generates that file itself. Supported old INI settings use the upstream profile-import path; explicit new profile records win over old aliases. The same-origin browser regression used synthetic records, not real game saves.

Keep previous commits and build files for internal recovery only. No public legacy route is exposed and players’ databases are not deleted. This is a local candidate until engine provenance, complete asset hashes and runtime acceptance have all been checked.
