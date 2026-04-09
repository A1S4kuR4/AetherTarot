# 知识层变更日志 (Knowledge Compilation Log)

本文件用于记录 Agent 对 `knowledge/wiki/` 目录进行的结构性变更操作。

## 格式规范

每次变更请往文档顶部添加如下格式的新条目：

```md
### [YYYY-MM-DD] [操作类型]
- **操作者**: [Agent 标识 / 开发者]
- **影响范围**: [涉及的文件路径或系统模块]
- **详细信息**:
  - [具体的动作描述 1]
  - [具体的动作描述 2]
```

**操作类型约定**：
- `INGEST`: 从 raw 素材提取内容创建/更新 wiki
- `LINT`: 执行规则检测及自动修复
- `UPDATE`: 独立的内容修订（非批量摄入）
- `SCHEMA`: AGENTS.md 规范修订

---

<!-- 请在此线以上插入最新的日志条目 -->

### 2026-04-08 INGEST
- **操作者**: Codex
- **影响范围**: `knowledge/wiki/concepts/symbol-dictionary.md`, `knowledge/wiki/spreads/seven-card.md`, `knowledge/wiki/spreads/spiritual-direction.md`, `knowledge/wiki/spreads/five-card-lesson.md`, `knowledge/wiki/spreads/four-aspects.md`, `knowledge/wiki/spreads/four-elements.md`, `knowledge/wiki/spreads/causal-cycle.md`, `knowledge/index.md`, `knowledge/log.md`, `memory/knowledge-ingest-backlog.md`
- **详细信息**:
  - 基于 `CTB` 的象征章节，新增编译了“塔罗象征词典”概念页，汇总植物、动物、建筑、景观与神话人物等高频视觉意象的横向知识。
  - 基于 `YAT` 的牌形章节，新增编译了七张牌、精神方向、五张牌课题、四个面向、四元素牌阵与因果循环六张高价值牌阵页，并同步更新目录与 backlog 状态。

### 2026-04-08 INGEST
- **操作者**: Codex
- **影响范围**: `knowledge/wiki/concepts/question-type-reading-lenses.md`, `knowledge/wiki/concepts/astrology-correspondences.md`, `knowledge/index.md`, `knowledge/log.md`, `memory/knowledge-ingest-backlog.md`
- **详细信息**:
  - 基于 `YAT` 与 `CTB` 的方法章节、关系 / 灵魂问题示例和问题重构段落，新增编译了“问题类型导向”概念页，补齐关系、工作、决策与成长等提问类型的横向知识。
  - 基于 `CTB` 的“塔罗与占星”“占星术与小阿卡纳”章节及 `YAT` 的元素 / 星座补充，新增编译了“占星对应”概念页，并同步更新概念目录与 backlog 状态。

### 2026-04-08 INGEST
- **操作者**: Codex
- **影响范围**: `knowledge/wiki/concepts/major-arcana-journey.md`, `knowledge/wiki/concepts/reversal-reading-principles.md`, `knowledge/wiki/concepts/spread-position-semantics.md`, `knowledge/index.md`, `knowledge/log.md`
- **详细信息**:
  - 基于 `78W`、`YAT`、`CTB` 的已注册来源，新增编译了“大阿卡纳旅程”概念页，补齐大牌整体序列、三层结构与纵向呼应的横向知识。
  - 基于 `YAT` 与 `CTB` 的方法章节和实例，新增编译了“逆位解读原则”“牌阵位置语义与张力模型”两张系统概念页，并同步更新概念目录覆盖状态。

### 2026-04-08 INGEST
- **操作者**: Codex
- **影响范围**: `knowledge/wiki/concepts/four-elements.md`, `knowledge/wiki/concepts/minor-arcana-numerology.md`, `knowledge/wiki/concepts/court-card-personality-system.md`, `knowledge/wiki/concepts/tree-of-life-correspondences.md`, `knowledge/wiki/spreads/single.md`, `knowledge/wiki/spreads/holy-triangle.md`, `knowledge/wiki/spreads/celtic-cross.md`, `knowledge/index.md`, `knowledge/log.md`
- **详细信息**:
  - 基于 `78W`、`YAT`、`CTB` 的已注册来源，补齐了 backlog 第一阶段的 4 张核心概念页，覆盖四元素、数字学、宫廷牌人格体系与生命之树对应四个主题。
  - 结合运行时 `spread_id` 与 `CTB / YAT` 原始材料，新增编译了 `single`、`holy-triangle`、`celtic-cross` 三张牌阵页，使知识层与当前运行时牌阵配置形成闭环。

