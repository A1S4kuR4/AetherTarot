# P3 二次审校报告：修复项验证

**审校日期**：2026-05-21  
**审校范围**：对初轮审校中发现的 4 个中等问题及其修复实现的验证，以及对新增代码的审查  
**对照基准**：`docs/30-agent/p3-retrieve-knowledge-review.md`（初轮审校报告）

---

## 一、修复项逐一验证

### 1.1 路径解析加固 ✅ 已修复，无新问题

**初轮问题**：`resolveKnowledgeWikiRoot` 仅使用 `process.cwd()` 向上走两级，生产环境可能失效。

**修复实现**（`loader.ts:42-61`）：

```ts
export function resolveKnowledgeWikiRoot() {
  const envWikiRoot = process.env.AETHERTAROT_WIKI_ROOT?.trim();
  if (envWikiRoot) {
    return path.resolve(envWikiRoot);
  }
  const candidates = [
    path.join(process.cwd(), "knowledge", "wiki"),
    path.join(process.cwd(), "..", "..", "knowledge", "wiki"),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[1];
}
```

**验证结果**：

- `AETHERTAROT_WIKI_ROOT` 环境变量优先，使用 `path.resolve` 解析，支持绝对和相对路径 ✅
- 未配置时提供两个候选路径：`cwd/knowledge/wiki`（适配 cwd 为 monorepo 根的部署）和 `cwd/../../knowledge/wiki`（适配 cwd 为 `apps/web` 的开发环境）✅
- `existsSync` 检查候选路径是否存在，不存在时 fallback 到第二个候选 ✅
- 导出为命名导出（非私有函数），便于测试直接调用验证 ✅
- `loader.spec.ts:86` 验证了 `resolveKnowledgeWikiRoot()` 返回 `path.resolve(wikiRoot)` ✅
- `loader.spec.ts:105` 验证了默认路径以 `knowledge/wiki` 结尾、chunks 非空 ✅

**无新增问题**。

---

### 1.2 Loader 错误日志 ✅ 已修复，无新问题

**初轮问题**：loader 的 try-catch 静默吞掉所有 I/O 错误，知识库降级时运维端无感知。

**修复实现**（`loader.ts:184-199`）：

```ts
function formatErrorReason(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function warnKnowledgeLoadFailure({
  kind,       // "directory" | "file"
  targetPath,
  error,
}: { kind: "directory" | "file"; targetPath: string; error: unknown }) {
  console.warn(
    `[AetherTarot knowledge loader] Failed to load wiki ${kind}: ${targetPath}. Reason: ${formatErrorReason(error)}`,
  );
}
```

调用点：
- `loader.ts:267-272`：目录读取失败时（`kind: "directory"`）
- `loader.ts:288-293`：单文件读取/解析失败时（`kind: "file"`）

**验证结果**：

- 结构化日志函数区分 `"directory"` 和 `"file"` 两种失败类型 ✅
- 日志包含 `[AetherTarot knowledge loader]` 前缀，便于日志过滤 ✅
- 日志包含失败路径和错误原因 ✅
- `formatErrorReason` 安全处理了非 Error 类型的 throw 值 ✅
- 单个坏目录/坏文件不中断整体加载（`continue` 语义保留）✅
- `loader.spec.ts:109-119` 验证了空 wiki 根目录时 `console.warn` 被调用、警告包含路径和 `Reason:` ✅
- `loader.spec.ts:122-156` 验证了单文件损坏时 `console.warn` 被调用、好文件正常加载、警告包含文件路径和错误信息 ✅

**无新增问题**。

---

### 1.3 检索核心算法单元测试 ✅ 已修复，覆盖充分

**初轮问题**：`retrieval.ts` 中所有纯函数均无独立单元测试。

**修复实现**：新增 `retrieval.spec.ts`（159 行，8 个测试用例）。

| 测试用例 | 行号 | 覆盖内容 | 验证 |
|---|---|---|---|
| "prioritizes exact card metadata matches" | 20-32 | card 参数精确匹配：匹配的 chunk 排在最前，不匹配的被排除 | ✅ |
| "matches hanged-man input to the-hanged-man wiki metadata" | 34-45 | `hanged-man` → `the-hanged-man` ID 规范化匹配 | ✅ |
| "weights orientation matches above unknown and mismatched chunks" | 47-63 | orientation 权重顺序：reversed > unknown > upright | ✅ |
| "maps Chinese topic aliases during scoring" | 66-87 | 传入中文 topic `"情感"` 匹配 `relationship`，分数高于非匹配 | ✅ |
| "detects multiple cards mentioned in the query" | 89-100 | 从 query 文本检测多张牌（愚者+魔术师），只返回匹配的 chunk | ✅ |
| "penalizes chunks for the wrong detected card" | 102-125 | 错误 card 被 -20 惩罚后分数低于正确 card | ✅ |
| "drops chunks below the score threshold" | 127-139 | score < 20 时返回空数组 | ✅ |
| "uses Chinese query terms in title, tags, and content matching" | 141-158 | 中文 query terms 在 title/tags/content 三个字段的匹配 | ✅ |

