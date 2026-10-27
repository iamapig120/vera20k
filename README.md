# VERA20k Web 中文测试平台

EA has not endorsed and does not support this product.

公开入口：https://github.bysb.net/vera20k/

基于 [libi/vera20k-web 5afb0d2](https://github.com/libi/vera20k-web/commit/5afb0d2166f3d6d2bb95e265982838feba116f3f)，保留其 UI、引导及备份入口。
[本站集成源码](https://github.com/iamapig120/vera20k/tree/d687e0bbc306c1fe3bd4b66abefa7c81ece253b6)按 GPLv3 提供；引擎固定为 `4f925c266afabb6d28a4de6971f5e2af0bd67625`，应用 Web 兼容层与[最小背景修复](https://github.com/iamapig120/vera20k/commit/672f6543a54f2bab6b7aa983ea53c35d325c8b71)。

选择/拖入本机资源文件夹或普通 ZIP，也可输入允许 CORS 的 HTTPS ZIP 地址。下载支持取消、重试，校验与缓存失败保留旧资源；资源缓存与设置/存档分开保存。旧数据库复制迁移后仍保留。本次未部署联机网关。

已验证：34 项自动测试、4 组原生 IndexedDB 迁移、缓存事务回归、构建/打包隔离、3 项背景回归及全部 9 个既有标准布局；实际中文目录导入 607 文件约 882 MiB，菜单/遭遇战地图/保存、刷新及读档通过。760×600 背景选择已核对修复前后；标准三档布局保持一致。

尚未实测：原生操作系统拖拽、真实外部跨域 HTTPS 游戏 ZIP、大资源完整缓存压力、旧 41f7ff9 引擎存档的跨版本读取、长战局及联机。音频设备初始化通过，未做人耳全量试听。验证资源不含中配电影；本仓库和站点不分发游戏资源或音乐。

当前入口的运行资源位于 `releases/d687e0bbc306/`，WASM SHA256 为 `0c6c3e8edf605faad4c69cf03244293dba81eee137dcac1800dd23b9e3e0e938`。旧资源保留以兼容已有页面缓存；旧完整发布由 `release-before-upstream-web-20261026` 指向 `de80125b29595a0948a8c6d931b0597f1ba0f590`，可恢复。
