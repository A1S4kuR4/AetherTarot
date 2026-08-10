# AetherTarot Agent

AetherTarot 是一个以结构化输出、安全边界和 Next.js 阅读体验为核心的反思式塔罗智能体项目。

本项目的目标不是提供确定性预言，而是把塔罗作为一种叙事与反思界面：用户的问题会被放入牌阵位置、牌面证据、综合推断和温和的行动提示中理解。

## 在线体验

生产内测入口：[https://aethertarot.cn/](https://aethertarot.cn/)

免费内测期间，游客按 IP hash 每日可完成 3 次完整解读；日常/深度模式的合法追问整合不重复扣减日额度。已登录用户通过邀请制 Credentials 流程管理，具体额度仍由运行时服务控制。

## 仓库内容

- `apps/web`：当前唯一活跃的 Next.js 应用，包含 reading 流程、百科、历史、登录、后台和 API routes。
- `packages/domain-tarot`：运行时塔罗牌组与牌阵访问层。
- `packages/prompting`：结构化解读的 prompt 与 provider 组装逻辑。
- `packages/shared-types`：reading、history、card、spread 等共享类型契约。
- `knowledge`：受治理的运行时塔罗知识，用于百科和检索路径。
- `data`：应用消费的牌组与牌阵源数据。
- `scripts`：仓库维护和资产校验脚本。
- `.agents/skills`：可公开分享的 repo-local agent skills，包括 AetherTarot 业务边界技能与受 `DESIGN.md` 约束的 UI/设计工作流。

本地计划、运维 work log、生成报告、scratch 文件、私有部署说明和长篇内部文档不会进入公开仓库。

## 当前能力

当前应用支持：

- 单牌、圣三角、四个面向、七张牌、赛尔特十字牌阵
- 通过 `/api/reading` 返回结构化 reading 输出
- 登录用户按 `{ user_id, thread_id }` 持久化受限的 thread 级短期摘要，并支持显式清除
- 对高风险或决策外包问题提供安全阻断与 sober-check 响应
- 快速解读路径与完整仪式路径
- 线下抽牌后手动录入实体牌面
- 本地历史回放与账号级 completed reading 存储
- 基于 `knowledge/wiki` 的塔罗百科浏览
- 解读结果分享卡片（图片生成与系统分享，sober-check 下禁用摘要分享）
- 通过服务端环境变量启用可选的 OpenAI-compatible LLM provider
- 邀请制内测访问、额度控制、telemetry 与轻量反馈

当前应用不包含：

- 公开自助注册
- Supabase Auth magic-link 登录
- 长期用户画像或 memory merge
- LangGraph session/checkpoint 过程持久化（不包括已上线的账号级 thread 摘要）
- 支付、订阅或公开账号管理

## 应用结构

```text
AetherTarot/
├─ apps/
│  └─ web/
├─ packages/
│  ├─ domain-tarot/
│  ├─ prompting/
│  └─ shared-types/
├─ data/
├─ knowledge/
├─ scripts/
├─ prototype/
├─ external/
├─ .agents/
│  └─ skills/
├─ .github/
├─ AGENTS.md
├─ DESIGN.md
└─ README.md
```

当前运行时位于 `apps/web`。主要页面与路由包括：

- `/`：入口与回访用户 journey
- `/new`：问题输入、塔罗师 / 抽牌方式与牌阵选择
- `/ritual`：洗牌与抽牌交互
- `/offline-draw`：线下洗牌后手动录入实体牌面
- `/reveal`：牌面揭示
- `/reading`：结构化解读结果页
- `/quick-reading`：单牌快速解读（lite profile 专用路径）
- `/journey`：completed reading 历史回放主入口
- `/history`：保留的历史列表页（非当前主叙事入口）
- `/encyclopedia`：塔罗知识百科
- `/login`：邀请制 Credentials 登录
- `/admin`：admin 用户的内测观测台

## 开发

在仓库根目录执行 workspace 脚本：

```powershell
npm ci
npm run dev -w @aethertarot/web
npm run test:contract -w @aethertarot/web
npm run lint -w @aethertarot/web
npm run build -w @aethertarot/web
```

`npm run dev -w @aethertarot/web` 默认进入 `local-only` 模式：不要求安装或启动
Supabase 本地栈，使用非 production 的固定 admin 测试身份，并关闭 Supabase 与外部
LLM 调用。完整边界与检查清单见 `docs/70-ops/dev-setup.md`。

端到端检查：

```powershell
npm run test:e2e -w @aethertarot/web
```

## 公开仓库边界

不要提交 secrets、环境变量文件、测试账号凭据、私有部署细节、生成报告、scratch 实验或本地 work log。

公开仓库只保留产品运行时代码和受治理的运行时知识。私人项目笔记与操作者流程应保留在本地。

## 免责声明

AetherTarot 仅用于 AI 产品探索与反思式娱乐。塔罗解读不能替代医疗、法律、财务、心理或其他专业建议。
