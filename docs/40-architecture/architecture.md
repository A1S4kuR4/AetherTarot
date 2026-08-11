# 系统架构（Architecture）

## 1. 文档目的

描述 AetherTarot 的核心系统分层、信息流与边界，让开发者和代码 Agent 能快速理解“哪些规则属于哪里”。

---

## 2. 架构目标

- 支持长上下文、多轮会话和结构化输出
- 将 transport、编排、领域规则、安全检查与前端展示解耦
- 支持两阶段 reading flow、后续多 provider，并已接入最小 LangGraph 编排
- 支持 Codex 这类代码 Agent 长期维护

---

## 3. 当前分层

### 产品 / 应用层

负责：

- 用户交互
- Agent Profile 选择
- 问题输入
- 线上抽牌展示与线下实体牌录入
- 初读、追问与整合深读渲染
- 本地历史记录、账号级 completed reading 历史记录与回放

当前落地：`apps/web`

### BFF Route 层

负责：

- `POST /api/reading` 的 request parsing
- `POST /api/encyclopedia/query` 的 request parsing
- 内测 Credentials 登录、邮箱白名单与 admin 角色校验
- reading 调用前的用户每日次数与共享 IP 分钟防刷检查
- encyclopedia query 调用前的用户每日次数与共享 IP 分钟防刷检查
- 输入 schema 校验
- `draw_source` 兼容解析
- 错误映射
- reading 请求观测事件记录
- HTTP response 返回

边界：只做 transport / access control / quota / validation / response mapping / telemetry，不直接拼装解读内容。

### Reading Service 层

负责：

- 问题分类
- Agent Profile / phase 归一化
- 权威牌阵 / 牌面上下文还原
- 线上随机与线下录入两种 `drawnCards[]` 来源的统一校验
- initial/final 阶段验证
- `prior_session_capsule` continuity context 注入与安全净化
- provider 调用
- 安全分级检查 (Dual-Tier Safety Checks)
- completed reading 的 `session_capsule` 生成
- 最终 schema 校验

当前落地：`apps/web/src/server/reading/`

当前实现：`generateStructuredReading()` 保持 service 入口不变，内部委托最小 LangGraph。P1 起，图节点在 provider draft 生成前加入 `reading_agent_core`，用 closed action set 和条件边实现最小受控 agent loop；它不改变 `/api/reading` 的单入口 contract，也不引入 checkpoint、streaming、interrupt 或多 Agent。P2 起，`retrieve_knowledge` 不再直接调用局部函数，而是通过 Reading Tool Registry + Tool Executor 执行正式注册工具，并写入内部 `tool_calls[]` audit。P6 起，`get_session_memory` / `write_session_memory` 也通过同一 registry/executor 读写同一 `thread_id` 下的结构化短期 memory。

P2 memory / persistence 边界：

- Reading Service 可在 request 提供 `thread_id` 时读写 P6 thread-level `SessionMemory`；该 memory 仅为当前 thread 的短期结构化摘要，不是 user memory。
- Reading Service 仍只消费 request 侧显式传入的 `prior_session_capsule`，不主动读取服务端 completed history、thread checkpoint 或 user profile。
- `prior_session_capsule` 必须先经过服务层净化，才能进入 provider context。
- completed `session_capsule` 是输出协议字段，不是 thread/session/user identity。
- 账号级 completed history replay 与 user-scoped Postgres Thread Memory 已实现；跨 thread 长期画像、long-term memory merge 与 LangGraph checkpoint 仍未实现。

主链当前由 LangGraph 业务节点承载；schema validation 是分布在组装、安全复核与 capsule 附着节点中的协议守卫，不是独立 graph 节点：

