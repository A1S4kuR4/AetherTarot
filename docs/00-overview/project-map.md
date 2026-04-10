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

### 面向 Agent / Prompt / Memory 相关开发

1. `docs/30-agent/context-strategy.md`
2. `docs/30-agent/output-schema.md`
3. `docs/40-architecture/architecture.md`
4. `docs/30-agent/provider-prompt-contract.md`
5. `docs/00-overview/repo-local-skills.md`

### 面向 UI / 前端 / 体验开发

1. `DESIGN.md`
2. `docs/10-product/ux-risk-status.md`
3. `docs/30-agent/output-schema.md`

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

### `memory/`

过程记忆层。用于保存阶段性工作日志、优先级计划、里程碑健康度、会话索引与短期 backlog。

约束：

- `memory/` 记录“当时发生了什么”
- `docs/` 记录“以后应该查什么”
- 重要规则、长期可复用方案与稳定边界，不应只留在 `memory/`，必须沉淀到 `docs/`

### `knowledge/`

知识编译层。用于沉淀塔罗牌义、牌阵、象征体系、语义结构与综合主题。

### `apps/`

应用层。当前以 `apps/web` 为唯一活跃应用，承载前台与轻量 BFF 路由；`prototype/` 已冻结，不再作为主开发入口。

### `prototype/`

历史原型层。保留 AI Studio / Vite 原型作为迁移参考，不参与当前 workspace，不作为新功能开发入口。

### `packages/`

复用模块层。当前迁移重点为 `shared-types`、`domain-tarot` 与 `prompting`，用于承载共享类型、塔罗运行时数据访问与 placeholder 结构化解读生成逻辑。

### `docs/60-evals/`

评测标准层。当前以 `docs/60-evals/rubrics.md` 维护质量与安全评测标准；仓库尚未建立独立根级 `evals/` 资产目录。

### `data/`

运行时数据层。用于放置首轮上线所需的牌组与牌阵 JSON 资产，作为当前权威运行时数据来源。

### `scripts/`

仓库级脚本层。当前用于生成与校验运行时卡牌资产，例如 `generate-card-assets.mjs` 与 `validate-card-assets.mjs`。

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
- 相关 ADR

### 我想调整输出格式

先读：

- `docs/30-agent/output-schema.md`
- `docs/60-evals/rubrics.md`

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

### 我想排查 CI 问题

先读：

- `docs/70-ops/github-ci-troubleshooting-2026-04-09.md`
- `docs/70-ops/dev-setup.md`

### 我想新增或迁移 repo-local skill

先读：

- `docs/00-overview/repo-local-skills.md`
- `AGENTS.md`

---

## 5. 维护要求

- 新增重要文档时，更新本文件的目录导航。
- 新增重要系统决策时，补充 `docs/80-decisions/adr/`。
- 目录或命名规则变化时，优先更新本文件。
