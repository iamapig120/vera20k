# 红色警戒 2：尤里的复仇 · 网页版

在浏览器中重返《红色警戒 2：尤里的复仇》。导入本机游戏资源，点击开始，即可进入游戏。

这是一个独立的网页版项目，基于 [VERA20k](https://github.com/YuriPlanet/vera20k) 引擎，
通过 WebAssembly 和 WebGPU 在浏览器中运行。构建产物为纯静态页面，可本地打开或部署到静态网站。
游戏资源由玩家自行提供，仅在浏览器本机读取，不会上传。

## 开始游戏

如果已经拿到构建好的网页包：

1. 解压网页包，使用支持 WebGPU 的桌面浏览器打开 `standalone.html`，或访问部署好的站点。
2. 选择或拖入已解压的《尤里的复仇》安装目录，其中应包含 `ra2.mix` 和 `ra2md.mix` 等游戏资源。
3. 点击「开始游戏」，等待资源加载完成。

请提供完整的游戏安装目录；仅有上述两个文件并不保证资源齐全。
当前不支持直接导入安装程序或压缩包。不同浏览器对本地文件页的 WebGPU 权限可能有差异。

当前支持单机运行，互联网联机通过可选的 WebSocket 网关接入；随机地图及同步截图尚未适配。
联机需要通过下述服务器入口访问，不能直接双击 `standalone.html`；固定 relay 网关不提供局域网 UDP 广播发现。
目前 Wasm 构建、网关和大厅测试通过。内置浏览器双页面已实测登录、房间发现、加入、最终设置确认和开局；双方进入地图后均可部署基地车和移动单位，中继确认正在转发比赛数据。完整战局、重赛及公网延迟场景仍未验证。
音效、单位语音和背景音乐使用导入的游戏音频资源；请允许浏览器播放声音。
资源会加载到浏览器内存中，所需内存取决于导入的资源量。

## 启动联机服务

先按下文完成 `bash web.sh build`，再在本项目目录运行：

```sh
(cd gateway && npm ci)
bash server.sh
```

然后打开 [本机游戏入口](http://localhost:8788/)，导入游戏资源，通过游戏菜单的 **Internet → Custom Match** 创建账号、登录、建房或加入房间。每位玩家使用独立账号。

`server.sh` 构建并运行上游原有 Rust UDP relay，同时运行上游大厅逻辑的本机 HTTP/SQLite 宿主和 WebSocket 网关。大厅直接导入子模块的 `LobbyService`/`SqlStore`，没有另写房间或比赛状态机。首次运行在 `.build/server-data/` 创建签名密钥和数据库；不要删除该目录或将其部署为静态资源。Ctrl+C 关闭本次启动的服务。

本机入口默认只监听回环地址。公网部署需 HTTPS/WSS 与允许的游戏 Origin，可只部署网关并连接上游原有 Cloudflare 大厅和匹配的 relay，详见 [网关部署](gateway/README.md) 与 [本机大厅适配](servers/README.md)。`HOST`、`PORT`、`VERA_WEB_ORIGIN` 可配置一体入口；首页“游戏资源 / 帮助”内可填写独立网关地址；留空使用页面同源 `/v1/` 和 `/game/`。静态网页可独立部署，网关需允许该网页 Origin。单机启动不发网关请求、不等待连接；无网关或网关不可达不影响单机。

所有 Web 兼容补丁、覆盖源码、服务器适配和网关均在本目录维护；上游子模块不承载本项目的代码修改，见 [AGENTS.md](AGENTS.md)。

## 本机存储

首次选择目录并开始游戏后，会把可用游戏资源缓存到浏览器 IndexedDB。
下次访问同一网址会自动恢复，点击「开始游戏」即可进入，无需重复选择目录。
首次缓存需要足够的浏览器存储空间；缓存失败会提示，本次仍可运行。
「更换文件夹」可更新资源缓存，设置和存档保留。

游戏产生的设置、快捷键和存档与资源缓存分开保存，写入后自动持久化。
首页提供保存状态与重试入口；游戏运行时自动保存，不显示额外网页控件。
首页可「导出备份」下载用户数据，也可「导入备份」，同名文件会覆盖，其他文件保留。
备份包含用户数据，不包含游戏资源；导入的数据在下次启动时生效。

建议使用固定的 HTTPS 网址或本地 localhost 服务。存储按浏览器和站点隔离，
更换域名、端口或浏览器不会共享数据；直接打开 `standalone.html` 的持久化行为取决于浏览器。
清除站点数据或使用无痕模式可能丢失缓存和用户数据，请定期导出备份。
浏览器会尝试申请持久存储，但不能保证获批；空间不足时请以页面提示为准。

## 从源码构建

需要 Git、Bash 3.2+、Python 3.11+、Rust、`wasm-bindgen-cli`；打包还需要 `zip`。
macOS、Linux 可直接使用 Bash，Windows 可使用 Git Bash。编译通过引擎的 Python 构建器串行管理；联机服务另外需要支持 `node:sqlite` 的 Node.js（已测试 25.2.1）。

克隆**本项目仓库**时初始化子模块：

```bash
git clone --recurse-submodules <本项目仓库地址> ra2yr-web
cd ra2yr-web
```

已有源码时，在项目根目录执行：

```bash
git submodule update --init --recursive
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.114 --locked
bash web.sh build
```

`wasm-bindgen-cli` 必须与构建源码中 `Cargo.lock` 的版本一致，脚本会检查并提示。
当前适配版本为 `0.2.114`；升级引擎后应按提示安装对应版本。

构建后可使用两种入口：

| 入口 | 用途 |
| --- | --- |
| `dist/standalone.html` | 内嵌脚本、样式、图标和 Wasm，可直接双击打开 |
| `dist/index.html` | 常规静态站点入口，需连同整个 `dist/` 目录部署到 HTTPS 静态托管 |

`index.html` 通过模块导入加载 JS/Wasm，本地双击请使用 `standalone.html`。
两种入口都需要支持 WebGPU 的桌面浏览器。

## 打包与部署

构建完成后生成发布包：

```bash
bash web.sh package --output ra2yr-web.zip
```

使用 Cloudflare Workers 静态资源部署时，在 `dist/` 中运行 `wrangler deploy`（需已有部署配置与登录）。
生成的 `.assetsignore` 仅允许上传正常网页入口、样式、脚本、图标和 Wasm，
排除 Git 数据、测试页和超过静态资源单文件限制的内嵌版 `standalone.html`。

ZIP 包含两个 HTML 入口、启动器样式和脚本、本机存储脚本、图标、JS/Wasm、可用的类型声明及 `build-info.txt`。
包内不包含游戏资源、引擎源码或编译缓存。解压后可直接打开 `standalone.html`，
也可将解压后的完整目录部署到 HTTPS 静态托管，无需后端服务。

只修改网页模板、启动器样式或脚本时，可复用已编译的 `dist/pkg/`，更新页面后重新打包：

```bash
bash web.sh bundle
bash web.sh package --output ra2yr-web.zip
```

## 项目结构

```text
vera20k/                 VERA20k 引擎子模块，固定到已适配的提交
patches/web-compat.patch 引擎已有文件的 Web 兼容补丁
overlays/                Web 平台新增源码
templates/               启动页面、样式、交互和 IndexedDB 存储脚本
assets/                  网页图标等资源
web.config               上游地址、补丁适配基准和覆盖文件清单
web.sh                   准备源码、编译、生成页面和打包
tests/run.sh             构建工作流回归测试
```

本项目可独立放在任意目录，通过 `vera20k/` Git 子模块引用引擎。
`.gitmodules` 和子模块版本应随本项目一起提交；子模块源码由其自身仓库管理。
`.build/`、`dist/` 和 ZIP 是被 Git 忽略的生成物。

## 更新引擎

普通使用者运行以下命令，即可检出本项目记录的引擎版本：

```bash
git submodule update --init --recursive
```

维护者升级到上游新版本时：

```bash
git -C vera20k fetch origin
git -C vera20k checkout --detach origin/main
bash web.sh prepare
# 如有补丁冲突，先完成兼容适配，再继续验证
bash tests/run.sh
bash web.sh build
# 审查并提交子模块版本及相关适配改动
git add vera20k
git commit -m "Update VERA20k submodule"
```

默认构建 `vera20k/` 子模块的 **HEAD 提交**，不读取其中未提交的源码改动。
`web.config` 中的 `BASE_REVISION` 记录补丁适配基准，实际构建版本由子模块 HEAD 决定。
构建脚本不会自动拉取、切换或提交子模块版本；未初始化时会提示初始化命令。

临时验证其他源码目录或提交：

```bash
bash web.sh --upstream /path/to/vera20k --ref origin/main build
```

## 维护 Web 适配

构建流程为：导出引擎提交 → 校验并应用补丁 → 添加覆盖文件 → 编译 Wasm → 生成静态页面。
编译在 `.build/engine/` 生成副本中进行，不修改引擎子模块。
源码副本、缓存和构建锁均保存在 `.build/`；Bash 构建锁串行管理本项目的构建。
默认关闭增量编译缓存，可通过 `CARGO_INCREMENTAL=1` 覆盖。

相同输入会复用源码副本。补丁冲突时保留上一份成功源码；生成副本有未提交改动时拒绝覆盖。
更新成功后，旧副本保存在 `.build/previous.*`，确认不再需要后可自行清理。

在保留原始引擎历史的独立工作树中完成兼容适配后，可重新捕获补丁和覆盖文件：

```bash
bash web.sh refresh-patch --adapted /path/to/adapted-checkout --base <upstream-commit>
bash tests/run.sh
bash web.sh build
```

捕获命令只读取适配工作树。新增源文件需加入 `web.config` 的 `OVERLAYS` 清单。
`.build/engine/` 初始提交已经包含补丁，捕获完整补丁时应以原始引擎提交为基准。
工作流测试使用临时仓库，不编译 Rust，也不需要网络或游戏资源。
启动器音频回归测试另需 Node.js：

```bash
node tests/audio.mjs
```

它检查音频初始化、资源筛选、缓存恢复以及用户数据在引擎启动前的恢复顺序。
`tests/storage.html` 在浏览器中直接运行真实 IndexedDB 回归；通过静态服务打开本项目目录后访问该页面。
它使用独立临时数据库，检查关闭重开、资源 Blob、删除记录和失败事务回滚。

## 致谢与许可

感谢 [VERA20k](https://github.com/YuriPlanet/vera20k) 提供 Rust 引擎基础。
兼容代码沿用上游 GPL 许可，详见 [LICENSE-GPL](LICENSE-GPL)；分发时需按许可证提供相应源代码。

本项目为非官方项目，与 Electronic Arts 无关联。游戏名称、商标及原始游戏资源的权利归各自权利人所有。
玩家需自行准备有权使用的《红色警戒 2：尤里的复仇》游戏资源。

启动流程回归：`node --test tests/launcher.test.cjs`，覆盖存储阻塞、超时重试与手动资源选择优先。下载连续 30 秒无响应会报错；本机存储等待上限为 20 秒。资源缓存失败不阻止游戏启动，清除资源缓存保留设置与存档。