1. 问题分类，并读取 `agent_profile` / `phase` / `prior_session_capsule`
2. canonical context 组装
3. final 阶段一致性验证（仅 `phase = final`）
4. 意图摩擦分析（标记 pass / sober_check / hard_stop；服务端条件边将 hard_stop 直接送入 `safety_stop` 并抛出 403）
5. 仅非 hard-stop 状态进入 `agent_decider`，选择 `retrieve_knowledge`、`get_session_memory`、`request_clarification` 或 `final_answer`
6. `retrieve_knowledge` 批量检索全部牌并写入 observation/tool audit；同一 thread 可先读 memory；`request_clarification` 与 `safety_stop` early exit
7. `ensure_minimum_grounding` 强制补齐每张牌的 Wiki 或 authority fallback 后，才进入 provider
8. provider.generateInitialRead 或 provider.generateFinalRead
9. provider draft contract validation（cards 顺序 / identity / orientation 与 authority context 一致，follow-up 数量符合 phase/profile；同时规范重复句号并拒绝来源元数据、内部阶段说明与单牌伪路径）
10. structured reading 组装（包含阶段元数据、200 Sober Check 拦截标注与 `presentation_mode` 派生）
11. mandatory generated-content validation：扫描所有用户可见 provider 字段，按风险替换局部字段或整份正文
12. input-driven safety review：按共享安全分类补充 `safety_note` 并收窄 guidance / follow-up
13. citation finalizer 校验 claim path/ref/card/orientation，并在安全改写或无效引用后确定性修复
14. completed reading 的 `session_capsule` 生成；登录请求带 `thread_id` 时通过 `write_session_memory` 写入本 thread；最后通过统一 schema 校验后返回

Agent core 的内部 state 包含 `agent_step_count`、`max_agent_steps`、`agent_actions[]`、`observations[]`、`tool_calls[]`、`pending_clarification`、`grounding_status` 与可选 `sessionMemory`。Generation 还可使用 invocation-only 的 mode、plan、stage、attempt、usage 与 failure subtype。Raw diagnostics 不进入公开错误 envelope；生产仅把去正文、去标题、去 decision reason 的 `PersistedReadingTraceV3` 写入 `reading_events`。公开成功协议只新增可选 `StructuredReading.grounding`。

### Encyclopedia Agent Service 层

负责：

- 从 `knowledge/wiki` 读取牌义、概念与牌阵页面
- 通过 Reading/Encyclopedia 共用 Wiki 基础层解析 frontmatter、段落/列表 claim 与 inline 来源 ID
- 根据用户问题与当前选中 `cardId` 做确定性检索
- 将 top sources 注入 OpenAI-compatible LLM，生成带来源的百科回答
- 在 quota 与 provider 前复用统一安全分类；Tier 1 返回 `403 safety_intercept`
- 对第三方读心、重大现实决策、健康、法律、财务与非即时受害者求助加入百科边界提醒
- provider answer 通过同一强制生成内容验证策略后才返回
- 返回独立的 `EncyclopediaQueryResponse`

当前落地：`apps/web/src/server/encyclopedia/` 与 `POST /api/encyclopedia/query`。

边界：百科 Agent 只解释“牌 / 概念 / 牌阵是什么意思”，不抽牌、不生成 `StructuredReading`、不写入 history 或 memory，也不把 `knowledge/wiki` 直接注入 reading provider。它可以使用同一 OpenAI-compatible LLM baseline，但必须保持与 `/api/reading` 主链隔离。

### Provider 层

负责：

- 根据服务配置选择实际解读生成器
- 将统一的 reading context 转换为结构化 reading draft
- 区分 initial read 与 final read 的生成语义

当前阶段：默认启用 `placeholder` provider，并新增一个可选的单 `llm` baseline。`llm` provider 通过 OpenAI-compatible `chat/completions` HTTP 调用接入。`AETHERTAROT_LLM_MAX_OUTPUT_TOKENS` 是默认 `3200` 的环境硬上限；每次 reading 再按 profile 与牌数选择推荐预算，并取二者较小值：

| 牌数 | Lite | Standard | Sober |
| --- | ---: | ---: | ---: |
| 1 | 900 | 1400 | 1800 |
| 2–4 | 1400 | 1900 | 2300 |
| 5–7 | 1800 | 2400 | 2800 |
| 8–10 | 2200 | 2800 | 3200 |

