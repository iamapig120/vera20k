const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const {fileURLToPath, pathToFileURL} = require('node:url');
const assert = require('node:assert/strict');

function files(root) {
  assert(fs.lstatSync(root).isDirectory() && !fs.lstatSync(root).isSymbolicLink(), 'Expected a real directory');
  const result = [];
  function visit(directory) {
    for (const name of fs.readdirSync(directory).sort()) {
      const full = path.join(directory, name), stat = fs.lstatSync(full);
      assert(!stat.isSymbolicLink(), 'Symlink/junction refused: ' + full);
      if (stat.isDirectory()) visit(full);
      else { assert(stat.isFile(), 'Non-file entry: ' + full); result.push(path.relative(root, full).replaceAll('\\', '/')); }
    }
  }
  visit(root);
  return result;
}

function inventory(root) {
  return files(root).map(name => {
    const bytes = fs.readFileSync(path.join(root, name));
    return {path: name, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex')};
  });
}

function copyPkg(source, destination) {
  source = path.resolve(source); destination = path.resolve(destination);
  assert(!fs.existsSync(destination), 'Destination already exists; refusing to overwrite');
  const relative = path.relative(source, destination);
  assert(relative.startsWith('..' + path.sep) || path.isAbsolute(relative), 'Destination must be outside source');
  const names = files(source);
  assert(names.includes('vera20k.js') && names.includes('vera20k_bg.wasm'), 'Missing primary Wasm bindings');
  for (const name of names) {
    assert(!/(^|\/)(\.git|\.env(?:\..*)?|gateway|retail)(\/|$)/i.test(name), 'Non-public package path: ' + name);
    assert(!/\.(mix|csf|sav|fnt|bik|vqa|bag|aud|wav|mp3|mp4|exe|dll|pem|key|pfx)$/i.test(name), 'Retail/private payload refused: ' + name);
  }
  const before = inventory(source);
  for (const name of names) {
    const output = path.join(destination, name);
    fs.mkdirSync(path.dirname(output), {recursive: true});
    fs.copyFileSync(path.join(source, name), output, fs.constants.COPYFILE_EXCL);
  }
  assert.deepEqual(inventory(destination), before, 'Package changed while copying');
  return before;
}

function exactFile(root, target) {
  const relative = path.relative(root, target);
  assert(relative && !relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative), 'Import escapes static root');
  let cursor = root;
  for (const name of relative.split(path.sep)) {
    assert(fs.readdirSync(cursor).includes(name), 'Missing/case-mismatched import: ' + relative);
    cursor = path.join(cursor, name);
    assert(!fs.lstatSync(cursor).isSymbolicLink(), 'Import symlink refused');
  }
  assert(fs.statSync(cursor).isFile(), 'Import is not a file: ' + relative);
}

function checkImports(root) {
  root = path.resolve(root);
  const edges = [], unchecked = [];
  for (const name of files(root).filter(name => /\.(m?js)$/.test(name))) {
    const source = fs.readFileSync(path.join(root, name), 'utf8');
    // Parse only: never link/evaluate the module or instantiate the Wasm.
    const module = new vm.SourceTextModule(source, {identifier: pathToFileURL(path.join(root, name)).href});
    for (const specifier of module.dependencySpecifiers) {
      assert(/^\.\.?\//.test(specifier) && !specifier.includes('\\'), 'Non-relative module import needs review: ' + specifier);
      const target = fileURLToPath(new URL(specifier, module.identifier));
      exactFile(root, target);
      edges.push({from: name, specifier, to: path.relative(root, target).replaceAll('\\', '/')});
    }
    if (/\bimport\s*\(/.test(source) || /\b(?:fetch\s*\(|new\s+URL\s*\()/.test(source)) unchecked.push(name);
  }
  return {staticImports: edges, runtimeUrlReview: unchecked, scope: 'Static import/export-from closure only; runtime URLs require a separate asset review'};
}

function checkSourceLink(buildInfo, sourceCommit, engineCommit) {
  assert(/^[a-f0-9]{40}$/.test(sourceCommit) && /^[a-f0-9]{40}$/.test(engineCommit), 'Use exact 40-character source and engine commits');
  const sources = [...buildInfo.matchAll(/^(?:Web integration|Corresponding source):\s*(?:https:\/\/github\.com\/iamapig120\/vera20k\/tree\/)?([a-f0-9]{40})\s*$/gm)].map(row => row[1]);
  const sourceLines = buildInfo.match(/^(?:Web integration|Corresponding source):.*$/gm) || [];
  const engines = [...buildInfo.matchAll(/^(?:Revision:|Official engine:|Upstream:?)\s+([a-f0-9]{40})\s*$/gm)].map(row => row[1]);
  assert(sources.length > 0 && sources.length === sourceLines.length && sources.every(value => value === sourceCommit), 'Stale, missing or conflicting corresponding-source commit');
  assert(engines.length > 0 && engines.every(value => value === engineCommit), 'Stale, missing or conflicting engine commit');
  return 'https://github.com/iamapig120/vera20k/tree/' + sourceCommit;
}

module.exports = {copyPkg, checkImports, checkSourceLink, inventory};
if (require.main === module) {
  const [action, input, output] = process.argv.slice(2);
  if (action === 'copy-pkg') console.log(JSON.stringify(copyPkg(input, output), null, 2));
  else if (action === 'check-imports') console.log(JSON.stringify(checkImports(input), null, 2));
  else throw Error('Usage: node --experimental-vm-modules package-preflight.cjs copy-pkg SOURCE_PKG NEW_PKG | check-imports FINAL_STATIC_ROOT');
}
