# VERA20k Web 中文测试平台

EA has not endorsed and does not support this product.

入口：https://github.bysb.net/vera20k/

保留 [libi/vera20k-web 5afb0d2](https://github.com/libi/vera20k-web/commit/5afb0d2166f3d6d2bb95e265982838feba116f3f) 的 UI 与引导。
[当前 GPLv3 集成源码](https://github.com/iamapig120/vera20k/tree/e4b04a157cb2e552bdc9e23f70acd226e9fd0e80)；引擎固定为 `4f925c266afabb6d28a4de6971f5e2af0bd67625`，含背景尺寸修正、可选影片包挂载及固定 CPAL 0.17.3 的 WebAudio 时钟修正。

支持本地文件夹/ZIP、允许 CORS 的 HTTPS ZIP 地址、取消和重试、资源原子缓存与独立设置/存档。保留目录文件及 MOD 覆盖语义，不执行导入的 EXE。资源总量仍受 2 GiB 保护限制；这不是浏览器统一上限。更大资源的存储与内存方案仍待单独验证。

本次验证：33 项 JS 自动测试、4 组启动器 VM 测试、6 项实际 CPAL 排程分支回归、构建隔离与打包回归通过。相同本地影片可从 MIX 中播放，缺少影片包仍能进入中文菜单；最终干净 WASM 载入“火线冲突”地图成功。源路径扫描无本机路径。音频冷启动与 500 ms 主线程阻塞后的集中追排明显改善；测试静音，尚未试听，长测仍有极少量不足 7 ms 的音效迟排。

未完成验收：所有战役/影片、音画同步、用户报告的所有载入流程、原生拖拽、真实外部游戏 HTTPS ZIP、完整大资源缓存压力、最终候选刷新后读档。F11、tooltip、超级武器图标及主线迁移另行处理。本仓库和站点不包含零售资源、电影、音乐或测试游戏文件，访客自行导入合法资源。

发布资源前缀：`releases/e4b04a157cb2/`。WASM SHA256：`ebe562fc34cccb8bc8d996030df57eeb3cb3e9d2142bb73847ed7018efa56137`。旧发布资源保留；`release-before-bik-audio-20261027` 保留前一版 `41a16df2a2cde1b8405a0a2fe0b9930157b12ff4`，更早回滚引用仍保留。
