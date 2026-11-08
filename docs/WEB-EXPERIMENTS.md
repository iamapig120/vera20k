# 红色警戒 2：尤里的复仇 · 网页版

EA has not endorsed and does not support this product.

## Menu, subtitle and resource correction (2026-11-07)

This supersedes the earlier 27.48 MB / 96.01 MB menu-only fixture measurements
below. Those packs omitted shared UI resources and also reused a previous dubbed
test audio container. They must not be used as the general playable fixture.

Entering Options or Skirmish reproduced missing `SDMPBTN.SHP` and
`MnScrnLCustomizeBattle.PAL`, followed by the engine's fatal missing-menu-art page.
The matched fixture now retains complete neutral/local/cache shell archives and
the actual multiplayer map library. It no longer infers the whole UI dependency
set from a main-menu-only trace. Maps and campaign/movie media still use the
existing explicit runtime boundaries.

The remote allowlist and local fixture service now retain the two known subtitle
files, `subtitle.txt` and `subtitlemd.txt`. Arbitrary `.txt` files remain excluded.
Their UTF-16LE BOMs and complete bytes are verified. Actual cold/hot movie captures
show Simplified Chinese captions at their authored times.

The fixture is assembled at `.build/menu-fix-20261107/plan.json`. Simplified CSF,
font/menu graphics, 203 generated cameos, and subtitles come from one audited
localization snapshot (`3abc3de107b944d7be0110dadcaf63f93251affe`). None of the old
loose CSF/SHP/WAV overrides are imported. Native resolution of generated cameos
is checked against that same source, including after the full graphics stage.
The first mission's visible infantry cameos and text are Simplified Chinese.

Voice provenance is checked separately. The earlier synthesized/replaced bank
(`e5a9492c...`) is excluded. All 1,201 audio members in the original-voice reference
were compared byte-for-byte and by SHA-256 with the selected installation's two
nested original audio containers. The original payloads are:

| Payload | SHA-256 |
| --- | --- |
| RA2 `audio.mix` (preserved audit input) | `38508207d70f671cac16323a1ecb45a9acf4b99aa75fb0095b2f17cab9880c22` |
| YR `audiomd.mix` (runtime selected) | `7572967cac3e9b9a3cc592923f8b905f879eb937ee9a64e28090e20e969d132a` |
| Selected original YR BAG | `8917fb579eb9f312b09f626e8b6b085958a36d0aa86b4e7db3f4cfb87016f69f` |
| Selected original YR IDX | `b3be1ac75032d062dce3d7415cb7dbe7ceec0b479bc6450241dee3148b7c12c1` |

The stock YR resolver selects the MD bank (2,285 samples, 740 original files),
not the separate RA2 bank; the unused RA2 bank is therefore not prefetched.
Its full native selection is checked against the complete reference install,
including entries native YR leaves unavailable. This verifies audio contents and
priority, rather than treating a filename or the Steam directory as provenance.
The installed outer language archives themselves have localization modifications;
they are not claimed to match pristine Steam-depot whole-file checksums.

Cold/hot tests cover Options, keyboard options, network options, Vera options,
Skirmish, Choose Map, Random Map Setup with return, an actual Skirmish match, and
the first Allied campaign with movie captions and the tactical battlefield.
Original-bank identities appear in real engine logs. Music is still fetched by
track. Audio output is muted in these owned headless tests, so no human listening
test is claimed. The Web engine binary is unchanged by this resource correction.

The retained loopback service is `http://127.0.0.1:8774/`; refresh the page and
read `http://127.0.0.1:8774/manifest.json` again before starting. Hash verification
and the atomic library replacement select the new files without deleting user
settings or saves. The old experiment and its data are preserved separately.
Source provenance, native resource/voice selection checks, captures and raw
transfers are under `.build/menu-fix-20261107/`. No retail/localization files are
committed or uploaded. Full campaigns, random-map generation, real network games,
save restoration, mods and every resolution remain outside this verification.

The corrected final profile contains 10 startup files: 167,468,476 decoded bytes /
73,697,321 Brotli wire bytes. The menu's immediate original-voice-bank request adds
64,980,959 wire bytes, making the actual menu-stage total **138,678,280 bytes**.
Cold resources through the first Allied tactical battlefield total **338,570,504
wire bytes / 766,912,959 decoded bytes**. Static page/Wasm traffic is excluded.
Native Ready was observed after 9.03 seconds, while the sound stage can still be
active; it is not an interactive-menu timing claim. Reloading the same campaign
flow added zero resource requests/bytes; native warm startup was 1.61 seconds.
The unchanged active UI/voice data also passed the full menu and Skirmish cold/hot
runs, followed by native resolver equivalence after removing unused RA2-bank
prefetch. All 61 JavaScript regressions passed. See
`.build/menu-fix-20261107/summary.json` for exact test profiles and boundaries.

## Staged resource experiment (2026-11-06)

This section supersedes the older maps/movies-only limitations below. The isolated
experiment now supports `runtime.music`, `runtime.audio` and `runtime.archives` in
addition to maps and movies. No production source or retail data is shipped.

The current local fixture's 305-file bootstrap is **65,619,444 decoded bytes /
27,484,835 Brotli response bytes**, including the campaign emblems and palettes.
The menu immediately plays a slide-in sound, which triggers another **68,523,110
wire bytes** for the complete sound archive. The actual menu-stage total is thus
**96,007,945 resource-body bytes**, excluding page/Wasm. The 27.48 MB bootstrap
alone is not the total cold startup requirement. This is an experimental shell
pack, not a minimum valid pack for arbitrary mods, resolutions or menu paths.

