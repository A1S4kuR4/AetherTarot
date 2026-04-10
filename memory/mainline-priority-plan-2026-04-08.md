# Mainline Priority Plan

- `last_updated`: `2026-04-10`
- `owner`: `Codex`
- `scope`: `product mainline priorities after knowledge-layer phase`
- `execution_status`: `M1 completed / M2 completed / M3 next / M4 partial / UX track active`
- `verification`: `npm run build` passed, `npm run test:e2e -- --workers=1 --reporter=list` passed, `2026-04-09` Web CI 排障完成，`2026-04-10` 资产注入与校验流程记录于最新 work log

## 1. 当前状态快照

截至 `2026-04-10` 最新同步，项目主线已经从“知识层领先、运行时偏轻”推进到“运行时闭环已打通第一段，并形成并行 UX / Runtime Alignment 主线”的阶段。

知识层现状：

- `78/78` 牌义页已完成
- `10` 张概念页已完成
- `9` 张牌阵页已完成

运行时现状：

- `data/spreads/` 当前仍只上线 `single`、`holy-triangle`、`celtic-cross`
- `apps/web` 的 `/api/reading` 已返回结构化 `StructuredReading` 成功 payload
- `apps/web/src/server/reading/` 已建立服务层、provider 边界、schema 校验与安全后处理
- `reading` 页与 `history` 页已切到结构化输出消费，不再以 `interpretation: string` 为主协议
- 本地历史已升级为 `ReadingHistoryEntry`，使用 versioned localStorage key
- 前端百科仍直接消费 `data/decks/rider-waite-smith.json`
- `data/decks/rider-waite-smith.json` 已扩展到 27 张运行时牌：大阿卡纳 0-21 与权杖 Ace-5
- `apps/web/public/cards/` 已接入 28 张 1000x1700 PNG：27 张正面牌面与 1 张背面
- `data/decks/card-asset-manifest.json` 已记录 full-bleed 状态、视觉审核与 SHA-256
- 仓库当前仍没有 LangGraph 实装痕迹
- 当前仍没有服务端 history persistence，也没有拆分 `apps/api`

补充说明：

- 为了让 `celtic-cross` 与主流程能更稳定地真实跑通，运行时牌库已从早期示例牌扩展到 `27` 张；这仍不等于产品层面的完整 `78/78` 运行时牌库建设已经完成。

当前瓶颈已经不再是“先补更多知识页”，而是“在已稳定的结构化 reading contract 上接入最小 LangGraph 与后续运行时能力”。

`2026-04-09` 的补充更新表明，项目已经形成第二条并行主线：

- `Paper / Midnight` 双面设计系统成为当前 canonical UI 方向
- `HomeView`、`RitualView`、`RevealView`、`InterpretationView` 与 `JourneyView` 完成一轮 UX / 产品重构
- `ADR-0002` Dual-Tier Safety Escalation 已落地到当前文档真相层
- `sober_check` 与 `presentation_mode` 已进入正式 output schema
- Web CI、Playwright 与 cross-platform lockfile 问题已完成一轮系统排障

`2026-04-10` 的补充更新表明，`M4 Runtime Alignment` 已开始进入资产与数据层：

- 大阿卡纳 0-21 与权杖 Ace-5 已完成本地运行时数据和牌面资产注入
- 全站卡牌渲染比例已统一到 `1:1.7`
- 资产生成与校验已具备根命令：`npm run generate:assets` 与 `npm run validate:assets`

因此，当前瓶颈不再只有“技术主线尚未接图”，还包括“如何把已成立的仪式感、留存入口与安全摩擦进一步机制化为稳定产品体验”。

## 2. 主线优先级

### 已完成：P0. 后端 / Agent 接口层

目标：把 `/api/reading` 从 mock 文案接口升级为真实 reading backend 的稳定入口。

执行结果：已完成。

完成情况：

- Route 已切换为最小 request payload：`question`、`spreadId`、`drawnCards[]`
- Route 不再信任客户端传入整张牌或整套牌阵，而是在服务端用 `domain-tarot` 还原权威 `Spread` / `TarotCard`
- 接口已具备请求校验、服务层调用、错误返回与 provider 抽象
- 已为后续 LangGraph 接入保留稳定调用边界

### 已完成：P0. 结构化输出落地

目标：让接口返回值向 `docs/30-agent/output-schema.md` 靠拢，而不是只返回 `interpretation: string`。

执行结果：已完成。

完成情况：

- 当前成功响应直接返回 `StructuredReading`
- 已覆盖 `question_type`、`cards[]`、`themes`、`synthesis`、`reflective_guidance`
- 同时包含 `follow_up_questions`、`safety_note`、`confidence_note`、`session_capsule`
- 前端阅读页已按结构分块展示，不再依赖 markdown 作为主显示协议
- 历史页已保存并回放结构化 reading

### 当前第一优先级：P1. 最小 LangGraph 编排

目标：在真实后端接口稳定后，引入最小可用图，而不是先做复杂图。

固定顺序：

