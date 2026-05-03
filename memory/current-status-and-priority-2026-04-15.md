# 当前状态 + 优先级清单（2026-04-29 同步）

- `last_updated`: `2026-05-03`
- `owner`: `Codex`
- `scope`: `formal current-state snapshot and next-priority bridge between mainline and UX risk tracking`

## 1. 文档目的

本文件作为一份面向团队内部的正式状态文档，用来桥接：

- `memory/mainline-priority-plan-2026-04-08.md`
- `docs/10-product/ux-risk-status.md`

目标是用一页内容回答三件事：

1. 项目现在已经完成到哪里
2. 当前真实阻塞点是什么
3. 下一轮工作该按什么顺序推进

本文档基线以 `2026-04-29` 的仓库实物、本地验证结果、beta ops 收口记录与 UX trust risk closeout 记录为准，不再复述旧状态作为当前事实。

## 2. 当前状态快照

截至 `2026-04-29`，AetherTarot 已经不再处于“缺核心架构”的阶段，而进入了“主链已成、运行时牌池已完整、cardsV2 已切入 runtime、连续性边界开始收紧、5 个牌阵已有差异化读感轴线、第一轮内测风控与观测已接入、快速解读与可信路径正在观察”的阶段。

当前可确认的事实如下：

- reading 主链已闭环：`POST /api/reading`、结构化 `StructuredReading`、Two-Stage Reading MVP、最小 LangGraph 与 Dual-Tier Safety 已落地。
- Web 主流程已存在并能构成完整体验：`/`、`/new`、`/ritual`、`/reveal`、`/reading`、`/journey`、`/history`、`/encyclopedia`、`/login`、`/admin` 均已接入当前应用。
- 后端与前端回归当前健康：`npm run test:contract -w @aethertarot/web` 通过（74 个 tests），`npm run test:e2e -w @aethertarot/web` 通过（32 个 tests），`npm run lint -w @aethertarot/web` 通过（0 errors / 12 warnings），`npm run build -w @aethertarot/web` 通过。此前旧数字只作为对应日期 work log 的历史快照，不再作为当前状态入口。
- Playwright 用例已对齐当前完整仪式路径、快速解读路径、sober check、hard stop、history / journey、五个牌阵与 encyclopedia 过滤；测试环境通过 e2e-only beta access bypass 避免依赖真实登录和 quota，且 production 下该 bypass 无效。

知识层现状：

- `knowledge/wiki/major-arcana/`：`22` 页
- `knowledge/wiki/minor-arcana/`：`56` 页
- `knowledge/wiki/concepts/`：`10` 页
- `knowledge/wiki/spreads/`：`9` 页

运行时现状：

