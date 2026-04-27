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
- 本地历史记录与回放

当前落地：`apps/web`

### BFF Route 层

负责：

- `POST /api/reading` 的 request parsing
- 内测 Supabase 登录、邮箱白名单与 admin 角色校验
- reading 调用前的邮箱/IP/每日 LLM 成本配额检查
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

当前实现：`generateStructuredReading()` 保持 service 入口不变，内部委托最小 LangGraph。图节点只承载现有流水线的阶段拆分，不改变 `/api/reading` 的单入口 contract，也不引入 checkpoint、streaming、interrupt 或外部 LLM。

P2 memory / persistence 边界：

- Reading Service 当前只消费 request 侧显式传入的 `prior_session_capsule`，不主动读取服务端 history、thread checkpoint 或 user memory。
- `prior_session_capsule` 必须先经过服务层净化，才能进入 provider context。
- completed `session_capsule` 是输出协议字段，不是 thread/session/user identity。
- 服务端 history persistence、thread/session persistence、长期画像与 memory merge 仍未实现；后续开启时必须先明确 identity、读写规则、清理规则与测试边界。

固定流水线当前由 9 个 LangGraph 业务节点承载；schema validation 是分布在组装、安全复核与 capsule 附着节点中的协议守卫，不是独立 graph 节点：

1. 问题分类，并读取 `agent_profile` / `phase` / `prior_session_capsule`
2. canonical context 组装
3. final 阶段一致性验证（仅 `phase = final`）
4. 意图摩擦分析（可能直接抛出 403 Hard Stop）
5. provider.generateInitialRead 或 provider.generateFinalRead
6. provider draft contract validation（cards 顺序 / identity / orientation 与 authority context 一致，follow-up 数量符合 phase/profile）
7. structured reading 组装（包含阶段元数据、200 Sober Check 拦截标注与 `presentation_mode` 派生）
8. safety review
9. completed reading 的 `session_capsule` 生成，并通过统一 schema 校验后返回

### Provider 层

负责：

- 根据服务配置选择实际解读生成器
- 将统一的 reading context 转换为结构化 reading draft
- 区分 initial read 与 final read 的生成语义

当前阶段：默认启用 `placeholder` provider，并新增一个可选的单 `llm` baseline。`llm` provider 通过 OpenAI-compatible `chat/completions` HTTP 调用接入，设置 `max_tokens` 上限，记录单次调用耗时、token usage 与估算成本；失败不做自动重试，仍不引入 Provider Router、多模型分层、streaming 或 checkpoint。

### Beta Ops / Observability 层

负责第一轮内测的付费 LLM 风险收口：

- `beta_testers` 是 tester / admin 白名单真相源
- `usage_counters` 通过 Supabase RPC 原子消费邮箱日限、IP 分钟限、IP 日限与每日 LLM 成本预算
- `reading_events` 记录请求量、用户数、phase、成功/失败、耗时、token 与成本
- `reading_feedback` 记录 completed reading 的轻量质量反馈
- `/admin` 与 `/api/admin/*` 只允许 `role = admin`
- `role = admin` 账号用于维护和压力测试，跳过 reading quota 与每日 LLM 预算预消费；它不跳过登录、白名单、admin 鉴权或 telemetry

该层不改变 `StructuredReading` 成功响应协议，不读取或改写塔罗解释内容，也不替代 Reading Service 的安全边界。

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

### Future Persistence 层（P2 设计，暂未实现）

未来若引入服务端持久化，应拆成独立边界，而不是并入现有 localStorage history 或 `session_capsule`：

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
4. Route 进行内测访问控制、基础 schema 校验与 quota 预消费；未登录、非白名单、普通 tester 访问 admin 或超限时直接返回结构化错误，不进入 provider
5. Service 委托最小 LangGraph，图节点依次执行分类、权威上下文组装、final 验证、意图摩擦分析、provider draft、结构化组装、安全复核与最终 schema 校验
   当前 graph 会在 provider draft 之后先执行一层 contract validation，防止 provider 越权改牌、乱序输出或返回不符合 phase/profile 的 follow-up 数量。