Music is requested one WAV at a time. Its file row supplies `duration_seconds`
using the native WAV-header calculation, so the frozen playlist keeps the same
membership, order and duration before the song has arrived. The fixture retains
the menu song locally; all 26 song descriptors remain declared. Memory retains
only the most recently downloaded song in addition to a playing decoder; the
existing content-hash browser cache can reuse earlier songs.

The sound fixture imports the real `audio.idx` at startup and declares the
selected BAG's identity. This admits the original sound slots without placeholder
sound bytes. The first queued sound waits before playback selection/RNG service,
downloads the declared audio MIX, verifies its IDX/BAG identity and resumes with
the same sound definitions. The full MIX is retained for its loose WAV fallbacks.
This stage also completes before entering the first offline scenario.

An exact production-core Wasm probe verified identical 818 sound definitions,
playlist entries/durations and selected IDX/BAG identities before/after the stage.
All 2,286 indexed samples are unavailable for playback while metadata-only and
readable after completion. Incompatible archive leaves are rejected. This does
not yet defer individual sound samples: native menu entry already needs the bank.

Graphics currently complete the four declared root MIX archives **before the
first offline scenario**, rather than fetching individual theater tiles. The
initial manager is refreshed only before theater activation, retaining its sticky
CRC cache and frozen definitions. Existing bootstrap leaves must remain identical
inside the expanded archives; incompatible versions are rejected. This reduces
menu startup, but still transfers large graphics archives on first scenario entry.

New manifest groups map logical names to rows in `files`, for example:

```json
"runtime": {
  "music": {"BULLY.WAV": "runtime/music/Bully.wav"},
  "audio": {"AUDIOMD.MIX": "runtime/audio/audiomd.mix"},
  "archives": {"RA2.MIX": "runtime/graphics/ra2.mix"}
}
```

Music rows need `duration_seconds` (integer 0..86400). A sound archive row needs
`bank: {size, sha256, index_sha256, source_archive, archive_name}`: `size`/`sha256`
identify the selected BAG, `index_sha256` identifies the bootstrap IDX, and the
source name must match the actual selected archive. All ordinary file rows still
need their own decoded size/SHA-256 and explicit URL. Root archive placeholders
must be valid MIX files, preserving startup definitions and all required shell
assets. This is a matched pack contract, not automatic splitting of an arbitrary
installation. Ares merged sound banks are rejected by this experimental path.

An owned headless browser is used for runtime tests, with audio muted and no
desktop focus changes. The local service accepts `--plan <JSON>`; the private
fixture plan and preparer are in `.build/staged-assets-20261106/`. The plan contains
`assets`, `bootstrapPaths`, and `runtimeFiles` with `kind` (`music`, `audio`, or
`archives`), logical `name`, manifest `path`, local `source`, and optional metadata.
It only reads explicitly listed local files and serves them on loopback.

```powershell
$env:VERA_RUNTIME_PLAN='.build/staged-assets-20261106/plan.json'
$env:VERA_RUNTIME_ENCODING='br'
$env:VERA_ENCODING_CACHE='.build/startup-audit-20261106/brotli-cache'
$env:VERA_RUNTIME_DELAY_MS='40'
$env:VERA_RUNTIME_KBPS='100000'
$env:VERA_RUNTIME_SCOPE='all'
$env:VERA_RUNTIME_CACHE='true'
$env:VERA_RUNTIME_OUTPUT='.build/staged-assets-20261106/new-run'
Get-Content .build/staged-assets-20261106/game-script.jsonl |
  node tests/runtime-game.mjs .build/staged-assets-20261106/bootstrap .build/runtime-fixtures
```

Network caps apply per response, with an artificial response-start delay; static
page/Wasm requests are unshaped. No system network settings change. Downloads
pause scenario/movie clocks and resume the original continuation after validation.
This is explicit waiting, not seamless streaming. HTTP/format failures can retry;
cancel aborts a ticket and rejects late completion. A version/source incompatibility
requires a corrected manifest and reload. Network games, replay, save loading,
random maps and arbitrary mod resource closure are not validated by this experiment.

The runtime movie catalog must include in-mission transmissions and outcome
movies, as well as opening briefings. A clip absent from both the installed assets
and the explicit catalog follows retail's missing-movie return; no URL is guessed.
The initial two-briefing fixture does not cover an entire campaign. The local
`.build/movie-fix-20261107/plan.json` fixture adds 55 original movie files without
adding them to bootstrap, and retains the original YR archive priority.

Fullscreen captions use at least a 640x480 reference canvas, so a 140x110 radar
clip enlarged to fullscreen does not enlarge its captions eightfold. Captions
stay inside the visible picture when an oversized native movie is cropped, and
fractional scaling keeps glyph edges inside the clip. The isolated subtitle
regression covers seven viewport sizes, original and wrapped Chinese cues,
and identical cold/hot rendering (`.build/subtitle-layout-20261107/summary.json`).

The browser enables retail `-SPEEDCONTROL`. Ordinary campaigns force internal
GameSpeed 2; with this switch they retain `[Options] GameSpeed`, whose retail
default is 3. Both retail sliders span 0–6 and display `6 - GameSpeed`: ordinary
campaign speed is position 4, while the switch's untouched default is position 3.
To retain ordinary campaign timing with the control enabled, select position 4
(stored value 2). These correspond to 32 ms and 48 ms timer intervals; changing
the display/render frame rate does not change that mapping. Existing preferences
are preserved.

