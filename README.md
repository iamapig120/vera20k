# VERA20k Web 中文测试平台

EA has not endorsed and does not support this product.

入口：https://github.bysb.net/vera20k/

网站仅提供当前版本。[对应GPLv3源码](https://github.com/iamapig120/vera20k/tree/a7ae1bf3835198fbd5d25d4564b6dc361eb7cad8)；官方引擎固定为 `ab588ea949d3a082b3e7421f1b87eec9b02846c0`，音频修复来自上游 #3184。启动器 UI 基于 libi/vera20k-web `5afb0d2`，保留本地文件夹/ZIP、允许CORS的HTTPS ZIP、取消重试、资源原子缓存及独立用户数据。

本次清理仅移除站点中已被取代的入口、脚本、WASM和发布目录，不清除玩家浏览器的游戏资源、设置或存档。存档按引擎结构格式识别；可从“本机数据/备份”导出用户数据。资源导入仍有2GiB保护阈值，不静默过滤根目录文件或MOD覆盖。网站不含原版游戏资源、音乐、汉化游戏文件或私有测试入口。

当前WASM已通过中文菜单、原版MIX影片、载入界面、战场及新存档刷新读取验证。上游采用共享AudioContext及六个512帧缓冲；冷启动和约160Hz、受控卡顿测试未记录到迟排或排程重叠。500ms主线程阻塞仍可产生约461ms空隙，未做主观试听。没有Worker/AudioWorklet改造；本构建仅单机，F11待验收功能未包含。

当前资源前缀：`releases/a7ae1bf38351/`。WASM SHA256：`dce2240e0c640bccac0c5fcfa8229a06bdb7ae3caabc20c6623c0f2d58575c3d`。更新使用正常Git提交；可恢复历史保留。
