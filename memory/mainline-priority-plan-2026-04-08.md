# Mainline Priority Plan

- `last_updated`: `2026-04-26`
- `owner`: `Codex`
- `scope`: `product mainline priorities after knowledge-layer phase`
- `execution_status`: `M1 completed / M2 completed / M3 completed / Two-Stage Reading MVP completed / M4 card-pool completed / spread alignment partial / R2-R3-R7 UX calibration active`
- `verification`: `2026-04-20` 本地验证结果为 `npm run build` passed、`npm run test:contract -w @aethertarot/web` passed（`40/40`）、`npm run lint -w @aethertarot/web` passed（`0` errors，`13` existing warnings）、`npm run test:e2e` passed（`23/23`）；Playwright 已对齐现行 `/new -> /ritual -> /reveal -> /reading -> /journey` 路径，并在测试环境固定使用 `placeholder` provider；完整 `78/78` runtime 牌池、本地资产、`four-aspects` / `seven-card` 运行时牌阵、hard-stop 资源、continuity capsule 边界与 R2/R3/R7 第一版 UX 风险收口均已进入真实回归

## 1. 当前状态快照

截至 `2026-04-20` 最新同步，项目主线已经从“知识层领先、运行时偏轻”推进到“回归已恢复、运行时牌池完整闭环，并形成并行 UX / Runtime Alignment 主线”的阶段；当前近端重点不是继续扩牌阵或打开长期记忆，而是校准既有 `R2 / R3 / R7` 前台体验。

知识层现状：

- `78/78` 牌义页已完成
- `10` 张概念页已完成
- `9` 张牌阵页已完成

运行时现状：

- `data/spreads/` 当前已上线 `single`、`holy-triangle`、`four-aspects`、`seven-card`、`celtic-cross`
- `apps/web` 的 `/api/reading` 已返回结构化 `StructuredReading` 成功 payload
- `apps/web/src/server/reading/` 已建立服务层、provider 边界、schema 校验与安全后处理
- `reading` 页与 `history` 页已切到结构化输出消费，不再以 `interpretation: string` 为主协议
- 本地历史已升级为 `ReadingHistoryEntry`，使用 versioned localStorage key
- 前端百科仍直接消费 `data/decks/rider-waite-smith.json`
- `four-aspects` 与 `seven-card` 已完成 authority、前台选择、揭示布局、reading 消费与 smoke 回归接入
- hard-stop 资源已切到中国大陆固定真实入口；`prior_session_capsule` 进入 provider 前会先做安全净化
- `data/decks/rider-waite-smith.json` 已扩展到完整 78 张运行时牌：Rider-Waite-Smith 全牌池已接入
- `apps/web/public/cards/` 已接入 79 个文件：78 张 1000x1700 PNG 正面牌面与 1 张背面
- `data/decks/card-asset-manifest.json` 已记录 full-bleed 状态、视觉审核与 SHA-256
- 仓库已接入最小 LangGraph 编排，`generateStructuredReading()` 保持 service 入口并委托 graph 执行
- Two-Stage Reading MVP 已落地：`POST /api/reading` 保持单入口，但 request / response 已加入 `agent_profile`、`phase`、`reading_phase` 与 follow-up 元数据
- Lite / Standard / Sober Agent Profile 已进入运行时结构，Standard / Sober 走 `initial -> followup -> final`，Lite 可 initial-as-final
- 当前仍没有服务端 history persistence，也没有拆分 `apps/api`

补充说明：

- 为了让 `celtic-cross` 与主流程能更稳定地真实跑通，运行时牌库已从早期示例牌扩展到完整 `78/78`；当前 Runtime Alignment 的剩余问题已不再是牌池缺口，而是牌阵与百科消费边界。

当前瓶颈已经不再是“先补更多知识页”或“接入最小 LangGraph”，而是“在已稳定的结构化 reading contract 与最小 graph 边界上，先把既有前台理解机制与回归信号守稳”。

`2026-04-09` 的补充更新表明，项目已经形成第二条并行主线：

