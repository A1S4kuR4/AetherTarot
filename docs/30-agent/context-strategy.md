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

`2026-04-26` 的 P2 设计结论是：先定义边界，不立即实现服务端持久化、长期画像或 memory merge。当前系统必须把以下几层分开：

| 层级 | 作用 | 当前状态 | 不允许做的事 |
| --- | --- | --- | --- |
| 当前任务状态 | 服务本轮 reading | request payload + graph state | 不允许被历史或记忆覆盖 |
| 本地 completed history | 回放用户已完成 reading | `ReadingHistoryEntry[]` in localStorage | 不允许当作 canonical user memory |
| `session_capsule` | 把一条 completed reading 的紧凑摘要显式带入下一轮 | `StructuredReading.session_capsule: string | null` | 不允许保存原始 transcript 或高风险细节 |
| future thread/session | 未来恢复一条 reading thread 或会话 | 暂未实现 | 不允许和 user id 混用 |
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

- 本地 history replay 继续保存完整 `ReadingHistoryEntry`
- `/new` 的重复主题提醒只读取本地 completed history 中最近若干条记录的 `question_type`、原问题与 themes，用于前台非阻断提醒；它不把 history 注入 `POST /api/reading`，不触发 `session_capsule` merge，也不等同于长期记忆读取
- `prior_session_capsule` 只带入上一轮紧凑摘要，不把整条 history 或原始 transcript 注入下一轮
- `prior_session_capsule` 在进入 provider 前会先做安全净化：移除 `用户补充` 类原始细节，以及自伤/他伤、操控、第三方意图猜测、紧急健康等高风险内容
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

当前本地线程实现：

- 只在 completed reading 生成 `session_capsule`
- `lite` 的 `initial-as-final` 可直接生成 capsule
- `standard / sober` 只有 `final` 才生成 capsule；`initial / awaiting_followup` 固定为 `null`
- 下一轮必须由前端显式 opt-in，把 `prior_session_capsule` 带回 `POST /api/reading`
- `prior_session_capsule` 的优先级低于当前问题、当前牌阵与本轮抽牌
- completed `session_capsule` 当前固定收敛为“问题 / 牌阵 / 核心主题 / 1-2 条延续主轴 / 边界提醒”模板
- `session_capsule` 不再直带 `用户补充` 或高风险细节，长度也会在服务层硬限制

P2 设计边界：

- `session_capsule` 继续保持 `string | null`，不在本阶段升级为对象 schema。
- `session_capsule` 是 completed reading 的衍生摘要，不是 thread id、user id、profile memory 或完整聊天记录。
- 前端只有在用户显式选择“延续这条线”时，才把 capsule 作为 `prior_session_capsule` 带回下一轮。
- 服务端必须继续对 incoming `prior_session_capsule` 做安全净化；净化后为空或只剩噪音时应降为 `null`。
- capsule 只允许作为低优先级 continuity context，不能改变当前牌阵、当前牌面、当前问题或 safety 判断。
- 若后续要把 capsule 升级为结构化对象，必须同步更新 shared types、request/schema validation、front-end consumers、docs、contract tests 与历史兼容策略。

## 4.1 Completed Reading 与 Thread / Session 边界

当前 `ReadingHistoryEntry` 的职责是让用户回放 completed reading，并在用户主动选择时提供一条 continuity source。它不是服务端 canonical history，也不是长期记忆。

未来若引入 thread/session persistence，应遵守：

- `reading_id` 仍然只标识一次 reading artifact，不能复用为 `thread_id`、`session_id` 或 `user_id`。
- `thread_id` 若出现，只表示一条 reading line 或 conversation thread，用于恢复过程和串联 completed readings。
- `session_id` 若出现，只表示一个短期交互会话，不自动等同于长期用户画像。
- `user_id` 若出现，只能用于账户或用户级偏好边界，不能从 local history 或 capsule 静默推导。
- thread/session persistence 默认保存可检查摘要和 reading 引用，不默认保存原始 transcript。
- 任何 thread/session 注入 provider 的内容都必须是摘要化、净化后的 context，而不是 checkpoint 原文堆叠。

P2.2 RFC 补充：

- 首个服务端连续性 identity 推荐为 `thread_id`，表示用户主动选择的一条 reading line。
- `session_id` 继续暂缓；只有当产品需要恢复未完成的短期流程时才重新评估。
- RFC 仍不批准实现，也不向 `POST /api/reading` 添加字段；详见 `docs/30-agent/thread-session-rfc.md`。

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
- [ ] 长期画像 schema
- [ ] memory merge 冲突规则
- [ ] 多轮追问时的上下文裁剪规则
