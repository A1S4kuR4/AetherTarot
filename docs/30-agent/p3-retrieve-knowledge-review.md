# P3 审校报告：retrieve_tarot_knowledge 真实知识检索升级

**审校日期**：2026-05-21  
**审校范围**：`retrieve_tarot_knowledge` 从 placeholder stub 升级为真实 knowledge/wiki 检索的完整链路  
**审校依据**：`docs/30-agent/reading-knowledge-grounding.md`（P3 规格）、`docs/30-agent/reading-tools.md`（P2 工具系统）

---

## 一、规格合规性

### 1.1 groundingStatus 语义

规格要求 P3 起不再返回 `groundingStatus = "stub"`，仅返回 `"retrieved"` 或 `"none"`。

`retrieve-tarot-knowledge.ts:69-70`：

```ts
groundingStatus: retrievedChunks.length > 0 ? "retrieved" : "none",
```

判定逻辑：当检索返回至少一个通过最低阈值（score >= 20）的 chunk 时返回 `"retrieved"`，否则返回 `"none"`。无 `"stub"` 残留。**合规。**

### 1.2 Chunk Metadata

规格要求 chunk 包含 `source_id`、`source`、`score`、`confidence`。

`retrieve-tarot-knowledge.ts:58-66` 在 tool run 时将 `ScoredTarotKnowledgeChunk` 映射为 output chunk，保留全部必需字段。`source` 指向 `knowledge/wiki/...`，`source_id` 来自 wiki frontmatter 的 `sources`。**合规。**

### 1.3 无伪造来源

规格要求未注册来源的页面使用 `"unregistered"`，不伪造外部来源。

`loader.ts:160-162`：

```ts
function buildSourceId(sourceIds: string[]) {
  return sourceIds.length > 0 ? sourceIds.join(",") : "unregistered";
}
```

`tool-system.spec.ts:159-163` 验证了 frontmatter 不包含 `sources` 时 chunk 的 `source_id === "unregistered"`。**合规。**

### 1.4 检索策略

规格要求使用 keyword/metadata retrieval（非 embedding RAG），包含 card 匹配（带 ID 规范化）、orientation 匹配、topic 匹配（含中文别名）、title/tags/content 关键词加权、top 5 截断。

`retrieval.ts` 完整实现了以上所有策略。`normalizeCardId`（line 41-45）处理了 `"the-"` 前缀差异，`TOPIC_ALIASES`（line 29-35）映射了英文 topic 到中文别名，`scoreChunk`（line 165-201）实现了分级加权。**合规。**

### 1.5 Tool 输入输出 Schema

规格要求输入保持 P2 兼容（`query, card?, orientation?, topic?`），输出包含 `chunks[]` 和 `groundingStatus`。

`retrieve-tarot-knowledge.ts:6-26` 定义的 input/output Zod schema 与规格完全一致。**合规。**

---

## 二、架构正确性

### 2.1 知识加载链路

`loader.ts` → `retrieval.ts` → `retrieve-tarot-knowledge.ts` → `executor.ts` → `graph.ts`

链路完整，每层职责清晰：

- Loader 负责文件 I/O、frontmatter 解析、section 切分
- Retrieval 负责纯函数式评分和排序（无副作用，可测试）
- Tool 负责编排 loader + retrieval，组装最终输出
- Executor 负责权限校验、schema 校验、超时控制、审计记录
- Graph 负责将 tool 结果写入 observations / tool_calls / groundingStatus

**架构设计正确，符合 P2 工具系统的分层约定。**

### 2.2 Card ID 规范化

`retrieval.ts:110-116` 的 `sameCard` 函数通过 `normalizeCardId` 同时处理 wiki 端（`"the-hanged-man"`）和 domain-tarot 端（`"hanged-man"`）的 ID 差异。`normalizeCardId` 去除 `"the"` 前缀、去空格、去特殊字符、去大小写——覆盖了两种 ID 体系的所有已知差异。

`tool-system.spec.ts:127-128` 验证了 `card: "hanged-man"` 输入能匹配 `chunk.card === "the-hanged-man"`。**正确。**

---

## 三、发现的问题

### 中等问题

#### 3.1 `resolveKnowledgeWikiRoot` 使用脆弱的相对路径（Medium）

`loader.ts:33-40`：

```ts
function resolveKnowledgeWikiRoot() {
  return path.join(
    /* turbopackIgnore: true */ process.cwd(),
    "..", "..", "knowledge", "wiki",
  );
}
```

`process.cwd()` 在 Next.js 生产环境中可能指向 `.next/` 目录或其他运行时路径，而非项目根目录。当前代码从 cwd 向上走两级到达 monorepo 根，再进入 `knowledge/wiki`。这在开发环境（cwd = `apps/web`）下成立，但在 Vercel / Docker / 独立构建等部署环境中可能失效。