With the first complete playable fixture, 100 Mbps per-response caps and 40 ms
response-start delay, the cold run displayed the engine after 21.04 seconds. Its
menu-stage resource transfer was 96.01 MB; selecting the first Allied campaign
then fetched four graphics archives (189.03 MB wire), its map (0.087 MB), and its
movie (27.34 MB). Skipping the downloaded movie reached the tactical battlefield.
Loading music Bully and scenario music Deceiver were fetched individually (9.71 MB
combined). Total cold resources through the battlefield were **322,176,402 bytes**.
Two screenshots 10 seconds apart show continued scenario/camera progression.
These measurements include whole graphics archives at first scenario entry and
exclude page/Wasm and time spent watching movies; they do not prove seamless play.

That run exposed a large-object browser-cache failure: the 281.9 MB decoded RA2
archive was absent after reload, while smaller objects were reused. Runtime cache
storage now writes 16 MiB chunks and publishes its content index only after all
chunks succeed. Reconstructed bytes still pass complete size/SHA-256 validation.
Missing/corrupt chunks refetch, and old single-object cache entries remain readable.
The dedicated regression covers new-loader reuse, missing chunks and corruption.

The final chunked-cache run repeated the complete cold/hot scenario flow: all
314 resource responses occurred once (322,176,402 bytes total); reload and the
second mission entry added **zero resource requests/bytes**. Warm native startup
was 1.40 seconds; cached resources still require decoding, hashing and importing.
There were no browser Runtime exceptions. The renderer's 22 unavailable smudge
types match the previous full conservative-pack run; all 1,176 needed overlays
loaded in both versions. This does not establish that upstream renders every art.

An actual 150 ms / 100 Mbps runtime-only failure test returned 503, retried,
cancelled after 3,096,576 wire bytes, rejected the expired ticket, then completed
the next audio request and accepted further menu navigation. Input during a
resource wait may need repeating; there is no promise of seamless interaction.
The final test summary is `.build/staged-assets-20261106/summary.json`, with raw
transfers, snapshots and logs in `game-br-chunked-v4/` and `game-failure-v5/`.
The Web build and 60 JavaScript regressions passed, as did six audio-bridge checks.
Workflow isolation/conflict guards passed; the shell packaging regression could
not finish because this Windows environment does not provide the `zip` command.

The retained local trial service is `http://127.0.0.1:8774/`. Enter
`http://127.0.0.1:8774/manifest.json` in the resource-manifest form, load `bootstrap`
and start the game. Only the first Allied mission is verified; this fixture lists
the first Allied/Soviet maps and their opening BIKs, not a complete campaign set.
It uses the same 40 ms / 100 Mbps per-response test conditions. Its PID is stored
in `.build/staged-assets-20261106/preview-service.pid`; no visible window was opened.

## URL 按需加载实验（2026-11-05）

实验分支已同步官方引擎 `11eea2cec0e92c466d7dd3d1738d888a2f6015b7`，Web 基线为 `5afb0d2`。
原工作区和已发布站点未修改。实验代码、测试及构建产物保留在隔离分支；没有预设生产资源地址，也不会上传游戏资源。

支持两层加载：启动前选择资源组并下载；游戏运行时，只在进入指定关卡或播放指定电影时请求对应文件。
启动页面读取 JSON 清单后，选择 `bootstrap` 组并开始游戏。引擎启动后遇到清单声明且本地缺失的地图或电影，
页面显示下载进度；成功后在同一页面继续原流程。已有本地资源优先，普通文件夹和 ZIP 导入仍走原流程。

### 清单与资源服务

清单格式为 `format: "vera20k-resources"`、`version: 1`，可选 `label`。
`files` 每项包含 `path`（游戏资源相对路径）、`url`（绝对地址或相对清单地址）、真实字节数 `size`、64 位十六进制 `sha256`。
`profiles` 将组名映射到启动前需要下载的路径数组；`runtime.maps` 和 `runtime.movies` 将引擎逻辑文件名映射到 `files` 中的路径：

```json
{
  "format": "vera20k-resources",
  "version": 1,
  "files": [
    {"path": "ra2.mix", "url": "./base/ra2.mix", "size": 123, "sha256": "<实际 SHA-256>"},
    {"path": "ra2md.mix", "url": "./base/ra2md.mix", "size": 456, "sha256": "<实际 SHA-256>"},
    {"path": "runtime/ALL01UMD.MAP", "url": "./maps/ALL01UMD.MAP", "size": 789, "sha256": "<实际 SHA-256>"},
    {"path": "runtime/A01_F00E.BIK", "url": "./movies/A01_F00E.BIK", "size": 987, "sha256": "<实际 SHA-256>"}
  ],
  "profiles": {"bootstrap": ["ra2.mix", "ra2md.mix"]},
  "runtime": {
    "maps": {"ALL01UMD.MAP": "runtime/ALL01UMD.MAP"},
    "movies": {"A01_F00E": "runtime/A01_F00E.BIK"}
  }
}
```

此例仅展示结构，大小和哈希是占位值，启动组还必须补全实际依赖。
声明运行时资源时，启动组不再强制包含 `mapsmd03.mix`，但仍要求 `ra2.mix` 和 `ra2md.mix`。
没有运行时资源的旧清单仍要求三个标准 MIX。地图支持 `.map`、`.mpr`、`.yrm`，电影支持完整 `.bik` 文件。
电影逻辑名可以省略 `.BIK`；逻辑名大小写不敏感。只请求清单中声明的资源，不会根据任意缺失文件拼接 URL。

清单上限 2 MiB、32 个分组、12,000 个文件、总资源 2 GiB、单文件 1 GiB；实际可用大小还受设备内存限制。
只接受游戏资源扩展名。远程清单和资源使用 HTTPS，服务器须允许页面通过 CORS 读取；拒绝重定向，省略登录凭据和 referrer。
仅当页面与源都在 localhost/loopback 时允许 HTTP。源必须提供稳定版本的完整文件，大小和 SHA-256 必须与清单一致。

### 当前预加载策略与边界

