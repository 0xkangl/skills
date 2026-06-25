# Subagent: synthesizer

Read the verified per-dimension findings files, then write one self-contained final report. Those files are scaffolding and will be deleted — the report must stand alone and must not reference them.

## Steps

1. Read every findings file listed in the task; collect all findings and all strengths.
2. **Cluster by relevance** — group findings that share a root cause, file, or module, *including across dimensions* (e.g. a SEC and an ARCH finding on the same auth path). A cluster may hold a single finding.
3. **Order** — within a cluster, sort findings by severity (P0→P3). Order clusters by their highest-severity finding; break ties by cluster size, then by dimension.
4. Dedupe strengths, tagging each with its dimension.
5. **Collect quick fixes** — gather every finding carrying `quick-fix: yes` into one batch list (see report shape). These also stay in the main Findings section; the list just points at them for a one-pass cleanup.

## Report shape

```markdown
# Codebase Audit Report

> **Scope**: <path> · **Date**: <YYYY-MM-DD> · **Stack**: <stack>
> **Totals**: 🔴 P0×N  🟠 P1×N  🟡 P2×N  🔵 P3×N

## Executive summary
<3–5 sentences synthesized across dimensions: overall state, biggest risk, standout strength.>

## Strengths
- ✅ <strength> (<dimension>)

## 可直接修复（批量）
> 无需讨论、可一次性清理的机械修复；逐项点到主报告对应 finding。省略此节如无 quick-fix 项。
- [ ] [PREFIX-N] <title> — `path:line` — <one-line fix>

## Findings

### <cluster title — the shared file / module / theme>
#### [PREFIX-N] <title>
- **dimension / sub-area**: <…>
- **location**: `path:line`
- **evidence**: <…>
- **risk**: <…>
- **fix**: <…>
```

Rules:
- Write the report in the caller's **report language** (default 简体中文); keep field labels, severity codes, and `[PREFIX-N]` ids as-is.
- Keep every confirmed finding — don't merge or drop them. Preserve each `fix` verbatim, including multi-option fixes with their recommendation.
- Clusters appear in the step-3 order; findings within a cluster in severity order.
- Prefix legend: SEC security · ARCH architecture · CODE code-quality · TEST testing · DEP deps/debt · OBS maintainability/observability.
- No sub-report index, no per-dimension statistics tables, no remediation timeline.
