# UX Trust Risk 收口工作日志（2026-04-27）

## 1. 背景

本轮任务目标是对 AetherTarot 的三个用户侧信任与流失风险做机制化收口：

- 用户怀疑“AI 只是在迎合我”。
- 仪式路径过长，仪式感可能变成等待成本。
- 结果页内容过长，用户第一眼抓不住重点。

本轮约束：

- 不修改 `StructuredReading`、`/api/reading` 成功响应 shape、shared types、Zod schema 或 provider output contract。
- 不新增 LLM 输出字段。
- 优先通过前端派生展示和现有字段重组，让解释路径变得可见、可检查。
- 保留 sober / safety 边界，快速模式不能绕过重大现实决策确认和后端 `sober_check`。

## 2. 初始仓库状态

进入任务时工作区已经存在大量未提交改动，涉及 beta access、auth、admin、observability、provider、shared types、docs 等多个模块。

处理原则：

- 不回退任何非本轮任务产生的改动。
- 只在本轮需要触及的文件上做增量修改。
- 测试失败排查时，如果失败由已有外部依赖或测试环境隔离引起，只加测试专用收口机制，不改变生产访问语义。

## 3. 实现内容

### 3.1 快速解读入口

修改文件：

- `apps/web/src/components/home/RitualInitializer.tsx`
- `apps/web/src/lib/tarotDraw.ts`
- `apps/web/src/components/ritual/RitualView.tsx`

主要变化：

- 在 `/new` 增加“快速解读”按钮。
- 问题非空即可使用快速解读。
- 快速解读默认使用：
  - `agent_profile = lite`
  - `draw_source = digital_random`
  - 当前已选牌阵
  - 如果未选牌阵，则自动使用 `single`
- 快速解读会自动抽牌并直达 `/reading`，跳过 `/ritual` 与 `/reveal`。
- 快速解读复用重大现实决策确认弹窗；例如“我应该离婚吗？”必须先确认现实边界，再进入 reading。
- 抽牌逻辑抽成 `apps/web/src/lib/tarotDraw.ts`：
  - `shuffleTarotDeck`
  - `drawRandomCardForPosition`
  - `drawCardsForSpread`
- 快速模式与仪式模式共用同一抽牌 helper，保留唯一牌、不重复位置，以及约 20% 逆位规则。

### 3.2 结果页首屏速读

修改文件：

- `apps/web/src/components/reading/InterpretationView.tsx`

主要变化：

- 将结果页首屏重构为“核心速读”。
- 首屏展示：
  - 一句核心判断
  - 3 个关键词
  - 一个下一步行动
  - 一个不要过度相信的边界提醒
- 派生规则：
  - 核心判断优先从 `synthesis` 首句安全截取。
  - 截取失败时回退到 `themes` 组合。
  - 关键词来自 `themes`、牌面关键词、问题类型与牌阵名等现有上下文。
  - 行动来自 `reflective_guidance[0]`，失败时给出温和回退。
  - 边界提醒来自 `confidence_note`，失败时给出默认边界说明。

注意：

- 这些都是前端派生展示。
- 没有新增 reading API 字段。
- 没有把结构化 reading 折叠成一段不可检查长文。

### 3.3 三层可信路径

修改文件：

- `apps/web/src/components/reading/InterpretationView.tsx`

主要变化：

- 在首屏之后新增“可信路径”区块。
- 标题为“这不是神谕，是可检查的解释路径”。
- 分三层展示：
  - “你说了什么”：原问题、轻量问题类型、是否有延续线索。
  - “牌本身说了什么”：牌名、正逆位、位置、关键词，默认先展示前 3 张。
  - “如何连接二者”：`spreadExperience.readingMechanism`、`evidencePath` 与解释边界说明。
- 明确表达：这是解释推理，不是神谕裁决。

结果页层级调整为：

1. 核心速读
2. 可信路径
3. 逐牌展开
4. 综合深读
5. 反思指引 / 追问 / 安全说明 / 手记

保留既有反馈标签，包括“像模板 / 有点迎合”。

### 3.4 Playwright e2e 专用访问收口

修改文件：

- `apps/web/src/server/beta/access.ts`
- `apps/web/src/server/beta/access.spec.ts`
- `apps/web/src/app/api/reading/route.ts`
- `apps/web/playwright.config.ts`

问题背景：