同一个实际预算同时用于全站每日 token reservation 与 provider `max_tokens`。Provider 响应后按实际 usage（缺失时按保守估算）结算并记录耗时、token usage 与估算成本；若 `finish_reason = "length"`，观测记录 `output_truncated`，完成 reservation 结算并返回明确的 `generation_failed`，截断内容不得进入普通 JSON 解析路径。

`monolithic` 分支保持一次内部 Provider 调用。`adaptive_staged` 分支对每个 stage 最多执行
两次 transport：可恢复 transport 类错误做同 stage retry，合同类错误做受限 repair。
每次 attempt 独立 reserve/settle，取消、非 429 的 4xx、安全与 token/quota 拒绝不重试。
这仍不引入 Provider Router、多模型分层、streaming 或 checkpoint。

### Beta Ops / Observability 层

负责第一轮内测的付费 LLM 风险收口：

- Auth.js Credentials provider 是唯一认证系统；用户在 `/login` 输入邮箱密码，密码以 scrypt 哈希存储在 Supabase
- Supabase 只保留数据库、RPC、quota 与 observability 能力，不再使用 Supabase Auth
- `app_users` 将用户邮箱映射为内部 `user_id`，避免把外部身份 subject 直接写入业务表
- `beta_testers` 是 tester / admin 白名单真相源
- `usage_counters` 通过 Supabase RPC 原子消费按认证 `user_id` 或匿名 salted IP hash 区分的 reading / encyclopedia 日限与共享 IP 分钟防刷；reading 的 initial 预占一次完整解读日额度，合法 final 不重复扣日额度
- `llm_daily_token_usage` / `llm_token_reservations` 通过 RPC 预占并结算北京时间自然日内的全站 LLM token 硬上限
- `reading_events` 记录请求量、用户数、phase、成功/失败、耗时、token 与成本
- `encyclopedia_events` 记录百科问答请求量、来源数、成功/失败、耗时、token 与成本
- `reading_feedback` 记录 completed reading 的轻量质量反馈；登录用户按 `user_id`、游客按 salted IP hash 校验 reading 归属，并限制同一主体每次 reading 只提交一次
- `growth_events` 保存首方 UTM 归因和 `page_view / reading_started / reading_completed / feedback_submitted` 四阶段漏斗；只保存 referrer hostname，不保存完整来源 URL、页面 query 或解读正文
- `stored_readings` 记录登录账号的 completed reading 回放数据，按 `user_id + reading_id` 唯一约束幂等保存；列表读取必须限量，默认最近 50 条
- `/admin` 与 `/api/admin/*` 只允许 `role = admin`
- `role = admin` 账号用于维护和压力测试，跳过个人次数与 IP 分钟防刷；真实 LLM 调用仍计入全站每日 token 硬上限，也不跳过登录、白名单、admin 鉴权或 telemetry

该层不改变 `StructuredReading` 成功响应协议，不读取或改写塔罗解释内容，也不替代 Reading Service 的安全边界。`stored_readings` 只服务账号级 history replay，不作为 Reading Service 的 provider context、thread memory 或长期用户画像来源。

### 领域规则层

负责：

- 牌义规则
- 牌阵规则
- 解释框架
- 问题分类规则
- 风格与边界规则

当前落地：`packages/domain-tarot` + `docs/20-domain/`

### 知识层

负责：

- 原始知识源保存
- wiki 化知识沉淀
- 索引与日志
- 人工 / Agent 共编修订

当前落地：`knowledge/`

### 评测与治理层

负责：

- 结构化输出回归
- 两阶段状态回归
- 安全检查回归
- 质量评测与失败归类
- 文档与实现同步

### Future Persistence 层（P2 设计，部分实现）

当前已实现的 `stored_readings` 只属于账号级 completed reading replay，并是登录账号的 canonical
history source；账号内容不写 guest localStorage。浏览器 outbox 只承接未确认同步的账号 completed
entry，成功后删除，不自动注入 provider，也不是 thread checkpoint 或长期用户画像。账号 outbox 与
guest history 都用 Web Locks 包住完整读-合并-写事务；锁或本机存储失败会显式显示，不能降级为可能覆盖其他标签的顺序写。

