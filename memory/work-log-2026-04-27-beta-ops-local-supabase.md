# Work Log - 2026-04-27

- `date`: `2026-04-27`
- `status`: `DONE`
- `scope`: `Beta Ops Risk Controls + Local Supabase Auth + LLM Provider Debugging`

## 1. 本轮目标

本轮围绕第一轮内测前的“能安全给真实 tester 使用”做收口，重点是：

- 为 `/api/reading` 增加登录、白名单、配额、成本上限与观测。
- 为 `/admin` 和 `/api/admin/*` 增加 admin-only 访问控制。
- 在本地跑起 Supabase stack，支撑真实 magic-link 登录、白名单、配额与观测表。
- 将 `643490291@qq.com` 配成 admin，并允许其用于高权限本地测试。
- 排查付费 LLM API 的 `HTTP 403`，区分供应商权限问题与浏览器跨域问题。
- 修复本地 Supabase 登录邮件发送失败，并把经验沉淀到 `docs/70-ops/`。

## 2. 内测风控与观测实现

### 2.1 数据层

新增 Supabase migration：

- `apps/web/supabase/migrations/202604270001_beta_ops.sql`

核心表 / RPC：

- `beta_testers`
  - 用邮箱维护内测白名单。
  - `role = tester | admin`。
  - `is_active = true` 才允许使用 protected beta 能力。
- `usage_counters`
  - 支持邮箱每日、IP 每分钟、IP 每日、全局 LLM 每日预算等计数。
  - 通过 RPC 做 quota consume，避免多实例下只靠内存限流。
- `reading_events`
  - 记录 reading 请求、邮箱、IP hash、phase、provider、成功/失败、耗时、token、估算成本、initial/final 完成状态。
- `reading_feedback`
  - 记录完成 reading 后的轻量反馈标签和可选文本。
- `consume_reading_quota`
  - 在调用 LLM 前消费 quota。
  - 超限时直接返回明确错误，避免继续烧付费 provider。

### 2.2 访问控制

新增登录与回调：

- `apps/web/src/app/login/page.tsx`
- `apps/web/src/app/auth/callback/route.ts`

新增 Supabase helper：

- `apps/web/src/lib/supabase/admin.ts`
- `apps/web/src/lib/supabase/client.ts`
- `apps/web/src/lib/supabase/database.types.ts`

保护规则：

- `/api/reading` 必须已登录。
- 登录邮箱必须存在于 `beta_testers`，且 `is_active = true`。
- `/admin` 与 `/api/admin/*` 只允许 `role = admin`。
- 普通 tester 无法访问 admin dashboard。

### 2.3 Reading 风控

`/api/reading` 在调用 reading provider 前执行：

- Supabase session 校验。
- `beta_testers` 白名单校验。
- 邮箱每日 reading quota。
- IP 每分钟 quota。
- IP 每日 quota。
- 全局 LLM 每日成本预算预留。

新增或扩展错误语义：

- `unauthorized`
- `forbidden`
- `rate_limited`
- `cost_limit_exceeded`
- `provider_unavailable`

失败时不会自动无限重试。LLM provider fetch 单次调用失败后直接返回错误，由用户手动重试。

### 2.4 Admin 高权限测试

`643490291@qq.com` 已写入本地 Supabase：

```text
643490291@qq.com | admin | active
```

后续追加 admin quota bypass：

- `role = admin` 不受邮箱/IP/每日 LLM 预算预消费限制。
- admin 请求仍会写入 `reading_events`，便于观察真实耗时、失败、token 与估算成本。

相关实现：

- `apps/web/src/server/beta/quota.ts`
- `apps/web/src/server/beta/quota.spec.ts`

## 3. LLM Provider 与 403 排查

### 3.1 现象

浏览器里 `/api/reading` 返回：

```text
POST http://localhost:3000/api/reading
503 Service Unavailable
```

前端展示：

```text
llm provider 请求失败（HTTP 403）
```

### 3.2 判断

这不是浏览器跨域问题。

原因：