### 2026-04-08 INGEST
- **操作者**: Codex
- **影响范围**: `knowledge/wiki/minor-arcana/pentacles/ace-of-pentacles.md`, `knowledge/wiki/minor-arcana/pentacles/two-of-pentacles.md`, `knowledge/wiki/minor-arcana/pentacles/three-of-pentacles.md`, `knowledge/wiki/minor-arcana/pentacles/four-of-pentacles.md`, `knowledge/wiki/minor-arcana/pentacles/five-of-pentacles.md`, `knowledge/wiki/minor-arcana/pentacles/six-of-pentacles.md`, `knowledge/wiki/minor-arcana/pentacles/seven-of-pentacles.md`, `knowledge/wiki/minor-arcana/pentacles/eight-of-pentacles.md`, `knowledge/wiki/minor-arcana/pentacles/nine-of-pentacles.md`, `knowledge/wiki/minor-arcana/pentacles/ten-of-pentacles.md`, `knowledge/wiki/minor-arcana/pentacles/page-of-pentacles.md`, `knowledge/wiki/minor-arcana/pentacles/knight-of-pentacles.md`, `knowledge/wiki/minor-arcana/pentacles/queen-of-pentacles.md`, `knowledge/wiki/minor-arcana/pentacles/king-of-pentacles.md`, `knowledge/index.md`, `knowledge/log.md`
- **详细信息**:
  - 基于 `YAT` 与 `CTB` 两个已注册来源，整批编译了星币组 `Ace` 至 `Ten` 与四张宫廷牌，统一采用小阿卡纳标准 frontmatter、六段页面结构与真实相对链接。
  - 同步更新覆盖矩阵，使 `wiki/minor-arcana/pentacles/` 形成完整的 14 张星币牌知识层落地，知识层牌义页总覆盖达到 `78/78`。

### 2026-04-07 INGEST
- **操作者**: Codex
- **影响范围**: `knowledge/wiki/minor-arcana/swords/ace-of-swords.md`, `knowledge/wiki/minor-arcana/swords/two-of-swords.md`, `knowledge/wiki/minor-arcana/swords/three-of-swords.md`, `knowledge/wiki/minor-arcana/swords/four-of-swords.md`, `knowledge/wiki/minor-arcana/swords/five-of-swords.md`, `knowledge/wiki/minor-arcana/swords/six-of-swords.md`, `knowledge/wiki/minor-arcana/swords/seven-of-swords.md`, `knowledge/wiki/minor-arcana/swords/eight-of-swords.md`, `knowledge/wiki/minor-arcana/swords/nine-of-swords.md`, `knowledge/wiki/minor-arcana/swords/ten-of-swords.md`, `knowledge/wiki/minor-arcana/swords/page-of-swords.md`, `knowledge/wiki/minor-arcana/swords/knight-of-swords.md`, `knowledge/wiki/minor-arcana/swords/queen-of-swords.md`, `knowledge/wiki/minor-arcana/swords/king-of-swords.md`, `knowledge/index.md`, `knowledge/log.md`
- **详细信息**:
  - 基于 `YAT` 与 `CTB` 两个已注册来源，整批编译了宝剑组 `Ace` 至 `Ten` 与四张宫廷牌，统一采用小阿卡纳标准 frontmatter、六段页面结构与相对链接规则。
  - 同步更新覆盖矩阵，使 `wiki/minor-arcana/swords/` 形成完整的 14 张宝剑牌知识层落地，并与已完成的大阿卡纳、权杖组、圣杯组建立交叉引用。

