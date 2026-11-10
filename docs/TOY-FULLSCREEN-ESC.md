# Escape in the Toy fullscreen game

The frontend requests browser fullscreen with keyboard capture and, when available, asks Keyboard Lock for Escape only. Escape key events keep propagating to the game, while their browser default is suppressed during this document's fullscreen session. This preserves game actions such as movie skip and menu handling. The browser's own long-press Escape exit route and the explicit fullscreen toggle remain available.

When capture is granted, the frontend clears its status text. It does not add another long-press-success hint on top of the browser's own message. Unsupported or refused locking still provides a specific fallback diagnostic and never blocks gameplay. Exit/re-entry and late asynchronous results are covered by focused frontend tests.

This is frontend-only; engine Wasm remains SHA-256 395bc907f6fb059dad0d5dc328f8328647020443603394631f626f8b2baa78e7 with the existing RMG and Skirmish entry-removal changes. The full JavaScript suite contains 83 passing tests. Actual fullscreen and keyboard-capture grants depend on the browser and host; a headless browser's refusal is not reported as a real native fullscreen pass. No mobile Toy App acceptance or new touch-movie-skip behavior is claimed.
