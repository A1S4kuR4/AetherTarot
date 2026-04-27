# AetherTarot Web

`apps/web` 是 AetherTarot 当前唯一活跃应用。它基于 Next.js App Router，负责承载完整的阅读流程、轻量 BFF Route 与本地历史回放。

- `/` 回访入口；有本地历史时进入 `JourneyView`，否则进入首次提问流程
- `/new` 提问与牌阵选择，并在存在 continuity source 时显示“延续中的线索”提示
- `/ritual` 洗牌与抽牌
- `/reveal` 展示抽到的牌
- `/reading` 展示结构化解读结果、`sober_check` 摩擦与安全阻断状态
- `/history` 查看本地历史记录，并支持“回看这次解读”与“延续这条线”两个分离动作
- `/encyclopedia` 浏览静态塔罗百科
- `/api/reading` 轻量 BFF Route，返回 `StructuredReading` 或结构化错误 payload
- `/login` Supabase magic-link 内测登录
- `/admin` 第一轮内测最小观测台，仅 `beta_testers.role = admin` 可访问

## State Flow

跨路由状态由 `ReadingContext` 管理，包含问题、牌阵、抽牌结果、结构化 reading、加载状态、安全拦截状态、本地历史以及显式 opt-in 的 continuity source。

- 历史记录使用 `aether_tarot_history_v2` localStorage 键
- 历史条目保存 `ReadingHistoryEntry`：`reading`、`drawnCards`、`spreadId`、`createdAt` 与可选 `user_notes`
- completed reading 现在会在 `reading.session_capsule` 中保存紧凑摘要；旧历史记录继续兼容 `session_capsule = null`
- continuity source 独立于 history replay：用户可从 `/history` 或 `/journey` 显式选择“延续这条线”，把上一轮 `session_capsule` 挂入下一轮请求的 `prior_session_capsule`
- `/api/reading` 成功时返回 `StructuredReading`，不再返回 markdown-only 文本
- Tier 1 安全阻断返回 `403 safety_intercept`，前端写入 `safetyIntercept` 并展示不可绕过的界限面板
- Tier 2 决策外包场景返回 `200`，payload 中包含 `sober_check` 与 `presentation_mode = "sober_anchor"`
- 当前已接入最小 LangGraph reading 编排；仍未接入 DeepSeek、Claude 或其他外部 LLM provider

## Supabase Skeleton

仓库使用 Supabase 承载第一轮内测的 session、邮箱白名单、quota 与观测数据。

- 运行期入口使用 `src/proxy.ts`
- 这是因为当前项目基于 Next.js 16，`middleware` 已更名为 `proxy`
- 如果未配置 `NEXT_PUBLIC_SUPABASE_URL` 与 `NEXT_PUBLIC_SUPABASE_ANON_KEY`，页面仍可启动，但 `/api/reading` 会拒绝内测调用
- `/api/reading` 还需要 `SUPABASE_SERVICE_ROLE_KEY`、`beta_testers` 白名单和 `consume_reading_quota` RPC
- schema 位于 `supabase/migrations/202604270001_beta_ops.sql`
- 本地 Supabase 端口使用 `55421` 到 `55429`，避免 Windows/WSL 保留 `5432x` 端口导致浏览器无法连接 Auth
- 本地 magic-link 邮件进入 Mailpit：`http://127.0.0.1:55424`