6. 若意图摩擦遇生死危机、紧急健康或操控类请求，图节点抛出 `ReadingServiceError(403 safety_intercept)` 并直接断开生成链路
7. 若遇重大决策依赖，记录降级状态，返回 `200` reading，并写入 `sober_check` 与 `presentation_mode = sober_anchor`
8. Provider 生成 initial 或 final 结构化 draft；若存在 `prior_session_capsule`，它会先在服务层移除 `用户补充` 类原始细节以及自伤/他伤、操控、第三方意图猜测、紧急健康等高风险内容，再作为低优先级 continuity context 注入 provider
9. Safety review 补充常规 `safety_note`，并收窄 guidance / follow-up
10. 只有 completed reading 会生成 `session_capsule`；`standard / sober initial` 继续固定为 `null`，且 completed capsule 会被模板化压缩为“问题 / 牌阵 / 核心主题 / 延续主轴 / 边界提醒”
11. 结果通过统一 schema 校验后返回前端 (`HTTP 200`)
12. Route 记录 reading event；LLM provider 返回 usage 时按 usage 估算成本，缺失 usage 时按字符粗估 token
13. 前端对 `requires_followup = true` 的 initial reading 展示追问，不写入 history；final reading 或 Lite completed reading 写入 localStorage history，并可被显式选作下一轮的 continuity source
14. completed reading 展示轻量反馈入口，写入 `reading_feedback` 供 `/admin` 汇总

---

## 5. 边界原则

- `apps/web` 仍是唯一活跃应用，当前不拆 `apps/api`
- Route 不能重新承载业务真相
- 安全规则必须在生成前和生成后分别检查，不能只靠 prompt 自觉
- hard-stop 危机转介当前按中国大陆固定资源顺序提示：`120` -> `110` -> `12356`
- 前端不再依赖 markdown 作为主协议
- 历史记录只保存 completed reading，Standard/Sober initial 不入 history
- MVP 不引入服务端会话存储；final 请求由前端带回 initial reading 快照
- 本地线程连续性已实现，但仍不引入 user id、thread id 或服务端 history persistence
- `reading_id` 只标识一次 reading artifact，不可复用为 `thread_id`、`session_id` 或 `user_id`
- localStorage history 是本地 replay cache，不是 canonical memory store
- `session_capsule` 是 completed reading 的低优先级 continuity summary，不是长期画像或 thread checkpoint
- 线下塔罗模式不得新建第二套解读链路；它只能作为 `drawnCards[]` 输入来源进入同一 `POST /api/reading` contract
- 新增 provider、扩展 LangGraph 节点或引入更复杂 graph 能力时，应复用现有 service 边界，而不是从 route 重新起一套流程
- `/api/reading` 在第一轮内测期间必须要求 Supabase 登录与 `beta_testers` 白名单；Cloudflare Access 只能作为站点门禁，不能替代应用内 quota
- `SUPABASE_SERVICE_ROLE_KEY` 与 `AETHERTAROT_LLM_API_KEY` 只能在服务端读取，不得使用 `NEXT_PUBLIC_` 前缀；错误响应不得返回 env 值或完整密钥

---

## 6. 待补充

- [ ] 部署拓扑
- [x] provider 配置说明（见 `docs/70-ops/dev-setup.md` 的 llm baseline env 变量）
- [x] session capsule、completed reading、future thread/session 与长期记忆边界设计（见 `docs/80-decisions/adr/0004-memory-and-persistence-boundaries.md`）
- [x] memory persistence roadmap 与测试矩阵（见 `docs/30-agent/memory-persistence-roadmap.md`）
- [x] P2.2 Thread / Session RFC 草案（见 `docs/30-agent/thread-session-rfc.md`）
- [ ] 服务端持久化与长期记忆实现方案
- [x] 第一轮内测访问控制、quota 与最小观测（见 `apps/web/supabase/migrations/202604270001_beta_ops.sql` 与 `docs/70-ops/dev-setup.md`）
- [ ] 告警设计
