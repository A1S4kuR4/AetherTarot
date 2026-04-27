# Work Log - 2026-04-26 P3 Ritual Animation / Settlement Radar

- `date`: `2026-04-26`
- `status`: `DONE`
- `scope`: `ritual draw animation, reveal view build fix, settlement radar visualization`

## 1. 目标

本轮围绕 `remotion-dev/skills` 的视觉与时间线思路做前台体验优化：

- 修复揭牌动画 JSX 结构导致的构建失败
- 在结算 / 阅读画面落地可解释的六维雷达图
- 确认 `@remotion/player` 不是只加依赖，而是在阅读结算图中真实使用
- 优化 `/ritual` 抽卡流程的洗牌、飞出、悬浮、入槽动画
- 降低抽卡最后两步的断帧感和残影感

## 2. 核心实现

### 2.1 结算雷达图

`apps/web/src/components/reading/RadarChart.tsx` 改为由 `@remotion/player` 承载的 Remotion composition，并保留结束帧状态，避免图形播放完后回到空图。

雷达图六个维度改为由当前抽出的牌计算：

- 精神：大阿卡纳数量
- 火：权杖 / fire 倾向
- 水：圣杯 / water 倾向
- 土：星币 / earth 倾向
- 风：宝剑 / air 倾向
- 张力：逆位数量

`apps/web/src/components/reading/InterpretationView.tsx` 负责从 `drawnCards` 统计各维度，并把主导倾向、条形读数和主题标签传给雷达图。这样图表不再只是装饰，而是能说明“这组牌为什么呈现这种总体气候”。

### 2.2 揭牌构建修复

`apps/web/src/components/reveal/RevealView.tsx` 修复了 3D 卡牌容器附近错误的 JSX 闭合结构，恢复 `npm run build` 可通过状态。

揭牌动效继续使用 Framer Motion 的 `useAnimate`，保持卡牌容器与内层翻面的职责分离。

### 2.3 抽卡动画

`apps/web/src/components/ritual/RitualView.tsx` 经过多轮校准后，最终放弃用估算坐标的 Remotion overlay 来表现抽卡入槽，改为 Framer Motion FLIP：

- 抽卡开始时读取牌堆源点和目标卡槽的真实 DOM rect
- 用同一个 fixed overlay 从牌堆位置连续飞到目标卡槽
- 等 overlay 完成后再提交 `drawnCards` 状态
- 状态提交后延迟到下一个 paint 再清理 overlay，减少同一张牌在两个位置同时出现的残影
- 洗牌阶段使用多张牌背的错位、错帧、旋转与位移，而不是简单整体旋转

这次调整的方向是解决用户指出的 p1 -> p2 像两帧切换的问题：根因不是单纯时长不够，而是动画元素与最终入槽元素不是同一个视觉轨迹，并且目标坐标曾经依赖估算值。

## 3. 设计取舍

- 阅读结算雷达图使用 Remotion Player，因为它是可复用的数据展示动画，也符合最初“策略一 Player 嵌入”的要求。
- 抽卡交互保留 Framer Motion，因为它需要响应真实 DOM 布局、点击节奏和槽位位置；这里使用 FLIP 比把交互硬塞进 Remotion 时间线更稳定。
- `/ritual` 没有在抽卡阶段直接翻正面。当前产品流程仍然把“揭示牌阵”作为正面展示节点，抽卡阶段只强化牌背飞出、落位和稀有牌震颤。

## 4. 验证

已运行：

- `npm run build`
  - 通过
- `git -C . diff --check`
  - 通过，仅出现 Windows 下 LF/CRLF 替换提示

## 5. 明确未做

- 未改变 `POST /api/reading` request / response
- 未改变 `StructuredReading`
- 未改变知识库 ingest 或后端解读逻辑
- 未提交本地未跟踪截图文件

## 6. 后续建议

- 用浏览器实际录屏继续观察抽卡最后 300ms 的顺滑度
- 如果后续要在抽卡阶段展示正面，需要同时调整产品流程文案，避免和“揭示牌阵”步骤语义冲突
- 雷达图维度如果继续扩展，应优先从 `knowledge/wiki` 的概念页沉淀规则，再同步到前台统计逻辑