同一模式也出现在 `encyclopedia/wiki.ts:33-34` 和 `encyclopedia/coverage.ts:29-30`，说明这是项目级约定，降低了单点风险，但仍非健壮方案。

**建议**：使用 `path.resolve(process.cwd(), "../../knowledge/wiki")` 并通过环境变量 `AETHERTAROT_WIKI_ROOT` 提供覆盖路径，在 CI/生产环境中显式注入。

#### 3.2 Loader 静默吞掉所有错误（Medium）

`loader.ts:229-233` 和 `loader.ts:240-249`：

```ts
try {
  entries = await fs.readdir(absoluteDirectory, { withFileTypes: true });
} catch {
  continue;  // 整个目录静默跳过
}

try {
  chunks.push(...(await loadWikiFile({ ... })));
} catch {
  continue;  // 单个文件静默跳过
}
```

如果某个 wiki 目录被误删、权限变更、或文件编码损坏，loader 会静默跳过，工具的检索结果会悄悄降级，运维端无任何信号。当前没有任何 metrics、日志或告警机制。

**建议**：至少增加 `console.warn` 级别的错误日志，记录跳过的目录/文件名和错误原因。中长期考虑接入应用级 telemetry。

#### 3.3 检索核心算法缺少单元测试（Medium）

`retrieval.ts` 中的 `retrieveTarotKnowledgeChunks`、`scoreChunk`、`detectCardsFromQuery`、`extractQueryTerms`、`normalizeTopic` 等函数均为纯函数，非常适合单元测试，但当前没有任何针对它们的独立测试。

现有 `tool-system.spec.ts` 仅覆盖端到端集成测试（通过 executor 调用真实 wiki），无法独立验证以下场景：

- 多张牌在同一 query 中的 card 检测行为
- 带 `-20` 惩罚的错误 card 匹配
- 中文 stop word 过滤效果
- topic 中文别名归一化
- score 阈值 20 的边界行为
- 不同权重（80/24/18/6/5/2）的独立效果

**建议**：为 `retrieval.ts` 编写单元测试，使用手动构造的 `TarotKnowledgeChunk[]` 作为输入，覆盖上述场景。这些测试应独立于文件系统和 wiki 数据。

#### 3.4 每次 tool 调用都全量重载 wiki（Medium）

`retrieve-tarot-knowledge.ts:50`：

```ts
const chunks = await loadTarotKnowledgeChunks();
```

每次 tool 调用都从磁盘读取全部 ~78 个 markdown 文件并解析。当前 `max_agent_steps = 3`，单次 reading 最多调用 3 次。在低流量下可接受，但随 wiki 规模增长或并发增加会成为性能瓶颈。

**建议**：引入内存缓存（如模块级变量 + TTL），或在服务启动时预加载。注意需处理热更新场景（wiki 文件变更后缓存失效）。

---

### 低等问题

#### 3.5 `parseFrontmatter` 对包含冒号的值处理脆弱（Low）

`loader.ts:52-63`：

```ts
const separatorIndex = line.indexOf(":");
frontmatter.set(
  line.slice(0, separatorIndex).trim(),
  line.slice(separatorIndex + 1).trim(),
);
```

按第一个冒号分割。如果未来 wiki 文件的 title 包含冒号（如 `title: "倒吊人: 暂停与反转"`），会被错误切割。当前所有 wiki 文件的 frontmatter value 均不含冒号，因此暂无实际影响。

**建议**：改用 YAML 解析库（如 `js-yaml`）或至少使用更健壮的正则（匹配 key: value 模式而非简单 split）。

#### 3.6 一级标题 `#` 出现在 chunk 内容中（Low）

`parseSections`（`loader.ts:96-131`）不处理 `#` 一级标题。以 `the-hanged-man.md` 为例，`# 倒吊人 (The Hanged Man)` 行会出现在第一个 section（"概述"）的 content 中。这不影响检索效果（检索基于关键词匹配而非结构解析），但略微降低了 chunk 内容质量。

**建议**：在 `parseSections` 中过滤以 `# ` 开头的行，或将其作为单独的 chunk metadata 字段而非内容的一部分。

#### 3.7 Tool 失败时 groundingStatus 回退到旧状态值（Low）

`graph.ts:696`：

```ts
groundingStatus: output?.groundingStatus ?? state.groundingStatus ?? "none",
```

当 tool 执行失败（超时、异常等）导致 `output` 为 undefined 时，`groundingStatus` 会回退到 `state.groundingStatus`。如果前一次成功的 tool 调用设置了 `"retrieved"`，失败后的 groundingStatus 仍为 `"retrieved"`——这与实际情况不符。

当前 `agent_decider` 在每个 reading 中通常只调用一次 `retrieve_knowledge`，所以重复调用的概率低。但若未来支持多次检索（如牌阵中不同位置的牌分别检索），此问题会暴露。

