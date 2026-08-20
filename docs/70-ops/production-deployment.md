# Web 首发部署与配额治理

## 1. 目标与范围

首发形态为邀请制 Web 内测，不接支付、小程序或长期用户记忆。部署目标是在真实
OpenAI-compatible LLM 可用时，维持可解释的使用边界、硬性 token 保护与最小化
数据留存。

推荐拓扑：

```text
Browser -> HTTPS / reverse proxy -> Next.js apps/web
                                  -> Auth.js Credentials session
                                  -> Supabase Postgres / RPC
                                  -> OpenAI-compatible LLM provider
```

当前腾讯云首发服务器运行 Node.js `22 LTS`；仓库开发与 CI 基线仍以 `.nvmrc`
为准。生产服务必须配置 HTTPS、仅在服务端加载 `SUPABASE_URL`、Supabase service
role key 与 LLM key，并显式配置 `AETHERTAROT_IP_HASH_SALT`。不要将 service role key、
LLM key、IP hash salt 或服务器登录凭据写入前端公开环境变量、日志、检查报告或回滚记录。

当前正式 Web 入口采用：

```text
Browser -> Caddy HTTPS (`aethertarot.cn`)
        -> systemd (`aethertarot-web.service`)
        -> Next.js (`127.0.0.1:3000`)
```

该入口应确认 Caddy 已启用响应压缩，例如 `encode zstd gzip`，并以正式域名复核
Auth.js 登录、登出与 `/auth/callback` 不会回到内部地址或 localhost。
`aethertarot.cn` 已完成 ICP 备案并解析到当前大陆节点；如后续接入 CDN 或加速服务，
应在启用前重新核对解析目标、证书、缓存规则与适用的公网服务合规要求。

运行时卡牌图片默认通过 Next Image 优化产物加载，而不是把 `cardsV2` 原始 PNG
直传给浏览器。`/_next/image` 的优化缓存 TTL 当前为 7 天；如果接入 EdgeOne/CDN，
可缓存 `/_next/static/*`、`/_next/image*` 与只读卡牌资源，但不要缓存
`/api/*`、`/auth/*`、Admin 页面或带用户状态的响应。

## 2. 访问与配额规则

`POST /api/reading` 允许未登录访客按 IP hash 每日完成 3 次完整解读，
`POST /api/encyclopedia/query` 允许每日体验一次；已登录用户仍要求 Auth.js Credentials
登录且处于 `beta_testers` 白名单。其他账号级能力仍要求登录。

| 规则 | 默认值 | 说明 |
| --- | ---: | --- |
| Reading 每用户每日完整解读次数 | `10` | 按认证 `user_id` 统计；initial 预占，合法 final 不重复计次 |
| Reading 未登录每日完整解读次数 | `3` | 按 salted IP hash 统计；initial 预占，合法 final 不重复计次 |
| Encyclopedia 每用户每日次数 | `20` | 与 reading 分开统计 |
| Encyclopedia 未登录每日次数 | `1` | 按 salted IP hash 统计 |
| IP 突发防刷 | `6` 次/分钟 | reading 与 encyclopedia 共享；独立于访客 IP 日额度 |
| 全站 LLM token 上限 | `1000000`/日 | reading 与 encyclopedia 共享 |

日窗口统一使用 `Asia/Shanghai` 自然日，从北京时间 `00:00:00` 到下一日
`00:00:00`。日额度拒绝响应中的恢复时间必须计算到下一次北京时间午夜。

Reading 前端为每个 `initial` / `final` phase 生成独立 `request_id` UUID，并把 initial
请求 ID 保存在 session draft 中。`initial` 预占一次完整解读日额度；通过服务端 snapshot
校验的 `final` 不再扣减日额度，但仍消费共享 IP 分钟防刷计数与全站 Token 预算。相同用户、
相同 request ID 与相同 payload 的并发或断网重试只允许执行一次 quota 检查、生成一次 provider 结果并写入一条 `reading_events`；
成功响应在当前单实例进程内缓存到北京时间午夜。`reading_events` 的 subject + request ID
成功事件唯一索引作为重复成功统计的数据库兜底；失败事件不占用该索引，因此相同请求在失败退款后仍可重试并记录成功。`initial` 生成失败会通过 `refund_reading_daily_quota(...)`
退还本次个人/访客日额度；`final` 没有新的日额度可退。IP 分钟防刷计数和已经实际消耗的 LLM token 均不退款。

`role = admin` 的账号可跳过个人次数与 IP 突发限制，便于维护和诊断；只要实际发出
LLM 请求，其 token 仍会进入全站每日硬上限。

