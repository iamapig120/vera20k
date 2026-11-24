#!/usr/bin/env python3
"""Bounded, non-executable zip extraction of an already SHA-verified package."""
from pathlib import Path, PurePosixPath
import shutil, stat, sys, zipfile
archive, dest = Path(sys.argv[1]), Path(sys.argv[2])
dest.mkdir()
with zipfile.ZipFile(archive) as z:
    entries = z.infolist()
    if len(entries) > 500 or sum(x.file_size for x in entries) > 250_000_000:
        raise SystemExit("Oversized package inventory")
    seen = set()
    for item in entries:
        name = PurePosixPath(item.filename)
        if name.is_absolute() or ".." in name.parts or "\\" in item.filename or name in seen:
            raise SystemExit("Unsafe archive member")
        seen.add(name)
        kind = stat.S_IFMT(item.external_attr >> 16)
        if kind not in (0, stat.S_IFREG, stat.S_IFDIR):
            raise SystemExit("Non-regular archive member")
        if item.is_dir(): continue
        target = dest.joinpath(*name.parts)
        target.parent.mkdir(parents=True, exist_ok=True)
        with z.open(item) as source, target.open("xb") as out:
            shutil.copyfileobj(source, out)
