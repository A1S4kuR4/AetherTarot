# AetherTarot Web

`apps/web` 是 AetherTarot 的 Next.js App Router 前端骨架，负责承载完整的占卜流程页面：

- `/` 提问与牌阵选择
- `/ritual` 洗牌与抽牌
- `/reveal` 展示抽到的牌
- `/reading` 展示 mock 解读结果
- `/history` 查看本地历史记录
- `/encyclopedia` 浏览静态塔罗百科

## State Flow

跨路由状态由 `ReadingContext` 管理，包含问题、牌阵、抽牌结果、解读文本、加载状态和本地历史。

- 历史记录沿用 `aether_tarot_history` localStorage 键
- `/api/reading` 当前返回 mock Markdown 解读
- 尚未接入真实 LangGraph、DeepSeek 或 Claude

## Supabase Skeleton

仓库保留了 Supabase 的浏览器端、服务端和请求前 session refresh 骨架。

- 运行期入口使用 `src/proxy.ts`
- 这是因为当前项目基于 Next.js 16，`middleware` 已更名为 `proxy`
- 如果未配置 `NEXT_PUBLIC_SUPABASE_URL` 与 `NEXT_PUBLIC_SUPABASE_ANON_KEY`，应用仍可正常启动
