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
4. `docs/20-domain/reading-contract.md`
5. `docs/20-domain/interpretation-framework.md`

### 面向 Agent / Prompt / Memory 相关开发

1. `docs/30-agent/context-strategy.md`
2. `docs/30-agent/output-schema.md`
3. `docs/40-architecture/architecture.md`
4. `docs/00-overview/repo-local-skills.md`

### 面向安全与评测

1. `docs/50-safety/safety-principles.md`
2. `docs/60-evals/rubrics.md`

---

## 3. 仓库职责分层

### `docs/`

项目真相层。记录产品目标、领域规则、架构边界、安全原则、评测标准与决策历史。

### `knowledge/`

知识编译层。用于沉淀塔罗牌义、牌阵、象征体系、语义风格、安全边界与综合主题。

### `apps/`

应用层。当前以 `apps/web` 为唯一活跃应用，承载前台与轻量 BFF 路由；`prototype/` 已冻结，不再作为主开发入口。

### `packages/`

复用模块层。当前迁移重点为 `shared-types`、`domain-tarot` 与 `prompting`，用于承载共享类型、塔罗运行时数据访问与 mock 解读模板。

### `evals/`

评测资产层。用于放置样例、测试集、rubrics、报告与回归脚本。

### `data/`

运行时数据层。用于放置首轮上线所需的牌组与牌阵 JSON 资产，作为当前权威运行时数据来源。

### `.agents/skills/`

仓库内 repo-local skills / agent workflows 的统一位置。用于封装 ingest、prompt 修订、评测归类、写 ADR 等技能。

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

### 我想新增或迁移 repo-local skill

先读：

- `docs/00-overview/repo-local-skills.md`
- `AGENTS.md`

---

## 5. 维护要求

- 新增重要文档时，更新本文件的目录导航。
- 新增重要系统决策时，补充 `docs/80-decisions/adr/`。
- 目录或命名规则变化时，优先更新本文件。
