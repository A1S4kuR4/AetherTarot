# 🔮 灵语塔罗 (AetherTarot Agent)

**基于长上下文、结构化输出与反思式解读的深度塔罗智能体**

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

## 📍 当前主线状态（2026-04-09）

项目已经进入“两条并行主线协同推进”的阶段。

知识层现状：

- 78/78 牌义页已完成
- 10 张概念页已完成
- 9 张牌阵页已完成

当前并行主线：

1. 技术主线：`M1` Real Reading API 与 `M2` Structured Reading Schema 已完成；下一步是 `M3` Minimal LangGraph，`M4` Runtime Alignment 持续收口。
2. UX / 产品主线：`Paper / Midnight` 双面设计系统已确立，`Home / Ritual / Reveal / Interpretation / Journey` 已完成一轮重大重构，但 `docs/10-product/ux-risk-status.md` 中的剩余风险仍在持续处理。

`2026-04-09` 同步完成的关键收口包括：

- 引入 `ADR-0002` Dual-Tier Safety Escalation
- 在正式输出协议中稳定纳入 `sober_check` 与 `presentation_mode`
- 完成 Web CI / Playwright / lockfile 的一轮系统排障

换句话说，当前瓶颈已经不再是“缺更多知识”，而是：

- 如何把现有 service pipeline 稳定映射为最小 LangGraph
- 如何把已成立的仪式感与结果体验继续推进为更稳定的产品机制

---

## 🛠 当前运行时架构

### `apps/web`

唯一活跃应用，承载：

- 首页 / 抽牌 / reveal / reading / history / encyclopedia 页面
- 轻量 BFF Route：`POST /api/reading`
- 本地结构化 history 回放

### `packages/domain-tarot`

运行时塔罗数据访问层，负责从 `data/` 读取权威牌组与牌阵资产。

### `packages/prompting`

当前占位 provider 的结构化解读生成逻辑。

### `packages/shared-types`

reading request / response、history 与塔罗基础实体的共享类型。

### `knowledge/`

知识编译层，沉淀牌义、概念、牌阵等 wiki 页面。

### `docs/`

项目真相层，记录产品目标、架构边界、输出协议、安全原则与评测标准。

---

## 🚀 当前能力边界

已具备：

- 单牌、圣三角、赛尔特十字牌阵
- 结构化 reading API
- 结构化结果页与本地历史回放
- Dual-Tier Safety Escalation（`403 Hard Stop` / `200 Sober Check`）
- `sober_check` 与 `presentation_mode` 已进入正式输出协议
- 生成后安全检查与 `safety_note`

当前不做：

- 外部 LLM provider 接入
- 独立 `apps/api`
- 独立 `agent-core` 服务
- LangGraph 复杂图
- 服务端 reading 持久化
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
