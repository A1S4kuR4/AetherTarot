# 上下文策略（Context Strategy）

## 1. 文档目的

定义 AetherTarot 在长上下文环境下如何组织系统知识、用户输入、会话历史与持久化记忆，避免“上下文越长越混乱”。

---

## 2. 原则

- 当前问题优先于历史问题
- 摘要优先于原文堆叠
- 稳定画像优先于临时情绪
- 系统规则优先于风格偏好
- 安全边界优先于解读流畅度

---

## 3. 上下文分层

### P2 边界总则

`2026-04-26` 的 P2 设计结论是先定义边界。后续实现已加入账号级 completed reading
replay 与账号作用域的 thread 短期记忆，但仍未引入 LangGraph session checkpoint、
长期画像或跨 thread memory merge。当前系统必须把以下几层分开：

| 层级 | 作用 | 当前状态 | 不允许做的事 |
| --- | --- | --- | --- |
| 当前任务状态 | 服务本轮 reading | request payload + graph state | 不允许被历史或记忆覆盖 |
| `/new` 未提交问题草稿 | 防止刷新时丢失正在编辑的问题 | guest 用独立 localStorage；账号用 identity-controlled sessionStorage | 不跨身份恢复，不允许作为额外历史、capsule 或 provider memory 注入 |
| 游客 completed history | 回放当前浏览器内游客完成的 reading | `aether_tarot_guest_history_v1` 中的 `ReadingHistoryEntry[]` | 不属于账号、不得自动导入、不得当作 canonical user memory |
| 账号级 completed history | 让内测登录用户跨设备回放已完成 reading | `stored_readings` 按 `user_id + reading_id` 幂等保存，GET 默认限量 | 不允许自动注入 provider、长期画像或 memory merge |
| `session_capsule` | 把一条 completed reading 的紧凑摘要显式带入下一轮 | `StructuredReading.session_capsule: string | null` | 不允许保存原始 transcript 或高风险细节 |
| thread-level memory | 同一 reading thread 内的结构化短期记忆 | 登录用户使用 Postgres `reading_thread_memories`，按 `{ user_id, thread_id }` 原子合并；in-memory store 仅用于测试/开发注入 | 不允许跨用户、跨 thread 或升级为长期画像；匿名用户不建立持久身份 |
| future long-term memory | 未来保存稳定偏好与反复主题 | 暂未实现 | 不允许默认写入危机细节、短期情绪或未验证第三方信息 |

当前优先级固定为：当前问题、当前牌阵、当前抽牌与安全边界高于任何历史或记忆。

### 层 1：系统固定层

包含：

- 产品定位
- 安全边界
- 输出协议
- 解释框架摘要

特点：最稳定、最不应频繁变化。

### 层 2：会话任务层

包含：

- 用户本轮问题
- 用户本轮补充背景
- 本轮抽牌结果
- 当前牌阵定义

特点：本轮最重要，应始终占最高优先级。

### 层 3：会话历史层

包含：

- 过去轮次的关键结论
- 用户曾确认或否认的重点
- 已经讨论过但仍 relevant 的主题

特点：优先使用摘要，不直接拼接全部聊天历史。

当前实现补充：