### 2026-04-07 INGEST
- **操作者**: Codex
- **影响范围**: `knowledge/wiki/minor-arcana/cups/ace-of-cups.md`, `knowledge/wiki/minor-arcana/cups/two-of-cups.md`, `knowledge/wiki/minor-arcana/cups/three-of-cups.md`, `knowledge/wiki/minor-arcana/cups/four-of-cups.md`, `knowledge/wiki/minor-arcana/cups/five-of-cups.md`, `knowledge/wiki/minor-arcana/cups/six-of-cups.md`, `knowledge/wiki/minor-arcana/cups/seven-of-cups.md`, `knowledge/wiki/minor-arcana/cups/eight-of-cups.md`, `knowledge/wiki/minor-arcana/cups/nine-of-cups.md`, `knowledge/wiki/minor-arcana/cups/ten-of-cups.md`, `knowledge/wiki/minor-arcana/cups/page-of-cups.md`, `knowledge/wiki/minor-arcana/cups/knight-of-cups.md`, `knowledge/wiki/minor-arcana/cups/queen-of-cups.md`, `knowledge/wiki/minor-arcana/cups/king-of-cups.md`, `knowledge/index.md`, `knowledge/log.md`
- **详细信息**:
  - 基于 `YAT` 与 `CTB` 两个已注册来源，整批编译了圣杯组 `Ace` 至 `Ten` 与四张宫廷牌，统一采用小阿卡纳标准 frontmatter 与六段页面结构。
  - 同步更新覆盖矩阵，使 `wiki/minor-arcana/cups/` 形成完整的 14 张圣杯牌知识层落地，并与已完成的大阿卡纳和权杖组建立交叉引用网络。

### 2026-04-07 INGEST
- **操作者**: Codex
- **影响范围**: `knowledge/wiki/minor-arcana/wands/page-of-wands.md`, `knowledge/wiki/minor-arcana/wands/knight-of-wands.md`, `knowledge/wiki/minor-arcana/wands/queen-of-wands.md`, `knowledge/wiki/minor-arcana/wands/king-of-wands.md`, `knowledge/index.md`, `knowledge/log.md`
- **详细信息**:
  - 基于 `YAT` 与 `CTB` 两个已注册来源，补齐了权杖宫廷牌四张页面，统一采用 `Page / Knight / Queen / King` 的 `card_id` 命名，并与权杖数字牌和已完成的大阿卡纳建立交叉引用。
  - 同步更新覆盖矩阵，使 `wiki/minor-arcana/wands/` 形成权杖全组 14 张牌的完整落地，为继续编译其他三组小阿卡纳提供了稳定模板。

### 2026-04-07 INGEST
- **操作者**: Codex
- **影响范围**: `knowledge/wiki/minor-arcana/wands/ace-of-wands.md`, `knowledge/wiki/minor-arcana/wands/two-of-wands.md`, `knowledge/wiki/minor-arcana/wands/three-of-wands.md`, `knowledge/wiki/minor-arcana/wands/four-of-wands.md`, `knowledge/wiki/minor-arcana/wands/five-of-wands.md`, `knowledge/wiki/minor-arcana/wands/six-of-wands.md`, `knowledge/wiki/minor-arcana/wands/seven-of-wands.md`, `knowledge/wiki/minor-arcana/wands/eight-of-wands.md`, `knowledge/wiki/minor-arcana/wands/nine-of-wands.md`, `knowledge/wiki/minor-arcana/wands/ten-of-wands.md`, `knowledge/index.md`, `knowledge/log.md`
- **详细信息**:
  - 基于 `YAT` 与 `CTB` 两个已注册来源，首次批量编译了权杖数字牌 `Ace` 至 `Ten`，并在小阿卡纳层建立了 `wiki/minor-arcana/wands/` 目录。
  - 同步更新覆盖矩阵，使权杖数字牌在知识层中形成连续落地，并为后续补齐权杖宫廷牌与其他花色提供结构模板。

