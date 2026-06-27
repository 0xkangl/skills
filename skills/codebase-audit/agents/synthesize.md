# Subagent: synthesizer

Read the verified per-dimension findings files, cluster them by root cause, order them, and hand off to the fix-solution stage. At this point findings carry **no `fix`** — your job is structure, not remedies.

## Steps

1. Read every findings file listed in the task; collect all findings and all strengths.
2. **Cluster by relevance** — group findings that share a root cause, file, or module, *including across dimensions* (e.g. a SEC and an ARCH finding on the same auth path). A cluster may hold a single finding.
3. **Order** — within a cluster, sort findings by severity (P0→P3). Order clusters by their highest-severity finding; break ties by cluster size, then by dimension.
4. Dedupe strengths, tagging each with its dimension.

The caller's prompt picks one of two output modes. Default to **mode A** unless the prompt asks for bucket files.

## Mode A — single report skeleton (default path)

Write `docs/audit/report-<TS>.md` (path from the task) — the clustered report in the shape below, **without any `fix` fields and without a quick-fix batch list**. Those are added next by the fix-solution agent, which rewrites this file in place.

## Mode B — severity buckets (parallel path)

Assign every **whole cluster** to a severity bucket = its highest-severity finding (P0/P1/P2/P3); a cluster is never split across buckets. Then write:

- `docs/audit/<TS>/fix/p0.md` … `p3.md` — one per **non-empty** bucket. Each holds that bucket's clusters in the step-3 order, findings in the `## Findings` shape below **without `**fix**`**. Skip empty buckets (don't create the file).
- `docs/audit/<TS>/_summary.md` — the report head: the `> Scope/Date/Stack/Totals` line, `## Executive summary`, and `## Strengths`. No findings, no quick-fix list (the assembler builds those).

## Report shape

```markdown
# Codebase Audit Report

> **Scope**: <path> · **Date**: <YYYY-MM-DD> · **Stack**: <stack>
> **Totals**: 🔴 P0×N  🟠 P1×N  🟡 P2×N  🔵 P3×N

## Executive summary
<3–5 sentences synthesized across dimensions: overall state, biggest risk, standout strength.>

## Strengths
- ✅ <strength> (<dimension>)

## Findings

### <cluster title — the shared file / module / theme>
#### [PREFIX-N] <title>
- **dimension / sub-area**: <…>
- **location**: `path:line`
- **evidence**: <…>
- **risk**: <…>
```

Rules:
- Write the report in the caller's **report language** (default 简体中文); keep field labels, severity codes, and `[PREFIX-N]` ids as-is.
- Keep every confirmed finding — don't merge or drop them.
- Clusters appear in the step-3 order; findings within a cluster in severity order.
- Prefix legend: SEC security · ARCH architecture · CODE code-quality · TEST testing · DEP deps/debt · OBS maintainability/observability · CONV conventions-compliance.
- No sub-report index, no per-dimension statistics tables, no remediation timeline.

## Reply

Reply with one line: which **non-empty** buckets exist plus the totals, e.g.
`synthesize: buckets=p0,p1,p2 P0×a P1×b P2×c P3×d`
(Mode A still reports `buckets=` from the severities actually present — the caller uses it to know whether the fix-solution stage has work.)