## 3. 邀请制 Auth 设置

当前生产认证系统是 Auth.js Credentials provider。Supabase 只作为数据库、RPC、quota
与 observability 真相源，不再使用 Supabase Auth、magic link、OTP 或浏览器 Supabase
session。旧 Supabase Auth / magic-link 说明仅保留在历史故障文档中。

邀请制账号规则：

1. 管理员在 `public.beta_testers` 中创建 tester / admin 账号，设置 `email`、`role`
   与 `is_active = true`。
2. 使用 `apps/web/scripts/set-tester-password.mjs` 为对应邮箱写入
   `beta_testers.password_hash`；密码使用 Node.js crypto scrypt hash。
3. 用户在 `/login` 输入邮箱与密码，Auth.js Credentials provider 校验
   `beta_testers.is_active` 与 `password_hash` 后签发 JWT session。
4. 服务端通过 session email 映射或创建 `app_users.id`，并用该内部 `user_id` 记录
   quota、reading events、encyclopedia events、feedback 与 `stored_readings`。
5. 测试结束后可将 `beta_testers.is_active = false` 立即停止对应账号访问；如需换密，
   重新运行 password 脚本即可。

生产环境必须配置：

- `AUTH_SECRET`：Auth.js session 签名密钥；生产值至少 32 字符、使用高熵随机值，不能使用 `replace-me`、`example`、`changeme` 等占位符。readiness 对长度和占位符失败关闭。
- `AUTH_URL`：正式 HTTPS 入口，例如 `https://aethertarot.cn`；缺失或错误会导致登出 /
  callback 跳回 localhost 或内部地址。
- `NEXT_PUBLIC_SITE_URL`：前端展示与跳转使用的公开站点地址。
- `SUPABASE_URL` 与 `SUPABASE_SERVICE_ROLE_KEY`：仅服务端读取，用于 tester、quota、
  observability、feedback 与 `stored_readings`。

当前不需要配置 Supabase Auth Email provider、custom SMTP、`signInWithOtp`、
`/api/auth/login-link` 或 Supabase Auth URL Configuration。若未来重新引入邮件登录，
必须新增 ADR 或 ops 变更记录，并同步更新本文件、`docs/70-ops/dev-setup.md` 与
`docs/70-ops/credentials-auth-deployment.md`。

登录尝试仍应经过应用层限流与审计，避免密码爆破和账号枚举：

| 规则 | 默认值 | 说明 |
| --- | ---: | --- |
| 同一邮箱每小时登录尝试 | `10` | 防止反复尝试单个 tester 邮箱 |
| 同一邮箱每日登录尝试 | `30` | 防止长时间低频爆破 |
| 同一 IP 每小时登录尝试 | `20` | 防止同源刷登录入口 |
| 全站每小时登录尝试 | `200` | 防止异常流量拖累服务 |

登录审计继续复用 `auth_email_events` 表记录邮箱、IP hash、成功/失败、错误码与耗时。
该表名保留历史命名，但当前语义是 Credentials 登录审计，不代表系统仍在发送登录邮件。
当前限流阈值在 `apps/web/src/auth.ts` 的 `RATE_LIMITS` 中定义，内测阶段不通过环境变量
暴露；如需调整，修改代码后重新部署。

此模式不影响静态百科浏览。启用 LLM 的卡牌分析或百科问答仍必须通过有效内测账号，
或使用未登录访客每日一次体验额度，并继续受个人/访客次数、共享 IP 突发限制和全站每日
token 上限约束。若浏览器存在无效或非白名单登录态，服务端返回登录/白名单错误，不降级为
未登录访客额度。

## 4. Token 预占与结算

token 硬上限在 provider 发出外部 HTTP 请求前执行，而不是在 route 入口预消费：
placeholder reading、不启用百科问答时的静态百科浏览，以及没有检索来源的百科回答
不调用真实模型，也不占额度。

1. provider 构造实际 prompt。
2. 请求前以 `UTF-8 prompt bytes + max output tokens` 作为保守预占量，调用
   `reserve_daily_llm_tokens(...)`。
3. RPC 在事务锁内检查 `consumed_tokens + outstanding_reserved_tokens + requested`
   不超过当日上限，成功后创建 reservation。
4. provider 获得响应后，以实际 usage 结算并释放预占差额。
5. provider 未返回 usage 时沿用服务端 token 估算结果结算。
6. 外部请求已发出但失败且无法可靠判断 usage 时，按全部预占 token 结算。

