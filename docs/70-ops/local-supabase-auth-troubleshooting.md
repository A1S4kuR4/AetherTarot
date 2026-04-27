# 本地 Supabase 登录故障排查

## 背景

本记录沉淀 `2026-04-27` 本地登录手测中遇到的 Supabase magic-link 发送失败问题，便于后续快速判断和修复。

本地 Supabase 只负责开发登录、白名单、配额和观测数据。登录邮件不会发送到真实邮箱，而是进入 Mailpit。

---

## 典型症状

在 `http://localhost:3000/login` 输入白名单邮箱后，页面提示：

```text
登录邮件发送失败
```

或者 Next dev overlay 指向：

```text
src/app/login/page.tsx
await supabase.auth.signInWithOtp(...)
```

浏览器网络请求可能显示 Supabase Auth 请求失败，或前端只能看到 `TypeError: Failed to fetch` 一类网络错误。

---

## 快速判断

先确认这是不是浏览器跨域问题。

如果浏览器请求的是：

```text
http://localhost:3000/login
http://127.0.0.1:<supabase-api-port>/auth/v1/otp
```

并且不是浏览器控制台明确报：

```text
blocked by CORS policy
```

通常不是 CORS，而是本地 Supabase Auth/API 端口不可达、Auth 容器异常、端口映射失效或邮件限流。

---

## 当前本地端口约定

本项目本地 Supabase 使用 `5542x` 端口，避免 Windows/WSL 常见的 `54319-54418` 系统保留端口冲突：

```text
API:     http://127.0.0.1:55421
DB:      postgresql://postgres:postgres@127.0.0.1:55422/postgres
Studio:  http://127.0.0.1:55423
Mailpit: http://127.0.0.1:55424
```

对应配置位于：

- `apps/web/supabase/config.toml`
- `apps/web/.env.local`
- `apps/web/.env.local.example`

---

## 排查命令

从仓库根目录或 `apps/web` 执行均可，Supabase CLI 命令建议在 `apps/web` 下执行。

查看 Supabase stack 状态：

```powershell
cd apps/web
npx supabase status
```

验证 API 网关是否可达：

```powershell
Invoke-WebRequest -Uri http://127.0.0.1:55421/auth/v1/settings -UseBasicParsing -SkipHttpErrorCheck |
  Select-Object StatusCode,Content
```

验证 Mailpit 是否可达：

```powershell
Invoke-WebRequest -Uri http://127.0.0.1:55424 -UseBasicParsing -SkipHttpErrorCheck |
  Select-Object StatusCode
```

查看关键容器端口：

```powershell
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" |
  Select-String -Pattern "supabase_(db|kong|auth|studio|inbucket|rest)_web|NAMES"
```

检查 Windows 是否保留了原 `5432x` 端口：

```powershell
netsh interface ipv4 show excludedportrange protocol=tcp
```

如果看到类似：

```text
Start Port    End Port
54319         54418
```

就不能再使用 `54321`、`54322`、`54323`、`54324` 这组端口。

---

## 修复流程

1. 确认 `apps/web/supabase/config.toml` 使用 `5542x` 端口。

关键配置应类似：

```toml
[api]
port = 55421

[db]
port = 55422
shadow_port = 55420

[studio]
port = 55423
api_url = "http://127.0.0.1:55421"

[inbucket]
port = 55424

[analytics]
port = 55427
```

2. 确认 `apps/web/.env.local` 指向新的本地 API：

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55421
```

3. 重启 Supabase stack：

```powershell
cd apps/web
npx supabase stop
npx supabase start
```

`supabase stop/start` 会保留本地数据卷；不要使用 `db reset`，除非你明确想清空本地数据并重跑 seed。

4. 重启 Next dev server。

Next 的 `NEXT_PUBLIC_*` 环境变量会进入前端 bundle。改完 `.env.local` 后，如果不重启 dev server，浏览器可能还在使用旧的 Supabase URL。

```powershell
npm run dev -w @aethertarot/web
```

5. 重新打开登录页：

```text
http://localhost:3000/login
```

---

## Auth 直连测试

如果页面仍失败，可以绕过前端，直接测试 Supabase Auth 是否能接受 OTP 请求。

```powershell
cd apps/web
$envText = npx supabase status --output env
$anonLine = $envText | Select-String '^ANON_KEY=' | Select-Object -First 1
$anon = $anonLine.ToString().Split('=')[1].Trim('"')
$payload = @{
  email = '643490291@qq.com'
  create_user = $true
  data = @{}
  gotrue_meta_security = @{}
} | ConvertTo-Json -Depth 5
$headers = @{
  apikey = $anon
  Authorization = "Bearer $anon"
  'Content-Type' = 'application/json'
  Origin = 'http://localhost:3000'
}
$redirect = [uri]::EscapeDataString('http://localhost:3000/auth/callback?next=%2F')
$resp = Invoke-WebRequest -Uri "http://127.0.0.1:55421/auth/v1/otp?redirect_to=$redirect" -Method Post -Headers $headers -Body $payload -SkipHttpErrorCheck
Write-Output ("status=" + [int]$resp.StatusCode)
Write-Output $resp.Content
```

成功结果：

```text
status=200
{}
```

然后打开 Mailpit：

```text
http://127.0.0.1:55424
```

应能看到 magic-link 邮件。

---

## 白名单与 admin 校验

确认内测账号仍在白名单，并且具备 admin 权限：

```powershell
docker exec supabase_db_web psql -U postgres -d postgres -c "select email, role, is_active from public.beta_testers order by email;"
```

目标结果：

```text
643490291@qq.com | admin | t
```

---

## 真实账号手测流程

1. 打开 `http://localhost:3000/login`。
2. 输入 `643490291@qq.com`。
3. 点击发送登录链接。
4. 打开 `http://127.0.0.1:55424`。
5. 打开最新 magic-link 邮件并点击链接。
6. 回到站点后访问 `http://localhost:3000/admin`。
7. 走 `/new -> /ritual -> /reveal -> /reading` 完成一次 reading。

如果浏览器仍使用旧端口，关闭旧 tab 后重新打开登录页，或强刷页面。

---

## 与 LLM 403 的区别

如果 `/api/reading` 返回：

```text
503 Service Unavailable
```

且服务端或供应商探针显示：

```json
{
  "error": {
    "message": "Model access denied.",
    "type": "Model.AccessDenied",
    "code": "Model.AccessDenied"
  }
}
```

这不是 Supabase 登录问题，也不是 CORS。它表示 LLM provider 已经收到服务端请求，但拒绝当前 API key 或 model 权限。应检查供应商控制台中的 API key、模型权限、地域和余额。

---

## 本次修复摘要

本次修复做了这些持久化处理：

- 将本地 Supabase 端口从 `5432x` 迁到 `5542x`。
- 将 `apps/web/.env.local` 的 `NEXT_PUBLIC_SUPABASE_URL` 切到 `http://127.0.0.1:55421`。
- 将本地 Auth 邮件发送限额调高到 `email_sent = 30`。
- 重启 Supabase stack 与 Next dev server。
- 为登录页 `signInWithOtp` 增加 `try/catch/finally`，避免连接失败时直接暴露开发 overlay。
- 将 `apps/web/dev-server.*.log` 加入 `.gitignore`。
