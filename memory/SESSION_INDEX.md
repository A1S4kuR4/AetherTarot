# Session Index

- `last_updated`: `2026-04-08`
- `owner`: `Codex`
- `scope`: `memory/` session entry index

## 1. 说明

本文件作为 `memory/` 目录的入口索引，用于快速定位当前最重要的执行文档与阶段性工作记录。

推荐进入顺序：

1. 先看主线优先级文档，确认当前产品主线。
2. 再看里程碑健康度报告，判断哪些模块已经完成、哪些仍待推进。
3. 然后看 ingest backlog，理解知识层资产现状与历史批次。
4. 最后看最近一份 work log，理解上一轮实际完成情况与项目进度。

## 2. 当前核心文档

### 2.1 Mainline Priority Plan

- 文件：`memory/mainline-priority-plan-2026-04-08.md`
- 用途：定义知识层阶段结束后的产品主线优先级
- 当前重点：
  - 先做后端 / Agent 接口层
  - 再做结构化输出
  - 然后接最小 LangGraph

### 2.2 Milestone Health Report

- 文件：`memory/milestone-health-report-2026-04-08.md`
- 用途：按“知识层阶段 + M1-M4”视角记录当前项目健康度
- 当前重点：
  - 知识层首轮闭环已完成
  - `M1 / M2` 已完成
  - `M3` 未开始
  - `M4` 部分完成

### 2.3 Ingest Backlog

- 文件：`memory/knowledge-ingest-backlog.md`
- 用途：知识层 ingest 的连续执行队列
- 当前重点：
  - 牌义页 `78/78` 已完成
  - 概念页已扩展到 `10` 张
  - 牌阵页已扩展到 `9` 张

### 2.4 Latest Work Log

- 文件：`memory/work-log-2026-04-08.md`
- 用途：记录本次对话的实际工作、repo-local skill 引入、skill root 迁移与文档收口情况
- 当前进度摘要：
  - 引入了 3 个 AetherTarot 专属 repo-local skills
  - 将原有 `ingest-wiki` 迁移到 `.agents/skills/`
  - 已补齐 repo-local skills 的当前约定文档

## 3. 当前项目状态入口

如果你的目标是理解当前项目主线，建议按以下路径进入：

1. 查看 `memory/mainline-priority-plan-2026-04-08.md`
2. 再看 `memory/milestone-health-report-2026-04-08.md`，确认各里程碑和模块当前状态
3. 按 `M1 -> M2 -> M3 -> M4` 理解后续迭代顺序
4. 再回看 `memory/knowledge-ingest-backlog.md`，只把 ingest 作为按需补洞来源

如果你的目标是继续执行 ingest，建议按以下路径进入：

1. 先看 `memory/mainline-priority-plan-2026-04-08.md`
2. 再看 `memory/knowledge-ingest-backlog.md`
3. 执行时同步维护：
   - `knowledge/index.md`
   - `knowledge/log.md`

如果你的目标是快速了解上一轮做了什么，建议直接查看：

- `memory/work-log-2026-04-08.md`

## 4. 维护约定

- 新增新的主线级记忆文档时，应优先更新本文件中的推荐阅读顺序。
- 新增 backlog 文档时，应在本文件补充入口链接。
- 新增工作日志时，应在本文件更新“Latest Work Log”。
- 若后续 `memory/` 增加更多专题记录，可在此文件下继续扩展索引分组。
