---
name: codebase-audit
disable-model-invocation: true
description: >
  手动多 agent 代码库审计：覆盖架构、性能、代码质量、安全、测试、依赖、可维护性、
  构建部署与规范；按项目激活前端、HTTP 接口与业务流程审计。
  独立复核后产出审计报告和按严重度问题汇总，只发现问题，不给修复方案。
---

# Codebase Audit

只读、多 agent 代码库审计；主 agent 定范围和编排，auditor 自读源码，独立 verifier 去伪，一个合成器生成两份自足文档。

## 调用与约束

- 仅显式 `/codebase-audit [path]` 或 `/kang-skills:codebase-audit [path]` 执行；相似请求不自动触发。
- 无 path 审整个项目；目录审其源码树；文件连同直接调用方与依赖一起审。
- 默认通用 9 维度全开，前端/API/流程按下表条件激活；用户指定 only/skip 时严格按要求收窄，点名的流程也纳入。
- 报告默认简体中文，服从用户指定语言。并发默认 5，服从用户调整及宿主上限；可串行派发独立子 agent。
- 使用宿主可用的子 agent 工具，不绑定工具名。**发现者与复核者必须是不同 agent**。若无子 agent 能力，主 agent 按相同维度与文档格式完成单 agent 审计，跳过独立复核及子 agent 派发；两份文档均须显著标记「单 agent、未经独立验证」，不得声称通过独立复核。
- 只发现与整理问题，不修改被审代码、不跑测试、不提交、不写修复方案。共用格式和不可信输入规则见 [agents/_finding-format.md](agents/_finding-format.md)，各角色先读再处理被审内容。

## 1. Scope：写一次范围说明

主 agent 用文件清单、manifest、入口和定向 `rg` 判栈与边界，不批量读源码正文。用真实时钟生成 `<TS>`（如 `date +%Y%m%d%H%M%S`），创建 `docs/audit/<TS>/`；若与已有运行或报告重名，换新 TS，不覆盖。目录不可写则停止派发并说明。

写 `docs/audit/<TS>/scope.md`，供各角色按路径读取，包含：

- 项目根绝对路径、审计范围、技术栈、报告语言、日期和激活维度。
- 关键目录/入口（树至多 3 层）。
- HTTP 项目：从路由注册、装饰器、OpenAPI/Swagger 或 HTTP proto 注解枚举接口骨架：分组、方法、路径、handler 位置。按资源/模块分组；spec 与代码不一致交对应 auditor 核查。生成路由列入清单，但跳过生成胶水的深审。
- 重要流程：用户点名或明显的多步核心路径，HTTP 项目映射到接口，其他项目映射到模块/函数/命令/消息处理器/定时任务。
- 任务清单：key、指令文件绝对路径、产物绝对路径；记录 audit/verify 的完成、跳过与失败状态，供合成和续跑核对覆盖。

用户要求接口审计却未找到路由时，扩大搜索/查 spec；仍找不到才询问路由位置。未识别重要流程则不激活 flow，交付时注明。未知栈仍审，注明判断边界；二进制与生成文件不交 auditor 深读。

告知用户范围、技术栈、激活项、接口组/流程数及并发上限，然后派发。

## 2. Audit：按需派发

每个激活维度、接口组和流程各一个 auditor。只给 scope 路径、任务 key/名称、对应指令路径和唯一产物路径，不粘贴范围全文、源码或其他 auditor 的结果；各自读取所需文件。常规维度 key 同时作文件名。

| 维度 / key | Prefix | 指令（本 skill 的 agents/ 下） | 激活条件 |
|---|---|---|---|
| 架构 / arch | ARCH | audit-architecture.md | 默认 |
| 性能 / perf | PERF | audit-performance.md | 默认 |
| 代码质量 / code | CODE | audit-code-quality.md | 默认 |
| 安全 / security | SEC | audit-security.md | 默认 |
| 测试 / testing | TEST | audit-testing.md | 默认 |
| 依赖 / deps | DEP | audit-dependencies.md | 默认 |
| 可维护性与可观测性 / obs | OBS | audit-observability.md | 默认 |
| 构建部署基建 / infra | INFRA | audit-infra.md | 默认 |
| 规范符合性 / conv | CONV | audit-conventions.md | 默认；加载 code-conventions skill |
| 前端 / fe | FE | audit-frontend.md | 检测到 web/前端栈 |
| 接口组 / api-<group> | API | audit-endpoint.md | 检测到 HTTP 服务，每组一项 |
| 业务流程 / flow-<flow> | FLOW | audit-flow.md | 识别出重要流程，不限 HTTP |