未来若引入 thread/session persistence 或 long-term memory，应拆成独立边界，而不是并入现有
localStorage history、`stored_readings` 或 `session_capsule`：

| Future layer | 作用 | 身份边界 | 当前状态 |
| --- | --- | --- | --- |
| Thread / session persistence | 恢复一条 reading line 或短期会话 | `thread_id` / `session_id`，不得复用 `reading_id` | 暂缓 |
| Long-term user memory | 保存稳定偏好、授权背景与反复主题 | `user_id`，不得从本地 history 静默推导 | 暂缓 |
| Memory merge | 合并稳定记忆、处理冲突和删除 | 必须定义 merge / overwrite / eviction / deletion | 暂缓 |

该层只能向 provider 注入摘要化、净化后的 context。它不能绕过 reading service 的 canonical context、safety review 或 output schema。

P2.2 RFC 当前推荐：如果未来开启服务端连续性，优先设计 `thread_id` 作为用户主动选择的一条 reading line；`session_id` 继续暂缓，除非需要恢复未完成的短期流程。该 RFC 不改变当前 `/api/reading` contract，见 `docs/30-agent/thread-session-rfc.md`。

---

## 4. 当前 reading 数据流

1. 用户输入问题、选择 Agent Profile、选择牌阵，并选择线上抽牌或线下实体牌录入
2. 前端完成线上随机抽牌，或按牌阵位置录入线下实体牌与正逆位
3. 前端提交 `question + spreadId + drawnCards + draw_source + agent_profile + phase + prior_session_capsule?`
4. Route 进行访问主体解析、请求大小 / schema 校验与次数/IP 突发 quota 消费；`initial` 预占一次完整解读日额度，已通过服务端 snapshot 校验的 `final` 不重复扣减日额度但仍计入共享 IP 分钟防刷；未登录访客可按 IP hash 每日完成 3 次完整解读，已登录用户仍需通过 `beta_testers` 白名单；非白名单、普通 tester 访问 admin 或超限时直接返回结构化错误，不进入 provider
5. Service 委托最小 LangGraph，图节点依次执行分类、权威上下文组装、final 验证、意图摩擦分析、受控 agent decider / tool executor loop、generation policy、provider draft、结构化组装、生成内容验证、输入安全复核、citation finalizer、thread memory 写入与最终 schema 校验
   当前 graph 会在 provider draft 之后先执行一层 contract validation，防止 provider 越权改牌、乱序输出或返回不符合 phase/profile 的 follow-up 数量。
6. 若意图摩擦遇生死危机、紧急健康或操控类请求，图节点抛出 `ReadingServiceError(403 safety_intercept)` 并直接断开生成链路
7. 若遇重大决策依赖，记录降级状态，返回 `200` reading，并写入 `sober_check` 与 `presentation_mode = sober_anchor`
8. Provider 按 generation mode 生成 monolithic、compact、card-insight+synthesis 或 Final refinement draft；若存在 `prior_session_capsule`，它会先在服务层移除 `用户补充` 类原始细节以及自伤/他伤、操控、第三方意图猜测、紧急健康等高风险内容，再作为低优先级 continuity context 注入 provider；若本轮通过 `get_session_memory` 读取到同 thread 短期 memory，也只作为低优先级追问背景注入 provider
9. Mandatory generated-content validator 扫描 cards interpretation、themes、synthesis、guidance、follow-up 与 confidence note；危险原文被替换后才进入 input-driven safety review
10. 只有 completed reading 会生成 `session_capsule`；`standard / sober initial` 继续固定为 `null`，且 completed capsule 会被模板化压缩为“问题 / 牌阵 / 核心主题 / 延续主轴 / 边界提醒”
11. 若 request 带有 `thread_id`，成功 reading 会通过 `write_session_memory` 写入结构化 thread memory；clarification、safety_stop 与生成失败不写入完整 memory
12. 结果通过统一 schema 校验后返回前端 (`HTTP 200`)
13. 真实 LLM provider 在外部请求前预占当日 token，结束后以 usage 或保守 fallback 结算；Route 记录 reading event 与估算成本
14. 前端对 `requires_followup = true` 的 initial reading 展示追问，不写入 history；游客的 final/Lite completed reading 通过跨标签事务写 guest localStorage；账号写服务端，失败时进入 identity-scoped outbox 并可重试
15. completed reading 向登录用户和游客展示“有帮助、太模板、太迎合、没回答问题”反馈入口；服务端核验同一用户或同一 IP hash 的 completed reading 后写入 `reading_feedback`，供 `/admin` 汇总
16. 首次落地时捕获并清洗 UTM，随后使用随机 attribution / session / flow ID 串联访问、开始解读、完成解读和反馈提交；事件写入 `growth_events`，`/admin` 可按 `utm_source` 查看漏斗

