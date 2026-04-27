# 项目地图（Project Map）

## 1. 文档目的

本文件用于帮助新成员或代码 Agent 快速理解：

- 这个项目的目标是什么
- 哪些文档是“必须先读”的
- 不同目录分别负责什么
- 当你要修改某类能力时，应先查看哪些资料

---

## 2. 阅读顺序建议

### 面向所有贡献者

1. `README.md`
2. `AGENTS.md`
3. `docs/10-product/vision.md`
4. `docs/10-product/risk-list.md`
5. `docs/20-domain/reading-contract.md`
6. `docs/20-domain/interpretation-framework.md`

补充约定：

- `README.md` 用于快速建立项目全貌，不应单独作为“最新执行状态”的唯一依据。
- 若你需要判断“现在做到哪了 / 下一步做什么”，应继续查看 `memory/current-status-and-priority-2026-04-15.md` 与 `memory/SESSION_INDEX.md`。
- 若你需要判断“什么是稳定规则”，应优先以 `docs/` 与 ADR 为准，而不是以 `memory/` 的阶段性叙述为准。

### 面向 Agent / Prompt / Memory 相关开发

1. `docs/30-agent/context-strategy.md`
2. `docs/30-agent/output-schema.md`
3. `docs/30-agent/reading-flow.md`
4. `docs/30-agent/langgraph-reading-workflow.md`
5. `docs/40-architecture/architecture.md`
6. `docs/30-agent/provider-prompt-contract.md`
7. `docs/80-decisions/adr/0004-memory-and-persistence-boundaries.md`
8. `docs/30-agent/memory-persistence-roadmap.md`
9. `docs/30-agent/thread-session-rfc.md`
10. `docs/00-overview/repo-local-skills.md`

### 面向 UI / 前端 / 体验开发

1. `DESIGN.md`
2. `docs/10-product/ux-risk-status.md`
3. `docs/80-decisions/adr/0003-trinity-spatial-architecture.md` (必读：了解三权分立架构)
4. `docs/30-agent/output-schema.md`

### 面向安全与评测

1. `docs/50-safety/safety-principles.md`
2. `docs/80-decisions/adr/0002-dual-tier-safety-escalation.md`
3. `docs/60-evals/rubrics.md`

### 面向产品风险 / UX 评审

1. `docs/10-product/risk-list.md`
2. `docs/10-product/ux-risk-status.md`

---

## 3. 仓库职责分层

### `docs/`

项目真相层。记录产品目标、领域规则、架构边界、安全原则、评测标准与决策历史。

推荐理解：

- `docs/` 回答“长期应该怎么做、边界是什么”。
- 如果 `memory/` 的阶段性描述与 `docs/` 的稳定规则冲突，应优先回到 `docs/` / ADR 校正。

### `memory/`

过程记忆层。用于保存阶段性工作日志、优先级计划、里程碑健康度、会话索引与短期 backlog。

约束：

- `memory/` 记录“当时发生了什么”
- `docs/` 记录“以后应该查什么”
- 重要规则、长期可复用方案与稳定边界，不应只留在 `memory/`，必须沉淀到 `docs/`

当前入口约定：

- `memory/current-status-and-priority-2026-04-15.md`：当前状态与下一步优先级桥接入口
- `memory/mainline-priority-plan-2026-04-08.md`：主线推进关系与里程碑状态
- `memory/work-log-2026-04-27-beta-ops-local-supabase.md`：第一轮内测访问控制、quota、admin、观测、本地 Supabase 与 LLM provider baseline 收口
- `docs/70-ops/ux-trust-risk-closeout-2026-04-27.md`：快速解读、核心速读、三层可信路径与 e2e-only beta access bypass 的收口记录
- `memory/SESSION_INDEX.md`：`memory/` 导航入口

### `knowledge/`

知识编译层。用于沉淀塔罗牌义、牌阵、象征体系、语义结构与综合主题。

### `apps/`

应用层。当前以 `apps/web` 为唯一活跃应用，承载前台与轻量 BFF 路由；`prototype/` 已冻结，不再作为主开发入口。

当前 Web 主流程路由语义约定：

- `/`：Narrative Hub，负责品牌叙事、教育与意图校准
- `/new`：Ritual Initializer，负责提问、选择牌阵与选择塔罗师
- `/ritual`：Ritual Draw Stage，负责正式洗牌、抽牌与进入揭示前的仪式过程
- `/reveal`：Spread Reveal，负责先看整组牌面与位置关系
- `/reading`：Interpretation，负责 initial / final 两阶段解读与安全摩擦
- `/journey`：Consciousness Archive，当前主历史与复访入口
- `/history`：保留的历史列表页，不作为当前主叙事入口
- `/encyclopedia`：Tarot Encyclopedia，负责牌义浏览、百科覆盖与知识检索入口

