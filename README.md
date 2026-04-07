# 🔮 灵语塔罗 (AetherTarot Agent)

**基于长上下文（Long Context）与推理模型驱动的深度塔罗占卜智能体**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Model: DeepSeek-R1 / Claude-3.5](https://img.shields.io/badge/Model-DeepSeek--R1%20%7C%20Claude--3.5-blue)](https://www.anthropic.com/)
![Approach: LLM-Wiki](https://img.shields.io/badge/Approach-LLM--Wiki%20(Long%20Context)-orange)

## 🌟 项目愿景
不同于市面上简单的“关键词匹配”占卜机器人，**灵语塔罗** 旨在利用大语言模型（LLM）的超长上下文能力，将 78 张塔罗牌的深层象征、神秘学背景与牌阵逻辑逻辑完全“内化”。通过 **Karpathy 的 LLM-Wiki 模式**，Agent 能够实现对复杂牌阵的全局洞察，为用户提供具备文学性、启发性和情感共鸣的深度解读。

> 目标：构建一个**可解释、可追踪、可评测、可长期迭代**的塔罗 Agent，而不是一个只会“说漂亮话”的一次性聊天机器

---

## 🛠 技术架构：从 RAG 转向 Long Context
本项目摒弃传统的向量数据库检索（RAG），采用**全量知识注入方案**：
-   **Knowledge Base:** 结构化的 `Tarot_Encyclopedia.md`（涵盖 78 张牌的正逆位、图像象征、数秘学、元素属性）。
-   **Context Strategy:** 利用 **Prompt Caching（提示词缓存）** 技术，将万字百科常驻模型上下文，实现零延迟、低成本的全局推理。
-   **Reasoning Engine:** 采用推理模型（如 DeepSeek-R1）进行“三遍消化法”解读：
    1.  **解析象征：** 识别牌面所有视觉符号。
    2.  **建立联结：** 分析牌阵中不同牌的能量流动与冲突。
    3.  **合成解读：** 结合用户语境输出最终回答。

---

## 🚀 核心功能规划

### 1. 智能牌阵系统 (Core Logic)
-   **自适应抽牌：** 支持单牌、圣三角、凯尔特十字等经典牌阵。
-   **真随机算法：** 结合物理随机数接口，模拟真实的洗牌感。
-   **正逆位判定：** 严谨的布尔值逻辑控制。

### 2. 深度解读引擎 (Insight Engine)
-   **全量知识对齐：** 基于内置 Wiki，确保解读不脱离神秘学基础。
-   **多轮追问：** 支持基于当前牌阵进行深度对话，Agent 记得每一张牌的位置与意义。

### 3. 多模态增强 (Vision Integration) - *进阶*
-   **实体牌识别：** 用户上传自己拍摄的占卜照片，Agent 自动识别牌名及位置。
-   **灵感卡片生成：** 根据占卜结果，AI 自动绘出一张“今日能量指引卡”。

---

## 📅 开发路线图 (Roadmap)

### 第一阶段：知识工程 (Knowledge & Prompt)
- [ ] 整理 `Tarot_Wiki.md`：包含 78 张牌的 500 字以上深度描述。
- [ ] 编写 **System Prompt**：定义占卜师的人设、解读风格和输出格式。
- [ ] 在 Playground 测试全量注入模式下的解读准确率。

### 第二阶段：逻辑流构建 (Workflow)
- [ ] 开发 Python 脚本实现抽牌逻辑（工具调用/Function Calling）。
- [ ] 设计对话状态机：确保“问题澄清 -> 洗牌 -> 抽牌 -> 解读”的闭环过程。
- [ ] 接入 **DeepSeek API** 并配置缓存优化成本。

### 第三阶段：记忆与持久化 (Memory)
- [ ] 集成 **Mem0** 或数据库，记录用户的性格标签和历史占卜记录。
- [ ] 实现“回声占卜”：当用户问及旧事，Agent 能对比新旧牌阵的变化。

### 第四阶段：表现层开发 (Frontend)
- [ ] 使用 **Streamlit** 或 **Next.js** 构建沉浸式 UI。
- [ ] 增加牌面翻转动画与神秘学氛围视觉设计。

---

## 📂 目录结构预设
```text
AetherTarot/
├─ README.md
├─ AGENTS.md
├─ docs/
│  ├─ 00-overview/
│  ├─ 10-product/
│  ├─ 20-domain/
│  ├─ 30-agent/
│  ├─ 40-architecture/
│  ├─ 50-safety/
│  ├─ 60-evals/
│  ├─ 70-ops/
│  └─ 80-decisions/adr/
├─ knowledge/
├─ apps/
├─ packages/
├─ evals/
└─ codex/skills/
```

> 当前模板主要覆盖 `README.md`、根目录 `AGENTS.md` 与 `docs/` 首批核心文档。

---

## 📝 开发者准则
1.  **逻辑严谨：** 所有的解读必须基于 `docs/Tarot_Wiki.md`，禁止 AI 凭空捏造不存在的神秘学符号。
2.  **人文关怀：** Agent 设置中必须包含“心理健康免责声明”，对于极端负面情绪提供正向引导。
3.  **极简架构：** 优先使用 Long Context 解决问题，非必要不引入复杂的向量检索。
4.  **文档先行：** 重要模块先写职责与边界，再开始编码。
5.  **输出可评测：**任何关键输出都应尽量结构化。
6.  **规则外部化：**不要把业务真相藏在 prompt 里。
7.  **知识可沉淀：**把牌义、牌阵、风格与安全边界写入知识层。
8.  **变更可追踪：**重要选择用 ADR 记录。

---

## 🤝 参与学习
如果你对 AI Agent 开发、神秘学或 Prompt Engineering 感兴趣，欢迎通过以下方式参与：
- **提交 Issue:** 反馈解读逻辑中的 Bug。
- **PR 贡献:** 丰富 `Tarot_Wiki.md` 的牌意维度。

---
*注：本项目仅供 AI 技术交流与学习，占卜结果不作为现实生活决策依据。*