下表描述当前地图/电影按需加载实验的限制，不代表理论上的最小首启资源集。完整 MIX 的启动前导入仍未改成成员级按需加载。

| 内容 | 当前处理方式 |
| --- | --- |
| Rules/Art/AI、CSF、字体、界面、调色板、SFX/EVA、音频目录、BGM | 启动组预加载；同步文件接口不改成网络接口 |
| 战役目录、地图列表/PKT、预览、地图 include、所有需要的 theater 与单位/建筑图像依赖 | 资源提供者放入启动组；文件检查不证明依赖完整 |
| 离线战役地图、普通离线关卡加载请求 | 进入地图解析前等待；战役在查询 Intro/Brief 之前先获取地图 |
| 离线全屏电影和雷达电影 | 播放入口按需获取完整 BIK，复用现有解码、字幕、音频和播放队列 |
| 联机、回放、读存档、任意文件读取 | 未接入运行时下载；继续使用原有路径，相关资源需预加载 |

下载期间暂停离线模拟和既有电影时钟，完成后重新锚定时间，避免网络等待变成快进。
冷下载会出现等待画面，雷达脚本电影的开始时刻也可能改变；当前不能保证无缝播放。
未实现任意资源缺失自动下载、BIK 边下载边播放、后台关卡预取或整包 MIX 的 HTTP Range 成员读取。
MIX 若只提供整包 URL，当前应在资源服务端预先拆出目标地图/电影，再填入清单。
地图不会仅因写入清单就自动出现在遭遇战列表中，仍需启动组提供原有目录信息。

### 校验、失败、取消和缓存

Rust 适配层只在引擎启动前接收冻结的逻辑名、大小和哈希目录；浏览器持有真实 URL。
请求按 FIFO 发出票据；回调在事件循环中继续原流程，没有跨 `await` 保持 `AppState` 可变借用。
浏览器与 Rust 分别校验长度和 SHA-256，Rust 另解析地图或 BIK 结构后才接纳。
过期/重复票据与错误资源不会安装。普通 `import_file` 启动后仍拒绝写入。

失败保留当前请求，页面可重试；取消会中止下载并使旧结果失效。
取消地图返回单人菜单；取消电影沿用原有缺失电影的跳过/返回流程。切换与退出不会将旧响应写入新的关卡或电影队列。
地图安装到本次会话的内存 VFS 后保留；电影直接交给播放器持有，播放结束后释放其运行时引用。

启动资源继续存入原 IndexedDB 资源库。运行时文件另存入 `vera20k-runtime-assets-v1` Cache Storage，按内容哈希复用，
缓存命中也重新校验；引擎拒绝的格式不会持久化。缓存不可用或配额不足时可继续使用本次内存数据并显示提示。
成功读取清单后，页面会单独记住清单 URL、所选分组和缓存选项；刷新时自动重新校验清单，让“开始游戏”恢复可用。
恢复资源选择时只读取清单，不预取游戏素材；页面和 JS/Wasm 仍按浏览器规则加载。点击开始后才校验并复用已缓存的启动资源，
运行时按需目录也会恢复，不会自动启动游戏。
清单不可达或原分组已删除时会保留地址并提示重试／重新选择，不能仅凭缺少目录的远程启动缓存开局；旧缓存和用户数据保留。
成功改选本地文件夹或 ZIP 后，以本地资源为准。清除资源缓存会删除两类资源缓存，不删除清单选择、用户设置或存档。
缓存尚无容量管理/LRU，浏览器可自行回收数据；不应将缓存视为永久资源库。

### 首启体积复核与保守修正（2026-11-06）

此前的 854.38 MB 来自测试服务扫描目录并把所有允许扩展名文件塞进启动组，不能称为“必须基础资源”。
该轮有 549 个唯一资源 URL，每项只下载一次；Resource Timing 的编码正文量与服务端原始文件量一致，服务未启用 HTTP 压缩。
MIX 是未压缩容器，这不是 ZIP 解压放大。电影 `movmd03.mix`（394.12 MB）和地图包已排除，不在这 854.38 MB 中。
整页另有图标重复请求，额外约 0.60 MB；测试静态文件的 `no-store` 导致热页面重取 Wasm，但这两项不是 854 MB 启动资源的来源。

| 旧启动组组成 | 原始大小 | 核对结论 |
| --- | ---: | --- |
| `ra2.mix` + `ra2md.mix` | 486.42 MB | 包括多个地图环境及大量非菜单资源；桌面版按文件/成员读取，Web 目前先全量导入内存 |
| `THEME.MIX` + `thememd.mix` | 123.72 MB | 全部音乐被预加载；当前主题目录扫描会读取每首 WAV 的头部及长度，尚未接入远程歌曲元数据 |
| 顶层 `audiomd.mix` | 79.77 MB | 当前实际音效来源；含 37.74 MB BAG、82,308 字节 IDX 与额外 WAV，保守修正保留全部内容 |
| `langmd.mix` + `language.mix` | 140.76 MB | 其中嵌套音频被当前顶层音效包覆盖，112 MB 左右不参与这份安装的播放选择 |
| 散装字体、SHP、WAV、CSF 等 | 12.72 MB | 242 项、8.26 MB 与当前生效的永久档案内容完全相同；其余覆盖文件保留 |
| `WDT.MIX` | 6.18 MB | 普通运行时不注册，移出该夹具启动集 |
| `expandmd01.mix` | 4.81 MB | 包含当前选中的规则/声音定义，保留 |

本机保守实验保持两个主 MIX、全部音乐/音效、其他覆盖文件和地图环境，只进行可核对的清理及传输压缩：