---

## 5. 边界原则

- `apps/web` 仍是唯一活跃应用，当前不拆 `apps/api`
- Route 不能重新承载业务真相
- 安全规则必须在生成前和生成后分别检查，不能只靠 prompt 自觉
- Reading 与 Encyclopedia 必须共享同一输入分类；生成内容验证必须是不可跳过的 service node，而不是 agent 可选 tool
- hard-stop 危机转介当前按中国大陆固定资源顺序提示：`120` -> `110` -> `12356`
- 前端不再依赖 markdown 作为主协议
- 历史记录只保存 completed reading，Standard/Sober initial 不入 history
- 不引入 LangGraph session checkpoint；Final 只提交 `initial_reading_id`，服务端恢复并
  claim canonical Initial snapshot，客户端 Initial 正文不可信
- 登录用户的结构化 Thread Memory 与账号级 completed history replay 已实现，但仍不
  代表 session checkpoint persistence 或 long-term memory
- `reading_id` 只标识一次 reading artifact，不可复用为 `thread_id`、`session_id` 或 `user_id`
- guest localStorage history 是当前浏览器 replay store；账号 canonical history 是服务端 `stored_readings`，两者不回退、不自动迁移
- `/new` 未提交问题草稿按身份分区：guest localStorage、账号 identity-controlled sessionStorage；旧全局 key 只删除不导入，任何草稿都不作为 reading draft、history、capsule、thread memory 或额外 provider context
- `stored_readings` 是账号级 replay store，不是自动 memory 注入来源；同一 `user_id + reading_id` 必须幂等保存，列表必须安全限量
- `session_capsule` 是 completed reading 的低优先级 continuity summary，不是长期画像或 thread checkpoint
- P6 `SessionMemory` 是同一 `user_id + thread_id` 内的 Postgres 短期结构化摘要；它
  不是长期画像、LangGraph checkpoint 或跨 thread personalization
- 线下塔罗模式不得新建第二套解读链路；它只能作为 `drawnCards[]` 输入来源进入同一 `POST /api/reading` contract
- 新增 provider、扩展 LangGraph 节点或引入更复杂 graph 能力时，应复用现有 service 边界，而不是从 route 重新起一套流程
- 第一轮内测期间，`/api/reading` 允许未登录访客按 IP hash 每日完成 3 次完整解读，`/api/encyclopedia/query` 允许每日体验一次；已登录访问必须要求 `beta_testers` 白名单，Cloudflare Access 只能作为站点门禁，不能替代应用内 quota
- `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY` 与 `AETHERTAROT_LLM_API_KEY` 只能在服务端读取，不得使用 `NEXT_PUBLIC_` 前缀；错误响应不得返回 env 值或完整密钥
- 事件统计窗口、每日次数与全站 token 上限均按 `Asia/Shanghai` 自然日计算；百科事件不得持久化原始用户提问

---

## 6. 待补充

