# 🔮 灵语塔罗 (AetherTarot Agent)

**基于长上下文、结构化输出与反思式解读的深度塔罗智能体**

![AetherTarot 宣传海报](docs/assets/aethertarot-poster.png)

AetherTarot 的目标不是生成“像塔罗的话”，而是构建一个**可解释、可追踪、可评测、可长期迭代**的塔罗 Agent。

---

## 🌟 项目愿景

不同于常见的逐牌堆砌式塔罗机器人，AetherTarot 试图把以下能力组合起来：

- 长上下文下的稳定问题理解
- 结合牌阵位置的整体综合
- 反思式、非断言式的表达方式
- 结构化输出与可回放历史
- 独立可审计的安全边界

产品定位不是“保证命中未来结果的预言系统”，而是“基于塔罗语义进行反思与叙事整理的智能体”。

---

## 📍 当前主线状态（2026-04-29）

项目已经进入“主链已成、运行时牌池完整、第一轮内测风控已接入、UX 信任风险继续收口”的阶段。

知识层现状：

- 78/78 牌义页已完成
- 10 张概念页已完成
- 9 张牌阵页已完成

运行时数据 / 资产现状：

- `data/decks/rider-waite-smith.json` 当前包含 78 张运行时牌：完整 Rider-Waite-Smith 运行时牌池已接入
- `apps/web/public/cardsV2/` 当前包含 79 个运行时文件：78 张正面牌面与 1 张背面；旧 `apps/web/public/cards/` 暂时保留但不再作为当前 runtime `imageUrl` 来源
- `data/decks/card-asset-manifest.json` 记录资产来源、full-bleed 审核状态与 SHA-256
- 知识层 78/78 与运行时牌池 78/78 现已对齐；当前 Runtime Alignment 的剩余问题不再是牌义卡缺口，而是牌阵上线顺序、百科消费策略与长期连续性设计

当前主线：

1. Reading 主链：`M1` Real Reading API、`M2` Structured Reading Schema、`M3` Minimal LangGraph 与 Dual-Tier Safety 已完成，并保持单一 `/api/reading` contract。
2. Runtime / UX 主线：5 个运行时牌阵已进入差异化前台机制与 provider / prompt spread-specific axis；快速解读、核心速读与三层可信路径已接入。
3. Beta Ops 主线：Supabase 登录、邮箱白名单、admin 权限、reading quota、LLM 成本预算、reading events 与 reading feedback 已接入第一轮内测闭环。
4. Memory / Persistence 主线：`session_capsule`、本地 history、future thread/session 与 long-term memory 边界已由 ADR-0004 和 P2 roadmap 收紧；服务端 persistence 与 memory merge 继续暂缓。

`2026-04-09` 至 `2026-04-29` 同步确认的关键收口包括：

- 引入 `ADR-0002` Dual-Tier Safety Escalation
- 在正式输出协议中稳定纳入 `sober_check` 与 `presentation_mode`
- 将现有 reading service pipeline 接入最小 LangGraph，并保持 `/api/reading` 协议不变
- 完成 Web CI / Playwright / lockfile 的一轮系统排障
- 完成首轮本地卡牌 PNG 注入、manifest 记录与 1:1.7 渲染规范化，并扩展到当前 78 张正面牌面
- 将运行时牌组从早期示例牌扩展到当前 78 张，并将当前 runtime imageUrl 切到 `/cardsV2/...`
- `npm run test:contract -w @aethertarot/web` 当前复核通过（74 个 tests），`npm run test:e2e -w @aethertarot/web` 当前复核通过（32 个 tests），`npm run lint -w @aethertarot/web` 当前通过（0 errors / 12 warnings），`npm run build -w @aethertarot/web` 当前通过
- Web CI 已把 `test:contract` 纳入 lint/build job；本地 Node.js 基线通过 `.nvmrc` 固定为 `20.19.0`，与 CI 一致
- 生产环境缺少 `AETHERTAROT_IP_HASH_SALT` 时不再回退到开发默认 salt；非 production 仍保留 dev fallback 方便本地调试
- 已把 hard-stop 示例资源替换为中国大陆固定的真实危机 / 心理支持入口，并把 incoming `prior_session_capsule` 的高风险细节净化接入回归
- `/new` 已新增快速解读入口：未选牌阵时默认单牌启示，已选牌阵时尊重当前牌阵，使用 `lite` profile 自动抽牌并直达 `/reading`
- `/reading` 已新增核心速读与三层可信路径：从既有字段派生首屏摘要，并区分“用户输入 / 牌面线索 / 解释连接”
- `/api/reading` 已接入 Supabase session、`beta_testers` 白名单、邮箱/IP/全局 LLM 成本 quota、admin quota bypass 与 reading event 观测
- `/encyclopedia` 已新增第一版塔罗百科 Agent：从 `knowledge/wiki` 检索牌义 / 概念 / 牌阵来源，经独立 `/api/encyclopedia/query` 返回带来源的百科问答，不改变 `/api/reading` 与 `StructuredReading`
- `/admin` 与 `/api/admin/*` 当前只允许 `role = admin`
- OpenAI-compatible `llm` baseline 当前第一轮内测默认使用 DashScope `qwen3.6-flash`，真实 key 通过服务端环境变量引用
- 当前运行时牌阵为 `single`、`holy-triangle`、`four-aspects`、`seven-card`、`celtic-cross`

换句话说，当前瓶颈已经不再是“缺更多知识”，而是：