达到上限时 API 返回 `HTTP 429` 与 `token_limit_exceeded`，文案为“今日体验额度已用完，
请于明日再试。”估算美元成本可继续记录在事件中用于观察，但不参与产品配额拦截。

## 5. 输入与数据边界

请求边界：

| 输入 | 上限 |
| --- | ---: |
| Reading `question` | `1000` 字符 |
| Reading 每条 follow-up answer | `600` 字符 |
| Reading `prior_session_capsule` | `280` 字符 |
| Reading `thread_id` | `128` 字符 |
| Reading `request_id` | UUID |
| `/api/reading` 请求体 | `64 KiB` |
| `/api/encyclopedia/query` 请求体 | `8 KiB` |
| `/api/reading-feedback` 请求体 | `8 KiB` |
| `/api/growth-events` 请求体 | `8 KiB` |

数据最小化与保留期：

| 数据 | 保存内容 | 保留期 |
| --- | --- | ---: |
| `auth_email_events` | Credentials 登录状态、邮箱、IP hash、错误码与耗时 | `30` 天 |
| `reading_events` | 幂等 request ID、调用状态、用量、IP hash、必要定位字段 | `30` 天 |
| `encyclopedia_events` | 调用状态、来源数量、用量、IP hash；不保存问题原文 | `30` 天 |
| `reading_feedback` | 用户主动反馈标签与备注；登录用户 ID 或游客 IP hash | `90` 天 |
| `growth_events` | 随机归因/会话/流程 ID、salted IP hash、清洗后 UTM、落地路径、referrer hostname；不含完整 URL/query/解读正文 | `90` 天 |
| `stored_readings` | completed reading 回放 payload、抽牌 metadata 与用户笔记 | `365` 天 |
| 已结算 token reservation、日汇总、quota counters | 配额审计与短期诊断数据 | `7` 天 |

清理由 Postgres `pg_cron` 在每日北京时间 `00:15`（UTC `16:15`）执行
`cleanup_beta_ops_retention()`。系统只保存经过 salt 哈希的 IP，不记录明文 IP。

## 6. 生产环境变量

```dotenv
NODE_ENV=production
NEXT_PUBLIC_SITE_URL=https://aethertarot.cn
AUTH_SECRET=
AUTH_URL=https://aethertarot.cn
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# 首次部署保持禁用真实模型，供应商硬预算验收后才改为 llm
AETHERTAROT_READING_PROVIDER=placeholder
AETHERTAROT_ENCYCLOPEDIA_PROVIDER=disabled
AETHERTAROT_READING_GENERATION_MODE=monolithic
AETHERTAROT_LLM_BASE_URL=
AETHERTAROT_LLM_MODEL=
AETHERTAROT_LLM_API_KEY=
AETHERTAROT_LLM_THINKING_MODE=
AETHERTAROT_LLM_RESPONSE_FORMAT=
AETHERTAROT_LLM_TEMPERATURE=0.3
AETHERTAROT_LLM_TIMEOUT_MS=120000
AETHERTAROT_LLM_MAX_OUTPUT_TOKENS=3000
AETHERTAROT_LLM_MAX_RESPONSE_BYTES=1048576
AETHERTAROT_LLM_MAX_CONCURRENCY=4
AETHERTAROT_LLM_MAX_QUEUE=16
AETHERTAROT_LLM_QUEUE_TIMEOUT_MS=15000

AETHERTAROT_READING_DAILY_LIMIT_PER_USER=10
AETHERTAROT_READING_DAILY_LIMIT_PER_ANONYMOUS_IP=3
AETHERTAROT_ENCYCLOPEDIA_DAILY_LIMIT_PER_USER=20
AETHERTAROT_ENCYCLOPEDIA_DAILY_LIMIT_PER_ANONYMOUS_IP=1
AETHERTAROT_LLM_IP_LIMIT_PER_MINUTE=6
AETHERTAROT_LLM_DAILY_TOKEN_LIMIT=1000000
AETHERTAROT_IP_HASH_SALT=
AETHERTAROT_PROXY_SHARED_SECRET=
```

Readiness 与运行时都会先 `trim` provider、generation mode、thinking mode 与 response format，再按相同枚举解释；因此运维文件中的偶然首尾空白不会造成 readiness 通过而运行时 503。Readiness 只接受 `AETHERTAROT_READING_PROVIDER=placeholder|llm`、`AETHERTAROT_ENCYCLOPEDIA_PROVIDER=disabled|llm`，并要求游客首发固定 `AETHERTAROT_READING_GENERATION_MODE=monolithic`；非法值在发布前失败。单次 provider deadline 最大为 `120000ms`，必须为 Caddy `response_header_timeout 130s` 保留至少 10 秒的 route 收尾与错误映射余量，`129999ms` 等“仅略低于边缘 timeout”的配置仍然失败。代码仍保留 `adaptive_staged` 实验路径，但不属于本轮可发布配置；readiness 还计算其最多四次 provider deadline 的最坏值并要求低于 Caddy 130 秒预算，避免未来放宽模式门禁时遗漏 whole-route 上限。

