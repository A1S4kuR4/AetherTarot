# Final 阶段追问整合回归复盘

- `date`: `2026-04-25`
- `scope`: `POST /api/reading` 两阶段 reading flow 与 `/reading` 前端呈现
- `status`: 已修复，需作为后续两阶段解读回归检查项

## 1. 现象

用户完成抽卡后，系统在初读阶段给出两个延伸追问。用户输入回答并生成整合深读后，综合解读与初读相比差异不明显，容易让用户感觉回答没有进入解读链路。

同时，整合深读末尾仍展示一个新的“延伸追问”，但没有输入框。这个呈现容易让用户误判为前端漏渲染输入框，或不清楚是否需要继续提交回答。

## 2. 协议判断

根据 `docs/30-agent/output-schema.md` 的字段语义：

- `reading_phase = initial` 且 `requires_followup = true` 时，`follow_up_questions` 是进入第二阶段的校准输入，前端应渲染输入框。
- `reading_phase = final` 时，`follow_up_questions` 只是延伸反思问题，不再阻塞 completed 状态，也不应再要求用户提交。

因此，final 阶段没有输入框本身是符合协议的。用户可以在自省后把自己的观察写入“你的回望与觉察”，但这不是继续生成解读的必填步骤。

真正的问题是 placeholder final provider 对用户回答的可见整合不够强，导致 final 阶段看起来像复述初读主轴。

## 3. 修复方案

本次修复保持两阶段协议不变，只增强 final 阶段的可见整合与前端命名：

- `packages/prompting/src/index.ts`
  - 新增追问回答摘要 helper。
  - final `synthesis` 明确写入用户回答带来的校准信息。
  - final `reflective_guidance` 增加基于用户回答的校准指引。
  - final `follow_up_questions` 绑定第一条用户回答，作为后续自省题，而不是泛化追问。

- `apps/web/src/components/reading/InterpretationView.tsx`
  - initial 阶段继续显示“延伸追问”。
  - final 阶段改为显示“延伸自省”，降低“缺少输入框”的误解。

- `apps/web/src/server/reading/__tests__/semantic-fixtures.spec.ts`
  - 新增回归测试，断言 final reading 的 `synthesis`、`reflective_guidance` 与 `follow_up_questions` 会可见地包含用户追问回答。

## 4. 防复发规则

后续调整两阶段 reading flow 时应检查：

- final 阶段必须保留 initial 主轴，但不能只做初读复述。
- 用户提交的 `followup_answers` 至少应在 `synthesis` 或 `reflective_guidance` 中产生可见校准。
- final 阶段的 `follow_up_questions` 不应被前端渲染为新的必填输入。
- 前端文案应区分“需要用户提交的追问”和“completed reading 后的自省题”。
- 不要通过新增第三阶段输入来修复该问题，除非同步更新 output schema、阅读流程、历史记录与评测。

推荐回归关注：

```powershell
npm run test:contract -w @aethertarot/web -- src/server/reading/__tests__/semantic-fixtures.spec.ts
```

## 5. 验证

本次修复后已执行：

```powershell
npm run test:contract -w @aethertarot/web -- src/server/reading/__tests__/semantic-fixtures.spec.ts
npm run build -w @aethertarot/web
```

结果：

- reading semantic fixtures 通过，包含 11 个测试。
- Next.js production build 通过。
- TypeScript 检查通过。

## 6. 经验

两阶段 reading 的关键不是让第二阶段彻底改写第一阶段，而是让用户补充成为清晰、可复核的校准线索。final 阶段应同时满足两个条件：延续牌面主轴，以及让用户看见自己的回答确实改变了解读的收束角度。

前端呈现也需要承担协议解释责任。相同字段 `follow_up_questions` 在 initial 与 final 阶段含义不同，因此 UI 标题不能一律叫“延伸追问”。
