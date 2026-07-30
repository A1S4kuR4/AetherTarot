# `/reading` UI / WCAG 正式审计（2026-07-30）

## 1. 结论

审计结论：**通过，19 / 20（Excellent）**。

- `/reading` 及分享弹窗没有未解决的 P0 / P1。
- WCAG 2.2 A / AA 自动审计覆盖的状态为 0 violations。
- 首屏牌阵仅第一张实际 LCP 候选图片使用 `loading="eager"`，其余图片保持 `lazy`；1 / 3 / 4 / 7 / 10 张牌流程均验证 DOM 加载策略，`/reading` 定向运行未再捕获 LCP 图片告警。
- Paper Mode、内容顺序、reading API、schema、状态流与牌义逻辑均未改变。
- 2 个 P2、2 个 P3 已记录，均不构成本轮发布阻断。

## 2. 审计范围与环境

### 范围

- 路由：`/reading`
- 状态：initial、final、loading、recoverable error、safety intercept、sober gate、分享弹窗
- 视口：1440 × 900、390 × 844
- 特殊条件：200% CSS zoom、长问题、长正文、`prefers-reduced-motion: reduce`
- 交互：键盘顺序、skip link、焦点可见性、锚点导航、表单标签、状态通知、弹窗焦点陷阱、Escape、焦点归还
- 媒体与布局：替代文本、颜色对比度、触摸目标、横向溢出、图片加载策略

### 明确排除

- `/quick-reading`
- reading API、结构化输出 schema、状态机、牌义与安全策略的业务规则
- 视觉重设计；本轮只做保持 Paper Mode 的局部合规修复

### 环境与规则基线

| 项目 | 版本 / 日期 |
| --- | --- |
| 审计日期 | 2026-07-30（Asia/Shanghai） |
| 分支 | `feature/review-tarot-modes` |
| Next.js | 16.2.6 |
| Playwright | 1.59.1，Chromium project |
| `@axe-core/playwright` | 4.12.1 |
| 自动规则 | WCAG 2.0 / 2.1 / 2.2 A、AA tags |
| Web Interface Guidelines | 2026-07-30 获取的最新 `command.md` |
| Impeccable | 4.0.3 detector；`DO_NOT_TRACK=1`、关闭更新检查 |

