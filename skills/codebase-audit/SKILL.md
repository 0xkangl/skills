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

（仅在 issues-report 成功生成时）告知用户有下游 skill 可选——**只提示、不自动调用**：

> 问题汇总已就绪。如需给每条问题补推荐修复方案（只分析不修复），可使用 `remediate-suggest` skill 处理这份 issues-report。

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