- [x] 部署拓扑与生产配额 / 保留规则（见 `docs/70-ops/production-deployment.md`）
- [x] provider 配置说明（见 `docs/70-ops/dev-setup.md` 的 llm baseline env 变量）
- [x] session capsule、completed reading、future thread/session 与长期记忆边界设计（见 `docs/80-decisions/adr/0004-memory-and-persistence-boundaries.md`）
- [x] memory persistence roadmap 与测试矩阵（见 `docs/30-agent/memory-persistence-roadmap.md`）
- [x] P2.2 Thread / Session RFC 草案（见 `docs/30-agent/thread-session-rfc.md`）
- [x] P6 thread-level memory（见 `docs/30-agent/reading-thread-memory.md`）
- [x] 登录用户的 Postgres Thread Memory、server-owned initial snapshot、数据库幂等与脱敏 Trace（ADR-0006）
- [ ] 长期画像与 LangGraph session checkpoint
- [x] 第一轮内测访问控制、quota 与最小观测（见 `apps/web/supabase/migrations/202604270001_beta_ops.sql` 与 `docs/70-ops/dev-setup.md`）
- [ ] 告警设计

## 7. P1 生产运行时

`POST /api/reading` 在 quota 与 Provider 前通过 `reading_request_executions` 获得数据库 lease；Final 还必须 claim 同 subject 的 `reading_initial_snapshots`。只有 owner 执行 Provider。成功响应先提交幂等结果，再消费 initial snapshot。

Supabase/PostgREST 的 `timestamptz` 响应允许使用 `Z` 或 `+00:00` 等 RFC 3339 offset。运行时边界必须接受两种等价表示，不能把已成功持久化的 snapshot 或 Thread Memory 误判为无效数据；这不要求数据库 schema migration。

Reading 与 Encyclopedia 共用 `server/llm/openai-compatible-transport.ts`，统一配置、timeout、OpenAI-compatible message/usage/finish reason、token gate 和 metrics。两条业务 Pipeline 的 prompt、检索、draft normalization 与安全映射保持独立。

## 8. P2 Grounding 与质量闭环

Reading 与 Encyclopedia 进一步共用 `server/knowledge/wiki.ts` 的 Wiki root、frontmatter 与 claim parser/cache 基础。Reading 使用逐牌强制检索和 claim-level citation；Encyclopedia 使用更精确的段落级排名，但继续返回既有 `sources[]`。

Reading 在 Provider 前有不可绕过的 `ensure_minimum_grounding`，在 P0 生成内容安全节点后有 citation finalizer。公开 `StructuredReading.grounding` 为可选字段；Wiki 失败时由 domain-tarot authority fallback 保证逐牌覆盖。

Thread Memory 已是登录用户、user/thread 双重作用域的 Postgres 存储；匿名只使用 capsule。Trace 已以 V2 脱敏持久化。Final 只接受 server-owned snapshot ID，不信任客户端 initial 正文。

质量闭环由 opt-in feedback replay、本地人工评分包与五调用真实模型 canary 组成。安全、身份和 grounding 保持确定性；是否评估结构化 LLM Decider 只由累计线上误路由 scorecard 门槛触发。当前不拆 Multi-Agent。

## 13. Adaptive staged generation

Reading backend 仍只有一个 canonical LangGraph。`ensure_minimum_grounding`
之后由 generation policy 选择 monolithic、Lite compact、复杂 Initial 的
card-insight+synthesis，或 Final refinement。所有分支在现有 `draft` 汇合并继续
同一安全与持久化后半链。

每个 stage 最多两次 transport 请求。Transport/timeout/429/5xx/truncation/empty
completion 做同 stage retry；JSON/contract/authority/prose/grounding/明显矛盾
做一次受限 repair；取消、非 429 的 4xx、安全与 token/quota 拒绝不重试。
每次请求独立 reserve/settle token，顶层 quota、idempotency 与 snapshot
ownership 不变。环境变量默认 `monolithic`，回滚不需要 schema 或数据迁移。

Staged normalizer 在 transport 的 parse 边界内执行。若已解析 JSON 随后触发
schema、authority、grounding 或语义合同错误，transport 把完整已解析对象作为当前
stage 的 `invalidPayload` 交给受限 repair，并把本次 LLM metric 记为失败。该 payload
只存在于当前 invocation，不进入 trace、response 或持久化。