`AETHERTAROT_LLM_MAX_CONCURRENCY/MAX_QUEUE/QUEUE_TIMEOUT_MS` 只控制单个 Node.js 实例；先获取 permit，再预留 token。多实例部署不会共享这个 semaphore，仍需供应商硬预算或共享网关限制。`MAX_RESPONSE_BYTES` 受代码 4 MiB 硬上限约束。生产必须使用不同的高熵值配置 IP hash salt 与 proxy shared secret。

`AETHERTAROT_LLM_INPUT_COST_PER_1K_USD` 与
`AETHERTAROT_LLM_OUTPUT_COST_PER_1K_USD` 可继续提供后台成本估算，但不会阻断请求。

抖音首轮生产口径为 `AETHERTAROT_READING_PROVIDER=llm`、
`AETHERTAROT_LLM_BASE_URL=https://api.deepseek.com`、
`AETHERTAROT_LLM_MODEL=deepseek-v4-flash`、`AETHERTAROT_LLM_THINKING_MODE=disabled`、
`AETHERTAROT_LLM_RESPONSE_FORMAT=json_object` 与
`AETHERTAROT_LLM_MAX_OUTPUT_TOKENS=3000`。代码默认硬上限仍是 `3200`，生产必须显式覆盖为
`3000`；每次请求还会按牌数与 profile 取更小的预算。三个用户可见 profile 名称固定为
`lite`（快速塔罗师）、`standard`（日常塔罗师）、`sober`（深度塔罗师），它们不是不同模型。
DeepSeek V4 默认启用思考模式；非思考模式更适合本轮 JSON 输出链路与 token 成本观察。
API key 仅在供应商账户无自动续充、余额耗尽会停止调用时写入生产服务器。
百科页面运行时读取 `AETHERTAROT_ENCYCLOPEDIA_PROVIDER`；修改该开关后重启应用即可
显隐问答面板。发布新前端代码时仍需在本地或 CI 重新执行生产构建，并上传
Next.js `standalone` release 产物。

只有在供应商免费额度或硬预算保护已经验收后，才将
`AETHERTAROT_READING_PROVIDER=llm` 与
`AETHERTAROT_ENCYCLOPEDIA_PROVIDER=llm` 分别用于开放对应真实模型入口。百科 provider
默认为 `disabled`：静态百科仍可浏览，页面不展示问答入口，直接请求 API 也不会消耗
用户 quota 或触发模型调用。

### 6.1 抖音 UTM 与转化漏斗

抖音发布链接至少携带：

```text
https://aethertarot.cn/?utm_source=douyin&utm_medium=video&utm_campaign=beta_launch_01
```

前端在首方存储中保留最近一次有效 UTM 归因 `30` 天，并用随机 UUID 串联一次浏览会话与
一次解读流程。服务端将以下事件写入 `growth_events`：

1. `page_view`：每个浏览会话一次
2. `reading_started`：进入实际解读流程时一次，不把本地快速预览误算为模型解读
3. `reading_completed`：收到并保存 completed reading 后一次
4. `feedback_submitted`：反馈 API 成功后一次

事件 API 每个 IP 每分钟最多接受 `120` 条，并依靠 event ID、session/event 与 flow/event
唯一约束幂等。`/admin` 的“运营来源漏斗”按 `utm_source` 汇总上述四阶段；上线前需用独立
浏览器会话完整走一遍带 UTM 的游客流程，确认 `douyin` 行四列各增加 `1`。不要把用户问题、
牌面正文、完整 referrer 或带 query 的页面 URL 写入运营事件。

## 7. 大陆 2C2G 生产基线体检

大陆服务器内测发布前，先在本地仓库执行只读 readiness 检查，再人工登录服务器确认
运行时基线。该检查只读取本地环境变量、Next 构建产物和卡牌静态资源，不 SSH、不修改
服务器、不打印 secret 值：

```bash
node scripts/production-readiness-check.mjs --origin https://aethertarot.cn
```

若大陆内测先使用临时 HTTPS 入口，将 `--origin` 改为实际可访问入口；不要把裸公网 IP
硬编码到脚本、测试或构建产物中。检查通过只代表本地发布包具备最低生产形态，服务器
事实仍需人工确认。

