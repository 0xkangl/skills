# api-audit 并入 codebase-audit 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `api-audit` skill 整体并入 `codebase-audit`（接口/流程审计成为条件维度），移除全部 fix/suggest 流程，产出统一为 `docs/audit/` 下「审计报告 + 问题汇总」两份文档。

**Architecture:** `skills/codebase-audit/` 是唯一保留的审计 skill：main agent 只做 Scope 与编排，5 步管道（Scope → Audit → Verify → Synthesize → Deliver），Audit 阶段并行派发常规维度 / 接口组 / 业务流程三类 auditor，每个 auditor 文件由全新 verifier 对抗式验证，最后 2 个合成器并行产出报告与问题汇总。find/verify 分离是唯一硬不变量。

**Tech Stack:** Markdown skill 文档（SKILL.md + agents/ 指令）、零依赖 Workflow 脚本（`scripts/workflows.mjs`，沙箱 JS：`agent`/`pipeline`/`parallel`/`phase`/`log` 原语）、evals JSON。

**Spec:** `docs/superpowers/specs/2026-07-06-audit-skills-merge-design.md`（一切以它为准；本计划把它翻译成可执行任务）。

## Global Constraints

以下契约贯穿所有任务，任何文件里出现时必须逐字一致（spec 验收 8）：

**回复行契约**（SKILL.md 各 Step prompt、`workflows.mjs` 各 prompt、对应 agents 文件末尾三处一致）：

| 场景 | 回复行固定形状 |
|---|---|
| 常规维度 audit | `<PREFIX>: P0=a P1=b P2=c P3=d` |
| 接口组 audit | `API[{group key}]: endpoints=n P0=a P1=b P2=c P3=d` |
| 流程 audit | `FLOW[{flow key}]: steps=n P0=a P1=b P2=c P3=d` |
| 常规维度 verify | `<PREFIX>: kept=x dropped=y` |
| 接口/流程 verify | `<PREFIX>[{key}]: kept=x dropped=y` |
| report 合成器 | `report: dims=<n> endpoints=<n|-> flows=<n|-> → <path>` |
| issues 合成器 | `issues-report: P0=a P1=b P2=c P3=d → <path>` |

**路径契约**：运行期平铺 `docs/audit/<TS>/<dim>.md`、`docs/audit/<TS>/api-<group>.md`、`docs/audit/<TS>/flow-<flow>.md`、`docs/audit/<TS>/scope.md`（仅 Workflow 路径）；最终产物 `docs/audit/report-<TS>.md`、`docs/audit/issues-report-<TS>.md`。**禁止** `<TS>/api/`、`<TS>/flow/` 子目录写法与 `docs/api-audit/` 路径。

**id 契约**：常规维度 `[<PREFIX>-N]`；接口组 `[API-<group>-N]`；流程 `[FLOW-<flow>-N]`（key 与产物文件名一致）。

**finding 字段**：severity / sub-area / location / evidence / **impact**（不再有 `risk`，不再有 `fix`/`suggest`/`quick-fix` 字段）。

**禁词**（验收 grep）：
- `skills/codebase-audit/` 全目录（含 evals/）不得出现 `fix-solution`、`quick-fix`、`suggest`（英文字面）。例外：`_finding-format.md` severity 定义里的「Fix now」允许。
- `skills/codebase-audit/agents/` 不得出现 `**risk**`（字面加粗字段标记）。
- `skills/`、`README.md`、`AGENTS.md` 不得出现字面 `api-audit`（合并说明用「原独立的接口审计 skill」表述；spec/plans 历史文档不在范围）。

**其它**：新写文件的中文/英文混排风格沿用现有 agents 文件；注释用简体中文；每个任务一次 commit（`rtk git …`）；Task 4–7 之间旧 SKILL.md 短暂引用已删文件属预期中间态，最终由 Task 7 收敛。

---

### Task 1: 重写 `agents/_finding-format.md`（合并两版）

**Files:**
- Modify: `skills/codebase-audit/agents/_finding-format.md`（整文件替换）

