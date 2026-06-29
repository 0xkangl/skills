---
name: codebase-audit
disable-model-invocation: true
description: >
  Multi-agent codebase audit / 代码库审计 spanning architecture, performance/scalability,
  code quality, security, testing, dependencies/debt, maintainability/observability,
  build/deploy/infra, frontend a11y/i18n, and conventions compliance
  (against the code-conventions skill): scopes the target, fans out parallel dimension
  auditors, adversarially verifies every finding to cut false positives, then synthesizes
  one self-contained report grouped by relevance and severity.
---

# Codebase Audit

A manual, multi-agent audit tuned for low token cost. The main agent only **scopes and orchestrates** — every auditor reads the source it needs itself, so source is never duplicated across prompts. Candidate findings pass an independent adversarial verify stage before a synthesizer merges them, which is what keeps false positives out.

**The find/verify split is the one hard invariant**: the subagent that confirms a finding is never the one that wrote it. Everything else — parallelism above all — is a token/latency optimization layered on top. Degrade the optimizations freely; never collapse audit and verify into a single agent.

## Invocation

`/codebase-audit [path]` — optional file or directory to scope the audit; omit to audit the whole project.

**Dimensions** default to all applicable ones — architecture, performance, code quality, security, testing, dependencies/debt, maintainability/observability, build/deploy/infra, and conventions; the frontend (a11y/i18n) dimension is added only when Scope detects a web/frontend stack. Narrow or exclude them in plain language — e.g. "security only", "architecture + code quality", "skip testing", "只做规范审计", "不需要依赖审查". Run exactly the set asked for.

**Report language** defaults to Simplified Chinese (简体中文). Honor an explicit request for another language.

**Workflow orchestration** is optional and opt-in: append `ultracode` to the invocation (e.g. `/codebase-audit ultracode src/`) to drive the audit through the deterministic Workflow pipeline. Without the keyword, fan out with the built-in `Agent` tool (the default) — never start a Workflow run just because the tool happens to be in your list.

## Pipeline

```
main agent (orchestrator — never reads source in bulk)
  1. Scope      → pick active dimensions + report language, detect stack,
                  stamp <TS>, create output dir
  2. Audit      → active dimension auditors in parallel; each reads its own files,
                  writes docs/audit/<TS>/<dim>.md
  3. Verify     → one adversarial verifier per active dimension; each refutes its
                  findings, keeping only what the code proves
  4. Synthesize → 1 agent clusters survivors by relevance, orders by severity —
                  no fix yet (auditors only found & proved)
  5. Fix        → fix-solution agent(s) add a fix + quick-fix flag to each finding,
                  now that the full root-cause cluster is visible, then finalize the report
                  (default: 1 agent in-place; parallel path: 1 per severity bucket → assembler)
  6. Deliver    → print summary, delete docs/audit/<TS>/ (the report is standalone)
```

The verify stage mirrors the adversarial-verify pattern from Claude's workflow feature: the agent that *finds* an issue is never the one that *confirms* it. Fix solutions land **after** clustering so a remedy sees the whole root-cause group across dimensions, not one dimension's slice.

## Dispatching subagents

Subagents are dispatched with the built-in **`Agent`** tool — a top-level tool that is always in your tool list. Call it directly. **Never `ToolSearch` for a dispatch tool**, and **never reach for the deferred `Task*` tools** (`TaskCreate`/`TaskUpdate`/… are a to-do / background-job tracker, *not* subagent dispatch). There is no separate "subagent" tool to discover — if `Agent` is in your list, that is the mechanism.

Pick the level by the invocation, not by probing the tool list. This is a degrade ladder: a level being unavailable is expected, never a blocking error — drop to the next and keep going.

0. **Preferred — Workflow (only when the user appended `ultracode`).** The opt-in keyword is the trigger, not the mere presence of the tool — which, like `Agent`, is a built-in top-level tool already in your list. Run the whole Audit→Verify→Synthesize→Fix→Assemble pipeline by calling `Workflow` with `scriptPath` pointing at `scripts/workflows.mjs` (deterministic orchestration; enforces the find/verify split structurally). This replaces Steps 2–5 below — the main agent still does Step 1 (Scope) and Step 6 (Deliver). See **Step 2–5 via Workflow**.
   - If you opted into `ultracode` but genuinely cannot find a `Workflow` tool (rare), print one line — e.g. `ℹ️ Workflow 工具不可用，改用 Agent 并行编排` — and fall through to level 1's **`Agent`-only** parallel pipeline (never `TaskCreate`, which is a to-do tracker, not a dispatch engine).
