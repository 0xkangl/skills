---
name: api-audit
disable-model-invocation: true
description: >
  Multi-agent HTTP API audit / 接口审计 focused on interface logic completeness and
  self-consistency. The main agent enumerates every endpoint into an inventory (path,
  method, when-used, constraints, coordination with other endpoints), then fans out two
  auditor families in parallel — per-endpoint auditors (correctness, reasonableness,
  simplification/optimization, necessity) and per-business-flow auditors (cross-endpoint
  flow correctness, design soundness, contradictions, missing endpoints/features) — each
  finding adversarially verified to cut false positives, then synthesized into two
  self-contained reports: an interface report and a business/flow report.
---

# API Audit

A manual, multi-agent audit of an HTTP service's **interface logic** — not general code quality. It answers four questions the user cares about:

1. **接口清单**：每个接口的路径、方法、使用时机、限制（认证/鉴权/限流/校验/幂等）、与其他接口的配合。
2. **逐接口分析**：流程与逻辑是否正确、是否合理、有无简化/优化空间、这个接口**是否有存在的必要**。
3. **业务/流程闭环**：项目里重要的功能及其业务流程，跨接口串起来是否正确、设计是否合理、有无矛盾、是否缺接口/功能才能完成流转。
4. **两份报告**：接口报告 + 业务/流程报告，各自从**完备性、合理性、简化/优化空间**给结论。

The main agent only **scopes and orchestrates** — it builds the endpoint inventory cheaply (route registrations, not handler bodies), then every auditor reads the source it needs itself, so source is never duplicated across prompts. Candidate findings pass an independent adversarial verify stage before synthesizers assemble the reports, which is what keeps false positives out.

**The find/verify split is the one hard invariant**: the subagent that confirms a finding is never the one that wrote it. Everything else — parallelism above all — is a token/latency optimization. Degrade the optimizations freely; never collapse audit and verify into a single agent.

This skill is about interface **logic** (completeness / self-consistency / necessity). REST 语义、命名、错误码等**规范符合性**不是它的重点——那是 `codebase-audit` 的 conventions 维度（基准来自 `code-conventions` skill）的事。

## Invocation

`@api-audit [path]` — optional file or directory to scope the audit (a service subtree, a router file, an `api/` package); omit to audit the whole project's HTTP surface.

**Report language** defaults to Simplified Chinese (简体中文). Honor an explicit request for another language.

**Workflow orchestration** is optional and opt-in: append `ultracode` (e.g. `@api-audit ultracode internal/api/`) to drive the audit through the deterministic Workflow pipeline. Without the keyword, fan out with the built-in `Agent` tool (the default) — never start a Workflow run just because the tool happens to be in your list.

## Pipeline

```
main agent (orchestrator — never reads handler bodies in bulk)
  1. Scope     → detect stack, enumerate ALL endpoints into an inventory skeleton
                 (path/method/handler location), group endpoints by resource/module,
                 list candidate important business flows, stamp <TS>, create run dir
  2. Audit     → in parallel:
                 (a) one endpoint-auditor per endpoint group → fills inventory details
                     (时机/限制/配合) + emits findings (正确性/合理性/简化优化/必要性)
                     → docs/api-audit/<TS>/api/<group>.md
                 (b) one flow-auditor per important business flow → traces the flow across
                     endpoints + emits findings (正确性/设计/简化优化/矛盾/缺失接口)
                     → docs/api-audit/<TS>/flow/<flow>.md
  3. Verify    → one adversarial verifier per auditor file; refutes findings, keeps only
                 what the code proves (inventory/flow-map description is left intact)
  4. Synthesize → 2 agents in parallel:
                 - api synthesizer  → docs/api-audit/api-report-<TS>.md   (接口报告)
                 - flow synthesizer → docs/api-audit/flow-report-<TS>.md  (业务/流程报告)
  5. Deliver   → print summary, delete docs/api-audit/<TS>/ (the two reports are standalone)
```

The verify stage mirrors the adversarial-verify pattern: the agent that *finds* an issue is never the one that *confirms* it. The two report families share one verify pass but synthesize separately, because the interface report is endpoint-indexed and the flow report is flow-indexed — different shapes, different audiences.

## Dispatching subagents

Subagents are dispatched with the built-in **`Agent`** tool — a top-level tool always in your list. Call it directly. **Never `ToolSearch` for a dispatch tool**, and **never reach for the deferred `Task*` tools** (`TaskCreate`/`TaskUpdate`/… are a to-do / background-job tracker, *not* subagent dispatch). If `Agent` is in your list, that is the mechanism.

Pick the level by the invocation, not by probing the tool list. This is a degrade ladder: a level being unavailable is expected, never a blocking error — drop to the next and keep going.

