# VERA20k Web 中文测试平台

EA has not endorsed and does not support this product.

入口：https://github.bysb.net/vera20k/

[对应 GPLv3 集成源码](https://github.com/iamapig120/vera20k/tree/2c5b23774eed950ad17b4b7cf80d0dbef31a4ad8)。
引擎直接来自官方主线 `ab588ea949d3a082b3e7421f1b87eec9b02846c0`，包含音频修复 [#3184](https://github.com/YuriPlanet/vera20k/pull/3184)。启动器保留 libi/vera20k-web `5afb0d2` 的 UI 和引导，并保留本站文件夹、本地 ZIP、HTTPS ZIP、取消重试、资源原子缓存和独立用户数据。本次仅构建单机功能，不连接或部署网关；未包含待验收的 F11 功能。

上游音频后端使用共享 AudioContext、六个 512 帧缓冲；旧本地 CPAL 补丁已停用。静音计时验证了冷启动、实际约160Hz和20/40/80/500ms受控卡顿，没有记录到迟排或排程重叠。500ms卡顿仍产生约461ms排程空隙；音频生成仍在主线程，没有 Worker/AudioWorklet 解耦，未做主观试听。

本地已验证：33项JS、6组启动器VM、4项实际VFS、4项背景回归（含9种标准布局）、构建流程及真实IndexedDB测试。608个中文资源文件共1,319,082,273字节，已实际启动；原版MIX中的盟军开场BIK播放、中文载入界面、战场和新存档刷新后实际读取通过。小型自建ZIP的本地/loopback URL导入、404/损坏保护和缓存刷新恢复通过；测试数据不在发布包中。

上游存档结构已改变：旧存档数据保留，不能声称已转换；可从“本机数据/备份”中的[上一版引擎](https://github.bysb.net/vera20k/releases/e4b04a157cb2/index.html)入口读取匹配旧版的存档，请先导出备份。旧资源与设置数据库不删除，迁移保留旧记录及删除标记。

2GiB仍是启动器保护阈值；根目录文件、影片及MOD覆盖不静默过滤。未验收：真实外部游戏HTTPS ZIP、原生拖拽、完整大资源缓存压力、完整战役/长局及多人游戏。仓库和网站不含原版游戏资源、音乐、汉化游戏文件、个人路径或私有诊断入口。

发布资源前缀：`releases/2c5b23774eed/`。WASM SHA256：`dce2240e0c640bccac0c5fcfa8229a06bdb7ae3caabc20c6623c0f2d58575c3d`。
可恢复引用 `release-before-main-audio-20261028` 指向前一发布 `a386ce0c0686cad9ccd11ecf334ef0087839bc89`；先前发布文件与旧不可变资源目录均保留。