| 步骤 | 本步减少量 | 核对方式 |
| --- | ---: | --- |
| 去掉 242 项字节相同的散装副本 | 8.26 MB 原始数据 | 与当前永久档案首个生效者逐字节/哈希比较 |
| 语言包重打包，仅移除未选中的嵌套音频 | 111.95 MB 原始数据 | 其余每个成员逐字节保留，核对音效实际来源 |
| 去掉未注册的 WDT | 6.18 MB 原始数据 | 源码挂载路径和真实注册日志 |
| Brotli quality 4（解码内容和 SHA-256 校验不变） | 355.82 MB 额外传输量 | 文件压缩结果、HTTP 正文与 Resource Timing 对照 |

前三项按文件逐项核算，合并后的解码数据为 727.99 MB；加压缩后的资源正文实测为 **372.17 MB**。

新包为 306 个启动文件。在同样 100 Mbps / 40 ms 条件下，真实引擎就绪约 48.2 秒，旧夹具约 102.4 秒；
实际网络正文减少 482.22 MB（56.44%）。热启动约 2.57 秒，冷/热均验证进入盟军第一关；音效目录、BAG/IDX 哈希与原包一致。
客户端仍须解码并导入 727.99 MB，所以传输压缩并没有解决高内存和全量 MIX 预载问题。
这仍是保守中间结果，不能当成已经完成的小首启方案，也没有把静音/缺音频当作缩减手段。
审计、逐项 SHA-256、重打包验证及生成包留在 `.build/startup-audit-20261106/`，原始游戏目录不修改、不上传。

测试服务新增 `--encoding br --encoding-cache <本机缓存目录>` 和 `--bootstrap-list <根文件名数组JSON>`。
清单 `size` 和 SHA-256 针对解码后的原始内容；`/transfers.json` 的 `bytes` 针对实际压缩正文，并另外记录 `decodedSize`。
压缩传输的页面进度标为“接收解压”，避免把解码字节误认为网络下载量。省略显式清单时页面明确标为完整目录夹具，不再暗示最小资源集。

随后用独立诊断构建记录 MIX 成员读取，再恢复正常 Wasm，对观察集合重打包后验证首屏。
1280×900 主菜单路径共观察到 85 个唯一成员视图（按 CRC 和大小去重，不等于底层存储实际读量）；
两个主 MIX 在该路径需要保留的成员重打包后仅 2.44 MB，其余地图图像可以放到关卡准备阶段。
只验证菜单的观察包为 179.22 MB 解码数据、154.61 MB 网络正文，约 30.1 秒显示主菜单。
其中整库音乐和 IDX/BAG 仍占 143.31 MB 网络正文，其余保留资源合计约 11.30 MB；后者包含约 7.19 MB 的菜单背景 BIK。
这证明音乐目录扫描和音效银行初始化是下一阶段的主要阻碍。观察包缺少关卡依赖，**不是可玩的缩减包**，不能替换前面的保守包。
诊断代码及站点仅在 `.build/startup-audit-20261106/` 留档，生成引擎源码和正常预览已恢复，正常 Wasm 哈希保持不变。

进一步缩到小首启，需要真正的三阶段资源闭包：菜单所需规则、字体、界面及必要声音；选关后的 theater/side/单位与建筑图像；
当前电影和单曲音乐。对应改动边界是 `AssetManager::open_startup_archives` 的嵌套 MIX 目录/挂载，
`ThemeCatalog` 的歌曲元数据扫描和播放准备，以及音效 IDX/BAG 所有权。
新数据须在显式加载阶段接纳，并保留原有资源优先级、sticky CRC 缓存、音频目录与 RNG 行为；目前尚未实现该通用分阶段图像/音频加载。

### 本地测试

网络限制夹具支持应用级响应延迟和带宽限制，不修改系统网络：

```sh
node tests/serve-runtime.mjs --assets <游戏目录> --runtime <散装地图与BIK目录> --port 8774 --delay 150 --kbps 10000 --scope runtime
node tests/runtime-network.mjs <散装地图与BIK目录>
```

`--delay` 是每个响应开始前额外等待的毫秒数，`--kbps` 按十进制千比特/秒计算，`0` 表示不限速。
带宽上限按单个响应实施；`--scope runtime` 仅限制地图/电影正文，`--scope all` 也限制启动资源正文。
页面、Wasm、清单和测量接口均不受此限制。`/transfers.json` 提供实际响应延迟、写出字节、持续时间及取消标记；
`/metrics.json` 仍保留原请求次数格式。这里不模拟共享链路竞争、丢包、抖动、TLS 或真实网络 RTT。

2026-11-06，在专属 headless Edge 中对 `ALL01UMD.MAP`（301,077 字节）和 `A01_F00E.BIK`（27,411,744 字节）顺序加载，
冷缓存每档均实际取得 27,712,821 字节，热缓存均没有资源正文请求。以下为单次测量，含浏览器哈希校验与缓存操作：

| 额外等待 / 正文上限 | 冷加载 | 热加载 | 电影实际首部等待 / 正文速率 |
| --- | ---: | ---: | ---: |
| 0 ms / 不限速 | 0.265 秒 | 0.079 秒 | 本机基线 |
| 40 ms / 50 Mbps | 4.656 秒 | 0.065 秒 | 55 ms / 49.88 Mbps |
| 150 ms / 10 Mbps | 22.608 秒 | 0.072 秒 | 164 ms / 10.00 Mbps |
| 400 ms / 2 Mbps | 111.814 秒 | 0.083 秒 | 413 ms / 2.00 Mbps |

延迟为服务器实测首部写出时间，Windows 调度会使额外等待略超过设置值。
自动重试测试首次返回 503，200 ms 后重试成功，0.785 秒内取得完整地图；取消测试在收到 32 KiB 后中止电影，服务器也停止响应。
测试结果写入新的 `.build/runtime-network-<时间戳>/`，保留已有结果和浏览器独立配置，不修改旧数据。

