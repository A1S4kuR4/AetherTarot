# 系统架构（Architecture）

## 1. 文档目的

描述 AetherTarot 的核心系统分层、信息流与边界，让开发者和代码 Agent 能快速理解“哪些规则属于哪里”。

---

## 2. 架构目标

- 支持长上下文、多轮会话和结构化输出
- 将 transport、编排、领域规则、安全检查与前端展示解耦
- 支持后续多 provider 和最小 LangGraph 接入
- 支持 Codex 这类代码 Agent 长期维护

---

## 3. 当前分层

### 产品 / 应用层

负责：

- 用户交互
- 问题输入
- 抽牌展示
- 解读结果渲染
- 本地历史记录与回放

当前落地：`apps/web`

### BFF Route 层

负责：

- `POST /api/reading` 的 request parsing
- 输入 schema 校验
- 错误映射
- HTTP response 返回

边界：只做 transport / validation / response mapping，不直接拼装解读内容。

### Reading Service 层

负责：

- 问题分类
- 权威牌阵 / 牌面上下文还原
- provider 调用
- 生成后安全检查
- 最终 schema 校验

当前落地：`apps/web/src/server/reading/`

固定流水线：

1. 问题分类
2. canonical context 组装
3. provider.generate
4. safety review
5. structured response validate

### Provider 层

负责：

- 根据服务配置选择实际解读生成器
- 将统一的 reading context 转换为结构化 reading draft

当前阶段：默认仅启用 `placeholder` provider；还未接入外部 LLM。

### 领域规则层

负责：

- 牌义规则
- 牌阵规则
- 解释框架
- 问题分类规则
- 风格与边界规则

当前落地：`packages/domain-tarot` + `docs/20-domain/`

### 知识层

负责：

- 原始知识源保存
- wiki 化知识沉淀
- 索引与日志
- 人工 / Agent 共编修订

当前落地：`knowledge/`

### 评测与治理层

负责：

- 结构化输出回归
- 安全检查回归
- 质量评测与失败归类
- 文档与实现同步

---

## 4. 当前 reading 数据流

1. 用户输入问题并完成抽牌
2. 前端仅提交 `question + spreadId + drawnCards[{positionId, cardId, isReversed}]`
3. Route 进行基础 schema 校验
4. Service 从 `domain-tarot` 还原权威 `Spread` / `TarotCard`
5. Provider 生成结构化 reading draft
6. Safety review 根据风险类别补 `safety_note` 或收敛 guidance
7. 结果通过统一 schema 校验后返回前端
8. 前端按结构化字段渲染，并写入 localStorage history

---

## 5. 边界原则

- `apps/web` 仍是唯一活跃应用，当前不拆 `apps/api`
- Route 不能重新承载业务真相
- 安全规则必须在生成后单独检查，不能只靠 prompt 自觉
- 前端不再依赖 markdown 作为主协议
- 历史记录与 API success payload 必须分开建模
- 新增 provider 或 LangGraph 时，应复用现有 service 边界，而不是从 route 重新起一套流程

---

## 6. 待补充

- [ ] 部署拓扑
- [ ] provider 配置说明
- [ ] session capsule 与长期记忆接入方式
- [ ] 观测指标与告警设计