**Interfaces:**
- Produces: finding 块形状（severity/sub-area/location/evidence/**impact**）、id 规则（`[<PREFIX>-N]` / `[API-<group>-N]` / `[FLOW-<flow>-N]`）、两族 sub-area 枚举、「只发现不修复」规则——Task 3/4/5 的文件与 Task 7 的 SKILL.md 都以此为共享基座。

- [ ] **Step 1: 用以下完整内容覆写文件**

````markdown
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
````

- [ ] **Step 2: 验证**

Run: `rg -n 'suggest|\*\*risk\*\*|\*\*fix\*\*' skills/codebase-audit/agents/_finding-format.md || echo OK`
Expected: `OK`

Run: `rg -c 'impact' skills/codebase-audit/agents/_finding-format.md`
Expected: 计数 ≥ 3

- [ ] **Step 3: Commit**

```bash
rtk git add skills/codebase-audit/agents/_finding-format.md && rtk git commit -m "refactor(audit): 合并 _finding-format——统一 impact 字段、双族 sub-area、id 带 key、只发现不修复"
```

---

### Task 2: 重写 `agents/verify.md`（合并两版）

**Files:**
- Modify: `skills/codebase-audit/agents/verify.md`（整文件替换）

**Interfaces:**
- Consumes: Task 1 的 finding 形状与 id 规则。
- Produces: verifier 回复行两种（`<PREFIX>: kept=x dropped=y` / `<PREFIX>[{key}]: kept=x dropped=y`）——Task 6 的 workflows.mjs 与 Task 7 的 SKILL.md Step 3 逐字引用。

- [ ] **Step 1: 用以下完整内容覆写文件**

````markdown
# Subagent: adversarial verifier

You get one auditor's file — a dimension findings file (`<dim>.md`), an endpoint-group file (`api-<group>.md`), or a flow file (`flow-<flow>.md`). Your job is to **refute** each finding, not endorse it. A finding survives only if the cited code unambiguously supports it. You did not write these findings — stay skeptical.

**Independence check first**: you must be a different agent than the one that wrote this file. If you authored these findings (or have no way to spawn as a separate subagent), stop — do not self-verify. Report that back to the caller instead of rubber-stamping your own work; a self-checked file is not a verified one.

## Leave the description layer & Strengths alone

- `## Strengths` 在**所有**文件中原样保留——它不是待反驳的 claim。
- 接口/流程文件的描述层（`## 接口清单` / `## 流程图`）是文档、不是 claim，**原样保留**。两条例外（都因为「描述与已验证 findings 相悖会误导读者」）：
  1. 核查 finding 时发现描述层某行与代码明显相悖（如清单里列的位置根本没有那个 handler）——修正该行并注明。
  2. drop 一条 `必要性` finding（「冗余/存疑」的接口其实有活的调用方）——同步把 接口清单 对应的 `必要性` 行改回 `必要` 或删除引用。
- **悬挂引用**：描述层里**任何** `见 [id]` / ⚠️ 标记，所指 finding 被你 drop 时必须同步更新（改回正常表述或删去）——包括流程图步骤上的 ⚠️ 标记，不只 必要性 行。指向已删 finding 的引用比没有引用更糟。

## For each finding

1. Open the cited `location` and read enough around it to judge.
2. Attack it——通用四问：证据是否误读？别处是否有 guard/middleware/validation 使它不成立？是否惯用且安全？是否依赖你看不到的上下文？三类从严：
   - **必要性 findings**：接口真的冗余/无人调用吗？先 grep 调用方，再同意冗余。
   - **缺失 findings**：「缺失」的承载真的不存在吗？HTTP 项目查别的路由/动词/查询参数；非 HTTP 项目查别的函数/命令/路径。这是最易夸大的类别——从严。
   - **简化优化 findings**：确认「更简单的做法」不丢代码里真实存在的约束——并发/边界/兼容性；复杂度实际承重则 drop。
3. Verdict:
   - **confirmed** — code clearly supports it → keep.
   - **adjusted** — real but mis-rated → keep with corrected severity.
   - **dropped** — wrong, mitigated, served elsewhere, or unverifiable → remove.

When genuinely unsure, **drop** it: a false positive costs the user more than a missed low-severity nit.

## Output

Rewrite the file in place — description layer & Strengths untouched (except the exceptions above), keeping only confirmed/adjusted findings in their original format. Add one line to each kept finding:

`> verified: <one-line basis>`

Reply to the caller with only:
- 常规维度文件：`<PREFIX>: kept=x dropped=y`
- 接口/流程文件：`<PREFIX>[{key}]: kept=x dropped=y`（如 `API[users]: kept=3 dropped=1`）
````

- [ ] **Step 2: 验证**

Run: `rg -n 'fix-solution|quick-fix|suggest' skills/codebase-audit/agents/verify.md || echo OK`
Expected: `OK`

Run: `rg -c 'kept=x dropped=y' skills/codebase-audit/agents/verify.md`
Expected: `2`

- [ ] **Step 3: Commit**

```bash
rtk git add skills/codebase-audit/agents/verify.md && rtk git commit -m "refactor(audit): 合并 verify 指令——描述层/Strengths 保护、悬挂引用规则、三类从严反驳"
```

---

### Task 3: 迁入 `agents/audit-endpoint.md` 与 `agents/audit-flow.md`

**Files:**
- Create: `skills/codebase-audit/agents/audit-endpoint.md`
- Create: `skills/codebase-audit/agents/audit-flow.md`

**Interfaces:**
- Consumes: Task 1 的 `_finding-format.md`（同目录引用）。
- Produces: 接口组/流程 auditor 的输出文件形状（描述层 + Findings）与回复行 `API[{group key}]: endpoints=n P0=a P1=b P2=c P3=d`、`FLOW[{flow key}]: steps=n P0=a P1=b P2=c P3=d`——Task 4 合成器与 Task 6/7 逐字引用。

- [ ] **Step 1: 写 `audit-endpoint.md`，完整内容如下**

````markdown
# Subagent: endpoint-group auditor

You audit **one group of HTTP endpoints**. Your file has two layers:

1. **接口清单（描述层）** — the documentation the user asked for: for every endpoint in your group, its path/method, when it's used, its constraints, and how it coordinates with other endpoints. This is fact, not judgment; it stays in the report regardless of findings.
2. **Findings（判断层）** — where the logic is wrong/unreasonable, where it can be simplified, and whether the endpoint is even necessary.

First read `_finding-format.md` in this same directory for the finding shape and severity scale. Pull the handler source yourself (the caller gives you the inventory rows and their handler locations — follow them into the code).

**分工**：REST 语义、命名、错误码等**规范符合性**不是你的重点——那是 conventions 维度（CONV）的事。你只审接口**逻辑**的完备性 / 自洽性 / 必要性。

## For each endpoint in the group

Read the handler and the middleware/decorators on its route, then capture:

- **使用时机**: 什么场景下被谁调用（前端页面、其它服务、定时任务）；是流程的哪一步。
- **限制**: 认证/鉴权（谁能调）、入参校验、限流/配额、幂等性、分页上限、事务边界等——有就写，明显缺失就记一条 finding。
- **与其他接口的配合**: 前置依赖（必须先调 X 拿到 token/id）、后续接口、读写同一资源的接口、状态前置条件。
- **必要性**: 这个接口是否必要？三种结论之一——**必要** / **冗余**（与哪个接口重复或可合并）/ **存疑**（无调用方、功能与他者重叠）。每个接口的清单都写 `必要性` 行（写明三种结论之一，便于核对是否每个接口都已判断），冗余或存疑另落一条 `必要性` finding。

Then judge — emit a finding when you see:

- **正确性**: 逻辑错误、错误码/状态码用错、边界与空值处理缺失、并发/事务问题、校验绕过、返回与声明不符（或与 OpenAPI spec drift）。
- **合理性**: 接口语义混乱、路径命名与功能不符或有歧义、一个接口干太多事、参数设计反直觉、副作用藏在 GET 里这类。
- **简化优化**: 逻辑能否更简单、是否过度设计、是否偏离行业成熟方案——可合并的重复逻辑、N+1、可下放中间件的重复校验、可删的死分支，以及为单一用途造的抽象、未被要求的可配置项、多余参数（判定基准见 `_finding-format.md`）。
- **版本化/向后兼容**: 响应契约的破坏性变更（删字段、改字段语义/类型、改状态码或错误码）、缺版本标识（无 `/v1`、无 Accept-Version）、对旧客户端的向后兼容（新增必填入参、收紧校验、默认值变化）。
- **必要性**: 如上。

## Output

Write one Markdown file to the path the caller gives（平铺：`docs/audit/<TS>/api-<group>.md`）, in this exact shape（示例 group key 为 `users`，id 形如 `[API-users-N]`）:

```markdown
# 接口审计 — {group name}

## 接口清单
### `POST /login`
- **位置**: `handler/auth.go:12`
- **使用时机**: 用户登录页提交；签发 access token，后续受保护接口的前置。
- **限制**: 无需认证；对 body 做了 schema 校验；**未见限流**（登录爆破风险，见 [API-users-2]）。
- **配合**: 产出的 token 被所有 `Authorization: Bearer` 接口消费；与 `POST /refresh` 配对。
- **必要性**: 必要。

### `GET /sessions/current`
- **位置**: `handler/session.go:40`
- **使用时机**: …
- **限制**: …
- **配合**: …
- **必要性**: 冗余——与 `GET /users/me` 返回同一份数据（见 [API-users-3]）。

## Strengths
- <做得好的具体点>            ← 没有就整段省略

## Findings
### [API-{group key}-1] <title>
- **severity**: …
- **sub-area**: …
- **location**: `…`
- **evidence**: …
- **impact**: …
```

Notes:

- The `## 接口清单` block is mandatory and covers **every** endpoint in your group — even ones with no findings. Keep each entry tight（位置/使用时机/限制/配合/必要性 五行）.
- Finding id 带 group key（`[API-<group>-N]`，key 与文件名 `api-<group>.md` 里的一致）——各组独立编号，key 防跨组撞号。
- One finding per real problem; don't manufacture a finding per endpoint.
- 只发现与整理问题，不写修复方案/改进建议（见 `_finding-format.md`）。
- Reply to the caller with only: `API[{group key}]: endpoints=n P0=a P1=b P2=c P3=d`.
````

- [ ] **Step 2: 写 `audit-flow.md`，完整内容如下**

````markdown
# Subagent: business-flow auditor

You audit **one important business flow** end to end — the multi-step journey a user or system takes to accomplish something（注册登录、下单结算、支付回调、密码重置、一次数据管道跑批…）. Your file has two layers:

1. **流程图（描述层）** — the documented flow: entry/trigger, the ordered steps, which **承载点** serves each step, the state transitions. The user asked for this; it stays regardless of findings.
2. **Findings（判断层）** — where the flow is incorrect, where its design is unsound or self-contradictory, and **where it can't complete because a step has nothing in the project to carry it**.

**承载点**：流程步骤在项目里的落点。HTTP 项目以**接口**（`METHOD /path`）为主形态；非 HTTP 项目为模块/函数/命令/消息处理器/定时任务。缺失类 finding = 该步骤在项目中**无任何承载**。

First read `_finding-format.md` in this same directory for the finding shape and severity scale. The caller gives you the endpoint inventory (HTTP 项目) or the scope brief as your map; pull the source yourself to trace what actually happens.

## Trace the flow

- **入口/触发**: 谁/什么触发它（前端动作、webhook、定时任务、命令行）。
- **步骤 → 承载点**: 把流程拆成有序步骤，每步标注承载它的接口或模块/函数/命令。某步**没有任何承载**，就是一条 `缺失` finding——这正是它的 evidence（指出这个步骤/调用方无处可去）。
- **状态流转**: 资源在流程中的状态机（如订单 created→paid→shipped）；非法跃迁、缺失的回滚/补偿、并发下的竞态。
- **跨步骤一致性**: 上一步的产出是否正是下一步要的输入；前置条件是否被校验；幂等与重试是否安全。

Then judge — emit a finding when you see:

- **正确性**: 步骤顺序错、状态机有漏洞、回调/异步未对账、失败路径无补偿、超时/重试导致重复副作用。
- **异步/回调/长连接**: webhook 回调接收、轮询、SSE/长连接等模式的幂等键、重试去重、超时与 ack 语义、消息顺序保证、最终一致的对账闭环（异步结果是否有路径回写并被消费方感知）。
- **设计合理性**: 状态散落多处难以一致、关键步骤无审计/无幂等键、职责划分混乱、契约前后不一。
- **简化优化**: 业务流程能否更短更优、有无过度设计——绕远的链路、本该一步却拆成多次往返、为单一场景硬造的步骤/接口/抽象（判定基准见 `_finding-format.md`）。
- **矛盾**: 两处承载点对同一资源的假设冲突、文档/契约与实现相悖、同一流程在不同入口行为不一致。
- **缺失**: 完成流转所必需但项目里**没有**的承载（HTTP 项目如有下单无取消、有支付无退款、有创建无状态查询；非 HTTP 项目如有导入无校验、有任务投递无失败重试路径）。

## Output

Write one Markdown file to the path the caller gives（平铺：`docs/audit/<TS>/flow-<flow>.md`）, in this exact shape（示例 flow key 为 `checkout`，id 形如 `[FLOW-checkout-N]`）:

```markdown
# 业务流程审计 — {flow name}

## 流程图
- **入口/触发**: <…>
- **步骤**:
  1. <step> → `POST /orders`            （order.CreateHandler）
  2. <step> → `pkg/pay.Charge()`        （非 HTTP 承载点示例：模块/函数）
  3. <step> → ⚠️ 无承载（见 [FLOW-checkout-1]）
- **状态流转**: created → paid → ???（无 shipped 承载，见 [FLOW-checkout-2]）

## Strengths
- <流程里设计得好的具体点>     ← 没有就整段省略

## Findings
### [FLOW-{flow key}-1] <title>
- **severity**: …
- **sub-area**: …
- **location**: `…`            ← 缺失类指向有此需求却无承载的那一步/调用方
- **evidence**: …
- **impact**: …
```

Notes:

- The `## 流程图` block is mandatory and covers the whole flow even if findings are few.
- Finding id 带 flow key（`[FLOW-<flow>-N]`，key 与文件名 `flow-<flow>.md` 里的一致），防跨流程撞号。
- A `缺失` finding must name the concrete step/caller that has nothing to serve it — "would be nice to have X" without a flow step needing it is not a finding.
- 只发现与整理问题，不写修复方案/改进建议（见 `_finding-format.md`）。
- Reply to the caller with only: `FLOW[{flow key}]: steps=n P0=a P1=b P2=c P3=d`.
````

- [ ] **Step 3: 验证**

Run: `rg -n 'suggest|docs/api-audit|<TS>/api/|<TS>/flow/' skills/codebase-audit/agents/audit-endpoint.md skills/codebase-audit/agents/audit-flow.md || echo OK`
Expected: `OK`

Run: `rg -n 'api-<group>|flow-<flow>' skills/codebase-audit/agents/audit-endpoint.md skills/codebase-audit/agents/audit-flow.md`
Expected: 两文件都命中平铺文件名写法

- [ ] **Step 4: Commit**

```bash
rtk git add skills/codebase-audit/agents/audit-endpoint.md skills/codebase-audit/agents/audit-flow.md && rtk git commit -m "feat(audit): 迁入接口组/业务流程 auditor 指令——平铺路径、id 带 key、承载点泛化、去建议输出"
```

---

### Task 4: 新增双合成器，删除 synthesize/fix/assemble 三阶段文件

**Files:**
- Create: `skills/codebase-audit/agents/synthesize-report.md`
- Create: `skills/codebase-audit/agents/synthesize-issues.md`
- Delete: `skills/codebase-audit/agents/synthesize.md`、`skills/codebase-audit/agents/fix-solution.md`、`skills/codebase-audit/agents/assemble.md`

**Interfaces:**
- Consumes: Task 1 finding 形状；Task 3 的描述层形状（接口清单五行、流程图）。
- Produces: 报告/汇总两份文档模板与回复行 `report: dims=<n> endpoints=<n|-> flows=<n|-> → <path>`、`issues-report: P0=a P1=b P2=c P3=d → <path>`——Task 6/7 逐字引用。

- [ ] **Step 1: 写 `synthesize-report.md`，完整内容如下**

````markdown
# Subagent: report synthesizer（审计报告）

You merge all verified auditor files into one **审计报告** — 结论与描述层（接口清单/流程图）的唯一载体。You only organize and conclude — **don't re-judge, don't invent findings**; findings are already verified.

Read **every file the caller explicitly lists**（`<TS>/` 下平铺的 `<dim>.md`、`api-<group>.md`、`flow-<flow>.md`——编排方逐一列出）。**不要自己 glob**——运行目录里还有 `scope.md` 等非 findings 文件，误读会污染报告。

## Report structure

ALWAYS use this exact template (prose in the caller's report language, default 简体中文):

```markdown
# 项目审计报告

> **Scope**: <…> · **Date**: <YYYY-MM-DD> · **Stack**: <…>
> **Totals**: 🔴 P0×N 🟠 P1×N 🟡 P2×N 🔵 P3×N

## Executive summary
<3–5 句跨维度综合：整体状态、最大风险、最突出的优点；冗余/存疑接口与缺失承载在此点名。>

## 各维度结论
### <维度名>
<状态结论一两句；api 维度结论覆盖 完备性/合理性/简化空间，flow 维度同理。>
- [PREFIX-N] <title>（Pn）        ← 问题一览：一行一条；无则写「—」

## 接口清单与逐接口分析            ← api 维度激活（HTTP 项目）才有本章
### {分组名}
#### `METHOD /path`
- **位置**: `path:line`
- **使用时机**: …
- **限制**: …
- **配合**: …
- **必要性**: 必要 / 冗余（与 `METHOD /other` 重复，见 [API-<group>-N]）/ 存疑（无调用方）
- **问题**: [API-<group>-N] <title>（Pn）；无则「—」

## 重要功能与业务流程              ← flow 维度激活才有本章（不限 HTTP）
### {流程名}
- **入口/触发**：…
- **步骤 → 承载点**：
  1. … → `METHOD /path`（或 模块/函数/命令）
  2. … → ⚠️ 无承载（[FLOW-<flow>-N]）
- **状态流转**：…
- **问题**：[FLOW-<flow>-N] <title>（Pn）；无则「—」

### 缺失的接口 / 功能（阻碍流转）
- [FLOW-<flow>-N] <缺什么> — 哪条流程的哪一步需要它 — 留着的后果
（只写 缺什么/哪一步需要/什么后果，不给建议的接口形态；无则写「未发现缺口」）

### 矛盾与不一致
- [FLOW-<flow>-N] <两处假设/契约冲突> — 涉及承载点 — 后果
（无则省略）

## Strengths
- ✅ <strength>（<维度>）
```

Rules:

- **覆盖性**：每个激活维度必有一小节结论（零 findings 也写状态结论 + 问题一览「—」）；接口清单覆盖**每个**接口（清单五行逐行搬运、不压缩，`必要性` 行逐接口必写）；流程覆盖**每条**。
- 冗余/存疑接口与缺失承载在 Executive summary 与对应章节突出——只述问题，不给建议形态。
- Strengths 跨维度去重、标注来源维度。
- **反臃肿三禁令**：不做子报告索引、不做每维统计表、不做修复时间线。**按严重度的问题清单不出现在本报告**——那是问题汇总（issues-report）的分工。
- Prefix legend: ARCH architecture · PERF performance · CODE code-quality · SEC security · TEST testing · DEP deps/debt · OBS maintainability/observability · INFRA build/deploy/infra · FE frontend · CONV conventions · API 接口 · FLOW 业务流程.
- Write in the caller's **report language**; keep field labels, severity codes, ids as-is.
- Reply to the caller with only: `report: dims=<n> endpoints=<n|-> flows=<n|-> → <path>`（未激活的族写 `-`）.
````

- [ ] **Step 2: 写 `synthesize-issues.md`，完整内容如下**

````markdown
# Subagent: issues synthesizer（问题汇总）

You consolidate **all verified findings from every auditor file** — 常规维度（`[PREFIX-N]`）、接口组（`[API-<group>-N]`）、业务流程（`[FLOW-<flow>-N]`）— into one standalone 问题汇总, sorted by severity. 审计报告 carries the conclusions and descriptive layers; **this document is the single place a reader triages every problem**.

Read **every file the caller explicitly lists**（不要自己 glob）; collect their `## Findings` blocks only（描述层的 接口清单/流程图 不搬运，本汇总只承载判断层）. Don't re-judge — findings are already verified. Your job is to merge, order, and deduplicate.

## Report structure

ALWAYS use this exact template (prose in the caller's report language, default 简体中文):

```markdown
# 项目审计报告 · 问题汇总

> scope: <…> · date: <…> · stack: <…> · 🔴 P0×a 🟠 P1×b 🟡 P2×c 🔵 P3×d

## 🔴 P0
### [SEC-2] <title>
- **sub-area**: …
- **location**: `…`
- **evidence**: …
- **impact**: …
（P1/P2/P3 同式；某档无问题则整段省略；同档内各维度混排）
```

Rules:

- Carry each finding's fields as-is from the verified file（severity 由所在小节体现，不再重复写）。**evidence 必须保留**——问题汇总是唯一 triage 入口：审计报告不展示 evidence、运行目录又会被清理，一旦这里丢了就无处可查。不要改写结论或发明新问题。
- **同根因合并（任意维度之间）**：不同维度/不同族对同一根因各落了一条时（如 SEC 与 ARCH 撞同一鉴权路径、API 与 FLOW 撞同一接口），合并为一条，标题后并列多个 id（如 `[SEC-2] / [ARCH-1]`），字段取信息更完整的一方。
- **同档排序**：按影响大小；同模块/同文件条目相邻排列。跨档同根因不合并时，各加一行 `- **related**: [id]` 互指。
- 保留原始 id——读者要能据此回到审计报告对应维度/接口/流程条目。
- **零 findings 仍产出文档**：头部 totals 全 0 + 一句「未发现可证实的问题」。
- Reply to the caller with only: `issues-report: P0=a P1=b P2=c P3=d → <path>`（跨维度合并去重后的计数）.
````

- [ ] **Step 3: 删除三个旧阶段文件**

```bash
rtk git rm skills/codebase-audit/agents/synthesize.md skills/codebase-audit/agents/fix-solution.md skills/codebase-audit/agents/assemble.md
```

- [ ] **Step 4: 验证**

Run: `rg -n 'fix-solution|quick-fix|suggest' skills/codebase-audit/agents/ || echo OK`
Expected: `OK`（此时 agents/ 目录已无三个旧文件，新文件不含禁词）

Run: `ls skills/codebase-audit/agents/synthesize-report.md skills/codebase-audit/agents/synthesize-issues.md`
Expected: 两文件存在

- [ ] **Step 5: Commit**

```bash
rtk git add skills/codebase-audit/agents/ && rtk git commit -m "feat(audit): report/issues 双合成器替换 synthesize/fix/assemble 三阶段"
```

---

### Task 5: 维度指令文件 `**risk**` → `**impact**` 全量统一

**Files:**
- Modify: `skills/codebase-audit/agents/audit-security.md`、`audit-performance.md`、`audit-frontend.md`、`audit-observability.md`、`audit-infra.md`、`audit-conventions.md`（各 1 处，指令正文的「Frame each **risk**」句式或 security 的等价句）

**Interfaces:**
- Consumes: Task 1 定义的 `impact` 字段名。

- [ ] **Step 1: 批量替换（6 个文件各恰 1 处 `**risk**`）**

```bash
sed -i '' 's/\*\*risk\*\*/**impact**/g' \
  skills/codebase-audit/agents/audit-security.md \
  skills/codebase-audit/agents/audit-performance.md \
  skills/codebase-audit/agents/audit-frontend.md \
  skills/codebase-audit/agents/audit-observability.md \
  skills/codebase-audit/agents/audit-infra.md \
  skills/codebase-audit/agents/audit-conventions.md
