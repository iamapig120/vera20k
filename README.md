# VERA20k Web

EA has not endorsed and does not support this product.

Play at https://github.bysb.net/vera20k/ using your own game files.
Corresponding GPLv3 source: https://github.com/iamapig120/vera20k/tree/6994a5109615a840dbbdd222dce8d63ce88b7553
Official engine: b6ef13b19c8c538a12eab7b2eb74ae5e2e3b486f.

Includes upstream campaign autosave migration (#3526), loading-dialog presentation (#3527), refresh-independent frame pacing and browser IME. Retains directory/ZIP/HTTPS import, atomic resource caching, backups, durable settings/saves, viewport sizing, YR-style defaults, remappable web fullscreen, campaign speed control and scaled map-dialog static text. Existing saved choices remain authoritative. Browser-reserved keys may require rebinding or the fullscreen button. No network gateway is deployed by this build.

Local validation: 154 native tests passed (one existing ignored), 42 host/import tests and six startup checks; WASM compiled and static paths, allowlist and private prefixes checked. This revision has not been run in a real browser/game session, so DPR/fullscreen, physical key behavior, BIK and real-save UI flows remain unverified. No existing player page or saved data was changed.

Only the current release is served; no retail resources, translation pack, music or private test/debug files are distributed. GPL and LGPL notices are retained. User resource and save databases are unchanged by deployment. Current asset prefix: `releases/6994a5109615/`. WASM SHA256: `f935ef37fe87c5c20e42f35a9e89176dca222c88c472381f5c29a29bdc09318a`. Previous deployment `663922ce566c2306ad042efaec602502ef246866` remains recoverable through ordinary Git history, without a public old-version entry.