1. **Default — the `Agent` tool** (`general-purpose` type). Issuing several Agent calls in **one message** runs them concurrently; that, and nothing more, is "in parallel." Drive Steps 2–4 by hand.
2. **Acceptable** — invoke the subagents **one at a time** (serial). Slower, identical correctness.
3. **Forbidden** — folding the work into the main agent. An auditor that verifies its own findings defeats the entire skill.

If the `Agent` tool genuinely isn't in your tool list, do **not** silently self-verify. Tell the user the report is **single-agent, not independently verified**, label it so in the output, and let them decide — never pass self-checked findings off as adversarially verified.

### Step 2–5 via Workflow

After Step 1 (Scope) produces `<TS>`, the scope brief, language, active dimensions, and the run dir:

1. **Write the scope brief to `docs/audit/<TS>/scope.md`.** The workflow script runs sandboxed (no filesystem, no clock); it can't read files — but the auditor agents can. Passing a *path* instead of the inline text keeps `args` tiny and immune to serialization issues, and avoids re-embedding the whole brief in every auditor prompt.
2. **Invoke the Workflow tool** with `scriptPath` and `args`. **`args` must be a real JSON object** — never a JSON-encoded string (a stringified payload destructures to all-`undefined` and the run aborts with `args 不是对象 …`).

```
Workflow({
  scriptPath: "<this skill dir>/scripts/workflows.mjs",
  args: {
    ts:         "<TS>",                 // YYYYMMDDHH from Step 1's clock — script can't read the clock
    scopeFile:  "docs/audit/<TS>/scope.md",  // scope brief on disk; agents read it themselves
    language:   "简体中文",             // report language
    agentsDir:  "<this skill dir>/agents",   // absolute path so workflow agents can read the instruction files
    meta:       "scope: <…>, date: <YYYY-MM-DD>, stack: <…>",
    dimensions: ["arch","security",…]   // active dimension keys (subset of arch|perf|code|security|testing|deps|obs|infra|fe|conv)
  }
})
```

The script fans out one auditor per dimension, chains a fresh verifier onto each (the find/verify split is structural — never the same agent), runs the synthesizer once all dimensions are verified (it buckets clusters into `docs/audit/<TS>/fix/p0..p3.md` + `_summary.md`), then fans out one fix-solution agent per non-empty severity bucket and a final assembler that writes `docs/audit/report-<TS>.md`. It returns the per-dimension P-counts / kept-dropped lines, the fix/assemble lines, and the report path for the Step 6 summary. Then continue to **Step 6 — Deliver & clean up**.

## Step 1 — Scope (main agent)

Resolve the target:
- **path given** — a file means that file plus its direct callers/deps; a directory means its source tree.
- **no path** — the whole project from the repo root.

Decide the **active dimension set** and the **report language** (default 简体中文) from the request. Default to all universally-applicable dimensions (arch, perf, code, security, testing, deps, obs, infra, conv); add `fe` only when stack detection finds a web/frontend stack (React/Vue/Svelte, a frontend build like vite/webpack, a `package.json` with a UI framework). Honor "only X" / "skip Y". Then map the scope cheaply with `git ls-files`, Glob, and `rg` over manifests — **do not read file bodies in bulk**. Build a compact brief:

```
Scope: <path | "whole project">
Dimensions: <active set, e.g. "all" or "security, architecture">
Report language: <简体中文 (default) | as requested>
Stack: <languages / frameworks / key deps>
Tree (≤3 levels):
<tree>
```

