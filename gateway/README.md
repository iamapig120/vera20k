# Web 联机网关

Node.js 22+，执行 `npm ci` 后运行 `npm start`。网关只转发 HTTPS 大厅请求和加密数据报，不持有 relay 签名密钥或游戏资源。

前端保持纯静态，可单独发布 `dist/` 到 HTTPS 静态托管。网关独立部署到例如 `https://gateway.example.com`，将 `VERA_WEB_ORIGIN` 设为静态页面来源，例如 `https://game.example.com`；在网页联机网关设置中填网关的 HTTP(S) origin。网页通过该网关访问 `/v1/*` 和 `/game/*`，网关的 OPTIONS 预检仅放行该前端来源、GET/POST 和 Authorization/Content-Type，不使用浏览器 cookie。网关离线或未配置不影响前端加载和单机运行。

```sh
VERA_WEB_ORIGIN=https://game.example.com \
VERA_RELAY_HOST=你的上游relay的IPv4或域名 \
VERA_RELAY_PORT=5000 \
HOST=127.0.0.1 PORT=8788 npm start
```

本机一体启动静态游戏页面和网关（先在 `web/` 构建 `dist/`）：

```sh
VERA_WEB_ORIGIN=http://localhost:8788 \
VERA_RELAY_HOST=你的上游relay的IPv4或域名 \
npm start -- --static ../dist
```

然后打开 `http://localhost:8788/`。localhost 允许浏览器使用 WebGPU；公网必须使用 HTTPS/WSS。可用 `VERA_STATIC_DIR` 代替 `--static`。

本机部署大厅与 relay 的启动方式见 [服务器说明](../servers/README.md)。大厅运行于 `http://127.0.0.1:8790` 时，启动网关可加：

```sh
VERA_ALLOW_LOCAL_HTTP=1 VERA_LOBBY_URL=http://127.0.0.1:8790 \
VERA_WEB_ORIGIN=http://localhost:8788 VERA_RELAY_HOST=127.0.0.1 \
npm start -- --static ../dist
```

`VERA_ALLOW_LOCAL_HTTP=1` 仅允许 `localhost`、`127.0.0.1`、`[::1]` 的 HTTP 大厅。默认仍要求 HTTPS；该开关不允许远程 HTTP 地址。

`VERA_LOBBY_URL` 默认使用上游官方 HTTPS 大厅，可配置自己的 HTTPS 大厅。relay 必须与该大厅下发的地址一致。目的地由管理员固定，客户端无法指定转发地址。

自建整套联机服务：按引擎的 `services/relay/README.md` 部署 UDP relay 并开放 UDP 5000；按 `services/lobby/README.md` 部署 Cloudflare 大厅，设置它的 `RELAY_ADDRESS` 指向该 relay，且大厅 `RELAY_TICKET_KEY` 与 relay 的私有密钥一致。这里的 `VERA_LOBBY_URL` 填该大厅 HTTPS 地址，`VERA_RELAY_HOST`/`VERA_RELAY_PORT` 填同一个 relay。网关不需要也不应配置 `RELAY_TICKET_KEY`。若使用官方大厅，必须从其管理员获得当前 relay 地址；不能随便替换成自己的 relay，因为票据签名密钥不同。

在 HTTPS 反向代理上，将网关域名的 `/v1/`、`/game/primary` 和 `/game/alternate` 转发至此进程；`/game/` 必须启用 WebSocket Upgrade，空闲超时至少 70 秒。也可把这些路径配置在静态站点的同一域名，使用同源入口。每条二进制消息对应一个完整 UDP 数据报，两条路由各使用独立的源端口。原有端到端加密、票据认证、重试和可靠传输继续由游戏协议处理。

`VERA_WEB_ORIGIN` 是允许的完整游戏来源，例如 `https://game.example.com`，不带路径。直接打开 `file://` 页面的 `null` Origin 不受支持。WebSocket 强制校验来源；HTTP 只允许指定来源或无 Origin 的同源请求。不要向客户端分发上游服务密钥。

服务器需要访问大厅 HTTPS 和 relay UDP，静态托管或当前 Cloudflare Workers 大厅本身不能运行这个 Node UDP 网关。公网部署使用 TLS 反向代理与服务管理器，保留默认的本机监听，并按容量限制连接和速率。默认最多 256 条 WebSocket，每条最多 2048 个数据报/秒，消息最多 2048 字节，发送积压超过 1 MiB 会断开。HTTP 请求最大 64 KiB，响应最大 4 MiB，上游超时 35 秒。上游仍负责身份与游戏 admission；此网关不替代其认证。

运行 `npm test`，三个生产入口集成测试使用本地 HTTP 大厅与 UDP echo，检查代理、双路数据报和来源/消息拒绝。它们不证明真实服务器或两位玩家的完整比赛可用。
