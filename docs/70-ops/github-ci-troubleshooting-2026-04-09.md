# GitHub CI 排障记录（2026-04-09）

## 1. 文档目的

本记录沉淀 2026 年 4 月 9 日 `feature/solve-ux-risks` 分支的 GitHub CI 排障过程，供后续遇到类似问题时快速定位与复用。

本次问题覆盖：

- `actions/setup-node` 依赖缓存失败
- `lint-build` 中 ESLint 硬错误
- `e2e` 中 Playwright 冒烟用例失败
- Next.js / Tailwind 构建阶段缺少 `lightningcss` Linux native 包

---

## 2. 事件摘要

排障开始时，GitHub CI 主要出现了三轮问题：

1. `setup-node` 在缓存依赖时提示 `Some specified paths were not resolved`
2. `lint-build` 进入 `lint` 后出现多处 ESLint error，导致 job 失败
3. `build` 与 `e2e` 随后在 Linux runner 上报错，核心现象为：
   `Cannot find module '../lightningcss.linux-x64-gnu.node'`

最终处理结果：

- `Web CI` workflow 恢复可运行
- `lint` 无 error，仅剩 `no-img-element` warning
- `build` 本地通过
- `e2e` 本地 19/19 通过
- 分支合并 `main` 后重新推送，GitHub CI 全量通过

---

## 3. 根因拆解

### 3.1 `setup-node` 缓存失败

初始 workflow 在 [web-ci.yml](D:/GoogleProject/AetherTarot/.github/workflows/web-ci.yml) 中配置了 `setup-node` 缓存，但 monorepo / workspace 场景下该缓存路径配置较脆弱，触发了：

```text
Some specified paths were not resolved, unable to cache dependencies.
```

处理策略：

- 直接移除 `actions/setup-node@v4` 的 `cache` 与 `cache-dependency-path`
- 保留 `node-version`
- 先恢复 CI 可用性，再处理后续真实错误

结论：

- 对当前仓库而言，`npm ci` 的稳定性优先于 `setup-node` 缓存
- 若未来要恢复缓存，需要重新验证 workspace 与锁文件路径的兼容性

### 3.2 ESLint 硬错误

`lint-build` 的失败不是单点问题，而是多个前端文件累计触发的规则升级结果，包括：

- `@typescript-eslint/no-require-imports`
- `react/no-unescaped-entities`
- `react-hooks/set-state-in-effect`
- `prefer-const`
- `@typescript-eslint/no-unused-vars`

关键修复点：

- [run-next.cjs](D:/GoogleProject/AetherTarot/apps/web/scripts/run-next.cjs)
  为 CJS 启动脚本添加局部 ESLint 例外，避免错误改写模块系统
- [InterpretationView.tsx](D:/GoogleProject/AetherTarot/apps/web/src/components/reading/InterpretationView.tsx)
  去掉同步 `setState` 的 effect，改为按 `reading_id` 管理 notes draft
- [RitualView.tsx](D:/GoogleProject/AetherTarot/apps/web/src/components/ritual/RitualView.tsx)
  用 `useState(() => shuffleDeck())` 初始化牌堆，避免 mount effect 里直接 `setState`
- [HistoryView.tsx](D:/GoogleProject/AetherTarot/apps/web/src/components/history/HistoryView.tsx)
  与 [JourneyView.tsx](D:/GoogleProject/AetherTarot/apps/web/src/components/home/JourneyView.tsx)
  修复未转义引号
- [HomeView.tsx](D:/GoogleProject/AetherTarot/apps/web/src/components/home/HomeView.tsx)
  删除未使用状态
- [middleware.ts](D:/GoogleProject/AetherTarot/apps/web/src/lib/supabase/middleware.ts)
  把 `let` 改为 `const`

结论：

- 当前 lint error 已清零
- `<img>` 相关仅为 warning，不阻塞 CI

### 3.3 Playwright `e2e` 冒烟失败

`e2e` 最初失败并不是后端协议错误，而是 UI 文本与测试断言出现了偏差。

触发原因：

- 为了满足 `react/no-unescaped-entities`，将界面中的直引号改成了花体引号
- Playwright 用例对问题文案做了带直引号的精确匹配

修复策略：

- 不直接写裸 `"` 字符
- 改为通过表达式渲染直引号文本，如 `{"\"" + question + "\""}` 的等价写法
- 同时满足 lint 与测试断言