真实引擎另以 150 ms / 10 Mbps、运行时范围测试：首次地图 503 保持等待，重试成功；冷电影等待约 22.34 秒后完成解码并进入战场。
刷新同一测试页、重新读取清单后，地图和电影没有新增正文请求，两个引擎等待阶段合计约 0.197 秒，随后正常进入战场。
下载进度可持续更新；冷运行在电影下载后的关卡转换中记录到最大约 2.13 秒主线程心跳间隔，不能将此归因于纯网络等待。
测试静音运行，未验收听感、持续帧率、长局或联机。浏览器测试中的网络时间不等于整次游戏启动时间。

旧完整目录夹具有 549 个文件、854,384,997 字节；上述历史运行时范围测试没有限制这部分启动下载。它不是最小启动需求，见前面的复核。
补测 `--scope all`、40 ms / 100 Mbps 后，真实首次启动从开始按钮到引擎就绪约 102.4 秒，热启动约 2.85 秒，随后均正常进入战场。
热缓存正文为零也不意味着整页没有流量：页面和 Wasm 属于单独的静态请求，测试服务使用 `Cache-Control: no-store`。
全资源档的 Resource Timing 实测响应正文合计：冷页面约 909.99 MB、热页面约 27.90 MB，其中热页面的 Wasm 为 26.69 MB；不含主文档和协议开销。
真实游戏驱动可通过 `VERA_RUNTIME_DELAY_MS`、`VERA_RUNTIME_KBPS`、`VERA_RUNTIME_SCOPE`、`VERA_RUNTIME_CACHE=true` 和
`VERA_RUNTIME_OUTPUT`（新的 R 盘输出目录）复测，`VERA_RUNTIME_FAIL` 可指定首次失败的资源路径。
`boot.json` 记录从开始按钮到引擎 Ready 的近似时间（3 秒轮询精度），`transfers.json` 和 `page-performance.json` 分别记录资源与静态页面请求。
它通过 stdin 接收前述 JSON 命令，`eval` 可加 `save: "文件名.json"` 将测量对象保存在本次输出目录；输入 `{"action":"quit"}` 关闭测试。

PowerShell 真实游戏复测示例（在实验项目目录执行，输出目录使用新的名称）：

```powershell
$env:VERA_RUNTIME_DELAY_MS='150'
$env:VERA_RUNTIME_KBPS='10000'
$env:VERA_RUNTIME_SCOPE='runtime'
$env:VERA_RUNTIME_CACHE='true'
$env:VERA_RUNTIME_OUTPUT='.build/runtime-game-network-new-run'
$env:VERA_RUNTIME_FAIL='runtime/ALL01UMD.MAP'
node tests/runtime-game.mjs <游戏目录> <散装地图与BIK目录>
```

全资源档改为 `VERA_RUNTIME_SCOPE=all`、`VERA_RUNTIME_KBPS=100000`、`VERA_RUNTIME_DELAY_MS=40`，去掉首次失败设置。
真实游戏驱动的启动上限为 180 秒、全程上限为 10 分钟；更慢的完整启动实验应调整测试驱动截止时间，不能将驱动超时直接判作引擎故障。

默认合成资源只用于传输测试，不能启动真实游戏：

```sh
node tests/serve-runtime.mjs --port 8774 --delay 2000 --fail-once runtime/TEST.MAP
```

访问 `http://127.0.0.1:8774/`，清单地址为同源 `/manifest.json`，请求次数在 `/metrics.json`。
服务仅监听 loopback，不提供上传或代理。测试本机合法资源时可加入
`--assets <游戏目录> --runtime <散装地图与BIK目录>`；会排除个人配置以及地图/电影档案包，按实际内容生成清单哈希。
测试服务只做实验夹具，不是生产资源发布服务。游戏资源和测试截图不进入 Git 或发布包。

```sh
node --test tests/resources.test.mjs tests/remote-resources.test.mjs tests/launcher.test.cjs tests/fullscreen.test.mjs tests/network.test.cjs tests/runtime.test.mjs tests/runtime-service.test.mjs
node tests/audio.mjs
node tests/runtime-browser.mjs
node tests/runtime-game.mjs <游戏目录> <散装地图与BIK目录>
```

最后两项使用专属 headless Edge 实例、专属临时目录和沙箱，不操作用户已有浏览器；真实游戏项需要 WebGPU。
真实游戏脚本通过 stdin 接收 JSON 的 `snapshot`、`click`、`key`、`eval`、`quit` 命令，退出时关闭自有实例与服务。
`VERA_RUNTIME_FAIL=runtime/ALL01UMD.MAP` 可让首次地图请求返回 503。
本次已真实验证引擎启动后请求地图、503 保持等待、重试、下载并解码过场电影、进入盟军第一关战场，
以及取消苏军地图后切换盟军、再次选择苏军并取消电影下载后进入苏军第一关；
浏览器 Cache Storage、损坏重取、配额失败、取消/替换、旧票据和错误内容拒绝另有自动测试。

