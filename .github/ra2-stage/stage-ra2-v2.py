#!/usr/bin/env python3
"""Create a local candidate. No network, push, ref changes or Pages settings."""
import argparse, hashlib, io, json, subprocess, sys, zipfile
from pathlib import Path

p=argparse.ArgumentParser()
p.add_argument('checkout')
p.add_argument('outer_zip')
a=p.parse_args()
root=Path(a.checkout).resolve()
archive=Path(a.outer_zip).resolve()
parent='dd22bd98ab2996aff05736106e5d81ee13aa8eea'
outer_sha='95483892bb583625982ed33af47d2d2a6b2a32a613c0c4f5f84756fdb9e7e1cf'
inner_sha='0b2f6b8ed7807f3dc516fe11c467eb59c429ca9be5063ee045958ba96538a249'
prefix='releases/f3cb68d8792f/'
link=f'<p><a id="experimental-ra2" href="./{prefix}index.html#start-ra2">原版红色警戒 2（实验）</a></p>'
original_link='<p><a class="button" id="current-release" href="./releases/890f0578cff8/index.html">开始游戏</a></p>'
def run(*cmd):
    return subprocess.check_output(['git','-C',str(root),*cmd])
def git(*cmd):
    return run(*cmd).decode().strip()
assert git('rev-parse','HEAD')==parent
assert not git('status','--porcelain','--untracked-files=all')
assert not (root / prefix).exists() and root not in archive.parents
verify=Path(__file__).with_name('verify-build-artifact-v2.py')
receipt=json.loads(subprocess.check_output([sys.executable,str(verify),outer_sha,str(archive)]))
assert receipt['zipSha256']==inner_sha
original=(root/'index.html').read_bytes()
marker=original_link.encode()+b'\n'
assert original.count(marker)==1
amended=original.replace(marker,marker+link.encode()+b'\n',1)

with zipfile.ZipFile(archive) as outer:
    inner=outer.read('pages-ra2-926a036-pure.zip')
with zipfile.ZipFile(io.BytesIO(inner)) as package:
    names=package.namelist()
    index=package.read('index.html')
    assert b'<details id="edition-switch" hidden>' in index
    assert b'<button id="start-ra2"' in index
    for name in names:
        target=root/prefix/name
        target.parent.mkdir(parents=True,exist_ok=True)
        target.write_bytes(package.read(name))
    (root/'index.html').write_bytes(amended)
    git('add','--','index.html',prefix)
    assert not git('diff','--cached','--name-only','--diff-filter=D')
    git('diff','--cached','--check','--','index.html')
    changes=set(git('diff','--cached','--name-status').splitlines())
    assert changes=={'M\tindex.html'}|{f'A\t{prefix}{name}' for name in names}
    assert run('show',':index.html').replace(link.encode()+b'\n',b'',1)==original
    assert all(run('show',f':{prefix}{name}')==package.read(name) for name in names)
git('commit','-m','Stage optional original Red Alert 2 experimental Pages link')
assert git('rev-parse','HEAD^')==parent and not git('status','--porcelain')
print(json.dumps(dict(parent=parent,candidate=git('rev-parse','HEAD'),tree=git('rev-parse','HEAD^{tree}'),prefix=prefix,link=f'./{prefix}index.html#start-ra2',newFiles=len(names),modified=['index.html'],zipSha256=inner_sha),ensure_ascii=False))