2C2G 服务器最低运行检查：

- 内存与磁盘：`free -h`、`df -h` 确认可用内存、swap 与磁盘余量足够，不在磁盘接近满载时重启。
- swap：2G RAM 机器必须启用 swap，建议 `2G` 到 `4G`；用 `swapon --show` 和 `free -h` 确认已生效。
- Node：确认生产 Node 为 20+；当前腾讯云首发目标为 Node.js `22 LTS`，仓库开发/CI 仍以 `.nvmrc` 为准。
- Node 内存限制：systemd 运行时建议设置 `NODE_OPTIONS=--max-old-space-size=1024`；生产发布默认禁止在小内存服务器上执行 `npm run build`。
- systemd：确认 `aethertarot-web.service` 的 `EnvironmentFile` / `Environment` 指向正确生产 env，且 `systemctl status`、`journalctl -u aethertarot-web.service` 无启动循环、OOM 或缺 env 错误。
- 网络入口：确认 Caddy/HTTPS、正式域名或临时 HTTPS 域名、Auth.js 登录/登出回跳、`www` 规范跳转和响应压缩。
- 本机端口：在服务器本机确认 Next.js 只监听预期本地端口，例如 `127.0.0.1:3000`，公网入口由反向代理承载。

### 7.1 可信客户端 IP 与 Caddy 验收

仓库示例见 `docs/70-ops/Caddyfile.aethertarot.example`，要求 Caddy `>= 2.10`。Caddy 必须删除外部传入的 `CF-Connecting-IP`、`X-Forwarded-For`、`X-Real-IP` 与两条内部头，再用 TCP peer 写内部 IP/secret；80 只跳转正式域名，HTTPS `www` 跳 apex，未知 Host/SNI 与源站 IP 拒绝。`/api/reading`、普通 API 与仍保留的 `/api/readings/migrate` 分别使用 `64KiB`、`256KiB`、`2MiB` body cap，配置和验收统一使用二进制单位，避免全局 cap 使 migrate 合同不可达。

Standalone 启动脚本会把 `HOSTNAME` 明确设为 `127.0.0.1`；systemd 仍应显式写入并验收。Caddy 不继承 `aethertarot-web.service` 的 env：为 `caddy.service` 单独配置权限 `0600` 的 `EnvironmentFile`（只含 `AETHERTAROT_PROXY_SHARED_SECRET`）或等价 drop-in，然后 `systemctl daemon-reload`。`AUTH_SECRET`、proxy secret 与 IP salt 都必须至少 32 字符且不是示例占位符，proxy secret 与 IP salt 必须彼此不同；应用/readiness 会拒绝不安全配置。当前边缘 `response_header_timeout = 130s`、上游读取上限 `140s`；有 provider 时 readiness 要求单一 `AETHERTAROT_LLM_TIMEOUT_MS` 不超过 `120000`，从排队前覆盖 acquire、reservation、headers/body 与 settlement，并为 route 收尾、settlement 与错误映射保留至少 10 秒边缘余量。

人工批准后在服务器执行并保存结果（本轮不自动执行）：

```bash
caddy version
caddy adapt --config /etc/caddy/Caddyfile --pretty
caddy validate --config /etc/caddy/Caddyfile
ss -ltnp
curl -I http://aethertarot.cn/
curl -I http://SERVER_ORIGIN_IP/
curl -k -I --resolve unknown.example:443:SERVER_ORIGIN_IP https://unknown.example/
curl -I https://aethertarot.cn/
curl -I https://aethertarot.cn/ -H 'CF-Connecting-IP: 1.1.1.1' -H 'X-Forwarded-For: 2.2.2.2' -H 'X-Real-IP: 3.3.3.3' -H 'X-AetherTarot-Client-IP: 4.4.4.4' -H 'X-AetherTarot-Proxy-Secret: forged'
```

判定标准：`caddy version` 至少 2.10，adapt/validate exit 0；`ss` 只能看到 `127.0.0.1:3000` 而不是 `0.0.0.0/[::]:3000`；公网机器连接 `SERVER_ORIGIN_IP:3000` 必须失败；raw-IP HTTP 必须为 421/明确拒绝；unknown SNI TLS 必须握手失败或拒绝；两个合法 HTTP host 必须 308 到 apex HTTPS，HTTPS www 也必须跳 apex。任一不满足即 FAIL，不得以应用测试通过替代。