这是基于 [VERA20k](https://github.com/YuriPlanet/vera20k) 的静态 WebAssembly/WebGPU 网页项目；游戏资源由用户或有授权的资源服务提供。


## 开始游戏

如果已经拿到构建好的网页包：

1. 将网页包解压并通过本地 HTTP 服务访问，或直接访问部署好的 HTTPS 站点，使用支持 WebGPU 的桌面浏览器。
2. 选择或拖入本机《尤里的复仇》目录、普通 ZIP，或输入允许 CORS 的 HTTPS ZIP 地址。资源应包含 `ra2.mix`、`ra2md.mix`、`mapsmd03.mix`；当前 Web 引擎不要求电影包。
3. 点击「开始游戏」，等待资源加载完成。

请提供完整的游戏安装目录；仅有上述两个文件并不保证资源齐全。
支持 UTF-8 Store / Deflate ZIP，不支持安装程序、加密、分卷或 ZIP64；最多 12,000 项、单项 1 GiB、压缩文件与解压总量各 2 GiB。路径穿越、重复路径、损坏校验和与多个资源根目录会被拒绝。请通过 localhost 或 HTTPS 访问网页。

导入会保留所选游戏根目录内的全部文件及相对路径，包括影片和 MOD 松散覆盖；EXE 等文件只作为资源字节保存，不会执行。此前版本缓存时已排除的文件需要重新选择原目录才能恢复。2 GiB 是当前启动器的保护阈值，不代表浏览器对所有游戏资源的统一上限；本改动没有解除该保护。

已导入的原版影片 MIX 会按引擎既有媒体选择顺序挂载；没有影片包仍可启动单机。独立 BIK 也可作为松散资源导入。此兼容调整只作用于 Web 构建，原生端媒体要求不变。

资源地址由使用者填写，不内置资源或代理。远程服务必须允许 CORS，失败可改用本地导入。公开入口仅接受 HTTPS；HTTP 仅在页面与资源均为 loopback 时供开发使用。下载支持进度、取消、重试；失败保留旧缓存。原子缓存提交阶段不可取消。

本次构建仅启用 `wasm` 单机功能，不连接联网网关。启动器保留上游界面及已填写的网关地址，供后续启用联网的构建使用；本次不部署网关，也不改变已有网关配置。
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

确认退出游戏后会先完成设置与存档写入并停止音画，再尝试关闭标签页；普通标签页若被浏览器拒绝关闭，会保留已退出提示。保存失败时页面保留重试与导出备份入口。

导入时勾选「缓存资源，下次直接开始」，会尝试将已校验资源缓存到浏览器 IndexedDB。
下次访问同一网址会自动恢复，点击「开始游戏」即可进入，无需重复选择目录。
首次缓存需要足够的浏览器存储空间；缓存失败会提示，本次仍可运行。
「更换文件夹」可更新资源缓存，设置和存档保留。

游戏产生的设置、快捷键和存档与资源缓存分开保存，写入后自动持久化。
本 fork 默认开启「YR Loading & Menu Movie」，仅影响启动画面与主菜单动画；已有 `YROriginalStyle=no` 的选择保留。
官方主线将设置迁到 `/saves/profile/`；恢复时会复制旧 `/retail/` 下已知的设置文件，新路径的记录（包括删除标记）优先。旧记录和旧数据库保留，不会清除其他根目录资源或 MOD 覆盖。
上游按快照结构哈希筛选可读存档，格式不兼容的记录不会出现在读取列表；浏览器中的设置、存档和备份能力保留。网站仅提供当前版本。此前 ab588 构建的新建存档通过了刷新读档；本次主线更新未重复实际读档验证。
旧站与原上游版本的数据会复制到独立的用户数据与资源库；旧库保留，已有新记录不被迁移覆盖。更换资源、清缓存及迁移失败均不删除旧设置或存档。
首页提供保存状态与重试入口；游戏运行时自动保存，不显示额外网页控件。
首页可「导出备份」下载用户数据，也可「导入备份」，同名文件会覆盖，其他文件保留。
备份包含用户数据，不包含游戏资源；导入的数据在下次启动时生效。

建议使用固定的 HTTPS 网址或本地 localhost 服务。存储按浏览器和站点隔离，
更换域名、端口或浏览器不会共享数据。
清除站点数据或使用无痕模式可能丢失缓存和用户数据，请定期导出备份。
浏览器会尝试申请持久存储，但不能保证获批；空间不足时请以页面提示为准。

## 从源码构建

启动器 UI 继续基于 `libi/vera20k-web` 的 `5afb0d2166f3d6d2bb95e265982838feba116f3f`；本实验引擎更新到官方 `YuriPlanet/vera20k` 主线 `11eea2cec0e92c466d7dd3d1738d888a2f6015b7`。本地兼容补丁保留设置/存档持久化、旧资料恢复、背景尺寸选择和发布路径清理，并加入上述运行时地图/电影等待入口；不包含另行验收的 F11 功能。源码按 [GPLv3](LICENSE-GPL) 提供，发布包不包含游戏资源。

Windows 可使用已有工具执行 `./tools/build-windows.ps1 -Python <python.exe绝对路径>`。临时目录位于项目 `.build` 内，Cargo 并发为 2；可用 `CARGO_HOME`、`RUSTUP_HOME`、`CARGO_TARGET_DIR` 指定缓存位置。

音频使用主线上游 `c9d6fe2d29f6da244590f60edd61645d3f44b67b`（#3184）的 Web 混音器：音乐和音效共享 AudioContext，预排六个 512 帧缓冲。旧版本的本地 CPAL 时钟补丁已停用。音频生成仍依赖主线程，超过队列时长的卡顿仍可能产生空隙；没有 Worker 或 AudioWorklet 线程解耦。依赖通过 `--locked` 固定，不另外升级依赖版本。

编译使用通用源码路径前缀，避免把本机工程、Cargo 和工具链目录写入发布产物。Web 构建的原生控制语料诊断入口直接报告不支持，避免嵌入开发机的 `CARGO_MANIFEST_DIR`；游戏仍从导入资源中读取数据。

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
cargo install wasm-bindgen-cli --version 0.2.127 --locked
bash web.sh build
```

`wasm-bindgen-cli` 必须与构建源码中 `Cargo.lock` 的版本一致，脚本会检查并提示。
当前适配版本为 `0.2.127`；升级引擎后应按提示安装对应版本。
默认构建会移除 Wasm 的函数名称和编译器元数据，减小站点的体积；
执行逻辑保持不变，但浏览器报错堆栈不再显示 Wasm 函数名称，无需额外安装工具。

构建入口为 `dist/index.html`，需连同整个 `dist/` 目录部署到 HTTPS 静态托管。
本地预览可在项目根目录运行：

```bash
python3 -m http.server 8080 --bind 127.0.0.1 --directory dist
```

然后使用支持 WebGPU 的桌面浏览器访问 <http://localhost:8080/>。
页面通过模块导入加载 JS/Wasm，需要通过 HTTP 服务访问。

## 打包与部署

构建完成后生成发布包：

```bash
bash web.sh package --output ra2yr-web.zip
```

使用 Cloudflare Workers 静态资源部署时，在 `dist/` 中运行 `wrangler deploy`（需已有部署配置与登录）。
生成的 `.assetsignore` 仅允许上传正常网页入口、样式、脚本、图标和 Wasm，
排除 Git 数据和测试页。

ZIP 包含 `index.html` 入口、启动器样式和脚本、本机存储脚本、图标、JS/Wasm、可用的类型声明及 `build-info.txt`。
包内不包含游戏资源、引擎源码或编译缓存。解压后通过上述本地 HTTP 服务访问，
或将完整目录部署到 HTTPS 静态托管；单机游戏无需后端服务。

只修改网页模板、启动器样式或脚本时，可复用已编译的 `dist/pkg/`，更新页面后重新打包：

```bash
bash web.sh bundle
bash web.sh package --output ra2yr-web.zip
```

## 项目结构

```text
vera20k/                 VERA20k 引擎子模块，固定到已适配的提交
patches/web-compat.patch 引擎已有文件的 Web 兼容补丁
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

它检查音频初始化、完整资源保留、缓存恢复以及用户数据在引擎启动前的恢复顺序。
执行 `node --test tests/resources.test.mjs tests/launcher.test.cjs` 检查导入和失败恢复；`node tests/audio.mjs` 检查音频初始化、主线启动 API、持久化回调及旧资料恢复。实际浏览器音频排程、BIK 和读档仍须另做运行验证，单元测试不替代这些验证。
`tests/storage.html` 在浏览器中直接运行真实 IndexedDB 回归；通过静态服务打开本项目目录后访问该页面。
它使用独立临时数据库，检查关闭重开、资源 Blob、删除记录和失败事务回滚。

## 致谢与许可

感谢 [VERA20k](https://github.com/YuriPlanet/vera20k) 提供 Rust 引擎基础。
兼容代码沿用上游 GPL 许可，详见 [LICENSE-GPL](LICENSE-GPL)；分发时需按许可证提供相应源代码。

本项目为非官方项目，与 Electronic Arts 无关联。游戏名称、商标及原始游戏资源的权利归各自权利人所有。
玩家需自行准备有权使用的《红色警戒 2：尤里的复仇》游戏资源。

启动流程回归：`node --test tests/launcher.test.cjs`，覆盖存储阻塞、超时重试与手动资源选择优先。下载连续 30 秒无响应会报错；本机存储等待上限为 20 秒。资源缓存失败不阻止游戏启动，清除资源缓存保留设置与存档。

清单刷新恢复的可选真实游戏回归：`node tests/manifest-restore-game.mjs PLAN_JSON SITE_DIR MAP_DIR`。它使用独立静音无界面浏览器验证游戏后刷新、自动恢复 URL 与分组、缓存复用、运行时电影和清单 503 重试；需提供本机原版测试资源，不会上传素材。

### Upstream synchronization (2026-10-31)

The engine follows official main `b6ef13b19c8c538a12eab7b2eb74ae5e2e3b486f`. Radar subtitles and their MessageList timeout conversion now come from upstream, alongside the previously integrated fullscreen subtitles, saved browser exit, WOL prompt scaling and tooltip metrics. The compatibility patch retains durable settings/deletions, the fork's YR-style default, keyboard footer scaling, remappable browser fullscreen command and campaign speed-control default. It also fixes static-text scaling in Random Map Setup and Choose Map. The launcher retains directory/ZIP/HTTPS import, atomic resource caching, backups and viewport sizing. Upstream lifecycle/replay handling and the new SkipStartupLogo setting are preserved. No retail files or translation content are distributed.

The previous `97ed751` integration passed 39 launcher/import tests, six startup compatibility checks and 24 subtitle logic checks. Its isolated muted browser run with local Chinese resources displayed the first Allied mission's loading art/progress, opening subtitles, radar movie and tactical HUD subtitle, including one restart without stale text. Those runtime observations do not validate this newer engine: this synchronization uses background compilation and automated tests only, with browser/DPR/fullscreen, BIK and real-save runtime checks still pending. No existing player page or saved data was changed. This release also includes upstream campaign autosave migration (#3526), loading-dialog presentation (#3527), refresh-independent pacing and browser IME support. Deployment status is recorded separately from local test results.

The web fork adds **全屏/退出全屏** in the keyboard page’s **vera20k** category. Fresh/reset profiles use F11; existing saved bindings are preserved. Rebinding, explicit unbinding and reset use VERA.INI. Text edits keep their keys. Browsers that reserve F11 can use another binding or the on-page fullscreen button; Esc and external fullscreen changes update the button.

The ordinary web launcher enables the engine’s existing `campaign_speed_control` startup option (retail `-SPEEDCONTROL`). Campaigns can use their saved GameSpeed and expose its Options slider; the separate network/spawn startup and lockstep rules are unchanged.
