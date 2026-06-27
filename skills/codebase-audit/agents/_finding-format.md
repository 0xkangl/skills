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
```

Rules:
- Write prose fields (title, evidence, risk, strengths) in the caller's **Report language** (default 简体中文); keep field labels, severity codes, and the `[PREFIX-N]` ids as-is.
- Report only what the code you actually read supports; never infer unseen context.
- One finding per real problem — don't pad to cover every sub-area.
- `evidence` is mandatory and must be checkable: an independent verifier will try to refute it.
- **No `fix` field here.** Auditors find and prove; the fix solution is added later (after cross-dimension clustering) by the fix-solution stage, so a remedy sees the whole root-cause group instead of one dimension's slice.
- No statistics, no summary, no closing notes — the synthesizer aggregates.
