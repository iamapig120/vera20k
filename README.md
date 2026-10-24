# VERA20k Web

独立 Git 仓库，用 **Bash** 将父目录的原始 VERA20k 构建成纯静态网页。
父项目源码、Git 分支、索引及配置均不修改。所有兼容补丁、新增代码、网页和构建逻辑都在这里。

## 构建与打开

需要 Bash 3.2+、Git、Rust（含 wasm32 目标）、wasm-bindgen CLI，以及打包用的 zip。
macOS/Linux 可直接使用 Bash，Windows 可使用 Git Bash。无需 Python、Node 或服务器。

```bash
cd web
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.114 --locked
bash web.sh build
```

构建产生两种静态入口：

- **`dist/standalone.html`**：内嵌 JS 和 Wasm，直接双击打开，不需要 HTTP 服务。
- `dist/index.html` + `dist/pkg/`：常规静态站点，可放到任何 HTTPS 静态托管。

打开后选择自己的《尤里的复仇》游戏目录。资源只在浏览器读取，不会上传。
需要支持 WebGPU 的桌面浏览器；不同浏览器对本地文件页的 GPU 权限可能有差异。
普通 `index.html` 通过模块导入加载 JS/Wasm，本地双击应使用 `standalone.html`。

脚本检查 wasm-bindgen CLI 与生成副本 `Cargo.lock` 的版本一致。
目前版本为 0.2.114，升级上游导致版本变化后请安装匹配版本。

## 继承上游更新

先在父仓库按正常流程更新上游，再执行：

```bash
cd web
bash web.sh prepare
bash web.sh build
```

默认导出父仓库 **HEAD 提交**，不读取其中未提交的源码改动。
也可以独立放置本仓库并指定上游目录/提交：

```bash
bash web.sh --upstream /path/to/vera20k --ref origin/main build
```

构建流程：`git archive` 导出原始提交 → 校验并应用补丁 → 添加覆盖文件 →
在生成副本编译 Wasm → 生成静态页面。副本、缓存及构建锁都在 `.build/`。
Rust 编译由 Bash 构建锁串行管理，直接调用 Cargo，不调用或修改上游的 Python 工具。
默认关闭增量编译缓存，可通过 `CARGO_INCREMENTAL=1` 覆盖。

相同输入会复用副本。补丁冲突时立即失败，保留上一份成功的源码。
生成副本有未提交修改时拒绝覆盖。成功更新时旧副本保存在 `.build/previous.*`，
确认不再需要后可以清理。脚本不自动拉取、合并或提交父项目。

## 维护 Web 修复

- `patches/web-compat.patch` 保存对已有上游文件的修改。
- `overlays/` 保存新增源文件，清单在 `web.config` 的 `OVERLAYS`。
- `templates/index.html` 保存网页资源导入和 Canvas 布局。

在保留原始上游历史的独立工作树中应用、修复适配后，可以重新捕获：

```bash
bash web.sh refresh-patch --adapted /path/to/adapted-checkout --base <upstream-commit>
bash tests/run.sh
bash web.sh build
```

捕获命令只读取适配工作树，不修改或提交它。新增文件应加入 `OVERLAYS`。
`.build/engine/` 初始提交已经含补丁；捕获完整补丁需要以原始上游提交为基准。
完成后只在 **web 仓库**审查、提交修改。

## 打包

```bash
bash web.sh package --output vera20k-web.zip
```

ZIP 只包含两个 HTML 入口、固定白名单内的 JS/Wasm/类型声明和 `build-info.txt`。
游戏资源、上游源码、编译缓存、本机路径和临时文件都不在包中。
解压后双击 `standalone.html` 即可，也可部署常规静态入口。

如只改了网页模板，可直接更新两个 HTML 入口，无需重新编译 Rust：

```bash
bash web.sh bundle
```

## Git 与范围

这是普通嵌套 Git 仓库，不是父项目的 submodule。使用 `git -C web ...` 单独管理。
父仓库可能显示未跟踪的 `web/`，不要将其加入父仓库。若需隐藏，可自行在父仓库本机
`.git/info/exclude` 添加 `/web/`；本工具不会修改父项目文件。
`.build/`、`dist/`、ZIP 都是忽略的生成物。

封装保留现有 Web 版本行为：WebGPU、异步启动、浏览器计时、内存资源系统、
串行模拟和离屏呈现。目前关闭音频，联网、游戏存档、随机地图及同步截图尚未适配；
资源包会占用浏览器内存。本次没有扩展这些游戏功能。

验证脚本：`bash tests/run.sh`。兼容代码沿用上游 GPL 许可，见 `LICENSE-GPL`；
分发时也需提供相应源代码。
