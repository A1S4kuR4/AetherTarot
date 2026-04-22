# 当前状态 + 优先级清单（2026-04-22 同步）

- `last_updated`: `2026-04-22`
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

本文档基线以 `2026-04-22` 的仓库实物与本地验证结果为准，不再仅复述 `2026-04-10` 或 `2026-04-12` 的旧状态。

## 2. 当前状态快照

截至 `2026-04-22`，AetherTarot 已经不再处于“缺核心架构”的阶段，而进入了“主链已成、运行时牌池已完整、连续性边界开始收紧、第二个新增高价值牌阵已上线、R2/R3/R7 第一版读感机制已通过回归复核”的阶段。

当前可确认的事实如下：

- reading 主链已闭环：`POST /api/reading`、结构化 `StructuredReading`、Two-Stage Reading MVP、最小 LangGraph 与 Dual-Tier Safety 已落地。
- Web 主流程已存在并能构成完整体验：`/`、`/new`、`/ritual`、`/reveal`、`/reading`、`/journey`、`/history`、`/encyclopedia` 均已接入当前应用。
- 后端 contract 当前健康：`npm run build` 通过，`npm run test:contract -w @aethertarot/web` 全绿（`40/40`）。`npm run test:e2e` 已在本轮 P1 / P0 收口后保持全绿（`23/23`）：此前失败集中在 Web smoke 的客户端 hydration / `startReading()` 长按启动 / 受保护页面重定向等待，现已通过显式等待 ReadingProvider hydration、逐项状态断言与 follow-up 提交稳定化修复。
- Playwright 用例已对齐当前 `/new -> /ritual -> /reveal -> /reading -> /journey` 路径，并在测试环境固定使用 `placeholder` provider；Web smoke helper 当前会等待 ReadingProvider 完成本地状态 hydration，再执行输入、牌阵选择、长按启动与 protected route 断言。

知识层现状：

- `knowledge/wiki/major-arcana/`：`22` 页
- `knowledge/wiki/minor-arcana/`：`56` 页
- `knowledge/wiki/concepts/`：`10` 页
- `knowledge/wiki/spreads/`：`9` 页

运行时现状：

- `data/decks/rider-waite-smith.json` 当前包含完整 `78` 张运行时牌：Rider-Waite-Smith 全牌池已接入
- `apps/web/public/cards/` 当前包含 `79` 个文件：`78` 张正面牌面与 `1` 张背面
- `data/spreads/` 当前已上线 `single`、`holy-triangle`、`four-aspects`、`seven-card`、`celtic-cross` 五个运行时牌阵，其中 `four-aspects` 与 `seven-card` 已完成 `/new -> /ritual -> /reveal -> /reading -> /journey` 全链路接入
- hard-stop 示例资源已替换为中国大陆固定的真实危机 / 心理支持入口，并补入 continuity capsule 的高风险细节净化
- Reading 页已完成第一版“证据感阅读体验”收口：逐牌展示显式拆为“牌面线索 / 位置语义 / 综合推断”，用于缓解 R3 迎合错觉，并保持现有 `StructuredReading` schema 不变
- `/reveal` 与 `/reading` 已补入第一版“牌阵如何组织随机”机制说明：随机决定牌面与正逆位，牌阵决定阅读顺序、位置语义与综合路径；该机制缓解 R2，但不宣称用户能操纵随机
- reading provider / LLM prompt 已加入第一版“建设性阻力”规则：reading 至少保留一个来自牌面、正逆位、位置语义、牌阵张力或现实未验证条件的非迎合观察点；后续读感校准已让不同问题类型使用不同阻力表达，避免退回同一句模板；该规则缓解 R7，但不改变 safety layer 或输出协议
- `2026-04-22` 已复跑 targeted semantic fixtures、build、完整 e2e 与 lint：`10/10`、build passed、`23/23`、`0` errors / `13` existing warnings；这次复核未暴露需要改变 schema、牌阵数量或 memory 边界的问题
- `/new` 已把明显重大现实决策类提问的前置提醒推进为现实边界确认：用户需先确认塔罗只用于整理线索，现实信息、专业意见与个人底线优先，才能进入抽牌仪式；服务端 Tier 2 `sober_check` 仍保持独立
- `/new` 已新增非阻断的重复主题提醒：基于本地 completed history 中最近若干条相同 `question_type` 的记录，提示用户先回看上一条线索；该机制不启用服务端 persistence、不打开 memory merge，也不改变 `POST /api/reading` 协议

这意味着当前主瓶颈已经不是“知识是否足够”，也不是“继续立刻扩 runtime / memory”，而是：

- 现有 5 个运行时牌阵的前台组织机制是否真的清楚、不过载
- 文档是否持续与仓库实物同步
- 长期连续性能力是否能先守住边界，不提前打开服务端 persistence、memory merge 或长期画像

## 3. 能力状态分层

### 已完成

- Reading backend 主链
- Structured output 协议
- Two-Stage Reading MVP
- Dual-Tier Safety
- `placeholder + llm baseline` provider 边界
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

### 阻塞点一：文档开始落后于仓库实物

当前文档系统已经出现“状态滞后于仓库实物”的迹象。

典型信号：

- 部分文档仍写运行时牌库 `27` 张、PNG `28` 张
- 当前仓库实物已是运行时牌库 `78` 张、PNG 文件 `79` 个

这不应被视为次要维护工作，而应视为主线风险，因为它会直接影响优先级判断与后续协作理解。

### 阻塞点二：运行时牌阵与知识消费边界仍未收口