- `Paper / Midnight` 双面设计系统成为当前 canonical UI 方向
- `HomeView`、`RitualView`、`RevealView`、`InterpretationView` 与 `JourneyView` 完成一轮 UX / 产品重构
- `ADR-0002` Dual-Tier Safety Escalation 已落地到当前文档真相层
- `sober_check` 与 `presentation_mode` 已进入正式 output schema
- Web CI、Playwright 与 cross-platform lockfile 问题已完成一轮系统排障

`2026-04-10` 的补充更新表明，`M4 Runtime Alignment` 已开始进入资产与数据层，同时 reading contract 已升级到 Two-Stage MVP：

- 完整 `78/78` Rider-Waite-Smith 运行时牌池已完成本地运行时数据和牌面资产注入
- 全站卡牌渲染比例已统一到 `1:1.7`
- 资产生成与校验已具备根命令：`npm run generate:assets` 与 `npm run validate:assets`。
- 两阶段 reading 规范已沉淀到 `docs/30-agent/reading-flow.md`、`docs/30-agent/agent-profiles.md`、`docs/30-agent/output-schema.md`、`docs/40-architecture/architecture.md` 与 `docs/60-evals/rubrics.md`

因此，当前瓶颈已经转为“如何在最小 graph 已成立后保持 contract 稳定”，以及“如何把已成立的仪式感、留存入口与安全摩擦进一步机制化为稳定产品体验”。

## 2. 主线优先级

### 已完成：P0. 后端 / Agent 接口层

目标：把 `/api/reading` 从 mock 文案接口升级为真实 reading backend 的稳定入口。

执行结果：已完成。

完成情况：

- Route 已切换为最小 request payload：`question`、`spreadId`、`drawnCards[]`
- Route 不再信任客户端传入整张牌或整套牌阵，而是在服务端用 `domain-tarot` 还原权威 `Spread` / `TarotCard`
- 接口已具备请求校验、服务层调用、错误返回与 provider 抽象
- 该稳定调用边界已被 M3 最小 LangGraph 复用

### 已完成：P0. 结构化输出落地

目标：让接口返回值向 `docs/30-agent/output-schema.md` 靠拢，而不是只返回 `interpretation: string`。

执行结果：已完成。

完成情况：

- 当前成功响应直接返回 `StructuredReading`
- 已覆盖 `question_type`、`cards[]`、`themes`、`synthesis`、`reflective_guidance`
- 同时包含 `follow_up_questions`、`safety_note`、`confidence_note`、`session_capsule`
- 前端阅读页已按结构分块展示，不再依赖 markdown 作为主显示协议
- 历史页已保存并回放结构化 reading

### 已完成：P1. 最小 LangGraph 编排

目标：在真实后端接口稳定后，引入最小可用图，而不是先做复杂图。

固定顺序：

1. 问题分类
2. 上下文组装
3. 解读生成
4. 安全检查
5. 输出整形

执行结果：已完成。

当前判断：

- 现有 service pipeline 已映射为最小 LangGraph
- `POST /api/reading` 的 request / response contract 保持不变
- M3 的结果是“接图”，不是“重新设计 schema”

### 当前并行第二主线：P1. UX / Product Risk Closure

目标：把 `2026-04-09` 已经启动的 UX 主线从“显著改善体验”继续推进到“关闭关键产品风险”。

当前状态：已启动，仍在推进。

已完成：

- 设计语言已从旧的 Cinematic / glassmorphism 方向切换为 `Paper / Midnight` 双面系统
- `HomeView`、`RitualView`、`RevealView`、`InterpretationView` 与 `JourneyView` 已完成一轮重大重构
- 决策外包风险已不再只靠后置文案，而是引入 `Hard Stop / Sober Check` 机制
- `docs/10-product/ux-risk-status.md` 已成为当前 UX 剩余风险的集中状态文档

当前仍待处理：

- `R1 / R3 / R5 / R6 / R10 / R11 / R12` 等剩余风险尚未完全关闭
- history / journey 价值仍需继续从“单次结果存档”推进到“阶段性关系入口”
- 某些结构化阅读节奏仍然偏模板化，前台编排差异还需要继续增强

