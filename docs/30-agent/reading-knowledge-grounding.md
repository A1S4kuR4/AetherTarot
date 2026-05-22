# Reading Knowledge Grounding（P3）

## 1. P3 目标

P3 的目标是把 `retrieve_tarot_knowledge` 从 placeholder stub 升级为真实的本地知识检索工具。

当前链路为：

```text
用户问题 / card / orientation / topic
-> 读取 AetherTarot 本地知识源
-> keyword / metadata retrieval
-> 返回 source-attributed chunks
-> graph observations / tool_calls
-> provider draft context
```

这一步只解决 reading 主链的牌义 grounding。它不实现 embedding RAG、长期 Memory Tool、完整 Agent Tracing、复杂 RBAC 或 Multi-Agent。

## 2. 知识源目录

当前知识源目录是：

```text
knowledge/wiki/
  major-arcana/
  minor-arcana/
  concepts/
  spreads/
```

loader 落地在：

```text
apps/web/src/server/reading/knowledge/loader.ts
apps/web/src/server/reading/knowledge/retrieval.ts
```

loader 从 wiki markdown frontmatter 和二级标题切分 chunk，不把牌义内容硬编码在 `retrieve_tarot_knowledge` 工具函数中。

P3.5 对 loader 做了部署可靠性加固：

- `AETHERTAROT_WIKI_ROOT` 存在时优先作为 wiki root；生产部署如果 `process.cwd()` 不稳定，必须显式配置到 `knowledge/wiki` 的绝对路径。
- 未配置环境变量时，仍兼容 monorepo 默认目录：支持从 repo root cwd 或 `apps/web` workspace cwd 推导 `knowledge/wiki`。
- 单个目录读取失败或单个文件读取 / 解析失败时，loader 不抛出中断整体检索，而是 `console.warn` 后继续加载其他目录 / 文件。
- warning 必须包含失败的文件或目录路径，以及错误原因，便于部署日志定位坏路径、坏权限或坏文件。
- `loadTarotKnowledgeChunks()` 使用模块级轻量内存缓存，TTL 为 60 秒；测试可调用 `clearTarotKnowledgeCache()` 清空缓存并强制重新加载。

## 3. Chunk Metadata

运行时 chunk 结构为：

```ts
{
  id: string;
  source_id: string;
  title: string;
  content: string;
  source: string;
  card?: string;
  orientation?: "upright" | "reversed" | "unknown";
  topic?: string[];
  tags?: string[];
}
```

工具返回给 graph 的结果会额外带：

```ts
{
  score: number;
  confidence: "low" | "medium" | "high";
}
```

`source` 指向 `knowledge/wiki/...` 文件路径；`source_id` 来自 wiki frontmatter 的 `sources`。如果页面没有注册来源，loader 使用 `unregistered`，不得伪造外部来源。

## 4. 当前 Retrieval 策略

P3 使用可解释的 keyword / metadata retrieval，不是 embedding RAG。

当前 scoring 规则：

- query 中识别到牌名时，优先使用 query card；否则使用 tool input 的 `card`。
- card metadata 精确匹配加高权重，并兼容运行时 `hanged-man` 与 wiki `the-hanged-man` 这类 ID 差异。
- orientation 匹配加权，`unknown` 只给很小权重。
- topic 匹配加权，当前支持 `relationship / career / self_growth / decision / other` 及中文别名。
- title / tags / content 的 keyword 命中分别加权。
- 默认返回 top 5，低于可靠阈值的结果会被丢弃。

P3.5 已为 retrieval 纯函数补充不依赖真实文件系统的单元测试，覆盖：

- card 精确匹配优先；
- `hanged-man` 与 `the-hanged-man` 的 ID 兼容；
- orientation 匹配权重；
- topic 中文别名映射；
- query 中多张牌的检测；
- 错误 card metadata 的降权 / 惩罚；
- 低于 20 分阈值不返回；
- 中文 query terms 在 title / tags / content 中参与匹配。

这些测试只验证当前 keyword / metadata retrieval 的可解释 scoring，不表示已经实现 embedding RAG。

## 5. Tool 返回语义

`retrieve_tarot_knowledge` 输入保持 P2 兼容：

```ts
{
  query: string;
  card?: string;
  orientation?: "upright" | "reversed" | "unknown";
  topic?: string;
}
```

输出为：

```ts
{
  chunks: Array<{
    id: string;
    title: string;
    content: string;
    source: string;
    source_id: string;
    score: number;
    confidence: "low" | "medium" | "high";
  }>;
  groundingStatus: "retrieved" | "none";
}
```

规则：

- 找到可靠 chunk：`groundingStatus = "retrieved"`。
- 找不到可靠 chunk：`groundingStatus = "none"`。
- P3 起不再返回 `groundingStatus = "stub"`。

## 6. Final Answer Grounding 边界

当 `groundingStatus = "retrieved"` 时，graph 会把 retrieved chunks 作为 `knowledgeGrounding` 注入 provider context。LLM prompt 明确要求：牌义 claim 以 retrieved chunks 为依据，不得编造额外来源。

当 `groundingStatus = "none"` 时，provider context 会标记本地知识库未返回可靠 chunk。最终输出只能基于当前牌面、牌阵位置和一般反思框架降级生成；不得写“根据知识库明确表明”之类伪 grounding 表述。

公开 `StructuredReading` shape 不新增字段。grounding 状态仍留在内部 `agentState.observations[]`、`tool_calls[]`、`grounding_status` 与 provider context 中；用户可见侧主要通过 `confidence_note` 保留不确定性和来源边界。

## 7. 后续升级

后续可以继续升级为：

- embedding retrieval
- hybrid keyword + embedding retrieval
- chunk-level eval replay
- source coverage report
- final reading validator tool

这些升级仍必须保持 reading contract、安全边界和公开输出 schema 稳定。
