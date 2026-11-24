#!/usr/bin/env python3
"""Create and verify a Pages commit locally. Never pushes or edits remotes."""
import argparse, hashlib, html, json, re, shutil, subprocess
from pathlib import Path

def need(ok, msg):
    if not ok: raise SystemExit(msg)

p=argparse.ArgumentParser()
for k in ("checkout","dist","parent","wrapper","engine","wasm-sha256"): p.add_argument("--"+k,required=True)
a=p.parse_args()
for k,n in (("parent",40),("wrapper",40),("engine",40),("wasm_sha256",64)):
    need(re.fullmatch("[0-9a-f]{%d}"%n,getattr(a,k)), "Invalid "+k)
root=Path(a.checkout).resolve(); dist=Path(a.dist).resolve()
def git(*cmd): return subprocess.check_output(["git","-C",str(root),*cmd],text=True).strip()
need(git("rev-parse","HEAD")==a.parent,"Wrong deployment parent")
need(git("status","--porcelain","--untracked-files=all")=="","Pages checkout not clean")
need(dist!=root and root not in dist.parents and dist not in root.parents,"Isolate release and deployment trees")
prefix=f"releases/{a.wrapper[:12]}/"
dest=root/prefix
need(not dest.exists(),"Release prefix already exists")
required={"index.html","launcher.css","launcher.js","storage.js","user-data.mjs","resources.mjs","LICENSE-GPL","LICENSES/Ares.txt","build-info.txt","pkg/vera20k.js","pkg/vera20k_bg.wasm","pkg/fonts/OFL.txt"}
paths=set(); rows=[]
for path in sorted(dist.rglob("*")):
    name=path.relative_to(dist).as_posix()
    need(not path.is_symlink(),"Forbidden symlink "+name)
    if path.is_dir(): continue
    need(path.is_file(),"Not ordinary file: "+name)
    need(re.fullmatch(r"[A-Za-z0-9_./-]+",name) and not any(c.startswith(".") for c in name.split("/")),"Invalid path "+name)
    allow=(name in required or name in {"network.js","lobby.js","fullscreen.mjs"} or
           re.fullmatch(r"assets/[\w.-]+\.(png|svg|webp|ico)",name) or
           re.fullmatch(r"LICENSES/[\w.-]+\.txt",name) or
           re.fullmatch(r"pkg/vera20k(?:_bg\.wasm)?\.d\.ts",name) or
           re.fullmatch(r"pkg/fonts/(?:Noto[\w.-]+\.(?:otf|ttf)|Unifont[\w.-]+\.bin|OFL[\w.-]*\.txt)",name) or
           re.fullmatch(r"pkg/snippets/[\w./-]+\.js",name))
    need(allow,"Disallowed release file: "+name)
    need(not re.search(r"(^|/)(?:debug|test|fixtures?)(?:[./_-]|$)",name,re.I),"Non-public path "+name)
    raw=path.read_bytes()
    need(0<len(raw)<100_000_000,"Empty/oversized file: "+name)
    paths.add(name); rows.append({"path":prefix+name,"bytes":len(raw),"sha256":hashlib.sha256(raw).hexdigest()})
need(required<=paths,"Missing files: "+", ".join(sorted(required-paths)))
need(any(n.startswith("pkg/snippets/") for n in paths),"No wasm-bindgen snippets")
need(any(n.endswith((".ttf",".otf")) for n in paths),"No fonts")
font_paths={n for n in paths if n.startswith("pkg/fonts/")}
need(len(font_paths)>=3,"Font closure incomplete")
wasm=dist/"pkg/vera20k_bg.wasm"
need(wasm.read_bytes()[:4]==b"\0asm" and next(x["sha256"] for x in rows if x["path"]==prefix+"pkg/vera20k_bg.wasm")==a.wasm_sha256,"WASM identity mismatch")
# Static relative JS imports must resolve within the same immutable prefix.
for name in paths:
    if not name.endswith((".js",".mjs")): continue
    source=(dist/name).read_text()
    for spec in re.findall(r"""(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\bnew\s+URL\s*\(\s*)['"](\.{1,2}/[^'"?#]+)['"]""",source):
        target=((dist/name).parent/spec).resolve()
        need(target.is_relative_to(dist) and target.relative_to(dist).as_posix() in paths,"Unresolved import "+name+": "+spec)