- 浏览器请求的是本地 Next route：`http://localhost:3000/api/reading`。
- LLM provider 请求发生在 Next 服务端 `apps/web/src/server/reading/llm-provider.ts`。
- CORS 只会影响浏览器直接请求第三方域名；服务端 fetch 不受浏览器 CORS 限制。

### 3.3 供应商直连探针

用当前 `.env.local` 的 provider 配置绕过 Next，直接请求 OpenAI-compatible `/chat/completions`，供应商返回：

```json
{
  "error": {
    "message": "Model access denied.",
    "type": "Model.AccessDenied",
    "code": "Model.AccessDenied"
  }
}
```

进一步用多个模型名做最小 `max_tokens = 1` 探针，也返回同类 `Model.AccessDenied`。

结论：

- 不是 `/api/reading` 认证失败。
- 不是 Supabase 问题。
- 不是 CORS。
- 是 LLM provider 侧拒绝当前 API key / model / region / billing 权限。

建议后续检查：

- provider 控制台是否开通模型服务。
- API key 是否来自对应 provider 控制台。
- key 是否具备目标模型访问权限。
- 账号是否有余额或后付费权限。
- endpoint region 是否与 key/model 匹配。
- model 名是否在当前账号可用列表中。

## 4. 本地 Supabase Stack 部署与迁移

### 4.1 初始状态

最初为快速迁移数据，启动过一个独立 Postgres：

- container: `aethertarot-postgres`
- port: `127.0.0.1:54322`

后续为了完整手测 magic-link 登录，切换到 Supabase CLI stack。独立 Postgres 已清理：

- 删除 container `aethertarot-postgres`
- 删除 volume `aethertarot-postgres-data`

### 4.2 Supabase CLI Stack

在 `apps/web` 下初始化：

```powershell
npx supabase init
```

启动 stack：

```powershell
npx supabase start
```

本地迁移自动应用，确认表存在：

- `beta_testers`
- `usage_counters`
- `reading_events`
- `reading_feedback`

并确认 admin 账号：

```sql
select email, role, is_active from public.beta_testers;
```

目标结果：

```text
643490291@qq.com | admin | t
```

## 5. Supabase 登录失败与端口冲突修复

### 5.1 现象

登录页调用：

```ts
await supabase.auth.signInWithOtp(...)
```

页面提示：

```text
登录邮件发送失败
```

或开发 overlay 指向：

```text
src/app/login/page.tsx
```

### 5.2 排查

检查 Auth、Kong、Mailpit 容器后发现：

- 容器内部 `supabase_kong_web` 可以访问 `http://127.0.0.1:8000/auth/v1/settings`。
- 但 Windows 宿主机无法访问原 `http://127.0.0.1:54321/auth/v1/settings`。
- `docker inspect supabase_kong_web` 曾显示容器端口没有正确发布到宿主机。

进一步检查 Windows TCP 排除端口：

```powershell
netsh interface ipv4 show excludedportrange protocol=tcp
```

发现系统保留了：

```text
54319-54418
```

原 Supabase 默认端口：

- `54321` API
- `54322` DB
- `54323` Studio
- `54324` Mailpit

全部落在或贴近冲突区间内，导致端口发布和浏览器连接不稳定。

### 5.3 修复

将 `apps/web/supabase/config.toml` 的本地端口整体迁移到 `5542x`：

```text
API:     http://127.0.0.1:55421
DB:      postgresql://postgres:postgres@127.0.0.1:55422/postgres
Studio:  http://127.0.0.1:55423
Mailpit: http://127.0.0.1:55424
```

同步修改：

- `apps/web/.env.local`
  - `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55421`
- `apps/web/.env.local.example`
- `docs/70-ops/dev-setup.md`
- `apps/web/README.md`

同时将本地 Auth 邮件发送限额从 `2` 调整为 `30`：

```toml
[auth.rate_limit]
email_sent = 30
```

### 5.4 重启

重启 Supabase：

```powershell
cd apps/web
npx supabase stop
npx supabase start
```

重启 Next dev server，让前端 bundle 重新读取 `NEXT_PUBLIC_SUPABASE_URL`：

```powershell
npm run dev -w @aethertarot/web
```

