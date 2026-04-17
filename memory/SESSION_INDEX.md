# Session Index

- `last_updated`: `2026-04-17`
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

### 2.1 Current Status + Priority List

- 文件：`memory/current-status-and-priority-2026-04-15.md`
- 用途：作为当前主线优先级文档与 UX 风险文档之间的桥接入口，统一回答“现在做到哪了、卡在哪里、下一步先做什么”
- 当前重点：
  - 项目已进入“主链已成、回归已恢复、运行时牌池已完整、continuity 边界开始收紧、第二个新增运行时牌阵已上线”阶段
  - 当前最大风险重新收束到牌阵语义、长期连续性与文档持续同步
  - 优先级固定为：先保持可信回归与文档同步，再收口牌阵与运行时体验，再开长期连续性能力
  - 最新运行时扩展已把牌库推进到 `78` 张、卡图推进到 `79` 个文件、运行时牌阵推进到 `5` 个，并在 Encyclopedia 前台显式展示 `78/78` vs `78/78` 覆度

### 2.2 Mainline Priority Plan

- 文件：`memory/mainline-priority-plan-2026-04-08.md`
- 用途：定义知识层阶段结束后的产品主线优先级与并行推进关系
- 当前重点：
  - `M3` Minimal LangGraph 已接入，当前技术主线转向 contract 稳定与后续 runtime 能力
  - `2026-04-09` 启动的 UX / 产品主线与技术主线并行推进
  - 不再把 ingest backlog 作为默认主线入口

### 2.3 Latest Work Log

- 文件：`memory/work-log-2026-04-17.md`
- 用途：记录 `2026-04-17` 的 safety realism、continuity regression 收紧与第二个高价值运行时牌阵 `seven-card` 上线
- 当前重点：
  - hard-stop 已切换到真实中国大陆危机 / 心理支持入口
  - `prior_session_capsule` 已在进入 provider 前做安全净化
  - `seven-card` 已作为第二个新增高价值运行时牌阵完成全链路接入
  - contract / build / e2e 已再次通过


### 2.4 Near-Term Work Plan

- 文件：`memory/near-term-work-plan-2026-04-10.md`
- 用途：安排 Two-Stage Reading MVP 之后的最近工作顺序
- 当前重点：
  - 先收口并提交当前两阶段 MVP 变更
  - 再补 contract hardening 与语义 eval
  - 然后准备真实 provider / prompt baseline
  - UX 风险收口和 Runtime Alignment 并行但不抢主线
### 2.5 Previous Shared Work Logs

- 文件：`memory/work-log-2026-04-12.md`
- 用途：记录 `2026-04-12` 的 Ritual / Reveal 生产级抛光、布局溢出关闭与编译故障恢复。

- 文件：`memory/work-log-2026-04-11.md`
- 用途：记录全套 28 张自定义资产注入、M3 最小 LangGraph 接入与 Trinity Spatial Architecture (ADR 0003) 落地。
- 摘要：首页叙事分域完成，Reading 流程进入 initial/final 两阶段 contract 稳固期。

- 文件：`memory/work-log-2026-04-10.md`
- 用途：记录 `2026-04-10` 的资产注入、1:1.7 规范化与两阶段 MVP 落地。

- 文件：`memory/work-log-2026-04-09.md`
- 用途：设计系统迁移、UX 重构、安全架构升级。

### 2.6 Optional Local Working Notes

- 文件（如本地存在）：
  - `memory/knowledge-ingest-backlog.md`
  - `memory/milestone-health-report-2026-04-08.md`
- 用途：
  - 作为本地 operator notes 或专题底稿使用
  - 不作为共享索引的默认必经入口

## 3. 当前项目状态入口

如果你的目标是理解当前项目主线，建议按以下路径进入：

1. 先看 `memory/current-status-and-priority-2026-04-15.md`，确认当前整体状态、真实阻塞点与下一步优先级
2. 再看 `memory/mainline-priority-plan-2026-04-08.md`
3. 再看 `memory/work-log-2026-04-17.md`，确认安全真实化、continuity 边界收紧、`seven-card` 上线与最新回归状态
4. 查看 `memory/near-term-work-plan-2026-04-10.md`，按最近工作顺序继续执行
5. 配合 `docs/10-product/ux-risk-status.md` 理解 UX 主线进度与当前 runtime 落地与回归信号状态

如果你的目标是继续执行 ingest，建议按以下路径进入：

1. 先看 `memory/mainline-priority-plan-2026-04-08.md`
2. 仅在确认 ingest 仍是当前缺口时，再看本地 `memory/knowledge-ingest-backlog.md`
3. 执行时同步维护：
   - `knowledge/index.md`
   - `knowledge/log.md`

如果你的目标是快速了解上一轮做了什么，建议直接查看：

- `memory/work-log-2026-04-12.md`
- `memory/work-log-2026-04-11.md`
- `memory/work-log-2026-04-10.md`
- `memory/work-log-2026-04-09.md`

## 4. 维护约定

- 新增新的主线级记忆文档时，应优先更新本文件中的推荐阅读顺序。
- 新增工作日志时，应在本文件更新“Latest Work Log”。
- 新增共享 work log 时，应提交到仓库而不是只保留本地。
- 本地 working notes 可以继续存在，但不应让共享索引依赖其存在。
- 若后续 `memory/` 增加更多专题记录，可在此文件下继续扩展索引分组。
