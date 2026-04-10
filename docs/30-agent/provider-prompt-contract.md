# Provider 与 Prompt Contract

## 1. 文档目的

本文件定义 Two-Stage Reading MVP 之后接入真实 LLM provider 的最小实现边界。目标是让真实 provider 替换 placeholder 时，不改变 `POST /api/reading` 公共入口、不改变 `StructuredReading` 输出协议、不绕过 service-layer safety。

本文件不是模型选型结论。真实模型、价格、API 能力和结构化输出稳定性必须在接入前重新核对。

---

## 2. Provider 接口边界

当前 provider 只需要实现两个语义方法：

```ts
interface ReadingProvider {
  generateInitialRead(context: HydratedReadingContext): Promise<ReadingDraft>;
  generateFinalRead(context: FinalReadingContext): Promise<ReadingDraft>;
}
```

`HydratedReadingContext` 包含：

- `question`
- `questionType`
- `agentProfile`
- `spread`
- `drawnCards`

`FinalReadingContext` 在此基础上增加：

- `initialReading`
- `followupAnswers`

Provider 只能返回 draft 字段：

- `cards`
- `themes`
- `synthesis`
- `reflective_guidance`
- `follow_up_questions`
- `confidence_note`

Provider 不负责生成：

- `reading_id`
- `locale`
- `question_type`
- `agent_profile`
- `reading_phase`
- `requires_followup`
- `initial_reading_id`
- `followup_answers`
- `spread`
- `safety_note`
- `session_capsule`
- `sober_check`
- `presentation_mode`

这些字段由 reading graph / service 层组装或安全层注入。

---

## 3. 接入顺序

真实 provider 第一版按单 provider baseline 实现：

1. 保留 `placeholder` provider 作为默认 fallback。
2. 新增一个真实 provider，例如 `llm` 或明确供应商名。
3. 使用环境变量切换：`AETHERTAROT_READING_PROVIDER=placeholder | llm`。
4. 真实 provider 内部先支持同步非流式调用。
5. 不在第一版引入 Provider Router、多模型分层、streaming、checkpoint 或 human review。
6. 所有真实 provider 输出先经过 provider-local parse / normalize，再交给 graph 的 `structuredReadingSchema.parse()` 做最终校验。

失败策略：

- 模型不可用、响应不可解析或缺字段时，抛 `ReadingServiceError("generation_failed", ...)` 或 `provider_unavailable`。
- 不允许在失败时返回 markdown-only reading。
- 不允许 provider 自行吞掉 safety 风险并返回“温和版”结果。

---

## 4. Initial Prompt Contract

Initial read 的目标是“牌先说话”。它必须基于问题、牌阵、抽到的牌和正逆位先建立牌面主轴，不能依赖用户补充来回填答案。

### 输入

Prompt 必须接收：

- 用户问题 `question`
- 问题类型 `questionType`
- Agent Profile `agentProfile`
- 权威牌阵快照 `spread`
- 按牌阵位置排序的 `drawnCards`
- 输出字段要求
- 安全与表达边界摘要

### 输出要求

Initial draft 必须：

- 为每张牌输出当前位置下的 `interpretation`
- 输出 2-4 个 `themes`
- 输出一个整体 `synthesis`
- 输出 2-4 条 `reflective_guidance`
- 按 profile 输出 `follow_up_questions`
- 输出 `confidence_note`

Initial draft 不得：

- 生成 `safety_note`、`sober_check` 或 `presentation_mode`
- 断言未来确定结果
- 把用户问题包装成唯一答案
- 向用户索取大量背景资料
- 给出医疗、法律、财务或操控建议

### Follow-up 规则

`follow_up_questions` 只在 initial 阶段承担流程推进作用。

- `lite`: 0-1 个，MVP 默认可为空
- `standard`: 1-2 个
- `sober`: 1-2 个，且更偏现实条件、边界和风险核实

每个追问必须能追溯到：

- 某个牌阵位置
- 某张牌的正逆位线索
- 牌与牌之间的张力
- 牌面提示与现实行动之间的落差

失败示例：

- “你最近是不是很焦虑？”
- “你是不是遇到了某个人？”
- “你是不是工作不顺？”

---

## 5. Final Prompt Contract

Final read 的目标是“在保留初读主轴的前提下，用用户补充信息校正解释空间”。

### 输入

Prompt 必须接收：

- 原始用户问题 `question`
- `questionType`
- `agentProfile`
- 同一 `spread` 与 `drawnCards`
- 完整 `initialReading`
- 用户提交的 `followupAnswers`
- 输出字段要求
- 安全与表达边界摘要

### 输出要求

Final draft 必须：

- 保留 initial 的核心 `themes`
- 复用 initial 的 `cards` 顺序与 card identity
- 在 `synthesis` 中体现用户补充如何收束解释空间
- 输出新的 `reflective_guidance`
- 输出 0-1 条延伸反思问题，不再作为阻塞流程
- 输出 `confidence_note`

Final draft 不得：

- 重新抽牌
- 更改牌阵或牌序
- 用用户补充完全推翻 initial 主轴
- 把 follow-up answers 当作事实真相的全部来源
- 把 advice 写成命令或确定性预言

---

## 6. Agent Profile Prompt 差异

### `lite`

- 输出更短
- 允许 `follow_up_questions = []`
- 重点是当前倾向、核心张力、简短建议
- 不应缺失结构化字段

### `standard`

- 默认完整两阶段
- initial 必须提出 1-2 个牌面锚定追问
- final 必须整合用户回答并保留 initial themes

### `sober`

- 基于 standard 的两阶段流程
- 更强调现实校验、风险承受边界、专业意见和可验证行动
- 不代表更神秘，也不允许更断言
- 不绕过 `analyzeIntentFriction()` 或 `applySafetyReview()`

---

## 7. Safety 边界

Provider prompt 可以重复安全表达原则，但安全控制权仍在 service 层：

1. `analyzeIntentFriction()` 在 provider 前处理 Tier 1 hard stop 与 Tier 2 sober check。
2. Provider 只生成 reading draft。
3. Graph 组装 `sober_check` / `presentation_mode`。
4. `applySafetyReview()` 在 provider 后补充 `safety_note` 并收窄 guidance / follow-up。
5. `structuredReadingSchema.parse()` 做最终协议校验。

Provider 不得自行决定：

- 是否 hard stop
- 是否注入 `sober_check`
- 是否跳过 `safety_note`
- 是否返回非结构化 markdown

---

## 8. Parse 与 Normalize 要求

真实 LLM provider 应优先使用结构化输出能力。如果供应商暂不支持可靠 schema 输出，provider 必须实现严格 parse / normalize：

- 删除未知字段
- 校验必需字段存在
- 将 `themes` 限制为 2-4 个
- 将 `reflective_guidance` 限制为 2-4 个
- 将 initial `follow_up_questions` 限制为 profile 允许范围
- 将 final `follow_up_questions` 限制为 0-1 个延伸问题
- 保持 `cards[]` 数量和顺序与 `drawnCards` / `spread.positions` 一致
- 缺失或不可修复时抛服务错误，不返回半结构化内容

---

## 9. 第一版验收

真实 provider 第一版必须通过：

- `npm run build`
- `npm run lint -w @aethertarot/web`
- `npx playwright test tests/reading-contract.spec.ts`
- `npm run test:e2e`

并至少人工抽查：

- Standard initial 是否“牌先说话”
- Follow-up 是否锚定牌面矛盾
- Final 是否保留 initial themes
- Sober 是否现实校验更强但不替用户做决定
- Health / legal / financial / manipulation / crisis 场景是否仍由 service-layer safety 控制