Stamp the run from the real clock (don't guess the hour) and create the output dir:

```bash
TS=$(date +%Y%m%d%H)
mkdir -p docs/audit/$TS
```

If `mkdir` fails, stop and ask the user to check permissions — launch nothing.

Tell the user:

```
🔍 Codebase audit started — scope: <…> · stack: <…> · files: <N>
Launching <N> auditors in parallel…
```

## Step 2 — Dimension auditors (active dimensions, in parallel)

Launch every active dimension in one batch. Give each the scope brief and point it at its instruction file and output path; the auditor reads its own source. (Full set below — run only the active ones.)

| Dimension | Prefix | Instruction | Output |
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

Prompt shape:

```
<scope>
{scope brief}
</scope>
Read {instruction file} and follow it. Pull the source you need yourself.
Write your findings to: docs/audit/<TS>/<dim>.md
Reply with one line only: "<PREFIX>: P0=a P1=b P2=c P3=d".
```

## Step 3 — Adversarial verify (one fresh subagent per active dimension)

When the auditors finish, launch one verifier per dimension — each a **new** subagent, never the auditor that wrote the file:

```
Read agents/verify.md and follow it.
Findings file (rewrite in place): docs/audit/<TS>/<dim>.md
Dimension: <name> (prefix <PREFIX>).
Reply with one line only: "<PREFIX>: kept=x dropped=y".
```

## Step 4 — Synthesize (1 subagent)

Clusters and orders the verified findings; adds **no fix** (auditors only found & proved). For the default Agent path use Mode A — the synthesizer writes the fix-less report skeleton that Step 5 then fills in place:

```
Read agents/synthesize.md and follow it (Mode A — single report skeleton, no fix).
Verified findings files (active dimensions only):
- docs/audit/<TS>/<dim>.md   (one line per active dimension)
Report skeleton (no fix, no quick-fix list yet): docs/audit/report-<TS>.md
Meta — scope: <…>, date: <YYYY-MM-DD>, stack: <…>, report language: <…>.
```

## Step 5 — Fix solutions (1 subagent, default path)

Now the clusters are visible, add a fix to every finding. One fix-solution agent rewrites the report in place — appends `**fix**` (and `**quick-fix**` where mechanical) to each finding and compiles the `## 可直接修复（批量）` list:

```
Read agents/fix-solution.md and follow it.
Whole report (rewrite in place — add a fix to each finding, build the batch list): docs/audit/report-<TS>.md
Report language: <…>.
Reply with one line only: "fix: all n=x quick=y".
```

**Parallel upgrade (optional).** To speed the fix stage, run Step 4 in Mode B instead (synthesizer buckets clusters by top severity into `docs/audit/<TS>/fix/p0..p3.md` + `_summary.md`, writes no report), launch one fix-solution agent per non-empty bucket in one batch, then a final assembler (`agents/assemble.md`) that stitches the buckets P0→P3 into `docs/audit/report-<TS>.md` and builds the batch list. Whole clusters are bucketed by their top severity, so a root cause is never split across agents. This is what the Workflow path does; serial buckets or the single-agent Mode A above are equal-correctness degrades.

## Step 6 — Deliver & clean up (main agent)

The final report lives at `docs/audit/report-<TS>.md` (outside the run dir). Once it's written, delete the scaffolding — the report is self-contained:

```bash
rm -rf docs/audit/<TS>/
```

Then summarize for the user:

```
✅ Audit complete
Totals: 🔴 P0×N  🟠 P1×N  🟡 P2×N  🔵 P3×N   ⚡ quick-fix×N
Top risk: <one line>   Strength: <one line>
Report: docs/audit/report-<TS>.md
```

## Failure handling

- **Auditor produced nothing** — verifier/synthesizer skip it; note "<dimension>: not produced" in the summary, don't block.
- **Auditor timed out** — proceed with whatever finished.
- **No tests in project** — the testing auditor records a single P1.
- **Stack unrecognized** — audit anyway; flag that some advice may not apply.
- **Binary / generated files** — skip; never feed them to an auditor.

## Principles

- **Scope-then-dispatch** — the main agent never ingests source in bulk; auditors read their own slices. This is the main token lever.
- **Evidence or it didn't happen** — every finding cites code; verify drops anything it can't substantiate.
- **Honest severity** — P0 means a genuine critical, not an inflated nit.
- **Constructive** — every finding carries a fix (added after clustering, so the remedy sees the whole root-cause group); strengths are reported alongside problems.
