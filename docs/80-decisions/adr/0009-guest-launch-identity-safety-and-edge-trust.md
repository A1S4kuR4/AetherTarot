# ADR 0009: Guest launch identity, Final safety, and edge trust boundaries

## Status

Accepted — 2026-08-12

## Context

游客上线把浏览器历史、账号历史、两阶段 Final 输入、模型 I/O 和来源 IP 同时暴露为安全边界。旧实现会把账号历史写入全局 localStorage、在账号 API 失败时跨身份回退；Final 只审查原问题；请求/响应可无界缓冲；应用直接信任公网代理头。这些问题会造成隐私泄露、安全绕过和资源耗尽，不能只靠 UI 或部署口头约定补救。

## Decision

1. 游客历史使用独立版本 key，仅属于当前浏览器；账号历史以服务端为唯一 canonical source。旧 key 不自动迁移，身份变化清空内存敏感态但保留 guest key。认证状态未解析时不渲染 guest；解析后的 identity-keyed provider 在新身份首个可见 commit 前创建全新的内存状态，其 layout-effect cleanup 在旧树 unmount commit 阶段同步 dispose，epoch/abort/stale guards 继续防止旧异步结果回写。
2. 每次 provider 前分别分类 question 与每条用户答案并聚合；字段内否定不能覆盖另一字段。输入策略与输出验证器复用 NFKC、Cf/零宽、全角、异常空格及 normalized/compact 声明式规则，把核心危险行为/状态、危险意图 cue 和安全/转述/受害者 context 映射为统一 span；context 只有覆盖同类别 core 与 cue 才豁免，未覆盖 cue 或另一 core 优先。Graph 在 intent friction 后设置不可由 decider 覆盖的 hard-stop 条件边，Tier 1 Final 在 tool/provider/持久化前停止，snapshot 释放以供修改重试。
3. 入站和 provider 响应都按实际字节流式限长；单一 provider deadline 从排队前覆盖 acquire、token reserve、headers/body 与 settlement。permit 不等待永久悬挂的 settlement，queue full/timeout 不在 stage 内重试。
4. 应用忽略标准代理头，只信任边缘代理覆写的内部 IP header 与 shared secret；生产失败关闭。进程 semaphore 和 shared secret 均不被描述为跨实例/跨网络的完整保护。
5. 高置信安全硬边界由服务端确定性语法承担。语法以 `speech act × state/action × person/entity × cue × bounded context` 组合，不把 `him/her`、某几个药名或完整句 fixture 当作封闭集合；暴力人物槽使用有限关系/角色/姓名语法，安全搭配（如拍摄影片、击败游戏）独立排除。自伤的当前状态/意图、恢复/教育/助人支持，治疗变更、即时袭击/威胁/限制离开，以及监控/秘密录制/位置查找分别建模。输出验证比输入更严格：伤害鼓励、操控指令、停治或改剂量、直接诊断触发整份服务端替代，拒绝正文不得进入 response、grounding、capsule、history、thread memory、agent state 或 trace。
6. 外部 safety classifier / moderation 只允许作为第二信号：它可以把确定性语法未命中的输入升级，但不能降级或取代确定性 Hard Stop，也不能成为唯一安全边界。若未来某条上线流程把该第二信号设为必经步骤，其 timeout、协议错误或不可用必须 fail closed：在 provider、tool 和任何持久化前终止，以现有非成功错误包返回（默认 `503 provider_unavailable`），不得静默按 pass 继续；这不等同于把 classifier 故障谎报成用户触发危机。
7. 游客首发的确定性高置信覆盖范围是简体中文与常见英文（包括已测试的基础中英混合、Unicode/Cf/空白规避）。这是一组受测试语法，不是自然语言穷尽证明；方言、拼音/转写、隐语、低资源语言和开放式语用仍可能超出覆盖。产品、文档和评测不得声称“识别所有表达”；扩展语言范围必须新增语义/property matrix 与发布证据。
8. Capsule 在任何逐行 label 清理和 280 字截断前，先对完整原文执行 NFKC、Cf 清除与全空白折叠并做整体风险判断；整体命中时整份降为 `null`。incoming、outgoing question fragment 与最终 capsule 复用同一分类式 sanitizer，避免换行切词绕过。

## Consequences

账号历史 API 故障会显示空历史或同步失败，而不是提供不可信本地可用性；旧本地记录需未来显式导入 UI 才能进入账号。Caddy、systemd env、源站端口封锁和供应商硬预算必须独立验收，代码合并本身不能关闭这些生产风险。未来 Cloudflare 配置必须独立设计，且只有源站仅允许 Cloudflare 官方网段时才可由边缘层采用 `CF-Connecting-IP`。

确定性语法会保守阻断部分歧义表达，因此必须以 benign collocation、完整否定 scope、恢复/教育/助人 bounded context 和跨句局部性回归控制误报。外部 classifier 即使未来接入，也只能增加 defense in depth，不能成为删减这些确定性回归的理由。

身份变化以 keyed remount、epoch 与 AbortSignal 取消旧 initial/final/history/notes/outbox 请求；账号保存失败进入 identity-scoped browser outbox 并明确显示待同步，不把 outbox 当成 canonical history。Guest history 与 account outbox 的多标签读合并写都使用 Web Locks 事务；锁不可用或本地写失败时明确告知用户，不用非事务 fallback 伪装成功。`/new` 草稿采用 guest localStorage / account sessionStorage 分区，旧全局 key 只删除不导入。