0. **Preferred — Workflow (only when the user appended `ultracode`).** The opt-in keyword is the trigger, not the mere presence of the tool. Run the whole Audit→Verify→Synthesize pipeline by calling `Workflow` with `scriptPath` pointing at this skill's `scripts/workflows.mjs`. This replaces Steps 2–4 below — the main agent still does Step 1 (Scope) and Step 5 (Deliver). See **Steps 2–4 via Workflow**.
   - If you opted into `ultracode` but genuinely cannot find a `Workflow` tool (rare), print one line — e.g. `ℹ️ Workflow 工具不可用，改用 Agent 并行编排` — and fall through to level 1.
1. **Default — the `Agent` tool** (`general-purpose` type). Issuing several Agent calls in **one message** runs them concurrently; that is "in parallel." Drive Steps 2–4 by hand.
2. **Acceptable** — invoke the subagents **one at a time** (serial). Slower, identical correctness.
3. **Forbidden** — folding the work into the main agent. An auditor that verifies its own findings defeats the entire skill.

If the `Agent` tool genuinely isn't in your tool list, do **not** silently self-verify. Tell the user the reports are **single-agent, not independently verified**, label them so, and let them decide.

### Steps 2–4 via Workflow

After Step 1 (Scope) produces `<TS>`, the scope brief, language, endpoint groups, and candidate flows, invoke the Workflow tool with `scriptPath` pointing at `scripts/workflows.mjs` and `args`:

```
Workflow({
  scriptPath: "<this skill dir>/scripts/workflows.mjs",
  args: {
    ts:        "<TS>",                  // YYYYMMDDHH from Step 1's clock — script can't read the clock
    scope:     "<the scope brief incl. inventory skeleton>",
    language:  "简体中文",
    agentsDir: "<this skill dir>/agents",  // absolute path so workflow agents can read instruction files
    meta:      "scope: <…>, date: <YYYY-MM-DD>, stack: <…>",
    groups:    [{ key: "users", name: "用户/认证" }, …],   // endpoint groups from Scope
    flows:     [{ key: "checkout", name: "下单结算" }, …]   // important business flows from Scope
  }
})
```

The script fans out one endpoint-auditor per group and one flow-auditor per flow, chains a fresh verifier onto each (find/verify split is structural), then runs the two synthesizers in parallel and returns the per-file kept/dropped lines and both report paths for the Step 5 summary. Continue to **Step 5 — Deliver**.

## Step 1 — Scope (main agent)

Resolve the target: a path means that file/subtree plus the routers that mount it; no path means the whole project's HTTP surface from the repo root.

**Detect the stack and enumerate endpoints.** Use `git ls-files`, Glob, and `rg` over **route registrations** — don't read handler bodies in bulk. Common registration shapes to grep (framework-agnostic; match whatever the project uses):

| Family | Grep hint (`rg`) |
|--------|------------------|
| Go net/http / chi / gin / echo / fiber | `rg -n "(HandleFunc|\.(GET\|POST\|PUT\|DELETE\|PATCH)\()|Handle\("` |
| Node Express / Koa / Fastify / Nest | `rg -n "\.(get\|post\|put\|delete\|patch)\(|@(Get\|Post\|Put\|Delete\|Patch)\("` |
| Python FastAPI / Flask / Django | `rg -n "@(app\|router)\.(get\|post\|put\|delete\|patch)\(|add_url_rule\|path\(|re_path\("` |
| Java Spring | `rg -n "@(Get\|Post\|Put\|Delete\|Request)Mapping"` |
| Spec-driven | `openapi`/`swagger` yaml/json, `.proto` with `google.api.http` |

If an OpenAPI/Swagger spec exists, treat it as a second source of truth and note any drift between spec and code as a finding seed.

