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
- 抽牌展示
- 初读、追问与整合深读渲染
- 本地历史记录与回放

当前落地：`apps/web`

### BFF Route 层

负责：

- `POST /api/reading` 的 request parsing
- 输入 schema 校验
- 错误映射
- HTTP response 返回

边界：只做 transport / validation / response mapping，不直接拼装解读内容。

### Reading Service 层

负责：

- 问题分类
- Agent Profile / phase 归一化
- 权威牌阵 / 牌面上下文还原
- initial/final 阶段验证
- `prior_session_capsule` continuity context 注入与安全净化
- provider 调用
- 安全分级检查 (Dual-Tier Safety Checks)
- completed reading 的 `session_capsule` 生成
- 最终 schema 校验

当前落地：`apps/web/src/server/reading/`

当前实现：`generateStructuredReading()` 保持 service 入口不变，内部委托最小 LangGraph。图节点只承载现有流水线的阶段拆分，不改变 `/api/reading` 的单入口 contract，也不引入 checkpoint、streaming、interrupt 或外部 LLM。

固定流水线：

1. 问题分类，并读取 `agent_profile` / `phase` / `prior_session_capsule`
2. canonical context 组装
3. final 阶段一致性验证（仅 `phase = final`）
4. 意图摩擦分析（可能直接抛出 403 Hard Stop）
5. provider.generateInitialRead 或 provider.generateFinalRead
6. provider draft contract validation（cards 顺序 / identity / orientation 与 authority context 一致，follow-up 数量符合 phase/profile）
7. structured reading 组装（包含阶段元数据、200 Sober Check 拦截标注与 `presentation_mode` 派生）
8. safety review
9. completed reading 的 `session_capsule` 生成
10. structured response validate

### Provider 层

负责：

- 根据服务配置选择实际解读生成器
- 将统一的 reading context 转换为结构化 reading draft
- 区分 initial read 与 final read 的生成语义

当前阶段：默认启用 `placeholder` provider，并新增一个可选的单 `llm` baseline。`llm` provider 通过 OpenAI-compatible `chat/completions` HTTP 调用接入，仍不引入 Provider Router、多模型分层、streaming 或 checkpoint。

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

---

## 4. 当前 reading 数据流

1. 用户输入问题、选择 Agent Profile、选择牌阵并完成抽牌
2. 前端提交 `question + spreadId + drawnCards + agent_profile + phase + prior_session_capsule?`
3. Route 进行基础 schema 校验
4. Service 委托最小 LangGraph，图节点依次执行分类、权威上下文组装、final 验证、意图摩擦分析、provider draft、结构化组装、安全复核与最终 schema 校验
   当前 graph 会在 provider draft 之后先执行一层 contract validation，防止 provider 越权改牌、乱序输出或返回不符合 phase/profile 的 follow-up 数量。
5. 若意图摩擦遇生死危机、紧急健康或操控类请求，图节点抛出 `ReadingServiceError(403 safety_intercept)` 并直接断开生成链路
6. 若遇重大决策依赖，记录降级状态，返回 `200` reading，并写入 `sober_check` 与 `presentation_mode = sober_anchor`
7. Provider 生成 initial 或 final 结构化 draft；若存在 `prior_session_capsule`，它会先在服务层移除 `用户补充` 类原始细节以及自伤/他伤、操控、第三方意图猜测、紧急健康等高风险内容，再作为低优先级 continuity context 注入 provider
8. Safety review 补充常规 `safety_note`，并收窄 guidance / follow-up
9. 只有 completed reading 会生成 `session_capsule`；`standard / sober initial` 继续固定为 `null`，且 completed capsule 会被模板化压缩为“问题 / 牌阵 / 核心主题 / 延续主轴 / 边界提醒”
10. 结果通过统一 schema 校验后返回前端 (`HTTP 200`)
11. 前端对 `requires_followup = true` 的 initial reading 展示追问，不写入 history；final reading 或 Lite completed reading 写入 localStorage history，并可被显式选作下一轮的 continuity source

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
- 新增 provider、扩展 LangGraph 节点或引入更复杂 graph 能力时，应复用现有 service 边界，而不是从 route 重新起一套流程

---

## 6. 待补充

- [ ] 部署拓扑
- [x] provider 配置说明（见 `docs/70-ops/dev-setup.md` 的 llm baseline env 变量）
- [~] session capsule 与长期记忆接入方式（本地线程级 continuity 已落地；服务端持久化与长期记忆仍待补）
- [ ] 观测指标与告警设计
