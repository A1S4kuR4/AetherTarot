# AetherTarot Web

`apps/web` 是 AetherTarot 当前唯一活跃应用。它基于 Next.js App Router，负责承载完整的阅读流程、轻量 BFF Route 与本地历史回放。

- `/` 回访入口；有本地历史时进入 `JourneyView`，否则进入首次提问流程
- `/new` 提问与牌阵选择
- `/ritual` 洗牌与抽牌
- `/reveal` 展示抽到的牌
- `/reading` 展示结构化解读结果、`sober_check` 摩擦与安全阻断状态
- `/history` 查看本地历史记录
- `/encyclopedia` 浏览静态塔罗百科
- `/api/reading` 轻量 BFF Route，返回 `StructuredReading` 或结构化错误 payload

## State Flow

跨路由状态由 `ReadingContext` 管理，包含问题、牌阵、抽牌结果、结构化 reading、加载状态、安全拦截状态和本地历史。

- 历史记录使用 `aether_tarot_history_v2` localStorage 键
- 历史条目保存 `ReadingHistoryEntry`：`reading`、`drawnCards`、`spreadId`、`createdAt` 与可选 `user_notes`
- `/api/reading` 成功时返回 `StructuredReading`，不再返回 markdown-only 文本
- Tier 1 安全阻断返回 `403 safety_intercept`，前端写入 `safetyIntercept` 并展示不可绕过的界限面板
- Tier 2 决策外包场景返回 `200`，payload 中包含 `sober_check` 与 `presentation_mode = "sober_anchor"`
- 当前已接入最小 LangGraph reading 编排；仍未接入 DeepSeek、Claude 或其他外部 LLM provider

## Supabase Skeleton

仓库保留了 Supabase 的浏览器端、服务端和请求前 session refresh 骨架。

- 运行期入口使用 `src/proxy.ts`
- 这是因为当前项目基于 Next.js 16，`middleware` 已更名为 `proxy`
- 如果未配置 `NEXT_PUBLIC_SUPABASE_URL` 与 `NEXT_PUBLIC_SUPABASE_ANON_KEY`，应用仍可正常启动
