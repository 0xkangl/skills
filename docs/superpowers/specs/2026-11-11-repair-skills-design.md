# 修复与脚手架 Skills 审阅设计

目标：保持五个 skill 的用途、输入格式与职责边界，优化跨宿主指令可执行性、失败恢复和确定性操作。用户已授权直接修改、使用 worktree、提交并合并本地 main。

## 审阅依据

截至 2026-11-11 检索并读取以下官方资料：

- [OpenAI：Rethinking skills and prompts for GPT-6 Astra](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra)：精简触发描述、渐进披露、只读任务需要的上下文。
- [Anthropic：Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)：依操作脆弱性分配自由度，以脚本承担确定性操作，使用可验证中间产物。
- [Qwen Code：Subagents](https://qwenlm.github.io/qwen-code-docs/en/users/features/sub-agents/)：子 agent 的独立上下文、工具限制、用户交互与工作目录取决于宿主；不能把上下文隔离当成文件系统隔离。
- [Qwen：Function Calling](https://qwen.readthedocs.io/en/stable/framework/function_call.html)：工具协议和输出格式应匹配运行环境。

这些资料支持下列设计取舍，不构成已经通过三家模型实测的结论。

## 发现与实现选择

| Skill | 现有缺口 | 优化 |
|---|---|---|
| diagnose-and-fix | 触发描述包含整个工作流；已有授权仍重复确认；测试后格式化；无关改动一律阻塞 | 精简描述，按证据复用上下文与选择，格式化后验收，按基线隔离暂存，保留诊断优先与独立验证 |
| diagnose-and-fix-batch | 假定子 agent 可直接问用户；结果与实际提交未交叉核验；失败残留带入后续问题 | 主 agent 转达交互；串行核验与失败隔离；维持同一单问题流程 |
| agents-scaffold | 命令示例含伪 shell 语法；CLI 和预检边界需验证 | 可复制命令、参数/预检回归，保留模板生成、备份与 git 行为 |
| remediate-suggest | 仅凭 ID 复用片段；无新增时可能覆盖已有产物；手工重拼与目录清理易丢内容 | 本 skill 自包含零依赖合并脚本，校验原始块、片段指纹、重复 ID，原子写入；保留已有块、原始顺序与未消费文件 |
| remediate-apply | 交互能力与工作区假设固定；未提交标签被当作无关变更；失败后继续可能混入改动 | 显式共享目录/基线与排除文档，校验 RESULT/commit，残留处理后继续；多方案人工选择不变 |

只改措辞不能保证合并保真；完整通用编排器又会引入不必要的解析器与状态层。因此保留模型承担诊断、分组、方案判断，仅把 Markdown 片段校验与合并交给脚本。JSON/YAML/自由文本问题列表继续按原格式处理，不引入依赖，不以正则冒充通用 YAML 解析器。

## 验收与边界

- 不修改五个 skill 之外的产品行为，不合并 skill，不引入跨 skill 内部文件引用，不修改发布版本。
- suggest 仍只分析、不跑被审项目测试、不提交；apply 仍逐条串行、一问题一提交，状态文档不提交。
- 诊断确认阶段保留用户选择权；已有明确选择与授权在相同范围复用。
- 脚本用 node:test 验证真实文件产物、拒绝路径和 no-op；所有 scaffold 测试必跑。
- 用独立 agent 做前后场景审查，检查无法交互、失败残留、格式化后验证、旧片段、无新增与多方案选择。没有模型调用凭据时不声称三家实测。


## 实施与验证记录

五个 skill 的触发描述合计由 1816 字符降至 457 字符（按 Markdown frontmatter 文本计数，非 token 或性能测量）。诊断、方案选择、独立验证、只分析及状态文档不提交的目标保留。

- `agents-scaffold`：基线 55 项测试通过；新增 8 项回归后 63/63 通过。修复值参数吞掉 `--dry-run`、模块目录冲突漏报/冲突策略未传递、备份及中途失败记录不完整、既有模块被整体列为可清理目录和既有 Git 分支被重命名；命令示例可由 Bash 正确解析。
- `remediate-suggest`：新增自包含合并脚本与 37 项 CLI/文件系统测试，37/37 通过。覆盖原文/人工字段保留、追加/no-op、源指纹失效、多 ID、代码围栏、重复与未知 ID、缺失方案、输入别名、原子替换、符号链接入口和实际 issues-report 的 `verified` 字段。脚本只校验约定 finding 结构；报告 meta 与代码基线由调用流程核验，源指纹不代表代码新鲜度。
- 仓库完整性：所有 8 个 skill 的 name/description、292 个相对链接、跨 skill 内容引用与 README 同步检查通过；`git diff --check`、两个脚本的语法检查通过。
- 独立静态场景复核：已选方案与无关改动、子 agent 无交互能力、失败残留与下一项重叠、格式化后验证、只读列表与实际摘要均已复核。额外修正了无提交结果被误判和条件性消解被报成已修复的两处歧义。
- 本次没有调用 Anthropic 或 Qwen 的实际模型进行端到端基准；跨提供方结论限于官方文档对照、指令场景审查和本地脚本验证。

本地 main 在实施期间另有 code-conventions 与 engineering-guidelines 的已提交变更；已先快进同步到本次分支，保留其内容，不纳入本次修改范围。

合并前独立 diff 审查以同步后的 `023c34f` 为基线，覆盖本次五个 skill、两个脚本及新增文件，未发现已证实的 Critical / Important 问题；审查者只读，测试结论来自上述实际命令。