info=(dist/"build-info.txt").read_text()
need(a.wrapper in info and a.engine in info,"build-info lacks exact commit IDs")
old=json.loads((root/"release-index.json").read_text())
need(old["retailAssetsDistributed"] is False,"Unexpected parent index")
historical=[old["current"],old["legacy"],*old.get("retained",[])]
kept={row["path"]:row for row in historical}
src=f"https://github.com/iamapig120/vera20k/tree/{a.wrapper}"
cur={"path":prefix,"sourceCommit":a.wrapper,"engineCommit":a.engine,"sourceUrl":src,"singlePlayer":False,"officialInternetGateway":True,"saveEnvelope":2,"files":rows}
shutil.copytree(dist,dest)
for row in rows:
    need(hashlib.sha256((root/row["path"]).read_bytes()).hexdigest()==row["sha256"],"Copied bytes changed")
(root/"release-index.json").write_text(json.dumps({"current":cur,"retained":list(kept.values()),"parentDeploymentCommit":a.parent,"saveFormatsCompatible":False,"retailAssetsDistributed":False,"toyGateway":False},ensure_ascii=False,indent=2)+"\n")
# Only the current release is linked from the landing page, without deleting archived URLs.
(root/"index.html").write_text(f"""<!doctype html>
<html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>VERA20k · 网页版</title><style>html{{color-scheme:dark;font:16px/1.65 system-ui,sans-serif;background:#10141b;color:#edf1f7}}body{{max-width:820px;margin:auto;padding:24px}}a{{color:#93cdff}}.button{{display:inline-block;padding:10px 18px;background:#244b70;color:white;border-radius:6px}}</style>
<p>EA has not endorsed and does not support this product.</p><h1>VERA20k 网页版</h1>
<p>使用自己的《尤里的复仇》游戏文件。本网站不提供原版资源或汉化包。游戏内的「互联网」入口连接官方网关；本站不提供自建联机网关。</p>
<p><a class="button" id="current-release" href="./{prefix}index.html">开始游戏</a></p>
<p>存档仍保存在此站点的浏览器数据中。更新不会清除数据；旧版本存档不保证能载入，请先导出备份。</p>
<p><a href="{html.escape(src)}">对应源代码</a> · <a href="./{prefix}build-info.txt">构建信息</a> · <a href="./LICENSE-GPL">GPLv3</a></p></html>
""")
(root/"README.md").write_text(f"""# VERA20k Web
EA has not endorsed and does not support this product.

Play at https://github.bysb.net/vera20k/ with your own game files. No retail assets, translation packs, music, player data, or Toy gateway are shipped. Internet mode uses the official gateway; this site does not host a custom relay.
Current wrapper source: {src}
Official engine source: https://github.com/YuriPlanet/vera20k/tree/{a.engine}
Current path: `{prefix}`. WASM SHA-256: `{a.wasm_sha256}`.
Earlier release trees and history are retained; the landing page links only the current release.
""")
git("add","--","README.md","index.html","release-index.json",prefix)
need(not git("diff","--cached","--name-only","--diff-filter=D"),"Deletion in deployment")
changes=git("diff","--cached","--name-only").splitlines()
need(all(n.startswith(prefix) or n in {"README.md","index.html","release-index.json"} for n in changes),"Unexpected staged paths")
# Imported package is byte-identical; third-party notices may retain CRLF/EOF.
git("diff","--cached","--check","--","README.md","index.html","release-index.json")
for row in rows:
    staged=subprocess.check_output(["git","-C",str(root),"show",":"+row["path"]])
    need(hashlib.sha256(staged).hexdigest()==row["sha256"],"Git index changed bytes: "+row["path"])
git("commit","-m",f"Publish VERA20k Web wrapper {a.wrapper[:12]} (engine {a.engine[:12]})")
need(git("rev-parse","HEAD^")==a.parent,"Incorrect commit parent")
need(git("status","--porcelain")=="","Deployment checkout not clean")
print(json.dumps({"parent":a.parent,"candidate":git("rev-parse","HEAD"),"tree":git("rev-parse","HEAD^{tree}"),"prefix":prefix,"wrapper":a.wrapper,"engine":a.engine,"wasmSha256":a.wasm_sha256,"fileCount":len(rows)}))