**建议**：Tool 失败时显式设置 `groundingStatus: "none"`，或将失败场景的 observation 中的 confidence 改为 `"error"`、并让 provider 据此降级。

#### 3.8 `scoreText` 使用 `includes` 做子串匹配（Low）

`retrieval.ts:118-125` 使用 `normalizedText.includes(normalize(term))` 进行关键词匹配。对中文文本这是可接受的（中文无天然词边界），但对英文文本，`"career"` 会匹配 `"careering"`。鉴于 wiki 内容以中文为主，英文术语出现频率低，实际影响极小。

**建议**：英文术语可增加词边界检查（`new RegExp('\\b' + term + '\\b', 'i')`），或保持现状并在未来升级 embedding retrieval 时自然解决。

---

## 四、测试覆盖评估

### 已有测试

`tool-system.spec.ts` 覆盖了：

- 默认工具注册列表（line 17-22）✅
- 重复注册拦截（line 24-31）✅
- 未知工具返回 `TOOL_NOT_FOUND`（line 33-44）✅
- 权限拒绝返回 `TOOL_PERMISSION_DENIED`（line 46-73）✅
- `retrieve_tarot_knowledge` 端到端成功路径（line 75-101）✅
- `retrieve_tarot_knowledge` 无匹配时返回 `"none"`（line 103-121）✅
- 从真实 wiki 加载 chunk 并验证 metadata（line 123-137）✅
- 空目录和畸形 markdown 的优雅处理（line 139-165）✅
- 工具异常捕获 `TOOL_EXECUTION_FAILED`（line 188-217）✅
- 无效输出捕获 `TOOL_INVALID_OUTPUT`（line 219-248）✅
- 超时捕获 `TOOL_TIMEOUT`（line 250-278）✅

### 缺失测试

| 缺失测试项 | 严重度 | 说明 |
|---|---|---|
| `retrieveTarotKnowledgeChunks` 单元测试 | Medium | 核心检索算法无独立测试 |
| `scoreChunk` 各权重分支 | Medium | 80/24/18/6/5/2 权重无独立验证 |
| `detectCardsFromQuery` 多牌场景 | Low | 未测试 query 含多张牌时的行为 |
| `extractQueryTerms` 中文分词 | Low | 未测试各种中文 query 模式 |
| `normalizeTopic` 中文别名 | Low | 未测试 topic 别名映射 |
| `parseSections` 边界 | Low | 无 frontmatter 文件、无二级标题文件 |
| `sameCard` 边界 | Low | 未测试 null/undefined/空字符串输入 |
| Loader 磁盘 I/O 失败场景 | Low | 未测试权限拒绝、编码错误等真实 I/O 错误 |

---

## 五、总体评价

### 优点

1. **规格合规度 100%**：P3 规格中所有显式要求均已实现，无遗漏。`groundingStatus`、chunk metadata、检索策略、输入输出 schema 全部对齐。
2. **分层清晰**：loader（I/O）→ retrieval（评分）→ tool（编排）→ executor（管控）→ graph（集成），各层职责单一，retrieval 层为纯函数，具备良好的可测试性。
3. **防御性设计**：loader 不因单个文件损坏而整体崩溃，retrieval 有最低阈值过滤，executor 有完整的超时/异常/schema 校验保护。
4. **Card ID 规范化处理到位**：通过 `normalizeCardId` 解决了 wiki 端 `"the-"` 前缀与 domain-tarot 端无前缀的 ID 差异。
5. **中文检索适配好**：中文 stop word 列表、bigram 切分、topic 中文别名映射——均为面向实际 query 场景的设计。
6. **测试骨架扎实**：Tool system 的集成测试覆盖了 executor 全链路（成功/失败/超时/权限/schema），loader 也测试了空目录和畸形文件。

### 需改进

1. **路径解析需加固**（Medium）：`resolveKnowledgeWikiRoot` 依赖 `process.cwd()` 的相对路径在生产环境可能失效。
2. **需增加可观测性**（Medium）：loader 静默吞错，知识库降级无感知。
3. **检索算法需单元测试**（Medium）：核心评分逻辑缺乏独立验证。
4. **需引入缓存**（Medium）：每次 tool 调用都全量重载 wiki。

### 结论

**P3 任务已完成，实现质量良好。** `retrieve_tarot_knowledge` 已从 placeholder stub 成功升级为真实的知识检索工具，连接了 `knowledge/wiki` 全部知识源（22 张大阿卡纳 + 56 张小阿卡纳 + 10 个概念页 + 9 个牌阵页），具备 card/orientation/topic/keyword 多维检索能力。所有 P3 规格要求均已满足，无阻塞性缺陷。

上述 4 个中等问题建议在 P4 或后续迭代中修复。其中路径加固和缓存引入可在不改变公开 API 的前提下完成，不影响 reading contract。