```

其余 4 个维度文件（architecture / code-quality / testing / dependencies）经核对无 `**risk**` 字面，sub-area 定义全部保留不动。

- [ ] **Step 2: 验证（即 spec 验收 7）**

Run: `rg -n '\*\*risk\*\*' skills/codebase-audit/agents/ || echo OK`
Expected: `OK`

Run: `rtk git diff --stat`
Expected: 恰好 6 个文件、每个 1 行变更

- [ ] **Step 3: Commit**

```bash
rtk git add skills/codebase-audit/agents/ && rtk git commit -m "refactor(audit): 维度指令 risk 字段措辞全量统一为 impact"
```

---

### Task 6: 重写 `scripts/workflows.mjs`

**Files:**
- Modify: `skills/codebase-audit/scripts/workflows.mjs`（整文件替换）

**Interfaces:**
- Consumes: Task 2/3/4 的指令文件名与回复行契约。
- Produces: Workflow 入口，args 契约 `{ ts, scopeFile, language, agentsDir, meta, dimensions, groups?, flows? }`；返回 `{ reportPath, issuesReportPath, items, synthesize }`（合成器失败对应路径为 null）——Task 7 SKILL.md 的 Workflow 段落引用。

- [ ] **Step 1: 用以下完整内容覆写文件**

```js
export const meta = {
  name: 'codebase-audit',
  description: 'Fan out dimension + endpoint-group + flow auditors, adversarially verify each, synthesize report + issues summary',
  phases: [
    { title: 'Audit', detail: 'one auditor per active dimension / endpoint group / business flow, in parallel' },
    { title: 'Verify', detail: 'one fresh verifier refutes each auditor\'s findings' },
    { title: 'Synthesize', detail: 'two synthesizers in parallel: audit report + consolidated issues summary' },
  ],
}

