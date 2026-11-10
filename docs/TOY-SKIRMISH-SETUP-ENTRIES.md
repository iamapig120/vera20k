# Toy Skirmish setup entries

This Toy source branch removes the VERA-only Save Setup and Load Setup entries from offline Skirmish. It does not modify the pinned upstream repository, its branches, or the standard upstream build.

The compatibility patch removes both entry identities and app actions, mouse hit areas, hover help, labels, button faces and the two extra slide-column buttons. Start Game, Customize Battle / Choose Map and Back retain their geometry and actions. Existing per-map setup files and current [Skirmish]/[MultiPlayer] automatic profile memory are preserved. The pinned engine does not include the later full Last Setup implementation from upstream PR #3892.

The entries originated in upstream PR #3851 (feature commit 0a2ee1a0c14dda11719e78aff1d06cc0ae427fad, merged as 89c53e6fe75588aaa55d2d779f6dfc3e58a6bf09). Their removal is a local Toy product decision, not an upstream parity fix.

This branch also retains the separately tested single-threaded Wasm random-map generation and initial resource-stage repairs. Reconstruct with the existing pinned upstream, compatibility patch and overlays, using web.sh prepare/build. No generated Wasm, retail resources or user data are committed here.

Validation: reconstructed engine sources match the complete previously compiled and browser-tested Toy/RMG/entry-removal candidate after CRLF/LF normalization. That candidate passed a complete Wasm build, 75 JavaScript regressions, old-tile click/drag and Tab/Enter checks, Choose Map Cancel/re-entry/Use Map, player-name keyboard editing, Back/revisit settings retention and ordinary Skirmish startup. A production Rust regression for inert old hit areas is included in the patch, but the native Rust test suite was not run. Physical Toy App/phone acceptance and all viewport sizes are not claimed.

Publication is a separate owner-authorized action. Source availability, uploaded-package correspondence and platform review status must be verified independently. Separate Esc, touch-movie-skip and new localization changes are not included.
