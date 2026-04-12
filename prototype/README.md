# AetherTarot Prototype

`prototype/` 是早期 AI Studio / Vite 原型的冻结目录，仅保留为历史参考。

当前主开发入口是 `apps/web`。新功能、样式调整、reading API、history、safety 或运行时数据接入都不应继续写回 `prototype/`。

## Legacy Run Notes

如果确实需要回看旧原型行为，可按原 Vite 项目方式运行：

```powershell
npm install
npm run dev
```

旧原型依赖 `GEMINI_API_KEY`，但这不代表当前 AetherTarot 运行时已经接入 Gemini 或其他外部 LLM provider。

## Boundary

- 不属于根 `npm workspaces`
- 不参与 Web CI
- 不作为设计系统、API contract 或安全边界的事实来源
- 只用于理解早期迁移背景
