# Near-Term Work Plan - 2026-04-10

- `last_updated`: `2026-04-10`
- `status`: `ACTIVE`
- `scope`: `post Two-Stage Reading MVP stabilization and next execution order`

## 1. 当前判断

Two-Stage Reading MVP 已完成第一轮代码、文档和 e2e 落地。项目下一步不应马上扩张更多功能，而应先把新 contract 稳住，再进入真实 LLM provider、语义评测和 UX 风险收口。

近期工作采用以下原则：

- 先收口当前未提交变更，再开新能力。
- 先补 contract / eval 防线，再接真实 LLM。
- UX 只围绕两阶段流程和风险关闭微调，不再大范围换视觉方向。
- Runtime asset / 牌库扩张继续推进，但不抢在 reading contract 稳定之前。

## 2. P0 - 当前变更收口

目标：让本轮 Two-Stage Reading MVP 成为一个可提交、可回滚、可复盘的边界。

执行项：

1. 复查当前 diff，确认只包含两阶段 reading MVP、文档同步、工作日志与 session index 更新。
2. 保持 `aether_tarot_产品模式与_agent_设计文档.md` 为未跟踪文件，除非明确决定把它作为产品源文档纳入仓库。
3. 提交前再次运行：
   - `npm run build`
   - `npm run lint -w @aethertarot/web`
   - `npm run test:e2e`
   - `git diff --check`
4. 提交建议拆成一个主提交：`Implement two-stage reading MVP contract`。

完成标准：

- 当前工作树中两阶段 MVP 相关文件完成提交或明确暂存策略。
- CI 所需命令本地通过。
- 未跟踪产品模式原文档是否入库有明确决策。

## 3. P1 - 两阶段 Contract Hardening

### P1 Contract Hardening 更新

已完成第一段：API/contract 断言已从 UI smoke flow 抽出为 apps/web/tests/reading-contract.spec.ts，并补充 final 阶段 profile / spread / drawnCards 不一致拒绝用例、follow-up 锚定断言和两阶段语义评测样例文档。后续仍可继续推进更完整的自动化语义评测。

目标：减少后续接真实 LLM 时破坏状态机和安全边界的风险。

执行项：

1. 为 reading graph 增加更靠近 service 层的契约测试，覆盖：
   - final 缺少 `initial_reading`
   - final 的 profile / spread / drawn cards 与 initial 不一致
   - Lite initial 可直接 completed
   - Standard/Sober initial 必须 requires followup
2. 增加语义评测 fixtures，专门检查：
   - final reading 保留 initial themes
   - follow-up questions 锚定牌面矛盾
   - safety_note 场景下 guidance / followup 被收窄
3. 把当前 e2e 中的 API contract 断言抽出成更轻的测试层，避免所有编排回归都依赖 Playwright。

完成标准：

- 关键状态机错误能在非 e2e 测试中失败。
- final 不推翻 initial 的评测标准有样例 case。

## 4. P1 - Provider / Prompt Preparation

### P1 Provider / Prompt Preparation 更新

已完成第一段：新增 `docs/30-agent/provider-prompt-contract.md`，把真实 provider 接入前必须稳定的接口、initial/final prompt contract、profile 差异、安全边界和 parse/normalize 要求沉淀到 docs。后续进入代码时优先实现单 provider baseline，仍不打开 Provider Router、streaming、checkpoint 或长期记忆。

目标：为接真实 LLM 做准备，但不立刻引入多 Provider 复杂度。

执行项：

1. 设计 placeholder -> real provider 的接口映射：
   - `generateInitialRead(context)`
   - `generateFinalRead(context)`
2. 起草 initial/final 两套 prompt contract：
   - initial 必须“牌先说话”
   - follow-up 必须锚定牌面矛盾
   - final 必须延续 initial themes
   - safety layer 仍由 service 控制，不交给 prompt 自觉
3. 先做单 provider baseline，不做 Provider Router。
4. 真实模型选择前单独核对最新 API、价格、结构化输出能力和可用性。

完成标准：

- 有一份可实现的 real provider 接入规格。
- prompt 输出字段与 `StructuredReading` 完全对齐。
- provider 接入不会改变 `POST /api/reading` 的公共入口。

## 5. P1 - UX 风险收口

目标：让两阶段流程对用户自然成立，而不是看起来像多了一步表单。

执行项：

1. 优化 initial reading 页面文案，强调“初读不是最终判决”。
2. 优化追问区体验：
   - 明确这些问题来自牌面矛盾
   - 减少被问卷化的感觉
   - 保持 Standard/Sober 的节奏差异
3. History / Journey 中优先展示 completed reading，避免用户误把 initial draft 当最终记录。
4. 对照 `docs/10-product/ux-risk-status.md`，优先关闭与迎合错觉、赛博塔罗感、关系依赖相关的剩余风险。

完成标准：

- Standard 两阶段流程在 UI 上有明确节奏感。
- Lite 快速模式不显得残缺。
- Sober 模式不显得惩罚用户，而是现实校验。

## 6. P2 - Runtime Alignment 后续

目标：继续推进完整运行时牌库和资产，但不打断 reading contract 稳定工作。

执行项：

1. 继续注入剩余 50 张小阿尔卡纳运行时数据和 1:1.7 本地资产。
2. 每批资产继续维护 manifest、尺寸校验和视觉审核状态。
3. 新增高价值牌阵前，先确认 reading provider 能稳定尊重 position semantics。
4. 百科是否接入 `knowledge/wiki` 延后到 provider baseline 后再定。

完成标准：

- 运行时牌库扩张不破坏现有 e2e。
- 新增牌阵前有明确解读质量评估理由。

## 7. 明确暂缓

近期不做：

- 服务端 history persistence
- `session_capsule` 写入与长期记忆合并
- 多 Provider Router
- LangGraph checkpoint / interrupt / streaming
- 生日、星座、八字等混合模式
- 大范围视觉重构

这些能力等两阶段 contract、真实 provider baseline 和语义 eval 稳定后再打开。