- `data/decks/rider-waite-smith.json` 当前包含完整 `78` 张运行时牌：Rider-Waite-Smith 全牌池已接入
- `apps/web/public/cardsV2/` 当前包含 `79` 个文件：`78` 张正面牌面与 `1` 张背面；旧 `apps/web/public/cards/` 暂时保留但不再作为当前 runtime imageUrl 来源
- `data/spreads/` 当前已上线 `single`、`holy-triangle`、`four-aspects`、`seven-card`、`celtic-cross` 五个运行时牌阵，其中 `four-aspects` 与 `seven-card` 已完成 `/new -> /ritual -> /reveal -> /reading -> /journey` 全链路接入
- hard-stop 示例资源已替换为中国大陆固定的真实危机 / 心理支持入口，并补入 continuity capsule 的高风险细节净化
- Reading 页已完成第一版“证据感阅读体验”收口：逐牌展示显式拆为“牌面线索 / 位置语义 / 综合推断”，用于缓解 R3 迎合错觉，并保持现有 `StructuredReading` schema 不变
- `/reveal` 与 `/reading` 已补入第一版“牌阵如何组织随机”机制说明：随机决定牌面与正逆位，牌阵决定阅读顺序、位置语义与综合路径；该机制缓解 R2，但不宣称用户能操纵随机
- reading provider / LLM prompt 已加入第一版“建设性阻力”规则：reading 至少保留一个来自牌面、正逆位、位置语义、牌阵张力或现实未验证条件的非迎合观察点；后续读感校准已让不同问题类型使用不同阻力表达，避免退回同一句模板；该规则缓解 R7，但不改变 safety layer 或输出协议
- `2026-04-25` 已完成 P1 轻量体验收口：`/reveal` 与 `/reading` 共用 5 个牌阵的 `spreadExperience` 前台口径，reading 机制区显式强化“牌面线索 -> 位置语义 -> 综合推断”的证据路径；provider / prompt bias 已补齐 5 个牌阵的 spread-specific reading axis；本轮没有新增牌阵、没有改变 `POST /api/reading` contract、没有改变 `StructuredReading` schema、没有打开服务端 persistence 或 memory merge
- `2026-04-25` Runtime Alignment 小步推进已完成：Encyclopedia 继续消费 runtime deck JSON，但补全 wands / cups / swords / pentacles 四花色过滤与 runtime / knowledge 覆度展示；`scripts/validate-card-assets.mjs` 已增加 `78` 张 deck 与 `79` 条 manifest entries 的显式数量守卫
- `2026-05-03` Encyclopedia 已新增第一版塔罗百科 Agent：`/encyclopedia` 内嵌问答面板，`POST /api/encyclopedia/query` 从 `knowledge/wiki` 检索牌义 / 概念 / 牌阵页面，经独立 LLM provider 生成带来源回答；该能力复用 beta access、独立百科 quota 与 `encyclopedia_events`，但不改变 `/api/reading`、`StructuredReading`、history 或 memory
- `/new` 已把明显重大现实决策类提问的前置提醒推进为现实边界确认：用户需先确认塔罗只用于整理线索，现实信息、专业意见与个人底线优先，才能进入抽牌仪式；服务端 Tier 2 `sober_check` 仍保持独立
- `/new` 已新增非阻断的重复主题提醒：基于本地 completed history 中最近若干条相同 `question_type` 的记录，提示用户先回看上一条线索；该机制不启用服务端 persistence、不打开 memory merge，也不改变 `POST /api/reading` 协议
- `/new` 已新增快速解读入口：用户只输入问题即可用 `lite` profile 自动抽牌并直达 `/reading`；未选择牌阵时默认单牌启示，已选择牌阵时尊重当前牌阵；快速路径继续复用重大现实决策确认、服务端 hard stop 与 `sober_check`
- `/reading` 已从首屏“核心主题聚焦”推进为“核心速读 + 三层可信路径”：一句核心判断、关键词、行动提醒与边界提醒均从既有字段派生，不新增 schema；可信路径区分“你说了什么 / 牌本身说了什么 / 如何连接二者”
- `/api/reading` 已接入 Supabase session、`beta_testers` 白名单、邮箱/IP/每日 LLM 成本 quota、失败观测与明确错误码；`/admin` 与 `/api/admin/*` 要求 `role = admin`；admin 可绕过 reading quota 但仍记录 observability
- `/api/encyclopedia/query` 已接入 Supabase session、`beta_testers` 白名单、邮箱/IP/每日 LLM 成本 quota、失败观测与明确错误码；百科问答只回答知识解释，不作为第二条 reading 链路
- 本地 Supabase 端口已迁到 `5542x`，magic-link 本地进入 Mailpit；当前第一轮内测 LLM baseline 为 DashScope OpenAI-compatible `qwen3.6-flash`，真实 key 通过服务端环境变量引用

这意味着当前主瓶颈已经不是“知识是否足够”，也不是“继续立刻扩 runtime / memory”，而是：

- 现有 5 个运行时牌阵、快速路径与可信路径已经进入产品机制观察期，但仍需继续观察是否清楚、不过载、不过度模板化
- 文档是否持续与仓库实物同步
- 第一轮内测风控与观测是否能支撑真实 tester 使用与质量反馈
- 长期连续性能力是否能先守住边界，不提前打开服务端 persistence、memory merge 或长期画像

## 3. 能力状态分层

### 已完成

- Reading backend 主链
- Structured output 协议
- Two-Stage Reading MVP
- Dual-Tier Safety
- `placeholder + llm baseline` provider 边界
- Supabase beta access / quota / admin / observability
- 快速解读、核心速读与三层可信路径
- Home / Ritual / Reveal / Reading / Journey 第一轮 UX 重构

### 部分完成

- Runtime Alignment
- Encyclopedia 与知识层对齐
- 历史复访价值
- UX 风险关闭
- 文档与仓库实物同步

### 未完成

- 服务端持久化
- 服务端级 continuity / `session_capsule` merge 策略
- 长期记忆 / memory merge
- 多 provider router
- 更多高价值运行时牌阵与 position semantics 收口

## 4. 当前真实阻塞点

### 阻塞点一：文档漂移需要持续压低