执行原则：

- UX 主线与已完成的 `M3` graph 边界并行推进，不互相覆盖叙事
- 已确定的设计系统、安全架构与 output schema 语义不回退
- 后续 UX 迭代应优先围绕风险关闭与机制成立，而不是重复大范围视觉漂移

### 当前第三优先级：P2. 前端消费升级 / Runtime Alignment

目标：让阅读页、历史页、百科页开始消费真实结构化解读与更多运行时牌阵。

当前状态：部分完成。

已完成：

- `reading` 页按 schema 分块展示
- `history` 能保存并恢复结构化 reading

未完成：

- `encyclopedia` 是否接 `knowledge/wiki` 仍处于待评估状态
- 首个新增高价值牌阵 `four-aspects` 已进入 `data/spreads/` + UI 联动上线流程；后续高价值牌阵仍待继续推进
- 运行时牌库现已扩展到完整 `78/78` 并接入本地资产；当前未完成部分转为新增高价值牌阵、百科 runtime 接入策略与长期连续性设计

### 保持降级：P2. 定向 ingest-wiki

目标：从“大规模持续补知识”切换为“按运行时缺口补知识”。

明确边界：

- 后续 ingest 只服务于真实解读质量问题、运行时新增牌阵、或知识缺口复盘
- 不再把 ingest 作为默认主线
- 除非 graph 扩展或 M4 暴露出明确缺口，否则不建议重新把主线拉回知识扩张

## 3. 已锁定的实现边界

以下边界已经在本阶段被实际实现或确认，不应在后续阶段轻易漂移：

- 首轮后端继续留在 `apps/web`，未拆 `apps/api`
- Route 只做 transport / validation / error mapping
- 实际 reading orchestration 已从 route 中抽离到服务层
- provider 当前为可替换占位实现，尚未接外部 LLM
- 安全边界已在生成后单独检查，不能只靠 prompt 约束
- 成功响应协议已稳定为带阶段元数据的 `StructuredReading`，短期内不应频繁改 shape
- `session_capsule` 已进入 completed reading 链路，但仍保持 `string | null`；当前只允许模板化、短摘要式输出，不承载原始补充文本
- 默认 `locale` 仍为 `zh-CN`
- 历史记录当前只做 localStorage 持久化，不做服务端持久化
- `encyclopedia` 仍未接入知识层 runtime 消费

## 4. 里程碑拆分与执行情况

### M1. Real Reading API

状态：已完成（`2026-04-08`）

结果：

- mock route 已替换
- 服务层边界已建立
- provider 配置与错误处理已落地
- API request / response contract 已收口

### M2. Structured Reading Schema

状态：已完成（`2026-04-08`）

结果：

- 共享类型已升级
- 前后端 payload 已切换到结构化 reading
- 历史记录结构已升级
- Reading / History UI 已完成结构化消费
- 文档与 Playwright 回归已同步

### M3. Minimal LangGraph

状态：已完成（`2026-04-10`）

结果：

- `apps/web/src/server/reading/graph.ts` 已承载最小 LangGraph 编排
- `apps/web/src/server/reading/service.ts` 保持 `generateStructuredReading()` 入口并委托 graph
- 图节点覆盖分类、上下文、意图摩擦、生成、结构化组装、安全复核与最终校验
- 当前不启用 checkpoint、streaming、interrupt、人审或外部 LLM

### M3.5. Two-Stage Reading MVP

状态：已完成（`2026-04-10`）

结果：

- `POST /api/reading` 保持单入口，新增 `agent_profile` 与 `phase` request 字段。
- `StructuredReading` 增加 `agent_profile`、`reading_phase`、`requires_followup`、`initial_reading_id` 与 `followup_answers`。
- `standard` / `sober` 走完整两阶段，`lite` 可快速完成。
- final 阶段会校验 initial reading 与当前 profile / spread / drawn cards 一致。
- History 只保存 completed reading，Standard/Sober initial 不写入历史。