### 5.5 验证

Supabase status：

```text
Project URL: http://127.0.0.1:55421
Database:    postgresql://postgres:postgres@127.0.0.1:55422/postgres
Studio:      http://127.0.0.1:55423
Mailpit:     http://127.0.0.1:55424
```

验证 Auth settings：

```powershell
Invoke-WebRequest -Uri http://127.0.0.1:55421/auth/v1/settings -UseBasicParsing -SkipHttpErrorCheck
```

结果：

```text
StatusCode = 200
```

验证 Mailpit：

```powershell
Invoke-WebRequest -Uri http://127.0.0.1:55424 -UseBasicParsing -SkipHttpErrorCheck
```

结果：

```text
StatusCode = 200
```

Auth 直连 OTP 测试：

```text
status=200
{}
```

Mailpit 中确认出现 magic-link 邮件。

## 6. 登录页异常兜底

修复前：

- `signInWithOtp` 遇到网络连接失败时可能直接抛异常。
- 开发环境会出现 Next overlay，用户只看到源码定位。

修复后：

- `handleSubmit` 用 `try/catch/finally` 包裹 Supabase 调用。
- Auth 返回 error 时展示：

```text
登录邮件发送失败，请检查本地 Supabase Auth 是否可用。
```

- 网络异常时展示：

```text
无法连接登录服务，请确认本地 Supabase stack 已启动。
```

文件：

- `apps/web/src/app/login/page.tsx`

## 7. 运维文档沉淀

新增稳定故障手册：

- `docs/70-ops/local-supabase-auth-troubleshooting.md`

内容包括：

- 典型症状
- 如何判断不是 CORS
- 当前 `5542x` 端口约定
- Windows/WSL `5432x` 端口保留冲突判断
- Supabase API / Mailpit 验证命令
- 修复流程
- Auth 直连 OTP 测试
- admin 白名单校验
- 真实账号手测流程
- 与 LLM `403 Model.AccessDenied` 的区别

同步更新：

- `docs/70-ops/dev-setup.md`
- `apps/web/README.md`
- `apps/web/.env.local.example`
- `.gitignore`

新增 `.gitignore` 规则：

```text
apps/web/dev-server.*.log
```

避免本地 Next dev server 日志进入 git。

## 8. 当前本地可用地址

Next：

```text
http://localhost:3000
```

Supabase：

```text
API:     http://127.0.0.1:55421
Studio:  http://127.0.0.1:55423
Mailpit: http://127.0.0.1:55424
DB:      postgresql://postgres:postgres@127.0.0.1:55422/postgres
```

admin 邮箱：

```text
643490291@qq.com
```

## 9. 真实账号手测流程

1. 打开 `http://localhost:3000/login`。
2. 输入 `643490291@qq.com`。
3. 点击发送登录链接。
4. 打开 Mailpit：`http://127.0.0.1:55424`。
5. 打开最新 magic-link 邮件并点击链接。
6. 登录回站点后访问 `http://localhost:3000/admin`。
7. 进入 `/new -> /ritual -> /reveal -> /reading` 完成一次 reading。
8. 若 reading 失败，先区分：
   - 登录 / Auth 失败：查 Supabase stack 和 Mailpit。
   - `/api/reading 503` 且 provider 返回 `Model.AccessDenied`：查 LLM provider 权限。
   - quota 错误：查 `usage_counters` 与 admin bypass 是否符合预期。

## 10. 验证记录

已完成的验证：

- `npm run test:contract -w @aethertarot/web`
  - 风控实现阶段：`52/52` 通过。
  - admin quota bypass 后：`54/54` 通过。
- `npm run lint -w @aethertarot/web`
  - 通过。
  - 仍有既有 warning，例如 `<img>` 与字体加载 warning。
- `npm run build -w @aethertarot/web`
  - 通过。
- Supabase Auth settings：
  - `http://127.0.0.1:55421/auth/v1/settings` 返回 `200`。
- Mailpit：
  - `http://127.0.0.1:55424` 返回 `200`。
- Auth OTP 直连：
  - 返回 `status=200 {}`。