同时检查云安全组与主机防火墙。伪造头测试应通过服务端审计确认 subject 仍来自 Caddy TCP peer。若未来接入 Cloudflare，必须使用单独配置；只有源站入站仅允许 Cloudflare 官方网段时，边缘代理才可信任 `CF-Connecting-IP`。

### 7.2 Standalone release 发布原则

大陆小内存节点不再执行服务器源码构建。标准发布链路为：

1. 在本地开发机、CI 或独立构建机运行 contract tests、lint 与 `npm run build -w @aethertarot/web`。
2. `apps/web/next.config.ts` 使用 Next.js `output: "standalone"`，构建后从
   `apps/web/.next/standalone` 组装 release。
3. release archive 必须包含 standalone server、traced runtime dependencies、
   `apps/web/.next/static` 与 `apps/web/public`，并写入非敏感 `RELEASE.json`。
4. release archive 不得包含 `apps/web/.env.production.local`、service role key、
   LLM key、salt、服务器密码或私钥。
5. 生产服务器只负责解压产物、保留服务器 env、重启 `aethertarot-web.service` 与验收。

`aethertarot-web.service` 应从 `/opt/aethertarot/app` 启动 standalone server，例如
`HOSTNAME=127.0.0.1 node apps/web/server.js`。如果当前 systemd unit 仍使用 `npm run start` 或依赖完整源码，
迁移到 standalone release 时必须同步调整 unit，并在回滚记录中写明 systemd 变更。

只有在紧急恢复且没有可用构建机时，才允许临时考虑服务器侧源码构建；执行前必须停掉
`aethertarot-web.service`、确认 swap 与可用内存，并接受 SSH 控制面再次失效的风险。
1.6GB 级别实例不得作为常规构建环境。

### 7.3 大陆节点手工部署约定

当前大陆节点部署操作可使用 repo-local skill：

- `.agents/skills/aethertarot-server-deploy/SKILL.md`
- `.agents/skills/aethertarot-server-deploy/references/deployment-flow.md`

该 skill 记录了当前节点的非敏感默认信息：目标 IP `47.96.103.79`、SSH 端口 `22`、应用目录 `/opt/aethertarot/app`、运行用户 `admin`、systemd service `aethertarot-web.service`。标准流程上传本地或 CI 构建的 standalone release，不在服务器执行 `npm run build`。仓库与部署记录不得保存密码、私钥内容、env 文件内容、service role key、LLM key 或 salt。

`aethertarot.cn` 已完成 ICP 备案并解析到当前大陆节点。大陆节点验收应优先使用：

- 服务器本机：`curl -I http://127.0.0.1:3000/`
- 正式域名：`curl -I https://aethertarot.cn/`
- 目标 IP：`curl -I http://47.96.103.79/`（用于定位 Caddy、firewall 或 DNS 问题）

若后续 DNS、CDN 或源站路由发生变化，必须先确认域名解析到预期目标，再把
`https://aethertarot.cn/` 作为部署成功证据。

若 SSH 在认证前报 `Connection timed out during banner exchange`、`Exceeded MaxStartups` 或连接被远端关闭，应停止部署命令，避免并发 SSH/SCP 继续压垮控制面；需先通过云控制台重启实例、重启 sshd 或清理卡住的登录连接。

回滚前后必须记录：

- 时间、操作者、服务器区域/IP、回滚原因。
- 回滚前 commit、目标 commit、Next `BUILD_ID`。
- provider 与关键 env 的“状态”而非值，例如 reading 是否为 `placeholder` / `llm`、百科是否为 `disabled` / `llm`；不得记录 service role key、LLM key、salt、密码或私钥内容。
- Supabase migration 状态、systemd unit/env 是否变更、Caddy 是否变更。
- readiness 检查结果、prewarm 结果、重启结果、登录/reading smoke 结果与最终验收结论。

## 8. 发布检查表