- 用户手动登录后，Playwright 的 `request` fixture 和测试 browser context 不会继承该登录状态。
- 因此 `/api/reading` e2e contract smoke 在独立测试上下文中会返回 401。
- 后续即使绕过访问控制，测试用户如果是 `tester`，仍会进入 Supabase quota RPC；本地测试环境不应依赖真实 Supabase quota。

最终处理：

- 增加 e2e-only beta access bypass：
  - 环境变量：`AETHERTAROT_E2E_BYPASS_BETA_ACCESS=1`
  - 请求头：`x-aethertarot-e2e-access: 1`
- bypass 严格限制：
  - `process.env.NODE_ENV !== "production"`
  - production 下即使设置 env 或 header 也不会生效。
- Playwright 配置增加：
  - `extraHTTPHeaders: { "x-aethertarot-e2e-access": "1" }`
  - `webServer.env.AETHERTAROT_E2E_BYPASS_BETA_ACCESS = "1"`
- e2e bypass tester 使用 `admin` role：
  - 目的是复用现有 `shouldBypassReadingQuota()` 规则，避免 e2e 依赖真实 quota RPC。
  - 仍然只在非 production 且明确测试标记存在时生效。
- `/api/reading` 在 e2e bypass 请求下跳过 `recordReadingEvent`，避免 e2e 写真实 `reading_events` 或等待外部 Supabase。

补充单测：

- e2e bypass 在非 production + env 下生效。
- e2e bypass 在非 production + request trigger 下生效。
- production 下明确不生效。

### 3.5 e2e smoke 更新

修改文件：

- `apps/web/tests/smoke.spec.ts`
- `apps/web/src/components/encyclopedia/EncyclopediaView.tsx`

主要变化：

- 新增快速解读 smoke：
  - 未选牌阵时默认单牌。
  - 已选牌阵时尊重选择。
  - 重大现实决策问题仍先出现前置确认，reading 页仍触发 sober check。
  - 快速 reading 会写入 history。
- 更新完整仪式 e2e：
  - `/new -> /ritual -> /reveal -> /reading` 仍保持可用。
  - 断言从旧文案“证据路径”精确标签改为当前“可信路径”结构。
- 百科过滤测试：
  - 给运行时牌库网格增加 `data-testid="runtime-card-grid"`。
  - 断言只作用于牌库网格，不误伤右侧详情区域。
  - 使用 hydration 等待，避免 client handler 尚未接上时点击过滤按钮。
- follow-up 表单输入：
  - 将 `fill()` 改为按题号定位 textarea 后 `pressSequentially()`，避免 React 受控 textarea 在长流程里偶发状态未更新。

## 4. 文档更新

修改文件：

- `docs/10-product/ux-risk-status.md`
- `docs/20-domain/interpretation-framework.md`
- `docs/30-agent/output-schema.md`
- `docs/60-evals/rubrics.md`

记录内容：

- R3 “迎合错觉”从风险描述推进为机制化收口。
- 补充快速模式与深度仪式模式的评估口径。
- 说明首屏速读是前端派生展示，不是新增协议字段。
- 继续强调前端不得把结构化结果折叠成长文。
- 在评测 rubric 中加入：
  - 快速模式是否能 30 秒内给出有价值初读。
  - 可信路径是否把用户输入、牌面证据、解释推理分开。
  - 首屏是否包含行动与边界提醒。
  - 重大现实决策是否仍保留 sober / safety 边界。

## 5. 测试过程与失败排查

### 5.1 第一次 contract / build / lint

结果：

- `npm run test:contract -w @aethertarot/web` 通过。
- `npm run build -w @aethertarot/web` 通过。
- `npm run lint -w @aethertarot/web` 通过，但有 14 个 warning。

warning 概况：

- 多处 `<img>` 建议改用 `next/image`。
- `layout.tsx` 自定义字体 warning。
- `HomeView.tsx` 中存在一个 unused warning。

这些 warning 在本轮前已经存在或不属于本轮风险收口的阻断项，因此未顺手改动。

### 5.2 e2e 初始失败：401

现象：

- Playwright API contract smoke 从第三条起返回 401。
- 原因是 Playwright request fixture 不继承用户手动登录的浏览器 session。

处理：

- 增加 e2e-only beta access bypass。
- 后续发现 tester 仍会走 Supabase quota，于是将 e2e bypass tester 设为 admin，仅在非 production 测试标记下生效。

### 5.3 e2e 超时：现有 dev server 未带测试 env

现象：