结论：

- 以后遇到 `react/no-unescaped-entities` 时，优先考虑“通过表达式输出字符”，不要轻易改变用户可见文案

### 3.4 `lightningcss.linux-x64-gnu.node` 缺失

这是本次最关键、也最容易复发的问题。

现象：

```text
Cannot find module '../lightningcss.linux-x64-gnu.node'
```

排查结果：

- [package-lock.json](D:/GoogleProject/AetherTarot/package-lock.json) 中最初只有 Windows 平台的
  `lightningcss-win32-x64-msvc` 实体条目
- 缺少 Linux 平台的 `node_modules/lightningcss-linux-x64-gnu`
- 这会导致 Ubuntu runner 执行 `npm ci` 后，无法安装 Linux native 包

实际根因：

- 这是 `npm` 在跨平台、带 optional native dependency 的 lockfile 生成上的已知问题
- 当本地带着已有 `node_modules` 重建锁文件时，平台可选依赖可能写不全

参考资料：

- [`npm/cli#4828`](https://github.com/npm/cli/issues/4828)

稳定修复方式：

1. 删除仓库根 `node_modules`
2. 删除 `apps/web/node_modules`
3. 删除旧的根 `package-lock.json`
4. 从仓库根重新执行 `npm install`
5. 确认新的 `package-lock.json` 中存在：
   `node_modules/lightningcss-linux-x64-gnu`

结论：

- 这类问题不要靠手工补 lockfile 片段
- 应从干净环境完整重建锁文件

---

## 4. 本次实际修复顺序

1. 移除 `setup-node` 缓存配置，先恢复 workflow 主路径
2. 修复前端 lint error，确认 `lint` 不再 hard fail
3. 修复引号渲染与 Playwright 断言不一致的问题
4. 本地验证 `e2e` 19/19 通过
5. 处理 `lightningcss` Linux native 包缺失问题
6. 从干净目录重建根锁文件
7. 再次验证 `lint`、`build`、`e2e`
8. 合并 `origin/main` 到 `feature/solve-ux-risks`
9. 推送远端并确认 GitHub CI 通过

---

## 5. 本地验证命令

本次用于确认修复有效的命令：

```powershell
npm run lint -w @aethertarot/web
npm run build -w @aethertarot/web
npm run test:e2e
```

注意：

- 不要并行执行 `lint` 与 `playwright test`
- 本仓库当前会在并行运行时偶发出现 `apps/web/test-results` 目录瞬时不存在的本地竞态
- 顺序执行时该问题不会阻塞 CI

---

## 6. 后续遇到类似问题时的处理清单

### A. 如果看到 `Some specified paths were not resolved`

- 先检查 `.github/workflows/web-ci.yml` 中 `setup-node` 的缓存配置
- 如问题持续，优先移除缓存配置，先恢复 job 可运行性

### B. 如果 `build` 或 `e2e` 报 `lightningcss.linux-x64-gnu.node` 缺失

- 先检查 lockfile 是否包含：
  `node_modules/lightningcss-linux-x64-gnu`
- 若没有，不要手工编辑 lockfile
- 直接从干净目录重建 `package-lock.json`

### C. 如果 `e2e` 突然因文本断言失败

- 先比对最近 UI 文案改动
- 检查是否为了规避 lint 而改变了用户可见字符
- 优先保持用户可见文本稳定，再用表达式或实体规避 lint

### D. 如果 `lint` 与 `playwright` 在本地互相影响

- 顺序执行，不要并行跑
- 优先相信顺序执行结果

---

## 7. 相关提交

本次排障过程中的关键提交包括：

- `f2cf195` Disable setup-node cache in web CI
- `fe11229` Fix web CI lint and e2e regressions
- `22542e8` Regenerate lockfile for cross-platform native deps
- `7106fe7` Merge remote-tracking branch `origin/main` into `feature/solve-ux-risks`

---

## 8. 建议

如果后续继续演进 CI，建议补充以下治理项：

- 在 `docs/70-ops/` 增加更系统的 CI 维护文档
- 为 lockfile / native deps 增加一条专门的排障说明
- 评估是否要在 Linux 容器或 WSL 中生成并校验锁文件
- 评估是否要将 `no-img-element` warning 分阶段收敛
