# ADR 0010：LLM Safety Reviewer 作为只升不降的第二安全信号

- 状态：Accepted
- 日期：2026-08-13
- 修订：2026-08-20（允许显式共享 Provider API key）
- 关联：ADR 0002、ADR 0005、ADR 0006、ADR 0007

## 背景

确定性安全规则可测试、可解释且延迟稳定，但开放自然语言不存在由有限规则或外部模型证明“完整覆盖”的方法。项目需要在不放弃确定性 authority 的前提下，引入一个能发现额外风险表达的第二信号，同时避免把 safety 变成有工具、有记忆或能改写正文的自治 Agent。

## 决策

新增无工具、无记忆、无自治的 `LLMSafetyReviewer`。安全判定顺序固定为：

1. 确定性输入规则；
2. LLM 输入审校信号；
3. 按现有产品优先级只取风险上界；
4. 生成后先做确定性 generated-content validation；
5. 再做 LLM 输出审校；
6. 按 `replace > restrict > pass` 只取上界，并仅使用服务端固定模板执行限制或替换。

Reviewer 只返回严格 JSON 标签、类别、字段路径以及 policy/model version。协议禁止 rationale、用户可见文案、热线链接与任何工具调用。确定性 `hard_stop` / `replace` 永远优先；Reviewer 不能降低 `bounded`、`sober_check` 或其他既有结果。输入合并继续使用 `hard_stop > abuse_support > sober_check > bounded > standard`，避免重大决定信号覆盖家暴受害者支持。

Reading Route 在 schema/access、deterministic preflight、request_id execution claim 与 Final authority 校验后调用输入 Reviewer，再进入 quota。Route 把结果作为 server-only option 注入 Graph；Graph 仍保留强制审校节点，直接调用 Graph 且没有注入结果时自行调用 Reviewer。输出节点位于 draft contract、确定性输出验证之后，且位于 input-driven safety、grounding、capsule、thread memory、response/history 之前。Encyclopedia route/service 复用同一 Reviewer 与上界合并规则。

## 失败语义

- `off` 只用于本地兼容；生产 readiness 和运行时拒绝 `off`。
- `shadow` 调用 Reviewer 并记录不含原文的结构化指标，但不改变用户结果。
- `enforce` 是 fail-closed 门禁。输入或输出的 timeout、429、5xx、queue、circuit-open、非法 JSON 或 schema violation 均映射为 `503 provider_unavailable`，不得伪装为用户触发的 `403`，也不得 silent deterministic-only fallback。
- 输入故障发生在 quota、tool 与正文 provider 前。输出故障丢弃正文，并发生在 grounding、capsule、thread memory、history、agent state、trace 与 response 写入前。initial 日额度按既有生成失败规则退还；已经实际使用的审校或生成 token 正常结算。

## 独立资源与隐私

Reviewer 使用独立命名的 provider/model/API key 配置入口、`safety_input` / `safety_output` token source、日预算表与 RPC、rate limit、bulkhead namespace、queue timeout、input/output deadline、circuit breaker 和 metrics purpose。2026-08-20 起，Reviewer API key 允许显式引用正文生成 key，或与之解析为同一实际 Secret；runtime/readiness 仍验证 key 存在且引用可解析，但不再要求实际值不同。共享供应商凭据不得合并或移除上述容量、预算、限流、舱壁与指标隔离。通用 bulkhead cache key 必须包含 namespace，不能仅按并发参数共享。

输入审校只发送 `question` 与逐字段 `followup_answers[].answer`；输出审校只发送最终用户可见生成字段。不得发送 email、userId、IP、牌面 authority、Wiki 原文、history、capsule、thread memory 或内部 trace。不得持久化 raw prompt、raw completion、rationale 或 invalid payload。日志只允许 request/run ID、purpose、版本、判定标签/类别、耗时、token、成本、错误与 circuit 状态。缓存仅允许 request_id 幂等或短 TTL HMAC verdict cache，不做跨用户原文或语义缓存。

## 发布与证据边界

发布顺序固定为 `shadow → canary → enforce`。Canary 是受控流量/账号阶段，不新增会改变失败语义的第四运行模式。进入 enforce 前必须观察误升级、漏升级、P95 延迟、429/5xx、schema failure、circuit-open 与独立预算消耗，并完成 fail-closed 演练。

外部模型只是第二信号，不构成自然语言完整覆盖证明。即使 canary 结果良好，也不能删除确定性规则、降低生成后验证强度，或把安全结论移入 prompt-only 控制。

## 后果

优点是增加开放表达的风险发现能力，同时保持确定性 authority、固定响应文案和可测试的持久化边界。代价是 enforce 模式增加两次低延迟外部依赖、独立预算与运维复杂度；Reviewer 故障会按设计降低可用性而不是降低安全性。共享 API key 时，凭据轮换、供应商账号级故障域和账号级账单边界也随之共享；如需 blast-radius 或账单隔离，可恢复独立凭据而无需修改公共协议。