- 白名单：
  - `643490291@qq.com | admin | t`。

## 11. 当前已知风险 / 后续事项

- LLM provider `403 Model.AccessDenied` 已确认根因是百炼工作空间未授权模型；授权后已恢复。当前默认使用 `qwen3.6-flash` 作为第一轮内测成本 baseline。
- `.env.local` 为本地私有配置，不进入 git；若更换 provider / model / key，必须重启 Next dev server。
- Supabase CLI 输出中 `imgproxy` 与 `pooler` 停止不影响当前登录、REST、数据库、观测与 Mailpit。
- Windows Docker Desktop 仍可能提示 analytics 需要 Docker daemon 暴露到 `tcp://localhost:2375`；当前不阻塞本地 Auth 和 DB 使用。
- 后续如果要做真实外部 tester 邮件发送，需要配置生产 SMTP / hosted Supabase，而不是依赖本地 Mailpit。
- admin quota bypass 只适合内测维护和压力测试；生产运营中应谨慎保留最高权限账号的操作审计。

## 12. 百炼授权恢复与最终风险判断

### 12.1 百炼模型授权

最初 `.env.local` 已切到百炼 OpenAI-compatible endpoint：

```dotenv
AETHERTAROT_LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
AETHERTAROT_LLM_API_KEY=$DASHSCOPE_API_KEY
```

但 `/chat/completions` 对多个模型返回：

```text
HTTP 403 Model.AccessDenied
```

后续确认原因不是 CORS、endpoint、key 格式或 model id 拼写，而是百炼工作空间未对目标模型授权。

授权后验证：

- `qwen3.6-flash`: `200`
- `qwen3.5-flash`: `200`
- `qwen3.5-plus`: `200`

当前 `.env.local` 默认模型：

```dotenv
AETHERTAROT_LLM_MODEL=qwen3.6-flash
```

### 12.2 服务端 env 引用解析

为避免真实 DashScope key 写入 `.env.local`，补充服务端解析：

- `AETHERTAROT_LLM_API_KEY=$DASHSCOPE_API_KEY`
- `AETHERTAROT_LLM_API_KEY=${DASHSCOPE_API_KEY}`

相关文件：

- `apps/web/src/server/reading/llm-provider.ts`
- `apps/web/src/server/reading/__tests__/llm-provider.spec.ts`

这样本地文件只保存引用，真实 key 继续来自系统环境变量。

### 12.3 最终验证

已完成：

- 百炼 `qwen3.6-flash` 直连 `/chat/completions`：`200`
- `npm run test:contract -w @aethertarot/web -- src/server/reading/__tests__/llm-provider.spec.ts`：`9/9` 通过
- `npm run test:llm -w @aethertarot/web`：`1/1` 通过，完整 reading pipeline 可生成 standard initial reading
- Supabase stack 通过 `docker start` 恢复已有容器：
  - API `http://127.0.0.1:55421` 返回 `200`
  - Mailpit `http://127.0.0.1:55424` 返回 `200`
  - admin 白名单：`643490291@qq.com | admin | t`
  - Auth OTP 直连：`status=200 {}`
- `/api/reading` 未登录保护：返回 `401 unauthorized`

### 12.4 五项风险状态

当前判断：

- LLM API 成本风险：第一轮白名单内测已基本解决。仍建议放量前把 `AETHERTAROT_LLM_COST_RESERVATION_USD` 按最坏情况调保守，或补实际成本回写。
- `/api/reading` 被刷风险：普通 tester 已基本解决；未登录、非白名单、邮箱/IP/全局预算限额都会阻断 provider 调用。
- 管理后台访问风险：已解决；`/admin` 与 `/api/admin/*` 均要求 `role = admin`。
- 密钥暴露风险：基本解决；真实 DashScope key 只放系统环境变量，服务端解析引用，不使用 `NEXT_PUBLIC_`。
- 观测缺失风险：第一轮内测已基本解决；可看请求量、用户数、成功/失败、LLM 耗时、token、估算成本、two-stage 完成和反馈。后续建议补 provider 细分 `http_status/provider_error_code` 到 dashboard。
