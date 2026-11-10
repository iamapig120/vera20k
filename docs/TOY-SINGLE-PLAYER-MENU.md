# Toy-only single-player main menu

This branch-specific product policy hides Internet (0x0684) and LAN (0x0578)
from the Toy main menu. Single Player, its offline Skirmish route, Movies and
Credits, Options, and Exit remain available. The remaining top buttons move up.

The default engine profile is unchanged. Only tools/toy-build/release.cjs injects
configure_toy_menu(true) immediately before start_game. The host cannot change
this setting after startup. Desktop builds and the ordinary Web launcher do not
opt in. The feature does not remove engine networking code or alter simulation.

The filtered layout feeds the existing button/label renderer and pointer
controller. Slide-in and slide-out use the same three top-button count. The pinned
main menu has no registered keyboard controls, and the action dispatcher rejects
Internet/LAN while the Toy profile is active. This is deliberate product behavior,
not a claim of retail parity.

## Build and review

Rebuild the Wasm engine and wasm-bindgen wrapper together before assembling Toy.
An old Wasm/wrapper cannot be paired with this new launcher. Keep the pinned
upstream and all adaptations in patches/web-compat.patch and overlays/. Do not
edit the upstream submodule. No upstream, PR, source publication, or deployment
is included in this change.

The r05c source snapshot pins upstream 11eea2cec0e92c466d7dd3d1738d888a2f6015b7.
The local work was reconstructed from that revision and the existing patch and
overlays, not from another working directory's pending changes.

Regression coverage is in the main-menu Rust state tests and tests/toy.test.mjs.
The main-menu policy tests cover the render/input list, compacted rows, blank-row
clicks, pointer release, keyboard routing, unchanged Standard layout, and blocked
multiplayer actions. The ordinary Single Player and Skirmish implementation is
unchanged. Runtime screenshots and build receipts belong outside source control.
