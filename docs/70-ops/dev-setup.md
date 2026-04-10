# 开发环境与协作流程（Dev Setup）

## 1. 文档目的

本文件定义当前 AetherTarot 的本地开发、验证与协作约定，帮助人类开发者与代码 Agent 以一致方式工作。

---

## 2. 当前工具链

- 包管理：根目录 `npm workspaces`
- CI Node.js 基线：`20.19.0`
- 活跃应用：`apps/web`
- 前端框架：Next.js 16 App Router + React 19
- 样式链路：Tailwind CSS 4 / PostCSS
- E2E：Playwright Chromium
- 共享包：`packages/shared-types`、`packages/domain-tarot`、`packages/prompting`
- 运行时数据：`data/decks/` 与 `data/spreads/`
- 当前后端入口：`apps/web/src/app/api/reading/route.ts` 轻量 BFF Route
- 当前 provider：`placeholder`，已接入最小 LangGraph 编排，尚未接入外部 LLM

---

## 3. 常用命令

从仓库根目录执行：

```powershell
npm install
npm run build
npm run test:e2e
npm run validate:assets
npm run generate:assets
```

Web workspace 专用命令：

```powershell
npm run dev -w @aethertarot/web
npm run lint -w @aethertarot/web
npm run build -w @aethertarot/web
npm run test:e2e -w @aethertarot/web
```

注意：

- `npm run build` 是根命令，会转发到 `@aethertarot/web`。
- `npm run test:e2e` 是根命令，会转发到 Web Playwright 测试。
- `npm run validate:assets` 会校验运行时卡牌 JSON、图片存在性、尺寸、manifest hash 与 full-bleed 审核字段。
- 本地排查 CI 时优先顺序执行 lint / build / e2e，不建议并行跑 Playwright 与其他会清理测试目录的命令。

---

## 4. 环境变量

`apps/web/.env.local.example` 提供当前 Web 应用的环境变量示例。

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Supabase 当前只是骨架能力；未配置这些变量时，应用仍可启动。

可选 provider 配置：

- `AETHERTAROT_READING_PROVIDER=placeholder`

当前唯一可用 provider 是 `placeholder`。配置为其他值会返回 `provider_unavailable`。

---

## 5. 建议协作流程

### 新功能开发

1. 明确需求边界
2. 先补充或更新相关文档
3. 如涉及重大方案变更，先写 ADR
4. 再进行代码实现
5. 最后补充评测与回归记录

### 修改提示词/Agent 逻辑

1. 更新 `docs/30-agent/` 相关文档
2. 更新 `docs/60-evals/rubrics.md` 中相关标准（如有必要）
3. 运行回归用例
4. 记录失败模式

### 修改安全相关逻辑

1. 先检查 `docs/50-safety/safety-principles.md`
2. 同步检查 `docs/20-domain/reading-contract.md` 与 `docs/60-evals/rubrics.md`
3. 必要时新增 ADR
4. 补充安全专项样例

---

## 6. 分支与提交建议

- feat/*：新功能
- fix/*：问题修复
- docs/*：文档更新
- eval/*：评测资产更新
- chore/*：基础设施与杂项

提交信息建议清楚表达：

- 修改了什么
- 为什么改
- 是否影响输出协议/安全/评测

---

## 7. 待补充

- [ ] 部署流程
- [ ] 外部 LLM provider 接入后的运行说明
- [ ] 复杂 graph / 外部 provider 接入后的本地调试说明