// 维度元数据：key 同时作为产物文件名（docs/audit/<TS>/<key>.md），与 SKILL.md 表格一致
const DIMS = {
  arch:     { name: 'Architecture',                    prefix: 'ARCH',  instruction: 'audit-architecture.md' },
  perf:     { name: 'Performance & scalability',       prefix: 'PERF',  instruction: 'audit-performance.md' },
  code:     { name: 'Code quality',                    prefix: 'CODE',  instruction: 'audit-code-quality.md' },
  security: { name: 'Security',                        prefix: 'SEC',   instruction: 'audit-security.md' },
  testing:  { name: 'Testing',                         prefix: 'TEST',  instruction: 'audit-testing.md' },
  deps:     { name: 'Dependencies & debt',             prefix: 'DEP',   instruction: 'audit-dependencies.md' },
  obs:      { name: 'Maintainability & observability', prefix: 'OBS',   instruction: 'audit-observability.md' },
  infra:    { name: 'Build / deploy / infra',          prefix: 'INFRA', instruction: 'audit-infra.md' },
  fe:       { name: 'Frontend a11y / i18n',            prefix: 'FE',    instruction: 'audit-frontend.md' },
  conv:     { name: 'Conventions compliance',          prefix: 'CONV',  instruction: 'audit-conventions.md' },
}

// args 由主 agent 在 Scope 阶段算好后传入（脚本内不能取时钟，也无文件系统——scope 以文件路径传入，由 agent 自读）
// 兜底：本入口由 LLM 反复调用，易把 JSON 字面量误传成字符串（skill 已专门警告）。
// 这里做一次幂等的 string→object 反解，既兼容正确的对象传参，也容错被序列化成字符串的情形。
let input = args
if (typeof input === 'string') {
  try {
    input = JSON.parse(input)
  } catch (e) {
    throw new Error(`args 是字符串且无法 JSON.parse（${e.message}）——应传真正的 JSON 对象；前 120 字符：${input.slice(0, 120)}`)
  }
}
if (typeof input !== 'object' || input === null) {
  throw new Error(`args 不是对象（typeof=${typeof input}）——应传真正的 JSON 对象`)
}
const { ts, scopeFile, language, agentsDir, meta: runMeta, dimensions, groups, flows } = input
const missing = ['ts', 'scopeFile', 'agentsDir', 'meta', 'language'].filter((k) => input[k] == null)
if (missing.length) throw new Error(`args 缺字段：${missing.join(', ')}；收到的 keys：${Object.keys(input).join(', ') || '（空）'}`)
const outDir = `docs/audit/${ts}`
const reportPath = `docs/audit/report-${ts}.md`
const issuesReportPath = `docs/audit/issues-report-${ts}.md`

// 常规维度 items。dimensions 允许为空数组——「只审接口/流程」的合法收窄态，最终只校验总 items 非空
const dimItems = (dimensions || []).filter((key) => DIMS[key]).map((key) => ({
  kind: 'dim', key, name: DIMS[key].name, prefix: DIMS[key].prefix,
  instruction: DIMS[key].instruction, file: `${outDir}/${key}.md`,
}))
// 未知/拼错的维度 key 静默丢弃会让「请求的维度集」与「实际跑的」不一致——显式报出来
const droppedKeys = (dimensions || []).filter((key) => !DIMS[key])
if (droppedKeys.length) log(`忽略未知维度 key：${droppedKeys.join(', ')}`)