- 游客 history replay 只写版本化 guest key，并明确属于当前浏览器；旧 `aether_tarot_history_v2/v3` 保留供未来显式确认导入，不再自动读取、删除或迁移
- 内测账号级 history replay 只保存 completed reading 的可回放 payload、抽牌 metadata 与用户笔记；它使用账号身份做存储边界，但仍只是 history replay，不是长期记忆
- `/api/readings` 读取账号级 history 时必须使用安全 limit，默认只返回最近 50 条，避免无限列表；重复 `user_id + reading_id` 保存或迁移必须幂等覆盖，不产生多条记录
- `/new` 的重复主题提醒只读取本地 completed history 中最近若干条记录的 `question_type`、原问题与 themes，用于前台非阻断提醒；它不把 history 注入 `POST /api/reading`，不触发 `session_capsule` merge，也不等同于长期记忆读取
- `/new` 的未提交问题草稿按身份隔离：guest 使用当前浏览器的版本化 localStorage key；账号使用当前 tab 的 sessionStorage，并以不含直接 PII 的 owner fingerprint 校验。A→guest、A→B 时账号草稿被清除，guest→A 不导入 guest 草稿。旧全局 `aether_tarot_new_question_draft_v1` 首次遇到时只删除、不自动导入；需要保留的用户应在升级前手工复制文本。
- P6 `SessionMemory` 只在同一 `thread_id` 内保存结构化短期摘要：topics、cards、constraints、open questions 与 last advice summary；它不保存完整用户原文，也不参与跨 session personalization
- 登录用户的 `SessionMemory` 按 `{ user_id, thread_id }` 持久化到 Postgres 并原子合并；匿名用户不建立持久 thread identity，in-memory store 只用于测试与开发注入
- `prior_session_capsule` 只带入上一轮紧凑摘要，不把整条 history 或原始 transcript 注入下一轮
- `prior_session_capsule` 在进入 provider 前会先对完整文本做 NFKC、Cf 清除和全空白折叠后的整体分类，再做逐行 label 清理；整体出现自伤/他伤、操控、第三方意图猜测、紧急健康等受限内容时整份降为 `null`，不尝试从同一危险 capsule 中挑回“安全行”
- 若净化后只剩噪音或空壳，`prior_session_capsule` 会在服务层降为 `null`

### 层 4：长期记忆层

包含：

- 用户稳定偏好
- 用户常问问题类型
- 可被允许保留的长期背景

特点：必须严格控制写入与读取条件。

---

## 4. Session Capsule 机制

每次会话结束后，可生成一份 `session capsule`，建议包含：

- 本轮问题摘要
- 本轮牌阵与主题
- 对用户最有价值的 2-4 个结论
- 用户对结果的反馈
- 应延续到下轮的重点
- 不应延续的情绪性噪音

> Session capsule 的目标是“延续理解”，不是“复制聊天记录”。

当前 capsule 实现：

- 只在 completed reading 生成 `session_capsule`
- `lite` 的 `initial-as-final` 可直接生成 capsule
- `standard / sober` 只有 `final` 才生成 capsule；`initial / awaiting_followup` 固定为 `null`
- 下一轮必须由前端显式 opt-in，把 `prior_session_capsule` 带回 `POST /api/reading`
- `prior_session_capsule` 的优先级低于当前问题、当前牌阵与本轮抽牌
- completed `session_capsule` 当前固定收敛为“问题 / 牌阵 / 核心主题 / 1-2 条延续主轴 / 边界提醒”模板
- `session_capsule` 不再直带 `用户补充` 或高风险细节；outgoing question fragment、最终 capsule 与 incoming capsule 复用同一分类式 sanitizer，且 280 字硬限制发生在完整风险判断之后
- outgoing capsule build 与 incoming sanitize 复用同一分类/脱敏 helper；自伤恢复/教育/助人与非即时受害者支持即使允许完成 reading，也只在问题行保留安全占位，不复制原问题

P2 设计边界：

- `session_capsule` 继续保持 `string | null`，不在本阶段升级为对象 schema。
- `session_capsule` 是 completed reading 的衍生摘要，不是 thread id、user id、profile memory 或完整聊天记录。
- 前端只有在用户显式选择“延续这条线”时，才把 capsule 作为 `prior_session_capsule` 带回下一轮。
- 服务端必须继续对 incoming `prior_session_capsule` 做安全净化；净化后为空或只剩噪音时应降为 `null`。
- capsule 只允许作为低优先级 continuity context，不能改变当前牌阵、当前牌面、当前问题或 safety 判断。
- 若后续要把 capsule 升级为结构化对象，必须同步更新 shared types、request/schema validation、front-end consumers、docs、contract tests 与历史兼容策略。

## 4.1 Completed Reading 与 Thread / Session 边界

当前 `ReadingHistoryEntry` 的职责是让用户回放 completed reading，并在用户主动选择时提供一条 continuity source。它不是服务端 canonical history，也不是长期记忆。

内测阶段新增的 `stored_readings` 只把这份 completed history 从纯本地缓存加固为账号级回放能力。它的读写规则是：