规则来源：[WCAG 2.2](https://www.w3.org/TR/WCAG22/)、[Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines)、[Next.js Image](https://nextjs.org/docs/app/api-reference/components/image)。

## 3. 五维评分

评分采用 0–4：0 为阻断，4 为当前范围内无已知实质缺口。

| 维度 | 分数 | 依据 |
| --- | ---: | --- |
| Accessibility | 4 / 4 | 覆盖状态 axe 0 violations；键盘、landmark、dialog、label、live region、替代文本与对比度通过 |
| Performance | 3 / 4 | `/reading` LCP 候选图片加载策略已修复；尚未执行路由隔离的正式 Lighthouse / RUM 测量，且保留两项非阻断优化 |
| Responsive | 4 / 4 | 390 × 844 与 200% zoom 无实质横向溢出；触摸目标不低于 WCAG 24 px 底线 |
| Theming | 4 / 4 | 修复沿用既有 Paper Mode，并新增可访问的 ink token，不改双表面视觉语言 |
| Implementation Integrity | 4 / 4 | 未改公共 `CardImage` 接口、reading API/schema/状态流/业务行为；lint、build 与 smoke 全绿 |
| **总分** | **19 / 20** | **Excellent** |

## 4. 已修复的 P1

### P1-01：缺少真正可用的跳转主内容入口与唯一主 landmark

- WCAG：2.4.1 Bypass Blocks；landmark 语义完整性
- 原因：内部 skip link 位于目标内容区域，且页面壳与 reading layout 形成嵌套 `main`。
- 修复：在 `Topbar.tsx:39` 为 `/reading` 提供首个可聚焦 skip link；`ReadingLayout.tsx:13` 改为唯一目标 `#reading-main`，不再产生嵌套 `main`。
- 验证：Tab 首项、Enter 后焦点目标、单一 `main` 数量均由 Playwright 断言。

### P1-02：关闭的移动侧栏仍暴露可聚焦元素

- WCAG：4.1.2 Name, Role, Value；ARIA hidden-focus 规则
- 原因：关闭状态仅依赖视觉位移 / `aria-hidden`，内部链接仍可能进入键盘顺序。
- 修复：`Sidebar.tsx:60` 在关闭时设置 `inert`。
- 验证：axe 不再报告 serious `aria-hidden-focus`，键盘顺序不进入关闭抽屉。

### P1-03：文字与按钮颜色对比度不足

- WCAG：1.4.3 Contrast (Minimum)
- 原因：基础 terracotta、indigo、safety 色适合作为装饰色，但直接作为纸面文字色时不足；`sober_anchor` 的全局 opacity 进一步降低全部正文对比度。
- 修复：
  - `globals.css:25-42` 新增 `terracotta-ink`、`indigo-ink`、`safety-ink`；主按钮改用可访问的 terracotta ink。
  - `BoundaryNote.tsx`、`SafetyIntercept.tsx`、`CardByCardSection.tsx`、`SpreadHeroGrid.tsx`、`FeedbackSection.tsx` 与 `ReadingSidebar.tsx` 使用 ink / text token。
  - `InterpretationView.tsx` 移除 sober 模式的全局 `opacity-90`，只收敛牌面装饰光晕。
  - `LoadingState.tsx` 移除正文额外透明度。
- 验证：initial、final、loading、error、safety、sober 与 dialog 的 axe color-contrast 均为 0 violations。

### P1-04：200% zoom 下关闭侧栏产生横向可滚动区域

- WCAG：1.4.10 Reflow
- 原因：off-canvas drawer 的视觉位移仍扩大根元素 scroll width。
- 修复：`globals.css:78` 为根元素设置 `overflow-x: clip`，保留侧栏交互实现。
- 验证：390 × 844 和 200% zoom 的 `scrollWidth - clientWidth <= 2px`。

### P1-05：首屏牌阵 LCP 图片仍为 lazy

- 规则：Next.js Image LCP guidance；Web Interface Guidelines performance
- 原因：`SpreadHeroGrid` 未向 `CardImage` 传递首屏候选图片加载提示。
- 修复：`SpreadHeroGrid.tsx:55` 仅索引 0 使用 `loading="eager"`，其余保持 `loading="lazy"`；未修改 `CardImage` 公共接口。
- 验证：`smoke.spec.ts:559` 对 1 / 3 / 4 / 7 / 10 张牌断言首张 eager、其余 lazy；定向 `/reading` 控制台监听未捕获 LCP 告警。

## 5. 未修复但已记录的发现

### P2-01：分享弹窗动效未显式响应 reduced motion

- 位置：`apps/web/src/components/share/ReadingShareDialog.tsx:279-296`
- 说明：弹窗使用 Motion 进入 / 退出动画，当前没有显式接入 `useReducedMotion`。WCAG 2.3.3 属 AAA，本轮 AA 不阻断，但建议后续统一收敛。
- 建议：后续执行 `$impeccable animate`，在 reduced motion 下取消位移、缩放与非必要过渡。

### P2-02：共享按钮样式使用 `transition-all`

- 位置：`apps/web/src/app/globals.css:223-273`
- 说明：多个按钮变体使用 `transition-all`，超出实际需要的属性范围；未造成当前 WCAG violation，但与 Web Interface Guidelines 的精确过渡建议不一致。
- 建议：后续替换为 `transition-[background-color,border-color,color,box-shadow,transform]` 等明确属性。

### P3-01：分享预览 `<img>` 缺少显式尺寸属性

- 位置：`apps/web/src/components/share/ReadingShareDialog.tsx:424`、`ReadingShareCard.tsx:229`
- 说明：父容器已约束尺寸，当前未观察到显著 CLS；显式 `width` / `height` 仍能让浏览器更早保留空间。
- 建议：生成尺寸确定后补齐固有尺寸属性。

### P3-02：程序化聚焦的 dialog 标题使用 `outline-none`

- 位置：`apps/web/src/components/share/ReadingShareDialog.tsx:316`
- 说明：标题不是可操作控件，且仅用于打开弹窗后的程序化聚焦，所以不构成 2.4.7 失败；保留轮廓或提供柔和 focus-visible 样式会让视觉焦点更可解释。
- 建议：后续视觉打磨时添加非侵入式焦点样式。

## 6. 正向发现

- 牌面替代文本包含牌名、牌阵位置与正 / 逆位信息。
- 表单控件具备可访问名称；输入状态、loading、feedback、notes 使用可感知的状态通知。
- 分享弹窗具备 dialog 语义、焦点陷阱、Escape 关闭及触发按钮焦点归还。
- 页面锚点与移动阅读导航共享同一组 section id，键盘和触摸均可到达。
- `/reading` route transition、首屏牌阵、滚动与 spinner 在 reduced motion 下均已验证；分享弹窗动效单列为 P2。
- 自动审计采用 WCAG 24 × 24 px 触摸目标底线；项目仍以 44 × 44 px 作为移动体验目标。
- Impeccable detector 对审计路径返回 `[]`。

## 7. 自动化与人工证据

### 可重复运行的审计

```bash
npm run test:a11y:reading -w @aethertarot/web
```

结果：4 / 4 passed。覆盖桌面 initial / final / share dialog、移动与 200% zoom、loading / error、safety intercept / sober gate；所有覆盖状态 WCAG 2.2 A / AA violations 为 0。

### 回归、静态检查与构建

```bash
npm run test:e2e -w @aethertarot/web -- --project=chromium tests/smoke.spec.ts
npm run lint -w @aethertarot/web
npm run build -w @aethertarot/web
$env:DO_NOT_TRACK='1'; $env:IMPECCABLE_NO_UPDATE_CHECK='1'; node .agents/skills/impeccable/scripts/detect.mjs --json apps/web/src/components/reading apps/web/src/components/share apps/web/src/components/layout/Topbar.tsx apps/web/src/components/layout/Sidebar.tsx apps/web/src/app/globals.css
```

结果：

- Chromium smoke：30 / 30 passed（4.3 min）。
- ESLint：通过。
- Next.js production build：通过；TypeScript、page data 与 20 个静态页面生成成功。
- Impeccable detector：`[]`。
- `git diff --check`：通过。

### 截图与人工复核

可重复审计的 HTML 证据保存在 `apps/web/playwright-report/index.html`，其中包含以下测试附件：

- `reading-desktop-1440x900`（桌面完整页面）
- `reading-mobile-390x844`（移动完整页面）
- `reading-mobile-zoom-200`（移动 200% zoom 视口）

额外的桌面状态截图保存在 `apps/web/scratch-shots/`：

- `audit-2026-07-30-desktop-states-loading.png`
- `audit-2026-07-30-desktop-states-share-dialog.png`
- `audit-2026-07-30-desktop-states-feedback-submitted.png`
- `audit-2026-07-30-desktop-states-notes.png`

人工复核结论：桌面 / 移动首屏层级、长页面内容顺序、状态文案、分享弹窗遮罩与焦点范围、按钮对比度、反馈和手记区均未发现 P0 / P1。一次额外依赖真实 LLM 的移动截图尝试因本地 token 限额进入 recoverable error；正式移动截图与 reflow 证据来自同一套通过的 mocked accessibility suite，因此该环境限制不影响审计结论。

## 8. 环境噪音与剩余风险

- 本地未连接持久化服务时，测试日志会出现 `[stored-readings] fetch failed`；相关用例仍以本地 fallback 完成，属于已知测试环境噪音。
- 完整跨路由 smoke 进程曾输出一条未携带路由 / DOM 来源的 Next.js LCP 提示；1 / 3 / 4 / 7 / 10 张 `/reading` 定向流程和 `/reading` 控制台监听均无该提示，因此不判定为本审计范围内回归。若要清零全站提示，应另开任务审计 `/reveal`、`/quick-reading` 与百科图片，不在本轮扩张范围。
- 本轮未采集生产 RUM 或路由隔离 Lighthouse 指标，所以 Performance 保留 3 / 4；当前证据证明加载意图和告警路径已修复，不等同于生产 LCP 数值承诺。

## 9. 后续建议顺序

1. P2：让分享弹窗显式尊重 reduced motion。
2. P2：把共享按钮 `transition-all` 收敛到实际动画属性。
3. P3：补齐分享预览图片固有尺寸。
4. P3：为程序化聚焦的 dialog 标题提供轻量可视焦点。
5. 单独建立全站图片 LCP / Lighthouse 基线，不与本轮 `/reading` 合规修复混合。