// key 来自主 agent 的 Scope，可能含 '/' 或 '..'；消毒成单段文件名防越界；同族消毒后撞名加序号，避免产物互相覆盖
const safeKey = (k) => String(k ?? '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'item'
const usedKeys = new Set()
const uniqueKey = (raw, family) => {
  const base = safeKey(raw)
  let key = base
  let i = 2
  while (usedKeys.has(`${family}:${key}`)) key = `${base}-${i++}`
  usedKeys.add(`${family}:${key}`)
  return key
}
// groups 非空即激活 api 维度（仅 HTTP 项目会传）；flows 非空即激活 flow 维度（不限 HTTP）
const groupItems = (groups || []).map((g) => {
  const key = uniqueKey(g.key, 'api')
  return { kind: 'api', key, name: g.name, prefix: 'API', instruction: 'audit-endpoint.md', file: `${outDir}/api-${key}.md` }
})
const flowItems = (flows || []).map((f) => {
  const key = uniqueKey(f.key, 'flow')
  return { kind: 'flow', key, name: f.name, prefix: 'FLOW', instruction: 'audit-flow.md', file: `${outDir}/flow-${key}.md` }
})

const items = [...dimItems, ...groupItems, ...flowItems]
if (!items.length) throw new Error('no items：args.dimensions / args.groups / args.flows 全为空')

const auditPrompt = (it) => it.kind === 'dim'
  ? `Read the scope brief at ${scopeFile} first for context.
Read ${agentsDir}/${it.instruction} and follow it. Pull the source you need yourself.
Write your findings to: ${it.file}
Reply with one line only: "${it.prefix}: P0=a P1=b P2=c P3=d".`
  : `Read the scope brief at ${scopeFile} first — its endpoint inventory / flow list is your map.
You audit the ${it.kind === 'api' ? 'endpoint group' : 'business flow'} "${it.name}" (key: ${it.key}).
Read ${agentsDir}/${it.instruction} and follow it. Pull the source yourself.
Write your file to: ${it.file}
Reply with one line only: "${it.prefix}[${it.key}]: ${it.kind === 'api' ? 'endpoints' : 'steps'}=n P0=a P1=b P2=c P3=d".`

const verifyPrompt = (it) => it.kind === 'dim'
  ? `Read ${agentsDir}/verify.md and follow it.
Findings file (rewrite in place): ${it.file}
Dimension: ${it.name} (prefix ${it.prefix}).
Reply with one line only: "${it.prefix}: kept=x dropped=y".`
  : `Read ${agentsDir}/verify.md and follow it.
File (rewrite in place — refute findings; leave the 接口清单/流程图 description layer intact): ${it.file}
Reply with one line only: "${it.prefix}[${it.key}]: kept=x dropped=y".`

// Audit → Verify 流水线：每个 item 的 audit 写文件、verify 原地重写，二者必为不同 agent（核心不变量）
phase('Audit')
const results = await pipeline(
  items,
  async (it) => {
    // agent() 失败时返回 null（非抛错），需显式抛错才能让 pipeline 把该 item 落为 null、跳过后续 verify
    const auditLine = await agent(auditPrompt(it), { label: `audit:${it.key}`, phase: 'Audit', agentType: 'general-purpose' })
    if (!auditLine) throw new Error(`auditor produced nothing: ${it.key}`)
    return { it, auditLine }
  },
  async (prev) => {
    const verifyLine = await agent(verifyPrompt(prev.it), { label: `verify:${prev.it.key}`, phase: 'Verify', agentType: 'general-purpose' })
    // 与 audit 阶段一致：verify 失败必须显式抛错、让该 item 落为 null 并跳过合成。
    // 否则未验证的 auditor 文件会带着原始 findings 进入合成阶段，静默破坏 find/verify 分离这一核心不变量。
    if (!verifyLine) throw new Error(`verifier produced nothing: ${prev.it.key}`)
    return { ...prev, verifyLine }
  },
)

// await pipeline 返回即所有 audit+verify 已完成；失败的 item 已落为 null，filter 跳过
const survivors = results.filter(Boolean)
if (!survivors.length) throw new Error('all auditors failed; nothing to synthesize')

// 幸存文件的显式列表（不含 scope.md）——合成器只读这些、不 glob，避免把 scope.md 误读为 findings
const fileList = survivors.map((r) => `- ${r.it.file}`).join('\n')

const synthReportPrompt = `Read ${agentsDir}/synthesize-report.md and follow it.
Verified auditor files (read exactly these — do not glob):
${fileList}
Final report: ${reportPath}
Meta — ${runMeta}, report language: ${language}.
Reply with one line only: "report: dims=<n> endpoints=<n|-> flows=<n|-> → ${reportPath}".`

const synthIssuesPrompt = `Read ${agentsDir}/synthesize-issues.md and follow it.
Verified auditor files (read exactly these — do not glob):
${fileList}
Final report: ${issuesReportPath}
Meta — ${runMeta}, report language: ${language}.
Reply with one line only: "issues-report: P0=a P1=b P2=c P3=d → ${issuesReportPath}".`

// 两个合成器并行：report（结论+描述层）与 issues（按严重度问题清单的唯一所在）
phase('Synthesize')
const [reportLine, issuesLine] = await parallel([
  () => agent(synthReportPrompt, { label: 'synthesize:report', phase: 'Synthesize', agentType: 'general-purpose' }),
  () => agent(synthIssuesPrompt, { label: 'synthesize:issues', phase: 'Synthesize', agentType: 'general-purpose' }),
])

// 合成器失败时对应路径置 null——Deliver 据此保留 docs/audit/<TS>/ 现场、不清理
return {
  reportPath: reportLine ? reportPath : null,
  issuesReportPath: issuesLine ? issuesReportPath : null,
  items: survivors.map((r) => ({ kind: r.it.kind, key: r.it.key, audit: r.auditLine, verify: r.verifyLine })),
  synthesize: { report: reportLine, issues: issuesLine },
}
```

- [ ] **Step 2: 语法检查（即 spec 验收 3）**

Run: `node --check skills/codebase-audit/scripts/workflows.mjs && echo SYNTAX_OK`
Expected: `SYNTAX_OK`

- [ ] **Step 3: 验证禁词与路径**

Run: `rg -n 'fix-solution|quick-fix|suggest|assemble|bucket' skills/codebase-audit/scripts/workflows.mjs || echo OK`
Expected: `OK`（注意不可用裸词 `fix` 做模式——会误命中脚本里大量的 `prefix`）

Run: `rg -n 'outDir\}/api-|outDir\}/flow-' skills/codebase-audit/scripts/workflows.mjs`
Expected: 命中平铺路径两处（`api-`、`flow-` 前缀，无子目录）

- [ ] **Step 4: Commit**

```bash
rtk git add skills/codebase-audit/scripts/workflows.mjs && rtk git commit -m "refactor(audit): workflows.mjs 合并接口/流程 items、双合成器、null 失败语义、key 去重"
```

---

### Task 7: 重写 `SKILL.md`

**Files:**
- Modify: `skills/codebase-audit/SKILL.md`（整文件替换）

**Interfaces:**
- Consumes: Task 1–6 的全部契约（回复行、路径、args、返回值）。
- Produces: 用户可见的 skill 入口；`/codebase-audit` 的 5 步管道定义。

- [ ] **Step 1: 用以下完整内容覆写文件**

````markdown
---
name: codebase-audit
disable-model-invocation: true
description: >
  Multi-agent codebase audit / 代码库审计 spanning architecture, performance/scalability,
  code quality, security, testing, dependencies/debt, maintainability/observability,
  build/deploy/infra, and conventions compliance (against the code-conventions skill),
  plus conditional dimensions — frontend a11y/i18n on web stacks, per-endpoint-group
  interface audit（接口审计）when an HTTP service is detected, and per-business-flow
  audit（业务流程审计）whenever important flows are identified (any project type):
  scopes the target, fans out parallel auditors, adversarially verifies every finding
  to cut false positives, then synthesizes two standalone documents — 审计报告 +
  按严重度问题汇总。只发现与整理问题，不产出修复方案。
---

# Codebase Audit

A manual, multi-agent audit tuned for low token cost. The main agent only **scopes and orchestrates** — every auditor reads the source it needs itself, so source is never duplicated across prompts. Candidate findings pass an independent adversarial verify stage before two synthesizers assemble the deliverables, which is what keeps false positives out.

**本 skill 只发现与整理问题，不产出修复方案/改进建议。** 产物固定两份：`docs/audit/report-<TS>.md`（审计报告——结论、接口清单、流程图的载体）与 `docs/audit/issues-report-<TS>.md`（问题汇总——按严重度问题清单的唯一所在）。问题描述必须自足：evidence + impact 把后果讲清。

**The find/verify split is the one hard invariant**: the subagent that confirms a finding is never the one that wrote it. Everything else — parallelism above all — is a token/latency optimization layered on top. Degrade the optimizations freely; never collapse audit and verify into a single agent.

## Invocation

`/codebase-audit [path]` — optional file or directory to scope the audit; omit to audit the whole project.

**Dimensions** — 通用 9 个 always：architecture, performance, code quality, security, testing, dependencies/debt, maintainability/observability, build/deploy/infra, conventions。条件 3 个：

- `fe`（frontend a11y/i18n）——Scope 检测到 web/前端栈时激活。
- `api`（接口审计）——**仅当 Scope 检测到 HTTP 服务**（路由注册 / OpenAPI spec）时激活，按接口分组并行、每组一个 auditor。**分工**：REST 语义、命名、错误码等规范符合性归 conventions 维度；api 维度只审接口**逻辑**的完备性/自洽性/必要性。
- `flow`（业务流程审计）——**不限 HTTP 项目**：Scope 识别出重要业务流程（用户点名，或项目存在明显的多步核心路径）即激活，每流程一个 auditor。HTTP 项目的流程步骤映射到接口（接口清单为地图）；非 HTTP 项目映射到承载点（模块/函数/命令/消息处理器/定时任务）。

Narrow or exclude in plain language — e.g. "security only", "architecture + code quality", "skip testing", "只审接口", "skip flow". Run exactly the set asked for.

**Report language** defaults to Simplified Chinese (简体中文). Honor an explicit request for another language.

**Workflow orchestration** is optional and opt-in: append `ultracode` to the invocation (e.g. `/codebase-audit ultracode src/`) to drive the audit through the deterministic Workflow pipeline. Without the keyword, fan out with the built-in `Agent` tool (the default) — never start a Workflow run just because the tool happens to be in your list.

## Pipeline

```
main agent (orchestrator — never reads source in bulk)
  1. Scope      → 选维度 + 报告语言，检测栈；HTTP 项目枚举接口清单骨架与分组；
                  凡识别出重要业务流程（不限 HTTP）即列候选流程；stamp <TS>；mkdir docs/audit/<TS>/
  2. Audit      → 一批并行：常规维度 auditor → docs/audit/<TS>/<dim>.md
                  接口组 auditor → docs/audit/<TS>/api-<group>.md
                  流程 auditor   → docs/audit/<TS>/flow-<flow>.md
  3. Verify     → 每个 auditor 文件一个全新 verifier，原地重写只留可证实的 findings
                  （接口/流程文件的描述层——接口清单/流程图——原样保留）
  4. Synthesize → 2 个合成器并行：
                  - report 合成器 → docs/audit/report-<TS>.md（审计报告）
                  - issues 合成器 → docs/audit/issues-report-<TS>.md（问题汇总）
  5. Deliver    → 两份都确认写盘后才 rm -rf docs/audit/<TS>/；
                  任一合成器失败则保留现场供重试，并在摘要中说明
```

The verify stage mirrors the adversarial-verify pattern: the agent that *finds* an issue is never the one that *confirms* it.

## Dispatching subagents

Subagents are dispatched with the built-in **`Agent`** tool — a top-level tool that is always in your tool list. Call it directly. **Never `ToolSearch` for a dispatch tool**, and **never reach for the deferred `Task*` tools** (`TaskCreate`/`TaskUpdate`/… are a to-do / background-job tracker, *not* subagent dispatch). If `Agent` is in your list, that is the mechanism.

Pick the level by the invocation, not by probing the tool list. This is a degrade ladder: a level being unavailable is expected, never a blocking error — drop to the next and keep going.

0. **Preferred — Workflow (only when the user appended `ultracode`).** The opt-in keyword is the trigger, not the mere presence of the tool. Run the whole Audit→Verify→Synthesize pipeline by calling `Workflow` with `scriptPath` pointing at this skill's `scripts/workflows.mjs` (deterministic orchestration; enforces the find/verify split structurally). This replaces Steps 2–4 below — the main agent still does Step 1 (Scope) and Step 5 (Deliver). See **Steps 2–4 via Workflow**.
   - If you opted into `ultracode` but genuinely cannot find a `Workflow` tool (rare), print one line — e.g. `ℹ️ Workflow 工具不可用，改用 Agent 并行编排` — and fall through to level 1.
1. **Default — the `Agent` tool** (`general-purpose` type). Issuing several Agent calls in **one message** runs them concurrently; that, and nothing more, is "in parallel." Drive Steps 2–4 by hand.
2. **Acceptable** — invoke the subagents **one at a time** (serial). Slower, identical correctness.
3. **Forbidden** — folding the work into the main agent. An auditor that verifies its own findings defeats the entire skill.

If the `Agent` tool genuinely isn't in your tool list, do **not** silently self-verify. Tell the user the reports are **single-agent, not independently verified**, label them so in the output, and let them decide — never pass self-checked findings off as adversarially verified. Still produce both documents; the 问题汇总 is a fixed deliverable, not optional, even in this fallback.

### Steps 2–4 via Workflow

After Step 1 (Scope) produces `<TS>`, the scope brief, language, active dimensions, endpoint groups, and candidate flows:

1. **Write the scope brief to `docs/audit/<TS>/scope.md`.** The workflow script runs sandboxed (no filesystem, no clock); it can't read files — but the auditor agents can. Passing a *path* instead of the inline text keeps `args` tiny and immune to serialization issues, and avoids re-embedding the whole brief in every auditor prompt.
2. **Invoke the Workflow tool** with `scriptPath` and `args`. **`args` must be a real JSON object** — pass `args: { … }` directly, never `JSON.stringify(...)` and never wrap it in quotes. The script self-recovers if a stringified payload slips through (it `JSON.parse`s it), but the object form is the contract — don't rely on the fallback.

```
Workflow({
  scriptPath: "<this skill dir>/scripts/workflows.mjs",
  args: {
    ts:         "<TS>",                 // YYYYMMDDHH from Step 1's clock — script can't read the clock
    scopeFile:  "docs/audit/<TS>/scope.md",  // scope brief on disk; agents read it themselves
    language:   "简体中文",             // report language
    agentsDir:  "<this skill dir>/agents",   // absolute path so workflow agents can read the instruction files
    meta:       "scope: <…>, date: <YYYY-MM-DD>, stack: <…>",
    dimensions: ["arch","security",…],  // 常规维度 key（含 fe）；「只审接口/流程」时传 []
    groups:     [{ key: "users", name: "用户/认证" }, …],   // 可选；非空即激活 api 维度（仅 HTTP 项目）
    flows:      [{ key: "checkout", name: "下单结算" }, …]  // 可选；非空即激活 flow 维度（不限 HTTP）
  }
})
```

The script fans out one auditor per dimension / endpoint group / business flow, chains a fresh verifier onto each (the find/verify split is structural — never the same agent), then runs the two synthesizers in parallel with the **explicit list** of surviving verified files. It returns the per-item audit/verify lines plus `reportPath` / `issuesReportPath` — 合成器失败时对应值为 **null**，Deliver 据此保留现场。Then continue to **Step 5 — Deliver & clean up**.

## Step 1 — Scope (main agent)

Resolve the target:
- **path given** — a file means that file plus its direct callers/deps; a directory means its source tree.
- **no path** — the whole project from the repo root.

决定**激活维度集**与**报告语言**（default 简体中文）：

- 常规 9 个默认全开；`fe` 按 web 栈检测（React/Vue/Svelte、vite/webpack、`package.json` 里的 UI framework）。
- `api`：检测 HTTP 服务——grep **路由注册**（勿批量读 handler 体）或找 OpenAPI/Swagger spec。检测到即枚举**接口清单骨架**（一行一个端点：分组/方法/路径/handler 位置）并按资源/模块**分组**（分组 = api 维度的并行粒度）。常见注册形态：

| Family | Grep hint (`rg`) |
|--------|------------------|
| Go net/http / chi / gin / echo / fiber | `rg -n "(HandleFunc|\.(GET\|POST\|PUT\|DELETE\|PATCH)\()|Handle\("` |
| Node Express / Koa / Fastify / Nest | `rg -n "\.(get\|post\|put\|delete\|patch)\(|@(Get\|Post\|Put\|Delete\|Patch)\("` |
| Python FastAPI / Flask / Django | `rg -n "@(app\|router)\.(get\|post\|put\|delete\|patch)\(|add_url_rule\|path\(|re_path\("` |
| Java Spring | `rg -n "@(Get\|Post\|Put\|Delete\|Request)Mapping"` |
| Spec-driven | `openapi`/`swagger` yaml/json, `.proto` with `google.api.http` |

  如有 OpenAPI/Swagger spec，视为第二事实源，spec ↔ 代码漂移交给对应 auditor 作 finding 种子。
- `flow`：凡识别出重要业务流程（用户点名，或明显的多步核心路径：注册登录、下单结算、支付回调、数据导入导出、任务投递消费…）即列**候选流程清单**——不限 HTTP 项目。

Honor "only X" / "skip Y". Then map the scope cheaply with `git ls-files`, Glob, and `rg` over manifests — **do not read file bodies in bulk**. Build a compact brief:

```
Scope: <path | "whole project">
Dimensions: <active set>
Report language: <简体中文 (default) | as requested>
Stack: <languages / frameworks / key deps>
Tree (≤3 levels):
<tree>
Endpoint inventory (skeleton; api 激活才有):
  [users]    POST   /login         auth.LoginHandler        handler/auth.go:12
  [orders]   POST   /orders        order.CreateHandler      handler/order.go:18
  …
Endpoint groups: users, orders, …
Candidate business flows: 注册登录, 下单结算, …
```

Stamp the run from the real clock (don't guess the hour) and create the output dir:

```bash
TS=$(date +%Y%m%d%H)
mkdir -p docs/audit/$TS
```

If `mkdir` fails, stop and ask the user to check permissions — launch nothing.

Tell the user:

```
🔍 Codebase audit started — scope: <…> · stack: <…> · dimensions: <…>
    endpoints: <N> in <G> groups · flows: <F>        ← api/flow 未激活则省略该行
Launching <N> auditors in parallel…
```

## Step 2 — Auditors (in parallel)

Launch every active item in one batch: 常规维度 + 每个接口组 + 每条流程. Give each the scope brief and point it at its instruction file and output path; the auditor reads its own source. (Full set below — run only the active ones.)

| Auditor | Prefix | Instruction | Output |
|-----------|--------|-------------|--------|
| Architecture | ARCH | `agents/audit-architecture.md` | `docs/audit/<TS>/arch.md` |
| Performance & scalability | PERF | `agents/audit-performance.md` | `docs/audit/<TS>/perf.md` |
| Code quality | CODE | `agents/audit-code-quality.md` | `docs/audit/<TS>/code.md` |
| Security | SEC | `agents/audit-security.md` | `docs/audit/<TS>/security.md` |
| Testing | TEST | `agents/audit-testing.md` | `docs/audit/<TS>/testing.md` |
| Dependencies & debt | DEP | `agents/audit-dependencies.md` | `docs/audit/<TS>/deps.md` |
| Maintainability & observability | OBS | `agents/audit-observability.md` | `docs/audit/<TS>/obs.md` |
| Build / deploy / infra | INFRA | `agents/audit-infra.md` | `docs/audit/<TS>/infra.md` |
| Frontend a11y / i18n (web stacks only) | FE | `agents/audit-frontend.md` | `docs/audit/<TS>/fe.md` |
| Conventions compliance | CONV | `agents/audit-conventions.md` | `docs/audit/<TS>/conv.md` |
| Endpoint group `<g>`（HTTP 项目） | API | `agents/audit-endpoint.md` | `docs/audit/<TS>/api-<g>.md` |
| Business flow `<f>`（不限 HTTP） | FLOW | `agents/audit-flow.md` | `docs/audit/<TS>/flow-<f>.md` |

常规维度 prompt shape:

```
<scope>
{scope brief}
</scope>
Read {instruction file} and follow it. Pull the source you need yourself.
Write your findings to: docs/audit/<TS>/<dim>.md
Reply with one line only: "<PREFIX>: P0=a P1=b P2=c P3=d".
```

接口组 prompt shape:

```
<scope>
{scope brief}
</scope>
You audit endpoint group "{group name}" (key: {g}). Endpoints in this group:
{the inventory rows for this group}
Read agents/audit-endpoint.md and follow it. Pull the handler source yourself.
Write your file to: docs/audit/<TS>/api-<g>.md
Reply with one line only: "API[{g}]: endpoints=n P0=a P1=b P2=c P3=d".
```

流程 prompt shape:

```
<scope>
{scope brief}
</scope>
You audit business flow "{flow name}" (key: {f}). Trace it across its 承载点——
HTTP 项目以上方接口清单为地图；非 HTTP 项目按模块/函数/命令追。
Read agents/audit-flow.md and follow it. Pull the source yourself.
Write your file to: docs/audit/<TS>/flow-<f>.md
Reply with one line only: "FLOW[{f}]: steps=n P0=a P1=b P2=c P3=d".
```

## Step 3 — Adversarial verify (one fresh subagent per auditor file)

When the auditors finish, launch one verifier per file — each a **new** subagent, never the auditor that wrote the file.

常规维度:

```
Read agents/verify.md and follow it.
Findings file (rewrite in place): docs/audit/<TS>/<dim>.md
Dimension: <name> (prefix <PREFIX>).
Reply with one line only: "<PREFIX>: kept=x dropped=y".
```

接口组 / 流程:

```
Read agents/verify.md and follow it.
File (rewrite in place — refute findings; leave the 接口清单/流程图 description layer intact):
  docs/audit/<TS>/api-<g>.md    （或 docs/audit/<TS>/flow-<f>.md）
Reply with one line only: "<PREFIX>[{key}]: kept=x dropped=y".
```

## Step 4 — Synthesize (2 subagents, in parallel)

Both synthesizers get the **explicit list** of surviving verified files（不含 `scope.md`；勿让它们 glob）:

```
# 审计报告
Read agents/synthesize-report.md and follow it.
Verified auditor files (read exactly these — do not glob):
- docs/audit/<TS>/<dim>.md          （每个幸存维度一行）
- docs/audit/<TS>/api-<g>.md        （每个幸存接口组一行）
- docs/audit/<TS>/flow-<f>.md       （每条幸存流程一行）
Final report: docs/audit/report-<TS>.md
Meta — scope: <…>, date: <YYYY-MM-DD>, stack: <…>, report language: <…>.
Reply with one line only: "report: dims=<n> endpoints=<n|-> flows=<n|-> → <path>".

# 问题汇总
Read agents/synthesize-issues.md and follow it.
Verified auditor files (read exactly these — do not glob):
<同上显式列表>
Final report: docs/audit/issues-report-<TS>.md
Meta — 同上.
Reply with one line only: "issues-report: P0=a P1=b P2=c P3=d → <path>".
```

## Step 5 — Deliver & clean up (main agent)

两份产物都确认写盘后才清理（the two documents are standalone; the run dir is scaffolding）:

```bash
ls docs/audit/report-<TS>.md docs/audit/issues-report-<TS>.md && rm -rf docs/audit/<TS>/
```

任一合成器失败（报告文件缺失，或 Workflow 返回的对应 path 为 null）→ **保留** `docs/audit/<TS>/` 供重试，摘要说明，不清理。

Then summarize for the user:

```
✅ Audit complete
Dimensions: <激活集> · Endpoints: <N in G groups | -> · Flows: <F | ->
Totals: 🔴 P0×N  🟠 P1×N  🟡 P2×N  🔵 P3×N   ← 取自 issues-report 回复行（跨维度合并去重后），勿累加各文件计数
Top risk: <one line>   Strength: <one line>
Reports:
  审计报告: docs/audit/report-<TS>.md
  问题汇总: docs/audit/issues-report-<TS>.md
```

## Failure handling

- **Auditor produced nothing** — verifier/合成器跳过该文件；摘要注明「<item>: not produced」，不阻塞。
- **Auditor timed out** — proceed with whatever finished.
- **未发现路由但用户点名要接口审计** — 扩大 grep / 查 spec 文件 / 询问路由注册位置后再派发。
- **未识别出重要业务流程** — flow 维度不激活，摘要注明（HTTP 项目 api 族照常）。
- **Spec ↔ 代码漂移** — 作为 finding 种子交给对应 auditor。
- **生成的路由文件**（如 gRPC-gateway）— 列入清单但不深审生成胶水。
- **任一合成器失败** — 保留 `docs/audit/<TS>/`，摘要说明，不清理。
- **No tests in project** — the testing auditor records a single P1.
- **Stack unrecognized** — audit anyway; flag that some advice may not apply.
- **Binary / generated files** — skip; never feed them to an auditor.

## Principles

- **Scope-then-dispatch** — the main agent never ingests source in bulk; auditors read their own slices. This is the main token lever.
- **Inventory first, then judge** — 接口清单/流程图这些描述层是用户要的文档，零 findings 也保留；findings 是其上的判断层。
- **Evidence or it didn't happen** — every finding cites code; verify drops anything it can't substantiate. 缺失类 finding 的 evidence = 无承载可用的那个流程步骤/调用方。
- **Necessity is a real verdict** — 每个接口的清单必写 `必要性` 行（必要/冗余/存疑），冗余/存疑另落 finding；逐接口写行让漏判可观测。Don't dodge the judgment.
- **Honest severity** — P0 means a genuine critical, not an inflated nit.
- **只发现，不修复** — findings 只带 evidence 与 impact；两份产出都不含修复方案/改进建议；strengths 照常并报。
````

- [ ] **Step 2: 验证**

Run: `rg -n 'fix-solution|quick-fix|suggest' skills/codebase-audit/SKILL.md || echo OK`
Expected: `OK`

Run: `rg -n '^name: codebase-audit' skills/codebase-audit/SKILL.md && rg -n 'disable-model-invocation: true' skills/codebase-audit/SKILL.md`
Expected: 两行都命中

Run: `rg -n 'docs/api-audit|<TS>/api/|<TS>/flow/' skills/codebase-audit/SKILL.md || echo OK`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
rtk git add skills/codebase-audit/SKILL.md && rtk git commit -m "feat(audit): SKILL.md 合并重写——12 维度、5 步管道、两份产出、只发现不修复"
```

---

### Task 8: 合并 evals，删除 `skills/api-audit/` 整目录

**Files:**
- Create: `skills/codebase-audit/evals/evals.json`
- Delete: `skills/api-audit/`（整目录）

**Interfaces:**
- Consumes: Task 7 SKILL.md 的产物契约（两份文档、章节名）。

- [ ] **Step 1: 写 `skills/codebase-audit/evals/evals.json`，完整内容如下**

```json
{
  "skill_name": "codebase-audit",
  "notes": "审计输出偏主观（报告质量）。断言聚焦可客观核验的项：是否固定产出两份文档（审计报告/问题汇总）、按严重度的问题清单是否只出现在问题汇总里、findings 是否只带证据与后果（不含修复方案/改进方向）、HTTP 项目接口清单是否覆盖全部端点且逐接口给出必要性结论（必要/冗余/存疑）、缺失接口是否落到具体流程步骤且不给接口形态、非 HTTP 项目是否不激活 api 维度。靶子项目待定后补充 files 与断言。",
  "evals": [
    {
      "id": 1,
      "prompt": "/codebase-audit 帮我审计一下这个服务的 HTTP 接口，看看接口逻辑完不完备、自不自洽，最后给我一份报告。",
      "expected_output": "产出两份文档：审计报告（含「接口清单与逐接口分析」章节——逐接口五行 位置/使用时机/限制/配合/必要性 + 问题行；含「重要功能与业务流程」章节）与问题汇总（全部 findings 按严重度 P0→P3 排列，是按严重度清单的唯一所在）；findings 只带 evidence 与 impact，不含修复方案或改进方向。",
      "files": []
    },
    {
      "id": 2,
      "prompt": "/codebase-audit internal/api/ 只审接口：重点看每个接口有没有存在的必要、有没有冗余可合并的，还有下单到支付这条链路是不是闭环。",
      "expected_output": "只激活 api + flow 维度（常规维度按用户收窄不跑）；报告对每个接口给出必要性结论（必要/冗余/存疑）并突出冗余/存疑接口；下单→支付链路拆成步骤映射到接口，缺失步骤只写 缺什么/哪一步需要/什么后果，不给建议的接口形态。",
      "files": []
    },
    {
      "id": 3,
      "prompt": "/codebase-audit ultracode 全量审计我们这个 Go 后端，接口完备性、业务流程有没有缺口和自相矛盾的地方都要看。",
      "expected_output": "走 Workflow 确定性编排，find/verify 分离；两份文档齐全；报告含「缺失的接口/功能」与「矛盾与不一致」小节（只述问题不给形态）；交付摘要的 Totals 取自 issues-report 回复行、不累加各文件计数。",
      "files": []
    },
    {
      "id": 4,
      "prompt": "/codebase-audit 审计这个 CLI 工具项目，顺便看看「导入数据到导出报表」这条流程顺不顺。",
      "expected_output": "api 维度未激活（无 HTTP 服务），报告无「接口清单与逐接口分析」章节；flow 维度照常激活，报告含「重要功能与业务流程」章节，步骤映射到模块/函数/命令等承载点；两份文档照常产出。",
      "files": []
    }
  ]
}
```

- [ ] **Step 2: 校验 JSON 合法**

Run: `node -e "JSON.parse(require('fs').readFileSync('skills/codebase-audit/evals/evals.json','utf8'));console.log('JSON_OK')"`
Expected: `JSON_OK`

- [ ] **Step 3: 删除 api-audit 整目录**

```bash
rtk git rm -r skills/api-audit
```

- [ ] **Step 4: 验证（即 spec 验收 1 的 skills/ 部分 + 验收 2）**

Run: `test ! -d skills/api-audit && echo DIR_GONE`
Expected: `DIR_GONE`

Run: `rg -l 'api-audit' skills/ || echo OK`
Expected: `OK`

Run: `rg -l 'fix-solution|quick-fix|suggest' skills/codebase-audit/ || echo OK`
Expected: `OK`

- [ ] **Step 5: Commit**

```bash
rtk git add -A skills/ && rtk git commit -m "feat(audit): 合并 evals 到 codebase-audit 并删除已并入的接口审计 skill 目录"
```

---

### Task 9: README.md 与 AGENTS.md 同步

**Files:**
- Modify: `README.md`（一览表、关系图、设计原则、目录树四处）
- Modify: `AGENTS.md`（skill 数目、核心原则 3）

**约束**：两个文件的合并说明**不得出现字面 `api-audit`**（验收 1 grep 范围含它们），用「原独立的接口审计 skill」表述。

- [ ] **Step 1: README 一览表——删 api-audit 行、改 codebase-audit 行**

用 Edit 把这两行（old_string 取完整两行）：

```
| [`codebase-audit`](skills/codebase-audit/) | 多 agent 审计 | 手动 `/codebase-audit`（偶发、一次性） | 多 agent 并行审计代码库（架构/性能/代码质量/安全/测试/依赖/可维护性/构建部署基建/规范符合性，前端 a11y/i18n 仅 web 栈），对抗式验证去伪后汇总单一报告；附带 `ultracode` 走 Workflow 确定性编排，否则自动降级到 Agent 并行 |
| [`api-audit`](skills/api-audit/) | 多 agent 审计 | 手动 `/api-audit`（偶发、一次性） | 多 agent 审计 HTTP 服务**接口逻辑**的完备性/自洽性：main agent 枚举接口清单（路径/方法/时机/限制/配合）后并行派发逐接口审计（正确性/合理性/简化优化/必要性）与业务流程审计（跨接口闭环/设计/矛盾/缺失接口），对抗式 verify 去伪后产出**三份文档**（接口报告 + 业务/流程报告 + 问题汇总）；附带 `ultracode` 走 Workflow，否则降级 Agent 并行 |
```

替换为这一行：

```
| [`codebase-audit`](skills/codebase-audit/) | 多 agent 审计 | 手动 `/codebase-audit`（偶发、一次性） | 多 agent 并行审计代码库（架构/性能/代码质量/安全/测试/依赖/可维护性/构建部署基建/规范符合性；条件维度：前端 a11y/i18n 仅 web 栈、接口审计仅 HTTP 项目、业务流程审计凡识别出重要流程即激活），对抗式验证去伪后产出**两份文档**（审计报告 + 按严重度问题汇总）；附带 `ultracode` 走 Workflow 确定性编排，否则自动降级到 Agent 并行 |
```

- [ ] **Step 2: README 关系图——删 api-audit 块、合并进 codebase-audit 块**

把关系图中这两段：

```
  codebase-audit  ——  手动 /codebase-audit；可对任意代码库
                       做多维度审计；规范符合性维度运行时按需
                       加载 code-conventions 作基准（缺失则降级）

  api-audit  ——  手动 /api-audit；与 codebase-audit 正交
                  （它审接口逻辑完备性/自洽性 + 业务流程闭环，
                   非通用代码质量），独立运行、产出三份文档（接口报告 + 业务/流程报告 + 问题汇总）
```

替换为：

```
  codebase-audit  ——  手动 /codebase-audit；可对任意代码库
                       做多维度审计（HTTP 项目自动附带接口审计，
                       识别出重要业务流程即附带流程审计——原独立的
                       接口审计 skill 已并入）；规范符合性维度运行时
                       按需加载 code-conventions 作基准（缺失则降级）
```

- [ ] **Step 3: README 设计原则——合并两条 bullet 为一条**

把这两条 bullet：

```
- `codebase-audit` 设 `disable-model-invocation: true`，仅手动 `/codebase-audit` 触发，可对任意代码库独立运行。其「规范符合性」维度会在运行时按需加载 `code-conventions` skill 作为审计基准（skill 级引用，不链入对方目录文件）；该 skill 缺失时此维度优雅降级、其余维度照常，故独立性不受影响。
- `api-audit` 设 `disable-model-invocation: true`，仅手动 `/api-audit` 触发，可对任意 HTTP 服务独立运行。它与 `codebase-audit` **正交不合并**：后者审通用代码质量多维度（架构/性能/代码质量/安全/测试/依赖/可维护性/构建部署基建/规范，前端 a11y/i18n 按栈），前者只审**接口逻辑**的完备性/自洽性与业务流程闭环，复用同一套「main agent 只 scope+编排 → 并行审计 → 对抗式 verify 分离 → 汇总」范式但聚焦点与产物（三份文档，含问题汇总）不同。
```

替换为一条：

```
- `codebase-audit` 设 `disable-model-invocation: true`，仅手动 `/codebase-audit` 触发，可对任意代码库独立运行。其「规范符合性」维度会在运行时按需加载 `code-conventions` skill 作为审计基准（skill 级引用，不链入对方目录文件）；该 skill 缺失时此维度优雅降级、其余维度照常，故独立性不受影响。原独立的接口审计 skill 已并入本 skill：接口审计（仅 HTTP 项目激活）与业务流程审计（识别出重要流程即激活，不限 HTTP）成为条件维度，产出统一为「审计报告 + 问题汇总」两份文档。
```

- [ ] **Step 4: README 目录树——修重复行、删 api-audit、补 evals/**

把目录树中这三行（含预存的重复 codebase-audit 两行与缩进错位）：

```
   ├── codebase-audit/             # SKILL.md + agents/（各维度审计指令）
   ├── codebase-audit/             # SKILL.md + agents/（各维度审计指令）+ scripts/
    ├── api-audit/                  # SKILL.md + agents/（接口/流程审计指令）+ scripts/ + evals/
```

替换为一行（缩进与相邻行对齐，4 空格）：

```
    ├── codebase-audit/             # SKILL.md + agents/（维度/接口/流程审计指令）+ scripts/ + evals/
```

- [ ] **Step 5: AGENTS.md——数目改六、核心原则 3 补合并案例**

Edit 1，把：

```
当前四个 skill 见 [README.md](README.md)。
```

替换为：

```
当前六个 skill 见 [README.md](README.md)。
```

Edit 2，把核心原则 3 末尾的：

```
作用域重合、强耦合的能力则合并——spec-first/SDD 工作流全程依赖 polyrepo 结构，已并入 `agents-scaffold` 的 `spec-center/AGENTS.md` 模板，不单列 skill。
```

替换为：

```
作用域重合、强耦合的能力则合并——spec-first/SDD 工作流全程依赖 polyrepo 结构，已并入 `agents-scaffold` 的 `spec-center/AGENTS.md` 模板，不单列 skill；接口/流程审计（原独立的接口审计 skill）同为手动一次性审计、与 `codebase-audit` 作用域重合，已并入其中成为条件维度。
```

- [ ] **Step 6: 验证（即 spec 验收 1 全量 + 验收 5）**

Run: `rg -l 'api-audit' skills/ README.md AGENTS.md || echo OK`
Expected: `OK`

Run: `rg -n '当前六个 skill' AGENTS.md && rg -c 'codebase-audit' README.md`
Expected: AGENTS.md 命中；README 计数 > 0 且目录树无重复行（人工瞄一眼 `rg -n 'codebase-audit/' README.md` 输出确认树里只剩一行）

- [ ] **Step 7: Commit**

```bash
rtk git add README.md AGENTS.md && rtk git commit -m "docs: README/AGENTS.md 同步审计 skill 合并——一览表/关系图/设计原则/目录树/数目"
```

---

### Task 10: 全量验收（spec §9 八条）

**Files:** 无新改动（除非验收暴露问题，修掉再重跑）

- [ ] **Step 1: 验收 1——api-audit 无残留**

Run: `test ! -d skills/api-audit && (rg -l 'api-audit' skills/ README.md AGENTS.md || echo PASS1)`
Expected: `PASS1`

- [ ] **Step 2: 验收 2——fix/suggest 流程无残留**

Run: `rg -l 'fix-solution|quick-fix|suggest' skills/codebase-audit/ || echo PASS2`
Expected: `PASS2`

- [ ] **Step 3: 验收 3——workflows.mjs 语法**

Run: `node --check skills/codebase-audit/scripts/workflows.mjs && echo PASS3`
Expected: `PASS3`

- [ ] **Step 4: 验收 4——name 一致、无跨 skill 路径引用、无死链**

Run: `rg -n '^name: codebase-audit' skills/codebase-audit/SKILL.md && (rg -n '\.\./(code-conventions|agents-scaffold|diagnose|engineering)' skills/codebase-audit/ || echo NO_CROSS_REF)`
Expected: name 命中 + `NO_CROSS_REF`

再人工核对 SKILL.md 引用的每个 `agents/*.md` 文件都存在：

Run: `for f in $(rg -o 'agents/[a-z_-]+\.md' skills/codebase-audit/SKILL.md -N | sort -u); do test -f "skills/codebase-audit/$f" || echo "DEAD: $f"; done; echo LINK_CHECK_DONE`
Expected: 只输出 `LINK_CHECK_DONE`，无 `DEAD:` 行

- [ ] **Step 5: 验收 5——README/AGENTS 同步（Task 9 已验，复跑确认）**

Run: `rg -l 'api-audit' README.md AGENTS.md || echo PASS5`
Expected: `PASS5`

- [ ] **Step 6: 验收 6——产出路径统一、平铺**

Run: `rg -n 'docs/api-audit|docs/audit/(codebase|api)/|<TS>/api/|<TS>/flow/' skills/ README.md || echo PASS6A`
Expected: `PASS6A`

Run: `rg -n 'outDir\}/(api|flow)/' skills/codebase-audit/scripts/workflows.mjs || echo PASS6B`
Expected: `PASS6B`

- [ ] **Step 7: 验收 7——risk 字段清零**

Run: `rg -n '\*\*risk\*\*' skills/codebase-audit/agents/ || echo PASS7`
Expected: `PASS7`

- [ ] **Step 8: 验收 8——回复行契约三处一致**

Run: `rg -o 'Reply with one line only: "[^"]*"' skills/codebase-audit/SKILL.md skills/codebase-audit/scripts/workflows.mjs | sort -u`

再列 agents 文件末尾的约定行：

Run: `rg -n 'Reply (with|to the caller with) (one line|only)' skills/codebase-audit/agents/`

人工逐字比对固定部分是否与 Global Constraints 的契约表一致（占位符 `{g}`/`${it.key}`/`{group key}` 属同一形状的不同书写，固定文本必须完全相同）。发现不一致 → 修正后重跑本 Step。

- [ ] **Step 9: 收尾**

若 Step 1–8 全绿且无新增改动，无需 commit；若有修正，`rtk git add -A && rtk git commit -m "fix(audit): 验收修正"`。最后向用户报告八条验收结果。