产物为 `docs/audit/<TS>/<key>.md`。group/flow key 只用字母、数字、短横线或下划线，同族内唯一，避免路径越界和 ID 冲突。接口逻辑归 API；REST 语义、命名、错误码等规范符合性归 CONV。

通用派发示例（所有路径用绝对路径，避免子 agent 工作目录不同）：

```text
先读 <agents/_finding-format.md 绝对路径>。
范围：<scope.md 绝对路径>；任务：<key / 名称>。
按 <对应 agents/audit-*.md 绝对路径> 审计，自己读取所需源码。
只写 <任务产物绝对路径>。仅回复一行：<PREFIX>[<可选 group/flow key>]: P0=a P1=b P2=c P3=d。
```

在并发上限内分批处理，记录实际产出；明确 skipped 的项登记原因、不派 verifier，并将覆盖缺口传给合成器。不把无回复/空文件当成零问题；无需为零 finding 补问题。测试维度遇到完全无测试的项目，只报一条 P1。

## 3. Verify：独立反驳

每个成功产出的文件交给一个**全新 verifier**。给 scope 路径、[agents/verify.md](agents/verify.md) 的绝对路径及该文件路径；只允许原地重写它。保持相同并发上限，回复仅一行 `<key>: kept=x dropped=y`。

verifier 查源码与调用上下文反驳每条 finding，保留有证据的项并校正严重度；去掉误报、已缓解或无法证实的项。接口清单/流程图与 Strengths 保留，按 verifier 规则同步修正被删除 finding 的引用。**未成功复核的文件不得进入已验证输入列表**。

## 4. Synthesize：读一次，写两份

派一个合成器，给 scope 路径、[agents/synthesize.md](agents/synthesize.md) 的绝对路径、**成功复核文件的显式列表**及失败/跳过项；不 glob，不把 scope.md 或未验证文件混入 findings。两个输出路径固定为：

- `docs/audit/report-<TS>.md`：结论、各维度问题一览、接口清单、流程图、优点。
- `docs/audit/issues-report-<TS>.md`：全部问题按 P0→P3 排列，保留证据与后果，是按严重度清单的唯一所在。

合成器只整理已验证结果，不重审或发明问题；同一份去重结果驱动两份报告的 ID 和 totals。零问题也产出两份文档；在独立复核模式下若无任何成功复核的任务，停止合成并报告失败，不能报为零问题。

## 5. Deliver：核对后交付

主 agent 确认两份报告均非空、关键章节/接口/流程覆盖齐全、ID 引用有效、两份 totals 一致，且 totals 来自问题汇总去重结果，不能累加各 auditor 计数。

对照 scope 任务清单，把每项失败/跳过及阶段写入报告和交付摘要；不把覆盖不完整称为全量完成。无失败/待续跑项且核对通过后，只删除本次 `docs/audit/<TS>/`，最终两份文档不依赖它。仍有失败/待续跑项，或任一报告失败/缺失/未通过核对，则保留现场供重试。

摘要给出范围、完成覆盖、未产出项及阶段、P0–P3 totals、最大风险、一项优点和两份报告路径。问题汇总成功时提示可用 `remediate-suggest` skill 补推荐方案，只提示，不自动调用。

## 失败与续跑

- 发现明确限流/配额错误（429、rate limit、quota、resource exhausted 等）即停止所有新派发，保留现场，告知用户等恢复；已在跑的自然结束。不要逐项重试消耗配额。
- auditor 失败/超时/空产物：登记 audit 失败并跳过该项复核；verifier 失败：登记 verify 失败并排除该文件；其他成功项可继续合成，报告明确覆盖缺口。
- 合成失败时保留中间文件；续跑同一 run 只补缺失/失败阶段，复用已成功复核的文件，不重复整个审计。