- 应用新的 Supabase migration，并确认 `pg_cron` 定时任务已注册。
- 确认已应用 Credentials auth 相关 migration：`app_users`、`beta_testers.password_hash` 与 `app_users.auth_provider = credentials` 约束。
- 使用 `apps/web/scripts/set-tester-password.mjs` 初始化 tester 与独立 admin 密码；用 tester 验证个人日额度。
- 验证 `/login` 正确处理 tester、admin、错误密码、未激活账号与未知邮箱，并写入登录审计。
- 验证邮箱/IP/全站登录尝试限流命中时返回受控错误，不泄露账号是否存在。
- 确认 `AUTH_URL`、`AUTH_SECRET`、`NEXT_PUBLIC_SITE_URL` 与 `SUPABASE_URL` 均为生产值，登出不跳回 localhost。
- 确认 `www` 规范跳转、Caddy 响应压缩与 Auth.js 登录/登出正式域名回跳均正确。
- 确认生产环境未启用 E2E access bypass。
- 确认 reading 使用本轮批准的 DeepSeek baseline、`max output tokens = 3000`，百科 provider 保持 `disabled`；未通过供应商硬预算验收时不得开放新的 LLM 入口。
- 验证 reading / encyclopedia 的个人额度、未登录 IP 日额度、共享 IP 分钟防刷与共享 token 硬上限。
- 应用 `202608100001_complete_reading_quota.sql`、`202608100002_douyin_launch_telemetry.sql` 与 forward-only `202608100003_growth_event_quota_permissions.sql`；确认 `consume_growth_event_quota` 仅授权 `service_role`，并验收 `pg_cron` retention job。
- 用带 `utm_source=douyin` 的独立游客会话依次验证访问、开始解读、完成解读和四类反馈，确认 `/admin` 的 douyin 漏斗递增且数据库不含完整 referrer、页面 query 或解读正文。
- 应用 reading request 幂等 migration，并验证重复 `request_id` 只写一条事件、生成失败会退还日额度。
- 验证 admin 不受个人额度限制，但模型调用增加日 token 使用量。
- 验证百科事件不含用户问题原文，并验证 `30` / `90` / `365` / `7` 天清理函数。
- 验证 `stored_readings` 仅保存当前登录用户的 completed reading，`GET /api/readings` 默认限量，重复 `user_id + reading_id` 保存幂等覆盖；游客 guest key 不自动导入任何账号，401/500 不回退其他身份。
- 单独执行一次真实百科 Agent 成功/失败路径验收，不以入口可见性替代功能验收。
- 从中国大陆网络测量登录与 reading 延迟，并核查卡牌图片体积、缓存与压缩配置。
- 在本地执行 `node scripts/production-readiness-check.mjs --origin <当前 HTTPS 内测入口>`，确认必需 env、Next 构建产物、`cardsV2` / `reveal` / `thumbs` 与 prewarm URL 均通过检查。
- 通过官方 registry 执行 `npm audit --omit=dev --registry=https://registry.npmjs.org/`；
  不在生产服务器直接运行自动依赖修复。
- 执行资产校验、contract tests、lint、build、E2E 与真实 provider smoke test。

## 9. 依赖安全基线

`2026-08-09` 发布前将 Next.js 升级到 `16.3.0`、Auth.js 升级到
`5.0.0-beta.32`，并在兼容范围内升级 LangChain Core / LangGraph / LangSmith，
以移除已报告的 critical / high 运行时依赖告警。

官方 registry 的 production-only audit 仍报告 3 个来自 LangSmith 可选 tracing peer
与开发期 Lighthouse 共用的 OpenTelemetry `1.30.1` moderate 告警。应用未启用该 tracing
链，生产 standalone 也不包含 Lighthouse；当前上游兼容范围仍会选择 OpenTelemetry 1.x，
因此不以强制跨 major override 破坏依赖解析，待上游统一到 `2.8.0+` 后再升级并复测。

## 10. P1 数据库前置条件

生产发布必须先应用 `202607230001_durable_reading_runtime.sql`、
`202608100001_complete_reading_quota.sql`、
`202608100002_douyin_launch_telemetry.sql` 与 forward-only
`202608100003_growth_event_quota_permissions.sql`。生产 Route 不允许回退到进程内 execution 或
memory Map；Supabase service role 不可用时，snapshot/幂等路径返回
`503 provider_unavailable`。定时运行 `cleanup_beta_ops_retention()`，以执行 Thread Memory
90 天、initial snapshot 7 天、execution 北京当日结束、trace 30 天、反馈与增长事件 90 天的清理。

Migration 应用后必须执行权限验收（本轮只提供命令，不自动连接生产库）：

```sql
select grantee, privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name = 'consume_growth_event_quota'
order by grantee;
```

PASS 仅允许 `service_role` 拥有 `EXECUTE`；`PUBLIC`、`anon`、`authenticated` 任一仍有 EXECUTE 即 FAIL。另行确认 `pg_cron` retention job 存在且最近运行成功。

## 11. LLM Safety Reviewer 发布与运维

