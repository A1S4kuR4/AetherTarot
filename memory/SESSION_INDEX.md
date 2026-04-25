# Session Index

- `last_updated`: `2026-04-25`
- `owner`: `Codex`
- `scope`: `shared memory/ session entry index`

## 1. 说明

本文件作为 `memory/` 目录的共享入口索引，用于快速定位当前最重要的执行文档与阶段性工作记录。

约定：

- 本文件优先索引已提交到仓库的共享 `memory/` 文档
- 某些本地工作底稿可继续存在于 `memory/`，但不应成为共享导航的必经入口

推荐进入顺序：

1. 先看当前状态文档，确认最新真实状态与下一步优先级。
2. 再看主线优先级文档，理解长期主线与并行关系。
3. 再看最近一份共享 work log，理解上一轮实际完成情况与项目进度。
4. 如涉及 UX / 安全主线，再看对应的 docs 与 ADR。
5. 如需继续本地 ingest，再额外查看本地 working notes。

## 2. 当前核心文档

### 2.1 Current Status + Priority List

- 文件：`memory/current-status-and-priority-2026-04-15.md`
- 用途：作为当前主线优先级文档与 UX 风险文档之间的桥接入口，统一回答“现在做到哪了、卡在哪里、下一步先做什么”
- 当前重点：
  - 项目已进入“主链已成、回归已恢复、运行时牌池已完整、continuity 边界开始收紧、第二个新增运行时牌阵已上线”阶段
  - 当前最大风险重新收束到现有 5 个牌阵的前台组织机制、`R2 / R3 / R7` 读感校准与文档持续同步
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

- 文件：`memory/work-log-2026-04-25-p1-experience-runtime-alignment.md`
- 用途：记录 `2026-04-25` P1 轻量体验收口与 Runtime Alignment 小步推进
- 当前重点：
  - `/reveal` 与 `/reading` 已共用 5 个牌阵的 `spreadExperience` 前台口径
  - reading 机制区已显式强化“牌面线索 -> 位置语义 -> 综合推断”的证据路径
  - provider / prompt bias 已补齐 5 个现有运行时牌阵的 spread-specific reading axis
  - Encyclopedia 继续消费 runtime deck JSON，并补全四花色过滤与覆度展示
  - 本轮没有新增牌阵、没有改变 schema、没有打开服务端 persistence 或 memory merge
  - 已复跑 semantic fixtures、asset validation、build、lint 与完整 e2e；结果分别为 `12/12`、通过、build passed、`0` errors / `14` warnings、`24/24`

- 文件：`memory/work-log-2026-04-25.md`
- 用途：记录 `2026-04-25` 中世纪欧洲风格 `cardsV2` 资源接入、运行时路径切换、卡背切换、manifest / validator 更新与验证结果
- 当前重点：
  - `data/decks/rider-waite-smith.json` 的 78 张牌已全部切到 `/cardsV2/...`
  - `CARD_BACK_IMAGE` 已切到 `/cardsV2/back.png`
  - `data/decks/card-asset-manifest.json` 已记录 `78` 张正面牌与 `1` 张卡背的真实尺寸和 SHA-256
  - `scripts/validate-card-assets.mjs` 已改为校验 `cardsV2`、portrait ratio、manifest coverage、source kind、visual review、recorded dimensions 与 hash
  - 已复跑 `npm run validate:assets` 与 `npm run build`，均通过

### 2.4 Near-Term Work Plan

- 文件：`memory/near-term-work-plan-2026-04-10.md`
- 用途：安排 Two-Stage Reading MVP 之后的最近工作顺序
- 当前重点：
  - 先收口并提交当前两阶段 MVP 变更
  - 再补 contract hardening 与语义 eval
  - 然后准备真实 provider / prompt baseline
  - UX 风险收口和 Runtime Alignment 并行但不抢主线

### 2.5 Previous Shared Work Logs

- 文件：`memory/work-log-2026-04-24.md`
- 用途：记录 `2026-04-24` 线下塔罗模式的设计落地、前端录入流程、`draw_source` 协议兼容、文档同步与验证结果
- 当前重点：
  - 线下塔罗模式作为 `drawnCards[]` 的新输入来源接入现有 `/api/reading`，不新建第二套 reading pipeline
  - 新增 `/offline-draw`，支持按牌阵位置录入实体牌、正逆位与重复牌约束
  - 新增 `draw_source = digital_random | offline_manual`，但不改变 `StructuredReading` response shape
  - 已复跑 focused graph contract test、build 与 diff whitespace check；结果分别为 `20/20`、build passed、无 whitespace error

- 文件：`memory/work-log-2026-04-22.md`
- 用途：记录 `2026-04-22` 对最新工作日志、状态文档与 UX 风险文档的复核，以及本轮执行计划、回归结果和后续口径
- 当前重点：
  - 确认当前不重新打开 `M1 / M2 / M3`，不新增运行时牌阵，不打开服务端 memory persistence
  - 本轮计划固定为先验证 2026-04-20 的 `R2 / R3 / R7` 改动，再把真实状态写回 `memory/`
  - 已复跑 targeted semantic fixtures、build、完整 e2e 与 lint；结果分别为 `10/10`、build passed、`23/23`、`0` errors / `13` existing warnings

- 文件：`memory/work-log-2026-04-20.md`
- 用途：记录 `2026-04-20` 的证据感阅读体验、重大现实决策前置确认、重复主题提醒、被组织的随机、建设性阻力与 E2E 稳定性恢复
- 当前重点：
  - reading 页已加入“牌面线索 / 位置语义 / 综合推断”的第一版证据分层
  - `/reveal -> /reading` 已加入“牌阵如何组织随机 / 本次牌阵如何组织随机”的可见机制说明
  - provider / prompt 已加入按问题类型分化的建设性阻力，避免 reading 只顺着用户期待展开或退回固定模板句
  - `/new` 已加入重大现实决策前置确认与本地重复主题提醒
  - 本轮没有打开服务端 memory persistence，也没有新增运行时牌阵
  - contract / build / e2e 已再次通过，其中 `npm run test:contract -w @aethertarot/web` 为 `40/40`，`npm run test:e2e` 为 `23/23`

- 文件：`memory/work-log-2026-04-17.md`
- 用途：记录 `2026-04-17` 的 safety realism、continuity regression 收紧与第二个高价值运行时牌阵 `seven-card` 上线。

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
3. 再看 `memory/work-log-2026-04-25-p1-experience-runtime-alignment.md`，确认 P1 体验收口、百科四花色过滤、validator 数量守卫与回归结果
4. 再看 `memory/work-log-2026-04-25.md`，确认 `cardsV2` 资源接入、卡背切换、manifest / validator 变更与验证结果
5. 再看 `memory/work-log-2026-04-24.md`，确认线下塔罗模式的输入来源、前端录入流程与验证结果
6. 再看 `memory/work-log-2026-04-22.md`，确认上一轮计划判断与回归结果
7. 再看 `memory/work-log-2026-04-20.md`，确认证据感阅读体验、组织随机、建设性阻力、前置现实边界、重复主题提醒与上一轮落地细节
8. 查看 `memory/near-term-work-plan-2026-04-10.md`，按最近工作顺序继续执行
9. 配合 `docs/10-product/ux-risk-status.md` 理解 UX 主线进度与当前 runtime 落地与回归信号状态

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
