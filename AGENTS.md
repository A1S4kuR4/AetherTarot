# AGENTS.md

本文件为 AetherTarot Agent 仓库的全局工作说明。目标是让代码 Agent 在进入仓库后，能够**快速理解项目结构、正确修改文件、同步更新文档，并避免破坏核心业务边界**。

---

## 1. 项目目标

AetherTarot Agent 是一个以**长上下文、深度推理、反思式塔罗解读**为核心的智能体项目。

所有改动都必须优先服务以下目标：

- 提高解读质量与一致性
- 降低幻觉、断言和逻辑漂移
- 保持安全边界清晰
- 让输出协议稳定、可测试、可回放
- 让文档与代码长期同步

---

## 2. 进入仓库后的阅读顺序

在执行较大改动前，优先阅读：

1. `README.md`
2. `docs/00-overview/project-map.md`
3. `docs/10-product/vision.md`
4. `docs/20-domain/reading-contract.md`
5. `docs/20-domain/interpretation-framework.md`
6. `docs/30-agent/context-strategy.md`
7. `docs/30-agent/output-schema.md`
8. `docs/50-safety/safety-principles.md`
9. 与目标模块相关的 ADR

如果任务涉及 Web UI / UX / 前端呈现，再补读：

- `DESIGN.md`
- `docs/10-product/ux-risk-status.md`

---

## 3. 全局改动规则

### 3.1 修改解释逻辑时

如果改动涉及以下任一内容，必须同步检查并更新相关文档与评测：

- 牌义解释逻辑
- 牌阵位置逻辑
- 综合结论生成逻辑
- 风格或语气规范
- 安全提示与边界措辞

至少同步检查：

- `docs/20-domain/interpretation-framework.md`
- `docs/30-agent/output-schema.md`
- `docs/50-safety/safety-principles.md`
- `docs/60-evals/rubrics.md`

### 3.2 修改上下文/记忆策略时

如果改动涉及以下内容：

- 会话摘要策略
- 用户画像持久化
- 长期记忆合并逻辑
- 工具调用上下文注入

必须同步检查：

- `docs/30-agent/context-strategy.md`
- `docs/40-architecture/architecture.md`
- 对应 ADR 是否需要新增或更新

### 3.3 修改安全边界时

任何涉及危机、自伤、医疗、法律、未成年人、关系操控或确定性预言的改动，都必须优先检查：

- `docs/20-domain/reading-contract.md`
- `docs/50-safety/safety-principles.md`
- `docs/60-evals/rubrics.md`

如果安全边界发生实质变化，应新增 ADR。

### 3.4 优先调用 repo-local skills

以下任务类型，优先调用对应 skill：

- 涉及 TypeScript / JavaScript 代码修改、已有模块重构、bugfix、测试补齐、类型收窄、最小 diff 实现、验证顺序控制（targeted tests / typecheck / 必要时 lint/build）时，优先使用 `.agents/skills/disciplined-typescript-engineer/SKILL.md`

- 仓库内所有 repo-local skill 的新增、迁移与维护，都应写入 `.agents/skills/`；`.agents/skills/` 是唯一 canonical skill root
- 涉及 repo-local skills 的目录约定、迁移或新增规范时，先检查 `docs/00-overview/repo-local-skills.md`
- 涉及 reading backend 状态建模、节点拆分、canonical context 组装、结构化字段流转或 `session_capsule` 接入时，优先使用 `.agents/skills/aethertarot-reading-state/SKILL.md`
- 涉及 `session capsule`、历史摘要、长期记忆写入/读取、memory merge、thread/session 持久化边界时，优先使用 `.agents/skills/aethertarot-memory-persistence/SKILL.md`
- 涉及危机、自伤、健康、法律、财务、关系操控、限制性输出或人工审核/安全升级时，优先使用 `.agents/skills/aethertarot-safety-escalation/SKILL.md`
- 涉及 `knowledge/raw/ -> knowledge/wiki/` 的 ingest、知识层 lint、source registry / index / log 同步时，优先使用 `.agents/skills/ingest-wiki/SKILL.md`
- 若任务同时跨越状态、记忆、安全边界，可组合使用多个 skill，并同步检查相关 docs / ADR
- 若任务属于通用工程实现且不完全落入上述业务域 skill，默认先使用 `.agents/skills/disciplined-typescript-engineer/SKILL.md`，再按需要叠加 domain-specific skills

---

## 4. 文档原则

- 不要把核心业务规则只写在代码注释或 prompt 中。
- 重要决策必须落到 `docs/` 或 ADR。
- 文档应该写“为什么”和“边界”，不仅写“做什么”。
- 避免生成空泛文档；优先产出能指导实现和评测的文档。

---

## 5. 输出原则

AetherTarot 的输出默认应符合以下方向：

- 以**反思、启发、叙事整理**为主
- 避免“绝对会发生”“命中注定”“必须分手/结婚/辞职”这类断言
- 保持温和、具体、可执行，但不过度命令式
- 允许神秘感，但不能牺牲清晰度与责任边界

---

## 6. 评测原则

新增或修改关键逻辑后，至少验证：

- 是否仍然紧扣用户问题
- 是否尊重牌阵位置
- 是否有整体综合，而非逐牌堆砌
- 是否没有越过安全边界
- 是否保持结构化输出稳定

---

## 7. 提交建议

较大改动建议遵循：

1. 先更新文档或 ADR
2. 再修改代码/提示词/配置
3. 最后补充评测样例或回归说明

---

## 8. 禁止事项

- 不要把确定性预言写成产品核心卖点。
- 不要删除安全提示而不补充替代机制。
- 不要在没有更新文档的情况下重写核心解释逻辑。
- 不要让输出结构频繁变化而不更新 schema / 消费方。
