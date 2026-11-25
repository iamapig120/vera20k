# yr-test edition picker (isolated QA, not published)

The launcher shows two accessible radio cards. YR is selected on every load. The single Start action invokes the original launcher, byte-for-byte, for YR; the separate experimental engine is lazy-loaded only after choosing RA2. RA2 loads user-owned local archives, never the YR remote manifest or its cache, and uses an independent IndexedDB namespace. File-picker availability and a real RA2 campaign must still be verified in Bilibili Toy before promotion.

## Exact inputs and build

- Existing audited YR ZIP: SHA-256 `3b74d19f29224e249fbf93abb44bed0e1763f7c112edb2092f6a72f15bffe2d8`. Wrapper source `939b0bde7cb325ef0ddddb9d813737b2ff6e20ac`.
- Paired engine ZIP from GitHub Actions 45547820943 / artifact 14993231140 (inner SHA-256 `9ab3d173230c29456f2a67ea71d129327467548321ea3e887a35c4a638c4fa82`); RA2 engine source and exact integration are at [0676dc7](https://github.com/iamapig120/vera20k/tree/0676dc7a2eaaaf1878f77ca9bb5e9aead75eaccc).
- Extract the inputs into separate directories, then run `node assemble.cjs AUDITED_YR_SITE PAIRED_RA2_SITE NEW_OUTPUT_DIRECTORY`. The output carries a full file checksum receipt and no retail game files. The app binaries are both included, but matched fonts and snippets exist only once. YR's network fingerprint, legacy resource URL, and save namespace are unmodified.
- For the simulated iframe smoke: `CHROME_BIN=/path/to/chromium node browser-check.cjs /path/to/output` with Playwright resolvable. Test fixtures contain no retail files, and must not be treated as an end-to-end game test.

## Remaining validation

Before submitting, verify a genuine original RA2 mission and default YR start with owned retail in the browser. In the real Toy preview verify the operating-system picker is available in the app/container, independent persistence on repeat launch, no page navigation, and the normal YR remote-manifest flow. The current paired engine requires `ra2.mix`, `ra2md.mix`, `language.mix` and `multi.mix` to launch RA2; this archive requirement does not mean YR rules are used. No bundled RA2 archives are supplied. The total package limit varies by Toy account; the public 1 MiB uncompressed entry page rule is checked separately.
