# Work Log - 2026-04-25 P1 Experience / Runtime Alignment

- `date`: `2026-04-25`
- `status`: `DONE`
- `scope`: `P1 light experience calibration and runtime alignment follow-up`

## 1. 目标

本轮按轻量收口执行：

- 不新增运行时牌阵
- 不改变 `POST /api/reading` request / response
- 不改变 `StructuredReading`、history storage 或 memory 边界
- 不打开服务端 persistence、长期画像或 memory merge
- 在现有 5 个牌阵内收口 R2 / R3 / R7 读感与 Runtime Alignment 细节

## 2. 核心实现

### 2.1 前台牌阵机制

新增 `apps/web/src/lib/spreadExperience.ts`，统一 `RevealView` 与 `InterpretationView` 的 5 个牌阵体验口径：

- `single`：单点聚焦，不把一张牌读成确定答案
- `holy-triangle`：过去 / 现在 / 潜在流向，强调时间与因果路径
- `four-aspects`：身体 / 情感 / 心智 / 精神分层观看
- `seven-card`：答案结果主轴 + 时间线 + 环境 / 投射张力
- `celtic-cross`：核心挑战 + 意识 / 潜意识 + 时间线 + 自我 / 环境 / 希望恐惧 / 结果

`/reveal` 新增“本轮观察重点”，并继续保留“牌阵如何组织随机”。`/reading` 在阅读机制区新增“证据路径”，显式说明牌面线索、位置语义与综合推断的顺序。

### 2.2 生成侧建设性阻力

`packages/prompting/src/index.ts` 已补齐 5 个牌阵的 spread-specific reading axis、final axis、guidance 与 LLM prompt bias。

建设性阻力继续遵守：

- 必须锚定牌面、正逆位、位置语义、牌阵关系或未验证现实条件
- 不得升级为确定性预言
- 不得第三方读心
- 不得替代医疗 / 法律 / 财务建议
- 不得命令用户做重大现实决定

### 2.3 Runtime Alignment

百科继续直接消费 runtime deck JSON，不接 `knowledge/wiki`。

本轮完成：

- 修正百科 runtime `arcana` 判定，适配当前 deck 中 `Major Arcana ...` / `Minor Arcana ...` 标签
- 补全 `wands` / `cups` / `swords` / `pentacles` 四花色过滤
- 覆度状态显示 22 张大阿卡纳与四个小阿卡纳花色各 14 张
- `scripts/validate-card-assets.mjs` 新增显式数量守卫：deck 必须 78 张，manifest 必须 79 条 entries，并必须包含 `/cardsV2/back.png`

## 3. 测试与验证

已运行：

- `npm run test:contract -w @aethertarot/web -- src/server/reading/__tests__/semantic-fixtures.spec.ts`
  - 通过：`12/12`
- `npm run validate:assets`
  - 通过：`Validated 78 tarot cards plus card back in apps\web\public\cardsV2.`
- `npm run build`
  - 通过
- `npm run lint -w @aethertarot/web`
  - 通过：`0` errors / `14` warnings
- `npm run test:e2e`
  - 通过：`24/24`

执行中曾遇到本地残留 Next dev server 导致 Playwright 复用旧进程，已停止残留进程后重跑验证。

## 4. 后续建议

- 继续观察 5 个牌阵的差异化机制说明是否清楚但不过载
- 继续抽样 R7 建设性阻力是否有牌阵差异、不冒犯、不越界
- 暂不新增牌阵，直到 R2 / R3 / R7 的前台体验更稳定
- 百科接 `knowledge/wiki` 仍保留为下一阶段独立对齐工作
