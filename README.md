# YR Web On-demand — Toy r04 source

Unofficial modified integration based on VERA20K. This is not an official VERA20K build. EA has not endorsed and does not support this product. The historical repository name is retained, while this integration is called YR Web On-demand.

This branch corresponds to the 20261108-r04 Toy package. It preserves the existing web-preview-source branch and includes code only: no retail/AI-media payloads, user saves, models, credentials, compiled Wasm, ZIPs or EA-derived icons are added in this snapshot. Existing repository history and the pinned public upstream repository retain their separate content and rights.

## Changes

- Guard older WebViews missing GPUAdapter.info before wgpu accesses info.description; use the existing WebGL2 backend.
- Automatically read the configured manifest after page initialization; hide URL/profile/read/cache controls and enable cache by default. Start remains a user action.
- Start requests Toy landscape immersion and browser fullscreen inside the click. Browser fullscreen covers the entire document so loading overlays remain descendants of its root. Unsupported/refused requests do not block gameplay.
- Resource requests use strict-origin-when-cross-origin, as requested by the owner, so browser-permitted cross-origin Referer contains the source origin without the page path. Opaque sandbox origins and host restrictions may still suppress it. No arbitrary Referer header is forged.
- Fresh Web profiles default to internal GameSpeed 2, matching ordinary campaign pace with -SPEEDCONTROL. Explicit persisted choices and desktop defaults are retained.
- Port the saved-game input/modal/loading scale fix to this pinned renderer's existing geometry and glyph interfaces.

## Source, license and build

Read LICENSE-GPL and notices/ENGINE-LEGAL.md; retain all upstream attribution and additional terms. Code licensing grants no retail-game, art, trademark or official-service rights. This source omits independent EA-derived PNG/ICO artwork; provide your own licensed PNG at assets/RA2MD.png when assembling a site.

The read-only vera20k submodule pins upstream 11eea2cec0e92c466d7dd3d1738d888a2f6015b7. patches/web-compat.patch and overlays/ are the complete engine adaptations; their reconstructed src tree is ee566d57ae7ea655c38d813f6ec0ccf7fecd4001, matching the compiled engine source. All Web templates, runtime loader, tests and build scripts are included. Initialize submodules, then use bash web.sh --ref 11eea2cec0e92c466d7dd3d1738d888a2f6015b7 prepare (or build). See docs/WEB-EXPERIMENTS.md for general build setup and tools/toy-build/README.md for Toy compilation. The historical experiment notes describe successive fixtures, rather than the current separate media package.

Exact frontend-input reconstruction and release hashes are in release/r04/. The ordinary Web build retains local resource selection; the Toy build only uses the configured manifest. Older r03 inputs are retained under release/r03/ for historical correspondence. The earlier OSS package's source archive predates this engine; use this branch or the new r04 source package for r04.

## Validation and limits

65 JavaScript tests pass. Owned muted headless tests reproduce the r03 description crash and verify r04 WebGL2 fallback, modern settings/skirmish/first Allied campaign, movie subtitles, manifest/bootstrap retries, refresh restoration, hot-menu zero new resource requests and actual Referer headers. The user-provided production manifest matches the local fixture byte-for-byte and allows the documented Toy content origin in its CORS response.

Native fullscreen is denied by this headless Edge even on a minimal page with an active user gesture. The requested root contains the loading panel and the App landscape/immersive call is verified with a stub; actual Toy App immersion/orientation is not claimed. Save/load scale integration compiles, but the previous 66 tests from a newer engine do not validate this port. No human audio listening, complete campaign, multiplayer, all resolutions or new simulation timing is claimed. See release/r04/BUILD.json for details.