已验证 staged 正文省略 optional refs 时，hydration 按 authority card index 与当前正逆位
确定性绑定该牌允许的检索 refs，synthesis 只继承这些 card refs 的并集。相反正逆位 Wiki
chunk 不进入允许集合；没有匹配 Wiki 时，minimum grounding 注入当前牌位的
authority-card chunk 并保留 degraded 状态。显式 unknown / cross-card / opposite-orientation
ref 仍在 normalizer 拒绝；检索为空或生成正文经安全层改写时，citation finalizer 仍执行
authority fallback。该 handoff 保留 grounding 的不可绕过边界，不信任模型自行声明来源。

2026-07-31 的真实 paired A/B 没有通过启用门槛：monolithic 合法率为
`55 / 64 = 85.9%`，adaptive staged 为 `31 / 65 = 47.7%`。修复后 probe 虽使
Initial/preparation 达到 `15 / 15`，但 Final 为 `0 / 5`。Probe 的后续取证又发现旧实现
只向 repair 传递出错叶子字段；修复后使用最后
1 次授权做 Sober Final 定向回放，第一次 authority mismatch、第二次 repair 成功并保留
全部 Initial themes，但最终 synthesis 仍偏泛。该单例只能验证恢复链，不足以证明质量和
稳定性门槛。因此 staged 目前只是显式配置实验路径，不能作为生产默认。详细报告见
`docs/test-reports/adaptive-staged-reading-ab-2026-07-31.md`。

后续 grounding handoff 修复按 authority card index / orientation 绑定已验证 staged prose；
没有匹配 Wiki 时使用同牌同方向 authority-card chunk，不再先接相反方向 Wiki 再由 finalizer
替换正文。最终独立 A/B 验证 synthesis `100 / 100`、card prose `375 / 375` 保真，但
card/synthesis consistency、Final integration、完整矩阵与 review coverage 仍未过门槛，
因此默认保持 `monolithic`。详见
`docs/test-reports/adaptive-staged-reading-grounding-handoff-ab-2026-07-31.md`。

2026-08-01 的逐例取证没有改变 state 或公共协议。质量加固发生在内部边界：synthesis
prompt 使用 server-owned card-index / spread-position 映射；Final prompt 使用
server-owned Initial + follow-up integration work order；normalizer 只对“大比例逐字复制
完整 card insights”这一可确定退化触发受限 repair。两条路径仍在同一个 `draft` 汇合并
经过既有 generated-content safety、citation finalizer、capsule 与 completed persistence。
# 游客上线 P0 信任边界（2026-08-10）

- 身份历史：游客浏览器存储与账号服务端 `stored_readings` 是两个不可互相回退的 source。认证 loading 不视为 guest；身份解析后以 identity-keyed provider remount，使新身份首个可见 commit 就是空白内存态，再从新身份 canonical source hydrate。epoch、AbortSignal 与 stale guard 继续失效旧 initial/final/GET/POST/PATCH 及后续副作用；旧 guest history key 只保留待未来显式导入，旧全局草稿 key 只删除不导入。
- Reading 安全：Graph 分别分类 question 与每个用户 follow-up answer，再按产品优先级聚合；输入和生成输出共用 NFKC/Cf/全角/空格/标点/英文拆词规范化，并在句、子句或受限局部窗口内解释否定、引用和受害者语境。局部安全语境不能抵消后续或另一字段的 hard stop。`analyze_intent_friction` 后的强制条件边直接进入 `safety_stop`，decider 无权覆盖。
- I/O：所有 JSON 入站路由按实际字节流式限长并强制 `application/json`；共享 transport 的单一端到端 deadline 从排队前开始，覆盖 permit、reservation、headers/body 与 settlement，并有响应硬上限。
- 舱壁：单 Node 进程共享 provider semaphore，permit 先于 token reservation；它只保护单实例，不是多实例全局并发控制。多实例仍需供应商硬预算、外部网关或共享协调层。
- IP：应用只接受 Caddy 覆写的内部 IP + shared secret；CF/XFF/X-Real-IP 永不参与应用身份。生产缺失或错误时失败关闭，非生产只允许显式私网/回环 fallback。
