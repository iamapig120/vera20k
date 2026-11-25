#!/usr/bin/env python3
"""Validate QA archive bytes and inventory; does not run or publish the game."""
import hashlib, io, json, re, sys, zipfile
from pathlib import Path, PurePosixPath
from stat import S_IFMT, S_IFREG
outer_sha, file = sys.argv[1:]
sha = lambda data: hashlib.sha256(data).hexdigest()
data = Path(file).read_bytes()
assert sha(data) == outer_sha
with zipfile.ZipFile(io.BytesIO(data)) as z:
    assert sorted(z.namelist()) == ['SHA256SUMS', 'pages-ra2-926a036-pure-v3.zip']
    inner = z.read('pages-ra2-926a036-pure-v3.zip')
    assert z.read('SHA256SUMS').decode().split() == [sha(inner), 'pages-ra2-926a036-pure-v3.zip']
with zipfile.ZipFile(io.BytesIO(inner)) as z:
    names = z.namelist()
    assert len(set(names)) == len(names) == 44 and sum(i.file_size for i in z.infolist()) < 80_000_000
    assert all(not i.is_dir() and S_IFMT(i.external_attr >> 16) in {0, S_IFREG} for i in z.infolist())
    for name in names:
        p = PurePosixPath(name)
        assert not p.is_absolute() and '..' not in p.parts and re.fullmatch(r'[A-Za-z0-9_./-]+', name)
        assert not re.search(r'\.(?:mix|csf|sav|fnt|bik|vqa|bag|aud|wav|mp3|mp4|exe|dll|pem|key|pfx|zip)$', name, re.I)
    fields = dict(line.split(': ', 1) for line in z.read('build-info.txt').decode().splitlines())
    assert fields['Revision'] == '926a036e648a505e9d2d93b87ee7a5ccff7e7953'
    assert fields['Web integration'] == 'e821c29d1de7962c348965b8e3011f6f735614a7'
    assert fields['Engine source tree'] == '37090817950f11ab3560bbd0617879c0a0c33a5a'
    wasm = z.read('pkg/vera20k_bg.wasm')
    assert wasm.startswith(b'\0asm')
    assert fields['WASM SHA256'] == sha(wasm)
    assert 'id="start-ra2"' in z.read('index.html').decode()
    assert 'export function start_ra2' in z.read('pkg/vera20k.js').decode()
    assert 'export function probe_ra2' in z.read('pkg/vera20k.js').decode()
    assert 'wss://wss.vera20k.com' in fields['Gateway']
print(json.dumps(dict(outerSha256=outer_sha, zipSha256=sha(inner), wasmSha256=sha(wasm), files=len(names), buildInfo=fields), ensure_ascii=False, indent=2))