### `prototype/`

历史原型层。保留 AI Studio / Vite 原型作为迁移参考，不参与当前 workspace，不作为新功能开发入口。

### `packages/`

复用模块层。当前迁移重点为 `shared-types`、`domain-tarot` 与 `prompting`，用于承载共享类型、塔罗运行时数据访问与 placeholder 结构化解读生成逻辑。

### `docs/60-evals/`

评测标准层。当前以 `docs/60-evals/rubrics.md` 维护质量与安全评测标准；仓库尚未建立独立根级 `evals/` 资产目录。

### `data/`

运行时数据层。用于放置首轮上线所需的牌组与牌阵 JSON 资产，作为当前权威运行时数据来源。

### `scripts/`

仓库级脚本层。当前用于生成与校验运行时卡牌资产，例如 `generate-card-assets.mjs` 与 `validate-card-assets.mjs`。运行时牌面资产的操作说明见 `docs/70-ops/card-asset-generation.md`。

### `.github/`

CI 配置层。当前维护 Web CI workflow，覆盖依赖安装、资产校验、lint、build 与 Playwright smoke tests。

### `.agents/skills/`

仓库内 repo-local skills / agent workflows 的统一位置。用于封装 ingest、prompt 修订、评测归类、写 ADR 等技能。

### `external/`

外部参考层。当前保留 `langchain-skills` 作为上游参考源，不作为 AetherTarot 的 canonical skill root。

---

## 4. 常见任务导航

### 我想修改牌义解释方式

先读：

- `docs/20-domain/interpretation-framework.md`
- `docs/20-domain/reading-contract.md`
- `docs/60-evals/rubrics.md`

### 我想改多轮会话记忆

先读：

- `docs/30-agent/context-strategy.md`
- `docs/40-architecture/architecture.md`
- `docs/80-decisions/adr/0004-memory-and-persistence-boundaries.md`
- `docs/30-agent/memory-persistence-roadmap.md`
- `docs/30-agent/thread-session-rfc.md`
- 相关 ADR

### 我想调整输出格式

先读：

- `docs/30-agent/output-schema.md`
- `docs/60-evals/rubrics.md`

### 我想理解当前 LangGraph reading 工作流

先读：

- `docs/30-agent/reading-flow.md`
- `docs/30-agent/langgraph-reading-workflow.md`
- `docs/30-agent/provider-prompt-contract.md`
- `docs/40-architecture/architecture.md`

### 我想处理敏感场景或危机话题

先读：

- `docs/50-safety/safety-principles.md`
- `docs/20-domain/reading-contract.md`
- `docs/80-decisions/adr/0002-dual-tier-safety-escalation.md`

### 我想了解当前设计系统

先读：

- `DESIGN.md`
- `docs/10-product/ux-risk-status.md`

### 我想评估当前产品风险或 UX 是否成立

先读：

- `docs/10-product/risk-list.md`
- `docs/10-product/ux-risk-status.md`
- `docs/10-product/vision.md`

### 我想知道“当前真实状态”和“下一步该做什么”

先读：

- `memory/current-status-and-priority-2026-04-15.md`
- `memory/work-log-2026-04-27-beta-ops-local-supabase.md`
- `docs/70-ops/ux-trust-risk-closeout-2026-04-27.md`
- `memory/mainline-priority-plan-2026-04-08.md`
- `memory/SESSION_INDEX.md`

### 我想排查 CI 问题

先读：

- `docs/70-ops/github-ci-troubleshooting-2026-04-09.md`
- `docs/70-ops/dev-setup.md`

### 我想排查前端图标显示成英文单词的问题

先读：

- `docs/70-ops/frontend-icon-rendering-regression.md`

### 我想新增或迁移 repo-local skill

先读：

- `docs/00-overview/repo-local-skills.md`
- `AGENTS.md`

---

## 5. 维护要求

- 新增重要文档时，更新本文件的目录导航。
- 新增重要系统决策时，补充 `docs/80-decisions/adr/`。
- 目录或命名规则变化时，优先更新本文件。
- 若 README、`docs/` 与 `memory/` 同时提到“当前状态”，应显式写清各自的粒度：
  - README：高层总览
  - `docs/`：稳定规则与边界
  - `memory/`：最新执行状态与阶段性计划
