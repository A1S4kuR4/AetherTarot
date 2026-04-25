# 前端图标渲染回归复盘

- `date`: `2026-04-25`
- `scope`: `apps/web` 前端 UI
- `status`: 已修复，需作为后续 UI 回归检查项

## 1. 现象

首页、抽卡页、旅程页等多个页面中，图标没有渲染为图形，而是直接显示为英文 ligature 名称，例如：

- `keyboard_double_arrow_down`
- `center_focus_strong`
- `filter_1`
- `change_history`
- `splitscreen`
- `dashboard`
- `grid_view`

这类现象会让界面看起来像文本泄漏，也会干扰布局宽度、按钮高度和用户对导航/操作入口的判断。

## 2. 根因

旧实现依赖 Google `Material Symbols Outlined` 字体：

- `apps/web/src/app/layout.tsx` 通过 Google Fonts 请求 Material Symbols
- `apps/web/src/app/globals.css` 通过 `.material-symbols-outlined` 开启 ligature 渲染
- 各组件用 `<span className="material-symbols-outlined">center_focus_strong</span>` 这类写法显示图标

该方案的脆弱点是：一旦字体请求失败、被网络环境拦截、缓存异常、dev server 状态异常，浏览器就会把 span 内文本当普通文字显示。图标 id 越长，破坏性越明显。

## 3. 修复方案

本次修复将 Material Symbols 字体依赖替换为本地 SVG 组件渲染：

- 新增 `apps/web/src/components/ui/LegacyIcon.tsx`
- 保留现有 icon id 数据契约，例如 `filter_1`、`grid_view`、`center_focus_strong`
- 在渲染层将这些 id 映射到 `lucide-react` 图标组件
- 移除 `layout.tsx` 中 Material Symbols 字体请求
- 移除 `globals.css` 中 `.material-symbols-outlined` 样式
- 替换 `apps/web/src` 下所有 `material-symbols-outlined` 用法

这个方案不要求修改牌阵 JSON 或共享类型，只把不稳定的远程字体 ligature 渲染改为稳定的本地组件渲染。

## 4. 防复发规则

后续前端 UI 改动应遵守：

- 不再新增 `material-symbols-outlined`。
- 不再把图标名作为可见文本依赖字体 ligature 渲染。
- 如果运行时数据仍保存 `icon: string`，使用 `LegacyIcon` 或后续等价映射组件渲染。
- 新增动态 icon id 时，必须同步补充 `LegacyIcon` 映射；未知 id 只能降级为通用图形，不能裸露为文本。
- UI 验收时至少检查首页 `/` 与抽卡页 `/new`，因为这两个页面最容易暴露长 icon id。

推荐快速搜索：

```powershell
Get-ChildItem -Path apps/web/src -Recurse -Include *.tsx,*.ts,*.css |
  Select-String -Pattern "material-symbols-outlined|Material Symbols"
```

搜索结果应为空。

## 5. 验证

本次修复后已执行：

```powershell
npm run build
```

结果：

- Next.js 编译通过
- TypeScript 检查通过
- `/`、`/new`、`/journey`、`/encyclopedia`、`/ritual`、`/reveal`、`/reading` 等页面均完成静态/动态构建

## 6. 经验

远程字体 ligature 图标适合原型阶段，不适合作为关键 UI 控件的长期依赖。AetherTarot 的按钮、导航、牌阵选择、状态提示都属于核心交互表面，图标必须具备离线/弱网/缓存异常下的稳定降级能力。

对于这类 UI 资产，优先选择：

- 本地 SVG 组件
- 已纳入 bundle 的 icon library
- 明确的 fallback 映射

避免选择：

- 依赖远程字体成功加载的 ligature 文本
- 无 fallback 的 CDN 图标字体
- 把内部 icon id 直接暴露到 DOM 可见文本中