生产必须配置独立的 `AETHERTAROT_SAFETY_REVIEWER_BASE_URL/MODEL/API_KEY`，不得复用正文 key 或 bulkhead。readiness 只接受 `MODE=shadow|enforce`；`off` 仅本地。默认约束为 temperature 0、strict JSON object、192 output tokens（允许 128–256）、32 KiB response cap（允许 16–32 KiB）、input 1800ms、output 2500ms、queue 300ms，且不做请求内无限重试。`AETHERTAROT_SAFETY_REVIEWER_SUBJECT_RATE_LIMIT_PER_MINUTE`（默认 12）在 Reviewer 调用且 Reading 配额扣减之前，对账号主体或 IP 摘要执行跨实例门控；原始主体/IP 不写入该表、不传给 Reviewer Provider。

独立日预算依赖 migration `202608130002_safety_reviewer_token_budget.sql`，提供 `safety_input/safety_output` reservation source 与独立 usage/reservation 表；跨实例主体门控依赖 `202608130003_safety_reviewer_subject_rate_limit.sql`。`202608130004_safety_reviewer_retention.sql` 将已结算 Reviewer reservation、日汇总和主体分钟计数纳入既有 7 天清理函数。发布前先执行 `node scripts/check-supabase-migration-versions.mjs`，再按唯一的向前顺序应用 `202608130001_clear_initial_snapshot_continuity_context.sql`、`202608130002_safety_reviewer_token_budget.sql`、`202608130003_safety_reviewer_subject_rate_limit.sql`、`202608130004_safety_reviewer_retention.sql`；只读核对四项 migration 已应用、三个 Reviewer RPC 仅授予 `service_role`，并确认 `cleanup_beta_ops_retention()` 与 pg_cron 最近一次执行成功。本开发轮次不得自动执行生产 migration。

发布顺序必须是：

1. `shadow`：确认用户结果与旧策略一致，指标不含原文；
2. 受控 canary：小流量/指定账号演练 fail-closed、429/5xx/schema/circuit-open；
3. `enforce`：只有误升级、漏升级、P95、预算与故障演练达标后启用。

enforce 输入故障发生在 Reading quota 与生成前；输出故障触发 initial 日额度退款，但实际使用的 Reviewer/正文 token 正常结算。不得把 503 改写成 safety 403，不得回退 deterministic-only。发布检查还需确认 Reviewer 与 generation 的 bulkhead namespace、API key、token budget、rate limit 和 circuit metrics 均能分别观测。

### 11.1 Reviewer 生产测试方案

生产故障注入必须先在独立 Supabase staging 与 Reviewer stub 上完成；主生产只接受可回滚的 shadow/canary 验收，不直接注入 token 耗尽、非法 schema 或 provider 5xx。当前 `MODE` 是实例级全局开关，不具备按账号或百分比切流能力；指定账号 canary 必须使用独立实例或独立内测入口。

发布分四阶段：

1. **数据库验收**：确认 `001`–`004` 已应用；三张 Reviewer 表启用 RLS；三个 Reviewer RPC 仅授权 `service_role`；在事务回滚测试中验证 token reserve/settle 幂等、同主体分钟上限、不同主体隔离，以及两个并发客户端合计不能越过同一主体阈值。
2. **隔离故障演练**：分别注入 input/output timeout、429、5xx、非法 schema、queue-full、预算耗尽与 circuit-open。input 故障必须发生在 Reading quota/provider 前；Initial output 故障必须退款并释放 execution lease；Final output 故障必须释放 snapshot claim；所有失败路径均不得持久化生成正文。Encyclopedia 必须覆盖 reviewer-only restrict、replace 与 fail-closed。
3. **生产 shadow**：至少观察 24 小时，确认用户 HTTP status、公共 schema 与旧策略一致；指标不含问题原文、Secret、原始账号或 IP；Reviewer reservation 不长期停留在 `reserved`；正常流量下 circuit-open 与 queue-full 为 0，P95 低于 input/output deadline 且保留收尾余量。
4. **独立 canary enforce → 主实例 enforce**：先在独立入口完成普通 Reading、hard-stop、sober-check、Reviewer-only restrict/replace、request_id replay、并发重复请求、subject 限流、quota refund、lease/snapshot release 和 Encyclopedia 全链路。随后切主实例，分别观察 15 分钟、1 小时和 24 小时。

GO 条件：严重违规零泄漏；无 deterministic-only 降级；跨实例主体上限不超发；quota/refund/lease/snapshot 全部符合合同；Reviewer 与正文生成的 key、bulkhead、预算和指标可独立观测；三浏览器核心 Reading/Encyclopedia smoke 通过。任一条件失败即 NO-GO，先将生产实例从 `enforce` 回退到 `shadow` 并重启；migration 保持 forward-only，不删除表或 RPC。
