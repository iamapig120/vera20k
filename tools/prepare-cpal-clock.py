"""Apply one WebAudio clock fix to the exact locked CPAL source, outside Cargo's cache."""
from pathlib import Path, PurePosixPath
import hashlib
import json
import os
import re
import subprocess
import sys
import tarfile

engine, build = (Path(value).resolve() for value in sys.argv[1:3])
assert engine.parent == build, 'Generated source must stay in the build directory'
lock_path = engine / 'Cargo.lock'
lock = lock_path.read_text(encoding='utf8')
blocks = lock.split('[[package]]')
block = next(part for part in blocks if re.search(r'^name = "cpal"$', part, re.M))
version = re.search(r'^version = "([^"]+)"$', block, re.M).group(1)
assert version == '0.17.3', 'Recheck the clock fix when updating CPAL'
checksum = re.search(r'^checksum = "([^"]+)"$', block, re.M).group(1)
cargo_home = Path(os.environ.get('CARGO_HOME', Path.home() / '.cargo'))
archives = list((cargo_home / 'registry/cache').glob(f'*/cpal-{version}.crate'))
if not archives:
    subprocess.run(['cargo', 'fetch', '--locked', '--target', 'wasm32-unknown-unknown',
                    '--manifest-path', str(engine / 'Cargo.toml')], check=True)
    archives = list((cargo_home / 'registry/cache').glob(f'*/cpal-{version}.crate'))
archive = next(path for path in archives if hashlib.sha256(path.read_bytes()).hexdigest() == checksum)
old = 'if *time_at_start_of_buffer > 0.001 {'
new = ('if *time_at_start_of_buffer > 0.001\n'
       '                            && *time_at_start_of_buffer >= now\n'
       '                        {')
key = hashlib.sha256((checksum + new).encode()).hexdigest()[:12]
vendor = build / f'cpal-clock-{version}-{key}'
vendor.mkdir(exist_ok=True)
with tarfile.open(archive, 'r:gz') as source:
    prefix = f'cpal-{version}/'
    for member in source:
        assert member.name.startswith(prefix), member.name
        relative = PurePosixPath(member.name[len(prefix):])
        assert not relative.is_absolute() and '..' not in relative.parts, member.name
        if member.isdir():
            continue
        assert member.isfile(), 'Only ordinary crate source files are accepted'
        content = source.extractfile(member).read()
        if str(relative) == 'src/host/webaudio/mod.rs':
            text = content.decode('utf8')
            assert text.count(old) == 1
            content = text.replace(old, new, 1).encode('utf8')
        target = vendor.joinpath(*relative.parts)
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists():
            assert target.read_bytes() == content, f'Preserving edited generated source: {target}'
        else:
            target.write_bytes(content)
(vendor / '.clock-fix-origin.json').write_text(json.dumps({'version':version,
    'registrySha256':checksum,'change':'Reanchor expired WebAudio buffer cursor to current_time +25ms'}),encoding='utf8')
manifest = engine / 'Cargo.toml'
text = manifest.read_text(encoding='utf8')
assert '[patch.crates-io]' not in text
relative_vendor = os.path.relpath(vendor, engine).replace('\\', '/')
manifest.write_text(text + f'\n[patch.crates-io]\ncpal = {{ path = "{relative_vendor}" }}\n', encoding='utf8')
patched_block = re.sub(r'^(source|checksum) = "[^"]+"\n', '', block, flags=re.M)
lock_path.write_text(lock.replace(block, patched_block, 1), encoding='utf8')
print('Applied locked CPAL WebAudio clock fix; registry source/cache unchanged.')