`2026-04-29` 已完成一轮文档漂移复核，确认主要风险集中在状态入口、provider baseline、快速路径和测试数字同步上。

典型信号：

- 当前仓库实物已是运行时牌库 `78` 张、`cardsV2` 文件 `79` 个
- 当前 Web 已有快速解读、核心速读、三层可信路径、beta access / quota / admin / observability
- 旧验证数字和旧 provider baseline 只能作为历史 work log 的时间切片，不应再出现在当前状态入口中

这不应被视为次要维护工作，而应视为主线风险，因为它会直接影响优先级判断与后续协作理解。

### 阻塞点二：运行时牌阵与知识消费边界仍未收口

当前最大产品缺口不是 UI 页面缺失，而是：

- 运行时牌阵扩展仍只推进到 `5` 个
- Encyclopedia 仍以 deck JSON 作为卡牌浏览 authority，同时已通过独立百科 Agent 消费 `knowledge/wiki` 作为问答来源；reading 主链仍不直接消费 wiki

### 阻塞点三：长期连续性能力仍缺位

历史、Journey 与两阶段 reading 已经形成产品雏形，但长期连续性能力仍未真正开始：

- history 仍是 localStorage
- `session_capsule` 已限定为 completed reading 才生成，且会先做模板收敛与高风险细节净化
- 尚未定义服务端 persistence、memory merge 与长期画像边界

## 5. 当前优先级清单

### P0. 保持可信回归与真相同步

状态：已恢复。当前最新本地复核为 contract 74 个 tests 通过、e2e 32 个 tests 通过、lint 0 errors / 12 warnings 与 build 通过。

已完成：

1. 修复 Playwright 失效用例，使 E2E 与当前 `/new -> /ritual -> /reveal -> /reading -> /journey` 实际流程一致。
2. 在 Playwright 测试环境固定 `AETHERTAROT_READING_PROVIDER=placeholder`，避免本地 `llm` 配置影响回归稳定性。
3. 同步 README、memory、UX 状态文档中的旧数字与旧叙事。
4. 为 Web smoke 增加 ReadingProvider hydration 等待与 `/new` 表单逐项状态断言，修复 `startReading()`、follow-up 表单与受保护路由 redirect 的等待不稳定。
5. 为 R2/R7 UX 改动补充 smoke 与 semantic fixture 回归，并确认完整 Web smoke 可稳定覆盖当前主路径。
6. `2026-04-29` 再次复核 contract、e2e、lint 与 build，确认快速路径、sober gate、hard stop、five-spread flow、admin / quota 相关测试都已进入当前基线。
7. Web CI 已把 `npm run test:contract` 纳入 lint/build job；生产环境缺少 `AETHERTAROT_IP_HASH_SALT` 时 fail fast，避免 IP hash 在 production 静默使用开发默认 salt。

后续要求：

- 继续保持全套 E2E 绿色，若再次失败必须记录新的失败用例、失败断言与通过数量
- 新 UI / 新流程改动必须同步更新 smoke 断言
- 文档中的运行时牌库与资产数字必须继续跟仓库实物对齐
- beta access / quota / observability 相关改动必须区分 production 语义与 e2e-only bypass

### P1. Runtime Alignment 收口

目标：在完整牌池之上继续收口运行时能力与前台理解机制，而不是回到“继续大量扩知识页”的旧主线。

当前补充进展：

- 已在 Encyclopedia 前台显式补出 runtime / knowledge 覆度状态，并明确显示当前为 `78/78` runtime vs `78/78` knowledge
- 当前已明确：Encyclopedia 浏览层继续直接消费 runtime deck JSON；百科问答层开始消费 `knowledge/wiki`，并通过来源列表让知识层进入产品体验
- `knowledge/wiki` direct consumption 目前只用于独立百科 Agent，不注入 reading provider，不与运行时牌阵扩展混做
- `four-aspects` 与 `seven-card` 已上线，并补齐了 authority、前台布局、contract 与 Playwright smoke 回归
- R2/R7 已完成第一版前台机制与生成语气收口：组织随机与建设性阻力都复用现有 schema，不打开服务端 persistence，不新增运行时牌阵
- R3 已进一步通过“核心速读 + 三层可信路径”收口，但真实用户是否理解仍需继续观察

执行项：