- 写入：登录账号仅在 final reading 或 Lite completed initial reading 完成后写服务端；游客只写当前浏览器 guest storage
- 合并：账号按同一 `user_id + reading_id` 幂等覆盖；游客以 Web Locks 跨 tab 排他事务包住完整 read–merge–write，避免两个同时开始的标签后写覆盖先写
- 读取：仅由 `/api/readings` 返回给前端 history UI，默认 limit 为 50；Reading Service 不主动读取它
- 删除 / 清理：继续遵守 beta ops retention，旧记录按 365 天清理

账号 history 的服务端 GET/POST/PATCH 是唯一 canonical source；401/500 或保存失败时必须显示空账号历史或明确同步失败，绝不回退游客/旧账号数据。登录、登出与 A→B 切换会清空内存 history、reading、continuity、draft 与安全态，但不会删除独立 guest key。因此，`stored_readings` 不改变 `prior_session_capsule` 的显式 opt-in 语义，也不等同于 provider memory 或长期画像。账号级 thread memory 是另一条独立、受限的连续性链路。

账号 POST 失败时，completed entry 会先进入按账号 fingerprint 分区的浏览器 outbox，并以“待同步”状态显示和提供显式重试；刷新不会丢失它。Outbox 不是新的 canonical history，也不会注入 provider；服务端幂等成功后立即移除。账号 outbox 与 guest history 都用 Web Locks 包住完整读-合并-写事务；锁不可用或本机写失败时向用户显示失败，不使用会丢并发更新的 fallback。认证 loading 不视为 guest；解析后的 identity-keyed provider 在新身份首个可见 commit 前建立全新内存态，其 layout-effect cleanup 在旧身份 unmount commit 阶段同步 abort 并推进 epoch。AbortSignal 与 stale guard 继续禁止旧 promise 的状态、growth completion、outbox commit 与 finally 写入新身份。

当前 thread persistence 及未来 session checkpoint 应共同遵守：

- `reading_id` 仍然只标识一次 reading artifact，不能复用为 `thread_id`、`session_id` 或 `user_id`。
- `thread_id` 只表示一条 reading line，用于读取/合并受限摘要与串联 completed readings；登录用户必须同时受 `user_id` 作用域约束。
- `session_id` 若出现，只表示一个短期交互会话，不自动等同于长期用户画像。
- `user_id` 若出现，只能用于账户或用户级偏好边界，不能从 local history 或 capsule 静默推导。
- thread persistence 只保存可检查的有界摘要，不保存原始 transcript；当前保留期与删除路径以 `reading-thread-memory.md` 和 ADR-0006 为准。
- 任何 thread/session 注入 provider 的内容都必须是摘要化、净化后的 context，而不是 checkpoint 原文堆叠。

P2.2 RFC 与后续实现补充：

- 首个服务端连续性 identity 已采用 `thread_id`，表示用户主动选择的一条 reading line；登录用户按 `{ user_id, thread_id }` 持久化，匿名用户继续使用显式 capsule continuity。
- `session_id` 继续暂缓；只有当产品需要恢复未完成的短期流程时才重新评估。
- `thread_id` 已是 `POST /api/reading` 的可选请求字段；当前实现状态以 `docs/30-agent/reading-thread-memory.md`、ADR-0004 与 ADR-0006 为准，原 RFC 的未实现段落仅保留为历史设计背景。

---

## 5. 长期画像写入规则

只有以下信息适合写入长期画像：

- 语言偏好
- 风格偏好
- 反复出现的主题类型
- 用户明确授权保留的资料

不建议默认写入：

- 短期情绪爆发
- 高风险隐私细节
- 未确认真实性的第三方信息
- 带强时效性的具体事件细节

P2 设计边界：

- 长期画像仍暂缓实现。
- 长期画像必须以用户级授权和稳定性为前提，不能从单次 reading 自动抽取。
- 从 session capsule 晋升为长期记忆，需要重复证据或用户明确授权。
- 长期画像只允许影响语气、语言偏好、稳定主题提醒等低优先级 personalization，不能影响 safety tier、牌阵语义、牌面事实或重大决策边界。
- 未来 memory merge 必须定义 merge / overwrite / eviction / deletion 规则后才能实现，不能静默累积。

