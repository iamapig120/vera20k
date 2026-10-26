EA has not endorsed and does not support this product.

# VERA20K 中文测试平台

本页为单人 WebGPU 测试平台。选择或拖入你自己的完整尤里的复仇资源文件夹／ZIP，
或输入允许 CORS 读取的 HTTPS ZIP 地址；文件不会上传至本项目服务器。
本仓库不包含原版游戏资源、音乐、电影或用户汉化素材，也不提供这些内容的下载地址。
游戏资源的非商业使用并不自动授予公开再分发权利。

引擎固定为 [PR #3139](https://github.com/YuriPlanet/vera20k/pull/3139)
的 `41f7ff9446a15c9812ea4ff7678458c2003abb1d`。
未修改引擎；[完整对应源码](https://github.com/iamapig120/vera20k/tree/pr-3139-wasm)
公开可下载。当前分支的 HTML、CSS 和 JavaScript 是启动器源码。
2026-10-26 修改：加入中文启动器、文件夹／ZIP／URL 导入、资源缓存和独立用户数据存储。
设计参考 [libi/vera20k-web](https://github.com/libi/vera20k-web/tree/5afb0d2166f3d6d2bb95e265982838feba116f3f)，
未引入其新版引擎或网关。Copyright © 2026 Halvor Nikolai Rusten and VERA20K contributors.
引擎及本启动器按 [GPLv3](LICENSE-GPL) 提供，不提供担保。

## 资源与缓存

支持 UTF-8 文件名、普通 Store/Deflate ZIP、一个嵌套游戏根目录。最低需要
`ra2.mix`、`ra2md.mix`、`mapsmd03.mix`、`movmd03.mix`；最低检查不能证明其他资源完整。
旧引擎需要原始 YR 电影归档；不含中文配音电影不代表可以删除全部原始电影。
上限：下载 ZIP 2 GiB、解压总量 2 GiB、单文件 1 GiB、12,000 条目、32 层路径。
拒绝路径穿越、重复路径、符号链接、校验失败、加密、分卷、ZIP64 和自解压程序。
EXE、脚本和存档不会作为游戏资源导入。加密／ZIP64 等格式可先在本机解压，再选择文件夹。

下载不携带站点登录凭据；来源必须提供浏览器可读的 HTTPS 响应。遇到 CORS 拒绝，
先保存 ZIP 再从本机导入；本项目没有下载代理。30 秒没有下载数据会报错，可取消或重试。
来源 URL 不保存到资源缓存记录。

可选将资源保存到同源 IndexedDB；设置及存档沿用独立的 `vera20k-wasm-user-data/files`，
资源位于 `vera20k-pr3139-resource-library/library`。更换资源不清空用户数据。
候选完整校验后才原子替换缓存；取消、下载／解压失败或事务失败保留旧缓存。
提交缓存时暂时不能取消，20 秒存储超时会中止事务。缓存失败仍可用当前内存资源开始。
浏览器空间不足、隐私模式、手动清理或更换源地址可能影响缓存；应自行保留重要存档备份。
引擎启动后需要刷新页面才能更换资源，部分导入后无法回滚引擎内存。

大资源逐文件读入引擎，ZIP 逐条目流式解压；完整包、解压 Blob、候选／旧资源及 Wasm 堆
仍可能同时存在。2 GiB 是数据上限，不是内存上限。低内存设备建议文件夹导入并关闭资源缓存。

## 构建与已验证范围

WebGPU、HTTPS 或 localhost 必需。本启动器使用原生浏览器 API，无前端安装依赖。
引擎源码使用 Rust 1.97.0、wasm-bindgen-cli 0.2.114、Python 3.11+、Git 2.31+，
在上述固定源码目录运行 `python tools/wasm/build.py`；前端修改无需重建 Wasm。
WASM SHA-256：`11c34ac8dd43c7365784f97138e3bf53efbdff07a90da36b0c1aeec0647cabaf`。

本地验证：26 项自动测试、7 项真实 IndexedDB 回归，文件夹及 ZIP 导入、下载取消／失败／重试、
缓存恢复、约 1.26 GiB 中文资源启动、中文菜单、遭遇战地图和保存成功。
更换资源缓存并刷新后实际设置／存档文件仍保留。
未验证原生拖拽、真实外部 HTTPS 游戏资源下载、满容量缓存压力、峰值内存，以及本启动器刷新后
重新进入游戏读档的完整流程。未保证移动设备、全部战役／游戏功能及与原版 EXE 完全一致。
联机和网关不在本版本范围。