1. 运行时牌库与本地资产已完整收口到 `78/78`；P1 的下一步不再是补牌，而是观察现有 5 个牌阵的前台组织机制是否足够清楚。
2. 新增牌阵继续暂缓；只有当 R2/R3/R7 的前台体验稳定后，才重新评估高价值牌阵与对应 position semantics。
3. 观察 Encyclopedia Agent 的来源命中、回答边界与成本表现，再决定是否增加更强的 wiki 页面路由或阅读页旁路入口。

### P2. 长期连续性能力设计

目标：在不打断当前 contract 稳定性的前提下，先定义后续 memory / persistence 边界。

状态：已启动边界设计，仍不进入服务端持久化实现。

`2026-04-26` 已新增 `ADR-0004 Memory and Persistence Boundaries`，并同步 `context-strategy`、`architecture`、`output-schema` 与 `rubrics`。当前结论是先把当前任务状态、本地 completed history、`session_capsule`、future thread/session persistence、future long-term memory 分层，不把它们合并成一个泛化 memory bucket。随后新增 `docs/30-agent/memory-persistence-roadmap.md`，把 P2 拆成 P2.1 capsule contract hardening、P2.2 thread/session RFC、P2.3 long-term memory RFC 与 P2.4 memory merge design。P2.2 RFC 草案已新增为 `docs/30-agent/thread-session-rfc.md`。

执行项：

1. `session_capsule` 接入点已定义：仅 completed reading 产出，仍为 `string | null`，显式 opt-in 带入下一轮，并在服务层净化后作为低优先级 continuity context。
2. 历史 completed reading 与 future thread/session 的边界已定义：localStorage history 是 replay cache；`reading_id` 只标识 reading artifact，不能复用为 `thread_id`、`session_id` 或 `user_id`。
3. 服务端 history persistence 与长期记忆的演进顺序已定义为暂缓：后续必须先明确 identity、读写规则、merge / overwrite / eviction / deletion、安全净化与测试边界。
4. P2.1 capsule contract hardening 已完成当前基线：新增 section/length/identity-field absence 测试，并加强 completed capsule 对 `用户补充` 标签与急性情绪细节的清洗。
5. P2.2 Thread / Session RFC 已完成草案：推荐未来若开启服务端连续性，优先以 `thread_id` 表示用户主动选择的一条 reading line；`session_id` 继续暂缓；RFC 不改变当前 `/api/reading` contract。

下一步建议：

1. 继续观察本地 continuity 体验，不立刻接服务端 persistence。
2. 只有当跨设备或服务端连续性成为明确产品需求时，才把 P2.2 RFC 升级为实现计划。
3. 长期画像与 memory merge 继续暂缓，直到用户授权、审查和删除模型成立。

在此之前，不打开大规模 memory / thread / profile 持久化实现。

## 6. 当前判断与执行原则

- 当前最该做的不是重新打开 `M1 / M2 / M3` 讨论，而是维护 contract 稳定性，并把重心转向 runtime alignment 与长期连续性设计。
- 当前不应回退去把 ingest 重新设为默认主线。
- 当前不应把 memory persistence 提前到回归修复之前。

## 7. 验收口径

本文件中的状态判断默认以以下事实为依据：

- 状态数字来自当前仓库实物：
  - `data/decks/rider-waite-smith.json`
  - `apps/web/public/cardsV2/`
  - `knowledge/wiki/*`
- 健康度结论来自当前本地验证：
- `npm run build`：通过
- `npm run test:contract -w @aethertarot/web`：通过（74 个 tests）
- `npm run test:e2e -w @aethertarot/web`：通过（32 个 tests）
- `npm run test:contract -w @aethertarot/web -- src/server/reading/__tests__/semantic-fixtures.spec.ts`：通过（`12/12`，`2026-04-25` 复核）
- `npm run lint -w @aethertarot/web`：通过（`0` errors，`12` existing-style warnings，`2026-04-29` 复核）
- `npm run validate:assets`：通过（`78` tarot cards plus card back in `apps\web\public\cardsV2`）
- `npm run test:llm -w @aethertarot/web`：通过（`2026-04-27`，DashScope `qwen3.6-flash` live smoke）

## 8. 默认假设

- 文档语言默认为中文
- 文档定位为内部执行入口，不写成对外宣传稿
- 优先级固定为：先保持可信回归与文档同步，再收口牌阵与运行时体验，再开长期连续性能力
- 本文件作为 `memory/` 中的正式桥接入口存在；后续若主线状态变化，应优先增量更新本文件，而不是再平行创建一份新的“当前状态”文档
