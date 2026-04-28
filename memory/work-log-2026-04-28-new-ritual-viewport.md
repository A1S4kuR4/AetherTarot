# Work Log - 2026-04-28 New / Ritual Viewport P1+P2

- `date`: `2026-04-28`
- `status`: `DONE`
- `scope`: `/new` and `/ritual` viewport, mobile CTA, density cleanup, smoke coverage`

## 1. 目标

本轮按 P1+P2 范围处理抽卡设置页和仪式页的残余 UX 问题：

- 修复 `/new` 常规桌面高度下的高度链、内部滚动和静默裁切风险。
- 让移动端用户在选择牌阵后不需要回滚顶部也能启动仪式或快速解读。
- 裁剪重复的路径说明文案，降低设置层信息噪音。
- 让 `/ritual` 使用固定导航栏下方的 fullscreen stage，并把牌堆高度改为随视口压缩。
- 补齐对应 e2e 断言，确保桌面与移动端关键路径可回归。

本轮明确不做 P3：

- 不新增 step pills / progress dots。
- 不改长按触觉反馈或半途松手提示。
- 不做完整移动端折叠设置重排。

## 2. 核心实现

### 2.1 `/new` 桌面高度与内部滚动

相关文件：

- `apps/web/src/components/home/RitualInitializer.tsx`
- `apps/web/src/app/globals.css`

实现内容：

- 保留 `new-reading-workspace` 在 `lg + height >= 720px` 下锁定视口高度的策略。
- `RitualInitializer` 根节点继续作为 `lg:h-full lg:min-h-0` 的三列工作区。
- 牌阵列表增加 `lg:overflow-y-auto`，避免未来新增牌阵时被父级 `overflow: hidden` 静默裁切。
- 设置列增加 `lg:overflow-y-auto`，让塔罗师和抽牌方式在低高桌面下仍可内部滚动。
- continuity / repeated theme 横幅保持顶部收缩区，不挤压主三列。

### 2.2 移动端固定 CTA

相关文件：

- `apps/web/src/components/home/RitualInitializer.tsx`
- `apps/web/src/app/globals.css`

实现内容：

- 启用已有 `.ritual-cta-bar`，在 `<lg` 固定底部显示：
  - 长按开始仪式 / 长按开始录入
  - 快速解读
- 桌面仍保留第一列底部 CTA；移动端隐藏该原位置 CTA，避免同一操作重复出现。
- `RitualInitializer` 移动端增加底部 padding，避免内容被固定 CTA 遮挡。
- CTA label、disabled 状态和说明文案抽成同一组局部常量，避免桌面与移动端行为漂移。

### 2.3 信息密度裁剪

相关文件：

- `apps/web/src/components/home/RitualInitializer.tsx`

实现内容：

- 删除第三列底部“当前路径：...”说明。
- 保留一处流程说明：桌面 CTA 区和移动 sticky CTA 使用同一条短文案。
- 焦点校准继续保留“更适合问 / 尽量别问”，但示例文案已保持压缩，不改变安全边界。

### 2.4 `/ritual` fullscreen stage 与牌堆自适应

相关文件：

- `apps/web/src/components/ritual/RitualView.tsx`
- `apps/web/src/app/globals.css`

实现内容：

- `RitualView` 外层改用 `.ritual-view-stage`，高度语义对齐固定 topbar 下方的舞台区域。
- 牌堆容器从固定 `h-[350px] md:h-[300px]` 改为 `.ritual-deck-field`：
  - mobile: `height: min(34dvh, 350px)`，带最小高度保护。
  - md+: `height: min(30dvh, 300px)`，带最小高度保护。
- 保留既有抽卡动画、FLIP overlay、牌面比例和抽牌逻辑。

## 3. 文档同步

已同步：

- `docs/10-product/ux-risk-status.md`

同步内容：

- `/new` 桌面内部滚动边界和防裁切策略。
- `/new` 移动端 sticky CTA 可达性。
- `/ritual` fullscreen stage 与 viewport-aware 牌堆区域。
- 本轮不改变 reading API、schema、抽牌算法、safety / sober 边界。

未新增 ADR，原因是本轮是既有 `DESIGN.md` 与 ADR 0003 下的布局收口，不改变核心架构决策。

## 4. 验证

已运行：

- `npm run build -w @aethertarot/web`
  - 通过。
- `npm run test:e2e -w @aethertarot/web`
  - `32/32` 通过。
- `git -C . diff --check`
  - 通过，仅出现 Windows 下 LF/CRLF 替换提示。

新增 / 扩展的 smoke 覆盖：

- `/new` desktop `1920x1080` 与 `1366x768`：body 不滚动，关键控件在视口内。
- `/new` mobile `390x844`：长按开始和快速解读固定底部，填写问题并选择牌阵后保持可见且状态正确。
- `/ritual` desktop `1366x768`：标题、槽位、按钮、牌堆和状态面板保持在视口内。

验证过程中发现：

- 本地曾有 stale Next dev server 占用 `3000`，导致第一次 e2e 命中旧 bundle，ReadingProvider hydration flag 未设置。
- 停止该旧 dev 进程后，按标准 dev-mode Playwright 配置重跑，完整 e2e 通过。
- 使用 `next start` 跑完整 e2e 会因 beta/auth 环境差异出现 `/api/reading 401`，不作为本轮回归真相；标准 dev-mode e2e 才是当前项目配置下的主验收路径。

## 5. 明确未改

- 未修改 `POST /api/reading` request / response。
- 未修改 `StructuredReading`、shared types 或 output schema。
- 未修改抽牌随机算法、逆位概率或 `drawCardsForSpread`。
- 未修改 safety / sober / crisis 边界。
- 未新增运行时依赖。

## 6. 后续建议

- P3 可另开一轮补 `/new -> /ritual -> /reveal -> /reading` 的 compact step pills / progress dots。
- 移动端长按可后续补 vibration API、`touch-action` / selection guard，以及半途松手提示。
- 若后续继续增加牌阵，优先观察中间牌阵列内部滚动是否仍保持足够可发现性。