### 2026-04-07 INGEST
- **操作者**: Codex
- **影响范围**: `knowledge/wiki/major-arcana/temperance.md`, `knowledge/wiki/major-arcana/the-devil.md`, `knowledge/wiki/major-arcana/the-tower.md`, `knowledge/wiki/major-arcana/the-star.md`, `knowledge/wiki/major-arcana/the-moon.md`, `knowledge/wiki/major-arcana/the-sun.md`, `knowledge/wiki/major-arcana/judgement.md`, `knowledge/index.md`, `knowledge/log.md`
- **详细信息**:
  - 基于已注册来源继续编译了 14-20 号大阿卡纳页面，其中“节制”“恶魔”综合使用 `78W`、`YAT`、`CTB`，其余页面以 `YAT`、`CTB` 为主完成结构化落地。
  - 同步更新了覆盖矩阵，补齐了 0-21 号大阿卡纳的连续知识层覆盖，使全部大阿卡纳页面已在 `knowledge/wiki/major-arcana/` 落地。

### 2026-04-07 INGEST
- **操作者**: Codex
- **影响范围**: `knowledge/wiki/major-arcana/the-chariot.md`, `knowledge/wiki/major-arcana/strength.md`, `knowledge/wiki/major-arcana/the-hermit.md`, `knowledge/wiki/major-arcana/the-wheel-of-fortune.md`, `knowledge/wiki/major-arcana/justice.md`, `knowledge/wiki/major-arcana/the-hanged-man.md`, `knowledge/wiki/major-arcana/death.md`, `knowledge/index.md`, `knowledge/log.md`
- **详细信息**:
  - 基于 `78W`、`YAT`、`CTB` 三个已注册来源，新增编译了 7-13 号大阿卡纳页面，其中“死神”页以 `YAT` 和 `CTB` 为主要综合来源。
  - 同步更新了覆盖矩阵，补齐了 0-13 号大阿卡纳在知识层中的连续落地状态。

### 2026-04-07 INGEST
- **操作者**: Codex
- **影响范围**: `knowledge/wiki/major-arcana/the-empress.md`, `knowledge/wiki/major-arcana/the-emperor.md`, `knowledge/wiki/major-arcana/the-hierophant.md`, `knowledge/wiki/major-arcana/the-lovers.md`, `knowledge/index.md`, `knowledge/log.md`
- **详细信息**:
  - 基于 `78W`、`YAT`、`CTB` 三个已注册来源，新增编译了“女皇”“皇帝”“教皇”“恋人”四张大阿卡纳页面。
  - 同步更新了覆盖矩阵，补齐了 0-6 号大阿卡纳在知识层中的连续落地状态。

### 2026-04-07 INGEST
- **操作者**: Codex
- **影响范围**: `knowledge/wiki/major-arcana/the-magician.md`, `knowledge/wiki/major-arcana/the-high-priestess.md`, `knowledge/wiki/major-arcana/the-world.md`, `knowledge/wiki/major-arcana/the-fool.md`, `knowledge/index.md`, `knowledge/log.md`
- **详细信息**:
  - 基于 `78W`、`YAT`、`CTB` 三个已注册来源，新增编译了“魔术师”“女祭司”“世界”三张大阿卡纳页面。
  - 将愚者页的交叉引用改为真实相对链接，并同步更新覆盖矩阵，闭环了愚者-魔术师-女祭司-世界的知识链路。

### 2026-04-07 INGEST
- **操作者**: Codex
- **影响范围**: `knowledge/wiki/major-arcana/the-fool.md`, `knowledge/index.md`, `knowledge/log.md`
- **详细信息**:
  - 基于 `78W`、`YAT`、`CTB` 三个已注册来源，首次编译了大阿卡纳“愚者”页面。
  - 同步更新了 78 张牌覆盖度矩阵，将 0 号愚者标记为已落地并链接至实体页面。

### 2026-04-07 SCHEMA
- **操作者**: Antigravity Agent
- **影响范围**: `knowledge/AGENTS.md`, `knowledge/index.md`, `knowledge/log.md`
- **详细信息**:
  - 初始化了基于 Karpathy LLM-Wiki 理论的知识编辑 Schema。
  - 创建了分类体系、四类页面模板、工作流规范。
  - 生成了含有 78 张塔罗牌名录的覆盖度矩阵。
