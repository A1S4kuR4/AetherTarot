# Repo-local Skills

## 1. 文档目的

本文件用于说明当前仓库内 repo-local skills 的统一位置、使用方式与新增约定，避免 skill 目录再次分叉。

---

## 2. 当前约定

- `.agents/skills/` 是当前仓库内唯一 canonical skill root。
- `external/langchain-skills/` 仅作为上游参考源保留，不作为当前项目的 skill 入口。
- 旧的 `codex/skills/` 已退役，不应再向该路径回写。

---

## 3. 当前已落地的 skills

- `ingest-wiki`
- `aethertarot-reading-state`
- `aethertarot-memory-persistence`
- `aethertarot-safety-escalation`

这些 skills 均服务于 AetherTarot 当前的知识层、reading runtime、记忆边界与安全边界，不应被当作通用示例随意泛化。

---

## 4. 使用方式

- 当任务与某个 skill 的 front matter 描述直接匹配时，优先调用对应 skill。
- 先看 skill 的 `name` / `description` 判断是否触发，再按需读取 `SKILL.md` 正文。
- 若任务同时跨越多个边界，可组合使用多个 repo-local skills。
- 若任务只是参考上游模式，应优先保留项目语义与当前 `docs/` 中的规则，而不是把上游写法直接搬进仓库。

---

## 5. 新增 skill 约定

新增 repo-local skill 时，默认遵循以下最小约定：

- 路径：`.agents/skills/<skill-name>/`
- 名称：使用小写 `kebab-case`
- 必需文件：`SKILL.md`
- 必需 front matter：
  - `name:`
  - `description:`
- 推荐文件：`agents/openai.yaml`
- 可选目录：
  - `references/`
  - `scripts/`
  - `assets/`

内容要求：

- 以 AetherTarot 当前仓库的真实任务和边界为中心
- 明确写出何时触发、何时不要触发、它只服务哪些任务
- 避免写成“任何项目都适用”的宽泛教程

---

## 6. 文档同步要求

当以下情况发生时，应同步检查仓库说明文档：

- 新增重要 repo-local skill
- skill root 约定变化
- 重要 skill 的职责边界发生明显变化

至少同步检查：

- `README.md`
- `AGENTS.md`
- `docs/00-overview/project-map.md`
- `memory/SESSION_INDEX.md`

如果只是微调 skill 内部说明，而不影响仓库级约定，可不额外扩写 repo 说明。