- 用户已启动项目并登录。
- 直接跑 `npm run test:e2e -w @aethertarot/web` 时，Playwright 复用已有 3000 dev server。
- 该 server 没有 `AETHERTAROT_E2E_BYPASS_BETA_ACCESS`。
- 尝试在 3001 起第二个 Next dev server 失败，因为 Next 检测到同一 app 目录已有 dev server。

处理：

- 先增加 request header 触发 bypass，减少对启动 env 的依赖。
- 后续发现服务端 route 热更新不稳定，happy-path API 仍卡在外部依赖。
- 为完成测试，停掉当前仓库下 Next dev 进程，让 Playwright 自己按配置启动测试 server。
- 测试完成后，重新在 `http://127.0.0.1:3000` 启动 dev server，并确认 HEAD 返回 200。

### 5.4 e2e 旧文案断言失败

现象：

- 旧 smoke 仍找 `getByText("证据路径", { exact: true })`。
- 新 UI 中 `evidencePath` 是“如何连接二者”卡片里的段落，不再作为独立精确标签出现。

处理：

- 增加 `expectTrustPath()` helper。
- 统一断言：
  - “这不是神谕，是可检查的解释路径”
  - “你说了什么”
  - “牌本身说了什么”
  - “如何连接二者”
  - `/证据路径/`
  - `/逐牌顺序来自权威位置/`

### 5.5 e2e follow-up 输入偶发失败

现象：

- 第二个 follow-up textarea 有时填入成功，第一个仍停在空值，导致“生成整合深读”按钮保持 disabled。
- 原因是长流程中 `fill()` 与 React 受控 textarea 状态同步偶发不稳定。

处理：

- 改为按题号 label 精确定位 textarea。
- 使用 `pressSequentially()` 模拟真实键入路径。
- 后续完整 smoke 通过。

### 5.6 百科过滤测试失败

现象：

- 点击“宝剑 (14)”后，测试仍在 runtime grid 中找到“愚者”。
- 快照显示 filter button 已 active，但 grid 仍为全部 78 张。
- 原因是测试过早点击 client component，React click handler 尚未稳定接上。

处理：

- 百科页也使用 `gotoAppRoute()`，等待 hydration。
- 对 runtime grid 断言过滤后按钮数量为 14。
- 继续断言目标牌可见、非当前 suit 牌不存在。

## 6. 最终验证结果

最终执行：

```powershell
npm run test:contract -w @aethertarot/web
npm run test:e2e -w @aethertarot/web
npm run lint -w @aethertarot/web
npm run build -w @aethertarot/web
```

结果：

- Contract：8 个 test files，58 个 tests，全通过。
- E2E：27 个 tests，全通过。
- Lint：0 errors，14 warnings。
- Build：通过，Next.js production build 成功。

附加验证：

- 测试完成后重新启动本地 dev server。
- `http://127.0.0.1:3000` HEAD 返回 200。

## 7. 本轮触及文件清单

核心实现：

- `apps/web/src/lib/tarotDraw.ts`
- `apps/web/src/components/home/RitualInitializer.tsx`
- `apps/web/src/components/ritual/RitualView.tsx`
- `apps/web/src/components/reading/InterpretationView.tsx`

测试与测试支撑：

- `apps/web/tests/smoke.spec.ts`
- `apps/web/playwright.config.ts`
- `apps/web/src/server/beta/access.ts`
- `apps/web/src/server/beta/access.spec.ts`
- `apps/web/src/app/api/reading/route.ts`
- `apps/web/src/components/encyclopedia/EncyclopediaView.tsx`

文档：

- `docs/10-product/ux-risk-status.md`
- `docs/20-domain/interpretation-framework.md`
- `docs/30-agent/output-schema.md`
- `docs/60-evals/rubrics.md`

本工作日志：

- `docs/70-ops/ux-trust-risk-closeout-2026-04-27.md`

## 8. 需要后续注意的边界

- e2e bypass 是测试基础设施，不是产品能力。
- e2e bypass 必须继续保持 production 下无效。
- 快速解读不代表更轻的安全边界；重大现实决策、危机问题、健康/法律/财务边界仍由现有 safety/sober pipeline 控制。
- “核心速读”只是前端派生展示，不应被误认为新增协议字段。
- 可信路径应继续保持“用户输入 / 牌面证据 / 解释推理”分层，不应重新退化成单段神秘化长文。
- 当前 lint warning 未在本轮处理；后续若专门做性能或图片优化，可统一评估 `<img>` 到 `next/image` 的迁移成本。
