"""Run the existing build with reproducible source paths, preserving caller flags."""
from pathlib import Path
import os
import subprocess
import sys

web_root = Path(sys.argv[1]).resolve()
environment = os.environ.copy()
separator = chr(31)
flags = (environment['CARGO_ENCODED_RUSTFLAGS'].split(separator)
         if environment.get('CARGO_ENCODED_RUSTFLAGS') else environment.get('RUSTFLAGS', '').split())
roots = [(Path.home(), '/home'), (web_root.parent, '/workspace')]
for variable, fallback, label in [('CARGO_HOME', Path.home()/'.cargo', '/cargo'),
                                  ('RUSTUP_HOME', Path.home()/'.rustup', '/rustup'),
                                  ('CARGO_TARGET_DIR', None, '/cargo-target')]:
    value = environment.get(variable) or fallback
    if value:
        roots.append((Path(value).expanduser().resolve(), label))
roots.append((web_root, '/vera20k-web'))
for source, target in roots:
    assert source.parent != source, 'Do not remap a filesystem root'
    for spelling in dict.fromkeys([str(source), source.as_posix()]):
        flags.append(f'--remap-path-prefix={spelling}={target}')
environment['CARGO_ENCODED_RUSTFLAGS'] = separator.join(flags)
environment.pop('RUSTFLAGS', None)
print('Building with public source-path prefixes; caller environment unchanged.', flush=True)
raise SystemExit(subprocess.run([sys.executable, *sys.argv[2:]], env=environment).returncode)
