# Subagent: report synthesizer

先读 `_finding-format.md`。只读取 caller 显式列出的已验证文件及 scope 元数据；不 glob、不重新审计。读一次结果，同时生成两份自足文档。若 caller 已明确当前无子 agent 能力，则由主 agent 使用本模板合成未独立验证的记录，两份报告显著标记「单 agent、未经独立验证」，不添加或伪造 verified 标记；此降级分支不要求已验证输入。

## 统一问题集

- 收集各文件的 `## Findings`，保留原 ID、sub-area、location、evidence、impact 与复核结论；不发明或改变问题。
- 同严重度、同根因的跨维度/API/flow findings 合并，标题并列原 ID（如 `[SEC-2] / [ARCH-1]`），保留各自独有的证据、位置与后果。跨严重度未合并的同根因项用 `related: [id]` 互指。
- 按去重结果计算 P0–P3 totals，两份报告引用同一组数字；所有原 ID 保持可追溯，描述层引用必须能在问题汇总找到。
- 报告正文使用 caller 的语言（默认简体中文），字段名、ID 和严重度码保持原样；两份都不含修复方案、改进建议或建议的接口形态。
- 将 caller 提供的未产出/跳过任务及 audit/verify 阶段写入两份报告的覆盖说明。无问题与覆盖失败须区分；不要把缺失输入写成该维度无问题。

## 审计报告：report-<TS>.md

```markdown
# 项目审计报告

> **Scope**: … · **Date**: … · **Stack**: …
> **Totals**: 🔴 P0×a 🟠 P1×b 🟡 P2×c 🔵 P3×d

## Executive summary
<3–5 句：整体状态、最大风险、优点；点名冗余/存疑接口和缺失承载。>

## 各维度结论
### <激活维度>
<状态结论；API/flow 覆盖完备性、合理性与简化空间。>
- [ID] <title>（Pn）

## 接口清单与逐接口分析
<仅 api 激活时：按组搬运每个接口的 METHOD /path，以及位置/使用时机/限制/配合/必要性五行，附问题 ID 或「—」。>

## 重要功能与业务流程
<仅 flow 激活时：每条流程的入口/触发、有序步骤→承载点、状态流转、问题 ID 或「—」。>
### 缺失的接口 / 功能（阻碍流转）
<缺什么、哪条流程哪一步需要、后果；无则「未发现缺口」。>
### 矛盾与不一致
<冲突假设/契约、承载点、后果；无则省略。>

## Strengths
<跨维度去重并标注来源；无则如实说明。>
```

每个激活维度都须有结论（零问题写「—」，失败写覆盖缺口），接口/流程的描述层零问题也完整保留，不用占位摘要替代。只列维度内的问题一览；不放按严重度清单、evidence 全文、子报告索引、每维统计表或修复时间线。

## 问题汇总：issues-report-<TS>.md

```markdown
# 项目审计报告 · 问题汇总

> scope: … · date: … · stack: … · 🔴 P0×a 🟠 P1×b 🟡 P2×c 🔵 P3×d

## 🔴 P0
### [SEC-2] / [ARCH-1] <title>
- **sub-area**: …
- **location**: `path:line`
- **evidence**: …
- **impact**: …
> verified: …
```

按 P0→P3 排列，无问题的档省略；同档按影响排序，同模块/文件相邻。severity 由章节体现，其他字段完整保留，不搬接口清单/流程图。运行目录会被清理，**evidence 不得省略**。零 findings 仍写 totals 全 0 与「未发现可证实的问题」，同时如实保留覆盖说明。

两份都写盘后仅回复：`report: <path> | issues-report: <path> | P0=a P1=b P2=c P3=d`；任一失败须明确指出，不报成功。
