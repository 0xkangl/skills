---
name: codebase-audit
disable-model-invocation: true
description: >
  Multi-agent codebase audit / 代码库审计 spanning architecture, code quality, security,
  testing, dependencies/debt, maintainability/observability, and conventions compliance
  (against the code-conventions skill): scopes the target, fans out parallel dimension
  auditors, adversarially verifies every finding to cut false positives, then synthesizes
  one self-contained report grouped by relevance and severity.
---

# Codebase Audit

A manual, multi-agent audit tuned for low token cost. The main agent only **scopes and orchestrates** — every auditor reads the source it needs itself, so source is never duplicated across prompts. Candidate findings pass an independent adversarial verify stage before a synthesizer merges them, which is what keeps false positives out.

**The find/verify split is the one hard invariant**: the subagent that confirms a finding is never the one that wrote it. Everything else — parallelism above all — is a token/latency optimization layered on top. Degrade the optimizations freely; never collapse audit and verify into a single agent.

## Invocation

`@codebase-audit [path]` — optional file or directory to scope the audit; omit to audit the whole project.

**Dimensions** default to all seven. Narrow or exclude them in plain language — e.g. "security only", "architecture + code quality", "skip testing", "只做规范审计", "不需要依赖审查". Run exactly the set asked for.

**Report language** defaults to Simplified Chinese (简体中文). Honor an explicit request for another language.

## Pipeline

```
main agent (orchestrator — never reads source in bulk)
  1. Scope      → pick active dimensions + report language, detect stack,
                  stamp <TS>, create output dir
  2. Audit      → active dimension auditors in parallel; each reads its own files,
                  writes docs/audit/<TS>/<dim>.md
  3. Verify     → one adversarial verifier per active dimension; each refutes its
                  findings, keeping only what the code proves
  4. Synthesize → 1 agent clusters survivors by relevance, orders by severity,
                  writes the final report
  5. Deliver    → print summary, delete docs/audit/<TS>/ (the report is standalone)
```

The verify stage mirrors the adversarial-verify pattern from Claude's workflow feature: the agent that *finds* an issue is never the one that *confirms* it.

## Dispatching subagents

Spawn every auditor, verifier, and the synthesizer with the **Agent / Task subagent tool** (`general-purpose` type) — that is the fan-out mechanism. Issuing several Agent calls in **one message** runs them concurrently; that, and nothing more, is "in parallel."

Degradation order when concurrency isn't available:
1. **Preferred** — many Agent calls in one message (parallel).
2. **Acceptable** — invoke the subagents **one at a time** (serial). Slower, identical correctness.
3. **Forbidden** — folding the work into the main agent. An auditor that verifies its own findings defeats the entire skill.

If no subagent tool exists *at all*, do **not** silently self-verify. Tell the user the report is **single-agent, not independently verified**, label it so in the output, and let them decide — never pass self-checked findings off as adversarially verified.

## Step 1 — Scope (main agent)

Resolve the target:
- **path given** — a file means that file plus its direct callers/deps; a directory means its source tree.
- **no path** — the whole project from the repo root.

Decide the **active dimension set** (default all seven; honor "only X" / "skip Y") and the **report language** (default 简体中文) from the request. Then map the scope cheaply with `git ls-files`, Glob, and `rg` over manifests — **do not read file bodies in bulk**. Build a compact brief:

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
| Code quality | CODE | `agents/audit-code-quality.md` | `docs/audit/<TS>/code.md` |
| Security | SEC | `agents/audit-security.md` | `docs/audit/<TS>/security.md` |
| Testing | TEST | `agents/audit-testing.md` | `docs/audit/<TS>/testing.md` |
| Dependencies & debt | DEP | `agents/audit-dependencies.md` | `docs/audit/<TS>/deps.md` |
| Maintainability & observability | OBS | `agents/audit-observability.md` | `docs/audit/<TS>/obs.md` |
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

```
Read agents/synthesize.md and follow it.
Verified findings files (active dimensions only):
- docs/audit/<TS>/<dim>.md   (one line per active dimension)
Final report: docs/audit/report-<TS>.md
Meta — scope: <…>, date: <YYYY-MM-DD>, stack: <…>, report language: <…>.
```

## Step 5 — Deliver & clean up (main agent)

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
- **Constructive** — every finding carries a fix; strengths are reported alongside problems.