**测试设计评价**：

- 使用 `chunk()` factory 函数构造最小化的测试 chunks，测试不依赖真实 wiki 数据，执行速度快且确定性高 ✅
- 覆盖了 card 匹配的正向（+80）和负向（-20 惩罚）两条路径 ✅
- 覆盖了 orientation 的三级权重（精确匹配 +24，unknown +4，不匹配 0）✅
- 覆盖了 topic 匹配（ID 映射 + 中文别名）✅
- 覆盖了 query 中牌名检测的复数场景 ✅
- 覆盖了 20 分阈值边界 ✅
- 覆盖了中文分词后的 title/tags/content 多字段匹配 ✅

**覆盖缺口**（可后续补充，非阻塞）：

- `extractQueryTerms` 的独立测试（当前通过端到端测试间接覆盖）
- `normalizeTopic` 直接从 query 文本推断 topic 的场景（当前仅测试了传入 `topic` 参数）
- score 的精确数值断言（当前主要验证排序顺序，未验证具体分数值）

**无新增问题**。

---

### 1.4 内存缓存 ✅ 已修复，实现合理

**初轮问题**：每次 tool 调用都全量重载 ~78 个 wiki 文件。

**修复实现**（`loader.ts:21-28, 301-324`）：

```ts
export const TAROT_KNOWLEDGE_CACHE_TTL_MS = 60_000;

interface TarotKnowledgeCacheEntry {
  expiresAt: number;
  chunks: TarotKnowledgeChunk[];
}

const tarotKnowledgeCache = new Map<string, TarotKnowledgeCacheEntry>();

export async function loadTarotKnowledgeChunks(options?: { wikiRoot?: string }) {
  const wikiRoot = path.resolve(options?.wikiRoot ?? resolveKnowledgeWikiRoot());
  const now = Date.now();
  const cached = tarotKnowledgeCache.get(wikiRoot);

  if (cached && cached.expiresAt > now) {
    return cached.chunks;
  }

  const chunks = await loadTarotKnowledgeChunksFromDisk(wikiRoot);
  tarotKnowledgeCache.set(wikiRoot, { chunks, expiresAt: now + TAROT_KNOWLEDGE_CACHE_TTL_MS });
  return chunks;
}

export function clearTarotKnowledgeCache() {
  tarotKnowledgeCache.clear();
}
```

**验证结果**：

- 按 `wikiRoot` 绝对路径作为缓存键，不同 wiki root 的缓存互不干扰 ✅
- TTL 为 60 秒（`TAROT_KNOWLEDGE_CACHE_TTL_MS`），常量导出，便于测试引用 ✅
- 过期检查使用 `expiresAt > now`，即 TTL 内命中缓存、TTL 过后重新加载 ✅
- 过期条目在下次 `loadTarotKnowledgeChunks` 时被覆盖写入（无内存泄漏）✅
- `clearTarotKnowledgeCache()` 清空全部缓存，导出供测试使用 ✅
- `loader.spec.ts:158-179` 验证了缓存行为：首次加载 1 chunk，缓存命中后新增的 wiki 文件不出现，清空后重新加载 2 chunks ✅
- 原 `loadTarotKnowledgeChunksFromDisk`（内部使用）与 `loadTarotKnowledgeChunks`（带缓存的公开 API）职责分离清晰 ✅

**设计说明**：

缓存是 lazy-TTL（访问时检查过期），而非主动过期（`setTimeout` 清除）。在低流量场景下这是合理的——没有定时器开销，也没有缓存条目在 TTL 后被访问前占用内存的风险（因为 `Map` 中只会有被实际使用过的 wikiRoot，通常只有 1 个）。如果未来需要严格的内存控制，可改用 LRU cache 或 `setTimeout` 主动清理。

**无新增问题**。

---

## 二、横向验证：Graph 层 grounding 失败路径

