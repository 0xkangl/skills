# Shared: finding format & severity scale

Every auditor (常规维度、endpoint 组、业务流程) reads this, then emits findings in the format below. Keep output dense — no filler, no restating these rules.

## Severity scale

- **P0 — Critical**: exploitable hole, crash/data-loss risk, or a defect breaking a core path. Fix now.（api/flow 维度下如：鉴权被绕过、接口逻辑错误使核心路径不可用、业务流程矛盾或缺失承载导致关键流转**根本无法完成**。）
- **P1 — High**: likely production incident, broken core behavior, or a flaw blocking scaling/maintenance.（api/flow 维度下如：逻辑缺陷很可能引发生产事故、缺失接口使重要场景无法支撑。）
- **P2 — Medium**: real debt or design smell with no runtime impact yet.（如冗余/可合并的接口、可简化的逻辑。）
- **P3 — Low**: polish, minor optimization, style.

Your dimension file may tighten this.

## 简化优化 判定基准

问的是「能不能更简单 / 更优」，不是「还能加什么」：

- **逻辑 / 流程可简化**：合并重复逻辑、减少往返与中间状态、删可达不到的死分支。
- **业务流程可优化**：把多次往返收敛成更短、更自洽的闭环。
- **不过度设计**：为单一用途造的抽象、未被要求的可配置 / 灵活性、多余的接口 / 参数 / 分层——按 YAGNI 判为问题。
- **偏离行业成熟方案**：同类问题已有更简单的成熟、生产级方案而代码自创了复杂解——过度复杂本身就是问题（在 evidence/impact 里陈述哪里复杂、留着的代价即可，不展开应该怎么改）。

判定时自问「资深工程师会不会觉得这里过度复杂」；会，就落一条 `简化优化`。

## Output

Write one Markdown file to the path the caller gives, in exactly this shape:

```markdown
# {Dimension / 分组 / 流程} — findings

## Strengths
- <concrete thing done well>            ← omit the whole section if none

## Findings
### [{ID}] <title>
- **severity**: P0|P1|P2|P3
- **sub-area**: <one of your sub-areas>
- **location**: `path:line`            ← omit if not pinpointable
- **evidence**: <the code construct that proves this — quote it, don't gesture>
- **impact**: <留着不管的具体后果：错误结果 / 事故 / 流程受阻 / 白费的接口>
```

（接口/流程文件在 `## Findings` 之前还有各自的描述层——`## 接口清单` / `## 流程图`，模板见 `audit-endpoint.md` / `audit-flow.md`；本文件只定义所有 auditor 共享的 finding 块形状。）

## Id 规则

- 常规维度：`[<PREFIX>-N]`（PREFIX 见 SKILL.md 维度表）。
- 接口组：`[API-<group>-N]`；业务流程：`[FLOW-<flow>-N]`——key 与产物文件名一致（`api-<group>.md` / `flow-<flow>.md`）。各组/各流程独立编号，key 是防跨组撞号的。

## Sub-area

- 常规维度：由各自的维度指令文件定义。
- endpoint 族：`正确性` | `合理性` | `简化优化` | `必要性`。
- flow 族：`正确性` | `设计合理性` | `简化优化` | `矛盾` | `缺失`。

## Rules

- Write prose fields (title, evidence, impact, strengths) in the caller's **Report language** (default 简体中文); keep field labels, severity codes, and ids as-is.
- Report only what the code you actually read supports; never infer unseen context.
- One finding per real problem — don't pad to cover every sub-area.
- `evidence` is mandatory and must be checkable: an independent verifier will try to refute it. 缺失类 finding 的 evidence = 无承载可用的那个流程步骤/调用方。
- **本 skill 只发现与整理问题，不产出修复方案/改进建议**；问题描述必须自足——evidence + impact 把「是什么、为什么是问题、留着有什么后果」讲清。
- No statistics, no summary, no closing notes — the synthesizer aggregates.