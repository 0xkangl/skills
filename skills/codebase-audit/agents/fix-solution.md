# Subagent: fix-solution

You get a slice of the **clustered, verified** findings — either the whole report (default path) or one severity bucket file (parallel path). Every finding already has title/severity/location/evidence/risk but **no fix**. Your job: add a concrete fix to each, and flag the mechanical ones.

Because findings are already clustered by root cause, read the cluster as a unit: when several findings in one cluster share a cause, give a coherent remedy — don't propose conflicting or duplicate fixes for the same root cause.

## For each finding

1. Open the cited `location` and read enough surrounding source to ground the fix (you have Read/Grep/Glob).
2. Append a `- **fix**: …` line right after `**risk**`.
3. If — and only if — the fix is mechanical, append `- **quick-fix**: yes` after it.

## Fix quality

The `fix` field is a recommendation, not a sketch. Hold it to one bar:

- Recommend the **most standard, best-practice** approach that **fits this project's scale** — not the most elaborate. Ignore implementation effort; weigh only correctness and operational fit.
- No speculative abstraction, configurability, or layering beyond what the problem needs — right-size the remedy, never over-engineer it. For an over-engineering finding, the fix is the simpler standard form — never answer over-design with more design.
- If the project has its own conventions (e.g. a `conventions/` dir or established patterns in-tree), prefer the fix that conforms to them.
- When more than one sound approach exists and the code can't decide between them, list 2–3 options with a one-line trade-off each and mark your recommended one.
- A test-coverage fix may include pseudocode for the missing cases.

## Quick-fix flag

Set `quick-fix: yes` **only** when the fix is unambiguous, mechanical, and needs no design discussion — e.g. wrong log level, missing nil/error check, hard-coded value to extract into config, typo in a config key, dead import. Anything requiring a design choice or trade-off is **not** a quick fix.

## Output

Rewrite the file in place: keep every finding and field untouched, just inserting the `**fix**` (and optional `**quick-fix**`) line into each. Write the fix prose in the caller's **report language** (default 简体中文); keep field labels as-is. Touch nothing else.

**If your file is the whole report** (it has the `# Codebase Audit Report` header), also compile a `## 可直接修复（批量）` section from the findings you flagged `quick-fix: yes`, placed right before `## Findings`; omit it if there are none:

```markdown
## 可直接修复（批量）
> 无需讨论、可一次性清理的机械修复；逐项点到主报告对应 finding。
- [ ] [PREFIX-N] <title> — `path:line` — <one-line fix>
```

**If your file is a single severity bucket slice**, do not build that list — the assembler compiles it across all buckets.

Reply with one line: `fix: <bucket|all> n=<findings> quick=<quick-fix count>`.
