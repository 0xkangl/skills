# Shared: finding format & severity scale

Every dimension auditor reads this, then emits findings in the format below. Keep output dense — no filler, no restating these rules.

## Severity scale

- **P0 — Critical**: exploitable hole, crash/data-loss risk, or a defect breaking a core path. Fix now.
- **P1 — High**: likely production incident, broken core behavior, or a flaw blocking scaling/maintenance.
- **P2 — Medium**: real debt or design smell with no runtime impact yet.
- **P3 — Low**: polish, minor optimization, style.

Your dimension file may tighten this.

## Output

Write one Markdown file to the path the caller gives in `<output>`, in exactly this shape:

```markdown
# {Dimension} — findings

## Strengths
- <concrete thing done well>            ← omit the whole section if none

## Findings
### [{PREFIX}-1] <title>
- **severity**: P0|P1|P2|P3
- **sub-area**: <one of your dimension's sub-areas>
- **location**: `path:line`            ← omit if not pinpointable
- **evidence**: <the code construct that proves this — quote it, don't gesture>
- **risk**: <concrete consequence of leaving it>
- **fix**: <specific change or approach>
- **quick-fix**: yes                    ← include this line ONLY for a mechanical, beyond-debate fix; omit otherwise
```

Rules:
- Write prose fields (title, evidence, risk, fix, strengths) in the caller's **Report language** (default 简体中文); keep field labels, severity codes, and the `[PREFIX-N]` ids as-is.
- Report only what the code you actually read supports; never infer unseen context.
- One finding per real problem — don't pad to cover every sub-area.
- `evidence` is mandatory and must be checkable: an independent verifier will try to refute it.
- No statistics, no summary, no closing notes — the synthesizer aggregates.

## Fix quality

The `fix` field is a recommendation, not a sketch. Hold it to one bar:

- Recommend the **most standard, best-practice** approach that **fits this project's scale** — not the most elaborate. Ignore implementation effort; weigh only correctness and operational fit.
- No speculative abstraction, configurability, or layering beyond what the problem needs — right-size the remedy, never over-engineer it.
- If the project has its own conventions (e.g. a `conventions/` dir or established patterns in-tree), prefer the fix that conforms to them.
- When more than one sound approach exists and the code can't decide between them, list 2–3 options with a one-line trade-off each and mark your recommended one.

## Quick-fix flag

Set `quick-fix: yes` **only** when the fix is unambiguous, mechanical, and needs no design discussion — e.g. wrong log level, missing nil/error check, hard-coded value to extract into config, typo in a config key, dead import. Anything requiring a design choice or trade-off is **not** a quick fix. The synthesizer collects these into one batch list so the user can clear them in a single pass.