- 如何在回归链路已恢复后继续保持 E2E、contract 与文档系统跟随实物状态演进
- 如何在最小 LangGraph 已接入后继续保持 contract 稳定、为后续 provider / memory 扩展留出边界
- 如何观察快速路径、核心速读和三层可信路径是否真正降低等待成本与迎合错觉
- 如何让第一轮内测风控、观测与反馈数据继续服务真实质量改进
- 如何在牌池已完整后继续收口高价值牌阵、百科消费路径与长期连续性能力，而不混淆知识层和运行时层

---

## 🛠 当前运行时架构

### `apps/web`

唯一活跃应用，承载：

- 首页 / 抽牌 / reveal / reading / history / encyclopedia 页面
- 轻量 BFF Route：`POST /api/reading`
- 独立百科问答 Route：`POST /api/encyclopedia/query`
- Supabase magic-link 内测登录、admin 观测台、reading feedback
- 本地结构化 history 回放

### `packages/domain-tarot`

运行时塔罗数据访问层，负责从 `data/` 读取权威牌组与牌阵资产。

### `packages/prompting`

当前 placeholder provider 与 llm prompt builder 的结构化解读生成逻辑。

### `packages/shared-types`

reading request / response、history 与塔罗基础实体的共享类型。

### `knowledge/`

知识编译层，沉淀牌义、概念、牌阵等 wiki 页面。

### `docs/`

项目真相层，记录产品目标、架构边界、输出协议、安全原则与评测标准。

---

## 🚀 当前能力边界

已具备：

- 单牌、圣三角、四个面向、七张牌、赛尔特十字牌阵
- 结构化 reading API
- 最小 LangGraph reading 编排
- 结构化结果页与本地历史回放
- Dual-Tier Safety Escalation（`403 Hard Stop` / `200 Sober Check`）
- `sober_check` 与 `presentation_mode` 已进入正式输出协议
- 生成前危机转介、incoming capsule 安全净化、生成后安全检查与 `safety_note`
- 默认 `placeholder` provider 与可选 OpenAI-compatible `llm` baseline
- 快速解读路径、完整仪式路径、核心速读与三层可信路径
- 第一轮内测访问控制、quota、LLM 成本预算、reading events 与 feedback
- 第一版塔罗百科 Agent：`knowledge/wiki` 检索 + OpenAI-compatible LLM 生成带来源回答，独立于 reading 主链
- 78 张运行时牌与 79 个 `cardsV2` 本地卡牌文件，均按竖版规范接入

当前不做：

- 多 Provider Router / 多模型分层
- 独立 `apps/api`
- 独立 `agent-core` 服务
- LangGraph 复杂图
- 服务端 reading 持久化
- 默认启用真实外部 tester 邮件；本地 magic-link 仍进入 Mailpit
- 在当前阶段重新打开“大规模继续扩知识页”作为默认主线
- 把当前 UX 主线视为已收口；仍在持续处理 `docs/10-product/ux-risk-status.md` 中的剩余风险

---

## 📂 目录结构

```text
AetherTarot/
├─ README.md
├─ AGENTS.md
├─ .agents/
│  └─ skills/
├─ docs/
├─ knowledge/
├─ data/
├─ apps/
│  └─ web/
├─ packages/
│  ├─ shared-types/
│  ├─ domain-tarot/
│  └─ prompting/
├─ scripts/
├─ prototype/
├─ external/
├─ .github/
└─ memory/
```

仓库内的 repo-local skills 统一放在 `.agents/skills/`；这是当前唯一的 canonical skill root。

如需新增、迁移或维护 repo-local skills，先读 `docs/00-overview/repo-local-skills.md`。

---

## 🧭 推荐阅读顺序

进入仓库后，优先阅读：

1. `README.md`
2. `AGENTS.md`
3. `docs/00-overview/project-map.md`
4. `docs/20-domain/reading-contract.md`
5. `docs/20-domain/interpretation-framework.md`
6. `docs/30-agent/output-schema.md`
7. `docs/40-architecture/architecture.md`
8. `docs/50-safety/safety-principles.md`

如果你要做 Web UI / UX，再补读：

- `DESIGN.md`
- `docs/10-product/ux-risk-status.md`

如果你要继续主线推进，再看：

- `memory/mainline-priority-plan-2026-04-08.md`
- `memory/current-status-and-priority-2026-04-15.md`
- `memory/SESSION_INDEX.md`

## 🧾 真相源约定

为防止文档漂移，当前按下面的粒度理解仓库文档：

- `README.md`：高层总览，用于快速知道项目是什么、当前大概在哪个阶段。
- `docs/`：稳定规则与边界真相层。涉及 reading contract、输出协议、安全、架构、评测时，以这里为准。
- `memory/`：最新执行状态、阶段性计划与共享 work log。涉及“现在做到哪了 / 下一步做什么”时，以这里为准。

推荐状态入口：

- `memory/current-status-and-priority-2026-04-15.md`
- `memory/mainline-priority-plan-2026-04-08.md`
- `memory/work-log-2026-04-27-beta-ops-local-supabase.md`
- `docs/70-ops/ux-trust-risk-closeout-2026-04-27.md`
- `memory/SESSION_INDEX.md`

---

## 📝 开发原则

- 规则外部化：不要把业务真相只藏在 prompt 中
- 文档先行：改核心逻辑前先对齐 docs / ADR
- 安全独立：安全边界必须可单独审计与回归
- 输出稳定：前端、history、评测共享同一套 reading schema
- 先闭环再扩张：优先让已有知识真正进入运行时

---

## 🤝 说明

本项目仅用于 AI 技术交流与学习。塔罗解读用于反思与启发，不替代医疗、法律、财务或其他专业建议。