---

## 6. 上下文压缩策略

当上下文过长时，优先压缩：

1. 历史原文
2. 冗余解释过程
3. 重复性情绪表达
4. 已经被更高质量总结覆盖的内容

不应优先压缩：

- 当前问题
- 当前牌阵
- 安全边界
- 输出协议

---

## 7. 待补充实现细节

- [x] session capsule 数据结构（当前保持 `string | null`）
- [x] session capsule 写入/读取时机（本地线程级）
- [x] completed reading、future thread/session 与 long-term memory 的边界设计（见 `docs/80-decisions/adr/0004-memory-and-persistence-boundaries.md`）
- [x] P2 memory persistence roadmap 与测试矩阵（见 `docs/30-agent/memory-persistence-roadmap.md`）
- [x] P2.1 capsule contract hardening（当前 `string | null` capsule 基线）
- [x] P2.2 Thread / Session RFC 草案（见 `docs/30-agent/thread-session-rfc.md`）
- [x] P6 thread-level structured short-term memory（见 `docs/30-agent/reading-thread-memory.md`）
- [ ] 长期画像 schema
- [x] Thread Memory 原子 merge、容量上限与 90 天 retention（ADR-0006）
- [ ] 多轮追问时的上下文裁剪规则

## 8. P1 持久化边界

- `thread_id` 由前端在进入仪式时生成；initial、final、active draft 与 completed history 保持一致。显式延续历史时复用原 thread，旧历史从本次延续开始生成新 thread。
- 登录用户的 Thread Memory 使用服务端认证 `user_id + thread_id` 读取；匿名用户只使用显式 `prior_session_capsule`，不会按 IP 建立 memory 身份。
- 当 `thread_id` 与显式 capsule 同时存在时，Agent 先尝试读取 Thread Memory。失败、超时或缺失都非阻断，并继续 capsule 降级。
- Thread Memory 不是长期画像。跨 thread profile、长期 preference、session checkpoint 与原始 transcript 仍未实现。
- PostgREST 返回的 `timestamptz` 可能使用 `+00:00` 等显式 UTC offset；Thread Memory 的 `updated_at` 与 initial snapshot 的 `expires_at` 必须按 RFC 3339 offset 时间解析。该兼容只属于应用边界验证，不改变数据库字段或保留策略。

## 9. P2 Grounding 上下文边界

- Wiki claims 与 citation refs 是单次生成的服务端 authority context，不写入 Thread Memory，也不作为长期偏好。
- Final 必须重新执行批量 grounding；initial snapshot 中即使保存了公开 `grounding`，也不能替代本次服务端检索和 citation 校验。
- Capsule、memory 与 history 可以保存最终 `StructuredReading.grounding` 供展示/回放，但 Provider 原始 citation、无效 ref 和被安全拦截正文不得进入任何持久化上下文。

## 10. 分阶段任务态不是记忆

`card_insights`、`synthesis_draft`、generation plan、attempt、repair payload、
stage usage 与 failure subtype 只属于当前 Graph invocation。

- synthesis 只接收 verified insights、牌阵轴、当前问题、必要 continuity 和 compact
  ref catalog，不重复注入完整知识 chunk。
- repair 只接收当前失败的完整已解析 payload、结构化 issue、最小合同与允许
  index/ref。合同 validator 必须运行在 transport 的 parse 边界内，避免只把出错叶子
  字段传给 repair；malformed JSON 仍只保留本次原始 completion。
- 原始无效输出不得进入 snapshot、history、session capsule、thread memory、
  长期画像或持久化 trace。
- 真实 A/B 的 raw completion 只允许保存在显式、本地、ignored 的 eval 审计目录；它
  不是 session capsule、history、thread memory 或 long-term memory，也不得被自动
  注入未来 Reading。
- 2026-07-31 的正式 A/B、probe 与最终定向回放合计 200 次 Graph，没有发现中间失败写入
  persistence 的 fatal；这只验证了本轮样本，不改变“失败不得持久化”的确定性规则。