初轮审校指出 `graph.ts:696` 的 `groundingStatus` 回退逻辑在 tool 失败时可能保留旧状态值。虽未针对修改 graph.ts，但 `graph.contract.spec.ts` 已有两个相关测试：

**"records failed retrieve tool calls and still degrades to final_answer"**（line 128-175）：

- 使用抛出异常的 mock tool 模拟 tool 失败
- 验证 `agentState.grounding_status` 为 `"none"`，`confidence` 为 `"error"`
- 验证 reading 仍能降级生成 `final_answer`（不崩溃）

**"does not fake knowledge grounding when retrieval returns none"**（line 177-225）：

- 使用返回 `groundingStatus: "none"` 的 mock tool
- 验证 `agentState.grounding_status` 为 `"none"`
- 验证 observation 中 `confidence: "none"`
- 验证可见文本不含伪造的 grounding 表述（`"根据知识库明确表明"`）
- 验证 `confidence_note` 包含降级说明（`"本地知识库没有返回足够可靠的牌义片段"`）

这两个测试从 contract 层面验证了：无论 tool 返回 `"none"` 还是 tool 执行失败，最终输出都不会虚假声称有知识库支撑。**初轮审校指出的回退逻辑问题在 contract 层面已被充分覆盖**，无需修改 graph.ts。

---

## 三、新增 Loader 测试的质量评估

`loader.spec.ts`（180 行，5 个测试用例）质量良好：

| 测试用例 | 覆盖内容 | 质量 |
|---|---|---|
| "prioritizes AETHERTAROT_WIKI_ROOT" | 环境变量优先路径解析，chunks 使用正确 source 路径 | ✅ |
| "keeps the default monorepo wiki path compatible" | 默认路径解析兼容，chunks 非空 | ✅ |
| "warns when a wiki directory cannot be read" | 空 wiki 根目录时 `console.warn` 被调用 | ✅ |
| "warns when a wiki file cannot be read without dropping good files" | `fs.readFile` mock 模拟单文件失败，好文件仍被加载，警告正确 | ✅ |
| "serves chunks from cache until the cache is cleared" | 缓存命中/失效/清空全流程 | ✅ |

**测试基础设施**：

- `afterEach` 中恢复了 `AETHERTAROT_WIKI_ROOT` 环境变量、清空了缓存、恢复了所有 mock ✅
- `createWikiRoot()` 和 `writeWikiPage()` helper 函数通过临时目录构建可控的 wiki 环境，与真实 wiki 数据隔离 ✅
- `writeWikiPage` 接受 `card` 和 `content` 参数，提供了良好的测试灵活性 ✅
- 文件失败测试使用了 `vi.spyOn(fs, "readFile")` 精确 mock，不污染全局 `fs` ✅

---

## 四、遗留低等问题（未修复，可接受）

以下初轮审校中标记为 Low 的问题未在此轮修复，属于合理取舍，不影响 P3 的"已完成"判定：

| 问题 | 严重度 | 说明 |
|---|---|---|
| `parseFrontmatter` 对含冒号的值处理脆弱 | Low | 当前 wiki 不涉及，可在未来 wiki 内容变更时修复 |
| `#` 一级标题出现在 chunk 内容中 | Low | 不影响检索效果，仅略微降低内容整洁度 |
| `scoreText` 使用 `includes` 无词边界 | Low | 英文术语在中文 wiki 中占比极低，实际影响可忽略 |
| `groundingStatus` 回退逻辑 | Low | graph contract 测试已覆盖两种失败路径，contract 层面保证不伪造 grounding |

---

## 五、总体评价

**初轮审校中发现的 4 个中等问题均已得到有效修复**：

1. 路径解析从单一路径升级为环境变量优先 + 双候选 fallback + `existsSync` 验证的三层防御
2. Loader 错误处理从静默吞错升级为结构化的 `console.warn` 日志，区分目录/文件两种失败类型，日志包含路径和错误原因
3. 检索核心算法新增 8 个单元测试，覆盖 card 匹配、ID 规范化、orientation 加权、中文 topic 别名、多牌检测、惩罚、阈值、中文分词——测试使用纯内存 chunk 构造，快速且确定性高
4. 新增模块级内存缓存，按 wikiRoot 键隔离，60 秒 TTL，提供 `clearTarotKnowledgeCache()` 供测试使用

**无新增中等问题或高优先级问题。**

**结论：P3 实现质量在修复后进一步提升，所有已知中等问题均已解决，可以确认 P3 已稳定完成。**