### M4. Runtime Alignment

状态：部分完成（运行时牌池完成，新增牌阵暂缓，既有 5 个牌阵的前台组织机制与百科消费策略待继续收口）

已启动部分：

- 阅读结果页已对齐结构化 schema
- 历史页已对齐结构化 reading contract
- `celtic-cross` 的抽牌与回放路径已能真实跑通
- 完整 `78/78` Rider-Waite-Smith 牌池已进入运行时牌组
- 本地牌面资产与 manifest 校验已形成闭环

待完成部分：

- 观察既有 5 个运行时牌阵的前台组织机制是否足够清楚，暂缓继续新增运行时牌阵
- 百科 runtime 接入策略
- 与 `coverage.ts` 对应的 consistency / coverage 测试
- 针对真实运行时缺口的定向 ingest 回补

## 5. 验证结果

本轮主线执行后的关键验证如下：

- `npm run build` 已通过
- `npm run test:contract -w @aethertarot/web` 已通过，当前为 `40/40` 全绿
- `npm run test:e2e` 已通过，当前 smoke suite 为 `23/23` 全绿
- API 校验已覆盖：无效 JSON、缺字段、未知 `spreadId`、未知 `cardId`、空 `drawnCards`、重复 `positionId`、重复 `cardId`、位置集合不完整、牌数不匹配、final 缺少 initial snapshot、Lite no-followup、final 主题延续、普通健康 safety_note
- Reading smoke flow 已覆盖：单牌、圣三角、四个面向、七张牌、凯尔特十字、Standard 两阶段、Lite 快速完成、历史回放、Tier 1 hard stop 与 Tier 2 sober check

这意味着：

- M1 / M2 不再只是方案层结论，而是已有代码、文档与回归支撑的已完成状态

## 6. 下一步建议

下一阶段建议不要重新打开 M1 / M2 / M3 的边界讨论，而是按“两条并行主线”继续推进：

1. 技术主线：保持 `POST /api/reading` 的 request / response contract 稳定，继续把 `npm run test:e2e` 作为前台 UX 改动后的 P0 真相门槛。
2. UX 主线：继续围绕 `docs/10-product/ux-risk-status.md` 校准 `R2 / R3 / R7` 的读感，确认组织随机说明清楚但不过重、证据分层能降低迎合错觉、建设性阻力有张力但不越界。
3. Runtime 主线：先观察现有 5 个运行时牌阵的前台组织效果，再决定是否需要新增高价值牌阵；当前不应马上继续扩 runtime spread。
4. Continuity 主线：P2 已进入边界设计阶段，见 `ADR-0004 Memory and Persistence Boundaries`。服务端 memory persistence、长期画像与 memory merge 继续暂缓；短期只维护 `session_capsule`、completed reading、future thread/session 与 long-term memory 的边界清晰度。
5. 只有当运行时明确暴露知识缺口时，再触发定向 ingest-wiki。

## 7. 成功标准（更新后）

当以下条件成立时，可以认为这份主线优先级文档已经与仓库现状对齐：

- 新同事进入仓库后，不会再把 `M1` 当成待启动事项
- 任何实现者都能清楚知道：`M1 / M2 / M3` 已完成，下一步是保持 contract 稳定并推进 M4 / UX 风险收口
- 任何实现者都能清楚知道：最小 LangGraph 技术边界、`2026-04-09` 启动的 UX 主线与 `2026-04-10` 资产 / Runtime Alignment 收口是并行关系
- 文档与当前仓库实物状态一致，不重复旧的 ingest 优先级叙事
- 优先级说明与 `README`、`docs/40-architecture/architecture.md`、`docs/30-agent/output-schema.md`、`docs/50-safety/safety-principles.md` 不冲突

## 8. 默认假设

- 文件名继续固定为 `mainline-priority-plan-2026-04-08.md`
- 文档语言默认为中文
- 这份文档继续作为 `memory/` 中的主线优先级入口
- 后续若扩展 M3 之后的 graph 能力，优先在本文件上增量更新执行状态，而不是重新起一份平行计划文档
