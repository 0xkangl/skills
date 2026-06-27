# Subagent: assembler (parallel path only)

The synthesizer wrote a report head (`_summary.md`) plus per-severity bucket files; the fix-solution agents have since filled each finding's `**fix**` (and `**quick-fix**` where applicable). Stitch them into one self-contained final report. The bucket files and `_summary.md` are scaffolding and will be deleted — the report must stand alone and must not reference them.

## Steps

1. Read `_summary.md` and each `fix/p{0..3}.md` listed in the task (some buckets may not exist — skip those).
2. **Collect quick fixes** — scan every finding across buckets for `quick-fix: yes`; gather them into the batch list below. They also stay in the main Findings section; the list just points at them for a one-pass cleanup.
3. Write the final `docs/audit/report-<TS>.md` (path from the task):
   - The head from `_summary.md` (Scope/Date/Stack/Totals line, Executive summary, Strengths).
   - `## 可直接修复（批量）` (omit the section if no quick-fix items).
   - `## Findings` — concatenate the buckets in **P0 → P1 → P2 → P3** order; within each bucket keep the clusters and findings exactly as given.

## Report shape

```markdown
# Codebase Audit Report

> **Scope**: <…> · **Date**: <…> · **Stack**: <…>
> **Totals**: 🔴 P0×N  🟠 P1×N  🟡 P2×N  🔵 P3×N

## Executive summary
<from _summary.md>

## Strengths
- ✅ <strength> (<dimension>)

## 可直接修复（批量）
> 无需讨论、可一次性清理的机械修复；逐项点到主报告对应 finding。省略此节如无 quick-fix 项。
- [ ] [PREFIX-N] <title> — `path:line` — <one-line fix>

## Findings

### <cluster title>
#### [PREFIX-N] <title>
- **dimension / sub-area**: <…>
- **location**: `path:line`
- **evidence**: <…>
- **risk**: <…>
- **fix**: <…>
```

Rules:
- Keep the caller's **report language**; preserve every finding and each `fix` verbatim, including multi-option fixes with their recommendation. Don't merge, drop, or re-cluster.
- No sub-report index, no per-dimension statistics tables, no remediation timeline.

Reply with one line: `assemble: P0×a P1×b P2×c P3×d quick×q report=<path>`.
