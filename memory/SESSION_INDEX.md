# Session Index

- `last_updated`: `2026-04-10`
- `owner`: `Codex`
- `scope`: `shared memory/ session entry index`

## 1. 说明

本文件作为 `memory/` 目录的共享入口索引，用于快速定位当前最重要的执行文档与阶段性工作记录。

约定：

- 本文件优先索引已提交到仓库的共享 `memory/` 文档
- 某些本地工作底稿可继续存在于 `memory/`，但不应成为共享导航的必经入口

推荐进入顺序：

1. 先看主线优先级文档，确认当前产品主线。
2. 再看最近一份共享 work log，理解上一轮实际完成情况与项目进度。
3. 如涉及 UX / 安全主线，再看对应的 docs 与 ADR。
4. 如需继续本地 ingest，再额外查看本地 working notes。

## 2. 当前核心文档

### 2.1 Mainline Priority Plan

- 文件：`memory/mainline-priority-plan-2026-04-08.md`
- 用途：定义知识层阶段结束后的产品主线优先级与并行推进关系
- 当前重点：
  - `M3` Minimal LangGraph 已接入，当前技术主线转向 contract 稳定与后续 runtime 能力
  - `2026-04-09` 启动的 UX / 产品主线与技术主线并行推进
  - 不再把 ingest backlog 作为默认主线入口

### 2.2 Latest Work Log

- 文件：`memory/work-log-2026-04-10.md`
- 用途：记录 `2026-04-10` 的全套 28 张自定义资产注入、数据重构、1:1.7 比例规范化收口，以及 M3 最小 LangGraph 接入
- 当前重点：
  - 大阿尔卡纳 0-21 现已全备且本地化
  - 权杖组 Ace-5 完成注入
  - 全站卡牌渲染比例统一为 1:1.7
  - `generateStructuredReading` 已委托最小 LangGraph，`/api/reading` 公共协议保持不变

### 2.3 Previous Shared Work Logs

- 文件：`memory/work-log-2026-04-09.md`
- 用途：记录 `2026-04-09` 的设计系统迁移、UX 重构、安全架构升级与 CI 排障收口
- 摘要：Paper / Midnight 系统确立，核心页面重构完成。

- 文件：`memory/work-log-2026-04-08.md`
- 用途：记录 repo-local skill 引入、skill root 迁移与文档收口情况
- 当前进度摘要：
  - 引入了 3 个 AetherTarot 专属 repo-local skills
  - 将原有 `ingest-wiki` 迁移到 `.agents/skills/`
  - 已补齐 repo-local skills 的当前约定文档

### 2.4 Optional Local Working Notes

- 文件（如本地存在）：
  - `memory/knowledge-ingest-backlog.md`
  - `memory/milestone-health-report-2026-04-08.md`
- 用途：
  - 作为本地 operator notes 或专题底稿使用
  - 不作为共享索引的默认必经入口

## 3. 当前项目状态入口

如果你的目标是理解当前项目主线，建议按以下路径进入：

1. 查看 `memory/mainline-priority-plan-2026-04-08.md`
2. 再看 `memory/work-log-2026-04-10.md`，确认最新资产注入、数据重构与 M3 最小 LangGraph 接入情况
3. 配合 `docs/10-product/ux-risk-status.md` 理解 UX 主线进度
4. 再按 `M1 -> M2 -> M3 -> M4` 理解技术主线演进顺序；当前 `M3` 已完成，`M4` 仍在推进

如果你的目标是继续执行 ingest，建议按以下路径进入：

1. 先看 `memory/mainline-priority-plan-2026-04-08.md`
2. 仅在确认 ingest 仍是当前缺口时，再看本地 `memory/knowledge-ingest-backlog.md`
3. 执行时同步维护：
   - `knowledge/index.md`
   - `knowledge/log.md`

如果你的目标是快速了解上一轮做了什么，建议直接查看：

- `memory/work-log-2026-04-10.md`
- `memory/work-log-2026-04-09.md`

## 4. 维护约定

- 新增新的主线级记忆文档时，应优先更新本文件中的推荐阅读顺序。
- 新增工作日志时，应在本文件更新“Latest Work Log”。
- 新增共享 work log 时，应提交到仓库而不是只保留本地。
- 本地 working notes 可以继续存在，但不应让共享索引依赖其存在。
- 若后续 `memory/` 增加更多专题记录，可在此文件下继续扩展索引分组。
