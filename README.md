# VERA20k Web releases

EA has not endorsed and does not support this product.

Use https://github.bysb.net/vera20k/ to select the current single-player release or the retained legacy release. Supply your own game files; this site distributes no retail assets, translation packs, music, player data, or Toy gateway.

Current wrapper corresponding source: https://github.com/iamapig120/vera20k/tree/5163eba8616a2dba68e88bf2ac05b9e88b1892d3
Official engine: https://github.com/YuriPlanet/vera20k/tree/79edebfa25eb3411105117409a3363497e4529b6
Current static prefix: releases/5163eba8616a/
Legacy prefix: releases/6994a5109615/ (unchanged, wrapper 6994a5109615, engine b6ef13b1).

The current engine writes envelope v2; the legacy engine accepts v1. The new metadata reader can list v1 saves, but neither strict loader converts the other format. Existing records are not cleared by this deployment. The launcher preserves pre-upgrade user bytes atomically and offers an export; these backups do not make binary formats compatible. Both releases use the same origin storage, so export before switching or overwriting a slot.

Complete pkg/snippets/fonts and GPL/Ares/font notices are included. Build uses the official single-player wasm cloud output unchanged, with SHA256 8f7ea8cce78cfd636f4d27d412081b34033e956eaae2fb4d6532f6483243fedf. No Cargo was run on Windows. Wrapper changes were implemented by ChatGPT at the repository owner's request.

Local validation: five host/IndexedDB checks, package membership/import closure, real sandboxed headless Edge WebGPU cold start, Chinese menu and campaign BIK, first mission, engine PNG and own generated save after refresh. Storage rollback used synthetic data. Real bidirectional game-format loading did not pass: the versions are explicitly incompatible. Test resources emitted TMP/SHP fallback warnings. Other DPR/fullscreen, long-running gameplay, audible audio and all languages have not been fully tested. No real player save or active player page was used.

Parent deployment commit: 714aee5cd4c491b654754dccfc57a615b742a693. Earlier releases and Git history are retained, with no forced history update.