当前最大产品缺口不是 UI 页面缺失，而是：

- `four-aspects` 与 `seven-card` 已上线，但运行时牌阵扩展仍只推进到 `5` 个
- Encyclopedia 仍直接消费 deck JSON，尚未决定是否进入 `knowledge/wiki` runtime 对齐

### 阻塞点三：长期连续性能力仍缺位

历史、Journey 与两阶段 reading 已经形成产品雏形，但长期连续性能力仍未真正开始：

- history 仍是 localStorage
- `session_capsule` 已限定为 completed reading 才生成，且会先做模板收敛与高风险细节净化
- 尚未定义服务端 persistence、memory merge 与长期画像边界

## 5. 当前优先级清单

### P0. 保持可信回归与真相同步

状态：已恢复。最新本地 `npm run test:e2e` 为 `23/23`，此前的 `12/23` Web smoke 波动已收口。

已完成：

1. 修复 Playwright 失效用例，使 E2E 与当前 `/new -> /ritual -> /reveal -> /reading -> /journey` 实际流程一致。
2. 在 Playwright 测试环境固定 `AETHERTAROT_READING_PROVIDER=placeholder`，避免本地 `llm` 配置影响回归稳定性。
3. 同步 README、memory、UX 状态文档中的旧数字与旧叙事。
4. 为 Web smoke 增加 ReadingProvider hydration 等待与 `/new` 表单逐项状态断言，修复 `startReading()`、follow-up 表单与受保护路由 redirect 的等待不稳定。
5. 为 R2/R7 UX 改动补充 smoke 与 semantic fixture 回归，并确认 `npm run test:e2e` 仍为 `23/23`。
6. `2026-04-22` 再次复核 `semantic-fixtures.spec.ts`、build、完整 e2e 与 lint，确认当前读感校准线仍可作为下一轮工作基线。

后续要求：

- 继续保持全套 E2E 绿色，若再次失败必须记录新的失败用例、失败断言与通过数量
- 新 UI / 新流程改动必须同步更新 smoke 断言
- 文档中的运行时牌库与资产数字必须继续跟仓库实物对齐

### P1. Runtime Alignment 收口

目标：在完整牌池之上继续收口运行时能力与前台理解机制，而不是回到“继续大量扩知识页”的旧主线。

当前补充进展：

- 已在 Encyclopedia 前台显式补出 runtime / knowledge 覆度状态，并明确显示当前为 `78/78` runtime vs `78/78` knowledge
- 当前已明确：Encyclopedia 本阶段继续直接消费 runtime deck JSON，而不是立即改成直接消费 `knowledge/wiki`
- `knowledge/wiki` direct consumption 继续保留为下一阶段的独立对齐工作，不与本轮 runtime 扩展混做
- `four-aspects` 与 `seven-card` 已上线，并补齐了 authority、前台布局、contract 与 Playwright smoke 回归
- R2/R7 已完成第一版前台机制与生成语气收口：组织随机与建设性阻力都复用现有 schema，不打开服务端 persistence，不新增运行时牌阵

执行项：

1. 运行时牌库与本地资产已完整收口到 `78/78`；P1 的下一步不再是补牌，而是观察现有 5 个牌阵的前台组织机制是否足够清楚。
2. 新增牌阵继续暂缓；只有当 R2/R3/R7 的前台体验稳定后，才重新评估高价值牌阵与对应 position semantics。
3. 决定 Encyclopedia 是否继续直接消费 deck JSON，还是开始接 `knowledge/wiki`。

### P2. 长期连续性能力设计

目标：在不打断当前 contract 稳定性的前提下，先定义后续 memory / persistence 边界。

执行项：

1. 定义 `session_capsule` 接入点。
2. 定义历史 completed reading 与 future thread/session 的边界。
3. 定义服务端 history persistence 与长期记忆的演进顺序。

在此之前，不打开大规模 memory / thread / profile 持久化实现。

## 6. 当前判断与执行原则

- 当前最该做的不是重新打开 `M1 / M2 / M3` 讨论，而是维护 contract 稳定性，并把重心转向 runtime alignment 与长期连续性设计。
- 当前不应回退去把 ingest 重新设为默认主线。
- 当前不应把 memory persistence 提前到回归修复之前。

## 7. 验收口径

本文件中的状态判断默认以以下事实为依据：

- 状态数字来自当前仓库实物：
  - `data/decks/rider-waite-smith.json`
  - `apps/web/public/cards/`
  - `knowledge/wiki/*`
- 健康度结论来自当前本地验证：
  - `npm run build`：通过
  - `npm run test:contract -w @aethertarot/web`：通过（`40/40`）
  - `npm run test:e2e`：通过（`23/23`；已覆盖 `/reveal` 与 `/reading` 的组织随机说明）
  - `npm run test:contract -w @aethertarot/web -- src/server/reading/__tests__/semantic-fixtures.spec.ts`：通过（`10/10`，`2026-04-22` 复核）
  - `npm run lint -w @aethertarot/web`：通过（`0` errors，`13` existing warnings，`2026-04-22` 复核）

## 8. 默认假设

- 文档语言默认为中文
- 文档定位为内部执行入口，不写成对外宣传稿
- 优先级固定为：先保持可信回归与文档同步，再收口牌阵与运行时体验，再开长期连续性能力
- 本文件作为 `memory/` 中的正式桥接入口存在；后续若主线状态变化，应优先增量更新本文件，而不是再平行创建一份新的“当前状态”文档