Build the **inventory skeleton** — one row per endpoint — and **group** endpoints by resource/module (the grouping = the unit of parallelism for endpoint auditors). Then list **candidate important business flows** (the multi-endpoint journeys that matter: auth, signup, checkout, payment, the project's core domain actions). Compact brief:

```
Scope: <path | "whole project">
Report language: <简体中文 (default) | as requested>
Stack: <language / HTTP framework / router>
Endpoint inventory (skeleton):
  [users]    POST   /login         auth.LoginHandler        handler/auth.go:12
  [users]    POST   /users         user.CreateHandler       handler/user.go:30
  [orders]   POST   /orders        order.CreateHandler      handler/order.go:18
  …
Endpoint groups: users, orders, …
Candidate business flows: 注册登录, 下单结算, …
```

Stamp the run from the real clock (don't guess the hour) and create the output dir:

```bash
TS=$(date +%Y%m%d%H)
mkdir -p docs/api-audit/$TS/api docs/api-audit/$TS/flow
```

If `mkdir` fails, stop and ask the user to check permissions — launch nothing.

Tell the user:

```
🔍 API audit started — scope: <…> · stack: <…> · endpoints: <N> in <G> groups · flows: <F>
Launching <G> endpoint auditors + <F> flow auditors in parallel…
```

## Step 2 — Auditors (in parallel)

Launch every endpoint group and every flow in one batch. Give each its slice of the inventory/flow list and point it at its instruction file and output path; the auditor reads the handler source itself.

| Auditor | Prefix | Instruction | Output |
|---------|--------|-------------|--------|
| Endpoint group `<g>` | `API` | `agents/audit-endpoint.md` | `docs/api-audit/<TS>/api/<g>.md` |
| Business flow `<f>` | `FLOW` | `agents/audit-flow.md` | `docs/api-audit/<TS>/flow/<f>.md` |

Endpoint-auditor prompt shape:

```
<scope>
{scope brief}
</scope>
You audit endpoint group "{group name}". Endpoints in this group:
{the inventory rows for this group}
Read agents/audit-endpoint.md and follow it. Pull the handler source yourself.
Write your file to: docs/api-audit/<TS>/api/<g>.md
Reply with one line only: "API[{g}]: endpoints=n P0=a P1=b P2=c P3=d".
```

Flow-auditor prompt shape:

```
<scope>
{scope brief}
</scope>
You audit business flow "{flow name}". Trace it across endpoints; the inventory above is your map.
Read agents/audit-flow.md and follow it. Pull the handler source yourself.
Write your file to: docs/api-audit/<TS>/flow/<f>.md
Reply with one line only: "FLOW[{f}]: steps=n P0=a P1=b P2=c P3=d".
```

## Step 3 — Adversarial verify (one fresh subagent per auditor file)

When the auditors finish, launch one verifier per file — each a **new** subagent, never the auditor that wrote the file:

```
Read agents/verify.md and follow it.
File (rewrite in place — refute findings; leave the inventory/flow-map description intact):
  docs/api-audit/<TS>/<api|flow>/<key>.md
Reply with one line only: "<PREFIX>[{key}]: kept=x dropped=y".
```

## Step 4 — Synthesize (2 subagents, in parallel)

Two synthesizers run together — one per report. Each reads only its family's verified files.

```
# API report
Read agents/synthesize-api.md and follow it.
Verified endpoint files: docs/api-audit/<TS>/api/*.md
Final report: docs/api-audit/api-report-<TS>.md
Meta — scope: <…>, date: <YYYY-MM-DD>, stack: <…>, report language: <…>.

# Flow report
Read agents/synthesize-flow.md and follow it.
Verified flow files: docs/api-audit/<TS>/flow/*.md
Also available for cross-reference: docs/api-audit/<TS>/api/*.md
Final report: docs/api-audit/flow-report-<TS>.md
Meta — scope: <…>, date: <YYYY-MM-DD>, stack: <…>, report language: <…>.
```

## Step 5 — Deliver & clean up (main agent)

The two reports live at `docs/api-audit/api-report-<TS>.md` and `docs/api-audit/flow-report-<TS>.md` (outside the run dir). Only after **both** reports are confirmed written, delete the scaffolding — the reports are self-contained:

```bash
rm -rf docs/api-audit/<TS>/
```

If a synthesizer failed (its report is missing — e.g. the Workflow run returned `null` for that family), **keep** `docs/api-audit/<TS>/` so the verified audit files survive for retry, and say so in the summary instead of cleaning up.

Then summarize for the user:

```
✅ API audit complete
Endpoints: N in G groups · Flows: F
Totals: 🔴 P0×N  🟠 P1×N  🟡 P2×N  🔵 P3×N
Top risk: <one line>   Biggest gap: <one missing endpoint/feature, or "none">
Reports:
  接口报告: docs/api-audit/api-report-<TS>.md
  业务/流程报告: docs/api-audit/flow-report-<TS>.md
```

## Failure handling

- **Auditor produced nothing** — verifier/synthesizer skip it; note "<group/flow>: not produced" in the summary, don't block.
- **No routes found** — the stack may be unusual; widen the grep, check for a spec file, or ask the user where routes are registered before launching auditors.
- **No clear business flows** — run the endpoint family only; note that the flow report covers single-endpoint behaviors instead.
- **Spec ↔ code drift** — surface as findings (endpoint in spec but not in code, or vice versa).
- **Binary / generated route files** (e.g. generated gRPC-gateway) — list endpoints from them but don't deep-audit generated glue.

## Principles

- **Inventory first, then judge** — the descriptive layer (path/时机/限制/配合, flow steps) is documentation the user asked for; it stays even when there are zero findings. Findings are the judgment layer on top.
- **Scope-then-dispatch** — the main agent enumerates routes but never ingests handler bodies in bulk; auditors read their own slices. The main token lever.
- **Evidence or it didn't happen** — every finding cites code; verify drops anything it can't substantiate. A "missing endpoint" finding must show the flow step that has no endpoint to serve it.
- **Necessity is a real verdict** — for each endpoint, say whether it's necessary, redundant (with which), or dubious. Don't dodge it.
- **Honest severity** — P0 means a genuine critical (broken core path, data-corrupting logic, a flow that cannot complete), not an inflated nit.
- **Constructive** — every finding carries a concrete fix/improvement; strengths are reported alongside problems.