1. 问题分类
2. 上下文组装
3. 解读生成
4. 安全检查
5. 输出整形

当前判断：

- 这条顺序已经在现有 service pipeline 中以非 LangGraph 形式落地
- 下一阶段应直接把现有 pipeline 映射成最小图，而不是回头重写 payload、route 或 UI
- M3 的目标应是“接图”，不是“重新设计 schema”

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

- UX 主线与 `M3` 技术主线并行推进，不互相覆盖叙事
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
- 新增高价值牌阵仍未进入 `data/spreads/` + UI 联动上线流程
- 运行时牌库虽已扩展到 27 张并接入本地资产，但距离完整 `78/78` 运行时牌池仍有 50 张小阿卡纳缺口

### 保持降级：P2. 定向 ingest-wiki

目标：从“大规模持续补知识”切换为“按运行时缺口补知识”。

明确边界：

- 后续 ingest 只服务于真实解读质量问题、运行时新增牌阵、或知识缺口复盘
- 不再把 ingest 作为默认主线
- 除非 M3 / M4 暴露出明确缺口，否则不建议重新把主线拉回知识扩张

## 3. 已锁定的实现边界

以下边界已经在本阶段被实际实现或确认，不应在后续阶段轻易漂移：

- 首轮后端继续留在 `apps/web`，未拆 `apps/api`
- Route 只做 transport / validation / error mapping
- 实际 reading orchestration 已从 route 中抽离到服务层
- provider 当前为可替换占位实现，尚未接外部 LLM
- 安全边界已在生成后单独检查，不能只靠 prompt 约束
- 成功响应协议已稳定为 `StructuredReading`，短期内不应频繁改 shape
- `session_capsule` 本轮固定为 `null`
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

状态：未开始

建议进入条件：

- 保持现有 request / response contract 不变
- 以当前 service pipeline 为蓝本接入最小图节点
- 节点职责仅覆盖分类、上下文、生成、安全、整形，不额外扩图

### M4. Runtime Alignment

状态：部分启动

已启动部分：

- 阅读结果页已对齐结构化 schema
- 历史页已对齐结构化 reading contract
- `celtic-cross` 的抽牌与回放路径已能真实跑通
- 大阿卡纳 0-21 与权杖 Ace-5 已进入运行时牌组
- 本地牌面资产与 manifest 校验已形成闭环

待完成部分：

- 新增高价值牌阵
- 剩余 50 张小阿卡纳运行时数据与资产注入
- 百科 runtime 接入策略
- 针对真实运行时缺口的定向 ingest 回补

## 5. 验证结果

本轮主线执行后的关键验证如下：

- `npm run build` 已通过
- `npm run test:e2e -- --workers=1 --reporter=list` 已通过，当前 smoke suite 为 `19/19` 全绿
- API 校验已覆盖：无效 JSON、缺字段、未知 `spreadId`、未知 `cardId`、空 `drawnCards`、重复 `positionId`、重复 `cardId`、位置集合不完整、牌数不匹配
- Reading smoke flow 已覆盖：单牌、圣三角、凯尔特十字、历史回放、Tier 1 hard stop 与 Tier 2 sober check

这意味着：

- M1 / M2 不再只是方案层结论，而是已有代码、文档与回归支撑的已完成状态

## 6. 下一步建议

下一阶段建议不要重新打开 M1 / M2 的边界讨论，而是按“两条并行主线”继续推进：

1. 技术主线：以当前 `apps/web/src/server/reading/service.ts` 的流水线为蓝本接入最小 LangGraph
2. 技术主线：保持 `POST /api/reading` 的 request / response contract 稳定
3. UX 主线：继续围绕 `docs/10-product/ux-risk-status.md` 中的剩余风险做机制化收口，而不是再换一轮视觉方向
4. 在 M3 完成后，再决定百科是否接知识层、以及新增哪些高价值牌阵
5. 只有当运行时明确暴露知识缺口时，再触发定向 ingest-wiki

## 7. 成功标准（更新后）

当以下条件成立时，可以认为这份主线优先级文档已经与仓库现状对齐：

- 新同事进入仓库后，不会再把 `M1` 当成待启动事项
- 任何实现者都能清楚知道：`M1 / M2` 已完成，下一步是 `M3`
- 任何实现者都能清楚知道：`M3` 技术主线、`2026-04-09` 启动的 UX 主线与 `2026-04-10` 资产 / Runtime Alignment 收口是并行关系
- 文档与当前仓库实物状态一致，不重复旧的 ingest 优先级叙事
- 优先级说明与 `README`、`docs/40-architecture/architecture.md`、`docs/30-agent/output-schema.md`、`docs/50-safety/safety-principles.md` 不冲突

## 8. 默认假设

- 文件名继续固定为 `mainline-priority-plan-2026-04-08.md`
- 文档语言默认为中文
- 这份文档继续作为 `memory/` 中的主线优先级入口
- 后续若 `M3` 开始实施，优先在本文件上增量更新执行状态，而不是重新起一份平行计划文档
