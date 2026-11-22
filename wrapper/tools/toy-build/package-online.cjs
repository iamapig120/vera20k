// Package the matched, freshly generated wasm-bindgen output for the Toy launcher.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const {buildCurrent} = require('./build-current.cjs');

const [pkgPath, layoutPath, revision, outputPath] = process.argv.slice(2);
assert(outputPath && /^[a-f0-9]{40}$/.test(revision),
  'Usage: node package-online.cjs GENERATED_PKG SNAPSHOT_LAYOUT_FILE ENGINE_COMMIT NEW_OUTPUT_ROOT');
const source = path.resolve(__dirname, '../..');
const templates = path.join(source, 'templates');
const output = path.resolve(outputPath);
const raw = path.join(output, 'raw');
const bundle = path.join(output, 'bundled');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const wasm = fs.readFileSync(path.join(pkgPath, 'vera20k_bg.wasm'));
const layout = Number(fs.readFileSync(layoutPath, 'utf8').trim());
assert(Number.isInteger(layout) && layout >= 0x80000000 && layout <= 0xffffffff, 'Invalid traced snapshot layout');
const bindings = fs.readFileSync(path.join(pkgPath, 'vera20k.js'), 'utf8');
for (const required of ['configure_remote_assets', 'finish_remote_asset', 'fonts_ready', 'veraLobbyOpen', 'veraLobbyRequest', 'veraSocketOpen']) {
  assert(bindings.includes(required), 'Missing generated binding: ' + required);
}
assert(!/veraLan[A-Z]/.test(bindings), 'Unexpected LAN binding');
const expectedWasmSha256 = hash(wasm);
const cache = crypto.createHash('sha256').update(wasm);
for (const name of fs.readdirSync(templates).sort()) cache.update(fs.readFileSync(path.join(templates, name)));
cache.update(bindings);
const version = cache.digest('hex').slice(0,40);

fs.mkdirSync(output);
fs.mkdirSync(raw);
fs.cpSync(pkgPath, path.join(raw, 'pkg'), {recursive: true});
const logo = process.env.VERA_TOY_LOGO || path.join(source, 'assets/RA2MD.png');
fs.mkdirSync(path.join(raw, 'assets'));
fs.copyFileSync(logo, path.join(raw, 'assets/RA2MD.png'));
fs.copyFileSync(path.join(source, 'LICENSE-GPL'), path.join(raw, 'LICENSE-GPL'));
fs.copyFileSync(path.join(source, 'notices/ENGINE-LEGAL.md'), path.join(raw, 'LEGAL.txt'));
for (const name of fs.readdirSync(templates)) {
  let content = fs.readFileSync(path.join(templates, name), 'utf8');
  if (name === 'index.html') content = content.replace(/^[ \t]+/gm, '')
    .replace(/(\.\/(?:launcher\.css|storage\.js|lobby\.js|network\.js|launcher\.js))"/g, '$1?v=' + version + '"');
  if (name === 'launcher.js') content = content.replace(/(\.\/pkg\/vera20k(?:_bg\.wasm|\.js))'/g, "$1?v=" + version + "'");
  fs.writeFileSync(path.join(raw, name), content);
}
fs.writeFileSync(path.join(raw, 'build-info.txt'), [
  'Local Toy build', 'Engine revision ' + revision, 'Wasm features wasm-net (single-threaded)',
  'Wasm SHA256 ' + expectedWasmSha256, 'Snapshot layout ' + layout, ''
].join('\n'));
execFileSync(process.execPath, [path.join(__dirname, 'build.cjs'), raw, bundle, path.join(output, 'bundle.json')],
  {cwd: source, stdio: 'inherit', windowsHide: true});
buildCurrent({input: bundle, output: path.join(output, 'candidate'),
  metadata: {layout: layout.toString(16), expectedWasmSha256, sourceRevision: revision}});
